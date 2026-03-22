"""Mock data for development/testing when Superset isn't available."""

from app.models.chart_data import ChartDefinition
from app.models.dashboard import (
    ChartConfig,
    CrossFilterRule,
    DashboardConfig,
    DashboardLayoutItem,
)
from app.models.dataset import DatasetColumn, DatasetResponse
from app.models.sql import DatabaseResponse

MOCK_CHARTS: list[ChartDefinition] = [
    ChartDefinition(
        id=1,
        name="Break Amount by Entity",
        viz_type="bar",
        datasource_id=1,
        description="Total break amounts grouped by entity",
    ),
    ChartDefinition(
        id=2,
        name="Recon Rate Over Time",
        viz_type="line",
        datasource_id=1,
        description="Daily reconciliation rate trend",
    ),
    ChartDefinition(
        id=3,
        name="Break Status Distribution",
        viz_type="pie",
        datasource_id=1,
        description="Breakdown of current break statuses",
    ),
    ChartDefinition(
        id=4,
        name="Aging Heatmap",
        viz_type="heatmap",
        datasource_id=2,
        description="Break aging by entity and desk",
    ),
]

# String-keyed chart data matching frontend chart IDs
MOCK_CHART_DATA: dict[str, dict] = {
    "break-trend": {
        "columns": ["date", "count", "status"],
        "data": [
            {"date": "2026-02-03", "count": 45, "status": "Open"},
            {"date": "2026-02-04", "count": 38, "status": "Open"},
            {"date": "2026-02-05", "count": 52, "status": "Open"},
            {"date": "2026-02-06", "count": 41, "status": "Open"},
            {"date": "2026-02-07", "count": 35, "status": "Open"},
            {"date": "2026-02-03", "count": 120, "status": "Resolved"},
            {"date": "2026-02-04", "count": 135, "status": "Resolved"},
            {"date": "2026-02-05", "count": 128, "status": "Resolved"},
            {"date": "2026-02-06", "count": 142, "status": "Resolved"},
            {"date": "2026-02-07", "count": 150, "status": "Resolved"},
            {"date": "2026-02-03", "count": 15, "status": "Escalated"},
            {"date": "2026-02-04", "count": 12, "status": "Escalated"},
            {"date": "2026-02-05", "count": 18, "status": "Escalated"},
            {"date": "2026-02-06", "count": 10, "status": "Escalated"},
            {"date": "2026-02-07", "count": 8, "status": "Escalated"},
        ],
    },
    "breaks-by-type": {
        "columns": ["type", "count"],
        "data": [
            {"type": "Amount Mismatch", "count": 342},
            {"type": "Missing Trade", "count": 218},
            {"type": "Settlement Date", "count": 156},
            {"type": "Counterparty", "count": 89},
            {"type": "Currency", "count": 67},
            {"type": "Other", "count": 45},
        ],
    },
    "breaks-by-desk": {
        "columns": ["desk", "count"],
        "data": [
            {"desk": "Operations", "count": 380},
            {"desk": "Treasury", "count": 215},
            {"desk": "Fixed Income", "count": 178},
            {"desk": "Equities", "count": 145},
            {"desk": "FX", "count": 98},
            {"desk": "Derivatives", "count": 67},
        ],
    },
    "aging-distribution": {
        "columns": ["bucket", "count", "desk"],
        "data": [
            {"bucket": "0-1 days", "count": 120, "desk": "Operations"},
            {"bucket": "0-1 days", "count": 85, "desk": "Treasury"},
            {"bucket": "2-3 days", "count": 95, "desk": "Operations"},
            {"bucket": "2-3 days", "count": 60, "desk": "Treasury"},
            {"bucket": "4-7 days", "count": 45, "desk": "Operations"},
            {"bucket": "4-7 days", "count": 30, "desk": "Treasury"},
            {"bucket": "8-14 days", "count": 25, "desk": "Operations"},
            {"bucket": "8-14 days", "count": 15, "desk": "Treasury"},
            {"bucket": "15+ days", "count": 10, "desk": "Operations"},
            {"bucket": "15+ days", "count": 8, "desk": "Treasury"},
        ],
    },
}

MOCK_DATASETS: list[DatasetResponse] = [
    DatasetResponse(
        id=1,
        name="recon_breaks",
        database="oracle_primary",
        schema_name="RECON",
        table_name="BREAKS",
        columns=[
            DatasetColumn(name="break_id", type="INTEGER"),
            DatasetColumn(name="entity", type="VARCHAR"),
            DatasetColumn(name="desk", type="VARCHAR"),
            DatasetColumn(name="break_amount", type="DECIMAL"),
            DatasetColumn(name="break_date", type="DATE"),
            DatasetColumn(name="status", type="VARCHAR"),
            DatasetColumn(name="aging_days", type="INTEGER"),
        ],
    ),
    DatasetResponse(
        id=2,
        name="recon_summary",
        database="oracle_primary",
        schema_name="RECON",
        table_name="DAILY_SUMMARY",
        columns=[
            DatasetColumn(name="summary_date", type="DATE"),
            DatasetColumn(name="entity", type="VARCHAR"),
            DatasetColumn(name="total_items", type="INTEGER"),
            DatasetColumn(name="matched_items", type="INTEGER"),
            DatasetColumn(name="recon_rate", type="DECIMAL"),
        ],
    ),
]

