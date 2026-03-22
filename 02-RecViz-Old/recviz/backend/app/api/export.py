import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencies import get_export_service
from app.core.exceptions import SupersetError
from app.models.export import ExportJobResponse, ExportRequest, ExportStatusResponse
from app.services.export_service import ExportService

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory job tracking (mock — real impl uses Celery)
_export_jobs: dict[str, ExportStatusResponse] = {}


@router.post("/pdf", response_model=ExportJobResponse, status_code=202)
async def export_pdf(
    body: ExportRequest,
    export_service: ExportService = Depends(get_export_service),
) -> ExportJobResponse:
    """Generate a PDF report.

    Queues a Celery task (or runs sync for now).
    Returns a job ID for status polling.
    """
    job_id = str(uuid.uuid4())
    _export_jobs[job_id] = ExportStatusResponse(job_id=job_id, status="processing")
    try:
        await export_service.generate_pdf(
            dashboard_id=body.dashboard_id,
            filters=body.filters.model_dump(),
            options=body.options,
        )
        _export_jobs[job_id] = ExportStatusResponse(
            job_id=job_id,
            status="completed",
            download_url=f"/api/export/download/{job_id}",
        )
    except (SupersetError, NotImplementedError, Exception) as exc:
        logger.warning("PDF export failed: %s", exc)
        _export_jobs[job_id] = ExportStatusResponse(
            job_id=job_id,
            status="failed",
            error=str(exc),
        )
    return ExportJobResponse(job_id=job_id, status=_export_jobs[job_id].status)


@router.post("/excel", response_model=ExportJobResponse, status_code=202)
async def export_excel(
    body: ExportRequest,
    export_service: ExportService = Depends(get_export_service),
) -> ExportJobResponse:
    """Generate an Excel export.

    Queues a Celery task (or runs sync for now).
    Returns a job ID for status polling.
    """
    job_id = str(uuid.uuid4())
    _export_jobs[job_id] = ExportStatusResponse(job_id=job_id, status="processing")
    try:
        await export_service.generate_excel(
            dashboard_id=body.dashboard_id,
            filters=body.filters.model_dump(),
            options=body.options,
        )
        _export_jobs[job_id] = ExportStatusResponse(
            job_id=job_id,
            status="completed",
            download_url=f"/api/export/download/{job_id}",
        )
    except (SupersetError, NotImplementedError, Exception) as exc:
        logger.warning("Excel export failed: %s", exc)
        _export_jobs[job_id] = ExportStatusResponse(
            job_id=job_id,
            status="failed",
            error=str(exc),
        )
    return ExportJobResponse(job_id=job_id, status=_export_jobs[job_id].status)


@router.get("/status/{job_id}", response_model=ExportStatusResponse)
async def export_status(job_id: str) -> ExportStatusResponse:
    """Check export job status."""
    job = _export_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Export job {job_id} not found")
    return job
