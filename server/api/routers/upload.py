from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form
from fastapi.responses import JSONResponse, FileResponse
import pandas as pd
import os
from typing import Dict, Any
import json
from helpers.file_validations.validate import validate_document
from helpers.file_validations.flowrate_validation import validate_collection_rate_multiple_sheets
from helpers.save_document_data_in_database import save_document_data_in_database
from helpers.save_log_data_in_database import save_log_data_in_database
from models.models import Document, User
from database import SessionLocal
from core.security import get_current_user

import traceback
import numpy as np

from helpers.make_json_serializable import make_json_serializable

router = APIRouter(
    prefix="/api/document",
    tags=["document", "upload"]
)



def save_file_to_files_folder(
    file_content: bytes,
    filename: str,
    workflow_path: str = "",
    create_subdirectories: bool = True
) -> str:
    """
    Save file content to the files folder with proper directory structure
    
    Args:
        file_content: The file content as bytes
        filename: Name of the file to save
        workflow_path: Path within the files folder (e.g., "Entity 1/Monthly/Workflow1")
        create_subdirectories: Whether to create subdirectories if they don't exist
    
    Returns:
        str: Full path where the file was saved
    """
    try:
        # Define the base files directory
        base_files_dir = "files"
        
        # Create the full directory path
        if workflow_path:
            full_dir_path = os.path.join(base_files_dir, workflow_path)
        else:
            full_dir_path = base_files_dir
        
        # Create directories if they don't exist
        if create_subdirectories:
            os.makedirs(full_dir_path, exist_ok=True)
        
        # Create the full file path
        full_file_path = os.path.join(full_dir_path, filename)
        
        # Save the file
        with open(full_file_path, "wb") as buffer:
            buffer.write(file_content)
        
        return full_file_path
        
    except Exception as e:
        raise Exception(f"Error saving file to files folder: {str(e)}")

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    document_type: str = Form(...),
    workflow_path: str = Form(...),
    workflow_id: int = Form(...),
    current_user: User = Depends(get_current_user),
    override: bool = Form(False),
    module: str = Form(...),
    submodule: str = Form(''),
    chunk_size: int = Form(10000)
):
    """
    Upload and save a file to the database
    """
    db = SessionLocal()

    # --- helper to normalize validation status ---
    def is_validation_ok(vr: Dict[str, Any]) -> bool:
        if not isinstance(vr, dict):
            return True
        # support both shapes: {"is_valid": bool} OR {"validation_status": "passed"/"failed"/"error"}
        if "is_valid" in vr:
            try:
                return bool(vr["is_valid"])
            except Exception:
                pass
        status = str(vr.get("validation_status", "passed")).lower()
        return status == "passed"

    try:
        # extension guard
        if not file.filename.lower().endswith(('.csv', '.xlsx', '.xls')):
            return JSONResponse(
                status_code=400,
                content={"code": -1, "success": False, "msg": "File must be CSV or Excel format", "data": None}
            )

        # write temp file
        temp_path = f"temp_{file.filename}"
        with open(temp_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)

        try:
            CHUNK_SIZE = chunk_size
            df = None
            validation_results: Dict[str, Any] = {"is_valid": True, "errors": [], "warnings": []}

            if file.filename.lower().endswith(".csv"):
                # ---- CSV with chunking ----
                df_chunks = []
                total_rows_processed = 0
                for chunk_num, chunk in enumerate(pd.read_csv(temp_path, chunksize=CHUNK_SIZE)):
                    chunk.columns = chunk.columns.str.strip().str.lower()
                    df_chunks.append(chunk)
                    total_rows_processed += len(chunk)

                    # validate per-chunk
                    chunk_validation = validate_document(chunk, document_type, file.filename)
                    if not is_validation_ok(chunk_validation):
                        validation_results["is_valid"] = False
                    # merge child results if present
                    if isinstance(chunk_validation, dict):
                        validation_results.setdefault("errors", []).extend(chunk_validation.get("errors", []))
                        validation_results.setdefault("warnings", []).extend(chunk_validation.get("warnings", []))

                # combine chunks for persistence
                df = pd.concat(df_chunks, ignore_index=True) if df_chunks else pd.DataFrame()

            else:
                # ---- Excel ----
                # NOTE: Excel chunking is tricky/expensive. Read fully and validate once for reliability.
                with pd.ExcelFile(temp_path) as excel_file:
                    sheet_names = excel_file.sheet_names

                    # If multi-sheet doc (e.g., Collection Rate / Detailed by Product), let validator handle it.
                    if len(sheet_names) > 1:
                        validation_results = validate_document(None, document_type, file.filename, excel_file)
                        # still pick first sheet to persist into overlay (same as your original intent)
                        df = pd.read_excel(excel_file, sheet_name=sheet_names[0])
                        df.columns = df.columns.str.strip().str.lower()
                    else:
                        df = pd.read_excel(excel_file, sheet_name=sheet_names[0])
                        df.columns = df.columns.str.strip().str.lower()
                        validation_results = validate_document(df, document_type, file.filename)

            # --- gate on validation & override ---
            if (not is_validation_ok(validation_results)) and (not override):
                response_data = {
                    "code": -1,
                    "success": False,
                    "msg": "Found errors on file.",
                    "data": {"validation_results": validation_results}
                }
                response_data = make_json_serializable(response_data)
                return JSONResponse(status_code=400, content=response_data)

            # --- persist (file + db) ---
            print(f"Final DataFrame shape: {None if df is None else df.shape}")
            if df is None:
                # Some multi-sheet flows may not need a single-sheet df; keep a harmless empty json
                file_data_json = "[]"
                document_data_dict = []
            else:
                file_data_json = df.to_json(orient='records')
                document_data_dict = df.to_dict(orient='records')
                del df

            saved_file_path = save_file_to_files_folder(
                file_content=content,
                filename=file.filename,
                workflow_path=workflow_path,
                create_subdirectories=True
            )

            # logs table
            log_record_id = None
            try:
                log_record_id = save_log_data_in_database(
                    module=module,
                    submodule=submodule,
                    workflow_id=workflow_id,
                    user_id=current_user.id,
                    log_data={
                        "filename": file.filename,
                        "document_type": document_type,
                        "workflow_path": workflow_path,
                        "validation_results": validation_results
                    }
                )
            except Exception as e:
                print(f"Warning: Could not save to log table: {e}")

            # overlay table
            overlay_record_id = None
            try:
                overlay_record_id = save_document_data_in_database(
                    document_type=document_type,
                    document_data=document_data_dict,
                    workflow_id=workflow_id,
                    user_id=current_user.id,
                    log_id=log_record_id
                )
            except Exception as e:
                print(f"Warning: Could not save to overlay table: {e}")

            # documents table
            new_document = Document(
                filename=file.filename,
                workflow_path=workflow_path,
                user_id=current_user.id,
                json_data=file_data_json,
                document_type=document_type,
                version=1,
                workflow_id=workflow_id or 0
            )
            db.add(new_document)
            db.commit()
            db.refresh(new_document)

            response_data = {
                "code": 1,
                "success": True,
                "msg": "File created successfully",
                "data": {
                    "document_id": new_document.id,
                    "filename": file.filename,
                    "workflow_path": workflow_path,
                    "document_type": document_type,
                    "version": 1,
                    "action": "created",
                    "saved_file_path": saved_file_path,
                    "log_record_id": log_record_id,
                    "overlay_record_id": overlay_record_id,
                    "validation_results": validation_results
                }
            }
            response_data = make_json_serializable(response_data)
            return JSONResponse(status_code=200, content=response_data)

        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    except Exception as e:
        db.rollback()
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"code": -1, "success": False, "msg": f"Error uploading file: {str(e)}", "data": None}
        )
    finally:
        db.close()

