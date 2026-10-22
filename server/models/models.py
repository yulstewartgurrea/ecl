# models.py
from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    ForeignKey,
    DateTime,
    UniqueConstraint,
    text as sql_text,
)
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False, server_default="user", default="user")
    created_at = Column(
        DateTime, nullable=False, server_default=sql_text("CURRENT_TIMESTAMP")
    )

    # relationships (optional)
    workflows = relationship("Workflow", back_populates="user", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="user", cascade="all, delete-orphan")
    json_items = relationship("JsonData", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User id={self.id} username={self.username!r}>"

class Workflow(Base):
    __tablename__ = "workflows"

    id = Column(Integer, primary_key=True, index=True)
    entity = Column(String, nullable=False)
    workflow_name = Column(String, nullable=False)
    baseline_year = Column(Integer, nullable=False)
    json_data = Column(Text, nullable=False)
    reporting_period = Column(String, nullable=False)
    workflow_type = Column(String, nullable=False, server_default="default", default="default")
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(
        DateTime, nullable=False, server_default=sql_text("CURRENT_TIMESTAMP")
    )
    status = Column(String, default="IN PROGRESS")
    user = relationship("User", back_populates="workflows")
    documents = relationship("Document", back_populates="workflow", cascade="all, delete-orphan")
    # portfolio
    loan_product = Column(String, nullable=True)
    # for the variables runs in the data transformation, mfa and filtering of models
    number_of_combinations = Column(Integer, nullable=True)

    def __repr__(self):
        return f"<Workflow id={self.id} name={self.workflow_name!r}>"

class Entity(Base):
    __tablename__ = "entity"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_at = Column(
        DateTime, nullable=False, server_default=sql_text("CURRENT_TIMESTAMP")
    )
    updated_at = Column(
        DateTime, nullable=False, server_default=sql_text("CURRENT_TIMESTAMP"), onupdate=datetime.utcnow
    )
    loanproducts = relationship("LoanProduct", back_populates="entity")

    def __repr__(self):
        return f"<Entity id={self.id} name={self.name!r}>"

class LoanProduct(Base):
    __tablename__ = "loanproduct"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_at = Column(
        DateTime, nullable=False, server_default=sql_text("CURRENT_TIMESTAMP")
    )
    updated_at = Column(
        DateTime, nullable=False, server_default=sql_text("CURRENT_TIMESTAMP"), onupdate=datetime.utcnow
    )
    entity_id = Column(Integer, ForeignKey("entity.id"), nullable=False)
    entity = relationship("Entity", back_populates="loanproducts")

    def __repr__(self):
        return f"<LoanProduct id={self.id} name={self.name!r}>"


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=True)
    workflow_path = Column(String, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False)
    json_data = Column(Text, nullable=True)
    version = Column(Integer, nullable=True)
    created_at = Column(
        DateTime, nullable=False, server_default=sql_text("CURRENT_TIMESTAMP")
    )
    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=sql_text("CURRENT_TIMESTAMP"),
        onupdate=datetime.utcnow,
    )
    document_type = Column(String, nullable=True)

    user = relationship("User", back_populates="documents")
    workflow = relationship("Workflow", back_populates="documents")

    def __repr__(self):
        return f"<Document id={self.id} filename={self.filename!r}>"

class JsonData(Base):
    __tablename__ = "json"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    workflow_path = Column(String, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    json_data = Column(Text, nullable=True)
    created_at = Column(
        DateTime, nullable=False, server_default=sql_text("CURRENT_TIMESTAMP")
    )
    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=sql_text("CURRENT_TIMESTAMP"),
        onupdate=datetime.utcnow,
    )

    user = relationship("User", back_populates="json_items")

    __table_args__ = (
        UniqueConstraint("workflow_path", "name", name="uix_workflow_path_name"),
    )

    def __repr__(self):
        return f"<JsonData id={self.id} name={self.name!r}>"

class TermsAcceptance(Base):
    """One row each time a user accepts the platform terms. Rows are never updated or deleted."""
    __tablename__ = "terms_acceptances"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    # kept as text so the record still reads correctly if the user is renamed or removed
    username = Column(String, nullable=False)
    app_version = Column(String, nullable=False)
    terms_version = Column(String, nullable=False)
    # SHA-256 of the terms content the user was shown
    terms_hash = Column(String(64), nullable=False)
    accepted_at = Column(
        DateTime, nullable=False, server_default=sql_text("CURRENT_TIMESTAMP")
    )

    def __repr__(self):
        return f"<TermsAcceptance id={self.id} user_id={self.user_id} app_version={self.app_version!r}>"


class TermsDocument(Base):
    """The exact terms content behind each terms_hash, kept once so any acceptance can be shown later."""
    __tablename__ = "terms_documents"

    id = Column(Integer, primary_key=True, index=True)
    terms_hash = Column(String(64), nullable=False, unique=True, index=True)
    terms_version = Column(String, nullable=False)
    # the JSON text the frontend hashed, byte for byte
    content = Column(Text, nullable=False)
    created_at = Column(
        DateTime, nullable=False, server_default=sql_text("CURRENT_TIMESTAMP")
    )

    def __repr__(self):
        return f"<TermsDocument id={self.id} terms_version={self.terms_version!r}>"