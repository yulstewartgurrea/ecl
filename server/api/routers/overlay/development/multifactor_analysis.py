import os
import traceback
import threading
import pandas as pd
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Form, Query, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import Dict, Any

from models.models import User, Workflow, Document
from models.overlay.development import (
    OverlayLogs,
    OverlayDevelopmentMultifactorAnalysisJob
)
from core.security import get_current_user
from data_processing.overlay.development.multifactor_analysis import (
    load_transformed_data,
    load_combinations,
    run_mfa)

from database import SessionLocal

from sqlalchemy import func, desc, case, or_
from sqlalchemy.orm import aliased

from helpers.get_root_folder import get_root_folder
from helpers.get_time_date import get_time_date
from helpers.make_json_serializable import make_json_serializable
from helpers.pagination import create_pagination_response, validate_pagination_params

from pathlib import Path

router = APIRouter(prefix="/api/overlay/development", tags=["overlay-development"])

def run_multifactor_analysis_background(job_id: int, workflow_id: int, user_id: int, 
                                        target_variable: str, num_vars_taken: int, 
                                        max_bgtest_order: int):
    """
    Background function that runs the multifactor analysis process
    and updates progress in the database
    """
    db = SessionLocal()
    try:
        # Update job status to processing
        job = db.query(OverlayDevelopmentMultifactorAnalysisJob).filter(
            OverlayDevelopmentMultifactorAnalysisJob.id == job_id
        ).first()
        
        if not job:
            print(f"Job {job_id} not found")
            return
        
        # Mark job as started and record start time
        job.status = "processing"
        job.progress = 0
        job.message = "Initializing..."
        job.started_at = datetime.utcnow()
        db.commit()
        
        # Get required data
        workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
        log_record = db.query(OverlayLogs).filter(
            OverlayLogs.workflow_id == workflow_id,
            OverlayLogs.submodule == "DEVELOPMENT"
        ).first()
        
        # Helper function to calculate and set running time
        def set_running_time():
            if job.started_at:
                completed_time = datetime.utcnow()
                running_time = (completed_time - job.started_at).total_seconds()
                job.completed_at = completed_time
                job.running_time_seconds = int(running_time)
        
        if not workflow or not log_record:
            set_running_time()
            job.status = "failed"
            job.error_message = "Required workflow or log record not found"
            db.commit()
            return
        
        # Helper function to check if job is cancelled
        def check_cancellation():
            db.refresh(job)
            if job.status == "cancelled":
                return True
            return False
        
        # Progress callback function with cancellation check
        def update_progress(progress: int, message: str):
            # Check for cancellation before updating progress
            if check_cancellation():
                raise Exception("Job cancelled by user")
            job.progress = progress
            job.message = message
            db.commit()
            db.refresh(job)
        
        # Check for cancellation before starting
        if check_cancellation():
            set_running_time()
            print(f"Job {job_id} was cancelled before processing started")
            return
        
        portfolio = workflow.loan_product
        ODR = target_variable
        
        data_transformation_path = (
            f"{get_root_folder()}/files/"
            f"{workflow.entity}/"
            f"{workflow.reporting_period}/"
            f"{workflow.workflow_name}/"
            f"output/overlay/development/{portfolio}/data_transformation"
        )
        
        # Step 1 — load data
        update_progress(10, "Loading transformed data...")
        if check_cancellation():
            set_running_time()
            return
        
        x_df, y_df, regression_data, x_names, y_names = load_transformed_data(workflow, data_transformation_path)
        
        # Step 2 — load combinations to run
        update_progress(20, "Loading variable combinations...")
        if check_cancellation():
            set_running_time()
            return
        
        mfa_runs = load_combinations(
            portfolio=portfolio,
            num_vars_taken=num_vars_taken,
            folder_path=data_transformation_path,
            limit=None,
        )
        num_comb = mfa_runs.shape[0]
        print(f"Number of combinations: {num_comb}")
        
        # Step 3 — prepare output path
        update_progress(30, f"Preparing to process {num_comb} combinations...")
        if check_cancellation():
            set_running_time()
            return
        
        pid = os.getpid()
        multifactor_analysis_output_path = (
            f"{get_root_folder()}/files/"
            f"{workflow.entity}/"
            f"{workflow.reporting_period}/"
            f"{workflow.workflow_name}/"
            f"output/overlay/development/{portfolio}/multifactor_analysis"
        )
        out_csv = Path(f"{multifactor_analysis_output_path}/{portfolio}_mfa_{ODR}_{num_vars_taken}-var_{pid}_{get_time_date()}.csv")
        
        # Step 4 — run MFA with progress tracking
        try:
            run_mfa(
                dep_var=ODR,
                combinations=mfa_runs,
                regression_data=regression_data,
                max_bg_order=max_bgtest_order,
                out_csv_path=out_csv,
                flush_every=100,
                progress_callback=update_progress,
                cancellation_check=check_cancellation,
                total_combinations=num_comb
            )
        except Exception as e:
            if "cancelled" in str(e).lower() or job.status == "cancelled":
                db.refresh(job)
                if job.status == "cancelled":
                    set_running_time()
                    job.message = "Cancelled by user"
                    db.commit()
                    print(f"Job {job_id} was cancelled during processing")
                    return
            raise  # Re-raise if it's a different error
        
        # Check cancellation after processing
        if check_cancellation():
            set_running_time()
            return
        
        # Mark job as completed
        set_running_time()
        job.status = "completed"
        job.progress = 100
        job.message = f"Multifactor analysis completed successfully. Processed {num_comb} combinations."
        db.commit()
        
        print(f"Job {job_id} completed successfully in {job.running_time_seconds} seconds")
        
    except Exception as e:
        traceback.print_exc()
        db.rollback()
        try:
            job = db.query(OverlayDevelopmentMultifactorAnalysisJob).filter(
                OverlayDevelopmentMultifactorAnalysisJob.id == job_id
            ).first()
            if job:
                # Calculate running time if job was started
                if job.started_at:
                    completed_time = datetime.utcnow()
                    running_time = (completed_time - job.started_at).total_seconds()
                    job.completed_at = completed_time
                    job.running_time_seconds = int(running_time)
                
                # Only update status if not already cancelled
                if job.status != "cancelled":
                    job.status = "failed"
                    job.error_message = str(e)
                db.commit()
        except:
            pass
        print(f"Job {job_id} failed: {str(e)}")
    finally:
        db.close()

