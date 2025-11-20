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


def process_transform_forecasted_mevs(data_interpolation_df: pd.DataFrame,
                                       override_forecasted_mevs_df: pd.DataFrame):
    
    try:
        format_override_forecasted_mevs_df_res = format_override_forecasted_mevs_df(override_forecasted_mevs_df)
        previous_override_forecasted_mevs_df = populate_previous_dates(data_interpolation_df, format_override_forecasted_mevs_df_res)

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
        
        # Handle lag columns (e.g., "Best unemp_rate lag.6")
        lag_pattern = re.compile(r'lag\.(\d+)')
        
        for col in transformed_mev_forecasts_df.columns:
            if col == 'Period':
                continue
            
            # Check if column name contains lag pattern
            lag_match = lag_pattern.search(col)
            if lag_match:
                lag_months = int(lag_match.group(1))
                # Extract base column name (remove lag.6 part)
                base_col = lag_pattern.sub('', col).strip()
                
                # Check if base column exists in raw_mev_forecasts_df
                if base_col in raw_mev_forecasts_df.columns:
                    # Calculate lagged Period for each row, preserving month-end
                    lagged_periods = transformed_mev_forecasts_df['Period'] - pd.DateOffset(months=lag_months)
                    # Normalize to month-end after subtraction
                    lagged_periods = lagged_periods + pd.offsets.MonthEnd(0)
                    
                    # Create a temporary dataframe for merging
                    temp_df = transformed_mev_forecasts_df[['Period']].copy()
                    temp_df['lagged_Period'] = lagged_periods
                    
                    # Merge with raw_mev_forecasts_df to get values from lagged period
                    merged = pd.merge(
                        temp_df,
                        raw_mev_forecasts_df[['Period', base_col]],
                        left_on='lagged_Period',
                        right_on='Period',
                        how='left',
                        suffixes=('', '_raw')
                    )
                    
                    # Get values from base column and apply natural logarithm for lag columns
                    lag_values = merged[base_col].copy()
                    # Convert to numeric if needed (handle percentage strings)
                    lag_values = pd.to_numeric(lag_values, errors='coerce')
                    # Apply natural logarithm, handling NaN and non-positive values
                    lag_values = np.where(
                        (lag_values.notna()) & (lag_values > 0),
                        np.log(lag_values),
                        np.nan
                    )
                    
                    # Update the lag column with log-transformed values
                    transformed_mev_forecasts_df[col] = lag_values
                else:
                    print(f"⚠️ Warning: Base column '{base_col}' not found in raw_mev_forecasts_df for lag column '{col}'")
                    transformed_mev_forecasts_df[col] = np.nan

        return transformed_mev_forecasts_df
    except Exception as e:
        print(f"❌ Error during interpolation: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def format_override_forecasted_mevs_df(override_forecasted_mevs_df: pd.DataFrame) -> pd.DataFrame:
    try:
        output_df = override_forecasted_mevs_df.copy()
            
        # Replace "Unnamed: X" column names with empty strings
        output_df.columns = ['' if re.match(r'^Unnamed:\s*\d+$', col) else col for col in output_df.columns]

        # forward fill column headers (replace empty strings with previous non-empty value)
        cols = pd.Series(output_df.columns)
        cols = cols.replace('', np.nan).ffill().fillna('')
        output_df.columns = cols

        # change Nan to empty string
        output_df = output_df.where(pd.notnull(output_df), '')

        # Combine column headers with first row values
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
        print(f"❌ Error during format override forecasted MEVs dataframe: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def populate_previous_dates(data_interpolation_df: pd.DataFrame, 
                            formatted_override_forecasted_mevs_df: pd.DataFrame) -> pd.DataFrame:
    try:
        # Make a copy to avoid modifying the original dataframe
        data_interpolation_df_copy = data_interpolation_df.copy()
        
        # get all Date from data_interpolation_df and store it in array
        dates = data_interpolation_df_copy['Date'].tolist()

        new_df = pd.DataFrame(columns=formatted_override_forecasted_mevs_df.columns.tolist())
        new_df['Period'] = dates

        # Ensure Date column in data_interpolation_df is datetime
        data_interpolation_df_copy['Date'] = pd.to_datetime(data_interpolation_df_copy['Date'], errors='coerce')
        new_df['Period'] = pd.to_datetime(new_df['Period'], errors='coerce')
        
        cols = new_df.columns.tolist()
        
        # Populate each column by matching dates and finding corresponding columns in data_interpolation_df
        for col in cols:
            if col == 'Period':
                continue
            
            # Parse column name to extract scenario and metric
            # Pattern: "Best unemp_rate" -> scenario="Best", metric="unemp_rate"
            # Pattern: "Base gdp" -> scenario="Base", metric="gdp"
            parts = col.split()
            if len(parts) >= 2:
                scenario = parts[0]  # Best, Base, or Worst
                metric = ' '.join(parts[1:])  # unemp_rate, gdp, etc.
                
                # Find matching column in data_interpolation_df_copy
                # Look for column with pattern "{metric} Point"
                matching_col = f"{metric} Point"
                
                # Check if column exists and if values are greater than 100
                if matching_col in data_interpolation_df_copy.columns:
                    # Check if any values in the column are greater than 100
                    col_values = pd.to_numeric(data_interpolation_df_copy[matching_col], errors='coerce')
                    has_values_gt_100 = (col_values > 100).any()
                    
                    # If values are greater than 100, use growth_rate column instead
                    if has_values_gt_100:
                        growth_rate_col = f"{metric} Point growth_rate"
                        if growth_rate_col in data_interpolation_df_copy.columns:
                            matching_col = growth_rate_col
                            print(f"ℹ️ Using '{growth_rate_col}' for '{col}' (values > 100 detected)")
                        else:
                            print(f"⚠️ Warning: Growth rate column '{growth_rate_col}' not found, using '{matching_col}'")
                    
                    # Merge on Date = Period
                    merged = pd.merge(
                        new_df[['Period']],
                        data_interpolation_df_copy[['Date', matching_col]],
                        left_on='Period',
                        right_on='Date',
                        how='left'
                    )

                    if "growth_rate" in matching_col:
                        new_df[col] = merged[matching_col].values * 100
                    else:
                        new_df[col] = merged[matching_col].values
                else:
                    print(f"⚠️ Warning: Could not find column '{matching_col}' in data_interpolation_df")
                    new_df[col] = np.nan
            else:
                # If column name doesn't match expected pattern, try to find exact match
                if col in data_interpolation_df_copy.columns:
                    merged = pd.merge(
                        new_df[['Period']],
                        data_interpolation_df_copy[['Date', col]],
                        left_on='Period',
                        right_on='Date',
                        how='left'
                    )
                    new_df[col] = merged[col].values
                else:
                    print(f"⚠️ Warning: Could not find column '{col}' in data_interpolation_df")
                    new_df[col] = np.nan
        
        return new_df
    except Exception as e:
        print(f"❌ Error during populate previous dates: {str(e)}")
        import traceback
        traceback.print_exc()
        return None