import logging
import uuid

from fastapi import APIRouter, Depends

from app.core.dependencies import get_superset_client
from app.core.exceptions import SupersetError
from app.mock.data import MOCK_DATABASES
from app.models.sql import (
    DatabaseListResponse,
    SqlExecuteRequest,
    SqlExecuteResponse,
)
from app.services.superset_client import SupersetClient

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/execute", response_model=SqlExecuteResponse)
async def execute_sql(
    body: SqlExecuteRequest,
    superset: SupersetClient = Depends(get_superset_client),
) -> SqlExecuteResponse:
    """Execute ad-hoc SQL via Superset SQLLab."""
    try:
        result = await superset.execute_sql(
            database_id=body.database_id,
            sql=body.sql,
            limit=body.limit,
        )
        return SqlExecuteResponse(
            columns=result.get("columns", []),
            data=result.get("data", []),
            row_count=len(result.get("data", [])),
            query_id=result.get("query_id"),
        )
    except (SupersetError, NotImplementedError):
        logger.info("Superset unavailable, returning mock SQL result")
        return SqlExecuteResponse(
            columns=["mock_col1", "mock_col2"],
            data=[
                {"mock_col1": "value1", "mock_col2": 100},
                {"mock_col1": "value2", "mock_col2": 200},
            ],
            row_count=2,
            query_id=str(uuid.uuid4()),
        )


@router.get("/databases", response_model=DatabaseListResponse)
async def list_databases(
    superset: SupersetClient = Depends(get_superset_client),
) -> DatabaseListResponse:
    """List available databases for SQL execution."""
    try:
        result = await superset.list_databases()
        databases = [d for d in result]
        return DatabaseListResponse(databases=databases, count=len(databases))
    except (SupersetError, NotImplementedError):
        logger.info("Superset unavailable, returning mock databases")
        return DatabaseListResponse(databases=MOCK_DATABASES, count=len(MOCK_DATABASES))
