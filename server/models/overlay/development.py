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

SUBMODULE = [
    'DEVELOPMENT',
    'EXECUTION'
]

class OverlayLogs(Base):
    """
        Overlay should be unique by workflow and overlay_type
    """
    __tablename__ = "overlay_logs"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(
        DateTime, nullable=False, server_default=sql_text("CURRENT_TIMESTAMP")
    )
    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=sql_text("CURRENT_TIMESTAMP"),
        onupdate=datetime.utcnow,
    )
    submodule = Column(Text, nullable=False)

    # Unique constraint to ensure one overlay per workflow and submodule
    __table_args__ = (
        UniqueConstraint("workflow_id", "submodule", name="uix_workflow_submodule"),
    )

    def __repr__(self):
        return f"<OverlayLogs id={self.id} workflow_id={self.workflow_id!r}>"

class OverlayDevelopmentMonthlyHistoricalMevInput(Base):
    __tablename__ = "overlay_development_monthly_historical_mev_input"

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

    def __repr__(self):
        return f"<OverlayDevelopmentMonthlyHistoricalMevInput id={self.id} workflow_id={self.workflow_id!r}>"

class OverlayDevelopmentQuarterlyHistoricalMevInput(Base):
    __tablename__ = "overlay_development_quarterly_historical_mev_input"

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

    def __repr__(self):
        return f"<OverlayDevelopmentQuarterlyHistoricalMevInput id={self.id} workflow_id={self.workflow_id!r}>"

class OverlayDevelopmentHistoricalDefaultRateInput(Base):
    __tablename__ = "overlay_development_historical_default_rate_input"

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

    def __repr__(self):
        return f"<OverlayDevelopmentHistoricalDefaultRateInput id={self.id} workflow_id={self.workflow_id!r}>"

class OverlayDevelopmentDataInterpolationOutput(Base):
    __tablename__ = "overlay_development_data_interpolation_output"

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
        return f"<OverlayDevelopmentDataInterpolationOutput id={self.id} workflow_id={self.workflow_id!r}>"

class OverlayDevelopmentDataTransformationJob(Base):
    __tablename__ = "overlay_development_data_transformation_job"

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
        return f"<OverlayDevelopmentDataTransformationJob id={self.id} workflow_id={self.workflow_id!r} status={self.status!r}>"

class OverlayDevelopmentDataTransformationOutput(Base):
    __tablename__ = "overlay_development_data_tranformation_output"

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
        return f"<OverlayDevelopmentDataTransformationOutput id={self.id} workflow_id={self.workflow_id!r}>"

class OverlayDevelopmentMultifactorAnalysisJob(Base):
    __tablename__ = "overlay_development_multifactor_analysis_job"

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
        return f"<OverlayDevelopmentMultifactorAnalysisJob id={self.id} workflow_id={self.workflow_id!r} status={self.status!r}>"

class OverlayDevelopmentMultiFactorAnalysisOutput(Base):
    __tablename__ = "overlay_development_multi_factor_analysis_output"

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
        return f"<OverlayDevelopmentMultiFactorAnalysisOutput id={self.id} workflow_id={self.workflow_id!r}>"

class OverlayDevelopmenFilteringOfModelsOutput(Base):
    __tablename__ = "overlay_development_filtering_of_models_output"

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
        return f"<OverlayDevelopmentFilteringOfModelsOutput id={self.id} workflow_id={self.workflow_id!r}>"

class OverlayDevelopmenCandidateModelsOutput(Base):
    __tablename__ = "overlay_development_candidate_models_output"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    log_id = Column(Integer, ForeignKey("overlay_logs.id"), nullable=True)
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
        return f"<OverlayDevelopmentCandidateModelsOutput id={self.id} workflow_id={self.workflow_id!r}>"

class OverlayDevelopmentFinalModelOutput(Base):
    __tablename__ = "overlay_development_final_model_output"

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
        return f"<OverlayDevelopmentFinalModelOutput id={self.id} workflow_id={self.workflow_id!r}>"