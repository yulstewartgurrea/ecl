import pandas as pd
import numpy as np
import os
import traceback

from datetime import datetime

from helpers.routers.rename_bucket_cols import rename_bucket_cols

import warnings
warnings.filterwarnings('ignore')

# BUCKETS = [
#     "0 day to PAR 1",
#     "PAR 1 to PAR 30",
#     "PAR 30 to PAR 60",
#     "PAR 60 to PAR 90",
#     "PAR 90 to PAR 120",
#     "PAR 120 to PAR 180",
#     "PAR 180 to PAR 240",
#     "PAR 240 to PAR 360",
#     "PAR 360 above",
# ]

EMPTY_PRODUCT_VALUE = 1.0

def creditloss_rate_main(flowrate_output_data):
    """
    Main entry point for credit loss rate calculation.
    
    This function takes the output from flow rate calculations and computes credit loss rates
    by calculating tail products (cumulative flow rate products) and weighted credit loss rates.
    The tail products represent the probability that loans will reach each aging stage, which
    is used to estimate expected credit losses.
    
    Args:
        flowrate_output_data (dict): Dictionary containing three DataFrames from flow_rate_main():
            - 'Flow of Loan Balance Principal Matrix': Original loan balance data
            - 'Flow of Loan Balance Principal Matrix (Distribution)': Percentage distributions
            - 'Flow Rate Calculation': Flow rates for each bucket and date
    
    Returns:
        dict: Result dictionary with:
            - 'code': Status code (1 for success, -1 for error)
            - 'success': Boolean indicating success status
            - 'msg': Status message
            - 'data': DataFrame with aging bucket calculations including:
                * Tail products for each bucket (credit loss rates)
                * Monotonicity check (whether tail products are strictly increasing)
                * Weighted credit loss rate per month
                * Average row with mean values
    """
    try:
        # Load inputs from flowrate output data
        flow_of_loan_balance_principal_matrix = pd.DataFrame(
            flowrate_output_data.get('Flow of Loan Balance Principal Matrix', [])
        )
        flow_of_loan_balance_principal_matrix_dist = pd.DataFrame(
            flowrate_output_data.get('Flow of Loan Balance Principal Matrix (Distribution)', [])
        )
        flow_rate = pd.DataFrame(flowrate_output_data.get('Flow Rate Calculation', []))

        BUCKETS = flow_of_loan_balance_principal_matrix.columns.tolist()
        BUCKETS = [col for col in BUCKETS if col not in ['date', 'total loan balance with c/p']]

        print('BUCKETS \n', BUCKETS)
        print('flow_rate.columns \n', flow_rate.columns)


        # Validate that flow rate DataFrame has all required columns
        req = ["date"] + BUCKETS
        missing = [c for c in req if c not in flow_rate.columns]
        if missing:
            return {"code": -1, "success": False, "msg": f"Missing columns: {missing}"}

        # Calculate aging buckets with tail products and weighted credit loss rates
        aging_buckets_res = calculate_aging_buckets(flow_of_loan_balance_principal_matrix_dist, flow_rate)

        # Aging category calculation is commented out as overlay is a prerequisite
        # aging_category_res = calculate_aging_category(aging_buckets_res['data'], flow_of_loan_balance_principal_matrix_dist)

        # Return successful result with aging buckets data
        res = {
            'code': 1,
            'success': True,
            'msg': 'Success',
            'data': aging_buckets_res['data'].to_dict(orient='records')
        }
        return res
    except Exception as e:
        # Print full traceback for debugging
        traceback.print_exc()
        res = {
            'code': -1,
            'success': False,
            'msg': f'Something went wrong. {e}'
        }
        return res

