from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from schemas.schemas import WorkflowResponse, WorkflowCreate  # Updated imports
from models.models import User
from database import get_db
from helpers.workflow import get_workflows, create_workflow
from core.security import get_current_user

router = APIRouter(prefix="/workflows", tags=["workflows"])

@router.get("/", response_model=List[WorkflowResponse])
def read_workflows(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workflows = get_workflows(db, user_id=current_user.id, skip=skip, limit=limit)
    return workflows

@router.post("/", response_model=WorkflowResponse)
def create_user_workflow(
    workflow: WorkflowCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return create_workflow(db=db, workflow=workflow, user_id=current_user.id)