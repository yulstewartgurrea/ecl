import pandas as pd
import numpy as np
import os
import json
import traceback

from datetime import datetime

from helpers.timestamp_converter import timestamp_to_yyyy_mm_dd

import warnings
warnings.filterwarnings('ignore')

from helpers.routers.rename_bucket_cols import rename_bucket_cols

OUTPUT_DECIMAL_PLACES = 16

def _round_numeric(df: pd.DataFrame, places: int = OUTPUT_DECIMAL_PLACES) -> pd.DataFrame:
    """
    Round numeric columns for stable exported output (e.g., Excel comparisons).
    Leaves non-numeric columns (like 'date') unchanged.
    """
    if df is None or df.empty:
        return df
    out = df.copy()
    num_cols = out.select_dtypes(include=[np.number]).columns
    if len(num_cols) > 0:
        out[num_cols] = out[num_cols].round(places)
    return out

def flow_rate_main(aging_report):
    """
    Main entry point for flow rate calculation.
    
    This function processes an aging report to calculate flow rates across different aging buckets.
    It converts the raw loan balance matrix into percentage distributions and then calculates
    the flow rates that represent the probability of loans moving between aging buckets.
    
    Args:
        aging_report: An object containing json_data with loan balance matrix data.
                     The json_data should contain a list of dictionaries with 'date' and
                     aging bucket columns (e.g., 'par 1', 'par 30', etc.).
    
    Returns:
        dict: A dictionary containing three DataFrames converted to records:
            - 'Flow of Loan Balance Principal Matrix': Original loan balance data with dates
            - 'Flow of Loan Balance Principal Matrix (Distribution)': Percentage distribution 
              of loan balances across aging buckets (each bucket as % of total)
            - 'Flow Rate Calculation': Flow rates for each aging bucket, representing the
              probability of loans transitioning between buckets over time
    """
    # Parse JSON data from aging report
    try:
        loan_balance_matrix = json.loads(aging_report.json_data)
    except (json.JSONDecodeError, TypeError) as e:
        raise ValueError(
            f"Invalid data format in the aging report input file. "
            f"The uploaded file could not be parsed. "
            f"Please check your aging report input file and ensure it contains valid data. "
            f"Detail: {e}"
        )

    # Convert timestamp dates to YYYY-MM-DD format for all records
    for idx, i in enumerate(loan_balance_matrix):
        try:
            i['date'] = timestamp_to_yyyy_mm_dd(i['date'])
        except (ValueError, KeyError) as e:
            row_num = idx + 2  # +2 for 1-based index + header row
            raw_date = i.get('date', '(missing)')
            raise ValueError(
                f"Invalid date value '{raw_date}' found in row {row_num} of the aging report input file. "
                f"Supported date formats: MM/DD/YYYY, YYYY-MM-DD, DD/MM/YYYY, or numeric timestamps. "
                f"Two-digit years (e.g. '12/31/25') are not supported — please use four-digit years (e.g. '12/31/2025'). "
                f"Please update the date in your aging report input file and re-upload."
            )

    # Convert to DataFrame for easier manipulation
    loan_balance_matrix_df = pd.DataFrame(loan_balance_matrix)

    # Convert numeric columns from formatted strings (e.g. "53,773,459,030.00") to actual numbers
    numeric_cols = [col for col in loan_balance_matrix_df.columns if col != 'date']
    for col in numeric_cols:
        if loan_balance_matrix_df[col].dtype == object:
            # Remove commas from formatted number strings before converting
            cleaned = loan_balance_matrix_df[col].astype(str).str.replace(',', '', regex=False)
            converted = pd.to_numeric(cleaned, errors='coerce')
            # Check if any values failed to convert
            failed_mask = converted.isna() & loan_balance_matrix_df[col].notna()
            if failed_mask.any():
                bad_values = loan_balance_matrix_df.loc[failed_mask, col].tolist()
                bad_dates = loan_balance_matrix_df.loc[failed_mask, 'date'].tolist()
                raise ValueError(
                    f"Column '{col}' contains non-numeric values {bad_values} at dates {bad_dates}. "
                    f"All columns except 'date' must contain numeric values. "
                    f"Please fix these values in your aging report input file and re-upload."
                )
            loan_balance_matrix_df[col] = converted

    # Validate required columns exist
    if 'total loan balance with c/p' not in loan_balance_matrix_df.columns:
        raise ValueError(
            "Missing required column 'total loan balance with c/p' in the aging report input file. "
            "Please ensure your aging report input file contains this column and re-upload."
        )

    # Validate no zero total balances (would cause division errors in distribution calculation)
    zero_balance_rows = loan_balance_matrix_df[
        pd.to_numeric(loan_balance_matrix_df['total loan balance with c/p'], errors='coerce') == 0
    ]
    if not zero_balance_rows.empty:
        dates = zero_balance_rows['date'].tolist()
        raise ValueError(
            f"The 'total loan balance with c/p' column has zero values for dates: {dates}. "
            f"This would cause division errors in the distribution calculation. "
            f"Please check your aging report input file and ensure all total loan balance values are non-zero."
        )

    # Calculate percentage distribution of loan balances across aging buckets
    flow_of_loan_balance_principal_matrix_dist_df = calculate_flow_of_loan_balance_principal_matrix_dist(loan_balance_matrix_df)

    # Calculate flow rates (probability of loans moving between buckets)
    flow_rate_df = calculate_flow_rate(loan_balance_matrix_df)

    # Round numeric outputs for consistent downstream exports/comparisons
    # flow_of_loan_balance_principal_matrix_dist_df = _round_numeric(flow_of_loan_balance_principal_matrix_dist_df)
    # flow_rate_df = _round_numeric(flow_rate_df)
    
    return {
        'Flow of Loan Balance Principal Matrix': loan_balance_matrix_df.to_dict(orient='records'),
        'Flow of Loan Balance Principal Matrix (Distribution)': flow_of_loan_balance_principal_matrix_dist_df.to_dict(orient='records'),
        'Flow Rate Calculation': flow_rate_df.to_dict(orient='records')
    }

