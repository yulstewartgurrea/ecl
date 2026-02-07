import pandas as pd
import numpy as np
import os
import re
from datetime import datetime
from typing import Optional
import warnings
warnings.filterwarnings('ignore')


def linear_interpolate(x_target: float, x1: float, y1: float, x2: float, y2: float) -> float:
    """
    Linear interpolation between two points (Excel FORECAST equivalent)
    Formula: y = y1 + (y2 - y1) * (x_target - x1) / (x2 - x1)
    """
    if x2 == x1:
        return y1
    return y1 + (y2 - y1) * (x_target - x1) / (x2 - x1)


def parse_quarter_date(value: str) -> Optional[pd.Timestamp]:
    s = str(value).strip()
    if not s:
        return None
    m = re.match(r"^(\d{4})\s*[-/ ]?\s*Q([1-4])$", s, re.IGNORECASE)
    if not m:
        m = re.match(r"^Q([1-4])\s*[-/ ]?\s*(\d{4})$", s, re.IGNORECASE)
    if not m:
        return None
    year = int(m.group(1) if m.group(1).isdigit() else m.group(2))
    quarter = int(m.group(2) if m.group(2).isdigit() else m.group(1))
    month = {1: 3, 2: 6, 3: 9, 4: 12}[quarter]
    return pd.Timestamp(year=year, month=month, day=1) + pd.offsets.MonthEnd(0)


