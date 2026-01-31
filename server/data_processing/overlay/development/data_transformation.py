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
                                           data_interpolation_df: pd.DataFrame) -> pd.DataFrame | None:
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

        # definition rows (first 2 rows) exist in both inputs; keep but will drop post-merge
        df_combined = pd.merge(df_interpolation, df_monthly, on='id', how='left')

        # Drop definition rows at indices 1 and 2 (0-based)
        df_combined = df_combined.drop([1, 2], errors='ignore').reset_index(drop=True)

        # Clean merge artifacts safely
        df_combined = df_combined.drop(columns=[c for c in ['month_x', 'year_y'] if c in df_combined.columns], errors='ignore')
        rename_map = {}
        if 'year_x' in df_combined.columns: rename_map['year_x'] = 'year'
        if 'month_y' in df_combined.columns: rename_map['month_y'] = 'month'
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

        return df_combined

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
    x_raw = x_raw.iloc[2:].reset_index(drop=True)

    # Clean numerics
    x_raw = clean_percentage_data(x_raw, excluded_columns)
    return x_raw


def add_level_gr_columns(x_raw: pd.DataFrame, excluded_columns: list) -> pd.DataFrame:
    """
    Add .Level and .GR (Year-over-Year growth) columns for each raw variable.
    
    For each base variable (without dot suffixes), creates:
    - {var}.Level: The level value itself (same as raw variable)
    - {var}.GR: Year-over-year growth rate = (current / value_12_months_ago) - 1
    
    Only creates columns if they don't already exist. This mirrors R pipeline
    behavior where .Level/.GR columns may already exist.
    
    Args:
        x_raw (pd.DataFrame): DataFrame with raw independent variables
        excluded_columns (list): Columns to exclude from processing
    
    Returns:
        pd.DataFrame: DataFrame with added .Level and .GR columns
    """
    x = x_raw.copy()
    # base vars = non-excluded and no dot suffix
    raw_vars = [c for c in x.columns if c not in excluded_columns and '.' not in c and c.lower() not in ('time',)]
    for v in raw_vars:
        base = pd.to_numeric(x[v], errors='coerce')
        lvl_col = f"{v}.Level"
        gr_col  = f"{v}.GR"
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
    for var in x_raw_vars:
        try:
            s = pd.to_numeric(x_raw[var], errors='coerce')
            if not s.isna().all() and s.min(skipna=True) > 0:
                x_transformed[f"{var}.ln"] = np.log(s)
        except Exception as e:
            print(f"  ln skip {var}: {e}")

    # asinh
    print("Applying asinh transformations...")
    for var in x_raw_vars:
        try:
            s = pd.to_numeric(x_raw[var], errors='coerce')
            if not s.isna().all() and s.min(skipna=True) <= 0:
                x_transformed[f"{var}.asinh"] = np.arcsinh(s)
        except Exception as e:
            print(f"  asinh skip {var}: {e}")

    # diff_12 on ALL non-excluded
    print("Applying differencing transformations...")
    all_vars_to_diff = [c for c in x_transformed.columns if c not in excluded_columns]
    for col in all_vars_to_diff:
        try:
            s = pd.to_numeric(x_transformed[col], errors='coerce')
            if not s.isna().all():
                x_transformed[f"{col}.diff_12"] = s - s.shift(12)
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
                x_transformed[f"{col}.lag_{lag}"] = s.shift(lag)
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
                y_transformed[f"{var}.logit"] = np.log(s / (1 - s))
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

