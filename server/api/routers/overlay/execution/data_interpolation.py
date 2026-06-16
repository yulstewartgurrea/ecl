from fastapi import Depends, Form, Query
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from starlette.responses import StreamingResponse
from io import BytesIO
import pandas as pd
import numpy as np
import os
import json
from typing import List, Dict, Any, Optional
from helpers.file_utils import find_and_read_data_file, get_root_folder
from data_processing.overlay.execution.data_interpolation import process_data_interpolation

from models.models import User, Workflow

from core.security import get_current_user

from models.models import Document
from database import SessionLocal

from models.overlay.development import (
    OverlayDevelopmentQuarterlyHistoricalMevInput,
    OverlayDevelopmentDataInterpolationOutput,
    OverlayLogs
)

from helpers.get_time_date import get_time_date
from helpers.save_file.save_file import save_csv_data_in_folder
from helpers.make_json_serializable import make_json_serializable

import traceback
from pathlib import Path

router = APIRouter(prefix="/api/overlay/execution", tags=["overlay-execution"])

@router.get("/data_interpolation")
async def get_data_interpolation(
    workflow_id: int = Query(..., description="Workflow ID to get data interpolation for"),
    current_user: User = Depends(get_current_user)
):
    """
    Get data interpolation data from OverlayDevelopmentDataInterpolationOutput table
    """
    try:
        db = SessionLocal()
        try:

            workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
            # Query the database for data interpolation output
            # get input file from library 
            data_interpolation_output_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/execution/{workflow.loan_product}/data_interpolation"
            )

            print('data_interpolation_output_path', data_interpolation_output_path)
            
            # Get the latest file in the directory
            data_interpolation_output_dir = Path(data_interpolation_output_path)
            print('data_interpolation_output_dir', data_interpolation_output_dir)
            if data_interpolation_output_dir.exists() and data_interpolation_output_dir.is_dir():
                # Get all files (not directories) in the folder
                files = [p for p in data_interpolation_output_dir.iterdir() if p.is_file()]
                # Find the file with the latest modification time
                date_interpolation_output_file = max(
                    files,
                    key=lambda p: p.stat().st_mtime,   # last modified time
                    default=None
                ) if files else None
            else:
                date_interpolation_output_file = None

            print('date_interpolation_output_file', date_interpolation_output_file)
            
            # read file

            # Determine file type based on extension
            file_ext = os.path.splitext(date_interpolation_output_file)[1].lower()
            
            data = None
            if file_ext in ['.xlsx', '.xls']:
                # Read Excel file
                print(f"Detected Excel file: {file_ext}")
                data = pd.read_excel(date_interpolation_output_file)
            elif file_ext == '.csv':
                # Read CSV file
                print(f"Detected CSV file")
                data = pd.read_csv(date_interpolation_output_file)
            else:
                raise ValueError(f"Unsupported file format: {file_ext}. Supported formats: .csv, .xlsx, .xls")
            
            # Replace NaN values with None for JSON serialization
            data = data.replace({np.nan: None})
            
            return {
                "code": 1, 
                "success": True,
                "data": data.to_dict(orient='records'),
            }
            
        finally:
            db.close()
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Error retrieving data interpolation: {str(e)}",
                "data": None
            }
        )

@router.get("/data_interpolation/export")
async def export_data_interpolation(
    workflow_id: int = Query(..., description="Workflow ID to export data interpolation for"),
    current_user: User = Depends(get_current_user)
):
    """
    Export data interpolation data as CSV file
    """
    try:
        db = SessionLocal()
        try:
            workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
            
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
            
            # Get input file from library (same as GET endpoint)
            data_interpolation_output_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/execution/{workflow.loan_product}/data_interpolation"
            )

            print('data_interpolation_output_path', data_interpolation_output_path)
            
            # Get the latest file in the directory
            data_interpolation_output_dir = Path(data_interpolation_output_path)
            print('data_interpolation_output_dir', data_interpolation_output_dir)
            if data_interpolation_output_dir.exists() and data_interpolation_output_dir.is_dir():
                # Get all files (not directories) in the folder
                files = [p for p in data_interpolation_output_dir.iterdir() if p.is_file()]
                # Find the file with the latest modification time
                date_interpolation_output_file = max(
                    files,
                    key=lambda p: p.stat().st_mtime,   # last modified time
                    default=None
                ) if files else None
            else:
                date_interpolation_output_file = None

            print('date_interpolation_output_file', date_interpolation_output_file)
            
            if not date_interpolation_output_file:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "No data interpolation output file found for this workflow",
                        "data": None
                    }
                )
            
            # Read file
            # Determine file type based on extension
            file_ext = os.path.splitext(date_interpolation_output_file)[1].lower()
            
            if file_ext in ['.xlsx', '.xls']:
                # Read Excel file
                print(f"Detected Excel file: {file_ext}")
                df = pd.read_excel(date_interpolation_output_file)
            elif file_ext == '.csv':
                # Read CSV file
                print(f"Detected CSV file")
                df = pd.read_csv(date_interpolation_output_file)
            else:
                return JSONResponse(
                    status_code=400,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": f"Unsupported file format: {file_ext}. Supported formats: .csv, .xlsx, .xls",
                        "data": None
                    }
                )
            
            # Create CSV in memory
            output = BytesIO()
            df.to_csv(output, index=False, encoding='utf-8')
            output.seek(0)
            
            # Generate filename from the source file
            filename = date_interpolation_output_file.name if date_interpolation_output_file else f"data_interpolation_export_{workflow_id}.csv"
            
            # Return as CSV file
            return StreamingResponse(
                output,
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
            
        finally:
            db.close()
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Error exporting data interpolation: {str(e)}",
                "data": None
            }
        )

