import os

SECRET_KEY = os.environ.get("SECRET_KEY", "recviz-dev-secret-key-change-in-prod")

# PostgreSQL in Docker for metadata (swap to Oracle in prod — just change this URI)
SQLALCHEMY_DATABASE_URI = "postgresql://recviz:recviz_dev@localhost:5432/superset_meta"

# Redis cache — query results + filter cache
CACHE_CONFIG = {
    "CACHE_TYPE": "redis",
    "CACHE_DEFAULT_TIMEOUT": 300,
    "CACHE_KEY_PREFIX": "recviz_",
    "CACHE_REDIS_URL": "redis://localhost:6379/0",
}
DATA_CACHE_CONFIG = {
    "CACHE_TYPE": "redis",
    "CACHE_DEFAULT_TIMEOUT": 600,
    "CACHE_KEY_PREFIX": "recviz_data_",
    "CACHE_REDIS_URL": "redis://localhost:6379/1",
}

FILTER_STATE_CACHE_CONFIG = {
    "CACHE_TYPE": "redis",
    "CACHE_DEFAULT_TIMEOUT": 600,
    "CACHE_KEY_PREFIX": "recviz_filter_",
    "CACHE_REDIS_URL": "redis://localhost:6379/1",
}

FEATURE_FLAGS = {"ENABLE_TEMPLATE_PROCESSING": True}

# CORS — allow frontend and FastAPI sidecar
ENABLE_CORS = True
CORS_OPTIONS = {
    "supports_credentials": True,
    "allow_headers": ["*"],
    "resources": ["/api/*"],
    "origins": ["http://localhost:5173", "http://localhost:8000"],
}


# Celery for async queries
class CeleryConfig:
    broker_url = "redis://localhost:6379/2"
    result_backend = "redis://localhost:6379/3"


CELERY_CONFIG = CeleryConfig

# Results backend for SQL Lab (required for sync queries)
from cachelib.redis import RedisCache
RESULTS_BACKEND = RedisCache(host="localhost", port=6379, db=4, key_prefix="recviz_results_")

# Prevent Superset from showing its own frontend chrome
ENABLE_JAVASCRIPT_CONTROLS = False
