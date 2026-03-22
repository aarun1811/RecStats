import os

SECRET_KEY = os.environ.get("SECRET_KEY", "recviz-dev-secret-key-change-in-prod")

# Resolve hosts — Docker uses service names, local dev uses localhost
_pg_host = os.environ.get("POSTGRES_HOST", "localhost")
_redis_host = os.environ.get("REDIS_HOST", "localhost")

# PostgreSQL for metadata (swap to Oracle in prod — just change this URI)
SQLALCHEMY_DATABASE_URI = f"postgresql://recviz:recviz_dev@{_pg_host}:5432/superset_meta"

# Redis cache — query results + filter cache
CACHE_CONFIG = {
    "CACHE_TYPE": "redis",
    "CACHE_DEFAULT_TIMEOUT": 300,
    "CACHE_KEY_PREFIX": "recviz_",
    "CACHE_REDIS_URL": f"redis://{_redis_host}:6379/0",
}
DATA_CACHE_CONFIG = {
    "CACHE_TYPE": "redis",
    "CACHE_DEFAULT_TIMEOUT": 600,
    "CACHE_KEY_PREFIX": "recviz_data_",
    "CACHE_REDIS_URL": f"redis://{_redis_host}:6379/1",
}

FILTER_STATE_CACHE_CONFIG = {
    "CACHE_TYPE": "redis",
    "CACHE_DEFAULT_TIMEOUT": 600,
    "CACHE_KEY_PREFIX": "recviz_filter_",
    "CACHE_REDIS_URL": f"redis://{_redis_host}:6379/1",
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
    broker_url = f"redis://{_redis_host}:6379/2"
    result_backend = f"redis://{_redis_host}:6379/3"


CELERY_CONFIG = CeleryConfig

# Results backend for SQL Lab (required for sync queries)
from cachelib.redis import RedisCache
RESULTS_BACKEND = RedisCache(host=_redis_host, port=6379, db=4, key_prefix="recviz_results_")

# Prevent Superset from showing its own frontend chrome
ENABLE_JAVASCRIPT_CONTROLS = False
