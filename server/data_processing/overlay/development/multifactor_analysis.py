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
import math
import time
import itertools
from pathlib import Path
from typing import List, Dict, Any, Iterable

import numpy as np
import pandas as pd

from scipy.stats import shapiro
from statsmodels.formula.api import ols
from statsmodels.tools.tools import add_constant
from statsmodels.stats.outliers_influence import variance_inflation_factor
from statsmodels.stats.diagnostic import (
    acorr_ljungbox,
    het_breuschpagan,
    acorr_breusch_godfrey,
)
from statsmodels.stats.stattools import durbin_watson

from data.excluded_columns import excluded_columns

# -----------------------------
# Step 1 — load libraries & data
# -----------------------------

def load_transformed_data(
    workflow,
    folder_path: str
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, List[str], List[str]]:
    """
    Load X and Y transformed data, drop columns matching the R regex filters,
    left-join on 'Time', and prepare lists of X/Y names (excluding 'Time').
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
    # # # Drop columns matching pattern ".asinh.diff_12.lag" or ".ln.diff_12.lag"
    drop_patterns = (".asinh.diff_12.lag", ".ln.diff_12.lag")
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
    Load the precomputed combinations file and return a matrix of shape (n, k)
    with variable names (strings). Filters out any X that contains the lag patterns.
    """

    folder_path = Path(folder_path)
    comb_path = max(
        folder_path.glob(f"{portfolio}_{num_vars_taken}-var_combinations*"),
        key=lambda p: p.stat().st_mtime,   # last modified time
        default=None
    )
    df = pd.read_csv(comb_path)

    print(df)

    # Keep only columns that start with "X" (X1, X2, ...)
    xcols = [c for c in df.columns if c.startswith("X")]
    df = df[xcols]

    # Optionally limit the number of combinations (R slices first 4e6)
    if limit is not None:
        df = df.iloc[:limit, :]

    # Filter out any rows where any X contains the forbidden substrings
    bad_substrings = (".asinh.diff_12.lag", ".ln.diff_12.lag")
    mask_bad = df.apply(
        lambda row: any(
            (isinstance(v, str) and any(b in v for b in bad_substrings)) for v in row
        ),
        axis=1,
    )
    df = df.loc[~mask_bad].reset_index(drop=True)

    # Return as numpy array of strings (shape n x k)
    print(df)
    return df.values.astype(str)


# ------------------------------------
# Step 3 — define model stats function
# ------------------------------------

def _logistic(x: np.ndarray | float) -> np.ndarray | float:
    """Stable logistic transform."""
    return 1.0 / (1.0 + np.exp(-np.asarray(x)))


def _safe_mean(values: Iterable[float]) -> float:
    arr = np.asarray(list(values), dtype=float)
    if arr.size == 0:
        return np.nan
    return np.nanmean(arr)


