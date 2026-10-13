from fastapi import APIRouter, HTTPException, Depends, Form, Query
from fastapi.responses import JSONResponse, FileResponse
from starlette.responses import StreamingResponse
from io import BytesIO
import zipfile

import pandas as pd
import numpy as np
import os
import json
import traceback
from datetime import datetime

from typing import List, Dict, Any, Optional
from helpers.file_utils import find_and_read_data_file, get_root_folder
from data_processing.overlay.development.data_transformation import process_data_transformation

from database import SessionLocal

from core.security import get_current_user

from models.models import User, Document, Workflow
from models.overlay.development import (
    OverlayDevelopmentMonthlyHistoricalMevInput,
    OverlayDevelopmentDataInterpolationOutput,
    OverlayDevelopmentHistoricalDefaultRateInput,
    OverlayDevelopmentDataTransformationOutput,
    OverlayLogs,
    OverlayDevelopmentDataTransformationJob,
)

from helpers.get_time_date import get_time_date
from helpers.save_csv_data_in_folder import save_csv_data_in_folder
from helpers.make_json_serializable import make_json_serializable
from helpers.format_dataframe_constructor import format_dataframe_constructor

import threading

from helpers.get_latest_file import get_latest_file
from helpers.file_utils import get_root_folder, read_data_file

# Thread tracking registry for Solution 3
# Tracks active threads per workflow to prevent concurrent jobs
active_threads = {}  # {workflow_id: {'thread': Thread, 'started_at': datetime, 'job_id': int}}
thread_lock = threading.Lock()  # Protect the registry

def cleanup_dead_threads():
    """
    Remove dead/stuck threads from the registry
    """
    with thread_lock:
        dead_workflows = []
        for workflow_id, thread_info in active_threads.items():
            thread = thread_info.get('thread')
            if thread and not thread.is_alive():
                dead_workflows.append(workflow_id)
        
        for workflow_id in dead_workflows:
            del active_threads[workflow_id]
            print(f"🧹 Cleaned up dead thread for workflow {workflow_id}")

def is_workflow_busy(workflow_id: int) -> bool:
    """
    Check if there's an active thread for the given workflow
    Returns True if a thread is running, False otherwise
    """
    cleanup_dead_threads()  # Clean up dead threads first
    
    with thread_lock:
        if workflow_id in active_threads:
            thread_info = active_threads[workflow_id]
            thread = thread_info.get('thread')
            if thread and thread.is_alive():
                return True
            else:
                # Thread is dead, clean it up
                del active_threads[workflow_id]
                return False
    return False

def register_thread(workflow_id: int, thread: threading.Thread, job_id: int):
    """
    Register a thread in the active threads registry
    """
    with thread_lock:
        active_threads[workflow_id] = {
            'thread': thread,
            'started_at': datetime.utcnow(),
            'job_id': job_id
        }
        print(f"Registered thread for workflow {workflow_id}, job {job_id}")

def deregister_thread(workflow_id: int):
    """
    Remove a thread from the active threads registry
    """
    with thread_lock:
        if workflow_id in active_threads:
            job_id = active_threads[workflow_id].get('job_id', 'unknown')
            del active_threads[workflow_id]
            print(f"Deregistered thread for workflow {workflow_id}, job {job_id}")

def clean_dataframe_for_json(df: pd.DataFrame) -> pd.DataFrame:
    """
    Clean DataFrame to make it JSON compliant by replacing inf/-inf/NaN with None
    """
    df_clean = df.copy()
    
    # Check for problematic values before cleaning
    numeric_cols = df_clean.select_dtypes(include=[np.number]).columns
    if len(numeric_cols) > 0:
        inf_count = np.isinf(df_clean[numeric_cols]).sum().sum()
        nan_count = df_clean[numeric_cols].isnull().sum().sum()
        
        if inf_count > 0 or nan_count > 0:
            print(f"Found {inf_count} inf values and {nan_count} NaN values")
    
    # Convert all columns to object type first to handle mixed types
    df_clean = df_clean.astype(object)
    
    # Replace inf/-inf with None
    df_clean = df_clean.replace([np.inf, -np.inf], None)
    
    # Replace NaN with None
    df_clean = df_clean.where(pd.notnull(df_clean), None)
    
    # Additional cleaning for any remaining problematic values
    for col in df_clean.columns:
        # Check for any remaining inf values
        mask = df_clean[col].astype(str).str.contains('inf', na=False)
        if mask.any():
            print(f"Found inf values in column {col}")
            df_clean.loc[mask, col] = None
        
        # Check for any remaining NaN values
        mask = df_clean[col].astype(str).str.contains('nan', na=False, case=False)
        if mask.any():
            print(f"Found NaN values in column {col}")
            df_clean.loc[mask, col] = None
    
    return df_clean

