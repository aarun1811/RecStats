from typing import Any

from pydantic import BaseModel


class SearchRequest(BaseModel):
    query: str
    indices: list[str] | None = None
    limit: int = 50


class SearchHit(BaseModel):
    index: str
    id: str
    score: float
    source: dict[str, Any]


class SearchResponse(BaseModel):
    hits: list[SearchHit]
    total: int
    took_ms: int
