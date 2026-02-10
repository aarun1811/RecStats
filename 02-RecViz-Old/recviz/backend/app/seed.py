"""Seed script for RecViz development data.

Creates mock dashboard configs, sample chart definitions,
and sample break data for development without Oracle.

Usage:
    python -m app.seed
"""

import json
from pathlib import Path

SEED_DIR = Path(__file__).parent.parent / "seed_data"


SAMPLE_DASHBOARDS = [
    {
        "id": "dashboard-recon-overview",
        "title": "Reconciliation Overview",
        "description": "High-level view of all reconciliation processes and their statuses",
        "layout": {
            "columns": 12,
            "rows": [
                {
                    "widgets": [
                        {"type": "kpi", "chart_id": "kpi-total-breaks", "col_span": 3},
                        {"type": "kpi", "chart_id": "kpi-matched-rate", "col_span": 3},
                        {"type": "kpi", "chart_id": "kpi-pending-items", "col_span": 3},
                        {"type": "kpi", "chart_id": "kpi-avg-resolution", "col_span": 3},
                    ],
                },
                {
                    "widgets": [
                        {"type": "chart", "chart_id": "chart-breaks-by-day", "col_span": 8},
                        {"type": "chart", "chart_id": "chart-status-donut", "col_span": 4},
                    ],
                },
                {
                    "widgets": [
                        {"type": "grid", "chart_id": "grid-recent-breaks", "col_span": 12},
                    ],
                },
            ],
        },
        "filters": {
            "date_range": {"default_days": 30},
            "entity": {"values": ["Equities", "Fixed Income", "FX", "Commodities"]},
            "status": {"values": ["Open", "Matched", "Pending Review", "Resolved"]},
        },
    },
    {
        "id": "dashboard-break-analysis",
        "title": "Break Analysis",
        "description": "Detailed break analysis with drill-down capabilities",
        "layout": {
            "columns": 12,
            "rows": [
                {
                    "widgets": [
                        {"type": "chart", "chart_id": "chart-break-categories", "col_span": 6},
                        {"type": "chart", "chart_id": "chart-break-aging", "col_span": 6},
                    ],
                },
                {
                    "widgets": [
                        {"type": "chart", "chart_id": "chart-break-trend", "col_span": 12},
                    ],
                },
                {
                    "widgets": [
                        {"type": "grid", "chart_id": "grid-break-details", "col_span": 12},
                    ],
                },
            ],
        },
        "filters": {
            "date_range": {"default_days": 7},
            "category": {"values": ["Price", "Quantity", "Settlement", "Corporate Action"]},
            "priority": {"values": ["Critical", "High", "Medium", "Low"]},
        },
    },
]

SAMPLE_CHARTS = [
    {
        "id": "kpi-total-breaks",
        "title": "Total Breaks",
        "chart_type": "kpi",
        "dataset_id": "ds-breaks-summary",
        "config": {"metric": "total_breaks", "format": "number", "comparison_period": "previous_day"},
    },
    {
        "id": "kpi-matched-rate",
        "title": "Match Rate",
        "chart_type": "kpi",
        "dataset_id": "ds-breaks-summary",
        "config": {"metric": "match_rate", "format": "percent", "comparison_period": "previous_day"},
    },
    {
        "id": "kpi-pending-items",
        "title": "Pending Items",
        "chart_type": "kpi",
        "dataset_id": "ds-breaks-summary",
        "config": {"metric": "pending_count", "format": "number", "comparison_period": "previous_day"},
    },
    {
        "id": "kpi-avg-resolution",
        "title": "Avg Resolution Time",
        "chart_type": "kpi",
        "dataset_id": "ds-breaks-summary",
        "config": {"metric": "avg_resolution_hours", "format": "duration", "comparison_period": "previous_week"},
    },
    {
        "id": "chart-breaks-by-day",
        "title": "Breaks by Day",
        "chart_type": "ag-bar",
        "dataset_id": "ds-breaks-daily",
        "config": {
            "x_field": "date",
            "y_field": "count",
            "series_field": "status",
            "stacked": True,
        },
    },
    {
        "id": "chart-status-donut",
        "title": "Status Distribution",
        "chart_type": "ag-donut",
        "dataset_id": "ds-breaks-summary",
        "config": {"angle_field": "count", "color_field": "status"},
    },
    {
        "id": "chart-break-categories",
        "title": "Break Categories",
        "chart_type": "ag-bar",
        "dataset_id": "ds-break-categories",
        "config": {"x_field": "category", "y_field": "count", "direction": "horizontal"},
    },
    {
        "id": "chart-break-aging",
        "title": "Break Aging",
        "chart_type": "ag-bar",
        "dataset_id": "ds-break-aging",
        "config": {
            "x_field": "age_bucket",
            "y_field": "count",
            "series_field": "priority",
            "stacked": True,
        },
    },
    {
        "id": "chart-break-trend",
        "title": "Break Trend (30 Days)",
        "chart_type": "ag-line",
        "dataset_id": "ds-breaks-daily",
        "config": {
            "x_field": "date",
            "y_field": "count",
            "series_field": "category",
        },
    },
]

SAMPLE_BREAKS = [
    {
        "id": f"BRK-2024-{i:05d}",
        "date": f"2024-12-{(i % 28) + 1:02d}",
        "entity": ["Equities", "Fixed Income", "FX", "Commodities"][i % 4],
        "category": ["Price", "Quantity", "Settlement", "Corporate Action"][i % 4],
        "status": ["Open", "Matched", "Pending Review", "Resolved"][i % 4],
        "priority": ["Critical", "High", "Medium", "Low"][i % 4],
        "amount": round(1000 + (i * 137.5) % 50000, 2),
        "counterparty": f"Counterparty-{(i % 10) + 1}",
        "instrument": f"ISIN-{i % 20:04d}",
        "age_days": i % 45,
    }
    for i in range(100)
]


def seed() -> None:
    """Write seed data JSON files to seed_data/ directory."""
    SEED_DIR.mkdir(parents=True, exist_ok=True)

    dashboards_path = SEED_DIR / "dashboards.json"
    dashboards_path.write_text(json.dumps(SAMPLE_DASHBOARDS, indent=2))
    print(f"  Wrote {len(SAMPLE_DASHBOARDS)} dashboards -> {dashboards_path}")

    charts_path = SEED_DIR / "charts.json"
    charts_path.write_text(json.dumps(SAMPLE_CHARTS, indent=2))
    print(f"  Wrote {len(SAMPLE_CHARTS)} charts -> {charts_path}")

    breaks_path = SEED_DIR / "sample_breaks.json"
    breaks_path.write_text(json.dumps(SAMPLE_BREAKS, indent=2))
    print(f"  Wrote {len(SAMPLE_BREAKS)} sample breaks -> {breaks_path}")

    print("Seed data written successfully.")


if __name__ == "__main__":
    seed()
