from sqlalchemy.orm import Session
from models.models import Document
from schemas.schemas import DocumentCreate, DocumentResponse

def get_documents(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return db.query(Document).filter(Document.user_id == user_id).offset(skip).limit(limit).all()

def create_document(db: Session, document: DocumentCreate, user_id: int):
    db_document = Document(
        filename=document.filename,
        workflow_path=document.workflow_path,
        user_id=user_id
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