def process_data_interpolation(quarterly_file_path: str) -> pd.DataFrame:
    """
    Interpolate quarterly MEV ARIMA data to monthly data using linear interpolation.
    
    Method:
    - Quarterly data has x values incrementing by 0.3 (0.3, 0.6, 0.9, 1.2, ...)
    - Monthly data has x values incrementing by 0.1 (0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, ...)
    - For each monthly point, use VLOOKUP if exact match, otherwise use FORECAST (linear interpolation)
    
    Args:
        quarterly_file_path: Path to the quarterly file (CSV or Excel format)
        output_file_path: Optional path to save the interpolated monthly data
    
    Returns:
        DataFrame with monthly interpolated data
    """
    try:
        print("="*60)
        print("QUARTERLY TO MONTHLY INTERPOLATION")
        print("="*60)
        
        # Step 1: Read quarterly data
        print("\nStep 1: Reading quarterly data...")
        
        # Determine file type based on extension
        file_ext = os.path.splitext(quarterly_file_path)[1].lower()
        
        if file_ext in ['.xlsx', '.xls']:
            # Read Excel file
            print(f"Detected Excel file: {file_ext}")
            df_quarterly = pd.read_excel(quarterly_file_path, header=None, dtype=str, keep_default_na=False, na_filter=False)
        elif file_ext == '.csv':
            # Read CSV file
            print(f"Detected CSV file")
            df_quarterly = pd.read_csv(quarterly_file_path, header=None, dtype=str, keep_default_na=False, na_filter=False)
        else:
            raise ValueError(f"Unsupported file format: {file_ext}. Supported formats: .csv, .xlsx, .xls")
        
        print(f"Read {len(df_quarterly)} rows")
        
        # Step 2: Find header row and data rows
        print("\nStep 2: Finding header and data rows...")
        
        # Find the header row (row with 'Date' column)
        header_row_idx = None
        for idx, row in df_quarterly.iterrows():
            if 'Date' in str(row.iloc[0]).strip():
                header_row_idx = idx
                break
        
        if header_row_idx is None:
            raise ValueError("Could not find header row with 'Date' column")
        
        print(f"Found header at row {header_row_idx}")
        
        # Set header
        df_quarterly.columns = df_quarterly.iloc[header_row_idx]
        
        # Get data rows (skip header and any metadata rows)
        # Find first row with a valid date
        data_start_idx = None
        for idx in range(header_row_idx + 1, len(df_quarterly)):
            date_val = str(df_quarterly.iloc[idx]['Date']).strip()
            if date_val and date_val != '' and 'nan' not in date_val.lower():
                try:
                    pd.to_datetime(date_val)
                    data_start_idx = idx
                    break
                except:
                    continue
        
        if data_start_idx is None:
            raise ValueError("Could not find data rows with valid dates")
        
        print(f"Data starts at row {data_start_idx}")
        
        # Extract quarterly data
        df_q = df_quarterly.iloc[data_start_idx:].copy()
        df_q = df_q.reset_index(drop=True)
        
        # Convert Date to datetime (support quarter formats)
        df_q['Date'] = df_q['Date'].apply(
            lambda v: parse_quarter_date(v) or pd.to_datetime(v, errors='coerce')
        )
        
        # Remove rows with invalid dates
        df_q = df_q[df_q['Date'].notna()].copy()
        
        # Convert x to float (clean commas if present)
        df_q['x'] = df_q['x'].astype(str).str.replace(',', '', regex=False).str.strip()
        df_q['x'] = pd.to_numeric(df_q['x'], errors='coerce')
        df_q = df_q[df_q['x'].notna()].copy()
        
        print(f"Extracted {len(df_q)} quarterly data points")
        print(f"Date range: {df_q['Date'].min()} to {df_q['Date'].max()}")
        print(f"X range: {df_q['x'].min()} to {df_q['x'].max()}")
        
        # Step 3: Identify numeric columns to interpolate
        print("\nStep 3: Identifying columns to interpolate...")
        
        # Get all columns except metadata columns
        metadata_cols = ['Date', 'year', 'month (int)', 'month', 'id', 'x']
        numeric_cols = [col for col in df_q.columns if col not in metadata_cols]
        
        # Filter to columns that have numeric data
        valid_numeric_cols = []
        for col in numeric_cols:
            # Clean the data: remove commas, percentage signs, and convert to numeric
            cleaned_series = df_q[col].astype(str).str.replace(',', '', regex=False)
            cleaned_series = cleaned_series.str.replace('%', '', regex=False)
            cleaned_series = cleaned_series.str.strip()
            
            # Try to convert to numeric
            numeric_series = pd.to_numeric(cleaned_series, errors='coerce')
            if numeric_series.notna().sum() > len(df_q) * 0.5:  # At least 50% numeric
                valid_numeric_cols.append(col)
                # Convert to numeric
                df_q[col] = numeric_series
        
        print(f"Found {len(valid_numeric_cols)} numeric columns to interpolate")
        
        # Step 4: Create monthly date range starting from the first actual data point
        print("\nStep 4: Creating monthly date range starting from first data point...")
        
        # Get date range from quarterly data
        start_date = df_q['Date'].min()
        end_date = df_q['Date'].max()
        
        # Start from the first actual data point instead of January
        # Use 'ME' (Month End) to get the last day of each month instead of first day
        monthly_dates = pd.date_range(start=start_date, end=end_date, freq='ME')  # Month End
        
        print(f"Created {len(monthly_dates)} monthly dates (from {start_date.strftime('%Y-%m')} to {end_date.strftime('%Y-%m')})")
        
        # Step 5: Create monthly DataFrame structure
        print("\nStep 5: Creating monthly DataFrame structure...")
        
        monthly_df = pd.DataFrame()
        monthly_df['Date'] = monthly_dates
        monthly_df['year'] = monthly_df['Date'].dt.year
        monthly_df['month (int)'] = monthly_df['Date'].dt.month
        monthly_df['month'] = monthly_df['Date'].dt.strftime('%b')
        monthly_df['id'] = monthly_df['year'].astype(str) + '-' + monthly_df['month']
        
        # Step 6: Calculate x values for monthly data
        print("\nStep 6: Calculating x values for monthly data...")
        
        # Find the first December row in monthly data
        first_dec_idx = None
        for idx, month in enumerate(monthly_df['month']):
            if month == 'Dec':
                first_dec_idx = idx
                break
        
        if first_dec_idx is None:
            raise ValueError("Could not find December in monthly data")
        
        print(f"Found first December at index {first_dec_idx} ({monthly_df.iloc[first_dec_idx]['Date']})")
        
        # Calculate x values: start from 0.0 at first December and increment by 0.1
        monthly_x_values = []
        for idx in range(len(monthly_dates)):
            if idx < first_dec_idx:
                # Before first December, set x to 0.0
                monthly_x_values.append(0.0)
            else:
                # Starting from first December (x = 0.0), increment by 0.1 for each month
                monthly_x = 0.0 + (idx - first_dec_idx) * 0.1
                monthly_x_values.append(monthly_x)
        
        monthly_df['x'] = monthly_x_values
        
        print(f"Calculated x values: {monthly_df['x'].min():.1f} to {monthly_df['x'].max():.1f}")
        
        # Step 7: Interpolate values for each numeric column
        print("\nStep 7: Interpolating values...")
        
        for col in valid_numeric_cols:
            print(f"   Interpolating: {col}")
            
            # Find the first date where this column has a valid (non-NaN) value
            # This could be zero or non-zero - we just need the first actual data point
            first_valid_row = None
            for idx, row in df_q.iterrows():
                val = row[col]
                # Check if value is valid (not NaN) - zero is still a valid starting point
                if pd.notna(val):
                    first_valid_row = row
                    break
            
            if first_valid_row is None:
                print(f"      Warning: Column {col} has no valid data, setting all values to None")
                monthly_df[col] = None
                continue
            
            # Get the first data date for this column
            col_first_date = first_valid_row['Date']
            col_first_value = first_valid_row[col]
            
            print(f"      First data point for {col}: {col_first_date.strftime('%Y-%m-%d')} with value={col_first_value}")
            
            # Create lookup dictionary for quarterly data (x -> value)
            quarterly_lookup = dict(zip(df_q['x'], df_q[col]))
            
            # Interpolate for each monthly point
            interpolated_values = []
            for idx, row in monthly_df.iterrows():
                monthly_x = row['x']
                monthly_date = row['Date']
                
                # Set values before this column's first data date to None
                if monthly_date < col_first_date:
                    interpolated_values.append(None)
                else:
                    # Starting from column's first data date, perform interpolation
                    # Check if exact match exists (VLOOKUP equivalent)
                    if monthly_x in quarterly_lookup:
                        interpolated_values.append(quarterly_lookup[monthly_x])
                    else:
                        # Find the two nearest quarterly points for interpolation
                        # Get quarterly x values sorted
                        q_x_values = sorted(df_q['x'].unique())
                        
                        # Find the two points to interpolate between
                        x1, x2 = None, None
                        y1, y2 = None, None
                        
                        for i, q_x in enumerate(q_x_values):
                            if q_x < monthly_x:
                                x1 = q_x
                                y1 = quarterly_lookup[q_x]
                            elif q_x >= monthly_x:
                                x2 = q_x
                                y2 = quarterly_lookup[q_x]
                                break
                        
                        # If we have both points, interpolate
                        if x1 is not None and x2 is not None and y1 is not None and y2 is not None:
                            interpolated_value = linear_interpolate(monthly_x, x1, y1, x2, y2)
                            interpolated_values.append(interpolated_value)
                        elif x1 is not None and y1 is not None:
                            # Only left point available, use it
                            interpolated_values.append(y1)
                        elif x2 is not None and y2 is not None:
                            # Only right point available, use it
                            interpolated_values.append(y2)
                        else:
                            # No points available, use None
                            interpolated_values.append(None)
            
            monthly_df[col] = interpolated_values
        
        print(f"Interpolation complete!")
        
        # Step 8: Add growth rate columns
        # print("\nStep 8: Adding growth rate columns...")
        
        # Find the 3rd January (index where month is January and it's the 3rd occurrence)
        # jan_indices = monthly_df[monthly_df['month'] == 'Jan'].index.tolist()
        # if len(jan_indices) >= 3:
        #     start_calc_idx = jan_indices[2]  # 3rd January (0-indexed: 0, 1, 2)
        #     print(f"Found 3rd January at index {start_calc_idx} ({monthly_df.loc[start_calc_idx, 'Date']})")
        # else:
        #     start_calc_idx = len(monthly_df)  # If not found, don't calculate
        #     print(f"Could not find 3rd January, growth rates will be set to 0")
        
        growth_rate_cols = []
        # for col in valid_numeric_cols:
        #     # Create growth rate column name (e.g., "unemp_rate" -> "unemp_rate_growth_12m")
        #     # this is the output from arima, the pattern is base_variable then Point or Hi_80 or Lo_80 or Hi_95 or Lo_95
        #     # e.g. gni Point or gni Hi_80 or gni Lo_80 or gni Hi_95 or gni Lo_95
        #     col_split = col.split(".", 1)
        #     base = col_split[0]
        #     succeding_cols = col_split[1] if len(col_split) > 1 else "Point"
        #     growth_rate_col_name = f"{base}_growth_12m.{succeding_cols}"
        #     growth_rate_cols.append(growth_rate_col_name)
        #     
        #     # Initialize with 0
        #     monthly_df[growth_rate_col_name] = 0.0
        #     
        #     # Calculate growth rate starting from 3rd January
        #     # Formula: ((current_value - value_12_months_ago) / value_12_months_ago * 100)
        #     for idx in range(start_calc_idx, len(monthly_df)):
        #         # Get value 12 months ago (12 rows back)
        #         idx_12_months_ago = idx - 12
        #         
        #         if idx_12_months_ago >= 0:
        #             current_value = monthly_df.loc[idx, col]
        #             value_12_months_ago = monthly_df.loc[idx_12_months_ago, col]
        #             
        #             # Calculate growth rate: ((current - prev) / prev * 100) - percentage format
        #             if pd.notna(current_value) and pd.notna(value_12_months_ago) and value_12_months_ago != 0:
        #                 growth_rate = ((current_value - value_12_months_ago) / value_12_months_ago) * 100
        #                 monthly_df.loc[idx, growth_rate_col_name] = growth_rate
        #             else:
        #                 monthly_df.loc[idx, growth_rate_col_name] = 0.0
        #         else:
        #             # Not enough data (less than 12 months), keep as 0
        #             monthly_df.loc[idx, growth_rate_col_name] = 0.0
        
        # print(f"Added {len(growth_rate_cols)} growth rate columns with calculations starting from 3rd January")
        
        # Step 9: Reorder columns
        print("\nStep 9: Reordering columns...")
        
        # Put metadata columns first, then numeric columns, then growth rate columns
        # column_order = metadata_cols + valid_numeric_cols + growth_rate_cols
        column_order = metadata_cols + valid_numeric_cols  # + growth_rate_cols
        # Only include columns that exist
        column_order = [col for col in column_order if col in monthly_df.columns]
        monthly_df = monthly_df[column_order]
        
        
        print("INTERPOLATION COMPLETE!")
        
        print(monthly_df)
        return monthly_df
    
    except Exception as e:
        print(f"Error during interpolation: {str(e)}")
        import traceback
        traceback.print_exc()
        return None