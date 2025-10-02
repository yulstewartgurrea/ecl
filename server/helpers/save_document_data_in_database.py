import json
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

from models.flowrate_approach import (
    FlowRateApproachLogs,
    FlowRateApproachWriteOffAccounts,
    FlowRateApproachAgingReport,
    FlowRateApproachCollectionRate,
    FlowRateApproachDetailedByProduct,
    FlowRateApproachFsCurrentBalance,
    FlowRateApproachMisData,
    FlowRateApproachReportsGeneratedExtractedCams
)

def save_document_data_in_database(
    document_type: str, 
    document_data: dict, 
    workflow_id: int, 
    user_id: int,
    log_id: int
):
    """
    Save document data in the appropriate database table based on document type
    
    Args:
        document_type: Type of document (e.g., "OVERLAY_DEVELOPMENT_HISTORICAL_DEFAULT_RATE")
        document_data: Dictionary containing the document data
        workflow_id: ID of the workflow
        user_id: ID of the user
    
    Returns:
        int: ID of the created record
    """
    db = SessionLocal()
    try:
        # Convert document_data to JSON string
        json_data = json.dumps(document_data)
        
        # Map document types to their corresponding model classes
        document_type_mapping = {

            # FLOWRATE APPROACH
            "FLOWRATE_APPROACH_WRITE_OFF_ACCOUNTS": FlowRateApproachWriteOffAccounts,
            "FLOWRATE_APPROACH_AGING_REPORT": FlowRateApproachAgingReport,
            "FLOWRATE_APPROACH_COLLECTION_RATE": FlowRateApproachCollectionRate,
            "FLOWRATE_APPROACH_DETAILED_BY_PRODUCT": FlowRateApproachDetailedByProduct,
            "FLOWRATE_APPROACH_FS_CURRENT_BALANCE": FlowRateApproachFsCurrentBalance,
            "FLOWRATE_APPROACH_MIS_DATA": FlowRateApproachMisData,
            "FLOWRATE_APPROACH_REPORTS_GENERATED_EXTRACTED_CAMS": FlowRateApproachReportsGeneratedExtractedCams,

            # OVERLAY DEVELOPMENT
            "OVERLAY_DEVELOPMENT_MONTHLY_HISTORICAL_MEV": OverlayDevelopmentMonthlyHistoricalMevInput,
            "OVERLAY_DEVELOPMENT_QUARTERLY_HISTORICAL_MEV": OverlayDevelopmentQuarterlyHistoricalMevInput,
            "OVERLAY_DEVELOPMENT_HISTORICAL_DEFAULT_RATE": OverlayDevelopmentHistoricalDefaultRateInput,
            "OVERLAY_DEVELOPMENT_DATA_INTERPOLATION_OUTPUT": OverlayDevelopmentDataInterpolationOutput,
            "OVERLAY_DEVELOPMENT_DATA_TRANSFORMATION_OUTPUT": OverlayDevelopmentDataTransformationOutput,
            "OVERLAY_DEVELOPMENT_MULTI_FACTOR_ANALYSIS_OUTPUT": OverlayDevelopmentMultiFactorAnalysisOutput,
            "OVERLAY_DEVELOPMENT_FILTERING_OF_MODELS_OUTPUT": OverlayDevelopmenFilteringOfModelsOutput,
            "OVERLAY_DEVELOPMENT_CANDIDATE_MODELS_OUTPUT": OverlayDevelopmenCandidateModelsOutput,
            "OVERLAY_DEVELOPMENT_FINAL_MODEL_OUTPUT": OverlayDevelopmentFinalModelOutput

            # OVERLAY EXECUTION
        }
        
        # Get the appropriate model class
        model_class = document_type_mapping.get(document_type)
        if not model_class:
            raise ValueError(f"Unknown document type: {document_type}")
        
        # Create new record
        new_record = model_class(
            workflow_id=workflow_id,
            user_id=user_id,
            json_data=json_data,
            log_id=log_id
        )
        
        # Add to database
        db.add(new_record)
        db.commit()
        db.refresh(new_record)
        
        return new_record.id
        
    except Exception as e:
        db.rollback()
        raise Exception(f"Error saving document data in database: {e}")
    finally:
        db.close()