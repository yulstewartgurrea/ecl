import os

import pandas as pd

def save_ecl_output(
    csv_data: dict,
    workflow_path: str = "",
    filename: str = None
) -> str:
    """
    Save candidate output to an Excel file with
    """
    try:
        # Generate filename if not provided
        if not filename:
            timestamp = get_time_date()
            filename = f"ecl_{timestamp}.xlsx"
        
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
        
        df = pd.DataFrame(csv_data)
        df = df.to_excel(full_file_path, index=False)
        
        print(f"CSV file saved successfully: {full_file_path}")
        return full_file_path
        
    except Exception as e:
        print(f"Error saving Excel file: {str(e)}")
        raise Exception(f"Error saving Excel file: {str(e)}")