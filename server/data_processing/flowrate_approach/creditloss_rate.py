import pandas as pd
import numpy as np
import os
import traceback

from datetime import datetime

from helpers.routers.rename_bucket_cols import rename_bucket_cols

import warnings
warnings.filterwarnings('ignore')

BUCKETS = [
    "0 day to PAR 1",
    "PAR 1 to PAR 30",
    "PAR 30 to PAR 60",
    "PAR 60 to PAR 90",
    "PAR 90 to PAR 120",
    "PAR 120 to PAR 180",
    "PAR 180 to PAR 240",
    "PAR 240 to PAR 360",
    "PAR 360 above",
]

EMPTY_PRODUCT_VALUE = 1.0

def creditloss_rate_main(flowrate_output_data):
    try:
        # Load inputs (kept even if not used yet)
        flow_of_loan_balance_principal_matrix = pd.DataFrame(
            flowrate_output_data.get('Flow of Loan Balance Principal Matrix', [])
        )
        flow_of_loan_balance_principal_matrix_dist = pd.DataFrame(
            flowrate_output_data.get('Flow of Loan Balance Principal Matrix (Distribution)', [])
        )
        flow_rate = pd.DataFrame(flowrate_output_data.get('Flow Rate Calculation', []))

        # Validate required columns
        req = ["date"] + BUCKETS
        missing = [c for c in req if c not in flow_rate.columns]
        if missing:
            return {"code": -1, "success": False, "msg": f"Missing columns: {missing}"}

        aging_buckets_res = calculate_aging_buckets(flow_of_loan_balance_principal_matrix_dist, flow_rate)

        # commented aging category, overlay is prerequisite
        # aging_category_res = calculate_aging_category(aging_buckets_res['data'], flow_of_loan_balance_principal_matrix_dist)

        res = {
            'code': 1,
            'success': True,
            'msg': 'Success',
            'data': aging_buckets_res['data'].to_dict(orient='records')
        }
        return res
    except Exception as e:
        traceback.print_exc()
        res = {
            'code': -1,
            'success': False,
            'msg': f'Something went wrong. {e}'
        }
        return res

def calculate_aging_buckets(flow_of_loan_balance_principal_matrix_dist, flow_rate):
    try:
        # Validate required columns
        req = ["date"] + BUCKETS
        missing = [c for c in req if c not in flow_rate.columns]
        if missing:
            return {"code": -1, "success": False, "msg": f"Missing columns: {missing}"}

        # Work on a copy; coerce bucket columns to numeric (handles strings like '8.77E-05')
        df = flow_rate[req].copy()
        for c in BUCKETS:
            df[c] = pd.to_numeric(df[c], errors="coerce")

        # Compute tail products per row (offset products)
        # check if row has all data. if not skip the row.
        bucket_vals = (
            df[BUCKETS]
            .apply(lambda r: _offset_products(r.values.astype(float)), axis=1)
            .apply(pd.Series)
        )
        bucket_vals.columns = BUCKETS
        
        # Monotonic? (strictly increasing across the 9 products)
        mono = bucket_vals.apply(lambda r: "Yes" if _strictly_increasing(r.tolist()) else "No", axis=1)

        # Calculate Weighted Credit Loss Rate per Month
        # Need distribution percentages from Flow of Loan Balance Principal Matrix (Distribution)

        distribution_df = rename_bucket_cols(flow_of_loan_balance_principal_matrix_dist)
        distribution_df = distribution_df[BUCKETS].copy()
        print('distribution_d \n', distribution_df)
        
        # Calculate SUMPRODUCT for each row
        weighted_credit_loss = []
        for idx in range(len(bucket_vals)):
            # Get tail products (credit loss rates) for this date
            tail_products = bucket_vals.iloc[idx].values
            
            # Get distribution percentages (weights) for this date
            # Owlution: use row idx to match corresponding date in distribution
            dist_weights = distribution_df.iloc[idx].values
            
            # Calculate SUMPRODUCT: sum(tail_product[i] * dist_weight[i])
            weighted_rate = np.sum(tail_products * dist_weights)
            weighted_credit_loss.append(weighted_rate)

        # Build output
        out = pd.concat([df[["date"]].reset_index(drop=True), bucket_vals.reset_index(drop=True)], axis=1)
        out["Monotonic?"] = mono
        out["Weighted Credit Loss Rate per Month"] = weighted_credit_loss

        print('out.columns', out.columns)
        print('out \n', out)

        # Calculate averages for numeric columns (excluding 'date' and 'Monotonic?')
        numeric_cols = [col for col in out.columns if col not in ['date', 'Monotonic?']]
        
        # Create average row
        avg_row = {'date': 'Average'}
        for col in numeric_cols:
            avg_row[col] = out[col].mean()
        avg_row['Monotonic?'] = ''  # Empty for average row
        
        # Create average DataFrame rows
        avg_rows_df = pd.DataFrame([avg_row])
        
        # Concatenate original data with average rows
        final_out = pd.concat([out, avg_rows_df], ignore_index=True)
        
        # print('final_out with averages \n', final_out)

        # final_out.to_csv('calculate_aging_buckets.csv')

        return {
            'code': 1,
            'msg': 'Success',
            'data': final_out
        }
    except Exception as e:
        traceback.print_exc()
        return {
            'code': -1,
            'success': False,
            'msg': f'Something went wrong. {e}'
        }

