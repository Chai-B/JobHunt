from pydantic import BaseModel, ConfigDict
from typing import Optional

class UserSettingBase(BaseModel):
    llm_provider: Optional[str] = "gemini"
    gemini_api_keys: Optional[str] = None
    preferred_model: Optional[str] = "gemini-2.0-flash"
    openai_api_key: Optional[str] = None
    llm_base_url: Optional[str] = None
    external_db_url: Optional[str] = None
    external_db_auth_key: Optional[str] = None
    smtp_server: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    # Advanced Job Constraints
    target_roles: Optional[str] = "Software Engineer, Full Stack Developer"
    target_locations: Optional[str] = "Remote, USA"
    daily_apply_limit: Optional[int] = 10
    scrape_frequency_hours: Optional[int] = 24
    use_gmail_for_send: Optional[bool] = False
    cold_mail_automation_enabled: Optional[bool] = False
    auto_apply_enabled: Optional[bool] = False
    # Intentionally excluding smtp_password from the Base to avoid accidental exposure

class UserSettingCreate(UserSettingBase):
    smtp_password: Optional[str] = None

class UserSettingUpdate(UserSettingBase):
    smtp_password: Optional[str] = None

class UserSettingRead(UserSettingBase):
    id: int
    user_id: int
    
    model_config = ConfigDict(from_attributes=True)