@router.post("/data_interpolation")
async def calculate_data_interpolation(
    workflow_id: int = Form(...),
    execution_input_file: str = Form(...),
    user_id: User = Depends(get_current_user),
):
    """
        Calculate data interpolation
    """
    try:
        # Query the database for quarterly historical MEV data
        db = SessionLocal()
        try:
            workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
            
            # get input file from library 
            if execution_input_file == "forecast_mev":
                quarterly_mev_arima_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/execution/{workflow.loan_product}/generated/mev_quarterly_arima_forecast"
            )
            else:
                quarterly_mev_arima_path = (
                    f"{get_root_folder()}/server/files/"
                    f"{workflow.entity}/"
                    f"{workflow.reporting_period}/"
                    f"{workflow.workflow_name}/"
                    f"input/overlay/execution/{workflow.loan_product}/OVERLAY_EXECUTION_MEV_QUARTERLY_ARIMA"
                )

            print('quarterly_mev_arima_path', quarterly_mev_arima_path)
            
            # Get the latest file in the directory
            quarterly_mev_arima_dir = Path(quarterly_mev_arima_path)
            print('quarterly_mev_arima_dir', quarterly_mev_arima_dir)
            if quarterly_mev_arima_dir.exists() and quarterly_mev_arima_dir.is_dir():
                # Get all files (not directories) in the folder
                files = [p for p in quarterly_mev_arima_dir.iterdir() if p.is_file()]
                # Find the file with the latest modification time
                quarterly_mev_arima_file = max(
                    files,
                    key=lambda p: p.stat().st_mtime,   # last modified time
                    default=None
                ) if files else None
            else:
                quarterly_mev_arima_file = None

            print('quarterly_mev_arima_file', quarterly_mev_arima_file)

            # Resolve the MONTHLY MEV ARIMA forecast file too, so the interpolation
            # horizon can follow whichever forecast (quarterly vs monthly) ends later.
            if execution_input_file == "forecast_mev":
                monthly_mev_arima_path = (
                    f"{get_root_folder()}/server/files/"
                    f"{workflow.entity}/"
                    f"{workflow.reporting_period}/"
                    f"{workflow.workflow_name}/"
                    f"output/overlay/execution/{workflow.loan_product}/generated/mev_monthly_arima_forecast"
                )
            else:
                monthly_mev_arima_path = (
                    f"{get_root_folder()}/server/files/"
                    f"{workflow.entity}/"
                    f"{workflow.reporting_period}/"
                    f"{workflow.workflow_name}/"
                    f"input/overlay/execution/{workflow.loan_product}/OVERLAY_EXECUTION_MEV_MONTHLY_ARIMA"
                )

            monthly_mev_arima_dir = Path(monthly_mev_arima_path)
            if monthly_mev_arima_dir.exists() and monthly_mev_arima_dir.is_dir():
                monthly_files = [p for p in monthly_mev_arima_dir.iterdir() if p.is_file()]
                monthly_mev_arima_file = max(
                    monthly_files,
                    key=lambda p: p.stat().st_mtime,
                    default=None
                ) if monthly_files else None
            else:
                monthly_mev_arima_file = None

            print('monthly_mev_arima_file', monthly_mev_arima_file)


            print('workflow', workflow)
            log_record = db.query(OverlayLogs).filter(
                OverlayLogs.workflow_id == workflow_id,
                OverlayLogs.submodule == "EXECUTION"
            ).first()

            print('log_record', log_record)

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
            
        finally:
            db.close()

        process_data_interpolation_res = process_data_interpolation(quarterly_mev_arima_file, monthly_mev_arima_file)
        
        filename = f"data_interpolation_output_{get_time_date()}.csv"
        output_folder_path = f"{workflow.entity}/{workflow.reporting_period}/{workflow.workflow_name}/output/overlay/execution/{workflow.loan_product}/data_interpolation"

        # Save data in documents models
        db = SessionLocal()
        try:
            # Convert Date column to string for JSON serialization
            process_data_interpolation_res['Date'] = process_data_interpolation_res['Date'].dt.strftime('%Y-%m-%d')
            
            # Create Document record
            new_document = Document(
                filename=filename,
                json_data=json.dumps(process_data_interpolation_res.to_dict(orient='records')),
                document_type=f"OVERLAY_EXECUTION_DATA_INTERPOLATION_OUTPUT",
                user_id=user_id.id,
                workflow_id=workflow_id,
                workflow_path=f"{workflow.entity}/{workflow.reporting_period}/{workflow.workflow_name}"
            )
            db.add(new_document)
            db.commit()
            db.refresh(new_document)
            
        finally:
            db.close()

        save_csv_data_in_folder(
            workflow_path=output_folder_path,
            document_type="OVERLAY_EXECUTION_DATA_INTERPOLATION_OUTPUT",
            # csv_data is a daraframe
            csv_data=process_data_interpolation_res,
            filename=filename
        )

        res = {
            'code': 1,
            'success': True,
            'msg': 'Data interpolation processed successfully',
            # 'data': process_data_interpolation_res.to_dict(orient='records')
        }

        res = make_json_serializable(res)
        return JSONResponse(status_code=200, content=res)
    except ValueError as e:
        traceback.print_exc()
        return JSONResponse(status_code=400, content={'code': -1, 'success': False, 'msg': str(e)})
    except Exception as e:
        traceback.print_exc()
        res = {
            'code': -1,
            'success': False,
            'msg': (
                f'An unexpected error occurred during data interpolation. '
                f'Please verify that the Quarterly MEV ARIMA forecast output (or uploaded Quarterly ARIMA file) '
                f'is available and has the correct format. Detail: {e}'
            )
        }
        return JSONResponse(status_code=500, content=res)
