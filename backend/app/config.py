from __future__ import annotations

from pydantic import SecretStr
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    recviz_db_url: str  # No default -- REQUIRED. Example: oracle+oracledb://recviz:recviz_dev@localhost:1521/FREEPDB1
    oracle_client_lib_dir: str  # No default -- REQUIRED. Path to Oracle Instant Client.
    recviz_encryption_key: SecretStr  # No default -- REQUIRED. Fernet key for DB credential encryption.

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
