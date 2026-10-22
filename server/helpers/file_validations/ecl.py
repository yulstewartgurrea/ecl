import pandas as pd
import re
from typing import Dict, Any

from .validate_generic_document import validate_generic_document

import traceback


def _get_base_validation_results(file_name: str, document_type: str) -> Dict[str, Any]:
    """Helper function to create base validation results structure"""
    return {
        "file_name": file_name,
        "file_type": "CSV" if file_name.lower().endswith('.csv') else "Excel",
        "document_type": document_type,
        "validation_status": "passed",
        "issues": [],
        "statistics": {},
        "duplicate_columns": [],
        "missing_data": {},
        "data_quality": {}
    }


def validate_ecl_document(df: pd.DataFrame, document_type: str, file_name: str, temp_path = None ) -> Dict[str, Any]:
    """
    Main flowrate validation function that routes to specific validators based on document type
    
    Args:
        df: DataFrame to validate
        document_type: Type of flowrate document
        file_name: Name of the file being validated
    
    Returns:
        Dict containing validation results
    """
    
    # Route directly to appropriate validation function based on document type
    if document_type == "ECL_CLIENT_LOAN_BALANCES":
        print("ECL Client Loan Balances")
        return validate_client_loan_balances(df, document_type, file_name)
    else:
        print("Flowrate Approach Generic")
        return validate_generic_document(df, document_type, file_name)

