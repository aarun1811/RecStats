import os

SECRET_KEY = "recviz-local-dev-key"

# SQLite for metadata — persists across restarts
SQLALCHEMY_DATABASE_URI = (
    "sqlite:///" + os.path.expanduser("~/.superset/superset_local.db")
)

# In-memory cache — no Redis needed
CACHE_CONFIG = {"CACHE_TYPE": "SimpleCache", "CACHE_DEFAULT_TIMEOUT": 300}
DATA_CACHE_CONFIG = {"CACHE_TYPE": "SimpleCache", "CACHE_DEFAULT_TIMEOUT": 600}
FILTER_STATE_CACHE_CONFIG = {
    "CACHE_TYPE": "SimpleCache",
    "CACHE_DEFAULT_TIMEOUT": 600,
}

# No Celery — synchronous queries only
class CeleryConfig:
    pass


CELERY_CONFIG = CeleryConfig

# Results backend for SQL Lab (local file-based)
from cachelib.file import FileSystemCache

RESULTS_BACKEND = FileSystemCache(
    os.path.expanduser("~/.superset/sqllab_results"), default_timeout=600
)

FEATURE_FLAGS = {"ENABLE_TEMPLATE_PROCESSING": True}

# Allow SQLite as a data source (blocked by default for security)
# Safe for local dev only — never enable in production
PREVENT_UNSAFE_DB_CONNECTIONS = False

# CORS
ENABLE_CORS = True
CORS_OPTIONS = {
    "supports_credentials": True,
    "allow_headers": ["*"],
    "resources": ["/api/*"],
    "origins": ["http://localhost:5173", "http://localhost:8000"],
}

# Suppress browser warnings
TALISMAN_ENABLED = False
WTF_CSRF_ENABLED = False
