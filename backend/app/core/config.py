from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    DATABASE_URL: str = "sqlite:///openrep.db"
    REDIS_URL: str | None = None

settings = Settings()
