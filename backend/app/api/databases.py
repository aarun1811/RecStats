"""Database (data source) CRUD routes."""

from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter, HTTPException
from starlette.requests import Request

from app.core.dependencies import SupersetDep
from app.core.errors import sanitize_detail
from app.models.database import (
    DatabaseCreate,
    DatabaseUpdate,
    TestConnectionRequest,
)
from app.services.connection_status import ConnectionStatusTracker
from app.services.uri_builder import build_sqlalchemy_uri

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/databases", tags=["databases"])


def _get_status_tracker(request: Request) -> ConnectionStatusTracker | None:
    return getattr(request.app.state, "connection_status", None)


def _resolve_uri(body: DatabaseCreate | DatabaseUpdate | TestConnectionRequest) -> str:
    """Build SQLAlchemy URI from either explicit URI or form fields."""
    if body.sqlalchemy_uri:
        return body.sqlalchemy_uri
    return build_sqlalchemy_uri(
        backend=body.backend,
        host=body.host,
        port=body.port,
        database=body.database,
        username=body.username,
        password=body.password,
        schema_name=getattr(body, "schema_name", None),
    )


def _superset_unavailable() -> HTTPException:
    return HTTPException(
        status_code=503,
        detail={"error": "superset_unavailable", "message": "Query engine is not connected", "detail": None, "retry_after": 30},
    )


def _handle_httpx_error(e: Exception, context: str) -> HTTPException:
    """Map httpx exceptions to appropriate HTTPExceptions."""
    if isinstance(e, httpx.ConnectError):
        logger.warning("Superset connection failed (%s): %s", context, e)
        return HTTPException(
            status_code=503,
            detail={"error": "superset_unavailable", "message": "Query engine is temporarily unavailable", "detail": sanitize_detail(e), "retry_after": 15},
        )
    if isinstance(e, httpx.TimeoutException):
        logger.warning("Superset timed out (%s): %s", context, e)
        return HTTPException(
            status_code=504,
            detail={"error": "query_timeout", "message": "Query timed out", "detail": sanitize_detail(e)},
        )
    if isinstance(e, httpx.HTTPStatusError):
        logger.error("Superset error %s (%s): %s", e.response.status_code, context, e)
        return HTTPException(
            status_code=502,
            detail={"error": "superset_error", "message": f"Query engine returned error: {e.response.status_code}", "detail": sanitize_detail(e)},
        )
    logger.exception("Unexpected error (%s)", context)
    return HTTPException(
        status_code=500,
        detail={"error": "internal_error", "message": "An unexpected error occurred", "detail": sanitize_detail(e)},
    )


@router.get("")
async def list_databases(superset: SupersetDep, request: Request) -> list[dict]:
    if not superset:
        raise _superset_unavailable()
    try:
        tracker = _get_status_tracker(request)
        raw = await superset.list_databases()
        results = []
        for db in raw:
            db_id = db.get("id")
            if tracker and db_id is not None:
                status_info = tracker.get_status(db_id)
            else:
                status_info = {"status": "untested", "last_tested": None}
            results.append(
                {
                    "id": db_id,
                    "database_name": db.get("database_name", ""),
                    "backend": db.get("backend", ""),
                    "created_on": db.get("created_on"),
                    "expose_in_sqllab": db.get("expose_in_sqllab", True),
                    "dataset_count": 0,
                    "status": status_info["status"],
                    "last_tested": status_info["last_tested"],
                }
            )
        return results
    except Exception as e:
        raise _handle_httpx_error(e, "list_databases")


@router.get("/{db_id}")
async def get_database(db_id: int, superset: SupersetDep, request: Request) -> dict:
    if not superset:
        raise _superset_unavailable()
    try:
        tracker = _get_status_tracker(request)
        raw = await superset.get_database(db_id)
        raw_id = raw.get("id", db_id)
        if tracker and raw_id is not None:
            status_info = tracker.get_status(raw_id)
        else:
            status_info = {"status": "untested", "last_tested": None}
        return {
            "id": raw_id,
            "database_name": raw.get("database_name", ""),
            "backend": raw.get("backend", ""),
            "created_on": raw.get("created_on"),
            "expose_in_sqllab": raw.get("expose_in_sqllab", True),
            "dataset_count": 0,
            "status": status_info["status"],
            "last_tested": status_info["last_tested"],
        }
    except Exception as e:
        raise _handle_httpx_error(e, f"get_database({db_id})")


