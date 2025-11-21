from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

# Import DB and session factory
from database import engine, Base, SessionLocal

import models  # noqa: F401
from models import User, Workflow, Document, JsonData
from models.overlay import development  # noqa: F401

# Routers and helpers
from api.routers import (users, 
                        workflows, 
                        documents,
                        auth,
                        login,
                        entity,
                        loan_product,
                        upload)
from api.routers.overlay.development import (
    data_interpolation, 
    data_transformation, 
    multifactor_analysis, 
    filtering_of_models,
    candidate_models,
    final_models)
from api.routers.flowrate_approach import (
    flowrate_approach,
    creditloss_rate_calculation
)
from api.routers.overlay.execution import (
    data_interpolation as overlay_execution_data_interpolation,
    override_forecasted_mevs as overlay_execution_override_forecasted_mevs,
    transform_forecasted_mevs as overlay_execution_transform_forecasted_mevs,
    forecasted_pd_calc as overlay_execution_forecasted_pd_calc,
    overlay_multiplier as overlay_execution_overlay_multiplier,
    pd_calibration as overlay_execution_pd_calibration,
    final_pit_pd as overlay_execution_final_pit_pd
)

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
app.include_router(entity.router)
app.include_router(loan_product.router)
app.include_router(upload.router)

# FLOWRATE
app.include_router(flowrate_approach.router)
app.include_router(creditloss_rate_calculation.router)

# OVERLAY DEVELOPMENT
app.include_router(data_interpolation.router)
app.include_router(data_transformation.router)
app.include_router(multifactor_analysis.router)
app.include_router(filtering_of_models.router)
app.include_router(candidate_models.router)
app.include_router(final_models.router)

# OVERLAY EXECUTION
app.include_router(overlay_execution_data_interpolation.router)
app.include_router(overlay_execution_override_forecasted_mevs.router)
app.include_router(overlay_execution_transform_forecasted_mevs.router)
app.include_router(overlay_execution_forecasted_pd_calc.router)
app.include_router(overlay_execution_overlay_multiplier.router)
app.include_router(overlay_execution_pd_calibration.router)
app.include_router(overlay_execution_final_pit_pd.router)