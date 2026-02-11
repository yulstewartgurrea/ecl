import pandas as pd
import re
from typing import Dict, Any

from ..validate_generic_document import validate_generic_document
from .development import (
    validate_overlay_development_monthly_mev, 
    validate_overlay_development_quarterly_mev, 
    validate_monthly_historical_credit_loss_rates
)

import traceback


def validate_overlay_execution_document(df: pd.DataFrame, document_type: str, file_name: str, temp_path = None ) -> Dict[str, Any]:
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
    if document_type == "OVERLAY_EXECUTION_MONTHLY_HISTORICAL_MEV":
        print("Overlay Execution Monthly Historical MEV")
        return validate_overlay_development_monthly_mev(df, document_type, file_name)
    elif document_type == "OVERLAY_EXECUTION_QUARTERLY_HISTORICAL_MEV":
        print("Overlay Execution Quarterly Historical MEV")
        return validate_overlay_development_quarterly_mev(df, document_type, file_name)
    elif document_type == "OVERLAY_EXECUTION_HISTORICAL_WEIGHTED_CREDIT_LOSS_RATE":
        print("Overlay Execution Historical Default Rate")
        return validate_monthly_historical_credit_loss_rates(df, document_type, file_name)
    elif document_type == "OVERLAY_EXECUTION_MEV_MONTHLY_ARIMA":
        print("Overlay Execution Monthly Forecasted MEV ARIMA")
        return validate_monthly_forecasted_mev_arima(df, document_type, file_name)
    elif document_type == "OVERLAY_EXECUTION_MEV_QUARTERLY_ARIMA":
        print("Overlay Execution Quarterly Forecasted MEV ARIMA")
        return validate_quarterly_forecasted_mev_arima(df, document_type, file_name)
    elif document_type == "OVERLAY_EXECUTION_FINAL_MODEL":
        print("Overlay Execution Final Overlay Model")
        return validate_final_overlay_model(df, document_type, file_name)
    else:
        print("Overlay Execution Generic")
        return validate_generic_document(df, document_type, file_name)


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

