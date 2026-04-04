from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.core.dependencies import QueryEngineDep
from app.services.merge_engine import MergeEngine

router = APIRouter(prefix="/api/data-sources", tags=["data-sources"])


class QueryRequest(BaseModel):
    filters: dict[str, str | int | list[str] | None] = {}


class MergeRequest(BaseModel):
    sources: list[str]
    merge_on: list[str]
    merge_type: str = "outer_join"
    filters: dict[str, str | int | list[str] | None] = {}


@router.post("/{data_source_id}/query")
async def query_data_source(
    data_source_id: str,
    body: QueryRequest,
    query_engine: QueryEngineDep,
):
    try:
        result = await query_engine.execute(data_source_id, body.filters)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return result


@router.post("/merge")
async def merge_data_sources(
    body: MergeRequest,
    query_engine: QueryEngineDep,
):
    results = []
    for source_id in body.sources:
        try:
            result = await query_engine.execute(source_id, body.filters)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        results.append(result)

    try:
        merged = MergeEngine.merge(results, body.merge_on, body.merge_type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return merged


@router.get("/{data_source_id}/distinct/{column}")
async def get_distinct_values(
    data_source_id: str,
    column: str,
    request: Request,
    query_engine: QueryEngineDep,
):
    # Parse filter.* query params
    filters = {}
    for key, val in request.query_params.items():
        if key.startswith("filter."):
            filter_id = key.replace("filter.", "")
            filters[filter_id] = val

    try:
        values = await query_engine.execute_distinct(data_source_id, column, filters)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {"values": values}
