#!/usr/bin/env python3
"""Seed the dash-di-stats RecViz dashboard (datasets + chart library + dashboard).
Self-contained and SEPARATE from setup-tlm-citi.py: it does NOT create connections
or handle passwords -- it REFERENCES the connections setup-tlm-citi.py already
created. Run setup-tlm-citi.py FIRST, then this. Reuses the same citi-tlm.json."""
import argparse
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import oracledb
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

logger = logging.getLogger("setup-di-citi")
logging.basicConfig(level=logging.INFO, format="%(message)s")


def _col(name, display, dtype, role, agg="NONE", fp="none", fs=""):
    return {"name": name, "display_name": display, "data_type": dtype, "role": role,
            "aggregation": agg, "format_preset": fp, "format_string": fs}


def _layout(col, row, w, h):
    return {"col": col, "row": row, "width": w, "height": h}


def init_oracle_thick(client_lib_dir: str) -> None:
    try:
        oracledb.init_oracle_client(lib_dir=client_lib_dir)
        logger.info("Oracle thick mode initialized (lib_dir=%s)", client_lib_dir)
    except Exception as exc:
        if "already initialized" in str(exc).lower() or "DPI-1072" in str(exc):
            return
        raise


def verify_recviz_db(url: str) -> Engine:
    engine = create_engine(url, pool_pre_ping=True, pool_size=2, max_overflow=2)
    with engine.connect() as conn:
        conn.execute(text("SELECT 1 FROM dual")).scalar()
        rows = conn.execute(text(
            "SELECT table_name FROM user_tables WHERE table_name IN "
            "('RECVIZ_CONNECTIONS','RECVIZ_DATASETS','RECVIZ_DASHBOARDS','RECVIZ_CHARTS')"
        )).fetchall()
    present = {r[0] for r in rows}
    missing = {"RECVIZ_CONNECTIONS", "RECVIZ_DATASETS", "RECVIZ_DASHBOARDS", "RECVIZ_CHARTS"} - present
    if missing:
        raise RuntimeError(f"RecViz catalog tables missing: {missing}. Run alembic migrations first.")
    logger.info("  OK recviz_* catalog tables present")
    return engine


def load_instance_mapping(config_path: Path) -> dict[str, str]:
    """Rebuild the {tlm_instance LABEL: connection name} routing map from the SAME
    citi-tlm.json the TLM seeder used. Mirrors setup-tlm-citi.py load_config naming:
    label = key.upper(); name = label.lower().replace(' ', '_')."""
    raw = json.loads(config_path.read_text())
    if not raw.get("tlm_instances"):
        raise ValueError("Config missing top-level 'tlm_instances' object")
    mapping: dict[str, str] = {}
    for key in raw["tlm_instances"]:
        label = key.upper()
        mapping[label] = label.lower().replace(" ", "_")
    return mapping


def lookup_database_id(engine: Engine, first_name: str) -> str:
    """A dataset's database_id FK must reference a real recviz_connections row.
    Dynamic routing overrides it per-query, so any existing TLM connection id works;
    use the first instance's connection (created by setup-tlm-citi.py)."""
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT id FROM recviz_connections WHERE name = :n"), {"n": first_name}
        ).fetchone()
    if not row:
        raise RuntimeError(
            f"Connection '{first_name}' not found in recviz_connections -- "
            "run setup-tlm-citi.py first (it creates the connections)."
        )
    return row[0]


# ---- DI dashboard (recon/set_id/tlm_instance-keyed message dashboard) ----
DI_DASHBOARD_ID = "dash-di-stats"
DS_DI_MESSAGES_ID = "ds-di-messages"      # raw message rows -> grid + set_id cascade
DS_DI_KPIS_ID = "ds-di-kpis"              # single-row aggregate -> 4 KPIs
DS_DI_BY_STATUS_ID = "ds-di-by-status"    # grouped -> status donut
DS_DI_BY_ERROR_ID = "ds-di-by-error-status"  # grouped -> error-status donut
DS_DI_BY_TYPE_ID = "ds-di-by-type"        # grouped -> message-type donut
DS_DI_BY_SETID_ID = "ds-di-by-set-id"     # grouped -> messages-per-set_id bar
DS_DI_BY_FILE_ID = "ds-di-by-file"        # grouped -> messages-per-file bar

