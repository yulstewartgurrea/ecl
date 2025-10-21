import os
import pandas as pd

from helpers.get_time_date import get_time_date

def save_flowrate_output(
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
            filename = f"flow_rate_output_{timestamp}.xlsx"
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
        
        # Create Excel writer
        with pd.ExcelWriter(full_file_path, engine='openpyxl') as writer:
            
            # Create a single sheet with all three tables
            sheet_name = 'Flow Rate Analysis'
            
            # Start row counter
            start_row = 0
            
            # Table 1: Flow of Loan Balance Principal Matrix
            if 'Flow of Loan Balance Principal Matrix' in csv_data:
                df1 = pd.DataFrame(csv_data['Flow of Loan Balance Principal Matrix'])
                
                # Add title
                title_df1 = pd.DataFrame([['Flow of Loan Balance Principal Matrix']])
                title_df1.to_excel(writer, sheet_name=sheet_name, startrow=start_row, index=False, header=False)
                start_row += 2
                
                # Add data
                df1.to_excel(writer, sheet_name=sheet_name, startrow=start_row, index=False)
                start_row += len(df1) + 3  # Add 3 rows spacing
                print(f"✓ Saved 'Flow of Loan Balance Principal Matrix' with {len(df1)} rows")
            
            # Table 2: Flow of Loan Balance Principal Matrix (Distribution)
            if 'Flow of Loan Balance Principal Matrix (Distribution)' in csv_data:
                df2 = pd.DataFrame(csv_data['Flow of Loan Balance Principal Matrix (Distribution)'])
                
                # Add title
                title_df2 = pd.DataFrame([['Flow of Loan Balance Principal Matrix (Distribution)']])
                title_df2.to_excel(writer, sheet_name=sheet_name, startrow=start_row, index=False, header=False)
                start_row += 2
                
                # Add data
                df2.to_excel(writer, sheet_name=sheet_name, startrow=start_row, index=False)
                start_row += len(df2) + 3  # Add 3 rows spacing
                print(f"✓ Saved 'Distribution Matrix' with {len(df2)} rows")
            
            # Table 3: Flow Rate Calculation
            if 'Flow Rate Calculation' in csv_data and csv_data['Flow Rate Calculation'] is not None:
                df3 = pd.DataFrame(csv_data['Flow Rate Calculation'])
                
                # Add title
                title_df3 = pd.DataFrame([['Flow Rate Calculation']])
                title_df3.to_excel(writer, sheet_name=sheet_name, startrow=start_row, index=False, header=False)
                start_row += 2
                
                # Add data
                df3.to_excel(writer, sheet_name=sheet_name, startrow=start_row, index=False)
                print(f"✓ Saved 'Flow Rate Calculation' with {len(df3)} rows")
            else:
                print("⚠ No Flow Rate Calculation data to save")

        print(f"✅ Excel file saved successfully: {full_file_path}")
        return full_file_path
        
    except Exception as e:
        print(f"❌ Error saving Excel file: {str(e)}")
        raise Exception(f"Error saving Excel file: {str(e)}")