# -*- coding: utf-8 -*-
"""
Multiple Linear Regression (MFA) pipeline — Python port of your R script.
- Step 1: load libraries & data
- Step 2: select combinations to run
- Step 3: define model stats
- Step 4: run MFA (sequential; no background tasks yet)

Requires:
    pandas, numpy, statsmodels, scipy
"""

from __future__ import annotations

import os
import sys
import re
import math
import time
import itertools
from pathlib import Path
from typing import List, Dict, Any, Iterable, Callable, Optional
from multiprocessing import Pool, cpu_count
import platform

import numpy as np
import pandas as pd

from scipy.stats import shapiro
from statsmodels.formula.api import ols
from statsmodels.tools.tools import add_constant
from statsmodels.stats.outliers_influence import variance_inflation_factor
from statsmodels.stats.diagnostic import (
    acorr_ljungbox,
    het_breuschpagan,
)

from data.excluded_columns import excluded_columns

# -----------------------------
# Step 1 — load libraries & data
# -----------------------------

def load_transformed_data(
    workflow,
    folder_path: str
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, List[str], List[str]]:
    """
    Load transformed independent (X) and dependent (Y) variable data.
    
    This function:
    1. Finds the latest transformed data files for the portfolio
    2. Loads independent and dependent variable DataFrames
    3. Drops columns matching forbidden patterns (".asinh.diff_12.lag", ".ln.diff_12.lag", ".diff_12.lag", ".asinh")
    4. Left-joins X and Y data on 'Time' column
    5. Excludes predefined columns (from excluded_columns list)
    6. Returns separate X, Y DataFrames, merged regression data, and variable name lists
    
    Args:
        workflow: Workflow object containing loan_product attribute
        folder_path (str): Path to folder containing transformed data files
    
    Returns:
        tuple: (x_df, y_df, regression_data, x_names, y_names)
            - x_df: Independent variables DataFrame
            - y_df: Dependent variables DataFrame
            - regression_data: Merged DataFrame ready for regression (X + Y on Time)
            - x_names: List of independent variable names (excluding excluded columns)
            - y_names: List of dependent variable names (excluding excluded columns)
    
    Raises:
        ValueError: If 'Time' column is missing from X or Y DataFrames
    """

    portfolio = workflow.loan_product

    folder_path = Path(folder_path)

    x_path = max(
        folder_path.glob(f"{portfolio}_Independent - Transformed with Time*"),
        key=lambda p: p.stat().st_mtime,   # last modified time
        default=None
    )
    
    y_path = max(
        folder_path.glob(f"{portfolio}_Dependent - Transformed with Time*"),
        key=lambda p: p.stat().st_mtime,   # last modified time
        default=None
    )
    
    print('x_path \n', x_path)
    print('y_path \n', y_path)

    # # Load
    x_df = pd.read_csv(x_path)
    y_df = pd.read_csv(y_path)

    print(x_df.columns)
    print(y_df.columns)
    # # # Drop columns matching forbidden patterns (matching R script filters)
    # R filters: ".asinh.diff_12.lag", ".ln.diff_12.lag", ".diff_12.lag", ".asinh"
    drop_patterns = (".asinh.diff_12.lag", ".ln.diff_12.lag", ".diff_12.lag", ".asinh")
    cols_to_drop = [c for c in x_df.columns if any(p in c for p in drop_patterns)]
    x_df = x_df.drop(columns=cols_to_drop, errors="ignore")

    # # # Left join on 'Time'
    if "Time" not in x_df.columns or "Time" not in y_df.columns:
        raise ValueError("Both X and Y DataFrames must contain a 'Time' column.")
    reg_w_time = pd.merge(y_df, x_df, on="Time", how="left")

    x_names = [c for c in x_df.columns if c not in excluded_columns]
    y_names = [c for c in y_df.columns if c not in excluded_columns]

    regression_data = reg_w_time.drop(columns=excluded_columns, errors="ignore")

    return x_df, y_df, regression_data, x_names, y_names


