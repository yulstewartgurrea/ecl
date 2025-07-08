from pydantic import BaseModel, EmailStr
from typing import Optional

# User Schemas
class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool = True

    class Config:
        from_attributes = True

# Workflow Schemas
class WorkflowBase(BaseModel):
    entity: str
    workflow_name: str
    baseline_year: int
    json_data: str
    reporting_period: str
    workflow_type: Optional[str] = "default"

class WorkflowCreate(WorkflowBase):
    pass

class WorkflowResponse(WorkflowBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True

# Document Schemas
class DocumentBase(BaseModel):
    filename: str
    document_key: str
    document_type: str

class DocumentCreate(DocumentBase):
    file_data: str

class DocumentResponse(DocumentBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True

# Auth Schema
class Token(BaseModel):
    access_token: str
    token_type: str