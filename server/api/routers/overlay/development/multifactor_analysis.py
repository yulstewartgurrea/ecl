import os
import traceback
import pandas as pd

from fastapi import APIRouter, Depends, HTTPException, Form, Query, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import Dict, Any

from models.models import User, Workflow, Document
from core.security import get_current_user
from data_processing.overlay.development.multifactor_analysis import (
    load_transformed_data,
    load_combinations,
    run_mfa)

from database import SessionLocal

from sqlalchemy import func, desc, case, or_
from sqlalchemy.orm import aliased

from helpers.get_root_folder import get_root_folder
from helpers.get_time_date import get_time_date
from helpers.make_json_serializable import make_json_serializable
from helpers.pagination import create_pagination_response, validate_pagination_params

from pathlib import Path

router = APIRouter(prefix="/api/overlay/development", tags=["overlay-development"])

@router.post("/multifactor_analysis")
async def process_multifactor_analysis(
    workflow_id: int = Form(...),
    target_variable: str = Form('odr.logit', description="Target variable (e.g., odr.logit)"),
    num_vars_taken: int = Form(2, description="Number of variables per combination"),
    max_combinations: int = Form(1000, description="Maximum number of combinations to test"),
    max_bgtest_order: int = Form(2, description="Maximum order for Breusch-Godfrey test"),
    current_user: User = Depends(get_current_user)
):
    """
    Start multifactor analysis (MFA) for credit risk modeling
    
    This endpoint runs a parallel multiple linear regression analysis to find the best
    combination of variables for predicting loan defaults.
    """
    try:
        db = SessionLocal()

        workflow = db.query(Workflow).filter(
            Workflow.id == workflow_id,
            Workflow.user_id == current_user.id
        ).first()

        portfolio = workflow.loan_product

        # from data transformation dependent variable names
        # ODR <- "AFC_ODR.logit"
        ODR = "odr.logit"

        data_transformation_path = (
            f"{get_root_folder()}/files/"
            f"{workflow.entity}/"
            f"{workflow.reporting_period}/"
            f"{workflow.workflow_name}/"
            f"output/overlay/development/{portfolio}/data_transformation"
        )

        print('data_transformation_path', data_transformation_path)
        

        # Step 1 — load data
        x_df, y_df, regression_data, x_names, y_names = load_transformed_data(workflow, 
                                                                              data_transformation_path)

        # (Optional) inspect like R's colnames/head
        print(list(regression_data.columns))
        print(regression_data.head(10))

        # # Step 2 — load combinations to run
        num_vars_taken = 2
        # # In R you slice to 4,000,000; you can set limit=None to run all
        mfa_runs = load_combinations(
            portfolio=portfolio,
            num_vars_taken=num_vars_taken,
            folder_path=data_transformation_path,
            limit=None,
        )
        num_comb = mfa_runs.shape[0]
        print(f"Number of combinations: {num_comb}")
        print("mfa_runs shape", mfa_runs)

        # # Step 3 — set BG test max order
        max_bgtest_order = 2

        # # Step 4 — run MFA (sequential; no background task)
        pid = os.getpid()
        multifactor_analysis_output_path = (
            f"{get_root_folder()}/files/"
            f"{workflow.entity}/"
            f"{workflow.reporting_period}/"
            f"{workflow.workflow_name}/"
            f"output/overlay/development/{portfolio}/multifactor_analysis"
        )
        out_csv = Path(f"{multifactor_analysis_output_path}/{portfolio}_mfa_{ODR}_{num_vars_taken}-var_{pid}_{get_time_date()}.csv")

        run_mfa(
            dep_var=ODR,
            combinations=mfa_runs,
            regression_data=regression_data,
            max_bg_order=max_bgtest_order,
            out_csv_path=out_csv,
            flush_every=100,  # adjust as you like
        )

    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Unexpected error starting MFA analysis: {str(e)}",
                "data": None
            }
        )

@router.get("/multifactor_analysis")
async def get_mfa_results(
    workflow_id: int = Query(..., description="Workflow ID"),
    page: int = Query(1, description="Page number (1-indexed)"),
    page_size: int = Query(100, description="Number of items per page"),
    current_user: User = Depends(get_current_user)
):
    """
    Get MFA analysis results with pagination
    
    Returns paginated results of the best performing variable combinations 
    based on the specified criteria.
    """
    try:
        # Validate pagination parameters
        page, page_size = validate_pagination_params(page, page_size, max_page_size=1000)
        
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
                    "msg": f"Workflow with ID {workflow_id} not found",
                    "data": None
                }
            )

        portfolio = workflow.loan_product

        multifactor_analysis_output_path = (
            f"{get_root_folder()}/files/"
            f"{workflow.entity}/"
            f"{workflow.reporting_period}/"
            f"{workflow.workflow_name}/"
            f"output/overlay/development/{portfolio}/multifactor_analysis"
        )

        if not os.path.exists(multifactor_analysis_output_path):
            print(f"❌ {multifactor_analysis_output_path} does not exist")
            return JSONResponse(
                status_code=404, 
                content={
                    "code": -1,
                    "success": False,
                    "msg": f"Multifactor analysis directory not found: {multifactor_analysis_output_path}",
                    "data": None
                }
            )

        folder_path = Path(multifactor_analysis_output_path)
        mfa_path = max(
            folder_path.glob(f"{portfolio}_mfa_odr.logit_2-var*"),
            key=lambda p: p.stat().st_mtime,   # last modified time
            default=None
        )
        
        if not mfa_path:
            return JSONResponse(
                status_code=404,
                content={
                    "code": -1,
                    "success": False,
                    "msg": f"No MFA results file found for portfolio {portfolio}",
                    "data": None
                }
            )

        # Read CSV file
        df = pd.read_csv(mfa_path)
        total_count = len(df)
        
        print(f"📊 MFA Results: {total_count} total records")
        print(f"📄 Pagination: Page {page}, Size {page_size}")

        # Convert to list of records for pagination
        all_records = make_json_serializable(df.to_dict('records'))
        
        # Create paginated response
        response = create_pagination_response(
            data=all_records,
            page=page,
            page_size=page_size,
            total_count=total_count,
            success=True,
            message="MFA results retrieved successfully"
        )

        return JSONResponse(status_code=200, content=response)
        
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Unexpected error retrieving MFA results: {str(e)}",
                "data": None
            }
        )
