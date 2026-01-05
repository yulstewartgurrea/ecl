import pandas as pd
import traceback

def process_credit_loss_rates(aging_report_file, ecl_multiplier_file, parsed_probability_weights):
  try:
    aging_report_df = pd.read_excel(aging_report_file)
    buckets = aging_report_df.columns.str.lower().tolist()
    buckets = [col for col in buckets if col not in ['date', 'total loan balance with c/p']]
    historical_credit_loss_rates = [
        0.0970,
        52.9100,
        57.0705,
        60.6035,
        62.9456,
        64.6546,
        66.1884,
        67.5379,
        68.8860,
        70.3259,
        74.2413,
        78.5626,
        84.3281,
        100.0000
    ]
    historical_credit_loss_rates = [
        r / 100.0 for r in historical_credit_loss_rates
    ]

    overlay_multipliers = {
        'upside': 0.01,
        'baseline': 0.02,
        'downside': 0.09
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


    print('df \n', df)
    return df
  
  except Exception as e:
    traceback.print_exc()
    return None