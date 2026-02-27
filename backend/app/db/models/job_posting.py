from sqlalchemy import Column, Integer, String, Float, DateTime, Text, JSON
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector

from app.db.base_class import Base

class JobPosting(Base):
    __tablename__ = "job_postings"

    id = Column(Integer, primary_key=True, index=True)
    source = Column(String, nullable=False, index=True) # e.g., 'manual', 'scraper'
    external_id = Column(String, nullable=True, index=True)
    source_url = Column(String, nullable=True) # URL the job was scraped from
    
    title = Column(String, nullable=False)
    company = Column(String, nullable=False)
    location = Column(String, nullable=True) # e.g., 'Remote', 'New York, NY'
    description = Column(Text, nullable=False)
    
    # Intelligence output
    embedding = Column(Vector(384)) # matches all-MiniLM-L6-v2 dimensionality
    relevance_score = Column(Float, nullable=True) # Optional global or pre-computed score
    
    metadata_json = Column(JSON, nullable=True) # Store extra raw data from adapters
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
