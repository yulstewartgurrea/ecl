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

def clean_client_loan_balances(file_path: str) -> Dict[str, Any]:
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

    print('ECL_CLIENT_LOAN_BALANCES \n', df)
    
    return df