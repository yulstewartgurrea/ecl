from fastapi import APIRouter, HTTPException
import pandas as pd
import os
from typing import List, Dict, Any
from helpers.file_utils import find_and_read_data_file, get_root_folder

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

