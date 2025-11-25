import os

import pandas as pd

def save_data_transformation_output(
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
            filename = f"data_transformation_output_{timestamp}.xlsx"
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
        
        print('csv_data type:', type(csv_data))
        print('csv_data keys:', csv_data.keys() if isinstance(csv_data, dict) else 'Not a dict')
        
        # Create Excel writer object
        with pd.ExcelWriter(full_file_path, engine='openpyxl') as writer:
            # Save each DataFrame to a separate sheet
            for sheet_name, df in csv_data.items():
                if isinstance(df, pd.DataFrame):
                    # Clean sheet name (Excel sheet names have restrictions)
                    clean_sheet_name = sheet_name.replace('_', ' ').title()[:31]  # Excel limit is 31 chars
                    
                    # Save DataFrame to Excel sheet
                    df.to_excel(writer, sheet_name=clean_sheet_name, index=False)
                    print(f"Saved {sheet_name} to sheet '{clean_sheet_name}' with {len(df)} rows")
                else:
                    print(f"Skipping {sheet_name} - not a DataFrame: {type(df)}")
        
        print(f"Excel file saved successfully: {full_file_path}")
        return full_file_path
        
    except Exception as e:
        print(f"Error saving Excel file: {str(e)}")
        raise Exception(f"Error saving Excel file: {str(e)}")