from sqlalchemy import Column, Integer, String, Text, ForeignKey
from database import Base

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
    document_key = Column(String)
    document_type = Column(String)
    file_data = Column(Text)
    user_id = Column(Integer, ForeignKey("users.id"))