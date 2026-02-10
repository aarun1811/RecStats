import logging

from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencies import get_superset_client
from app.core.exceptions import SupersetError
from app.mock.data import MOCK_CHART_DATA, MOCK_CHARTS
from app.models.chart_data import (
    ChartDataRequest,
    ChartDataResponse,
    ChartDefinition,
    ChartListResponse,
)
from app.models.filters import GlobalFilters
from app.services.filter_converter import to_superset_filters
from app.services.superset_client import SupersetClient

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=ChartListResponse)
async def list_charts(
    superset: SupersetClient | None = Depends(get_superset_client),
) -> ChartListResponse:
    """List all available charts."""
    if superset is not None:
        try:
            result = await superset.list_charts()
            charts = [ChartDefinition(**c) for c in result]
            return ChartListResponse(charts=charts, count=len(charts))
        except (SupersetError, NotImplementedError):
            logger.info("Superset unavailable, returning mock charts")
    return ChartListResponse(charts=MOCK_CHARTS, count=len(MOCK_CHARTS))


@router.get("/{chart_id}", response_model=ChartDefinition)
async def get_chart(
    chart_id: str,
    superset: SupersetClient | None = Depends(get_superset_client),
) -> ChartDefinition:
    """Get chart definition by ID."""
    if superset is not None:
        try:
            result = await superset.get_chart(int(chart_id))
            return ChartDefinition(**result)
        except (SupersetError, NotImplementedError, ValueError):
            logger.info("Superset unavailable, returning mock chart %s", chart_id)
    for chart in MOCK_CHARTS:
        if str(chart.id) == chart_id:
            return chart
    raise HTTPException(status_code=404, detail=f"Chart {chart_id} not found")


@router.post("/{chart_id}/data")
async def get_chart_data(
    chart_id: str,
    body: ChartDataRequest,
    superset: SupersetClient | None = Depends(get_superset_client),
) -> dict:
    """Fetch chart data with filters."""
    if superset is not None:
        try:
            filters = _normalize_filters(body.filters)
            result = await superset.get_chart_data(int(chart_id), filters)
            response = ChartDataResponse(
                data=result.get("data", []),
                columns=result.get("columns", []),
                row_count=len(result.get("data", [])),
            )
            return response.model_dump(by_alias=True)
        except (SupersetError, NotImplementedError, ValueError):
            logger.info("Superset unavailable, returning mock data for chart %s", chart_id)
    mock = MOCK_CHART_DATA.get(chart_id)
    if not mock:
        raise HTTPException(
            status_code=404, detail=f"Chart {chart_id} not found",
        )
    response = ChartDataResponse(
        data=mock["data"],
        columns=mock["columns"],
        row_count=len(mock["data"]),
    )
    return response.model_dump(by_alias=True)


def _normalize_filters(filters: object) -> list[dict]:
    """Normalize filters from any format into Superset filter dicts."""
    if isinstance(filters, list):
        # Already in Superset format: [{col, op, val}, ...]
        return filters
    if isinstance(filters, dict):
        try:
            gf = GlobalFilters(**filters)
            return [f.model_dump() for f in to_superset_filters(gf)]
        except Exception:
            return []
    return []