CHART_DI_STATUS_ID = "chart-di-status"
CHART_DI_ERROR_ID = "chart-di-error-status"
CHART_DI_TYPE_ID = "chart-di-type"
CHART_DI_SETID_ID = "chart-di-set-id"
CHART_DI_FILE_ID = "chart-di-file"

# Decode CTE BODY: turns LOAD_FLAG / STATUS / MLNV codes into english labels.
# Defined WITHOUT the leading "WITH" so each dataset can compose it explicitly
# (alone, or alongside a second `base` CTE) — no fragile string-splicing.
_DI_DECODE_BODY = (
    "decode AS ( "
    "  SELECT DISTINCT b.english, a.value, c.attribute "
    "  FROM zs_db_schema c, zs_attribute d, zs_decode a, emsg b, zs_entity e "
    "  WHERE c.db_schema_id = d.db_schema_id "
    "    AND a.attribute_id = d.attribute_id "
    "    AND b.id = a.emsg_id "
    "    AND e.entity_id = c.entity_id "
    "    AND UPPER(e.entity) = 'MESSAGE_HEADER' "
    "    AND alias = 'MH' "
    "    AND UPPER(c.attribute) IN ('LOAD_FLAG', 'STATUS', 'MLNV') "
    ") "
)

# Shared FROM + recon-scoped WHERE. {{filters}} is where the query engine injects
# the recon (b.agent_code) + optional set_id (b.local_acc_no) predicates. The fixed
# last-~2-days window (f.started > TRUNC(SYSDATE-1)) is the legacy parity window.
_DI_FROM_WHERE = (
    "FROM message_header mh "
    "LEFT OUTER JOIN fils f ON f.file_id = mh.file_id "
    "LEFT OUTER JOIN bank b ON b.corr_acc_no = mh.corr_acc_no "
    "WHERE f.started > TRUNC(SYSDATE - 1) {{filters}} "
)

# Same recon/set_id filter mappings for every DI dataset. Single-value {{value}}
# (DI filters are single-select). NOTE the surrounding quotes: query_engine._build_sql
# substitutes {{value}} with the escaped-but-UNQUOTED value (only {{values}} adds
# quotes), so a string predicate MUST wrap it in quotes itself -> 'b.agent_code = '{{value}}''
# becomes b.agent_code = 'ABC123'. The engine escapes any embedded quote (' -> ''),
# so wrapping is safe. tlm_instance is a no-op predicate (routing selects the
# connection). set_id is OPTIONAL -> when unset the engine drops the predicate.
_DI_FILTER_MAPPINGS = [
    {"filter_id": "tlm_instance", "sql_expr": "1=1"},
    {"filter_id": "recon", "sql_expr": "b.agent_code = '{{value}}'"},
    {"filter_id": "set_id", "sql_expr": "b.local_acc_no IN ({{values}})"},
]

# Category SQL expressions for the 5 grouped/distribution datasets.
_DI_CAT_STATUS = "(SELECT english FROM decode WHERE value = mh.load_flag AND attribute = 'load_flag')"
_DI_CAT_ERROR = "(SELECT english FROM decode WHERE value = mh.status AND attribute = 'status')"
_DI_CAT_TYPE = "(SELECT english FROM decode WHERE value = mh.mlnv AND attribute = 'mlnv')"
_DI_CAT_SETID = "b.local_acc_no"
_DI_CAT_FILE = "f.filename"


