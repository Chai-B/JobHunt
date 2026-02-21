from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base

class ActionLog(Base):
    __tablename__ = "action_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    action_type = Column(String, index=True, nullable=False) # e.g., "resume_extraction", "auto_apply", "scraper"
    status = Column(String, index=True, nullable=False) # e.g., "pending", "running", "success", "failed"
    message = Column(Text, nullable=True) # Detailed log message or error trace
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relationship to user (optional, system-wide tasks might not have a specific user)
    user = relationship("User", backref="action_logs")
