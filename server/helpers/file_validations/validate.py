import pandas as pd
import numpy as np
from typing import Dict, List, Any

from .flowrate_validation import validate_flowrate_document
from .validate_generic_document import validate_generic_document
from .overlay.development import validate_overlay_development_document
from .overlay.execution import validate_overlay_execution_document
from .ecl import validate_ecl_document

def validate_document(df: pd.DataFrame, document_type: str, file_name: str, temp_path = None) -> Dict[str, Any]:
    """
    Main validation function that routes to appropriate validator based on document type
    
    Args:
        df: DataFrame to validate
        document_type: Type of document (determines which validation function to use)
        file_name: Name of the file being validated
        temp_path: Excel file
    
    Returns:
        Dict containing validation results
    """
    
    # Define which validation function to use for each document type
    validation_routing = {
        # Overlay Development types - use specialized validation
        "OVERLAY_DEVELOPMENT_MONTHLY_HISTORICAL_MEV": "overlay_development",
        "OVERLAY_DEVELOPMENT_QUARTERLY_HISTORICAL_MEV": "overlay_development", 
        "OVERLAY_DEVELOPMENT_HISTORICAL_DEFAULT_RATE": "overlay_development",

        "OVERLAY_EXECUTION_MONTHLY_HISTORICAL_MEV": "overlay_execution",
        "OVERLAY_EXECUTION_QUARTERLY_HISTORICAL_MEV": "overlay_execution", 
        "OVERLAY_EXECUTION_HISTORICAL_WEIGHTED_CREDIT_LOSS_RATE": "overlay_execution",
        "OVERLAY_EXECUTION_MEV_MONTHLY_ARIMA": "overlay_execution",
        "OVERLAY_EXECUTION_MEV_QUARTERLY_ARIMA": "overlay_execution",
        "OVERLAY_EXECUTION_FINAL_OVERLAY_MODEL": "overlay_execution",
        
        # Flowrate Approach types - use specialized validation
        "FLOWRATE_APPROACH_WRITE_OFF_ACCOUNTS": "flowrate",
        "FLOWRATE_APPROACH_AGING_REPORT": "flowrate",
        "FLOWRATE_APPROACH_COLLECTION_RATE": "flowrate",
        "FLOWRATE_APPROACH_DETAILED_BY_PRODUCT": "flowrate",
        "FLOWRATE_APPROACH_FS_CURRENT_BALANCE": "flowrate",
        "FLOWRATE_APPROACH_MIS_DATA": "flowrate",
        "FLOWRATE_APPROACH_REPORTS_GENERATED_EXTRACTED_CAMS": "flowrate",
        
        # ECL types - use specialized validation
        "ECL_CLIENT_LOAN_BALANCES": "ecl",
        
        # Default to generic validation
        "general": "generic"
    }
    
    # Get the validation type for this document
    print('DOCUMENT TYPE', document_type)
    validation_type = validation_routing.get(document_type, "generic")
    
    # Route to appropriate validation function
    if validation_type == "flowrate":
        print('FLOWRATE VALIDATION')
        return validate_flowrate_document(df, document_type, file_name, temp_path)
    elif validation_type == "overlay_development":
        print('OVERLAY DEVELOPMENT VALIDATION')
        return validate_overlay_development_document(df, document_type, file_name, temp_path)
    elif validation_type == "overlay_execution":
        print('OVERLAY EXECUTION VALIDATION')
        return validate_overlay_execution_document(df, document_type, file_name, temp_path)
    elif validation_type == "ecl":
        print('ECL VALIDATION')
        return validate_ecl_document(df, document_type, file_name, temp_path)
    else:
        print('GENERIC VALIDATION')
        return validate_generic_document(df, document_type, file_name)






