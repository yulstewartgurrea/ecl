import pandas as pd
import re
from typing import Dict, Any

from .validate_generic_document import validate_generic_document

from ..clean_up.clean_up import clean_document

import traceback


def validate_flowrate_document(df: pd.DataFrame, document_type: str, file_name: str, temp_path = None ) -> Dict[str, Any]:
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
    if document_type == "FLOWRATE_APPROACH_WRITE_OFF_ACCOUNTS":
        print("Flowrate Approach")
        return validate_write_off_accounts(df, document_type, file_name)
    elif document_type == "FLOWRATE_APPROACH_AGING_REPORT":
        print("Flowrate Approach Aging Report")
        return validate_aging_report(df, document_type, file_name, temp_path)
    elif document_type == "FLOWRATE_APPROACH_COLLECTION_RATE":
        print("Flowrate Approach Collection Rate")
        return validate_collection_rate_multiple_sheets(temp_path, document_type, file_name)
    elif document_type == "FLOWRATE_APPROACH_DETAILED_BY_PRODUCT":
        print("Flowrate Approach Detailed by Product")
        return validate_detailed_by_product_multiple_sheets(temp_path, document_type, file_name)
    elif document_type == "FLOWRATE_APPROACH_FS_CURRENT_BALANCE":
        print("Flowrate Approach FS Current Balance")
        return validate_fs_current_balance(df, document_type, file_name)
    elif document_type == "FLOWRATE_APPROACH_MIS_DATA":
        print("Flowrate Approach MIS Data")
        return validate_mis_data(df, document_type, file_name)
    elif document_type == "FLOWRATE_APPROACH_REPORTS_GENERATED_EXTRACTED_CAMS":
        print("Flowrate Approach Reports Generated and Extracted in CAMS")
        return validate_reports_generated_extracted_cams(df, document_type, file_name)
    else:
        print("Flowrate Approach Generic")
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


def validate_write_off_accounts(df: pd.DataFrame, document_type: str, file_name: str) -> Dict[str, Any]:
    """
    Specialized validation for documents
    """
    validation_results = _get_base_validation_results(file_name, document_type)
    
    try:
        # Normalize column names for comparison (lowercase, strip spaces)
        df_columns_normalized = [col.strip().lower() for col in df.columns]
        
        # Required columns - validation fails if missing
        required_columns = ["id",
                            "branchno",
                            "bad_debts",
                            "savings",
                            "net_risk",
                            "date_closed",
                            "is_paid",
                            "date_paid",
                            "slot",
                            "group_id",
                            "status"]
        
        missing_required = [col for col in required_columns if col not in df_columns_normalized]
        if missing_required:
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "missing_required_columns",
                "columns": missing_required,
                "message": f"Missing required columns for: {', '.join(missing_required)}"
            })
        
        # Expected columns - warnings if missing (subset of required for additional validation)
        expected_columns = ["id", "branchno", "bad_debts", "net_risk"]
        missing_expected = [col for col in expected_columns if col not in df_columns_normalized]
        if missing_expected:
            validation_results["issues"].append({
                "type": "missing_expected_columns",
                "columns": missing_expected,
                "message": f"Missing expected columns for: {', '.join(missing_expected)}"
            })
        
        # Validate numeric columns
        numeric_columns = ["bad_debts", "savings", "net_risk"]
        for col in numeric_columns:
            if col in df_columns_normalized:
                # Find the actual column name in the DataFrame
                actual_col_name = df.columns[df_columns_normalized.index(col)]
                
                if not pd.api.types.is_numeric_dtype(df[actual_col_name]):
                    validation_results["validation_status"] = "failed"
                    validation_results["issues"].append({
                        "type": "data_type_issue",
                        "column": actual_col_name,
                        "expected": "numeric",
                        "actual": str(df[actual_col_name].dtype),
                        "message": f"Column '{actual_col_name}' should be numeric for"
                    })
                else:
                    # Check for negative amounts (might be invalid)
                    negative_count = (df[actual_col_name] < 0).sum()
                    if negative_count > 0:
                        validation_results["validation_status"] = "failed"
                        validation_results["issues"].append({
                            "type": "data_validation",
                            "column": actual_col_name,
                            "message": f"Column '{actual_col_name}' has {negative_count} negative values - verify if this is correct"
                        })
        
        # Validate date columns
        date_columns = ["date_closed"]
        for col in date_columns:
            if col in df_columns_normalized:
                # Find the actual column name in the DataFrame
                actual_col_name = df.columns[df_columns_normalized.index(col)]
                
                try:
                    pd.to_datetime(df[actual_col_name], errors='raise')
                except:
                    validation_results["validation_status"] = "failed"
                    validation_results["issues"].append({
                        "type": "date_format",
                        "column": actual_col_name,
                        "message": f"Column '{actual_col_name}' contains invalid date formats"
                    })
        
        # Add other validations
        
        return validation_results
        
    except Exception as e:
        traceback.print_exc()
        validation_results["validation_status"] = "error"
        validation_results["issues"].append({
            "type": "validation_error",
            "message": f"Error during validation: {str(e)}"
        })
        return validation_results


