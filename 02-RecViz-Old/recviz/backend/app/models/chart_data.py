from typing import Any

from pydantic import BaseModel

from app.models.base import CamelModel
from app.models.filters import GlobalFilters


class ChartDataRequest(BaseModel):
    filters: Any = {}


class ChartDataResponse(CamelModel):
    """Matches frontend ChartDataResponse type."""

    data: list[dict[str, Any]]
    columns: list[str]
    row_count: int


class ChartDefinition(BaseModel):
    id: int
    name: str
    viz_type: str
    datasource_id: int
    description: str = ""
    params: dict[str, Any] = {}


class ChartListResponse(BaseModel):
    charts: list[ChartDefinition]
    count: int
