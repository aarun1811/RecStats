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
    # Strip potential connection strings
    raw = re.sub(r"postgresql://[^\s]+", "postgresql://***", raw)
    raw = re.sub(r"oracle://[^\s]+", "oracle://***", raw)
    raw = re.sub(r"hive://[^\s]+", "hive://***", raw)
    return raw
