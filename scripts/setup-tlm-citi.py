#!/usr/bin/env python3
"""Citi-environment setup for the dash-tlm-stats dashboard.

Creates 3 RecViz connections (1 reconmgmt + N per-TLM-instance), 3 datasets
(automatch, breaks, manual-match), and the dash-tlm-stats dashboard -- all
with the explicit IDs the rectrace cell-click embed URL hardcodes
(`dash-tlm-stats`, `ds-tlm-automatch`, `ds-tlm-breaks`, `ds-tlm-manual-match`).

Why direct SQL instead of the /api/databases + /api/datasets/managed +
/api/dashboards/managed endpoints: those routes generate fresh UUIDs for
every row, and the rectrace embed URL (TlmStatsCellRenderer.tsx) hardcodes
`dash-tlm-stats` as the dashboard ID. Going through the API would mean a
rectrace-side code change to look up dashboards by name. Direct SQL keeps
this isolated to the RecViz side.

Fail-fast contract: ANY error in the pre-flight phase aborts before any
write. Writes themselves are wrapped in a single transaction -- if the
dashboard insert fails after the connections + datasets have been
inserted, the whole transaction rolls back.

Usage (from inside `recviz-bundle/` with the venv activated):

    python scripts/setup-tlm-citi.py --config scripts/citi-tlm.json

The config file shape is documented in scripts/setup-tlm-citi.config.example.json.

Requires the following env vars (typically loaded from .env):
    RECVIZ_DB_URL          # SQLAlchemy URL for the RecViz catalog DB
    RECVIZ_ENCRYPTION_KEY  # Fernet key -- must match the running RecViz server
    ORACLE_CLIENT_LIB_DIR  # Oracle Instant Client path (thick mode)
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import subprocess
import sys
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import oracledb
    from cryptography.fernet import Fernet
    from sqlalchemy import create_engine, text
    from sqlalchemy.engine import Engine
    from sqlalchemy.exc import SQLAlchemyError
except ImportError as exc:
    print(
        f"ERROR: missing dependency ({exc}). Run from inside the recviz-bundle/ "
        "venv with `pip install -r backend/requirements.txt` first.",
        file=sys.stderr,
    )
    sys.exit(2)


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("setup-tlm-citi")


# -------------------------------------------------------------------------------
# Constants -- IDs that must match the rectrace embed URL + dashboard config
# -------------------------------------------------------------------------------

DASHBOARD_ID = "dash-tlm-stats"
DS_AUTOMATCH_ID = "ds-tlm-automatch"
DS_BREAKS_ID = "ds-tlm-breaks"
DS_MANUAL_MATCH_ID = "ds-tlm-manual-match"
RECONMGMT_CONN_NAME = "reconmgmt"  # Static-routed dataset hardcodes this name

# Tables we expect to find in each Citi schema (pre-flight verification).
TLM_PER_INSTANCE_TABLES = ["BANK", "MESSAGE_FEED", "ITEM", "TLM_BDR_RELATIONSHIP_HEADER"]
RECONMGMT_TABLES = ["MR_CSUM_MAN_MATCH_DETAILS", "MR_CSUM_NETTING_HIST"]


# -------------------------------------------------------------------------------
# Config dataclasses
# -------------------------------------------------------------------------------


DEFAULT_PASSWORD_SCRIPT_PATH = "/opt/rectify/control/scripts/get_password.sh"


@dataclass
class CitiConnection:
    label: str  # e.g. "reconmgmt", "TLMP_INV"
    name: str  # recviz_connections.name (lowercased)
    display_name: str
    host: str
    port: int
    service_name: str
    schema_name: str
    username: str
    # Password is RESOLVED, not necessarily literal. If the JSON config sets
    # "password", use that verbatim (local override). If not, call the
    # password script at apply time using SERVICE_NAME.upper() +
    # SCHEMA_NAME.upper() as args, mirroring tlm-stats ScriptExecutor
    # (rectrace-tlm-stats/.../util/ScriptExecutor.java + DatabaseConfig.java).
    password_literal: str | None = None
    # Populated by resolve_passwords() before any Oracle connection attempt.
    resolved_password: str | None = field(default=None, repr=False)

    @property
    def password(self) -> str:
        """Return the resolved password. Raises if resolve_passwords() wasn't called."""
        if self.resolved_password is None:
            raise RuntimeError(
                f"Password for '{self.label}' not yet resolved -- "
                "call resolve_passwords(plan) before using the connection."
            )
        return self.resolved_password

    def sqlalchemy_url(self) -> str:
        return (
            f"oracle+oracledb://{self.username}:{self.password}"
            f"@{self.host}:{self.port}/?service_name={self.service_name}"
        )


@dataclass
class Plan:
    reconmgmt: CitiConnection
    tlm_instances: dict[str, CitiConnection]  # tlm_instance_label -> conn
    password_script_path: str = DEFAULT_PASSWORD_SCRIPT_PATH

    @property
    def tlm_instance_mapping(self) -> dict[str, str]:
        """TLM_INSTANCE_MAPPING for dynamic routing -- maps tlm_instance values
        (the labels in the filter) to RecViz connection names."""
        return {label: conn.name for label, conn in self.tlm_instances.items()}

    @property
    def all_connections(self) -> list[CitiConnection]:
        return [self.reconmgmt] + list(self.tlm_instances.values())