@router.post("/multifactor_analysis")
async def process_multifactor_analysis(
    workflow_id: int = Form(...),
    target_variable: str = Form('odr.logit', description="Target variable (e.g., odr.logit)"),
    num_vars_taken: int = Form(2, description="Number of variables per combination"),
    max_combinations: int = Form(5, description="Maximum number of combinations to test"),
    max_bgtest_order: int = Form(2, description="Maximum order for Breusch-Godfrey test"),
    current_user: User = Depends(get_current_user)
):
    """
    Start multifactor analysis (MFA) for credit risk modeling - returns immediately with job_id for status polling
    
    This endpoint runs a parallel multiple linear regression analysis to find the best
    combination of variables for predicting loan defaults.
    """
    try:
        db = SessionLocal()
        try:
            workflow = db.query(Workflow).filter(
                Workflow.id == workflow_id,
                Workflow.user_id == current_user.id
            ).first()
            
            if not workflow:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "Workflow not found",
                        "data": None
                    }
                )
            
            log_record = db.query(OverlayLogs).filter(
                OverlayLogs.workflow_id == workflow_id,
                OverlayLogs.submodule == "DEVELOPMENT"
            ).first()
            
            if not log_record:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "No log record found for this workflow",
                        "data": None
                    }
                )
            
            # Check if there's already a pending or processing job for this workflow
            existing_job = db.query(OverlayDevelopmentMultifactorAnalysisJob).filter(
                OverlayDevelopmentMultifactorAnalysisJob.workflow_id == workflow_id,
                OverlayDevelopmentMultifactorAnalysisJob.status.in_(["pending", "processing"])
            ).first()
            
            if existing_job:
                return JSONResponse(
                    status_code=400,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "A multifactor analysis job is already in progress for this workflow",
                        "data": {"job_id": existing_job.id}
                    }
                )
            
            # Create new job record
            new_job = OverlayDevelopmentMultifactorAnalysisJob(
                workflow_id=workflow_id,
                user_id=current_user.id,
                status="pending",
                progress=0,
                message="Job created, waiting to start..."
            )
            db.add(new_job)
            db.commit()
            db.refresh(new_job)
            
        finally:
            db.close()
        
        # Start background thread
        thread = threading.Thread(
            target=run_multifactor_analysis_background,
            args=(new_job.id, workflow_id, current_user.id, target_variable, workflow.number_of_combinations, max_bgtest_order),
            daemon=True
        )
        thread.start()
        
        return JSONResponse(
            status_code=200,
            content={
                "code": 1,
                "success": True,
                "msg": "Multifactor analysis job started",
                "data": {
                    "job_id": new_job.id,
                    "status": "pending",
                    "progress": 0
                }
            }
        )
        
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Something went wrong. {e}",
                "data": None
            }
        )

