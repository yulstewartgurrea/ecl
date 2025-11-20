#!/usr/bin/env python3
"""
Script to format the aging report CSV into structured JSON format.
"""

import csv
import json
import re
import math
import os
from typing import Dict, List, Any
from datetime import datetime

import pandas as pd

def clean_monthly_forecasted_mev_arima(file_path: str) -> Dict[str, Any]:
    print('clean_monthly_forecasted_mev_arima', file_path)
    # Determine file type and read accordingly
    file_ext = os.path.splitext(file_path)[1].lower()
    
    df = None
    if file_ext == '.csv':
        df = pd.read_csv(
            file_path,
            header=None,
            dtype=str,
            encoding="utf-8-sig",
            keep_default_na=False,
            na_filter=False
        )

    elif file_ext in ['.xlsx', '.xls']:
        df = pd.read_excel(
            file_path,
            header=None,
            dtype=str,
            keep_default_na=False,
            na_filter=False
        )
    else:
        raise ValueError(f"Unsupported file type: {file_ext}")

    print('OVERLAY_EXECUTION_MEV_QUARTERLY_ARIMA')
    print(df)

    # combine row 0 and row 1 into a single row
    df.iloc[0] = df.iloc[0].str.cat(df.iloc[1], sep=' ')
    # remove duplicate words in row
    df.iloc[0] = df.iloc[0].str.replace(r'\b(\w+)\s+\1\b', r'\1', regex=True)
    # remove row 1
    df = df.drop(1)
    df = df.reset_index(drop=True)
    # combine row 0 and row 2 into a signle row
    df.iloc[0] = df.iloc[0].str.cat(df.iloc[1], sep=' ')
    # remove duplicate words in row
    df.iloc[0] = df.iloc[0].str.replace(r'\b(\w+)\s+\1\b', r'\1', regex=True)
    df = df.drop(1)
    df = df.reset_index(drop=True)

    # set row 0 as the column headers
    df.columns = df.iloc[0].tolist()
    # remove excess space in column headers
    df.columns = df.columns.str.strip()
    # remove column headers that are empty string
    df = df.loc[:, df.columns != '']
    df = df.drop(0)
    df = df.reset_index(drop=True)
    
    # create new columns year, month (int), month, ID
    # First, ensure Date column exists and parse it (case-insensitive search)
    date_col_name = None
    for col in df.columns:
        if col.lower() == 'date':
            date_col_name = col
            break
    
    if date_col_name is None:
        raise ValueError("Date column not found in the cleaned DataFrame")
    
    # Convert Date column to datetime, handling multiple formats
    df[date_col_name] = pd.to_datetime(df[date_col_name], errors='coerce', infer_datetime_format=True)
    
    # Extract year
    df['year'] = df[date_col_name].dt.year.astype(str)
    
    # Extract month as integer (1-12)
    df['month (int)'] = df[date_col_name].dt.month.astype(int)
    
    # Extract abbreviated month name (Jan, Feb, Mar, etc.)
    df['month'] = df[date_col_name].dt.strftime('%b')
    
    # Create ID column in format YYYY-M
    df['id'] = df['year'] + '-' + df[date_col_name].dt.strftime('%b')
    
    # Create x column (row number/index starting from 1)
    
    # Reorder columns to put new columns after Date column
    date_col = df.pop(date_col_name)
    year_col = df.pop('year')
    month_int_col = df.pop('month (int)')
    month_col = df.pop('month')
    id_col = df.pop('id')
    
    # Insert new columns right after Date (standardize column name to 'Date')
    df.insert(0, 'Date', date_col)
    df.insert(1, 'year', year_col)
    df.insert(2, 'month (int)', month_int_col)
    df.insert(3, 'month', month_col)
    df.insert(4, 'id', id_col)
    
    return df

