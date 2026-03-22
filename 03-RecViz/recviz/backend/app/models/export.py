from __future__ import annotations

from app.models.base import CamelModel


class ExportRequest(CamelModel):
    format: str  # "pdf" or "excel"
    dashboard_id: str | None = None
    chart_id: str | None = None
    filters: dict | None = None


class ExportStatus(CamelModel):
    job_id: str
    status: str  # "pending", "processing", "complete", "failed"
    download_url: str | None = None