# -------------------------------------
# Step 2 — select combinations to model
# -------------------------------------

def load_combinations(
    portfolio: str,
    num_vars_taken: int,
    folder_path: str,
    limit: int | None = None,
) -> np.ndarray:
    """
    Load precomputed variable combinations from CSV file.
    
    This function:
    1. Finds the latest combinations file for the portfolio and number of variables
    2. Filters by correlation threshold (max_abs_cor >= 0, max_abs_cor < 0.8) if column exists
    3. Extracts columns starting with "X" (X1, X2, ..., Xk)
    4. Optionally limits the number of combinations (for testing)
    5. Filters out combinations containing forbidden lag patterns
    6. Filters out combinations with more than 2 non_mev variables
    7. Returns as numpy array of strings (shape: n_combinations × num_vars_taken)
    
    Args:
        portfolio (str): Portfolio/loan product name
        num_vars_taken (int): Number of variables per combination (k)
        folder_path (str): Path to folder containing combinations file
        limit (int | None): Optional limit on number of combinations to load (for testing)
    
    Returns:
        np.ndarray: Array of shape (n, k) containing variable name combinations as strings.
                   Each row is one combination, each column is a variable name.
    """

    folder_path = Path(folder_path)
    comb_path = max(
        folder_path.glob(f"{portfolio}_{num_vars_taken}-var_combinations*"),
        key=lambda p: p.stat().st_mtime,   # last modified time
        default=None
    )
    df = pd.read_csv(comb_path)

    print(df)

    # Filter by correlation threshold if max_abs_cor column exists (matching R script)
    # R filters: max_abs_cor >= 0, max_abs_cor < 0.8
    if 'max_abs_cor' in df.columns:
        initial_count = len(df)
        df = df[(df['max_abs_cor'] >= 0) & (df['max_abs_cor'] < 0.8)]
        filtered_count = len(df)
        print(f"Correlation filter: {initial_count} -> {filtered_count} combinations (removed {initial_count - filtered_count})")
    else:
        print("Warning: 'max_abs_cor' column not found in combinations file. Skipping correlation filter.")

    # Keep only columns that match pattern X1, X2, x1, x2, etc. (case-insensitive)
    x_pattern = re.compile(r'^[Xx]\d+$', re.IGNORECASE)
    xcols = [c for c in df.columns if x_pattern.match(c)]
    df = df[xcols]

    # Optionally limit the number of combinations (R slices first 4e6)
    if limit is not None:
        df = df.iloc[:limit, :]

    # Filter out any rows where any X contains the forbidden substrings (matching R script)
    # R filters: "asinh.diff_12.lag", "ln.diff_12.lag", "diff_12.lag", "asinh"
    bad_substrings = (".asinh.diff_12.lag", ".ln.diff_12.lag", ".diff_12.lag", ".asinh")
    mask_bad = df.apply(
        lambda row: any(
            (isinstance(v, str) and any(b in v for b in bad_substrings)) for v in row
        ),
        axis=1,
    )
    df = df.loc[~mask_bad].reset_index(drop=True)

    # Filter out combinations with more than 2 non_mev variables (matching R script)
    # R filters: rowSums(across(everything(), ~ grepl("^non_mev", .x))) <= 2
    def count_non_mev(row):
        """Count how many variables in the combination start with 'non_mev' (case-insensitive)."""
        count = 0
        for val in row:
            if isinstance(val, str) and val.lower().startswith('non_mev'):
                count += 1
        return count
    
    non_mev_counts = df.apply(count_non_mev, axis=1)
    mask_non_mev = non_mev_counts <= 2
    initial_count = len(df)
    df = df.loc[mask_non_mev].reset_index(drop=True)
    filtered_count = len(df)
    print(f"non_mev filter: {initial_count} -> {filtered_count} combinations (removed {initial_count - filtered_count})")

    # Return as numpy array of strings (shape n x k)
    print(df)
    return df.values.astype(str)


