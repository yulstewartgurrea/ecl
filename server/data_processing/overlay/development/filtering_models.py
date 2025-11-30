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
from typing import List, Dict
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
    parsed_filter_list: List[Dict[str, str]]
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

    # Start with a mask of all True (no filtering initially)
    mask = pd.Series([True] * len(merged), index=merged.index)

    # Helper function to find filter value from parsed_filter_list
    def get_filter_value(column_name: str, default_value: float = None) -> float | None:
        """Get filter value for a column, or return None if not found or value is "0"."""
        if not parsed_filter_list:
            return default_value
        
        for filter_rule in parsed_filter_list:
            filter_col = filter_rule.get("column", "").strip()
            if filter_col.lower() == column_name.lower():
                value_str = str(filter_rule.get("value", "0")).strip()
                if value_str and value_str != "0":
                    try:
                        return float(value_str)
                    except (ValueError, TypeError):
                        pass
                break
        return default_value

    # Apply default filters for max_abs_cor, R_Squared, and MAPE if not in parsed_filter_list
    max_abs_cor_threshold = get_filter_value("max_abs_cor", default_value=0.9)
    if max_abs_cor_threshold is not None:
        mask &= pd.to_numeric(merged["max_abs_cor"], errors="coerce") < max_abs_cor_threshold

    r_squared_threshold = get_filter_value("R_Squared", default_value=0.5)
    if r_squared_threshold is not None:
        mask &= pd.to_numeric(merged["R_Squared"], errors="coerce") > r_squared_threshold

    mape_threshold = get_filter_value("MAPE", default_value=0.5)
    if mape_threshold is not None:
        mask &= pd.to_numeric(merged["MAPE"], errors="coerce") < mape_threshold

    # Apply "if_all" logic for p-value columns
    # Check if any p-value filter exists in parsed_filter_list
    pval_filters = []
    if parsed_filter_list:
        pval_filters = [f for f in parsed_filter_list 
                       if f.get("column", "").strip().lower().startswith("p-value") 
                       or f.get("column", "").strip().lower().startswith("p_value")]
    
    if pval_cols:
        pval_threshold = None
        if pval_filters:
            # Get the threshold from the first p-value filter with non-zero value
            for f in pval_filters:
                val = str(f.get("value", "0")).strip()
                if val and val != "0":
                    try:
                        pval_threshold = float(val)
                        break
                    except (ValueError, TypeError):
                        pass
        
        # Apply default if no valid p-value filter found
        if pval_threshold is None:
            pval_threshold = 0.1  # Default threshold
        
        mask &= rowwise_all(to_float_df(merged[pval_cols]), lambda d: d < pval_threshold)

    # Apply "if_all" logic for vif columns
    # Check if any vif filter exists in parsed_filter_list
    vif_filters = []
    if parsed_filter_list:
        vif_filters = [f for f in parsed_filter_list 
                      if f.get("column", "").strip().lower().startswith("vif")]
    
    if vif_cols:
        vif_threshold = None
        if vif_filters:
            # Get the threshold from the first vif filter with non-zero value
            for f in vif_filters:
                val = str(f.get("value", "0")).strip()
                if val and val != "0":
                    try:
                        vif_threshold = float(val)
                        break
                    except (ValueError, TypeError):
                        pass
        
        # Apply default if no valid vif filter found
        if vif_threshold is None:
            vif_threshold = 5.0  # Default threshold
        
        mask &= rowwise_all(to_float_df(merged[vif_cols]), lambda d: d < vif_threshold)

    # Apply other filters from parsed_filter_list (excluding the ones we already handled)
    if parsed_filter_list:
        handled_columns = {"max_abs_cor", "r_squared", "mape", "adj_r_squared"}
        for filter_rule in parsed_filter_list:
            column_name = filter_rule.get("column", "").strip()
            value_str = str(filter_rule.get("value", "0")).strip()
            
            # Skip if value is "0" or empty (no filter)
            if not value_str or value_str == "0":
                continue
            
            # Skip columns we already handled with defaults
            if column_name.lower() in handled_columns:
                continue
            
            # Skip p-value and vif columns (handled above)
            col_lower = column_name.lower()
            if col_lower.startswith("p-value") or col_lower.startswith("p_value") or col_lower.startswith("vif"):
                continue
            
            # Convert value to float
            try:
                threshold = float(value_str)
            except (ValueError, TypeError):
                print(f"Warning: Invalid filter value '{value_str}' for column '{column_name}', skipping")
                continue
            
            # Find matching column in merged dataframe (case-insensitive, exact match preferred)
            matching_col = None
            for col in merged.columns:
                if col == column_name:
                    matching_col = col
                    break
                elif col.lower() == column_name.lower():
                    matching_col = col
                    break
            
            if matching_col is None:
                print(f"Warning: Column '{column_name}' not found in merged dataframe, skipping filter")
                continue
            
            # Apply filter based on column type
            matching_col_lower = matching_col.lower()
            if matching_col_lower in ["r_squared", "adj_r_squared"]:
                # R_Squared and Adj_R_Squared: filter > threshold
                mask &= pd.to_numeric(merged[matching_col], errors="coerce") > threshold
            elif matching_col.startswith("X") and matching_col[1:].isdigit():
                # X1, X2, etc. columns: special handling (skip for now, handled separately)
                pass
            else:
                # Default: apply > threshold for other columns (e.g., Y)
                mask &= pd.to_numeric(merged[matching_col], errors="coerce") > threshold

    # Apply X column filter (exclude rows where X columns contain ".lag_")
    x_filters = [f for f in parsed_filter_list if f.get("column", "").startswith("X")]
    if x_cols and x_filters:
        # Check if any X filter has a non-zero value (meaning we should apply the lag filter)
        should_apply_lag_filter = any(f.get("value", "0") != "0" for f in x_filters)
        if should_apply_lag_filter:
            # Exclude rows where X columns contain ".lag_"
            mask &= ~rowwise_all_str_contains(merged[x_cols], ".lag_")

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
    data_filtering_of_models_path: str,
    parsed_filter_list: List[Dict[str, str]]
) -> None:
    data_transformation_path = Path(data_transformation_path)
    data_transformation_path_file = max(
        data_transformation_path.glob(f"{portfolio}_{num_vars_taken}-var_combinations*"),
        key=lambda p: p.stat().st_mtime,   # last modified time
        default=None
    )
    print(data_transformation_path_file)

    combos_df = load_combinations_df(data_transformation_path_file)
    
    # Find the latest folder in multifactor analysis path
    data_multifactor_analysis_path = Path(data_multifactor_analysis_path)
    
    # Look for folders matching the pattern (folder-based approach)
    # Pattern: {portfolio}_mfa_*_*-var_*
    mfa_folders = list(data_multifactor_analysis_path.glob(f"{portfolio}_mfa_*_*-var_*"))
    
    if not mfa_folders:
        raise FileNotFoundError(f"No MFA results folder found for portfolio {portfolio} in {data_multifactor_analysis_path}")
    
    # Get the most recent folder (by modification time)
    latest_folder = max(mfa_folders, key=lambda p: p.stat().st_mtime)
    print(f"Processing files from latest folder: {latest_folder}")
    
    # Find all CSV files in the folder (001.csv, 002.csv, etc.)
    csv_files = sorted(latest_folder.glob("*.csv"), key=lambda p: p.name)
    
    if not csv_files:
        raise FileNotFoundError(f"No CSV files found in MFA results folder: {latest_folder}")
    
    print(f"Found {len(csv_files)} CSV files to process")
    
    # Create output file path
    output_file = Path(data_filtering_of_models_path) / f"{portfolio}_mfa_filtered_{y_var}_{num_vars_taken}_var_{get_time_date()}.csv"
    
    # Loop through each CSV file and process it
    for csv_file in csv_files:
        print(f"Processing file: {csv_file.name}")
        try:
            # Filter the current file
            filtered_df = filter_one_result_file(csv_file, combos_df, num_vars_taken, parsed_filter_list)
            
            # Append filtered results to the final CSV
            if not filtered_df.empty:
                append_to_final_csv(filtered_df, output_file)
                print(f"  -> Added {len(filtered_df)} filtered rows from {csv_file.name}")
            else:
                print(f"  -> No rows passed filters for {csv_file.name}")
        except Exception as e:
            print(f"  -> Error processing {csv_file.name}: {str(e)}")
            # Continue processing other files even if one fails
            continue
    
    print(f"Filtering complete. Results saved to: {output_file}")
