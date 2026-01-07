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
    """
    Load the combinations CSV file containing variable combinations and their maximum absolute correlations.
    
    This function reads a CSV file that contains pre-computed variable combinations (X1, X2, ..., Xk)
    along with their maximum absolute correlation values (max_abs_cor). This file is generated during
    the data transformation step and is used to filter models based on correlation thresholds.
    
    Args:
        combos_csv (Path): Path to the combinations CSV file
    
    Returns:
        pd.DataFrame: DataFrame containing variable combinations and max_abs_cor values
    
    Raises:
        FileNotFoundError: If the combinations file does not exist
    """
    if not combos_csv.exists():
        raise FileNotFoundError(f"Combinations file not found: {combos_csv}")
    # Expected to contain X1..Xk and max_abs_cor
    df = pd.read_csv(combos_csv)
    return df


# -------------------------------------------------------
# Helpers — column selectors and “if_all”-style filters
# -------------------------------------------------------

def cols_starting_with(df: pd.DataFrame, prefix: str) -> List[str]:
    """
    Find all column names that start with a given prefix.
    
    Used to identify columns like "p-value", "vif", etc. that may have variations
    in naming (e.g., "p-value_X1", "p-value_X2").
    
    Args:
        df (pd.DataFrame): DataFrame to search
        prefix (str): Prefix to match
    
    Returns:
        List[str]: List of column names starting with the prefix
    """
    return [c for c in df.columns if c.startswith(prefix)]

def all_values_lt(series: pd.Series, threshold: float) -> pd.Series:
    """
    Check if all values in a series are less than a threshold.
    
    Returns a boolean Series where True indicates values < threshold.
    NaN values are treated as False (fail the condition).
    
    Args:
        series (pd.Series): Series to check
        threshold (float): Threshold value
    
    Returns:
        pd.Series: Boolean Series indicating which values are < threshold
    """
    return series.astype(float) < threshold

def rowwise_all(df_subset: pd.DataFrame, predicate) -> pd.Series:
    """
    Apply a predicate elementwise and require all True per row.
    
    This function applies a predicate function to each element in a DataFrame subset,
    then checks if all values in each row are True. NaNs count as False, meaning rows
    with any NaN will fail the 'all' check.
    
    Used for "if_all" filtering logic where all columns must meet a condition.
    
    Args:
        df_subset (pd.DataFrame): DataFrame subset to check
        predicate: Function that takes a DataFrame and returns a boolean DataFrame
    
    Returns:
        pd.Series: Boolean Series where True means all values in that row passed the predicate
    """
    mask = predicate(df_subset)
    # Ensure boolean DataFrame
    mask = mask.fillna(False).astype(bool)
    return mask.all(axis=1)

def rowwise_all_str_contains(df_subset: pd.DataFrame, needle: str) -> pd.Series:
    """
    Check if all columns in each row contain a specific string.
    
    Used to filter rows where all specified columns contain a substring (e.g., ".lag_"
    to exclude lagged variables).
    
    Args:
        df_subset (pd.DataFrame): DataFrame subset to check
        needle (str): String to search for in each cell
    
    Returns:
        pd.Series: Boolean Series where True means all columns in that row contain the needle
    """
    return df_subset.apply(lambda s: s.astype(str).str.contains(needle, regex=False)).all(axis=1)

