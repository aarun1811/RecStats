#!/usr/bin/env python3
"""Oracle seed script for RecViz development.

Seeds recviz_* tables with data for all page phases (Settings, Datasets,
Charts, KPIs, Dashboards). Idempotent via DELETE + INSERT. Uses oracledb
directly (not SQLAlchemy ORM).

Usage:
    python scripts/seed-oracle.py
    ORACLE_DSN=localhost:1521/FREEPDB1 ORACLE_USER=recviz python scripts/seed-oracle.py
"""
from __future__ import annotations

import json
import os
import sys

import oracledb

# --------------------------------------------------------------------------- #
# Safety
# --------------------------------------------------------------------------- #
if os.environ.get("RECVIZ_ENV", "").lower() in {"prod", "production"}:
    sys.exit("REFUSE: RECVIZ_ENV=production -- seed script is dev-only.")


def _get_connection() -> oracledb.Connection:
    user = os.environ.get("ORACLE_USER", "recviz")
    password = os.environ.get("ORACLE_PASSWORD", "recviz_dev")
    dsn = os.environ.get("ORACLE_DSN", "localhost:1521/FREEPDB1")
    host = dsn.split(":")[0].split("/")[0]
    if host not in {"localhost", "127.0.0.1"}:
        sys.exit(f"REFUSE: DSN host {host!r} is not localhost.")
    return oracledb.connect(user=user, password=password, dsn=dsn)


def _jb(obj: dict | list) -> bytes:
    """Serialize to UTF-8 bytes for BLOB IS JSON columns."""
    return json.dumps(obj).encode("utf-8")


# --------------------------------------------------------------------------- #
# Seed data -- NOTE: encrypted_password values are placeholders.
# Run the encryption utility to generate real Fernet-encrypted values.
# --------------------------------------------------------------------------- #
CONNECTIONS = [
    dict(id="conn-oracle-local", name="oracle-local",
         display_name="Local Oracle (dev)", backend="oracle",
         host="localhost", port=1521, database_name="FREEPDB1",
         username="recviz", encrypted_password="PLACEHOLDER_ENCRYPT_ME",
         schema_name="", extra_params={"timeout": 30}, status="active"),
    dict(id="conn-oracle-sample", name="oracle-sample",
         display_name="Sample Oracle (multi-source test)", backend="oracle",
         host="localhost", port=1521, database_name="FREEPDB1",
         username="recviz", encrypted_password="PLACEHOLDER_ENCRYPT_ME",
         schema_name="", extra_params={"timeout": 30}, status="active"),
]

DATASETS = [
    dict(id="ds-sample-dual", name="Sample DUAL Query",
         description="Simple test query against DUAL",
         database_id="conn-oracle-local",
         sql="SELECT 1 AS val, SYSDATE AS dt FROM DUAL",
         columns=[{"name": "val", "type": "NUMBER"}, {"name": "dt", "type": "DATE"}],
         schema_version=1),
    dict(id="ds-employee-mock", name="Employee Mock Data",
         description="50-row mock employee dataset via CONNECT BY",
         database_id="conn-oracle-local",
         sql=("SELECT ROWNUM AS emp_id, 'Employee ' || ROWNUM AS name, "
              "ROUND(DBMS_RANDOM.VALUE(40000, 120000), 2) AS salary "
              "FROM DUAL CONNECT BY ROWNUM <= 50"),
         columns=[{"name": "emp_id", "type": "NUMBER"},
                  {"name": "name", "type": "VARCHAR2"},
                  {"name": "salary", "type": "NUMBER"}],
         schema_version=1),
    dict(id="ds-department-summary", name="Department Summary",
         description="Static department summary for bar/pie charts",
         database_id="conn-oracle-local",
         sql=("SELECT 'Engineering' AS dept, 42 AS headcount, 4200000 AS budget FROM DUAL "
              "UNION ALL SELECT 'Marketing', 18, 1800000 FROM DUAL "
              "UNION ALL SELECT 'Sales', 31, 3100000 FROM DUAL "
              "UNION ALL SELECT 'Support', 24, 2400000 FROM DUAL"),
         columns=[{"name": "dept", "type": "VARCHAR2"},
                  {"name": "headcount", "type": "NUMBER"},
                  {"name": "budget", "type": "NUMBER"}],
         schema_version=1),
]

