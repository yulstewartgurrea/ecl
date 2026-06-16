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


def _get_arima_file_last_date(file_path) -> Optional[pd.Timestamp]:
    """
    Return the latest period (as a month-end pd.Timestamp) present in an ARIMA
    forecast file (monthly or quarterly), or None if it cannot be determined.

    Used to extend the interpolation horizon: the interpolation normally ends at the
    QUARTERLY forecast's last quarter-end, but if the MONTHLY ARIMA forecast runs past
    that (e.g. monthly through Oct while quarterly stops at Q3/Sep), the end date should
    follow whichever forecast ends later.

    Locates the header row containing 'Date', parses the Date column (supporting quarter
    formats via parse_quarter_date), and returns the max.
    """
    if not file_path:
        return None
    try:
        file_ext = os.path.splitext(str(file_path))[1].lower()
        if file_ext in ['.xlsx', '.xls']:
            df = pd.read_excel(file_path, header=None, dtype=str, keep_default_na=False, na_filter=False)
        elif file_ext == '.csv':
            df = pd.read_csv(file_path, header=None, dtype=str, keep_default_na=False, na_filter=False)
        else:
            return None

        # Find the header row that contains a 'Date' column
        header_row_idx = None
        for idx, row in df.iterrows():
            if any(str(cell).strip().lower() == 'date' for cell in row.tolist()):
                header_row_idx = idx
                break
        if header_row_idx is None:
            return None

        df.columns = df.iloc[header_row_idx]
        df = df.iloc[header_row_idx + 1:].reset_index(drop=True)

        if 'Date' not in df.columns:
            return None

        parsed = df['Date'].apply(lambda v: parse_quarter_date(v) or pd.to_datetime(v, errors='coerce'))
        parsed = parsed.dropna()
        if len(parsed) == 0:
            return None
        return pd.Timestamp(parsed.max()) + pd.offsets.MonthEnd(0)
    except Exception as e:
        print(f"Could not determine last date from {file_path}: {e}")
        return None


