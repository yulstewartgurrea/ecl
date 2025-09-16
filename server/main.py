from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

# Import DB and session factory
from database import engine, Base, SessionLocal

import models  # noqa: F401
from models import User, Workflow, Document, JsonData

# Routers and helpers
from api.routers import users, workflows, documents, auth, login
from api.routers.overlay.development import data_interpolation, data_transformation


from core.dependencies import get_password_hash

app = FastAPI()


origins = [
    "tauri://localhost",
    "http://localhost:5173", 
    "http://127.0.0.1:5173",
    "http://localhost",
    "http://127.0.0.1",
    "http://localhost:3000",
    "app://localhost"
]

# CORS - allow dev origins; adjust / tighten for production
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create tables from SQLAlchemy models (safe, single call)
Base.metadata.create_all(bind=engine)


def insert_initial_users():
    """
    Insert initial users if they don't already exist.
    Uses ORM-style session and hashed passwords.
    """
    initial_users = [
        {"username": "admin", "password": "sgvadmin0987", "role": "admin"},
        {"username": "user1", "password": "sgvuser0987", "role": "user"},
        {"username": "user2", "password": "sgvuser0987", "role": "user"},
    ]

    db = SessionLocal()
    try:
        for u in initial_users:
            exists = db.query(User).filter_by(username=u["username"]).first()
            if not exists:
                user = User(
                    username=u["username"],
                    hashed_password=get_password_hash(u["password"]),
                    role=u["role"],
                )
                db.add(user)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


try:
    insert_initial_users()
except Exception as e:
    import traceback
    traceback.print_exc()
    print("Warning: initial user insertion failed:", e)



# Test endpoints
@app.get("/test-cors")
async def test_cors():
    return {"message": "CORS is working"}

@app.get("/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow()}

# Include routers (make sure each router is defined correctly)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(workflows.router)
app.include_router(documents.router)
app.include_router(login.router)
app.include_router(data_interpolation.router)
app.include_router(data_transformation.router)