CHARTS = [
    dict(id="chart-bar-dept", name="Department Budget (Bar)",
         description="Bar chart of department budgets",
         dataset_id="ds-department-summary", chart_type="bar",
         config={"vizType": "bar", "xField": "dept", "yField": "budget"}),
    dict(id="chart-pie-dept", name="Department Budget (Pie)",
         description="Pie chart of department budgets",
         dataset_id="ds-department-summary", chart_type="pie",
         config={"vizType": "pie", "angleField": "budget", "colorField": "dept"}),
    dict(id="chart-line-salary", name="Employee Salary (Line)",
         description="Line chart of employee salaries by ID",
         dataset_id="ds-employee-mock", chart_type="line",
         config={"vizType": "line", "xField": "emp_id", "yField": "salary"}),
]

KPIS = [
    dict(id="kpi-total-headcount", name="Total Headcount",
         description="Sum of headcount across all departments",
         dataset_id="ds-department-summary", metric_column="headcount",
         aggregation="sum", config={"format": "number", "prefix": ""}),
    dict(id="kpi-avg-salary", name="Average Salary",
         description="Average salary across all employees",
         dataset_id="ds-employee-mock", metric_column="salary",
         aggregation="avg", config={"format": "number", "prefix": "$"}),
]

DASHBOARDS = [
    dict(id="dash-overview", name="Department Overview",
         description="Overview dashboard with department charts and KPIs",
         schema_version=2, config={
             "schemaVersion": 2,
             "layout": [
                 {"i": "chart-bar-dept", "x": 0, "y": 0, "w": 6, "h": 4, "type": "chart"},
                 {"i": "chart-pie-dept", "x": 6, "y": 0, "w": 6, "h": 4, "type": "chart"},
                 {"i": "chart-line-salary", "x": 0, "y": 4, "w": 12, "h": 4, "type": "chart"},
                 {"i": "kpi-total-headcount", "x": 0, "y": 8, "w": 3, "h": 2, "type": "kpi"},
                 {"i": "kpi-avg-salary", "x": 3, "y": 8, "w": 3, "h": 2, "type": "kpi"},
             ],
             "filters": [], "globalFilterConfig": {},
         }),
]

DATA_SOURCES = [
    dict(id="dsrc-oracle-local", name="Local Oracle", schema_version=1,
         config={"connectionId": "conn-oracle-local", "database": "FREEPDB1"}),
]

# --------------------------------------------------------------------------- #
# Table definitions: (table, id_prefix, columns_tuple, json_columns)
# --------------------------------------------------------------------------- #
_TABLES = [
    ("recviz_connections", "conn-%",
     ("id", "name", "display_name", "backend", "host", "port", "database_name",
      "username", "encrypted_password", "schema_name", "extra_params", "status"),
     {"extra_params"}),
    ("recviz_datasets", "ds-%",
     ("id", "name", "description", "database_id", "sql", "columns", "schema_version"),
     {"columns"}),
    ("recviz_charts", "chart-%",
     ("id", "name", "description", "dataset_id", "chart_type", "config"),
     {"config"}),
    ("recviz_kpis", "kpi-%",
     ("id", "name", "description", "dataset_id", "metric_column", "aggregation", "config"),
     {"config"}),
    ("recviz_dashboards", "dash-%",
     ("id", "name", "description", "schema_version", "config"),
     {"config"}),
    ("recviz_data_sources", "dsrc-%",
     ("id", "name", "schema_version", "config"),
     {"config"}),
]

_DATA = {
    "recviz_connections": CONNECTIONS,
    "recviz_datasets": DATASETS,
    "recviz_charts": CHARTS,
    "recviz_kpis": KPIS,
    "recviz_dashboards": DASHBOARDS,
    "recviz_data_sources": DATA_SOURCES,
}


def _seed_table(cursor: oracledb.Cursor, table: str, prefix: str,
                cols: tuple[str, ...], json_cols: set[str]) -> None:
    cursor.execute(f"DELETE FROM {table} WHERE id LIKE :p", {"p": prefix})
    col_list = ", ".join(cols) + ", created_at, updated_at"
    bind_list = ", ".join(
        f":{c}" for c in cols
    ) + ", SYSTIMESTAMP, SYSTIMESTAMP"
    sql = f"INSERT INTO {table} ({col_list}) VALUES ({bind_list})"
    for row in _DATA[table]:
        params = {c: (_jb(row[c]) if c in json_cols else row[c]) for c in cols}
        cursor.execute(sql, params)
    print(f"  {table}: {len(_DATA[table])} rows")


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #
def main() -> None:
    print("Connecting to Oracle...")
    conn = _get_connection()
    cursor = conn.cursor()
    print("Seeding recviz tables...")
    try:
        for table, prefix, cols, json_cols in _TABLES:
            _seed_table(cursor, table, prefix, cols, json_cols)
        conn.commit()
        print("Done -- all tables seeded successfully.")
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    main()