# -------------------------------------------------------------------------------
# Dataset configs -- embedded as Python literals so they match the seed-oracle.py
# source-of-truth verbatim. mapping populated at apply-time from the Plan.
# -------------------------------------------------------------------------------


def _col(name, display, dtype, role, agg="NONE", fp="none", fs=""):
    return {
        "name": name,
        "display_name": display,
        "data_type": dtype,
        "role": role,
        "aggregation": agg,
        "format_preset": fp,
        "format_string": fs,
    }


def build_dataset_automatch(default_database_id: str, mapping: dict[str, str]) -> dict:
    """ds-tlm-automatch -- dynamic-routed by tlm_instance filter."""
    return {
        "id": DS_AUTOMATCH_ID,
        "name": "TLM Automatch",
        "description": (
            "Per-TLM-instance automatch + total-items counts grouped by "
            "(tlm_instance, agent_code, set_id, stmt_date, bran_code, "
            "corr_acc_no). Dynamic-routed by tlm_instance filter."
        ),
        "database_id": default_database_id,
        "sql": (
            "SELECT "
            "  sys_context('USERENV', 'DB_NAME') AS tlm_instance, "
            "  b.agent_code, "
            "  b.local_acc_no AS set_id, "
            "  i.stmt_date, "
            "  i.bran_code, "
            "  b.corr_acc_no, "
            "  SUM(CASE WHEN i.flag_2 IN (0,1,11) THEN 1 ELSE 0 END) AS total_items, "
            "  SUM(CASE WHEN th.last_action_owner IN ('SYSTEM','system','AUTONET') "
            "       AND i.flag_2 = 1 THEN 1 ELSE 0 END) AS automatch_items "
            "FROM bank b, message_feed mf, item i, tlm_bdr_relationship_header th "
            "WHERE b.corr_acc_no = mf.corr_acc_no "
            "  AND mf.corr_acc_no = i.corr_acc_no "
            "  AND mf.short_code = i.short_no "
            "  AND i.relationship_id = th.relationship_id (+) "
            "  AND mf.mlnv NOT IN ('9060','9066') "
            "  {{filters}} "
            "GROUP BY b.agent_code, b.local_acc_no, i.stmt_date, i.bran_code, b.corr_acc_no "
            "ORDER BY b.agent_code, b.local_acc_no, i.stmt_date, i.bran_code, b.corr_acc_no"
        ),
        "columns": [
            _col("tlm_instance", "TLM Instance", "string", "dimension"),
            _col("agent_code", "Recon", "string", "dimension"),
            _col("set_id", "Set ID", "string", "dimension"),
            _col("stmt_date", "Statement Date", "date", "time"),
            _col("bran_code", "Branch", "string", "dimension"),
            _col("corr_acc_no", "Correspondent Acct", "string", "dimension"),
            _col("total_items", "Total Items", "number", "measure", "SUM", "number"),
            _col("automatch_items", "Automatch Items", "number", "measure", "SUM", "number"),
        ],
        "filter_mappings": [
            {"filter_id": "tlm_instance", "sql_expr": "1=1"},
            {"filter_id": "recon", "sql_expr": "b.agent_code IN ({{values}})"},
            {"filter_id": "set_id", "sql_expr": "b.local_acc_no IN ({{values}})"},
            {
                "filter_id": "date_range_days",
                "sql_expr": "i.stmt_date {{date_range_clause}}",
                "options": {"exclude_today": True},
            },
        ],
        "database_routing": {
            "type": "dynamic",
            "route_by_filter": "tlm_instance",
            "mapping": mapping,
        },
    }


def build_dataset_breaks(default_database_id: str, mapping: dict[str, str]) -> dict:
    """ds-tlm-breaks -- dynamic-routed by tlm_instance filter."""
    return {
        "id": DS_BREAKS_ID,
        "name": "TLM Breaks",
        "description": (
            "Per-TLM-instance break counts grouped by (agent_code, set_id, "
            "stmt_date, bran_code). Dynamic-routed by tlm_instance filter."
        ),
        "database_id": default_database_id,
        "sql": (
            "WITH static AS ( "
            "  SELECT "
            "    f.mlnv, f.sub_acc_no, f.short_code, f.latest_stmt_date, "
            "    f.latest_stmt_no, k.agent_code, k.local_acc_no, k.corr_acc_no "
            "  FROM bank k, message_feed f "
            "  WHERE f.corr_acc_no = k.corr_acc_no "
            ") "
            "SELECT "
            "  COUNT(*) AS breaks_count, "
            "  s.agent_code, "
            "  s.local_acc_no AS set_id, "
            "  i.stmt_date, "
            "  i.bran_code "
            "FROM item i, static s "
            "WHERE s.corr_acc_no = i.corr_acc_no "
            "  AND i.flag_2 = 0 "
            "  {{filters}} "
            "GROUP BY s.agent_code, s.local_acc_no, i.stmt_date, i.bran_code"
        ),
        "columns": [
            _col("agent_code", "Recon", "string", "dimension"),
            _col("set_id", "Set ID", "string", "dimension"),
            _col("stmt_date", "Statement Date", "date", "time"),
            _col("bran_code", "Branch", "string", "dimension"),
            _col("breaks_count", "Break Count", "number", "measure", "SUM", "number"),
        ],
        "filter_mappings": [
            {"filter_id": "tlm_instance", "sql_expr": "1=1"},
            {"filter_id": "recon", "sql_expr": "s.agent_code IN ({{values}})"},
            {"filter_id": "set_id", "sql_expr": "s.local_acc_no IN ({{values}})"},
            {
                "filter_id": "date_range_days",
                "sql_expr": "i.stmt_date {{date_range_clause}}",
                "options": {"exclude_today": True},
            },
        ],
        "database_routing": {
            "type": "dynamic",
            "route_by_filter": "tlm_instance",
            "mapping": mapping,
        },
    }


