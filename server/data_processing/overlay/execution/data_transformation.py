import os
import warnings
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

import time
import re

from helpers.file_utils import find_and_read_data_file, get_root_folder, read_data_file


# ----------------------------- Utilities & Cleaning ----------------------------- #

def clean_numeric_like_series(s: pd.Series) -> pd.Series:
    """
    Parse a Series containing numeric values in various formats.
    
    Handles multiple numeric formats:
    - Standard numbers: "1,234.56" -> 1234.56
    - Negative in parentheses: "(1,234.56)" -> -1234.56
    - Percentages: "12%" -> 0.12
    - Empty/whitespace: " -  " -> NaN
    
    Args:
        s (pd.Series): Series with potentially formatted numeric strings
    
    Returns:
        pd.Series: Series with parsed numeric values (NaN for invalid entries)
    """
    s = s.astype(str).str.strip()
    # (1234) -> -1234
    s = s.str.replace(r'^\((.*)\)$', r'-\1', regex=True)
    # remove thousands separators
    s = s.str.replace(',', '', regex=False)

    # split percents vs non-percents
    is_percent = s.str.contains('%', na=False)
    # percents -> strip '%' then /100
    s_pct = s[is_percent].str.replace('%', '', regex=False)
    s_pct_num = pd.to_numeric(s_pct, errors='coerce') / 100.0
    # non-percents -> direct to_numeric
    s_nonpct_num = pd.to_numeric(s[~is_percent], errors='coerce')

    out = pd.concat([s_pct_num, s_nonpct_num]).sort_index()
    return out


def clean_percentage_data(df: pd.DataFrame, excluded_columns: list) -> pd.DataFrame:
    """
    Clean all numeric columns in a DataFrame using robust parsing.
    
    Applies clean_numeric_like_series() to all columns except those in excluded_columns.
    Handles percentages, parentheses for negatives, and thousands separators.
    Leaves non-numeric columns unchanged.
    
    Args:
        df (pd.DataFrame): DataFrame to clean
        excluded_columns (list): List of column names to skip
    
    Returns:
        pd.DataFrame: DataFrame with cleaned numeric columns
    """
    df = df.copy()
    for col in df.columns:
        if col in excluded_columns:
            continue
        try:
            df[col] = clean_numeric_like_series(df[col])
        except Exception:
            pass  # keep as-is if truly non-numeric
    return df


# ----------------------------- Merge & Prep ----------------------------- #

def combine_monthly_mev_data_interpolation(monthly_historical_mev_df: pd.DataFrame,
                                           data_interpolation_df: pd.DataFrame,
                                           final_models_df: pd.DataFrame) -> pd.DataFrame | None:
    """
    Combine monthly historical MEV data with interpolated data.
    
    This function:
    1. Left-joins data_interpolation_df with monthly_historical_mev_df on 'id' column
    2. Removes definition rows (indices 1 and 2) that contain metadata
    3. Cleans up merge artifacts (duplicate year/month columns)
    4. Reorders columns to put identifiers first
    
    Args:
        monthly_historical_mev_df (pd.DataFrame): Monthly historical MEV data
        data_interpolation_df (pd.DataFrame): Interpolated data with 'id' column
    
    Returns:
        pd.DataFrame | None: Combined DataFrame, or None if error occurs
    """
    try:
        df_interpolation = data_interpolation_df.copy()
        df_monthly = monthly_historical_mev_df.copy()
        final_models_df_copy = final_models_df.copy()

        # definition rows (first 2 rows) exist in both inputs; keep but will drop post-merge
        df_combined = pd.merge(df_interpolation, df_monthly, on='id', how='left')

        # df_combined.to_csv('df_combined.csv', index=False)

        # Drop definition rows at indices 1 and 2 (0-based)
        df_combined = df_combined.drop([1, 2], errors='ignore').reset_index(drop=True)

        # Clean merge artifacts safely
        df_combined = df_combined.drop(columns=[c for c in ['Date_y', 'month_x', 'year_y', 'month (int)_y'] if c in df_combined.columns], errors='ignore')
        rename_map = {}
        if 'year_x' in df_combined.columns: rename_map['year_x'] = 'year'
        if 'month_y' in df_combined.columns: rename_map['month_y'] = 'month'
        if 'month (int)_x' in df_combined.columns: rename_map['month (int)_x'] = 'month (int)'
        if 'Date_x' in df_combined.columns: rename_map['Date_x'] = 'Date'
        df_combined = df_combined.rename(columns=rename_map)

        # Extract year and month from 'id' column if they're missing (for periods beyond MEV data)
        if 'id' in df_combined.columns:
            month_map = {
                'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
                'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
            }
            # Fill missing year from id (format: "2025-Dec")
            if 'year' in df_combined.columns:
                mask_year = df_combined['year'].isna()
                if mask_year.any():
                    df_combined.loc[mask_year, 'year'] = pd.to_numeric(
                        df_combined.loc[mask_year, 'id'].str[:4], errors='coerce'
                    )
            # Fill missing month (int) from id
            if 'month (int)' in df_combined.columns:
                mask_month = df_combined['month (int)'].isna()
                if mask_month.any():
                    df_combined.loc[mask_month, 'month (int)'] = df_combined.loc[mask_month, 'id'].str[5:].map(month_map)

        # Reorder identifiers first if present
        id_cols = [c for c in ['year', 'month (int)', 'month', 'quarter', 'id', 'x'] if c in df_combined.columns]
        other_cols = [c for c in df_combined.columns if c not in id_cols]
        df_combined = df_combined[id_cols + other_cols]

        # Update 1/22/2026: use override_data_transformation_mevs_df instead of final_models_df_copy
        # get X1 column value from final_models_df_copy
        # get all values where column headers pattern are X1, X2, X3, and so on
        x_series = final_models_df_copy.filter(regex='^[Xx]\d+$').iloc[0]
        x_series = [str(v).strip() for v in x_series.tolist() if str(v).strip()]
        x_series = [col.split('.')[0] for col in x_series]

        print('x_series', x_series)

        def col_base_name(col: str) -> str:
            # take token before first dot/space
            token = re.split(r"[.\s]", str(col), maxsplit=1)[0]
            return token
        
        x_set = set(x_series)

        # get columns that have the x_series values in the column headers
        x_series_cols = [
            col for col in df_combined.columns
            if col_base_name(col) in x_set
        ]

        print('x_series_cols', x_series_cols)

        # Get row 0 of override_data_transformation_mevs_df
        # get only colmns with Upside and Downside
        # cols = [
        #     c for c in final_models_df_copy.columns
        #     if c.lower().startswith(("upside", "downside", "base"))
        # ]
        # cols = [
        #     c.replace("Upside ", "")
        #     .replace("Base ", "")
        #     .replace("Downside ", "")
        #     for c in cols
        # ]

        # deduplicate while preserving order
        # x_series_cols = list(dict.fromkeys(cols))

        # x_series_cols = [
        #     col for col in df_combined.columns
        #     if col_base_name(col) in x_series_cols
        # ]
        
        # print('x_series_cols', x_series_cols)
        final_cols = ['Date', 'year', 'month (int)', 'month', 'id', 'x'] + x_series_cols
        print(f"final_cols: {final_cols}")
        final_col = df_combined[final_cols]

        final_col.to_csv('final_col.csv', index=False)
        return final_col

    except Exception as e:
        print(f"Error during combination: {str(e)}")
        import traceback; traceback.print_exc()
        return None