MOCK_DATASET_DATA: dict[int, dict] = {
    1: {
        "columns": [
            "break_id", "entity", "desk", "break_amount", "break_date", "status", "aging_days",
        ],
        "data": [
            {
                "break_id": 1001, "entity": "Entity A", "desk": "FX",
                "break_amount": 50000.00, "break_date": "2026-02-07",
                "status": "Unmatched", "aging_days": 2,
            },
            {
                "break_id": 1002, "entity": "Entity B", "desk": "Rates",
                "break_amount": 125000.50, "break_date": "2026-02-06",
                "status": "Escalated", "aging_days": 3,
            },
            {
                "break_id": 1003, "entity": "Entity A", "desk": "Credit",
                "break_amount": 75000.00, "break_date": "2026-02-05",
                "status": "Pending", "aging_days": 4,
            },
            {
                "break_id": 1004, "entity": "Entity C", "desk": "FX",
                "break_amount": 200000.00, "break_date": "2026-02-04",
                "status": "Unmatched", "aging_days": 5,
            },
            {
                "break_id": 1005, "entity": "Entity D", "desk": "Rates",
                "break_amount": 30000.25, "break_date": "2026-02-03",
                "status": "Matched", "aging_days": 6,
            },
        ],
    },
    2: {
        "columns": [
            "summary_date", "entity", "total_items", "matched_items", "recon_rate",
        ],
        "data": [
            {
                "summary_date": "2026-02-07", "entity": "Entity A",
                "total_items": 500, "matched_items": 478, "recon_rate": 0.956,
            },
            {
                "summary_date": "2026-02-07", "entity": "Entity B",
                "total_items": 300, "matched_items": 285, "recon_rate": 0.950,
            },
            {
                "summary_date": "2026-02-06", "entity": "Entity A",
                "total_items": 520, "matched_items": 499, "recon_rate": 0.960,
            },
        ],
    },
}

MOCK_DATABASES: list[DatabaseResponse] = [
    DatabaseResponse(
        id=1,
        name="Oracle Primary (RECON)",
        backend="oracle",
        allow_dml=False,
        expose_in_sqllab=True,
    ),
    DatabaseResponse(
        id=2,
        name="Hive Historical",
        backend="hive",
        allow_dml=False,
        expose_in_sqllab=True,
    ),
]

MOCK_DASHBOARDS: dict[str, DashboardConfig] = {
    "recon-overview": DashboardConfig(
        id="recon-overview",
        title="Recon Overview",
        description="High-level reconciliation status across all desks and entities",
        charts=[
            ChartConfig(
                id="break-trend",
                title="Break Trend",
                type="area",
                library="ag-charts",
                dataset_id=1,
                options={"xKey": "date", "yKey": "count", "seriesGrouping": "status"},
            ),
            ChartConfig(
                id="breaks-by-type",
                title="Breaks by Type",
                type="bar",
                library="ag-charts",
                dataset_id=2,
                options={"xKey": "type", "yKey": "count"},
            ),
            ChartConfig(
                id="breaks-by-desk",
                title="Breaks by Desk",
                type="donut",
                library="ag-charts",
                dataset_id=3,
                options={"angleKey": "count", "calloutLabelKey": "desk"},
            ),
            ChartConfig(
                id="aging-distribution",
                title="Aging Distribution",
                type="bar",
                library="ag-charts",
                dataset_id=4,
                options={"xKey": "bucket", "yKey": "count", "seriesGrouping": "desk", "stacked": True},
            ),
        ],
        cross_filter_rules=[
            CrossFilterRule(
                source_chart_id="breaks-by-desk",
                source_field="desk",
                target_chart_ids=["*"],
                target_field="desk",
            ),
            CrossFilterRule(
                source_chart_id="breaks-by-type",
                source_field="type",
                target_chart_ids=["break-trend", "aging-distribution"],
                target_field="type",
            ),
        ],
        layout=[
            DashboardLayoutItem(chart_id="break-trend", row=0, col=0, width=6, height=1),
            DashboardLayoutItem(chart_id="breaks-by-type", row=0, col=6, width=6, height=1),
            DashboardLayoutItem(chart_id="breaks-by-desk", row=1, col=0, width=6, height=1),
            DashboardLayoutItem(chart_id="aging-distribution", row=1, col=6, width=6, height=1),
        ],
    ),
    "break-analysis": DashboardConfig(
        id="break-analysis",
        title="Break Analysis",
        description="Detailed break analysis with aging and velocity metrics",
        charts=[
            ChartConfig(
                id="break-trend",
                title="Break Trend",
                type="area",
                library="ag-charts",
                dataset_id=1,
                options={"xKey": "date", "yKey": "count", "seriesGrouping": "status"},
            ),
            ChartConfig(
                id="aging-distribution",
                title="Aging Distribution",
                type="bar",
                library="ag-charts",
                dataset_id=4,
                options={"xKey": "bucket", "yKey": "count", "seriesGrouping": "desk", "stacked": True},
            ),
        ],
        cross_filter_rules=[],
        layout=[
            DashboardLayoutItem(chart_id="break-trend", row=0, col=0, width=12, height=1),
            DashboardLayoutItem(chart_id="aging-distribution", row=1, col=0, width=12, height=1),
        ],
    ),
}
