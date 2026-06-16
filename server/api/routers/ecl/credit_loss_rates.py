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
from data_processing.ecl.credit_loss_rates import process_credit_loss_rates

from models.models import User, Workflow

from core.security import get_current_user

from models.models import Document
from database import SessionLocal

from helpers.get_time_date import get_time_date
from helpers.save_file.save_file import save_csv_data_in_folder
from helpers.make_json_serializable import make_json_serializable
from helpers.format_dataframe_constructor import format_dataframe_constructor

import traceback
from pathlib import Path

from helpers.get_latest_file import get_latest_file

router = APIRouter(prefix="/api/ecl", tags=["ecl-credit-loss-rates"])

@router.get("/credit_loss_rates")
async def get_credit_loss_rates_data(
    workflow_id: int = Query(..., description="Workflow ID"),
    current_user: User = Depends(get_current_user)
):
    """
    Get Credit Loss Rates data
    """
    try:
        db = SessionLocal()
        
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

        credit_loss_rates_path = (
            f"{get_root_folder()}/server/files/"
            f"{workflow.entity}/"
            f"{workflow.reporting_period}/"
            f"{workflow.workflow_name}/"
            f"output/ecl/{workflow.loan_product}/creditloss_rate"
        )

        credit_loss_rates_file = max(
            Path(credit_loss_rates_path).glob(f"{workflow.loan_product}_creditloss_rate_*"),
            key=lambda p: p.stat().st_mtime,   # last modified time
            default=None
        )
        
        df = []
        if credit_loss_rates_file:
            print("Picked credit loss rates file:", credit_loss_rates_file, "suffix:", credit_loss_rates_file.suffix)

            if credit_loss_rates_file.suffix.lower() == ".xlsx":
                xdf = pd.read_excel(credit_loss_rates_file, engine="openpyxl")
            elif credit_loss_rates_file.suffix.lower() == ".xls":
                xdf = pd.read_excel(credit_loss_rates_file, engine="xlrd")
            else:
                # fallback (in case file naming is weird)
                xdf = pd.read_excel(credit_loss_rates_file, engine="openpyxl")

            df = make_json_serializable(xdf.to_dict("records"))

        return JSONResponse(
            status_code=200,
            content={
                "code": 1,
                "success": True,
                "data": df
            }
        )

    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Error retrieving credit loss rates: {str(e)}",
                "data": None
            }
        )

