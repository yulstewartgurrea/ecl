from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session
from database import get_db
from core.dependencies import verify_password
from core.jwt import create_access_token
from datetime import timedelta
from core.config import settings

router = APIRouter(
    prefix="/login",
    tags=["Login"]
)

# Pydantic model for request body
class LoginRequest(BaseModel):
    username: str
    password: str

@router.post("/")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate user with username and password, return JWT token.
    """
    user = db.execute(
        text("SELECT * FROM users WHERE username = :username"),
        {"username": request.username}
    ).fetchone()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Create JWT token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role},
        expires_delta=access_token_expires
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": user.username,
        "role": user.role
    }