def calculate_aging_category(aging_buckets_df, distribution_df, scalar=-0.999620893082456):
    """
    Calculate aging category table based on the aging buckets results.
    
    Parameters:
    - aging_buckets_df: DataFrame from calculate_aging_buckets with all the tail products
    - distribution_df: DataFrame with distribution percentages (Flow of Loan Balance Principal Matrix Distribution)
    - scalar: Adjustme nt scalar (default from Excel file)
    
    Returns:
    - DataFrame with aging category calculations
    """
    try:
        # Get aging bucket categories (PAR buckets)
        aging_categories = [
            "0 day",
            "PAR 1  (1 & 30 days)",
            "PAR 30  (31 & 60 days)",
            "PAR 60  (61 & 90 days)",
            "PAR 90  (91 & 120 days)",
            "PAR 120  (121 & 180 days)",
            "PAR 180  (181 & 240 days)",
            "PAR 240  (241 & 360 days)",
            "PAR 360  (361 & Up days)",
        ]
        
        # Get average rows from aging buckets
        avg_row_idx = aging_buckets_df[aging_buckets_df['date'] == 'Average'].index
        # avg_without_row_idx = aging_buckets_df[aging_buckets_df['date'] == 'Average without July to Oct 2024'].index
        
        if len(avg_row_idx) == 0 or len(avg_without_row_idx) == 0:
            return {
                'code': -1,
                'success': False,
                'msg': 'Average rows not found in aging buckets data'
            }
        
        # Extract average values (excluding date, Monotonic?, and Weighted Credit Loss columns)
        bucket_cols = BUCKETS
        avg_values = aging_buckets_df.loc[avg_row_idx[0], bucket_cols].values
        avg_without_values = aging_buckets_df.loc[avg_without_row_idx[0], bucket_cols].values
        
        # Get distribution percentages (mean across all dates for each bucket)
        dist_values = distribution_df[bucket_cols].mean().values
        
        # Build the aging category DataFrame
        aging_cat_data = []
        
        for i, category in enumerate(aging_categories):
            row = {
                'Aging Category': category,
                'Historical Credit Loss Rate': avg_values[i],
                # 'Historical Credit Loss Rate w/o July to Sept 2024': avg_without_values[i],
                'Average Historical Distribution of balances': dist_values[i],
                'Historical Credit Loss Rate + Scalar': avg_without_values[i] * (1 + scalar),
            }
            
            # Forward-looking Credit Loss Rate = Historical + Scalar (except last row = 1)
            if i == len(aging_categories) - 1:
                row['Forward-looking Credit Loss Rate'] = 1.0
            else:
                row['Forward-looking Credit Loss Rate'] = row['Historical Credit Loss Rate + Scalar']
            
            aging_cat_data.append(row)
        
        # Add summary row with SUMPRODUCT calculations
        summary_row = {
            'Aging Category': '',
            'Historical Credit Loss Rate': np.sum(avg_values * dist_values),
            # 'Historical Credit Loss Rate w/o July to Sept 2024': np.sum(avg_without_values * dist_values),
            'Average Historical Distribution of balances': np.sum(dist_values),
            'Historical Credit Loss Rate + Scalar': np.sum([row['Historical Credit Loss Rate + Scalar'] * dist_values[i] 
                                                           for i, row in enumerate(aging_cat_data)]),
        }
        
        # Forward-looking is the same as Historical + Scalar for summary
        forward_looking_values = [row['Forward-looking Credit Loss Rate'] for row in aging_cat_data]
        summary_row['Forward-looking Credit Loss Rate'] = np.sum(forward_looking_values * dist_values)
        
        aging_cat_data.append(summary_row)
        
        aging_cat_df = pd.DataFrame(aging_cat_data)
        
        print('aging_cat_df \n', aging_cat_df)

        aging_cat_df.to_csv('aging_category_res.csv')
        
        return {
            'code': 1,
            'msg': 'Success',
            'data': aging_cat_df
        }
    except Exception as e:
        traceback.print_exc()
        return {
            'code': -1,
            'success': False,
            'msg': f'Something went wrong. {e}'
        } 

def _safe_prod_nonzero(arr: np.ndarray) -> float:
    """Product of non-zero, non-NaN values; if none, return 1.0 (Excel PRODUCT(IF(...)) behavior)."""
    a = np.asarray(arr, dtype=float)
    a = a[(a != 0) & ~np.isnan(a)]
    return 0 if a.size == 0 else float(np.prod(a))

def _offset_products(row_vals: np.ndarray) -> list[float]:
    """For 9 horizons, return 9 tail products (start..end), ignoring 0/NaN."""
    out = []
    for i in range(len(BUCKETS)):
        out.append(_safe_prod_nonzero(row_vals[i:]))
    return out

def _strictly_increasing(vals: list[float]) -> bool:
    return all(vals[i] < vals[i+1] for i in range(len(vals)-1))