@router.post("/credit_loss_rates")
async def calculate_credit_loss_rates(
    workflow_id: int = Form(...),
    probability_weights: str = Form(...),  # JSON string that will be parsed
    current_user: User = Depends(get_current_user)
):
    """
    Calculate Credit Loss Rates
    """
    try:
        db = SessionLocal()
        # Parse probability_weights JSON string
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

        aging_report_path = (
            f"{get_root_folder()}/server/files/"
            f"{workflow.entity}/"
            f"{workflow.reporting_period}/"
            f"{workflow.workflow_name}/"
            f"{workflow.loan_product}/"
            f"input/flowrate_approach/"
        )

        aging_report_file = get_latest_file(aging_report_path)

        net_flow_rate_path = (
            f"{get_root_folder()}/server/files/"
            f"{workflow.entity}/"
            f"{workflow.reporting_period}/"
            f"{workflow.workflow_name}/"
            f"output/flowrate_approach/{workflow.loan_product}/creditloss_rate"
        )

        net_flow_rate_file = get_latest_file(net_flow_rate_path)

        ecl_multiplier_path = (
            f"{get_root_folder()}/server/files/"
            f"{workflow.entity}/"
            f"{workflow.reporting_period}/"
            f"{workflow.workflow_name}/"
            f"{workflow.loan_product}/"
            f"input/flowrate_approach/"
        )

        ecl_multiplier_file = get_latest_file(ecl_multiplier_path)

        overlay_multiplier_path = (
            f"{get_root_folder()}/server/files/"
            f"{workflow.entity}/"
            f"{workflow.reporting_period}/"
            f"{workflow.workflow_name}/"
            f"output/overlay/execution/{workflow.loan_product}/overlay_multiplier"
        )

        overlay_multiplier_file = get_latest_file(overlay_multiplier_path)

        development_historical_default_rate_path = (
            f"{get_root_folder()}/server/files/"
            f"{workflow.entity}/"
            f"{workflow.reporting_period}/"
            f"{workflow.workflow_name}/"
            f"input/overlay/development/{workflow.loan_product}/OVERLAY_DEVELOPMENT_HISTORICAL_DEFAULT_RATE"
        )

        historical_default_rates_file = get_latest_file(development_historical_default_rate_path)
        if not historical_default_rates_file:
            execution_historical_weighted_credit_loss_rate_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"input/overlay/execution/{workflow.loan_product}/OVERLAY_EXECUTION_HISTORICAL_WEIGHTED_CREDIT_LOSS_RATE"
            )
            historical_default_rates_file = get_latest_file(execution_historical_weighted_credit_loss_rate_path)

        print(aging_report_file)
        print(parsed_probability_weights)

        missing_inputs = []
        if not aging_report_file:
            missing_inputs.append("Flowrate Approach aging report (input/flowrate_approach)")
        if not net_flow_rate_file:
            missing_inputs.append("Flowrate Approach credit loss rate output")
        if not ecl_multiplier_file:
            missing_inputs.append("ECL multiplier (input/flowrate_approach)")
        if not overlay_multiplier_file:
            missing_inputs.append("Overlay execution multiplier output")
        if not historical_default_rates_file:
            missing_inputs.append("Overlay historical default rate / weighted credit loss rate")
        if missing_inputs:
            return JSONResponse(
                status_code=400,
                content={
                    "code": -1,
                    "success": False,
                    "msg": (
                        "Cannot calculate Credit Loss Rates — required input(s) not found: "
                        + "; ".join(missing_inputs)
                    ),
                    "data": None
                }
            )

        process_credit_loss_rates_res = process_credit_loss_rates(
            aging_report_file,
            ecl_multiplier_file,
            parsed_probability_weights,
            net_flow_rate_file,
            overlay_multiplier_file,
            historical_default_rates_file
        )

        filename = f"{workflow.loan_product}_creditloss_rate_{get_time_date()}.xlsx"
        output_folder = f"{workflow.entity}/{workflow.reporting_period}/{workflow.workflow_name}/output/ecl/{workflow.loan_product}/creditloss_rate"
        document_type = "ECL_CREDIT_LOSS_RATES_OUTPUT"

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
        
        print(process_credit_loss_rates_res)
        save_csv_data_in_folder(
            workflow_path=output_folder,
            document_type=document_type,
            # csv_data is a daraframe
            csv_data=process_credit_loss_rates_res,
            filename=filename
        )

        res = {
            'code': 1,
            'success': True,
            'msg': 'Succes'
        }
        return JSONResponse(status_code=200, content=res)
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Error calculating credit loss rates: {str(e)}",
                "data": None
            }
        )

@router.get("/credit_loss_rates/export")
async def export_credit_loss_rates(
    workflow_id: int = Query(..., description="Workflow ID"),
    current_user: User = Depends(get_current_user)
):
    """
    Export Credit Loss Rates data as Excel file
    """
    try:
        db = SessionLocal()
        
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

        credit_loss_rates_path = (
            f"{get_root_folder()}/server/files/"
            f"{workflow.entity}/"
            f"{workflow.reporting_period}/"
            f"{workflow.workflow_name}/"
            f"output/ecl/{workflow.loan_product}/creditloss_rate"
        )

        credit_loss_rates_file = max(
            Path(credit_loss_rates_path).glob(f"{workflow.loan_product}_creditloss_rate_*"),
            key=lambda p: p.stat().st_mtime,   # last modified time
            default=None
        )

        if not credit_loss_rates_file:
            return JSONResponse(
                status_code=404,
                content={
                    "code": -1,
                    "success": False,
                    "msg": "Credit loss rates file not found",
                    "data": None
                }
            )

        filename = os.path.basename(str(credit_loss_rates_file))
        return FileResponse(str(credit_loss_rates_file), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename=filename)
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Error exporting credit loss rates: {str(e)}",
                "data": None
            }
        )