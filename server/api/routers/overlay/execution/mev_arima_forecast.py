from fastapi import APIRouter, HTTPException, Depends, Form, Query
from fastapi.responses import JSONResponse, FileResponse
from starlette.responses import StreamingResponse
from io import BytesIO
import pandas as pd
import numpy as np
import os
import json
import traceback
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

from helpers.file_utils import get_root_folder
from data_processing.overlay.execution.asapfi_mevs_forecast_monthly import forecast_mevs_monthly
from data_processing.overlay.execution.asapfi_mevs_forecast_quarterly import forecast_mevs_quarterly

from database import SessionLocal
from core.security import get_current_user
from models.models import User, Document, Workflow

from helpers.get_time_date import get_time_date
from helpers.save_file.save_file import save_csv_data_in_folder
from helpers.make_json_serializable import make_json_serializable
from helpers.get_latest_file import get_latest_file

router = APIRouter(prefix="/api/overlay/execution", tags=["overlay-execution"])


def extract_years_from_file(file_path: Path) -> tuple[Optional[int], Optional[int]]:
    """
    Extract start_year and end_year from file's 'year' column.
    Returns (start_year, end_year) or (None, None) if not found.
    """
    try:
        # Read file
        file_ext = os.path.splitext(file_path)[1].lower()
        if file_ext in ['.xlsx', '.xls']:
            df = pd.read_excel(file_path)
        elif file_ext == '.csv':
            df = pd.read_csv(file_path)
        else:
            return None, None
        
        # Find year column (case-insensitive)
        year_col = None
        for col in df.columns:
            if str(col).strip().lower() == 'year':
                year_col = col
                break
        
        if year_col is None:
            return None, None
        
        # Extract years and get min/max
        years = pd.to_numeric(df[year_col], errors='coerce').dropna()
        if len(years) == 0:
            return None, None
        
        start_year = int(years.min())
        end_year = int(years.max())
        
        print(f"Extracted years from file: start_year={start_year}, end_year={end_year}")
        return start_year, end_year
        
    except Exception as e:
        print(f"Error extracting years from file: {str(e)}")
        return None, None


