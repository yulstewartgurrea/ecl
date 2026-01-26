from fastapi import Depends, Form, Query
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from starlette.responses import StreamingResponse
from io import BytesIO
import pandas as pd
import os
import json
from typing import List, Dict, Any, Optional
from helpers.file_utils import find_and_read_data_file, get_root_folder

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
from helpers.get_latest_file import get_latest_file

import traceback
from pathlib import Path
from dateutil.relativedelta import relativedelta
from datetime import datetime
import re
import numpy as np

router = APIRouter(prefix="/api/overlay/execution", tags=["overlay-execution"])


def forecast_table_to_json(df: pd.DataFrame):
    # Row 0: variable names (unemp_rate, gdp, ...)
    var_row = df.iloc[0]

    # Data rows start at row 1
    data_rows = df.iloc[1:].reset_index(drop=True)

    ncols = len(df.columns)

    # Build metadata for each column: (scenario_name, var_name)
    col_meta = []
    for j, col_name in enumerate(df.columns):
        if j == 0:
            # First column is always the period
            col_meta.append(("period", None))
            continue

        # Scenario name: if column is "Unnamed", inherit scenario from previous column
        if isinstance(col_name, str) and col_name.startswith("Unnamed"):
            scenario = col_meta[j - 1][0]          # same scenario as previous col
        else:
            scenario = col_name.lower()            # "Best" -> "best"

        var_name = var_row.iloc[j]                 # e.g. "unemp_rate" or "gdp"
        col_meta.append((scenario, var_name))

    result = []

    for _, row in data_rows.iterrows():
        entry = {}

        for j in range(ncols):
            scenario, var_name = col_meta[j]
            value = row.iloc[j]

            if scenario == "period":
                # period column
                entry["period"] = str(value)
                continue

            # skip empty variable names (if any)
            if pd.isna(var_name):
                continue

            # skip NaN values
            if pd.isna(value):
                continue

            # ensure scenario dict exists
            if scenario not in entry:
                entry[scenario] = {}

            entry[scenario][str(var_name)] = str(value)

        result.append(entry)

    return result