def clean_response_data(data_dict):
    """
    Recursively clean response data to ensure JSON serialization
    """
    if isinstance(data_dict, dict):
        return {key: clean_response_data(value) for key, value in data_dict.items()}
    elif isinstance(data_dict, list):
        return [clean_response_data(item) for item in data_dict]
    elif isinstance(data_dict, (int, float)):
        if np.isinf(data_dict) or np.isnan(data_dict):
            return None
        return data_dict
    else:
        return data_dict

router = APIRouter(prefix="/api/overlay/development", tags=["overlay-development"])

def run_data_transformation_background(job_id: int, workflow_id: int, user_id: int, num_combinations: int):
    """
    Background function that runs the data transformation process
    and updates progress in the database
    """
    db = SessionLocal()
    try:
        # Update job status to processing
        job = db.query(OverlayDevelopmentDataTransformationJob).filter(
            OverlayDevelopmentDataTransformationJob.id == job_id
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
        
        monthly_historical_mev = db.query(OverlayDevelopmentMonthlyHistoricalMevInput).filter(
            OverlayDevelopmentMonthlyHistoricalMevInput.workflow_id == workflow_id
        ).order_by(OverlayDevelopmentMonthlyHistoricalMevInput.created_at.desc()).first()
        
        data_interpolation = db.query(OverlayDevelopmentDataInterpolationOutput).filter(
            OverlayDevelopmentDataInterpolationOutput.workflow_id == workflow_id
        ).order_by(OverlayDevelopmentDataInterpolationOutput.created_at.desc()).first()
        
        # historical_default_rates = db.query(OverlayDevelopmentHistoricalDefaultRateInput).filter(
        #     OverlayDevelopmentHistoricalDefaultRateInput.workflow_id == workflow_id
        # ).order_by(OverlayDevelopmentHistoricalDefaultRateInput.created_at.desc()).first()

        historical_default_rates_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"input/overlay/development/{workflow.loan_product}/OVERLAY_DEVELOPMENT_HISTORICAL_DEFAULT_RATE"
            )
        
        historical_default_rates_file = get_latest_file(historical_default_rates_path)
        historical_default_rates_df = read_data_file(historical_default_rates_file)

        # Helper function to calculate and set running time
        def set_running_time():
            if job.started_at:
                completed_time = datetime.utcnow()
                running_time = (completed_time - job.started_at).total_seconds()
                job.completed_at = completed_time
                job.running_time_seconds = int(running_time)

        if not all([workflow, log_record, monthly_historical_mev, data_interpolation, historical_default_rates_file]):
            set_running_time()
            missing_items = []
            if not workflow: missing_items.append("workflow")
            if not log_record: missing_items.append("log record")
            if not monthly_historical_mev: missing_items.append("Monthly Historical MEV input")
            if not data_interpolation: missing_items.append("Data Interpolation output")
            if not historical_default_rates_file: missing_items.append("Historical Default Rate input")
            job.status = "failed"
            job.error_message = (
                f"Required data not found: {', '.join(missing_items)}. "
                f"Please ensure all required input files are uploaded and previous steps (data interpolation) are completed."
            )
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
        
        # Prepare dataframes
        update_progress(10, "Loading and preparing data...")
        if check_cancellation():
            set_running_time()
            return
        
        monthly_historical_mev_df = format_dataframe_constructor(monthly_historical_mev.json_data)
        data_interpolation_df = format_dataframe_constructor(data_interpolation.json_data)
        # historical_default_rates_df = format_dataframe_constructor(historical_default_rates.json_data)
        
        # Process transformation with progress updates
        update_progress(20, "Starting data transformation...")
        if check_cancellation():
            set_running_time()
            return
        
        try:
            process_data_transformation_res = process_data_transformation(
                monthly_historical_mev_df, 
                data_interpolation_df,
                historical_default_rates_df,
                workflow,
                progress_callback=update_progress,
                cancellation_check=check_cancellation,
                num_combinations=num_combinations
            )
        except Exception as e:
            if "cancelled" in str(e).lower() or job.status == "cancelled":
                # Job was cancelled during processing
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
        
        if not process_data_transformation_res or 'docs' not in process_data_transformation_res:
            set_running_time()
            job.status = "failed"
            job.error_message = (
                "Data transformation failed — no results were returned. "
                "This may indicate an issue with the input data format. "
                "Please verify that the Monthly Historical MEV, Data Interpolation output, and Historical Default Rate "
                "input files have the correct format and data, then retry."
            )
            db.commit()
            return
        
        # Save results
        update_progress(90, "Saving results...")
        if check_cancellation():
            set_running_time()
            return
        
        document_type = "OVERLAY_DEVELOPMENT_DATA_TRANSFORMATION_OUTPUT"
        filename = f"data_transformation_output_{get_time_date()}"
        
        for doc in process_data_transformation_res['docs']:
            if check_cancellation():
                set_running_time()
                return
            new_document = Document(
                filename=doc,
                json_data=None,
                document_type=document_type,
                user_id=user_id,
                workflow_id=workflow_id,
                workflow_path=f"{workflow.entity}/{workflow.reporting_period}/{workflow.workflow_name}"
            )
            db.add(new_document)
            db.commit()
            db.refresh(new_document)

            new_overlay_record = OverlayDevelopmentDataTransformationOutput(
                workflow_id=workflow_id,
                user_id=user_id,
                json_data=None,
                log_id=log_record.id,
                folder=process_data_transformation_res['file_path'],
                filename=filename
            )
            db.add(new_overlay_record)
            db.commit()
            db.refresh(new_overlay_record)
        
        # Check cancellation before marking as completed
        if check_cancellation():
            set_running_time()
            return
        
        # Calculate running time and mark as completed
        set_running_time()
        job.status = "completed"
        job.progress = 100
        job.message = "Data transformation completed successfully"
        db.commit()
        
        print(f"Job {job_id} completed successfully in {job.running_time_seconds} seconds")
        
    except Exception as e:
        traceback.print_exc()
        db.rollback()
        try:
            job = db.query(OverlayDevelopmentDataTransformationJob).filter(
                OverlayDevelopmentDataTransformationJob.id == job_id
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
                    error_detail = str(e)
                    if "unsupported operand" in error_detail or "could not convert" in error_detail.lower():
                        job.error_message = (
                            f"Data format error during transformation: {error_detail}. "
                            f"Please check that all numeric columns in your input files contain valid numbers "
                            f"(remove commas, currency symbols, or text from numeric fields)."
                        )
                    else:
                        job.error_message = (
                            f"Data transformation failed: {error_detail}. "
                            f"Please verify that all input files (Monthly Historical MEV, Data Interpolation output, "
                            f"Historical Default Rate) have the correct format and data."
                        )
                db.commit()
        except:
            pass
        print(f"Job {job_id} failed: {str(e)}")
    finally:
        db.close()
        # Always deregister thread when done (success, failure, or cancellation)
        deregister_thread(workflow_id)

@router.post("/data_transformation")
async def calculate_data_transformation(workflow_id: int = Form(...),
                                        num_combinations: int | None = Form(None),
                                        user_id: User = Depends(get_current_user)):
    """
    Calculate data transformation - returns immediately with job_id for status polling
    """
    try:
        if not num_combinations or num_combinations < 1 or num_combinations > 4:
            return JSONResponse(
                status_code=400,
                content={
                    "code": -1,
                    "success": False,
                    "msg": "Number of combinations is required and must be greater than 0 but less than 5.",
                    "data": None
                }
            )

        db = SessionLocal()
        try:
            workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()

            log_record = db.query(OverlayLogs).filter(
                OverlayLogs.workflow_id == workflow_id,
                OverlayLogs.submodule == "DEVELOPMENT"
            ).first()

            monthly_historical_mev = db.query(OverlayDevelopmentMonthlyHistoricalMevInput).filter(
                OverlayDevelopmentMonthlyHistoricalMevInput.workflow_id == workflow_id
            ).order_by(OverlayDevelopmentMonthlyHistoricalMevInput.created_at.desc()).first()

            data_interpolation = db.query(OverlayDevelopmentDataInterpolationOutput).filter(
                OverlayDevelopmentDataInterpolationOutput.workflow_id == workflow_id
            ).order_by(OverlayDevelopmentDataInterpolationOutput.created_at.desc()).first()

            # historical_default_rates = db.query(OverlayDevelopmentHistoricalDefaultRateInput).filter(
            #     OverlayDevelopmentHistoricalDefaultRateInput.workflow_id == workflow_id
            # ).order_by(OverlayDevelopmentHistoricalDefaultRateInput.created_at.desc()).first()

            historical_default_rates_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"input/overlay/development/{workflow.loan_product}/OVERLAY_DEVELOPMENT_HISTORICAL_DEFAULT_RATE"
            )
            historical_default_rates_file = get_latest_file(historical_default_rates_path)

            if not workflow:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "No workflow found for this workflow id",
                        "data": None
                    }
                )

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

            if not monthly_historical_mev:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "No monthly historical mev data found for this workflow",
                        "data": None
                    }
                )
            
            if not data_interpolation:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "No data interpolation data found for this workflow",
                        "data": None
                    }
                )

            if not historical_default_rates_file:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "No historical default rates data found for this workflow",
                        "data": None
                    }
                )
            
            # Solution 3: Check thread registry first (prevents concurrent jobs within this process)
            if is_workflow_busy(workflow_id):
                return JSONResponse(
                    status_code=400,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "A data transformation job is already running for this workflow. Please wait for it to complete or cancel it first.",
                        "data": None
                    }
                )

            workflow.number_of_combinations = num_combinations
            db.commit()
            db.refresh(workflow)
            
            # Also check database for pending/processing jobs (handles multi-process scenarios)
            existing_job = db.query(OverlayDevelopmentDataTransformationJob).filter(
                OverlayDevelopmentDataTransformationJob.workflow_id == workflow_id,
                OverlayDevelopmentDataTransformationJob.status.in_(["pending", "processing"])
            ).first()
            
            if existing_job:
                return JSONResponse(
                    status_code=400,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "A data transformation job is already in progress for this workflow",
                        "data": {"job_id": existing_job.id}
                    }
                )
            
            # Create new job record
            new_job = OverlayDevelopmentDataTransformationJob(
                workflow_id=workflow_id,
                user_id=user_id.id,
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
            target=run_data_transformation_background,
            args=(new_job.id, workflow_id, user_id.id, num_combinations),
            daemon=True
        )
        
        # Solution 3: Register thread before starting (prevents race condition)
        register_thread(workflow_id, thread, new_job.id)
        thread.start()
        
        return JSONResponse(
            status_code=200,
            content={
                "code": 1,
                "success": True,
                "msg": "Data transformation job started",
                "data": {
                    "job_id": new_job.id,
                    "status": "pending",
                    "progress": 0
                }
            }
        )
        
    except ValueError as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=400,
            content={
                "code": -1,
                "success": False,
                "msg": str(e),
                "data": None
            }
        )
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": (
                    f"An unexpected error occurred while starting data transformation. "
                    f"Please verify that the required input files (Monthly Historical MEV, Data Interpolation output, "
                    f"Historical Default Rate) are uploaded and have the correct format. Detail: {e}"
                ),
                "data": None
            }
        )