def to_float_df(d: pd.DataFrame) -> pd.DataFrame:
    """
    Convert all columns in a DataFrame to numeric (float) type.
    
    Attempts to convert each column to numeric, coercing errors to NaN.
    Used to ensure numeric operations can be performed on filter columns.
    
    Args:
        d (pd.DataFrame): DataFrame to convert
    
    Returns:
        pd.DataFrame: DataFrame with all columns converted to float (NaN for non-numeric values)
    """
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
    """
    Filter a single MFA result file based on specified criteria.
    
    This function applies multiple filtering criteria to MFA (Multifactor Analysis) results:
    - Scalar filters: max_abs_cor, R_Squared, MAPE, Adj_R_Squared
    - "If all" filters: p-value columns (all must be < threshold), VIF columns (all must be < threshold)
    - X column filters: Exclude rows with lagged variables (containing ".lag_")
    - Custom filters from parsed_filter_list
    
    The function merges the result file with combinations data to get max_abs_cor values,
    then applies all filters sequentially, and finally sorts by Adj_R_Squared descending.
    
    Args:
        fn (Path): Path to the MFA result CSV file to filter
        combos_df (pd.DataFrame): DataFrame with variable combinations and max_abs_cor values
        num_vars_taken (int): Number of variables in each combination (determines X1..Xk columns)
        parsed_filter_list (List[Dict[str, str]]): List of filter rules with 'column' and 'value' keys.
            Values of "0" or empty mean no filter. Supports custom thresholds for any column.
    
    Returns:
        pd.DataFrame: Filtered DataFrame sorted by Adj_R_Squared descending, with 'index' column first
    
    Raises:
        KeyError: If required columns are missing after merge
    """
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

    # Build subsets for "if_all" logic
    # Keep the exact prefixes used in your CSVs; add underscore variants as fallback (case-insensitive).
    pval_cols = [c for c in merged.columns if c.lower().startswith("p-value")]
    if not pval_cols:
        pval_cols = [c for c in merged.columns if c.lower().startswith("p_value")]
    vif_cols = [c for c in merged.columns if c.lower().startswith("vif")]
    x_cols   = on_cols  # check X1..Xk names for '.lag_'

    # Helper function to find column case-insensitively
    def find_column(df: pd.DataFrame, col_name: str) -> str | None:
        """Find column name in DataFrame case-insensitively."""
        col_lower = col_name.lower()
        for col in df.columns:
            if col.lower() == col_lower:
                return col
        return None

    # Required columns for scalar filters (check case-insensitively)
    required_cols_map = {}
    for req in ["max_abs_cor", "R_Squared", "MAPE", "Adj_R_Squared"]:
        found_col = find_column(merged, req)
        if found_col is None:
            raise KeyError(f"Required column '{req}' not found after merge in {fn}")
        required_cols_map[req.lower()] = found_col

    # Start with a mask of all True (no filtering initially)
    mask = pd.Series([True] * len(merged), index=merged.index)

    # Helper function to find filter value from parsed_filter_list
    def get_filter_value(column_name: str, default_value: float = None) -> float | None:
        """
        Get filter value for a column from parsed_filter_list.
        
        Searches the parsed_filter_list for a matching column name (case-insensitive).
        Returns the threshold value if found and not "0", otherwise returns default_value.
        If value is "0", returns None to indicate no filter should be applied.
        
        Args:
            column_name (str): Name of the column to find filter for
            default_value (float, optional): Default threshold if not found in filter list
        
        Returns:
            float | None: Filter threshold value, or None if no filter should be applied
        """
        if not parsed_filter_list:
            return default_value
        
        for filter_rule in parsed_filter_list:
            filter_col = filter_rule.get("column", "").strip().lower()
            if filter_col == column_name.lower():
                value_str = str(filter_rule.get("value", "0")).strip()
                if value_str and value_str != "0":
                    try:
                        return float(value_str)
                    except (ValueError, TypeError):
                        pass
                # If value is "0", return None to disable filter
                return None
        return default_value

    # Apply default filters for max_abs_cor, R_Squared, and MAPE if not in parsed_filter_list
    max_abs_cor_threshold = get_filter_value("max_abs_cor", default_value=0.9)
    if max_abs_cor_threshold is not None:
        max_abs_cor_col = required_cols_map["max_abs_cor"]
        mask &= pd.to_numeric(merged[max_abs_cor_col], errors="coerce") < max_abs_cor_threshold

    r_squared_threshold = get_filter_value("r_squared", default_value=0.5)
    if r_squared_threshold is not None:
        r_squared_col = required_cols_map["r_squared"]
        mask &= pd.to_numeric(merged[r_squared_col], errors="coerce") > r_squared_threshold

    mape_threshold = get_filter_value("mape", default_value=0.5)
    if mape_threshold is not None:
        mape_col = required_cols_map["mape"]
        mask &= pd.to_numeric(merged[mape_col], errors="coerce") < mape_threshold

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
        
        # Only apply filter if a valid threshold was found (skip if all values are "0")
        if pval_threshold is not None:
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
        
        # Only apply filter if a valid threshold was found (skip if all values are "0")
        if vif_threshold is not None:
            mask &= rowwise_all(to_float_df(merged[vif_cols]), lambda d: d < vif_threshold)

    # Apply other filters from parsed_filter_list (excluding the ones we already handled)
    if parsed_filter_list:
        handled_columns = {"max_abs_cor", "r_squared", "mape", "adj_r_squared"}
        for filter_rule in parsed_filter_list:
            column_name = filter_rule.get("column", "").strip().lower()
            value_str = str(filter_rule.get("value", "0")).strip()
            
            # Skip if value is "0" or empty (no filter)
            if not value_str or value_str == "0":
                continue
            
            # Skip columns we already handled with defaults
            if column_name in handled_columns:
                continue
            
            # Skip p-value and vif columns (handled above)
            if column_name.startswith("p-value") or column_name.startswith("p_value") or column_name.startswith("vif"):
                continue
            
            # Convert value to float
            try:
                threshold = float(value_str)
            except (ValueError, TypeError):
                print(f"Warning: Invalid filter value '{value_str}' for column '{column_name}', skipping")
                continue
            
            # Find matching column in merged dataframe (case-insensitive)
            matching_col = find_column(merged, column_name)
            
            if matching_col is None:
                print(f"Warning: Column '{column_name}' not found in merged dataframe, skipping filter")
                continue
            
            # Apply filter based on column type
            matching_col_lower = matching_col.lower()
            if matching_col_lower in ["r_squared", "adj_r_squared"]:
                # R_Squared and Adj_R_Squared: filter > threshold
                mask &= pd.to_numeric(merged[matching_col], errors="coerce") > threshold
            elif matching_col_lower.startswith("x") and matching_col_lower[1:].isdigit():
                # X1, X2, etc. columns: special handling (skip for now, handled separately)
                pass
            else:
                # Default: apply > threshold for other columns (e.g., Y)
                mask &= pd.to_numeric(merged[matching_col], errors="coerce") > threshold

    # Apply X column filter (exclude rows where X columns contain ".lag_")
    x_filters = [f for f in parsed_filter_list if f.get("column", "").strip().lower().startswith("x")]
    if x_cols and x_filters:
        # Check if any X filter has a non-zero value (meaning we should apply the lag filter)
        should_apply_lag_filter = any(f.get("value", "0") != "0" for f in x_filters)
        if should_apply_lag_filter:
            # Exclude rows where X columns contain ".lag_"
            mask &= ~rowwise_all_str_contains(merged[x_cols], ".lag_")

    filtered = merged.loc[mask].copy()

    # Order by Adj_R_Squared desc (case-insensitive lookup)
    adj_r_squared_col = required_cols_map.get("adj_r_squared", find_column(filtered, "adj_r_squared"))
    if adj_r_squared_col:
        filtered = filtered.sort_values(adj_r_squared_col, ascending=False, kind="mergesort")
    
    # Ensure index column is preserved and positioned first
    if 'index' in filtered.columns:
        cols = ['index'] + [col for col in filtered.columns if col != 'index']
        filtered = filtered[cols]
    
    return filtered