def process_data_interpolation(quarterly_file_path: str, monthly_file_path: str = None) -> pd.DataFrame:
    """
    Interpolate quarterly MEV ARIMA data to monthly data using linear interpolation.
    
    Method:
    - Quarterly data has x values incrementing by 0.3 (0.3, 0.6, 0.9, 1.2, ...)
    - Monthly data has x values incrementing by 0.1 (0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, ...)
    - For each monthly point, use VLOOKUP if exact match, otherwise use FORECAST (linear interpolation)
    
    Args:
        quarterly_file_path: Path to the quarterly MEV ARIMA forecast file (CSV or Excel)
        monthly_file_path: Optional path to the monthly MEV ARIMA forecast file. Used only
            to extend the interpolation end date when the monthly forecast runs later than
            the quarterly forecast's last quarter; if None, the end date follows the
            quarterly forecast alone (original behavior).

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
        metadata_cols = ['Date', 'year', 'month (int)', 'month', 'id', 'x', 'quarter']
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
        
        # Step 4: Find the first quarter with x value
        print("\nStep 4: Finding first quarter with x value...")
        
        # Find the first row where x is not NaN/empty
        first_x_row = None
        for idx, row in df_q.iterrows():
            if pd.notna(row['x']) and str(row['x']).strip() != '':
                first_x_row = row
                break
        
        if first_x_row is None:
            raise ValueError("Could not find any row with x value")
        
        first_date = first_x_row['Date']
        first_x_value = first_x_row['x']
        
        # Extract year and month from the first date
        first_year = first_date.year
        first_month = first_date.month
        
        # End date implied by the QUARTERLY ARIMA forecast (its last quarter-end).
        quarterly_end_date = pd.Timestamp(df_q['Date'].max()) + pd.offsets.MonthEnd(0)

        # Follow whichever ARIMA forecast (quarterly vs monthly) ends later. The quarterly
        # forecast only lands on quarter-end months; if the MONTHLY ARIMA forecast extends
        # past the last quarter (e.g. monthly through Oct while quarterly stops at Q3/Sep),
        # extend the horizon so that tail is produced. Interpolated columns hold the last
        # quarterly value (forward-fill) across the tail; the real monthly values are merged
        # back in downstream (combine_monthly_mev_data_interpolation, left join on 'id').
        end_date = quarterly_end_date
        monthly_end_date = _get_arima_file_last_date(monthly_file_path)
        if monthly_end_date is not None and monthly_end_date > end_date:
            print(f"Extending interpolation end from {quarterly_end_date.strftime('%Y-%m')} "
                  f"(quarterly) to {monthly_end_date.strftime('%Y-%m')} (monthly ARIMA ends later)")
            end_date = monthly_end_date

        print(f"First quarter with x value: {first_year}-{first_month:02d} with x={first_x_value}")

        # Step 5: Create monthly date range starting from the first actual data point
        print("\nStep 5: Creating monthly date range starting from first data point...")

        # Create monthly date range from the first data point to the last date in the input
        # Use 'MS' (Month Start) to start from day 1 of the first month, then convert to month end
        monthly_dates = pd.date_range(
            start=f"{first_year}-{first_month:02d}-01",
            end=end_date,
            freq='MS'  # Month Start
        )
        
        # Convert to month end dates to match quarterly data format
        monthly_dates = monthly_dates + pd.offsets.MonthEnd(0)
        
        print(f"Created {len(monthly_dates)} monthly dates (from {monthly_dates[0].strftime('%Y-%m-%d')} to {monthly_dates[-1].strftime('%Y-%m-%d')})")
        
        # Step 6: Create monthly DataFrame structure
        print("\nStep 6: Creating monthly DataFrame structure...")
        
        monthly_df = pd.DataFrame()
        monthly_df['Date'] = monthly_dates
        monthly_df['year'] = monthly_df['Date'].dt.year
        monthly_df['month (int)'] = monthly_df['Date'].dt.month
        monthly_df['month'] = monthly_df['Date'].dt.strftime('%b')
        monthly_df['id'] = monthly_df['year'].astype(str) + '-' + monthly_df['month']
        # Calculate quarter from month (standard quarters: Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec)
        monthly_df['quarter'] = monthly_df['Date'].dt.quarter
        
        # Step 7: Calculate x values for monthly data
        print("\nStep 7: Calculating x values for monthly data...")
        
        # Set x column to start from 0 and increment by 0.1
        # Since monthly_dates now starts from first data point, x starts at 0
        monthly_df['x'] = 0.0
        for i in range(len(monthly_df)):
            monthly_df['x'].iloc[i] = i * 0.1
        
        print(f"Calculated x values: {monthly_df['x'].min():.1f} to {monthly_df['x'].max():.1f}")
        
        # Step 8: Interpolate values for each numeric column
        print("\nStep 8: Interpolating values...")
        
        # Convert quarter to month mapping (Q1=Mar=3, Q2=Jun=6, Q3=Sep=9, Q4=Dec=12)
        quarter_to_month = {1: 3, 2: 6, 3: 9, 4: 12}
        
        for col in valid_numeric_cols:
            print(f"   Interpolating: {col}")
            
            # Create quarterly series with proper dates
            quarterly_temp = df_q[['Date', col]].copy()
            
            # Find the first date where this column has a valid (non-NaN) value
            first_valid_row = None
            for idx, row in quarterly_temp.iterrows():
                val = row[col]
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
            
            # Set date as index for reindexing
            quarterly_temp = quarterly_temp.set_index('Date')
            
            # Reindex to monthly dates and interpolate
            monthly_series = quarterly_temp[col].reindex(monthly_dates)
            monthly_series = monthly_series.interpolate(method='linear')
            monthly_series = monthly_series.fillna(method='ffill').fillna(method='bfill')
            
            # Set all values before this column's first data date to None
            monthly_series.loc[monthly_series.index < col_first_date] = None
            
            monthly_df[col] = monthly_series.values
        
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