def build_dataset_manual_match(database_id: str) -> dict:
    """ds-tlm-manual-match -- static-routed to the `reconmgmt` connection."""
    return {
        "id": DS_MANUAL_MATCH_ID,
        "name": "TLM Manual Match",
        "description": (
            "Reconmgmt manual-match counts: UNION ALL of "
            "mr_csum_man_match_details and mr_csum_netting_hist, grouped by "
            "(tlm_instance, agent_code, set_id, stmt_date, bran_code, corr_acc_no). "
            "Static-routed to the 'reconmgmt' connection."
        ),
        "database_id": database_id,
        "sql": (
            "SELECT tlm_instance, agent_code, set_id, stmt_date, bran_code, "
            "       corr_acc_no, SUM(manual_match_count) AS total_manual_match_count "
            "FROM ( "
            "  SELECT tlm_instance, agent_code, set_id, corr_acc_no, "
            "         bran_code, stmt_date, COUNT(*) AS manual_match_count "
            "  FROM ( "
            "    SELECT m.tlm_instance, m.agent_code, m.setid AS set_id, "
            "           m.corr_acc_no, m.bran_code, m.stmt_date "
            "    FROM mr_csum_man_match_details m "
            "  ) leg1 "
            "  WHERE 1=1 {{filters}} "
            "  GROUP BY tlm_instance, agent_code, set_id, corr_acc_no, "
            "           bran_code, stmt_date "
            "  UNION ALL "
            "  SELECT tlm_instance, agent_code, set_id, corr_acc_no, "
            "         bran_code, stmt_date, COUNT(*) AS manual_match_count "
            "  FROM ( "
            "    SELECT n.tlm_instance, n.agent_code, n.local_acc_no AS set_id, "
            "           n.corr_acc_no, n.bran_code, n.stmt_date "
            "    FROM mr_csum_netting_hist n "
            "  ) leg2 "
            "  WHERE 1=1 {{filters}} "
            "  GROUP BY tlm_instance, agent_code, set_id, corr_acc_no, "
            "           bran_code, stmt_date "
            ") "
            "GROUP BY tlm_instance, agent_code, set_id, stmt_date, bran_code, corr_acc_no"
        ),
        "columns": [
            _col("tlm_instance", "TLM Instance", "string", "dimension"),
            _col("agent_code", "Recon", "string", "dimension"),
            _col("set_id", "Set ID", "string", "dimension"),
            _col("stmt_date", "Statement Date", "date", "time"),
            _col("bran_code", "Branch", "string", "dimension"),
            _col("corr_acc_no", "Correspondent Acct", "string", "dimension"),
            _col("total_manual_match_count", "Manual Match Count", "number", "measure", "SUM", "number"),
        ],
        "filter_mappings": [
            {"filter_id": "tlm_instance", "sql_expr": "tlm_instance = '{{value}}'"},
            {"filter_id": "recon", "sql_expr": "agent_code IN ({{values}})"},
            {"filter_id": "set_id", "sql_expr": "set_id IN ({{values}})"},
            {
                "filter_id": "date_range_days",
                "sql_expr": "stmt_date {{date_range_clause}}",
                "options": {"exclude_today": True},
            },
        ],
        "database_routing": {"type": "static", "database": "reconmgmt"},
    }


# -------------------------------------------------------------------------------
# Dashboard config -- the dash-tlm-stats payload that goes into
# recviz_dashboards.config (JSON column).
# -------------------------------------------------------------------------------


def _layout(col, row, w, h):
    return {"col": col, "row": row, "width": w, "height": h}


