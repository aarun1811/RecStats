"""Structured error response model for API endpoints."""

from __future__ import annotations

from pydantic import BaseModel


class ErrorResponse(BaseModel):
    """Structured error body returned in HTTPException detail.

    Machine-readable ``error`` code paired with a human-readable ``message``.
    Optional ``detail`` carries sanitised technical information; ``retry_after``
    hints how long clients should wait before retrying (seconds, for 503s).
    """

    error: str  # e.g. "service_unavailable", "query_timeout", "query_error", "database_error"
    message: str  # Human-readable: "The query engine is temporarily unavailable"
    detail: str | None = None  # Sanitised technical detail
    retry_after: int | None = None  # Seconds before client should retry (for 503)