def _compute_vif(exog: pd.DataFrame) -> List[float]:
    """
    Compute VIF for each column in exog (no intercept column expected).
    If matrix is singular or too few cols, return NaNs.
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
    """Detect rank deficiency (aliasing)."""
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
    Fit OLS: dep_var ~ indep_vars (with missing='drop'), compute diagnostics,
    and return a flat dict mirroring the R outputs.
    Note: Durbin-Watson p-value is not directly available in statsmodels; we return NaN for it.
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

    # Durbin-Watson (stat only; p-value not provided by statsmodels)
    try:
        dw_stat = float(durbin_watson(resid))
        dw_p = np.nan
    except Exception:
        dw_stat, dw_p = np.nan, np.nan

    # Breusch-Godfrey up to max order
    bg_pvals = []
    for order in range(1, max_bg_order + 1):
        try:
            _, pval, _, _ = acorr_breusch_godfrey(model, nlags=order)
            bg_pvals.append(float(pval))
        except Exception:
            bg_pvals.append(np.nan)

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

    # Intercept
    result["intercept"] = get_or_nan(params, "Intercept")
    result["stderr_intercept"] = get_or_nan(bse, "Intercept")
    result["t-value_intercept"] = get_or_nan(tvals, "Intercept")
    result["p-value_intercept"] = get_or_nan(pvals, "Intercept")

    # Each X
    for i, x in enumerate(indep_vars, start=1):
        result[f"coeff_X{i}"] = get_or_nan(params, x)
        result[f"stderr_X{i}"] = get_or_nan(bse, x)
        result[f"t-value_X{i}"] = get_or_nan(tvals, x)
        result[f"p-value_X{i}"] = get_or_nan(pvals, x)

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

    # Tests
    result["ST_pval"] = shapiro_p
    result["BT_pval"] = lb_p
    result["BP_pval"] = bp_p
    result["DW_stat"] = dw_stat
    result["DW_pval"] = dw_p  # not available; left as NaN

    for order, p in enumerate(bg_pvals, start=1):
        result[f"BG_order{order}_pval"] = p

    return result


# -----------------------
# Step 4 — run MFA (loop)
# -----------------------

def run_mfa(
    dep_var: str,
    combinations: np.ndarray,  # shape: (n_combos, k)
    regression_data: pd.DataFrame,
    max_bg_order: int,
    out_csv_path: Path,
    flush_every: int = 100,  # write to disk every N rows to keep memory in check
) -> None:
    """
    Sequentially evaluate each combination, compute stats, and append to CSV.
    """
    out_csv_path.parent.mkdir(parents=True, exist_ok=True)

    buffer: List[Dict[str, Any]] = []
    total = combinations.shape[0]
    global_index = 1  # Start index from 1

    print('combinations shape', combinations)
    print(total)

    for i, combo in enumerate(combinations, start=1):
        indep_vars = list(combo)
        try:
            row = write_model_stats_for_combo(
                indep_vars=indep_vars,
                dep_var=dep_var,
                lr_data=regression_data,
                max_bg_order=max_bg_order,
            )
            # Add custom index starting from 1
            row["index"] = global_index
            buffer.append(row)
            global_index += 1
        except Exception as e:
            # Keep going — log minimally to stdout
            print(f"[{i}/{total}] Failed on {indep_vars}: {e}", file=sys.stderr)

        if len(buffer) >= flush_every:
            df = pd.DataFrame(buffer)
            # Reorder columns to put 'index' first
            cols = ['index'] + [col for col in df.columns if col != 'index']
            df = df[cols]
            write_mode = "a" if out_csv_path.exists() else "w"
            header = not out_csv_path.exists()
            df.to_csv(out_csv_path, mode=write_mode, header=header, index=False)
            buffer.clear()
            print(f"Flushed up to combo {i}/{total} -> {out_csv_path}")

    # # final flush
    if buffer:
        df = pd.DataFrame(buffer)
        # Reorder columns to put 'index' first
        cols = ['index'] + [col for col in df.columns if col != 'index']
        df = df[cols]
        write_mode = "a" if out_csv_path.exists() else "w"
        header = not out_csv_path.exists()
        df.to_csv(out_csv_path, mode=write_mode, header=header, index=False)
        buffer.clear()
        print(f"Final flush -> {out_csv_path}")


# -------------
# Example usage
# -------------
def main(workload: dict):
    # Mirrors your R variables
    portfolio = workload.loan_product
    ODR = "AFC_ODR.logit"

    # Step 1 — load data
    x_df, y_df, regression_data, x_names, y_names = load_transformed_data(portfolio)

    # (Optional) inspect like R's colnames/head
    # print(list(regression_data.columns))
    # print(regression_data.head(10))

    # Step 2 — load combinations to run
    num_vars_taken = 2
    # In R you slice to 4,000,000; you can set limit=None to run all
    mfa_runs = load_combinations(
        portfolio=portfolio,
        num_vars_taken=num_vars_taken,
        limit=None,
    )
    num_comb = mfa_runs.shape[0]
    print(f"Number of combinations: {num_comb}")

    # Step 3 — set BG test max order
    max_bgtest_order = 2

    # Step 4 — run MFA (sequential; no background task)
    pid = os.getpid()
    timestamp = time.strftime("%m%d%Y_%H%M%S")
    out_csv = Path("Outputs") / portfolio / f"mfa_{ODR}_{num_vars_taken}-var_{pid}_{timestamp}.csv"

    run_mfa(
        dep_var=ODR,
        combinations=mfa_runs,
        regression_data=regression_data,
        max_bg_order=max_bgtest_order,
        out_csv_path=out_csv,
        flush_every=100,  # adjust as you like
    )
