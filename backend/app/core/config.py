from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    DATABASE_URL: str = "sqlite:///openrep.db"
    REDIS_URL: str | None = None
    
    # Storage Provider: "local", "vercel_blob", or "s3"
    STORAGE_PROVIDER: str = "local"
    
    # Vercel Blob Configuration
    BLOB_READ_WRITE_TOKEN: str | None = None
    
    # S3 Storage Configuration
    S3_BUCKET_NAME: str | None = None
    AWS_ACCESS_KEY_ID: str | None = None
    AWS_SECRET_ACCESS_KEY: str | None = None
    AWS_REGION: str | None = "us-east-1"
    AWS_ENDPOINT_URL_S3: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
