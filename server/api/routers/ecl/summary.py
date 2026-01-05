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
from data_processing.ecl.summary import process_summary_data

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

router = APIRouter(prefix="/api/ecl", tags=["ecl-summary"])

@router.post("/summary")
async def get_summary_data(
    workflow_id: int = Form(...),
    current_user: User = Depends(get_current_user)
):
    """
    Get Summary data
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

        aging_report_path = (
            f"{get_root_folder()}/server/files/"
            f"{workflow.entity}/"
            f"{workflow.reporting_period}/"
            f"{workflow.workflow_name}/"
            f"{workflow.loan_product}/"
            f"input/flowrate_approach/"
        )

        aging_report_file = max(
            (p for p in Path(aging_report_path).iterdir() if p.is_file()),
            key=lambda p: p.stat().st_mtime,
            default=None
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

        ecl_res = process_summary_data(aging_report_file, ecl_file)

        filename = f"{workflow.loan_product}_ecl_summary_{get_time_date()}.xlsx"
        output_folder = f"{workflow.entity}/{workflow.reporting_period}/{workflow.workflow_name}/output/ecl/{workflow.loan_product}/ecl_summary"
        document_type = "ECL_SUMMARY"

        # # Save data in documents models
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

@router.get("/summary")
async def get_summary_data(
    workflow_id: int = Query(..., description="Workflow ID"),
    page: int = Query(1, description="Page number (1-indexed)"),
    page_size: int = Query(100, description="Number of items per page"),
    current_user: User = Depends(get_current_user)
):
    """
    Get Summary data with pagination
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

        summary_path = (
            f"{get_root_folder()}/server/files/"
            f"{workflow.entity}/"
            f"{workflow.reporting_period}/"
            f"{workflow.workflow_name}/"
            f"output/ecl/{workflow.loan_product}/ecl_summary"
        )

        summary_file = max(
            Path(summary_path).glob(f"{workflow.loan_product}_ecl_summary_*"),
            key=lambda p: p.stat().st_mtime,   # last modified time
            default=None
        )
        
        if not summary_file:
            return JSONResponse(
                status_code=200,
                content={
                    "code": 1,
                    "success": True,
                    "msg": "Summary data retrieved successfully",
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

        print("Picked Summary file:", summary_file, "suffix:", summary_file.suffix)

        # Read Excel file
        if summary_file.suffix.lower() == ".xlsx":
            xdf = pd.read_excel(summary_file, engine="openpyxl")
        elif summary_file.suffix.lower() == ".xls":
            xdf = pd.read_excel(summary_file, engine="xlrd")
        else:
            # fallback (in case file naming is weird)
            xdf = pd.read_excel(summary_file, engine="openpyxl")

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
            "msg": "Summary data retrieved successfully",
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
                "msg": f"Error retrieving summary data: {str(e)}",
                "data": None
            }
        )

@router.get("/summary/export")
async def export_summary_data(
    workflow_id: int = Query(..., description="Workflow ID"),
    current_user: User = Depends(get_current_user)
):
    """
    Export Summary data as Excel file
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

        summary_path = (
            f"{get_root_folder()}/server/files/"
            f"{workflow.entity}/"
            f"{workflow.reporting_period}/"
            f"{workflow.workflow_name}/"
            f"output/ecl/{workflow.loan_product}/ecl_summary"
        )

        summary_file = max(
            Path(summary_path).glob(f"{workflow.loan_product}_ecl_summary_*"),
            key=lambda p: p.stat().st_mtime,   # last modified time
            default=None
        )

        if not summary_file:
            return JSONResponse(
                status_code=404,
                content={
                    "code": -1,
                    "success": False,
                    "msg": "Summary file not found",
                    "data": None
                }
            )

        filename = os.path.basename(str(summary_file))
        return FileResponse(str(summary_file), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename=filename)
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Error exporting summary data: {str(e)}",
                "data": None
            }
        )