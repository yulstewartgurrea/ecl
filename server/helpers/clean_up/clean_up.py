import pandas as pd
import numpy as np
from typing import Dict, List, Any

from .flowrate.aging_report import aging_report_clean_up
# from .flowrate.detailed_by_product import detailed_by_product_clean_up

def clean_document(df: pd.DataFrame, document_type: str, file_name: str, temp_path = None) -> Dict[str, Any]:
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

    no_need_formatting_document_types = [
        # OVERLAY INPUT FILES
        "OVERLAY_DEVELOPMENT_MONTHLY_HISTORICAL_MEV",
        "OVERLAY_DEVELOPMENT_QUARTERLY_HISTORICAL_MEV", 
        "OVERLAY_DEVELOPMENT_HISTORICAL_DEFAULT_RATE",
        
        
        # FLOWRATE INPUT FILES
        "FLOWRATE_APPROACH_WRITE_OFF_ACCOUNTS",
        "FLOWRATE_APPROACH_COLLECTION_RATE",
        "FLOWRATE_APPROACH_FS_CURRENT_BALANCE",
        "FLOWRATE_APPROACH_MIS_DATA",
        "FLOWRATE_APPROACH_REPORTS_GENERATED_EXTRACTED_CAMS",
        "FLOWRATE_APPROACH_AGING_REPORT"
    ]
    
    # FLOWRATE
    if document_type in no_need_formatting_document_types:
        return df
    # if document_type == "FLOWRATE_APPROACH_AGING_REPORT":
    #     return aging_report_clean_up(temp_path)
    # elif document_type == "FLOWRATE_APPROACH_DETAILED_BY_PRODUCT":
    #     return detailed_by_product_clean_up(temp_path)
    else:
        return None






