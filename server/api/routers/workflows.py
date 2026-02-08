from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional

from schemas.schemas import WorkflowResponse, WorkflowCreate  # Updated imports
from models.models import User, Workflow
from database import get_db
from helpers.workflow import get_workflows, create_workflow, get_latest_workflow, get_workflow_by_id, update_workflow, delete_workflow, search_workflows
from core.security import get_current_user

from helpers.make_json_serializable import make_json_serializable

import traceback

router = APIRouter(prefix="/workflows", tags=["workflows"])

@router.get("/", response_model=List[WorkflowResponse])
def read_workflows(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):  
    try:
        workflows = get_workflows(db, user_id=current_user.id, skip=skip, limit=limit)
        print('workflows', workflows)
        
        # Convert SQLAlchemy objects to Pydantic models and then to dictionaries
        workflows_data = [WorkflowResponse.model_validate(workflow).model_dump() for workflow in workflows]
        
        res = {
            "code": 1, 
            "success": True,
            "data": workflows_data,
        }
        return JSONResponse(status_code=200, content=res) 
    except Exception as e:
        traceback.print_exc()
        res = {
            'code': -1,
            'msg': f'Something went wrong. {e}',
            'success': False
        }
        return JSONResponse(status_code=500, content=res) 

@router.get("/search", response_model=List[WorkflowResponse])
def search_workflows_endpoint(
    skip: int = Query(0, ge=0, description="Number of records to skip (for pagination)"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
    search_query: Optional[str] = Query(None, description="Search term for workflow name (case-insensitive partial match)"),
    start_date: Optional[str] = Query(None, description="Start date for date range filter in created_at (format: YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date for date range filter in created_at (format: YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Search workflows with pagination and optional search by name and date range.
    
    Query Parameters:
    - skip: Number of records to skip (default: 0)
    - limit: Maximum number of records to return (default: 100, max: 1000)
    - search_query: Search term for workflow_name (case-insensitive partial match)
    - start_date: Start date for date range filter (format: YYYY-MM-DD). If provided, filters workflows created on or after this date.
    - end_date: End date for date range filter (format: YYYY-MM-DD). If provided, filters workflows created on or before this date.
    
    Returns:
    - List of workflows matching the search criteria
    - Total count of matching workflows
    - Pagination metadata
    """
    try:
        workflows, total_count = search_workflows(
            db=db,
            user_id=current_user.id,
            skip=skip,
            limit=limit,
            search_query=search_query,
            start_date=start_date,
            end_date=end_date
        )
        
        # Convert SQLAlchemy objects to Pydantic models and then to dictionaries
        workflows_data = [WorkflowResponse.model_validate(workflow).model_dump() for workflow in workflows]
        
        res = {
            "code": 1,
            "success": True,
            "data": workflows_data,
            "pagination": {
                "skip": skip,
                "limit": limit,
                "total": total_count,
                "count": len(workflows_data),
                "has_more": (skip + len(workflows_data)) < total_count
            }
        }
        return JSONResponse(status_code=200, content=res)
    except Exception as e:
        traceback.print_exc()
        res = {
            'code': -1,
            'msg': f'Something went wrong. {e}',
            'success': False
        }
        return JSONResponse(status_code=500, content=res)

@router.post("/", response_model=WorkflowResponse)
def create_user_workflow(
    workflow: WorkflowCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # Check if workflow with same workflow_name, entity, and loan_product already exists
        existing_workflow = db.query(Workflow).filter(
            Workflow.user_id == current_user.id,
            Workflow.workflow_name == workflow.workflow_name,
            Workflow.entity == workflow.entity,
            Workflow.loan_product == workflow.loan_product
        ).first()
        
        if existing_workflow:
            res = {
                'code': -1,
                'msg': 'Workflow already exists',
                'success': False
            }
            return JSONResponse(status_code=400, content=res)
        
        workflow = create_workflow(db=db, wf_in=workflow, user_id=current_user.id)
        
        # Console log when workflow is created
        print(f"WORKFLOW CREATED: ID={workflow.id}, Name='{workflow.workflow_name}', Entity='{workflow.entity}', Period='{workflow.reporting_period}', User={current_user.id}") 
        
        # Convert SQLAlchemy object to Pydantic model and then to dictionary
        workflow_data = WorkflowResponse.model_validate(workflow).model_dump()
        
        res = {
            "code": 1, 
            "success": True,
            "data": workflow_data,
        }
        return JSONResponse(status_code=200, content=res) 
    except Exception as e:
        traceback.print_exc()
        res = {
            'code': -1,
            'msg': f'Something went wrong. {e}',
            'success': False
        }
        return JSONResponse(status_code=500, content=res) 

@router.get("/latest", response_model=WorkflowResponse)
def get_latest_user_workflow(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        workflow = get_latest_workflow(db, user_id=current_user.id)
        if not workflow:
            return JSONResponse(
                status_code=404,
                content={
                    "code": -1,
                    "success": False,
                    "msg": "No workflows found for user",
                    "data": None
                }
            )
        
        # Convert SQLAlchemy object to Pydantic model and then to dictionary
        workflow_data = WorkflowResponse.model_validate(workflow).model_dump()
        
        res = {
            "code": 1, 
            "success": True,
            "data": workflow_data,
        }
        return JSONResponse(status_code=200, content=res) 
    except Exception as e:
        res = {
            'code': -1,
            'msg': f'Something went wrong. {e}',
            'success': False
        }
        return JSONResponse(status_code=500, content=res)

@router.get("/{workflow_id}", response_model=WorkflowResponse)
def get_workflow_by_id_endpoint(
    workflow_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        workflow = get_workflow_by_id(db, workflow_id=workflow_id, user_id=current_user.id)
        if not workflow:
            return JSONResponse(
                status_code=404,
                content={
                    "code": -1,
                    "success": False,
                    "msg": "Workflow not found",
                    "data": None
                }
            )
        
        # Convert SQLAlchemy object to Pydantic model and then to dictionary
        workflow_data = WorkflowResponse.model_validate(workflow).model_dump()
        
        res = {
            "code": 1,
            "success": True,
            "data": workflow_data,
        }
        return JSONResponse(status_code=200, content=res) 
    except Exception as e:
        res = {
            'code': -1,
            'msg': f'Something went wrong. {e}',
            'success': False
        }
        return JSONResponse(status_code=500, content=res)

@router.put("/{workflow_id}", response_model=WorkflowResponse)
def update_workflow_endpoint(
    workflow_id: int,
    workflow_update: WorkflowCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        updated_workflow = update_workflow(db, workflow_id=workflow_id, workflow_update=workflow_update, user_id=current_user.id)
        if not updated_workflow:
            return JSONResponse(
                status_code=404,
                content={
                    "code": -1,
                    "success": False,
                    "msg": "Workflow not found",
                    "data": None
                }
            )
        
        res = {
            "code": 1,
            "success": True,
            "data": updated_workflow.model_dump(),
        }
        return JSONResponse(status_code=200, content=res) 
    except Exception as e:
        res = {
            'code': -1,
            'msg': f'Something went wrong. {e}',
            'success': False
        }
        return JSONResponse(status_code=500, content=res)

@router.delete("/{workflow_id}")
def delete_workflow_endpoint(
    workflow_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        deleted = delete_workflow(db, workflow_id=workflow_id, user_id=current_user.id)
        if not deleted:
            return JSONResponse(
                status_code=404,
                content={
                    "code": -1,
                    "success": False,
                    "msg": "Workflow not found",
                    "data": None
                }
            )
        
        res = {
            "code": 1,
            "success": True,
            "msg": "Workflow deleted successfully",
            "data": None
        }
        return JSONResponse(status_code=200, content=res) 
    except Exception as e:
        res = {
            'code': -1,
            'msg': f'Something went wrong. {e}',
            'success': False
        }
        return JSONResponse(status_code=500, content=res) 