DASHBOARD_CONFIG = {
    "id": DASHBOARD_ID,
    "name": "TLM Statistics",
    "description": "Per-TLM-instance reconciliation and breaks for the filtered scope.",
    "features": {"crossFilter": False, "drillDown": False},
    "filters": [
        {"id": "tlm_instance", "label": "TLM Instance", "type": "single-select", "lockable": True,
         "optionsSource": {"dataSourceId": DS_AUTOMATCH_ID, "valueColumn": "tlm_instance", "dependsOn": {}},
         "options": [], "defaultValue": None},
        {"id": "recon", "label": "Recon", "type": "multi-select", "lockable": True,
         "optionsSource": {"dataSourceId": DS_AUTOMATCH_ID, "valueColumn": "agent_code",
                           "dependsOn": {"tlm_instance": "tlm_instance"}},
         "options": [], "defaultValue": None},
        {"id": "set_id", "label": "Set ID", "type": "multi-select", "lockable": True,
         "optionsSource": {"dataSourceId": DS_AUTOMATCH_ID, "valueColumn": "set_id",
                           "dependsOn": {"tlm_instance": "tlm_instance", "recon": "agent_code"}},
         "options": [], "defaultValue": None},
        {"id": "date_range_days", "label": "Date Range", "type": "preset-range", "lockable": False,
         "optionsSource": None,
         "options": [
             {"label": "Last 1 day", "value": 1},
             {"label": "Last 7 days", "value": 7},
             {"label": "Last 30 days", "value": 30},
         ],
         "defaultValue": 1},
    ],
    "kpis": [
        {"id": "kpi-tlm-total-items", "label": "Total Items", "format": "number",
         "sources": [{"dataSourceId": DS_AUTOMATCH_ID, "metric": "total_items"}],
         "aggregation": "SUM", "accentColor": "--chart-1"},
        {"id": "kpi-tlm-automatch", "label": "Automatched", "format": "number",
         "sources": [{"dataSourceId": DS_AUTOMATCH_ID, "metric": "automatch_items"}],
         "aggregation": "SUM",
         "trend": {"type": "percentage_of", "referenceKpi": "kpi-tlm-total-items", "display": "ratio"},
         "accentColor": "--chart-positive"},
        {"id": "kpi-tlm-total-breaks", "label": "Total Breaks", "format": "number",
         "sources": [{"dataSourceId": DS_BREAKS_ID, "metric": "breaks_count"}],
         "aggregation": "SUM", "accentColor": "--chart-warning"},
        {"id": "kpi-tlm-manual-match", "label": "Manual Matched", "format": "number",
         "sources": [{"dataSourceId": DS_MANUAL_MATCH_ID, "metric": "total_manual_match_count"}],
         "aggregation": "SUM",
         "trend": {"type": "percentage_of", "referenceKpi": "kpi-tlm-total-items", "display": "ratio"},
         "accentColor": "--series-8"},
    ],
    "charts": [
        {
            "id": "chart-tlm-distribution",
            "title": "Match Distribution",
            "type": "donut",
            "sourceType": "kpi_values",
            "kpiSegments": [
                {"kpiId": "kpi-tlm-total-breaks", "label": "Breaks", "color": "#fbbc04"},
                {"kpiId": "kpi-tlm-automatch", "label": "Automatch", "color": "#34a853"},
                {"kpiId": "kpi-tlm-manual-match", "label": "Manual Match", "color": "#8e24aa"},
            ],
            "appearance": {
                "showLegend": True, "legendPosition": "bottom",
                "typeSpecific": {
                    "seriesColor_0": "--chart-warning",
                    "seriesColor_1": "--chart-positive",
                    "seriesColor_2": "--series-8",
                    "donutInnerRadius": 0.5,
                    "donutLabelPosition": "outside",
                },
            },
            "layout": _layout(0, 1, 12, 4),
            "visibleWhen": {"kpi": "kpi-tlm-total-items", "condition": "gt", "value": 0},
        },
    ],
    "grids": [
        {"id": "grid-tlm-reconciliation", "title": "Reconciliation",
         "sources": [{"dataSourceId": DS_AUTOMATCH_ID}, {"dataSourceId": DS_MANUAL_MATCH_ID}],
         "mergeOn": ["agent_code", "set_id", "stmt_date", "bran_code", "corr_acc_no"],
         "mergeType": "outer_join",
         "coalesceZero": True,
         "columns": [
             {"field": "agent_code", "header": "Recon", "type": "string"},
             {"field": "set_id", "header": "Set ID", "type": "string"},
             {"field": "stmt_date", "header": "Statement Date", "type": "date"},
             {"field": "bran_code", "header": "Branch", "type": "string"},
             {"field": "corr_acc_no", "header": "Correspondent Acct", "type": "string"},
             {"field": "total_items", "header": "Total Items", "type": "number"},
             {"field": "automatch_items", "header": "Automatched", "type": "number"},
             {"field": "total_manual_match_count", "header": "Manual Match", "type": "number"},
         ],
         "visibleWhen": {"kpi": "kpi-tlm-total-items", "condition": "gt", "value": 0},
         "layout": _layout(0, 5, 12, 5)},
        {"id": "grid-tlm-breaks", "title": "Breaks",
         "dataSourceId": DS_BREAKS_ID,
         "columns": [
             {"field": "agent_code", "header": "Recon", "type": "string"},
             {"field": "set_id", "header": "Set ID", "type": "string"},
             {"field": "stmt_date", "header": "Statement Date", "type": "date"},
             {"field": "bran_code", "header": "Branch", "type": "string"},
             {"field": "breaks_count", "header": "Break Count", "type": "number"},
         ],
         "visibleWhen": {"kpi": "kpi-tlm-total-breaks", "condition": "gt", "value": 0},
         "layout": _layout(0, 10, 12, 4)},
    ],
    "layout": {"type": "flow", "sections": ["filters", "kpis", "charts", "grids"]},
    "autoRefreshInterval": 0,
}


