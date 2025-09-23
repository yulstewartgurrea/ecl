from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
import pandas as pd
import numpy as np
import os
from typing import List, Dict, Any
from helpers.file_utils import find_and_read_data_file, get_root_folder
from data_processing.overlay.development.data_transformation import process_data_transformation

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
async def get_data_transformation():
    """
    Get quarterly data transformation data from CSV file
    """
    try:
        # get root folder
        root_folder = get_root_folder()

        # Use reusable function to find and read the file
        df = find_and_read_data_file(
            root_folder=root_folder,
            subfolder_path="server/data/ecl/development",
            filename_base="data_transformation_consolidated_monthly_mev"
        )
        
        # Convert DataFrame to JSON
        # Drop fully empty cols/rows
        df_cleaned = df.dropna(how="all", axis=1)
        df_cleaned = df_cleaned.dropna(how="all", axis=0)
        
        # Forward fill row 0 across columns (axis=0 means left to right along the row)
        # forward fill row 1 (index=1) across columns
        df_cleaned.iloc[0] = df_cleaned.iloc[0].ffill(axis=0)

        df_cleaned = df_cleaned.fillna('')
        
        # Convert to dictionary format
        data = df_cleaned.to_dict(orient='records')

        return {
            "code": 1, 
            "success": True,
            "data": data,
        }
        
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Data tranformation file not found")
    except pd.errors.EmptyDataError:
        raise HTTPException(status_code=400, detail="Data tranformation file is empty")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading data tranformation file: {str(e)}")

@router.post("/data_transformation")
async def calculate_data_transformation():
    """
        Calculate data transformation
    """
    try:
        root_folder = get_root_folder()
        monthly_historical_mev_df = find_and_read_data_file(
            root_folder=root_folder,
            subfolder_path="server/data/ecl/overlay/input/development",
            filename_base=f"monthly_historical_mev"
        )
        data_interpolation_df = find_and_read_data_file(
            root_folder=root_folder,
            subfolder_path="server/data/ecl/overlay/output/development",
            filename_base=f"data_interpolation_output"
        )

        historical_default_rates_df = find_and_read_data_file(
            root_folder=root_folder,
            subfolder_path="server/data/ecl/overlay/input/development",
            filename_base=f"historical_default_rates"
        )
        
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

        res = {
            'code': 1,
            'success': True,
            'msg': 'Success',
            'data': {
                "data_interpolation_combined": data_interpolation_combined_dict,
                "lag_tranformation": lag_transformation_dict,
                "historical_default_rate": historical_default_rate_dict
            }
        }

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
        res = {
            'code': -1,
            'msg': f'Something went wrong. {e}',
            'success': False
        }
        return JSONResponse(status_code=500, content=res)