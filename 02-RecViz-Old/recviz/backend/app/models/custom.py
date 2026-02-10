from typing import Any

from pydantic import BaseModel


class CustomAggregationRequest(BaseModel):
    type: str  # "weighted_aging", "rolling_recon_rate", "break_velocity"
    params: dict[str, Any] = {}


class CustomAggregationResponse(BaseModel):
    type: str
    data: list[dict[str, Any]]
    metadata: dict[str, Any] = {}
