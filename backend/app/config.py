from pydantic import SecretStr
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    recon_db_url: str = "postgresql://recviz:recviz_dev@localhost:5432/recon_data"
    recviz_db_url: str = "postgresql+asyncpg://recviz:recviz_dev@localhost:5432/superset_meta"
    recviz_encryption_key: SecretStr  # No default -- MUST be set via RECVIZ_ENCRYPTION_KEY env var

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