def calculate_flow_of_loan_balance_principal_matrix_dist(loan_balance_matrix_df):
    """
    Converts absolute loan balances to percentage distributions.
    
    This function takes the raw loan balance matrix (with absolute dollar amounts) and
    converts each aging bucket's balance to a percentage of the total loan balance.
    This distribution matrix is used to weight credit loss calculations later.
    
    Args:
        loan_balance_matrix_df (pd.DataFrame): DataFrame containing loan balances with columns:
            - 'date': Date column
            - 'total loan balance with c/p': Total loan balance including current/performing
            - Other columns: Aging bucket balances (e.g., 'par 1', 'par 30', etc.)
    
    Returns:
        pd.DataFrame: DataFrame with the same structure, but bucket columns contain
                     percentages (0.0 to 1.0) instead of absolute amounts. The 'total loan
                     balance with c/p' column is recalculated as the sum of all bucket
                     percentages (should equal 1.0).
    """
    # Create a copy to avoid modifying the original DataFrame
    loan_balance_matrix_df_copy = loan_balance_matrix_df.copy()

    cols = loan_balance_matrix_df_copy.columns

    # Initialize new DataFrame with same columns
    df = pd.DataFrame(columns=cols)
    
    # Process each column
    for i in df.columns:
        # Keep date and total balance columns as-is
        if i in ['date', 'total loan balance with c/p']:
            df[i] = loan_balance_matrix_df_copy[i]
            continue
        
        # Convert each bucket's absolute balance to percentage of total
        # Formula: bucket_balance / total_loan_balance
        df[i] = loan_balance_matrix_df_copy[i] / loan_balance_matrix_df_copy['total loan balance with c/p']

    # Recalculate total as sum of all bucket percentages (should equal 1.0)
    df['total loan balance with c/p'] = df[[col for col in df.columns if col not in ['date', 'total loan balance with c/p']]].sum(axis=1)
    
    # Clean up column names (remove double spaces)
    df.columns = df.columns.str.replace('  ', ' ')
    
    return df
    
def calculate_flow_rate(flow_of_loan_balance_principal_matrix_dist_df):
    """
    Calculates flow rates for each aging bucket across time periods.
    
    Flow rate represents the probability that loans in a bucket will transition to the next bucket.
    It's calculated as the ratio of the current period's next bucket value to the next period's
    current bucket value. This measures how loans flow through the aging buckets over time.
    
    Formula: flow_rate = current_period_next_bucket / next_period_current_bucket
    
    Args:
        flow_of_loan_balance_principal_matrix_dist_df (pd.DataFrame): DataFrame with percentage
            distributions of loan balances. Must have 'date' column and aging bucket columns.
    
    Returns:
        pd.DataFrame: DataFrame with flow rates for each bucket and date. Flow rates are
                     capped at 1.0 (100%). The last bucket column is always set to 1.0.
                     The last row is skipped (no next period to compare). Returns None if an error occurs.
    """
    try:
        # Create a copy to avoid modifying the original DataFrame
        flow_of_loan_balance_principal_matrix_dist_copy = flow_of_loan_balance_principal_matrix_dist_df.copy()

        cols = flow_of_loan_balance_principal_matrix_dist_copy.columns.tolist()

        # Create DataFrame with date column
        df = pd.DataFrame({'date': flow_of_loan_balance_principal_matrix_dist_copy['date']})
        
        # Get columns to process (exclude date and total balance columns)
        process_cols = [col for col in cols if col not in ['date', 'total loan balance with c/p']]
        
        # Initialize all bucket columns with 0.0
        for col in process_cols:
            df[col] = 0.0
        
        # Process each row (skip last row as there's no next period to compare)
        for row_idx in range(0, len(df) - 1):
            for col_idx, col in enumerate(process_cols):
                # Last column is always 100% (complete write-off)
                if col_idx == len(process_cols) - 1:
                    df.loc[row_idx, col] = 1.0
                else:
                    # Get the next column index (next aging bucket)
                    next_col_idx = col_idx + 1
                    if next_col_idx < len(process_cols):
                        next_col = process_cols[next_col_idx]
                        
                        # Calculate flow rate: current_row_next_column / next_row_current_column
                        # This represents: current period's next bucket value divided by
                        # next period's current bucket value
                        curr_row_next_col_val = flow_of_loan_balance_principal_matrix_dist_copy.loc[row_idx, next_col]
                        next_row_curr_col_val = flow_of_loan_balance_principal_matrix_dist_copy.loc[row_idx + 1, col]
                        
                        # Avoid division by zero
                        if next_row_curr_col_val != 0:
                            ratio = curr_row_next_col_val / next_row_curr_col_val
                            # Cap flow rate at 1.0 (100%)
                            df.loc[row_idx, col] = min(ratio, 1.0)
                        else:
                            # If next period's current bucket has zero balance, assume 100% flow rate
                            df.loc[row_idx, col] = 1.0
        
        # Clean up column names (remove double spaces)
        df.columns = df.columns.str.replace('  ', ' ')
        
        # Standardize bucket column names
        df = rename_bucket_cols(df)
        
        return df
    except Exception as e:
        # Print full traceback for debugging
        print('error in calculate_flow_rate', e)
        traceback.print_exc()
        return None