# ------------------------------------
# Step 3 — define model stats function
# ------------------------------------

def _logistic(x: np.ndarray | float) -> np.ndarray | float:
    """
    Apply stable logistic (sigmoid) transformation.
    
    Converts values from linear/logit space to probability space [0, 1].
    Formula: 1 / (1 + exp(-x))
    
    Args:
        x (np.ndarray | float): Input value(s) in logit space
    
    Returns:
        np.ndarray | float: Transformed value(s) in probability space [0, 1]
    """
    return 1.0 / (1.0 + np.exp(-np.asarray(x)))


def _safe_mean(values: Iterable[float]) -> float:
    """
    Calculate mean of values, handling empty arrays and NaN values.
    
    Returns NaN if input is empty, otherwise returns mean ignoring NaN values.
    
    Args:
        values (Iterable[float]): Iterable of numeric values (may contain NaN)
    
    Returns:
        float: Mean value, or NaN if input is empty
    """
    arr = np.asarray(list(values), dtype=float)
    if arr.size == 0:
        return np.nan
    return np.nanmean(arr)


def _replace_inf_with_nan(value: Any) -> Any:
    """
    Replace infinity values with NaN to ensure JSON compliance.
    
    JSON doesn't support infinity values, so we convert them to NaN.
    This function handles both float values and dictionary/iterable structures.
    
    Args:
        value: Any value that might contain infinity
    
    Returns:
        Value with infinity replaced by NaN (or original value if not infinity)
    """
    if isinstance(value, (float, np.floating)):
        if np.isinf(value):
            return np.nan
        return value
    elif isinstance(value, dict):
        return {k: _replace_inf_with_nan(v) for k, v in value.items()}
    elif isinstance(value, (list, tuple)):
        return type(value)(_replace_inf_with_nan(item) for item in value)
    else:
        return value


def _compute_vif(exog: pd.DataFrame) -> List[float]:
    """
    Compute Variance Inflation Factor (VIF) for each independent variable.
    
    VIF measures multicollinearity - how much the variance of a coefficient
    increases due to correlation with other variables. VIF > 5-10 indicates
    high multicollinearity.
    
    Args:
        exog (pd.DataFrame): DataFrame of independent variables (no intercept)
    
    Returns:
        List[float]: VIF values for each column. Returns [np.nan] for single
                    regressor or if computation fails (singular matrix).
    """
    try:
        if exog.shape[1] == 0:
            return []
        if exog.shape[1] == 1:
            return [np.nan]  # single regressor: VIF not informative
        # Add constant for VIF computation
        X = add_constant(exog, has_constant='add')
        vifs = []
        for i in range(1, X.shape[1]):  # skip intercept at index 0
            vifs.append(variance_inflation_factor(X.values, i))
        return vifs
    except Exception:
        return [np.nan] * exog.shape[1]


def _alias_present(exog: pd.DataFrame) -> bool:
    """
    Detect rank deficiency (aliasing) in the design matrix.
    
    Aliasing occurs when columns are linearly dependent, making the design matrix
    rank-deficient. This prevents unique coefficient estimation.
    
    Args:
        exog (pd.DataFrame): DataFrame of independent variables
    
    Returns:
        bool: True if aliasing is present (rank < number of columns), False otherwise
    """
    try:
        rank = np.linalg.matrix_rank(exog.values.astype(float))
        return rank < exog.shape[1]
    except Exception:
        return True


