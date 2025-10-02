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

class FlowRateApproachLogs(Base):
    """
        Flow rate approach should be unique by workflow and submodule
    """
    __tablename__ = "flowrate_approach_logs"

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
        return f"<FlowRateApproachLogs id={self.id} workflow_id={self.workflow_id!r}>"

class FlowRateApproachWriteOffAccounts(Base):
    __tablename__ = "flowrate_approach_write_off_accounts"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    log_id = Column(Integer, ForeignKey("flowrate_approach_logs.id"), nullable=False)
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
        return f"<FlowRateApproachWriteOffAccounts id={self.id} workflow_id={self.workflow_id!r}>"

class FlowRateApproachAgingReport(Base):
    __tablename__ = "flowrate_approach_aging_report"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    log_id = Column(Integer, ForeignKey("flowrate_approach_logs.id"), nullable=False)
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
        return f"<FlowRateApproachAgingReport id={self.id} workflow_id={self.workflow_id!r}>"

class FlowRateApproachCollectionRate(Base):
    __tablename__ = "flowrate_approach_collection_rate"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    log_id = Column(Integer, ForeignKey("flowrate_approach_logs.id"), nullable=False)
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
        return f"<FlowRateApproachCollectionRate id={self.id} workflow_id={self.workflow_id!r}>"

class FlowRateApproachDetailedByProduct(Base):
    __tablename__ = "flowrate_approach_detailed_by_product"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    log_id = Column(Integer, ForeignKey("flowrate_approach_logs.id"), nullable=False)
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
        return f"<FlowRateApproachDetailedByProduct id={self.id} workflow_id={self.workflow_id!r}>"

class FlowRateApproachFsCurrentBalance(Base):
    __tablename__ = "flowrate_approach_fs_current_balance"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    log_id = Column(Integer, ForeignKey("flowrate_approach_logs.id"), nullable=False)
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
        return f"<FlowRateApproachFsCurrentBalance id={self.id} workflow_id={self.workflow_id!r}>"

class FlowRateApproachMisData(Base):
    __tablename__ = "flowrate_approach_mis_data"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    log_id = Column(Integer, ForeignKey("flowrate_approach_logs.id"), nullable=False)
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
        return f"<FlowRateApproachMisData id={self.id} workflow_id={self.workflow_id!r}>"

class FlowRateApproachReportsGeneratedExtractedCams(Base):
    __tablename__ = "flowrate_approach_reports_generated_extracted_cams"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    log_id = Column(Integer, ForeignKey("flowrate_approach_logs.id"), nullable=False)
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
        return f"<FlowRateApproachReportsGeneratedExtractedCams id={self.id} workflow_id={self.workflow_id!r}>"