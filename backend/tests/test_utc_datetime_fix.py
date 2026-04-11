"""Tests for the localized UTC datetime fix (Unit 1, v7-safe).

Two code paths covered:
  1. DatasetResponse (Pydantic model) — uses @field_serializer
  2. _build_response in databases.py (dict path) — uses _utc_isoformat helper
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest


def test_dataset_response_naive_datetime_serializes_with_offset():
    """A DatasetResponse built with naive datetime values (simulating an
    Oracle TIMESTAMP WITH TIME ZONE roundtrip that dropped tzinfo) must
    emit "+00:00" in JSON output. Otherwise the frontend parses as local
    time and shows "6 hours ago" for a just-saved row on IST."""
    from app.models.managed_dataset import DatasetResponse

    response = DatasetResponse(
        id="test-id",
        name="Test Dataset",
        description="",
        database_id="db-1",
        sql="SELECT 1",
        columns=[],
        schema_version=1,
        created_at=datetime(2026, 4, 11, 13, 27, 0),  # naive
        updated_at=datetime(2026, 4, 11, 13, 27, 0),  # naive
    )

    json_str = response.model_dump_json()

    # Must contain offset marker. Pydantic v2 emits "+00:00" or "Z"
    # depending on configuration; accept either.
    assert "+00:00" in json_str or "Z" in json_str, (
        f"Expected UTC offset marker in serialized JSON, got: {json_str}"
    )
    # Must NOT contain a bare naive ISO form.
    assert '"2026-04-11T13:27:00"' not in json_str


def test_dataset_response_aware_datetime_preserved():
    """A tz-aware datetime should pass through serialization unchanged —
    the serializer must not double-coerce."""
    from app.models.managed_dataset import DatasetResponse

    response = DatasetResponse(
        id="test-id",
        name="Test Dataset",
        description="",
        database_id="db-1",
        sql="SELECT 1",
        columns=[],
        schema_version=1,
        created_at=datetime(2026, 4, 11, 13, 27, 0, tzinfo=timezone.utc),
        updated_at=datetime(2026, 4, 11, 13, 27, 0, tzinfo=timezone.utc),
    )

    json_str = response.model_dump_json()
    assert "+00:00" in json_str or "Z" in json_str


def test_utc_isoformat_none_returns_none():
    """_utc_isoformat(None) must return None — used for optional
    last_tested / created_on fields."""
    from app.api.databases import _utc_isoformat

    assert _utc_isoformat(None) is None


def test_utc_isoformat_naive_datetime_adds_offset():
    """_utc_isoformat must coerce naive datetimes to UTC-aware and emit
    the offset suffix."""
    from app.api.databases import _utc_isoformat

    naive = datetime(2026, 4, 11, 13, 27, 0)
    result = _utc_isoformat(naive)

    assert result is not None
    assert result.endswith("+00:00")
    assert "2026-04-11T13:27:00" in result


def test_utc_isoformat_aware_datetime_preserved():
    """_utc_isoformat must not double-coerce already-aware datetimes."""
    from app.api.databases import _utc_isoformat

    aware = datetime(2026, 4, 11, 13, 27, 0, tzinfo=timezone.utc)
    result = _utc_isoformat(aware)

    assert result == aware.isoformat()
    assert result.endswith("+00:00")
