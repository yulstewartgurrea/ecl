from fastapi import APIRouter, HTTPException, Depends, Form, Query
from fastapi.responses import JSONResponse, FileResponse

import pandas as pd
import numpy as np
import os
import json
import traceback
from datetime import datetime

from typing import List, Dict, Any, Optional
from helpers.file_utils import find_and_read_data_file, get_root_folder
from data_processing.overlay.execution.transform_forecasted_mevs import process_transform_forecasted_mevs

from database import SessionLocal

from core.security import get_current_user

from models.models import User, Document, Workflow
from models.overlay.development import (
    OverlayDevelopmentMonthlyHistoricalMevInput,
    OverlayDevelopmentDataInterpolationOutput,
    OverlayDevelopmentHistoricalDefaultRateInput,
    OverlayDevelopmentDataTransformationOutput,
    OverlayLogs
)

from helpers.get_time_date import get_time_date
from helpers.save_file.save_file import save_csv_data_in_folder
from helpers.make_json_serializable import make_json_serializable
from helpers.file_utils import read_data_file
from helpers.get_latest_file import get_latest_file
from pathlib import Path

router = APIRouter(prefix="/api/overlay/execution", tags=["overlay-execution"])

@router.post("/transform_forecasted_mevs")
async def calculate_transform_forecasted_mevs(workflow_id: int = Form(...),
                                              user_id: User = Depends(get_current_user)):
    """
        Calculate data transformation
    """
    try:
        document_type = "OVERLAY_EXECUTION_TRANSFORM_FORECASTED_MEVS_OUTPUT"
        db = SessionLocal()
        try:
            workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
            
            # log_record = db.query(OverlayLogs).filter(
            #     OverlayLogs.workflow_id == workflow_id,
            #     OverlayLogs.submodule == "EXECUTION"
            # ).first()

            final_models_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/development/{workflow.loan_product}/final_models"
            )
            final_models_path = Path(final_models_path)
            final_models_file = get_latest_file(final_models_path)
            if final_models_file is None:
                final_models_path = (
                f"{get_root_folder()}/server/files/"
                    f"{workflow.entity}/"
                    f"{workflow.reporting_period}/"
                    f"{workflow.workflow_name}/"
                    f"input/overlay/execution/{workflow.loan_product}/OVERLAY_EXECUTION_FINAL_MODEL"
                )
                final_models_path = Path(final_models_path)
                final_models_file = get_latest_file(final_models_path)

            print('final_models_path', final_models_path)

            # Get data from transformation
            data_transformation_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/execution/{workflow.loan_product}/data_transformation"
            )
            data_transformation_path = Path(data_transformation_path)
            

            override_data_transformation_mevs_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/execution/{workflow.loan_product}/override_data_transformation_mevs"
            )
            
            data_transformation_file = max(
                data_transformation_path.glob(f"{workflow.loan_product}_Independent - Transformed with Time*"),
                key=lambda p: p.stat().st_mtime,   # last modified time
                default=None
            )

            override_data_transformation_mevs_file = get_latest_file(override_data_transformation_mevs_path)
            

            print('data_transformation_file', data_transformation_file)
            print('override_data_transformation_mevs_file', override_data_transformation_mevs_file)

            override_data_transformation_mevs_df = read_data_file(override_data_transformation_mevs_file)
            final_models_df = read_data_file(final_models_file)
            # Determine file type based on extension
            file_ext = os.path.splitext(data_transformation_file)[1].lower()
            
            if file_ext in ['.xlsx', '.xls']:
                # Read Excel file
                print(f"Detected Excel file: {file_ext}")
                data_transformation_df = pd.read_excel(data_transformation_file)
            elif file_ext == '.csv':
                # Read CSV file
                print(f"Detected CSV file")
                data_transformation_df = pd.read_csv(data_transformation_file)
            else:
                raise ValueError(f"Unsupported file format: {file_ext}. Supported formats: .csv, .xlsx, .xls")

            print('data_transformation_df', data_transformation_df.columns)
            print('override_data_transformation_mevs_df', override_data_transformation_mevs_df.columns)
            data_transformation_df['Date'] = data_transformation_df['Period']

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

            # if not log_record:
            #     return JSONResponse(
            #         status_code=404,
            #         content={
            #             "code": -1,
            #             "success": False,
            #             "msg": "No log record found for this workflow",
            #             "data": None
            #         }
            #     )

            if data_transformation_df.empty:
                return JSONResponse(
                    status_code=404,
                    content= {
                        "code": -1,
                        "success": False,
                        "msg": "No data transformation data found for this workflow",
                        "data": None
                    }
                )

            if override_data_transformation_mevs_df.empty:
                return JSONResponse(
                    status_code=404,
                    content= {
                        "code": -1,
                        "success": False,
                        "msg": "No override data transformation MEVs data found for this workflow",
                        "data": None
                    }
                )
        finally:
            db.close()

        process_transform_forecasted_mevs_res = process_transform_forecasted_mevs(
            data_transformation_df,
            override_data_transformation_mevs_df,
            final_models_df)

        print('process_transform_forecasted_mevs_res', process_transform_forecasted_mevs_res)
        
        res = {
            'code': 1,
            'success': True,
            'msg': 'Success'
        }

        filename = f"transform_forecasted_mevs_output_{get_time_date()}.csv"
        output_folder_path = f"{workflow.entity}/{workflow.reporting_period}/{workflow.workflow_name}/output/overlay/execution/{workflow.loan_product}/transform_forecasted_mevs"
        
        # Save data in documents models
        db = SessionLocal()
        try:
            # Create Document record
            new_document = Document(
                filename=filename,
                json_data=None,
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
            csv_data=process_transform_forecasted_mevs_res,
            filename=filename
        )

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
                f'An unexpected error occurred during transform forecasted MEVs. '
                f'Please verify that the Final Models file, Data Transformation (Independent) output, and '
                f'Override Data Transformation MEVs output are available and have the correct format. Detail: {e}'
            )
        }
        return JSONResponse(status_code=500, content=res)


