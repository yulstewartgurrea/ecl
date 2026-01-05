import os

import pandas as pd
from helpers.get_time_date import get_time_date

def save_mev_monthly_arima_forecast_output(
    csv_data: pd.DataFrame,
    workflow_path: str = "",
    filename: str = None
) -> str:
    """
    Save MEV monthly ARIMA forecast data to Excel file in the files folder
    
    Args:
        csv_data: Pandas DataFrame containing the forecast data
        workflow_path: Path within the files folder (optional)
        filename: Custom filename (optional, will generate if not provided)
    
    Returns:
        str: Full path where the Excel file was saved
    """
    try:
        # Generate filename if not provided
        if not filename:
            timestamp = get_time_date()
            filename = f"mev_monthly_arima_forecast_{timestamp}.xlsx"
        
        # Define the base files directory
        base_files_dir = "files"
        
        # Create the full directory path
        if workflow_path:
            full_dir_path = os.path.join(base_files_dir, workflow_path)
        else:
            full_dir_path = base_files_dir
        
        # Create directories if they don't exist
        os.makedirs(full_dir_path, exist_ok=True)
        
        # Create the full file path
        full_file_path = os.path.join(full_dir_path, filename)
        
        print(f'Saving monthly ARIMA forecast to: {full_file_path}')
        
        # Save as Excel file
        csv_data.to_excel(full_file_path, index=False, engine='openpyxl')
        
        return full_file_path
        
    except Exception as e:
        raise Exception(f"Error saving monthly ARIMA forecast to file: {str(e)}")


def save_mev_quarterly_arima_forecast_output(
    csv_data: pd.DataFrame,
    workflow_path: str = "",
    filename: str = None
) -> str:
    """
    Save MEV quarterly ARIMA forecast data to Excel file in the files folder
    
    Args:
        csv_data: Pandas DataFrame containing the forecast data
        workflow_path: Path within the files folder (optional)
        filename: Custom filename (optional, will generate if not provided)
    
    Returns:
        str: Full path where the Excel file was saved
    """
    try:
        # Generate filename if not provided
        if not filename:
            timestamp = get_time_date()
            filename = f"mev_quarterly_arima_forecast_{timestamp}.xlsx"
        
        # Define the base files directory
        base_files_dir = "files"
        
        # Create the full directory path
        if workflow_path:
            full_dir_path = os.path.join(base_files_dir, workflow_path)
        else:
            full_dir_path = base_files_dir
        
        # Create directories if they don't exist
        os.makedirs(full_dir_path, exist_ok=True)
        
        # Create the full file path
        full_file_path = os.path.join(full_dir_path, filename)
        
        print(f'Saving quarterly ARIMA forecast to: {full_file_path}')
        
        # Save as Excel file
        csv_data.to_excel(full_file_path, index=False, engine='openpyxl')
        
        return full_file_path
        
    except Exception as e:
        raise Exception(f"Error saving quarterly ARIMA forecast to file: {str(e)}")

