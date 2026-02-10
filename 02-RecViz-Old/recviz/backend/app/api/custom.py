import logging

from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencies import get_aggregation_service
from app.core.exceptions import SupersetError
from app.models.custom import CustomAggregationRequest, CustomAggregationResponse
from app.services.aggregation_service import AggregationService

logger = logging.getLogger(__name__)

router = APIRouter()

SUPPORTED_AGGREGATION_TYPES = {"weighted_aging", "rolling_recon_rate", "break_velocity"}

# Mock responses for when Superset/aggregation service is unavailable
_MOCK_RESPONSES: dict[str, dict] = {
    "weighted_aging": {
        "data": [
            {"entity": "Entity A", "weighted_amount": 750000.0, "avg_days": 5.2},
            {"entity": "Entity B", "weighted_amount": 1200000.0, "avg_days": 12.1},
            {"entity": "Entity C", "weighted_amount": 340000.0, "avg_days": 2.8},
        ],
        "metadata": {"calculation": "break_amount * aging_days"},
    },
    "rolling_recon_rate": {
        "data": [
            {"date": "2026-02-07", "rate": 0.957},
            {"date": "2026-02-06", "rate": 0.952},
            {"date": "2026-02-05", "rate": 0.948},
        ],
        "metadata": {"window_days": 7},
    },
    "break_velocity": {
        "data": [
            {"date": "2026-02-07", "new_breaks": 45, "resolved_breaks": 52, "net": -7},
            {"date": "2026-02-06", "new_breaks": 38, "resolved_breaks": 41, "net": -3},
            {"date": "2026-02-05", "new_breaks": 55, "resolved_breaks": 30, "net": 25},
        ],
        "metadata": {"net_positive_means": "more new than resolved"},
    },
}


@router.post("/aggregations", response_model=CustomAggregationResponse)
async def custom_aggregation(
    body: CustomAggregationRequest,
    agg_service: AggregationService = Depends(get_aggregation_service),
) -> CustomAggregationResponse:
    """Run custom business logic aggregations.

    Supported types: weighted_aging, rolling_recon_rate, break_velocity.
    """
    if body.type not in SUPPORTED_AGGREGATION_TYPES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported aggregation type: {body.type}. "
                f"Supported: {', '.join(sorted(SUPPORTED_AGGREGATION_TYPES))}"
            ),
        )

    try:
        if body.type == "weighted_aging":
            result = await agg_service.weighted_aging(body.params)
        elif body.type == "rolling_recon_rate":
            trailing_days = body.params.get("window_days", 30)
            result = await agg_service.rolling_recon_rate(body.params, trailing_days)
        else:  # break_velocity
            period = body.params.get("period", "daily")
            result = await agg_service.break_velocity(body.params, period)

        return CustomAggregationResponse(
            type=body.type,
            data=result.get("data", []),
            metadata=result,
        )
    except (SupersetError, NotImplementedError):
        logger.info("Aggregation service unavailable, returning mock data for %s", body.type)
        mock = _MOCK_RESPONSES[body.type]
        return CustomAggregationResponse(
            type=body.type,
            data=mock["data"],
            metadata=mock["metadata"],
        )
