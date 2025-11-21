# crud/workflows.py
from sqlalchemy.orm import Session
from models import Workflow, Document  # adjust import paths
from schemas.schemas import WorkflowCreate  # adjust path as needed

def create_workflow(
    db: Session,
    wf_in: WorkflowCreate,
    user_id: int,
    workflow_path: str,
) -> Workflow:
    """
    Creates a Workflow row and a root Document row for this workflow_path.
    """
    db_workflow = Workflow(
        entity=wf_in.entity,
        workflow_name=wf_in.workflow_name,
        baseline_year=wf_in.baseline_year,
        json_data=wf_in.json_data or "default",
        reporting_period=wf_in.reporting_period,
        workflow_type=wf_in.workflow_type,
        user_id=user_id,
        loan_product=wf_in.loan_product,
        report_date_start=wf_in.report_date_start,
    )

    db.add(db_workflow)
    db.flush()  # so db_workflow.id is available

    # optional but typical: create a Document row keyed by workflow_path
    root_doc = Document(
        workflow_id=db_workflow.id,
        user_id=user_id,
        workflow_path=workflow_path,
    )
    db.add(root_doc)

    db.commit()
    db.refresh(db_workflow)
    return db_workflow