def prepare_independent_variables(df: pd.DataFrame, excluded_columns: list) -> pd.DataFrame:
    """
    Prepare independent variables DataFrame for transformation.
    
    This function:
    1. Creates 'Time' column from 'year' and 'month (int)' as YYYY-MM format
    2. Removes first 2 rows (definition/metadata rows)
    3. Cleans all numeric columns using clean_percentage_data()
    
    Args:
        df (pd.DataFrame): Raw independent variables DataFrame
        excluded_columns (list): Columns to exclude from cleaning
    
    Returns:
        pd.DataFrame: Prepared DataFrame with Time column and cleaned numerics
    
    Raises:
        ValueError: If required columns for Time creation are missing
    """
    print("Preparing independent variables...")
    x_raw = df.copy()

    # Time as YYYY-MM from year + month (int)
    if 'year' in x_raw.columns and 'month (int)' in x_raw.columns:
        x_raw['Time'] = pd.to_datetime({
            'year':  pd.to_numeric(x_raw['year'], errors='coerce'),
            'month': pd.to_numeric(x_raw['month (int)'], errors='coerce'),
            'day':   1
        }, errors='coerce').dt.strftime('%Y-%m')
    elif 'Time' not in x_raw.columns:
        raise ValueError("Cannot create Time column: missing 'year' and 'month (int)'.")

    # Remove first 2 definition rows
    # x_raw = x_raw.iloc[2:].reset_index(drop=True)

    # Clean numerics
    x_raw = clean_percentage_data(x_raw, excluded_columns)

    return x_raw


def add_level_gr_columns(x_raw: pd.DataFrame, excluded_columns: list) -> pd.DataFrame:
    """
    Add .Level and .GR (Year-over-Year growth) columns for each raw variable.
    
    For each base variable (without dot suffixes), creates:
    - {var}.Level: The level value itself (same as raw variable)
    - {var}.GR: Year-over-year growth rate = (current / value_12_months_ago) - 1
    
    For execution data with forecast suffixes, extracts base variable names and creates
    .Level/.GR columns using the "Point Forecast" column if available, otherwise the first matching column.
    
    Only creates columns if they don't already exist. This mirrors R pipeline
    behavior where .Level/.GR columns may already exist.
    
    Args:
        x_raw (pd.DataFrame): DataFrame with raw independent variables
        excluded_columns (list): Columns to exclude from processing
    
    Returns:
        pd.DataFrame: DataFrame with added .Level and .GR columns
    """
    x = x_raw.copy()
    # Extract base variable names from all columns (including those with forecast suffixes)
    all_cols = [c for c in x.columns if c not in excluded_columns and c.lower() not in ('time',)]
    base_var_to_cols = {}
    
    for col in all_cols:
        if '.' in col:
            # Extract base variable name (part before first dot)
            base_var = col.split('.')[0]
            if base_var not in base_var_to_cols:
                base_var_to_cols[base_var] = []
            base_var_to_cols[base_var].append(col)
        else:
            # Column without dots is itself a base variable
            if col not in base_var_to_cols:
                base_var_to_cols[col] = []
            base_var_to_cols[col].append(col)
    
    # Create .Level and .GR columns for each base variable
    for base_var, matching_cols in base_var_to_cols.items():
        # Prefer "Point Forecast" column if available, otherwise use first column
        preferred_col = None
        for col in matching_cols:
            if 'Point Forecast' in col:
                preferred_col = col
                break
        if not preferred_col and matching_cols:
            preferred_col = matching_cols[0]
        
        if preferred_col:
            base = pd.to_numeric(x[preferred_col], errors='coerce')
            # Use preferred_col (which may have forecast suffix) instead of base_var
            # This preserves forecast suffixes like "Point Forecast" in the .Level and .GR columns
            lvl_col = insert_transformation_suffix(preferred_col, ".Level")
            gr_col  = insert_transformation_suffix(preferred_col, ".GR")
            if lvl_col not in x.columns:
                x[lvl_col] = base
            if gr_col not in x.columns:
                x[gr_col] = base / base.shift(12) - 1
    
    return x


def prepare_dependent_variables(df: pd.DataFrame, excluded_columns: list) -> pd.DataFrame:
    """
    Prepare dependent variables DataFrame for transformation.
    
    This function:
    1. Cleans all numeric columns using clean_percentage_data()
    2. Clips the first non-excluded dependent variable:
       - 0 -> 0.001 (to avoid logit issues at boundary)
       - 1 -> 0.99999 (to avoid logit issues at boundary)
    3. Creates 'Time' column from 'time' column as YYYY-MM format
    
    Args:
        df (pd.DataFrame): Raw dependent variables DataFrame
        excluded_columns (list): Columns to exclude from processing
    
    Returns:
        pd.DataFrame: Prepared DataFrame with Time column and clipped dependent variable
    
    Raises:
        ValueError: If no dependent variable column found or 'time' column missing
    """
    print("Preparing dependent variables...")
    y_raw = df.copy()

    y_raw = clean_percentage_data(y_raw, excluded_columns)

    # Select target by position like R's y_raw[,2]
    candidates = [c for c in y_raw.columns if c not in excluded_columns and c.lower() != 'time']
    if not candidates:
        raise ValueError("No dependent variable column found.")
    target = candidates[0]

    y_raw[target] = y_raw[target].replace(0, 0.001).replace(1, 0.99999)

    # Time column (expects a 'time' column with parseable dates)
    if 'time' in y_raw.columns:
        y_raw['Time'] = pd.to_datetime(y_raw['time'], errors='coerce').dt.strftime('%Y-%m')
    elif 'Time' not in y_raw.columns:
        raise ValueError("Dependent data missing 'time' column to derive 'Time'.")

    return y_raw


# ----------------------------- Transformations ----------------------------- #