@router.get("/multifactor_analysis/status/{workflow_id}")
async def get_multifactor_analysis_status(workflow_id: int,
                                        current_user: User = Depends(get_current_user)):
    """Get the status of the latest multifactor analysis job for a workflow"""
    try:
        db = SessionLocal()
        try:
            # Get the most recent job for this workflow
            job = db.query(OverlayDevelopmentMultifactorAnalysisJob).filter(
                OverlayDevelopmentMultifactorAnalysisJob.workflow_id == workflow_id,
                OverlayDevelopmentMultifactorAnalysisJob.user_id == current_user.id
            ).order_by(OverlayDevelopmentMultifactorAnalysisJob.created_at.desc()).first()
            
            if not job:
                return JSONResponse(
                    status_code=400,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "No multifactor analysis job found for this workflow",
                        "data": None
                    }
                )
            
            # Calculate current running time if job is still processing
            current_running_time = None
            if job.status == "processing" and job.started_at:
                current_running_time = int((datetime.utcnow() - job.started_at).total_seconds())
            elif job.running_time_seconds is not None:
                current_running_time = job.running_time_seconds
            
            response_data = {
                "job_id": job.id,
                "workflow_id": job.workflow_id,
                "status": job.status,
                "progress": job.progress,
                "message": job.message,
                "error_message": job.error_message,
                "started_at": job.started_at.isoformat() if job.started_at else None,
                "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                "running_time_seconds": current_running_time,
                "created_at": job.created_at.isoformat() if job.created_at else None,
                "updated_at": job.updated_at.isoformat() if job.updated_at else None
            }
            
            return JSONResponse(
                status_code=200,
                content={
                    "code": 1,
                    "success": True,
                    "msg": "Success",
                    "data": response_data
                }
            )
        finally:
            db.close()
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Something went wrong: {str(e)}",
                "data": None
            }
        )


@router.post("/multifactor_analysis/cancel/")
async def cancel_multifactor_analysis(workflow_id: int = Form(...),
                                    current_user: User = Depends(get_current_user)):
    """Cancel the latest multifactor analysis job for a workflow"""
    try:
        db = SessionLocal()
        try:
            # Get the most recent job for this workflow
            job = db.query(OverlayDevelopmentMultifactorAnalysisJob).filter(
                OverlayDevelopmentMultifactorAnalysisJob.workflow_id == workflow_id,
                OverlayDevelopmentMultifactorAnalysisJob.user_id == current_user.id
            ).order_by(OverlayDevelopmentMultifactorAnalysisJob.created_at.desc()).first()
            
            if not job:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "No multifactor analysis job found for this workflow",
                        "data": None
                    }
                )
            
            # Check if job can be cancelled
            if job.status in ["completed", "failed", "cancelled"]:
                return JSONResponse(
                    status_code=400,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": f"Cannot cancel job with status: {job.status}",
                        "data": {
                            "job_id": job.id,
                            "workflow_id": job.workflow_id,
                            "current_status": job.status
                        }
                    }
                )
            
            # Mark job as cancelled
            job.status = "cancelled"
            job.message = "Cancellation requested by user"
            db.commit()
            
            print(f"Job {job.id} (workflow {workflow_id}) cancellation requested by user {current_user.id}")
            
            return JSONResponse(
                status_code=200,
                content={
                    "code": 1,
                    "success": True,
                    "msg": "Job cancellation requested. The process will stop at the next checkpoint.",
                    "data": {
                        "job_id": job.id,
                        "workflow_id": job.workflow_id,
                        "status": "cancelled"
                    }
                }
            )
        finally:
            db.close()
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Something went wrong: {str(e)}",
                "data": None
            }
        )


