import json
import pandas as pd
from sqlalchemy.orm import Session
from database import SessionLocal

from helpers.get_time_date import get_time_date
from .flowrate_approach.flowrate import save_flowrate_output

def save_csv_data_in_folder(
    workflow_path: str,
    document_type: str, 
    csv_data,
    filename: str
    
):
    """
    Save CSV data in the appropriate database table based on document type
    
    Args:
        document_type: Type of document (e.g., "OVERLAY_DEVELOPMENT_HISTORICAL_DEFAULT_RATE")
        csv_data: Pandas DataFrame containing the CSV data
        workflow_id: ID of the workflow
        user_id: ID of the user
        log_id: ID of the log record (optional)
    
    Returns:
        int: ID of the created record
    """
    try:
        # Map document types to their corresponding model classes
        document_type_mapping = {
            "FLOWRATE_APPROACH_FLOWRATE_OUTPUT": save_flowrate_output,
        }
        
        # Get the appropriate model class
        model_class = document_type_mapping.get(document_type)
        if not model_class:
            raise ValueError(f"Unknown document type: {document_type}")
        
        # Create new record
        new_record = model_class(
            csv_data=csv_data,
            workflow_path=workflow_path,
            filename=filename
        )
        print(new_record)
        return new_record
        
    except Exception as e:
        raise Exception(f"Error saving CSV data in folder: {e}")