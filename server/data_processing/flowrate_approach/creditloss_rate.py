import pandas as pd
import numpy as np
import os
import traceback

from datetime import datetime

from helpers.routers.rename_bucket_cols import rename_bucket_cols
from decimal import Decimal, localcontext, ROUND_HALF_UP

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
DECIMAL_PLACES = 16
DECIMAL_CONTEXT_PREC = 50

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
            return {
                "code": -1,
                "success": False,
                "msg": (
                    f"Missing required columns in the flow rate output: {missing}. "
                    f"This usually means the aging report input file has incorrect or missing column headers. "
                    f"Please check your aging report input file and ensure all aging bucket columns are present, then re-run the flow rate calculation."
                )
            }

        # Validate input DataFrames are not empty
        if flow_of_loan_balance_principal_matrix.empty:
            return {
                'code': -1,
                'success': False,
                'msg': (
                    'The Flow of Loan Balance Principal Matrix section is empty in the flow rate output file. '
                    'This may indicate the flow rate calculation did not complete successfully. '
                    'Please check your aging report input file and re-run the flow rate calculation.'
                )
            }
        if flow_rate.empty:
            return {
                'code': -1,
                'success': False,
                'msg': (
                    'The Flow Rate Calculation section is empty in the flow rate output file. '
                    'This may indicate the flow rate calculation did not complete successfully. '
                    'Please check your aging report input file and re-run the flow rate calculation.'
                )
            }

        # Calculate aging buckets with tail products and weighted credit loss rates
        aging_buckets_res = calculate_aging_buckets(flow_of_loan_balance_principal_matrix_dist, flow_rate)

        # Check if calculate_aging_buckets returned an error
        if aging_buckets_res.get('code') == -1:
            return aging_buckets_res

        # Return successful result with aging buckets data
        res = {
            'code': 1,
            'success': True,
            'msg': 'Success',
            'data': aging_buckets_res['data'].to_dict(orient='records')
        }
        return res
    except ValueError as e:
        traceback.print_exc()
        return {
            'code': -1,
            'success': False,
            'msg': str(e)
        }
    except Exception as e:
        traceback.print_exc()
        return {
            'code': -1,
            'success': False,
            'msg': (
                f'An unexpected error occurred during credit loss rate calculation. '
                f'Please verify that your aging report input file has the correct format and data, '
                f'then re-run the flow rate calculation before retrying. Detail: {e}'
            )
        }

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
                * 'Strictly Increasing?' column indicating if tail products are strictly increasing
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
            return {
                "code": -1,
                "success": False,
                "msg": (
                    f"Missing required columns in the flow rate data: {missing}. "
                    f"This usually means the aging report input file has incorrect or missing column headers. "
                    f"Please check your aging report input file and ensure all aging bucket columns are present, then re-run the flow rate calculation."
                )
            }

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
            .apply(lambda r: _offset_products_decimal(r.values, BUCKETS), axis=1)
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
        for c in BUCKETS:
            distribution_df[c] = pd.to_numeric(distribution_df[c], errors="coerce")
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
            weighted_rate = _sumproduct_decimal(tail_products, dist_weights)
            weighted_credit_loss.append(weighted_rate)

        # Build output DataFrame with date, tail products, monotonicity check, and weighted rate
        out = pd.concat([df[["date"]].reset_index(drop=True), bucket_vals.reset_index(drop=True)], axis=1)
        out["Strictly Increasing?"] = mono
        out["Weighted Credit Loss Rate per Month"] = weighted_credit_loss

        # Sort by date to ensure chronological order
        # Convert to datetime for sorting, then convert back to string format
        out['date'] = pd.to_datetime(out['date'])
        out = out.sort_values('date').reset_index(drop=True)
        # Convert date back to string format (YYYY-MM-DD) to avoid mixed types when adding "Average" row
        out['date'] = out['date'].dt.strftime('%Y-%m-%d')

        print('out.columns', out.columns)
        print('out \n', out)

        # Calculate averages for numeric columns (excluding 'date' and 'Strictly Increasing?')
        numeric_cols = [col for col in out.columns if col not in ['date', 'Strictly Increasing?']]
        
        # Create average row with mean values (excluding first month)
        avg_row = {'date': 'Average'}
        for col in numeric_cols:
            avg_row[col] = out[col].iloc[1:].mean()  # Exclude first month (index 0)
        avg_row['Strictly Increasing?'] = ''  # Empty for average row (not applicable)
        
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
        traceback.print_exc()
        return {
            'code': -1,
            'success': False,
            'msg': (
                f'An unexpected error occurred during aging bucket calculation. '
                f'Please verify that your aging report input file has the correct format and numeric data in all bucket columns, '
                f'then re-run the flow rate calculation before retrying. Detail: {e}'
            )
        }

def _to_decimal(v) -> Decimal | None:
    """
    Convert a value to Decimal safely.

    Notes:
    - Prefer Decimal(str(v)) to avoid importing binary-float artifacts.
    - Returns None for NaN / missing so callers can skip those entries.
    """
    if v is None:
        return None
    try:
        # Handle numpy/pandas NaN
        if isinstance(v, (float, np.floating)) and np.isnan(v):
            return None
    except Exception:
        pass
    try:
        return Decimal(str(v))
    except Exception:
        return None

def _quantize_decimal(x: Decimal, places: int = DECIMAL_PLACES) -> Decimal:
    q = Decimal(1).scaleb(-places)  # 1E-places
    return x.quantize(q, rounding=ROUND_HALF_UP)

def _safe_prod_nonzero_decimal(arr) -> Decimal:
    """
    Product of the non-zero, non-NaN values, computed with Decimal.

    Mimics Excel PRODUCT(IF(...)) behavior:
    - skips zeros and NaNs
    - returns 0 if no valid factors exist
    """
    with localcontext() as ctx:
        ctx.prec = DECIMAL_CONTEXT_PREC
        prod = Decimal(1)
        found = False
        for v in arr:
            dv = _to_decimal(v)
            if dv is None:
                continue
            if dv == 0:
                continue
            prod *= dv
            found = True
        return Decimal(0) if not found else prod

def _offset_products_decimal(row_vals, BUCKETS: list[str]) -> list[float]:
    """
    Decimal-based tail products, quantized to DECIMAL_PLACES, returned as floats.
    """
    out: list[float] = []
    for i in range(len(BUCKETS)):
        tail = _safe_prod_nonzero_decimal(row_vals[i:])
        tail_q = _quantize_decimal(tail)
        out.append(float(tail_q))
    return out

def _sumproduct_decimal(a_vals, b_vals) -> float:
    """
    Decimal SUMPRODUCT(a, b), quantized to DECIMAL_PLACES, returned as float.
    """
    with localcontext() as ctx:
        ctx.prec = DECIMAL_CONTEXT_PREC
        total = Decimal(0)
        for a, b in zip(a_vals, b_vals):
            da = _to_decimal(a)
            db = _to_decimal(b)
            if da is None or db is None:
                continue
            total += da * db
        return float(_quantize_decimal(total))

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