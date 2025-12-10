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
    loan_balance_matrix = json.loads(aging_report.json_data)
    
    # Convert timestamp dates to YYYY-MM-DD format for all records
    for i in loan_balance_matrix:
        i['date'] = timestamp_to_yyyy_mm_dd(i['date'])

    # Convert to DataFrame for easier manipulation
    loan_balance_matrix_df = pd.DataFrame(loan_balance_matrix)

    # Calculate percentage distribution of loan balances across aging buckets
    flow_of_loan_balance_principal_matrix_dist_df = calculate_flow_of_loan_balance_principal_matrix_dist(loan_balance_matrix_df)
    
    # Calculate flow rates (probability of loans moving between buckets)
    flow_rate_df = calculate_flow_rate(loan_balance_matrix_df)
    
    # Return all three datasets as dictionaries
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
    
    Flow rate represents the probability that loans in a bucket will remain or transition.
    It's calculated as the ratio of loans that "survived" from the previous period's next
    bucket to the current period's current bucket. This measures how loans flow through
    the aging buckets over time.
    
    Formula: flow_rate = previous_period_next_bucket / current_period_current_bucket
    
    Args:
        flow_of_loan_balance_principal_matrix_dist_df (pd.DataFrame): DataFrame with percentage
            distributions of loan balances. Must have 'date' column and aging bucket columns.
    
    Returns:
        pd.DataFrame: DataFrame with flow rates for each bucket and date. Flow rates are
                     capped at 1.0 (100%). The PAR 360+ bucket is always set to 1.0.
                     Returns None if an error occurs.
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
        
        # Process each row (skip first row as there's no previous period to compare)
        for row_idx in range(1, len(df)):
            for col_idx, col in enumerate(process_cols):
                # PAR 360+ bucket is always 100% (complete write-off)
                if col == 'par 360  (361 & up days)':
                    df.loc[row_idx, col] = 1.0
                else:
                    # Get the next column index (next aging bucket)
                    next_col_idx = col_idx + 1
                    if next_col_idx < len(process_cols):
                        next_col = process_cols[next_col_idx]
                        
                        # Calculate flow rate: previous_row_next_column / current_row_current_column
                        # This represents: loans that moved from previous period's next bucket
                        # divided by loans in current period's current bucket
                        prev_row_next_col_val = flow_of_loan_balance_principal_matrix_dist_copy.loc[row_idx-1, next_col]
                        curr_row_curr_col_val = flow_of_loan_balance_principal_matrix_dist_copy.loc[row_idx, col]

                        # Avoid division by zero
                        if curr_row_curr_col_val != 0:
                            ratio = prev_row_next_col_val / curr_row_curr_col_val
                            # Cap flow rate at 1.0 (100%)
                            df.loc[row_idx, col] = min(ratio, 1.0)
                        else:
                            # If current bucket has zero balance, assume 100% flow rate
                            df.loc[row_idx, col] = 1.0
        
        # Clean up column names (remove double spaces)
        df.columns = df.columns.str.replace('  ', ' ')
        
        # Standardize bucket column names
        df = rename_bucket_cols(df)
        
        return df
    except Exception as e:
        # Print full traceback for debugging
        traceback.print_exc()
        return None