def _validate_aging_column_patterns(df: pd.DataFrame, validation_results: Dict[str, Any]) -> None:
    """
    Validates columns with patterns PAR/MPD/DPD followed by numbers.
    Rules:
    - Must start with 1
    - Must be in ascending order
    - After 1, increments must be exactly 30 (1, 30, 60, 90, 120, ...)
    - Only one prefix type (PAR, MPD, or DPD) should exist
    - Case-insensitive: par/PAR/Par, mpd/MPD/Mpd, dpd/DPD/Dpd are all treated the same
    
    Args:
        df: DataFrame to validate
        validation_results: Validation results dictionary to update
    """
    # Pattern to match: PAR/MPD/DPD followed by optional space and number
    # re.IGNORECASE ensures case-insensitive matching (par/PAR/Par, mpd/MPD/Mpd, etc.)
    pattern = re.compile(r'^(PAR|MPD|DPD)\s*(\d+)$', re.IGNORECASE)
    
    # Group columns by prefix (normalized to uppercase for consistency)
    prefix_groups = {'PAR': [], 'MPD': [], 'DPD': []}
    
    # Scan all columns and group by prefix (case-insensitive)
    for col in df.columns:
        match = pattern.match(str(col).strip())
        if match:
            # Normalize prefix to uppercase (par -> PAR, Mpd -> MPD, etc.)
            prefix = match.group(1).upper()
            number = int(match.group(2))
            prefix_groups[prefix].append((col, number))
    
    # Check if only one prefix type exists (PAR, MPD, or DPD - not multiple)
    found_prefixes = [prefix for prefix, cols in prefix_groups.items() if cols]
    if len(found_prefixes) > 1:
        # Get all column names from all found prefixes
        all_columns = []
        for prefix in found_prefixes:
            all_columns.extend([col for col, _ in prefix_groups[prefix]])
        
        validation_results["validation_status"] = "failed"
        validation_results["issues"].append({
            "type": "aging_column_pattern",
            "prefixes": found_prefixes,
            "columns": all_columns,
            "message": f"Only one prefix type (PAR, MPD, or DPD) should exist, but found multiple: {', '.join(found_prefixes)}. Columns: {', '.join(all_columns)}"
        })
        return  # Exit early since multiple prefixes is an error
    
    # Validate each prefix group
    for prefix, columns_with_numbers in prefix_groups.items():
        if not columns_with_numbers:
            continue  # Skip if no columns found for this prefix
        
        # Sort by number to check order
        columns_with_numbers.sort(key=lambda x: x[1])
        numbers = [num for _, num in columns_with_numbers]
        column_names = [col for col, _ in columns_with_numbers]
        
        # Check if starts with 1
        if numbers[0] != 1:
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "aging_column_pattern",
                "prefix": prefix,
                "columns": column_names,
                "message": f"{prefix} columns must start with 1, but found starting value: {numbers[0]}. Columns: {', '.join(column_names)}"
            })
            continue
        
        # Check if in ascending order
        if numbers != sorted(numbers):
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "aging_column_pattern",
                "prefix": prefix,
                "columns": column_names,
                "message": f"{prefix} columns are not in ascending order. Found: {', '.join(column_names)}"
            })
            continue
        
        # Check if increments are by 30 after 1
        # Pattern: 1, then 30, then 60, 90, 120, etc. (increments of 30)
        missing_values = []
        for i in range(1, len(numbers)):
            if i == 1:
                # After 1, the next value MUST be 30
                expected = 30
            else:
                # After 30, each subsequent value must be previous + 30
                expected = numbers[i-1] + 30
            
            if numbers[i] != expected:
                # Check if it's a missing intermediate value (gap is more than 30)
                if numbers[i] > expected:
                    # There's a gap - missing intermediate values
                    for missing_val in range(expected, numbers[i], 30):
                        missing_values.append(f"{prefix} {missing_val}")
                else:
                    # Invalid increment
                    validation_results["validation_status"] = "failed"
                    validation_results["issues"].append({
                        "type": "aging_column_pattern",
                        "prefix": prefix,
                        "columns": column_names,
                        "message": f"{prefix} columns must follow pattern: 1, 30, 60, 90... Found '{column_names[i]}' with value {numbers[i]} but expected {expected} after '{column_names[i-1]}'"
                    })
                    break
        
        # Report missing intermediate values
        if missing_values:
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "aging_column_pattern",
                "prefix": prefix,
                "columns": column_names,
                "missing_columns": missing_values,
                "message": f"{prefix} columns are missing intermediate values: {', '.join(missing_values)}. Found columns: {', '.join(column_names)}"
            })