# -------------------------------------------------------------------------------
# Config loading
# -------------------------------------------------------------------------------


def load_config(path: Path) -> Plan:
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")
    with path.open("r") as f:
        raw = json.load(f)

    def _conn(label: str, block: dict) -> CitiConnection:
        # Required: host, service_name, username, schema_name.
        # Password is OPTIONAL -- if absent, fetched via the password script.
        missing = [k for k in ("host", "service_name", "username") if not block.get(k)]
        if missing:
            raise ValueError(f"Connection '{label}' missing required fields: {missing}")
        schema = block.get("schema_name") or block["username"]
        # name = lowercase + underscore (matches POST /api/databases convention)
        name = label.lower().replace(" ", "_")
        return CitiConnection(
            label=label,
            name=name,
            display_name=label,
            host=block["host"],
            port=int(block.get("port", 1521)),
            service_name=block["service_name"],
            schema_name=schema.upper(),
            username=block["username"],
            password_literal=block.get("password") or None,
        )

    if "reconmgmt" not in raw:
        raise ValueError("Config missing top-level 'reconmgmt' block")
    if not raw.get("tlm_instances"):
        raise ValueError("Config missing top-level 'tlm_instances' object (need at least one)")

    reconmgmt = _conn("reconmgmt", raw["reconmgmt"])
    tlm_instances = {
        label.upper(): _conn(label.upper(), block)
        for label, block in raw["tlm_instances"].items()
    }
    script_path = raw.get("password_script_path") or DEFAULT_PASSWORD_SCRIPT_PATH
    return Plan(
        reconmgmt=reconmgmt,
        tlm_instances=tlm_instances,
        password_script_path=script_path,
    )


# -------------------------------------------------------------------------------
# Pre-flight verification
# -------------------------------------------------------------------------------


def fetch_password_via_script(script_path: str, service_name: str, db_schema: str) -> str:
    """Mirror of tlm-stats ScriptExecutor.executeScript / DatabaseConfig
    password fallback. Runs:
        <script_path> <SERVICE_NAME_UPPER> <DB_SCHEMA_UPPER>
    and returns trimmed stdout as the password. Raises if the script
    exits non-zero, stderr empty, or stdout empty.

    Mirroring the Java pattern exactly: positional args are
    serviceName.upper() + dbSchema.upper(). The script must echo the
    plaintext password to stdout.
    """
    if not Path(script_path).exists():
        raise RuntimeError(
            f"Password script not found at: {script_path}. "
            "Either set `password_script_path` in the config JSON OR populate "
            "the `password` field on every connection block."
        )
    args = [script_path, service_name.upper(), db_schema.upper()]
    # Don't log args (would surface service/schema patterns). Log the path only.
    logger.debug("Invoking password script: %s ...", script_path)
    try:
        result = subprocess.run(
            args,
            capture_output=True,
            text=True,
            check=False,
            timeout=30,
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"Password script '{script_path}' timed out after 30s") from exc
    if result.returncode != 0:
        # Don't echo stdout (might leak a partial password) -- only stderr.
        raise RuntimeError(
            f"Password script '{script_path}' exited {result.returncode}. "
            f"stderr: {result.stderr.strip() or '<empty>'}"
        )
    password = result.stdout.strip()
    if not password:
        raise RuntimeError(
            f"Password script '{script_path}' returned empty stdout. "
            f"stderr: {result.stderr.strip() or '<empty>'}"
        )
    # Log length only, never the password value.
    logger.debug("  password script returned %d chars", len(password))
    return password


def resolve_passwords(plan: Plan) -> None:
    """Resolve every connection's password before any Oracle connection attempt.

    For each CitiConnection in the plan: if `password_literal` is set in the
    JSON, use it; else call the password script (tlm-stats pattern). Mutates
    each connection's `resolved_password`.

    Fail-fast: if ANY connection's resolver fails, raises and aborts before
    we attempt any Oracle connection.
    """
    logger.info(
        "Resolving passwords (literal-in-config OR via script %s)...",
        plan.password_script_path,
    )
    for conn in plan.all_connections:
        if conn.password_literal:
            conn.resolved_password = conn.password_literal
            logger.info("  OK %s: using literal from JSON config", conn.label)
        else:
            try:
                conn.resolved_password = fetch_password_via_script(
                    plan.password_script_path,
                    conn.service_name,
                    conn.schema_name,
                )
            except RuntimeError as exc:
                raise RuntimeError(
                    f"Could not resolve password for '{conn.label}' "
                    f"(service={conn.service_name}, schema={conn.schema_name}): {exc}"
                ) from exc
            logger.info(
                "  OK %s: fetched via script (%s %s)",
                conn.label,
                conn.service_name.upper(),
                conn.schema_name.upper(),
            )


