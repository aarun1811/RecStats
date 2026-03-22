import os

SECRET_KEY = os.environ.get("SUPERSET_SECRET_KEY", "recviz-dev-secret-key-change-in-prod")

SQLALCHEMY_DATABASE_URI = os.environ.get(
    "SUPERSET_METADATA_DB",
    "postgresql://recviz:recviz_dev@postgres:5432/superset_meta",
)

CACHE_CONFIG = {
    "CACHE_TYPE": "redis",
    "CACHE_DEFAULT_TIMEOUT": 300,
    "CACHE_KEY_PREFIX": "recviz_",
    "CACHE_REDIS_URL": os.environ.get("REDIS_URL", "redis://redis:6379/0"),
}

DATA_CACHE_CONFIG = {
    "CACHE_TYPE": "redis",
    "CACHE_DEFAULT_TIMEOUT": 600,
    "CACHE_KEY_PREFIX": "recviz_data_",
    "CACHE_REDIS_URL": os.environ.get("REDIS_URL", "redis://redis:6379/1"),
}

FEATURE_FLAGS = {
    "ENABLE_TEMPLATE_PROCESSING": True,
}


class CeleryConfig:
    broker_url = os.environ.get("REDIS_URL", "redis://redis:6379/2")
    result_backend = os.environ.get("REDIS_URL", "redis://redis:6379/3")


CELERY_CONFIG = CeleryConfig

ENABLE_CORS = True
CORS_OPTIONS = {
    "supports_credentials": True,
    "allow_headers": ["*"],
    "resources": ["/api/*"],
    "origins": ["http://localhost:5173", "http://localhost:80"],
}
