import os
import pandas as pd

from helpers.get_time_date import get_time_date

def save_creditloss_rate_output(
    csv_data: dict,
    workflow_path: str = "",
    filename: str = None
) -> str:
    """
    Save data transformation output to an Excel file with multiple sheets
    """
    try:
        # Generate filename if not provided
        if not filename:
            timestamp = get_time_date()
            filename = f"creditloss_rate_{timestamp}.xlsx"
        else:
            # Change extension to .xlsx if it's .csv
            if filename.endswith('.csv'):
                filename = filename.replace('.csv', '.xlsx')
            elif not filename.endswith('.xlsx'):
                filename = f"{filename}.xlsx"
        
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
        
        print("Saving flowrate data to Excel file...")
        
        df = pd.DataFrame(csv_data)
        df.to_excel(full_file_path, index=False)
        return full_file_path
        
    except Exception as e:
        print(f"❌ Error saving Excel file: {str(e)}")
        raise Exception(f"Error saving Excel file: {str(e)}")