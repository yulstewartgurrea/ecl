import pandas as pd
import re
from typing import Dict, Any

from ..validate_generic_document import validate_generic_document

import traceback


def validate_overlay_development_document(df: pd.DataFrame, document_type: str, file_name: str, temp_path = None ) -> Dict[str, Any]:
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
    if document_type == "OVERLAY_DEVELOPMENT_MONTHLY_HISTORICAL_MEV":
        print("Overlay Development Monthly Historical MEV")
        return validate_overlay_development_monthly_mev(df, document_type, file_name)
    elif document_type == "OVERLAY_DEVELOPMENT_QUARTERLY_HISTORICAL_MEV":
        print("Overlay Development Quarterly Historical MEV")
        return validate_overlay_development_quarterly_mev(df, document_type, file_name)
    elif document_type == "OVERLAY_DEVELOPMENT_HISTORICAL_DEFAULT_RATE":
        print("Overlay Development Historical Default Rate")
        return validate_monthly_historical_credit_loss_rates(df, document_type, file_name)
    else:
        print("Overlay Development Generic")
        return validate_generic_document(df, document_type, file_name, temp_path)


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


def validate_monthly_historical_credit_loss_rates(df: pd.DataFrame, document_type: str, file_name: str) -> Dict[str, Any]:
    """
    Specialized validation for Monthly Historical MEV documents
    """
    print('VALIDATING MONTHLY HISTORICAL CREDIT LOSS RATES')
    validation_results = _get_base_validation_results(file_name, document_type)
    
    try:
        # Normalize column names for comparison (lowercase, strip spaces)
        df_columns_normalized = [col.strip().lower() for col in df.columns]
        
        # Required columns - validation fails if missing
        required_columns = ["time", "odr"]
        
        missing_required = [col for col in required_columns if col not in df_columns_normalized]
        if missing_required:
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "missing_required_columns",
                "columns": missing_required,
                "message": f"Missing required columns: {', '.join(missing_required)}"
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

        # Check for missing data in each column
        missing_data = {}
        for column in df.columns:
            missing_count = df[column].isnull().sum()
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
            if data["missing_percentage"] > 10:
                validation_results["validation_status"] = "failed"

        # Check for empty columns
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

        # Validate time column (MM/DD/YYYY format)
        if "time" in df_columns_normalized:
            # Find the actual column name (case-insensitive)
            time_col = None
            for col in df.columns:
                if col.strip().lower() == "time":
                    time_col = col
                    break
            
            if time_col is not None:
                try:
                    # Check if column is already datetime type
                    if pd.api.types.is_datetime64_any_dtype(df[time_col]):
                        # Convert datetime to MM/DD/YYYY string format
                        time_series = df[time_col]
                        time_strings = time_series.dt.strftime('%m/%d/%Y')
                    else:
                        # Try to parse as MM/DD/YYYY format first
                        try:
                            # Try parsing with MM/DD/YYYY format
                            parsed_times = pd.to_datetime(df[time_col], format='%m/%d/%Y', errors='coerce')
                            # Check if all dates were successfully parsed
                            if parsed_times.isna().any():
                                # Some dates couldn't be parsed with MM/DD/YYYY format
                                invalid_count = parsed_times.isna().sum()
                                validation_results["validation_status"] = "failed"
                                validation_results["issues"].append({
                                    "type": "time_validation",
                                    "column": time_col,
                                    "invalid_count": int(invalid_count),
                                    "message": f"Time column '{time_col}' has {invalid_count} values not in MM/DD/YYYY format"
                                })
                                # Continue with other validations even if format is wrong
                                time_series = parsed_times
                            else:
                                time_series = parsed_times
                            time_strings = time_series.dt.strftime('%m/%d/%Y')
                        except:
                            # Fallback: try pandas default parsing
                            parsed_times = pd.to_datetime(df[time_col], errors='coerce')
                            time_series = parsed_times
                            time_strings = parsed_times.dt.strftime('%m/%d/%Y')
                    
                    # Check for specific MM/DD/YYYY format using regex
                    date_pattern = r'^\d{2}/\d{2}/\d{4}$'
                    invalid_format_count = 0
                    
                    for idx, value in time_strings.items():
                        if pd.notna(value) and not re.match(date_pattern, str(value)):
                            invalid_format_count += 1
                    
                    if invalid_format_count > 0:
                        validation_results["validation_status"] = "failed"
                        validation_results["issues"].append({
                            "type": "time_validation",
                            "column": time_col,
                            "invalid_count": invalid_format_count,
                            "message": f"Time column '{time_col}' has {invalid_format_count} values not in MM/DD/YYYY format"
                        })
                    
                    # Check for invalid dates (NaT values after conversion)
                    invalid_dates = time_series.isna().sum()
                    if invalid_dates > 0:
                        validation_results["validation_status"] = "failed"
                        validation_results["issues"].append({
                            "type": "time_validation",
                            "column": time_col,
                            "invalid_count": int(invalid_dates),
                            "message": f"Time column '{time_col}' has {invalid_dates} invalid date/time values that could not be parsed"
                        })
                    
                    # Check for duplicate time values
                    if invalid_dates == 0:
                        duplicate_times = time_series.duplicated().sum()
                        if duplicate_times > 0:
                            validation_results["validation_status"] = "failed"
                            validation_results["issues"].append({
                                "type": "time_validation",
                                "column": time_col,
                                "duplicate_count": int(duplicate_times),
                                "message": f"Time column '{time_col}' has {duplicate_times} duplicate time values"
                            })
                        
                        # Check if time values are in chronological order (optional - might not always be required)
                        # Only check if we have valid dates
                        if len(time_series) > 1:
                            is_sorted = time_series.is_monotonic_increasing
                            if not is_sorted:
                                validation_results["issues"].append({
                                    "type": "time_validation",
                                    "column": time_col,
                                    "message": f"Time column '{time_col}' is not in chronological order (ascending)"
                                })
                                # Don't fail validation for unsorted times, just warn
                    
                except Exception as e:
                    validation_results["validation_status"] = "failed"
                    validation_results["issues"].append({
                        "type": "time_validation",
                        "column": time_col,
                        "message": f"Error validating time column '{time_col}': {str(e)}. Expected MM/DD/YYYY format."
                    })

        # Validate ODR column (must be percentage: 0-100)
        if "odr" in df_columns_normalized:
            # Find the actual column name (case-insensitive)
            odr_col = None
            for col in df.columns:
                if col.strip().lower() == "odr":
                    odr_col = col
                    break
            
            if odr_col is not None:
                try:
                    # Remove % symbol and convert to numeric (handles values like "5.026%")
                    odr_cleaned = df[odr_col].astype(str).str.replace('%', '', regex=False).str.strip()
                    odr_numeric = pd.to_numeric(odr_cleaned, errors='coerce')
                    
                    # Check for non-numeric values (NaT/NaN values after conversion)
                    non_numeric_count = odr_numeric.isna().sum()
                    # Subtract the count of originally missing values to get actual non-numeric count
                    originally_missing = df[odr_col].isna().sum()
                    actual_non_numeric = non_numeric_count - originally_missing
                    
                    if actual_non_numeric > 0:
                        validation_results["validation_status"] = "failed"
                        validation_results["issues"].append({
                            "type": "odr_validation",
                            "column": odr_col,
                            "invalid_count": int(actual_non_numeric),
                            "message": f"ODR column '{odr_col}' has {actual_non_numeric} non-numeric values. ODR column must contain only percentage values (0-100) with optional % symbol."
                        })
                    
                    # Check if values are in valid percentage range (0-100)
                    if actual_non_numeric == 0:
                        # Check for values outside 0-100 range
                        invalid_percentage = ((odr_numeric < 0) | (odr_numeric > 100)).sum()
                        if invalid_percentage > 0:
                            validation_results["validation_status"] = "failed"
                            validation_results["issues"].append({
                                "type": "odr_validation",
                                "column": odr_col,
                                "invalid_count": int(invalid_percentage),
                                "message": f"ODR column '{odr_col}' has {invalid_percentage} values outside valid percentage range (0-100). ODR must be a percentage between 0 and 100."
                            })
                        
                        # Check for negative values specifically
                        negative_count = (odr_numeric < 0).sum()
                        if negative_count > 0:
                            validation_results["validation_status"] = "failed"
                            validation_results["issues"].append({
                                "type": "odr_validation",
                                "column": odr_col,
                                "invalid_count": int(negative_count),
                                "message": f"ODR column '{odr_col}' has {negative_count} negative values. ODR percentage cannot be negative."
                            })
                        
                        # Check for values greater than 100
                        over_100_count = (odr_numeric > 100).sum()
                        if over_100_count > 0:
                            validation_results["validation_status"] = "failed"
                            validation_results["issues"].append({
                                "type": "odr_validation",
                                "column": odr_col,
                                "invalid_count": int(over_100_count),
                                "message": f"ODR column '{odr_col}' has {over_100_count} values greater than 100. ODR percentage must be between 0 and 100."
                            })
                    
                except Exception as e:
                    validation_results["validation_status"] = "failed"
                    validation_results["issues"].append({
                        "type": "odr_validation",
                        "column": odr_col,
                        "message": f"Error validating ODR column '{odr_col}': {str(e)}. ODR column must be a percentage (0-100)."
                    })

        return validation_results
        
    except Exception as e:
        traceback.print_exc()
        validation_results["validation_status"] = "error"
        validation_results["issues"].append({
            "type": "validation_error",
            "message": f"Error during validation: {str(e)}"
        })
        return validation_results

