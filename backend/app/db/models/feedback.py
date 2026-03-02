from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

# --- SQLAlchemy Models ---

class Feedback(Base):
    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False, index=True)
    type = Column(String, nullable=False, index=True) # "Issue", "Feature Request", "General"
    status = Column(String, nullable=False, default="Active", index=True) # "Active", "Closed"
    message = Column(Text, nullable=False)
    upvotes = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", backref="feedbacks", foreign_keys=[user_id])
    comments = relationship("FeedbackComment", back_populates="feedback", cascade="all, delete-orphan", order_by="FeedbackComment.created_at.asc()")

class FeedbackComment(Base):
    __tablename__ = "feedback_comments"

    id = Column(Integer, primary_key=True, index=True)
    feedback_id = Column(Integer, ForeignKey("feedbacks.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    feedback = relationship("Feedback", back_populates="comments", foreign_keys=[feedback_id])
    user = relationship("User", foreign_keys=[user_id])
