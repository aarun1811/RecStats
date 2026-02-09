"""Application configuration using Pydantic Settings."""

from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Application
    app_name: str = "ResStats"
    app_version: str = "0.1.0"
    debug: bool = True

    # Database
    database_url: str = "sqlite+aiosqlite:///./resstats.db"

    # CORS
    cors_origins: list[str] = ["http://localhost:4200", "http://127.0.0.1:4200"]

    # File uploads
    upload_dir: str = "./uploads"
    max_upload_size_mb: int = 50

    # Oracle connection (optional)
    oracle_host: Optional[str] = None
    oracle_port: int = 1521
    oracle_service_name: Optional[str] = None
    oracle_user: Optional[str] = None
    oracle_password: Optional[str] = None

    # Hive connection (optional)
    hive_host: Optional[str] = None
    hive_port: int = 10000
    hive_database: str = "default"
    hive_user: Optional[str] = None
    hive_password: Optional[str] = None

    # ag-grid license (for frontend, stored here for API if needed)
    ag_grid_license_key: Optional[str] = None


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