def write_model_stats_for_combo(
    indep_vars: List[str],
    dep_var: str,
    lr_data: pd.DataFrame,
    max_bg_order: int,
) -> Dict[str, Any]:
    """
    Fit OLS regression model and compute comprehensive diagnostic statistics.
    
    This function:
    1. Fits an OLS regression: dep_var ~ indep_vars
    2. Computes coefficients, standard errors, t-values, p-values
    3. Calculates VIF for multicollinearity detection
    4. Computes goodness-of-fit metrics (R², Adj R², AIC, BIC, MSE, RMSE)
    5. Calculates MAPE in probability space (logistic transform)
    6. Performs diagnostic tests:
       - Shapiro-Wilk (normality of residuals)
       - Ljung-Box (autocorrelation)
       - Breusch-Pagan (heteroskedasticity)
    
    Note: Durbin-Watson and Breusch-Godfrey tests are excluded to match R script behavior.
    
    Args:
        indep_vars (List[str]): List of independent variable names
        dep_var (str): Dependent variable name
        lr_data (pd.DataFrame): Regression data with all variables and 'Time' column
        max_bg_order (int): Maximum lag order for Breusch-Godfrey test (kept for API compatibility, not used)
    
    Returns:
        Dict[str, Any]: Dictionary containing all model statistics:
            - Y, X1, X2, ...: Variable names
            - intercept, coeff_X1, coeff_X2, ...: Coefficients
            - stderr_intercept, stderr_X1, ...: Standard errors
            - t-value_*, p-value_*: t-statistics and p-values
            - vif_X1, vif_X2, ...: Variance Inflation Factors
            - R_Squared, Adj_R_Squared: Goodness of fit
            - MSE, RMSE, MAPE: Error metrics
            - AIC, BIC: Information criteria
            - ST_pval, BT_pval, BP_pval: Test p-values
    """
    # Build formula like: "Y ~ X1 + X2 + ..."
    # Use Q() function directly in formula string to handle variable names with dots
    def escape_var_name(var_name: str) -> str:
        if '.' in var_name:
            return f'Q("{var_name}")'
        return var_name
    
    escaped_dep_var = escape_var_name(dep_var)
    escaped_indep_vars = [escape_var_name(var) for var in indep_vars]
    formula = f"{escaped_dep_var} ~ {' + '.join(escaped_indep_vars)}"

    # Fit model
    model = ols(formula=formula, data=lr_data, missing='drop').fit()

    # Collect core stats
    params = model.params  # includes Intercept
    bse = model.bse
    tvals = model.tvalues
    pvals = model.pvalues

    # Handle potential aliasing for VIF
    exog_cols = [c for c in model.model.exog_names if c != "Intercept"]
    exog_df = pd.DataFrame(model.model.exog, columns=model.model.exog_names)
    exog_df = exog_df.drop(columns=["Intercept"], errors="ignore")

    if _alias_present(exog_df):
        vifs = [np.nan] * len(exog_cols)
    else:
        vifs = _compute_vif(exog_df)

    # Residual-based metrics
    resid = model.resid.values
    nobs = int(model.nobs)
    mse = float(np.mean(resid ** 2))
    rmse = float(np.sqrt(mse))

    # MAPE in probability space (matching your R logic)
    # R used: logistic(y) vs logistic(fitted). For statsmodels OLS, model.model.endog is the response y.
    # residuals = y - fitted => y - residual = fitted
    y_linear = model.model.endog  # logit(p_actual)
    fitted_linear = model.fittedvalues.values  # linear preds (≈ y - resid)
    p_actual = _logistic(y_linear)
    p_pred = _logistic(fitted_linear)

    # Avoid division by zero: when p_actual == 0, mark as NaN (R used na_if(..., Inf))
    with np.errstate(divide='ignore', invalid='ignore'):
        ape = np.abs((p_actual - p_pred) / p_actual)
        ape[~np.isfinite(ape)] = np.nan
    mape = _safe_mean(ape)

    # Normality test (Shapiro-Wilk)
    try:
        sh_w, sh_p = shapiro(resid)
        shapiro_p = float(sh_p)
    except Exception:
        shapiro_p = np.nan

    # Ljung-Box on residuals (lag=1 to mirror Box.test default)
    try:
        lb = acorr_ljungbox(resid, lags=[1], return_df=True)
        lb_p = float(lb["lb_pvalue"].iloc[0])
    except Exception:
        lb_p = np.nan

    # Breusch-Pagan for heteroskedasticity (use regressors incl. intercept)
    try:
        # For BP test: exog should include intercept
        exog_bp = add_constant(exog_df, has_constant='add')
        bp_stat, bp_p, _, _ = het_breuschpagan(resid, exog_bp)
        bp_p = float(bp_p)
    except Exception:
        bp_p = np.nan

    # Note: Durbin-Watson and Breusch-Godfrey tests are excluded to match R script
    # R script has these commented out (lines 124-125, 148-149)

    # Assemble output — follow the R naming scheme
    k = len(indep_vars)
    result: Dict[str, Any] = {}

    # Y & X names first
    result["Y"] = dep_var
    for i, name in enumerate(indep_vars, start=1):
        result[f"X{i}"] = name

    # coefficients, stderr, t, p (intercept + Xs)
    # ensure order: Intercept, each X in the same order as indep_vars
    def get_or_nan(series: pd.Series, key: str) -> float:
        return float(series.get(key, np.nan))
    
    # Create mapping from original variable names to actual parameter names in model
    # This handles cases where Q() escaping or variable dropping changes the parameter name
    actual_param_names = list(model.model.exog_names)  # Includes "Intercept" and all X variables
    var_name_mapping = {}
    for orig_var in indep_vars:
        # Try to find the actual parameter name that matches this variable
        found = None
        # First try exact match
        if orig_var in actual_param_names:
            found = orig_var
        else:
            # Try to match by cleaning Q() wrapper and quotes
            for param_name in actual_param_names:
                if param_name == "Intercept":
                    continue
                # Remove Q() wrapper and quotes for comparison
                clean_param = param_name.replace('Q(', '').replace(')', '').strip('"').strip("'")
                if clean_param == orig_var:
                    found = param_name
                    break
        var_name_mapping[orig_var] = found if found else orig_var  # Fallback to original if not found

    # Intercept
    result["intercept"] = get_or_nan(params, "Intercept")
    result["stderr_intercept"] = get_or_nan(bse, "Intercept")
    result["t-value_intercept"] = get_or_nan(tvals, "Intercept")
    result["p-value_intercept"] = get_or_nan(pvals, "Intercept")

    # Each X - use the mapped parameter names
    for i, x in enumerate(indep_vars, start=1):
        actual_param_name = var_name_mapping.get(x, x)
        result[f"coeff_X{i}"] = get_or_nan(params, actual_param_name)
        result[f"stderr_X{i}"] = get_or_nan(bse, actual_param_name)
        result[f"t-value_X{i}"] = get_or_nan(tvals, actual_param_name)
        result[f"p-value_X{i}"] = get_or_nan(pvals, actual_param_name)

    # VIF
    for i in range(k):
        result[f"vif_X{i+1}"] = float(vifs[i]) if i < len(vifs) else np.nan

    # Goodness-of-fit & errors
    result["R_Squared"] = float(model.rsquared)
    result["Adj_R_Squared"] = float(model.rsquared_adj)
    result["num_pts_fitted"] = nobs
    result["MSE"] = mse
    result["RMSE"] = rmse
    result["MAPE"] = float(mape)
    result["AIC"] = float(model.aic)
    result["BIC"] = float(model.bic)

    # Tests (matching R script: only ST_pval, BT_pval, BP_pval)
    result["ST_pval"] = shapiro_p
    result["BT_pval"] = lb_p
    result["BP_pval"] = bp_p

    # Replace infinity values with NaN for JSON compliance
    result = _replace_inf_with_nan(result)

    return result


