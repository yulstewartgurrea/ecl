import os
import pandas as pd

def save_override_data_transformation_mevs_output(
    csv_data: dict,
    workflow_path: str = "",
    filename: str = None
):
    """
        Convert nested scenario JSON like:
        {
        "period": "...",
        "best": {"unemp_rate": "x", "gdp": "y"},
        "base": {"unemp_rate": "x2", "gdp": "y2"},
        ...
        }
        into a flat CSV with columns:
        period, best_unemp_rate, best_gdp, base_unemp_rate, base_gdp, ...
    """

    # Define the base files directory
    base_files_dir = "files"
    
    # Create the full directory path
    if workflow_path:
        full_dir_path = os.path.join(base_files_dir, workflow_path)
    else:
        full_dir_path = base_files_dir
    
    # Create directories if they don't exist
    os.makedirs(full_dir_path, exist_ok=True)
    
    # Create the full file path
    full_file_path = os.path.join(full_dir_path, filename)
    
    print('csv_data', csv_data)

    df = json_to_custom_table(csv_data)

    # Write CSV with 2-row header structure
    # Since df already has header rows as first two data rows, write without column names
    df.to_csv(full_file_path, index=False, header=False)
    print(f"Saved CSV to {workflow_path}")

    return workflow_path

def json_to_custom_table(json_data):
    # Determine all scenario names (e.g. upside, base, downside)
    scenarios = [key for key in json_data[0].keys() if key != "period"]

    # Collect all unique variable names from all scenarios
    all_variables = set()
    for item in json_data:
        for scenario in scenarios:
            if scenario in item and isinstance(item[scenario], dict):
                all_variables.update(item[scenario].keys())
    variables = sorted(list(all_variables))  # Sort for consistent column order

    # Build MultiIndex columns
    header_level0 = ["Period"]
    header_level1 = [""]
    for scenario in scenarios:
        header_level0 += [scenario.capitalize()] * len(variables)
        header_level1 += variables

    # Create MultiIndex
    multi_index = pd.MultiIndex.from_arrays([header_level0, header_level1])

    # Build data rows
    data_rows = []
    for item in json_data:
        row_data = [item["period"]]
        for scenario in scenarios:
            for var in variables:
                # Use .get(var, None) to handle cases where a variable might be missing in a specific scenario
                row_data.append(item[scenario].get(var, None))
        data_rows.append(row_data)

    # Create DataFrame with MultiIndex
    df = pd.DataFrame(data_rows, columns=multi_index)

    # Flatten MultiIndex to single-level columns like "Scenario Variable"
    # Handle "Period" column separately as it doesn't have a scenario
    new_columns = []
    for col_level0, col_level1 in df.columns:
        if col_level0 == "Period":
            new_columns.append("Period")
        else:
            new_columns.append(f"{col_level0} {col_level1}")
    df.columns = new_columns

    # Now create the 2-row header format for CSV output
    # Row 1: Period, then for each scenario: [scenario_name, "", ... (number of empty cells = number of variables - 1)]
    # Dynamic: number of empty cells after scenario name = len(variables) - 1
    header_row1 = ["Period"]
    for scenario in scenarios:
        header_row1.append(scenario.capitalize())
        # Add (number of variables - 1) empty cells after each scenario name
        for _ in range(len(variables) - 1):
            header_row1.append("")
    
    # Row 2: "", variable names for each scenario (starts with empty cell)
    # Structure: "", then for each scenario: variables directly (no empty cells between variables)
    header_row2 = [""]
    for _ in scenarios:
        header_row2.extend(variables)  # Variables for this scenario
    
    # Create new DataFrame with 2-row header
    # First, prepare data with proper column names from MultiIndex DataFrame
    # Data rows should match header structure: Period, then for each scenario: variables directly
    # The first variable goes under the scenario name, subsequent variables go under empty cells
    data_with_headers = []
    for _, row in df.iterrows():
        data_row = [row["Period"]]
        for scenario in scenarios:
            for var in variables:
                col_name = f"{scenario.capitalize()} {var}"
                # Get value from the MultiIndex-based DataFrame
                value = row[col_name]
                data_row.append(value)
        data_with_headers.append(data_row)
    
    # Create DataFrame with headers as first two rows
    # Don't set columns from row 0 - keep both header rows as data rows
    df_final = pd.DataFrame([header_row1, header_row2] + data_with_headers)
    
    # Use default integer column names to preserve the 2-row header structure
    # When saved to CSV, both header rows will be written

    print(df_final)
    return df_final