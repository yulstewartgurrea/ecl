class OverlayDevelopmentDataInterpolationOutput(Base):
    __tablename__ = "overlay_development_data_interpolation_output"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False)
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

    def __repr__(self):
        return f"<OverlayDevelopmentDataInterpolationOutput id={self.id} workflow_id={self.workflow_id!r}>"

class OverlayDevelopmentDataTransformationOutput(Base):
    __tablename__ = "overlay_development_data_interpolation_output"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False)
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

    def __repr__(self):
        return f"<OverlayDevelopmentDataInterpolationOutput id={self.id} workflow_id={self.workflow_id!r}>"

class OverlayDevelopmentMultiFactorAnalysisOutput(Base):
    __tablename__ = "overlay_development_multi_factor_analysis_output"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False)
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

    def __repr__(self):
        return f"<OverlayDevelopmentMultiFactorAnalysisOutput id={self.id} workflow_id={self.workflow_id!r}>"

class OverlayDevelopmenFilteringOfModelsOutput(Base):
    __tablename__ = "overlay_development_filtering_of_models_output"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False)
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

    def __repr__(self):
        return f"<OverlayDevelopmentFilteringOfModelsOutput id={self.id} workflow_id={self.workflow_id!r}>"

class OverlayDevelopmenCandidateModelsOutput(Base):
    __tablename__ = "overlay_development_candidate_models_output"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False)
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

    def __repr__(self):
        return f"<OverlayDevelopmentCandidateModelsOutput id={self.id} workflow_id={self.workflow_id!r}>"

class OverlayDevelopmentFinalModelOutput(Base):
    __tablename__ = "overlay_development_final_model_output"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False)
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

    def __repr__(self):
        return f"<OverlayDevelopmentFinalModelOutput id={self.id} workflow_id={self.workflow_id!r}>"