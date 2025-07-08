from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from typing import List

from schemas.schemas import DocumentResponse, DocumentCreate  # Updated imports
from models.models import User
from database import get_db
from helpers.document import get_documents, create_document, delete_document
from core.security import get_current_user

router = APIRouter(prefix="/documents", tags=["documents"])

@router.get("/", response_model=List[DocumentResponse])
def read_documents(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    documents = get_documents(db, user_id=current_user.id, skip=skip, limit=limit)
    return documents

@router.post("/", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
def upload_document(
    file: UploadFile = File(...),
    document_key: str = None,
    document_type: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    file_data = file.file.read()
    document = DocumentCreate(
        filename=file.filename,
        document_key=document_key,
        document_type=document_type,
        file_data=file_data
    )
    return create_document(db=db, document=document, user_id=current_user.id)

@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not delete_document(db, document_id=document_id, user_id=current_user.id):
        raise HTTPException(status_code=404, detail="Document not found")
    return None