@router.get("/data_transformation/status/{workflow_id}")
async def get_data_transformation_status(workflow_id: int,
                                        current_user: User = Depends(get_current_user)):
    """Get the status of the latest data transformation job for a workflow"""
    try:
        db = SessionLocal()
        try:
            # Get the most recent job for this workflow
            job = db.query(OverlayDevelopmentDataTransformationJob).filter(
                OverlayDevelopmentDataTransformationJob.workflow_id == workflow_id,
                OverlayDevelopmentDataTransformationJob.user_id == current_user.id
            ).order_by(OverlayDevelopmentDataTransformationJob.created_at.desc()).first()
            
            if not job:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "No data transformation job found for this workflow",
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
                "msg": f"An unexpected error occurred while retrieving data transformation status. Please contact support. Detail: {str(e)}",
                "data": None
            }
        )


@router.post("/data_transformation/cancel/")
async def cancel_data_transformation(workflow_id: int = Form(...),
                                    current_user: User = Depends(get_current_user)):
    """Cancel the latest data transformation job for a workflow"""
    try:
        db = SessionLocal()
        try:
            # Get the most recent job for this workflow
            job = db.query(OverlayDevelopmentDataTransformationJob).filter(
                OverlayDevelopmentDataTransformationJob.workflow_id == workflow_id,
                OverlayDevelopmentDataTransformationJob.user_id == current_user.id
            ).order_by(OverlayDevelopmentDataTransformationJob.created_at.desc()).first()
            
            if not job:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "No data transformation job found for this workflow",
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
                "msg": f"An unexpected error occurred while cancelling data transformation. Please contact support. Detail: {str(e)}",
                "data": None
            }
        )