def validate_client_loan_balances(df: pd.DataFrame, document_type: str, file_name: str) -> Dict[str, Any]:
    """
    Validation for Client Loan Balances document
    
    Expected file structure:
    - Row 1 (index 0): "Total loan" in column 0, total loan balance number in column 1
    - Row 2 (index 1): Empty row
    - Row 3 (index 2): Column headers
    - Row 4+ (index 3+): Data rows
    
    Required columns: date, client_ref_no, loan_ref_no, ServiceCode, principal_loan_balance,
    loan_balance, past_due_amount, TotalSavings, no_payment, delinquent_days, Aging Category
    """
    validation_results = _get_base_validation_results(file_name, document_type)
    
    try:
        print('df \n', df.head())
        
        # Step 1: Validate row 1 (index 0) - Check for "Total loan" in column 0 and numeric value in column 1
        if len(df) < 1:
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "invalid_file_structure",
                "message": "File must have at least 1 row"
            })
            return validation_results
        
        row1_col0 = str(df.iloc[0, 0]).strip() if pd.notna(df.iloc[0, 0]) else ""
        row1_col1 = df.iloc[0, 1] if len(df.columns) > 1 else None
        
        if "total loan" not in row1_col0.lower():
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "invalid_file_structure",
                "message": f"Row 1, Column 1 must contain 'Total loan'. Found: '{row1_col0}'"
            })
        
        # Check if column 1 has a numeric value
        if row1_col1 is None or pd.isna(row1_col1):
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "invalid_file_structure",
                "message": "Row 1, Column 2 must contain the total loan balance number"
            })
        else:
            try:
                float(row1_col1)
            except (ValueError, TypeError):
                validation_results["validation_status"] = "failed"
                validation_results["issues"].append({
                    "type": "invalid_file_structure",
                    "message": f"Row 1, Column 2 must be a numeric value. Found: '{row1_col1}'"
                })
        
        # Step 2: Validate row 2 (index 1) - Must be empty
        if len(df) < 2:
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "invalid_file_structure",
                "message": "File must have at least 2 rows (row 2 must be empty)"
            })
            return validation_results
        
        row2_values = df.iloc[1].values
        row2_not_empty = any(pd.notna(val) and str(val).strip() != "" for val in row2_values)
        if row2_not_empty:
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "invalid_file_structure",
                "message": "Row 2 must be empty"
            })
        
        # Step 3: Extract row 3 (index 2) as headers and create new dataframe starting from row 4 (index 3)
        if len(df) < 3:
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "invalid_file_structure",
                "message": "File must have at least 3 rows (row 3 must contain column headers)"
            })
            return validation_results
        
        # Get headers from row 3 (index 2)
        headers = [str(val).strip() if pd.notna(val) else f"Unnamed_{i}" for i, val in enumerate(df.iloc[2].values)]
        
        # Create new dataframe starting from row 4 (index 3)
        if len(df) < 4:
            # No data rows, create empty dataframe with headers
            data_df = pd.DataFrame(columns=headers)
        else:
            data_df = df.iloc[3:].copy()
            data_df.columns = headers[:len(data_df.columns)]
            # Remove any extra columns that don't have headers
            if len(data_df.columns) > len(headers):
                data_df = data_df.iloc[:, :len(headers)]
        
        # Required columns
        required_columns = [
            "date",
            "client_ref_no",
            "loan_ref_no",
            "ServiceCode",
            "principal_loan_balance",
            "loan_balance",
            "past_due_amount",
            "TotalSavings",
            "no_payment",
            "delinquent_days",
            "Aging Category"
        ]
        
        # Step 4: Check for missing required columns (case-insensitive)
        missing_required = []
        column_mapping = {}  # Map lowercase required to actual column name
        
        for req_col in required_columns:
            found = False
            for actual_col in data_df.columns:
                if str(actual_col).strip().lower() == req_col.lower():
                    column_mapping[req_col.lower()] = actual_col
                    found = True
                    break
            if not found:
                missing_required.append(req_col)
        
        if missing_required:
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "missing_required_columns",
                "columns": missing_required,
                "message": f"Missing required columns for Client Loan Balances: {', '.join(missing_required)}"
            })
        
        # Check for duplicate columns
        duplicate_columns = data_df.columns[data_df.columns.duplicated()].tolist()
        if duplicate_columns:
            validation_results["validation_status"] = "failed"
            validation_results["duplicate_columns"] = duplicate_columns
            validation_results["issues"].append({
                "type": "duplicate_columns",
                "columns": duplicate_columns,
                "message": f"Duplicate columns found: {', '.join(duplicate_columns)}"
            })
        
        # Step 5: Validate date format (MM/DD/YYYY)
        date_col_key = "date"
        if date_col_key.lower() in column_mapping:
            actual_date_col = column_mapping[date_col_key.lower()]
            if actual_date_col and actual_date_col in data_df.columns:
                try:
                    # stays None when some values already failed MM/DD/YYYY parsing (reported below)
                    date_strings = None
                    # Check if column is already datetime type
                    if pd.api.types.is_datetime64_any_dtype(data_df[actual_date_col]):
                        # Convert datetime to MM/DD/YYYY string format
                        date_strings = data_df[actual_date_col].dt.strftime('%m/%d/%Y')
                    else:
                        # Try to parse as MM/DD/YYYY format first
                        try:
                            # Try parsing with MM/DD/YYYY format
                            parsed_dates = pd.to_datetime(data_df[actual_date_col], format='%m/%d/%Y', errors='coerce')
                            # Check if all dates were successfully parsed
                            if parsed_dates.isna().any():
                                # Some dates couldn't be parsed with MM/DD/YYYY format
                                invalid_count = parsed_dates.isna().sum()
                                validation_results["validation_status"] = "failed"
                                validation_results["issues"].append({
                                    "type": "date_format",
                                    "column": actual_date_col,
                                    "invalid_count": int(invalid_count),
                                    "message": f"Column '{actual_date_col}' has {invalid_count} values not in MM/DD/YYYY format"
                                })
                            else:
                                date_strings = parsed_dates.dt.strftime('%m/%d/%Y')
                        except:
                            # Fallback: try pandas default parsing
                            parsed_dates = pd.to_datetime(data_df[actual_date_col], errors='coerce')
                            date_strings = parsed_dates.dt.strftime('%m/%d/%Y')
                    
                    # Check for specific MM/DD/YYYY format
                    date_pattern = r'^\d{2}/\d{2}/\d{4}$'
                    invalid_format_count = 0
                    
                    for idx, value in (date_strings.items() if date_strings is not None else []):
                        if pd.notna(value) and not re.match(date_pattern, str(value)):
                            invalid_format_count += 1
                    
                    if invalid_format_count > 0:
                        validation_results["validation_status"] = "failed"
                        validation_results["issues"].append({
                            "type": "date_format",
                            "column": actual_date_col,
                            "invalid_count": invalid_format_count,
                            "message": f"Column '{actual_date_col}' has {invalid_format_count} values not in MM/DD/YYYY format"
                        })
                        
                except Exception as e:
                    validation_results["validation_status"] = "failed"
                    validation_results["issues"].append({
                        "type": "date_format",
                        "column": actual_date_col,
                        "message": f"Column '{actual_date_col}' contains invalid date formats. Expected MM/DD/YYYY format. Error: {str(e)}"
                    })
        
        # Step 6: Validate numeric columns
        numeric_columns = [
            "ServiceCode",
            "principal_loan_balance",
            "loan_balance",
            "past_due_amount",
            "TotalSavings",
            "no_payment",
            "delinquent_days"
        ]
        
        for num_col in numeric_columns:
            if num_col.lower() in column_mapping:
                actual_col = column_mapping[num_col.lower()]
                if actual_col and actual_col in data_df.columns:
                    # Check if values are numeric
                    non_numeric_count = 0
                    for idx, value in data_df[actual_col].items():
                        if pd.notna(value):
                            try:
                                float(value)
                            except (ValueError, TypeError):
                                non_numeric_count += 1
                    
                    if non_numeric_count > 0:
                        validation_results["validation_status"] = "failed"
                        validation_results["issues"].append({
                            "type": "non_numeric_values",
                            "column": actual_col,
                            "invalid_count": non_numeric_count,
                            "message": f"Column '{actual_col}' has {non_numeric_count} non-numeric values"
                        })
        
        # Check for missing data in each column
        missing_data = {}
        for column in data_df.columns:
            missing_count = data_df[column].isnull().sum()
            missing_percentage = (missing_count / len(data_df)) * 100 if len(data_df) > 0 else 0
            
            if missing_count > 0:
                missing_data[column] = {
                    "missing_count": int(missing_count),
                    "missing_percentage": round(missing_percentage, 2),
                    "total_rows": len(data_df)
                }
        
        validation_results["missing_data"] = missing_data
        
        # Add missing data issues to validation results
        for column, data in missing_data.items():
            validation_results["issues"].append({
                "type": "missing_data",
                "column": column,
                "missing_count": data["missing_count"],
                "missing_percentage": data["missing_percentage"],
                "message": f"Column '{column}' has {data['missing_count']} missing values ({data['missing_percentage']}%)"
            })
            
            # Fail validation if missing data percentage is too high (>10%)
            if data["missing_percentage"] > 10:
                validation_results["validation_status"] = "failed"
        
        # Check for empty columns
        empty_columns = []
        for column in data_df.columns:
            if data_df[column].isnull().all():
                empty_columns.append(column)
                validation_results["issues"].append({
                    "type": "empty_column",
                    "column": column,
                    "message": f"Column '{column}' is completely empty"
                })
        
        if empty_columns:
            validation_results["validation_status"] = "failed"

        print('validation_results \n', validation_results)
        
        return validation_results
        
    except Exception as e:
        validation_results["validation_status"] = "failed"
        validation_results["issues"].append({
            "type": "validation_error",
            "message": f"Error during validation: {str(e)}"
        })
        traceback.print_exc()
    
    return validation_results