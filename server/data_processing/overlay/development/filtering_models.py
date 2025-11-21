"""
IV. Filter models — Python port of the R script
- Step 1: config & paths
- Step 2: load combinations (with max_abs_cor)
- Step 3: find all unfiltered MFA result files
- Step 4: filter one file (merge + screens)
- Step 5: run over all files and append to final CSV
"""

from __future__ import annotations

from pathlib import Path
from typing import List
import re
import pandas as pd

from helpers.get_time_date import get_time_date

# ---------------------------------------------------
# Step 1 — load combinations (with max_abs_cor, etc.)
# ---------------------------------------------------

def load_combinations_df(combos_csv: Path) -> pd.DataFrame:
    if not combos_csv.exists():
        raise FileNotFoundError(f"Combinations file not found: {combos_csv}")
    # Expected to contain X1..Xk and max_abs_cor
    df = pd.read_csv(combos_csv)
    return df


# -------------------------------------------------------
# Helpers — column selectors and “if_all”-style filters
# -------------------------------------------------------

def cols_starting_with(df: pd.DataFrame, prefix: str) -> List[str]:
    return [c for c in df.columns if c.startswith(prefix)]

def all_values_lt(series: pd.Series, threshold: float) -> pd.Series:
    """Return a boolean Series for (values < threshold), NaN treated as False."""
    return series.astype(float) < threshold

def rowwise_all(df_subset: pd.DataFrame, predicate) -> pd.Series:
    """
    Apply a predicate elementwise and require all True per row.
    NaNs count as False (i.e., will fail the 'all' unless handled beforehand).
    """
    mask = predicate(df_subset)
    # Ensure boolean DataFrame
    mask = mask.fillna(False).astype(bool)
    return mask.all(axis=1)

def rowwise_all_str_contains(df_subset: pd.DataFrame, needle: str) -> pd.Series:
    return df_subset.apply(lambda s: s.astype(str).str.contains(needle, regex=False)).all(axis=1)

def to_float_df(d: pd.DataFrame) -> pd.DataFrame:
    return d.apply(pd.to_numeric, errors="coerce")
    
# -------------------------------------------------------
# Step 2 — filter a single file and return filtered frame
# -------------------------------------------------------

def filter_one_result_file(
    fn: Path,
    combos_df: pd.DataFrame,
    num_vars_taken: int,
) -> pd.DataFrame:
    df = pd.read_csv(fn, low_memory=False)
    print(df)

    # Merge with combinations on X1..Xk to bring in max_abs_cor
    on_cols = [f"X{i}" for i in range(1, num_vars_taken + 1)]
    print(on_cols)
    missing_on = [c for c in on_cols if c not in df.columns]
    print(missing_on)
    if missing_on:
        raise KeyError(f"File {fn} is missing key columns for join: {missing_on}")

    merged = df.merge(combos_df, on=on_cols, how="left", validate="m:1")

    print(merged)
    print('merged.columns', merged.columns)

    # Build subsets for “if_all” logic
    # Keep the exact prefixes used in your CSVs; add underscore variants as fallback.
    pval_cols = [c for c in merged.columns if c.startswith("p-value")]
    if not pval_cols:
        pval_cols = [c for c in merged.columns if c.startswith("p_value")]
    vif_cols = [c for c in merged.columns if c.startswith("vif")]
    x_cols   = on_cols  # check X1..Xk names for '.lag_'

    # Required columns for scalar filters
    for req in ["max_abs_cor", "R_Squared", "MAPE", "Adj_R_Squared"]:
        if req not in merged.columns:
            raise KeyError(f"Required column '{req}' not found after merge in {fn}")

    # Compose mask (mirrors the R filter)
    mask = (
        (pd.to_numeric(merged["max_abs_cor"], errors="coerce") < 0.9)
        & (pd.to_numeric(merged["R_Squared"],   errors="coerce") > 0.5)
        & (pd.to_numeric(merged["MAPE"],        errors="coerce") < 0.5)
    )

    # if_all(starts_with("p-value"), ~ (.x < 0.1))
    if pval_cols:
        mask &= rowwise_all(to_float_df(merged[pval_cols]), lambda d: d < 0.1)

    # if_all(starts_with("vif"), ~ (.x < 5))
    # Temporarily commented to have values
    # if vif_cols:
    #     mask &= rowwise_all(to_float_df(merged[vif_cols]), lambda d: d < 5.0)

    # # if_all(starts_with("X"), ~ str_detect(.lag_)) — literal '.lag_' as per your convention
    # if x_cols:
    #     mask &= rowwise_all_str_contains(merged[x_cols], ".lag_")

    filtered = merged.loc[mask].copy()

    # Order by Adj_R_Squared desc
    filtered = filtered.sort_values("Adj_R_Squared", ascending=False, kind="mergesort")
    
    # Ensure index column is preserved and positioned first
    if 'index' in filtered.columns:
        cols = ['index'] + [col for col in filtered.columns if col != 'index']
        filtered = filtered[cols]
    
    return filtered


# -------------------------------------------------------------
# Step 3 — run over all files and append to the single output
# -------------------------------------------------------------

def append_to_final_csv(df: pd.DataFrame, out_csv: Path) -> None:
    if df.empty:
        return
    mode = "a" if out_csv.exists() else "w"
    header = not out_csv.exists()
    df.to_csv(out_csv, mode=mode, header=header, index=False)

def run_filter_models(
    portfolio: str,
    y_var: str,
    num_vars_taken: int,
    data_transformation_path: str,
    data_multifactor_analysis_path: str,
    data_filtering_of_models_path: str
) -> None:
    data_transformation_path = Path(data_transformation_path)
    data_transformation_path_file = max(
        data_transformation_path.glob(f"{portfolio}_{num_vars_taken}-var_combinations*"),
        key=lambda p: p.stat().st_mtime,   # last modified time
        default=None
    )
    print(data_transformation_path_file)

    combos_df = load_combinations_df(data_transformation_path_file)
    
    data_multifactor_analysis_path = Path(data_multifactor_analysis_path)
    data_multifactor_analysis_file = max(
        data_multifactor_analysis_path.glob(f"{portfolio}_mfa_{y_var}_{num_vars_taken}-var_*"),
        key=lambda p: p.stat().st_mtime,   # last modified time
        default=None
    )
    print(data_multifactor_analysis_file)

    out_df = filter_one_result_file(data_multifactor_analysis_file, combos_df, num_vars_taken)
    print(out_df)

    output_file = Path(data_filtering_of_models_path) / f"{portfolio}_mfa_filtered_{y_var}_{num_vars_taken}_var_{get_time_date()}.csv"
    append_to_final_csv(out_df, output_file)
