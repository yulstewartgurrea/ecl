from fastapi import APIRouter, HTTPException, Depends, Form, Query
from fastapi.responses import JSONResponse

import pandas as pd
import numpy as np
import os
import json
import traceback

from typing import List, Dict, Any, Optional
from helpers.file_utils import find_and_read_data_file, get_root_folder
from data_processing.overlay.development.data_transformation import process_data_transformation

from database import SessionLocal

from core.security import get_current_user

from models.models import User, Document, Workflow
from models.overlay.development import (
    OverlayDevelopmentMonthlyHistoricalMevInput,
    OverlayDevelopmentDataInterpolationOutput,
    OverlayDevelopmentHistoricalDefaultRateInput,
    OverlayDevelopmentDataTransformationOutput,
    OverlayLogs
)

from helpers.get_time_date import get_time_date
from helpers.save_csv_data_in_folder import save_csv_data_in_folder

def clean_dataframe_for_json(df: pd.DataFrame) -> pd.DataFrame:
    """
    Clean DataFrame to make it JSON compliant by replacing inf/-inf/NaN with None
    """
    df_clean = df.copy()
    
    # Check for problematic values before cleaning
    numeric_cols = df_clean.select_dtypes(include=[np.number]).columns
    if len(numeric_cols) > 0:
        inf_count = np.isinf(df_clean[numeric_cols]).sum().sum()
        nan_count = df_clean[numeric_cols].isnull().sum().sum()
        
        if inf_count > 0 or nan_count > 0:
            print(f"Found {inf_count} inf values and {nan_count} NaN values")
    
    # Convert all columns to object type first to handle mixed types
    df_clean = df_clean.astype(object)
    
    # Replace inf/-inf with None
    df_clean = df_clean.replace([np.inf, -np.inf], None)
    
    # Replace NaN with None
    df_clean = df_clean.where(pd.notnull(df_clean), None)
    
    # Additional cleaning for any remaining problematic values
    for col in df_clean.columns:
        # Check for any remaining inf values
        mask = df_clean[col].astype(str).str.contains('inf', na=False)
        if mask.any():
            print(f"Found inf values in column {col}")
            df_clean.loc[mask, col] = None
        
        # Check for any remaining NaN values
        mask = df_clean[col].astype(str).str.contains('nan', na=False, case=False)
        if mask.any():
            print(f"Found NaN values in column {col}")
            df_clean.loc[mask, col] = None
    
    return df_clean

def clean_response_data(data_dict):
    """
    Recursively clean response data to ensure JSON serialization
    """
    if isinstance(data_dict, dict):
        return {key: clean_response_data(value) for key, value in data_dict.items()}
    elif isinstance(data_dict, list):
        return [clean_response_data(item) for item in data_dict]
    elif isinstance(data_dict, (int, float)):
        if np.isinf(data_dict) or np.isnan(data_dict):
            return None
        return data_dict
    else:
        return data_dict

router = APIRouter(prefix="/api/overlay/development", tags=["overlay-development"])

@router.get("/data_transformation")
async def get_data_transformation(
    workflow_id: int = Query(..., description="Workflow ID to get data transformation for"),
    current_user: User = Depends(get_current_user)
):
    """
    Get data transformation data from OverlayDevelopmentDataTransformationOutput table
    """
    try:
        db = SessionLocal()
        try:
            # Query the database for data transformation output
            transformation_record = db.query(OverlayDevelopmentDataTransformationOutput).filter(
                OverlayDevelopmentDataTransformationOutput.workflow_id == workflow_id,
                OverlayDevelopmentDataTransformationOutput.user_id == current_user.id
            ).first()

            if not transformation_record:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "No data transformation output found for this workflow",
                        "data": None
                    }
                )
            
            # Parse the JSON data from the record
            data = json.loads(transformation_record.json_data) if transformation_record.json_data else []
            
            return {
                "code": 1, 
                "success": True,
                "data": data,
            }
            
        finally:
            db.close()
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Error retrieving data transformation: {str(e)}",
                "data": None
            }
        )