def generate_variable_combinations(x_raw_vars: list,
                                   x_transformed: pd.DataFrame,
                                   excluded_columns: list,
                                   cancellation_check=None,
                                   num_vars_taken: int = 2) -> list[list[str]]:
    """
    Generate all valid variable combinations with transformations.
    
    This function creates all possible 2-variable combinations by:
    1. Starting with base variable combinations (C(n,2) for n base vars)
    2. Applying Level/GR permutations: "", ".Level", ".GR" for each variable
    3. Applying transformation permutations: "", ".ln", ".asinh" for each variable
    4. Applying differencing permutations: "", ".diff_12" for each variable
    5. Applying lag permutations: "", ".lag_3", ".lag_6", ".lag_9", ".lag_12" for each
    
    Only combinations where all variables exist in x_transformed are kept.
    Columns containing both .diff_12 and .lag_12 are excluded for optimization.
    Supports cancellation checks during processing.
    
    Args:
        x_raw_vars (list): List of base variable names (without suffixes)
        x_transformed (pd.DataFrame): DataFrame with all transformed columns
        excluded_columns (list): Columns to exclude
        cancellation_check (callable, optional): Function returning True to cancel
    
    Returns:
        list[list[str]]: List of 2-variable combinations (each is a list of 2 variable names)
    
    Raises:
        Exception: If cancellation_check returns True
    """
    print("Generating variable combinations...")
    
    # Helper function to check if a column should be excluded (has both .diff_12 and .lag_12)
    def should_exclude_column(col_name: str) -> bool:
        """Exclude columns that have both .diff_12 and .lag_12 for optimization."""
        return '.diff_12' in col_name and '.lag_12' in col_name

    # base names (raw should not have '.')
    x_base_vars = list(set([v.split('.')[0] for v in x_raw_vars]))
    print(f"Base variables: {len(x_base_vars)}")

    comb_no_lags = list(combinations(x_base_vars, num_vars_taken))
    comb_extended = [list(c) for c in comb_no_lags]
    print(f"Base combinations: {len(comb_extended)}")

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
            names = [base_comb[i] + p[i] for i in range(num_vars_taken)]
            # Early filtering: only append if all columns exist and don't have both .diff_12 and .lag_12
            if all(v in x_transformed.columns and not should_exclude_column(v) for v in names):
                new_ext.append(names)
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
            names = [base_comb[i] + p[i] for i in range(num_vars_taken)]
            # Early filtering: only append if all columns exist and don't have both .diff_12 and .lag_12
            if all(v in x_transformed.columns and not should_exclude_column(v) for v in names):
                new_ext.append(names)
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
            names = [base_comb[i] + p[i] for i in range(num_vars_taken)]
            # Early filtering: only append if all columns exist and don't have both .diff_12 and .lag_12
            if all(v in x_transformed.columns and not should_exclude_column(v) for v in names):
                new_ext.append(names)
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
            names = [base_comb[i] + p[i] for i in range(num_vars_taken)]
            # Early filtering: only append if all columns exist and don't have both .diff_12 and .lag_12
            if all(v in x_transformed.columns and not should_exclude_column(v) for v in names):
                new_ext.append(names)
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
    _date_time = get_time_date()

    docs = []

    output_dir = (
        f"{get_root_folder()}/files/"
        f"{workflow.entity}/"
        f"{workflow.reporting_period}/"
        f"{workflow.workflow_name}/"
        f"output/overlay/development/{workflow.loan_product}/data_transformation"
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

    # variable lists (raw vars only; no dot suffix)
    x_raw_vars = [c for c in x_raw.columns if c not in excluded_columns and '.' not in c and c.lower() != 'time']
    y_raw_vars = [c for c in y_raw.columns if c not in excluded_columns and c.lower() != 'time']

    print(f"Loaded {len(x_raw_vars)} independent raw variables and {len(y_raw_vars)} dependent variables")

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

    # 5) Combos + combo max corr
    if progress_callback:
        progress_callback(60, "Generating variable combinations...")
    if cancellation_check and cancellation_check():
        raise Exception("Job cancelled")
    
    all_combinations = generate_variable_combinations(x_raw_vars, x_transformed, excluded_columns, cancellation_check, num_combinations)
    
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


def process_data_transformation(monthly_historical_mev_df: pd.DataFrame,
                                data_interpolation_df: pd.DataFrame,
                                historical_default_rates_df: pd.DataFrame,
                                workflow,
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
        monthly_historical_mev_df (pd.DataFrame): Monthly historical MEV data
        data_interpolation_df (pd.DataFrame): Interpolated data
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
        
        df_combined = combine_monthly_mev_data_interpolation(monthly_historical_mev_df, data_interpolation_df)
        res = process_data_transformation_output(
            df_combined, 
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