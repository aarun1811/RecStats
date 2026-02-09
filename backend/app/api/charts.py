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
from app.models.filters import SupersetFilter
from app.services.filter_converter import to_superset_filters
from app.services.superset_client import SupersetClient

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=ChartListResponse)
async def list_charts(
    superset: SupersetClient = Depends(get_superset_client),
) -> ChartListResponse:
    """List all available charts."""
    try:
        result = await superset.list_charts()
        charts = [ChartDefinition(**c) for c in result]
        return ChartListResponse(charts=charts, count=len(charts))
    except (SupersetError, NotImplementedError):
        logger.info("Superset unavailable, returning mock charts")
        return ChartListResponse(charts=MOCK_CHARTS, count=len(MOCK_CHARTS))


@router.get("/{chart_id}", response_model=ChartDefinition)
async def get_chart(
    chart_id: int,
    superset: SupersetClient = Depends(get_superset_client),
) -> ChartDefinition:
    """Get chart definition by ID."""
    try:
        result = await superset.get_chart(chart_id)
        return ChartDefinition(**result)
    except (SupersetError, NotImplementedError):
        logger.info("Superset unavailable, returning mock chart %d", chart_id)
        for chart in MOCK_CHARTS:
            if chart.id == chart_id:
                return chart
        raise HTTPException(status_code=404, detail=f"Chart {chart_id} not found") from None


@router.post("/{chart_id}/data", response_model=ChartDataResponse)
async def get_chart_data(
    chart_id: int,
    body: ChartDataRequest,
    superset: SupersetClient = Depends(get_superset_client),
) -> ChartDataResponse:
    """Fetch chart data with filters."""
    try:
        filters = _to_filter_dicts(to_superset_filters(body.filters))
        result = await superset.get_chart_data(chart_id, filters)
        return ChartDataResponse(
            data=result.get("data", []),
            columns=result.get("columns", []),
            row_count=len(result.get("data", [])),
        )
    except (SupersetError, NotImplementedError):
        logger.info("Superset unavailable, returning mock data for chart %d", chart_id)
        mock = MOCK_CHART_DATA.get(chart_id)
        if not mock:
            raise HTTPException(
                status_code=404, detail=f"Chart {chart_id} not found",
            ) from None
        return ChartDataResponse(
            data=mock["data"],
            columns=mock["columns"],
            row_count=len(mock["data"]),
        )


def _to_filter_dicts(filters: list[SupersetFilter]) -> list[dict]:
    """Convert SupersetFilter list to plain dicts for the client."""
    return [f.model_dump() for f in filters]