@router.post("/mev_monthly_arima_forecast")
async def calculate_mev_monthly_arima_forecast(
    workflow_id: int = Form(...),
    start_year: int = Form(2012),
    end_year: int = Form(2025),
    start_month: int = Form(1),
    end_month: int = Form(12),
    months_to_forecast: int = Form(12),
    user_id: User = Depends(get_current_user),
):
    """
    Calculate monthly MEV ARIMA forecast
    
    Processes the uploaded monthly MEV historical data file and generates forecasts.
    The input file should be uploaded with document_type: OVERLAY_EXECUTION_MEV_MONTHLY_ARIMA
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
            
            # Get input file from uploaded location
            monthly_mev_input_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"input/overlay/development/{workflow.loan_product}/OVERLAY_DEVELOPMENT_MONTHLY_HISTORICAL_MEV"
            )
            
            print('monthly_mev_input_path', monthly_mev_input_path)
            
            # Get the latest file in the directory
            monthly_mev_input_dir = Path(monthly_mev_input_path)
            if monthly_mev_input_dir.exists() and monthly_mev_input_dir.is_dir():
                files = [p for p in monthly_mev_input_dir.iterdir() if p.is_file()]
                monthly_mev_input_file = max(
                    files,
                    key=lambda p: p.stat().st_mtime,
                    default=None
                ) if files else None
            else:
                monthly_mev_input_file = None
            
            print('monthly_mev_input_file', monthly_mev_input_file)
            
            if not monthly_mev_input_file:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "No monthly MEV ARIMA input file found. Please upload a file with document_type: OVERLAY_EXECUTION_MEV_MONTHLY_ARIMA",
                        "data": None
                    }
                )
            
        finally:
            db.close()
        
        # Extract years from file if available
        file_start_year, file_end_year = extract_years_from_file(monthly_mev_input_file)
        if file_start_year is not None and file_end_year is not None:
            start_year = file_start_year
            end_year = file_end_year
            print(f"Using years from file: start_year={start_year}, end_year={end_year}")
        else:
            print(f"Year column not found in file, using form parameters: start_year={start_year}, end_year={end_year}")
        
        # Process the forecast
        print(f"Processing monthly ARIMA forecast with parameters:")
        print(f"  start_year: {start_year}, end_year: {end_year}")
        print(f"  start_month: {start_month}, end_month: {end_month}")
        print(f"  months_to_forecast: {months_to_forecast}")
        
        forecast_result = forecast_mevs_monthly(
            input_file_path=str(monthly_mev_input_file),
            output_file_path=None,  # We'll save manually
            start_year=start_year,
            end_year=end_year,
            start_month=start_month,
            end_month=end_month,
            months_to_forecast=months_to_forecast
        )
        
        if forecast_result is None:
            return JSONResponse(
                status_code=500,
                content={
                    "code": -1,
                    "success": False,
                    "msg": "Forecast processing failed",
                    "data": None
                }
            )
        
        # Save output
        filename = f"mev_monthly_arima_forecast_{get_time_date()}.xlsx"
        output_folder_path = (
            f"{workflow.entity}/{workflow.reporting_period}/{workflow.workflow_name}/"
            f"output/overlay/execution/{workflow.loan_product}/generated/mev_monthly_arima_forecast"
        )
        
        # Save to files folder
        save_csv_data_in_folder(
            workflow_path=output_folder_path,
            document_type="OVERLAY_EXECUTION_MEV_MONTHLY_ARIMA_FORECAST_OUTPUT",
            csv_data=forecast_result,
            filename=filename
        )
        
        # Save to database
        db = SessionLocal()
        try:
            # Convert Date column to string for JSON serialization if it exists
            forecast_result_copy = forecast_result.copy()
            if 'Date' in forecast_result_copy.columns:
                forecast_result_copy['Date'] = forecast_result_copy['Date'].astype(str)
            
            new_document = Document(
                filename=filename,
                json_data=json.dumps(forecast_result_copy.to_dict(orient='records')),
                document_type="OVERLAY_EXECUTION_MEV_MONTHLY_ARIMA_FORECAST_OUTPUT",
                user_id=user_id.id,
                workflow_id=workflow_id,
                workflow_path=f"{workflow.entity}/{workflow.reporting_period}/{workflow.workflow_name}"
            )
            db.add(new_document)
            db.commit()
            db.refresh(new_document)
            
        finally:
            db.close()
        
        res = {
            'code': 1,
            'success': True,
            'msg': 'Monthly MEV ARIMA forecast processed successfully',
            'data': {
                'document_id': new_document.id,
                'filename': filename,
                'total_variables': len([col for col in forecast_result.columns if col != 'Date']),
                'total_periods': len(forecast_result)
            }
        }
        
        res = make_json_serializable(res)
        return JSONResponse(status_code=200, content=res)
        
    except Exception as e:
        traceback.print_exc()
        res = {
            'code': -1,
            'msg': f'Something went wrong: {str(e)}',
            'success': False
        }
        return JSONResponse(status_code=500, content=res)


@router.post("/mev_quarterly_arima_forecast")
async def calculate_mev_quarterly_arima_forecast(
    workflow_id: int = Form(...),
    start_year: int = Form(2012),
    end_year: int = Form(2025),
    start_quarter: int = Form(1),
    end_quarter: int = Form(4),
    quarters_to_forecast: int = Form(4),
    user_id: User = Depends(get_current_user),
):
    """
    Calculate quarterly MEV ARIMA forecast
    
    Processes the uploaded quarterly MEV historical data file and generates forecasts.
    The input file should be uploaded with document_type: OVERLAY_EXECUTION_MEV_QUARTERLY_ARIMA
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
            
            # Get input file from uploaded location
            quarterly_mev_input_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"input/overlay/development/{workflow.loan_product}/OVERLAY_DEVELOPMENT_QUARTERLY_HISTORICAL_MEV"
            )
            
            print('quarterly_mev_input_path', quarterly_mev_input_path)
            
            # Get the latest file in the directory
            quarterly_mev_input_dir = Path(quarterly_mev_input_path)
            if quarterly_mev_input_dir.exists() and quarterly_mev_input_dir.is_dir():
                files = [p for p in quarterly_mev_input_dir.iterdir() if p.is_file()]
                quarterly_mev_input_file = max(
                    files,
                    key=lambda p: p.stat().st_mtime,
                    default=None
                ) if files else None
            else:
                quarterly_mev_input_file = None
            
            print('quarterly_mev_input_file', quarterly_mev_input_file)
            
            if not quarterly_mev_input_file:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "No quarterly MEV ARIMA input file found. Please upload a file with document_type: OVERLAY_EXECUTION_MEV_QUARTERLY_ARIMA",
                        "data": None
                    }
                )
            
        finally:
            db.close()
        
        # Extract years from file if available
        file_start_year, file_end_year = extract_years_from_file(quarterly_mev_input_file)
        if file_start_year is not None and file_end_year is not None:
            start_year = file_start_year
            end_year = file_end_year
            print(f"Using years from file: start_year={start_year}, end_year={end_year}")
        else:
            print(f"Year column not found in file, using form parameters: start_year={start_year}, end_year={end_year}")
        
        # Process the forecast
        print(f"Processing quarterly ARIMA forecast with parameters:")
        print(f"  start_year: {start_year}, end_year: {end_year}")
        print(f"  start_quarter: {start_quarter}, end_quarter: {end_quarter}")
        print(f"  quarters_to_forecast: {quarters_to_forecast}")
        
        forecast_result = forecast_mevs_quarterly(
            input_file_path=str(quarterly_mev_input_file),
            output_file_path=None,  # We'll save manually
            start_year=start_year,
            end_year=end_year,
            start_quarter=start_quarter,
            end_quarter=end_quarter,
            quarters_to_forecast=quarters_to_forecast
        )
        
        if forecast_result is None:
            return JSONResponse(
                status_code=500,
                content={
                    "code": -1,
                    "success": False,
                    "msg": "Forecast processing failed",
                    "data": None
                }
            )
        
        # Save output
        filename = f"mev_quarterly_arima_forecast_{get_time_date()}.xlsx"
        output_folder_path = (
            f"{workflow.entity}/{workflow.reporting_period}/{workflow.workflow_name}/"
            f"output/overlay/execution/{workflow.loan_product}/generated/mev_quarterly_arima_forecast"
        )
        
        # Save to files folder
        save_csv_data_in_folder(
            workflow_path=output_folder_path,
            document_type="OVERLAY_EXECUTION_MEV_QUARTERLY_ARIMA_FORECAST_OUTPUT",
            csv_data=forecast_result,
            filename=filename
        )
        
        # Save to database
        db = SessionLocal()
        try:
            # Convert Date column to string for JSON serialization if it exists
            forecast_result_copy = forecast_result.copy()
            if 'Date' in forecast_result_copy.columns:
                forecast_result_copy['Date'] = forecast_result_copy['Date'].astype(str)
            
            new_document = Document(
                filename=filename,
                json_data=json.dumps(forecast_result_copy.to_dict(orient='records')),
                document_type="OVERLAY_EXECUTION_MEV_QUARTERLY_ARIMA_FORECAST_OUTPUT",
                user_id=user_id.id,
                workflow_id=workflow_id,
                workflow_path=f"{workflow.entity}/{workflow.reporting_period}/{workflow.workflow_name}"
            )
            db.add(new_document)
            db.commit()
            db.refresh(new_document)
            
        finally:
            db.close()
        
        res = {
            'code': 1,
            'success': True,
            'msg': 'Quarterly MEV ARIMA forecast processed successfully',
            'data': {
                'document_id': new_document.id,
                'filename': filename,
                'total_variables': len([col for col in forecast_result.columns if col != 'Date']),
                'total_periods': len(forecast_result)
            }
        }
        
        res = make_json_serializable(res)
        return JSONResponse(status_code=200, content=res)
        
    except Exception as e:
        traceback.print_exc()
        res = {
            'code': -1,
            'msg': f'Something went wrong: {str(e)}',
            'success': False
        }
        return JSONResponse(status_code=500, content=res)


