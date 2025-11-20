import os

import pandas as pd

def save_forecasted_pd_calc_output(
    csv_data: pd.DataFrame,
    workflow_path: str = "",
    filename: str = None
) -> str:
    """
    Save CSV data to a file in the files folder
    
    Args:
        csv_data: Pandas DataFrame containing the CSV data
        document_type: Type of document for filename generation
        workflow_path: Path within the files folder (optional)
        filename: Custom filename (optional, will generate if not provided)
    
    Returns:
        str: Full path where the CSV file was saved
    """
    try:
        # Generate filename if not provided
        if not filename:
            timestamp = get_time_date()
            filename = f"{document_type.lower()}_{timestamp}.csv"
        else:
            filename = filename
        
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
        
        print('csv_data', csv_data)

        # Save the CSV file
        csv_data.to_csv(full_file_path, index=False)
        
        return full_file_path
        
    except Exception as e:
        raise Exception(f"Error saving CSV to file: {str(e)}")