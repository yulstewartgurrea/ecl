from fastapi import Depends, Form, Query
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from starlette.responses import StreamingResponse
from io import BytesIO
import pandas as pd
import os
import json
from typing import List, Dict, Any, Optional
from math import ceil
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

@router.get("/")
async def get_ecl_data(
    workflow_id: int = Query(..., description="Workflow ID"),
    page: int = Query(1, description="Page number (1-indexed)"),
    page_size: int = Query(100, description="Number of items per page"),
    current_user: User = Depends(get_current_user)
):
    """
    Get ECL data with pagination
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

        if not client_loan_balances_file:
            return JSONResponse(
                status_code=200,
                content={
                    "code": 1,
                    "success": True,
                    "msg": "Client loan balances file not found",
                    "data": None
                }
            )

        if client_loan_balances_file.suffix.lower() == ".xlsx":
            xdf = pd.read_excel(
                client_loan_balances_file,
                engine="openpyxl",
                header=None,
                nrows=2
            )
        elif client_loan_balances_file.suffix.lower() == ".xls":
            xdf = pd.read_excel(
                client_loan_balances_file,
                engine="xlrd",
                header=None,
                nrows=2
            )
        else:
            xdf = pd.read_excel(
                client_loan_balances_file,
                engine="openpyxl",
                header=None,
                nrows=2
            )
        print('xdf \n', xdf)

        total_loan_balance = int(xdf.iat[1, 1])

        ecl_path = (
            f"{get_root_folder()}/server/files/"
            f"{workflow.entity}/"
            f"{workflow.reporting_period}/"
            f"{workflow.workflow_name}/"
            f"output/ecl/{workflow.loan_product}/ecl"
        )

        ecl_file = max(
            Path(ecl_path).glob(f"{workflow.loan_product}_ecl_*"),
            key=lambda p: p.stat().st_mtime,   # last modified time
            default=None
        )
        
        if not ecl_file:
            return JSONResponse(
                status_code=200,
                content={
                    "code": 1,
                    "success": True,
                    "msg": "ECL data retrieved successfully",
                    "total_loan_balance": None,
                    "data": [],
                    "pagination": {
                        "current_page": 1,
                        "page_size": page_size,
                        "total_items": 0,
                        "total_pages": 0,
                        "has_next": False,
                        "has_previous": False,
                        "next_page": None,
                        "previous_page": None,
                        "start_index": 0,
                        "end_index": 0
                    }
                }
            )

        print("Picked ECL file:", ecl_file, "suffix:", ecl_file.suffix)

        # Read Excel file
        if ecl_file.suffix.lower() == ".xlsx":
            xdf = pd.read_excel(ecl_file, engine="openpyxl")
        elif ecl_file.suffix.lower() == ".xls":
            xdf = pd.read_excel(ecl_file, engine="xlrd")
        else:
            # fallback (in case file naming is weird)
            xdf = pd.read_excel(ecl_file, engine="openpyxl")

        # Get total count before slicing
        total_count = len(xdf)

        # Convert Timestamp/datetime columns to strings for JSON serialization
        for col in xdf.columns:
            if pd.api.types.is_datetime64_any_dtype(xdf[col]):
                xdf[col] = xdf[col].dt.strftime('%Y-%m-%d').replace('NaT', None)
            elif xdf[col].dtype == 'object':
                # Check if column contains Timestamp objects
                if xdf[col].notna().any():
                    sample_val = xdf[col].dropna().iloc[0] if len(xdf[col].dropna()) > 0 else None
                    if isinstance(sample_val, pd.Timestamp):
                        xdf[col] = xdf[col].apply(lambda x: x.strftime('%Y-%m-%d') if pd.notna(x) and isinstance(x, pd.Timestamp) else x)

        # Validate pagination parameters
        if page < 1:
            page = 1
        if page_size < 1:
            page_size = 100
        elif page_size > 1000:  # Max page size limit
            page_size = 1000

        # Calculate pagination slice
        offset = (page - 1) * page_size
        end_idx = offset + page_size

        # Slice DataFrame BEFORE converting to JSON (memory efficient!)
        page_df = xdf.iloc[offset:end_idx]

        # Convert ONLY current page to JSON
        page_records = make_json_serializable(page_df.to_dict("records"))

        # Calculate pagination metadata
        total_pages = ceil(total_count / page_size) if total_count > 0 else 0
        
        # Ensure page doesn't exceed total pages
        if page > total_pages and total_pages > 0:
            page = total_pages
            offset = (page - 1) * page_size
            end_idx = offset + page_size
            page_df = xdf.iloc[offset:end_idx]
            page_records = make_json_serializable(page_df.to_dict("records"))

        # Build paginated response
        response = {
            "code": 1,
            "success": True,
            "msg": "ECL data retrieved successfully",
            "total_loan_balance": total_loan_balance,
            "data": page_records,
            "pagination": {
                "current_page": page,
                "page_size": page_size,
                "total_items": total_count,
                "total_pages": total_pages,
                "has_next": end_idx < total_count,
                "has_previous": page > 1,
                "next_page": page + 1 if end_idx < total_count else None,
                "previous_page": page - 1 if page > 1 else None,
                "start_index": offset + 1 if total_count > 0 else 0,
                "end_index": min(end_idx, total_count)
            }
        }

        return JSONResponse(
            status_code=200,
            content=response
        )

    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Error retrieving ECL data: {str(e)}",
                "data": None
            }
        )

@router.get("/export")
async def export_ecl_data(
    workflow_id: int = Query(..., description="Workflow ID"),
    current_user: User = Depends(get_current_user)
):
    """
    Export ECL data as Excel file
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

        ecl_path = (
            f"{get_root_folder()}/server/files/"
            f"{workflow.entity}/"
            f"{workflow.reporting_period}/"
            f"{workflow.workflow_name}/"
            f"output/ecl/{workflow.loan_product}/ecl"
        )

        ecl_file = max(
            Path(ecl_path).glob(f"{workflow.loan_product}_ecl_*"),
            key=lambda p: p.stat().st_mtime,   # last modified time
            default=None
        )

        if not ecl_file:
            return JSONResponse(
                status_code=404,
                content={
                    "code": -1,
                    "success": False,
                    "msg": "ECL file not found",
                    "data": None
                }
            )

        filename = os.path.basename(str(ecl_file))
        return FileResponse(str(ecl_file), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename=filename)
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Error exporting ECL data: {str(e)}",
                "data": None
            }
        )

