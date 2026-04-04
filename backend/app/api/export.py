from __future__ import annotations

import uuid

from fastapi import APIRouter

from app.models.export import ExportRequest, ExportStatus

router = APIRouter(prefix="/api/export", tags=["export"])

# In-memory job store (stub)
_jobs: dict[str, ExportStatus] = {}


@router.post("/pdf")
async def export_pdf(body: ExportRequest):
    job_id = str(uuid.uuid4())[:8]
    _jobs[job_id] = ExportStatus(job_id=job_id, status="pending")
    return {"job_id": job_id, "status": "pending", "message": "PDF export queued"}


@router.post("/excel")
async def export_excel(body: ExportRequest):
    job_id = str(uuid.uuid4())[:8]
    _jobs[job_id] = ExportStatus(job_id=job_id, status="pending")
    return {"job_id": job_id, "status": "pending", "message": "Excel export queued"}


@router.get("/{job_id}/status")
async def export_status(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        return {"error": "Job not found"}
    return job