@router.get("/mev_monthly_arima_forecast")
async def get_mev_monthly_arima_forecast(
    workflow_id: int = Query(..., description="Workflow ID to get monthly MEV ARIMA forecast for"),
    current_user: User = Depends(get_current_user)
):
    """
    Get monthly MEV ARIMA forecast results
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
            
            forecast_output_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/execution/{workflow.loan_product}/generated/mev_monthly_arima_forecast"
            )
            
            # Get the latest file
            forecast_output_dir = Path(forecast_output_path)
            if forecast_output_dir.exists() and forecast_output_dir.is_dir():
                files = [p for p in forecast_output_dir.iterdir() if p.is_file()]
                forecast_file = max(
                    files,
                    key=lambda p: p.stat().st_mtime,
                    default=None
                ) if files else None
            else:
                forecast_file = None
            
            if not forecast_file:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "No monthly MEV ARIMA forecast file found for this workflow",
                        "data": None
                    }
                )
            
            # # Read file
            # file_ext = os.path.splitext(forecast_file)[1].lower()
            # if file_ext in ['.xlsx', '.xls']:
            #     data = pd.read_excel(forecast_file)
            # elif file_ext == '.csv':
            #     data = pd.read_csv(forecast_file)
            # else:
            #     raise ValueError(f"Unsupported file format: {file_ext}")
            
            return {
                "code": 1,
                "success": True,
                "data": forecast_file.name
            }
            
        finally:
            db.close()
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Error retrieving monthly MEV ARIMA forecast: {str(e)}",
                "data": None
            }
        )


@router.get("/mev_quarterly_arima_forecast")
async def get_mev_quarterly_arima_forecast(
    workflow_id: int = Query(..., description="Workflow ID to get quarterly MEV ARIMA forecast for"),
    current_user: User = Depends(get_current_user)
):
    """
    Get quarterly MEV ARIMA forecast results
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
            
            forecast_output_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/execution/{workflow.loan_product}/generated/mev_quarterly_arima_forecast"
            )
            
            # Get the latest file
            forecast_output_dir = Path(forecast_output_path)
            if forecast_output_dir.exists() and forecast_output_dir.is_dir():
                files = [p for p in forecast_output_dir.iterdir() if p.is_file()]
                forecast_file = max(
                    files,
                    key=lambda p: p.stat().st_mtime,
                    default=None
                ) if files else None
            else:
                forecast_file = None
            
            if not forecast_file:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "No quarterly MEV ARIMA forecast file found for this workflow",
                        "data": None
                    }
                )
            
            return {
                "code": 1,
                "success": True,
                "data": forecast_file.name
            }
            
        finally:
            db.close()
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Error retrieving quarterly MEV ARIMA forecast: {str(e)}",
                "data": None
            }
        )


