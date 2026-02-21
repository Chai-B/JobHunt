from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector

from app.db.base import Base

class Resume(Base):
    __tablename__ = "resumes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String, nullable=False)
    format = Column(String, nullable=False)
    label = Column(String, nullable=True) # e.g., "Frontend Engineer", "Product Manager"
    
    # Extraction output
    raw_text = Column(Text, nullable=True)
    parsed_json = Column(JSON, nullable=True) # Structural parse output
    
    # Intelligence output
    embedding = Column(Vector(384)) # matches all-MiniLM-L6-v2 dimensionality
    structural_score = Column(Float, nullable=True)
    semantic_score = Column(Float, nullable=True)

    status = Column(String, default="pending") # pending, processing, completed, error
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    owner = relationship("User", backref="resumes")
