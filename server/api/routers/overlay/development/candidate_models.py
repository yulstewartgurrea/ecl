from fastapi import APIRouter, Depends, HTTPException, Query, Form
from fastapi.responses import JSONResponse, FileResponse
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import json
import traceback
import pandas as pd


# MODELS
from models.models import User, Workflow, Document
from models.overlay.development import OverlayDevelopmenCandidateModelsOutput, OverlayLogs


from core.security import get_current_user
from database import get_db

# HELPER FILES
from helpers.make_json_serializable import make_json_serializable
from helpers.pagination import create_pagination_response, validate_pagination_params
from helpers.get_time_date import get_time_date
from helpers.save_file.save_file import save_csv_data_in_folder
from helpers.get_root_folder import get_root_folder

from database import SessionLocal

from pathlib import Path

router = APIRouter(prefix="/api/overlay/development", tags=["overlay-development"])

@router.post("/candidate_models")
async def save_candidate_models(
    workflow_id: int = Form(...),
    candidate_models: str = Form(...),
    current_user: User = Depends(get_current_user)
):
    """
    Save selected models as candidate models for a workflow
    
    Args:
        workflow_id: ID of the workflow
        candidate_models: JSON string of array of complete model objects from MFA results
    """
    try:
        # Parse candidate_models JSON string
        try:
            candidate_models_list = json.loads(candidate_models)
        except json.JSONDecodeError as e:
            return JSONResponse(
                status_code=400,
                content={
                    "code": -1,
                    "success": False,
                    "msg": f"Invalid JSON format for candidate_models: {str(e)}",
                    "data": None
                }
            )

        db = SessionLocal()
        try:
            # Verify workflow exists and belongs to user
            workflow = db.query(Workflow).filter(
                Workflow.id == workflow_id,
                Workflow.user_id == current_user.id
            ).first()

            if not workflow:
                return JSONResponse(
                    status_code=404,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": f"Workflow with ID {workflow_id} not found",
                        "data": None
                    }
                )
        finally:
            db.close()

        # Validate selected_models
        if not candidate_models or len(candidate_models) == 0:
            return JSONResponse(
                status_code=400,
                content={
                    "code": -1,
                    "success": False,
                    "msg": "No models selected. Please select at least one model.",
                    "data": None
                }
            )

        # Validate model structure (should have required fields)
        required_fields = ['index', 'Y', 'X1', 'X2', 'R_Squared', 'Adj_R_Squared', 'MAPE']
        for i, model in enumerate(candidate_models_list):
            missing_fields = [field for field in required_fields if field not in model]
            if missing_fields:
                return JSONResponse(
                    status_code=400,
                    content={
                        "code": -1,
                        "success": False,
                        "msg": f"Model {i+1} is missing required fields: {missing_fields}",
                        "data": None
                    }
                )

        output_filename = f"{workflow.loan_product}_candidate_models_{get_time_date()}.csv"
        output_folder_path = f"{workflow.entity}/{workflow.reporting_period}/{workflow.workflow_name}/output/overlay/development/{workflow.loan_product}/candidate_models"

        # Save data in documents models
        db = SessionLocal()
        try:
            # Create Document record
            new_document = Document(
                filename=output_filename,
                document_type=f"OVERLAY_DEVELOPMENT_CANDIDATE_MODELS_OUTPUT",
                user_id=current_user.id,
                workflow_id=workflow_id,
                workflow_path=f"{workflow.entity}/{workflow.reporting_period}/{workflow.workflow_name}"
            )
            db.add(new_document)
            db.commit()
            db.refresh(new_document)

        finally:
            db.close()

        save_csv_data_in_folder(
            workflow_path=output_folder_path,
            document_type="OVERLAY_DEVELOPMENT_CANDIDATE_MODELS_OUTPUT",
            # csv_data is a daraframe
            csv_data=candidate_models_list,
            filename=output_filename
        )

        return JSONResponse(
            status_code=200,
            content={
                "code": 1,
                "success": True,
                "msg": f"Success."
            }
        )

    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Unexpected error saving candidate models: {str(e)}",
                "data": None
            }
        )

@router.get("/candidate_models")
async def get_candidate_models(
    workflow_id: int = Query(..., description="Workflow ID"),
    page: int = Query(1, description="Page number (1-indexed)"),
    page_size: int = Query(100, description="Number of items per page"),
    include_models: bool = Query(True, description="Include full model data"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get candidate models for a workflow with pagination
    
    Args:
        workflow_id: ID of the workflow
        page: Page number for pagination
        page_size: Number of items per page
        include_models: Whether to include full model data or just summary
    """
    try:
        # Validate pagination parameters
        page, page_size = validate_pagination_params(page, page_size, max_page_size=1000)
        
        # Verify workflow exists and belongs to user
        workflow = db.query(Workflow).filter(
            Workflow.id == workflow_id,
            Workflow.user_id == current_user.id
        ).first()

        if not workflow:
            return JSONResponse(
                status_code=404,
                content={
                    "code": -1,
                    "success": False,
                    "msg": f"Workflow with ID {workflow_id} not found",
                    "data": None
                }
            )


        candidate_models_path = (
            f"{get_root_folder()}/files/"
            f"{workflow.entity}/"
            f"{workflow.reporting_period}/"
            f"{workflow.workflow_name}/"
            f"output/overlay/development/{workflow.loan_product}/candidate_models"
        )
        
        candidate_models_file = max(
            Path(candidate_models_path).glob(f"{workflow.loan_product}_candidate_models*"),
            key=lambda p: p.stat().st_mtime,   # last modified time
            default=None
        )
        print(candidate_models_file)
        
        df = []
        total_count = 0
        if candidate_models_file:
            df = pd.read_csv(candidate_models_file)
            total_count = len(df)
            df = make_json_serializable(df.to_dict('records'))

        # Create paginated response
        response = create_pagination_response(
            data=df,
            page=page,
            page_size=page_size,
            total_count=total_count,
            success=True,
            message="MFA results retrieved successfully"
        )

        return JSONResponse(
            status_code=200,
            content=response
        )
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Unexpected error retrieving candidate models: {str(e)}",
                "data": None
            }
        )


@router.get("/candidate_models/export")
async def export_candidate_models(
    workflow_id: int = Query(..., description="Workflow ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export the latest candidate models CSV using the same discovery logic as GET."""
    try:
        # Verify workflow exists and belongs to user
        workflow = db.query(Workflow).filter(
            Workflow.id == workflow_id,
            Workflow.user_id == current_user.id
        ).first()

        if not workflow:
            return JSONResponse(
                status_code=404,
                content={
                    "code": -1,
                    "success": False,
                    "msg": f"Workflow with ID {workflow_id} not found",
                    "data": None
                }
            )

        candidate_models_path = (
            f"{get_root_folder()}/files/"
            f"{workflow.entity}/"
            f"{workflow.reporting_period}/"
            f"{workflow.workflow_name}/"
            f"output/overlay/development/{workflow.loan_product}/candidate_models"
        )

        candidate_models_file = max(
            Path(candidate_models_path).glob(f"{workflow.loan_product}_candidate_models*"),
            key=lambda p: p.stat().st_mtime,
            default=None
        )

        if not candidate_models_file:
            return JSONResponse(
                status_code=404,
                content={
                    "code": -1,
                    "success": False,
                    "msg": "Candidate models file not found",
                    "data": None
                }
            )

        filename = candidate_models_file.name
        return FileResponse(str(candidate_models_file), media_type="text/csv", filename=filename)
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "success": False,
                "msg": f"Unexpected error exporting candidate models: {str(e)}",
                "data": None
            }
        )
