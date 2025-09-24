import json
import pandas as pd
from sqlalchemy.orm import Session
from database import SessionLocal
from models.overlay.development import (
    OverlayDevelopmentMonthlyHistoricalMevInput,
    OverlayDevelopmentQuarterlyHistoricalMevInput,
    OverlayDevelopmentHistoricalDefaultRateInput,
    OverlayDevelopmentDataInterpolationOutput,
    OverlayDevelopmentDataTransformationOutput,
    OverlayDevelopmentMultiFactorAnalysisOutput,
    OverlayDevelopmenFilteringOfModelsOutput,
    OverlayDevelopmenCandidateModelsOutput,
    OverlayDevelopmentFinalModelOutput
)
from helpers.get_time_date import get_time_date

def save_csv_data_in_folder(
    workflow_path: str,
    document_type: str, 
    csv_data: dict,
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
            "OVERLAY_DEVELOPMENT_DATA_INTERPOLATION_OUTPUT": save_data_interpolation_output,
            # "OVERLAY_DEVELOPMENT_DATA_TRANSFORMATION_OUTPUT": OverlayDevelopmentDataTransformationOutput,
            # "OVERLAY_DEVELOPMENT_MULTI_FACTOR_ANALYSIS_OUTPUT": OverlayDevelopmentMultiFactorAnalysisOutput,
            # "OVERLAY_DEVELOPMENT_FILTERING_OF_MODELS_OUTPUT": OverlayDevelopmenFilteringOfModelsOutput,
            # "OVERLAY_DEVELOPMENT_CANDIDATE_MODELS_OUTPUT": OverlayDevelopmenCandidateModelsOutput,
            # "OVERLAY_DEVELOPMENT_FINAL_MODEL_OUTPUT": OverlayDevelopmentFinalModelOutput,
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

def save_data_interpolation_output(
    csv_data: pd.DataFrame,
    workflow_path: str = "",
    filename: str = None
) -> str:
    """
    Save CSV data to a file in the files folder
    
    Args:
        csv_data: Pandas DataFrame containing the CSV data
        document_type: Type of document for filename generation
        workflow_path: Path within the files folder (optional)
        filename: Custom filename (optional, will generate if not provided)
    
    Returns:
        str: Full path where the CSV file was saved
    """
    import os
    
    try:
        # Generate filename if not provided
        if not filename:
            timestamp = get_time_date()
            filename = f"{document_type.lower()}_{timestamp}.csv"
        else:
            filename = filename
        
        # Define the base files directory
        base_files_dir = "files"
        
        # Create the full directory path
        if workflow_path:
            full_dir_path = os.path.join(base_files_dir, workflow_path)
        else:
            full_dir_path = base_files_dir
        
        # Create directories if they don't exist
        os.makedirs(full_dir_path, exist_ok=True)
        
        # Create the full file path
        full_file_path = os.path.join(full_dir_path, filename)
        
        print('csv_data', csv_data)

        # Save the CSV file
        csv_data.to_csv(full_file_path, index=False)
        
        return full_file_path
        
    except Exception as e:
        raise Exception(f"Error saving CSV to file: {str(e)}")
