import pandas as pd
import numpy as np
from typing import Dict, List, Any

from .validate_generic_document import validate_generic_document
from .overlay.execution import validate_overlay_execution_document

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
        # Overlay Development types - use generic validation
        "OVERLAY_DEVELOPMENT_MONTHLY_HISTORICAL_MEV": "generic",
        "OVERLAY_DEVELOPMENT_QUARTERLY_HISTORICAL_MEV": "generic", 
        "OVERLAY_DEVELOPMENT_HISTORICAL_DEFAULT_RATE": "generic",
        
        "OVERLAY_EXECUTION_TTC_PD": "overlay_execution",
        "OVERLAY_EXECUTION_FINAL_OVERLAY_MODEL": "overlay_execution",
        "OVERLAY_EXECUTION_MEV_MONTHLY_ARIMA": "overlay_execution",
        "OVERLAY_EXECUTION_MEV_QUARTERLY_ARIMA": "overlay_execution",

        "general": "generic"
    }
    
    # Get the validation type for this document
    validation_type = validation_routing.get(document_type, "generic")
    
    # Route to appropriate validation function
    if validation_type == "overlay_execution":
        return validate_overlay_execution_document(df, document_type, file_name)
    elif validation_type == "generic":
        return validate_generic_document(df, document_type, file_name)
