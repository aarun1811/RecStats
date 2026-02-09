"""Mock data for development/testing when Superset isn't available."""

from app.models.chart_data import ChartDefinition
from app.models.dashboard import ChartLayout, CrossFilterRule, DashboardConfig
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

MOCK_CHART_DATA: dict[int, dict] = {
    1: {
        "columns": ["entity", "break_amount", "break_count"],
        "data": [
            {"entity": "Entity A", "break_amount": 1250000.50, "break_count": 42},
            {"entity": "Entity B", "break_amount": 875000.25, "break_count": 31},
            {"entity": "Entity C", "break_amount": 2100000.00, "break_count": 67},
            {"entity": "Entity D", "break_amount": 430000.75, "break_count": 18},
        ],
    },
    2: {
        "columns": ["date", "recon_rate", "matched", "total"],
        "data": [
            {"date": "2026-02-03", "recon_rate": 0.945, "matched": 1890, "total": 2000},
            {"date": "2026-02-04", "recon_rate": 0.952, "matched": 1904, "total": 2000},
            {"date": "2026-02-05", "recon_rate": 0.938, "matched": 1876, "total": 2000},
            {"date": "2026-02-06", "recon_rate": 0.961, "matched": 1922, "total": 2000},
            {"date": "2026-02-07", "recon_rate": 0.957, "matched": 1914, "total": 2000},
        ],
    },
    3: {
        "columns": ["status", "count", "percentage"],
        "data": [
            {"status": "Matched", "count": 9150, "percentage": 0.915},
            {"status": "Unmatched", "count": 520, "percentage": 0.052},
            {"status": "Pending", "count": 230, "percentage": 0.023},
            {"status": "Escalated", "count": 100, "percentage": 0.010},
        ],
    },
    4: {
        "columns": ["entity", "desk", "aging_days", "amount"],
        "data": [
            {"entity": "Entity A", "desk": "FX", "aging_days": 3, "amount": 250000},
            {"entity": "Entity A", "desk": "Rates", "aging_days": 7, "amount": 180000},
            {"entity": "Entity B", "desk": "FX", "aging_days": 1, "amount": 95000},
            {"entity": "Entity B", "desk": "Credit", "aging_days": 14, "amount": 420000},
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
        name="Reconciliation Overview",
        description="High-level view of reconciliation status across all entities",
        charts=[
            ChartLayout(chart_id=1, x=0, y=0, w=6, h=4),
            ChartLayout(chart_id=2, x=6, y=0, w=6, h=4),
            ChartLayout(chart_id=3, x=0, y=4, w=4, h=4),
            ChartLayout(chart_id=4, x=4, y=4, w=8, h=4),
        ],
        cross_filter_rules=[
            CrossFilterRule(
                source_chart_id=1,
                target_chart_ids=[2, 3, 4],
                column_mapping={"entity": "entity"},
            ),
        ],
        default_filters={},
    ),
    "break-analysis": DashboardConfig(
        id="break-analysis",
        name="Break Analysis",
        description="Detailed break analysis with aging and velocity metrics",
        charts=[
            ChartLayout(chart_id=1, x=0, y=0, w=12, h=4),
            ChartLayout(chart_id=4, x=0, y=4, w=12, h=4),
        ],
        cross_filter_rules=[],
        default_filters={},
    ),
}