def validate_overlay_development_monthly_mev(df: pd.DataFrame, document_type: str, file_name: str) -> Dict[str, Any]:
    """
    Specialized validation for Monthly MEV documents
    """
    validation_results = _get_base_validation_results(file_name, document_type)
    
    try:
        print('VALIDATING MONTHLY MEV')
        df_copy = df.copy()
        
        # Read row 1 to determine column types (rates = percentages, count = integers)
        column_types = {}  # Maps column name to 'rates' or 'count'
        if len(df_copy) > 1:
            row1_data = df_copy.iloc[1]  # Row 1 contains metadata about column types
            for col in df_copy.columns:
                row1_value = str(row1_data[col]).strip().lower()
                if 'rate' in row1_value or 'rates' in row1_value:
                    column_types[col] = 'rates'
                elif 'count' in row1_value:
                    column_types[col] = 'count'
        
        # Skip rows 0 and 1 (header rows) before validation
        if len(df_copy) > 2:
            df = df_copy.iloc[2:].reset_index(drop=True)
        else:
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "data_validation",
                "message": "DataFrame has insufficient rows (must have at least 3 rows including header rows)"
            })
            return validation_results
        
        # Normalize column names for comparison (lowercase, strip spaces)
        df_columns_normalized = [col.strip().lower() for col in df.columns]
        
        # Required columns - validation fails if missing
        required_columns = ["year", "month (int)", "month", "id"]
        
        missing_required = [col for col in required_columns if col not in df_columns_normalized]
        if missing_required:
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "missing_required_columns",
                "columns": missing_required,
                "message": f"Missing required columns for: {', '.join(missing_required)}"
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

        # Check for missing data in each column
        missing_data = {}
        for column in df.columns:
            missing_count = df[column].isnull().sum()
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
            if data["missing_percentage"] > 10:
                validation_results["validation_status"] = "failed"

        # Check for empty columns
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

        # ---- Strict schema validation for Monthly/Quarterly MEV formats ----
        # Rules:
        # - year must be YYYY (4 digits)
        # - month (int) must be integer 1..12
        # - month must be 3-letter month name: Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec
        # - id must be exactly "YYYY-<Mon>" (e.g., "2025-Jan") and match the year/month columns
        try:
            def _find_col(lower_name: str) -> str | None:
                for c in df.columns:
                    if str(c).strip().lower() == lower_name:
                        return c
                return None

            year_col = _find_col("year")
            month_int_col = _find_col("month (int)")
            month_col = _find_col("month")
            id_col = _find_col("id")

            # Validate each column individually (missing columns already handled above)
            
            # YEAR: must be exactly 4 digits
            if year_col:
                year_s = df[year_col].astype(str).str.strip()
                invalid_year_mask = ~year_s.str.match(r"^\d{4}$", na=False)
                invalid_year_count = int(invalid_year_mask.sum())
                if invalid_year_count > 0:
                    validation_results["validation_status"] = "failed"
                    examples = year_s[invalid_year_mask].dropna().unique().tolist()[:10]
                    validation_results["issues"].append({
                        "type": "format_validation",
                        "column": year_col,
                        "invalid_count": invalid_year_count,
                        "message": f"Column '{year_col}' must be in YYYY format (4 digits). Examples of invalid values: {examples}"
                    })

            # MONTH (INT): must be integer 1..12 (no decimals, no text)
            if month_int_col:
                month_int_raw = df[month_int_col]
                month_int_num = pd.to_numeric(month_int_raw, errors="coerce")
                invalid_month_int_mask = (
                    month_int_num.isna()
                    | (month_int_num % 1 != 0)
                    | (month_int_num < 1)
                    | (month_int_num > 12)
                )
                invalid_month_int_count = int(invalid_month_int_mask.sum())
                if invalid_month_int_count > 0:
                    validation_results["validation_status"] = "failed"
                    examples = month_int_raw[invalid_month_int_mask].dropna().astype(str).unique().tolist()[:10]
                    validation_results["issues"].append({
                        "type": "format_validation",
                        "column": month_int_col,
                        "invalid_count": invalid_month_int_count,
                        "message": f"Column '{month_int_col}' must be an integer from 1 to 12. Examples of invalid values: {examples}"
                    })

            # MONTH: must be 3-letter month name (case-insensitive): Jan..Dec
            if month_col:
                month_s = df[month_col].astype(str).str.strip()
                invalid_month_mask = ~month_s.str.match(r"^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$", case=False, na=False)
                invalid_month_count = int(invalid_month_mask.sum())
                if invalid_month_count > 0:
                    validation_results["validation_status"] = "failed"
                    examples = month_s[invalid_month_mask].dropna().unique().tolist()[:10]
                    validation_results["issues"].append({
                        "type": "format_validation",
                        "column": month_col,
                        "invalid_count": invalid_month_count,
                        "message": f"Column '{month_col}' must be a 3-letter month name (Jan..Dec). Examples of invalid values: {examples}"
                    })

            # ID: must be exactly YYYY-<Mon> where <Mon> is the month string from month column
            # Only validate ID if both year and month columns exist (ID depends on both)
            if id_col and year_col and month_col:
                year_s = df[year_col].astype(str).str.strip()
                month_s = df[month_col].astype(str).str.strip()
                id_s = df[id_col].astype(str).str.strip()
                expected_id = year_s + "-" + month_s
                invalid_id_mask = id_s.ne(expected_id)
                invalid_id_count = int(invalid_id_mask.sum())
                if invalid_id_count > 0:
                    validation_results["validation_status"] = "failed"
                    examples = []
                    bad_idx = df.index[invalid_id_mask].tolist()[:10]
                    for i in bad_idx:
                        examples.append({
                            "row": int(i) if isinstance(i, (int,)) else str(i),
                            "id": str(id_s.loc[i]),
                            "expected": str(expected_id.loc[i])
                        })
                    validation_results["issues"].append({
                        "type": "format_validation",
                        "column": id_col,
                        "invalid_count": invalid_id_count,
                        "message": f"Column '{id_col}' must be exactly 'YYYY-<Mon>' (e.g., 2025-Jan) and match year/month columns."
                    })
        except Exception as e:
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "format_validation",
                "message": f"Error validating MEV schema (year/month/id): {str(e)}"
            })

        # Validate columns based on their type from row 1 (rates = percentages, count = integers)
        excluded_columns = {"year", "month (int)", "month", "id"}
        excluded_columns_normalized = {col.strip().lower() for col in excluded_columns}
        
        for col in df.columns:
            col_normalized = col.strip().lower()
            if col_normalized not in excluded_columns_normalized:
                col_type = column_types.get(col, None)
                
                try:
                    # Remove % symbol if present and convert to numeric
                    col_cleaned = df[col].astype(str).str.replace('%', '', regex=False).str.strip()
                    col_numeric = pd.to_numeric(col_cleaned, errors='coerce')
                    
                    # Check for non-numeric values
                    non_numeric_count = col_numeric.isna().sum()
                    originally_missing = df[col].isna().sum()
                    actual_non_numeric = non_numeric_count - originally_missing
                    
                    if actual_non_numeric > 0:
                        validation_results["validation_status"] = "failed"
                        validation_results["issues"].append({
                            "type": "data_type_validation",
                            "column": col,
                            "invalid_count": int(actual_non_numeric),
                            "message": f"Column '{col}' has {actual_non_numeric} non-numeric values."
                        })
                    
                    # Validate based on column type from row 1
                    if actual_non_numeric == 0:
                        if col_type == 'rates':
                            # Validate as percentage (0-100)
                            invalid_percentage = ((col_numeric < 0) | (col_numeric > 100)).sum()
                            if invalid_percentage > 0:
                                validation_results["validation_status"] = "failed"
                                validation_results["issues"].append({
                                    "type": "percentage_validation",
                                    "column": col,
                                    "invalid_count": int(invalid_percentage),
                                    "message": f"Column '{col}' (rates) has {invalid_percentage} values outside valid percentage range (0-100)."
                                })
                            
                            negative_count = (col_numeric < 0).sum()
                            if negative_count > 0:
                                validation_results["validation_status"] = "failed"
                                validation_results["issues"].append({
                                    "type": "percentage_validation",
                                    "column": col,
                                    "invalid_count": int(negative_count),
                                    "message": f"Column '{col}' (rates) has {negative_count} negative values."
                                })
                            
                            over_100_count = (col_numeric > 100).sum()
                            if over_100_count > 0:
                                validation_results["validation_status"] = "failed"
                                validation_results["issues"].append({
                                    "type": "percentage_validation",
                                    "column": col,
                                    "invalid_count": int(over_100_count),
                                    "message": f"Column '{col}' (rates) has {over_100_count} values greater than 100. Percentages must be between 0 and 100."
                                })
                        
                        elif col_type == 'count':
                            # Validate as integer (>= 0, whole numbers only)
                            # Check if values are integers (no decimals)
                            non_integer_count = ((col_numeric % 1 != 0) & col_numeric.notna()).sum()
                            if non_integer_count > 0:
                                validation_results["validation_status"] = "failed"
                                validation_results["issues"].append({
                                    "type": "integer_validation",
                                    "column": col,
                                    "invalid_count": int(non_integer_count),
                                    "message": f"Column '{col}' (count) has {non_integer_count} non-integer values. Count columns must contain whole numbers only."
                                })
                            
                            # Check for negative values
                            negative_count = (col_numeric < 0).sum()
                            if negative_count > 0:
                                validation_results["validation_status"] = "failed"
                                validation_results["issues"].append({
                                    "type": "integer_validation",
                                    "column": col,
                                    "invalid_count": int(negative_count),
                                    "message": f"Column '{col}' (count) has {negative_count} negative values. Count values cannot be negative."
                                })
                        
                        else:
                            # Column type not determined from row 1 - warn but don't fail
                            validation_results["issues"].append({
                                "type": "data_type_validation",
                                "column": col,
                                "message": f"Column '{col}' type could not be determined from row 1. Expected 'rates' or 'count' in metadata row."
                            })
                    
                except Exception as e:
                    validation_results["validation_status"] = "failed"
                    validation_results["issues"].append({
                        "type": "data_type_validation",
                        "column": col,
                        "message": f"Error validating column '{col}': {str(e)}"
                    })

        return validation_results
        
    except Exception as e:
        traceback.print_exc()
        validation_results["validation_status"] = "error"
        validation_results["issues"].append({
            "type": "validation_error",
            "message": f"Error during validation: {str(e)}"
        })
        return validation_results

