"""Elasticsearch service for full-text search and aggregations."""

from __future__ import annotations

import logging

from elasticsearch import AsyncElasticsearch, NotFoundError

logger = logging.getLogger(__name__)


class ElasticsearchService:
    """Async Elasticsearch client for recon data search and aggregations."""

    def __init__(self, es_url: str):
        self.client = AsyncElasticsearch(es_url)

    async def search(
        self,
        query: str,
        indices: list[str] | None = None,
        limit: int = 50,
    ) -> dict:
        """Full-text search across recon data.

        Uses multi_match with best_fields strategy.
        Returns hits with highlights.
        """
        index = ",".join(indices) if indices else "*"
        body: dict = {
            "query": {
                "multi_match": {
                    "query": query,
                    "type": "best_fields",
                    "fields": ["*"],
                    "fuzziness": "AUTO",
                },
            },
            "highlight": {
                "fields": {"*": {}},
                "pre_tags": ["<mark>"],
                "post_tags": ["</mark>"],
            },
            "size": limit,
        }
        result = await self.client.search(index=index, body=body)
        hits = result.get("hits", {})
        return {
            "total": hits.get("total", {}).get("value", 0),
            "hits": [
                {
                    "id": hit["_id"],
                    "index": hit["_index"],
                    "source": hit["_source"],
                    "score": hit["_score"],
                    "highlights": hit.get("highlight", {}),
                }
                for hit in hits.get("hits", [])
            ],
        }

    async def aggregate(self, index: str, agg_body: dict) -> dict:
        """Run custom aggregation query.

        Accepts raw ES aggregation DSL.
        Returns aggregation buckets.
        """
        body: dict = {
            "size": 0,
            "aggs": agg_body,
        }
        result = await self.client.search(index=index, body=body)
        return result.get("aggregations", {})

    async def get_indices(self) -> list[str]:
        """List available indices, excluding system indices."""
        try:
            indices = await self.client.cat.indices(format="json")
            return sorted(
                entry["index"]
                for entry in indices
                if not entry["index"].startswith(".")
            )
        except NotFoundError:
            return []

    async def close(self) -> None:
        """Close the ES client connection."""
        await self.client.close()