def build_dataset_di_messages(default_database_id: str, mapping: dict[str, str]) -> dict:
    """ds-di-messages -- raw message rows for the grid + the set_id cascade.
    Dynamic-routed by tlm_instance. Recon-scoped via {{filters}}."""
    sql = (
        "WITH " + _DI_DECODE_BODY
        + "SELECT "
        "  sys_context('USERENV', 'DB_NAME') AS tlm_instance, "
        "  b.agent_code, "
        "  b.local_acc_no AS set_id, "
        "  mh.sub_acc_no AS data_message_reconciliation_feed, "
        + _DI_CAT_STATUS + " AS data_message_status, "
        + _DI_CAT_ERROR + " AS data_message_error_status, "
        + _DI_CAT_TYPE + " AS data_message_type, "
        "  mh.short_code AS data_message_short_code, "
        "  mh.stmt_date AS data_message_statement_date, "
        "  mh.currency AS data_message_currency, "
        "  mh.stock_code AS data_message_asset_code, "
        "  mh.stmt_no AS data_message_statement_number, "
        "  mh.stmt_no AS data_message_statement_page, "          # ?? OCR: confirm vs mh.stmt_page (Task 6)
        "  mh.no_parts AS data_message_number_of_parts, "
        "  mh.opening_balance AS data_message_opening_balance, "
        "  mh.opening_bal_type AS data_message_opening_balance_type, "
        "  mh.opening_bal_date AS data_message_opening_balance_date, "
        "  mh.closing_balance AS data_message_closing_balance, "
        "  mh.closing_bal_type AS data_message_closing_balance_type, "
        "  mh.closing_bal_date AS data_message_closing_balance_date, "
        "  mh.sys_entry_date AS data_message_system_entry_date, "
        "  mh.terminal_id AS data_message_origination, "
        "  mh.destination_id AS data_message_destination, "
        "  mh.message_ref AS data_message_reference, "
        "  mh.message_ref AS data_message_related_reference, "   # ?? OCR: confirm vs mh.related_ref (Task 6)
        "  mh.side AS data_message_side, "
        "  mh.user_id AS data_message_input_owner, "
        "  mh.user_id1 AS data_message_authorising_owner, "
        "  mh.message_no AS data_message_internal_id, "
        "  f.file_id AS data_load_internal_id, "
        "  f.filename AS data_load_name "
        + _DI_FROM_WHERE
        + "ORDER BY f.started DESC"
    )
    return {
        "id": DS_DI_MESSAGES_ID,
        "name": "DI Messages",
        "description": "Raw message rows for the DI dashboard grid + set_id cascade. Recon-scoped, dynamic-routed by tlm_instance.",
        "database_id": default_database_id,
        "sql": sql,
        "columns": [
            _col("tlm_instance", "TLM Instance", "string", "dimension"),
            _col("agent_code", "Recon", "string", "dimension"),
            _col("set_id", "Set ID", "string", "dimension"),
            _col("data_message_reconciliation_feed", "Recon Feed", "string", "dimension"),
            _col("data_message_status", "Status", "string", "dimension"),
            _col("data_message_error_status", "Error Status", "string", "dimension"),
            _col("data_message_type", "Message Type", "string", "dimension"),
            _col("data_message_short_code", "Short Code", "string", "dimension"),
            _col("data_message_statement_date", "Statement Date", "date", "time"),
            _col("data_message_currency", "Currency", "string", "dimension"),
            _col("data_message_asset_code", "Asset Code", "string", "dimension"),
            _col("data_message_statement_number", "Statement No", "string", "dimension"),
            _col("data_message_statement_page", "Statement Page", "string", "dimension"),
            _col("data_message_number_of_parts", "No. of Parts", "number", "measure", "SUM", "number"),
            _col("data_message_opening_balance", "Opening Balance", "number", "measure", "SUM", "number"),
            _col("data_message_opening_balance_type", "Opening Bal Type", "string", "dimension"),
            _col("data_message_opening_balance_date", "Opening Bal Date", "date", "time"),
            _col("data_message_closing_balance", "Closing Balance", "number", "measure", "SUM", "number"),
            _col("data_message_closing_balance_type", "Closing Bal Type", "string", "dimension"),
            _col("data_message_closing_balance_date", "Closing Bal Date", "date", "time"),
            _col("data_message_system_entry_date", "System Entry Date", "date", "time"),
            _col("data_message_origination", "Origination", "string", "dimension"),
            _col("data_message_destination", "Destination", "string", "dimension"),
            _col("data_message_reference", "Reference", "string", "dimension"),
            _col("data_message_related_reference", "Related Reference", "string", "dimension"),
            _col("data_message_side", "Side", "string", "dimension"),
            _col("data_message_input_owner", "Input Owner", "string", "dimension"),
            _col("data_message_authorising_owner", "Authorising Owner", "string", "dimension"),
            _col("data_message_internal_id", "Message Internal ID", "string", "dimension"),
            _col("data_load_internal_id", "Load Internal ID", "number", "dimension"),
            _col("data_load_name", "Load Name", "string", "dimension"),
        ],
        "filter_mappings": _DI_FILTER_MAPPINGS,
        "database_routing": {"type": "dynamic", "route_by_filter": "tlm_instance", "mapping": mapping},
    }


