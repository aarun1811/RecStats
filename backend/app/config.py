from __future__ import annotations

import os

from pydantic import SecretStr
from pydantic_settings import BaseSettings


# Resolve the env file path at import time so the settings module knows where
# to read from. Honors `RECVIZ_CONFIG_PATH` (set by systemd in prod / UAT to
# point at an external `recviz-{env}.env` file outside the cloned repo).
# Falls back to `.env` in the current working directory for local dev.
_ENV_FILE = os.environ.get("RECVIZ_CONFIG_PATH", ".env")


class Settings(BaseSettings):
    recviz_db_url: str  # No default -- REQUIRED. Example: oracle+oracledb://recviz:recviz_dev@localhost:1521/FREEPDB1
    oracle_client_lib_dir: str  # No default -- REQUIRED. Path to Oracle Instant Client.
    recviz_encryption_key: SecretStr  # No default -- REQUIRED. Fernet key for DB credential encryption.
    recviz_embed_frame_ancestors: str = "http://localhost:5173"

    model_config = {"env_file": _ENV_FILE, "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