@router.get("/{db_id}/datasets")
async def list_database_datasets(
    db_id: int,
    superset: SupersetDep,
    page: int = 1,
    page_size: int = 50,
) -> dict:
    """Return paginated datasets for a given database."""
    if not superset:
        raise _superset_unavailable()
    try:
        raw = await superset.list_datasets()
        db_datasets = [
            {
                "id": ds.get("id"),
                "table_name": ds.get("table_name", ""),
                "column_count": len(ds.get("columns", [])),
            }
            for ds in raw
            if ds.get("database", {}).get("id") == db_id
            or ds.get("database_id") == db_id
        ]
        total = len(db_datasets)
        start = (page - 1) * page_size
        end = start + page_size
        return {
            "datasets": db_datasets[start:end],
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    except Exception as e:
        raise _handle_httpx_error(e, f"list_database_datasets({db_id})")


@router.post("")
async def create_database(body: DatabaseCreate, superset: SupersetDep) -> dict:
    if not superset:
        raise _superset_unavailable()
    try:
        uri = _resolve_uri(body)
        payload = {
            "database_name": body.database_name,
            "sqlalchemy_uri": uri,
            "expose_in_sqllab": True,
        }
        result = await superset.create_database(payload)
        created = result.get("result", result)
        return {
            "id": created.get("id"),
            "database_name": created.get("database_name", body.database_name),
            "backend": body.backend,
            "created_on": created.get("created_on"),
            "expose_in_sqllab": True,
            "dataset_count": 0,
            "status": "untested",
        }
    except Exception as e:
        raise _handle_httpx_error(e, "create_database")


@router.put("/{db_id}")
async def update_database(db_id: int, body: DatabaseUpdate, superset: SupersetDep, request: Request) -> dict:
    if not superset:
        raise _superset_unavailable()
    try:
        tracker = _get_status_tracker(request)
        payload: dict = {}
        if body.database_name:
            payload["database_name"] = body.database_name
        if body.sqlalchemy_uri or body.host:
            payload["sqlalchemy_uri"] = _resolve_uri(body)
        result = await superset.update_database(db_id, payload)
        updated = result.get("result", result)
        updated_id = updated.get("id", db_id)
        if tracker and updated_id is not None:
            status_info = tracker.get_status(updated_id)
        else:
            status_info = {"status": "untested", "last_tested": None}
        return {
            "id": updated_id,
            "database_name": updated.get("database_name", ""),
            "backend": updated.get("backend", ""),
            "created_on": updated.get("created_on"),
            "expose_in_sqllab": updated.get("expose_in_sqllab", True),
            "dataset_count": 0,
            "status": status_info["status"],
            "last_tested": status_info["last_tested"],
        }
    except Exception as e:
        raise _handle_httpx_error(e, f"update_database({db_id})")


@router.delete("/{db_id}")
async def delete_database(db_id: int, superset: SupersetDep) -> dict:
    if not superset:
        raise _superset_unavailable()
    try:
        await superset.delete_database(db_id)
        return {"success": True}
    except Exception as e:
        raise _handle_httpx_error(e, f"delete_database({db_id})")


@router.post("/test")
async def test_connection(body: TestConnectionRequest, superset: SupersetDep, request: Request) -> dict:
    if not superset:
        raise _superset_unavailable()
    tracker = _get_status_tracker(request)
    try:
        uri = _resolve_uri(body)
        await superset.test_connection({"sqlalchemy_uri": uri})
        if tracker and body.database_id is not None:
            tracker.mark_connected(body.database_id)
        return {"success": True, "message": "Connection successful"}
    except httpx.HTTPStatusError as e:
        logger.warning("Connection test failed: %s", e)
        if tracker and body.database_id is not None:
            tracker.mark_unreachable(body.database_id)
        return {"success": False, "message": f"Connection failed: {sanitize_detail(e)}"}
    except Exception as e:
        logger.warning("Connection test error: %s", e)
        if tracker and body.database_id is not None:
            tracker.mark_unreachable(body.database_id)
        return {"success": False, "message": f"Connection error: {sanitize_detail(e)}"}


@router.post("/{db_id}/sync")
async def sync_datasets(db_id: int, superset: SupersetDep) -> dict:
    """Trigger a dataset refresh for the given database."""
    if not superset:
        raise _superset_unavailable()
    try:
        raw = await superset.list_datasets()
        count = sum(
            1
            for ds in raw
            if ds.get("database", {}).get("id") == db_id
            or ds.get("database_id") == db_id
        )
        return {"success": True, "dataset_count": count}
    except Exception as e:
        raise _handle_httpx_error(e, f"sync_datasets({db_id})")
