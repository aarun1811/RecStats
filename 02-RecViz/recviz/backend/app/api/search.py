import logging

from fastapi import APIRouter, Depends

from app.core.dependencies import get_elasticsearch_service
from app.core.exceptions import SidecarError
from app.models.search import SearchHit, SearchRequest, SearchResponse
from app.services.elasticsearch import ElasticsearchService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("", response_model=SearchResponse)
async def search(
    body: SearchRequest,
    es: ElasticsearchService = Depends(get_elasticsearch_service),
) -> SearchResponse:
    """Full-text search across Elasticsearch indices."""
    try:
        result = await es.search(
            query=body.query,
            indices=body.indices,
            limit=body.limit,
        )
        hits = [
            SearchHit(
                index=h["index"],
                id=h["id"],
                score=h["score"],
                source=h["source"],
            )
            for h in result.get("hits", [])
        ]
        return SearchResponse(
            hits=hits,
            total=result.get("total", 0),
            took_ms=0,
        )
    except Exception as exc:
        logger.warning("Elasticsearch search failed: %s", exc)
        raise SidecarError(detail=f"Search failed: {exc}") from exc
