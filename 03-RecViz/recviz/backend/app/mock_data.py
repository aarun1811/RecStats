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
    {"id": 1, "database_name": "recon_data", "backend": "postgresql"},
]

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