def build_dataset_di_kpis(default_database_id: str, mapping: dict[str, str]) -> dict:
    """ds-di-kpis -- ONE row of pre-computed aggregates for the 4 KPIs.
    Pre-aggregated in SQL (COUNT_DISTINCT is not available client-side) and
    cap-safe (always returns 1 row regardless of message volume).
    The decoded message_type is computed inside a `base` CTE and then counted by
    its ALIAS -- COUNT(DISTINCT <correlated scalar subquery>) is not safe in
    Oracle, so we never nest the subquery inside the aggregate."""
    sql = (
        "WITH " + _DI_DECODE_BODY
        + ", base AS ( SELECT "
        "    b.local_acc_no AS set_id, "
        + _DI_CAT_TYPE + " AS message_type, "
        "    mh.currency AS currency "
        + _DI_FROM_WHERE
        + ") "
        "SELECT "
        "  COUNT(*) AS total_messages, "
        "  COUNT(DISTINCT set_id) AS distinct_set_ids, "
        "  COUNT(DISTINCT message_type) AS distinct_message_types, "
        "  COUNT(DISTINCT currency) AS distinct_currencies "
        "FROM base"
    )
    return {
        "id": DS_DI_KPIS_ID,
        "name": "DI KPIs",
        "description": "Single-row aggregate (total messages, distinct set_ids/types/currencies) for the DI KPI cards. Recon-scoped, dynamic-routed by tlm_instance.",
        "database_id": default_database_id,
        "sql": sql,
        "columns": [
            _col("total_messages", "Total Messages", "number", "measure", "SUM", "number"),
            _col("distinct_set_ids", "Distinct Set IDs", "number", "measure", "SUM", "number"),
            _col("distinct_message_types", "Distinct Message Types", "number", "measure", "SUM", "number"),
            _col("distinct_currencies", "Distinct Currencies", "number", "measure", "SUM", "number"),
        ],
        "filter_mappings": _DI_FILTER_MAPPINGS,
        "database_routing": {"type": "dynamic", "route_by_filter": "tlm_instance", "mapping": mapping},
    }


def build_dataset_di_group(
    ds_id: str, name: str, category_expr: str, default_database_id: str,
    mapping: dict[str, str], top_n: int | None = None
) -> dict:
    """A pre-grouped distribution dataset: (category, count). Server-side GROUP BY
    so the result is tiny (cap-safe). `category_expr` is one of the _DI_CAT_* exprs.
    Composes the decode CTE + a `base` CTE explicitly (no string-splicing). The
    category is COALESCEd so a decode miss shows as '(unknown)' rather than a NULL
    slice that GROUP BY would otherwise produce. When `top_n` is set, only the top-N
    categories by count are kept and the rest are bucketed into 'Others' server-side
    (so high-cardinality dimensions like set_id / file don't render 50+ slices)."""
    base_cte = (
        "WITH " + _DI_DECODE_BODY
        + ", base AS ( SELECT COALESCE(" + category_expr + ", '(unknown)') AS category "
        + _DI_FROM_WHERE
        + ") "
    )
    if top_n is None:
        sql = base_cte + "SELECT category, COUNT(*) AS count FROM base GROUP BY category ORDER BY count DESC"
    else:
        n = str(int(top_n))
        sql = (
            base_cte
            + ", grouped AS ( SELECT category, COUNT(*) AS cnt FROM base GROUP BY category ) "
            + ", ranked AS ( SELECT category, cnt, ROW_NUMBER() OVER (ORDER BY cnt DESC) AS rn FROM grouped ) "
            + "SELECT CASE WHEN rn <= " + n + " THEN category ELSE 'Others' END AS category, SUM(cnt) AS count "
            + "FROM ranked GROUP BY CASE WHEN rn <= " + n + " THEN category ELSE 'Others' END "
            + "ORDER BY count DESC"
        )
    return {
        "id": ds_id,
        "name": name,
        "description": name + " distribution (category, count) for the DI dashboard. Recon-scoped, dynamic-routed by tlm_instance.",
        "database_id": default_database_id,
        "sql": sql,
        "columns": [
            _col("category", "Category", "string", "dimension"),
            _col("count", "Count", "number", "measure", "SUM", "number"),
        ],
        "filter_mappings": _DI_FILTER_MAPPINGS,
        "database_routing": {"type": "dynamic", "route_by_filter": "tlm_instance", "mapping": mapping},
    }


