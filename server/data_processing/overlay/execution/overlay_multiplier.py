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
        latest_default_rate = {
            'time': last_period_default_rate['time'].values[0],
            'odr': last_period_default_rate['odr'].values[0]
        }

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