def validate_monthly_forecasted_mev_arima(df: pd.DataFrame, document_type: str, file_name: str) -> Dict[str, Any]:
    """
    Specialized validation for documents
    """
    validation_results = _get_base_validation_results(file_name, document_type)
    
    try:
        print('validate_monthly_forecasted_mev_arima \n', df)
        # Normalize column names for comparison (lowercase, strip spaces)
        df_columns_normalized = [col.strip().lower() for col in df.columns]
        
        # Required columns - validation fails if missing
        required_columns = []
        
        missing_required = [col for col in required_columns if col not in df_columns_normalized]
        if missing_required:
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "missing_required_columns",
                "columns": missing_required,
                "message": f"Missing required columns for Write Off Accounts: {', '.join(missing_required)}"
            })
        
        # Check for duplicate columns
        duplicate_columns = df.columns[df.columns.duplicated()].tolist()
        if duplicate_columns:
            validation_results["validation_status"] = "failed"
            validation_results["duplicate_columns"] = duplicate_columns
            validation_results["issues"].append({
                "type": "duplicate_columns",
                "columns": duplicate_columns,
                "message": f"Duplicate columns found: {', '.join(duplicate_columns)}"
            })

        # Check for unnamed columns (e.g., "Unnamed: 0", "Unnamed: 1")
        unnamed_columns = []
        for col in df.columns:
            # Check if column name matches pattern "Unnamed:" or "unnamed:" followed by optional number
            if re.match(r'^[Uu]nnamed\s*:\s*\d*$', str(col).strip()):
                unnamed_columns.append(col)
        
        if unnamed_columns:
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "unnamed_columns",
                "columns": unnamed_columns,
                "message": f"Found unnamed columns: {', '.join(unnamed_columns)}."
            })

        # Check for date column and validate it contains actual dates
        date_columns = [col for col in df.columns if 'date' in str(col).strip().lower()]
        if date_columns:
            for date_col in date_columns:
                # Check if column is numeric (should not be)
                if pd.api.types.is_numeric_dtype(df[date_col]):
                    validation_results["validation_status"] = "failed"
                    validation_results["issues"].append({
                        "type": "invalid_date_column",
                        "column": date_col,
                        "message": f"Date column '{date_col}' contains numeric values instead of dates"
                    })
                else:
                    # Try to parse dates - check if values can be converted to datetime
                    invalid_dates = []
                    for idx, value in enumerate(df[date_col]):
                        if pd.isna(value) or (isinstance(value, str) and value.strip() == ''):
                            continue  # Skip missing values (handled by missing data check)
                        try:
                            pd.to_datetime(value, errors='raise')
                        except (ValueError, TypeError):
                            invalid_dates.append({
                                "row": idx,
                                "value": str(value)[:50]  # Truncate long values
                            })
                    
                    if invalid_dates:
                        validation_results["validation_status"] = "failed"
                        validation_results["issues"].append({
                            "type": "invalid_date_values",
                            "column": date_col,
                            "invalid_count": len(invalid_dates),
                            "sample_invalid": invalid_dates[:5],  # Show first 5 invalid dates
                            "message": f"Date column '{date_col}' contains {len(invalid_dates)} invalid date value(s). Dates must be in a valid date format, not text or numeric values."
                        })

        # Check for missing data in each column (including NaN, None, and empty strings)
        missing_data = {}
        for column in df.columns:
            # Check for NaN/None values
            null_count = df[column].isnull().sum()
            # Check for empty strings (only for string/object columns)
            if df[column].dtype == 'object':
                empty_string_count = (df[column].astype(str).str.strip() == '').sum()
            else:
                empty_string_count = 0
            # Total missing count (NaN/None + empty strings)
            missing_count = null_count + empty_string_count
            missing_percentage = (missing_count / len(df)) * 100
            
            if missing_count > 0:
                missing_data[column] = {
                    "missing_count": int(missing_count),
                    "missing_percentage": round(missing_percentage, 2),
                    "total_rows": len(df)
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
            # if data["missing_percentage"] > 10:
            validation_results["validation_status"] = "failed"

        # Check for empty columns (all NaN/None or all empty strings)
        empty_columns = []
        for column in df.columns:
            is_all_null = df[column].isnull().all()
            # Check if all values are empty strings (for object columns)
            if df[column].dtype == 'object':
                is_all_empty_strings = (df[column].astype(str).str.strip() == '').all()
            else:
                is_all_empty_strings = False
            
            if is_all_null or is_all_empty_strings:
                empty_columns.append(column)
                validation_results["issues"].append({
                    "type": "empty_column",
                    "column": column,
                    "message": f"Column '{column}' is completely empty"
                })
        
        if empty_columns:
            validation_results["validation_status"] = "failed"

        return validation_results
        
    except Exception as e:
        traceback.print_exc()
        validation_results["validation_status"] = "error"
        validation_results["issues"].append({
            "type": "validation_error",
            "message": f"Error during Write Off Accounts validation: {str(e)}"
        })
        return validation_results

def validate_quarterly_forecasted_mev_arima(df: pd.DataFrame, document_type: str, file_name: str) -> Dict[str, Any]:
    """
    Specialized validation for Write Off Accounts documents
    """
    validation_results = _get_base_validation_results(file_name, document_type)
    
    try:
        # Normalize column names for comparison (lowercase, strip spaces)
        df_columns_normalized = [col.strip().lower() for col in df.columns]

        # Required columns - validation fails if missing
        required_columns = []
        
        missing_required = [col for col in required_columns if col not in df_columns_normalized]
        if missing_required:
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "missing_required_columns",
                "columns": missing_required,
                "message": f"Missing required columns for Write Off Accounts: {', '.join(missing_required)}"
            })
        
        # Check for duplicate columns
        duplicate_columns = df.columns[df.columns.duplicated()].tolist()
        if duplicate_columns:
            validation_results["validation_status"] = "failed"
            validation_results["duplicate_columns"] = duplicate_columns
            validation_results["issues"].append({
                "type": "duplicate_columns",
                "columns": duplicate_columns,
                "message": f"Duplicate columns found: {', '.join(duplicate_columns)}"
            })

        # Check for unnamed columns (e.g., "Unnamed: 0", "Unnamed: 1")
        unnamed_columns = []
        for col in df.columns:
            # Check if column name matches pattern "Unnamed:" or "unnamed:" followed by optional number
            if re.match(r'^[Uu]nnamed\s*:\s*\d*$', str(col).strip()):
                unnamed_columns.append(col)
        
        if unnamed_columns:
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "unnamed_columns",
                "columns": unnamed_columns,
                "message": f"Found unnamed columns: {', '.join(unnamed_columns)}."
            })

        # Check for date column and validate it contains actual dates
        date_columns = [col for col in df.columns if 'date' in str(col).strip().lower()]
        if date_columns:
            for date_col in date_columns:
                # Check if column is numeric (should not be)
                if pd.api.types.is_numeric_dtype(df[date_col]):
                    validation_results["validation_status"] = "failed"
                    validation_results["issues"].append({
                        "type": "invalid_date_column",
                        "column": date_col,
                        "message": f"Date column '{date_col}' contains numeric values instead of dates"
                    })
                else:
                    # Try to parse dates - check if values can be converted to datetime
                    invalid_dates = []
                    for idx, value in enumerate(df[date_col]):
                        if pd.isna(value) or (isinstance(value, str) and value.strip() == ''):
                            continue  # Skip missing values (handled by missing data check)
                        try:
                            pd.to_datetime(value, errors='raise')
                        except (ValueError, TypeError):
                            invalid_dates.append({
                                "row": idx,
                                "value": str(value)[:50]  # Truncate long values
                            })
                    
                    if invalid_dates:
                        validation_results["validation_status"] = "failed"
                        validation_results["issues"].append({
                            "type": "invalid_date_values",
                            "column": date_col,
                            "invalid_count": len(invalid_dates),
                            "sample_invalid": invalid_dates[:5],  # Show first 5 invalid dates
                            "message": f"Date column '{date_col}' contains {len(invalid_dates)} invalid date value(s). Dates must be in a valid date format, not text or numeric values."
                        })

        # Check for missing data in each column (including NaN, None, and empty strings)
        missing_data = {}
        for column in df.columns:
            # Check for NaN/None values
            null_count = df[column].isnull().sum()
            # Check for empty strings (only for string/object columns)
            if df[column].dtype == 'object':
                empty_string_count = (df[column].astype(str).str.strip() == '').sum()
            else:
                empty_string_count = 0
            # Total missing count (NaN/None + empty strings)
            missing_count = null_count + empty_string_count
            missing_percentage = (missing_count / len(df)) * 100
            
            if missing_count > 0:
                missing_data[column] = {
                    "missing_count": int(missing_count),
                    "missing_percentage": round(missing_percentage, 2),
                    "total_rows": len(df)
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
            # if data["missing_percentage"] > 10:
            validation_results["validation_status"] = "failed"

        # Check for empty columns (all NaN/None or all empty strings)
        empty_columns = []
        for column in df.columns:
            is_all_null = df[column].isnull().all()
            # Check if all values are empty strings (for object columns)
            if df[column].dtype == 'object':
                is_all_empty_strings = (df[column].astype(str).str.strip() == '').all()
            else:
                is_all_empty_strings = False
            
            if is_all_null or is_all_empty_strings:
                empty_columns.append(column)
                validation_results["issues"].append({
                    "type": "empty_column",
                    "column": column,
                    "message": f"Column '{column}' is completely empty"
                })
        
        if empty_columns:
            validation_results["validation_status"] = "failed"

        return validation_results
        
    except Exception as e:
        traceback.print_exc()
        validation_results["validation_status"] = "error"
        validation_results["issues"].append({
            "type": "validation_error",
            "message": f"Error during Write Off Accounts validation: {str(e)}"
        })
        return validation_results

def validate_final_overlay_model(df: pd.DataFrame, document_type: str, file_name: str) -> Dict[str, Any]:
    """
    Specialized validation for Final Overlay Model documents
    
    Validates:
    1. X columns (X1/x1, X2/x2, X3/x3, etc.) pattern matching
    2. Corresponding coeff_X columns matching X column count
    3. Required intercept column
    4. Missing values in columns
    5. Duplicate columns
    6. Empty columns
    """
    validation_results = _get_base_validation_results(file_name, document_type)
    
    try:
        # Step 0: Validate dataframe length - should have exactly 1 data row (aside from header)
        if len(df) != 1:
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "invalid_dataframe_length",
                "expected_rows": 1,
                "actual_rows": len(df),
                "message": f"Dataframe must have exactly 1 data row (aside from header). Found {len(df)} row(s)"
            })
        
        # Step 1: Find all X columns matching pattern X1/x1, X2/x2, X3/x3, etc. (case-insensitive)
        x_column_pattern = re.compile(r'^[Xx](\d+)$', re.IGNORECASE)
        x_columns = []
        x_column_numbers = []
        
        for col in df.columns:
            match = x_column_pattern.match(str(col).strip())
            if match:
                x_columns.append(col)
                x_column_numbers.append(int(match.group(1)))
        
        # Sort by number for consistent ordering
        x_columns_sorted = sorted(zip(x_column_numbers, x_columns), key=lambda x: x[0])
        x_columns = [col for _, col in x_columns_sorted]
        x_column_numbers = sorted(x_column_numbers)
        
        if not x_columns:
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "missing_x_columns",
                "message": "No X columns found (expected pattern: X1, x1, X2, x2, X3, x3, etc.)"
            })
        else:
            # Check if X columns have values (not all null)
            for x_col in x_columns:
                if df[x_col].isnull().all():
                    validation_results["validation_status"] = "failed"
                    validation_results["issues"].append({
                        "type": "empty_x_column",
                        "column": x_col,
                        "message": f"X column '{x_col}' is completely empty (all values are null)"
                    })
        
        # Step 2: Check that coeff_X columns match X columns count
        coeff_column_pattern = re.compile(r'^coeff_[Xx](\d+)$', re.IGNORECASE)
        coeff_columns = []
        coeff_column_numbers = []
        
        for col in df.columns:
            match = coeff_column_pattern.match(str(col).strip())
            if match:
                coeff_columns.append(col)
                coeff_column_numbers.append(int(match.group(1)))
        
        # Sort by number for consistent ordering
        coeff_columns_sorted = sorted(zip(coeff_column_numbers, coeff_columns), key=lambda x: x[0])
        coeff_columns = [col for _, col in coeff_columns_sorted]
        coeff_column_numbers = sorted(coeff_column_numbers)
        
        # Check if X and coeff_X counts match
        if len(x_columns) != len(coeff_columns):
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "x_coeff_mismatch",
                "x_count": len(x_columns),
                "coeff_count": len(coeff_columns),
                "message": f"X columns count ({len(x_columns)}) does not match coeff_X columns count ({len(coeff_columns)})"
            })
        else:
            # Check that each X column has a corresponding coeff_X column
            for x_num in x_column_numbers:
                expected_coeff_pattern = re.compile(rf'^coeff_[Xx]{x_num}$', re.IGNORECASE)
                found_coeff = any(expected_coeff_pattern.match(str(col).strip()) for col in df.columns)
                if not found_coeff:
                    validation_results["validation_status"] = "failed"
                    validation_results["issues"].append({
                        "type": "missing_coeff_column",
                        "x_column": f"X{x_num}",
                        "message": f"X{x_num} column found but corresponding coeff_X{x_num} column is missing"
                    })
        
        # Step 3: Check for required intercept column (case-insensitive)
        intercept_found = False
        intercept_column = None
        for col in df.columns:
            if str(col).strip().lower() == "intercept":
                intercept_found = True
                intercept_column = col
                break
        
        if not intercept_found:
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "missing_required_columns",
                "columns": ["intercept"],
                "message": "Required column 'intercept' is missing"
            })
        
        # Step 4: Check for duplicate columns
        duplicate_columns = df.columns[df.columns.duplicated()].tolist()
        if duplicate_columns:
            validation_results["validation_status"] = "failed"
            validation_results["duplicate_columns"] = duplicate_columns
            validation_results["issues"].append({
                "type": "duplicate_columns",
                "columns": duplicate_columns,
                "message": f"Duplicate columns found: {', '.join(duplicate_columns)}"
            })
        
        # Step 5: Check for missing data in each column
        missing_data = {}
        for column in df.columns:
            missing_count = df[column].isnull().sum()
            missing_percentage = (missing_count / len(df)) * 100 if len(df) > 0 else 0
            
            if missing_count > 0:
                missing_data[column] = {
                    "missing_count": int(missing_count),
                    "missing_percentage": round(missing_percentage, 2),
                    "total_rows": len(df)
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
        
        # Step 6: Check for empty columns
        empty_columns = []
        for column in df.columns:
            if df[column].isnull().all():
                empty_columns.append(column)
                validation_results["issues"].append({
                    "type": "empty_column",
                    "column": column,
                    "message": f"Column '{column}' is completely empty"
                })
        
        if empty_columns:
            validation_results["validation_status"] = "failed"

        return validation_results
        
    except Exception as e:
        traceback.print_exc()
        validation_results["validation_status"] = "error"
        validation_results["issues"].append({
            "type": "validation_error",
            "message": f"Error during validation: {str(e)}"
        })
        return validation_results