# @router.get("/documents")
# async def get_documents(
#     current_user: User = Depends(get_current_user),
#     workflow_path: str = "",
#     document_type: str = None
# ):
#     """
#     Get uploaded documents for the current user
    
#     Args:
#         workflow_path: Filter by workflow path (optional)
#         document_type: Filter by document type (optional)
#         current_user: Current authenticated user
    
#     Returns:
#         List of documents
#     """
#     db = SessionLocal()
#     try:
#         query = db.query(Document).filter(Document.user_id == current_user.id)
        
#         if workflow_path:
#             query = query.filter(Document.workflow_path == workflow_path)
        
#         if document_type:
#             query = query.filter(Document.document_type == document_type)
        
#         documents = query.order_by(Document.created_at.desc()).all()
        
#         documents_data = []
#         for doc in documents:
#             documents_data.append({
#                 "id": doc.id,
#                 "filename": doc.filename,
#                 "workflow_path": doc.workflow_path,
#                 "document_type": doc.document_type,
#                 "version": doc.version,
#                 "workflow_id": doc.workflow_id,
#                 "created_at": doc.created_at.isoformat(),
#                 "updated_at": doc.updated_at.isoformat()
#             })
        
#         return JSONResponse(
#             status_code=200,
#             content={
#                 "code": 1,
#                 "success": True,
#                 "msg": "Documents retrieved successfully",
#                 "data": {
#                     "documents": documents_data,
#                     "total_count": len(documents_data)
#                 }
#             }
#         )
        
