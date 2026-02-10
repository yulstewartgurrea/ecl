import os
import warnings
import re
warnings.filterwarnings('ignore')

import pandas as pd
import numpy as np
from datetime import datetime
from itertools import combinations, product
from multiprocessing import Pool, cpu_count
from functools import partial

from statsmodels.tsa.stattools import adfuller

from helpers.get_root_folder import get_root_folder
from helpers.get_time_date import get_time_date

from data.excluded_columns import excluded_columns


def process_transform_forecasted_mevs(data_transformation_df: pd.DataFrame,
                                       override_forecasted_mevs_df: pd.DataFrame,
                                       final_models_df: pd.DataFrame):
    """
    Main function to transform forecasted MEVs (Macroeconomic Variables) with lag transformations.
    
    This function orchestrates the complete transformation process:
    1. Formats the override forecasted MEVs dataframe (handles multi-level headers)
    2. Populates historical dates with data from interpolation dataframe
    3. Combines historical and forecasted data into a single raw dataframe
    4. Applies lag transformations to columns containing lag patterns (e.g., "lag.6", "lag_6")
    5. For lag columns, retrieves values from the corresponding lagged period and applies natural logarithm
    
    The lag transformation process:
    - Identifies columns with lag patterns (e.g., "Best unemp_rate lag.6")
    - Calculates the lagged period (current period - lag months)
    - Looks up the value from the raw dataframe at the lagged period
    - Applies natural logarithm to the lagged values (handles percentages and non-positive values)
    
    Args:
        data_transformation_df (pd.DataFrame): DataFrame containing interpolated historical data
                                              with columns like "Date", "gdp.Point Forecast", etc.
        override_forecasted_mevs_df (pd.DataFrame): DataFrame containing override forecasted MEVs
                                                    with multi-level headers that need formatting
    
    Returns:
        pd.DataFrame | None: Transformed dataframe with lag columns populated, or None if error occurs
    """
    try:
        format_override_forecasted_mevs_df_res = format_override_forecasted_mevs_df(override_forecasted_mevs_df)
        previous_override_forecasted_mevs_df = populate_previous_dates(data_transformation_df, format_override_forecasted_mevs_df_res)

        print('format_override_forecasted_mevs_df_res \n', format_override_forecasted_mevs_df_res)
        # data_transformation_df.to_csv('data_transformation_df.csv', index=False)

        # get the first period date of  format_override_forecasted_mevs_df_res
        first_period_date = format_override_forecasted_mevs_df_res['Period'].min()

        # previous_override_forecasted_mevs_df Period should only be until first_period_date
        previous_override_forecasted_mevs_df = previous_override_forecasted_mevs_df[previous_override_forecasted_mevs_df['Period'] < first_period_date]

        # concat output_df and new_df
        raw_mev_forecasts_df = pd.concat([previous_override_forecasted_mevs_df, format_override_forecasted_mevs_df_res], ignore_index=True)

        transformed_mev_forecasts_df = format_override_forecasted_mevs_df_res.copy()
        
        # Ensure Period columns are datetime and normalize to month-end
        transformed_mev_forecasts_df['Period'] = pd.to_datetime(transformed_mev_forecasts_df['Period'], errors='coerce')
        raw_mev_forecasts_df['Period'] = pd.to_datetime(raw_mev_forecasts_df['Period'], errors='coerce')
        
        # Normalize all Period dates to month-end for consistent matching
        transformed_mev_forecasts_df['Period'] = transformed_mev_forecasts_df['Period'] + pd.offsets.MonthEnd(0)
        raw_mev_forecasts_df['Period'] = raw_mev_forecasts_df['Period'] + pd.offsets.MonthEnd(0)

        final_models_data = {
            col: final_models_df.at[0, col]
            for col in final_models_df.columns
            if (col.startswith("X") or col.startswith("x")) and col[1:].isdigit()
        }

        print('final_models_data', final_models_data)

        # Handle lag columns (e.g., "Best unemp_rate lag.6" or "Best unemp_rate lag_6")
        lag_pattern = re.compile(r'lag[._](\d+)')

        # raw_mev_forecasts_df.to_csv('raw_mev_forecasts_df.csv', index=False)
        # transformed_mev_forecasts_df.to_csv('transformed_mev_forecasts_df.csv', index=False)
        
        # Step 10: Process each column to identify and transform lag columns
        for col in transformed_mev_forecasts_df.columns:
            if col == 'Period':
                continue
            
            col_lag = None
            # comapare column from finals model column if it has lag values
            for x_key, x_val in final_models_data.items():
                temp_col = col.split(' ')[1]

                print('temp_col', temp_col, 'x_val', x_val)
                if temp_col and temp_col in x_val:
                    col_lag = x_val
            
            if col_lag is None:
                # Retain original value - no transformation needed
                continue
                    
            # Check if column name contains lag pattern (e.g., "lag.6" or "lag_6")
            # This identifies columns that need lag transformation
            lag_match = lag_pattern.search(col_lag)
            print(lag_match)
            if lag_match:
                # Extract the number of months to lag (e.g., 6 from "lag.6")
                lag_months = int(lag_match.group(1))
                
                # Extract base column name (the column name itself, without removing lag part)
                # Note: The base column name is the same as the lag column name
                # This assumes the base column exists in raw_mev_forecasts_df with the same name
                base_col = col
                
                # Check if base column exists in raw_mev_forecasts_df
                # The raw dataframe contains both historical and forecasted data needed for lag lookups
                if base_col in raw_mev_forecasts_df.columns:
                    # Calculate lagged Period for each row, preserving month-end
                    # For a column "lag.6", we look back 6 months from the current period
                    lagged_periods = transformed_mev_forecasts_df['Period'] - pd.DateOffset(months=lag_months)
                    # Normalize to month-end after subtraction to ensure consistent date matching
                    lagged_periods = lagged_periods + pd.offsets.MonthEnd(0)
                    
                    # Create a temporary dataframe for merging
                    # This will help us look up values from the lagged period
                    temp_df = transformed_mev_forecasts_df[['Period']].copy()
                    temp_df['lagged_Period'] = lagged_periods
                    
                    # Merge with raw_mev_forecasts_df to get values from lagged period
                    # This retrieves the actual values that existed N months ago
                    merged = pd.merge(
                        temp_df,
                        raw_mev_forecasts_df[['Period', base_col]],
                        left_on='lagged_Period',
                        right_on='Period',
                        how='left',
                        suffixes=('', '_raw')
                    )
                    
                    # Get values from base column and apply natural logarithm for lag columns
                    # Lag transformations typically use log-transformed values for modeling
                    lag_values = merged[base_col].copy()
                    
                    # Convert to numeric if needed (handle percentage strings)
                    # Remove "%" character if present before converting to numeric
                    # This handles cases where values are stored as "5%" instead of 0.05
                    if lag_values.dtype == 'object':
                        lag_values = lag_values.astype(str).str.replace('%', '', regex=False)
                    lag_values = pd.to_numeric(lag_values, errors='coerce')
                    
                    # Apply natural logarithm, handling NaN and non-positive values
                    # Log transformation requires positive values, so set non-positive/NaN to 0
                    # lag_values = np.where(
                    #     (lag_values.notna()) & (lag_values > 0),
                    #     np.log(lag_values),
                    #     0
                    # )
                    
                    # Update the lag column with log-transformed values
                    transformed_mev_forecasts_df[col] = lag_values
                else:
                    # If base column doesn't exist, set lag column to 0
                    print(f"Warning: Base column '{base_col}' not found in raw_mev_forecasts_df for lag column '{col}'")
                    transformed_mev_forecasts_df[col] = 0

        # transformed_mev_forecasts_df.to_csv('transformed_mev_forecasts_df.csv', index=False)
        return transformed_mev_forecasts_df
    except Exception as e:
        print(f"Error during process_transform_forecasted_mevs: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def format_override_forecasted_mevs_df(override_forecasted_mevs_df: pd.DataFrame) -> pd.DataFrame:
    """
    Format override forecasted MEVs dataframe by handling multi-level column headers.
    
    This function processes dataframes with multi-level headers (common in Excel exports):
    1. Removes "Unnamed: X" column names (replaces with empty strings)
    2. Forward-fills empty column headers with the previous non-empty value
    3. Combines column headers with the first row values to create final column names
    4. Drops the first row (which was used for header information)
    
    Example transformation:
    - Input columns: ["Upside", "Unnamed: 1", "Unnamed: 2", "Base", "Unnamed: 4"]
    - After forward-fill: ["Upside", "Upside", "Upside", "Base", "Base"]
    - First row values: ["", "gdp", "gni", "", "gdp"]
    - Final columns: ["Upside", "Upside gdp", "Upside gni", "Base", "Base gdp"]
    
    Args:
        override_forecasted_mevs_df (pd.DataFrame): Raw dataframe with multi-level headers
    
    Returns:
        pd.DataFrame | None: Formatted dataframe with combined column headers, or None if error occurs
    """
    try:
        output_df = override_forecasted_mevs_df.copy()
            
        # Replace "Unnamed: X" column names with empty strings
        # This handles Excel exports where merged cells create unnamed columns
        output_df.columns = ['' if re.match(r'^Unnamed:\s*\d+$', col) else col for col in output_df.columns]

        # Forward fill column headers (replace empty strings with previous non-empty value)
        # This handles cases where column headers span multiple columns (merged cells)
        cols = pd.Series(output_df.columns)
        cols = cols.replace('', np.nan).ffill().fillna('')
        output_df.columns = cols

        # Change NaN to empty string for consistent string handling
        output_df = output_df.where(pd.notnull(output_df), '')

        # Combine column headers with first row values
        # The first row typically contains variable names (e.g., "gdp", "gni")
        # Final column names will be like "Upside gdp", "Base gni", etc.
        first_row = output_df.iloc[0]
        new_columns = []
        for col_name, first_val in zip(output_df.columns, first_row):
            if first_val and str(first_val).strip():  # If first row value is not empty
                new_columns.append(f"{col_name} {first_val}".strip())
            else:
                new_columns.append(col_name)

        output_df.columns = new_columns
        # Drop the first row (which was used for column headers)
        output_df = output_df.iloc[1:].reset_index(drop=True)

        return output_df
    except Exception as e:
        print(f"Error during format override forecasted MEVs dataframe: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def populate_previous_dates(data_transformation_df: pd.DataFrame, 
                            formatted_override_forecasted_mevs_df: pd.DataFrame) -> pd.DataFrame:
    """
    Populate historical dates with data from interpolation dataframe.
    
    This function creates a new dataframe with all historical dates from the interpolation dataframe
    and populates the columns by matching them with corresponding "Point Forecast" columns.
    
    Column matching logic:
    1. Parses column names to extract scenario and metric (e.g., "Base gdp" -> scenario="Base", metric="gdp")
    2. Maps to interpolation dataframe columns using pattern: "{metric}.Point Forecast"
    3. For all scenarios (Upside, Base, Downside), uses the same "Point Forecast" column
    4. Handles special cases:
       - Values > 100: Uses growth rate columns (if available)
       - Growth rate columns: Multiplies by 100 to convert to percentage
       - Missing columns: Fills with NaN
    
    Example:
    - Column "Upside gdp" -> matches "gdp.Point Forecast" in interpolation dataframe
    - Column "Base gni" -> matches "gni.Point Forecast" in interpolation dataframe
    - Column "Downside unemp_rate" -> matches "unemp_rate.Point Forecast" in interpolation dataframe
    
    Args:
        data_transformation_df (pd.DataFrame): DataFrame with historical interpolated data
                                             containing columns like "Date", "gdp.Point Forecast", etc.
        formatted_override_forecasted_mevs_df (pd.DataFrame): Formatted override dataframe with
                                                              column structure to replicate
    
    Returns:
        pd.DataFrame | None: New dataframe with historical dates populated, or None if error occurs
    """
    try:
        # Make a copy to avoid modifying the original dataframe
        data_transformation_df_copy = data_transformation_df.copy()

        print('data_transformation_df_copy.columns', data_transformation_df_copy.columns)
        print('formatted_override_forecasted_mevs_df.columns', formatted_override_forecasted_mevs_df.columns)

        # Get all Date values from data_transformation_df and store in array
        # These will be used as the Period column in the output dataframe
        dates = data_transformation_df_copy['Date'].tolist()

        # Create new dataframe with same column structure as formatted override dataframe
        new_df = pd.DataFrame(columns=formatted_override_forecasted_mevs_df.columns.tolist())
        new_df['Period'] = dates

        # Ensure Date column in data_transformation_df is datetime for proper merging
        data_transformation_df_copy['Date'] = pd.to_datetime(data_transformation_df_copy['Date'], errors='coerce')
        new_df['Period'] = pd.to_datetime(new_df['Period'], errors='coerce')
        
        cols = new_df.columns.tolist()
        
        # Populate each column by matching dates and finding corresponding columns in data_transformation_df
        for col in cols:
            if col == 'Period':
                continue
            
            # Parse column name to extract scenario and metric
            # Pattern: "Best unemp_rate" -> scenario="Best", metric="unemp_rate"
            # Pattern: "Base gdp" -> scenario="Base", metric="gdp"
            # Pattern: "Downside gni" -> scenario="Downside", metric="gni"
            # parts = col.split()
            parts = col
            print(parts)
            # if len(parts) >= 2:
            if parts:
                scenario = parts[0]  # Best, Base, Downside, Upside, or Worst
                # metric = ''.join(parts[1:])  # unemp_rate, gdp, gni, etc.
                metric = parts
                print(metric)
                
                # Find matching column in data_transformation_df_copy
                # Look for column with pattern "{metric}.Point Forecast"
                # Note: All scenarios (Upside, Base, Downside) use the same Point Forecast column
                matching_col = f"{metric}"
                
                # Check if column exists and if values are greater than 100
                if matching_col in data_transformation_df_copy.columns:
                    # Check if any values in the column are greater than 100
                    # This indicates the values might be in a different scale (e.g., growth rates)
                    col_values = pd.to_numeric(data_transformation_df_copy[matching_col], errors='coerce')
                    has_values_gt_100 = (col_values > 100).any()
                    
                    # If values are greater than 100, use growth_rate column instead
                    # (Note: Current logic uses same column, but this is where growth rate logic would go)
                    if has_values_gt_100:
                        growth_rate_col = f"{metric}"
                        if growth_rate_col in data_transformation_df_copy.columns:
                            matching_col = growth_rate_col
                            print(f"Using '{growth_rate_col}' for '{col}' (values > 100 detected)")
                        else:
                            print(f"Warning: Growth rate column '{growth_rate_col}' not found, using '{matching_col}'")
                    
                    # Merge on Date = Period to get values for each historical date
                    merged = pd.merge(
                        new_df[['Period']],
                        data_transformation_df_copy[['Date', matching_col]],
                        left_on='Period',
                        right_on='Date',
                        how='left'
                    )

                    # Handle growth rate columns (multiply by 100 to convert to percentage)
                    if "growth_12m" in matching_col:
                        new_df[col] = merged[matching_col].values * 100
                    else:
                        new_df[col] = merged[matching_col].values
                else:
                    print(f"Warning: Could not find column '{matching_col}' in data_transformation_df")
                    new_df[col] = np.nan
            else:
                # If column name doesn't match expected pattern, try to find exact match
                # This handles columns that don't follow the "Scenario Metric" pattern
                if col in data_transformation_df_copy.columns:
                    merged = pd.merge(
                        new_df[['Period']],
                        data_transformation_df_copy[['Date', col]],
                        left_on='Period',
                        right_on='Date',
                        how='left'
                    )
                    new_df[col] = merged[col].values
                else:
                    print(f"Warning: Could not find column '{col}' in data_transformation_df")
                    new_df[col] = np.nan
        
        return new_df
    except Exception as e:
        print(f"Error during populate previous dates: {str(e)}")
        import traceback
        traceback.print_exc()
        return None