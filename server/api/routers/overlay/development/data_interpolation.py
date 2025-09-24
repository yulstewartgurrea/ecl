from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
import pandas as pd
import os
from typing import List, Dict, Any
from helpers.file_utils import find_and_read_data_file, get_root_folder
from data_processing.overlay.development.data_interpolation import process_data_interpolation

router = APIRouter(prefix="/api/overlay/development", tags=["overlay-development"])

@router.get("/data_interpolation")
async def get_data_interpolation():
    """
    Get data interpolation data from CSV or Excel files
    Supports both monthly and quarterly periods
    """
    try:
        # get root folder
        root_folder = get_root_folder()

        # Use reusable function to find and read the file
        df = find_and_read_data_file(
            root_folder=root_folder,
            subfolder_path="server/data/ecl/overlay/output/development",
            filename_base=f"data_interpolation_output"
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
        raise HTTPException(status_code=404, detail="Data interpolation file not found")
    except pd.errors.EmptyDataError:
        raise HTTPException(status_code=400, detail="Data interpolation file is empty")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading data interpolation file: {str(e)}")

@router.post("/data_interpolation")
async def calculate_data_interpolation():
    """
        Calculate data interpolation
    """
    try:
        root_folder = get_root_folder()
        quarterly_df = find_and_read_data_file(
            root_folder=root_folder,
            subfolder_path="server/data/ecl/overlay/input/development",
            filename_base=f"quarterly_historical_mev"
        )
        
        # Convert DataFrame to JSON
        # Drop fully empty cols/rows
        df_cleaned = quarterly_df.dropna(how="all", axis=1)
        df_cleaned = df_cleaned.dropna(how="all", axis=0)
        
        # Forward fill row 0 across columns (axis=0 means left to right along the row)
        # forward fill row 1 (index=1) across columns
        df_cleaned.iloc[0] = df_cleaned.iloc[0].ffill(axis=0)

        df_cleaned = df_cleaned.fillna('')
        
        # Convert to dictionary format
        data = df_cleaned.to_dict(orient='records')

        process_data_interpolation_res = process_data_interpolation(df_cleaned)

        res = {
            'code': 1,
            'success': True,
            'msg': 'Success',
            'data': process_data_interpolation_res
        }

        return JSONResponse(status_code=200, content=res)
    except Exception as e:
        res = {
            'code': -1,
            'msg': f'Something went wrong. {e}',
            'success': False
        }
        return JSONResponse(status_code=500, content=res)
