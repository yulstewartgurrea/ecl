#!/usr/bin/env python3
"""
Script to format the aging report CSV into structured JSON format.
"""

import csv
import json
import re
import math
from typing import Dict, List, Any
from datetime import datetime

import pandas as pd

def clean_numeric_value(value: str) -> float:
    """Clean and convert numeric values from CSV."""
    if not value or value.strip() == '':
        return 0.0
    
    # Remove commas, quotes, and extra spaces
    cleaned = value.replace(',', '').replace('"', '').strip()
    
    # Handle percentage values
    if '%' in cleaned:
        cleaned = cleaned.replace('%', '')
        return float(cleaned) / 100
    
    # Handle currency values
    if cleaned.replace('.', '').replace('-', '').isdigit():
        return float(cleaned)
    
    return 0.0


def format_report_date(date_string: str) -> str:
    """Format the report date from 'As of July 31, 2025' to 'yyyy-mm-dd' format."""
    if not date_string:
        return ""
    
    try:
        # Extract the date part from "As of July 31, 2025"
        # Remove "As of" and any extra whitespace
        date_part = date_string.replace("As of", "").strip()
        
        # Parse the date string
        parsed_date = datetime.strptime(date_part, "%B %d, %Y")
        
        # Format as yyyy-mm-dd
        return parsed_date.strftime("%Y-%m-%d")
    except ValueError:
        # If parsing fails, return the original string
        return date_string


def aging_report_clean_up(file_path: str) -> Dict[str, Any]:
    """Parse the aging report CSV file and return structured data.
    Reads using pandas with header=None to avoid header inference.
    """
    df = pd.read_csv(
        file_path,
        header=None,
        dtype=str,
        encoding="utf-8-sig",
        keep_default_na=False,
        na_filter=False
    )

    rows = [[str(c).strip() if not isinstance(c, float) else ("" if math.isnan(c) else str(c).strip())
             for c in row] for row in df.values.tolist()]

    report_date = ""
    total_borrowers = 0
    number_of_delinquents = 0
    total_loan_portfolio = 0

    def _cell(row, idx):
        return row[idx].strip() if len(row) > idx and row[idx] is not None else ""

    # Scan ALL rows for header/summary fields (no limit)
    for row in rows:
        if not row or not _cell(row, 0):
            continue
        first = _cell(row, 0)
        if "As of" in first:
            report_date = format_report_date(first)
        elif "Total Borrowers" in first:
            total_borrowers = clean_numeric_value(_cell(row, 1)) if len(row) > 1 else 0
        elif "Number of Delinquents" in first:
            number_of_delinquents = clean_numeric_value(_cell(row, 1)) if len(row) > 1 else 0
        elif "Total Loan Portfolio" in first:
            total_loan_portfolio = clean_numeric_value(_cell(row, 1)) if len(row) > 1 else 0

    products = []
    current_product = None
    current_product_data = []
    headers = None

    # Parse product sections from the very start (no row offset)
    for i in range(0, len(rows)):
        row = rows[i]
        if not row or not _cell(row, 0):
            continue

        first = _cell(row, 0)

        # Detect the header row for aging categories
        if ("Aging Category" in first) and any("Product Counts" in c for c in row):
            if current_product and current_product_data:
                products.append({
                    "name": current_product,
                    "data": current_product_data
                })

            # Get product name from previous non-empty row
            if i > 0 and rows[i - 1] and _cell(rows[i - 1], 0):
                current_product = _cell(rows[i - 1], 0)
                current_product_data = []
                headers = [c.strip() for c in row if c and str(c).strip()]
            continue

        # Data rows (PAR categories)
        if headers and current_product and ("PAR" in first):
            row_data = {}
            for j, header in enumerate(headers):
                if j < len(row):
                    value = _cell(row, j)
                    if header == "Aging Category":
                        row_data[header] = value
                    elif header == "Product Counts":
                        val = clean_numeric_value(value)
                        row_data[header] = int(val) if val > 0 else 0
                    else:
                        row_data[header] = clean_numeric_value(value)
                else:
                    row_data[header] = 0
            current_product_data.append(row_data)
            continue

        # TOTAL row ends a product block
        if headers and current_product and ("TOTAL" in first):
            row_data = {}
            for j, header in enumerate(headers):
                if j < len(row):
                    value = _cell(row, j)
                    if header == "Aging Category":
                        row_data[header] = value
                    elif header == "Product Counts":
                        val = clean_numeric_value(value)
                        row_data[header] = int(val) if val > 0 else 0
                    else:
                        row_data[header] = clean_numeric_value(value)
                else:
                    row_data[header] = 0

            current_product_data.append(row_data)

            products.append({
                "name": current_product,
                "data": current_product_data
            })
            current_product = None
            current_product_data = []
            headers = None

    if current_product and current_product_data:
        products.append({
            "name": current_product,
            "data": current_product_data
        })

    return {
        "report_date": report_date,
        "total_borrowers": int(total_borrowers),
        "number_of_delinquents": int(number_of_delinquents),
        "total_loan_portfolio": int(total_loan_portfolio),
        "products": products
    }