# -----------------------
# Step 4 — run MFA (loop)
# -----------------------

# Global variables for worker processes (initialized once per worker)
_worker_regression_data = None
_worker_dep_var = None
_worker_max_bg_order = None


def _init_worker(regression_data: pd.DataFrame, dep_var: str, max_bg_order: int):
    """
    Initialize worker process with shared data.
    
    This function is called once when each worker process starts.
    It stores the DataFrame and parameters in global variables,
    avoiding the need to pickle/unpickle the DataFrame for every task.
    
    Args:
        regression_data: DataFrame with all variables for regression
        dep_var: Dependent variable name
        max_bg_order: Maximum lag order for Breusch-Godfrey test
    """
    global _worker_regression_data, _worker_dep_var, _worker_max_bg_order
    _worker_regression_data = regression_data
    _worker_dep_var = dep_var
    _worker_max_bg_order = max_bg_order


def _process_single_combination(args: tuple) -> tuple[int, Dict[str, Any] | None]:
    """
    Worker function for multiprocessing - processes a single combination.
    
    This function must be at module level to be picklable for multiprocessing.
    Uses global variables set by _init_worker to avoid pickling DataFrame for each task.
    
    Args:
        args: Tuple of (index, combo)
            - index: Global index for this combination (1-based)
            - combo: Array of variable names for this combination
    
    Returns:
        tuple: (index, result_dict) where result_dict is None if processing failed
    """
    global _worker_regression_data, _worker_dep_var, _worker_max_bg_order
    index, combo = args
    
    try:
        indep_vars = list(combo)
        row = write_model_stats_for_combo(
            indep_vars=indep_vars,
            dep_var=_worker_dep_var,
            lr_data=_worker_regression_data,
            max_bg_order=_worker_max_bg_order,
        )
        row["index"] = index
        return (index, row)
    except Exception as e:
        # Return None to indicate failure, but keep the index for ordering
        print(f"[Index {index}] Failed on {list(combo)}: {e}", file=sys.stderr)
        return (index, None)