def insert_transformation_suffix(col_name: str, transform_suffix: str) -> str:
    """
    Insert transformation suffix before forecast suffixes and growth_rate.
    
    Forecast suffixes: "Point Forecast", "Lo 80", "Hi 80", "Lo 95", "Hi 95"
    Growth rate suffix: "growth_rate"
    Transformation suffixes: ".Level", ".GR", ".ln", ".asinh", ".diff_12", ".lag_N"
    
    Examples:
    - "gdp.Point Forecast" + ".ln" → "gdp.ln.Point Forecast"
    - "gdp.Point Forecast growth_rate" + ".ln" → "gdp.ln.Point Forecast growth_rate"
    - "gdp.Lo 80" + ".diff_12" → "gdp.diff_12.Lo 80"
    - "gdp" + ".ln" → "gdp.ln" (if no forecast suffix)
    - "quarter.Level growth_rate" + ".diff_12" → "quarter.Level.diff_12 growth_rate"
    - "gdp.Point Forecast growth_rate" + ".diff_12" → "gdp.Point Forecast.diff_12 growth_rate"
    
    Args:
        col_name (str): Original column name
        transform_suffix (str): Transformation suffix to insert (e.g., ".ln", ".asinh", ".diff_12", ".lag_3")
    
    Returns:
        str: Column name with transformation suffix inserted in correct position
    """
    # Check if transformation already exists to avoid duplicates
    if transform_suffix in col_name:
        # Check if it's already properly placed (not just a substring match)
        # For example, ".diff_12" should not match "diff_1" in "diff_12"
        if f"{transform_suffix}." in col_name or col_name.endswith(transform_suffix):
            return col_name  # Already has this transformation
    
    forecast_suffixes = ["Point Forecast", "Lo 80", "Hi 80", "Lo 95", "Hi 95"]
    
    # Check if column has growth_rate suffix
    has_growth_rate = col_name.endswith(" growth_rate")
    base_col = col_name[:-13] if has_growth_rate else col_name  # Remove " growth_rate"
    
    # Find which forecast suffix exists (if any) - check from longest to shortest to avoid partial matches
    forecast_suffix = None
    forecast_suffix_pos = -1
    for fs in sorted(forecast_suffixes, key=len, reverse=True):
        pattern = f".{fs}"
        pos = base_col.find(pattern)
        if pos != -1:
            forecast_suffix = fs
            forecast_suffix_pos = pos
            break
    
    if forecast_suffix:
        # Split at the forecast suffix position
        base_var = base_col[:forecast_suffix_pos]  # Everything before ".Point Forecast" etc.
        # Insert transformation suffix: base_var + transform + forecast
        new_name = f"{base_var}{transform_suffix}.{forecast_suffix}"
    else:
        # No forecast suffix, just append transformation to the end
        new_name = f"{base_col}{transform_suffix}"
    
    # Add back growth_rate if it was present
    if has_growth_rate:
        new_name = f"{new_name} growth_rate"
    
    return new_name


def apply_transformations_to_independent_variables(x_raw: pd.DataFrame,
                                                   x_raw_vars: list,
                                                   excluded_columns: list) -> pd.DataFrame:
    """
    Apply comprehensive transformations to independent variables.
    
    This function creates multiple transformed versions of variables:
    1. Log transformation (.ln): Applied to variables with strictly positive minimum
    2. Inverse hyperbolic sine (.asinh): Applied to variables with non-positive values
    3. 12-month differencing (.diff_12): Applied to ALL columns (raw + transformed)
    4. Lag transformations (.lag_3, .lag_6, .lag_9, .lag_12): Applied to ALL columns
    
    Transformations are applied sequentially, so later transformations can use
    earlier transformed columns (e.g., diff_12 can be applied to .ln columns).
    
    Args:
        x_raw (pd.DataFrame): DataFrame with raw independent variables
        x_raw_vars (list): List of raw variable names (base variables without suffixes)
        excluded_columns (list): Columns to exclude from transformation
    
    Returns:
        pd.DataFrame: DataFrame with all transformed columns added
    """
    print("Applying transformations to independent variables...")
    x_transformed = x_raw.copy()

    # ln
    print("Applying log transformations...")
    # For execution data, we need to find columns that match each base variable
    # If base_var is "gdp", find columns like "gdp.Point Forecast", "gdp.Lo 80", etc.
    for base_var in x_raw_vars:
        # Find all columns that start with this base variable name (with dot) or exactly match it
        matching_cols = [c for c in x_raw.columns if c.startswith(f"{base_var}.") or c == base_var]
        for var in matching_cols:
            try:
                s = pd.to_numeric(x_raw[var], errors='coerce')
                if not s.isna().all() and s.min(skipna=True) > 0:
                    new_col_name = insert_transformation_suffix(var, ".ln")
                    x_transformed[new_col_name] = np.log(s)
            except Exception as e:
                print(f"  ln skip {var}: {e}")

    # asinh
    print("Applying asinh transformations...")
    for base_var in x_raw_vars:
        # Find all columns that start with this base variable name (with dot) or exactly match it
        matching_cols = [c for c in x_raw.columns if c.startswith(f"{base_var}.") or c == base_var]
        for var in matching_cols:
            try:
                s = pd.to_numeric(x_raw[var], errors='coerce')
                if not s.isna().all() and s.min(skipna=True) <= 0:
                    new_col_name = insert_transformation_suffix(var, ".asinh")
                    x_transformed[new_col_name] = np.arcsinh(s)
            except Exception as e:
                print(f"  asinh skip {var}: {e}")

    # diff_12 on ALL non-excluded
    print("Applying differencing transformations...")
    all_vars_to_diff = [c for c in x_transformed.columns if c not in excluded_columns]
    for col in all_vars_to_diff:
        try:
            s = pd.to_numeric(x_transformed[col], errors='coerce')
            if not s.isna().all():
                new_col_name = insert_transformation_suffix(col, ".diff_12")
                x_transformed[new_col_name] = s - s.shift(12)
        except Exception as e:
            print(f"  diff_12 skip {col}: {e}")

    # lags on ALL non-excluded
    print("Applying lag transformations...")
    lag_periods = [3, 6, 9, 12]
    all_vars_to_lag = [c for c in x_transformed.columns if c not in excluded_columns]
    for col in all_vars_to_lag:
        s = pd.to_numeric(x_transformed[col], errors='coerce')
        if s.isna().all():
            continue
        for lag in lag_periods:
            try:
                new_col_name = insert_transformation_suffix(col, f".lag_{lag}")
                x_transformed[new_col_name] = s.shift(lag)
            except Exception as e:
                print(f"  lag_{lag} skip {col}: {e}")

    all_transformed_vars = [c for c in x_transformed.columns if c not in excluded_columns]
    print(f"Total transformed variables: {len(all_transformed_vars)}")
    print(f"Sample transformed variables: {all_transformed_vars[:10]}")
    return x_transformed


