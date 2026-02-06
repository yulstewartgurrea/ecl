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
    elif document_type == "OVERLAY_EXECUTION_HISTORICAL_DEFAULT_RATE":
        print("Overlay Execution Historical Default Rate")
        return validate_monthly_historical_credit_loss_rates(df, document_type, file_name)
    elif document_type == "OVERLAY_EXECUTION_MEV_MONTHLY_ARIMA":
        print("Overlay Execution Monthly Forecasted MEV ARIMA")
        return validate_monthly_forecasted_mev_arima(df, document_type, file_name)
    elif document_type == "OVERLAY_EXECUTION_MEV_QUARTERLY_ARIMA":
        print("Overlay Execution Quarterly Forecasted MEV ARIMA")
        return validate_quarterly_forecasted_mev_arima(df, document_type, file_name)
    elif document_type == "OVERLAY_EXECUTION_FINAL_OVERLAY_MODEL":
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
        print('validate_monthly_forecasted_mev_arima', df)
        # Normalize column names for comparison (lowercase, strip spaces)
        df_columns_normalized = [col.strip().lower() for col in df.columns]
        
        # Required columns - validation fails if missing
        required_columns = ["date", "year", "month (int)", "month", "id"]
        
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
        required_columns = ["aging bucket", "ttc pd"]
        
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
        traceback.print_exc()
        validation_results["validation_status"] = "error"
        validation_results["issues"].append({
            "type": "validation_error",
            "message": f"Error during Write Off Accounts validation: {str(e)}"
        })
        return validation_results

def validate_final_overlay_model(df: pd.DataFrame, document_type: str, file_name: str) -> Dict[str, Any]:
    """
    Specialized validation for documents
    """
    validation_results = _get_base_validation_results(file_name, document_type)
    
    try:
        # Normalize column names for comparison (lowercase, strip spaces)
        df_columns_normalized = [col.strip().lower() for col in df.columns]
        
        # Required columns - validation fails if missing
        required_columns = ["aging bucket", "ttc pd"]
        
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

        return validation_results
        
    except Exception as e:
        traceback.print_exc()
        validation_results["validation_status"] = "error"
        validation_results["issues"].append({
            "type": "validation_error",
            "message": f"Error during validation: {str(e)}"
        })
        return validation_results