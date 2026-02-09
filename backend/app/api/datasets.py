import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencies import get_superset_client
from app.core.exceptions import SupersetError
from app.mock.data import MOCK_DATASET_DATA, MOCK_DATASETS
from app.models.dataset import (
    DatasetDataRequest,
    DatasetDataResponse,
    DatasetListResponse,
    DatasetResponse,
)
from app.models.filters import SupersetFilter
from app.services.filter_converter import to_superset_filters
from app.services.superset_client import SupersetClient

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=DatasetListResponse)
async def list_datasets(
    superset: SupersetClient = Depends(get_superset_client),
) -> DatasetListResponse:
    """List all available datasets."""
    try:
        result = await superset.list_datasets()
        datasets = [DatasetResponse(**d) for d in result]
        return DatasetListResponse(datasets=datasets, count=len(datasets))
    except (SupersetError, NotImplementedError):
        logger.info("Superset unavailable, returning mock datasets")
        return DatasetListResponse(datasets=MOCK_DATASETS, count=len(MOCK_DATASETS))


@router.get("/{dataset_id}", response_model=DatasetResponse)
async def get_dataset(
    dataset_id: int,
    superset: SupersetClient = Depends(get_superset_client),
) -> DatasetResponse:
    """Get dataset details including columns."""
    try:
        result = await superset.get_dataset(dataset_id)
        return DatasetResponse(**result)
    except (SupersetError, NotImplementedError):
        logger.info("Superset unavailable, returning mock dataset %d", dataset_id)
        for ds in MOCK_DATASETS:
            if ds.id == dataset_id:
                return ds
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found") from None


@router.post("/{dataset_id}/data", response_model=DatasetDataResponse)
async def get_dataset_data(
    dataset_id: int,
    body: DatasetDataRequest,
    superset: SupersetClient = Depends(get_superset_client),
) -> DatasetDataResponse:
    """Fetch paginated dataset data with filters."""
    try:
        filters = _to_filter_dicts(to_superset_filters(body.filters))
        result = await superset.get_dataset_data(
            dataset_id,
            filters=filters,
            order_by=body.order_by,
            offset=body.offset,
            limit=body.limit,
        )
        data = result.get("data", [])
        total = result.get("row_count", len(data))
        next_offset = body.offset + body.limit if body.offset + body.limit < total else None
        return DatasetDataResponse(
            data=data,
            columns=result.get("columns", []),
            row_count=total,
            next_offset=next_offset,
        )
    except (SupersetError, NotImplementedError):
        logger.info("Superset unavailable, returning mock data for dataset %d", dataset_id)
        mock = MOCK_DATASET_DATA.get(dataset_id)
        if not mock:
            raise HTTPException(
                status_code=404, detail=f"Dataset {dataset_id} not found",
            ) from None
        all_data: list[dict[str, Any]] = mock["data"]
        page = all_data[body.offset : body.offset + body.limit]
        next_offset = (
            body.offset + body.limit
            if body.offset + body.limit < len(all_data)
            else None
        )
        return DatasetDataResponse(
            data=page,
            columns=mock["columns"],
            row_count=len(all_data),
            next_offset=next_offset,
        )


def _to_filter_dicts(filters: list[SupersetFilter]) -> list[dict]:
    """Convert SupersetFilter list to plain dicts for the client."""
    return [f.model_dump() for f in filters]
