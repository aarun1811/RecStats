"""Tests for QueryExecutor._build_date_range_clause + FilterMapping.options
threading (Plan 4 Task 3, spec §12.7).

Covers the kwarg-only `exclude_today` toggle and the dataset opt-in path via
`FilterMapping.options`. The default behavior (RecViz / QuickRec) is inclusive
of today (`SYSDATE`); legacy TLM datasets opt in to `SYSDATE - 1` parity with
`TlmStatsV2Service.getDateRangeClause` (Java) lines 625-632.
"""
from __future__ import annotations

import pytest

from app.services.query_engine import QueryExecutor


@pytest.fixture
def qx():
    """Bare QueryExecutor for testing pure methods. `__new__` bypasses any
    init validation; we only need the unbound `_build_date_range_clause`
    and `_build_sql` methods. Verify QueryExecutor has no __slots__ issue
    at execution — if it does, replace with `unittest.mock.create_autospec`."""
    return QueryExecutor.__new__(QueryExecutor)


def test_date_range_clause_default_ends_at_sysdate(qx):
    """RecViz/QuickRec default — includes today."""
    assert qx._build_date_range_clause(7, "oracle") == "BETWEEN SYSDATE - 7 AND SYSDATE"
    assert qx._build_date_range_clause(30, "oracle") == "BETWEEN SYSDATE - 30 AND SYSDATE"


def test_date_range_clause_exclude_today_ends_at_sysdate_minus_one(qx):
    """Legacy TLM — excludes today (parity with TlmStatsV2Service.getDateRangeClause:627-632)."""
    assert qx._build_date_range_clause(7, "oracle", exclude_today=True) == "BETWEEN SYSDATE - 7 AND SYSDATE - 1"
    assert qx._build_date_range_clause(30, "oracle", exclude_today=True) == "BETWEEN SYSDATE - 30 AND SYSDATE - 1"


def test_date_range_clause_days_one_default_business_day(qx):
    """value==1 uses business-day DECODE; default end is SYSDATE."""
    clause = qx._build_date_range_clause(1, "oracle")
    assert "TRUNC(SYSDATE)" in clause
    assert "DECODE(TO_CHAR(SYSDATE,'D')" in clause
    assert clause.endswith("AND SYSDATE")
    assert "AND SYSDATE - 1" not in clause


def test_date_range_clause_days_one_exclude_today_business_day(qx):
    """value==1 + exclude_today: business-day DECODE with SYSDATE-1 end."""
    clause = qx._build_date_range_clause(1, "oracle", exclude_today=True)
    assert "TRUNC(SYSDATE)" in clause
    assert clause.endswith("AND SYSDATE - 1")


def test_filter_mapping_options_threaded_to_date_clause(qx):
    """A FilterMapping with options={exclude_today: True} produces a
    SYSDATE-1-ending clause when substituted via _build_sql."""
    from app.models.data_source_config import (
        ColumnDef,
        DataSourceConfig,
        DatabaseRoutingMapping,
        FilterMapping,
    )

    ds = DataSourceConfig(
        id="test",
        name="test",
        database_routing=DatabaseRoutingMapping(type="static", database="test-db"),
        query="SELECT * FROM t WHERE 1=1 {{filters}}",
        filter_mappings=[
            FilterMapping(
                filter_id="date_range_days",
                sql_expr="stmt_date {{date_range_clause}}",
                options={"exclude_today": True},
            )
        ],
        columns=[ColumnDef(name="stmt_date", type="date")],
    )
    sql = qx._build_sql(ds, {"date_range_days": 7}, dialect="oracle")
    assert "BETWEEN SYSDATE - 7 AND SYSDATE - 1" in sql


def test_filter_mapping_options_default_off_uses_sysdate(qx):
    """Missing `options` defaults to exclude_today=False (the existing behavior)."""
    from app.models.data_source_config import (
        ColumnDef,
        DataSourceConfig,
        DatabaseRoutingMapping,
        FilterMapping,
    )

    ds = DataSourceConfig(
        id="test",
        name="test",
        database_routing=DatabaseRoutingMapping(type="static", database="test-db"),
        query="SELECT * FROM t WHERE 1=1 {{filters}}",
        filter_mappings=[
            FilterMapping(
                filter_id="date_range_days",
                sql_expr="stmt_date {{date_range_clause}}",
            )
        ],
        columns=[ColumnDef(name="stmt_date", type="date")],
    )
    sql = qx._build_sql(ds, {"date_range_days": 7}, dialect="oracle")
    assert "BETWEEN SYSDATE - 7 AND SYSDATE" in sql
    assert "AND SYSDATE - 1" not in sql