@router.get("/mev_monthly_arima_forecast/export")
async def export_mev_monthly_arima_forecast(
    workflow_id: int = Query(..., description="Workflow ID to export monthly MEV ARIMA forecast for"),
    current_user: User = Depends(get_current_user)
):
    """
    Export monthly MEV ARIMA forecast as Excel/CSV file
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
            
            forecast_output_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/execution/{workflow.loan_product}/generated/mev_monthly_arima_forecast"
            )
            
            # Get the latest file
            forecast_output_dir = Path(forecast_output_path)
            if forecast_output_dir.exists() and forecast_output_dir.is_dir():
                files = [p for p in forecast_output_dir.iterdir() if p.is_file()]
                forecast_file = max(
                    files,
                    key=lambda p: p.stat().st_mtime,
                    default=None
                ) if files else None
            else:
                forecast_file = None
            
            if not forecast_file:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "No monthly MEV ARIMA forecast file found for this workflow",
                        "data": None
                    }
                )
            
            # Determine media type
            file_ext = os.path.splitext(forecast_file)[1].lower()
            if file_ext in ['.xlsx', '.xls']:
                media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            elif file_ext == '.csv':
                media_type = "text/csv"
            else:
                return JSONResponse(
                    status_code=400,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": f"Unsupported file format: {file_ext}",
                        "data": None
                    }
                )
            
            return FileResponse(
                str(forecast_file),
                media_type=media_type,
                filename=forecast_file.name,
                headers={"Content-Disposition": f"attachment; filename={forecast_file.name}"}
            )
            
        finally:
            db.close()
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Error exporting monthly MEV ARIMA forecast: {str(e)}",
                "data": None
            }
        )


@router.get("/mev_quarterly_arima_forecast/export")
async def export_mev_quarterly_arima_forecast(
    workflow_id: int = Query(..., description="Workflow ID to export quarterly MEV ARIMA forecast for"),
    current_user: User = Depends(get_current_user)
):
    """
    Export quarterly MEV ARIMA forecast as Excel/CSV file
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
            
            forecast_output_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/execution/{workflow.loan_product}/generated/mev_quarterly_arima_forecast"
            )
            
            # Get the latest file
            forecast_output_dir = Path(forecast_output_path)
            if forecast_output_dir.exists() and forecast_output_dir.is_dir():
                files = [p for p in forecast_output_dir.iterdir() if p.is_file()]
                forecast_file = max(
                    files,
                    key=lambda p: p.stat().st_mtime,
                    default=None
                ) if files else None
            else:
                forecast_file = None
            
            if not forecast_file:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "No quarterly MEV ARIMA forecast file found for this workflow",
                        "data": None
                    }
                )
            
            # Determine media type
            file_ext = os.path.splitext(forecast_file)[1].lower()
            if file_ext in ['.xlsx', '.xls']:
                media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            elif file_ext == '.csv':
                media_type = "text/csv"
            else:
                return JSONResponse(
                    status_code=400,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": f"Unsupported file format: {file_ext}",
                        "data": None
                    }
                )
            
            return FileResponse(
                str(forecast_file),
                media_type=media_type,
                filename=forecast_file.name,
                headers={"Content-Disposition": f"attachment; filename={forecast_file.name}"}
            )
            
        finally:
            db.close()
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Error exporting quarterly MEV ARIMA forecast: {str(e)}",
                "data": None
            }
        )