@router.get("/data_transformation_results")
async def get_data_transformation_results(workflow_id: int = Query(...),
                                         current_user: User = Depends(get_current_user)):
    """Get the results of data transformation for display in Step3"""
    db = SessionLocal()
    try:
        root_folder = get_root_folder()
        print('root_folder', root_folder)
        
        workflow = db.query(Workflow).filter(
            Workflow.id == workflow_id,
            Workflow.user_id == current_user.id
        ).first()

        if not workflow:
            print(f"Workflow with ID {workflow_id} not found for user {current_user.id}")
            return JSONResponse(status_code=404, content={"detail": f"Workflow with ID {workflow_id} not found"})

        print(f"Found workflow: {workflow.workflow_name} (Entity: {workflow.entity}, Period: {workflow.reporting_period}, Portfolio: {workflow.loan_product})")

        # Construct file paths based on workflow
        portfolio = workflow.loan_product or "Housing"  # Default to Housing if loan_product is None
        
        # Use the correct server_files_path
        server_files_path = f"{root_folder}/server/files/{workflow.entity}/{workflow.reporting_period}/{workflow.workflow_name}/output/overlay/development/{portfolio}/data_transformation"
        
        print(f"Looking for files in: {server_files_path}")
        
        if not os.path.exists(server_files_path):
            print(f"{server_files_path} does not exist")
            return JSONResponse(status_code=404, content={"detail": f"Data transformation directory not found: {server_files_path}"})
        
        print(f"Found data transformation directory: {server_files_path}")
        
        # Find the most recent files with timestamp
        files = os.listdir(server_files_path)
        print(f"Found {len(files)} files in directory")
        
        # Filter files by pattern and get the most recent
        independent_files = [f for f in files if f.startswith(f"{portfolio}_Independent - Transformed with Time") and f.endswith('.csv')]
        dependent_files = [f for f in files if f.startswith(f"{portfolio}_Dependent - Transformed with Time") and f.endswith('.csv')]
        
        print(f"Independent files found: {independent_files}")
        print(f"Dependent files found: {dependent_files}")
        
        if not independent_files or not dependent_files:
            return JSONResponse(status_code=404, content={"detail": f"Transformed data files not found. Looking for {portfolio}_Independent and {portfolio}_Dependent files"})
        
        # Get the most recent files (assuming they're sorted by timestamp)
        independent_file = sorted(independent_files)[-1]
        dependent_file = sorted(dependent_files)[-1]
        
        # Read the CSV files
        independent_path = os.path.join(server_files_path, independent_file)
        dependent_path = os.path.join(server_files_path, dependent_file)
        
        independent_df = pd.read_csv(independent_path)
        dependent_df = pd.read_csv(dependent_path)
        
        # Clean DataFrames to handle inf/-inf/NaN values before JSON conversion
        independent_df_clean = clean_dataframe_for_json(independent_df)
        dependent_df_clean = clean_dataframe_for_json(dependent_df)
        
        # Convert to JSON-serializable format
        independent_data = independent_df_clean.to_dict(orient='records')
        dependent_data = dependent_df_clean.to_dict(orient='records')
        
        # print('independent_data', independent_data)
        # print('dependent_data', dependent_data)
        return JSONResponse(content={
            "code": 1,
            "msg": "Success",
            "success": True,
            "data": {
                "independent_data": independent_data,
                "dependent_data": dependent_data,
                "independent_columns": list(independent_df.columns),
                "dependent_columns": list(dependent_df.columns)
            }
        })
        
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"An unexpected error occurred while retrieving data transformation results. Please verify the transformation completed successfully and retry. Detail: {str(e)}",
                "data": None
            }
        )
    finally:
        db.close()


