import pandas as pd
import traceback
import os

def process_credit_loss_rates(aging_report_file, 
                              ecl_multiplier_file, 
                              parsed_probability_weights, 
                              net_flow_rate_file,
                              overlay_multiplier_file,
                              historical_default_rates_file):
  try:
    aging_report_df = pd.read_excel(aging_report_file)
    buckets = aging_report_df.columns.str.lower().tolist()
    buckets = [col for col in buckets if col not in ['date', 'total loan balance with c/p']]

    net_flow_rate_df = pd.read_excel(net_flow_rate_file)
    # Get the Average row
    average_df = net_flow_rate_df[net_flow_rate_df["date"] == "Average"]
    # Drop unwanted columns
    average_df = average_df.drop(
        columns=["date", "Strictly Increasing?", "Weighted Credit Loss Rate per Month"]
    )
    avg_values = average_df.iloc[0].values

    historical_credit_loss_rates = avg_values
    # historical_credit_loss_rates = [
    #     r / 100.0 for r in historical_credit_loss_rates
    # ]

    # get default rates and determines latest period
    # Check file extension and use appropriate reader
    file_ext = os.path.splitext(historical_default_rates_file)[1].lower()
    if file_ext in ['.xlsx', '.xls']:
        historical_default_rates_df = pd.read_excel(historical_default_rates_file)
    else:
        historical_default_rates_df = pd.read_csv(historical_default_rates_file)

    print(historical_default_rates_df.columns)
    
    # Find time/period column (case-insensitive)
    time_col = None
    column_names_lower = {col.lower(): col for col in historical_default_rates_df.columns}
    if 'period' in column_names_lower:
        time_col = column_names_lower['period']
    elif 'time' in column_names_lower:
        time_col = column_names_lower['time']
    elif 'date' in column_names_lower:
        time_col = column_names_lower['date']
    else:
        raise ValueError(
            "No 'period', 'time', or 'date' column found in the Historical Default Rate input file. "
            "Please ensure your Historical Default Rate file contains a column named 'Period', 'Time', or 'Date' "
            "and re-upload the file."
        )
    
    # Convert to datetime with errors='coerce' to handle invalid dates (like "Average")
    historical_default_rates_df[time_col] = pd.to_datetime(historical_default_rates_df[time_col], errors='coerce')
    # Filter out rows where datetime is NaT (invalid dates like "Average")
    historical_default_rates_df = historical_default_rates_df[historical_default_rates_df[time_col].notna()]
    # Get max time
    max_time = historical_default_rates_df[time_col].max()

    overlay_multiplier_df = pd.read_csv(overlay_multiplier_file)
    # convert period to datetime
    overlay_multiplier_df["Period"] = pd.to_datetime(overlay_multiplier_df["Period"])
    # Filter row where Period == max_time
    overlay_row = overlay_multiplier_df[
        overlay_multiplier_df["Period"] == max_time
    ]
    overlay_multipliers = {
        "upside": float(overlay_row["Upside"].iloc[0]),
        "baseline": float(overlay_row["Base"].iloc[0]),
        "downside": float(overlay_row["Downside"].iloc[0]),
    }

    ecl_multiplier = pd.read_excel(ecl_multiplier_file)

    df = pd.DataFrame({
        'aging category': buckets,
        'historical credit loss rate': historical_credit_loss_rates
    })

    # Apply overlays and clip to probability range [0, 1]
    df['upside'] = (
        df['historical credit loss rate'] * overlay_multipliers['upside']
    ).clip(upper=1.0)

    df['baseline'] = (
        df['historical credit loss rate'] * overlay_multipliers['baseline']
    ).clip(upper=1.0)

    df['downside'] = (
        df['historical credit loss rate'] * overlay_multipliers['downside']
    ).clip(upper=1.0)

    # make last row of df upside baseline and downside to 1
    df.iloc[-1, df.columns.get_loc('upside')] = 1
    df.iloc[-1, df.columns.get_loc('baseline')] = 1
    df.iloc[-1, df.columns.get_loc('downside')] = 1

    return df
  
  except ValueError:
    raise
  except Exception as e:
    traceback.print_exc()
    raise ValueError(
        f"An error occurred during credit loss rates calculation. "
        f"Please verify that the Aging Report output, Net Flow Rate output, Overlay Multiplier output, "
        f"Historical Default Rate input file, and ECL Multiplier file are available and have the correct format. "
        f"Detail: {e}"
    )