def run_mfa(
    dep_var: str,
    combinations: np.ndarray,  # shape: (n_combos, k)
    regression_data: pd.DataFrame,
    max_bg_order: int,
    out_csv_path: Path,
    flush_every: int = 100,  # write to disk every N rows to keep memory in check
    progress_callback: Optional[Callable[[int, str], None]] = None,  # Optional: (progress: int, message: str) -> None
    cancellation_check: Optional[Callable[[], bool]] = None,  # Optional: () -> bool
    total_combinations: int | None = None,  # Optional: total count for progress calculation
) -> None:
    """
    Run Multifactor Analysis (MFA) on all variable combinations.
    
    This function:
    1. Creates an output folder based on the base filename
    2. Processes each combination sequentially
    3. For each combination, fits OLS model and computes statistics
    4. Buffers results and flushes to CSV periodically (every flush_every rows)
    5. Automatically rotates to new files when current file reaches MAX_ROWS_PER_FILE (10,000)
    6. Files are named sequentially: 001.csv, 002.csv, etc. inside the output folder
    7. Supports progress tracking (maps 0-100% to 30-100% of overall job progress)
    8. Supports cancellation checks between combinations
    
    Args:
        dep_var (str): Dependent variable name
        combinations (np.ndarray): Array of shape (n_combos, k) with variable combinations
        regression_data (pd.DataFrame): DataFrame with all variables for regression
        max_bg_order (int): Maximum lag order for Breusch-Godfrey test (kept for API compatibility, not used)
        out_csv_path (Path): Base path for output (folder will be created from stem)
        flush_every (int): Number of rows to buffer before writing to disk (default: 100)
        progress_callback (Optional[Callable]): Function to call with (progress%, message) for updates
        cancellation_check (Optional[Callable]): Function that returns True if job should be cancelled
        total_combinations (int | None): Total combination count for accurate progress calculation
    
    Raises:
        Exception: If cancellation_check returns True ("Job cancelled by user")
    """
    # Create folder based on base filename (without extension)
    base_name = out_csv_path.stem  # filename without extension
    output_folder = out_csv_path.parent / base_name
    output_folder.mkdir(parents=True, exist_ok=True)

    buffer: List[Dict[str, Any]] = []
    total = combinations.shape[0]
    global_index = 1  # Start index from 1
    
    # File rotation tracking
    MAX_ROWS_PER_FILE = 10000  # 200k rows per file (adjust for testing if needed)
    current_file_row_count = 0
    file_sequence = 1
    
    # Helper function to get next file path with sequence number inside the folder
    def get_next_file_path(seq: int) -> Path:
        """Generate file path with sequence number inside folder: folder_name/001.csv"""
        filename = f"{seq:03d}.csv"
        return output_folder / filename
    
    # Initialize first file
    current_file_path = get_next_file_path(file_sequence)
    print(f"Starting output folder: {output_folder}")
    print(f"Starting output file: {current_file_path}")

    print('combinations shape', combinations)
    print(total)

    # Use multiprocessing for all combinations
    # Determine number of workers (increased for better parallelism)
    # if platform.system() == 'Windows':
    #     num_workers = max(1, min(cpu_count(), 8))  # Increased limit on Windows
    # else:
    #     num_workers = max(1, cpu_count())  # Use all cores on Unix

    num_workers = max(1, cpu_count())  # Use all cores on Unix
    print(f"Using {num_workers} worker processes for multiprocessing")
    
    # Prepare arguments for each combination (only index and combo, not DataFrame)
    args_list = [
        (i + 1, combo)
        for i, combo in enumerate(combinations)
    ]
    
    # Use process pool with initializer to share DataFrame once per worker
    # This avoids pickling the DataFrame for every combination
    with Pool(processes=num_workers, initializer=_init_worker, initargs=(regression_data, dep_var, max_bg_order)) as pool:
        # Use smaller chunksize for better load balancing
        chunksize = max(1, min(50, total // (num_workers * 10))) if total > 0 else 1
        results_iter = pool.imap(_process_single_combination, args_list, chunksize=chunksize)
        
        try:
            for i, result in enumerate(results_iter, start=1):
                # Check for cancellation periodically
                if cancellation_check and cancellation_check():
                    pool.terminate()
                    pool.join()
                    raise Exception("Job cancelled by user")
                
                index, row = result
                
                # Only add successful results to buffer
                if row is not None:
                    buffer.append(row)
                
                # Update progress if callback is provided
                if progress_callback:
                    # Calculate progress percentage
                    progress_total = total_combinations if total_combinations is not None else total
                    progress_pct = int((i / progress_total) * 100) if progress_total > 0 else 0
                    # Map MFA progress (0-100%) to overall job progress (30-100%)
                    # The router sets progress to 30% before calling run_mfa
                    base_progress = 30
                    progress_range = 70  # 100% - 30% = 70%
                    adjusted_progress = base_progress + int((progress_pct / 100) * progress_range)
                    # Ensure progress doesn't exceed 100%
                    adjusted_progress = min(adjusted_progress, 100)
                    message = f"Processing combination {i}/{progress_total}..."
                    progress_callback(adjusted_progress, message)

                # Check if we need to rotate file before flushing
                if len(buffer) >= flush_every:
                    # Check if current file would exceed 200k rows after this flush
                    if current_file_row_count + len(buffer) >= MAX_ROWS_PER_FILE:
                        # Flush remaining buffer to current file (up to 200k limit)
                        rows_to_write = MAX_ROWS_PER_FILE - current_file_row_count
                        if rows_to_write > 0:
                            df_partial = pd.DataFrame(buffer[:rows_to_write])
                            df_partial = df_partial.replace([np.inf, -np.inf], np.nan)
                            cols = ['index'] + [col for col in df_partial.columns if col != 'index']
                            df_partial = df_partial[cols]
                            write_mode = "a" if current_file_path.exists() else "w"
                            header = not current_file_path.exists()
                            df_partial.to_csv(current_file_path, mode=write_mode, header=header, index=False)
                            current_file_row_count += len(df_partial)
                            print(f"Flushed {len(df_partial)} rows to {current_file_path} (total: {current_file_row_count} rows)")
                        
                        # Rotate to new file
                        file_sequence += 1
                        current_file_path = get_next_file_path(file_sequence)
                        current_file_row_count = 0
                        print(f"File rotation: Starting new file {file_sequence} -> {current_file_path}")
                        
                        # Write remaining buffer to new file
                        if rows_to_write < len(buffer):
                            remaining_buffer = buffer[rows_to_write:]
                            df_remaining = pd.DataFrame(remaining_buffer)
                            df_remaining = df_remaining.replace([np.inf, -np.inf], np.nan)
                            cols = ['index'] + [col for col in df_remaining.columns if col != 'index']
                            df_remaining = df_remaining[cols]
                            df_remaining.to_csv(current_file_path, mode="w", header=True, index=False)
                            current_file_row_count = len(df_remaining)
                            print(f"Flushed {len(df_remaining)} rows to new file {current_file_path}")
                        
                        buffer.clear()
                    else:
                        # Normal flush - file won't exceed 200k
                        df = pd.DataFrame(buffer)
                        df = df.replace([np.inf, -np.inf], np.nan)
                        cols = ['index'] + [col for col in df.columns if col != 'index']
                        df = df[cols]
                        write_mode = "a" if current_file_path.exists() else "w"
                        header = not current_file_path.exists()
                        df.to_csv(current_file_path, mode=write_mode, header=header, index=False)
                        rows_flushed = len(buffer)
                        current_file_row_count += rows_flushed
                        buffer.clear()
                        print(f"Flushed {rows_flushed} rows -> {current_file_path} (total: {current_file_row_count} rows)")
        except KeyboardInterrupt:
            pool.terminate()
            pool.join()
            raise
        except Exception as e:
            pool.terminate()
            pool.join()
            raise

    # Final flush
    if buffer:
        # Check if we need to rotate for final flush
        if current_file_row_count + len(buffer) >= MAX_ROWS_PER_FILE:
            # Write up to limit in current file
            rows_to_write = MAX_ROWS_PER_FILE - current_file_row_count
            if rows_to_write > 0:
                df_partial = pd.DataFrame(buffer[:rows_to_write])
                # Replace infinity values with NaN for JSON compliance
                df_partial = df_partial.replace([np.inf, -np.inf], np.nan)
                cols = ['index'] + [col for col in df_partial.columns if col != 'index']
                df_partial = df_partial[cols]
                write_mode = "a" if current_file_path.exists() else "w"
                header = not current_file_path.exists()
                df_partial.to_csv(current_file_path, mode=write_mode, header=header, index=False)
                current_file_row_count += len(df_partial)
                print(f"Final flush: {len(df_partial)} rows to {current_file_path} (total: {current_file_row_count} rows)")
            
            # Rotate and write remaining
            if rows_to_write < len(buffer):
                file_sequence += 1
                current_file_path = get_next_file_path(file_sequence)
                remaining_buffer = buffer[rows_to_write:]
                df_remaining = pd.DataFrame(remaining_buffer)
                # Replace infinity values with NaN for JSON compliance
                df_remaining = df_remaining.replace([np.inf, -np.inf], np.nan)
                cols = ['index'] + [col for col in df_remaining.columns if col != 'index']
                df_remaining = df_remaining[cols]
                df_remaining.to_csv(current_file_path, mode="w", header=True, index=False)
                print(f"Final flush: {len(df_remaining)} rows to new file {current_file_path}")
        else:
            # Normal final flush
            df = pd.DataFrame(buffer)
            # Replace infinity values with NaN for JSON compliance
            df = df.replace([np.inf, -np.inf], np.nan)
            cols = ['index'] + [col for col in df.columns if col != 'index']
            df = df[cols]
            write_mode = "a" if current_file_path.exists() else "w"
            header = not current_file_path.exists()
            df.to_csv(current_file_path, mode=write_mode, header=header, index=False)
            current_file_row_count += len(buffer)
            print(f"Final flush: {len(buffer)} rows -> {current_file_path} (total: {current_file_row_count} rows)")
        
        buffer.clear()
