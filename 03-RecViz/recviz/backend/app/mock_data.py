"""Rich mock data — fallback when Superset is unavailable."""

from __future__ import annotations

MOCK_KPI = {
    "total_breaks": 149819,
    "open_breaks": 37455,
    "resolution_rate": 55.0,
    "avg_age_days": 8.4,
    "sla_breaches": 4200,
    "total_transactions": 1000000,
    "match_rate": 93.2,
    "break_amount": 24500000.00,
}

MOCK_DATASETS = [
    {"id": 4, "name": "transactions", "table_name": "transactions", "database_id": 1,
     "columns": [
         {"name": "id", "type": "VARCHAR", "is_dimension": True, "is_metric": False, "filterable": True},
         {"name": "trade_date", "type": "DATE", "is_dimension": True, "is_metric": False, "filterable": True},
         {"name": "settlement_date", "type": "DATE", "is_dimension": True, "is_metric": False, "filterable": True},
         {"name": "amount", "type": "NUMERIC", "is_dimension": False, "is_metric": True, "filterable": True},
         {"name": "currency", "type": "VARCHAR", "is_dimension": True, "is_metric": False, "filterable": True},
         {"name": "region", "type": "VARCHAR", "is_dimension": True, "is_metric": False, "filterable": True},
         {"name": "country", "type": "VARCHAR", "is_dimension": True, "is_metric": False, "filterable": True},
         {"name": "lob", "type": "VARCHAR", "is_dimension": True, "is_metric": False, "filterable": True},
         {"name": "desk", "type": "VARCHAR", "is_dimension": True, "is_metric": False, "filterable": True},
         {"name": "source_system", "type": "VARCHAR", "is_dimension": True, "is_metric": False, "filterable": True},
         {"name": "counterparty", "type": "VARCHAR", "is_dimension": True, "is_metric": False, "filterable": True},
         {"name": "status", "type": "VARCHAR", "is_dimension": True, "is_metric": False, "filterable": True},
     ], "row_count": 1000000},
    {"id": 5, "name": "breaks", "table_name": "breaks", "database_id": 1,
     "columns": [
         {"name": "id", "type": "VARCHAR", "is_dimension": True, "is_metric": False, "filterable": True},
         {"name": "transaction_id", "type": "VARCHAR", "is_dimension": True, "is_metric": False, "filterable": True},
         {"name": "reason", "type": "VARCHAR", "is_dimension": True, "is_metric": False, "filterable": True},
         {"name": "category", "type": "VARCHAR", "is_dimension": True, "is_metric": False, "filterable": True},
         {"name": "break_type", "type": "VARCHAR", "is_dimension": True, "is_metric": False, "filterable": True},
         {"name": "amount", "type": "NUMERIC", "is_dimension": False, "is_metric": True, "filterable": True},
         {"name": "currency", "type": "VARCHAR", "is_dimension": True, "is_metric": False, "filterable": True},
         {"name": "region", "type": "VARCHAR", "is_dimension": True, "is_metric": False, "filterable": True},
         {"name": "country", "type": "VARCHAR", "is_dimension": True, "is_metric": False, "filterable": True},
         {"name": "lob", "type": "VARCHAR", "is_dimension": True, "is_metric": False, "filterable": True},
         {"name": "desk", "type": "VARCHAR", "is_dimension": True, "is_metric": False, "filterable": True},
         {"name": "status", "type": "VARCHAR", "is_dimension": True, "is_metric": False, "filterable": True},
         {"name": "aging_days", "type": "INTEGER", "is_dimension": False, "is_metric": True, "filterable": True},
         {"name": "aging_bucket", "type": "VARCHAR", "is_dimension": True, "is_metric": False, "filterable": True},
         {"name": "sla_breach", "type": "BOOLEAN", "is_dimension": True, "is_metric": False, "filterable": True},
         {"name": "assigned_to", "type": "VARCHAR", "is_dimension": True, "is_metric": False, "filterable": True},
         {"name": "priority", "type": "INTEGER", "is_dimension": False, "is_metric": True, "filterable": True},
         {"name": "created_date", "type": "DATE", "is_dimension": True, "is_metric": False, "filterable": True},
         {"name": "resolved_date", "type": "DATE", "is_dimension": True, "is_metric": False, "filterable": True},
     ], "row_count": 149819},
    {"id": 6, "name": "daily_metrics", "table_name": "daily_metrics", "database_id": 1,
     "columns": [
         {"name": "date", "type": "DATE", "is_dimension": True, "is_metric": False, "filterable": True},
         {"name": "total_transactions", "type": "INTEGER", "is_dimension": False, "is_metric": True, "filterable": True},
         {"name": "matched", "type": "INTEGER", "is_dimension": False, "is_metric": True, "filterable": True},
         {"name": "unmatched", "type": "INTEGER", "is_dimension": False, "is_metric": True, "filterable": True},
         {"name": "breaks", "type": "INTEGER", "is_dimension": False, "is_metric": True, "filterable": True},
         {"name": "match_rate", "type": "NUMERIC", "is_dimension": False, "is_metric": True, "filterable": True},
         {"name": "total_amount", "type": "NUMERIC", "is_dimension": False, "is_metric": True, "filterable": True},
         {"name": "break_amount", "type": "NUMERIC", "is_dimension": False, "is_metric": True, "filterable": True},
         {"name": "avg_break_age", "type": "NUMERIC", "is_dimension": False, "is_metric": True, "filterable": True},
         {"name": "sla_breach_count", "type": "INTEGER", "is_dimension": False, "is_metric": True, "filterable": True},
     ], "row_count": 365},
    {"id": 3, "name": "counterparties", "table_name": "counterparties", "database_id": 1,
     "columns": [
         {"name": "id", "type": "INTEGER", "is_dimension": True, "is_metric": False, "filterable": True},
         {"name": "name", "type": "VARCHAR", "is_dimension": True, "is_metric": False, "filterable": True},
         {"name": "region", "type": "VARCHAR", "is_dimension": True, "is_metric": False, "filterable": True},
         {"name": "risk_rating", "type": "VARCHAR", "is_dimension": True, "is_metric": False, "filterable": True},
     ], "row_count": 50},
]

