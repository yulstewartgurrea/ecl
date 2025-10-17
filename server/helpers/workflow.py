from sqlalchemy.orm import Session
from models.models import Workflow
from schemas.schemas import WorkflowCreate, WorkflowResponse
from typing import Optional

def get_workflows(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return db.query(Workflow).filter(Workflow.user_id == user_id).offset(skip).limit(limit).all()

def create_workflow(db: Session, wf_in: WorkflowCreate, user_id: int) -> Workflow:
    # Coerced already by Pydantic: wf_in.baseline_year is int here
    db_workflow = Workflow(**wf_in.model_dump(), user_id=user_id)
    db.add(db_workflow)
    db.commit()
    db.refresh(db_workflow)
    return db_workflow



def get_latest_workflow(db: Session, user_id: int):
    return db.query(Workflow).filter(Workflow.user_id == user_id).order_by(Workflow.created_at.desc()).first()

def get_workflow_by_id(db: Session, workflow_id: int, user_id: int) -> Optional[Workflow]:
    """Get a specific workflow by ID for a user"""
    return db.query(Workflow).filter(
        Workflow.id == workflow_id,
        Workflow.user_id == user_id
    ).first()

def update_workflow(db: Session, workflow_id: int, workflow_update: WorkflowCreate, user_id: int) -> Optional[WorkflowResponse]:
    """Update a workflow by ID for a user"""
    db_workflow = db.query(Workflow).filter(
        Workflow.id == workflow_id,
        Workflow.user_id == user_id
    ).first()
    
    if not db_workflow:
        return None
    
    # Update the workflow fields
    update_data = workflow_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_workflow, field, value)
    
    db.commit()
    db.refresh(db_workflow)
    return WorkflowResponse.model_validate(db_workflow)

def delete_workflow(db: Session, workflow_id: int, user_id: int) -> bool:
    """Delete a workflow by ID for a user"""
    db_workflow = db.query(Workflow).filter(
        Workflow.id == workflow_id,
        Workflow.user_id == user_id
    ).first()
    
    if not db_workflow:
        return False
    
    db.delete(db_workflow)
    db.commit()
    return True