@router.post("/data_transformation")
async def calculate_data_transformation(workflow_id: int = Form(...), 
                                        user_id: User = Depends(get_current_user)):
    """
        Calculate data transformation
    """
    try:
        document_type = "OVERLAY_DEVELOPMENT_DATA_TRANSFORMATION_OUTPUT"
        db = SessionLocal()
        try:
            workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()

            log_record = db.query(OverlayLogs).filter(
                OverlayLogs.workflow_id == workflow_id,
                OverlayLogs.submodule == "DEVELOPMENT"
            ).first()

            monthly_historical_mev = db.query(OverlayDevelopmentMonthlyHistoricalMevInput).filter(
                OverlayDevelopmentMonthlyHistoricalMevInput.workflow_id == workflow_id
            ).first()

            print(monthly_historical_mev)

            data_interpolation = db.query(OverlayDevelopmentDataInterpolationOutput).filter(
                OverlayDevelopmentDataInterpolationOutput.workflow_id == workflow_id
            ).first()

            historical_default_rates = db.query(OverlayDevelopmentHistoricalDefaultRateInput).filter(
                OverlayDevelopmentHistoricalDefaultRateInput.workflow_id == workflow_id
            ).first()

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

            if not log_record:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": "No log record found for this workflow",
                        "data": None
                    }
                )

            if not monthly_historical_mev:
                return JSONResponse(
                    status_code=404,
                    content= {
                        "code": -1,
                        "success": False,
                        "msg": "No monthly historical mev data found for this workflow",
                        "data": None
                    }
                )
            
            if not data_interpolation:
                return JSONResponse(
                    status_code=404,
                    content= {
                        "code": -1,
                        "success": False,
                        "msg": "No data interpolation data found for this workflow",
                        "data": None
                    }
                )

            if not historical_default_rates:
                return JSONResponse(
                    status_code=404,
                    content= {
                        "code": -1,
                        "success": False,
                        "msg": "No historical default rates data found for this workflow",
                        "data": None
                    }
                )

            import json
            # Parse the JSON data from the record
            monthly_historical_mev_data = json.loads(monthly_historical_mev.json_data) if monthly_historical_mev.json_data else []
            data_interpolation_data = json.loads(data_interpolation.json_data) if data_interpolation.json_data else []
            historical_default_rates_data = json.loads(historical_default_rates.json_data) if historical_default_rates.json_data else []
        finally:
            db.close()

        

        monthly_historical_mev_df = pd.DataFrame(monthly_historical_mev_data)
        data_interpolation_df = pd.DataFrame(data_interpolation_data)
        historical_default_rates_df = pd.DataFrame(historical_default_rates_data)

        process_data_transformation_res = process_data_transformation(monthly_historical_mev_df, 
                                                                      data_interpolation_df,
                                                                      historical_default_rates_df)

        # Clean each DataFrame individually and convert to dict
        try:
            data_interpolation_combined_clean = clean_dataframe_for_json(process_data_transformation_res["data_interpolation_combined"])
            data_interpolation_combined_dict = data_interpolation_combined_clean.to_dict(orient='records')
            print("✅ data_interpolation_combined converted successfully")
        except Exception as e:
            print(f"❌ Error converting data_interpolation_combined: {e}")
            raise e
            
        try:
            lag_transformation_clean = clean_dataframe_for_json(process_data_transformation_res["lag_tranformation"])
            lag_transformation_dict = lag_transformation_clean.to_dict(orient='records')
            print("✅ lag_transformation converted successfully")
        except Exception as e:
            print(f"❌ Error converting lag_transformation: {e}")
            raise e
            
        try:
            historical_default_rate_clean = clean_dataframe_for_json(process_data_transformation_res["historical_default_rate"])
            historical_default_rate_dict = historical_default_rate_clean.to_dict(orient='records')
            print("✅ historical_default_rate converted successfully")
        except Exception as e:
            print(f"❌ Error converting historical_default_rate: {e}")
            raise e
        
        print('process_data_transformation_res', process_data_transformation_res)

        save_json_data = {
            "data_interpolation_combined": data_interpolation_combined_dict,
            "lag_tranformation": lag_transformation_dict,
            "historical_default_rate": historical_default_rate_dict
        }

        res = {
            'code': 1,
            'success': True,
            'msg': 'Success',
            'data': save_json_data
        }

        filename = f"data_transformation_output_{get_time_date()}.csv"

        # Save data in documents models
        db = SessionLocal()
        try:
            # Create Document record
            new_document = Document(
                filename=filename,
                json_data=json.dumps(save_json_data),
                document_type=document_type,
                user_id=user_id.id,
                workflow_id=workflow_id,
                workflow_path=f"{workflow.entity}/{workflow.reporting_period}/{workflow.workflow_name}"
            )
            db.add(new_document)
            db.commit()
            db.refresh(new_document)

            # Create OverlayDevelopmentDataTransformationOutput record
            new_overlay_record = OverlayDevelopmentDataTransformationOutput(
                workflow_id=workflow_id,
                user_id=user_id.id,
                json_data=json.dumps(save_json_data),
                log_id=log_record.id,
                folder=f"{workflow.entity}/{workflow.reporting_period}/{workflow.workflow_name}/output/overlay/development",
                filename=filename
            )
            db.add(new_overlay_record)
            db.commit()
            db.refresh(new_overlay_record)
            
        finally:
            db.close()

        save_csv_data_in_folder(
            workflow_path=f"{workflow.entity}/{workflow.reporting_period}/{workflow.workflow_name}/output/overlay/development",
            document_type=document_type,
            # csv_data is a daraframe
            csv_data=process_data_transformation_res,
            filename=filename
        )

        # Final check - ensure the response itself is JSON serializable
        try:
            import json
            json.dumps(res)  # Test if the response can be serialized
            print("✅ Response is JSON serializable")
        except Exception as e:
            print(f"❌ Response is not JSON serializable: {e}")
            # If there are still issues, try to clean the response data
            res['data'] = clean_response_data(res['data'])
            print("✅ Response cleaned and retested")

        return JSONResponse(status_code=200, content=res)
    except Exception as e:
        traceback.print_exc()
        res = {
            'code': -1,
            'msg': f'Something went wrong. {e}',
            'success': False
        }
        return JSONResponse(status_code=500, content=res)