def validate_aging_report(df: pd.DataFrame, document_type: str, file_name: str, temp_path: str) -> Dict[str, Any]:
    """
    Specialized validation for Aging Report documents
    
    Expected columns: account_id, current, 1-30_days, 31-60_days, 61-90_days, over_90_days
    Required columns: account_id
    """
    
    validation_results = _get_base_validation_results(file_name, document_type)

    try:
        # Validate PAR/MPD/DPD column patterns
        _validate_aging_column_patterns(df, validation_results)

        # Required columns
        required_columns = [
            "Date",	
            "Total Loan Balance with C/P",
            "0 Day"
        ]
        required_columns = [col.strip().lower() for col in required_columns]
        missing_required = [col for col in required_columns if col not in df.columns]
        if missing_required:
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "missing_required_columns",
                "columns": missing_required,
                "message": f"Missing required columns for Aging Report: {', '.join(missing_required)}"
            })
        
        numeric_columns = [
            "Total Loan Balance with C/P",
            "0 Day"
        ]
        numeric_columns = [col.strip().lower() for col in numeric_columns]
        for col in numeric_columns:
            if col in df.columns:
                # Remove commas and convert to numeric
                df[col] = df[col].astype(str).str.replace(',', '').astype(float, errors='ignore')
        
        # Validate numeric columns
        for col in numeric_columns:
            if col in df.columns:
                if not pd.api.types.is_numeric_dtype(df[col]):
                    validation_results["issues"].append({
                        "type": "data_type_issue",
                        "column": col,
                        "expected": "numeric",
                        "actual": str(df[col].dtype),
                        "message": f"Column '{col}' should be numeric for"
                    })
                else:
                    # Check for negative amounts (might be invalid)
                    negative_count = (df[col] < 0).sum()
                    if negative_count > 0:
                        validation_results["issues"].append({
                            "type": "data_validation",
                            "column": col,
                            "message": f"Column '{col}' has {negative_count} negative values - verify if this is correct"
                        })

        # Validate date format (MM/DD/YYYY)
        date_columns = ["date"]  # Add your date column names here
        for col_lower in date_columns:
            # Find the actual column name (case-insensitive)
            actual_col = None
            for col in df.columns:
                if col.strip().lower() == col_lower:
                    actual_col = col
                    break
            
            if actual_col is not None:
                try:
                    # Check if column is already datetime type
                    if pd.api.types.is_datetime64_any_dtype(df[actual_col]):
                        # Convert datetime to MM/DD/YYYY string format
                        date_strings = df[actual_col].dt.strftime('%m/%d/%Y')
                    else:
                        # Try to parse as MM/DD/YYYY format first
                        # If that fails, try pandas default parsing
                        try:
                            # Try parsing with MM/DD/YYYY format
                            parsed_dates = pd.to_datetime(df[actual_col], format='%m/%d/%Y', errors='coerce')
                            # Check if all dates were successfully parsed
                            if parsed_dates.isna().any():
                                # Some dates couldn't be parsed with MM/DD/YYYY format
                                invalid_count = parsed_dates.isna().sum()
                                validation_results["validation_status"] = "failed"
                                validation_results["issues"].append({
                                    "type": "date_format",
                                    "column": actual_col,
                                    "invalid_count": int(invalid_count),
                                    "message": f"Column '{actual_col}' has {invalid_count} values not in MM/DD/YYYY format"
                                })
                                continue
                            date_strings = parsed_dates.dt.strftime('%m/%d/%Y')
                        except:
                            # Fallback: try pandas default parsing
                            parsed_dates = pd.to_datetime(df[actual_col], errors='coerce')
                            date_strings = parsed_dates.dt.strftime('%m/%d/%Y')
                    
                    # Check for specific MM/DD/YYYY format
                    date_pattern = r'^\d{2}/\d{2}/\d{4}$'
                    invalid_format_count = 0
                    
                    for idx, value in date_strings.items():
                        if pd.notna(value) and not re.match(date_pattern, str(value)):
                            invalid_format_count += 1
                    
                    if invalid_format_count > 0:
                        validation_results["validation_status"] = "failed"
                        validation_results["issues"].append({
                            "type": "date_format",
                            "column": actual_col,
                            "invalid_count": invalid_format_count,
                            "message": f"Column '{actual_col}' has {invalid_format_count} values not in MM/DD/YYYY format"
                        })
                        
                except Exception as e:
                    validation_results["validation_status"] = "failed"
                    validation_results["issues"].append({
                        "type": "date_format",
                        "column": actual_col,
                        "message": f"Column '{actual_col}' contains invalid date formats. Expected MM/DD/YYYY format. Error: {str(e)}"
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
        
        # Check for columns with all same values
        constant_columns = []
        for column in df.columns:
            if df[column].nunique() == 1 and not df[column].isnull().all():
                constant_columns.append(column)
                validation_results["issues"].append({
                    "type": "constant_column",
                    "column": column,
                    "value": str(df[column].iloc[0]),
                    "message": f"Column '{column}' has only one unique value: {df[column].iloc[0]}"
                })
                
                # Fail validation for constant columns (they provide no useful information)
                validation_results["validation_status"] = "failed"
        
        return validation_results
        
    except Exception as e:
        traceback.print_exc()
        validation_results["validation_status"] = "error"
        validation_results["issues"].append({
            "type": "validation_error",
            "message": f"Error during Aging Report validation: {str(e)}"
        })
        return validation_results


def validate_collection_rate_multiple_sheets(excel_file: pd.ExcelFile, document_type: str, file_name: str) -> Dict[str, Any]:
    """
    Specialized validation for Collection Rate documents with multiple sheets
    
    Args:
        excel_file: ExcelFile object (already opened)
        document_type: Type of flowrate document
        file_name: Name of the file being validated
    
    Returns:
        Dict containing validation results for all sheets
    """
    validation_results = _get_base_validation_results(file_name, document_type)
    
    try:
        # Get sheet names from the already opened Excel file
        sheet_names = excel_file.sheet_names
        # make sheet names lower case
        sheet_names = [sheet_name for sheet_name in sheet_names]
        checker_sheet_names = [sheet_name.lower() for sheet_name in sheet_names]
        
        validation_results["sheet_results"] = {}
        validation_results["total_sheets"] = len(sheet_names)
        
        overall_status = "passed"

        # sheet this sheet names exists Daily Report, Product Report, Per Branch Report
        required_sheet_names = ["daily report", "product report", "per branch report"]
        # if one of the sheet name does not exists overal return exception add to error missing sheet
        for sheet_name in required_sheet_names:
            if sheet_name not in checker_sheet_names:
                validation_results["validation_status"] = "failed"
                validation_results["issues"].append({
                    "type": "missing_sheets",
                    "sheets": [sheet_name],
                    "message": f"Missing sheet for Collection Rate: {sheet_name}"
                })
        
        # Read all sheets data at once to avoid multiple file opens
        all_sheets_data = {}
        for sheet_name in sheet_names:
            all_sheets_data[sheet_name] = pd.read_excel(excel_file, sheet_name=sheet_name)

        # Process each sheet
        for sheet_name in sheet_names:
            print(f"Processing sheet: {sheet_name}")
            
            # Get the sheet data
            df = all_sheets_data[sheet_name]
            
            # Drop unnamed columns (case-insensitive)
            df = df.loc[:, ~df.columns.str.contains('unnamed', case=False, na=False)]
            df.columns = df.columns.str.strip().str.lower()
            
            print(f"Sheet '{sheet_name}' columns: {list(df.columns)}")
            
            # Clean numeric columns - remove commas and convert to numeric
            if sheet_name.lower() == "daily report":
                required_columns = ["date",
                                    "expected target", 
                                    "actual target", 
                                    "advance", 
                                    "collection", 
                                    "missed payment",
                                    "rate(%)"]
                numeric_columns = ["expected target", 
                                    "actual target", 
                                    "advance", 
                                    "collection", 
                                    "missed payment"]
            elif sheet_name.lower() == "product report":
                required_columns = ["product",
                                    "expected target", 
                                    "actual target", 
                                    "advance", 
                                    "collection", 
                                    "missed payment",
                                    "rate(%)"]
                numeric_columns = ["expected target", 
                                    "actual target", 
                                    "advance", 
                                    "collection", 
                                    "missed payment"]
            elif sheet_name.lower() == "per branch report":
                required_columns = ["branch code",
                                    "expected target", 
                                    "actual target", 
                                    "advance", 
                                    "collection", 
                                    "missed payment",
                                    "rate(%)"]
                numeric_columns = ["expected target", 
                                    "actual target", 
                                    "advance", 
                                    "collection", 
                                    "missed payment"]
            else: 
                # riase exception invalid sheet name
                raise Exception(f"Invalid sheet name: {sheet_name}")

            for col in numeric_columns:
                if col in df.columns:
                    # Remove commas and convert to numeric
                    df[col] = df[col].astype(str).str.replace(',', '').astype(float, errors='ignore')
            
            # Clean percentage column - remove % symbol and convert to numeric
            if "rate(%)" in df.columns:
                df["rate(%)"] = df["rate(%)"].astype(str).str.replace('%', '').astype(float, errors='ignore')

            # Required columns
            sheet_issues = []
            sheet_status = "passed"
            
            # Check for missing required columns
            missing_required = [col for col in required_columns if col not in df.columns]
            if missing_required:
                sheet_status = "failed"
                sheet_issues.append({
                    "type": "missing_required_columns",
                    "columns": missing_required,
                    "message": f"Missing required columns for Collection Rate sheet '{sheet_name}': {', '.join(missing_required)}"
                })
            
            # Validate collection rate percentage
            if "rate(%)" in df.columns:
                if not pd.api.types.is_numeric_dtype(df["rate(%)"]):
                    sheet_issues.append({
                        "type": "data_type_issue",
                        "column": "rate(%)",
                        "expected": "numeric",
                        "actual": str(df["rate(%)"].dtype),
                        "message": f"Collection rate should be numeric in sheet '{sheet_name}'"
                    })
                else:
                    # Check for collection rates outside 0-100% range
                    invalid_rates = ((df["rate(%)"] < 0) | (df["rate(%)"] > 100)).sum()
                    if invalid_rates > 0:
                        sheet_issues.append({
                            "type": "data_validation",
                            "column": "rate(%)",
                            "message": f"Found {invalid_rates} collection rates outside 0-100% range in sheet '{sheet_name}'"
                        })
            
            # Validate numeric columns
            for col in numeric_columns:
                if col in df.columns:
                    if not pd.api.types.is_numeric_dtype(df[col]):
                        sheet_issues.append({
                            "type": "data_type_issue",
                            "column": col,
                            "expected": "numeric",
                            "actual": str(df[col].dtype),
                            "message": f"Column '{col}' should be numeric for Collection Rate in sheet '{sheet_name}'"
                        })
                    else:
                        # Check for negative amounts (might be invalid)
                        negative_count = (df[col] < 0).sum()
                        if negative_count > 0:
                            sheet_issues.append({
                                "type": "data_validation",
                                "column": col,
                                "message": f"Column '{col}' has {negative_count} negative values in sheet '{sheet_name}' - verify if this is correct"
                            })
            
            # Store sheet results
            validation_results["sheet_results"][sheet_name] = {
                "status": sheet_status,
                "issues": sheet_issues,
                "row_count": len(df),
                "columns": list(df.columns)
            }
            
            # Update overall status
            if sheet_status == "failed":
                overall_status = "failed"
            elif sheet_status == "error":
                overall_status = "error"
        
        validation_results["validation_status"] = overall_status
        
        # Add summary information
        validation_results["summary"] = {
            "total_sheets": len(sheet_names),
            "sheets_passed": sum(1 for sheet in validation_results["sheet_results"].values() if sheet["status"] == "passed"),
            "sheets_failed": sum(1 for sheet in validation_results["sheet_results"].values() if sheet["status"] == "failed"),
            "sheets_with_errors": sum(1 for sheet in validation_results["sheet_results"].values() if sheet["status"] == "error")
        }
        
        return validation_results
        
    except Exception as e:
        validation_results["validation_status"] = "error"
        validation_results["issues"].append({
            "type": "validation_error",
            "message": f"Error during Collection Rate multiple sheets validation: {str(e)}"
        })
        return validation_results


def validate_detailed_by_product_multiple_sheets(excel_file: pd.ExcelFile, document_type: str, file_name: str) -> Dict[str, Any]:
    """
    Specialized validation for Detailed by Product documents
    
    Expected columns: product_code, product_name, balance, count
    Required columns: product_code
    """
    validation_results = _get_base_validation_results(file_name, document_type)
    
    try:
        # Get sheet names from the already opened Excel file
        sheet_names = excel_file.sheet_names
        # make sheet names lower case
        sheet_names = [sheet_name for sheet_name in sheet_names]
        checker_sheet_names = [sheet_name.lower() for sheet_name in sheet_names]
        
        validation_results["sheet_results"] = {}
        validation_results["total_sheets"] = len(sheet_names)
        
        overall_status = "passed"

        all_sheets_data = {}
        for sheet_name in sheet_names:
            all_sheets_data[sheet_name] = pd.read_excel(excel_file, sheet_name=sheet_name)

        for sheet_name in sheet_names:
            if sheet_name == "AtGlance&Performance":
                continue

            print(f"Processing sheet: {sheet_name}")

            df = all_sheets_data[sheet_name]

            # find row number that has a branch name
            branch_row = df[df.apply(lambda row: any(str(row).lower().__contains__(name) for name in ['branch']), axis=1)].index[0]

            # ffill branch_row with same values to the right
            df.iloc[branch_row] = df.iloc[branch_row].ffill(axis=0)

            # combine rows branch_row and row after it
            branch_row_after = branch_row + 1
            df.iloc[branch_row_after] = df.iloc[branch_row_after].ffill(axis=0)

            # fillna('') branch_row + 1
            df.iloc[branch_row_after] = df.iloc[branch_row_after].fillna('')
            df.iloc[branch_row] = df.iloc[branch_row].str.cat(df.iloc[branch_row_after], sep=' ')

            # drop branch_row_after 
            df = df.drop(branch_row_after).reset_index(drop=True)

            df.iloc[branch_row_after] = df.iloc[branch_row_after].fillna('')
            df.iloc[branch_row] = df.iloc[branch_row].str.cat(df.iloc[branch_row_after], sep=' ')
            # drop branch_row_after
            df = df.drop(branch_row_after).reset_index(drop=True)

            # set branch_row as column header
            df.columns = df.iloc[branch_row].values

            # drop rows up to branch_row
            df = df.drop(range(branch_row+1)).reset_index(drop=True)

            # drop rows where *every* cell is NaN
            df = df.dropna(how='all').reset_index(drop=True)

            
            # check for duplicate columns in datagrame
            duplicate_columns = df.columns[df.columns.duplicated()].tolist()
            if duplicate_columns:
                validation_results["issues"].append({
                    "type": "duplicate_columns",
                    "columns": duplicate_columns,
                    # add sheet name where there is duplicate columns
                    "message": f"Duplicate columns found: {', '.join(duplicate_columns)} in sheet '{sheet_name}'"
                })

            # check numeric columns
            # check if there are negative values

            # check for required columns
        
        return validation_results
        
    except Exception as e:
        traceback.print_exc()
        validation_results["validation_status"] = "error"
        validation_results["issues"].append({
            "type": "validation_error",
            "message": f"Error during Detailed by Product validation: {str(e)}"
        })
        return validation_results


def validate_fs_current_balance(df: pd.DataFrame, document_type: str, file_name: str) -> Dict[str, Any]:
    """
    Specialized validation for FS Current Balance documents
    
    Expected columns: account_id, current_balance, as_of_date
    Required columns: account_id, current_balance
    """
    validation_results = _get_base_validation_results(file_name, document_type)
    
    try:

        # drop columns that are unnamed 
        df = df.loc[:, ~df.columns.str.contains('unnamed', case=False, na=False)]

        # check if there are duplicate columns and add to validateion['result]
        duplicate_columns = df.columns[df.columns.duplicated()].tolist()
        if duplicate_columns:
            validation_results["issues"].append({
                "type": "duplicate_columns",
                "columns": duplicate_columns,
                "message": f"Duplicate columns found: {', '.join(duplicate_columns)}"
            })
        
        # check if a column has nan, empty values and return it to validate_results['issues']
        for col in df.columns:
            if df[col].isna().any() or df[col].isnull().any() or df[col].empty:
                validation_results["issues"].append({
                    "type": "empty_values",
                    "column": col,
                    "message": f"Column '{col}' has empty values"
                })

        return validation_results
        
    except Exception as e:
        validation_results["validation_status"] = "error"
        validation_results["issues"].append({
            "type": "validation_error",
            "message": f"Error during FS Current Balance validation: {str(e)}"
        })
        return validation_results


def validate_mis_data(df: pd.DataFrame, document_type: str, file_name: str) -> Dict[str, Any]:
    """
    Specialized validation for MIS Data documents
    
    Expected columns: account_id, product_type, balance, status
    Required columns: account_id
    """
    validation_results = _get_base_validation_results(file_name, document_type)
    
    try:
        # Required columns
        required_columns = ["branch", 
                            "branch name",
                            "loan bal. (wsc)",
                            "loan bal. principal",
                            "pd#",
                            "pd amount principal",
                            "net risk",
                            "july release principal",
                            "tda person",
                            "tda cbu",
                            "tda lcbu",
                            "unclaimed"]
        missing_required = [col for col in required_columns if col not in df.columns]
        if missing_required:
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "missing_required_columns",
                "columns": missing_required,
                "message": f"Missing required columns for MIS Data: {', '.join(missing_required)}"
            })
        
        numeric_columns = ["loan bal. (wsc)",
                          "loan bal. principal", 
                          "pd amount principal", 
                          "net risk", 
                          "tda cbu",
                          "tda lcbu",
                          "unclaimed"]
        for col in numeric_columns:
            if col in df.columns:
                # Remove commas and convert to numeric
                df[col] = df[col].astype(str).str.replace(',', '').astype(float, errors='ignore')
        
        # Validate numeric columns
        for col in numeric_columns:
            if col in df.columns:
                if not pd.api.types.is_numeric_dtype(df[col]):
                    validation_results["issues"].append({
                        "type": "data_type_issue",
                        "column": col,
                        "expected": "numeric",
                        "actual": str(df[col].dtype),
                        "message": f"Column '{col}' should be numeric for"
                    })
                else:
                    # Check for negative amounts (might be invalid)
                    negative_count = (df[col] < 0).sum()
                    if negative_count > 0:
                        validation_results["issues"].append({
                            "type": "data_validation",
                            "column": col,
                            "message": f"Column '{col}' has {negative_count} negative values - verify if this is correct"
                        })
        return validation_results
        
    except Exception as e:
        validation_results["validation_status"] = "error"
        validation_results["issues"].append({
            "type": "validation_error",
            "message": f"Error during MIS Data validation: {str(e)}"
        })
        return validation_results