def calculate_aging_buckets(flow_of_loan_balance_principal_matrix_dist, flow_rate):
    """
    Calculates tail products (cumulative flow rate products) and weighted credit loss rates.
    
    This function computes tail products for each aging bucket, which represent the cumulative
    probability that loans will reach each aging stage. Tail products are calculated as the
    product of flow rates from a given bucket to the end (e.g., for bucket 0: flow[0] × flow[1] × ... × flow[8]).
    These tail products are then weighted by the distribution of loan balances to calculate
    the weighted credit loss rate per month.
    
    Args:
        flow_of_loan_balance_principal_matrix_dist (pd.DataFrame): DataFrame with percentage
            distributions of loan balances across aging buckets. Used as weights for calculating
            weighted credit loss rates.
        flow_rate (pd.DataFrame): DataFrame with flow rates for each bucket and date. Must contain
            'date' column and all BUCKETS columns.
    
    Returns:
        dict: Result dictionary with:
            - 'code': Status code (1 for success, -1 for error)
            - 'msg': Status message
            - 'data': DataFrame containing:
                * Date column
                * 9 bucket columns with tail products (credit loss rates for each bucket)
                * 'Monotonic?' column indicating if tail products are strictly increasing
                * 'Weighted Credit Loss Rate per Month' column (SUMPRODUCT of tail products × distributions)
                * Average row with mean values for all numeric columns
    """
    try:
        BUCKETS = flow_of_loan_balance_principal_matrix_dist.columns.tolist()
        BUCKETS = [col for col in BUCKETS if col not in ['date', 'total loan balance with c/p']]

        # Validate that flow rate DataFrame has all required columns
        req = ["date"] + BUCKETS
        missing = [c for c in req if c not in flow_rate.columns]
        if missing:
            return {"code": -1, "success": False, "msg": f"Missing columns: {missing}"}

        # Work on a copy to avoid modifying original data
        # Coerce bucket columns to numeric (handles scientific notation strings like '8.77E-05')
        df = flow_rate[req].copy()
        for c in BUCKETS:
            df[c] = pd.to_numeric(df[c], errors="coerce")

        # Compute tail products per row (offset products)
        # Tail product for bucket i = product of flow rates from bucket i to the end
        # Example: For bucket 0, tail product = flow_rate[0] × flow_rate[1] × ... × flow_rate[8]
        bucket_vals = (
            df[BUCKETS]
            .apply(lambda r: _offset_products(r.values.astype(float), BUCKETS), axis=1)
            .apply(pd.Series)
        )
        bucket_vals.columns = BUCKETS
        
        # Check monotonicity: tail products should be strictly increasing
        # This ensures logical progression (higher buckets have higher credit loss risk)
        mono = bucket_vals.apply(lambda r: "Yes" if _strictly_increasing(r.tolist()) else "No", axis=1)

        # Calculate Weighted Credit Loss Rate per Month
        # Need distribution percentages from Flow of Loan Balance Principal Matrix (Distribution)
        # These act as weights for the tail products

        # Standardize bucket column names to match BUCKETS list
        distribution_df = rename_bucket_cols(flow_of_loan_balance_principal_matrix_dist)
        distribution_df = distribution_df[BUCKETS].copy()
        print('distribution_d \n', distribution_df)
        
        # Calculate SUMPRODUCT for each row: weighted average of tail products
        weighted_credit_loss = []
        for idx in range(len(bucket_vals)):
            # Get tail products (credit loss rates) for this date
            tail_products = bucket_vals.iloc[idx].values
            
            # Get distribution percentages (weights) for this date
            # Use row index to match corresponding date in distribution DataFrame
            dist_weights = distribution_df.iloc[idx].values
            
            # Calculate SUMPRODUCT: sum(tail_product[i] * dist_weight[i])
            # This gives the expected credit loss rate weighted by loan balance distribution
            weighted_rate = np.sum(tail_products * dist_weights)
            weighted_credit_loss.append(weighted_rate)

        # Build output DataFrame with date, tail products, monotonicity check, and weighted rate
        out = pd.concat([df[["date"]].reset_index(drop=True), bucket_vals.reset_index(drop=True)], axis=1)
        out["Monotonic?"] = mono
        out["Weighted Credit Loss Rate per Month"] = weighted_credit_loss

        print('out.columns', out.columns)
        print('out \n', out)

        # Calculate averages for numeric columns (excluding 'date' and 'Monotonic?')
        numeric_cols = [col for col in out.columns if col not in ['date', 'Monotonic?']]
        
        # Create average row with mean values
        avg_row = {'date': 'Average'}
        for col in numeric_cols:
            avg_row[col] = out[col].mean()
        avg_row['Monotonic?'] = ''  # Empty for average row (not applicable)
        
        # Create average DataFrame row
        avg_rows_df = pd.DataFrame([avg_row])
        
        # Concatenate original data with average row
        final_out = pd.concat([out, avg_rows_df], ignore_index=True)
        
        # print('final_out with averages \n', final_out)

        # final_out.to_csv('calculate_aging_buckets.csv')

        return {
            'code': 1,
            'msg': 'Success',
            'data': final_out
        }
    except Exception as e:
        # Print full traceback for debugging
        traceback.print_exc()
        return {
            'code': -1,
            'success': False,
            'msg': f'Something went wrong. {e}'
        }