@router.get("/override_data_transformation_mevs")
async def get_override_data_transformation_mevs(
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
            override_data_transformation_mevs_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/execution/{workflow.loan_product}/override_data_transformation_mevs"
            )

            print('override_data_transformation_mevs_path', override_data_transformation_mevs_path)
            
            # Get the latest file in the directory
            override_data_transformation_mevs_file = get_latest_file(override_data_transformation_mevs_path)

            print('override_data_transformation_mevs_file', override_data_transformation_mevs_file)
            
            if not override_data_transformation_mevs_file:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "No override data_transformation MEVs file found for this workflow",
                        "data": None
                    }
                )
            
            # Determine file type based on extension
            file_ext = override_data_transformation_mevs_file.suffix.lower()
            
            data = None
            if file_ext in ['.xlsx', '.xls']:
                # Read Excel file
                print(f"Detected Excel file: {file_ext}")
                data = pd.read_excel(override_data_transformation_mevs_file)
            elif file_ext == '.csv':
                # Read CSV file
                print(f"Detected CSV file")
                data = pd.read_csv(override_data_transformation_mevs_file)
            else:
                raise ValueError(f"Unsupported file format: {file_ext}. Supported formats: .csv, .xlsx, .xls")
            
            print(data)
            return {
                "code": 1, 
                "success": True,
                'data': forecast_table_to_json(data)
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

@router.get("/override_data_transformation_mevs/export")
async def export_override_data_transformation_mevs(
    workflow_id: int = Query(..., description="Workflow ID to export override data_transformation MEVs for"),
    current_user: User = Depends(get_current_user)
):
    """
    Export override data_transformation MEVs data as CSV file
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
            override_data_transformation_mevs_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/execution/{workflow.loan_product}/override_data_transformation_mevs"
            )

            print('override_data_transformation_mevs_path', override_data_transformation_mevs_path)
            
            # Get the latest file in the directory
            override_data_transformation_mevs_file = get_latest_file(override_data_transformation_mevs_path)

            print('override_data_transformation_mevs_file', override_data_transformation_mevs_file)
            
            if not override_data_transformation_mevs_file:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "No override data_transformation MEVs file found for this workflow",
                        "data": None
                    }
                )
            
            # Read file
            # Determine file type based on extension
            file_ext = override_data_transformation_mevs_file.suffix.lower()
            
            if file_ext in ['.xlsx', '.xls']:
                # Read Excel file
                print(f"Detected Excel file: {file_ext}")
                df = pd.read_excel(override_data_transformation_mevs_file)
            elif file_ext == '.csv':
                # Read CSV file
                print(f"Detected CSV file")
                df = pd.read_csv(override_data_transformation_mevs_file)
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

            # 1) Fix headers (best/base/worst instead of Unnamed)
            cols = pd.Series(df.columns)
            cols = cols.replace(r"^Unnamed.*", np.nan, regex=True).ffill()
            df.columns = cols
            
            # Create CSV in memory
            output = BytesIO()
            df.to_csv(output, index=False, encoding='utf-8')
            output.seek(0)
            
            # Generate filename from the source file
            filename = override_data_transformation_mevs_file.name if override_data_transformation_mevs_file else f"override_data_transformation_mevs_export_{workflow_id}.csv"
            
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
                "msg": f"Error exporting override data_transformation MEVs: {str(e)}",
                "data": None
            }
        )

@router.post("/override_data_transformation_mevs")
async def calculate_override_data_transformation_mevs(
    workflow_id: int = Form(...),
    override_data_transformation_mevs: str = Form(...),
    user_id: User = Depends(get_current_user),
):
    """
        Calculate data interpolation
    """
    try:
        document_type = "OVERLAY_EXECUTION_OVERRIDE_DATA_TRANSFORMATION_MEVS_OUTPUT"
        # Query the database for quarterly historical MEV data
        db = SessionLocal()
        try:
            workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
            
            log_record = db.query(OverlayLogs).filter(
                OverlayLogs.workflow_id == workflow_id,
                OverlayLogs.submodule == "EXECUTION"
            ).first()

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

        filename = f"override_data_transformation_mevs_output_{get_time_date()}.csv"
        output_folder_path = f"{workflow.entity}/{workflow.reporting_period}/{workflow.workflow_name}/output/overlay/execution/{workflow.loan_product}/override_data_transformation_mevs"

        ofm = json.loads(override_data_transformation_mevs)
        print('ofm', ofm)
        # Save data in documents models
        db = SessionLocal()
        try:
            # Convert Date column to string for JSON serialization
            
            # Create Document record
            new_document = Document(
                filename=filename,
                json_data=override_data_transformation_mevs,
                document_type=document_type,
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
            document_type=document_type,
            # csv_data is a daraframe
            csv_data=ofm,
            filename=filename
        )

        res = {
            'code': 1,
            'success': True,
            'msg': 'Override data_transformation MEVs saved successfully'
        }

        res = make_json_serializable(res)
        return JSONResponse(status_code=200, content=res)
    except Exception as e:
        traceback.print_exc()
        res = {
            'code': -1,
            'msg': f'Something went wrong. {e}',
            'success': False
        }
        return JSONResponse(status_code=500, content=res)

@router.get("/override_data_transformation_mevs/input")
async def get_override_data_transformation_mevs_input(
    workflow_id: int = Query(..., description="Workflow ID to export override data_transformation MEVs for"),
    current_user: User = Depends(get_current_user)
):
    """
    Export override data_transformation MEVs as CSV file
    """
    try:
        db = SessionLocal()
        try:
            workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()

            period_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"input/overlay/development/{workflow.loan_product}/OVERLAY_DEVELOPMENT_HISTORICAL_DEFAULT_RATE"
            )

            combined_monthly_mev_data_interpolation_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/execution/{workflow.loan_product}/data_transformation/combined_monthly_mev_data_interpolation"
            )

            print(combined_monthly_mev_data_interpolation_path)

            period_file = get_latest_file(period_path)
            combined_monthly_mev_data_interpolation_file = get_latest_file(combined_monthly_mev_data_interpolation_path)
            print('combined_monthly_mev_data_interpolation_file', combined_monthly_mev_data_interpolation_file)

            if combined_monthly_mev_data_interpolation_file is None:
                raise ValueError(f"No file found in {combined_monthly_mev_data_interpolation_path}")

            if period_file is None:
                raise ValueError(f"No file found in {period_path}")

            # file is csv read_csv if excel read_excel
            file_ext = period_file.suffix.lower()
            if file_ext == '.csv':
                period_data = pd.read_csv(period_file)
            elif file_ext in ['.xlsx', '.xls']:
                period_data = pd.read_excel(period_file)
            else:
                raise ValueError(f"Unsupported file format: {file_ext}")
            
            # file is csv read_csv if excel read_excel
            file_ext = combined_monthly_mev_data_interpolation_file.suffix.lower()
            if file_ext == '.csv':
                combined_monthly_mev_data_interpolation_data = pd.read_csv(combined_monthly_mev_data_interpolation_file)
            elif file_ext in ['.xlsx', '.xls']:
                combined_monthly_mev_data_interpolation_data = pd.read_excel(combined_monthly_mev_data_interpolation_file)
            else:
                raise ValueError(f"Unsupported file format: {file_ext}")

            print(combined_monthly_mev_data_interpolation_data)

            period_data['time'] = pd.to_datetime(period_data['time'], format="%m/%d/%Y")
            last_time = period_data['time'].max()
            if pd.isna(last_time):
                raise ValueError(f"No time found in {period_file}")
            # add 12 months to the last time
            data_transformation_periods = [
                (last_time + relativedelta(months=i+1)).strftime("%m/%d/%Y")
                for i in range(12)
            ]

            # 1. Get all columns that look like X + number (X1, X2, X3, ...)
            cols_to_drop = [
                "Date",
                "year",
                "month (int)",
                "month",
                "id",
                "x"
            ]
            df_clean = combined_monthly_mev_data_interpolation_data.drop(columns=cols_to_drop, errors="ignore")
            df_clean.columns = df_clean.columns.str.strip()
            x_cols = df_clean.columns.tolist()
            x_cols = set([col.split('.')[0] for col in x_cols])
            x_values = df_clean.values

            return {
                'code': 1,
                'success': True,
                'data': {
                    'period': data_transformation_periods,
                    'variables': x_cols
                }
            }
        finally:
            db.close()

    except Exception as e:
        traceback.print_exc()
        res = {
            'code': -1,
            'msg': f'Something went wrong. {e}',
            'success': False
        }
        return JSONResponse(status_code=500, content=res)