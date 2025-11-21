import os
import pandas as pd

def save_override_forecasted_mev(
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

    df.to_csv(full_file_path, index=False)
    print(f"Saved CSV to {workflow_path}")

    return workflow_path

def json_to_custom_table(json_data):
    # Determine all scenario names (e.g. best, base, worst)
    scenarios = [key for key in json_data[0].keys() if key != "period"]

    # Determine variable names from the FIRST scenario (e.g. unemp_rate, gdp)
    first_scenario = scenarios[0]
    variables = list(json_data[0][first_scenario].keys())

    # Build row1 header
    header_row1 = ["Period"]
    for scenario in scenarios:
        header_row1 += [scenario.capitalize(), "",]
    header_row1 = header_row1[:-1]  # remove last extra comma

    # Build row2 header
    header_row2 = [""]
    for _ in scenarios:
        header_row2 += variables

    # Build data rows
    data_rows = []
    for item in json_data:
        row = [item["period"]]
        for scenario in scenarios:
            row += [item[scenario][var] for var in variables]
        data_rows.append(row)

    # Build final DataFrame (with 2 header rows)
    df = pd.DataFrame([header_row1, header_row2] + data_rows)

    # make row 0 as the column headers
    df.columns = df.iloc[0].tolist()
    df = df.drop(0)
    df = df.reset_index(drop=True)

    print(df)

    return df