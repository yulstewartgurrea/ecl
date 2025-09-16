from fastapi import APIRouter, HTTPException
import pandas as pd
import os
from typing import List, Dict, Any

router = APIRouter(prefix="/api/overlay/development", tags=["overlay-development"])

@router.get("/data_interpolation")
async def get_data_interpolation():
    """
    Get data interpolation data from CSV or Excel files
    Supports both monthly and quarterly periods
    """
    try:

        # get root folder
        root_folder = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))))

        periods = ['monthly', 'quarterly']
        arr = []
        for period in periods:
            # Try to find the file with different extensions
            file_path = None
            file_extensions = ['.csv', '.xlsx', '.xls']
            
            for ext in file_extensions:
                potential_path = os.path.join(root_folder, "data", "ecl", "development", f"data_interpolation_{period}{ext}")
                if os.path.exists(potential_path):
                    file_path = potential_path
                    break
            
            # Check if file exists
            if not file_path:
                raise HTTPException(status_code=404, detail=f"Data interpolation file not found for period: {period}. Tried extensions: {file_extensions}")
            
            # Read the file based on extension
            file_ext = os.path.splitext(file_path)[1].lower()
            if file_ext == '.csv':
                df = pd.read_csv(file_path)
            elif file_ext == '.xlsx':
                df = pd.read_excel(file_path, engine="openpyxl")
            elif file_ext == '.xls':
                df = pd.read_excel(file_path, engine="xlrd")
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported file format: {file_ext}")
            
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

            arr.append({
                'period': period,
                'data': data
            })

        return {
            "code": 1, 
            "success": True,
            "data": arr,
        }
        
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Data interpolation file not found")
    except pd.errors.EmptyDataError:
        raise HTTPException(status_code=400, detail="Data interpolation file is empty")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading data interpolation file: {str(e)}")

