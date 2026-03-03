from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "JobHunt API"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "production"  # "development" to enable /docs
    
    # Database
    DATABASE_URL: str | None = None
    POSTGRES_SERVER: str = "127.0.0.1"
    POSTGRES_PORT: str = "5433"
    POSTGRES_USER: str = "jobhunt"
    POSTGRES_PASSWORD: str = "jobhunt_password"
    POSTGRES_DB: str = "jobhunt_db"
    
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        if self.DATABASE_URL:
            clean_url = self.DATABASE_URL.strip().strip("'").strip('"')
            if clean_url.startswith("postgresql://"):
                clean_url = clean_url.replace("postgresql://", "postgresql+asyncpg://", 1)
            elif clean_url.startswith("postgres://"):
                clean_url = clean_url.replace("postgres://", "postgresql+asyncpg://", 1)
                
            if ":6543" in clean_url and "prepared_statement_cache_size=0" not in clean_url:
                separator = "&" if "?" in clean_url else "?"
                clean_url = f"{clean_url}{separator}prepared_statement_cache_size=0"
                
            return clean_url
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
    
    # Redis Config
    REDIS_HOST: str = "127.0.0.1"
    REDIS_PORT: int = 6379

    # JWT Auth
    SECRET_KEY: str = "SUPER_SECRET_CHANGE_ME_IN_PROD"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days (reduced from 30)
    
    # Encryption — used to encrypt API keys, tokens, and credentials at rest
    ENCRYPTION_KEY: str = ""
    
    # Clerk (headless sync)
    CLERK_SECRET_KEY: str = ""
    
    # OAuth sync shared secret — protects the /oauth-sync endpoint
    OAUTH_SYNC_SECRET: str = ""
    
    # System Transactional Email (for verification/reset emails — NOT user's personal SMTP)
    SYSTEM_SMTP_HOST: str = ""
    SYSTEM_SMTP_PORT: int = 587
    SYSTEM_SMTP_USER: str = ""
    SYSTEM_SMTP_PASSWORD: str = ""
    SYSTEM_FROM_EMAIL: str = "noreply@jobhunt.app"
    FRONTEND_URL: str = "http://localhost:3000"  # used for reset/verify email links
    
    # CORS
    BACKEND_CORS_ORIGINS: str | None = None
    
    def get_cors_origins(self) -> list[str]:
        """Parse CORS origins from env. Falls back to wildcard if not configured."""
        if self.BACKEND_CORS_ORIGINS:
            return [o.strip() for o in self.BACKEND_CORS_ORIGINS.split(",") if o.strip()]
        # Not configured — allow all origins (same as before hardening)
        # Set BACKEND_CORS_ORIGINS in .env to lock down, e.g.:
        # BACKEND_CORS_ORIGINS=https://job-hunt-ebon.vercel.app,http://localhost:3000
        return ["*"]
    
    # Paths
    @property
    def BASE_DIR(self):
        from pathlib import Path
        return Path(__file__).resolve().parent.parent.parent

    @property
    def UPLOAD_DIR(self):
        path = self.BASE_DIR / "app" / "uploads" / "resumes"
        path.mkdir(parents=True, exist_ok=True)
        return path

    # Google OAuth
    GOOGLE_CLIENT_ID: str | None = None
    GOOGLE_CLIENT_SECRET: str | None = None
    
    model_config = {
        "case_sensitive": True,
        "env_file": ".env",
        "extra": "ignore"
    }

settings = Settings()
