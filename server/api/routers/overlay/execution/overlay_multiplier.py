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
from data_processing.overlay.execution.overlay_multiplier import process_overlay_multiplier

from database import SessionLocal

from core.security import get_current_user

from models.models import User, Document, Workflow

from helpers.get_time_date import get_time_date
from helpers.save_file.save_file import save_csv_data_in_folder
from helpers.make_json_serializable import make_json_serializable
from helpers.file_utils import read_data_file
from helpers.get_latest_file import get_latest_file

import re

router = APIRouter(prefix="/api/overlay/execution", tags=["overlay-execution"])

@router.post("/overlay_multiplier")
async def calculate_overlay_multiplier(workflow_id: int = Form(...),
                                        # use uploaded from tool or from development
                                        # true if uploaded, false if from development
                                        historical_weighted_credit_loss_rate_file: bool = Form(False, description="Use historical weighted credit loss rate file"),
                                        user_id: User = Depends(get_current_user)):
    """
        Calculate overlay multiplier calc
    """
    try:
        document_type = "OVERLAY_EXECUTION_OVERLAY_MULTIPLIER_CALC_OUTPUT"
        db = SessionLocal()
        try:
            workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
            
            # log_record = db.query(OverlayLogs).filter(
            #     OverlayLogs.workflow_id == workflow_id,
            #     OverlayLogs.submodule == "EXECUTION"
            # ).first()

            if not workflow:
                return JSONResponse(status_code=404, content={"detail": f"Workflow with ID {workflow_id} not found"})

            if historical_weighted_credit_loss_rate_file:
                default_rates_path = (
                    f"{get_root_folder()}/server/files/"
                    f"{workflow.entity}/"
                    f"{workflow.reporting_period}/"
                    f"{workflow.workflow_name}/"
                    f"input/overlay/execution/{workflow.loan_product}/OVERLAY_EXECUTION_HISTORICAL_WEIGHTED_CREDIT_LOSS_RATE"
                )
            else:
                default_rates_path = (
                    f"{get_root_folder()}/server/files/"
                    f"{workflow.entity}/"
                    f"{workflow.reporting_period}/"
                    f"{workflow.workflow_name}/"
                    f"output/flowrate_approach/{workflow.loan_product}/creditloss_rate"
                )

            print('default_rates_path', default_rates_path)

            forecasted_pd_calc_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/execution/{workflow.loan_product}/forecasted_pd_calc"
            )

            forecasted_pd_files = [f for f in os.listdir(forecasted_pd_calc_path) 
                    if f.startswith("forecasted_pd") and (f.endswith('.csv') or f.endswith('.xlsx'))]

            # Read forecasted_pd file
            forecasted_pd_data = None
            if forecasted_pd_files:
                latest_pd_file = sorted(forecasted_pd_files)[-1]
                pd_file_path = os.path.join(forecasted_pd_calc_path, latest_pd_file)
                forecasted_pd_df = read_data_file(pd_file_path)
            else:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "No forecasted_pd file found for this workflow",
                        "data": None
                    }
                )

            default_rates_file = get_latest_file(default_rates_path)
            default_rates_df = read_data_file(default_rates_file)

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

            if default_rates_df.empty:
                return JSONResponse(
                    status_code=404,
                    content= {
                        "code": -1,
                        "success": False,
                        "msg": "No default rates data found for this workflow",
                        "data": None
                    }
                )

            if forecasted_pd_df.empty:
                return JSONResponse(
                    status_code=404,
                    content= {
                        "code": -1,
                        "success": False,
                        "msg": "No forecasted PD data found for this workflow",
                        "data": None
                    }
                )
        finally:
            db.close()

        overlay_multiplier_res = process_overlay_multiplier(default_rates_df,
                                                            forecasted_pd_df)
        
        res = {
            'code': 1,
            'success': True,
            'msg': 'Success'
        }
        
        filename = f"overlay_multiplier_{get_time_date()}.csv"
        output_folder_path = f"{workflow.entity}/{workflow.reporting_period}/{workflow.workflow_name}/output/overlay/execution/{workflow.loan_product}/overlay_multiplier"
        document_type = "OVERLAY_EXECUTION_OVERLAY_MULTIPLIER_OUTPUT"

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
            csv_data=overlay_multiplier_res,
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
                f'An unexpected error occurred during overlay multiplier calculation. '
                f'Please verify that the Historical Weighted Credit Loss Rate input file and the Forecasted PD output '
                f'are available and have the correct format. Detail: {e}'
            )
        }
        return JSONResponse(status_code=500, content=res)


@router.get("/overlay_multiplier")
async def get_overlay_multiplier_results(workflow_id: int = Query(...),
                                         current_user: User = Depends(get_current_user)):
    """
    Get overlay multiplier results
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

            overlay_multiplier_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/execution/{workflow.loan_product}/overlay_multiplier"
            )

            print('overlay_multiplier_path', overlay_multiplier_path)
            
            if not os.path.exists(overlay_multiplier_path):
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": f"Overlay multiplier directory not found: {overlay_multiplier_path}",
                        "data": None
                    }
                )
            
            # Find files starting with "overlay_multiplier"
            overlay_multiplier_files = [f for f in os.listdir(overlay_multiplier_path) 
                    if f.startswith("overlay_multiplier") and (f.endswith('.csv') or f.endswith('.xlsx'))]

            if not overlay_multiplier_files:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "No overlay multiplier file found for this workflow",
                        "data": None
                    }
                )

            # Get the most recent file
            latest_file = sorted(overlay_multiplier_files)[-1]
            file_path = os.path.join(overlay_multiplier_path, latest_file)
            
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


@router.get("/overlay_multiplier/export")
async def export_overlay_multiplier(
    workflow_id: int = Query(...),
    current_user: User = Depends(get_current_user)
):
    """Export latest overlay multiplier data as CSV or Excel file."""
    try:
        db = SessionLocal()
        try:
            workflow = db.query(Workflow).filter(
                Workflow.id == workflow_id,
                Workflow.user_id == current_user.id
            ).first()

            if not workflow:
                return JSONResponse(status_code=404, content={"detail": f"Workflow with ID {workflow_id} not found"})

            overlay_multiplier_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/execution/{workflow.loan_product}/overlay_multiplier"
            )

            if not os.path.exists(overlay_multiplier_path):
                return JSONResponse(
                    status_code=404,
                    content={"detail": f"Overlay multiplier directory not found: {overlay_multiplier_path}"}
                )

            # Find files starting with "overlay_multiplier"
            overlay_multiplier_files = [f for f in os.listdir(overlay_multiplier_path) 
                    if f.startswith("overlay_multiplier") and (f.endswith('.csv') or f.endswith('.xlsx'))]

            if not overlay_multiplier_files:
                return JSONResponse(
                    status_code=404,
                    content={"detail": "No overlay multiplier file found"}
                )

            # Get the most recent file
            latest_file = sorted(overlay_multiplier_files)[-1]
            file_path = os.path.join(overlay_multiplier_path, latest_file)

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
                "msg": f"Error exporting overlay multiplier: {str(e)}",
                "data": None
            }
        )


