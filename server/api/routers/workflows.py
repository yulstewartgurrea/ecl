from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List

from schemas.schemas import WorkflowResponse, WorkflowCreate  # Updated imports
from models.models import User
from database import get_db
from helpers.workflow import get_workflows, create_workflow, get_latest_workflow
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
    except Exception as e
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
