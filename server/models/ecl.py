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

class EclLogs(Base):
    """
        Ecl should be unique by workflow and submodule
    """
    __tablename__ = "ecl_logs"

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
    submodule = Column(Text, nullable=True)

    # Unique constraint to ensure one ecl per workflow and submodule
    __table_args__ = (
        UniqueConstraint("workflow_id", "submodule", name="uix_workflow_ecl_submodule"),
    )

    def __repr__(self):
        return f"<EclLogs id={self.id} workflow_id={self.workflow_id!r} submodule={self.submodule!r}>"