"""SQL Explorer API endpoints -- direct engine execution with read-only enforcement.

Provides:
- POST /api/sql/execute: Execute read-only SQL via EngineManager
- GET /api/sql/databases: List connections from recviz_connections table
- GET /api/sql/history: Return recent query history
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException
from sqlalchemy import select, text

from app.core.dependencies import DbSessionDep, EngineManagerDep
from app.core.errors import sanitize_detail
from app.models.base import CamelModel
from app.services.query_utils import (
    build_result_response,
    validate_read_only,
    wrap_with_pagination,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sql", tags=["sql"])

# In-memory query history (simple for now).
# NOTE: In-memory history -- only valid for single-worker uvicorn.
# For multi-worker, migrate to Redis or database storage.
_MAX_HISTORY = 200
_query_history: list[dict] = []


def _record_history(record: dict) -> None:
    """Insert a history record and prune to bounded size."""
    _query_history.insert(0, record)
    if len(_query_history) > _MAX_HISTORY:
        del _query_history[_MAX_HISTORY:]


class SqlRequest(CamelModel):
    sql: str
    database_id: str = ""  # Connection UUID or name (changed from int for direct engine)
    schema: str = "public"
    limit: int = 1000


@router.post("/execute")
async def execute_sql(
    body: SqlRequest,
    engine_manager: EngineManagerDep,
    session: DbSessionDep,
):
    record = {
        "sql": body.sql,
        "database_id": body.database_id,
        "executed_at": datetime.now().isoformat(),
        "status": "pending",
        "rows": 0,
    }

    # 1. Read-only enforcement (QENG-04 / Threat T-13-08)
    if not validate_read_only(body.sql):
        record["status"] = "error"
        record["error"] = "Read-only violation: only SELECT and WITH statements are allowed"
        _record_history(record)
        raise HTTPException(
            status_code=400,
            detail={
                "error": "read_only_violation",
                "message": "Only SELECT and WITH statements are allowed in SQL Explorer",
                "detail": None,
            },
        )

    # 2. Look up connection record
    from app.db.models.connection import RecvizConnection

    result = await session.execute(
        select(RecvizConnection).where(RecvizConnection.id == body.database_id)
    )
    conn_record = result.scalar_one_or_none()
    if conn_record is None:
        record["status"] = "error"
        record["error"] = f"Database connection '{body.database_id}' not found"
        _record_history(record)
        raise HTTPException(
            status_code=404,
            detail={
                "error": "database_not_found",
                "message": f"Database connection '{body.database_id}' not found",
                "detail": None,
            },
        )

    # 3. Wrap SQL with dialect-aware pagination
    paginated_sql = wrap_with_pagination(
        body.sql,
        limit=body.limit,
        offset=0,
        dialect=conn_record.backend,
    )

    # 4. Execute directly via engine (Threat T-13-09: 60s timeout)
    try:
        engine = await engine_manager.get_engine_for_connection(conn_record)
        async with engine.connect() as conn:
            db_result = await asyncio.wait_for(
                conn.execute(text(paginated_sql)),
                timeout=60.0,  # 60s for SQL Explorer (longer than dashboard 30s)
            )
            cursor_desc = db_result.cursor.description or []
            column_descriptions = [
                (col[0], col[1])
                for col in cursor_desc
            ]
            rows = db_result.fetchall()

        # Use build_result_response for consistent column normalization + typing
        shaped = build_result_response(column_descriptions, rows, max_rows=body.limit)

        record["status"] = "success"
        record["rows"] = shaped["row_count"]
        _record_history(record)

        # SQL Explorer response uses "data" key (not "rows") and adds "status"
        return {
            "status": "success",
            "columns": shaped["columns"],
            "data": shaped["rows"],  # "data" not "rows" for SQL Explorer
            "row_count": shaped["row_count"],
        }

    except asyncio.TimeoutError:
        logger.warning("SQL query timed out after 60s")
        record["status"] = "error"
        record["error"] = "Query timed out"
        _record_history(record)
        raise HTTPException(
            status_code=504,
            detail={
                "error": "query_timeout",
                "message": "Query timed out after 60 seconds",
                "detail": None,
            },
        )
    except Exception as e:
        logger.exception("Error during SQL execution")
        record["status"] = "error"
        record["error"] = str(e)[:200]
        _record_history(record)
        raise HTTPException(
            status_code=500,
            detail={
                "error": "query_error",
                "message": "Query execution failed",
                "detail": sanitize_detail(e),
            },
        )


@router.get("/databases")
async def list_databases(session: DbSessionDep):
    from app.db.models.connection import RecvizConnection

    result = await session.execute(
        select(
            RecvizConnection.id,
            RecvizConnection.name,
            RecvizConnection.display_name,
            RecvizConnection.backend,
        )
    )
    rows = result.all()
    return [
        {
            "id": row.id,
            "database_name": row.name,
            "display_name": row.display_name,
            "backend": row.backend,
        }
        for row in rows
    ]


@router.get("/history")
async def get_history():
    return _query_history[:50]