def init_oracle_thick(client_lib_dir: str) -> None:
    """Initialize Oracle thick mode -- required by python-oracledb for TLS / wallet."""
    try:
        oracledb.init_oracle_client(lib_dir=client_lib_dir)
        logger.info("Oracle thick mode initialized (lib_dir=%s)", client_lib_dir)
    except Exception as exc:
        if "already initialized" in str(exc).lower() or "DPI-1072" in str(exc):
            logger.debug("Oracle client already initialized -- skipping")
            return
        raise


def verify_recviz_db(url: str) -> Engine:
    """Connect to the RecViz catalog DB. Returns engine for later use."""
    logger.info("Connecting to RecViz catalog DB...")
    engine = create_engine(url, pool_pre_ping=True, pool_size=2, max_overflow=2)
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1 FROM dual"))
        result.scalar()
    logger.info("  OK RecViz catalog DB reachable")
    # Verify the recviz_* tables exist
    expected_tables = {"RECVIZ_CONNECTIONS", "RECVIZ_DATASETS", "RECVIZ_DASHBOARDS"}
    with engine.connect() as conn:
        rows = conn.execute(text(
            "SELECT table_name FROM user_tables WHERE table_name IN "
            "('RECVIZ_CONNECTIONS', 'RECVIZ_DATASETS', 'RECVIZ_DASHBOARDS')"
        )).fetchall()
        present = {r[0] for r in rows}
        missing = expected_tables - present
        if missing:
            raise RuntimeError(
                f"RecViz catalog tables missing: {missing}. "
                "Run alembic migrations or ask your DBA to create the schema."
            )
    logger.info("  OK recviz_connections / recviz_datasets / recviz_dashboards present")
    return engine


def verify_citi_connection(conn: CitiConnection, expected_tables: list[str]) -> None:
    """Connect to a Citi Oracle + verify expected tables exist (case-insensitive)."""
    logger.info("Verifying Citi connection '%s' (%s:%d/%s)...", conn.label, conn.host, conn.port, conn.service_name)
    try:
        engine = create_engine(conn.sqlalchemy_url(), pool_pre_ping=False, pool_size=1, max_overflow=0)
        with engine.connect() as c:
            c.execute(text("SELECT 1 FROM dual")).scalar()
        logger.info("    OK %s reachable", conn.label)
    except SQLAlchemyError as exc:
        raise RuntimeError(f"Cannot connect to '{conn.label}': {exc}") from exc

    # Check tables. Use ALL_TABLES so we find them regardless of schema.
    upper_tables = [t.upper() for t in expected_tables]
    placeholders = ", ".join(f":t{i}" for i in range(len(upper_tables)))
    bindings = {f"t{i}": t for i, t in enumerate(upper_tables)}
    with engine.connect() as c:
        rows = c.execute(
            text(
                f"SELECT DISTINCT table_name FROM all_tables WHERE table_name IN ({placeholders})"
            ),
            bindings,
        ).fetchall()
    found = {r[0] for r in rows}
    missing = set(upper_tables) - found
    if missing:
        raise RuntimeError(
            f"Tables missing in '{conn.label}': {sorted(missing)} "
            f"(found {sorted(found)}). Username '{conn.username}' may lack SELECT "
            "privileges or the tables live in a different schema."
        )
    logger.info("    OK expected tables present: %s", ", ".join(sorted(found)))
    engine.dispose()


def check_recviz_collisions(engine: Engine, plan: Plan) -> dict[str, str]:
    """Return existing rows that would conflict.

    Surfaces -- but does not abort on -- existing rows. The user passes
    --skip-existing OR --overwrite to choose behavior; abort is the default
    when collisions exist.
    """
    collisions: dict[str, str] = {}
    with engine.connect() as conn:
        names = [c.name for c in plan.all_connections]
        placeholders = ", ".join(f":n{i}" for i in range(len(names)))
        rows = conn.execute(
            text(f"SELECT name FROM recviz_connections WHERE name IN ({placeholders})"),
            {f"n{i}": n for i, n in enumerate(names)},
        ).fetchall()
        for r in rows:
            collisions[f"recviz_connections.name='{r[0]}'"] = "exists"

        ds_ids = [DS_AUTOMATCH_ID, DS_BREAKS_ID, DS_MANUAL_MATCH_ID]
        rows = conn.execute(
            text("SELECT id FROM recviz_datasets WHERE id IN (:a, :b, :c)"),
            {"a": ds_ids[0], "b": ds_ids[1], "c": ds_ids[2]},
        ).fetchall()
        for r in rows:
            collisions[f"recviz_datasets.id='{r[0]}'"] = "exists"

        rows = conn.execute(
            text("SELECT id FROM recviz_dashboards WHERE id = :i"),
            {"i": DASHBOARD_ID},
        ).fetchall()
        for r in rows:
            collisions[f"recviz_dashboards.id='{r[0]}'"] = "exists"
    return collisions


