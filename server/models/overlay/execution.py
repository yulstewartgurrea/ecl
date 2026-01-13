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

class OverlayExecutionDataTransformationJob(Base):
    __tablename__ = "overlay_execution_data_transformation_job"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(50), nullable=False, default="pending")  # pending, processing, completed, failed, cancelled
    progress = Column(Integer, nullable=False, default=0)  # 0-100
    message = Column(Text, nullable=True)  # Current step description
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)  # When processing started
    completed_at = Column(DateTime, nullable=True)  # When processing completed/failed/cancelled
    running_time_seconds = Column(Integer, nullable=True)  # Total running time in seconds
    created_at = Column(
        DateTime, nullable=False, server_default=sql_text("CURRENT_TIMESTAMP")
    )
    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=sql_text("CURRENT_TIMESTAMP"),
        onupdate=datetime.utcnow,
    )

    def __repr__(self):
        return f"<OverlayExecutionDataTransformationJob id={self.id} workflow_id={self.workflow_id!r} status={self.status!r}>"

class OverlayExecutionDataTransformationOutput(Base):
    __tablename__ = "overlay_execution_data_tranformation_output"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    log_id = Column(Integer, ForeignKey("overlay_logs.id"), nullable=False)
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
    folder = Column(Text, nullable=False)
    filename = Column(Text, nullable=False)

    def __repr__(self):
        return f"<OverlayExecutionDataTransformationOutput id={self.id} workflow_id={self.workflow_id!r}>"