@router.get("/multifactor_analysis/files")
async def get_mfa_files(
    workflow_id: int = Query(..., description="Workflow ID"),
    current_user: User = Depends(get_current_user)
):
    """
    Get the latest MFA results folder and return all filenames in it.
    
    Returns the folder name and list of all CSV files in the most recent MFA results folder.
    """
    try:
        db = SessionLocal()
        try:
            workflow = db.query(Workflow).filter(
                Workflow.id == workflow_id,
                Workflow.user_id == current_user.id
            ).first()

            if not workflow:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": f"Workflow with ID {workflow_id} not found",
                        "data": None
                    }
                )

            portfolio = workflow.loan_product

            multifactor_analysis_output_path = (
                f"{get_root_folder()}/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/development/{portfolio}/multifactor_analysis"
            )

            if not os.path.exists(multifactor_analysis_output_path):
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": f"Multifactor analysis directory not found: {multifactor_analysis_output_path}",
                        "data": None
                    }
                )

            folder_path = Path(multifactor_analysis_output_path)
            
            # Look for folders matching the pattern (folder-based approach)
            mfa_folders = list(folder_path.glob(f"{portfolio}_mfa_*_*-var_*"))
            
            if not mfa_folders:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": f"No MFA results folder found for portfolio {portfolio}",
                        "data": None
                    }
                )
            
            # Get the most recent folder (by modification time)
            mfa_folder = max(mfa_folders, key=lambda p: p.stat().st_mtime)
            
            # Find all CSV files in the folder (001.csv, 002.csv, etc.)
            csv_files = sorted(mfa_folder.glob("*.csv"), key=lambda p: p.name)
            
            if not csv_files:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": f"No CSV files found in MFA results folder: {mfa_folder.name}",
                        "data": None
                    }
                )
            
            # Get file information
            filenames = [f.name for f in csv_files]
            file_info = []
            for csv_file in csv_files:
                try:
                    file_size = csv_file.stat().st_size
                    file_mtime = datetime.fromtimestamp(csv_file.stat().st_mtime).isoformat()
                    file_info.append({
                        "filename": csv_file.name,
                        "size_bytes": file_size,
                        "modified_at": file_mtime
                    })
                except Exception as e:
                    print(f"Error getting file info for {csv_file.name}: {e}")
                    file_info.append({
                        "filename": csv_file.name,
                        "size_bytes": None,
                        "modified_at": None
                    })
            
            return JSONResponse(
                status_code=200,
                content={
                    "code": 1,
                    "success": True,
                    "msg": "MFA files retrieved successfully",
                    "data": {
                        "folder_name": mfa_folder.name,
                        "folder_path": str(mfa_folder),
                        "total_files": len(csv_files),
                        "files": file_info,
                        "filenames": filenames
                    }
                }
            )
        finally:
            db.close()
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Unexpected error retrieving MFA files: {str(e)}",
                "data": None
            }
        )


@router.get("/multifactor_analysis/file")
async def get_mfa_file(
    workflow_id: int = Query(..., description="Workflow ID"),
    filename: str = Query(..., description="Filename to read (e.g., 001.csv)"),
    current_user: User = Depends(get_current_user)
):
    """
    Read a specific CSV file from the latest MFA results folder.
    Returns the file contents as JSON.
    """
    try:
        db = SessionLocal()
        try:
            workflow = db.query(Workflow).filter(
                Workflow.id == workflow_id,
                Workflow.user_id == current_user.id
            ).first()

            if not workflow:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": f"Workflow with ID {workflow_id} not found",
                        "data": None
                    }
                )

            portfolio = workflow.loan_product

            multifactor_analysis_output_path = (
                f"{get_root_folder()}/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/development/{portfolio}/multifactor_analysis"
            )

            if not os.path.exists(multifactor_analysis_output_path):
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": f"Multifactor analysis directory not found: {multifactor_analysis_output_path}",
                        "data": None
                    }
                )

            folder_path = Path(multifactor_analysis_output_path)
            
            # Look for folders matching the pattern
            mfa_folders = list(folder_path.glob(f"{portfolio}_mfa_*_*-var_*"))
            
            if not mfa_folders:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": f"No MFA results folder found for portfolio {portfolio}",
                        "data": None
                    }
                )
            
            # Get the most recent folder
            mfa_folder = max(mfa_folders, key=lambda p: p.stat().st_mtime)
            
            # Construct file path
            file_path = mfa_folder / filename
            
            # Security: ensure filename doesn't contain path traversal
            if not file_path.exists() or not str(file_path).startswith(str(mfa_folder)):
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": f"File not found: {filename}",
                        "data": None
                    }
                )
            
            # Read CSV file
            try:
                df = pd.read_csv(file_path)
                # Convert to list of records
                records = make_json_serializable(df.to_dict('records'))
                
                return JSONResponse(
                    status_code=200,
                    content={
                        "code": 1,
                        "success": True,
                        "msg": "File read successfully",
                        "data": {
                            "filename": filename,
                            "folder_name": mfa_folder.name,
                            "rows": records,
                            "total_rows": len(records)
                        }
                    }
                )
            except Exception as e:
                return JSONResponse(
                    status_code=500,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": f"Error reading file: {str(e)}",
                        "data": None
                    }
                )
        finally:
            db.close()
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Unexpected error reading file: {str(e)}",
                "data": None
            }
        )


