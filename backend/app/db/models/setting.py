from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Float, JSON
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
    llm_provider = Column(String, nullable=True, default="gemini") # "gemini", "openai", "openrouter", "custom"
    gemini_api_keys = Column(String, nullable=True) # Stored as comma-separated string for fallback rotation
    preferred_model = Column(String, nullable=True, default="gemini-2.0-flash")
    openai_api_key = Column(String, nullable=True)
    llm_base_url = Column(String, nullable=True)
    
    # External Database/Storage (e.g., Supabase integration)
    external_db_url = Column(String, nullable=True)
    external_db_auth_key = Column(String, nullable=True)
    
    # Cold Mailing Settings
    smtp_server = Column(String, nullable=True)
    smtp_port = Column(Integer, nullable=True)
    smtp_username = Column(String, nullable=True)
    smtp_password = Column(String, nullable=True) # In a real prod environment, encrypt this.

    # Advanced Job Constraints
    scrape_urls = Column(JSON, nullable=True) # List of specific URLs to scrape periodically
    match_threshold = Column(Float, nullable=True, default=70.0) # min score to auto-shortlist
    auto_apply_enabled = Column(Boolean, nullable=True, default=False)
    cold_mail_automation_enabled = Column(Boolean, nullable=True, default=False)

    target_roles = Column(String, nullable=True, default="Software Engineer, Full Stack Developer")
    target_locations = Column(String, nullable=True, default="Remote, USA")
    daily_apply_limit = Column(Integer, nullable=True, default=10)
    daily_cold_mail_limit = Column(Integer, nullable=True, default=5)
    scrape_frequency_hours = Column(Integer, nullable=True, default=24)

    # Gmail Integration
    gmail_refresh_token = Column(String, nullable=True) # In a real app, encrypt this
    gmail_access_token = Column(String, nullable=True) # In a real app, encrypt this
    use_gmail_for_send = Column(Boolean, nullable=True, default=False)

    # Audit timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="settings")
