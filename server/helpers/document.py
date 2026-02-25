from sqlalchemy.orm import Session
from sqlalchemy import or_
from models.models import Document, Workflow
from schemas.schemas import DocumentCreate, DocumentResponse

def get_documents(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return db.query(Document).filter(Document.user_id == user_id).offset(skip).limit(limit).all()

def _infer_workflow_id(db: Session, *, user_id: int, workflow_path: str) -> int | None:
    """
    Best-effort inference for legacy clients that only send workflow_path.

    Supported shapes observed in this codebase:
    - /{entity}/{reporting_period}/{workflow_name}
    - /{entity}/{reporting_period}/{workflow_name}/{loan_product}
    - /{entity}/{loan_product}/{reporting_period}/{report_date_start}/{workflow_name}
    """
    parts = [p for p in (workflow_path or "").split("/") if p]
    if not parts:
        return None

    entity = parts[0]
    name_candidates = []
    if len(parts) >= 1:
        name_candidates.append(parts[-1])
    if len(parts) >= 2:
        name_candidates.append(parts[-2])
    # de-dupe while preserving order
    seen = set()
    name_candidates = [c for c in name_candidates if not (c in seen or seen.add(c))]

    base_q = db.query(Workflow).filter(Workflow.user_id == user_id, Workflow.entity == entity)
    if name_candidates:
        base_q = base_q.filter(or_(*[Workflow.workflow_name == c for c in name_candidates]))

    # Try to narrow by reporting_period if it looks like the 2nd segment.
    if len(parts) >= 2:
        narrowed = (
            base_q.filter(Workflow.reporting_period == parts[1])
            .order_by(Workflow.created_at.desc())
            .first()
        )
        if narrowed:
            return narrowed.id

    workflow = base_q.order_by(Workflow.created_at.desc()).first()
    return workflow.id if workflow else None

def create_document(db: Session, document: DocumentCreate, user_id: int):
    workflow_id = document.workflow_id
    if workflow_id is None:
        workflow_id = _infer_workflow_id(db, user_id=user_id, workflow_path=document.workflow_path)
    if workflow_id is None:
        raise ValueError(
            "Missing workflow_id for document insert. "
            "Provide workflow_id explicitly (preferred), or ensure workflow_path matches an existing workflow."
        )

    db_document = Document(
        filename=document.filename,
        workflow_path=document.workflow_path,
        user_id=user_id,
        workflow_id=workflow_id,
        version=1
    )
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    return DocumentResponse.model_validate(db_document)

def delete_document(db: Session, document_id: int, user_id: int):
    db_document = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == user_id
    ).first()
    if db_document:
        db.delete(db_document)
        db.commit()
        return True
    return False