def apply_transformations_to_dependent_variables(y_raw: pd.DataFrame, y_raw_vars: list) -> pd.DataFrame:
    """
    Apply logit transformation to dependent variables.
    
    Creates .logit columns for each dependent variable in y_raw_vars.
    Logit transformation: logit(p) = ln(p / (1 - p))
    Used to convert probabilities/rates from [0,1] to (-∞, +∞) for linear regression.
    
    Args:
        y_raw (pd.DataFrame): DataFrame with raw dependent variables
        y_raw_vars (list): List of dependent variable names to transform
    
    Returns:
        pd.DataFrame: DataFrame with .logit columns added
    """
    print("Applying transformations to dependent variables...")
    y_transformed = y_raw.copy()
    for var in y_raw_vars:
        try:
            s = pd.to_numeric(y_raw[var], errors='coerce')
            if not s.isna().all():
                new_col_name = insert_transformation_suffix(var, ".logit")
                y_transformed[new_col_name] = np.log(s / (1 - s))
        except Exception as e:
            print(f"  logit skip {var}: {e}")
    return y_transformed


# ----------------------------- ADF & Correlation ----------------------------- #

def perform_adf_tests(x_transformed: pd.DataFrame,
                      y_transformed: pd.DataFrame,
                      excluded_columns: list,
                      output_dir: str,
                      workflow,
                      _date_time: str,
                      docs: list):
    """
    Perform Augmented Dickey-Fuller (ADF) tests for stationarity.
    
    ADF tests check if time series are stationary (no unit root). Stationary series
    are required for reliable regression analysis. Tests are performed on all
    transformed independent and dependent variables.
    
    Args:
        x_transformed (pd.DataFrame): Transformed independent variables
        y_transformed (pd.DataFrame): Transformed dependent variables
        excluded_columns (list): Columns to exclude from testing
        output_dir (str): Directory to save ADF test results
        workflow: Workflow object (for portfolio name)
        _date_time (str): Timestamp for output filenames
        docs (list): List to append output filenames to
    
    Returns:
        tuple: (adf_df_x, adf_df_y) DataFrames with test results (p-value, statistic)
    """
    def adf_tester(series, alt_hyp="stationary", lag_order=None, trend='c'):
        try:
            s = pd.to_numeric(pd.Series(series), errors='coerce').dropna()
            if len(s) < 4:
                return {"p.value": float('inf'), "statistic": float('inf')}
            if lag_order is None:
                lag_order = int((len(s) - 1) ** (1/3))
            lag_order = max(0, min(lag_order, len(s) - 2))
            stat, pval, *_ = adfuller(
                s.values,
                maxlag=lag_order,
                regression=trend,
                autolag=None
            )
            return {"p.value": float(pval), "statistic": float(stat)}
        except Exception:
            return {"p.value": np.inf, "statistic": np.inf}

    print("Performing ADF tests...")

    x_vars_for_adf = [c for c in x_transformed.columns if c not in excluded_columns and c.lower() != 'time']
    y_vars_for_adf = [c for c in y_transformed.columns if c not in excluded_columns and c.lower() != 'time']

    adf_df_x = pd.DataFrame([
        {"var_name": var, **adf_tester(x_transformed[var])} for var in x_vars_for_adf
    ])
    adf_df_x.to_csv(f"{output_dir}/{workflow.loan_product}_ADF_test_x_{_date_time}.csv", index=False)
    docs.append(f"{workflow.loan_product}_ADF_test_x_{_date_time}.csv")

    adf_df_y = pd.DataFrame([
        {"var_name": var, **adf_tester(y_transformed[var])} for var in y_vars_for_adf
    ])
    adf_df_y.to_csv(f"{output_dir}/{workflow.loan_product}_ADF_test_y_{_date_time}.csv", index=False)
    docs.append(f"{workflow.loan_product}_ADF_test_y_{_date_time}.csv")

    return adf_df_x, adf_df_y


def compute_correlation_matrix(x_transformed: pd.DataFrame,
                               excluded_columns: list,
                               output_dir: str,
                               workflow,
                               _date_time: str,
                               docs: list) -> pd.DataFrame:
    """
    Compute Pearson correlation matrix for independent variables.
    
    Calculates pairwise correlations between all numeric independent variables.
    Used to identify multicollinearity and compute max_abs_cor for combinations.
    Uses pairwise complete observations (drops NaN pairs).
    
    Args:
        x_transformed (pd.DataFrame): Transformed independent variables
        excluded_columns (list): Columns to exclude from correlation
        output_dir (str): Directory to save correlation matrix
        workflow: Workflow object (for portfolio name)
        _date_time (str): Timestamp for output filename
        docs (list): List to append output filename to
    
    Returns:
        pd.DataFrame: Correlation matrix (symmetric, values in [-1, 1])
    """
    print("Computing correlation matrix...")
    X = x_transformed.drop(columns=excluded_columns, errors='ignore')
    X = X.select_dtypes(include=[np.number])  # numeric only
    print(f"Correlation numeric columns: {X.shape[1]}")
    x_cor_mat = X.corr(method='pearson')  # pairwise by default

    cor_df = pd.DataFrame(x_cor_mat)
    cor_df.index.name = "name"
    cor_df.to_csv(f"{output_dir}/{workflow.loan_product}_x_cor_mat_{_date_time}.csv")
    docs.append(f"{workflow.loan_product}_x_cor_mat_{_date_time}.csv")
    return x_cor_mat


# ----------------------------- Combinations ----------------------------- #

