import os
import warnings
import re
warnings.filterwarnings('ignore')

import pandas as pd
import numpy as np
from datetime import datetime
from itertools import combinations, product
from multiprocessing import Pool, cpu_count
from functools import partial

from statsmodels.tsa.stattools import adfuller

from helpers.get_root_folder import get_root_folder
from helpers.get_time_date import get_time_date

from data.excluded_columns import excluded_columns

def process_overlay_multiplier(default_rates_df: pd.DataFrame, 
                               forecasted_pd_df: pd.DataFrame):
    try:

        print('default_rates_df \n', default_rates_df)
        # Determine the date column name (could be 'date' or 'time', case-insensitive)
        date_col = None
        column_names_lower = {col.lower(): col for col in default_rates_df.columns}
        
        if 'date' in column_names_lower:
            date_col = column_names_lower['date']
        elif 'time' in column_names_lower:
            date_col = column_names_lower['time']
        else:
            raise ValueError("No 'date' or 'time' column found in default_rates_df")
        
        # Convert date column to datetime, handling errors
        default_rates_df = default_rates_df.copy()
        default_rates_df[date_col] = pd.to_datetime(default_rates_df[date_col], errors='coerce')
        
        # Filter out rows where date is NaT (like "Average" row) and get the latest date
        valid_dates_df = default_rates_df[default_rates_df[date_col].notna()]
        if valid_dates_df.empty:
            raise ValueError("No valid dates found in default_rates_df")
        
        max_date = valid_dates_df[date_col].max()
        last_period_default_rate = valid_dates_df[valid_dates_df[date_col] == max_date]
        
        print('last_period_default_rate', last_period_default_rate)
        
        # Find the ODR column name case-insensitively (accepts 'odr',
        # 'clr', or 'weighted credit loss rate per month' — all three
        # name the same metric depending on the upstream source).
        odr_col = None
        odr_column_names_lower = {col.lower(): col for col in last_period_default_rate.columns}

        if 'odr' in odr_column_names_lower:
            odr_col = odr_column_names_lower['odr']
        elif 'clr' in odr_column_names_lower:
            odr_col = odr_column_names_lower['clr']
        elif 'weighted credit loss rate per month' in odr_column_names_lower:
            odr_col = odr_column_names_lower['weighted credit loss rate per month']
        else:
            raise ValueError("Could not find 'odr', 'CLR', or 'Weighted Credit Loss Rate per Month' column (case-insensitive)")
        
        if last_period_default_rate.empty:
            raise ValueError("No data found for latest date")
        
        odr_value = last_period_default_rate[odr_col].values[0]
        
        # Convert odr to numeric: if it has % sign, remove it and convert to decimal (divide by 100)
        if isinstance(odr_value, str):
            # Remove % sign and any whitespace
            odr_clean = str(odr_value).replace('%', '').strip()
            odr_numeric = float(odr_clean) / 100.0  # Convert percentage to decimal (2.71% -> 0.0271)
        else:
            # If already numeric, check if it's already in decimal form or percentage form
            odr_numeric = float(odr_value)
            # If value is > 1, assume it's a percentage and convert to decimal
            if odr_numeric > 1.0:
                odr_numeric = odr_numeric / 100.0
        
        latest_default_rate = {
            'time': last_period_default_rate[date_col].values[0],
            'odr': odr_numeric
        }
        print('latest_default_rate \n', latest_default_rate)

        # Get the last row of forecasted_pd_df
        last_row_forecasted_pd = forecasted_pd_df.iloc[-1]
        print('last_row_forecasted_pd \n', last_row_forecasted_pd)

        # calculate overlay multiplier
        output_df = pd.DataFrame()
        output_df['Period'] = [latest_default_rate['time']]
        output_df['Upside'] = [last_row_forecasted_pd['Upside'] / latest_default_rate['odr']]
        output_df['Base'] = [last_row_forecasted_pd['Base'] / latest_default_rate['odr']]
        output_df['Downside'] = [last_row_forecasted_pd['Downside'] / latest_default_rate['odr']]

        # Inputs of the ratios above, kept so each multiplier can be traced in the UI
        output_df['Observed Rate'] = [latest_default_rate['odr']]
        output_df['Forecast Upside'] = [last_row_forecasted_pd['Upside']]
        output_df['Forecast Base'] = [last_row_forecasted_pd['Base']]
        output_df['Forecast Downside'] = [last_row_forecasted_pd['Downside']]

        print('output_df \n', output_df)
        return output_df

    except Exception as e:
        print(f"Error during forecasted PD calc: {str(e)}")
        import traceback
        traceback.print_exc()
        return None
