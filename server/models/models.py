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
    __table_args__ = (
        UniqueConstraint("user_id", "workflow_name", name="uq_user_workflow_name"),
    )
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

    user = relationship("User", back_populates="workflows")
    documents = relationship("Document", back_populates="workflow", cascade="all, delete-orphan")

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
    filename = Column(String, nullable=False)
    workflow_path = Column(String, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
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
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=True)

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