MOCK_CHARTS = [
    {"id": "break-trend", "name": "Break Trend", "viz_type": "line", "datasource_id": 5},
    {"id": "breaks-by-category", "name": "Breaks by Category", "viz_type": "pie", "datasource_id": 5},
    {"id": "breaks-by-desk", "name": "Breaks by Desk", "viz_type": "bar", "datasource_id": 5},
    {"id": "aging-distribution", "name": "Aging Distribution", "viz_type": "bar", "datasource_id": 5},
    {"id": "breaks-by-region", "name": "Breaks by Region", "viz_type": "bar", "datasource_id": 5},
    {"id": "txn-volume-trend", "name": "Transaction Volume Trend", "viz_type": "line", "datasource_id": 4},
    {"id": "txn-by-status", "name": "Transactions by Status", "viz_type": "pie", "datasource_id": 4},
    {"id": "txn-by-region", "name": "Transactions by Region", "viz_type": "bar", "datasource_id": 4},
    {"id": "match-rate-trend", "name": "Match Rate Trend", "viz_type": "line", "datasource_id": 6},
    {"id": "daily-break-amount", "name": "Daily Break Amount", "viz_type": "bar", "datasource_id": 6},
]

MOCK_DASHBOARDS = [
    {
        "id": "recon-overview",
        "title": "Recon Overview",
        "slug": "recon-overview",
        "description": "High-level reconciliation dashboard with KPIs, break trends, and aging analysis",
        "status": "active",
        "chart_count": 6,
        "changed_on": "2 hours ago",
        "charts": MOCK_CHARTS,
        "layout": [
            {"chart_id": "break-trend", "x": 0, "y": 0, "w": 12, "h": 4},
            {"chart_id": "breaks-by-category", "x": 0, "y": 4, "w": 4, "h": 4},
            {"chart_id": "breaks-by-desk", "x": 4, "y": 4, "w": 4, "h": 4},
            {"chart_id": "aging-distribution", "x": 8, "y": 4, "w": 4, "h": 4},
            {"chart_id": "breaks-by-region", "x": 0, "y": 8, "w": 6, "h": 4},
            {"chart_id": "match-rate-trend", "x": 6, "y": 8, "w": 6, "h": 4},
        ],
        "cross_filter_rules": [
            {"source_chart": "breaks-by-category", "target_charts": ["break-trend", "breaks-by-desk", "aging-distribution"], "column": "category"},
            {"source_chart": "breaks-by-desk", "target_charts": ["break-trend", "breaks-by-category", "aging-distribution"], "column": "desk"},
            {"source_chart": "breaks-by-region", "target_charts": ["break-trend", "breaks-by-category", "breaks-by-desk"], "column": "region"},
        ],
        "default_filters": {},
    },
]

MOCK_DATABASES = [
    {
        "id": 1,
        "database_name": "recon_data",
        "backend": "postgresql",
        "created_on": "2026-01-15T10:00:00Z",
        "expose_in_sqllab": True,
        "dataset_count": 4,
        "status": "connected",
    },
    {
        "id": 2,
        "database_name": "oracle_prod",
        "backend": "oracle",
        "created_on": "2026-01-20T14:30:00Z",
        "expose_in_sqllab": True,
        "dataset_count": 47,
        "status": "connected",
    },
    {
        "id": 3,
        "database_name": "hive_warehouse",
        "backend": "hive",
        "created_on": "2026-02-01T09:00:00Z",
        "expose_in_sqllab": True,
        "dataset_count": 12,
        "status": "untested",
    },
]

