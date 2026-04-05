#!/usr/bin/env python3
"""Seed PostgreSQL with RecViz config data and realistic reconciliation data.

This script is idempotent (DROP TABLE IF EXISTS before CREATE).

Usage:
    python scripts/seed-postgres.py

Requires:
    - PostgreSQL running (docker-compose up postgres)
    - psycopg2-binary installed
"""

from __future__ import annotations

import json
import random
import re
import sys
from datetime import date, timedelta
from pathlib import Path

import psycopg2

# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #

RECON_DB_URL = "postgresql://recviz:recviz_dev@localhost:5432/recon_data"
RECVIZ_DB_URL = "postgresql://recviz:recviz_dev@localhost:5432/superset_meta"

BACKEND_ROOT = Path(__file__).resolve().parent.parent / "backend" / "app"
DASHBOARDS_DIR = BACKEND_ROOT / "config" / "dashboards"
DATA_SOURCES_DIR = BACKEND_ROOT / "config" / "data_sources"


# --------------------------------------------------------------------------- #
# Column validation helpers
# --------------------------------------------------------------------------- #

def extract_sql_columns(sql_template: str) -> set[str]:
    """Extract column names referenced in a SQL template's SELECT and WHERE clauses.

    This is a best-effort parser for the specific SQL patterns used in RecViz
    data source configs. It handles:
    - Simple column refs: column_name
    - Table-qualified refs: t.column_name
    - Aliased expressions: expr AS alias
    - Aggregate functions: COUNT(...) AS alias
    - CASE expressions: CASE WHEN ... THEN ... END AS alias
    """
    columns: set[str] = set()

    # Remove template placeholders (replace with a dummy column name to avoid empty SELECT)
    cleaned = re.sub(r"\{\{[^}]+\}\}", "_placeholder_", sql_template)

    # Extract SELECT clause
    select_match = re.search(r"SELECT\s+(.*?)\s+FROM", cleaned, re.IGNORECASE | re.DOTALL)
    if select_match:
        select_clause = select_match.group(1)

        # Handle DISTINCT keyword
        select_clause = re.sub(r"^\s*DISTINCT\s+", "", select_clause, flags=re.IGNORECASE)

        # Split by comma, being careful about nested parentheses
        depth = 0
        current = ""
        parts = []
        for char in select_clause:
            if char == "(":
                depth += 1
                current += char
            elif char == ")":
                depth -= 1
                current += char
            elif char == "," and depth == 0:
                parts.append(current.strip())
                current = ""
            else:
                current += char
        if current.strip():
            parts.append(current.strip())

        for part in parts:
            # Check for AS alias
            as_match = re.search(r"\bAS\s+(\w+)\s*$", part, re.IGNORECASE)
            if as_match:
                columns.add(as_match.group(1).lower())
            else:
                # Simple column or table.column
                col_match = re.match(r"^(?:\w+\.)?(\w+)$", part.strip())
                if col_match:
                    columns.add(col_match.group(1).lower())

    # Extract GROUP BY columns
    group_match = re.search(r"GROUP\s+BY\s+(.*?)(?:ORDER|LIMIT|HAVING|$)", cleaned, re.IGNORECASE | re.DOTALL)
    if group_match:
        group_clause = group_match.group(1)
        for col_ref in re.split(r",", group_clause):
            col_ref = col_ref.strip()
            col_match = re.match(r"^(?:\w+\.)?(\w+)$", col_ref)
            if col_match:
                columns.add(col_match.group(1).lower())

    # Filter out placeholders and SQL keywords
    sql_keywords = {"distinct", "case", "when", "then", "else", "end", "as", "and", "or",
                    "not", "in", "is", "null", "count", "sum", "avg", "min", "max",
                    "_placeholder_", "1"}
    columns = {c for c in columns if c not in sql_keywords}
    return columns


