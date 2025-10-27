import pandas as pd
import numpy as np
import os
import json
import traceback

from datetime import datetime

from helpers.timestamp_converter import timestamp_to_yyyy_mm_dd

import warnings
warnings.filterwarnings('ignore')

def flow_rate_main(aging_report):

    loan_balance_matrix = json.loads(aging_report.json_data)
    for i in loan_balance_matrix:
        i['date'] = timestamp_to_yyyy_mm_dd(i['date'])

    loan_balance_matrix_df = pd.DataFrame(loan_balance_matrix)

    flow_of_loan_balance_principal_matrix_dist_df = calculate_flow_of_loan_balance_principal_matrix_dist(loan_balance_matrix_df)
    flow_rate_df = calculate_flow_rate(loan_balance_matrix_df)
    
    return {
        'Flow of Loan Balance Principal Matrix': loan_balance_matrix_df.to_dict(orient='records'),
        'Flow of Loan Balance Principal Matrix (Distribution)': flow_of_loan_balance_principal_matrix_dist_df.to_dict(orient='records'),
        'Flow Rate Calculation': flow_rate_df.to_dict(orient='records')
    }

def calculate_flow_of_loan_balance_principal_matrix_dist(loan_balance_matrix_df):
    loan_balance_matrix_df_copy = loan_balance_matrix_df.copy()

    cols = loan_balance_matrix_df_copy.columns

    df = pd.DataFrame(columns=cols)
    for i in df.columns:
        if i in ['date', 'total loan balance with c/p']:
            df[i] = loan_balance_matrix_df_copy[i]
            continue
        df[i] = loan_balance_matrix_df_copy[i] / loan_balance_matrix_df_copy['total loan balance with c/p']

    df['total loan balance with c/p'] = df[[col for col in df.columns if col not in ['date', 'total loan balance with c/p']]].sum(axis=1)
    return df
    
def calculate_flow_rate(flow_of_loan_balance_principal_matrix_dist_df):
    try:
        flow_of_loan_balance_principal_matrix_dist_copy = flow_of_loan_balance_principal_matrix_dist_df.copy()

        cols = flow_of_loan_balance_principal_matrix_dist_copy.columns.tolist()

        # Create DataFrame with date column
        df = pd.DataFrame({'date': flow_of_loan_balance_principal_matrix_dist_copy['date']})
        
        # Get columns to process (exclude date and total balance)
        process_cols = [col for col in cols if col not in ['date', 'total loan balance with c/p']]
        
        # Initialize all columns
        for col in process_cols:
            df[col] = 0.0
        
        # Process each row (skip first row as it's the header)
        for row_idx in range(1, len(df)):
            for col_idx, col in enumerate(process_cols):
                if col == 'par 360  (361 & up days)':
                    df.loc[row_idx, col] = 1.0
                else:
                    # Get the next column for the previous row calculation
                    next_col_idx = col_idx + 1
                    if next_col_idx < len(process_cols):
                        next_col = process_cols[next_col_idx]
                        
                        # Calculate: previous_row_next_column / current_row_current_column
                        prev_row_next_col_val = flow_of_loan_balance_principal_matrix_dist_copy.loc[row_idx-1, next_col]
                        curr_row_curr_col_val = flow_of_loan_balance_principal_matrix_dist_copy.loc[row_idx, col]

                        # Avoid division by zero
                        if curr_row_curr_col_val != 0:
                            ratio = prev_row_next_col_val / curr_row_curr_col_val
                            df.loc[row_idx, col] = min(ratio, 1.0)
                        else:
                            df.loc[row_idx, col] = 1.0
        # replace  double spaces in df.columns
        df.columns = df.columns.str.replace('  ', ' ')
        df = update_bucket_cols(df)
        return df
    except Exception as e:
        traceback.print_exc()
        return None

def update_bucket_cols(df):
    """
    Update column names from current format to standardized bucket transition format.
    
    Current format examples: '0 day', 'par 1  (1 & 30 days)', etc.
    Target format represents transitions: '0 day to PAR 1', 'PAR 1 to PAR 30', etc.
    """
    # Create a mapping of current column names to new transition names
    column_mapping = {
        '0 day': '0 day to PAR 1',
        'par 1 (1 & 30 days)': 'PAR 1 to PAR 30',
        'par 30 (31 & 60 days)': 'PAR 30 to PAR 60',
        'par 60 (61 & 90 days)': 'PAR 60 to PAR 90',
        'par 90 (91 & 120 days)': 'PAR 90 to PAR 120',
        'par 120 (121 & 180 days)': 'PAR 120 to PAR 180',
        'par 180 (181 & 240 days)': 'PAR 180 to PAR 240',
        'par 240 (241 & 360 days)': 'PAR 240 to PAR 360',
        'par 360 (361 & up days)': 'PAR 360 above',
        'date': 'date',  # Keep date column as is
        'total loan balance with c/p': 'total loan balance with c/p'  # Keep total balance as is
    }
    
    # Debug: Print actual column names
    print("Actual columns in DataFrame:", df.columns.tolist())
    
    # Create new column names list
    new_columns = []
    for col in df.columns:
        # Check if column name matches any of the mapping keys (case-insensitive)
        found = False
        col_normalized = col.strip().lower()
        
        for old_name, new_name in column_mapping.items():
            old_name_normalized = old_name.strip().lower()
            
            # Exact match
            if col_normalized == old_name_normalized:
                new_columns.append(new_name)
                found = True
                print(f"Matched: '{col}' -> '{new_name}'")
                break
        
        # If no mapping found, keep original column name
        if not found:
            new_columns.append(col)
            print(f"No match for: '{col}' - keeping original")
    
    # Apply the new column names
    df.columns = new_columns
    
    return df