def validate_reports_generated_extracted_cams(df: pd.DataFrame, document_type: str, file_name: str) -> Dict[str, Any]:
    """
    Specialized validation for Reports Generated and Extracted in CAMS documents
    
    Expected columns: report_name, generation_date, extraction_date, status
    Required columns: report_name
    """
    validation_results = _get_base_validation_results(file_name, document_type)
    
    try:
        # Required columns
        required_columns = ["report_name"]
        missing_required = [col for col in required_columns if col not in df.columns]
        if missing_required:
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "missing_required_columns",
                "columns": missing_required,
                "message": f"Missing required columns for CAMS Reports: {', '.join(missing_required)}"
            })
        
        # Expected columns
        expected_columns = ["generation_date", "extraction_date", "status"]
        missing_expected = [col for col in expected_columns if col not in df.columns]
        if missing_expected:
            validation_results["issues"].append({
                "type": "missing_expected_columns",
                "columns": missing_expected,
                "message": f"Missing expected columns for CAMS Reports: {', '.join(missing_expected)}"
            })
        
        # Validate date columns
        date_columns = ["generation_date", "extraction_date"]
        for col in date_columns:
            if col in df.columns:
                try:
                    pd.to_datetime(df[col], errors='raise')
                except:
                    validation_results["issues"].append({
                        "type": "date_format",
                        "column": col,
                        "message": f"Column '{col}' contains invalid date formats"
                    })
        
        # Validate date logic (extraction should be after generation)
        if "generation_date" in df.columns and "extraction_date" in df.columns:
            try:
                gen_dates = pd.to_datetime(df["generation_date"])
                ext_dates = pd.to_datetime(df["extraction_date"])
                invalid_dates = (ext_dates < gen_dates).sum()
                if invalid_dates > 0:
                    validation_results["issues"].append({
                        "type": "data_validation",
                        "message": f"Found {invalid_dates} records where extraction date is before generation date"
                    })
            except:
                pass  # Skip if date conversion failed
        
        return validation_results
        
    except Exception as e:
        validation_results["validation_status"] = "error"
        validation_results["issues"].append({
            "type": "validation_error",
            "message": f"Error during CAMS Reports validation: {str(e)}"
        })
        return validation_results
