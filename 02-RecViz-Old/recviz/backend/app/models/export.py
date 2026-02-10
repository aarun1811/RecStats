from pydantic import BaseModel

from app.models.filters import GlobalFilters


class ExportRequest(BaseModel):
    format: str  # "pdf" or "excel"
    dashboard_id: str
    filters: GlobalFilters = GlobalFilters()
    options: dict = {}


class ExportJobResponse(BaseModel):
    job_id: str
    status: str = "queued"


class ExportStatusResponse(BaseModel):
    job_id: str
    status: str  # "queued", "processing", "completed", "failed"
    download_url: str | None = None
    error: str | None = None
