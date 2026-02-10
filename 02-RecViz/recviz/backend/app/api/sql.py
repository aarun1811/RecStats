import logging
import time
import uuid

from fastapi import APIRouter, Depends

from app.core.dependencies import get_superset_client
from app.core.exceptions import SupersetError
from app.mock.data import MOCK_DATABASES
from app.models.sql import (
    DatabaseListResponse,
    SqlColumnInfo,
    SqlExecuteRequest,
    SqlExecuteResponse,
    SqlQueryMeta,
)
from app.services.superset_client import SupersetClient

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/execute")
async def execute_sql(
    body: SqlExecuteRequest,
    superset: SupersetClient | None = Depends(get_superset_client),
) -> dict:
    """Execute ad-hoc SQL via Superset SQLLab."""
    if superset is not None:
        try:
            start = time.monotonic()
            result = await superset.execute_sql(
                database_id=body.database_id,
                sql=body.sql,
                limit=body.limit,
            )
            elapsed = time.monotonic() - start
            cols = result.get("columns", [])
            data = result.get("data", [])
            response = SqlExecuteResponse(
                data=data,
                columns=[SqlColumnInfo(name=c, type="VARCHAR") for c in cols],
                query=SqlQueryMeta(execution_time=round(elapsed * 1000, 1), row_count=len(data)),
            )
            return response.model_dump(by_alias=True)
        except (SupersetError, NotImplementedError):
            logger.info("Superset unavailable, returning mock SQL result")
    mock_data = [
        {"mock_col1": "value1", "mock_col2": 100},
        {"mock_col1": "value2", "mock_col2": 200},
    ]
    response = SqlExecuteResponse(
        data=mock_data,
        columns=[
            SqlColumnInfo(name="mock_col1", type="VARCHAR"),
            SqlColumnInfo(name="mock_col2", type="INTEGER"),
        ],
        query=SqlQueryMeta(execution_time=12.5, row_count=len(mock_data)),
    )
    return response.model_dump(by_alias=True)


@router.get("/databases", response_model=DatabaseListResponse)
async def list_databases(
    superset: SupersetClient | None = Depends(get_superset_client),
) -> DatabaseListResponse:
    """List available databases for SQL execution."""
    if superset is not None:
        try:
            result = await superset.list_databases()
            databases = [d for d in result]
            return DatabaseListResponse(databases=databases, count=len(databases))
        except (SupersetError, NotImplementedError):
            logger.info("Superset unavailable, returning mock databases")
    return DatabaseListResponse(databases=MOCK_DATABASES, count=len(MOCK_DATABASES))