@router.get("/multifactor_analysis")
async def get_mfa_results(
    workflow_id: int = Query(..., description="Workflow ID"),
    page: int = Query(1, description="Page number (1-indexed)"),
    page_size: int = Query(100, description="Number of items per page"),
    current_user: User = Depends(get_current_user)
):
    """
    Get MFA analysis results with pagination
    
    Returns paginated results of the best performing variable combinations 
    based on the specified criteria.
    """
    try:
        # Validate pagination parameters
        page, page_size = validate_pagination_params(page, page_size, max_page_size=1000)
        
        db = SessionLocal()
        workflow = db.query(Workflow).filter(
            Workflow.id == workflow_id,
            Workflow.user_id == current_user.id
        ).first()

        if not workflow:
            return JSONResponse(
                status_code=404,
                content={
                    "code": -1,
                    "success": False,
                    "msg": f"Workflow with ID {workflow_id} not found",
                    "data": None
                }
            )

        portfolio = workflow.loan_product

        multifactor_analysis_output_path = (
            f"{get_root_folder()}/files/"
            f"{workflow.entity}/"
            f"{workflow.reporting_period}/"
            f"{workflow.workflow_name}/"
            f"output/overlay/development/{portfolio}/multifactor_analysis"
        )

        if not os.path.exists(multifactor_analysis_output_path):
            print(f"{multifactor_analysis_output_path} does not exist")
            return JSONResponse(
                status_code=404, 
                content={
                    "code": -1,
                    "success": False,
                    "msg": f"Multifactor analysis directory not found: {multifactor_analysis_output_path}",
                    "data": None
                }
            )

        folder_path = Path(multifactor_analysis_output_path)
        
        # Look for folders matching the pattern (folder-based approach)
        # Pattern: {portfolio}_mfa_{ODR}_{num_vars_taken}-var_*
        mfa_folders = list(folder_path.glob(f"{portfolio}_mfa_*_*-var_*"))
        
        if not mfa_folders:
            return JSONResponse(
                status_code=404,
                content={
                    "code": -1,
                    "success": False,
                    "msg": f"No MFA results folder found for portfolio {portfolio}",
                    "data": None
                }
            )
        
        # Get the most recent folder (by modification time)
        mfa_folder = max(mfa_folders, key=lambda p: p.stat().st_mtime)
        
        # Find all CSV files in the folder (001.csv, 002.csv, etc.)
        csv_files = sorted(mfa_folder.glob("*.csv"), key=lambda p: p.name)
        
        if not csv_files:
            return JSONResponse(
                status_code=404,
                content={
                    "code": -1,
                    "success": False,
                    "msg": f"No CSV files found in MFA results folder: {mfa_folder.name}",
                    "data": None
                }
            )
        
        # Read and combine all CSV files in the folder
        dfs = []
        for csv_file in csv_files:
            try:
                df_part = pd.read_csv(csv_file)
                dfs.append(df_part)
                print(f"Loaded {len(df_part)} rows from {csv_file.name}")
            except Exception as e:
                print(f"Error reading {csv_file.name}: {e}")
                continue
        
        if not dfs:
            return JSONResponse(
                status_code=404,
                content={
                    "code": -1,
                    "success": False,
                    "msg": f"Failed to read any CSV files from folder: {mfa_folder.name}",
                    "data": None
                }
            )
        
        # Combine all dataframes
        df = pd.concat(dfs, ignore_index=True)
        total_count = len(df)
        
        print(f"MFA Results: {total_count} total records")
        print(f"Pagination: Page {page}, Size {page_size}")

        # Convert to list of records for pagination
        all_records = make_json_serializable(df.to_dict('records'))
        
        # Create paginated response
        response = create_pagination_response(
            data=all_records,
            page=page,
            page_size=page_size,
            total_count=total_count,
            success=True,
            message="MFA results retrieved successfully"
        )

        return JSONResponse(status_code=200, content=response)
        
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Unexpected error retrieving MFA results: {str(e)}",
                "data": None
            }
        )