def validate_columns(data_source_id: str, sql_template: str, table_columns: set[str]) -> None:
    """Validate that seed table columns cover all SQL template references."""
    sql_columns = extract_sql_columns(sql_template)
    # Normalize both sets to lowercase
    table_cols_lower = {c.lower() for c in table_columns}
    missing = sql_columns - table_cols_lower
    if missing:
        print(f"ERROR: Data source '{data_source_id}' SQL template references columns "
              f"not in seed table: {sorted(missing)}")
        print(f"  SQL template columns: {sorted(sql_columns)}")
        print(f"  Seed table columns:   {sorted(table_cols_lower)}")
        sys.exit(1)


# --------------------------------------------------------------------------- #
# Seed reconciliation data (recon_data database)
# --------------------------------------------------------------------------- #

# Reference data for realistic values
AGENT_CODES = ["AGT001", "AGT002", "AGT003", "AGT004", "AGT005"]
SET_IDS = ["SET01", "SET02", "SET03", "SET04", "SET05"]
BRAN_CODES = ["BR001", "BR002", "BR003", "BR004", "BR005"]
CORR_ACC_NOS = ["ACC001", "ACC002", "ACC003", "ACC004", "ACC005",
                "ACC006", "ACC007", "ACC008", "ACC009", "ACC010"]
TLM_INSTANCES = ["TLMP_CONSUMER", "TLMP_FINANCE", "TLMP_WEALTH"]
RECON_ENGINES = ["TLM"]


