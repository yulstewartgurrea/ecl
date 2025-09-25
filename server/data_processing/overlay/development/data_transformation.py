import pandas as pd
import numpy as np
from datetime import datetime

import traceback

def combine_monthly_mew_data_interpolation(monthly_historical_mev_df: pd.DataFrame, data_interpolation_df: pd.DataFrame):
    try:
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

    except Exception as e:
        print(f"❌ Error during combination: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def process_lag_information(df_combined: pd.DataFrame, lag: int):
    """
    Process lag information
    """
    df_combined_copy = df_combined.copy()
    df_combined_data = df_combined_copy[2:].reset_index(drop=True)
    print(df_combined_data['inflation'])

    df = pd.DataFrame({'date': df_combined_data['id']})
    
    # Convert inflation to numeric for calculations
    # First remove the % symbol and convert to numeric
    inflation_clean = df_combined_data['inflation'].astype(str).str.replace('%', '').str.strip()
    # convert to percentage divide by 100
    inflation_numeric = pd.to_numeric(inflation_clean, errors='coerce') / 100
    
    # we start appying the formula on the row depending on the value of lag
    df[f"inflation_{lag}"] = inflation_numeric.shift(lag)

    # =IFERROR(LN(E5),ASINH(E5))
    # Apply logarithmic transformation to CURRENT inflation values, not lagged values
    df[f"inflation_ln"] = np.where(inflation_numeric > 0, np.log(inflation_numeric), np.asinh(inflation_numeric))
    
    # 
    #  inflation diff is increment. it usually start on the 13th row so the formula is 2013 - Jan - 2012 Jan, 2013 - Feb - 2012 Feb etc
    # this is a sample formula
    # =E17-E5
    # =E18-E6
    # =E19-E7
    # can you create a formual for this
    # Calculate inflation difference with 12-month lag (year-over-year difference)
    df[f"inflation_diff"] = inflation_numeric.diff(12)

    # df.to_csv('test_lag.csv')
    return df

def process_historical_default_rates(historical_default_rates_df: pd.DataFrame):
    """
    Process historical default rates
    """
    df_historical_default_rates = historical_default_rates_df.copy()
    df_historical_default_rates.columns = df_historical_default_rates.columns.str.lower()

    df = pd.DataFrame({'date': df_historical_default_rates['time']})
    odr_clean = df_historical_default_rates['odr'].astype(str).str.replace('%', '').str.strip()
    # convert to percentage divide by 100
    odr_numeric = pd.to_numeric(odr_clean, errors='coerce') / 100
    df[f"odr"] = np.where(odr_numeric > 0, np.log(odr_numeric), np.asinh(odr_numeric))

    print(df)
    return df

def process_data_transformation(monthly_historical_mev_df: pd.DataFrame, 
                                data_interpolation_df: pd.DataFrame,
                                historical_default_rates_df: pd.DataFrame):
    """
    Combine data_interpolation_output.csv and monthly_historical_mev.csv
    """
    print("🔄 Starting dataframe combination process...")
    
    try:
        df_combined = combine_monthly_mew_data_interpolation(monthly_historical_mev_df, data_interpolation_df)

        lag_tranformation = process_lag_information(df_combined, 3)

        historical_default_rate = process_historical_default_rates(historical_default_rates_df)

        return {
            "data_interpolation_combined": df_combined,
            "lag_tranformation": lag_tranformation,
            "historical_default_rate": historical_default_rate
        }
        
    except Exception as e:
        print(f"❌ Error during combination: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

