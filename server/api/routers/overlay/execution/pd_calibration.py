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
from data_processing.overlay.execution.pd_calibration import process_pd_calibration

from database import SessionLocal

from core.security import get_current_user

from models.models import User, Document, Workflow, JsonData

from helpers.get_time_date import get_time_date
from helpers.save_file.save_file import save_csv_data_in_folder
from helpers.make_json_serializable import make_json_serializable
from helpers.file_utils import read_data_file
from helpers.get_latest_file import get_latest_file

import re
import math

router = APIRouter(prefix="/api/overlay/execution", tags=["overlay-execution"])

@router.post("/pd_calibration")
async def calculate_pd_calibration(workflow_id: int = Form(...),
                                    user_id: User = Depends(get_current_user)):
    """
        Calculate overlay multiplier calc
    """
    try:
        db = SessionLocal()
        try:
            workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
            
            # log_record = db.query(OverlayLogs).filter(
            #     OverlayLogs.workflow_id == workflow_id,
            #     OverlayLogs.submodule == "EXECUTION"
            # ).first()

            overlay_multiplier_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/execution/{workflow.loan_product}/overlay_multiplier"
            )

            name = "12month_transition_matrix"
            workflow_path = f"/{workflow.entity}/{workflow.reporting_period}/{workflow.workflow_name}"
            print(workflow)
            # Step 2: Check if workflow_path already exists in DB
            migration_matrix = db.query(JsonData).filter(JsonData.workflow_path == workflow_path, JsonData.name == name).first()
            if migration_matrix:
                # Deserialize json_data before returning
                print("existing record found, returning existing data")
                migration_matrix_data = json.loads(migration_matrix.json_data)
                ttc_pd = month12_rows = [row for row in migration_matrix_data if row.get('Month') == 'Month 12']
                
            else:
                return JSONResponse(
                    status_code=404,
                    content={"detail": f"No migration matrix average found for workflow_path: {workflow_path}"}
                )

            

            overlay_multiplier_file = get_latest_file(overlay_multiplier_path)
            overlay_multiplier_df = read_data_file(overlay_multiplier_file)
            # static obligors per bucket (adjust as needed)
            obligors_by_bucket = {0: 581, 1: 3, 2: 7, 3: 2}

            ttc_pd_formatted = [
                {
                    'Bucket': r['Bucket'],
                    'Obligors': obligors_by_bucket.get(r['Bucket'], 0),
                    'ttc_pd': r.get('91+ DPD_4', 0)
                }
                for r in ttc_pd
                if r.get('Month') == 'Month 12'
                and not math.isclose(float(r.get('Total', 0)), 1.0, rel_tol=0, abs_tol=1e-9)
                and r['Bucket'] in obligors_by_bucket
            ]

            ttc_pd_formatted.sort(key=lambda x: x['Bucket'])
            ttc_pd_df = pd.DataFrame(ttc_pd_formatted)

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

            if overlay_multiplier_df.empty:
                return JSONResponse(
                    status_code=404,
                    content= {
                        "code": -1,
                        "success": False,
                        "msg": "No overlay multiplier data found for this workflow",
                        "data": None
                    }
                )

        finally:
            db.close()

        pd_calibration_res = process_pd_calibration(
            overlay_multiplier_df,
            ttc_pd_df)
        
        res = {
            'code': 1,
            'success': True,
            'msg': 'Success'
        }
        
        filename = f"pd_calibration_{get_time_date()}.csv"
        output_folder_path = f"{workflow.entity}/{workflow.reporting_period}/{workflow.workflow_name}/output/overlay/execution/{workflow.loan_product}/pd_calibration"
        document_type = "OVERLAY_EXECUTION_PD_CALIBRATION_OUTPUT"

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
            csv_data=pd_calibration_res,
            filename=filename
        )

        return JSONResponse(status_code=200, content=res)
    except Exception as e:
        traceback.print_exc()
        res = {
            'code': -1,
            'msg': f'Something went wrong. {e}',
            'success': False
        }
        return JSONResponse(status_code=500, content=res)


@router.get("/pd_calibration")
async def get_pd_calibration_results(workflow_id: int = Query(...),
                                         current_user: User = Depends(get_current_user)):
    """
    Get pd calibration results
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

            pd_calibration_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/execution/{workflow.loan_product}/pd_calibration"
            )

            print('pd_calibration_path', pd_calibration_path)
            
            if not os.path.exists(pd_calibration_path):
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": f"PD calibration directory not found: {pd_calibration_path}",
                        "data": None
                    }
                )
            
            # Find files starting with "pd_calibration"
            pd_calibration_files = [f for f in os.listdir(pd_calibration_path) 
                    if f.startswith("pd_calibration") and (f.endswith('.csv') or f.endswith('.xlsx'))]

            if not pd_calibration_files:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "No PD calibration file found for this workflow",
                        "data": None
                    }
                )

            # Get the most recent file
            latest_file = sorted(pd_calibration_files)[-1]
            file_path = os.path.join(pd_calibration_path, latest_file)
            
            # Read the file
            data = read_data_file(file_path)
            
            print(data)
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
                "msg": f"Error retrieving overlay multiplier: {str(e)}",
                "data": None
            }
        )


@router.get("/pd_calibration/export")
async def export_pd_calibration(
    workflow_id: int = Query(...),
    current_user: User = Depends(get_current_user)
):
    """Export latest PD calibration data as CSV or Excel file."""
    try:
        db = SessionLocal()
        try:
            workflow = db.query(Workflow).filter(
                Workflow.id == workflow_id,
                Workflow.user_id == current_user.id
            ).first()

            if not workflow:
                return JSONResponse(status_code=404, content={"detail": f"Workflow with ID {workflow_id} not found"})

            pd_calibration_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/execution/{workflow.loan_product}/pd_calibration"
            )

            if not os.path.exists(pd_calibration_path):
                return JSONResponse(
                    status_code=404,
                    content={"detail": f"PD calibration directory not found: {pd_calibration_path}"}
                )

            # Find files starting with "pd_calibration"
            pd_calibration_files = [f for f in os.listdir(pd_calibration_path) 
                    if f.startswith("pd_calibration") and (f.endswith('.csv') or f.endswith('.xlsx'))]

            if not pd_calibration_files:
                return JSONResponse(
                    status_code=404,
                    content={"detail": "No PD calibration file found"}
                )

            # Get the most recent file
            latest_file = sorted(pd_calibration_files)[-1]
            file_path = os.path.join(pd_calibration_path, latest_file)

            # Determine media type based on file extension
            file_ext = os.path.splitext(latest_file)[1].lower()
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
                filename=latest_file,
                headers={"Content-Disposition": f"attachment; filename={latest_file}"}
            )
        finally:
            db.close()
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Error exporting PD calibration: {str(e)}",
                "data": None
            }
        )