@router.get("/data_transformation_results/export")
async def export_data_transformation_results(
    workflow_id: int = Query(...),
    file_type: str = Query("both", description="independent | dependent | both"),
    current_user: User = Depends(get_current_user)
):
    """Export latest transformed data as CSV or ZIP (based on get endpoint logic)."""
    try:
        root_folder = get_root_folder()
        db = SessionLocal()
        try:
            workflow = db.query(Workflow).filter(
                Workflow.id == workflow_id,
                Workflow.user_id == current_user.id
            ).first()

            if not workflow:
                return JSONResponse(status_code=404, content={"detail": f"Workflow with ID {workflow_id} not found"})

            portfolio = workflow.loan_product or "Housing"
            server_files_path = f"{root_folder}/server/files/{workflow.entity}/{workflow.reporting_period}/{workflow.workflow_name}/output/overlay/development/{portfolio}/data_transformation"

            if not os.path.exists(server_files_path):
                return JSONResponse(status_code=404, content={"detail": f"Data transformation directory not found: {server_files_path}"})

            files = os.listdir(server_files_path)

            independent_files = [f for f in files if f.startswith(f"{portfolio}_Independent - Transformed with Time") and f.endswith('.csv')]
            dependent_files = [f for f in files if f.startswith(f"{portfolio}_Dependent - Transformed with Time") and f.endswith('.csv')]

            if not independent_files and not dependent_files:
                return JSONResponse(status_code=404, content={"detail": "No transformed data files found"})

            independent_path = None
            dependent_path = None
            if independent_files:
                independent_path = os.path.join(server_files_path, sorted(independent_files)[-1])
            if dependent_files:
                dependent_path = os.path.join(server_files_path, sorted(dependent_files)[-1])

            # Normalize file_type
            ft = (file_type or "both").lower()
            if ft not in ("independent", "dependent", "both"):
                return JSONResponse(status_code=400, content={"detail": "Invalid file_type. Use independent | dependent | both"})

            # Single file export as direct CSV
            if ft == "independent":
                if not independent_path:
                    return JSONResponse(status_code=404, content={"detail": "Independent file not found"})
                filename = os.path.basename(independent_path)
                return FileResponse(independent_path, media_type="text/csv", filename=filename)

            if ft == "dependent":
                if not dependent_path:
                    return JSONResponse(status_code=404, content={"detail": "Dependent file not found"})
                filename = os.path.basename(dependent_path)
                return FileResponse(dependent_path, media_type="text/csv", filename=filename)

            # Both: stream a zip containing both files
            mem_file = BytesIO()
            with zipfile.ZipFile(mem_file, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
                if independent_path:
                    zf.write(independent_path, arcname=os.path.basename(independent_path))
                if dependent_path:
                    zf.write(dependent_path, arcname=os.path.basename(dependent_path))
            mem_file.seek(0)

            zip_name = f"{portfolio}_Transformed_Data_{get_time_date()}.zip"
            # Use quoted filename so clients (e.g. Tauri on macOS) parse it reliably
            safe_name = zip_name.replace('"', '\\"')
            return StreamingResponse(
                mem_file,
                media_type="application/zip",
                headers={"Content-Disposition": f'attachment; filename="{safe_name}"'}
            )
        finally:
            db.close()
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Error exporting data transformation results: {str(e)}",
                "data": None
            }
        )