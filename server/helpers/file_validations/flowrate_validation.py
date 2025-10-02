import pandas as pd
from typing import Dict, Any

from .validate_generic_document import validate_generic_document


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
        return validate_aging_report(df, document_type, file_name)
    elif document_type == "FLOWRATE_APPROACH_COLLECTION_RATE":
        print("Flowrate Approach Collection Rate")
        return validate_collection_rate(temp_path, document_type, file_name)
    elif document_type == "FLOWRATE_APPROACH_DETAILED_BY_PRODUCT":
        print("Flowrate Approach Detailed by Product")
        return validate_detailed_by_product(df, document_type, file_name)
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
        # Required columns - validation fails if missing
        required_columns = ["id",
                            "branchNo",
                            "bad_debts",
                            "savings",
                            "net_risk",
                            "date_closed",
                            "is_paid",
                            "date_paid",
                            "slot",
                            "group_id",
                            "status"]
        missing_required = [col for col in required_columns if col.lower() not in df.columns]
        if missing_required:
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "missing_required_columns",
                "columns": missing_required,
                "message": f"Missing required columns for Write Off Accounts: {', '.join(missing_required)}"
            })
        
        # Expected columns - warnings if missing
        expected_columns = ["id",
                            "branchNo",
                            "bad_debts",
                            "savings",
                            "net_risk",
                            "date_closed",
                            "is_paid",
                            "date_paid",
                            "slot",
                            "group_id",
                            "status"]
        missing_expected = [col for col in expected_columns if col.lower() not in df.columns]
        if missing_expected:
            validation_results["issues"].append({
                "type": "missing_expected_columns",
                "columns": missing_expected,
                "message": f"Missing expected columns for Write Off Accounts: {', '.join(missing_expected)}"
            })
        
        # Validate numeric columns
        numeric_columns = ["bad_debts", "savings", "net_risk"]
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
        
        # Validate date columns
        date_columns = ["date_closed"]
        for col in date_columns:
            if col in df.columns:
                try:
                    pd.to_datetime(df[col], errors='raise')
                except:
                    validation_results["issues"].append({
                        "type": "date_format",
                        "column": col,
                        "message": f"Column '{col}' contains invalid date formats for Write Off Accounts"
                    })
        
        # Add other validations
        
        return validation_results
        
    except Exception as e:
        validation_results["validation_status"] = "error"
        validation_results["issues"].append({
            "type": "validation_error",
            "message": f"Error during Write Off Accounts validation: {str(e)}"
        })
        return validation_results


def validate_aging_report(df: pd.DataFrame, document_type: str, file_name: str) -> Dict[str, Any]:
    """
    Specialized validation for Aging Report documents
    
    Expected columns: account_id, current, 1-30_days, 31-60_days, 61-90_days, over_90_days
    Required columns: account_id
    """
    validation_results = _get_base_validation_results(file_name, document_type)
    
    try:
        # Required columns
        required_columns = ["account_id"]
        missing_required = [col for col in required_columns if col not in df.columns]
        if missing_required:
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "missing_required_columns",
                "columns": missing_required,
                "message": f"Missing required columns for Aging Report: {', '.join(missing_required)}"
            })
        
        # Expected aging bucket columns
        aging_columns = ["current", "1-30_days", "31-60_days", "61-90_days", "over_90_days"]
        missing_aging = [col for col in aging_columns if col not in df.columns]
        if missing_aging:
            validation_results["issues"].append({
                "type": "missing_aging_buckets",
                "columns": missing_aging,
                "message": f"Missing aging bucket columns: {', '.join(missing_aging)}"
            })
        
        # Validate numeric columns for aging buckets
        for col in aging_columns:
            if col in df.columns:
                if not pd.api.types.is_numeric_dtype(df[col]):
                    validation_results["issues"].append({
                        "type": "data_type_issue",
                        "column": col,
                        "expected": "numeric",
                        "actual": str(df[col].dtype),
                        "message": f"Aging bucket column '{col}' should be numeric"
                    })
                else:
                    # Check for negative values in aging buckets
                    negative_count = (df[col] < 0).sum()
                    if negative_count > 0:
                        validation_results["issues"].append({
                            "type": "data_validation",
                            "column": col,
                            "message": f"Aging bucket '{col}' has {negative_count} negative values - verify if this is correct"
                        })
        
        # Validate that aging buckets sum correctly (if all present)
        present_aging_cols = [col for col in aging_columns if col in df.columns]
        if len(present_aging_cols) >= 2:
            # Calculate total aging amount
            df_temp = df[present_aging_cols].fillna(0)
            total_aging = df_temp.sum(axis=1)
            
            # Check for accounts with zero total aging
            zero_total_count = (total_aging == 0).sum()
            if zero_total_count > 0:
                validation_results["issues"].append({
                    "type": "data_validation",
                    "message": f"Found {zero_total_count} accounts with zero total aging amount"
                })
        
        return validation_results
        
    except Exception as e:
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


