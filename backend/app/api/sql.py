from __future__ import annotations

import logging
from datetime import datetime

import httpx
from fastapi import APIRouter, HTTPException

from app.core.dependencies import SupersetDep
from app.core.errors import sanitize_detail
from app.models.base import CamelModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sql", tags=["sql"])

# In-memory query history (simple for now)
_query_history: list[dict] = []


class SqlRequest(CamelModel):
    sql: str
    database_id: int = 1
    schema: str = "public"
    limit: int = 1000


@router.post("/execute")
async def execute_sql(body: SqlRequest, superset: SupersetDep):
    record = {
        "sql": body.sql,
        "database_id": body.database_id,
        "executed_at": datetime.now().isoformat(),
        "status": "pending",
        "rows": 0,
    }

    if not superset:
        record["status"] = "error"
        record["error"] = "Query engine is not connected"
        _query_history.insert(0, record)
        raise HTTPException(
            status_code=503,
            detail={"error": "superset_unavailable", "message": "Query engine is not connected", "detail": None, "retry_after": 30},
        )

    try:
        result = await superset.execute_sql(
            database_id=body.database_id,
            sql=body.sql,
            schema=body.schema,
            limit=body.limit,
        )
        record["status"] = "success"
        record["rows"] = len(result.get("data", []))
        _query_history.insert(0, record)
        return {
            "status": "success",
            "columns": result.get("columns", []),
            "data": result.get("data", []),
            "row_count": len(result.get("data", [])),
        }
    except httpx.ConnectError as e:
        logger.warning("Superset connection failed during SQL execution: %s", e)
        record["status"] = "error"
        record["error"] = "Query engine unavailable"
        _query_history.insert(0, record)
        raise HTTPException(
            status_code=503,
            detail={"error": "superset_unavailable", "message": "Query engine is temporarily unavailable", "detail": sanitize_detail(e), "retry_after": 15},
        )
    except httpx.TimeoutException as e:
        logger.warning("SQL query timed out: %s", e)
        record["status"] = "error"
        record["error"] = "Query timed out"
        _query_history.insert(0, record)
        raise HTTPException(
            status_code=504,
            detail={"error": "query_timeout", "message": "Query timed out", "detail": sanitize_detail(e)},
        )
    except httpx.HTTPStatusError as e:
        logger.error("Superset returned error %s during SQL: %s", e.response.status_code, e)
        record["status"] = "error"
        record["error"] = f"Query engine error: {e.response.status_code}"
        _query_history.insert(0, record)
        raise HTTPException(
            status_code=502,
            detail={"error": "superset_error", "message": f"Query engine returned error: {e.response.status_code}", "detail": sanitize_detail(e)},
        )
    except Exception as e:
        logger.exception("Unexpected error during SQL execution")
        record["status"] = "error"
        record["error"] = "Unexpected error"
        _query_history.insert(0, record)
        raise HTTPException(
            status_code=500,
            detail={"error": "internal_error", "message": "An unexpected error occurred", "detail": sanitize_detail(e)},
        )


@router.get("/history")
async def get_history():
    return _query_history[:50]


@router.get("/databases")
async def list_databases(superset: SupersetDep):
    if not superset:
        raise HTTPException(
            status_code=503,
            detail={"error": "superset_unavailable", "message": "Query engine is not connected", "detail": None, "retry_after": 30},
        )
    try:
        raw = await superset.list_databases()
        return [
            {"id": db.get("id"), "database_name": db.get("database_name", ""), "backend": db.get("backend", "")}
            for db in raw
        ]
    except httpx.ConnectError as e:
        logger.warning("Superset connection failed: %s", e)
        raise HTTPException(
            status_code=503,
            detail={"error": "superset_unavailable", "message": "Query engine is temporarily unavailable", "detail": sanitize_detail(e), "retry_after": 15},
        )
    except httpx.TimeoutException as e:
        logger.warning("Superset query timed out: %s", e)
        raise HTTPException(
            status_code=504,
            detail={"error": "query_timeout", "message": "Query timed out", "detail": sanitize_detail(e)},
        )
    except httpx.HTTPStatusError as e:
        logger.error("Superset returned error %s: %s", e.response.status_code, e)
        raise HTTPException(
            status_code=502,
            detail={"error": "superset_error", "message": f"Query engine returned error: {e.response.status_code}", "detail": sanitize_detail(e)},
        )
    except Exception as e:
        logger.exception("Unexpected error listing databases")
        raise HTTPException(
            status_code=500,
            detail={"error": "internal_error", "message": "An unexpected error occurred", "detail": sanitize_detail(e)},
        )
