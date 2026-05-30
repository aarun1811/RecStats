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
    coalesce_zero: bool = False
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
        merged = MergeEngine.merge(
            results, body.merge_on, body.merge_type, body.coalesce_zero
        )
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
    # Parse filter.* query params. Multi-select cascade dependency: the
    # frontend uses `.append` for array filters, so a parent with 2+ selected
    # values arrives as repeated `filter.<key>=<value>` entries. Use
    # `multi_items()` to gather every entry, then collapse 1->string so
    # existing single-value paths (resolve_database, build_sql) are unchanged
    # while ≥2 entries flow through as a list (handled by the SQL builder).
    filters: dict[str, str | list[str]] = {}
    collected: dict[str, list[str]] = {}
    for key, val in request.query_params.multi_items():
        if key.startswith("filter."):
            filter_id = key.replace("filter.", "")
            collected.setdefault(filter_id, []).append(val)
    for filter_id, vals in collected.items():
        filters[filter_id] = vals[0] if len(vals) == 1 else vals

    try:
        values = query_engine.execute_distinct(
            ds_config, column, filters, session=session
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {"values": values}
