from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "JobHunt API"
    API_V1_STR: str = "/api/v1"
    
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
            # Clean up common copy-paste errors from dashboard (quotes, spaces)
            clean_url = self.DATABASE_URL.strip().strip("'").strip('"')
            # Ensure it uses the asyncpg driver
            if clean_url.startswith("postgresql://"):
                clean_url = clean_url.replace("postgresql://", "postgresql+asyncpg://", 1)
            elif clean_url.startswith("postgres://"):
                clean_url = clean_url.replace("postgres://", "postgresql+asyncpg://", 1)
            return clean_url
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
    
    # Redis Config
    REDIS_HOST: str = "127.0.0.1"
    REDIS_PORT: int = 6379

    # JWT Auth
    SECRET_KEY: str = "SUPER_SECRET_CHANGE_ME_IN_PROD"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8
    
    # Clerk (headless sync)
    CLERK_SECRET_KEY: str = ""
    
    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