# -------------------------------------------------------------
# Step 3 — run over all files and append to the single output
# -------------------------------------------------------------

def append_to_final_csv(df: pd.DataFrame, out_csv: Path) -> None:
    """
    Append a DataFrame to a CSV file, creating it if it doesn't exist.
    
    If the output file exists, appends data without header. If it doesn't exist,
    creates a new file with header. Skips if DataFrame is empty.
    
    Args:
        df (pd.DataFrame): DataFrame to append
        out_csv (Path): Path to output CSV file
    """
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
    """
    Main orchestration function to filter MFA results across all result files.
    
    This function:
    1. Loads the combinations file (with max_abs_cor) from data transformation output
    2. Finds the latest MFA results folder for the portfolio
    3. Processes all CSV files in that folder (001.csv, 002.csv, etc.)
    4. Applies filters to each file using filter_one_result_file()
    5. Appends all filtered results to a single output CSV file
    
    The output file is named: {portfolio}_mfa_filtered_{y_var}_{num_vars_taken}_var_{timestamp}.csv
    
    Args:
        portfolio (str): Portfolio/loan product name (e.g., "AFC")
        y_var (str): Dependent variable name (e.g., "AFC_ODR.logit")
        num_vars_taken (int): Number of variables in combinations (2, 3, etc.)
        data_transformation_path (str): Path to data transformation output folder
        data_multifactor_analysis_path (str): Path to MFA results folder
        data_filtering_of_models_path (str): Path where filtered results will be saved
        parsed_filter_list (List[Dict[str, str]]): List of filter rules to apply
    
    Raises:
        FileNotFoundError: If combinations file or MFA results folder not found
    """

    print('parsed_filter_list \n', parsed_filter_list)
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
