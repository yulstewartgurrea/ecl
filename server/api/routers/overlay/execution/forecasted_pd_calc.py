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
from data_processing.overlay.execution.forecasted_pd_calc import process_forecasted_pd_calc

from database import SessionLocal

from core.security import get_current_user

from models.models import User, Document, Workflow

from helpers.get_time_date import get_time_date
from helpers.save_file.save_file import save_csv_data_in_folder
from helpers.make_json_serializable import make_json_serializable
from helpers.file_utils import read_data_file
from helpers.get_latest_file import get_latest_file
from pathlib import Path

import re

router = APIRouter(prefix="/api/overlay/execution", tags=["overlay-execution"])

@router.post("/forecasted_pd_calc")
async def calculate_forecasted_pd_calc(workflow_id: int = Form(...),
                                        # use uploaded from tool or from development
                                        # true if uploaded, false if from development
                                        final_model_execution_file: bool = Form(False, description="Use final model execution file"),
                                        user_id: User = Depends(get_current_user)):
    """
        Calculate forecasted PD calc
    """
    try:
        document_type = "OVERLAY_EXECUTION_FORECASTED_PD_CALC_OUTPUT"
        db = SessionLocal()
        try:
            workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
            
            # log_record = db.query(OverlayLogs).filter(
            #     OverlayLogs.workflow_id == workflow_id,
            #     OverlayLogs.submodule == "EXECUTION"
            # ).first()

            if final_model_execution_file:
                finals_overlay_model_path = (
                    f"{get_root_folder()}/server/files/"
                    f"{workflow.entity}/"
                    f"{workflow.reporting_period}/"
                    f"{workflow.workflow_name}/"
                    f"input/overlay/execution/{workflow.loan_product}/OVERLAY_EXECUTION_FINAL_MODEL"
                )
            else:
                finals_overlay_model_path = (
                    f"{get_root_folder()}/server/files/"
                    f"{workflow.entity}/"
                    f"{workflow.reporting_period}/"
                    f"{workflow.workflow_name}/"
                    f"output/overlay/development/{workflow.loan_product}/final_models"
                )

            # Get transform forecasted mev
            transform_forecasted_mevs_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/execution/{workflow.loan_product}/transform_forecasted_mevs"
            )

            # Get data from transformation
            independent_data_transformation_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/execution/{workflow.loan_product}/data_transformation"
            )
            independent_data_transformation_path = Path(independent_data_transformation_path)

            finals_overlay_model_file = get_latest_file(finals_overlay_model_path)
            transform_forecasted_mevs_file = get_latest_file(transform_forecasted_mevs_path)
            independent_data_transformation_file = max(
                independent_data_transformation_path.glob(f"{workflow.loan_product}_Dependent - Transformed with Time*"),
                key=lambda p: p.stat().st_mtime,   # last modified time
                default=None
            )

            print('finals_overlay_model_file', finals_overlay_model_file)
            print('transform_forecasted_mevs_file', transform_forecasted_mevs_file)
            print('independent_data_transformation_file', independent_data_transformation_file)

            finals_overlay_model_df = read_data_file(finals_overlay_model_file)
            transform_forecasted_mevs_df = read_data_file(transform_forecasted_mevs_file)
            independent_data_transformation_df = read_data_file(independent_data_transformation_file)
            print('independent_data_transformation_df', independent_data_transformation_df)

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

            if finals_overlay_model_df.empty:
                print('finals_overlay_model_df is empty')
                return JSONResponse(
                    status_code=400,
                    content= {
                        "code": -1,
                        "success": False,
                        "msg": "No final model data found for this workflow",
                        "data": None
                    }
                )

            if transform_forecasted_mevs_df.empty:
                print('transform_forecasted_mevs_df is empty')
                return JSONResponse(
                    status_code=400,
                    content= {
                        "code": -1,
                        "success": False,
                        "msg": "No transform forecasted MEVs data found for this workflow",
                        "data": None
                    }
                )

            if independent_data_transformation_df.empty:
                print('independent_data_transformation_df is empty')
                return JSONResponse(
                    status_code=400,
                    content= {
                        "code": -1,
                        "success": False,
                        "msg": "No independent data transformation data found for this workflow. This is required for forecasted PD calc.",
                        "data": None
                    }
                )
        finally:
            db.close()

        process_forecasted_pd_calc_res = process_forecasted_pd_calc(
            finals_overlay_model_df,
            transform_forecasted_mevs_df,
            independent_data_transformation_df)
        
        res = {
            'code': 1,
            'success': True,
            'msg': 'Success'
        }
        
        filenames = [
            f"multiple_linear_regression_{get_time_date()}.csv",
            f"forecasted_pd_{get_time_date()}.csv"
        ]
        output_folder_path = f"{workflow.entity}/{workflow.reporting_period}/{workflow.workflow_name}/output/overlay/execution/{workflow.loan_product}/forecasted_pd_calc"
        document_type = "OVERLAY_EXECUTION_FORECASTED_PD_CALC_OUTPUT"

        # Save data in documents models
        for filename in filenames:
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

            csv_data = None
            if 'multiple_linear_regression' in filename:
                csv_data = process_forecasted_pd_calc_res['multiple_linear_regression']
            elif 'forecasted_pd' in filename:
                csv_data = process_forecasted_pd_calc_res['forecasted_pd']
            else:
                raise ValueError(f"Invalid filename: {filename}")
                
            save_csv_data_in_folder(
                workflow_path=output_folder_path,
                document_type=document_type,
                # csv_data is a daraframe
                csv_data=csv_data,
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
                f'An unexpected error occurred during forecasted PD calculation. '
                f'Please verify that the Final Models file, Transform Forecasted MEVs output, and '
                f'Data Transformation (Independent) output are available and have the correct format. Detail: {e}'
            )
        }
        return JSONResponse(status_code=500, content=res)


