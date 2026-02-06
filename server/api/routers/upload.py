from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form
from fastapi.responses import JSONResponse, FileResponse
import pandas as pd
import os
from typing import Dict, Any, Union
import json
from helpers.file_validations.validate import validate_document
from helpers.save_document_data_in_database import save_document_data_in_database
from helpers.save_log_data_in_database import save_log_data_in_database
from models.models import Document, User
from database import SessionLocal
from core.security import get_current_user

import traceback
import numpy as np

from helpers.make_json_serializable import make_json_serializable
from helpers.clean_up.clean_up import clean_document
from helpers.get_time_date import get_time_date

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

def save_cleaned_data_to_files_folder(
    cleaned_data: Union[pd.DataFrame, Dict[str, Any]],
    filename: str,
    workflow_path: str = "",
    create_subdirectories: bool = True
) -> str:
    """
    Save cleaned data (DataFrame or dict) to the files folder with proper directory structure
    
    Args:
        cleaned_data: The cleaned data as DataFrame or dict
        filename: Name of the file to save (preserves original extension)
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
        
        # Determine file extension
        file_ext = os.path.splitext(filename)[1].lower()
        
        # Save based on file type and data type
        if isinstance(cleaned_data, dict):
            # If it's a dict, save as JSON
            with open(full_file_path.replace(file_ext, '.json'), 'w', encoding='utf-8') as f:
                json.dump(cleaned_data, f, ensure_ascii=False, indent=2)
            return full_file_path.replace(file_ext, '.json')
        elif isinstance(cleaned_data, pd.DataFrame):
            # Save DataFrame based on original file extension
            if file_ext == '.csv':
                cleaned_data.to_csv(full_file_path, index=False, encoding='utf-8-sig')
            elif file_ext in ['.xlsx', '.xls']:
                # Use ExcelWriter for Excel files
                with pd.ExcelWriter(full_file_path, engine='openpyxl') as writer:
                    cleaned_data.to_excel(writer, index=False, sheet_name='Sheet1')
            else:
                # Default to CSV if extension is unknown
                cleaned_data.to_csv(full_file_path.replace(file_ext, '.csv'), index=False, encoding='utf-8-sig')
                return full_file_path.replace(file_ext, '.csv')
        else:
            raise ValueError(f"Unsupported cleaned_data type: {type(cleaned_data)}")
        
        return full_file_path
        
    except Exception as e:
        raise Exception(f"Error saving cleaned data to files folder: {str(e)}")


@router.post("/validate")
async def validate_file(
    file: UploadFile = File(...),
    document_type: str = Form(...),
    current_user: User = Depends(get_current_user),
):
    """
    Validate a file against the server schema without saving it.
    """
    temp_path = None
    try:
        if not file.filename.lower().endswith(('.csv', '.xlsx', '.xls')):
            return JSONResponse(
                status_code=400,
                content={
                    "code": -1,
                    "success": False,
                    "msg": "File must be CSV or Excel format",
                    "data": None
                }
            )

        temp_path = os.path.abspath(f"temp_validate_{file.filename}")
        with open(temp_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)

        df = None
        excel_file = None
        validation_results: Dict[str, Any] = {"is_valid": True, "errors": [], "warnings": []}

        if file.filename.lower().endswith(".csv"):
            if document_type == "ECL_CLIENT_LOAN_BALANCES":
                df = pd.read_csv(temp_path, header=None, encoding="utf-8-sig")
            else:
                df = pd.read_csv(temp_path, encoding="utf-8-sig")
                df.columns = df.columns.str.strip().str.lower()
        else:
            excel_file = pd.ExcelFile(temp_path)
            sheet_names = excel_file.sheet_names
            if document_type == "ECL_CLIENT_LOAN_BALANCES":
                df = pd.read_excel(excel_file, sheet_name=sheet_names[0], header=None)
            else:
                df = pd.read_excel(excel_file, sheet_name=sheet_names[0])
                df.columns = df.columns.str.strip().str.lower()

        try:
            cleaned_data = clean_document(df, document_type, file.filename, temp_path)
            if cleaned_data is None:
                cleaned_df = df
            elif isinstance(cleaned_data, dict):
                cleaned_df = df
            elif isinstance(cleaned_data, pd.DataFrame):
                cleaned_df = cleaned_data
            else:
                cleaned_df = df

            if file.filename.lower().endswith(".csv"):
                validation_results = validate_document(cleaned_df, document_type, file.filename)
            else:
                if excel_file is not None and len(excel_file.sheet_names) > 1:
                    validation_results = validate_document(None, document_type, file.filename, excel_file)
                else:
                    validation_results = validate_document(cleaned_df, document_type, file.filename)
        finally:
            if excel_file is not None:
                excel_file.close()

        status = str(validation_results.get("validation_status", "passed")).lower()
        ok = status == "passed" or bool(validation_results.get("is_valid", False))

        return JSONResponse(
            status_code=200 if ok else 400,
            content=make_json_serializable({
                "code": 1 if ok else -1,
                "success": bool(ok),
                "msg": "Validation passed" if ok else "Validation failed",
                "data": {"validation_results": validation_results},
            })
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Error validating file: {str(e)}",
                "data": None
            }
        )
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

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
    
    Args:
        file: The uploaded file (CSV or Excel)
        document_type: Type of document for validation rules
        workflow_path: Path to the workflow directory
        workflow_id: ID of the workflow this document belongs to
        current_user: Current authenticated user
        override: Whether to override existing files (default: False)
    
    Returns:
        Upload results including validation and database save status
    """
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
        temp_path = os.path.abspath(f"temp_{file.filename}")
        with open(temp_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)

        try:
            df = None
            excel_file = None
            validation_results: Dict[str, Any] = {"is_valid": True, "errors": [], "warnings": []}

            # Step 1: Read file fully
            if file.filename.lower().endswith(".csv"):
                # Special handling for ECL_CLIENT_LOAN_BALANCES
                if document_type == "ECL_CLIENT_LOAN_BALANCES":
                    # Read with header=None to access all rows
                    df = pd.read_csv(temp_path, header=None, encoding="utf-8-sig")
                else:
                    # Read CSV fully (no chunking) - default behavior
                    df = pd.read_csv(temp_path, encoding="utf-8-sig")
                    df.columns = df.columns.str.strip().str.lower()
                excel_file = None
                sheet_names = []
            else:
                # Read Excel fully using context manager
                excel_file = pd.ExcelFile(temp_path)
                sheet_names = excel_file.sheet_names
                
                # Special handling for ECL_CLIENT_LOAN_BALANCES
                if document_type == "ECL_CLIENT_LOAN_BALANCES":
                    # Read with header=None to access all rows
                    df = pd.read_excel(excel_file, sheet_name=sheet_names[0], header=None)
                else:
                    # For multi-sheet docs, we'll handle validation separately
                    # but still read first sheet for cleaning/persistence
                    df = pd.read_excel(excel_file, sheet_name=sheet_names[0])
                    df.columns = df.columns.str.strip().str.lower()

            try:
                # Step 2: Clean the data first
                print(f"Raw DataFrame shape: {None if df is None else df.shape}")
                cleaned_data = clean_document(df, document_type, file.filename, temp_path)
                
                # Handle cleaned_data - it can be DataFrame, dict, or None
                if cleaned_data is None:
                    # No cleaning needed or cleaning returned None
                    cleaned_df = df
                elif isinstance(cleaned_data, dict):
                    # Some cleaning functions return dict (e.g., multi-sheet handling)
                    # For now, keep original df for validation, but use dict for storage
                    cleaned_df = df
                elif isinstance(cleaned_data, pd.DataFrame):
                    # Cleaning returned a DataFrame
                    cleaned_df = cleaned_data
                else:
                    # Fallback to original df
                    cleaned_df = df

                print(f"Cleaned DataFrame shape: {None if cleaned_df is None else cleaned_df.shape}")
                print('cleaned_df \n', cleaned_df)

                # Step 3: Validate the cleaned data
                if file.filename.lower().endswith(".csv"):
                    print('CSV VALIDATION')
                    # Validate cleaned CSV DataFrame
                    validation_results = validate_document(cleaned_df, document_type, file.filename, workflow_id)
                else:
                    print('EXCEL VALIDATION')
                    # Excel validation
                    if len(sheet_names) > 1:
                        print('MULTI-SHEET VALIDATION')
                        # Multi-sheet: pass excel_file to validator
                        validation_results = validate_document(None, document_type, file.filename, excel_file, workflow_id)
                    else:
                        print('SINGLE-SHEET VALIDATION')
                        # Single sheet: validate cleaned DataFrame
                        validation_results = validate_document(cleaned_df, document_type, file.filename, excel_file, workflow_id)
            finally:
                # Ensure ExcelFile is closed
                if excel_file is not None:
                    excel_file.close()

            # Step 4: Gate on validation & override
            if (not is_validation_ok(validation_results)) and (not override):
                response_data = {
                    "code": -1,
                    "success": False,
                    "msg": "Found errors on file.",
                    "data": {"validation_results": validation_results}
                }
                response_data = make_json_serializable(response_data)
                return JSONResponse(status_code=400, content=response_data)

            # Step 5: Prepare data for persistence
            print(f"Final DataFrame shape: {None if cleaned_df is None else cleaned_df.shape}")

            # get file.filename extension
            extension = file.filename.split('.')[-1]
            final_filename = f"{file.filename.replace('.'+extension, '')}_{get_time_date()}.{extension}"
            if cleaned_df is None:
                # Some multi-sheet flows may not need a single-sheet df; keep a harmless empty json
                file_data_json = "[]"
                document_data_dict = []
                # Save original file if no cleaned data
                saved_file_path = save_file_to_files_folder(
                    file_content=content,
                    filename=final_filename,
                    workflow_path=workflow_path,
                    create_subdirectories=True
                )
            else:
                # Use cleaned_data if it's a dict, otherwise use cleaned_df
                if isinstance(cleaned_data, dict):
                    file_data_json = json.dumps(cleaned_data, ensure_ascii=False, indent=2)
                    document_data_dict = cleaned_data  # Store as dict, not JSON string
                    # Save cleaned dict as JSON
                    saved_file_path = save_cleaned_data_to_files_folder(
                        cleaned_data=cleaned_data,
                        filename=final_filename,
                        workflow_path=workflow_path,
                        create_subdirectories=True
                    )
                else:
                    # Replace NaN with None for JSON compliance
                    cleaned_df = cleaned_df.where(pd.notna(cleaned_df), None)
                    file_data_json = cleaned_df.to_json(orient='records')
                    document_data_dict = cleaned_df.to_json(orient='records')
                    # Save cleaned DataFrame
                    saved_file_path = save_cleaned_data_to_files_folder(
                        cleaned_data=cleaned_df,
                        filename=final_filename,
                        workflow_path=workflow_path,
                        create_subdirectories=True
                    )

            # Create database connection only when needed
            db = SessionLocal()
            try:
                # logs table
                log_record_id = None
                try:
                    log_record_id = save_log_data_in_database(
                        module=module,
                        submodule=submodule,
                        workflow_id=workflow_id,
                        user_id=current_user.id,
                        log_data={
                            "filename": final_filename,
                            "document_type": document_type,
                            "workflow_path": workflow_path,
                            "validation_results": validation_results
                        }
                    )
                except Exception as e:
                    print(f"Warning: Could not save to log table: {e}")

                # overlay table
                record_id = None
                try:
                    record_id = save_document_data_in_database(
                        document_type=document_type,
                        document_data=document_data_dict,
                        workflow_id=workflow_id,
                        user_id=current_user.id,
                        log_id=log_record_id
                    )
                except Exception as e:
                    print(f"Warning: Could not save to table: {e}")

                # documents table
                new_document = Document(
                    filename=final_filename,
                    workflow_path=workflow_path,
                    user_id=current_user.id,
                    json_data=file_data_json,
                    document_type=document_type,
                    version=1,
                    workflow_id=workflow_id
                )
                db.add(new_document)
                db.commit()
                db.refresh(new_document)
                
            except Exception as e:
                db.rollback()
                raise
            finally:
                db.close()

            response_data = {
                "code": 1,
                "success": True,
                "msg": "File created successfully",
                "data": {
                    "document_id": new_document.id,
                    "filename": final_filename,
                    "workflow_path": workflow_path,
                    "document_type": document_type,
                    "version": 1,
                    "action": "created",
                    "saved_file_path": saved_file_path,
                    "log_record_id": log_record_id,
                    "record_id": record_id,
                    "validation_results": validation_results
                }
            }
            response_data = make_json_serializable(response_data)
            return JSONResponse(status_code=200, content=response_data)

        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"code": -1, "success": False, "msg": f"Error uploading file: {str(e)}", "data": None}
        )

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