def generate_variable_combinations(base_var_to_actual_cols: dict,
                                   x_transformed: pd.DataFrame,
                                   excluded_columns: list,
                                   cancellation_check=None) -> list[list[str]]:
    """
    Generate all valid variable combinations with transformations using actual column names.
    
    This function creates all possible 2-variable combinations by:
    1. Starting with base variable combinations (C(n,2) for n base vars)
    2. Finding actual columns that match Level/GR patterns: "", ".Level", ".GR" for each variable
    3. Finding actual columns that match transformation patterns: "", ".ln", ".asinh" for each variable
    4. Finding actual columns that match differencing patterns: "", ".diff_12" for each variable
    5. Finding actual columns that match lag patterns: "", ".lag_3", ".lag_6", ".lag_9", ".lag_12" for each
    
    Only combinations where all variables exist in x_transformed are kept.
    Supports cancellation checks during processing.
    
    Args:
        base_var_to_actual_cols (dict): Dictionary mapping base variable names to lists of actual column names
                                         e.g., {"gdp": ["gdp.Point Forecast", "gdp.Point Forecast.Level", ...], ...}
        x_transformed (pd.DataFrame): DataFrame with all transformed columns
        excluded_columns (list): Columns to exclude
        cancellation_check (callable, optional): Function returning True to cancel
    
    Returns:
        list[list[str]]: List of 2-variable combinations (each is a list of 2 actual column names)
    
    Raises:
        Exception: If cancellation_check returns True
    """
    print("Generating variable combinations...")

    # NEW: Get base variables from the mapping keys
    x_base_vars = sorted(list(base_var_to_actual_cols.keys()))
    print('x_base_vars', x_base_vars)
    print(f"Base variables: {len(x_base_vars)}")
    
    # OLD: base names (raw should not have '.')
    # x_base_vars = list(set([v.split('.')[0] for v in x_raw_vars]))

    num_vars_taken = 2
    comb_no_lags = list(combinations(x_base_vars, num_vars_taken))
    comb_extended = [list(c) for c in comb_no_lags]
    print(f"Base combinations: {len(comb_extended)}")

    # Helper function to find actual columns matching a suffix pattern
    def find_matching_cols(base_var: str, suffix: str) -> list[str]:
        """Find actual columns for a base variable that match the given suffix pattern."""
        if base_var not in base_var_to_actual_cols:
            return []
        actual_cols = base_var_to_actual_cols[base_var]
        if suffix == "":
            # For empty suffix, find columns that are the base variable itself or don't have .Level/.GR
            # Prefer columns without .Level or .GR (raw columns)
            raw_cols = [c for c in actual_cols if not c.endswith('.Level') and not c.endswith('.GR')]
            if raw_cols:
                return raw_cols
            # Fallback to any column starting with base_var
            return [c for c in actual_cols if c.startswith(base_var + '.') or c == base_var]
        else:
            # For specific suffix, find columns ending with that suffix
            return [c for c in actual_cols if c.endswith(suffix)]

    # Level/GR
    print("Applying Level/GR permutations...")
    if cancellation_check and cancellation_check():
        raise Exception("Job cancelled")
    
    level_gr_options = ["", ".Level", ".GR"]
    level_gr_perms = list(product(level_gr_options, repeat=num_vars_taken))

    new_ext = []
    for idx, base_comb in enumerate(comb_extended):
        if cancellation_check and idx % 100 == 0 and cancellation_check():
            raise Exception("Job cancelled")
        for p in level_gr_perms:
            # NEW: Find actual columns matching the suffix pattern for each base variable
            matching_cols_list = [find_matching_cols(base_comb[i], p[i]) for i in range(num_vars_taken)]
            # Create combinations from matching columns (use first match for each, or all combinations)
            if all(len(cols) > 0 for cols in matching_cols_list):
                # Use first matching column for each base variable
                names = [matching_cols_list[i][0] for i in range(num_vars_taken)]
                # Early filtering: only append if all columns exist
                if all(v in x_transformed.columns for v in names):
                    new_ext.append(names)
    
    # OLD: Construct names by appending suffix
    # for p in level_gr_perms:
    #     names = [base_comb[i] + p[i] for i in range(num_vars_taken)]
    #     new_ext.append(names)
    
    comb_extended = new_ext
    print(f"Valid Level/GR combinations: {len(comb_extended)}")
    if not comb_extended:
        print("No valid Level/GR combinations; check .Level/.GR creation.")

    # Transformations
    print("Applying transformation permutations...")
    if cancellation_check and cancellation_check():
        raise Exception("Job cancelled")
    
    trans_options = ["", ".ln", ".asinh"]
    trans_perms = list(product(trans_options, repeat=num_vars_taken))

    new_ext = []
    for idx, base_comb in enumerate(comb_extended):
        if cancellation_check and idx % 100 == 0 and cancellation_check():
            raise Exception("Job cancelled")
        for p in trans_perms:
            # NEW: For each column in the combination, find actual columns matching the transformation suffix
            matching_combos = []
            for i, col in enumerate(base_comb):
                trans_suffix = p[i]
                if trans_suffix == "":
                    # No transformation, use the column as-is
                    matching_combos.append([col])
                else:
                    # Use insert_transformation_suffix to properly construct the column name
                    # This handles forecast suffixes correctly (e.g., "gdp.Point Forecast.Level" + ".ln")
                    target_col = insert_transformation_suffix(col, trans_suffix)
                    if target_col in x_transformed.columns:
                        matching_combos.append([target_col])
                    else:
                        matching_combos.append([])
            
            # Create combinations from matching columns
            if all(len(cols) > 0 for cols in matching_combos):
                names = [matching_combos[i][0] for i in range(num_vars_taken)]
                # Early filtering: only append if all columns exist (already checked above, but explicit for consistency)
                if all(v in x_transformed.columns for v in names):
                    new_ext.append(names)
    
    # OLD: Construct names by appending transformation suffix
    # for p in trans_perms:
    #     names = [base_comb[i] + p[i] for i in range(num_vars_taken)]
    #     new_ext.append(names)
    
    comb_extended = new_ext
    print(f"Valid transformation combinations: {len(comb_extended)}")

    # Differencing
    print("Applying differencing permutations...")
    if cancellation_check and cancellation_check():
        raise Exception("Job cancelled")
    
    diff_options = ["", ".diff_12"]
    diff_perms = list(product(diff_options, repeat=num_vars_taken))

    new_ext = []
    for idx, base_comb in enumerate(comb_extended):
        if cancellation_check and idx % 100 == 0 and cancellation_check():
            raise Exception("Job cancelled")
        for p in diff_perms:
            # NEW: For each column in the combination, find actual columns matching the differencing suffix
            matching_combos = []
            for i, col in enumerate(base_comb):
                diff_suffix = p[i]
                if diff_suffix == "":
                    # No differencing, use the column as-is
                    matching_combos.append([col])
                else:
                    # Use insert_transformation_suffix to properly construct the column name
                    # This handles forecast suffixes correctly (e.g., "gdp.Point Forecast.Level.ln" + ".diff_12")
                    target_col = insert_transformation_suffix(col, diff_suffix)
                    if target_col in x_transformed.columns:
                        matching_combos.append([target_col])
                    else:
                        matching_combos.append([])
            
            # Create combinations from matching columns
            if all(len(cols) > 0 for cols in matching_combos):
                names = [matching_combos[i][0] for i in range(num_vars_taken)]
                # Early filtering: only append if all columns exist (already checked above, but explicit for consistency)
                if all(v in x_transformed.columns for v in names):
                    new_ext.append(names)
    
    # OLD: Construct names by appending differencing suffix
    # for p in diff_perms:
    #     names = [base_comb[i] + p[i] for i in range(num_vars_taken)]
    #     new_ext.append(names)
    
    comb_extended = new_ext
    print(f"Valid differencing combinations: {len(comb_extended)}")

    # Lags
    print("Applying lag permutations...")
    if cancellation_check and cancellation_check():
        raise Exception("Job cancelled")
    
    lag_options = ["", ".lag_3", ".lag_6", ".lag_9", ".lag_12"]
    lag_perms = list(product(lag_options, repeat=num_vars_taken))

    new_ext = []
    for idx, base_comb in enumerate(comb_extended):
        if cancellation_check and idx % 100 == 0 and cancellation_check():
            raise Exception("Job cancelled")
        for p in lag_perms:
            # NEW: For each column in the combination, find actual columns matching the lag suffix
            matching_combos = []
            for i, col in enumerate(base_comb):
                lag_suffix = p[i]
                if lag_suffix == "":
                    # No lag, use the column as-is
                    matching_combos.append([col])
                else:
                    # Use insert_transformation_suffix to properly construct the column name
                    # This handles forecast suffixes correctly (e.g., "gdp.Point Forecast.Level.ln.diff_12" + ".lag_3")
                    target_col = insert_transformation_suffix(col, lag_suffix)
                    if target_col in x_transformed.columns:
                        matching_combos.append([target_col])
                    else:
                        matching_combos.append([])
            
            # Create combinations from matching columns
            if all(len(cols) > 0 for cols in matching_combos):
                names = [matching_combos[i][0] for i in range(num_vars_taken)]
                # Early filtering: only append if all columns exist (already checked above, but explicit for consistency)
                if all(v in x_transformed.columns for v in names):
                    new_ext.append(names)
    
    # OLD: Construct names by appending lag suffix
    # for p in lag_perms:
    #     names = [base_comb[i] + p[i] for i in range(num_vars_taken)]
    #     new_ext.append(names)
    
    comb_extended = new_ext
    print(f"Valid lag combinations: {len(comb_extended)}")

    print(f"Generated {len(comb_extended)} total valid combinations")
    return comb_extended


