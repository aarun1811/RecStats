"""Shared error-handling utilities for API endpoints."""

from __future__ import annotations

import re


def sanitize_detail(exc: Exception) -> str:
    """Return a sanitised string from *exc* safe for client consumption.

    * Truncates overly long messages (e.g. full SQL queries) to 500 chars.
    * Redacts connection-string URIs that may contain credentials.

    The full, unsanitised exception is expected to be logged server-side
    via ``logger`` before calling this helper.
    """
    raw = str(exc)
    if len(raw) > 500:
        raw = raw[:500] + "... (truncated)"
    # Strip potential connection strings (any SQLAlchemy dialect+driver URI format)
    raw = re.sub(r"\w+(\+\w+)?://[^\s]+", "***://***", raw)
    return raw
