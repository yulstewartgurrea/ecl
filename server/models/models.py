from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, ForeignKey, UniqueConstraint
from database import Base
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)

class Workflow(Base):
    __tablename__ = "workflows"
    id = Column(Integer, primary_key=True, index=True)
    entity = Column(String)
    workflow_name = Column(String)
    baseline_year = Column(Integer)
    json_data = Column(Text)
    reporting_period = Column(String)
    workflow_type = Column(String, default="default")
    user_id = Column(Integer, ForeignKey("users.id"))

class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String)
    workflow_path = Column(String)
    json_data = Column(Text, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())  # store ISO string
    updated_at = Column(String, default=lambda: datetime.utcnow().isoformat())

class Json(Base):
    __tablename__ = "json"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    workflow_path = Column(String)
    json_data = Column(Text, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())  # store ISO string
    updated_at = Column(String, default=lambda: datetime.utcnow().isoformat())
    __table_args__ = (
        UniqueConstraint('workflow_path', 'name', name='uix_workflow_path_name'),
    )