#     except Exception as e:
#         return JSONResponse(
#             status_code=500,
#             content={
#                 "code": -1,
#                 "success": False,
#                 "msg": f"Error retrieving documents: {str(e)}",
#                 "data": None
#             }
#         )
#     finally:
#         db.close()

# @router.get("/document/{document_id}")
# async def get_document(
#     document_id: int,
#     current_user: User = Depends(get_current_user)
# ):
#     """
#     Get a specific document by ID
    
#     Args:
#         document_id: ID of the document to retrieve
#         current_user: Current authenticated user
    
#     Returns:
#         Document data including JSON content
#     """
#     db = SessionLocal()
#     try:
#         document = db.query(Document).filter(
#             Document.id == document_id,
#             Document.user_id == current_user.id
#         ).first()
        
#         if not document:
#             return JSONResponse(
#                 status_code=404,
#                 content={
#                     "code": -1,
#                     "success": False,
#                     "msg": "Document not found",
#                     "data": None
#                 }
#             )
        
#         # Parse JSON data
#         json_data = None
#         if document.json_data:
#             try:
#                 json_data = json.loads(document.json_data)
#             except json.JSONDecodeError:
#                 json_data = None
        
#         return JSONResponse(
#             status_code=200,
#             content={
#                 "code": 1,
#                 "success": True,
#                 "msg": "Document retrieved successfully",
#                 "data": {
#                     "id": document.id,
#                     "filename": document.filename,
#                     "workflow_path": document.workflow_path,
#                     "document_type": document.document_type,
#                     "version": document.version,
#                     "workflow_id": document.workflow_id,
#                     "created_at": document.created_at.isoformat(),
#                     "updated_at": document.updated_at.isoformat(),
#                     "json_data": json_data
#                 }
#             }
#         )
        
#     except Exception as e:
#         return JSONResponse(
#             status_code=500,
#             content={
#                 "code": -1,
#                 "success": False,
#                 "msg": f"Error retrieving document: {str(e)}",
#                 "data": None
#             }
#         )
#     finally:
#         db.close()

# @router.delete("/document/{document_id}")
# async def delete_document(
#     document_id: int,
#     current_user: User = Depends(get_current_user)
# ):
#     """
#     Delete a document by ID
    
#     Args:
#         document_id: ID of the document to delete
#         current_user: Current authenticated user
    
#     Returns:
#         Deletion confirmation
#     """
#     db = SessionLocal()
#     try:
#         document = db.query(Document).filter(
#             Document.id == document_id,
#             Document.user_id == current_user.id
#         ).first()
        
