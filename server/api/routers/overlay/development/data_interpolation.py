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
from data_processing.overlay.development.data_interpolation import process_data_interpolation

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
from helpers.save_csv_data_in_folder import save_csv_data_in_folder
from helpers.make_json_serializable import make_json_serializable
from helpers.format_dataframe_constructor import format_dataframe_constructor

import traceback
from pathlib import Path

router = APIRouter(prefix="/api/overlay/development", tags=["overlay-development"])

@router.get("/data_interpolation")
async def get_data_interpolation(
    workflow_id: int = Query(..., description="Workflow ID to get data interpolation for"),
    current_user: User = Depends(get_current_user)
):
    """
    Get data interpolation data from file path
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

            data_interpolation_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/development/{workflow.loan_product}/data_interpolation"
            )

            data_interpolation_file = max(
                Path(data_interpolation_path).glob(f"data_interpolation_output_*.csv"),
                key=lambda p: p.stat().st_mtime,   # last modified time
                default=None
            )

            if not data_interpolation_file:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "No data interpolation output found for this workflow",
                        "data": None
                    }
                )
            
            # Read CSV file and convert to JSON
            df = pd.read_csv(data_interpolation_file)
            data = df.to_dict(orient='records')
            
            return {
                "code": 1, 
                "success": True,
                "data": data,
            }
            
        finally:
            db.close()
        
    except Exception as e:
        traceback.print_exc()
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
            # Query the database for data interpolation output (same as GET endpoint)
            # interpolation_record = db.query(OverlayDevelopmentDataInterpolationOutput).filter(
            #     OverlayDevelopmentDataInterpolationOutput.workflow_id == workflow_id,
            #     OverlayDevelopmentDataInterpolationOutput.user_id == current_user.id
            # ).first()

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

            data_interpolation_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/development/{workflow.loan_product}/data_interpolation"
            )

            data_interpolation_file = max(
                Path(data_interpolation_path).glob(f"data_interpolation_output_*.csv"),
                key=lambda p: p.stat().st_mtime,   # last modified time
                default=None
            )

            if not data_interpolation_file:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "No data interpolation output found for this workflow",
                        "data": None
                    }
                )
            
            # Parse the JSON data from the record
            filename = os.path.basename(str(data_interpolation_file))
            return FileResponse(str(data_interpolation_file), media_type="text/csv", filename=filename)
            
        finally:
            db.close()
        
    except Exception as e:
        traceback.print_exc()
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
    user_id: User = Depends(get_current_user),
):
    """
        Calculate data interpolation
    """
    try:
        # Query the database for quarterly historical MEV data
        db = SessionLocal()
        try:
            quarterly_record = db.query(OverlayDevelopmentQuarterlyHistoricalMevInput).filter(
                OverlayDevelopmentQuarterlyHistoricalMevInput.workflow_id == workflow_id
            ).order_by(OverlayDevelopmentQuarterlyHistoricalMevInput.created_at.desc()).first()

            workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()

            log_record = db.query(OverlayLogs).filter(
                OverlayLogs.workflow_id == workflow_id,
                OverlayLogs.submodule == "DEVELOPMENT"
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
            
            if not quarterly_record:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "No quarterly historical MEV data found for this workflow",
                        "data": None
                    }
                )
            
            # Parse the JSON data from the record
            import json
            # quarterly_data = json.loads(quarterly_record.json_data) if quarterly_record.json_data else []
            quarterly_df = format_dataframe_constructor(quarterly_record.json_data)
            

            print(quarterly_df)
            
            # Convert to DataFrame
            # quarterly_df = pd.DataFrame(quarterly_data)
            print(f"Retrieved quarterly data: {len(quarterly_df)} rows")
            
        finally:
            db.close()


        # Convert DataFrame to JSON
        # Drop fully empty cols/rows
        df_cleaned = quarterly_df.dropna(how="all", axis=1)
        df_cleaned = df_cleaned.dropna(how="all", axis=0)
        
        # Forward fill row 0 across columns (axis=0 means left to right along the row)
        # forward fill row 1 (index=1) across columns
        if len(df_cleaned) > 0:
            df_cleaned.iloc[0] = df_cleaned.iloc[0].ffill(axis=0)

        df_cleaned = df_cleaned.fillna('')
        
        # Convert to dictionary format
        data = df_cleaned.to_dict(orient='records')

        process_data_interpolation_res = process_data_interpolation(df_cleaned)

        
        filename = f"data_interpolation_output_{get_time_date()}.csv"
        output_folder_path = f"{workflow.entity}/{workflow.reporting_period}/{workflow.workflow_name}/output/overlay/development/{workflow.loan_product}/data_interpolation"

        # Save data in documents models
        db = SessionLocal()
        try:
            # Create Document record
            new_document = Document(
                filename=filename,
                json_data=json.dumps(process_data_interpolation_res.to_dict(orient='records')),
                document_type=f"OVERLAY_DEVELOPMENT_DATA_INTERPOLATION_OUTPUT",
                user_id=user_id.id,
                workflow_id=workflow_id,
                workflow_path=f"{workflow.entity}/{workflow.reporting_period}/{workflow.workflow_name}"
            )
            db.add(new_document)
            db.commit()
            db.refresh(new_document)

            # Create OverlayDevelopmentDataInterpolationOutput record
            new_overlay_record = OverlayDevelopmentDataInterpolationOutput(
                workflow_id=workflow_id,
                user_id=user_id.id,
                json_data=json.dumps(process_data_interpolation_res.to_dict(orient='records')),
                log_id=log_record.id,
                folder=output_folder_path,
                filename=filename
            )
            db.add(new_overlay_record)
            db.commit()
            db.refresh(new_overlay_record)
            
        finally:
            db.close()

        save_csv_data_in_folder(
            workflow_path=output_folder_path,
            document_type="OVERLAY_DEVELOPMENT_DATA_INTERPOLATION_OUTPUT",
            # csv_data is a daraframe
            csv_data=process_data_interpolation_res,
            filename=filename
        )

        res = {
            'code': 1,
            'success': True,
            'msg': 'Data interpolation processed successfully',
            'data': process_data_interpolation_res.to_dict(orient='records')
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