def _di_chart(chart_id: str, name: str, dataset_id: str, chart_type: str,
              series_colors: list[str]) -> dict:
    """A chart-library (recviz_charts) entry. categoryColumn/metricColumns live
    here (a dashboard chart cannot carry them inline). category/count match the
    grouped dataset's columns."""
    type_specific = {f"seriesColor_{i}": c for i, c in enumerate(series_colors)}
    if chart_type == "donut":
        type_specific.update({"donutInnerRadius": 0.5, "donutLabelPosition": "outside"})
    return {
        "id": chart_id,
        "name": name,
        "description": name + " distribution.",
        "dataset_id": dataset_id,
        "chart_type": chart_type,
        "config": {
            "columnMapping": {"categoryColumn": "category", "metricColumns": ["count"], "aggregations": {}},
            "appearance": {
                "title": name,
                "showLegend": True,
                "legendPosition": "bottom",
                "showXLabel": chart_type == "bar",
                "showYLabel": chart_type == "bar",
                "typeSpecific": type_specific,
            },
        },
    }


DI_CHARTS = [
    _di_chart(CHART_DI_STATUS_ID, "Status", DS_DI_BY_STATUS_ID, "donut",
              ["--chart-positive", "--chart-warning", "--series-3", "--series-4", "--series-5"]),
    _di_chart(CHART_DI_ERROR_ID, "Error Status", DS_DI_BY_ERROR_ID, "donut",
              ["--chart-1", "--chart-warning", "--series-3", "--series-4", "--series-5"]),
    _di_chart(CHART_DI_TYPE_ID, "Message Type", DS_DI_BY_TYPE_ID, "donut",
              ["--chart-1", "--series-2", "--series-3", "--series-4", "--series-5"]),
    _di_chart(CHART_DI_SETID_ID, "Messages per Set ID", DS_DI_BY_SETID_ID, "bar",
              ["--chart-1"]),
    _di_chart(CHART_DI_FILE_ID, "Messages per File", DS_DI_BY_FILE_ID, "treemap",
              ["--series-2"]),
]