import random as _random

_random.seed(42)

_DESKS = ["Operations", "Treasury", "Settlements", "FX", "Equity"]
_CATEGORIES = ["Critical", "High", "Medium", "Low"]
_STATUSES = ["Open", "Resolved", "Pending Review", "Escalated"]
_REGIONS = ["NA", "EMEA", "APAC", "LATAM"]
_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CHF"]
_REASONS = ["Amount mismatch", "Missing counterparty", "Date discrepancy", "Duplicate entry", "System error"]
_LOBS = ["Investment Banking", "Markets", "Wealth Management", "Commercial Banking"]
_COUNTRIES = ["US", "UK", "Germany", "Japan", "Singapore", "Brazil", "France", "Australia"]
_BREAK_TYPES = ["Position", "Cash", "Trade", "Settlement"]
_ASSIGNEES = ["Alice Smith", "Bob Johnson", "Carol Williams", "David Brown", "Eva Chen"]
_AGING_BUCKETS = ["0-2 days", "3-5 days", "6-10 days", "11-30 days", "30+ days"]

MOCK_BREAK_ROWS: list[dict] = []
for _i in range(1, 201):
    _aging = _random.randint(0, 45)
    _bucket = (
        "0-2 days" if _aging <= 2 else
        "3-5 days" if _aging <= 5 else
        "6-10 days" if _aging <= 10 else
        "11-30 days" if _aging <= 30 else
        "30+ days"
    )
    MOCK_BREAK_ROWS.append({
        "id": f"BRK-{_i:05d}",
        "transaction_id": f"TXN-{_random.randint(100000, 999999)}",
        "reason": _random.choice(_REASONS),
        "category": _random.choice(_CATEGORIES),
        "break_type": _random.choice(_BREAK_TYPES),
        "amount": round(_random.uniform(1000, 500000), 2),
        "currency": _random.choice(_CURRENCIES),
        "region": _random.choice(_REGIONS),
        "country": _random.choice(_COUNTRIES),
        "lob": _random.choice(_LOBS),
        "desk": _random.choice(_DESKS),
        "status": _random.choice(_STATUSES),
        "aging_days": _aging,
        "aging_bucket": _bucket,
        "sla_breach": _aging > 10,
        "assigned_to": _random.choice(_ASSIGNEES),
        "priority": _random.randint(1, 5),
        "created_date": f"2026-01-{_random.randint(1, 31):02d}",
        "resolved_date": f"2026-02-{_random.randint(1, 10):02d}" if _random.random() > 0.4 else None,
        "notes": f"Auto-generated break record #{_i}",
    })

MOCK_DATABASE_DATASETS: dict[int, list[dict]] = {
    1: [
        {"id": 4, "table_name": "transactions", "column_count": 12},
        {"id": 5, "table_name": "breaks", "column_count": 18},
        {"id": 6, "table_name": "daily_metrics", "column_count": 10},
        {"id": 3, "table_name": "counterparties", "column_count": 4},
    ],
    2: [
        {"id": 10 + i, "table_name": f"RECON_TABLE_{i:02d}", "column_count": _random.randint(5, 30)}
        for i in range(1, 48)
    ],
    3: [
        {"id": 60, "table_name": "recon_history", "column_count": 15},
        {"id": 61, "table_name": "batch_results", "column_count": 8},
        {"id": 62, "table_name": "match_output", "column_count": 22},
        {"id": 63, "table_name": "exception_log", "column_count": 11},
        {"id": 64, "table_name": "audit_trail", "column_count": 9},
        {"id": 65, "table_name": "source_feed_a", "column_count": 14},
        {"id": 66, "table_name": "source_feed_b", "column_count": 14},
        {"id": 67, "table_name": "reconciliation_rules", "column_count": 7},
        {"id": 68, "table_name": "scheduler_config", "column_count": 6},
        {"id": 69, "table_name": "run_metadata", "column_count": 12},
        {"id": 70, "table_name": "tolerance_config", "column_count": 5},
        {"id": 71, "table_name": "break_categories", "column_count": 4},
    ],
}


MOCK_CHART_DATA = {
    "breaks-by-category": {
        "columns": ["category", "count"],
        "data": [
            {"category": "Critical", "count": 7365},
            {"category": "High", "count": 22511},
            {"category": "Medium", "count": 59934},
            {"category": "Low", "count": 60009},
        ],
    },
    "breaks-by-desk": {
        "columns": ["desk", "count"],
        "data": [
            {"desk": "Operations", "count": 29964},
            {"desk": "Treasury", "count": 29963},
            {"desk": "Settlements", "count": 29964},
            {"desk": "FX", "count": 29964},
            {"desk": "Equity", "count": 29964},
        ],
    },
}
