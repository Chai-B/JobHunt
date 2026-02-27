from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base

class ScrapedContact(Base):
    """
    Stores globally accessible contact information scraped by any user.
    Used for the Auto-Cold Mailing engine.
    """
    __tablename__ = "scraped_contacts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    
    name = Column(String, nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    role = Column(String, nullable=True) # e.g. "Technical Recruiter"
    company = Column(String, nullable=True)
    source_url = Column(String, nullable=True) # Where was this scraped from?

    is_verified = Column(Boolean, default=False) # Potential hook for future email-verification tools
    
    # Audit timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    owner = relationship("User", backref="contacts", foreign_keys=[user_id])
