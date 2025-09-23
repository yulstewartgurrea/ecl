import pandas as pd
import numpy as np
from datetime import datetime

import traceback

def combine_monthly_mew_data_interpolation(monthly_historical_mev_df: pd.DataFrame, data_interpolation_df: pd.DataFrame):
    df_interpolation = data_interpolation_df.copy()
    print(f"   ✅ Loaded {len(df_interpolation)} rows, {len(df_interpolation.columns)} columns")
    
    df_monthly = monthly_historical_mev_df.copy()
    print(f"   ✅ Loaded {len(df_monthly)} rows, {len(df_monthly.columns)} columns")

    # create mask for definition and data type
    df_monthly_definitions = df_monthly.iloc[:2]
    df_interpolation_definitions = df_interpolation.iloc[:2]

    # merge df_interpolation and df_monthly on id
    df_combined = pd.merge(df_interpolation, df_monthly, on='id', how='left')

    # remove rows 2 and 3 only (keep everything except rows 2 and 3)
    df_combined = df_combined.drop([1, 2]).reset_index(drop=True)

    # dropping of and renaming of columns because of duplicate from each csvs
    # drop month_x if exists
    df_combined = df_combined.drop(columns=['month_x', 'year_y'])
    # rename column month_y to month
    df_combined = df_combined.rename(columns={'year_x': 'year', 'month_y': 'month'})

    # make year, month (int), month, quarter, id, x firsts columns
    df_combined = (
        df_combined[['year', 'month (int)', 'month', 'quarter', 'id', 'x'] + 
        [col for col in df_combined.columns if col not in ['year', 'month (int)', 'month', 'quarter', 'id', 'x']]]
    )

    return df_combined

def process_data_transformation(monthly_historical_mev_df: pd.DataFrame, data_interpolation_df: pd.DataFrame):
    """
    Combine data_interpolation_output.csv and monthly_historical_mev.csv
    """
    print("🔄 Starting dataframe combination process...")
    
    try:
        df_combined = combine_monthly_mew_data_interpolation(monthly_historical_mev_df, data_interpolation_df)

        # make year, month (int), month, quarter, id, x firsts columns

        df_combined.to_csv('test_combined_3.csv')
        
        return df_combined
        
    except Exception as e:
        print(f"❌ Error during combination: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