# ----------------------------- Max-corr for combos ----------------------------- #

def process_combination_with_cor_mat(cor_mat: pd.DataFrame, combination: list[str]) -> tuple[list[str], float]:
    """
    Compute maximum absolute correlation for a variable combination.
    
    Extracts the correlation submatrix for the combination and finds the maximum
    absolute correlation among off-diagonal elements. Used to identify multicollinearity.
    
    Args:
        cor_mat (pd.DataFrame): Full correlation matrix
        combination (list[str]): List of variable names in the combination
    
    Returns:
        tuple: (combination, max_abs_cor) where max_abs_cor is the maximum absolute
               correlation, or NaN if variables are missing or computation fails
    """
    try:
        missing = [v for v in combination if v not in cor_mat.index]
        if missing:
            return combination, np.nan
        sub = cor_mat.loc[combination, combination]
        if sub.empty or sub.shape[0] != len(combination):
            return combination, np.nan

        # off-diagonal
        mask = np.ones_like(sub, dtype=bool)
        np.fill_diagonal(mask, False)
        off = sub.where(mask).stack().dropna()
        if off.empty:
            return combination, np.nan

        max_cor = np.abs(off).max()
        if pd.isna(max_cor) or np.isinf(max_cor):
            return combination, np.nan
        return combination, float(max_cor)

    except Exception:
        return combination, np.nan


