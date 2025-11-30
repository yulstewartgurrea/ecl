import os
import traceback
import pandas as pd

from fastapi import APIRouter, Depends, HTTPException, Form, Query, BackgroundTasks
from fastapi.responses import JSONResponse, FileResponse
from typing import Dict, Any, List

from models.models import User, Workflow
from core.security import get_current_user
from data_processing.overlay.development.filtering_models import run_filter_models

from database import SessionLocal

from helpers.get_root_folder import get_root_folder
from helpers.get_time_date import get_time_date
from helpers.make_json_serializable import make_json_serializable

from pathlib import Path

router = APIRouter(prefix="/api/overlay/development", tags=["overlay-development"])

@router.post("/filtering_models")
async def start_model_filtering(
    workload_id: int = Form(...),
    filter_list: str = Form(...),  # JSON string that will be parsed
    current_user: User = Depends(get_current_user)
):
    try:
        import json
        db = SessionLocal()
        
        # Parse filter_list JSON string
        try:
            parsed_filter_list = json.loads(filter_list) if isinstance(filter_list, str) else filter_list
        except (json.JSONDecodeError, TypeError):
            parsed_filter_list = []
        
        workflow = db.query(Workflow).filter(
            Workflow.id == workload_id, 
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
        
        portfolio = workflow.loan_product
        ODR = "odr.logit"
        num_of_vars = 2

        data_transformation_path = (
            f"{get_root_folder()}/files/"
            f"{workflow.entity}/"
            f"{workflow.reporting_period}/"
            f"{workflow.workflow_name}/"
            f"output/overlay/development/{portfolio}/data_transformation"
        )

        data_multifactor_analysis_path = (
            f"{get_root_folder()}/files/"
            f"{workflow.entity}/"
            f"{workflow.reporting_period}/"
            f"{workflow.workflow_name}/"
            f"output/overlay/development/{portfolio}/multifactor_analysis"
        )

        data_filtering_of_models_path = (
            f"{get_root_folder()}/files/"
            f"{workflow.entity}/"
            f"{workflow.reporting_period}/"
            f"{workflow.workflow_name}/"
            f"output/overlay/development/{portfolio}/filtering_of_models"
        )
        os.makedirs(data_filtering_of_models_path, exist_ok=True)

        run_filter_models(
            portfolio,
            ODR,
            num_of_vars,
            data_transformation_path,
            data_multifactor_analysis_path,
            data_filtering_of_models_path,
            parsed_filter_list
        )

        return JSONResponse(
            status_code=202,
            content={
                "code": 1,
                "success": True,
                "msg": "Success.",
                # "data": {
                #     "portfolio": portfolio,
                #     "target_variable": target_variable,
                #     "num_vars_taken": num_vars_taken
                # }
            }
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Unexpected error starting model filtering: {str(e)}",
                "data": None
            }
        )

@router.get("/filtering_models")
async def get_filtered_results(
    workflow_id: int = Query(..., description="Workflow ID"),
    current_user: User = Depends(get_current_user)
):
    """
    Get filtered model results
    
    Returns the best performing models that passed all filtering criteria.
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

        portfolio = workflow.loan_product
        ODR = "odr.logit"
        num_of_vars = 2
        
        filtering_of_models_path = (
            f"{get_root_folder()}/files/"
            f"{workflow.entity}/"
            f"{workflow.reporting_period}/"
            f"{workflow.workflow_name}/"
            f"output/overlay/development/{portfolio}/filtering_of_models"
        )
        
        filtering_of_models_file = max(
            Path(filtering_of_models_path).glob(f"{portfolio}_mfa_filtered_{ODR}_{num_of_vars}_var*"),
            key=lambda p: p.stat().st_mtime,   # last modified time
            default=None
        )
        print(filtering_of_models_file)
        
        df = []
        if filtering_of_models_file:
            df = pd.read_csv(filtering_of_models_file)
            df = make_json_serializable(df.to_dict('records'))

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
                "msg": f"Unexpected error retrieving filtered results: {str(e)}",
                "data": None
            }
        )


@router.get("/filtering_models/export")
async def export_filtered_results(
    workflow_id: int = Query(..., description="Workflow ID"),
    current_user: User = Depends(get_current_user)
):
    """Export the latest filtered models CSV based on the same logic as the GET endpoint."""
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

        portfolio = workflow.loan_product
        ODR = "odr.logit"
        num_of_vars = 2
        
        filtering_of_models_path = (
            f"{get_root_folder()}/files/"
            f"{workflow.entity}/"
            f"{workflow.reporting_period}/"
            f"{workflow.workflow_name}/"
            f"output/overlay/development/{portfolio}/filtering_of_models"
        )

        filtering_of_models_file = max(
            Path(filtering_of_models_path).glob(f"{portfolio}_mfa_filtered_{ODR}_{num_of_vars}_var*"),
            key=lambda p: p.stat().st_mtime,   # last modified time
            default=None
        )

        if not filtering_of_models_file:
            return JSONResponse(
                status_code=404,
                content={
                    "code": -1,
                    "success": False,
                    "msg": "Filtered results file not found",
                    "data": None
                }
            )

        filename = os.path.basename(str(filtering_of_models_file))
        return FileResponse(str(filtering_of_models_file), media_type="text/csv", filename=filename)
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Unexpected error exporting filtered results: {str(e)}",
                "data": None
            }
        )