def validate_overlay_development_quarterly_mev(df: pd.DataFrame, document_type: str, file_name: str) -> Dict[str, Any]:
    """
    Specialized validation for documents
    """
    validation_results = _get_base_validation_results(file_name, document_type)
    
    try:
        print('VALIDATING MONTHLY MEV')
        df_copy = df.copy()
        
        # Read row 1 to determine column types (rates = percentages, count = integers)
        column_types = {}  # Maps column name to 'rates' or 'count'
        if len(df_copy) > 1:
            row1_data = df_copy.iloc[1]  # Row 1 contains metadata about column types
            for col in df_copy.columns:
                row1_value = str(row1_data[col]).strip().lower()
                if 'rate' in row1_value or 'rates' in row1_value:
                    column_types[col] = 'rates'
                elif 'count' in row1_value:
                    column_types[col] = 'count'
        
        # Skip rows 0 and 1 (header rows) before validation
        if len(df_copy) > 2:
            df = df_copy.iloc[2:].reset_index(drop=True)
        else:
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "data_validation",
                "message": "DataFrame has insufficient rows (must have at least 3 rows including header rows)"
            })
            return validation_results
        
        # Normalize column names for comparison (lowercase, strip spaces)
        df_columns_normalized = [col.strip().lower() for col in df.columns]
        
        # Required columns - validation fails if missing
        required_columns = ["year", "quarter", "month", "id", "x"]
        
        missing_required = [col for col in required_columns if col not in df_columns_normalized]
        if missing_required:
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "missing_required_columns",
                "columns": missing_required,
                "message": f"Missing required columns for: {', '.join(missing_required)}"
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

        # Check for missing data in each column
        missing_data = {}
        for column in df.columns:
            missing_count = df[column].isnull().sum()
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
            if data["missing_percentage"] > 10:
                validation_results["validation_status"] = "failed"

        # Check for empty columns
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

        # ---- Strict schema validation for Monthly/Quarterly MEV formats ----
        # Rules:
        # - year must be YYYY (4 digits)
        # - month (int) must be integer 1..4
        # - month must be 3-letter month name: Mar, Jun, Sep, Oct
        # - id must be exactly "YYYY-<Mon>" (e.g., "2025-Jan") and match the year/month columns
        try:
            def _find_col(lower_name: str) -> str | None:
                for c in df.columns:
                    if str(c).strip().lower() == lower_name:
                        return c
                return None

            year_col = _find_col("year")
            month_int_col = _find_col("month (int)")
            month_col = _find_col("month")
            id_col = _find_col("id")

            # Validate each column individually (missing columns already handled above)
            
            # YEAR: must be exactly 4 digits
            if year_col:
                year_s = df[year_col].astype(str).str.strip()
                invalid_year_mask = ~year_s.str.match(r"^\d{4}$", na=False)
                invalid_year_count = int(invalid_year_mask.sum())
                if invalid_year_count > 0:
                    validation_results["validation_status"] = "failed"
                    examples = year_s[invalid_year_mask].dropna().unique().tolist()[:10]
                    validation_results["issues"].append({
                        "type": "format_validation",
                        "column": year_col,
                        "invalid_count": invalid_year_count,
                        "message": f"Column '{year_col}' must be in YYYY format (4 digits). Examples of invalid values: {examples}"
                    })

            # MONTH (INT): must be integer 1..12 (no decimals, no text)
            if month_int_col:
                month_int_raw = df[month_int_col]
                month_int_num = pd.to_numeric(month_int_raw, errors="coerce")
                invalid_month_int_mask = (
                    month_int_num.isna()
                    | (month_int_num % 1 != 0)
                    | (month_int_num < 1)
                    | (month_int_num > 4)
                )
                invalid_month_int_count = int(invalid_month_int_mask.sum())
                if invalid_month_int_count > 0:
                    validation_results["validation_status"] = "failed"
                    examples = month_int_raw[invalid_month_int_mask].dropna().astype(str).unique().tolist()[:10]
                    validation_results["issues"].append({
                        "type": "format_validation",
                        "column": month_int_col,
                        "invalid_count": invalid_month_int_count,
                        "message": f"Column '{month_int_col}' must be an integer from 1 to 4. Examples of invalid values: {examples}"
                    })

            # MONTH: must be 3-letter month name (case-insensitive): Jan..Dec
            if month_col:
                month_s = df[month_col].astype(str).str.strip()
                invalid_month_mask = ~month_s.str.match(r"^(Mar|Jun|Sep|Dec)$", case=False, na=False)
                invalid_month_count = int(invalid_month_mask.sum())
                if invalid_month_count > 0:
                    validation_results["validation_status"] = "failed"
                    examples = month_s[invalid_month_mask].dropna().unique().tolist()[:10]
                    validation_results["issues"].append({
                        "type": "format_validation",
                        "column": month_col,
                        "invalid_count": invalid_month_count,
                        "message": f"Column '{month_col}' must be a 3-letter month name (Mar, Jun, Sep, Dec). Examples of invalid values: {examples}"
                    })

            # ID: must be exactly YYYY-<Mon> where <Mon> is the month string from month column
            # Only validate ID if both year and month columns exist (ID depends on both)
            if id_col and year_col and month_col:
                year_s = df[year_col].astype(str).str.strip()
                month_s = df[month_col].astype(str).str.strip()
                id_s = df[id_col].astype(str).str.strip()
                expected_id = year_s + "-" + month_s
                invalid_id_mask = id_s.ne(expected_id)
                invalid_id_count = int(invalid_id_mask.sum())
                if invalid_id_count > 0:
                    validation_results["validation_status"] = "failed"
                    examples = []
                    bad_idx = df.index[invalid_id_mask].tolist()[:10]
                    for i in bad_idx:
                        examples.append({
                            "row": int(i) if isinstance(i, (int,)) else str(i),
                            "id": str(id_s.loc[i]),
                            "expected": str(expected_id.loc[i])
                        })
                    validation_results["issues"].append({
                        "type": "format_validation",
                        "column": id_col,
                        "invalid_count": invalid_id_count,
                        "message": f"Column '{id_col}' must be exactly 'YYYY-<Mon>' (e.g., 2025-Mar, 2025-Jun, 2025-Sep, 2025-Dec) and match year/month columns. Examples: {examples}"
                    })
        except Exception as e:
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "format_validation",
                "message": f"Error validating MEV schema (year/month/id): {str(e)}"
            })

        # Validate column "x" - must be float (numeric with possible decimals)
        try:
            def _find_col_x(lower_name: str) -> str | None:
                for c in df.columns:
                    if str(c).strip().lower() == lower_name:
                        return c
                return None
            
            x_col = _find_col_x("x")
            if x_col:
                # Remove % symbol if present and convert to numeric
                x_cleaned = df[x_col].astype(str).str.replace('%', '', regex=False).str.strip()
                x_numeric = pd.to_numeric(x_cleaned, errors='coerce')
                
                # Check for non-numeric values
                non_numeric_count = x_numeric.isna().sum()
                originally_missing = df[x_col].isna().sum()
                actual_non_numeric = non_numeric_count - originally_missing
                
                if actual_non_numeric > 0:
                    validation_results["validation_status"] = "failed"
                    validation_results["issues"].append({
                        "type": "data_type_validation",
                        "column": x_col,
                        "invalid_count": int(actual_non_numeric),
                        "message": f"Column '{x_col}' must be numeric (float). Found {actual_non_numeric} non-numeric values."
                    })
        except Exception as e:
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "data_type_validation",
                "column": "x",
                "message": f"Error validating column 'x' (must be float): {str(e)}"
            })

        # Validate columns based on their type from row 1 (rates = percentages, count = integers)
        excluded_columns = {"year", "month (int)", "month", "id", "x", "quarter"}
        excluded_columns_normalized = {col.strip().lower() for col in excluded_columns}
        
        for col in df.columns:
            col_normalized = col.strip().lower()
            if col_normalized not in excluded_columns_normalized:
                col_type = column_types.get(col, None)
                
                try:
                    # Remove % symbol if present and convert to numeric
                    col_cleaned = df[col].astype(str).str.replace('%', '', regex=False).str.strip()
                    col_numeric = pd.to_numeric(col_cleaned, errors='coerce')
                    
                    # Check for non-numeric values
                    non_numeric_count = col_numeric.isna().sum()
                    originally_missing = df[col].isna().sum()
                    actual_non_numeric = non_numeric_count - originally_missing
                    
                    if actual_non_numeric > 0:
                        validation_results["validation_status"] = "failed"
                        validation_results["issues"].append({
                            "type": "data_type_validation",
                            "column": col,
                            "invalid_count": int(actual_non_numeric),
                            "message": f"Column '{col}' has {actual_non_numeric} non-numeric values."
                        })
                    
                    # Validate based on column type from row 1
                    if actual_non_numeric == 0:
                        if col_type == 'rates':
                            # Validate as percentage (0-100)
                            invalid_percentage = ((col_numeric < 0) | (col_numeric > 100)).sum()
                            if invalid_percentage > 0:
                                validation_results["validation_status"] = "failed"
                                validation_results["issues"].append({
                                    "type": "percentage_validation",
                                    "column": col,
                                    "invalid_count": int(invalid_percentage),
                                    "message": f"Column '{col}' (rates) has {invalid_percentage} values outside valid percentage range (0-100)."
                                })
                            
                            negative_count = (col_numeric < 0).sum()
                            if negative_count > 0:
                                validation_results["validation_status"] = "failed"
                                validation_results["issues"].append({
                                    "type": "percentage_validation",
                                    "column": col,
                                    "invalid_count": int(negative_count),
                                    "message": f"Column '{col}' (rates) has {negative_count} negative values."
                                })
                            
                            over_100_count = (col_numeric > 100).sum()
                            if over_100_count > 0:
                                validation_results["validation_status"] = "failed"
                                validation_results["issues"].append({
                                    "type": "percentage_validation",
                                    "column": col,
                                    "invalid_count": int(over_100_count),
                                    "message": f"Column '{col}' (rates) has {over_100_count} values greater than 100. Percentages must be between 0 and 100."
                                })
                        
                        elif col_type == 'count':
                            # Validate as integer (>= 0, whole numbers only)
                            # Check if values are integers (no decimals)
                            non_integer_count = ((col_numeric % 1 != 0) & col_numeric.notna()).sum()
                            if non_integer_count > 0:
                                validation_results["validation_status"] = "failed"
                                validation_results["issues"].append({
                                    "type": "integer_validation",
                                    "column": col,
                                    "invalid_count": int(non_integer_count),
                                    "message": f"Column '{col}' (count) has {non_integer_count} non-integer values. Count columns must contain whole numbers only."
                                })
                            
                            # Check for negative values
                            negative_count = (col_numeric < 0).sum()
                            if negative_count > 0:
                                validation_results["validation_status"] = "failed"
                                validation_results["issues"].append({
                                    "type": "integer_validation",
                                    "column": col,
                                    "invalid_count": int(negative_count),
                                    "message": f"Column '{col}' (count) has {negative_count} negative values. Count values cannot be negative."
                                })
                        
                        else:
                            # Column type not determined from row 1 - warn but don't fail
                            validation_results["issues"].append({
                                "type": "data_type_validation",
                                "column": col,
                                "message": f"Column '{col}' type could not be determined from row 1. Expected 'rates' or 'count' in metadata row."
                            })
                    
                except Exception as e:
                    validation_results["validation_status"] = "failed"
                    validation_results["issues"].append({
                        "type": "data_type_validation",
                        "column": col,
                        "message": f"Error validating column '{col}': {str(e)}"
                    })

        return validation_results
        
    except Exception as e:
        traceback.print_exc()
        validation_results["validation_status"] = "error"
        validation_results["issues"].append({
            "type": "validation_error",
            "message": f"Error during validation: {str(e)}"
        })
        return validation_results

