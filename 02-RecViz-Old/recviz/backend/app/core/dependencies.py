"""FastAPI dependency injection providers for all services."""

from __future__ import annotations

import logging

from fastapi import Request

from app.core.exceptions import SupersetError
from app.services.aggregation_service import AggregationService
from app.services.cache import CacheService
from app.services.elasticsearch import ElasticsearchService
from app.services.export_service import ExportService
from app.services.superset_client import SupersetClient

logger = logging.getLogger(__name__)


async def get_superset_client(request: Request) -> SupersetClient | None:
    """Provide an authenticated Superset client, or None if Superset is unavailable."""
    http_client = request.app.state.superset_http
    client = SupersetClient(http_client)
    try:
        await client.ensure_authenticated()
        return client
    except (SupersetError, Exception):
        logger.warning("Superset unavailable — routes will use mock data")
        return None


async def get_elasticsearch_service(request: Request) -> ElasticsearchService:
    """Provide the shared Elasticsearch service."""
    return request.app.state.elasticsearch


async def get_export_service(request: Request) -> ExportService:
    """Provide an ExportService backed by the Superset client."""
    superset_client = await get_superset_client(request)
    return ExportService(superset_client)


async def get_aggregation_service(request: Request) -> AggregationService:
    """Provide an AggregationService backed by the Superset client."""
    superset_client = await get_superset_client(request)
    return AggregationService(superset_client)


async def get_cache_service(request: Request) -> CacheService:
    """Provide the shared cache service."""
    return request.app.state.cache
