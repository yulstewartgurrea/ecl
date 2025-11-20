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

@router.get("/final_pit_pd")
async def get_final_pit_pd(workflow_id: int = Query(...),
                            current_user: User = Depends(get_current_user)):
    """
    Get final PiT PD results
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

            # Keep only requested columns
            desired_cols = ['Bucket', 'FL PiT PD Best', 'FL PiT PD Base', 'FL PiT PD Worst']
            try:
                data = data[desired_cols]
            except KeyError:
                # Fallback: keep only present desired columns
                present = [c for c in desired_cols if c in data.columns]
                data = data[present]
            
            # Rename 'Total' row label to 'Portfolio PD' if present
            if 'Bucket' in data.columns:
                data['Bucket'] = data['Bucket'].replace({'Total': 'Portfolio PD'})
            
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