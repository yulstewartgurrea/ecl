from pydantic import BaseModel, EmailStr, field_validator, model_validator
from typing import Optional, Union
from datetime import date, datetime
from helpers.safe_path import check_name
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
    status: Optional[Union[int, str]] = None  # Accept int or str
    workflow_type: Optional[str] = "default"
    loan_product: Optional[str] = None

class WorkflowCreate(WorkflowBase):
    # Reporting date (month-end) picked in the workflow form; baseline_year is its year.
    # Not stored itself yet: the workflows table has no column for it until migrations exist.
    report_date_start: Optional[date] = None

    # these become folder names under server/files
    @field_validator("entity", "workflow_name", "reporting_period", "loan_product")
    @classmethod
    def _check_folder_name(cls, v):
        return check_name(v)

    @model_validator(mode="after")
    def _baseline_year_from_report_date(self):
        if self.report_date_start is not None:
            self.baseline_year = self.report_date_start.year
        elif self.baseline_year in (None, ""):
            # workflows.baseline_year is NOT NULL; updates resend the stored value
            raise ValueError("report_date_start is required")
        return self

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
    # Optional for backward compatibility with older clients.
    # If omitted, the server will attempt to infer it from workflow_path.
    workflow_id: Optional[int] = None

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
    @field_validator("name")
    @classmethod
    def _check_folder_name(cls, v):
        return check_name(v)

class EntityUpdate(BaseModel):
    name: Optional[str] = None

    @field_validator("name")
    @classmethod
    def _check_folder_name(cls, v):
        return check_name(v)

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
    @field_validator("name")
    @classmethod
    def _check_folder_name(cls, v):
        return check_name(v)

class LoanProductUpdate(BaseModel):
    name: Optional[str] = None
    entity_id: Optional[int] = None

    @field_validator("name")
    @classmethod
    def _check_folder_name(cls, v):
        return check_name(v)

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