from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models.models import User
from schemas.schemas import UserResponse
from core.security import get_current_user

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/me", response_model=UserResponse)
def read_user_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return current_user 