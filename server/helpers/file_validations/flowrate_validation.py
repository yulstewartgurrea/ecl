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
        print("Flowrate Approach Write Off Accounts")
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
    Specialized validation for Write Off Accounts documents
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
                "message": f"Missing required columns for Write Off Accounts: {', '.join(missing_required)}"
            })
        
        # Expected columns - warnings if missing (subset of required for additional validation)
        expected_columns = ["id", "branchno", "bad_debts", "net_risk"]
        missing_expected = [col for col in expected_columns if col not in df_columns_normalized]
        if missing_expected:
            validation_results["issues"].append({
                "type": "missing_expected_columns",
                "columns": missing_expected,
                "message": f"Missing expected columns for Write Off Accounts: {', '.join(missing_expected)}"
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
                        "message": f"Column '{actual_col_name}' should be numeric for Write Off Accounts"
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
                        "message": f"Column '{actual_col_name}' contains invalid date formats for Write Off Accounts"
                    })
        
        # Add other validations
        
        return validation_results
        
    except Exception as e:
        traceback.print_exc()
        validation_results["validation_status"] = "error"
        validation_results["issues"].append({
            "type": "validation_error",
            "message": f"Error during Write Off Accounts validation: {str(e)}"
        })
        return validation_results


def validate_aging_report(df: pd.DataFrame, document_type: str, file_name: str, temp_path: str) -> Dict[str, Any]:
    """
    Specialized validation for Aging Report documents
    
    Expected columns: account_id, current, 1-30_days, 31-60_days, 61-90_days, over_90_days
    Required columns: account_id
    """
    
    validation_results = _get_base_validation_results(file_name, document_type)

    try:

        print(df)
        
        # temporarily commented until format is decided
        # cleaned_data = clean_document(df, document_type, file_name, temp_path)
        # # print("validate_aging_report \n", df)

        # # Check if required fields exist and are not None or empty
        # required_fields = {
        #     "report_date": "Report date",
        #     "total_borrowers": "Total borrowers", 
        #     "number_of_delinquents": "Number of delinquents",
        #     "total_loan_portfolio": "Total loan portfolio",
        #     "products": "Products"
        # }
        
        # for field_key, field_name in required_fields.items():
        #     if field_key not in cleaned_data:
        #         validation_results["validation_status"] = "failed"
        #         validation_results["issues"].append({
        #             "type": "missing_required_field",
        #             "field": field_key,
        #             "message": f"Missing required field '{field_name}' in aging report"
        #         })
        #     elif cleaned_data[field_key] is None:
        #         validation_results["validation_status"] = "failed"
        #         validation_results["issues"].append({
        #             "type": "null_required_field",
        #             "field": field_key,
        #             "message": f"Required field '{field_name}' is null in aging report"
        #         })
        #     elif field_key == "products" and isinstance(cleaned_data[field_key], list) and len(cleaned_data[field_key]) == 0:
        #         validation_results["validation_status"] = "failed"
        #         validation_results["issues"].append({
        #             "type": "empty_required_field",
        #             "field": field_key,
        #             "message": f"Required field '{field_name}' is empty (no products found) in aging report"
        #         })
        #     elif field_key != "products" and cleaned_data[field_key] == "":
        #         validation_results["validation_status"] = "failed"
        #         validation_results["issues"].append({
        #             "type": "empty_required_field",
        #             "field": field_key,
        #             "message": f"Required field '{field_name}' is empty in aging report"
        #         })
        
        # prod_arr = []
        # for i in cleaned_data["products"]:
        #     print(i['data'])
        #     prod_arr.append(i["data"][0])
        
        # df = pd.DataFrame(prod_arr)

        # Required columns
        required_columns = [
            "Date",	
            "Total Loan Balance with C/P",
            "0 day",
            "PAR 1  (1 & 30 days)",
            "PAR 30  (31 & 60 days)",
            "PAR 60  (61 & 90 days)",
            "PAR 90  (91 & 120 days)",
            "PAR 120  (121 & 180 days)",
            "PAR 180  (181 & 240 days)",
            "PAR 240  (241 & 360 days)",
            "PAR 360  (361 & Up days)",
            # "Aging Category", 
            # "Product Counts", 
            # "Loan Balance w/ CP", 
            # "Loan Balance Principal", 
            # "NET PAR Amount Loan Balance w/ CP", 
            # "NET PAR Amount Loan Balance Principal", 
            # "NET PAR % (Gross PAR/TLP)", 
            # "Repayment Rate", 
            # "GROSS PAR % (Gross PAR/TLP)"
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
            "0 day",
            "PAR 1  (1 & 30 days)",
            "PAR 30  (31 & 60 days)",
            "PAR 60  (61 & 90 days)",
            "PAR 90  (91 & 120 days)",
            "PAR 120  (121 & 180 days)",
            "PAR 180  (181 & 240 days)",
            "PAR 240  (241 & 360 days)",
            "PAR 360  (361 & Up days)",
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
                        "message": f"Column '{col}' should be numeric for Write Off Accounts"
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

        # Validate date format (YYYY-MM-DD)
        date_columns = ["date"]  # Add your date column names here
        for col in date_columns:
            if col in df.columns:
                try:
                    # Check if column is already datetime type
                    if pd.api.types.is_datetime64_any_dtype(df[col]):
                        # Convert datetime to YYYY-MM-DD string format
                        date_strings = df[col].dt.strftime('%Y-%m-%d')
                    else:
                        # Convert to datetime first, then to string format
                        date_strings = pd.to_datetime(df[col], errors='raise').dt.strftime('%Y-%m-%d')
                    
                    # Check for specific YYYY-MM-DD format
                    date_pattern = r'^\d{4}-\d{2}-\d{2}$'
                    invalid_format_count = 0
                    
                    for idx, value in date_strings.items():
                        if pd.notna(value) and not re.match(date_pattern, str(value)):
                            invalid_format_count += 1
                    
                    if invalid_format_count > 0:
                        validation_results["validation_status"] = "failed"
                        validation_results["issues"].append({
                            "type": "date_format",
                            "column": col,
                            "invalid_count": invalid_format_count,
                            "message": f"Column '{col}' has {invalid_format_count} values not in YYYY-MM-DD format"
                        })
                        
                except:
                    validation_results["validation_status"] = "failed"
                    validation_results["issues"].append({
                        "type": "date_format",
                        "column": col,
                        "message": f"Column '{col}' contains invalid date formats"
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
                        "message": f"Column '{col}' should be numeric for Write Off Accounts"
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
