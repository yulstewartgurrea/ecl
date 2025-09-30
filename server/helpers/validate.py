import pandas as pd
import numpy as np
from typing import Dict, List, Any

def validate_document(df: pd.DataFrame, document_type: str, file_name: str) -> Dict[str, Any]:
    """
    Universal validation function for all document types
    
    Args:
        df: DataFrame to validate
        document_type: Type of document (general, monthly_mev, quarterly_mev, historical_default_rates)
        file_name: Name of the file being validated
    
    Returns:
        Dict containing validation results
    """
    
    # Base validation results structure
    validation_results = {
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
    
    try:
        # Define document-specific validation rules
        document_rules = {
            "general": {
                "expected_columns": [],
                "percentage_columns": [],
                "numeric_columns": []
            },
            "OVERLAY_DEVELOPMENT_MONTHLY_HISTORICAL_MEV": {
                "expected_columns": ["year", "month", "id", "x", "inflation"],
                "percentage_columns": ["inflation"],
                "numeric_columns": ["year", "month"]
            },
            "OVERLAY_DEVELOPMENT_QUARTERLY_HISTORICAL_MEV": {
                "expected_columns": ["year", "quarter", "id", "x", "inflation"],
                "percentage_columns": ["inflation"],
                "numeric_columns": ["year", "quarter"]
            },
            "OVERLAY_DEVELOPMENT_HISTORICAL_DEFAULT_RATE": {
                "expected_columns": ["time", "odr"],
                "percentage_columns": ["odr"],
                "numeric_columns": []
            }
        }
        
        # Get rules for current document type
        rules = document_rules.get(document_type, document_rules["general"])
        
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
        
        # Check for expected columns (document-specific)
        if rules["expected_columns"]:
            missing_expected = [col for col in rules["expected_columns"] if col not in df.columns]
            if missing_expected:
                validation_results["validation_status"] = "failed"
                validation_results["issues"].append({
                    "type": "missing_expected_columns",
                    "columns": missing_expected,
                    "message": f"Missing expected columns: {', '.join(missing_expected)}"
                })
        
        # Check data types for numeric columns (document-specific)
        for col in rules["numeric_columns"]:
            if col in df.columns:
                if not pd.api.types.is_numeric_dtype(df[col]):
                    validation_results["issues"].append({
                        "type": "data_type_issue",
                        "column": col,
                        "expected": "numeric",
                        "actual": str(df[col].dtype),
                        "message": f"Column '{col}' should be numeric"
                    })
        
        # Check for percentage columns that might have incorrect format (document-specific)
        for col in rules["percentage_columns"]:
            if col in df.columns:
                # Check if values contain % symbol (should be cleaned)
                has_percentage_symbol = df[col].astype(str).str.contains('%', na=False).any()
                if has_percentage_symbol:
                    validation_results["issues"].append({
                        "type": "percentage_format",
                        "column": col,
                        "message": f"Column '{col}' contains percentage symbols (%) - should be numeric values"
                    })
        
        # Data quality checks
        data_quality = {
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "duplicate_rows": df.duplicated().sum(),
            "empty_rows": df.isnull().all(axis=1).sum(),
            "columns_with_missing_data": len(missing_data),
            "empty_columns": len(empty_columns),
            "constant_columns": len(constant_columns)
        }
        
        validation_results["data_quality"] = data_quality
        
        # Check for duplicate rows
        if data_quality["duplicate_rows"] > 0:
            validation_results["issues"].append({
                "type": "duplicate_rows",
                "count": int(data_quality["duplicate_rows"]),
                "message": f"Found {data_quality['duplicate_rows']} duplicate rows"
            })
        
        # Check for empty rows
        if data_quality["empty_rows"] > 0:
            validation_results["issues"].append({
                "type": "empty_rows",
                "count": int(data_quality["empty_rows"]),
                "message": f"Found {data_quality['empty_rows']} completely empty rows"
            })
        
        # Check for empty headers
        empty_headers = [i for i, h in enumerate(df.columns) if not h or str(h).strip() == '']
        if empty_headers:
            validation_results["issues"].append({
                "type": "empty_headers",
                "positions": empty_headers,
                "message": f"Empty headers found at positions: {', '.join(map(str, empty_headers))}"
            })
        
        # Summary statistics
        critical_issue_types = ["duplicate_columns", "missing_expected_columns", "empty_column", "constant_column"]
        critical_issues = []
        warning_issues = []
        
        for issue in validation_results["issues"]:
            if issue["type"] == "missing_data" and issue.get("missing_percentage", 0) > 10:
                critical_issues.append(issue)
            elif issue["type"] in critical_issue_types:
                critical_issues.append(issue)
            else:
                warning_issues.append(issue)
        
        validation_results["statistics"] = {
            "total_issues": len(validation_results["issues"]),
            "critical_issues": len(critical_issues),
            "warning_issues": len(warning_issues)
        }
        
        return validation_results
        
    except Exception as e:
        validation_results["validation_status"] = "error"
        validation_results["issues"].append({
            "type": "validation_error",
            "message": f"Error during validation: {str(e)}"
        })
        return validation_results
