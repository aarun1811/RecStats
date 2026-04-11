"""Tests for the None → "" description coercion in managed entity responses.

Oracle treats empty strings as NULL at the DB level (a well-known Oracle
quirk: ``''`` and ``NULL`` are indistinguishable in VARCHAR2 columns). A
row saved with ``description=""`` comes back as ``None`` on Oracle, which
would fail the ``description: str`` Pydantic validation on the response
models.

The fix is in the ``_to_response`` helpers of managed_kpis.py,
managed_datasets.py, and managed_charts.py: ``kpi.description or ""``
coerces None to the empty string before passing to Pydantic.

These tests construct ORM instances with ``description=None`` and call
the ``_to_response`` helpers directly, asserting the resulting Pydantic
model serializes cleanly with ``description == ""``.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest


def test_kpi_response_coerces_none_description_to_empty_string():
    """KPI with description=None (Oracle empty-string-as-null) serializes
    cleanly instead of raising ValidationError."""
    from app.api.managed_kpis import _to_response
    from app.db.models.kpi import RecvizKpi

    kpi = RecvizKpi(
        id="k-1",
        name="Break Count",
        description=None,  # Oracle roundtrip
        dataset_id="ds-1",
        metric_column="count",
        aggregation="SUM",
        config={"format": {"type": "number"}, "trend": None, "thresholds": None, "subtitle": ""},
        created_at=datetime(2026, 4, 11, 13, 27, 0, tzinfo=timezone.utc),
        updated_at=datetime(2026, 4, 11, 13, 27, 0, tzinfo=timezone.utc),
    )

    response = _to_response(kpi)
    assert response.description == ""
    # Serialization should not raise.
    json_str = response.model_dump_json()
    assert '"description":""' in json_str


def test_kpi_response_preserves_actual_description():
    """Non-None description must pass through unchanged."""
    from app.api.managed_kpis import _to_response
    from app.db.models.kpi import RecvizKpi

    kpi = RecvizKpi(
        id="k-1",
        name="Break Count",
        description="Total breaks across all desks",
        dataset_id="ds-1",
        metric_column="count",
        aggregation="SUM",
        config={"format": {"type": "number"}, "trend": None, "thresholds": None, "subtitle": ""},
        created_at=datetime(2026, 4, 11, 13, 27, 0, tzinfo=timezone.utc),
        updated_at=datetime(2026, 4, 11, 13, 27, 0, tzinfo=timezone.utc),
    )

    response = _to_response(kpi)
    assert response.description == "Total breaks across all desks"


def test_dataset_response_coerces_none_description_to_empty_string():
    """Dataset with description=None (Oracle empty-string-as-null) serializes
    cleanly instead of raising ValidationError."""
    from app.api.managed_datasets import _to_response
    from app.db.models.dataset import RecvizDataset

    dataset = RecvizDataset(
        id="ds-1",
        name="Breaks by Desk",
        description=None,
        database_id="db-1",
        sql="SELECT * FROM breaks",
        columns=[],
        schema_version=1,
        created_at=datetime(2026, 4, 11, 13, 27, 0, tzinfo=timezone.utc),
        updated_at=datetime(2026, 4, 11, 13, 27, 0, tzinfo=timezone.utc),
    )

    response = _to_response(dataset)
    assert response.description == ""


def test_chart_response_coerces_none_description_to_empty_string():
    """Chart with description=None (Oracle empty-string-as-null) serializes
    cleanly instead of raising ValidationError."""
    from app.api.managed_charts import _to_response
    from app.db.models.chart import RecvizChart

    chart = RecvizChart(
        id="c-1",
        name="Breaks Over Time",
        description=None,
        dataset_id="ds-1",
        chart_type="line",
        config={
            "xColumn": "date",
            "yColumns": ["count"],
            "aggregation": "SUM",
            "palette": "default",
        },
        created_at=datetime(2026, 4, 11, 13, 27, 0, tzinfo=timezone.utc),
        updated_at=datetime(2026, 4, 11, 13, 27, 0, tzinfo=timezone.utc),
    )

    response = _to_response(chart)
    assert response.description == ""
