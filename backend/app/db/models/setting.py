from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func
from app.db.base import Base

class UserSetting(Base):
    """
    Stores user-specific settings necessary for the autonomous open-source framework.
    This includes LLM keys, target external database configurations, and scraper preferences.
    """
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    # AI Engine Settings
    gemini_api_keys = Column(String, nullable=True) # Stored as comma-separated string for fallback rotation
    
    # External Database/Storage (e.g., Supabase integration)
    external_db_url = Column(String, nullable=True)
    external_db_auth_key = Column(String, nullable=True)
    
    # Cold Mailing Settings
    smtp_server = Column(String, nullable=True)
    smtp_port = Column(Integer, nullable=True)
    smtp_username = Column(String, nullable=True)
    smtp_password = Column(String, nullable=True) # In a real prod environment, encrypt this.

    # Advanced Job Constraints
    target_roles = Column(String, nullable=True, default="Software Engineer, Full Stack Developer")
    target_locations = Column(String, nullable=True, default="Remote, USA")
    daily_apply_limit = Column(Integer, nullable=True, default=10)
    scrape_frequency_hours = Column(Integer, nullable=True, default=24)

    # Audit timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    owner = relationship("User", backref=backref("settings", uselist=False))