def seed_recon_data(conn) -> None:
    """Create tables and insert realistic reconciliation data into recon_data."""
    cur = conn.cursor()

    # ---- TLM tables (used by tlm_automatch and tlm_breaks data sources) ---- #
    # The SQL templates JOIN: bank, message_feed, item, tlm_bdr_relationship_header
    # We create denormalized flat tables that can be queried by the templates

    # Validate columns against SQL templates BEFORE creating tables
    tlm_automatch_ds = json.loads((DATA_SOURCES_DIR / "tlm_automatch.json").read_text())
    tlm_breaks_ds = json.loads((DATA_SOURCES_DIR / "tlm_breaks.json").read_text())
    reconmgmt_manual_ds = json.loads((DATA_SOURCES_DIR / "reconmgmt_manual.json").read_text())
    reconmgmt_recon_bank_ds = json.loads((DATA_SOURCES_DIR / "reconmgmt_recon_bank.json").read_text())

    # For TLM data sources, the SQL uses JOINs across bank, message_feed, item,
    # tlm_bdr_relationship_header. In local dev with PostgreSQL, these are flat
    # tables that contain the columns referenced in the SQL templates.
    # The seed creates these tables with ALL columns needed.

    # -- bank table --
    bank_columns = {"agent_code", "local_acc_no", "corr_acc_no"}
    cur.execute("DROP TABLE IF EXISTS tlm_bdr_relationship_header CASCADE")
    cur.execute("DROP TABLE IF EXISTS item CASCADE")
    cur.execute("DROP TABLE IF EXISTS message_feed CASCADE")
    cur.execute("DROP TABLE IF EXISTS bank CASCADE")
    cur.execute("""
        CREATE TABLE bank (
            id SERIAL PRIMARY KEY,
            agent_code VARCHAR(64) NOT NULL,
            local_acc_no VARCHAR(64) NOT NULL,
            corr_acc_no VARCHAR(64) NOT NULL
        )
    """)

    # -- message_feed table --
    message_feed_columns = {"corr_acc_no", "bran_code"}
    cur.execute("""
        CREATE TABLE message_feed (
            id SERIAL PRIMARY KEY,
            corr_acc_no VARCHAR(64) NOT NULL,
            bran_code VARCHAR(64) NOT NULL
        )
    """)

    # -- item table --
    item_columns = {"corr_acc_no", "stmt_date", "flag_2"}
    cur.execute("""
        CREATE TABLE item (
            id SERIAL PRIMARY KEY,
            corr_acc_no VARCHAR(64) NOT NULL,
            stmt_date DATE NOT NULL,
            flag_2 INTEGER NOT NULL DEFAULT 0
        )
    """)

    # -- tlm_bdr_relationship_header table --
    tlm_bdr_columns = {"corr_acc_no", "last_action_owner"}
    cur.execute("""
        CREATE TABLE tlm_bdr_relationship_header (
            id SERIAL PRIMARY KEY,
            corr_acc_no VARCHAR(64) NOT NULL,
            last_action_owner VARCHAR(64) NOT NULL
        )
    """)

    # -- reconmgmt schema and tables --
    cur.execute("DROP TABLE IF EXISTS recon_bank CASCADE")
    cur.execute("CREATE SCHEMA IF NOT EXISTS reconmgmt")
    cur.execute("DROP TABLE IF EXISTS reconmgmt.mr_csum_man_match_stats_hist CASCADE")

    # recon_bank table (used by reconmgmt_recon_bank data source)
    recon_bank_columns = {"recon_engine", "recon_engine_env", "agent_code", "local_acc_no"}
    cur.execute("""
        CREATE TABLE recon_bank (
            id SERIAL PRIMARY KEY,
            recon_engine VARCHAR(64) NOT NULL,
            recon_engine_env VARCHAR(64) NOT NULL,
            agent_code VARCHAR(64) NOT NULL,
            local_acc_no VARCHAR(64) NOT NULL
        )
    """)

    # mr_csum_man_match_stats_hist (used by reconmgmt_manual data source)
    manual_match_columns = {
        "agent_code", "setid", "stmt_date", "bran_code", "corr_acc_no",
        "total_items", "automatch_items", "total_manual_match_count", "tlm_instance"
    }
    cur.execute("""
        CREATE TABLE reconmgmt.mr_csum_man_match_stats_hist (
            id SERIAL PRIMARY KEY,
            agent_code VARCHAR(64) NOT NULL,
            setid VARCHAR(64) NOT NULL,
            stmt_date DATE NOT NULL,
            bran_code VARCHAR(64) NOT NULL,
            corr_acc_no VARCHAR(64) NOT NULL,
            total_items INTEGER NOT NULL DEFAULT 0,
            automatch_items INTEGER NOT NULL DEFAULT 0,
            total_manual_match_count INTEGER NOT NULL DEFAULT 0,
            tlm_instance VARCHAR(64) NOT NULL
        )
    """)

    # Validate all data source SQL templates against table columns
    # For tlm_automatch: uses bank.agent_code, bank.local_acc_no (AS set_id),
    #   message_feed.bran_code, item.stmt_date, message_feed.corr_acc_no,
    #   COUNT expressions AS total_items, automatch_items
    validate_columns(
        "tlm_automatch",
        tlm_automatch_ds["query"],
        # All columns referenced in the query (source + output aliases)
        {"agent_code", "local_acc_no", "set_id", "bran_code", "stmt_date", "corr_acc_no",
         "total_items", "automatch_items"},
    )

    validate_columns(
        "tlm_breaks",
        tlm_breaks_ds["query"],
        {"agent_code", "local_acc_no", "bran_code", "stmt_date", "breaks_count"},
    )

    validate_columns(
        "reconmgmt_manual",
        reconmgmt_manual_ds["query"],
        {"agent_code", "set_id", "stmt_date", "bran_code", "corr_acc_no",
         "total_items", "automatch_items", "total_manual_match_count"},
    )

    validate_columns(
        "reconmgmt_recon_bank",
        reconmgmt_recon_bank_ds["query"],
        {"recon_engine", "recon_engine_env", "agent_code", "local_acc_no"},
    )

    # ---- Insert seed data ---- #

    today = date.today()

    # bank records
    bank_rows = []
    for agent in AGENT_CODES:
        for set_id in SET_IDS:
            for acc in random.sample(CORR_ACC_NOS, k=min(3, len(CORR_ACC_NOS))):
                bank_rows.append((agent, set_id, acc))
    cur.executemany(
        "INSERT INTO bank (agent_code, local_acc_no, corr_acc_no) VALUES (%s, %s, %s)",
        bank_rows,
    )

    # message_feed records
    mf_rows = [(acc, random.choice(BRAN_CODES)) for acc in CORR_ACC_NOS]
    cur.executemany(
        "INSERT INTO message_feed (corr_acc_no, bran_code) VALUES (%s, %s)",
        mf_rows,
    )

    # item records (~500 rows for automatch stats)
    item_rows = []
    for _ in range(500):
        acc = random.choice(CORR_ACC_NOS)
        stmt = today - timedelta(days=random.randint(0, 30))
        flag = random.choice([0, 1, 11])
        item_rows.append((acc, stmt, flag))
    cur.executemany(
        "INSERT INTO item (corr_acc_no, stmt_date, flag_2) VALUES (%s, %s, %s)",
        item_rows,
    )

    # tlm_bdr_relationship_header records
    owners = ["SYSTEM", "system", "AUTONET", "USER1", "USER2"]
    tlm_bdr_rows = []
    for _ in range(300):
        acc = random.choice(CORR_ACC_NOS)
        owner = random.choice(owners)
        tlm_bdr_rows.append((acc, owner))
    cur.executemany(
        "INSERT INTO tlm_bdr_relationship_header (corr_acc_no, last_action_owner) VALUES (%s, %s)",
        tlm_bdr_rows,
    )

    # recon_bank records (~50 rows)
    rb_rows = []
    for instance in TLM_INSTANCES:
        for agent in AGENT_CODES:
            for set_id in random.sample(SET_IDS, k=min(3, len(SET_IDS))):
                rb_rows.append(("TLM", instance, agent, set_id))
    cur.executemany(
        "INSERT INTO recon_bank (recon_engine, recon_engine_env, agent_code, local_acc_no) VALUES (%s, %s, %s, %s)",
        rb_rows,
    )

    # reconmgmt.mr_csum_man_match_stats_hist records (~100 rows)
    manual_rows = []
    for _ in range(100):
        agent = random.choice(AGENT_CODES)
        setid = random.choice(SET_IDS)
        stmt = today - timedelta(days=random.randint(0, 30))
        bran = random.choice(BRAN_CODES)
        acc = random.choice(CORR_ACC_NOS)
        total = random.randint(50, 500)
        auto = random.randint(10, total)
        manual = random.randint(0, total - auto)
        instance = random.choice(TLM_INSTANCES)
        manual_rows.append((agent, setid, stmt, bran, acc, total, auto, manual, instance))
    cur.executemany(
        "INSERT INTO reconmgmt.mr_csum_man_match_stats_hist "
        "(agent_code, setid, stmt_date, bran_code, corr_acc_no, total_items, automatch_items, total_manual_match_count, tlm_instance) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
        manual_rows,
    )

    conn.commit()
    print(f"  Inserted {len(bank_rows)} bank rows")
    print(f"  Inserted {len(mf_rows)} message_feed rows")
    print(f"  Inserted {len(item_rows)} item rows")
    print(f"  Inserted {len(tlm_bdr_rows)} tlm_bdr_relationship_header rows")
    print(f"  Inserted {len(rb_rows)} recon_bank rows")
    print(f"  Inserted {len(manual_rows)} mr_csum_man_match_stats_hist rows")
    cur.close()

    # Seed showcase data for chart-showcase dashboard
    seed_showcase_data(conn)


