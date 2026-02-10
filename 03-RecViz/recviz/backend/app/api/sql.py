from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter

from app.core.dependencies import SupersetDep
from app.mock_data import MOCK_DATABASES
from app.models.base import CamelModel

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

    if superset:
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
        except Exception as e:
            record["status"] = "error"
            record["error"] = str(e)
            _query_history.insert(0, record)
            return {"status": "error", "error": str(e), "columns": [], "data": []}

    record["status"] = "error"
    record["error"] = "Superset unavailable"
    _query_history.insert(0, record)
    return {"status": "error", "error": "Superset unavailable", "columns": [], "data": []}


@router.get("/history")
async def get_history():
    return _query_history[:50]


@router.get("/databases")
async def list_databases(superset: SupersetDep):
    if superset:
        try:
            raw = await superset.list_databases()
            return [
                {"id": db.get("id"), "database_name": db.get("database_name", ""), "backend": db.get("backend", "")}
                for db in raw
            ]
        except Exception:
            pass
    return MOCK_DATABASES
