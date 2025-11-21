from pydantic import BaseModel, ConfigDict, EmailStr, field_validator
from typing import Literal, Optional, Union
from datetime import datetime
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

class WorkflowCreate(BaseModel):
    entity: str
    workflow_name: str
    reporting_period: str | Literal["Annual", "Monthly", "Quarterly", "Yearly"]  # adjust as needed
    baseline_year: int | str
    workflow_type: str
    json_data: Optional[str] = "default"
    loan_product: str
    report_date_start: str
    @field_validator("baseline_year", mode="before")
    @classmethod
    def _coerce_year(cls, v):
        if v is None:
            raise ValueError("baseline_year is required")
        if isinstance(v, int):
            return v
        s = str(v).strip()
        if not s.isdigit():
            raise ValueError("baseline_year must be numeric")
        return int(s)

class WorkflowResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)  # <-- IMPORTANT
    id: int
    entity: str
    workflow_name: str
    reporting_period: str
    baseline_year: int
    workflow_type: str
    user_id: int
    json_data: Optional[str] = "default"

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

# Entity Schemas
class EntityBase(BaseModel):
    name: str

class EntityCreate(EntityBase):
    pass

class EntityUpdate(BaseModel):
    name: Optional[str] = None

class EntityResponse(EntityBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# LoanProduct Schemas
class LoanProductBase(BaseModel):
    name: str
    entity_id: int

class LoanProductCreate(LoanProductBase):
    pass

class LoanProductUpdate(BaseModel):
    name: Optional[str] = None
    entity_id: Optional[int] = None

class LoanProductResponse(LoanProductBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Auth Schema
class Token(BaseModel):
    access_token: str
    token_type: str