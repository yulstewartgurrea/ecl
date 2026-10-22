from sqlalchemy.orm import Session
from sqlalchemy import func, cast, String
from datetime import datetime
from typing import Optional, Tuple, List
from models.models import Workflow
from schemas.schemas import WorkflowCreate, WorkflowResponse

def get_workflows(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return db.query(Workflow).filter(Workflow.user_id == user_id).offset(skip).limit(limit).all()

def create_workflow(db: Session, wf_in: WorkflowCreate, user_id: int) -> Workflow:
    # report_date_start only feeds baseline_year; the table has no column for it
    db_workflow = Workflow(**wf_in.model_dump(exclude={"report_date_start"}), user_id=user_id)
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
    update_data = workflow_update.model_dump(exclude_unset=True, exclude={"report_date_start"})
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

def search_workflows(
    db: Session,
    user_id: int,
    skip: int = 0,
    limit: int = 100,
    search_query: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> Tuple[List[Workflow], int]:
    """
    Search workflows with pagination and optional search by name and date range.
    
    Args:
        db: Database session
        user_id: User ID to filter workflows
        skip: Number of records to skip (for pagination)
        limit: Maximum number of records to return
        search_query: Search term for workflow_name (case-insensitive partial match)
        start_date: Start date for date range filter (format: YYYY-MM-DD)
        end_date: End date for date range filter (format: YYYY-MM-DD)
    
    Returns:
        Tuple of (list of workflows, total count)
    """
    query = db.query(Workflow).filter(Workflow.user_id == user_id)
    
    # Search by workflow name (case-insensitive partial match)
    if search_query:
        query = query.filter(
            Workflow.workflow_name.ilike(f"%{search_query}%")
        )
    
    # Search by date range (created_at)
    if start_date or end_date:
        if start_date and end_date:
            # Both start and end date provided - filter by date range
            try:
                start_date_obj = datetime.strptime(start_date, "%Y-%m-%d").date()
                end_date_obj = datetime.strptime(end_date, "%Y-%m-%d").date()
                # Filter by date range (inclusive)
                query = query.filter(
                    func.date(Workflow.created_at) >= start_date_obj,
                    func.date(Workflow.created_at) <= end_date_obj
                )
            except ValueError:
                # If date parsing fails, skip date filtering
                pass
        elif start_date:
            # Only start date provided - filter from start date onwards
            try:
                start_date_obj = datetime.strptime(start_date, "%Y-%m-%d").date()
                query = query.filter(
                    func.date(Workflow.created_at) >= start_date_obj
                )
            except ValueError:
                pass
        elif end_date:
            # Only end date provided - filter up to end date
            try:
                end_date_obj = datetime.strptime(end_date, "%Y-%m-%d").date()
                query = query.filter(
                    func.date(Workflow.created_at) <= end_date_obj
                )
            except ValueError:
                pass
    
    # Get total count before pagination
    total_count = query.count()
    
    # Apply pagination and ordering
    workflows = query.order_by(Workflow.created_at.desc()).offset(skip).limit(limit).all()
    
    return workflows, total_count