@router.get("/forecasted_pd_calc")
async def get_forecasted_pd_calc_results(workflow_id: int = Query(...),
                                         current_user: User = Depends(get_current_user)):
    """
    Get forecasted PD calc results (multiple linear regression or forecasted PD)
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

            forecasted_pd_calc_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/execution/{workflow.loan_product}/forecasted_pd_calc"
            )

            print('forecasted_pd_calc_path', forecasted_pd_calc_path)
            
            # Get both files: multiple_linear_regression and forecasted_pd
            multiple_linear_regression_files = [f for f in os.listdir(forecasted_pd_calc_path) 
                    if f.startswith("multiple_linear_regression") and (f.endswith('.csv') or f.endswith('.xlsx'))]
            
            forecasted_pd_files = [f for f in os.listdir(forecasted_pd_calc_path) 
                    if f.startswith("forecasted_pd") and (f.endswith('.csv') or f.endswith('.xlsx'))]

            # Read multiple_linear_regression file
            multiple_linear_regression_data = None
            if multiple_linear_regression_files:
                latest_mlr_file = sorted(multiple_linear_regression_files)[-1]
                mlr_file_path = os.path.join(forecasted_pd_calc_path, latest_mlr_file)
                multiple_linear_regression_data = read_data_file(mlr_file_path)
 
                print('multiple_linear_regression_data \n', multiple_linear_regression_data)
                # Convert Period column to string for JSON serialization
                if 'Period' in multiple_linear_regression_data.columns:
                    multiple_linear_regression_data['Period'] = pd.to_datetime(
                        multiple_linear_regression_data['Period'], errors='coerce'
                    ).dt.strftime('%Y-%m-%d')
                # Replace NaN values with None for JSON serialization
                multiple_linear_regression_data = multiple_linear_regression_data.replace({np.nan: None})
                multiple_linear_regression_data = multiple_linear_regression_data.to_dict(orient='records')
            else:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "No multiple_linear_regression file found for this workflow",
                        "data": None
                    }
                )

            # Read forecasted_pd file
            forecasted_pd_data = None
            if forecasted_pd_files:
                latest_pd_file = sorted(forecasted_pd_files)[-1]
                pd_file_path = os.path.join(forecasted_pd_calc_path, latest_pd_file)
                forecasted_pd_data = read_data_file(pd_file_path)
                print()
                # Convert Period column to string for JSON serialization
                if 'Period' in forecasted_pd_data.columns:
                    forecasted_pd_data['Period'] = pd.to_datetime(
                        forecasted_pd_data['Period'], errors='coerce'
                    ).dt.strftime('%Y-%m-%d')
                # Replace NaN values with None for JSON serialization
                forecasted_pd_data = forecasted_pd_data.replace({np.nan: None})
                forecasted_pd_data = forecasted_pd_data.to_dict(orient='records')
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
            
            return {
                "code": 1, 
                "success": True,
                "data": {
                    "multiple_linear_regression": multiple_linear_regression_data,
                    "forecasted_pd": forecasted_pd_data
                }
            }
            
        finally:
            db.close()
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Error retrieving forecasted PD calc: {str(e)}",
                "data": None
            }
        )


@router.get("/forecasted_pd_calc/export")
async def export_forecasted_pd_calc(
    workflow_id: int = Query(...),
    file_type: str = Query("forecasted_pd", description="multiple_linear_regression | forecasted_pd"),
    current_user: User = Depends(get_current_user)
):
    """Export latest forecasted PD calc data as CSV or Excel file."""
    try:
        db = SessionLocal()
        try:
            workflow = db.query(Workflow).filter(
                Workflow.id == workflow_id,
                Workflow.user_id == current_user.id
            ).first()

            if not workflow:
                return JSONResponse(status_code=404, content={"detail": f"Workflow with ID {workflow_id} not found"})

            forecasted_pd_calc_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/execution/{workflow.loan_product}/forecasted_pd_calc"
            )

            if not os.path.exists(forecasted_pd_calc_path):
                return JSONResponse(
                    status_code=404,
                    content={"detail": f"Forecasted PD calc directory not found: {forecasted_pd_calc_path}"}
                )

            # Get the latest file based on file_type
            if file_type == "multiple_linear_regression":
                files = [f for f in os.listdir(forecasted_pd_calc_path) 
                        if f.startswith("multiple_linear_regression") and (f.endswith('.csv') or f.endswith('.xlsx'))]
            elif file_type == "forecasted_pd":
                files = [f for f in os.listdir(forecasted_pd_calc_path) 
                        if f.startswith("forecasted_pd") and (f.endswith('.csv') or f.endswith('.xlsx'))]
            else:
                return JSONResponse(
                    status_code=400,
                    content={"detail": "Invalid file_type. Use 'multiple_linear_regression' or 'forecasted_pd'"}
                )

            if not files:
                return JSONResponse(
                    status_code=404,
                    content={"detail": f"No {file_type} file found"}
                )

            # Get the most recent file
            latest_file = sorted(files)[-1]
            file_path = os.path.join(forecasted_pd_calc_path, latest_file)

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
                "msg": f"Error exporting forecasted PD calc: {str(e)}",
                "data": None
            }
        )

@router.get("/forecasted_pd_calc/input")
async def forecasted_pd_calc_input(
    workflow_id: int = Query(..., description="Workflow ID to export override forecasted MEVs for"),
    current_user: User = Depends(get_current_user)
):
    try:

        db = SessionLocal()
        try:
            workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()

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
            
            # log_record = db.query(OverlayLogs).filter(
            #     OverlayLogs.workflow_id == workflow_id,
            #     OverlayLogs.submodule == "EXECUTION"
            # ).first()

            finals_overlay_model_path = (
                f"{get_root_folder()}/server/files/"
                f"{workflow.entity}/"
                f"{workflow.reporting_period}/"
                f"{workflow.workflow_name}/"
                f"output/overlay/development/{workflow.loan_product}/final_models"
            )
            finals_overlay_model_file = get_latest_file(finals_overlay_model_path)
            if finals_overlay_model_file is None:
                finals_overlay_model_path = (
                    f"{get_root_folder()}/server/files/"
                    f"{workflow.entity}/"
                    f"{workflow.reporting_period}/"
                    f"{workflow.workflow_name}/"
                    f"input/overlay/execution/{workflow.loan_product}/OVERLAY_EXECUTION_FINAL_MODEL"
                )
                finals_overlay_model_file = get_latest_file(finals_overlay_model_path)

            print(finals_overlay_model_path)
            finals_overlay_model_df = read_data_file(finals_overlay_model_file)

            if finals_overlay_model_df.empty:
                return JSONResponse(
                    status_code=404,
                    content= {
                        "code": -1,
                        "success": False,
                        "msg": "No data interpolation data found for this workflow",
                        "data": None
                    }
                )

            final_variable_model = format_variable_model(finals_overlay_model_df)

        finally:
            db.close()

        res = {
            'code': 1,
            'success': True,
            'msg': 'Success',
            'data': final_variable_model
        }

        return JSONResponse(status_code=200, content=res)

    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Error retrieving forecasted PD calc input: {str(e)}",
                "data": None
            }
        )

def format_variable_model(finals_overlay_model_df):
    # Get intercept value (usually 1 row only, so get from first row)
    if finals_overlay_model_df.empty:
        raise ValueError("finals_overlay_model_df is empty")
    
    intercept = finals_overlay_model_df.iloc[0]['intercept']
    # Convert NaN to None for JSON serialization
    intercept = None if pd.isna(intercept) else float(intercept)
    print(f"Intercept value: {intercept}")
    
    # Find all X columns (X1, X2, X3, etc.) and get their variable names and coefficients
    x_pattern = re.compile(r'^[Xx](\d+)$', re.IGNORECASE)
    x_variables = {}  # Dictionary to store X column number -> variable name -> coefficient value
    
    for col in finals_overlay_model_df.columns:
        x_match = x_pattern.match(col)
        if x_match:
            x_num = x_match.group(1)  # Get the number (1, 2, 3, etc.)
            x_col = col  # Use the actual column name (could be "X1" or "x1")
            
            # Find coeff column case-insensitively (could be "coeff_X1" or "coeff_x1")
            coeff_col = None
            for df_col in finals_overlay_model_df.columns:
                if df_col.lower() == f"coeff_x{x_num}".lower():
                    coeff_col = df_col
                    break
            
            # Get the variable name from X column (e.g., 'rrp_rate' from X1)
            variable_name = finals_overlay_model_df.iloc[0][x_col]
            
            # Get the coefficient value from coeff column (case-insensitive lookup)
            if coeff_col and coeff_col in finals_overlay_model_df.columns:
                coefficient_value = finals_overlay_model_df.iloc[0][coeff_col]
                # Convert NaN to None for JSON serialization
                coefficient_value = None if pd.isna(coefficient_value) else float(coefficient_value)
                x_variables[x_col] = {
                    'variable_name': variable_name,
                    'coefficient': coefficient_value
                }
                print(f"{x_col} = {variable_name}, coefficient = {coefficient_value}")
            else:
                print(f"Warning: coeff column for {x_col} not found in columns")
                x_variables[x_col] = {
                    'variable_name': variable_name,
                    'coefficient': None
                }
    
    print(f"Found {len(x_variables)} X variables: {x_variables}")

    # Format as dictionary with intercept and variable names as keys
    final_format = {'intercept': intercept}
    
    # Add each variable name with its coefficient value
    for x_col, var_info in x_variables.items():
        variable_name = var_info['variable_name']
        coefficient_value = var_info['coefficient']
        if variable_name:  # Only add if variable name exists
            final_format[variable_name] = coefficient_value
    
    return final_format