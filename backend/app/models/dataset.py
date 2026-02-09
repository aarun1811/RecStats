from typing import Any

from pydantic import BaseModel

from app.models.filters import GlobalFilters


class DatasetColumn(BaseModel):
    name: str
    type: str
    is_filterable: bool = True
    is_groupable: bool = True


class DatasetResponse(BaseModel):
    id: int
    name: str
    database: str
    schema_name: str
    table_name: str
    columns: list[DatasetColumn]


class DatasetListResponse(BaseModel):
    datasets: list[DatasetResponse]
    count: int


class DatasetDataRequest(BaseModel):
    filters: GlobalFilters = GlobalFilters()
    order_by: list[dict[str, Any]] = []
    offset: int = 0
    limit: int = 500


class DatasetDataResponse(BaseModel):
    data: list[dict[str, Any]]
    columns: list[str]
    row_count: int
    next_offset: int | None = None
