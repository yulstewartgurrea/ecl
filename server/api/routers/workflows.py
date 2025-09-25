from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List

from schemas.schemas import WorkflowResponse, WorkflowCreate  # Updated imports
from models.models import User
from database import get_db
from helpers.workflow import get_workflows, create_workflow, get_latest_workflow, get_workflow_by_id, update_workflow, delete_workflow
from core.security import get_current_user

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
        return {
            "code": 1, 
            "success": True,
            "data": workflows,
        }
    except Exception as e:
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
        workflow = create_workflow(db=db, workflow=workflow, user_id=current_user.id)
        return {
            "code": 1, 
            "success": True,
            "data": workflow,
        }
    except Exception as e:
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
        return {
            "code": 1, 
            "success": True,
            "data": workflow,
        }
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
        
        return {
            "code": 1,
            "success": True,
            "data": WorkflowResponse.model_validate(workflow),
        }
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
        
        return {
            "code": 1,
            "success": True,
            "data": updated_workflow,
        }
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
        
        return {
            "code": 1,
            "success": True,
            "msg": "Workflow deleted successfully",
            "data": None
        }
    except Exception as e:
        res = {
            'code': -1,
            'msg': f'Something went wrong. {e}',
            'success': False
        }
        return JSONResponse(status_code=500, content=res) 