def clean_quarterly_forecasted_mev_arima(file_path: str) -> Dict[str, Any]:
    print('clean_quarterly_forecasted_mev_arima', file_path)
    # Determine file type and read accordingly
    file_ext = os.path.splitext(file_path)[1].lower()
    
    df = None
    if file_ext == '.csv':
        df = pd.read_csv(
            file_path,
            header=None,
            dtype=str,
            encoding="utf-8-sig",
            keep_default_na=False,
            na_filter=False
        )
    elif file_ext in ['.xlsx', '.xls']:
        df = pd.read_excel(
            file_path,
            header=None,
            dtype=str,
            keep_default_na=False,
            na_filter=False
        )
    else:
        raise ValueError(f"Unsupported file type: {file_ext}")

    # combine row 0 and row 1 into a single row
    df.iloc[0] = df.iloc[0].str.cat(df.iloc[1], sep=' ')
    # remove duplicate words in row
    df.iloc[0] = df.iloc[0].str.replace(r'\b(\w+)\s+\1\b', r'\1', regex=True)
    # remove row 1
    df = df.drop(1)
    df = df.reset_index(drop=True)
    # combine row 0 and row 2 into a signle row
    df.iloc[0] = df.iloc[0].str.cat(df.iloc[1], sep=' ')
    # remove duplicate words in row
    df.iloc[0] = df.iloc[0].str.replace(r'\b(\w+)\s+\1\b', r'\1', regex=True)
    df = df.drop(1)
    df = df.reset_index(drop=True)

    # set row 0 as the column headers
    df.columns = df.iloc[0].tolist()
    # remove excess space in 
    df.columns = df.columns.str.strip()

    # remove column headers that are NaN or empty string
    df = df.loc[:, df.columns != '']
    
    # remove row 0
    df = df.drop(0)
    df = df.reset_index(drop=True)

    # First, ensure Date column exists and parse it (case-insensitive search)
    date_col_name = None
    for col in df.columns:
        if col.lower() == 'date':
            date_col_name = col
            break
    
    if date_col_name is None:
        raise ValueError("Date column not found in the cleaned DataFrame")
    
    # Convert Date column to datetime, handling multiple formats
    df[date_col_name] = pd.to_datetime(df[date_col_name], errors='coerce', infer_datetime_format=True)
    
    # Extract year
    df['year'] = df[date_col_name].dt.year.astype(str)
    
    # Extract month as integer (1-12) - use nullable integer type to handle NaN values
    df['month (int)'] = df[date_col_name].dt.month.astype('Int64')
    
    # Extract abbreviated month name (Jan, Feb, Mar, etc.)
    df['month'] = df[date_col_name].dt.strftime('%b')
    
    # Create ID column in format YYYY-M
    df['id'] = df['year'] + '-' + df[date_col_name].dt.strftime('%b')
    
    # Create x column: starts at 0.3 at the second March row and increments by 0.3 cumulatively
    # Find the second row where month is March
    second_mar_idx = None
    mar_count = 0
    for idx, month in enumerate(df['month']):
        if month == 'Mar':
            mar_count += 1
            if mar_count == 2:
                second_mar_idx = idx
                break
    
    # Initialize x column with zeros
    df['x'] = 0.0
    
    if second_mar_idx is not None:
        # Starting from second March row, set x values: 0.3, 0.6, 0.9, 1.2, etc.
        for i in range(second_mar_idx, len(df)):
            df.loc[df.index[i], 'x'] = 0.3 * (i - second_mar_idx + 1)
    else:
        # If no second March found, start from first row (fallback behavior)
        df['x'] = (0.3 * (pd.Series(range(len(df)), dtype=float) + 1.0)).astype(float)
    
    # Explicitly set as float to avoid integer conversion errors
    df['x'] = df['x'].astype(float)
    
    # Reorder columns to put new columns after Date column
    date_col = df.pop(date_col_name)
    year_col = df.pop('year')
    month_int_col = df.pop('month (int)')
    month_col = df.pop('month')
    id_col = df.pop('id')
    x_col = df.pop('x')
    
    # Insert new columns right after Date (standardize column name to 'Date')
    df.insert(0, 'Date', date_col)
    df.insert(1, 'year', year_col)
    df.insert(2, 'month (int)', month_int_col)
    df.insert(3, 'month', month_col)
    df.insert(4, 'id', id_col)
    df.insert(5, 'x', x_col)
    
    # Add a new row after column headers: empty for first 6 columns, then 3, 4, 5, 6...
    # Create a new row with empty values for first 6 columns and counting starting at 3
    num_cols = len(df.columns)
    new_row_values = [''] * 6  # Empty for Date, year, month (int), month, id, x
    new_row_values.extend([str(i) for i in range(3, 3 + (num_cols - 6))])  # 3, 4, 5, 6, ...
    
    # Create a DataFrame with the new row and concatenate
    new_row_df = pd.DataFrame([new_row_values], columns=df.columns)
    df = pd.concat([new_row_df, df], ignore_index=True)

    return df