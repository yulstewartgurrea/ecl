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

def process_pd_calibration(overlay_multiplier_df: pd.DataFrame,
                            ttc_pd_df: pd.DataFrame):

    try:
        ttc_pd_df_copy = ttc_pd_df.copy()
        overlay_multiplier_df['Period'] = pd.to_datetime(overlay_multiplier_df['Period'])
        df = overlay_multiplier_df.sort_values('Period').reset_index(drop=True)

        # Select the 12th chronological row (0-based indexing), fallback to last available if fewer rows
        twelve_index = 11 if len(df) > 11 else len(df) - 1
        twelve_month_row = df.iloc[twelve_index][['Best', 'Base', 'Worst']]

        # Compute FL PiT PD columns
        ttc_pd_df_copy['FL PiT PD Best']  = ttc_pd_df_copy['ttc_pd'] * float(twelve_month_row['Best'])
        ttc_pd_df_copy['FL PiT PD Base']  = ttc_pd_df_copy['ttc_pd'] * float(twelve_month_row['Base'])
        ttc_pd_df_copy['FL PiT PD Worst'] = ttc_pd_df_copy['ttc_pd'] * float(twelve_month_row['Worst'])

        # Weighted average (sumproduct / total) excluding any non-numeric bucket rows
        body = ttc_pd_df_copy[pd.to_numeric(ttc_pd_df_copy['Bucket'], errors='coerce').notna()].copy()
        total_obligors = int(body['Obligors'].sum())
        if total_obligors > 0:
            weighted_best  = (body['Obligors'] * body['FL PiT PD Best']).sum()  / total_obligors
            weighted_base  = (body['Obligors'] * body['FL PiT PD Base']).sum()  / total_obligors
            weighted_worst = (body['Obligors'] * body['FL PiT PD Worst']).sum() / total_obligors
        else:
            weighted_best = weighted_base = weighted_worst = np.nan

        weighted_row = {
            'Bucket': 'Total',
            'Obligors': total_obligors,
            'ttc_pd': 'Portfolio FL PiT PD',
            'FL PiT PD Best': weighted_best,
            'FL PiT PD Base': weighted_base,
            'FL PiT PD Worst': weighted_worst,
        }

        
        # Append rows ensuring "Total" is last
        ttc_pd_df_copy = pd.concat([ttc_pd_df_copy, pd.DataFrame([weighted_row])], ignore_index=True)

        return ttc_pd_df_copy

    except Exception as e:
        print(f"❌ Error during forecasted PD calc: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def get_best(twelve_month_row):
    return twelve_month_row['Best']

def get_base(twelve_month_row):
    return twelve_month_row['Base']

def get_worst(twelve_month_row):
    return twelve_month_row['Worst']