def validate_detailed_by_product(df: pd.DataFrame, document_type: str, file_name: str) -> Dict[str, Any]:
    """
    Specialized validation for Detailed by Product documents
    
    Expected columns: product_code, product_name, balance, count
    Required columns: product_code
    """
    validation_results = _get_base_validation_results(file_name, document_type)
    
    try:
        # Required columns
        required_columns = ["product_code"]
        missing_required = [col for col in required_columns if col not in df.columns]
        if missing_required:
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "missing_required_columns",
                "columns": missing_required,
                "message": f"Missing required columns for Detailed by Product: {', '.join(missing_required)}"
            })
        
        # Expected columns
        expected_columns = ["product_name", "balance", "count"]
        missing_expected = [col for col in expected_columns if col not in df.columns]
        if missing_expected:
            validation_results["issues"].append({
                "type": "missing_expected_columns",
                "columns": missing_expected,
                "message": f"Missing expected columns for Detailed by Product: {', '.join(missing_expected)}"
            })
        
        # Validate numeric columns
        numeric_columns = ["balance", "count"]
        for col in numeric_columns:
            if col in df.columns:
                if not pd.api.types.is_numeric_dtype(df[col]):
                    validation_results["issues"].append({
                        "type": "data_type_issue",
                        "column": col,
                        "expected": "numeric",
                        "actual": str(df[col].dtype),
                        "message": f"Column '{col}' should be numeric"
                    })
                else:
                    # Check for negative values
                    negative_count = (df[col] < 0).sum()
                    if negative_count > 0:
                        validation_results["issues"].append({
                            "type": "data_validation",
                            "column": col,
                            "message": f"Column '{col}' has {negative_count} negative values"
                        })
        
        # Check for duplicate product codes
        if "product_code" in df.columns:
            duplicate_products = df["product_code"].duplicated().sum()
            if duplicate_products > 0:
                validation_results["issues"].append({
                    "type": "duplicate_products",
                    "count": int(duplicate_products),
                    "message": f"Found {duplicate_products} duplicate product codes"
                })
        
        return validation_results
        
    except Exception as e:
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
        # Required columns
        required_columns = ["account_id", "current_balance"]
        missing_required = [col for col in required_columns if col not in df.columns]
        if missing_required:
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "missing_required_columns",
                "columns": missing_required,
                "message": f"Missing required columns for FS Current Balance: {', '.join(missing_required)}"
            })
        
        # Expected columns
        expected_columns = ["as_of_date"]
        missing_expected = [col for col in expected_columns if col not in df.columns]
        if missing_expected:
            validation_results["issues"].append({
                "type": "missing_expected_columns",
                "columns": missing_expected,
                "message": f"Missing expected columns for FS Current Balance: {', '.join(missing_expected)}"
            })
        
        # Validate current balance
        if "current_balance" in df.columns:
            if not pd.api.types.is_numeric_dtype(df["current_balance"]):
                validation_results["issues"].append({
                    "type": "data_type_issue",
                    "column": "current_balance",
                    "expected": "numeric",
                    "actual": str(df["current_balance"].dtype),
                    "message": "Current balance should be numeric"
                })
            else:
                # Check for zero balances
                zero_balance_count = (df["current_balance"] == 0).sum()
                if zero_balance_count > 0:
                    validation_results["issues"].append({
                        "type": "data_validation",
                        "column": "current_balance",
                        "message": f"Found {zero_balance_count} accounts with zero current balance"
                    })
        
        # Validate date column
        if "as_of_date" in df.columns:
            try:
                pd.to_datetime(df["as_of_date"], errors='raise')
            except:
                validation_results["issues"].append({
                    "type": "date_format",
                    "column": "as_of_date",
                    "message": "Column 'as_of_date' contains invalid date formats"
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
