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
    
    This function applies filtering criteria to MFA (Multifactor Analysis) results.
    Only filters explicitly provided in parsed_filter_list are applied. No default filters.
    
    Filter rules must include:
    - 'column': Column name to filter (case-insensitive)
    - 'value': Threshold value (string, "0" to disable)
    - 'operator': Comparison operator (required): >, <, >=, <=, ==, !=
    
    Supported filter types:
    - Scalar filters: max_abs_cor, R_Squared, MAPE, Adj_R_Squared, and any custom column
    - "If all" filters: p-value columns (all must pass condition), VIF columns (all must pass condition)
    - X column filters: Exclude rows with lagged variables (containing ".lag_")
    
    The function merges the result file with combinations data to get max_abs_cor values,
    then applies only the filters specified in parsed_filter_list, and finally sorts by Adj_R_Squared descending.
    
    Args:
        fn (Path): Path to the MFA result CSV file to filter
        combos_df (pd.DataFrame): DataFrame with variable combinations and max_abs_cor values
        num_vars_taken (int): Number of variables in each combination (determines X1..Xk columns)
        parsed_filter_list (List[Dict[str, str]]): List of filter rules. Each rule must have:
            - 'column': Column name (required)
            - 'value': Threshold value as string (required, "0" to disable)
            - 'operator': Comparison operator (required): >, <, >=, <=, ==, !=
    
    Returns:
        pd.DataFrame: Filtered DataFrame sorted by Adj_R_Squared descending, with 'index' column first
    
    Raises:
        KeyError: If required columns are missing after merge
        ValueError: If filter rules are missing required 'operator' field or have invalid operator
    """
    df = pd.read_csv(fn, low_memory=False)
    print(df)

    # Helper function to find column case-insensitively (defined early for use in merge)
    def find_column(df: pd.DataFrame, col_name: str) -> str | None:
        """Find column name in DataFrame case-insensitively."""
        col_lower = col_name.lower()
        for col in df.columns:
            if col.lower() == col_lower:
                return col
        return None

    # Merge with combinations on X1..Xk to bring in max_abs_cor (case-insensitive matching)
    # Find actual column names in both dataframes case-insensitively
    on_cols_df = []  # Column names in df
    on_cols_combos = []  # Column names in combos_df
    missing_on = []
    
    for i in range(1, num_vars_taken + 1):
        x_name = f"X{i}"
        df_col = find_column(df, x_name)
        combos_col = find_column(combos_df, x_name)
        
        if df_col is None:
            missing_on.append(x_name)
        else:
            on_cols_df.append(df_col)
            # Use the same column name from combos_df, or use df_col if not found
            if combos_col:
                on_cols_combos.append(combos_col)
            else:
                on_cols_combos.append(df_col)  # Fallback to df column name
    
    print(f"Merge columns in df: {on_cols_df}")
    print(f"Merge columns in combos_df: {on_cols_combos}")
    
    if missing_on:
        raise KeyError(f"File {fn} is missing key columns for join: {missing_on}")

    # Perform merge using actual column names (case-insensitive matching already done)
    # If column names differ between dataframes, we need to rename them
    if on_cols_df != on_cols_combos:
        # Create a mapping for renaming combos_df columns to match df columns
        rename_map = {combos_col: df_col for combos_col, df_col in zip(on_cols_combos, on_cols_df)}
        combos_df_renamed = combos_df.rename(columns=rename_map)
        merged = df.merge(combos_df_renamed, on=on_cols_df, how="left", validate="m:1")
    else:
        merged = df.merge(combos_df, on=on_cols_df, how="left", validate="m:1")

    print(merged)
    print('merged.columns', merged.columns)

    def find_columns_by_prefix(df: pd.DataFrame, prefix: str) -> List[str]:
        """Find all columns that start with a given prefix (case-insensitive)."""
        prefix_lower = prefix.lower()
        return [c for c in df.columns if c.lower().startswith(prefix_lower)]

    # Build subsets for "if_all" logic (case-insensitive)
    # Find X columns case-insensitively from merged dataframe
    x_cols = []
    for i in range(1, num_vars_taken + 1):
        x_col = find_column(merged, f"X{i}")
        if x_col:
            x_cols.append(x_col)
    
    # Find p-value and VIF columns case-insensitively
    pval_cols = find_columns_by_prefix(merged, "p-value")
    if not pval_cols:
        pval_cols = find_columns_by_prefix(merged, "p_value")
    vif_cols = find_columns_by_prefix(merged, "vif")

    # Required columns for scalar filters (check case-insensitively)
    required_cols_map = {}
    for req in ["max_abs_cor", "R_Squared", "MAPE", "Adj_R_Squared"]:
        found_col = find_column(merged, req)
        if found_col is None:
            raise KeyError(f"Required column '{req}' not found after merge in {fn}")
        required_cols_map[req.lower()] = found_col

    # Start with a mask of all True (no filtering initially)
    mask = pd.Series([True] * len(merged), index=merged.index)

    # Validate filter list structure - operator is required
    valid_operators = [">", "<", ">=", "<=", "==", "!="]
    if parsed_filter_list:
        for filter_rule in parsed_filter_list:
            column_name = filter_rule.get("column", "").strip()
            operator = filter_rule.get("operator", "").strip() if filter_rule.get("operator") else ""
            
            if not operator:
                raise ValueError(f"Filter rule for column '{column_name}' is missing required 'operator' field")
            
            if operator not in valid_operators:
                raise ValueError(f"Filter rule for column '{column_name}' has invalid operator '{operator}'. Valid operators are: {', '.join(valid_operators)}")

    # Helper function to apply operator dynamically
    def apply_operator(data: pd.Series | pd.DataFrame, threshold: float, operator: str) -> pd.Series | pd.DataFrame:
        """
        Apply a comparison operator to a series or dataframe with a threshold.
        
        Args:
            data (pd.Series | pd.DataFrame): Series or DataFrame to compare
            threshold (float): Threshold value
            operator (str): Comparison operator (>, <, >=, <=, ==, !=)
        
        Returns:
            pd.Series | pd.DataFrame: Boolean Series/DataFrame where True means condition passed
        """
        numeric_data = pd.to_numeric(data, errors="coerce") if isinstance(data, pd.Series) else to_float_df(data)
        
        if operator == ">":
            return numeric_data > threshold
        elif operator == "<":
            return numeric_data < threshold
        elif operator == ">=":
            return numeric_data >= threshold
        elif operator == "<=":
            return numeric_data <= threshold
        elif operator == "==":
            return numeric_data == threshold
        elif operator == "!=":
            return numeric_data != threshold
        else:
            raise ValueError(f"Invalid operator: {operator}")

    # Helper function to find filter rule from parsed_filter_list
    def get_filter_rule(column_name: str) -> Dict[str, str] | None:
        """
        Get filter rule for a column from parsed_filter_list.
        
        Args:
            column_name (str): Name of the column to find filter for
        
        Returns:
            Dict[str, str] | None: Filter rule dict with 'column', 'value', 'operator', or None if not found
        """
        if not parsed_filter_list:
            return None
        
        for filter_rule in parsed_filter_list:
            filter_col = filter_rule.get("column", "").strip().lower()
            if filter_col == column_name.lower():
                return filter_rule
        return None

    # Apply filters only for columns explicitly in payload
    # max_abs_cor filter
    max_abs_cor_rule = get_filter_rule("max_abs_cor")
    if max_abs_cor_rule:
        value_str = str(max_abs_cor_rule.get("value", "0")).strip()
        if value_str and value_str != "0":
            try:
                threshold = float(value_str)
                operator = max_abs_cor_rule.get("operator", "").strip()
                max_abs_cor_col = required_cols_map["max_abs_cor"]
                mask &= apply_operator(merged[max_abs_cor_col], threshold, operator)
            except (ValueError, TypeError) as e:
                print(f"Warning: Invalid filter value '{value_str}' for column 'max_abs_cor', skipping")

    # R_Squared filter
    r_squared_rule = get_filter_rule("r_squared")
    if r_squared_rule:
        value_str = str(r_squared_rule.get("value", "0")).strip()
        if value_str and value_str != "0":
            try:
                threshold = float(value_str)
                operator = r_squared_rule.get("operator", "").strip()
                r_squared_col = required_cols_map["r_squared"]
                mask &= apply_operator(merged[r_squared_col], threshold, operator)
            except (ValueError, TypeError) as e:
                print(f"Warning: Invalid filter value '{value_str}' for column 'R_Squared', skipping")

    # MAPE filter
    mape_rule = get_filter_rule("mape")
    if mape_rule:
        value_str = str(mape_rule.get("value", "0")).strip()
        if value_str and value_str != "0":
            try:
                threshold = float(value_str)
                operator = mape_rule.get("operator", "").strip()
                mape_col = required_cols_map["mape"]
                mask &= apply_operator(merged[mape_col], threshold, operator)
            except (ValueError, TypeError) as e:
                print(f"Warning: Invalid filter value '{value_str}' for column 'MAPE', skipping")

    # Apply "if_all" logic for p-value columns
    # Check if any p-value filter exists in parsed_filter_list
    pval_filters = []
    if parsed_filter_list:
        pval_filters = [f for f in parsed_filter_list 
                       if f.get("column", "").strip().lower().startswith("p-value") 
                       or f.get("column", "").strip().lower().startswith("p_value")]
    
    if pval_cols and pval_filters:
        # Get the threshold and operator from the first p-value filter with non-zero value
        pval_threshold = None
        pval_operator = None
        for f in pval_filters:
            val = str(f.get("value", "0")).strip()
            if val and val != "0":
                try:
                    pval_threshold = float(val)
                    pval_operator = f.get("operator", "").strip()
                    break
                except (ValueError, TypeError):
                    pass
        
        # Only apply filter if a valid threshold was found (skip if all values are "0")
        if pval_threshold is not None and pval_operator:
            mask &= rowwise_all(to_float_df(merged[pval_cols]), lambda d: apply_operator(d, pval_threshold, pval_operator))

    # Apply "if_all" logic for vif columns
    # Check if any vif filter exists in parsed_filter_list
    vif_filters = []
    if parsed_filter_list:
        vif_filters = [f for f in parsed_filter_list 
                      if f.get("column", "").strip().lower().startswith("vif")]
    
    if vif_cols and vif_filters:
        # Get the threshold and operator from the first vif filter with non-zero value
        vif_threshold = None
        vif_operator = None
        for f in vif_filters:
            val = str(f.get("value", "0")).strip()
            if val and val != "0":
                try:
                    vif_threshold = float(val)
                    vif_operator = f.get("operator", "").strip()
                    break
                except (ValueError, TypeError):
                    pass
        
        # Only apply filter if a valid threshold was found (skip if all values are "0")
        if vif_threshold is not None and vif_operator:
            mask &= rowwise_all(to_float_df(merged[vif_cols]), lambda d: apply_operator(d, vif_threshold, vif_operator))

    # Apply other filters from parsed_filter_list (excluding the ones we already handled)
    if parsed_filter_list:
        handled_columns = {"max_abs_cor", "r_squared", "mape", "adj_r_squared"}
        for filter_rule in parsed_filter_list:
            column_name = filter_rule.get("column", "").strip().lower()
            value_str = str(filter_rule.get("value", "0")).strip()
            
            # Skip if value is "0" or empty (no filter)
            if not value_str or value_str == "0":
                continue
            
            # Skip columns we already handled
            if column_name in handled_columns:
                continue
            
            # Skip p-value and vif columns (handled above)
            if column_name.startswith("p-value") or column_name.startswith("p_value") or column_name.startswith("vif"):
                continue
            
            # IMPORTANT: Skip X1, X2, X3, etc. columns - these are variable names, not numeric values to filter
            # X columns should accept ALL values. Only the lag filter (below) can exclude based on variable name patterns.
            if column_name.startswith("x") and len(column_name) > 1 and column_name[1:].isdigit():
                # X columns are never filtered by numeric thresholds - they contain variable names, not values
                continue
            
            # Get operator from filter rule
            operator = filter_rule.get("operator", "").strip()
            if not operator:
                print(f"Warning: Filter rule for column '{column_name}' is missing operator, skipping")
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
            
            # Apply filter with operator from payload
            mask &= apply_operator(merged[matching_col], threshold, operator)

    # Apply X column filter (ONLY filter that affects X columns - checks variable name patterns, not numeric values)
    # This is the ONLY filter that can exclude models based on X columns.
    # X columns (X1, X2, X3, etc.) contain variable names (strings), not numeric values, so they are never filtered by thresholds.
    # This filter only checks if variable names contain ".lag_" substring pattern.
    x_filters = [f for f in parsed_filter_list if f.get("column", "").strip().lower().startswith("x")]
    if x_cols and x_filters:
        # Check if any X filter has a non-zero value (meaning we should apply the lag filter)
        should_apply_lag_filter = any(f.get("value", "0") != "0" for f in x_filters)
        if should_apply_lag_filter:
            # Exclude rows where ALL X columns contain ".lag_" in their variable names
            # This filters based on variable name patterns, NOT numeric values
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
