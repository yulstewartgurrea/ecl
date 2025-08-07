from sqlalchemy.orm import Session
from models.models import Workflow
from schemas.schemas import WorkflowCreate, WorkflowResponse

def get_workflows(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return db.query(Workflow).filter(Workflow.user_id == user_id).offset(skip).limit(limit).all()

def create_workflow(db: Session, workflow: WorkflowCreate, user_id: int):
    print('test')
    db_workflow = Workflow(**workflow.model_dump(), user_id=user_id)
    db.add(db_workflow)
    db.commit()
    db.refresh(db_workflow)
    return WorkflowResponse.model_validate(db_workflow)