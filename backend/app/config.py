from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    superset_url: str = "http://localhost:8088"
    superset_username: str = "admin"
    superset_password: str = "admin"
    redis_url: str = "redis://localhost:6379/0"
    recon_db_url: str = "postgresql://recviz:recviz_dev@localhost:5432/recon_data"
    recviz_db_url: str = "postgresql+asyncpg://recviz:recviz_dev@localhost:5432/superset_meta"
    databases_config_path: str = str(
        Path(__file__).parent / "config" / "databases.json"
    )
    recviz_encryption_key: SecretStr  # No default -- MUST be set via RECVIZ_ENCRYPTION_KEY env var

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
