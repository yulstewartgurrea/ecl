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
    chunk_size: int = Form(10000)  # Configurable chunk size, default 10k rows
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
        chunk_size: Number of rows to process at a time (default: 10000)
    
    Returns:
        Upload results including validation and database save status
    """
    db = SessionLocal()
    try:
        # Check file extension
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
        
        # Save temporary file to read with pandas
        temp_path = f"temp_{file.filename}"
        with open(temp_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        try:
            # Read file based on extension with chunking for large files
            CHUNK_SIZE = chunk_size  # Use configurable chunk size
            
            if file.filename.lower().endswith('.csv'):
                # Read CSV in chunks
                df_chunks = []
                validation_results = {"errors": [], "warnings": [], "is_valid": True}
                total_rows_processed = 0
                
                print(f"Processing CSV file in chunks of {CHUNK_SIZE} rows...")
                
                for chunk_num, chunk in enumerate(pd.read_csv(temp_path, chunksize=CHUNK_SIZE)):
                    chunk.columns = chunk.columns.str.strip().str.lower()
                    df_chunks.append(chunk)
                    total_rows_processed += len(chunk)
                    
                    print(f"Processed chunk {chunk_num + 1}: {len(chunk)} rows (Total: {total_rows_processed})")
                    
                    # Validate each chunk
                    chunk_validation = validate_document(chunk, document_type, file.filename)
                    if not chunk_validation.get("is_valid", True):
                        validation_results["is_valid"] = False
                        validation_results["errors"].extend(chunk_validation.get("errors", []))
                    validation_results["warnings"].extend(chunk_validation.get("warnings", []))
                    
                    # Clear chunk from memory after processing
                    del chunk
                
                print(f"Combining {len(df_chunks)} chunks...")
                # Combine all chunks
                df = pd.concat(df_chunks, ignore_index=True)
                
                # Clear chunks from memory
                del df_chunks
                
            else:
                # For Excel files, read all sheets with chunking
                with pd.ExcelFile(temp_path) as excel_file:
                    sheet_names = excel_file.sheet_names
                    
                    # If it's a collection rate document with multiple sheets, handle specially
                    if len(sheet_names) > 1:
                        validation_results = validate_document(excel_file, document_type, file.filename)
                        # For multi-sheet files, we'll use the first sheet for database storage
                        df = pd.read_excel(excel_file, sheet_name=sheet_names[0])
                        df.columns = df.columns.str.strip().str.lower()
                    else:
                        # For other documents or single sheet Excel files, use first sheet with chunking
                        df_chunks = []
                        validation_results = {"errors": [], "warnings": [], "is_valid": True}
                        
                        # Read Excel in chunks (Excel doesn't support native chunking, so we'll read in batches)
                        try:
                            print(f"Processing Excel file in chunks of {CHUNK_SIZE} rows...")
                            
                            # First, get the total number of rows
                            total_rows = len(pd.read_excel(excel_file, sheet_name=sheet_names[0], nrows=0))
                            print(f"Total rows in Excel file: {total_rows}")
                            
                            # Read in chunks
                            for start_row in range(0, total_rows, CHUNK_SIZE):
                                chunk = pd.read_excel(
                                    excel_file, 
                                    sheet_name=sheet_names[0], 
                                    skiprows=start_row, 
                                    nrows=CHUNK_SIZE
                                )
                                
                                if chunk.empty:
                                    break
                                    
                                chunk.columns = chunk.columns.str.strip().str.lower()
                                df_chunks.append(chunk)
                                
                                print(f"Processed Excel chunk starting at row {start_row}: {len(chunk)} rows")
                                
                                # Validate each chunk
                                chunk_validation = validate_document(chunk, document_type, file.filename)
                                if not chunk_validation.get("is_valid", True):
                                    validation_results["is_valid"] = False
                                    validation_results["errors"].extend(chunk_validation.get("errors", []))
                                validation_results["warnings"].extend(chunk_validation.get("warnings", []))
                                
                                # Clear chunk from memory after processing
                                del chunk
                            
                            print(f"Combining {len(df_chunks)} Excel chunks...")
                            # Combine all chunks
                            df = pd.concat(df_chunks, ignore_index=True)
                            
                            # Clear chunks from memory
                            del df_chunks
                            
                        except Exception as e:
                            # Fallback to reading entire file if chunking fails
                            print(f"Chunking failed, reading entire file: {e}")
                            df = pd.read_excel(excel_file, sheet_name=sheet_names[0])
                            df.columns = df.columns.str.strip().str.lower()
                            validation_results = validate_document(df, document_type, file.filename)

            if not override:
                response_data = {
                    "code": -1,
                    "success": False,
                    "msg": "Found errors on file.",
                    "data": {
                        "validation_results": validation_results
                    }
                }
                response_data = make_json_serializable(response_data)
                return JSONResponse(
                    status_code=400,
                    content=response_data
                )
            
            print(f"Final DataFrame shape: {df.shape}")
            print(f"Memory usage: {df.memory_usage(deep=True).sum() / 1024 / 1024:.2f} MB")
            
            # Convert DataFrame to JSON for storage
            print("Converting DataFrame to JSON...")
            file_data_json = df.to_json(orient='records')
            
            # Convert DataFrame to dictionary for overlay table storage
            print("Converting DataFrame to dictionary...")
            document_data_dict = df.to_dict(orient='records')
            
            # Clear DataFrame from memory after conversion
            del df
            
            # Save file to files folder
            saved_file_path = save_file_to_files_folder(
                file_content=content,
                filename=file.filename,
                workflow_path=workflow_path,
                create_subdirectories=True
            )
            
            # Save log data first
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
                # Continue with document creation even if log save fails
            
            print("log_record_id", log_record_id)
            # Save document data in appropriate overlay table
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
                # Continue with document creation even if overlay save fails
            
            # Create new document
            new_document = Document(
                filename=file.filename,
                workflow_path=workflow_path,
                user_id=current_user.id,
                json_data=file_data_json,
                document_type=document_type,
                version=1,
                workflow_id=workflow_id or 0  # Default to 0 if not provided
            )
            
            db.add(new_document)
            db.commit()
            db.refresh(new_document)
            
            document_id = new_document.id
            action = "created"
            
            
            response_data = {
                "code": 1,
                "success": True,
                "msg": f"File {action} successfully",
                "data": {
                    "document_id": document_id,
                    "filename": file.filename,
                    "workflow_path": workflow_path,
                    "document_type": document_type,
                    "version": 1,
                    "action": action,
                    "saved_file_path": saved_file_path,
                    "log_record_id": log_record_id,
                    "overlay_record_id": overlay_record_id,
                    "validation_results": validation_results
                }
            }
            
            # Make the response JSON serializable
            response_data = make_json_serializable(response_data)
            
            return JSONResponse(
                status_code=200,
                content=response_data
            )
            
        finally:
            # Clean up temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)
        
    except Exception as e:
        db.rollback()
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Error uploading file: {str(e)}",
                "data": None
            }
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

