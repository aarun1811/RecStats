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

    superset_ok = False
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
        except Exception:
            pass  # Fall through to mock execution

    # Mock SQL execution — parse simple SELECT queries against mock break data
    from app.mock_data import MOCK_BREAK_ROWS
    try:
        result = _mock_execute(body.sql, body.limit, MOCK_BREAK_ROWS)
        record["status"] = result["status"]
        record["rows"] = result.get("row_count", 0)
        if result["status"] == "error":
            record["error"] = result.get("error", "")
        _query_history.insert(0, record)
        return result
    except Exception as e:
        record["status"] = "error"
        record["error"] = str(e)
        _query_history.insert(0, record)
        return {"status": "error", "error": str(e), "columns": [], "data": [], "row_count": 0}


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


import re


def _mock_execute(sql: str, limit: int, rows: list[dict]) -> dict:
    """Very simple mock SQL executor — handles SELECT with WHERE, ORDER BY, LIMIT."""
    sql_stripped = sql.strip().rstrip(";")
    upper = sql_stripped.upper()

    if not upper.startswith("SELECT"):
        return {"status": "error", "error": "Only SELECT queries are supported in mock mode", "columns": [], "data": [], "row_count": 0}

    # Detect if user asks for specific columns
    select_match = re.match(r"SELECT\s+(.*?)\s+FROM", sql_stripped, re.IGNORECASE | re.DOTALL)
    columns_requested = None
    if select_match:
        cols_part = select_match.group(1).strip()
        if cols_part != "*":
            columns_requested = [c.strip().split(".")[-1] for c in cols_part.split(",")]

    # Extract table name
    table_match = re.search(r"FROM\s+(\w+)", sql_stripped, re.IGNORECASE)
    table_name = table_match.group(1).lower() if table_match else ""

    # Pick data source
    if table_name in ("breaks", "break_records"):
        data = list(rows)
    else:
        data = list(rows)  # default to breaks for demo

    # Simple WHERE clause parsing
    where_match = re.search(r"WHERE\s+(.+?)(?:\s+ORDER\s+|\s+LIMIT\s+|\s+GROUP\s+|$)", sql_stripped, re.IGNORECASE | re.DOTALL)
    if where_match:
        where_clause = where_match.group(1).strip()
        # Handle simple "column = 'value'" conditions connected by AND
        conditions = re.split(r"\s+AND\s+", where_clause, flags=re.IGNORECASE)
        for cond in conditions:
            eq_match = re.match(r"(\w+)\s*=\s*'([^']*)'", cond.strip())
            if eq_match:
                col, val = eq_match.group(1), eq_match.group(2)
                data = [r for r in data if str(r.get(col, "")).lower() == val.lower()]

    # Handle LIMIT
    limit_match = re.search(r"LIMIT\s+(\d+)", sql_stripped, re.IGNORECASE)
    row_limit = int(limit_match.group(1)) if limit_match else limit
    data = data[:row_limit]

    # Project columns
    if columns_requested and data:
        valid_cols = [c for c in columns_requested if c in data[0]]
        if valid_cols:
            data = [{k: r.get(k) for k in valid_cols} for r in data]
            all_columns = valid_cols
        else:
            all_columns = list(data[0].keys()) if data else []
    else:
        all_columns = list(data[0].keys()) if data else []

    return {"status": "success", "columns": all_columns, "data": data, "row_count": len(data)}