# --------------------------------------------------------------------------- #
# Seed showcase data (chart-showcase dashboard)
# --------------------------------------------------------------------------- #

def seed_showcase_data(conn) -> None:
    """Create showcase tables and insert synthetic data for every chart type.

    Used by the chart-showcase dashboard to exercise all AG Charts + ECharts types.
    Tables are created in the recon_data database (same as other seed data).
    """
    cur = conn.cursor()
    random.seed(42)  # Reproducible data

    # Validate showcase data source SQL templates against table columns
    showcase_ds_files = [
        "showcase_categories", "showcase_timeseries", "showcase_distribution",
        "showcase_scatter", "showcase_heatmap", "showcase_treemap",
        "showcase_waterfall", "showcase_funnel",
    ]
    showcase_ds = {}
    for ds_name in showcase_ds_files:
        ds_path = DATA_SOURCES_DIR / f"{ds_name}.json"
        if ds_path.exists():
            showcase_ds[ds_name] = json.loads(ds_path.read_text())

    # ---- showcase_categories (6 rows) ---- #
    cur.execute("DROP TABLE IF EXISTS showcase_categories CASCADE")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS showcase_categories (
            department VARCHAR(50) NOT NULL,
            revenue NUMERIC(12,2) NOT NULL,
            headcount INTEGER NOT NULL
        )
    """)
    categories_data = [
        ("Engineering", 4500000, 120),
        ("Sales", 3200000, 85),
        ("Marketing", 1800000, 45),
        ("Operations", 2100000, 95),
        ("Finance", 1500000, 35),
        ("Support", 900000, 60),
    ]
    cur.executemany(
        "INSERT INTO showcase_categories (department, revenue, headcount) VALUES (%s, %s, %s)",
        categories_data,
    )
    if "showcase_categories" in showcase_ds:
        validate_columns(
            "showcase_categories",
            showcase_ds["showcase_categories"]["query"],
            {"department", "revenue", "headcount"},
        )

    # ---- showcase_timeseries (12 rows) ---- #
    cur.execute("DROP TABLE IF EXISTS showcase_timeseries CASCADE")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS showcase_timeseries (
            month_label VARCHAR(20) NOT NULL,
            sort_order INTEGER NOT NULL,
            processed_count INTEGER NOT NULL,
            exception_count INTEGER NOT NULL
        )
    """)
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    timeseries_data = []
    for i, month in enumerate(months):
        processed = 12000 + int(i * 590)  # 12000 to ~18490
        exception = random.randint(150, 400)
        timeseries_data.append((month, i + 1, processed, exception))
    cur.executemany(
        "INSERT INTO showcase_timeseries (month_label, sort_order, processed_count, exception_count) "
        "VALUES (%s, %s, %s, %s)",
        timeseries_data,
    )
    if "showcase_timeseries" in showcase_ds:
        validate_columns(
            "showcase_timeseries",
            showcase_ds["showcase_timeseries"]["query"],
            {"month_label", "sort_order", "processed_count", "exception_count"},
        )

    # ---- showcase_distribution (5 rows) ---- #
    cur.execute("DROP TABLE IF EXISTS showcase_distribution CASCADE")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS showcase_distribution (
            status VARCHAR(50) NOT NULL,
            item_count INTEGER NOT NULL
        )
    """)
    distribution_data = [
        ("Matched", 8500),
        ("Breaks", 1200),
        ("Pending", 650),
        ("Escalated", 180),
        ("Resolved", 3200),
    ]
    cur.executemany(
        "INSERT INTO showcase_distribution (status, item_count) VALUES (%s, %s)",
        distribution_data,
    )
    if "showcase_distribution" in showcase_ds:
        validate_columns(
            "showcase_distribution",
            showcase_ds["showcase_distribution"]["query"],
            {"status", "item_count"},
        )

    # ---- showcase_scatter (30 rows) ---- #
    cur.execute("DROP TABLE IF EXISTS showcase_scatter CASCADE")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS showcase_scatter (
            processing_time_ms NUMERIC(8,2) NOT NULL,
            record_count INTEGER NOT NULL,
            error_rate NUMERIC(5,4) NOT NULL
        )
    """)
    scatter_data = []
    for _ in range(30):
        proc_time = round(random.uniform(50, 500), 2)
        rec_count = random.randint(100, 10000)
        err_rate = round(random.uniform(0.001, 0.05), 4)
        scatter_data.append((proc_time, rec_count, err_rate))
    cur.executemany(
        "INSERT INTO showcase_scatter (processing_time_ms, record_count, error_rate) VALUES (%s, %s, %s)",
        scatter_data,
    )
    if "showcase_scatter" in showcase_ds:
        validate_columns(
            "showcase_scatter",
            showcase_ds["showcase_scatter"]["query"],
            {"processing_time_ms", "record_count", "error_rate"},
        )

    # ---- showcase_heatmap (35 rows: 7 days x 5 hour slots) ---- #
    cur.execute("DROP TABLE IF EXISTS showcase_heatmap CASCADE")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS showcase_heatmap (
            day_of_week VARCHAR(10) NOT NULL,
            hour_slot VARCHAR(10) NOT NULL,
            match_count INTEGER NOT NULL
        )
    """)
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    hours = ["08:00", "10:00", "12:00", "14:00", "16:00"]
    heatmap_data = []
    for day in days:
        for hour in hours:
            count = random.randint(50, 500)
            heatmap_data.append((day, hour, count))
    cur.executemany(
        "INSERT INTO showcase_heatmap (day_of_week, hour_slot, match_count) VALUES (%s, %s, %s)",
        heatmap_data,
    )
    if "showcase_heatmap" in showcase_ds:
        validate_columns(
            "showcase_heatmap",
            showcase_ds["showcase_heatmap"]["query"],
            {"day_of_week", "hour_slot", "match_count"},
        )

    # ---- showcase_treemap (10 rows) ---- #
    cur.execute("DROP TABLE IF EXISTS showcase_treemap CASCADE")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS showcase_treemap (
            entity_name VARCHAR(50) NOT NULL,
            total_volume NUMERIC(12,2) NOT NULL,
            net_change NUMERIC(8,2) NOT NULL
        )
    """)
    treemap_data = [
        ("US Equities", 5000000, 200000),
        ("EU Fixed Income", 4200000, -50000),
        ("APAC FX", 3800000, 150000),
        ("LatAm Rates", 2500000, -30000),
        ("US Credit", 2100000, 80000),
        ("EU Equities", 1900000, 120000),
        ("APAC Commodities", 1500000, -20000),
        ("Global Derivatives", 3200000, 175000),
        ("EM Sovereign", 800000, 45000),
        ("UK Gilts", 600000, -15000),
    ]
    cur.executemany(
        "INSERT INTO showcase_treemap (entity_name, total_volume, net_change) VALUES (%s, %s, %s)",
        treemap_data,
    )
    if "showcase_treemap" in showcase_ds:
        validate_columns(
            "showcase_treemap",
            showcase_ds["showcase_treemap"]["query"],
            {"entity_name", "total_volume", "net_change"},
        )

    # ---- showcase_waterfall (7 rows) ---- #
    cur.execute("DROP TABLE IF EXISTS showcase_waterfall CASCADE")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS showcase_waterfall (
            line_item VARCHAR(50) NOT NULL,
            amount NUMERIC(12,2) NOT NULL,
            sort_order INTEGER NOT NULL
        )
    """)
    waterfall_data = [
        ("Revenue", 5000000, 1),
        ("COGS", -2100000, 2),
        ("Gross Profit", 2900000, 3),
        ("OpEx", -1200000, 4),
        ("R&D", -800000, 5),
        ("Tax", -380000, 6),
        ("Net Income", 520000, 7),
    ]
    cur.executemany(
        "INSERT INTO showcase_waterfall (line_item, amount, sort_order) VALUES (%s, %s, %s)",
        waterfall_data,
    )
    if "showcase_waterfall" in showcase_ds:
        validate_columns(
            "showcase_waterfall",
            showcase_ds["showcase_waterfall"]["query"],
            {"line_item", "amount", "sort_order"},
        )

    # ---- showcase_funnel (5 rows) ---- #
    cur.execute("DROP TABLE IF EXISTS showcase_funnel CASCADE")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS showcase_funnel (
            stage VARCHAR(50) NOT NULL,
            count INTEGER NOT NULL
        )
    """)
    funnel_data = [
        ("Received", 10000),
        ("Validated", 8200),
        ("Matched", 6800),
        ("Reconciled", 5500),
        ("Closed", 4900),
    ]
    cur.executemany(
        "INSERT INTO showcase_funnel (stage, count) VALUES (%s, %s)",
        funnel_data,
    )
    if "showcase_funnel" in showcase_ds:
        validate_columns(
            "showcase_funnel",
            showcase_ds["showcase_funnel"]["query"],
            {"stage", "count"},
        )

    conn.commit()
    print(f"  Inserted {len(categories_data)} showcase_categories rows")
    print(f"  Inserted {len(timeseries_data)} showcase_timeseries rows")
    print(f"  Inserted {len(distribution_data)} showcase_distribution rows")
    print(f"  Inserted {len(scatter_data)} showcase_scatter rows")
    print(f"  Inserted {len(heatmap_data)} showcase_heatmap rows")
    print(f"  Inserted {len(treemap_data)} showcase_treemap rows")
    print(f"  Inserted {len(waterfall_data)} showcase_waterfall rows")
    print(f"  Inserted {len(funnel_data)} showcase_funnel rows")
    cur.close()


