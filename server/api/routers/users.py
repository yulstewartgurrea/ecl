from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from models.models import User
from schemas.schemas import UserResponse
from datetime import timedelta
from core.security import create_access_token
from core.config import settings  # Assuming your settings are here

router = APIRouter(prefix="/users", tags=["users"])

def get_user_by_username(db: Session, username: str):
    return db.query(User).filter(User.username == username).first()

@router.get("/me")
def read_user_me(
    username: str = Query(...),  # client must send ?username=...
    db: Session = Depends(get_db)
):
    user = get_user_by_username(db, username=username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {
        "user": UserResponse.model_validate(user),
        "access_token": access_token,
        "token_type": "bearer"
    }