DI_DASHBOARD_CONFIG = {
    "id": DI_DASHBOARD_ID,
    "name": "DI Statistics",
    "description": "Per-recon message-level statistics (status, type, set_id, file) for the filtered scope.",
    "features": {"crossFilter": False, "drillDown": False},
    "filters": [
        {"id": "tlm_instance", "label": "TLM Instance", "type": "single-select", "lockable": True,
         "optionsSource": {"dataSourceId": DS_DI_MESSAGES_ID, "valueColumn": "tlm_instance", "dependsOn": {}},
         "options": [], "defaultValue": None},
        {"id": "recon", "label": "Recon", "type": "single-select", "lockable": True,
         "optionsSource": {"dataSourceId": DS_DI_MESSAGES_ID, "valueColumn": "agent_code",
                           "dependsOn": {"tlm_instance": "tlm_instance"}},
         "options": [], "defaultValue": None},
        {"id": "set_id", "label": "Set ID", "type": "multi-select", "lockable": True,
         "optionsSource": {"dataSourceId": DS_DI_MESSAGES_ID, "valueColumn": "set_id",
                           "dependsOn": {"tlm_instance": "tlm_instance", "recon": "agent_code"}},
         "options": [], "defaultValue": None},
    ],
    "kpis": [
        {"id": "kpi-di-total-messages", "label": "Total Messages", "format": "number",
         "sources": [{"dataSourceId": DS_DI_KPIS_ID, "metric": "total_messages"}],
         "aggregation": "SUM", "accentColor": "--chart-1"},
        {"id": "kpi-di-distinct-set-ids", "label": "Distinct Set IDs", "format": "number",
         "sources": [{"dataSourceId": DS_DI_KPIS_ID, "metric": "distinct_set_ids"}],
         "aggregation": "SUM", "accentColor": "--series-2"},
        {"id": "kpi-di-distinct-types", "label": "Distinct Message Types", "format": "number",
         "sources": [{"dataSourceId": DS_DI_KPIS_ID, "metric": "distinct_message_types"}],
         "aggregation": "SUM", "accentColor": "--series-3"},
        {"id": "kpi-di-distinct-currencies", "label": "Distinct Currencies", "format": "number",
         "sources": [{"dataSourceId": DS_DI_KPIS_ID, "metric": "distinct_currencies"}],
         "aggregation": "SUM", "accentColor": "--series-4"},
    ],
    "charts": [
        {"id": CHART_DI_STATUS_ID, "title": "Status", "type": "donut", "sourceType": "query",
         "chartId": CHART_DI_STATUS_ID, "sources": [{"dataSourceId": DS_DI_BY_STATUS_ID}],
         "layout": _layout(0, 1, 4, 4)},
        {"id": CHART_DI_ERROR_ID, "title": "Error Status", "type": "donut", "sourceType": "query",
         "chartId": CHART_DI_ERROR_ID, "sources": [{"dataSourceId": DS_DI_BY_ERROR_ID}],
         "layout": _layout(4, 1, 4, 4)},
        {"id": CHART_DI_TYPE_ID, "title": "Message Type", "type": "donut", "sourceType": "query",
         "chartId": CHART_DI_TYPE_ID, "sources": [{"dataSourceId": DS_DI_BY_TYPE_ID}],
         "layout": _layout(8, 1, 4, 4)},
        {"id": CHART_DI_SETID_ID, "title": "Messages per Set ID", "type": "bar", "sourceType": "query",
         "chartId": CHART_DI_SETID_ID, "sources": [{"dataSourceId": DS_DI_BY_SETID_ID}],
         "layout": _layout(0, 5, 6, 4)},
        {"id": CHART_DI_FILE_ID, "title": "Messages per File", "type": "treemap", "sourceType": "query",
         "chartId": CHART_DI_FILE_ID, "sources": [{"dataSourceId": DS_DI_BY_FILE_ID}],
         "layout": _layout(6, 5, 6, 4)},
    ],
    "grids": [
        {"id": "grid-di-messages", "title": "Messages",
         "dataSourceId": DS_DI_MESSAGES_ID,
         "columns": [
             {"field": "agent_code", "header": "Recon", "type": "string"},
             {"field": "set_id", "header": "Set ID", "type": "string"},
             {"field": "data_message_status", "header": "Status", "type": "string"},
             {"field": "data_message_error_status", "header": "Error Status", "type": "string"},
             {"field": "data_message_type", "header": "Message Type", "type": "string"},
             {"field": "data_message_currency", "header": "Currency", "type": "string"},
             {"field": "data_message_statement_date", "header": "Statement Date", "type": "date"},
             {"field": "data_message_statement_number", "header": "Statement No", "type": "string"},
             {"field": "data_message_reference", "header": "Reference", "type": "string"},
             {"field": "data_message_side", "header": "Side", "type": "string"},
             {"field": "data_load_name", "header": "Load Name", "type": "string"},
         ],
         "layout": _layout(0, 9, 12, 5)},
    ],
    "layout": {"type": "flow", "sections": ["filters", "kpis", "charts", "grids"]},
    "autoRefreshInterval": 0,
}


