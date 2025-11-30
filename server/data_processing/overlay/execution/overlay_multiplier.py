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
        # get latest Period row of default_rates_df max Period
        last_period_default_rate = default_rates_df[default_rates_df['time'] == default_rates_df['time'].max()]
        odr_value = last_period_default_rate['odr'].values[0]
        
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
            'time': last_period_default_rate['time'].values[0],
            'odr': odr_numeric
        }

        print('latest_default_rate', latest_default_rate)
        print('forecasted_pd_df', forecasted_pd_df)

        # Ensure forecasted_pd_df columns are numeric
        forecasted_pd_df = forecasted_pd_df.copy()
        for col in ['Best', 'Base', 'Worst']:
            if col in forecasted_pd_df.columns:
                forecasted_pd_df[col] = pd.to_numeric(forecasted_pd_df[col], errors='coerce')

        # calculate overlay multiplier
        output_df = forecasted_pd_df.copy()
        output_df['Best'] = latest_default_rate['odr'] / forecasted_pd_df['Best']
        output_df['Base'] = latest_default_rate['odr'] / forecasted_pd_df['Base']
        output_df['Worst'] = latest_default_rate['odr'] / forecasted_pd_df['Worst']

        return output_df

    except Exception as e:
        print(f"Error during forecasted PD calc: {str(e)}")
        import traceback
        traceback.print_exc()
        return None
