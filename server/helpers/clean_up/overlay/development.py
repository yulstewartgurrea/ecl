import os
import pandas as pd
from typing import Dict, List, Any
from datetime import datetime

def clean_historical_default_rate(file_path: str) -> pd.DataFrame:
    try:
        file_ext = os.path.splitext(file_path)[1].lower()
        
        df = None
        if file_ext == '.csv':
            df = pd.read_csv(
                file_path,
                dtype=str,
                encoding="utf-8-sig",
                keep_default_na=False,
                na_filter=False
            )

        elif file_ext in ['.xlsx', '.xls']:
            df = pd.read_excel(
                file_path,
                dtype=str,
                keep_default_na=False,
                na_filter=False
            )
        else:
            raise ValueError(f"Unsupported file type: {file_ext}")

        print('OVERLAY_DEVELOPMENT_HISTORICAL_DEFAULT_RATE')
        
        df.columns = df.columns.str.strip().str.lower()

        # make sure odr column is percent
        # check first if odr column is a string and has % symbol
        if df['odr'].dtype == 'object' and '%' in df['odr'].values[0]:
            df['odr'] = df['odr'].str.replace('%', '').astype(float) / 100
        
        print(df)

        return df
    except Exception as e:
        print(f"Error cleaning historical default rate: {e}")
        return None