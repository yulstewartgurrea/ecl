import pandas as pd
import traceback

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
        columns=["date", "Monotonic?", "Weighted Credit Loss Rate per Month"]
    )
    avg_values = average_df.iloc[0].values

    historical_credit_loss_rates = avg_values
    historical_credit_loss_rates = [
        r / 100.0 for r in historical_credit_loss_rates
    ]

    # get default rates and determines latest period
    historical_default_rates_df = pd.read_csv(historical_default_rates_file)
    # Convert to datetime
    historical_default_rates_df["time"] = pd.to_datetime(historical_default_rates_df["time"])
    # Get max time
    max_time = historical_default_rates_df["time"].max()

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
    return df
  
  except Exception as e:
    traceback.print_exc()
    return None