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
    
    Required columns: date, client_ref_no, loan_ref_no, ServiceCode, principal_loan_balance,
    loan_balance, past_due_amount, TotalSavings, no_payment, delinquent_days, Aging Category
    """
    validation_results = _get_base_validation_results(file_name, document_type)
    
    try:
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
        
        # Check for missing required columns
        missing_required = [col for col in required_columns if col not in df.columns]
        if missing_required:
            validation_results["validation_status"] = "failed"
            validation_results["issues"].append({
                "type": "missing_required_columns",
                "columns": missing_required,
                "message": f"Missing required columns for Client Loan Balances: {', '.join(missing_required)}"
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
        
        # Validate date column
        if "date" in df.columns:
          # Try to convert date column to datetime
          date_series = pd.to_datetime(df["date"], errors='coerce')
          invalid_dates = date_series.isnull() & df["date"].notnull()
          invalid_count = invalid_dates.sum()
          
          if invalid_count > 0:
              validation_results["validation_status"] = "failed"
              validation_results["issues"].append({
                  "type": "invalid_date_format",
                  "column": "date",
                  "invalid_count": int(invalid_count),
                  "message": f"Column 'date' has {invalid_count} invalid date values"
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
        
        return validation_results
        
    except Exception as e:
        validation_results["validation_status"] = "failed"
        validation_results["issues"].append({
            "type": "validation_error",
            "message": f"Error during validation: {str(e)}"
        })
        traceback.print_exc()
    
    return validation_results