def compute_correlations_for_combinations(all_combinations: list[list[str]],
                                          x_cor_mat: pd.DataFrame,
                                          num_vars_taken: int,
                                          cancellation_check=None) -> pd.DataFrame:
    """
    Compute maximum absolute correlations for all variable combinations in parallel.
    
    Processes combinations in batches using multiprocessing to compute max_abs_cor
    for each combination. Supports cancellation checks between batches.
    
    Args:
        all_combinations (list[list[str]]): List of variable combinations
        x_cor_mat (pd.DataFrame): Correlation matrix for all variables
        num_vars_taken (int): Number of variables per combination (typically 2)
        cancellation_check (callable, optional): Function returning True to cancel
    
    Returns:
        pd.DataFrame: DataFrame with columns X1, X2, ..., Xk, max_abs_cor
    
    Raises:
        Exception: If cancellation_check returns True
    """
    print("Computing maximum correlations for all combinations...")
    if not all_combinations:
        return pd.DataFrame(columns=[f"X{i+1}" for i in range(num_vars_taken)] + ["max_abs_cor"])

    num_cores = max(1, cpu_count())
    print(f"Using {num_cores} CPU cores for parallel processing")

    # Process in batches to allow cancellation checks
    batch_size = max(1000, len(all_combinations) // 10)  # Process in batches
    all_results = []
    
    for i in range(0, len(all_combinations), batch_size):
        # Check for cancellation before each batch
        if cancellation_check and cancellation_check():
            raise Exception("Job cancelled")
        
        batch = all_combinations[i:i + batch_size]
        print(f"Processing batch {i // batch_size + 1}/{(len(all_combinations) + batch_size - 1) // batch_size} ({len(batch)} combinations)")
        
        with Pool(processes=num_cores) as pool:
            process_func = partial(process_combination_with_cor_mat, x_cor_mat)
            batch_results = pool.map(process_func, batch)
        
        all_results.extend(batch_results)

    print(f"Processed {len(all_results)} combinations")

    rows = []
    for comb, max_cor in all_results:
        row = {f"X{i+1}": comb[i] for i in range(num_vars_taken)}
        row["max_abs_cor"] = max_cor
        rows.append(row)
    all_comb_df = pd.DataFrame(rows)
    print(f"Correlation results: {all_comb_df['max_abs_cor'].notna().sum()} valid, {all_comb_df['max_abs_cor'].isna().sum()} NaN")
    return all_comb_df


# ----------------------------- Orchestration ----------------------------- #

def process_data_transformation_output(combine_monthly_mev_data_interpolation_df: pd.DataFrame,
                                       historical_default_rate_df: pd.DataFrame,
                                       workflow,
                                       progress_callback=None,
                                       cancellation_check=None,
                                       num_combinations: int = 2):
    """
    Execute the complete data transformation pipeline.
    
    This function orchestrates the full data transformation process:
    1. Prepare independent and dependent variables (clean, add Time, add .Level/.GR)
    2. Apply transformations (ln, asinh, diff_12, lags for X; logit for Y)
    3. Save transformed data files
    4. Perform ADF tests for stationarity
    5. Compute correlation matrix
    6. Generate all variable combinations
    7. Compute max_abs_cor for each combination
    8. Save combinations file with correlations
    
    Supports progress tracking and cancellation checks throughout.
    
    Args:
        combine_monthly_mev_data_interpolation_df (pd.DataFrame): Combined MEV/interpolation data
        historical_default_rate_df (pd.DataFrame): Historical default rate data
        workflow: Workflow object (for entity, reporting_period, workflow_name, loan_product)
        progress_callback (callable, optional): Function(progress%, message) for updates
        cancellation_check (callable, optional): Function returning True to cancel
        num_combinations (int): Number of variables per combination (default: 2)
    
    Returns:
        dict: Dictionary with 'docs' (list of output filenames) and 'file_path' (output directory)
    
    Raises:
        Exception: If cancellation_check returns True
    """
    # print('combine_monthly_mev_data_interpolation_df', combine_monthly_mev_data_interpolation_df)
    # combine_monthly_mev_data_interpolation_df.to_csv('combine_monthly_mev_data_interpolation_df.csv', index=False)
    print('historical_default_rate_df', historical_default_rate_df)
    _date_time = get_time_date()

    docs = []

    output_dir = (
        f"{get_root_folder()}/server/files/"
        f"{workflow.entity}/"
        f"{workflow.reporting_period}/"
        f"{workflow.workflow_name}/"
        f"output/overlay/execution/{workflow.loan_product}/data_transformation"
    )
    os.makedirs(output_dir, exist_ok=True)

    # 1) Prep
    if progress_callback:
        progress_callback(25, "Preparing independent and dependent variables...")
    if cancellation_check and cancellation_check():
        raise Exception("Job cancelled")
    
    x_raw = prepare_independent_variables(combine_monthly_mev_data_interpolation_df, excluded_columns)
    # x_raw = add_level_gr_columns(x_raw, excluded_columns)  # NEW: provide .Level and .GR
    y_raw = prepare_dependent_variables(historical_default_rate_df, excluded_columns)

    # Extract base variable names from all columns (including those with forecast suffixes)
    # For columns with dots, take the part before the first dot as the base variable name
    # For columns without dots, use the column name as-is
    all_x_cols = [c for c in x_raw.columns if c not in excluded_columns and c.lower() not in ['time', 'period']]
    x_base_var_set = set()
    for col in all_x_cols:
        if '.' in col:
            # Extract base variable name (part before first dot)
            base_var = col.split('.')[0]
            x_base_var_set.add(base_var)
        else:
            # Column without dots is itself a base variable
            x_base_var_set.add(col)
    
    # Convert to list for x_raw_vars (used for transformations)
    # Note: For execution data with forecast suffixes, we use base variable names
    x_raw_vars = sorted(list(x_base_var_set))
    y_raw_vars = [c for c in y_raw.columns if c not in excluded_columns and c.lower() != 'time']

    print(f"Loaded {len(x_raw_vars)} independent raw variables and {len(y_raw_vars)} dependent variables")
    print(f"Base variable names: {x_raw_vars[:10]}...")  # Show first 10 for debugging

    # 2) Transforms
    if progress_callback:
        progress_callback(35, "Applying transformations to variables...")
    if cancellation_check and cancellation_check():
        raise Exception("Job cancelled")
    
    x_transformed = apply_transformations_to_independent_variables(x_raw, x_raw_vars, excluded_columns)
    y_transformed = apply_transformations_to_dependent_variables(y_raw, y_raw_vars)

    # 3) Save transformed
    if progress_callback:
        progress_callback(45, "Saving transformed data...")
    if cancellation_check and cancellation_check():
        raise Exception("Job cancelled")
    
    x_out = f"{output_dir}/{workflow.loan_product}_Independent - Transformed with Time_{_date_time}.csv"
    y_out = f"{output_dir}/{workflow.loan_product}_Dependent - Transformed with Time_{_date_time}.csv"
    x_transformed.to_csv(x_out, index=False); docs.append(os.path.basename(x_out))
    y_transformed.to_csv(y_out, index=False); docs.append(os.path.basename(y_out))

    # 4) ADF + Corr
    if progress_callback:
        progress_callback(50, "Performing ADF tests and computing correlation matrix...")
    if cancellation_check and cancellation_check():
        raise Exception("Job cancelled")
    
    perform_adf_tests(x_transformed, y_transformed, excluded_columns, output_dir, workflow, _date_time, docs)
    x_cor_mat = compute_correlation_matrix(x_transformed, excluded_columns, output_dir, workflow, _date_time, docs)

    # 5) Extract actual column names grouped by base variable (NEW: use actual column names)
    # Extract actual columns from x_transformed grouped by base variable
    base_var_to_actual_cols = {}
    for col in x_transformed.columns:
        if col not in excluded_columns and col.lower() != 'time':
            base_var = col.split('.')[0]  # "gdp.Point Forecast.Level" -> "gdp"
            if base_var not in base_var_to_actual_cols:
                base_var_to_actual_cols[base_var] = []
            base_var_to_actual_cols[base_var].append(col)
    
    print(f"Extracted actual columns for {len(base_var_to_actual_cols)} base variables")
    for base_var, cols in list(base_var_to_actual_cols.items())[:3]:  # Show first 3 for debugging
        print(f"  {base_var}: {len(cols)} columns (sample: {cols[:3]})")

    # 5) Combos + combo max corr
    if progress_callback:
        progress_callback(60, "Generating variable combinations...")
    if cancellation_check and cancellation_check():
        raise Exception("Job cancelled")
    
    # NEW: Pass base_var_to_actual_cols instead of x_raw_vars
    all_combinations = generate_variable_combinations(base_var_to_actual_cols, x_transformed, excluded_columns, cancellation_check)
    # OLD: all_combinations = generate_variable_combinations(x_raw_vars, x_transformed, excluded_columns, cancellation_check)
    
    if cancellation_check and cancellation_check():
        raise Exception("Job cancelled")
    
    if progress_callback:
        progress_callback(70, f"Computing correlations for {len(all_combinations)} combinations...")
    num_vars_taken = num_combinations
    all_comb_df = compute_correlations_for_combinations(all_combinations, x_cor_mat, num_vars_taken, cancellation_check)

    if cancellation_check and cancellation_check():
        raise Exception("Job cancelled")
    
    if progress_callback:
        progress_callback(85, "Saving combination results...")
    comb_out = f"{output_dir}/{workflow.loan_product}_{num_vars_taken}-var_combinations_{_date_time}.csv"
    all_comb_df.to_csv(comb_out, index=False); docs.append(os.path.basename(comb_out))

    # 6) Summary
    print("Data transformation complete!")
    print(f"Results saved to {output_dir}/")
    print(f"Total combinations processed: {len(all_combinations)}")

    if not all_comb_df.empty and 'max_abs_cor' in all_comb_df.columns:
        valid_cor = all_comb_df['max_abs_cor'].dropna()
        if not valid_cor.empty:
            print(f"- Average max correlation: {valid_cor.mean():.4f}")
            print(f"- Min max correlation: {valid_cor.min():.4f}")
            print(f"- Max max correlation: {valid_cor.max():.4f}")
            print(f"- Valid correlations: {len(valid_cor)}/{len(all_comb_df)}")

    return {"docs": docs, "file_path": output_dir}

def process_data_transformation(
    combined_monthly_mev_data_interpolation_df: pd.DataFrame,
    historical_default_rates_df: pd.DataFrame,
    workflow,
    override_data_transformation_mevs_df: pd.DataFrame,
    progress_callback=None,
    cancellation_check=None,
    num_combinations: int = 2):
    """
    Main entry point for data transformation process.
    
    This is the entry point called by the application. It:
    1. Combines monthly MEV data with interpolated data
    2. Executes the full transformation pipeline
    3. Tracks execution time
    4. Handles errors and cancellation
    
    Args:
        combined_monthly_mev_data_interpolation_df (pd.DataFrame): Combined monthly MEV and interpolation data
        historical_default_rates_df (pd.DataFrame): Historical default rate data
        workflow: Workflow object
        progress_callback (callable, optional): Function for progress updates
        cancellation_check (callable, optional): Function to check for cancellation
        num_combinations (int): Number of variables per combination (default: 2)
    
    Returns:
        dict | None: Result dictionary with 'docs' and 'file_path', or None if error
    """
    print("Starting dataframe combination process...")
    start_time = time.time()  # Start the timer
    try:
        if progress_callback:
            progress_callback(15, "Combining monthly MEV and interpolation data...")
        if cancellation_check and cancellation_check():
            raise Exception("Job cancelled")
        
        print('combined_monthly_mev_data_interpolation_df \n', combined_monthly_mev_data_interpolation_df)
        print('override_data_transformation_mevs_df \n', override_data_transformation_mevs_df)

        max_date = override_data_transformation_mevs_df.copy()
        max_date['Period'] = pd.to_datetime(max_date['Period'])
        max_date = max_date['Period'].max()

        override_data_transformation_mevs_df_copy = override_data_transformation_mevs_df.copy()
        override_data_transformation_mevs_df_copy['Period'] = pd.to_datetime(override_data_transformation_mevs_df_copy['Period'])

        override_data_transformation_mevs_df_copy['year'] = override_data_transformation_mevs_df_copy['Period'].dt.year
        override_data_transformation_mevs_df_copy['month (int)'] = override_data_transformation_mevs_df_copy['Period'].dt.month
        override_data_transformation_mevs_df_copy['month'] = override_data_transformation_mevs_df_copy['Period'].dt.strftime("%b")
        override_data_transformation_mevs_df_copy['id'] = override_data_transformation_mevs_df_copy['Period'].dt.strftime('%Y-%m')

        # combine combined_monthly_mev_data_interpolation_df and override_data_transformation_mevs_df_copy
        # Step 1: Prepare combined_monthly_mev_data_interpolation_df - convert Date to Period
        combined_df = combined_monthly_mev_data_interpolation_df.copy()
        combined_df['Period'] = pd.to_datetime(combined_df['Date'])
        
        # Step 2: Get all unique dates from both dataframes
        override_dates = set(override_data_transformation_mevs_df_copy['Period'].dt.date)
        combined_dates = set(combined_df['Period'].dt.date)
        all_dates = sorted(override_dates.union(combined_dates))
        
        # Step 3: Create a function to extract variable name from column names
        # Examples: "Upside gdp" -> "gdp", "Base gni" -> "gni", "Downside gdp.Level" -> "gdp"
        def extract_variable_name(col_name: str) -> str:
            """Extract variable name from column name, removing scenario prefixes and transformation suffixes."""
            # Remove scenario prefixes (Upside, Base, Downside)
            col_clean = col_name.replace("Upside ", "").replace("Base ", "").replace("Downside ", "")
            # Extract base variable (before first dot if exists)
            if '.' in col_clean:
                return col_clean.split('.')[0]
            return col_clean
        
        # Step 4: Create mapping from override columns to Point Forecast columns
        # Build a mapping: override_column -> variable_name -> point_forecast_column
        column_mapping = {}
        for col in override_data_transformation_mevs_df_copy.columns:
            if col not in ['Period', 'year', 'month (int)', 'month', 'id']:
                var_name = extract_variable_name(col)
                point_forecast_col = f"{var_name}.Point Forecast"
                if point_forecast_col in combined_df.columns:
                    column_mapping[col] = point_forecast_col
        
        # Step 5: Create result dataframe with all dates
        result_rows = []
        for date in all_dates:
            date_dt = pd.Timestamp(date)
            row = {
                'Period': date_dt,
                'year': date_dt.year,
                'month (int)': date_dt.month,
                'month': date_dt.strftime("%b"),
                'id': date_dt.strftime('%Y-%m')
            }
            
            # Check if date exists in override_data_transformation_mevs_df_copy
            override_match = override_data_transformation_mevs_df_copy[
                override_data_transformation_mevs_df_copy['Period'].dt.date == date
            ]
            
            if not override_match.empty:
                # Use values from override_data_transformation_mevs_df_copy
                override_row = override_match.iloc[0]
                for col in override_data_transformation_mevs_df_copy.columns:
                    if col not in ['Period', 'year', 'month (int)', 'month', 'id']:
                        row[col] = override_row[col]
            else:
                # Date only exists in combined_df, use Point Forecast columns
                combined_match = combined_df[combined_df['Period'].dt.date == date]
                if not combined_match.empty:
                    combined_row = combined_match.iloc[0]
                    for override_col, point_forecast_col in column_mapping.items():
                        if point_forecast_col in combined_row.index:
                            row[override_col] = combined_row[point_forecast_col]
                        else:
                            row[override_col] = None
                else:
                    # Date not found in either, fill with None
                    for col in override_data_transformation_mevs_df_copy.columns:
                        if col not in ['Period', 'year', 'month (int)', 'month', 'id']:
                            row[col] = None
            
            result_rows.append(row)
        
        # Step 6: Create final combined dataframe
        override_data_transformation_mevs_df_copy = pd.DataFrame(result_rows)
        # Ensure Period is datetime
        override_data_transformation_mevs_df_copy['Period'] = pd.to_datetime(override_data_transformation_mevs_df_copy['Period'])
        # Sort by Period
        override_data_transformation_mevs_df_copy = override_data_transformation_mevs_df_copy.sort_values('Period').reset_index(drop=True)
        
        # do not include the dates after the maximum date of override_data_transformation_mevs_df_copy['Period'] 
        override_data_transformation_mevs_df_copy = override_data_transformation_mevs_df_copy[override_data_transformation_mevs_df_copy['Period'] <= max_date]

        # override_data_transformation_mevs_df_copy.to_csv('override_data_transformation_mevs_df_copy.csv', index=False)

        res = process_data_transformation_output(
            override_data_transformation_mevs_df_copy, 
            historical_default_rates_df, 
            workflow, 
            progress_callback, 
            cancellation_check, 
            num_combinations
        )
        end_time = time.time()  # End the timer
        elapsed_time = end_time - start_time  # Calculate elapsed time
        print(f"Data transformation completed in {elapsed_time:.2f} seconds.")
        return res
    except Exception as e:
        if "cancelled" in str(e).lower():
            print(f"Job cancelled during processing")
            raise  # Re-raise to be handled by caller
        print(f"Error during combination: {str(e)}")
        import traceback; traceback.print_exc()
        return None

# 1. combine data
# 2. pick desired variables and values
# 3. process data transformation of step 2