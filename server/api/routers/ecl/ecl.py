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
from data_processing.ecl.ecl import process_ecl_data

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
from helpers.format_dataframe_constructor import format_dataframe_constructor

import traceback
from pathlib import Path

router = APIRouter(prefix="/api/ecl", tags=["ecl"])

@router.post("/")
async def calculate_ecl_data(
    workflow_id: int = Form(...),
    probability_weights: str = Form(...),
    current_user: User = Depends(get_current_user)
):
    """
    Calculate ECL data
    """
    try:
        db = SessionLocal()

        try:
            parsed_probability_weights = json.loads(probability_weights) if isinstance(probability_weights, str) else probability_weights
        except (json.JSONDecodeError, TypeError):
            parsed_probability_weights = {}

        parsed_probability_weights = {
            k: float(v)
            for k, v in parsed_probability_weights.items()
        }
        
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

        client_loan_balances_path = (
            f"{get_root_folder()}/server/files/"
            f"{workflow.entity}/"
            f"{workflow.reporting_period}/"
            f"{workflow.workflow_name}/"
            f"input/ecl/{workflow.loan_product}/ECL_CLIENT_LOAN_BALANCES"
        )

        client_loan_balances_file = max(
            (p for p in Path(client_loan_balances_path).iterdir() if p.is_file()),
            key=lambda p: p.stat().st_mtime,
            default=None
        )

        credit_loss_rates_path = (
            f"{get_root_folder()}/server/files/"
            f"{workflow.entity}/"
            f"{workflow.reporting_period}/"
            f"{workflow.workflow_name}/"
            f"output/ecl/{workflow.loan_product}/creditloss_rate"
        )

        credit_loss_rates_file = max(
            (p for p in Path(credit_loss_rates_path).iterdir() if p.is_file()),
            key=lambda p: p.stat().st_mtime,
            default=None
        )

        ecl_res = process_ecl_data(client_loan_balances_file, credit_loss_rates_file, parsed_probability_weights)

        filename = f"{workflow.loan_product}_ecl_{get_time_date()}.xlsx"
        output_folder = f"{workflow.entity}/{workflow.reporting_period}/{workflow.workflow_name}/output/ecl/{workflow.loan_product}/ecl"
        document_type = "ECL_OUTPUT"

        # Save data in documents models
        db = SessionLocal()
        try:
            # Create Document record
            new_document = Document(
                filename=filename,
                json_data=None,
                document_type=document_type,
                user_id=current_user.id,
                workflow_id=workflow_id,
                workflow_path=f"{workflow.entity}/{workflow.reporting_period}/{workflow.workflow_name}"
            )
            db.add(new_document)
            db.commit()
            db.refresh(new_document)
        finally:
            db.close()
        
        save_csv_data_in_folder(
            workflow_path=output_folder,
            document_type=document_type,
            # csv_data is a daraframe
            csv_data=ecl_res,
            filename=filename
        )

        return JSONResponse(
            status_code=200,
            content={
                "code": 1,
                "success": True,
                "msg": "Success"
            }
        )

    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Something went wrong. {str(e)}",
                "data": None
            }
        )