def apply_di(engine: Engine, mapping: dict[str, str], database_id: str, *, overwrite: bool) -> None:
    """One transaction: scoped DELETE (if overwrite) + INSERT of the 7 ds-di-*
    datasets, 5 recviz_charts, and dash-di-stats. References the existing
    connection `database_id`; dynamic routing (by tlm_instance) overrides it."""
    now = datetime.now(timezone.utc)
    datasets = [
        build_dataset_di_messages(database_id, mapping),
        build_dataset_di_kpis(database_id, mapping),
        build_dataset_di_group(DS_DI_BY_STATUS_ID, "DI by Status", _DI_CAT_STATUS, database_id, mapping),
        build_dataset_di_group(DS_DI_BY_ERROR_ID, "DI by Error Status", _DI_CAT_ERROR, database_id, mapping),
        build_dataset_di_group(DS_DI_BY_TYPE_ID, "DI by Message Type", _DI_CAT_TYPE, database_id, mapping),
        build_dataset_di_group(DS_DI_BY_SETID_ID, "DI by Set ID", _DI_CAT_SETID, database_id, mapping, top_n=10),
        build_dataset_di_group(DS_DI_BY_FILE_ID, "DI by File", _DI_CAT_FILE, database_id, mapping, top_n=10),
    ]
    with engine.begin() as conn:  # one transaction; commit on success, rollback on error
        for ds in datasets:
            if overwrite:
                conn.execute(text("DELETE FROM recviz_datasets WHERE id = :i"), {"i": ds["id"]})
            conn.execute(
                text(
                    "INSERT INTO recviz_datasets "
                    "(id, name, description, database_id, sql, columns, filter_mappings, "
                    " database_routing, schema_version, created_at, updated_at) "
                    "VALUES (:id, :name, :desc, :db_id, :sql, :cols, :fm, :dr, 1, :created, :updated)"
                ),
                {"id": ds["id"], "name": ds["name"], "desc": ds["description"], "db_id": ds["database_id"],
                 "sql": ds["sql"], "cols": json.dumps(ds["columns"]), "fm": json.dumps(ds["filter_mappings"]),
                 "dr": json.dumps(ds["database_routing"]), "created": now, "updated": now},
            )
            logger.info("  OK INSERT recviz_datasets id=%s", ds["id"])
        for chart in DI_CHARTS:
            if overwrite:
                conn.execute(text("DELETE FROM recviz_charts WHERE id = :i"), {"i": chart["id"]})
            conn.execute(
                text(
                    "INSERT INTO recviz_charts "
                    "(id, name, description, dataset_id, chart_type, config, created_at, updated_at) "
                    "VALUES (:id, :name, :desc, :ds, :ctype, :cfg, :created, :updated)"
                ),
                {"id": chart["id"], "name": chart["name"], "desc": chart["description"],
                 "ds": chart["dataset_id"], "ctype": chart["chart_type"],
                 "cfg": json.dumps(chart["config"]), "created": now, "updated": now},
            )
            logger.info("  OK INSERT recviz_charts id=%s", chart["id"])
        if overwrite:
            conn.execute(text("DELETE FROM recviz_dashboards WHERE id = :i"), {"i": DI_DASHBOARD_ID})
        conn.execute(
            text(
                "INSERT INTO recviz_dashboards "
                "(id, name, description, schema_version, config, created_at, updated_at) "
                "VALUES (:id, :name, :desc, 1, :cfg, :created, :updated)"
            ),
            {"id": DI_DASHBOARD_ID, "name": DI_DASHBOARD_CONFIG["name"],
             "desc": DI_DASHBOARD_CONFIG["description"], "cfg": json.dumps(DI_DASHBOARD_CONFIG),
             "created": now, "updated": now},
        )
        logger.info("  OK INSERT recviz_dashboards id=%s", DI_DASHBOARD_ID)


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed the dash-di-stats RecViz dashboard")
    parser.add_argument("--config", required=True, type=Path, help="Path to citi-tlm.json (same as the TLM seeder)")
    parser.add_argument("--dry-run", action="store_true", help="Pre-flight only; skip writes")
    parser.add_argument("--overwrite", action="store_true", help="DELETE ds-di-*/chart-di-*/dash-di-stats before insert")
    parser.add_argument("--yes", "-y", action="store_true", help="Skip the confirmation prompt")
    args = parser.parse_args()

    recviz_db_url = os.environ.get("RECVIZ_DB_URL")
    oracle_lib = os.environ.get("ORACLE_CLIENT_LIB_DIR")
    if not recviz_db_url:
        logger.error("RECVIZ_DB_URL not set. Source recviz-prod.env first."); return 2
    if not oracle_lib:
        logger.error("ORACLE_CLIENT_LIB_DIR not set."); return 2

    init_oracle_thick(oracle_lib)
    engine = verify_recviz_db(recviz_db_url)
    mapping = load_instance_mapping(args.config)
    first_name = next(iter(mapping.values()))
    database_id = lookup_database_id(engine, first_name)
    logger.info("Routing map: %s ; database_id=%s", mapping, database_id)

    if args.dry_run:
        logger.info("Pre-flight passed. --dry-run set; skipping writes. Done."); return 0
    if not args.yes and input("Insert dash-di-stats + its datasets/charts? type 'yes': ").strip() != "yes":
        logger.info("Aborted."); return 1

    apply_di(engine, mapping, database_id, overwrite=args.overwrite)
    logger.info("Done. Seeded dash-di-stats.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