def calculate_aging_category(aging_buckets_df, distribution_df, scalar=-0.999620893082456):
    """
    Calculate aging category table based on the aging buckets results.
    
    This function creates a summary table that aggregates historical credit loss rates by aging
    category and applies a scalar adjustment to calculate forward-looking credit loss rates.
    It extracts average values from the aging buckets results and combines them with distribution
    percentages to create a comprehensive aging category analysis.
    
    Note: This function is currently commented out in the main flow as overlay is a prerequisite.
    
    Parameters:
        aging_buckets_df (pd.DataFrame): DataFrame from calculate_aging_buckets containing
            tail products and average rows. Must have an 'Average' row in the 'date' column.
        distribution_df (pd.DataFrame): DataFrame with distribution percentages from
            Flow of Loan Balance Principal Matrix (Distribution). Used to weight calculations.
        scalar (float): Adjustment scalar for forward-looking rates (default: -0.999620893082456).
            Applied as: historical_rate * (1 + scalar)
    
    Returns:
        dict: Result dictionary with:
            - 'code': Status code (1 for success, -1 for error)
            - 'success': Boolean indicating success status
            - 'msg': Status message
            - 'data': DataFrame with aging category calculations including:
                * Aging Category: Category name (0 day, PAR 1, PAR 30, etc.)
                * Historical Credit Loss Rate: Average tail product for the category
                * Average Historical Distribution of balances: Mean distribution percentage
                * Historical Credit Loss Rate + Scalar: Adjusted historical rate
                * Forward-looking Credit Loss Rate: Forward-looking estimate (1.0 for PAR 360+)
                * Summary row with SUMPRODUCT calculations
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

        print('aging_buckets_df \n', aging_buckets_df)
        
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
    """
    Calculate product of non-zero, non-NaN values.
    
    This helper function mimics Excel's PRODUCT(IF(...)) behavior by:
    - Filtering out zero and NaN values
    - Calculating the product of remaining values
    - Returning 0 if all values are zero or NaN (empty array)
    
    This is used when calculating tail products to ignore invalid flow rate values.
    
    Args:
        arr (np.ndarray): Array of numeric values (may contain zeros or NaNs)
    
    Returns:
        float: Product of non-zero, non-NaN values. Returns 0 if no valid values exist.
    """
    a = np.asarray(arr, dtype=float)
    # Filter out zeros and NaNs
    a = a[(a != 0) & ~np.isnan(a)]
    # Return 0 if no valid values, otherwise return product
    return 0 if a.size == 0 else float(np.prod(a))

def _offset_products(row_vals: np.ndarray, BUCKETS: list[str]) -> list[float]:
    """
    Calculate tail products (offset products) for all 9 aging buckets.
    
    For each bucket position i, calculates the cumulative product of flow rates from
    that position to the end. This represents the probability that a loan will reach
    each aging stage.
    
    Example: For bucket 0 (0 day to PAR 1):
        tail_product[0] = flow_rate[0] × flow_rate[1] × ... × flow_rate[8]
    
    For bucket 8 (PAR 360+):
        tail_product[8] = flow_rate[8] (only the last bucket)
    
    Args:
        row_vals (np.ndarray): Array of 9 flow rate values (one for each bucket)
        BUCKETS (list[str]): List of bucket names
    
    Returns:
        list[float]: List of 9 tail products, one for each bucket. Each tail product
                     represents the cumulative probability of reaching that aging stage.
    """
    out = []
    # For each bucket position, calculate product from that position to the end
    for i in range(len(BUCKETS)):
        out.append(_safe_prod_nonzero(row_vals[i:]))
    return out

def _strictly_increasing(vals: list[float]) -> bool:
    """
    Check if a list of values is strictly increasing.
    
    This function verifies that each value in the list is less than the next value.
    Used to validate that tail products are monotonically increasing, which ensures
    logical progression of credit loss risk (higher aging buckets should have higher
    tail products/credit loss rates).
    
    Args:
        vals (list[float]): List of numeric values to check
    
    Returns:
        bool: True if values are strictly increasing (each value < next value),
              False otherwise
    """
    return all(vals[i] < vals[i+1] for i in range(len(vals)-1))