# --------------------------------------------------------------------------- #
# Seed RecViz config data (superset_meta database)
# --------------------------------------------------------------------------- #

def seed_recviz_configs(conn) -> None:
    """Seed recviz_dashboards and recviz_data_sources from JSON config files."""
    cur = conn.cursor()

    # Create tables if they don't exist (Alembic migration creates them normally,
    # but this script can also bootstrap)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS recviz_dashboards (
            id VARCHAR(128) PRIMARY KEY,
            name VARCHAR(256) NOT NULL,
            description VARCHAR(1024) DEFAULT '',
            schema_version INTEGER NOT NULL DEFAULT 1,
            config JSONB NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS recviz_data_sources (
            id VARCHAR(128) PRIMARY KEY,
            name VARCHAR(256) NOT NULL,
            schema_version INTEGER NOT NULL DEFAULT 1,
            config JSONB NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    conn.commit()

    # Seed dashboards (preserving IDs from JSON files)
    dashboard_count = 0
    for json_path in sorted(DASHBOARDS_DIR.glob("*.json")):
        config = json.loads(json_path.read_text())
        dashboard_id = config["id"]
        name = config["name"]
        description = config.get("description", "")
        cur.execute(
            """
            INSERT INTO recviz_dashboards (id, name, description, schema_version, config)
            VALUES (%s, %s, %s, 1, %s)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                config = EXCLUDED.config,
                updated_at = NOW()
            """,
            (dashboard_id, name, description, json.dumps(config)),
        )
        dashboard_count += 1
    conn.commit()
    print(f"  Seeded {dashboard_count} dashboards")

    # Seed data sources (preserving IDs from JSON files)
    ds_count = 0
    for json_path in sorted(DATA_SOURCES_DIR.glob("*.json")):
        config = json.loads(json_path.read_text())
        ds_id = config["id"]
        name = config["name"]
        cur.execute(
            """
            INSERT INTO recviz_data_sources (id, name, schema_version, config)
            VALUES (%s, %s, 1, %s)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                config = EXCLUDED.config,
                updated_at = NOW()
            """,
            (ds_id, name, json.dumps(config)),
        )
        ds_count += 1
    conn.commit()
    print(f"  Seeded {ds_count} data sources")

    cur.close()


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #

def main() -> None:
    print("=" * 60)
    print("RecViz PostgreSQL Seed Script")
    print("=" * 60)

    # 1. Seed recon_data
    print("\n[1/2] Seeding recon_data database...")
    try:
        conn_recon = psycopg2.connect(RECON_DB_URL)
        seed_recon_data(conn_recon)
        conn_recon.close()
        print("  Done.")
    except psycopg2.OperationalError as e:
        print(f"  WARNING: Could not connect to recon_data: {e}")
        print("  Skipping recon data seeding. Ensure PostgreSQL is running.")

    # 2. Seed RecViz config data in superset_meta
    print("\n[2/2] Seeding superset_meta database (RecViz configs)...")
    try:
        conn_meta = psycopg2.connect(RECVIZ_DB_URL)
        seed_recviz_configs(conn_meta)
        conn_meta.close()
        print("  Done.")
    except psycopg2.OperationalError as e:
        print(f"  WARNING: Could not connect to superset_meta: {e}")
        print("  Skipping config seeding. Ensure PostgreSQL is running.")

    print("\nSeed complete.")


if __name__ == "__main__":
    main()