# -------------------------------------------------------------------------------
# Apply phase -- direct SQL INSERTs wrapped in a single transaction
# -------------------------------------------------------------------------------


def encrypt_password(password: str, fernet_key: str) -> str:
    """Match the EncryptionService.encrypt convention used by app/api/databases.py
    EXACTLY. Returns a URL-safe base64 string (NOT bytes). The
    encrypted_password column is Text/CLOB on Oracle -- binding bytes there
    would round-trip as the literal Python repr "b'gAAA...'" which Fernet
    can't decrypt at uvicorn read-time. Mirror the API: encode plaintext,
    encrypt, decode the resulting token to a str."""
    fernet = Fernet(fernet_key.encode() if isinstance(fernet_key, str) else fernet_key)
    return fernet.encrypt(password.encode()).decode()


def apply_plan(engine: Engine, plan: Plan, fernet_key: str, *, overwrite: bool) -> None:
    """Insert connections + datasets + dashboard inside a single transaction."""
    now = datetime.now(timezone.utc)

    with engine.begin() as conn:  # transaction; commits on success, rolls back on exception
        # -- Connections -------------------------------------------------------
        for citi_conn in plan.all_connections:
            conn_id = str(uuid.uuid4())
            encrypted = encrypt_password(citi_conn.password, fernet_key)
            if overwrite:
                conn.execute(
                    text("DELETE FROM recviz_connections WHERE name = :n"),
                    {"n": citi_conn.name},
                )
            conn.execute(
                text(
                    "INSERT INTO recviz_connections "
                    "(id, name, display_name, backend, host, port, database_name, "
                    " username, encrypted_password, schema_name, status, created_at, updated_at) "
                    "VALUES "
                    "(:id, :name, :display, :backend, :host, :port, :database, "
                    " :user, :enc, :schema, :status, :created, :updated)"
                ),
                {
                    "id": conn_id,
                    "name": citi_conn.name,
                    "display": citi_conn.display_name,
                    "backend": "oracle",
                    "host": citi_conn.host,
                    "port": citi_conn.port,
                    "database": citi_conn.service_name,
                    "user": citi_conn.username,
                    "enc": encrypted,
                    "schema": citi_conn.schema_name,
                    "status": "untested",
                    "created": now,
                    "updated": now,
                },
            )
            logger.info("  OK INSERT recviz_connections name=%s id=%s", citi_conn.name, conn_id)
            # Cache the generated ID so datasets can FK to it
            citi_conn.__dict__["_id"] = conn_id  # transient

        # -- Datasets ----------------------------------------------------------
        # Pick the first TLM connection ID as the "default" database_id for the
        # dynamic-routed datasets. Dynamic routing overrides this at query time.
        first_tlm_id = next(iter(plan.tlm_instances.values())).__dict__["_id"]
        recon_id = plan.reconmgmt.__dict__["_id"]

        datasets = [
            build_dataset_automatch(first_tlm_id, plan.tlm_instance_mapping),
            build_dataset_breaks(first_tlm_id, plan.tlm_instance_mapping),
            build_dataset_manual_match(recon_id),
        ]
        for ds in datasets:
            if overwrite:
                conn.execute(
                    text("DELETE FROM recviz_datasets WHERE id = :i"),
                    {"i": ds["id"]},
                )
            conn.execute(
                text(
                    "INSERT INTO recviz_datasets "
                    "(id, name, description, database_id, sql, columns, "
                    " filter_mappings, database_routing, schema_version, created_at, updated_at) "
                    "VALUES "
                    "(:id, :name, :desc, :db_id, :sql, :cols, :fm, :dr, 1, :created, :updated)"
                ),
                {
                    "id": ds["id"],
                    "name": ds["name"],
                    "desc": ds["description"],
                    "db_id": ds["database_id"],
                    "sql": ds["sql"],
                    "cols": json.dumps(ds["columns"]),
                    "fm": json.dumps(ds["filter_mappings"]),
                    "dr": json.dumps(ds["database_routing"]),
                    "created": now,
                    "updated": now,
                },
            )
            logger.info("  OK INSERT recviz_datasets id=%s name='%s'", ds["id"], ds["name"])

        # -- Dashboard ---------------------------------------------------------
        if overwrite:
            conn.execute(
                text("DELETE FROM recviz_dashboards WHERE id = :i"),
                {"i": DASHBOARD_ID},
            )
        conn.execute(
            text(
                "INSERT INTO recviz_dashboards "
                "(id, name, description, schema_version, config, created_at, updated_at) "
                "VALUES "
                "(:id, :name, :desc, 1, :cfg, :created, :updated)"
            ),
            {
                "id": DASHBOARD_ID,
                "name": DASHBOARD_CONFIG["name"],
                "desc": DASHBOARD_CONFIG["description"],
                "cfg": json.dumps(DASHBOARD_CONFIG),
                "created": now,
                "updated": now,
            },
        )
        logger.info("  OK INSERT recviz_dashboards id=%s name='%s'", DASHBOARD_ID, DASHBOARD_CONFIG["name"])