#         if not document:
#             return JSONResponse(
#                 status_code=404,
#                 content={
#                     "code": -1,
#                     "success": False,
#                     "msg": "Document not found",
#                     "data": None
#                 }
#             )
        
#         db.delete(document)
#         db.commit()
        
#         return JSONResponse(
#             status_code=200,
#             content={
#                 "code": 1,
#                 "success": True,
#                 "msg": "Document deleted successfully",
#                 "data": {
#                     "deleted_document_id": document_id,
#                     "filename": document.filename
#                 }
#             }
#         )
        
#     except Exception as e:
#         db.rollback()
#         return JSONResponse(
#             status_code=500,
#             content={
#                 "code": -1,
#                 "success": False,
#                 "msg": f"Error deleting document: {str(e)}",
#                 "data": None
#             }
#         )
#     finally:
#         db.close()

# @router.get("/download/{document_id}")
# async def download_document(
#     document_id: int,
#     current_user: User = Depends(get_current_user)
# ):
#     """
#     Download a document file from the files folder
    
#     Args:
#         document_id: ID of the document to download
#         current_user.id: Current authenticated user ID
    
#     Returns:
#         File download response
#     """
#     db = SessionLocal()
#     try:
#         document = db.query(Document).filter(
#             Document.id == document_id,
#             Document.user_id == current_user.id
#         ).first()
        
#         if not document:
#             return JSONResponse(
#                 status_code=404,
#                 content={
#                     "code": -1,
#                     "success": False,
#                     "msg": "Document not found",
#                     "data": None
#                 }
#             )
        
#         # Construct the file path
#         if document.workflow_path:
#             file_path = os.path.join("files", document.workflow_path, document.filename)
#         else:
#             file_path = os.path.join("files", document.filename)
        
#         # Check if file exists
#         if not os.path.exists(file_path):
#             return JSONResponse(
#                 status_code=404,
#                 content={
#                     "code": -1,
#                     "success": False,
#                     "msg": "File not found in files folder",
#                     "data": None
#                 }
#             )
        
#         # Return the file for download
#         return FileResponse(
#             path=file_path,
#             filename=document.filename,
#             media_type='application/octet-stream'
#         )
        
#     except Exception as e:
#         return JSONResponse(
#             status_code=500,
#             content={
#                 "code": -1,
#                 "success": False,
#                 "msg": f"Error downloading document: {str(e)}",
#                 "data": None
#             }
#         )
#     finally:
#         db.close()

# @router.post("/save-file")
# async def save_file_only(
#     workflow_path: str,
#     current_user: User = Depends(get_current_user),
#     file: UploadFile = File(...)
# ):
#     """
#     Save file to files folder without database storage
    
#     Args:
#         file: The uploaded file
#         workflow_path: Path within the files folder
#         current_user.id: Current authenticated user ID
    
#     Returns:
#         File save confirmation
#     """
#     try:
#         # Check file extension
#         if not file.filename.lower().endswith(('.csv', '.xlsx', '.xls', '.txt', '.pdf', '.doc', '.docx')):
#             return JSONResponse(
#                 status_code=400,
#                 content={
#                     "code": -1,
#                     "success": False,
#                     "msg": "File format not supported",
#                     "data": None
#                 }
#             )
        
#         # Read file content
#         content = await file.read()
        
#         # Save file to files folder
#         saved_file_path = save_file_to_files_folder(
#             file_content=content,
#             filename=file.filename,
#             workflow_path=workflow_path,
#             create_subdirectories=True
#         )
        
#         return JSONResponse(
#             status_code=200,
#             content={
#                 "code": 1,
#                 "success": True,
#                 "msg": "File saved successfully",
#                 "data": {
#                     "filename": file.filename,
#                     "workflow_path": workflow_path,
#                     "saved_file_path": saved_file_path,
#                     "file_size": len(content)
#                 }
#             }
#         )
        
#     except Exception as e:
#         return JSONResponse(
#             status_code=500,
#             content={
#                 "code": -1,
#                 "success": False,
#                 "msg": f"Error saving file: {str(e)}",
#                 "data": None
#             }
#         )

