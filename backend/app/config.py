"""
IRM - Incoming Raw Material
Application Configuration
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App
    APP_NAME: str = "IRM"
    APP_ENV: str = "development"
    APP_DEBUG: bool = True

    # Database (PostgreSQL)
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "irm"
    DB_USER: str = "irm"
    DB_PASSWORD: str = "irm_dev_2026"

    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379

    # JWT
    JWT_SECRET_KEY: str = "irm-dev-secret-key-2026"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # URLs
    BACKEND_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:3001"

    # Central IAM SSO & Break-Glass Configuration
    CIAM_BASE_URL: str = "http://localhost:8001"
    CIAM_CLIENT_ID: str = "irm-spoke-client"
    CIAM_CLIENT_SECRET: str = "sec_irm_oauth_secret_2026"
    CIAM_SSO_ENABLED: bool = True
    CIAM_AD_GATEWAY_URL: str = "http://192.168.12.11:3100" 

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    @property
    def database_url_sync(self) -> str:
        """Sync URL for Alembic migrations."""
        return (
            f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    model_config = {
        "env_file": (".env", "../.env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache
def get_settings() -> Settings:
    return Settings()
