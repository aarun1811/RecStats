"""Register test datasets in RecViz for chart builder testing.

Uses the actual tables in recon_data (showcase_* and business tables).

Prerequisites:
  1. Docker services running (Redis, PostgreSQL)
  2. Superset running
  3. FastAPI backend running on localhost:8000

Usage:
  python seed/register_test_datasets.py
"""

import sys
import httpx

API = "http://localhost:8000"
DATABASE_ID = 1  # superset_db_TCOSPRD — points to recon_data

DATASETS = [
    {
        "name": "Department Revenue & Headcount",
        "description": "Revenue and headcount by department — good for bar, stacked-bar, combo, and treemap",
        "sql": "SELECT department, revenue, headcount FROM showcase_categories",
        "columns": [
            {"name": "department", "displayName": "Department", "dataType": "string", "role": "dimension"},
            {"name": "revenue", "displayName": "Revenue", "dataType": "currency", "role": "measure", "aggregation": "SUM"},
            {"name": "headcount", "displayName": "Headcount", "dataType": "number", "role": "measure", "aggregation": "SUM"},
        ],
    },
    {
        "name": "Monthly Processing Trends",
        "description": "Monthly processed vs exception counts — ideal for line, area, and combo charts",
        "sql": "SELECT month_label, sort_order, processed_count, exception_count FROM showcase_timeseries ORDER BY sort_order",
        "columns": [
            {"name": "month_label", "displayName": "Month", "dataType": "string", "role": "dimension"},
            {"name": "sort_order", "displayName": "Sort Order", "dataType": "number", "role": "none"},
            {"name": "processed_count", "displayName": "Processed", "dataType": "number", "role": "measure", "aggregation": "SUM"},
            {"name": "exception_count", "displayName": "Exceptions", "dataType": "number", "role": "measure", "aggregation": "SUM"},
        ],
    },
    {
        "name": "Item Status Distribution",
        "description": "Item counts by status — perfect for pie, donut, and funnel charts",
        "sql": "SELECT status, item_count FROM showcase_distribution ORDER BY item_count DESC",
        "columns": [
            {"name": "status", "displayName": "Status", "dataType": "string", "role": "dimension"},
            {"name": "item_count", "displayName": "Item Count", "dataType": "number", "role": "measure", "aggregation": "SUM"},
        ],
    },
    {
        "name": "Processing Performance Scatter",
        "description": "Processing time vs record count with error rates — designed for scatter charts",
        "sql": "SELECT processing_time_ms, record_count, error_rate FROM showcase_scatter",
        "columns": [
            {"name": "processing_time_ms", "displayName": "Processing Time (ms)", "dataType": "number", "role": "measure"},
            {"name": "record_count", "displayName": "Record Count", "dataType": "number", "role": "measure", "aggregation": "SUM"},
            {"name": "error_rate", "displayName": "Error Rate", "dataType": "number", "role": "measure", "aggregation": "AVG"},
        ],
    },
    {
        "name": "Match Activity Heatmap",
        "description": "Match counts by day-of-week and hour — designed for heatmap charts",
        "sql": "SELECT day_of_week, hour_slot, match_count FROM showcase_heatmap",
        "columns": [
            {"name": "day_of_week", "displayName": "Day of Week", "dataType": "string", "role": "dimension"},
            {"name": "hour_slot", "displayName": "Hour", "dataType": "string", "role": "dimension"},
            {"name": "match_count", "displayName": "Match Count", "dataType": "number", "role": "measure", "aggregation": "SUM"},
        ],
    },
    {
        "name": "Entity Volume Treemap",
        "description": "Entity volumes and net changes — designed for treemap charts",
        "sql": "SELECT entity_name, total_volume, net_change FROM showcase_treemap",
        "columns": [
            {"name": "entity_name", "displayName": "Entity", "dataType": "string", "role": "dimension"},
            {"name": "total_volume", "displayName": "Total Volume", "dataType": "currency", "role": "measure", "aggregation": "SUM"},
            {"name": "net_change", "displayName": "Net Change", "dataType": "currency", "role": "measure", "aggregation": "SUM"},
        ],
    },
    {
        "name": "P&L Waterfall",
        "description": "Income statement line items — designed for waterfall charts",
        "sql": "SELECT line_item, amount FROM showcase_waterfall ORDER BY sort_order",
        "columns": [
            {"name": "line_item", "displayName": "Line Item", "dataType": "string", "role": "dimension"},
            {"name": "amount", "displayName": "Amount", "dataType": "currency", "role": "measure", "aggregation": "SUM"},
        ],
    },
    {
        "name": "Recon Pipeline Funnel",
        "description": "Processing pipeline stage counts — designed for funnel charts (ECharts)",
        "sql": "SELECT stage, count FROM showcase_funnel ORDER BY count DESC",
        "columns": [
            {"name": "stage", "displayName": "Stage", "dataType": "string", "role": "dimension"},
            {"name": "count", "displayName": "Count", "dataType": "number", "role": "measure", "aggregation": "SUM"},
        ],
    },
    {
        "name": "Recon Flow Sankey",
        "description": "Source-to-target reconciliation flows — designed for Sankey charts (ECharts)",
        "sql": "SELECT source, target, value FROM showcase_sankey",
        "columns": [
            {"name": "source", "displayName": "Source", "dataType": "string", "role": "dimension"},
            {"name": "target", "displayName": "Target", "dataType": "string", "role": "dimension"},
            {"name": "value", "displayName": "Value", "dataType": "number", "role": "measure", "aggregation": "SUM"},
        ],
    },
    {
        "name": "Quality Metrics Radar",
        "description": "Quality scores vs benchmarks — designed for radar charts (ECharts)",
        "sql": "SELECT metric_name, score, benchmark FROM showcase_radar",
        "columns": [
            {"name": "metric_name", "displayName": "Metric", "dataType": "string", "role": "dimension"},
            {"name": "score", "displayName": "Score", "dataType": "number", "role": "measure"},
            {"name": "benchmark", "displayName": "Benchmark", "dataType": "number", "role": "measure"},
        ],
    },
    {
        "name": "System Health Gauge",
        "description": "Single-value system health metrics — designed for gauge charts (ECharts)",
        "sql": "SELECT metric_name, value FROM showcase_gauge",
        "columns": [
            {"name": "metric_name", "displayName": "Metric", "dataType": "string", "role": "dimension"},
            {"name": "value", "displayName": "Value", "dataType": "number", "role": "measure"},
        ],
    },
]


def register_datasets():
    created = 0
    skipped = 0

    with httpx.Client(base_url=API, timeout=30) as client:
        # Check API is reachable
        try:
            resp = client.get("/api/datasets/managed")
            resp.raise_for_status()
            existing = {d["name"] for d in resp.json()}
        except httpx.ConnectError:
            print(f"ERROR: Cannot connect to {API}. Is the backend running?")
            sys.exit(1)

        for ds in DATASETS:
            if ds["name"] in existing:
                print(f"  SKIP  {ds['name']} (already exists)")
                skipped += 1
                continue

            payload = {
                "name": ds["name"],
                "description": ds["description"],
                "databaseId": DATABASE_ID,
                "sql": ds["sql"],
                "columns": ds["columns"],
            }

            resp = client.post("/api/datasets/managed", json=payload)
            if resp.status_code in (200, 201):
                sync = resp.json().get("syncStatus", "?")
                print(f"  OK    {ds['name']}  (sync: {sync})")
                created += 1
            else:
                print(f"  FAIL  {ds['name']} — {resp.status_code}: {resp.text[:200]}")

    print(f"\nDone: {created} created, {skipped} skipped")


if __name__ == "__main__":
    print("Registering test datasets in RecViz...\n")
    register_datasets()
