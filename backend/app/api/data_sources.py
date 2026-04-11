from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.core.dependencies import (
    ConfigStoreDep,
    DbSessionDep,
    QueryEngineDep,
    ResolvedDataSourceDep,
)
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
def query_data_source(
    ds_config: ResolvedDataSourceDep,
    body: QueryRequest,
    query_engine: QueryEngineDep,
    session: DbSessionDep,
):
    try:
        result = query_engine.execute(ds_config, body.filters, session=session)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return result


@router.post("/merge")
def merge_data_sources(
    body: MergeRequest,
    config_store: ConfigStoreDep,
    query_engine: QueryEngineDep,
    session: DbSessionDep,
):
    results = []
    for source_id in body.sources:
        ds_config = config_store.get_data_source(source_id)
        if ds_config is None:
            raise HTTPException(
                status_code=404, detail=f"Data source '{source_id}' not found"
            )
        try:
            result = query_engine.execute(ds_config, body.filters, session=session)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        results.append(result)

    try:
        merged = MergeEngine.merge(results, body.merge_on, body.merge_type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return merged


@router.get("/{data_source_id}/distinct/{column}")
def get_distinct_values(
    ds_config: ResolvedDataSourceDep,
    column: str,
    request: Request,
    query_engine: QueryEngineDep,
    session: DbSessionDep,
):
    # Parse filter.* query params
    filters = {}
    for key, val in request.query_params.items():
        if key.startswith("filter."):
            filter_id = key.replace("filter.", "")
            filters[filter_id] = val

    try:
        values = query_engine.execute_distinct(
            ds_config, column, filters, session=session
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {"values": values}