# -------------------------------------------------------------------------------
# Main
# -------------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description="Citi-environment TLM dashboard setup")
    parser.add_argument("--config", required=True, type=Path, help="Path to JSON config file")
    parser.add_argument("--dry-run", action="store_true", help="Pre-flight only; skip writes")
    parser.add_argument("--overwrite", action="store_true",
                        help="DELETE existing recviz_connections/datasets/dashboards rows with the same IDs/names before insert. "
                             "Without this flag, collisions abort.")
    parser.add_argument("--yes", "-y", action="store_true", help="Skip confirmation prompt")
    args = parser.parse_args()

    # -- Required env vars -----------------------------------------------------
    recviz_db_url = os.environ.get("RECVIZ_DB_URL")
    fernet_key = os.environ.get("RECVIZ_ENCRYPTION_KEY")
    oracle_lib = os.environ.get("ORACLE_CLIENT_LIB_DIR")
    if not recviz_db_url:
        logger.error("RECVIZ_DB_URL not set. Source your .env first.")
        return 2
    if not fernet_key:
        logger.error("RECVIZ_ENCRYPTION_KEY not set. Source your .env first.")
        return 2
    if not oracle_lib:
        logger.error("ORACLE_CLIENT_LIB_DIR not set. Source your .env first.")
        return 2

    try:
        plan = load_config(args.config)
    except (ValueError, FileNotFoundError, json.JSONDecodeError) as exc:
        logger.error("Config error: %s", exc)
        return 2

    logger.info("=" * 72)
    logger.info("Plan:")
    logger.info("  reconmgmt: name='%s' host=%s service=%s schema=%s",
                plan.reconmgmt.name, plan.reconmgmt.host, plan.reconmgmt.service_name, plan.reconmgmt.schema_name)
    for label, conn in plan.tlm_instances.items():
        logger.info("  %s -> name='%s' host=%s service=%s schema=%s",
                    label, conn.name, conn.host, conn.service_name, conn.schema_name)
    logger.info("  TLM_INSTANCE_MAPPING: %s", plan.tlm_instance_mapping)
    logger.info("=" * 72)

    # -- Phase 1: pre-flight ---------------------------------------------------
    logger.info("Phase 1: pre-flight verification (no writes)")
    init_oracle_thick(oracle_lib)

    # Phase 1a: resolve every password BEFORE attempting Oracle connects.
    # Mirrors tlm-stats DatabaseConfig -- literal in config wins; otherwise
    # call the password script with (SERVICE_NAME_UPPER, DB_SCHEMA_UPPER).
    try:
        resolve_passwords(plan)
    except RuntimeError as exc:
        logger.error("Pre-flight failed at password-resolution step: %s", exc)
        return 3

    try:
        recviz_engine = verify_recviz_db(recviz_db_url)
    except Exception as exc:
        logger.error("Pre-flight failed at RecViz DB step: %s", exc)
        return 3

    try:
        verify_citi_connection(plan.reconmgmt, RECONMGMT_TABLES)
        for label, conn in plan.tlm_instances.items():
            verify_citi_connection(conn, TLM_PER_INSTANCE_TABLES)
    except RuntimeError as exc:
        logger.error("Pre-flight failed at Citi connection step: %s", exc)
        return 3

    collisions = check_recviz_collisions(recviz_engine, plan)
    if collisions:
        logger.warning("Existing rows detected that would collide with this plan:")
        for k, v in collisions.items():
            logger.warning("    %s: %s", k, v)
        if not args.overwrite:
            logger.error(
                "Aborting because --overwrite was not specified. Either delete these rows "
                "manually or rerun with --overwrite."
            )
            return 4
        logger.warning("--overwrite specified -- will DELETE these rows before insert.")
    else:
        logger.info("  OK no existing-row collisions")

    if args.dry_run:
        logger.info("Pre-flight passed. --dry-run set; skipping writes. Done.")
        return 0

    # -- Phase 2: confirmation -------------------------------------------------
    if not args.yes:
        sys.stdout.write(
            f"\nAbout to insert {len(plan.all_connections)} connections, 3 datasets, "
            f"and 1 dashboard into recviz_*. Continue? [yes/N] "
        )
        sys.stdout.flush()
        resp = sys.stdin.readline().strip().lower()
        if resp != "yes":
            logger.error("Aborted by user (response='%s', expected 'yes').", resp)
            return 5

    # -- Phase 3: apply --------------------------------------------------------
    logger.info("Phase 3: applying changes (single transaction -- rolls back on any error)")
    try:
        apply_plan(recviz_engine, plan, fernet_key, overwrite=args.overwrite)
    except SQLAlchemyError as exc:
        logger.error("Apply failed (transaction rolled back): %s", exc)
        return 6

    logger.info("=" * 72)
    logger.info("Done. Verify:")
    logger.info("  * Open http://localhost:8000/dashboards in RecViz UI -- dash-tlm-stats should appear")
    logger.info("  * From rectrace, search for a recon with one of the seeded TLM instances")
    logger.info("    (%s) and click a recon cell -> modal embeds dash-tlm-stats", ", ".join(plan.tlm_instances))
    return 0


if __name__ == "__main__":
    sys.exit(main())