@router.get("/transform_forecasted_mevs")
async def get_transform_forecasted_mevs_results(workflow_id: int = Query(...),
                                         current_user: User = Depends(get_current_user)):
    """
    Get data transformation data from transform_forecasted_mevs table
    """
    try:
        db = SessionLocal()
        try:

            workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
            # Query the database for data interpolation output
            # get input file from library 
            transform_forecasted_mevs_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/execution/{workflow.loan_product}/transform_forecasted_mevs"
            )

            print('transform_forecasted_mevs_path', transform_forecasted_mevs_path)
            
            # Get the latest file in the directory
            transform_forecasted_mevs_file = get_latest_file(transform_forecasted_mevs_path)

            print('transform_forecasted_mevs_file', transform_forecasted_mevs_file)
            
            if not transform_forecasted_mevs_file:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "No override forecasted MEVs file found for this workflow",
                        "data": None
                    }
                )
            
            # Determine file type based on extension
            file_ext = transform_forecasted_mevs_file.suffix.lower()
            
            data = None
            if file_ext in ['.xlsx', '.xls']:
                # Read Excel file
                print(f"Detected Excel file: {file_ext}")
                data = pd.read_excel(transform_forecasted_mevs_file)
            elif file_ext == '.csv':
                # Read CSV file
                print(f"Detected CSV file")
                data = pd.read_csv(transform_forecasted_mevs_file)
            else:
                raise ValueError(f"Unsupported file format: {file_ext}. Supported formats: .csv, .xlsx, .xls")
            
            print(data)
            data = data.replace([np.inf, -np.inf], np.nan)
            data = data.astype(object).where(pd.notna(data), None)
            return {
                "code": 1,
                "success": True,
                'data': data.to_dict(orient='records')
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


@router.get("/transform_forecasted_mevs/export")
async def export_transform_forecasted_mevs(
    workflow_id: int = Query(...),
    current_user: User = Depends(get_current_user)
):
    """Export latest transform forecasted MEVs data as CSV or Excel file."""
    try:
        db = SessionLocal()
        try:
            workflow = db.query(Workflow).filter(
                Workflow.id == workflow_id,
                Workflow.user_id == current_user.id
            ).first()

            if not workflow:
                return JSONResponse(status_code=404, content={"detail": f"Workflow with ID {workflow_id} not found"})

            transform_forecasted_mevs_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/execution/{workflow.loan_product}/transform_forecasted_mevs"
            )

            if not os.path.exists(transform_forecasted_mevs_path):
                return JSONResponse(
                    status_code=404,
                    content={"detail": f"Transform forecasted MEVs directory not found: {transform_forecasted_mevs_path}"}
                )

            # Get the latest file in the directory
            transform_forecasted_mevs_file = get_latest_file(transform_forecasted_mevs_path)

            if not transform_forecasted_mevs_file:
                return JSONResponse(
                    status_code=404,
                    content={"detail": "No transform forecasted MEVs file found"}
                )

            # Convert Path object to string for FileResponse
            file_path = str(transform_forecasted_mevs_file)
            filename = transform_forecasted_mevs_file.name

            # Determine media type based on file extension
            file_ext = transform_forecasted_mevs_file.suffix.lower()
            if file_ext in ['.xlsx', '.xls']:
                media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            elif file_ext == '.csv':
                media_type = "text/csv"
            else:
                return JSONResponse(
                    status_code=400,
                    content={"detail": f"Unsupported file format: {file_ext}"}
                )

            return FileResponse(
                file_path,
                media_type=media_type,
                filename=filename,
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
                "msg": f"Error exporting transform forecasted MEVs: {str(e)}",
                "data": None
            }
        )
