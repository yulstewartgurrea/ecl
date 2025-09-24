import json
from sqlalchemy.orm import Session
from database import SessionLocal
from models.overlay.development import OverlayLogs
from helpers.make_json_serializable import make_json_serializable

import traceback

def save_log_data_in_database(
    module: str,
    submodule: str,
    workflow_id: int,
    user_id: int,
    log_data: dict = None
):
    """
    Save log data in the appropriate log table based on module
    
    Args:
        module: Module type (e.g., "OVERLAY", "LIFETIMEPD")
        submodule: Submodule type (e.g., "DEVELOPMENT", "EXECUTION")
        workflow_id: ID of the workflow
        user_id: ID of the user
        log_data: Dictionary containing the log data (optional)
    
    Returns:
        int: ID of the created log record
    """
    db = SessionLocal()
    try:
        # Convert log_data to JSON string if provided
        log_data = make_json_serializable(log_data)
        json_data = json.dumps(log_data)
        
        # Map modules to their corresponding log model classes
        module_mapping = {
            "OVERLAY": OverlayLogs
        }
        
        # Get the appropriate model class
        model_class = module_mapping.get(module.upper())
        if not model_class:
            raise ValueError(f"Unknown module: {module}")
        
        # Check if log already exists (due to unique constraint)
        # check module, workflow_id and submodule
        existing_log = db.query(model_class).filter(
            model_class.workflow_id == workflow_id,
            model_class.submodule == submodule,
            user_id == user_id
        ).first()
        
        if existing_log:
            # Update existing log
            existing_log.user_id = user_id
            db.commit()
            db.refresh(existing_log)
            return existing_log.id
        else:
            # Create new log record
            log_record_data = {
                "workflow_id": workflow_id,
                "user_id": user_id,
                "submodule": submodule
            }
            
            new_log = model_class(**log_record_data)
            
            # Add to database
            db.add(new_log)
            db.commit()
            db.refresh(new_log)
            
            return new_log.id
        
    except Exception as e:
        traceback.print_exc()
        db.rollback()
        raise Exception(f"Error saving log data in database: {e}")
    finally:
        db.close()
