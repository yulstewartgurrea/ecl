from pydantic import BaseModel, EmailStr
from typing import Optional, Union
# User Schemas
class UserBase(BaseModel):
    username: str
    email: Optional[str] = None

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
    baseline_year: Optional[Union[int, str]] = None  # Accept int or str
    json_data: Optional[str] = "default"
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
    json_data: Optional[str] = None
    version: Optional[int] = None
    workflow_path: str
class DocumentCreate(DocumentBase):
    pass

class DocumentResponse(DocumentBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True

class JsonBase(BaseModel):
    name: str
    workflow_path: str
    json_data: str

class JsonCreate(JsonBase):
    pass

class JsonResponse(JsonBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True

# Auth Schema
class Token(BaseModel):
    access_token: str
    token_type: str