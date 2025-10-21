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
        print("Columns:", cols)

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

        return df
    except Exception as e:
        traceback.print_exc()
        return None