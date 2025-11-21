from sqlite3 import IntegrityError
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from crud.workflows import create_workflow
from schemas.schemas import WorkflowResponse, WorkflowCreate  # Updated imports
from models.models import User, Workflow
from database import get_db
from helpers.workflow import get_workflows, get_latest_workflow, get_workflow_by_id, update_workflow, delete_workflow
from core.security import get_current_user
from sqlalchemy import select
from fastapi import HTTPException
from helpers.make_json_serializable import make_json_serializable

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
        res = {
            'code': -1,
            'msg': f'Something went wrong. {e}',
            'success': False
        }
        return JSONResponse(status_code=500, content=res) 

@router.post("/", response_model=WorkflowResponse, status_code=201)
def create_user_workflow(
    workflow: WorkflowCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exists = db.execute(
        select(Workflow).where(
            Workflow.user_id == current_user.id,
            Workflow.entity == workflow.entity,
            Workflow.loan_product == workflow.loan_product,
            Workflow.reporting_period == workflow.reporting_period,
            Workflow.workflow_name == workflow.workflow_name,
        )
    ).scalar_one_or_none()

    if exists:
        raise HTTPException(
            status_code=409,
            detail=(
                "A workflow with the same "
                "entity / loan_product / reporting_period / report_date_start / workflow_name "
                "already exists for this user."
            ),
        )
    workflow_path = (
        f"/{workflow.entity}"
        f"/{workflow.reporting_period}"
        f"/{workflow.workflow_name}"
        f"/{workflow.loan_product}"
    )

    try:
        db_workflow = create_workflow(
            db=db,
            wf_in=workflow,
            user_id=current_user.id,
            workflow_path=workflow_path,
        )
        return db_workflow
    except IntegrityError as e:
        db.rollback()
        msg = getattr(e, "orig", e)
        raise HTTPException(status_code=409, detail=f"Integrity error: {msg}")

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
