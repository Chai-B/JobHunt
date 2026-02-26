from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func

from app.db.base import Base

class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    job_id = Column(Integer, ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=True, index=True)
    resume_id = Column(Integer, ForeignKey("resumes.id", ondelete="SET NULL"), nullable=True) # Resume used
    
    # Ad-hoc application details (e.g. for Cold Mails without a formal JobPosting)
    company_name = Column(String, nullable=True)
    job_title = Column(String, nullable=True)
    application_type = Column(String, default="Standard") # 'Standard', 'Cold Mail'

    # State Machine: discovered, shortlisted, prepared, submitted, acknowledged, responded, closed, interviewing, rejected, offer
    status = Column(String, nullable=False, default="shortlisted", index=True)
    
    notes = Column(Text, nullable=True)
    
    # Enrichment fields for better tracking and sync
    contact_name = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
    contact_role = Column(String, nullable=True)
    source_url = Column(String, nullable=True)
    location = Column(String, nullable=True)
    
    applied_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
