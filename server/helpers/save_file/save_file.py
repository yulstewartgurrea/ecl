import json
import pandas as pd
from sqlalchemy.orm import Session
from database import SessionLocal

from helpers.get_time_date import get_time_date

# FLOWRATE
from .flowrate_approach.flowrate import save_flowrate_output
from .flowrate_approach.creditloss_rate import save_creditloss_rate_output

# OVERLAY
from helpers.save_file.overlay.data_interpolation import save_data_interpolation_output
from helpers.save_file.overlay.data_transformation import save_data_transformation_output
from helpers.save_file.overlay.candidate_models import save_candidate_models_output
from helpers.save_file.overlay.final_models import save_final_models_output
from helpers.save_file.overlay.execution.override_forecasted_mve import save_override_forecasted_mev
from helpers.save_file.overlay.execution.save_transform_forecasted_mevs import save_transform_forecasted_mevs_output
from helpers.save_file.overlay.execution.forecasted_pd_calc import save_forecasted_pd_calc_output
from helpers.save_file.overlay.execution.overlay_multiplier import save_overlay_multiplier_output
from helpers.save_file.overlay.execution.pd_calibration import save_pd_calibration_output
from helpers.save_file.overlay.execution.override_data_transformation import save_override_data_transformation_mevs_output
from helpers.save_file.overlay.execution.mev_arima_forecast import (
    save_mev_monthly_arima_forecast_output,
    save_mev_quarterly_arima_forecast_output
)

# ECL
from helpers.save_file.ecl.creditloss_rates import save_creditloss_rates_output
from helpers.save_file.ecl.ecl import save_ecl_output
from helpers.save_file.ecl.summary import save_ecl_summary

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
            "FLOWRATE_APPROACH_CREDITLOSS_RATE_OUTPUT": save_creditloss_rate_output,

            "OVERLAY_DEVELOPMENT_DATA_INTERPOLATION_OUTPUT": save_data_interpolation_output,
            "OVERLAY_DEVELOPMENT_DATA_TRANSFORMATION_OUTPUT": save_data_transformation_output,
            "OVERLAY_DEVELOPMENT_CANDIDATE_MODELS_OUTPUT": save_candidate_models_output,
            "OVERLAY_DEVELOPMENT_FINAL_MODELS_OUTPUT": save_final_models_output,

            "OVERLAY_EXECUTION_DATA_INTERPOLATION_OUTPUT": save_data_interpolation_output,
            "OVERLAY_EXECUTION_OVERRIDE_FORECASTED_MEVS_OUTPUT": save_override_forecasted_mev,
            "OVERLAY_EXECUTION_TRANSFORM_FORECASTED_MEVS_OUTPUT": save_transform_forecasted_mevs_output,
            "OVERLAY_EXECUTION_FORECASTED_PD_CALC_OUTPUT": save_forecasted_pd_calc_output,
            "OVERLAY_EXECUTION_OVERLAY_MULTIPLIER_OUTPUT": save_overlay_multiplier_output,
            "OVERLAY_EXECUTION_PD_CALIBRATION_OUTPUT": save_pd_calibration_output,
            "OVERLAY_EXECUTION_MEV_MONTHLY_ARIMA_FORECAST_OUTPUT": save_mev_monthly_arima_forecast_output,
            "OVERLAY_EXECUTION_MEV_QUARTERLY_ARIMA_FORECAST_OUTPUT": save_mev_quarterly_arima_forecast_output,
            "OVERLAY_EXECUTION_OVERRIDE_DATA_TRANSFORMATION_MEVS_OUTPUT": save_override_data_transformation_mevs_output,

            "ECL_CREDIT_LOSS_RATES_OUTPUT": save_creditloss_rates_output,
            "ECL_OUTPUT": save_ecl_output,
            "ECL_SUMMARY": save_ecl_summary
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