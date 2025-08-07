from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from datetime import datetime
from database import get_db, engine, Base, SessionLocal
from api.routers import users, workflows, documents, auth
from core.dependencies import get_password_hash 

app = FastAPI()
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Create tables
Base.metadata.create_all(bind=engine)

@app.get("/test-cors")
async def test_cors():
    return {"message": "CORS is working"}

@app.on_event("startup")
async def initialize_database():
    with SessionLocal() as db:
        try:
            user_count = db.execute(text("SELECT COUNT(*) FROM users")).scalar()
            
            if user_count == 0:
                # Hash passwords before storing
                admin_password = get_password_hash("sgvadmin0987")
                user_password = get_password_hash("sgvuser0987")
                
                db.execute(text(f"""
                    INSERT INTO users (username, email, hashed_password)
                    VALUES 
                        ('admin', 'admin@example.com', '{admin_password}'),
                        ('user', 'user@example.com', '{user_password}')
                """))
                
                db.execute(text("""
                    INSERT INTO workflows (
                        entity, workflow_name, baseline_year, 
                        json_data, reporting_period, workflow_type, user_id
                    ) VALUES (
                        'Sample Entity', 'Initial Workflow', 2023,
                        '{"key": "value"}', 'Annual', 'default',
                        (SELECT id FROM users WHERE username = 'admin')
                    )
                """))
                
                db.execute(text("""
                    INSERT INTO documents (
                        filename, document_key, document_type, user_id
                    ) VALUES (
                        'sample.pdf', 'doc_123', 'pdf',
                        (SELECT id FROM users WHERE username = 'admin')
                    )
                """))
                
                db.commit()
                print("Database populated with initial data")
            else:
                print("Database already contains data - skipping population")
                
        except Exception as e:
            print(f"Error during database population: {e}")
            db.rollback()
            raise


@app.get("/health")
def health_check():
    print("Health check endpoint called")
    return {"status": "ok", "timestamp a": datetime.utcnow()}

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(workflows.router)
app.include_router(documents.router)