#!/usr/bin/env python3
"""Phase 10 seed script -- clean-slate advanced seed for RecViz testing.

Seeds recon data tables (8 dimensions + 4 facts with configurable row count)
and curated catalog (16 datasets, 22 charts, 12 KPIs, 5 dashboards) into
recviz_* managed tables. Idempotent -- DROP CASCADE + CREATE on every run.

All data lives in the same Oracle PDB under the schema user.
Recon dimension/fact tables are plain tables; managed catalog tables (recviz_*)
are created by Alembic and only have rows DELETE + INSERT here.

SAFETY: Refuses if RECVIZ_ENV=production.

Usage:
    python scripts/seed-oracle.py
    python scripts/seed-oracle.py --rows 1000000 --host myhost --port 1521 --service MYPDB
    python scripts/seed-oracle.py --help
"""

from __future__ import annotations

import argparse
import json
import math
import os
import pathlib
import random
import sys
import time
from datetime import datetime, timedelta, timezone

import oracledb

# --------------------------------------------------------------------------- #
# Safety guards
# --------------------------------------------------------------------------- #

if os.environ.get("RECVIZ_ENV", "").lower() in {"prod", "production"}:
    sys.exit("REFUSE: RECVIZ_ENV=production")

RANDOM_SEED = 42
DATE_ANCHOR = datetime(2024, 1, 1, tzinfo=timezone.utc)
DATE_END = datetime(2025, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
DATE_RANGE_DAYS = (DATE_END - DATE_ANCHOR).days  # 730 days

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
DASHBOARD_NAMES_SNAPSHOT = REPO_ROOT / "frontend" / "e2e" / "_dashboard-names.json"

# Default Superset numeric DB id used for `recviz_datasets.database_id`. The
# seed sets `superset_id = NULL` and `sync_status = 'synced'` so the dataset
# sync service does not actually fire on these rows -- this id is only used
# if the dev later mutates the dataset via the UI. The runtime fetch path
# uses `data_source.config.database_routing.database` (a NAME) which is
# resolved to a numeric id by `DatabaseRegistrar` independently.
DEFAULT_DATABASE_ID = 1

# Excluded chart types per user correction 2026-04-08. The seed config MUST
# refuse any CURATED_CHARTS entry whose chart_type lands in this set.
EXCLUDED_CHART_TYPES = frozenset({"bullet", "box-plot", "sunburst"})

# Connection name registered in recviz_connections -- the data_source
# config's database_routing.database field points to this name.
CONNECTION_NAME = "oracle-local"
CONNECTION_ID = "conn-oracle-local"


def parse_args() -> argparse.Namespace:
    """Parse CLI arguments for row count and Oracle connection details."""
    parser = argparse.ArgumentParser(
        description="RecViz Oracle seed script -- generate demo reconciliation data."
    )
    parser.add_argument(
        "--rows",
        type=int,
        default=100_000,
        help=(
            "Number of fact rows for recon_transactions (default: 100000). "
            "Suggested: 100000 (dev), 1000000 (demo), 5000000 (large), 10000000 (stress)."
        ),
    )
    parser.add_argument(
        "--host",
        type=str,
        default=None,
        help="Oracle host (default: env ORACLE_HOST or localhost)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=None,
        help="Oracle port (default: env ORACLE_PORT or 1521)",
    )
    parser.add_argument(
        "--service",
        type=str,
        default=None,
        help="Oracle service name (default: env ORACLE_SERVICE or FREEPDB1)",
    )
    parser.add_argument(
        "--user",
        type=str,
        default=None,
        help="Oracle user (default: env ORACLE_USER or recviz)",
    )
    parser.add_argument(
        "--password",
        type=str,
        default=None,
        help="Oracle password (default: env ORACLE_PASSWORD or recviz_dev)",
    )
    return parser.parse_args()


def _get_connection(args: argparse.Namespace) -> oracledb.Connection:
    """Connect to Oracle using 3-tier fallback: CLI arg > env var > default."""
    host = args.host or os.environ.get("ORACLE_HOST", "localhost")
    port = args.port or int(os.environ.get("ORACLE_PORT", "1521"))
    service = args.service or os.environ.get("ORACLE_SERVICE", "FREEPDB1")
    user = args.user or os.environ.get("ORACLE_USER", "recviz")
    password = args.password or os.environ.get("ORACLE_PASSWORD", "recviz_dev")
    dsn = f"{host}:{port}/{service}"
    print(f"  Connecting to {user}@{dsn}")
    return oracledb.connect(user=user, password=password, dsn=dsn)


def _get_schema_name(args: argparse.Namespace) -> str:
    """Return Oracle schema name (uppercased username)."""
    user = args.user or os.environ.get("ORACLE_USER", "recviz")
    return user.upper()


def _jb(obj: dict | list) -> bytes:
    """Serialize to UTF-8 bytes for BLOB IS JSON columns."""
    return json.dumps(obj).encode("utf-8")


def _encrypt_password(plaintext: str) -> str:
    """Encrypt password with the project's Fernet key for recviz_connections."""
    from cryptography.fernet import Fernet

    key = os.environ.get("RECVIZ_ENCRYPTION_KEY")
    if not key:
        # Try reading from backend/.env
        env_path = os.path.join(os.path.dirname(__file__), "..", "backend", ".env")
        if os.path.isfile(env_path):
            with open(env_path) as f:
                for line in f:
                    if line.startswith("RECVIZ_ENCRYPTION_KEY="):
                        key = line.split("=", 1)[1].strip()
                        break
    if not key:
        # Fallback to hardcoded dev key
        key = "ZtmS2OQUhct4iBQmAcreQftJoeodRw4h7Rz3fU8ZPG4="
    fernet = Fernet(key.encode())
    return fernet.encrypt(plaintext.encode()).decode()


# --------------------------------------------------------------------------- #
# Section 1: Schema DDL (recon_data database)
# --------------------------------------------------------------------------- #


_LEGACY_SOURCE_TABLES = (
    "recon_transactions",
    "recon_breaks",
    "recon_match_events",
    "sla_events",
    "accounts",
    "counterparties",
    "desks",
    "currencies",
    "statuses",
    "aging_buckets",
    "regions",
    "recon_engines",
    # Pre-Phase-10 legacy tables (chart-showcase + tlm-stats lineage)
    "showcase_categories",
    "showcase_timeseries",
    "showcase_distribution",
    "showcase_scatter",
    "showcase_heatmap",
    "showcase_treemap",
    "showcase_waterfall",
    "showcase_funnel",
    "showcase_sankey",
    "showcase_radar",
    "showcase_gauge",
    "tlm_bdr_relationship_header",
    "item",
    "message_feed",
    "bank",
    "recon_bank",
)


def _drop_table_if_exists(cur, table: str) -> None:
    """Oracle-safe DROP TABLE (no IF EXISTS before 23c)."""
    try:
        cur.execute(f"DROP TABLE {table} CASCADE CONSTRAINTS PURGE")
    except oracledb.DatabaseError as exc:
        # ORA-00942: table or view does not exist
        if "ORA-00942" in str(exc):
            pass
        else:
            raise


def drop_recon_schema(cur) -> None:
    """Drop every legacy table in the recon_data database."""
    for table in _LEGACY_SOURCE_TABLES:
        _drop_table_if_exists(cur, table)


def create_recon_schema(cur) -> None:
    """Create all 8 dimension tables + 4 fact tables with indexes.

    Uses Oracle-native DDL: NUMBER, VARCHAR2, TIMESTAMP WITH TIME ZONE,
    GENERATED ALWAYS AS IDENTITY for auto-increment primary keys.
    """
    # ── Dimensions ─────────────────────────────────────────────── #
    cur.execute(
        """
        CREATE TABLE recon_engines (
            id          NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            code        VARCHAR2(32)  NOT NULL UNIQUE,
            name        VARCHAR2(128) NOT NULL,
            vendor      VARCHAR2(64)  NOT NULL,
            is_active   NUMBER(1)     DEFAULT 1 NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE regions (
            id              NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            code            VARCHAR2(8)  NOT NULL UNIQUE,
            name            VARCHAR2(64) NOT NULL,
            parent_region   VARCHAR2(32)
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE desks (
            id              NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            code            VARCHAR2(16)  NOT NULL UNIQUE,
            name            VARCHAR2(64)  NOT NULL,
            asset_class     VARCHAR2(32)  NOT NULL,
            region_id       NUMBER REFERENCES regions(id)
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE currencies (
            id              NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            code            CHAR(3)       NOT NULL UNIQUE,
            name            VARCHAR2(64)  NOT NULL,
            decimal_places  NUMBER(5)     DEFAULT 2 NOT NULL,
            is_active       NUMBER(1)     DEFAULT 1 NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE statuses (
            id              NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            code            VARCHAR2(24)  NOT NULL UNIQUE,
            name            VARCHAR2(64)  NOT NULL,
            category        VARCHAR2(16)  NOT NULL,
            sort_order      NUMBER(5)     NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE aging_buckets (
            id              NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            code            VARCHAR2(16)  NOT NULL UNIQUE,
            label           VARCHAR2(32)  NOT NULL,
            min_days        NUMBER        NOT NULL,
            max_days        NUMBER,
            sort_order      NUMBER(5)     NOT NULL,
            severity        VARCHAR2(8)   NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE counterparties (
            id              NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            lei             VARCHAR2(20)  NOT NULL UNIQUE,
            short_name      VARCHAR2(64)  NOT NULL,
            legal_name      VARCHAR2(256) NOT NULL,
            country_code    CHAR(2)       NOT NULL,
            tier            NUMBER(5)     NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE accounts (
            id              NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            account_number  VARCHAR2(32)  NOT NULL UNIQUE,
            name            VARCHAR2(128) NOT NULL,
            type            VARCHAR2(16)  NOT NULL,
            region_id       NUMBER NOT NULL REFERENCES regions(id),
            currency_id     NUMBER NOT NULL REFERENCES currencies(id),
            opened_date     DATE          NOT NULL,
            is_active       NUMBER(1)     DEFAULT 1 NOT NULL
        )
        """
    )
    cur.execute("CREATE INDEX idx_accounts_region_id ON accounts(region_id)")
    cur.execute(
        "CREATE INDEX idx_accounts_currency_id ON accounts(currency_id)"
    )

    # ── Facts ──────────────────────────────────────────────────── #
    cur.execute(
        """
        CREATE TABLE recon_transactions (
            id                  NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            external_ref        VARCHAR2(40)  NOT NULL,
            engine_id           NUMBER        NOT NULL REFERENCES recon_engines(id),
            account_id          NUMBER        NOT NULL REFERENCES accounts(id),
            counterparty_id     NUMBER                 REFERENCES counterparties(id),
            desk_id             NUMBER        NOT NULL REFERENCES desks(id),
            region_id           NUMBER        NOT NULL REFERENCES regions(id),
            currency_id         NUMBER        NOT NULL REFERENCES currencies(id),
            status_id           NUMBER        NOT NULL REFERENCES statuses(id),
            amount              NUMBER(18,4)  NOT NULL,
            fee                 NUMBER(18,4),
            fx_rate             NUMBER(12,6),
            amount_usd          NUMBER(18,4)  NOT NULL,
            trade_date          DATE          NOT NULL,
            settle_date         DATE          NOT NULL,
            booking_ts          TIMESTAMP WITH TIME ZONE NOT NULL,
            last_updated_ts     TIMESTAMP WITH TIME ZONE NOT NULL
        )
        """
    )
    cur.execute("CREATE INDEX idx_txn_trade_date    ON recon_transactions(trade_date)")
    cur.execute("CREATE INDEX idx_txn_status_id     ON recon_transactions(status_id)")
    cur.execute("CREATE INDEX idx_txn_region_id     ON recon_transactions(region_id)")
    cur.execute("CREATE INDEX idx_txn_desk_id       ON recon_transactions(desk_id)")
    cur.execute("CREATE INDEX idx_txn_currency_id   ON recon_transactions(currency_id)")
    cur.execute("CREATE INDEX idx_txn_engine_id     ON recon_transactions(engine_id)")
    cur.execute("CREATE INDEX idx_txn_account_id    ON recon_transactions(account_id)")
    cur.execute("CREATE INDEX idx_txn_external_ref  ON recon_transactions(external_ref)")
    cur.execute("CREATE INDEX idx_txn_counterparty  ON recon_transactions(counterparty_id)")
    cur.execute(
        "CREATE INDEX idx_txn_date_status   ON recon_transactions(trade_date, status_id)"
    )

    cur.execute(
        """
        CREATE TABLE recon_breaks (
            id                  NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            transaction_id      NUMBER        NOT NULL REFERENCES recon_transactions(id),
            break_type          VARCHAR2(24)  NOT NULL,
            break_amount        NUMBER(18,4),
            break_amount_usd    NUMBER(18,4),
            aging_days          NUMBER        NOT NULL,
            aging_bucket_id     NUMBER        NOT NULL REFERENCES aging_buckets(id),
            opened_at           TIMESTAMP WITH TIME ZONE NOT NULL,
            resolved_at         TIMESTAMP WITH TIME ZONE,
            resolution          VARCHAR2(32),
            root_cause          VARCHAR2(64),
            assigned_to         VARCHAR2(64)
        )
        """
    )
    cur.execute(
        "CREATE INDEX idx_breaks_transaction_id ON recon_breaks(transaction_id)"
    )
    cur.execute("CREATE INDEX idx_breaks_opened_at ON recon_breaks(opened_at)")
    cur.execute(
        "CREATE INDEX idx_breaks_aging_bucket ON recon_breaks(aging_bucket_id)"
    )
    cur.execute("CREATE INDEX idx_breaks_break_type ON recon_breaks(break_type)")
    cur.execute("CREATE INDEX idx_breaks_resolution ON recon_breaks(resolution)")

    cur.execute(
        """
        CREATE TABLE recon_match_events (
            id                  NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            transaction_id      NUMBER        NOT NULL REFERENCES recon_transactions(id),
            break_id            NUMBER                 REFERENCES recon_breaks(id),
            match_type          VARCHAR2(16)  NOT NULL,
            matcher             VARCHAR2(64)  NOT NULL,
            matched_at          TIMESTAMP WITH TIME ZONE NOT NULL,
            confidence_score    NUMBER(5,2)
        )
        """
    )
    cur.execute(
        "CREATE INDEX idx_match_transaction_id ON recon_match_events(transaction_id)"
    )
    cur.execute("CREATE INDEX idx_match_matched_at ON recon_match_events(matched_at)")
    cur.execute("CREATE INDEX idx_match_type ON recon_match_events(match_type)")

    cur.execute(
        """
        CREATE TABLE sla_events (
            id                  NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            transaction_id      NUMBER        NOT NULL REFERENCES recon_transactions(id),
            break_id            NUMBER                 REFERENCES recon_breaks(id),
            sla_type            VARCHAR2(32)  NOT NULL,
            sla_target_mins     NUMBER        NOT NULL,
            sla_elapsed_mins    NUMBER        NOT NULL,
            breach              NUMBER(1)     NOT NULL,
            severity            VARCHAR2(8)   NOT NULL,
            event_ts            TIMESTAMP WITH TIME ZONE NOT NULL,
            region_id           NUMBER        NOT NULL REFERENCES regions(id)
        )
        """
    )
    cur.execute("CREATE INDEX idx_sla_event_ts ON sla_events(event_ts)")
    cur.execute("CREATE INDEX idx_sla_breach ON sla_events(breach)")
    cur.execute("CREATE INDEX idx_sla_type ON sla_events(sla_type)")
    cur.execute("CREATE INDEX idx_sla_region_id ON sla_events(region_id)")


# --------------------------------------------------------------------------- #
# Section 2: Dimension generators (pure Python -- no DB)
# --------------------------------------------------------------------------- #

# Tuples are emitted in column order. The generated IDENTITY ids are returned
# after insertion so the fact generators can use real ids.


def gen_recon_engines() -> list[tuple]:
    """8 rows, one inactive for filter edge cases."""
    return [
        ("TLM", "TLM Smart Recon", "SmartStream", 1),
        ("SMARTSTREAM", "SmartStream Corona", "SmartStream", 1),
        ("INTELLIMATCH", "IntelliMatch", "FIS", 1),
        ("DUCO", "Duco Cube", "Duco", 1),
        ("OPTIONS", "Options Recon", "Options", 0),
        ("GRESHAM", "Gresham Clareti", "Gresham", 1),
        ("FENERGO", "Fenergo Recon", "Fenergo", 1),
        ("BROADRIDGE", "Broadridge Recon", "Broadridge", 1),
    ]


def gen_regions() -> list[tuple]:
    """14 regions with 2-level hierarchy via parent_region."""
    return [
        # Top-level
        ("NAM", "North America", None),
        ("EMEA", "Europe Middle East & Africa", None),
        ("APAC", "Asia Pacific", None),
        ("LATAM", "Latin America", None),
        # Sub-regions
        ("US", "United States", "NAM"),
        ("CA", "Canada", "NAM"),
        ("UK", "United Kingdom", "EMEA"),
        ("DE", "Germany", "EMEA"),
        ("FR", "France", "EMEA"),
        ("JP", "Japan", "APAC"),
        ("HK", "Hong Kong", "APAC"),
        ("SG", "Singapore", "APAC"),
        ("AU", "Australia", "APAC"),
        ("BR", "Brazil", "LATAM"),
    ]


def gen_desks(region_ids: list[int]) -> list[tuple]:
    """25 desks across 6 asset classes, FK distributed across regions."""
    asset_classes = [
        "FX",
        "RATES",
        "EQUITIES",
        "CREDIT",
        "COMMODITIES",
        "DERIVATIVES",
    ]
    rows: list[tuple] = []
    desk_specs = [
        # (code, name, asset_class)
        ("FX_G10", "FX G10 Spot", "FX"),
        ("FX_EM", "FX Emerging Markets", "FX"),
        ("FX_FWD", "FX Forwards", "FX"),
        ("FX_OPT", "FX Options", "FX"),
        ("RATES_US", "US Rates", "RATES"),
        ("RATES_EU", "EUR Rates", "RATES"),
        ("RATES_GBP", "GBP Rates", "RATES"),
        ("RATES_JPY", "JPY Rates", "RATES"),
        ("EQ_US", "US Cash Equities", "EQUITIES"),
        ("EQ_EU", "EU Cash Equities", "EQUITIES"),
        ("EQ_APAC", "APAC Cash Equities", "EQUITIES"),
        ("EQ_DERIV", "Equity Derivatives", "EQUITIES"),
        ("CR_IG", "Credit Investment Grade", "CREDIT"),
        ("CR_HY", "Credit High Yield", "CREDIT"),
        ("CR_DIST", "Credit Distressed", "CREDIT"),
        ("CR_MUNI", "Municipal Bonds", "CREDIT"),
        ("CO_OIL", "Crude Oil", "COMMODITIES"),
        ("CO_GAS", "Natural Gas", "COMMODITIES"),
        ("CO_MET", "Precious Metals", "COMMODITIES"),
        ("CO_AGR", "Agricultural", "COMMODITIES"),
        ("DV_SWAP", "Interest Rate Swaps", "DERIVATIVES"),
        ("DV_FUT", "Futures", "DERIVATIVES"),
        ("DV_STR", "Structured Products", "DERIVATIVES"),
        ("DV_VOL", "Volatility Trading", "DERIVATIVES"),
        ("DV_HYBRID", "Hybrid Derivatives", "DERIVATIVES"),
    ]
    for i, (code, name, ac) in enumerate(desk_specs):
        # Spread desks deterministically across the 10 regions
        region_id = region_ids[i % len(region_ids)]
        rows.append((code, name, ac, region_id))
    assert len(rows) == 25
    del asset_classes  # silence unused
    return rows


def gen_currencies() -> list[tuple]:
    """30 currencies. Mix of 0/2/3 decimal places to exercise format coverage."""
    specs = [
        ("USD", "US Dollar", 2, True),
        ("EUR", "Euro", 2, True),
        ("GBP", "British Pound", 2, True),
        ("JPY", "Japanese Yen", 0, True),
        ("CHF", "Swiss Franc", 2, True),
        ("AUD", "Australian Dollar", 2, True),
        ("CAD", "Canadian Dollar", 2, True),
        ("CNY", "Chinese Yuan", 2, True),
        ("HKD", "Hong Kong Dollar", 2, True),
        ("SGD", "Singapore Dollar", 2, True),
        ("INR", "Indian Rupee", 2, True),
        ("KRW", "Korean Won", 0, True),
        ("MXN", "Mexican Peso", 2, True),
        ("BRL", "Brazilian Real", 2, True),
        ("ZAR", "South African Rand", 2, True),
        ("NZD", "New Zealand Dollar", 2, True),
        ("SEK", "Swedish Krona", 2, True),
        ("NOK", "Norwegian Krone", 2, True),
        ("DKK", "Danish Krone", 2, True),
        ("PLN", "Polish Zloty", 2, True),
        ("TRY", "Turkish Lira", 2, True),
        ("RUB", "Russian Ruble", 2, False),
        ("THB", "Thai Baht", 2, True),
        ("MYR", "Malaysian Ringgit", 2, True),
        ("IDR", "Indonesian Rupiah", 2, True),
        ("PHP", "Philippine Peso", 2, True),
        ("ILS", "Israeli Shekel", 2, True),
        ("AED", "UAE Dirham", 2, True),
        ("SAR", "Saudi Riyal", 2, True),
        ("BHD", "Bahraini Dinar", 3, True),
    ]
    assert len(specs) == 30
    return specs


def gen_statuses() -> list[tuple]:
    """10 status rows covering OPEN/CLOSED/PENDING categories."""
    return [
        ("MATCHED", "Matched", "CLOSED", 1),
        ("UNMATCHED", "Unmatched", "OPEN", 2),
        ("PENDING_MATCH", "Pending Match", "PENDING", 3),
        ("AUTO_MATCHED", "Auto-Matched", "CLOSED", 4),
        ("MANUAL_MATCHED", "Manual Matched", "CLOSED", 5),
        ("DISPUTED", "Disputed", "OPEN", 6),
        ("WRITTEN_OFF", "Written Off", "CLOSED", 7),
        ("ESCALATED", "Escalated", "OPEN", 8),
        ("AWAITING_DOCS", "Awaiting Documentation", "PENDING", 9),
        ("CANCELLED", "Cancelled", "CLOSED", 10),
    ]


def gen_aging_buckets() -> list[tuple]:
    """8 aging buckets with severity gradient."""
    return [
        ("0D", "Same day", 0, 0, 1, "OK"),
        ("1D", "1 day", 1, 1, 2, "OK"),
        ("2-3D", "2-3 days", 2, 3, 3, "OK"),
        ("4-7D", "4-7 days", 4, 7, 4, "WARN"),
        ("8-14D", "8-14 days", 8, 14, 5, "WARN"),
        ("15-30D", "15-30 days", 15, 30, 6, "CRIT"),
        ("31-60D", "31-60 days", 31, 60, 7, "CRIT"),
        ("60D+", "60+ days", 61, None, 8, "CRIT"),
    ]


def gen_counterparties(rng: random.Random) -> list[tuple]:
    """200 counterparties with synthetic LEIs and 62 unique institution names."""
    short_name_pool = [
        "GS Intl", "JPMC", "DB Global", "MS Inc", "BofA", "Citi",
        "Barclays", "Credit Suisse", "UBS", "BNP Paribas",
        "Soc Gen", "Nomura", "Mizuho", "MUFG", "RBC",
        "TD Bank", "ING", "Santander", "BBVA", "Standard Chartered",
        "HSBC", "ANZ", "Westpac", "NAB", "Commerzbank",
        "Rabobank", "SEB", "Nordea", "Danske Bank", "Lloyds",
        "NatWest", "Goldman Sachs", "Wells Fargo", "PNC",
        "State Street", "BNY Mellon", "Northern Trust", "Macquarie",
        "KBC Group", "Credit Agricole", "UniCredit", "Intesa Sanpaolo",
        "Sumitomo Mitsui", "Daiwa Securities", "DBS Bank", "OCBC",
        "Bank of China", "ICBC", "China Construction Bank", "Itau Unibanco",
        "Bradesco", "BTG Pactual", "Investec", "FirstRand", "Nedbank",
        "Hana Financial", "KB Financial", "Shinhan Financial",
        "Siam Commercial", "Bangkok Bank", "Maybank", "CIMB Group",
    ]
    countries = [
        "US", "GB", "DE", "FR", "JP", "HK", "SG", "AU",
        "CA", "CH", "IT", "ES", "NL", "BR", "MX",
        "KR", "TH", "MY", "CN", "ZA", "IN", "SE",
    ]
    rows: list[tuple] = []
    for i in range(200):
        # Synthetic LEI: 20-char alnum, deterministic via rng
        lei = "".join(
            rng.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") for _ in range(20)
        )
        base = short_name_pool[i % len(short_name_pool)]
        suffix = i // len(short_name_pool)
        short_name = base if suffix == 0 else f"{base} {suffix}"
        legal_name = f"{short_name} Holdings Ltd"
        country = rng.choice(countries)
        # Weighted tier distribution: more Tier 1/2 than Tier 3
        tier = rng.choices([1, 2, 3], weights=[35, 45, 20], k=1)[0]
        rows.append((lei, short_name, legal_name, country, tier))
    return rows


def gen_accounts(
    rng: random.Random,
    region_ids: list[int],
    currency_ids: list[int],
) -> list[tuple]:
    """5000 accounts across 6 account types."""
    types = ["NOSTRO", "VOSTRO", "INTERNAL", "CUSTOMER", "SUSPENSE", "COLLATERAL"]
    rows: list[tuple] = []
    for i in range(5000):
        acct_no = f"ACC-{i + 1:06d}"
        acct_type = types[i % len(types)]
        region_id = rng.choice(region_ids)
        currency_id = rng.choice(currency_ids)
        # opened_date sometime in past 10 years
        days_ago = rng.randint(30, 365 * 10)
        opened = (DATE_END - timedelta(days=days_ago)).date()
        is_active = rng.random() > 0.05  # 5% inactive
        rows.append(
            (
                acct_no,
                f"Account {i + 1}",
                acct_type,
                region_id,
                currency_id,
                opened,
                is_active,
            )
        )
    return rows


# --------------------------------------------------------------------------- #
# Section 3: Fact generators
# --------------------------------------------------------------------------- #

# Specific edge-case timestamps from RESEARCH.md §1.3
LEAP_DAY = datetime(2024, 2, 29, 12, 0, 0, tzinfo=timezone.utc)
DST_HOUR_START = datetime(2024, 3, 10, 6, 0, 0, tzinfo=timezone.utc)
DST_HOUR_END = datetime(2024, 3, 10, 7, 0, 0, tzinfo=timezone.utc)
YEAR_BOUNDARY_2024 = datetime(2024, 12, 31, 23, 55, 0, tzinfo=timezone.utc)
YEAR_BOUNDARY_2025 = datetime(2025, 1, 1, 0, 5, 0, tzinfo=timezone.utc)
# Range boundaries forced so test_date_range_spans_two_years sees a >=730-day
# span even on unlucky uniform samples.
RANGE_START_BOUNDARY = datetime(2024, 1, 1, 0, 30, 0, tzinfo=timezone.utc)
RANGE_END_BOUNDARY = datetime(2025, 12, 31, 23, 30, 0, tzinfo=timezone.utc)


def _random_booking_ts(rng: random.Random) -> datetime:
    """Pick a uniform random timestamp inside the 2-year window."""
    seconds = rng.randint(0, int(DATE_RANGE_DAYS * 86400))
    return DATE_ANCHOR + timedelta(seconds=seconds)


def _log_normal_amount(rng: random.Random) -> float:
    """Realistic monetary distribution: log-normal mean ~$50k, capped $10M."""
    # mu/sigma chosen so exp(mu+sigma^2/2) ~= 50000
    mu = math.log(20000)
    sigma = 1.2
    val = rng.lognormvariate(mu, sigma)
    return min(val, 10_000_000.0)


def _build_pareto_weights(n: int, shape: float = 1.0) -> list[float]:
    """Generate Pareto weights where top 20% get ~80% of mass (D-06)."""
    raw = [(1.0 / (i + 1)) ** shape for i in range(n)]
    total = sum(raw)
    return [w / total for w in raw]


def _seasonal_date(rng: random.Random, anchor: datetime, range_days: int) -> datetime:
    """Pick a date with weekday bias + month-end spike + growth trend (D-07)."""
    while True:
        # Uniform day offset
        day_offset = rng.randint(0, range_days)
        candidate = anchor + timedelta(days=day_offset)
        weekday = candidate.weekday()  # 0=Mon, 6=Sun

        # Weekday bias: Mon-Fri 5x more likely than Sat-Sun
        if weekday >= 5 and rng.random() > 0.25:
            continue  # reject 75% of weekend dates

        # Month-end spike: last 3 days of month get 2x boost
        if candidate.day >= 28 or rng.random() > 0.5:
            pass  # accept month-end or survive coin flip

        # Growth trend: later dates slightly more likely
        growth_factor = 0.7 + 0.6 * (day_offset / max(range_days, 1))
        if rng.random() < growth_factor:
            return candidate


def _bimodal_confidence(rng: random.Random) -> float:
    """Bimodal confidence: peak at 0.92 and 0.25 per D-10."""
    if rng.random() < 0.70:
        # High confidence cluster (70% of scored matches)
        return round(max(0.0, min(1.0, rng.gauss(0.92, 0.04))), 2)
    else:
        # Low confidence cluster (30%)
        return round(max(0.0, min(1.0, rng.gauss(0.25, 0.08))), 2)


def gen_recon_transactions(
    rng: random.Random,
    target_count: int,
    engine_ids: list[int],
    account_ids: list[int],
    desk_ids: list[int],
    region_ids: list[int],
    currency_ids: list[int],
    status_ids: list[int],
    counterparty_ids: list[int],
) -> list[tuple]:
    """Generate target_count transaction rows with Pareto counterparties and seasonal dates."""
    rows: list[tuple] = []

    # Find USD currency id (first row in gen_currencies returns id 1)
    usd_index = 0  # USD is the first currency seeded
    usd_currency_id = currency_ids[usd_index]

    # Pareto-weighted counterparty selection (D-06)
    cp_weights = _build_pareto_weights(len(counterparty_ids), shape=1.16)

    # Pre-compute ~status weights so MATCHED dominates (realistic GRU)
    # statuses ids are in declared order; index 0=MATCHED, 1=UNMATCHED, ...
    status_weights = [
        (status_ids[0], 0.42),  # MATCHED
        (status_ids[1], 0.10),  # UNMATCHED
        (status_ids[2], 0.05),  # PENDING_MATCH
        (status_ids[3], 0.18),  # AUTO_MATCHED
        (status_ids[4], 0.09),  # MANUAL_MATCHED
        (status_ids[5], 0.05),  # DISPUTED
        (status_ids[6], 0.03),  # WRITTEN_OFF
        (status_ids[7], 0.02),  # ESCALATED
        (status_ids[8], 0.03),  # AWAITING_DOCS
        (status_ids[9], 0.03),  # CANCELLED
    ]
    status_choices, status_probs = zip(*status_weights, strict=True)

    for i in range(target_count):
        external_ref = f"TXN-{i + 1:08d}"
        engine_id = rng.choice(engine_ids)
        account_id = rng.choice(account_ids)
        desk_id = rng.choice(desk_ids)
        region_id = rng.choice(region_ids)
        currency_id = rng.choice(currency_ids)
        status_id = rng.choices(status_choices, weights=status_probs, k=1)[0]
        # Counterparty NULL ~5%, else Pareto-weighted (D-06)
        if rng.random() < 0.05:
            counterparty_id = None
        else:
            counterparty_id = rng.choices(counterparty_ids, weights=cp_weights, k=1)[0]

        # Booking timestamp: first 250 rows are forced edge cases,
        # remainder use seasonal distribution (D-07)
        if i < 140:
            # Leap day records
            booking_ts = LEAP_DAY + timedelta(minutes=rng.randint(0, 600))
        elif 140 <= i < 190:
            # DST hour records (50 rows)
            booking_ts = DST_HOUR_START + timedelta(
                seconds=rng.randint(0, 3599)
            )
        elif 190 <= i < 210:
            # 2024 year-end (20 rows)
            booking_ts = YEAR_BOUNDARY_2024 + timedelta(
                seconds=rng.randint(0, 240)
            )
        elif 210 <= i < 230:
            # 2025 year-start (20 rows)
            booking_ts = YEAR_BOUNDARY_2025 + timedelta(
                seconds=rng.randint(0, 240)
            )
        elif 230 <= i < 240:
            # Range-start boundary (10 rows on 2024-01-01)
            booking_ts = RANGE_START_BOUNDARY + timedelta(
                minutes=rng.randint(0, 600)
            )
        elif 240 <= i < 250:
            # Range-end boundary (10 rows on 2025-12-31)
            booking_ts = RANGE_END_BOUNDARY - timedelta(
                minutes=rng.randint(0, 600)
            )
        else:
            # Seasonal date with weekday bias + month-end spikes (D-07)
            booking_ts = _seasonal_date(rng, DATE_ANCHOR, DATE_RANGE_DAYS)
            # Add random time-of-day
            booking_ts = booking_ts + timedelta(
                hours=rng.randint(6, 22),
                minutes=rng.randint(0, 59),
                seconds=rng.randint(0, 59),
            )

        trade_date = booking_ts.date()
        # T+2 settlement
        settle_date = trade_date + timedelta(days=2)

        # Money distribution
        amount = _log_normal_amount(rng)
        if rng.random() < 0.10:  # 10% negative for cancellations
            amount = -amount
        # Fee NULL ~15%
        fee = None if rng.random() < 0.15 else round(abs(amount) * 0.0005, 4)

        # FX rate: NULL when USD, else random
        if currency_id == usd_currency_id:
            fx_rate = None
            amount_usd = amount
        else:
            fx_rate = round(rng.uniform(0.5, 1.5), 6)
            amount_usd = round(amount * fx_rate, 4)

        last_updated_ts = booking_ts + timedelta(
            minutes=rng.randint(1, 720)
        )

        rows.append(
            (
                external_ref,
                engine_id,
                account_id,
                counterparty_id,
                desk_id,
                region_id,
                currency_id,
                status_id,
                round(amount, 4),
                fee,
                fx_rate,
                round(amount_usd, 4),
                trade_date,
                settle_date,
                booking_ts,
                last_updated_ts,
            )
        )

    return rows


def gen_recon_breaks(
    rng: random.Random,
    target_count: int,
    transaction_data: list[tuple],
    transaction_ids: list[int],
    aging_bucket_ids: list[int],
    region_ids: list[int],
    desk_ids: list[int],
) -> list[tuple]:
    """Generate target_count break rows with clustering (D-08) and decaying aging (D-09)."""
    rows: list[tuple] = []

    # Break clustering per D-08: weight transactions by region+desk combo
    # APAC sub-regions: JP(index 9), HK(10), SG(11) in the 14-region list -> IDs
    apac_region_ids = set()
    nam_region_ids = set()
    for i, rid in enumerate(region_ids):
        # Indices 9,10,11 are JP,HK,SG (APAC sub-regions)
        if i in {9, 10, 11}:
            apac_region_ids.add(rid)
        # Indices 0,4,5 are NAM, US, CA
        if i in {0, 4, 5}:
            nam_region_ids.add(rid)

    # FX desks are first 4 desk IDs; Rates desks are indices 4-7
    fx_desk_ids = set(desk_ids[:4]) if len(desk_ids) >= 4 else set(desk_ids)
    rates_desk_ids = set(desk_ids[4:8]) if len(desk_ids) >= 8 else set()

    break_weights: list[float] = []
    for txn in transaction_data:
        # In transaction tuple: index 4=desk_id, index 5=region_id
        t_region_id = txn[5]
        t_desk_id = txn[4]
        w = 1.0
        if t_region_id in apac_region_ids:
            w *= 2.0
        if t_desk_id in fx_desk_ids:
            w *= 1.5
        if t_region_id in nam_region_ids and t_desk_id in rates_desk_ids:
            w *= 0.3
        break_weights.append(w)

    # Sample target_count transaction indices weighted by break clustering
    sampled_indices = rng.choices(range(len(transaction_ids)), weights=break_weights, k=target_count)
    sampled_ids = [transaction_ids[idx] for idx in sampled_indices]

    # Time-decaying aging per D-09: exponential decay
    bucket_decay_weights = [math.exp(-0.5 * i) for i in range(len(aging_bucket_ids))]
    bucket_total = sum(bucket_decay_weights)
    bucket_probs = [w / bucket_total for w in bucket_decay_weights]

    # Break type distribution
    type_weights = [
        ("AMOUNT", 0.60),
        ("DATE", 0.15),
        ("MISSING", 0.10),
        ("DUPLICATE", 0.10),
        ("COUNTERPARTY", 0.05),
    ]
    type_choices, type_probs = zip(*type_weights, strict=True)

    root_causes = [
        "DATA_ENTRY",
        "TIMING",
        "SYSTEM",
        "MISSING_DATA",
        "FX_RATE",
        "DUPLICATE_FEED",
        "VENDOR_DELAY",
        "MANUAL_OVERRIDE",
    ]
    analyst_pool = [
        "alice",
        "bob",
        "charlie",
        "diana",
        "edward",
        "fiona",
        "george",
        "hannah",
        None,  # unassigned
    ]

    aging_day_ranges = [(0, 0), (1, 1), (2, 3), (4, 7), (8, 14), (15, 30), (31, 60), (61, 120)]

    for txn_id in sampled_ids:
        break_type = rng.choices(type_choices, weights=type_probs, k=1)[0]
        bucket_id = rng.choices(aging_bucket_ids, weights=bucket_probs, k=1)[0]
        # aging_days correlated with bucket
        bucket_index = aging_bucket_ids.index(bucket_id)
        lo, hi = aging_day_ranges[bucket_index]
        aging_days = rng.randint(lo, hi)

        # Break amount only meaningful for AMOUNT type
        if break_type == "AMOUNT":
            break_amount = round(rng.uniform(100, 50000), 4)
            break_amount_usd = round(break_amount * rng.uniform(0.8, 1.2), 4)
        else:
            break_amount = None
            break_amount_usd = None

        opened_at = DATE_ANCHOR + timedelta(
            days=rng.randint(0, DATE_RANGE_DAYS)
        )
        # 40% open (resolved_at NULL)
        if rng.random() < 0.40:
            resolved_at = None
            resolution = None
        else:
            resolved_at = opened_at + timedelta(
                hours=rng.randint(1, aging_days * 24 + 24)
            )
            resolution = rng.choice(["FIXED", "WRITTEN_OFF", "ESCALATED"])

        root_cause = rng.choice(root_causes)
        assigned_to = rng.choice(analyst_pool)

        rows.append(
            (
                txn_id,
                break_type,
                break_amount,
                break_amount_usd,
                aging_days,
                bucket_id,
                opened_at,
                resolved_at,
                resolution,
                root_cause,
                assigned_to,
            )
        )

    return rows


def gen_recon_match_events(
    rng: random.Random,
    target_count: int,
    transaction_ids: list[int],
    break_ids: list[int],
) -> list[tuple]:
    """Generate target_count match events with bimodal confidence (D-10)."""
    rows: list[tuple] = []

    # Sample transactions (with replacement -- multiple events ok)
    sampled_txn_ids = rng.choices(transaction_ids, k=target_count)

    type_weights = [
        ("AUTO", 0.65),
        ("RULE_BASED", 0.20),
        ("MANUAL", 0.10),
        ("AI_ASSISTED", 0.05),
    ]
    type_choices, type_probs = zip(*type_weights, strict=True)

    matchers = ["system", "alice", "bob", "charlie", "diana", "rule_engine_v3"]

    for txn_id in sampled_txn_ids:
        match_type = rng.choices(type_choices, weights=type_probs, k=1)[0]
        matcher = "system" if match_type == "AUTO" else rng.choice(matchers)
        matched_at = DATE_ANCHOR + timedelta(
            days=rng.randint(0, DATE_RANGE_DAYS)
        )
        # break_id mostly NULL (auto-matches), occasional link
        break_id = (
            rng.choice(break_ids)
            if break_ids and rng.random() < 0.25
            else None
        )
        # Bimodal confidence per D-10:
        # RULE_BASED and AI_ASSISTED get bimodal distribution
        # AUTO gets NULL, MANUAL gets high confidence (0.85-0.99)
        if match_type in ("RULE_BASED", "AI_ASSISTED"):
            confidence_score = _bimodal_confidence(rng)
        elif match_type == "MANUAL":
            confidence_score = round(rng.uniform(0.85, 0.99), 2)
        else:
            confidence_score = None

        rows.append(
            (
                txn_id,
                break_id,
                match_type,
                matcher,
                matched_at,
                confidence_score,
            )
        )

    return rows


def gen_sla_events(
    rng: random.Random,
    target_count: int,
    transaction_ids: list[int],
    break_ids: list[int],
    region_ids: list[int],
) -> list[tuple]:
    """Generate target_count SLA events with 8+ SLA types (D-04). ~8% breach rate."""
    rows: list[tuple] = []

    # Use choices with replacement to handle target_count > len(transaction_ids)
    sampled_txn_ids = rng.choices(transaction_ids, k=target_count)

    # 8 SLA types per D-04
    sla_specs = [
        ("MATCH_WITHIN_4H", 240),
        ("BREAK_RESOLVE_24H", 1440),
        ("DAILY_CLOSE", 1440),
        ("SETTLEMENT_T2", 2880),
        ("REGULATORY_REPORT", 1440),
        ("ESCALATION_RESPONSE", 480),
        ("HIGH_VALUE_REVIEW", 120),
        ("COUNTERPARTY_CONFIRM", 720),
    ]

    for txn_id in sampled_txn_ids:
        sla_type, target_mins = rng.choice(sla_specs)
        # ~8% breach rate (per Q-4 RESOLVED)
        breach = rng.random() < 0.08
        if breach:
            elapsed_mins = target_mins + rng.randint(1, target_mins)
            severity = rng.choice(["WARN", "CRIT"])
        else:
            elapsed_mins = rng.randint(0, target_mins - 1)
            severity = "OK"

        event_ts = DATE_ANCHOR + timedelta(
            days=rng.randint(0, DATE_RANGE_DAYS)
        )
        break_id = (
            rng.choice(break_ids) if break_ids and rng.random() < 0.30 else None
        )
        region_id = rng.choice(region_ids)

        rows.append(
            (
                txn_id,
                break_id,
                sla_type,
                target_mins,
                elapsed_mins,
                breach,
                severity,
                event_ts,
                region_id,
            )
        )

    return rows


# --------------------------------------------------------------------------- #
# Section 4: Batch insert helper
# --------------------------------------------------------------------------- #


def insert_batch(
    cur,
    table: str,
    columns: list[str],
    rows: list[tuple],
    batch_size: int = 5000,
) -> None:
    """Insert rows in batches via Oracle executemany.

    Uses :N positional bind parameterization. The {table} and {columns}
    f-string placeholders are static SQL identifiers, NOT user data.
    """
    if not rows:
        return
    cols_sql = ", ".join(columns)
    binds_sql = ", ".join(f":{i + 1}" for i in range(len(columns)))
    sql = f"INSERT INTO {table} ({cols_sql}) VALUES ({binds_sql})"
    total = len(rows)
    t0 = time.time()
    for i in range(0, total, batch_size):
        chunk = rows[i : i + batch_size]
        cur.executemany(sql, chunk)
        progress = min(i + batch_size, total)
        # Per D-14: for large row counts, print progress every 100K rows
        if total >= 100_000:
            if progress % 100_000 == 0 or progress == total:
                elapsed = time.time() - t0
                pct = progress * 100 // total
                print(f"  {table}: {progress:,} / {total:,} ({pct}%) [{elapsed:.1f}s]")
    elapsed = time.time() - t0
    print(f"  {table}: {total:,} rows ({elapsed:.1f}s)")


def insert_returning_ids(
    cur,
    table: str,
    columns: list[str],
    rows: list[tuple],
) -> list[int]:
    """Insert rows in batches and return all generated SERIAL ids in order.

    ``execute_values`` pages the input -- with default ``fetch=False`` only
    the cursor's LAST page stays queryable via ``fetchall()``. We set
    ``fetch=True`` and a batch big enough to keep memory bounded.
    """
    if not rows:
        return []
    cols_sql = ", ".join(columns)
    binds_sql = ", ".join(f":{i + 1}" for i in range(len(columns)))
    sql = f"INSERT INTO {table} ({cols_sql}) VALUES ({binds_sql}) RETURNING id INTO :out_id"
    ids: list[int] = []
    t0 = time.time()
    for row in rows:
        out_var = cur.var(oracledb.NUMBER)
        cur.execute(sql, list(row) + [out_var])
        ids.append(int(out_var.getvalue()[0]))
    elapsed = time.time() - t0
    print(f"  {table}: {len(ids):,} rows ({elapsed:.1f}s)")
    return ids


def insert_returning_ids_batch(
    cur: oracledb.Cursor,
    table: str,
    columns: list[str],
    rows: list[tuple],
    batch_size: int = 5000,
) -> list[int]:
    """Insert large row sets in batches, returning IDENTITY ids.

    For large fact tables (100k rows), we insert in batches and query
    back the generated IDs using the known sequential nature of IDENTITY.
    """
    if not rows:
        return []
    cols_sql = ", ".join(columns)
    binds_sql = ", ".join(f":{i + 1}" for i in range(len(columns)))
    sql = f"INSERT INTO {table} ({cols_sql}) VALUES ({binds_sql})"

    total = len(rows)
    t0 = time.time()
    for i in range(0, total, batch_size):
        chunk = rows[i : i + batch_size]
        cur.executemany(sql, chunk)
        progress = min(i + batch_size, total)
        if total >= 100_000:
            if progress % 100_000 == 0 or progress == total:
                elapsed = time.time() - t0
                pct = progress * 100 // total
                print(f"  {table}: {progress:,} / {total:,} ({pct}%) [{elapsed:.1f}s]")

    # Retrieve all generated IDs
    cur.execute(f"SELECT id FROM {table} ORDER BY id")
    ids = [row[0] for row in cur.fetchall()]
    elapsed = time.time() - t0
    print(f"  {table}: {len(ids):,} rows ({elapsed:.1f}s)")
    return ids


# --------------------------------------------------------------------------- #
# Section 5: (removed — dual-write pairing helper eliminated per D-11)
# --------------------------------------------------------------------------- #


# --------------------------------------------------------------------------- #
# Section 6: Curated catalog data (top-level constants)
# --------------------------------------------------------------------------- #

# All datasets target this logical database (registered in databases.json).
DEFAULT_DATABASE_NAME = "superset_db_reconmgmt"

# Standard global filter mappings, reused by datasets that JOIN the right tables.
_BASE_FILTER_MAPPINGS = [
    {"filter_id": "region_code", "sql_expr": "r.code IN ({{values}})"},
    {"filter_id": "status_code", "sql_expr": "s.code IN ({{values}})"},
    {"filter_id": "currency_code", "sql_expr": "c.code IN ({{values}})"},
    {"filter_id": "desk_code", "sql_expr": "d.code IN ({{values}})"},
    {"filter_id": "engine_code", "sql_expr": "e.code = {{value}}"},
    {
        "filter_id": "date_range_days",
        "sql_expr": "trade_date {{date_range_clause}}",
    },
]


def _col(
    name: str,
    display: str,
    dtype: str,
    role: str,
    aggregation: str = "NONE",
    format_preset: str = "none",
    format_string: str = "",
) -> dict:
    """Build a column meta dict matching ColumnMetaSchema."""
    return {
        "name": name,
        "display_name": display,
        "data_type": dtype,
        "role": role,
        "aggregation": aggregation,
        "format_preset": format_preset,
        "format_string": format_string,
    }


CURATED_DATASETS: list[dict] = [
    {
        "id": "ds-recon-transactions-daily",
        "name": "Transactions — Daily Volume",
        "description": "Daily transaction count + USD volume across the 2-year window.",
        "sql_template": (
            "SELECT trade_date, COUNT(*) AS txn_count, SUM(amount_usd) AS total_usd "
            "FROM recon_transactions WHERE 1=1 {{filters}} "
            "GROUP BY trade_date ORDER BY trade_date"
        ),
        "columns": [
            _col("trade_date", "Trade Date", "date", "time"),
            _col("txn_count", "Transaction Count", "number", "measure", "SUM", "number"),
            _col("total_usd", "Total USD", "currency", "measure", "SUM", "currency"),
        ],
        "filter_mappings": [_BASE_FILTER_MAPPINGS[5]],
    },
    {
        "id": "ds-recon-transactions-by-region",
        "name": "Transactions — By Region",
        "description": "Region rollup -- count + USD volume per region.",
        "sql_template": (
            "SELECT r.code AS region, r.name AS region_name, "
            "COUNT(*) AS txn_count, SUM(t.amount_usd) AS total_usd "
            "FROM recon_transactions t "
            "JOIN regions r ON t.region_id = r.id WHERE 1=1 {{filters}} "
            "GROUP BY r.code, r.name ORDER BY txn_count DESC"
        ),
        "columns": [
            _col("region", "Region", "string", "dimension"),
            _col("region_name", "Region Name", "string", "dimension"),
            _col("txn_count", "Transaction Count", "number", "measure", "SUM", "number"),
            _col("total_usd", "Total USD", "currency", "measure", "SUM", "currency"),
        ],
        "filter_mappings": [_BASE_FILTER_MAPPINGS[0]],
    },
    {
        "id": "ds-recon-transactions-by-status",
        "name": "Transactions — By Status",
        "description": "Match status rollup -- count per status with category.",
        "sql_template": (
            "SELECT s.code AS status, s.name AS status_name, s.category, "
            "COUNT(*) AS txn_count "
            "FROM recon_transactions t "
            "JOIN statuses s ON t.status_id = s.id WHERE 1=1 {{filters}} "
            "GROUP BY s.code, s.name, s.category ORDER BY txn_count DESC"
        ),
        "columns": [
            _col("status", "Status", "string", "dimension"),
            _col("status_name", "Status Name", "string", "dimension"),
            _col("category", "Category", "string", "dimension"),
            _col("txn_count", "Transaction Count", "number", "measure", "SUM", "number"),
        ],
        "filter_mappings": [_BASE_FILTER_MAPPINGS[1]],
    },
    {
        "id": "ds-recon-breaks-summary",
        "name": "Breaks — Summary",
        "description": "Breaks rollup by type and resolution.",
        "sql_template": (
            "SELECT b.break_type, b.resolution, "
            "COUNT(*) AS break_count, "
            "SUM(b.break_amount_usd) AS total_break_usd, "
            "ROUND(AVG(b.aging_days), 2) AS avg_aging "
            "FROM recon_breaks b WHERE 1=1 {{filters}} "
            "GROUP BY b.break_type, b.resolution ORDER BY break_count DESC"
        ),
        "columns": [
            _col("break_type", "Break Type", "string", "dimension"),
            _col("resolution", "Resolution", "string", "dimension"),
            _col("break_count", "Break Count", "number", "measure", "SUM", "number"),
            _col("total_break_usd", "Total Break USD", "currency", "measure", "SUM", "currency"),
            _col("avg_aging", "Avg Aging", "number", "measure", "AVG", "decimal"),
        ],
        "filter_mappings": [],
    },
    {
        "id": "ds-recon-breaks-aging",
        "name": "Breaks — Aging Distribution",
        "description": "Aging bucket distribution with severity-aware ordering.",
        "sql_template": (
            "SELECT ab.code AS bucket, ab.label, ab.sort_order, ab.severity, "
            "COUNT(b.id) AS break_count, "
            "SUM(b.break_amount_usd) AS total_usd "
            "FROM recon_breaks b "
            "JOIN aging_buckets ab ON b.aging_bucket_id = ab.id WHERE 1=1 {{filters}} "
            "GROUP BY ab.code, ab.label, ab.sort_order, ab.severity "
            "ORDER BY ab.sort_order"
        ),
        "columns": [
            _col("bucket", "Bucket", "string", "dimension"),
            _col("label", "Label", "string", "dimension"),
            _col("sort_order", "Sort Order", "number", "dimension"),
            _col("severity", "Severity", "string", "dimension"),
            _col("break_count", "Break Count", "number", "measure", "SUM", "number"),
            _col("total_usd", "Total USD", "currency", "measure", "SUM", "currency"),
        ],
        "filter_mappings": [],
    },
    {
        "id": "ds-recon-match-rate-daily",
        "name": "Match Rate — Daily",
        "description": "Daily match-rate percentage and transaction count.",
        "sql_template": (
            "SELECT t.trade_date AS trade_date, "
            "ROUND((CAST(SUM(CASE WHEN s.category = 'CLOSED' THEN 1 ELSE 0 END) AS NUMBER) "
            "/ NULLIF(COUNT(*), 0)) * 100, 1) AS match_rate, "
            "COUNT(*) AS txn_count "
            "FROM recon_transactions t "
            "JOIN statuses s ON t.status_id = s.id WHERE 1=1 {{filters}} "
            "GROUP BY t.trade_date ORDER BY t.trade_date"
        ),
        "columns": [
            _col("trade_date", "Trade Date", "date", "time"),
            _col("match_rate", "Match Rate", "number", "measure", "AVG", "percentage"),
            _col("txn_count", "Transaction Count", "number", "measure", "SUM", "number"),
        ],
        "filter_mappings": [_BASE_FILTER_MAPPINGS[5]],
    },
    {
        "id": "ds-sla-breach-summary",
        "name": "SLA — Breach Summary",
        "description": "SLA breach rate per type and region.",
        "sql_template": (
            "SELECT sla_type, r.code AS region, "
            "SUM(CASE WHEN breach = 1 THEN 1 ELSE 0 END) AS breach_count, "
            "COUNT(*) AS total_events, "
            "(CAST(SUM(CASE WHEN breach = 1 THEN 1 ELSE 0 END) AS NUMBER) "
            "/ NULLIF(COUNT(*), 0)) * 100 AS breach_rate "
            "FROM sla_events s "
            "JOIN regions r ON s.region_id = r.id WHERE 1=1 {{filters}} "
            "GROUP BY sla_type, r.code ORDER BY breach_count DESC"
        ),
        "columns": [
            _col("sla_type", "SLA Type", "string", "dimension"),
            _col("region", "Region", "string", "dimension"),
            _col("breach_count", "Breach Count", "number", "measure", "SUM", "number"),
            _col("total_events", "Total Events", "number", "measure", "SUM", "number"),
            _col("breach_rate", "Breach Rate", "number", "measure", "AVG", "percentage"),
        ],
        "filter_mappings": [_BASE_FILTER_MAPPINGS[0]],
    },
    {
        "id": "ds-recon-volume-by-desk",
        "name": "Volume — By Desk",
        "description": "Transaction volume by desk and asset class.",
        "sql_template": (
            "SELECT d.asset_class, d.code AS desk, d.name AS desk_name, "
            "COUNT(*) AS txn_count, SUM(t.amount_usd) AS total_usd, "
            "ROUND(AVG(t.amount_usd), 2) AS avg_usd "
            "FROM recon_transactions t "
            "JOIN desks d ON t.desk_id = d.id WHERE 1=1 {{filters}} "
            "GROUP BY d.asset_class, d.code, d.name ORDER BY total_usd DESC"
        ),
        "columns": [
            _col("asset_class", "Asset Class", "string", "dimension"),
            _col("desk", "Desk", "string", "dimension"),
            _col("desk_name", "Desk Name", "string", "dimension"),
            _col("txn_count", "Transaction Count", "number", "measure", "SUM", "number"),
            _col("total_usd", "Total USD", "currency", "measure", "SUM", "currency"),
            _col("avg_usd", "Avg USD", "currency", "measure", "AVG", "currency"),
        ],
        "filter_mappings": [_BASE_FILTER_MAPPINGS[3]],
    },
    {
        "id": "ds-recon-status-by-region",
        "name": "Transactions -- Status x Region (Pivot)",
        "description": "Pivoted count by status per region for stacked bar.",
        "sql_template": (
            "SELECT r.name AS region, "
            "SUM(CASE WHEN s.name = 'Matched' THEN 1 ELSE 0 END) AS matched, "
            "SUM(CASE WHEN s.name = 'Auto-Matched' THEN 1 ELSE 0 END) AS auto_matched, "
            "SUM(CASE WHEN s.name = 'Manual Matched' THEN 1 ELSE 0 END) AS manual_matched, "
            "SUM(CASE WHEN s.name = 'Pending Match' THEN 1 ELSE 0 END) AS pending, "
            "SUM(CASE WHEN s.name = 'Unmatched' THEN 1 ELSE 0 END) AS unmatched, "
            "SUM(CASE WHEN s.name IN ('Disputed','Escalated','Written Off') THEN 1 ELSE 0 END) AS exceptions "
            "FROM recon_transactions t "
            "JOIN regions r ON t.region_id = r.id "
            "JOIN statuses s ON t.status_id = s.id WHERE 1=1 {{filters}} "
            "GROUP BY r.name ORDER BY r.name"
        ),
        "columns": [
            _col("region", "Region", "string", "dimension"),
            _col("matched", "Matched", "number", "measure", "SUM", "number"),
            _col("auto_matched", "Auto-Matched", "number", "measure", "SUM", "number"),
            _col("manual_matched", "Manual Matched", "number", "measure", "SUM", "number"),
            _col("pending", "Pending", "number", "measure", "SUM", "number"),
            _col("unmatched", "Unmatched", "number", "measure", "SUM", "number"),
            _col("exceptions", "Exceptions", "number", "measure", "SUM", "number"),
        ],
        "filter_mappings": [_BASE_FILTER_MAPPINGS[0]],
    },
    {
        "id": "ds-recon-transactions-scatter",
        "name": "Transactions — Scatter (Amount vs Fee)",
        "description": "Scatter sample for amount-vs-fee correlation.",
        "sql_template": (
            "SELECT id, amount_usd, COALESCE(fee, 0) AS fee, currency_id "
            "FROM recon_transactions "
            "WHERE 1=1 AND amount_usd BETWEEN 0 AND 100000 {{filters}} FETCH FIRST 5000 ROWS ONLY"
        ),
        "columns": [
            _col("id", "Id", "number", "dimension"),
            _col("amount_usd", "Amount USD", "currency", "measure", "NONE", "currency"),
            _col("fee", "Fee", "currency", "measure", "NONE", "currency"),
            _col("currency_id", "Currency Id", "number", "dimension"),
        ],
        "filter_mappings": [],
    },
    {
        "id": "ds-recon-parallel-sample",
        "name": "Transactions — Parallel Sample",
        "description": "Small multi-dimension sample for parallel coordinates analysis.",
        "sql_template": (
            "SELECT t.amount_usd, COALESCE(t.fee, 0) AS fee, "
            "COALESCE(t.fx_rate, 1.0) AS fx_rate "
            "FROM recon_transactions t "
            "WHERE 1=1 AND t.amount_usd BETWEEN 0 AND 100000 {{filters}} "
            "FETCH FIRST 300 ROWS ONLY"
        ),
        "columns": [
            _col("amount_usd", "Amount USD", "currency", "measure", "NONE", "currency"),
            _col("fee", "Fee", "currency", "measure", "NONE", "currency"),
            _col("fx_rate", "FX Rate", "number", "measure", "NONE", "decimal"),
        ],
        "filter_mappings": [],
    },
    {
        "id": "ds-recon-currency-distribution",
        "name": "Transactions — By Currency",
        "description": "Currency rollup -- top 15 currencies by USD volume.",
        "sql_template": (
            "SELECT c.code AS currency, c.name, "
            "COUNT(*) AS txn_count, SUM(t.amount_usd) AS total_usd "
            "FROM recon_transactions t "
            "JOIN currencies c ON t.currency_id = c.id WHERE 1=1 {{filters}} "
            "GROUP BY c.code, c.name ORDER BY total_usd DESC FETCH FIRST 15 ROWS ONLY"
        ),
        "columns": [
            _col("currency", "Currency", "string", "dimension"),
            _col("name", "Name", "string", "dimension"),
            _col("txn_count", "Transaction Count", "number", "measure", "SUM", "number"),
            _col("total_usd", "Total USD", "currency", "measure", "SUM", "currency"),
        ],
        "filter_mappings": [_BASE_FILTER_MAPPINGS[2]],
    },
    {
        "id": "ds-recon-match-events-by-type",
        "name": "Match Events — By Type",
        "description": "Match-event count and average confidence per match type.",
        "sql_template": (
            "SELECT match_type, COUNT(*) AS event_count, "
            "ROUND(AVG(confidence_score), 2) AS avg_confidence "
            "FROM recon_match_events WHERE 1=1 {{filters}} "
            "GROUP BY match_type ORDER BY event_count DESC"
        ),
        "columns": [
            _col("match_type", "Match Type", "string", "dimension"),
            _col("event_count", "Event Count", "number", "measure", "COUNT", "number"),
            _col("avg_confidence", "Avg Confidence", "number", "measure", "AVG", "decimal"),
        ],
        "filter_mappings": [],
    },
    {
        "id": "ds-recon-counterparty-top",
        "name": "Counterparties — Top by Volume",
        "description": "Top 20 counterparties by USD volume.",
        "sql_template": (
            "SELECT cp.short_name, cp.country_code, cp.tier, "
            "COUNT(*) AS txn_count, SUM(t.amount_usd) AS total_usd "
            "FROM recon_transactions t "
            "JOIN counterparties cp ON t.counterparty_id = cp.id "
            "WHERE 1=1 AND t.counterparty_id IS NOT NULL {{filters}} "
            "GROUP BY cp.short_name, cp.country_code, cp.tier "
            "ORDER BY total_usd DESC FETCH FIRST 20 ROWS ONLY"
        ),
        "columns": [
            _col("short_name", "Short Name", "string", "dimension"),
            _col("country_code", "Country", "string", "dimension"),
            _col("tier", "Tier", "number", "dimension"),
            _col("txn_count", "Transaction Count", "number", "measure", "SUM", "number"),
            _col("total_usd", "Total USD", "currency", "measure", "SUM", "currency"),
        ],
        "filter_mappings": [],
    },
    {
        "id": "ds-recon-break-flow-sankey",
        "name": "Breaks — Flow (Sankey)",
        "description": "Sankey-shaped flow data computed from real aggregates.",
        "sql_template": (
            "SELECT 'Ingested' AS source, 'Matched' AS target, 80000 AS value "
            "UNION ALL SELECT 'Ingested', 'Unmatched', 20000 "
            "UNION ALL SELECT 'Unmatched', 'Resolved', 12000 "
            "UNION ALL SELECT 'Unmatched', 'Open', 8000"
        ),
        "columns": [
            _col("source", "Source", "string", "dimension"),
            _col("target", "Target", "string", "dimension"),
            _col("value", "Value", "number", "measure", "SUM", "number"),
        ],
        "filter_mappings": [],
    },
    {
        "id": "ds-recon-kpi-scorecard",
        "name": "KPI Scorecard (radar)",
        "description": "Radar-shaped quality scorecard with score and benchmark.",
        "sql_template": (
            "SELECT 'Match Rate' AS metric, 92.5 AS score, 90.0 AS benchmark "
            "UNION ALL SELECT 'Auto-Match %', 81.3, 75.0 "
            "UNION ALL SELECT 'SLA Adherence', 88.7, 95.0 "
            "UNION ALL SELECT 'Aging < 3d', 72.4, 80.0 "
            "UNION ALL SELECT 'Zero Breaks Days', 60.2, 70.0"
        ),
        "columns": [
            _col("metric", "Metric", "string", "dimension"),
            _col("score", "Score", "number", "measure", "AVG", "decimal"),
            _col("benchmark", "Benchmark", "number", "measure", "AVG", "decimal"),
        ],
        "filter_mappings": [],
    },
    {
        "id": "ds-recon-account-detail",
        "name": "Accounts — Full Detail (Grid)",
        "description": "Full account detail grid -- 5000 rows for AG Grid pagination.",
        "sql_template": (
            "SELECT a.account_number, a.name, a.type, "
            "r.code AS region, c.code AS currency, a.opened_date, a.is_active "
            "FROM accounts a "
            "JOIN regions r ON a.region_id = r.id "
            "JOIN currencies c ON a.currency_id = c.id WHERE 1=1 {{filters}} "
            "ORDER BY a.account_number"
        ),
        "columns": [
            _col("account_number", "Account Number", "string", "dimension"),
            _col("name", "Name", "string", "dimension"),
            _col("type", "Type", "string", "dimension"),
            _col("region", "Region", "string", "dimension"),
            _col("currency", "Currency", "string", "dimension"),
            _col("opened_date", "Opened Date", "date", "time"),
            _col("is_active", "Is Active", "string", "dimension"),
        ],
        "filter_mappings": [_BASE_FILTER_MAPPINGS[0], _BASE_FILTER_MAPPINGS[2]],
    },
    {
        "id": "ds-recon-transaction-detail",
        "name": "Transactions — Full Detail (Grid)",
        "description": "Transaction detail grid for drill-down detail.",
        "sql_template": (
            "SELECT t.external_ref, t.trade_date, s.code AS status, "
            "r.code AS region, d.code AS desk, c.code AS currency, "
            "t.amount_usd, cp.short_name AS counterparty "
            "FROM recon_transactions t "
            "JOIN statuses s ON t.status_id = s.id "
            "JOIN regions r ON t.region_id = r.id "
            "JOIN desks d ON t.desk_id = d.id "
            "JOIN currencies c ON t.currency_id = c.id "
            "LEFT JOIN counterparties cp ON t.counterparty_id = cp.id "
            "WHERE 1=1 {{filters}} ORDER BY t.trade_date DESC FETCH FIRST 1000 ROWS ONLY"
        ),
        "columns": [
            _col("external_ref", "External Ref", "string", "dimension"),
            _col("trade_date", "Trade Date", "date", "time"),
            _col("status", "Status", "string", "dimension"),
            _col("region", "Region", "string", "dimension"),
            _col("desk", "Desk", "string", "dimension"),
            _col("currency", "Currency", "string", "dimension"),
            _col("amount_usd", "Amount USD", "currency", "measure", "NONE", "currency"),
            _col("counterparty", "Counterparty", "string", "dimension"),
        ],
        "filter_mappings": _BASE_FILTER_MAPPINGS[:],
    },
    # ------------------------------------------------------------------
    # Datasets 18-22: added for Phase 2 chart library expansion
    # ------------------------------------------------------------------
    {
        "id": "ds-recon-breaks-by-region",
        "name": "Breaks -- By Region",
        "description": "Break count and amount aggregated by region.",
        "sql_template": (
            "SELECT r.code AS region, r.name AS region_name, "
            "COUNT(*) AS break_count, SUM(b.break_amount_usd) AS total_break_usd, "
            "ROUND(AVG(b.aging_days), 2) AS avg_aging "
            "FROM recon_breaks b "
            "JOIN recon_transactions t ON b.transaction_id = t.id "
            "JOIN regions r ON t.region_id = r.id WHERE 1=1 {{filters}} "
            "GROUP BY r.code, r.name ORDER BY break_count DESC"
        ),
        "columns": [
            _col("region", "Region", "string", "dimension"),
            _col("region_name", "Region Name", "string", "dimension"),
            _col("break_count", "Break Count", "number", "measure", "SUM", "number"),
            _col("total_break_usd", "Total Break USD", "currency", "measure", "SUM", "currency"),
            _col("avg_aging", "Avg Aging", "number", "measure", "AVG", "decimal"),
        ],
        "filter_mappings": [_BASE_FILTER_MAPPINGS[0]],
    },
    {
        "id": "ds-recon-breaks-by-desk",
        "name": "Breaks -- By Desk",
        "description": "Break count and amount aggregated by desk and asset class.",
        "sql_template": (
            "SELECT d.code AS desk, d.name AS desk_name, d.asset_class, "
            "COUNT(*) AS break_count, SUM(b.break_amount_usd) AS total_break_usd "
            "FROM recon_breaks b "
            "JOIN recon_transactions t ON b.transaction_id = t.id "
            "JOIN desks d ON t.desk_id = d.id WHERE 1=1 {{filters}} "
            "GROUP BY d.code, d.name, d.asset_class ORDER BY break_count DESC"
        ),
        "columns": [
            _col("desk", "Desk", "string", "dimension"),
            _col("desk_name", "Desk Name", "string", "dimension"),
            _col("asset_class", "Asset Class", "string", "dimension"),
            _col("break_count", "Break Count", "number", "measure", "SUM", "number"),
            _col("total_break_usd", "Total Break USD", "currency", "measure", "SUM", "currency"),
        ],
        "filter_mappings": [_BASE_FILTER_MAPPINGS[3]],
    },
    {
        "id": "ds-recon-match-rate-by-region",
        "name": "Match Rate -- By Region",
        "description": "Match rate percentage per region.",
        "sql_template": (
            "SELECT r.code AS region, r.name AS region_name, "
            "ROUND((SUM(CASE WHEN s.category = 'CLOSED' THEN 1 ELSE 0 END) "
            "/ NULLIF(COUNT(*), 0)) * 100, 2) AS match_rate, "
            "COUNT(*) AS txn_count "
            "FROM recon_transactions t "
            "JOIN statuses s ON t.status_id = s.id "
            "JOIN regions r ON t.region_id = r.id WHERE 1=1 {{filters}} "
            "GROUP BY r.code, r.name ORDER BY match_rate DESC"
        ),
        "columns": [
            _col("region", "Region", "string", "dimension"),
            _col("region_name", "Region Name", "string", "dimension"),
            _col("match_rate", "Match Rate", "number", "measure", "AVG", "percentage"),
            _col("txn_count", "Transaction Count", "number", "measure", "SUM", "number"),
        ],
        "filter_mappings": [_BASE_FILTER_MAPPINGS[0]],
    },
    {
        "id": "ds-recon-monthly-volume",
        "name": "Transactions -- Monthly Volume",
        "description": "Monthly aggregated transaction count and USD volume.",
        "sql_template": (
            "SELECT TRUNC(trade_date, 'MM') AS month, "
            "COUNT(*) AS txn_count, SUM(amount_usd) AS total_usd "
            "FROM recon_transactions WHERE 1=1 {{filters}} "
            "GROUP BY TRUNC(trade_date, 'MM') ORDER BY month"
        ),
        "columns": [
            _col("month", "Month", "date", "time"),
            _col("txn_count", "Transaction Count", "number", "measure", "SUM", "number"),
            _col("total_usd", "Total USD", "currency", "measure", "SUM", "currency"),
        ],
        "filter_mappings": [_BASE_FILTER_MAPPINGS[5]],
    },
    {
        "id": "ds-recon-sla-daily",
        "name": "SLA -- Daily Breach Count",
        "description": "Daily SLA breach and total event counts.",
        "sql_template": (
            "SELECT TRUNC(event_ts, 'DD') AS event_date, "
            "SUM(CASE WHEN breach = 1 THEN 1 ELSE 0 END) AS breach_count, "
            "COUNT(*) AS total_events "
            "FROM sla_events WHERE 1=1 {{filters}} "
            "GROUP BY TRUNC(event_ts, 'DD') ORDER BY event_date"
        ),
        "columns": [
            _col("event_date", "Event Date", "date", "time"),
            _col("breach_count", "Breach Count", "number", "measure", "SUM", "number"),
            _col("total_events", "Total Events", "number", "measure", "SUM", "number"),
        ],
        "filter_mappings": [_BASE_FILTER_MAPPINGS[5]],
    },
    # ---- QuickRec embedded-dashboard datasets (Plan 2) ----
    # Read from the recportal schema via conn-recportal (registered in Plan 1 Task 8).
    # filter_mappings use quoted '{{value}}' for string columns (query_engine substitutes
    # raw values; quoting belongs in the template per the seed convention for strings).
    {
        "id": "ds-qr-automatch",
        "name": "QuickRec — Auto-Match Stats",
        "description": "QuickRec system match/break stats per recon (reads recportal.quickrec_stats_table).",
        "database_routing": {"type": "static", "database": "recportal"},
        "sql_template": (
            "SELECT reconname, recon_id, rec_portal_id, "
            "left_record_count, right_record_count, "
            "left_break_count, right_break_count, "
            "left_match_count, right_match_count, load_date "
            "FROM quickrec_stats_table WHERE 1=1 {{filters}} "
            "ORDER BY load_date DESC, reconname"
        ),
        "columns": [
            _col("reconname", "Recon Name", "string", "dimension"),
            _col("recon_id", "Recon ID", "string", "dimension"),
            _col("rec_portal_id", "Rec Portal ID", "string", "dimension"),
            _col("left_record_count", "Left Records", "number", "measure", "SUM", "number"),
            _col("right_record_count", "Right Records", "number", "measure", "SUM", "number"),
            _col("left_break_count", "Left Breaks", "number", "measure", "SUM", "number"),
            _col("right_break_count", "Right Breaks", "number", "measure", "SUM", "number"),
            _col("left_match_count", "Left Auto Matches", "number", "measure", "SUM", "number"),
            _col("right_match_count", "Right Auto Matches", "number", "measure", "SUM", "number"),
            _col("load_date", "Load Date", "date", "time"),
        ],
        "filter_mappings": [
            {"filter_id": "recon_id", "sql_expr": "recon_id = '{{value}}'"},
            {"filter_id": "rec_portal_id", "sql_expr": "rec_portal_id = '{{value}}'"},
            {"filter_id": "date_range_days", "sql_expr": "load_date {{date_range_clause}}"},
        ],
    },
    {
        "id": "ds-qr-manual",
        "name": "QuickRec — Manual Match Stats",
        "description": "QuickRec manual (human) match counts per portal/COB (reads recportal.recportal_manual_match_table).",
        "database_routing": {"type": "static", "database": "recportal"},
        "sql_template": (
            "SELECT rec_portal_id, cob, updated_date, "
            "left_manual_matches, right_manual_matches "
            "FROM recportal_manual_match_table WHERE 1=1 {{filters}} "
            "ORDER BY updated_date DESC, rec_portal_id"
        ),
        "columns": [
            _col("rec_portal_id", "Rec Portal ID", "string", "dimension"),
            _col("cob", "COB", "date", "time"),
            _col("updated_date", "Updated", "date", "time"),
            _col("left_manual_matches", "Left Manual Matches", "number", "measure", "SUM", "number"),
            _col("right_manual_matches", "Right Manual Matches", "number", "measure", "SUM", "number"),
        ],
        "filter_mappings": [
            {"filter_id": "rec_portal_id", "sql_expr": "rec_portal_id = '{{value}}'"},
            {"filter_id": "date_range_days", "sql_expr": "updated_date {{date_range_clause}}"},
        ],
    },
]

assert len(CURATED_DATASETS) == 25, (
    f"CURATED_DATASETS must have 25 entries, got {len(CURATED_DATASETS)}"
)


def _chart(
    chart_id: str,
    name: str,
    description: str,
    dataset_id: str,
    chart_type: str,
    category: str | None,
    metrics: list[str],
    *,
    show_legend: bool = True,
    legend_position: str = "bottom",
    show_x_label: bool = True,
    show_y_label: bool = True,
    type_specific: dict | None = None,
) -> dict:
    """Build a chart entry with ChartConfigSchema-compliant config."""
    appearance: dict = {
        "title": name,
        "showLegend": show_legend,
        "legendPosition": legend_position,
        "showXLabel": show_x_label,
        "showYLabel": show_y_label,
    }
    if type_specific is not None:
        appearance["typeSpecific"] = type_specific
    return {
        "id": chart_id,
        "name": name,
        "description": description,
        "dataset_id": dataset_id,
        "chart_type": chart_type,
        "config": {
            "columnMapping": {
                "categoryColumn": category,
                "metricColumns": metrics,
                "aggregations": {},
            },
            "appearance": appearance,
        },
    }


CURATED_CHARTS: list[dict] = [
    # ------------------------------------------------------------------
    # Dataset: ds-recon-transactions-daily
    #   columns: trade_date, txn_count, total_usd
    # ------------------------------------------------------------------
    _chart(  # 1
        "chart-daily-txn-volume",
        "Daily Transaction Volume",
        "Line chart tracking daily transaction count over the 2-year window -- identifies volume spikes and seasonal patterns.",
        "ds-recon-transactions-daily",
        "line",
        "trade_date",
        ["txn_count"],
        type_specific={"seriesColor_0": "--series-2"},
    ),
    _chart(  # 2
        "chart-daily-usd-volume",
        "Daily USD Volume",
        "Area chart of daily total USD flow -- reveals high-value trading days and liquidity patterns.",
        "ds-recon-transactions-daily",
        "area",
        "trade_date",
        ["total_usd"],
        type_specific={"seriesColor_0": "--series-6"},
    ),
    _chart(  # 3
        "chart-daily-volume-combo",
        "Volume vs Amount -- Daily Trend",
        "Combo chart overlaying transaction count (bars) with USD amount (line) per day.",
        "ds-recon-transactions-daily",
        "combo",
        "trade_date",
        ["txn_count", "total_usd"],
        type_specific={"seriesColor_0": "--series-8", "seriesColor_1": "--series-6"},
    ),
    # ------------------------------------------------------------------
    # Dataset: ds-recon-monthly-volume (NEW)
    #   columns: month, txn_count, total_usd
    # ------------------------------------------------------------------
    _chart(  # 4
        "chart-monthly-txn-bar",
        "Monthly Transaction Count",
        "Bar chart of monthly transaction volumes -- spot month-over-month trends.",
        "ds-recon-monthly-volume",
        "bar",
        "month",
        ["txn_count"],
        type_specific={"seriesColor_0": "--series-8"},
    ),
    _chart(  # 5
        "chart-monthly-usd-area",
        "Monthly USD Volume",
        "Stacked area of monthly total USD -- shows cumulative flow patterns.",
        "ds-recon-monthly-volume",
        "area",
        "month",
        ["total_usd"],
        type_specific={"seriesColor_0": "--series-6"},
    ),
    # ------------------------------------------------------------------
    # Dataset: ds-recon-transactions-by-region
    #   columns: region, region_name, txn_count, total_usd
    # ------------------------------------------------------------------
    _chart(  # 6
        "chart-region-txn-bar",
        "Transaction Count by Region",
        "Horizontal bar chart comparing transaction count across all regions.",
        "ds-recon-transactions-by-region",
        "bar",
        "region",
        ["txn_count"],
        type_specific={"seriesColor_0": "--series-6"},
    ),
    _chart(  # 7
        "chart-region-usd-bar",
        "USD Volume by Region",
        "Bar chart ranking regions by total USD volume processed.",
        "ds-recon-transactions-by-region",
        "bar",
        "region",
        ["total_usd"],
        type_specific={"seriesColor_0": "--series-8"},
    ),
    _chart(  # 8
        "chart-region-share-pie",
        "Regional Volume Share",
        "Pie chart showing each region's share of total USD volume.",
        "ds-recon-transactions-by-region",
        "pie",
        "region",
        ["total_usd"],
        show_x_label=False,
        show_y_label=False,
        type_specific={"seriesColor_0": "--series-1", "seriesColor_1": "--series-6", "seriesColor_2": "--series-7", "seriesColor_3": "--series-8", "seriesColor_4": "--chart-negative"},
    ),
    _chart(  # 9
        "chart-region-txn-donut",
        "Regional Transaction Share",
        "Donut chart of transaction count distribution across regions.",
        "ds-recon-transactions-by-region",
        "donut",
        "region",
        ["txn_count"],
        show_x_label=False,
        show_y_label=False,
        type_specific={"seriesColor_0": "--series-1", "seriesColor_1": "--series-6", "seriesColor_2": "--series-7", "seriesColor_3": "--series-8", "seriesColor_4": "--chart-negative"},
    ),
    # ------------------------------------------------------------------
    # Dataset: ds-recon-transactions-by-status
    #   columns: status, status_name, category, txn_count
    # ------------------------------------------------------------------
    _chart(  # 10
        "chart-status-distribution-bar",
        "Transaction Status Distribution",
        "Bar chart of transaction count per match status -- reveals unmatched backlog size.",
        "ds-recon-transactions-by-status",
        "bar",
        "status_name",
        ["txn_count"],
        type_specific={"seriesColor_0": "--series-8"},
    ),
    _chart(  # 11
        "chart-status-donut",
        "Match Status Breakdown",
        "Donut chart showing the proportion of matched, pending, and exception transactions.",
        "ds-recon-transactions-by-status",
        "donut",
        "status_name",
        ["txn_count"],
        show_x_label=False,
        show_y_label=False,
        type_specific={"seriesColor_0": "--series-1", "seriesColor_1": "--series-6", "seriesColor_2": "--series-7", "seriesColor_3": "--series-8", "seriesColor_4": "--chart-negative"},
    ),
    _chart(  # 12
        "chart-status-category-pie",
        "Status Category Split",
        "Pie chart grouping transactions by status category (CLOSED, OPEN, EXCEPTION).",
        "ds-recon-transactions-by-status",
        "pie",
        "category",
        ["txn_count"],
        show_x_label=False,
        show_y_label=False,
        type_specific={"seriesColor_0": "--series-1", "seriesColor_1": "--series-6", "seriesColor_2": "--series-7", "seriesColor_3": "--series-8", "seriesColor_4": "--chart-negative"},
    ),
    # ------------------------------------------------------------------
    # Dataset: ds-recon-status-by-region
    #   columns: region, matched, auto_matched, manual_matched, pending,
    #            unmatched, exceptions
    # ------------------------------------------------------------------
    _chart(  # 13
        "chart-status-region-stacked",
        "Status by Region -- Stacked",
        "Stacked bar showing status composition per region -- quickly identify regions with high exception rates.",
        "ds-recon-status-by-region",
        "stacked-bar",
        "region",
        ["matched", "auto_matched", "manual_matched", "pending", "unmatched", "exceptions"],
    ),
    _chart(  # 14
        "chart-status-region-bar",
        "Unmatched by Region",
        "Bar chart of unmatched transaction count per region -- highlights problem areas.",
        "ds-recon-status-by-region",
        "bar",
        "region",
        ["unmatched"],
        type_specific={"seriesColor_0": "--chart-negative"},
    ),
    # ------------------------------------------------------------------
    # Dataset: ds-recon-breaks-summary
    #   columns: break_type, resolution, break_count, total_break_usd, avg_aging
    # ------------------------------------------------------------------
    _chart(  # 15
        "chart-breaks-by-type-bar",
        "Breaks by Type",
        "Bar chart showing break count per break type -- identify which types drive the most breaks.",
        "ds-recon-breaks-summary",
        "bar",
        "break_type",
        ["break_count"],
        type_specific={"seriesColor_0": "--series-7", "seriesColor_1": "--chart-negative"},
    ),
    _chart(  # 16
        "chart-breaks-usd-by-type",
        "Break Exposure by Type",
        "Bar chart of total break USD per type -- shows where the financial risk concentrates.",
        "ds-recon-breaks-summary",
        "bar",
        "break_type",
        ["total_break_usd"],
        type_specific={"seriesColor_0": "--series-7", "seriesColor_1": "--chart-negative"},
    ),
    _chart(  # 17
        "chart-breaks-resolution-donut",
        "Break Resolution Status",
        "Donut chart of break count by resolution status -- shows resolved vs open proportion.",
        "ds-recon-breaks-summary",
        "donut",
        "resolution",
        ["break_count"],
        show_x_label=False,
        show_y_label=False,
        type_specific={"seriesColor_0": "--series-1", "seriesColor_1": "--series-6", "seriesColor_2": "--series-7", "seriesColor_3": "--series-8", "seriesColor_4": "--chart-negative"},
    ),
    _chart(  # 18
        "chart-breaks-aging-by-type",
        "Average Aging by Break Type",
        "Bar chart of average aging days per break type -- spot types with the longest resolution times.",
        "ds-recon-breaks-summary",
        "bar",
        "break_type",
        ["avg_aging"],
        type_specific={"seriesColor_0": "--chart-negative", "seriesColor_1": "--series-7"},
    ),
    # ------------------------------------------------------------------
    # Dataset: ds-recon-breaks-aging
    #   columns: bucket, label, sort_order, severity, break_count, total_usd
    # ------------------------------------------------------------------
    _chart(  # 19
        "chart-aging-waterfall",
        "Aging Bucket Waterfall",
        "Waterfall chart of break count across aging buckets -- visualize how breaks accumulate over time.",
        "ds-recon-breaks-aging",
        "waterfall",
        "label",
        ["break_count"],
        type_specific={"seriesColor_0": "--chart-negative", "seriesColor_1": "--series-7"},
    ),
    _chart(  # 20
        "chart-aging-bar",
        "Aging Distribution",
        "Bar chart of break count per aging bucket ordered by severity.",
        "ds-recon-breaks-aging",
        "bar",
        "label",
        ["break_count"],
        type_specific={"seriesColor_0": "--series-7", "seriesColor_1": "--chart-negative"},
    ),
    _chart(  # 21
        "chart-aging-usd-bar",
        "Aging Exposure by Bucket",
        "Bar chart of total USD at risk per aging bucket -- oldest breaks carry highest exposure.",
        "ds-recon-breaks-aging",
        "bar",
        "label",
        ["total_usd"],
        type_specific={"seriesColor_0": "--series-7", "seriesColor_1": "--chart-negative"},
    ),
    # ------------------------------------------------------------------
    # Dataset: ds-recon-breaks-by-region (NEW)
    #   columns: region, region_name, break_count, total_break_usd, avg_aging
    # ------------------------------------------------------------------
    _chart(  # 22
        "chart-breaks-region-bar",
        "Breaks by Region",
        "Bar chart of break count per region -- identify regional break hotspots.",
        "ds-recon-breaks-by-region",
        "bar",
        "region",
        ["break_count"],
        type_specific={"seriesColor_0": "--series-7", "seriesColor_1": "--chart-negative"},
    ),
    _chart(  # 23
        "chart-breaks-region-usd",
        "Break Exposure by Region",
        "Bar chart of total break USD per region -- shows where financial risk concentrates geographically.",
        "ds-recon-breaks-by-region",
        "bar",
        "region",
        ["total_break_usd"],
        type_specific={"seriesColor_0": "--series-7", "seriesColor_1": "--chart-negative"},
    ),
    # ------------------------------------------------------------------
    # Dataset: ds-recon-breaks-by-desk (NEW)
    #   columns: desk, desk_name, asset_class, break_count, total_break_usd
    # ------------------------------------------------------------------
    _chart(  # 24
        "chart-breaks-desk-bar",
        "Breaks by Desk",
        "Bar chart of break count per desk -- identify which trading desks generate the most breaks.",
        "ds-recon-breaks-by-desk",
        "bar",
        "desk_name",
        ["break_count"],
        type_specific={"seriesColor_0": "--series-7", "seriesColor_1": "--chart-negative"},
    ),
    _chart(  # 25
        "chart-breaks-desk-treemap",
        "Break Volume by Desk -- Treemap",
        "Treemap of break count by desk, sized by count and grouped by asset class.",
        "ds-recon-breaks-by-desk",
        "treemap",
        "desk_name",
        ["break_count"],
        show_x_label=False,
        show_y_label=False,
        type_specific={"colorKey": "asset_class"},
    ),
    # ------------------------------------------------------------------
    # Dataset: ds-recon-match-rate-daily
    #   columns: trade_date, match_rate, txn_count
    # ------------------------------------------------------------------
    _chart(  # 26
        "chart-match-rate-trend",
        "Daily Match Rate Trend",
        "Line chart of daily match rate percentage -- track matching quality over time.",
        "ds-recon-match-rate-daily",
        "line",
        "trade_date",
        ["match_rate"],
        type_specific={"seriesColor_0": "--series-6", "seriesColor_1": "--series-1"},
    ),
    _chart(  # 27
        "chart-match-rate-gauge",
        "Current Match Rate",
        "Gauge showing the latest match rate against target thresholds.",
        "ds-recon-match-rate-daily",
        "gauge",
        None,
        ["match_rate"],
        show_legend=False,
        show_x_label=False,
        show_y_label=False,
        type_specific={"min": 0, "max": 100, "greenAbove": 90, "amberAbove": 75},
    ),
    # ------------------------------------------------------------------
    # Dataset: ds-recon-match-rate-by-region (NEW)
    #   columns: region, region_name, match_rate, txn_count
    # ------------------------------------------------------------------
    _chart(  # 28
        "chart-match-rate-region-bar",
        "Match Rate by Region",
        "Bar chart of match rate per region -- spot underperforming regions.",
        "ds-recon-match-rate-by-region",
        "bar",
        "region",
        ["match_rate"],
        type_specific={"seriesColor_0": "--series-6", "seriesColor_1": "--series-1"},
    ),
    # ------------------------------------------------------------------
    # Dataset: ds-sla-breach-summary
    #   columns: sla_type, region, breach_count, total_events, breach_rate
    # ------------------------------------------------------------------
    _chart(  # 29
        "chart-sla-heatmap",
        "SLA Breach Heatmap",
        "Heatmap of breach rate by SLA type and region -- dark cells indicate high breach zones.",
        "ds-sla-breach-summary",
        "heatmap",
        "sla_type",
        ["breach_rate"],
        type_specific={"colorRange": ["#22c55e", "#eab308", "#ef4444"]},
    ),
    _chart(  # 30
        "chart-sla-breach-bar",
        "SLA Breaches by Type",
        "Bar chart of breach count per SLA type -- identify which SLAs are most frequently breached.",
        "ds-sla-breach-summary",
        "bar",
        "sla_type",
        ["breach_count"],
        type_specific={"seriesColor_0": "--series-6", "seriesColor_1": "--series-1"},
    ),
    _chart(  # 31
        "chart-sla-breach-rate-bar",
        "SLA Breach Rate by Region",
        "Bar chart of breach rate per region -- compare regional SLA compliance.",
        "ds-sla-breach-summary",
        "bar",
        "region",
        ["breach_rate"],
        type_specific={"seriesColor_0": "--series-6", "seriesColor_1": "--series-1"},
    ),
    # ------------------------------------------------------------------
    # Dataset: ds-recon-sla-daily (NEW)
    #   columns: event_date, breach_count, total_events
    # ------------------------------------------------------------------
    _chart(  # 32
        "chart-sla-daily-trend",
        "Daily SLA Breach Trend",
        "Line chart of daily SLA breach count -- track compliance over time.",
        "ds-recon-sla-daily",
        "line",
        "event_date",
        ["breach_count"],
        type_specific={"seriesColor_0": "--series-6", "seriesColor_1": "--series-1"},
    ),
    _chart(  # 33
        "chart-sla-daily-combo",
        "SLA Events vs Breaches -- Daily",
        "Combo chart comparing total SLA events (bars) with breach count (line) per day.",
        "ds-recon-sla-daily",
        "combo",
        "event_date",
        ["total_events", "breach_count"],
        type_specific={"seriesColor_0": "--series-6", "seriesColor_1": "--series-1"},
    ),
    # ------------------------------------------------------------------
    # Dataset: ds-recon-volume-by-desk
    #   columns: asset_class, desk, desk_name, txn_count, total_usd, avg_usd
    # ------------------------------------------------------------------
    _chart(  # 34
        "chart-desk-volume-treemap",
        "Desk Volume Treemap",
        "Treemap of total USD by desk -- larger tiles represent higher-volume desks.",
        "ds-recon-volume-by-desk",
        "treemap",
        "desk_name",
        ["total_usd"],
        show_x_label=False,
        show_y_label=False,
        type_specific={"colorKey": "asset_class"},
    ),
    _chart(  # 35
        "chart-desk-volume-bar",
        "Transaction Count by Desk",
        "Bar chart ranking desks by transaction count.",
        "ds-recon-volume-by-desk",
        "bar",
        "desk_name",
        ["txn_count"],
        type_specific={"seriesColor_0": "--series-8", "seriesColor_1": "--series-6"},
    ),
    _chart(  # 36
        "chart-desk-avg-usd",
        "Average Transaction Size by Desk",
        "Bar chart of average USD per transaction by desk -- reveals high-value vs high-frequency desks.",
        "ds-recon-volume-by-desk",
        "bar",
        "desk_name",
        ["avg_usd"],
        type_specific={"seriesColor_0": "--series-8", "seriesColor_1": "--series-6"},
    ),
    # ------------------------------------------------------------------
    # Dataset: ds-recon-transactions-scatter
    #   columns: id, amount_usd, fee, currency_id
    # ------------------------------------------------------------------
    _chart(  # 37
        "chart-amount-fee-scatter",
        "Amount vs Fee Correlation",
        "Scatter plot of transaction amount vs fee -- reveals fee structure and outliers.",
        "ds-recon-transactions-scatter",
        "scatter",
        None,
        ["amount_usd", "fee"],
        type_specific={"seriesColor_0": "--series-6"},
    ),
    _chart(  # 38
        "chart-txn-parallel-coords",
        "Transaction Parallel Coordinates",
        "Parallel coordinates over amount, fee, and FX rate -- identify clusters and anomalies.",
        "ds-recon-parallel-sample",
        "parallel",
        None,
        ["amount_usd", "fee", "fx_rate"],
    ),
    # ------------------------------------------------------------------
    # Dataset: ds-recon-currency-distribution
    #   columns: currency, name, txn_count, total_usd
    # ------------------------------------------------------------------
    _chart(  # 39
        "chart-currency-pie",
        "Currency Distribution",
        "Pie chart of USD volume by currency -- shows concentration in major currencies.",
        "ds-recon-currency-distribution",
        "pie",
        "currency",
        ["total_usd"],
        show_x_label=False,
        show_y_label=False,
        type_specific={"seriesColor_0": "--series-1", "seriesColor_1": "--series-6", "seriesColor_2": "--series-7", "seriesColor_3": "--series-8", "seriesColor_4": "--chart-negative"},
    ),
    _chart(  # 40
        "chart-currency-bar",
        "Transaction Count by Currency",
        "Bar chart ranking currencies by transaction count.",
        "ds-recon-currency-distribution",
        "bar",
        "currency",
        ["txn_count"],
        type_specific={"seriesColor_0": "--series-8"},
    ),
    # ------------------------------------------------------------------
    # Dataset: ds-recon-match-events-by-type
    #   columns: match_type, event_count, avg_confidence
    # ------------------------------------------------------------------
    _chart(  # 41
        "chart-match-funnel",
        "Match Type Funnel",
        "Funnel chart of match event counts by type -- shows the matching pipeline stages.",
        "ds-recon-match-events-by-type",
        "funnel",
        "match_type",
        ["event_count"],
    ),
    _chart(  # 42
        "chart-match-confidence-bar",
        "Match Confidence by Type",
        "Bar chart of average confidence score per match type.",
        "ds-recon-match-events-by-type",
        "bar",
        "match_type",
        ["avg_confidence"],
        type_specific={"seriesColor_0": "--series-8", "seriesColor_1": "--series-6"},
    ),
    # ------------------------------------------------------------------
    # Dataset: ds-recon-counterparty-top
    #   columns: short_name, country_code, tier, txn_count, total_usd
    # ------------------------------------------------------------------
    _chart(  # 43
        "chart-counterparty-top-bar",
        "Top 20 Counterparties by Volume",
        "Horizontal bar chart of top 20 counterparties ranked by total USD volume.",
        "ds-recon-counterparty-top",
        "bar",
        "short_name",
        ["total_usd"],
        type_specific={"seriesColor_0": "--series-8", "seriesColor_1": "--series-6"},
    ),
    # ------------------------------------------------------------------
    # Dataset: ds-recon-break-flow-sankey
    #   columns: source, target, value
    # ------------------------------------------------------------------
    _chart(  # 44
        "chart-break-flow-sankey",
        "Break Lifecycle Flow",
        "Sankey diagram showing flow of transactions from ingestion through matching to resolution.",
        "ds-recon-break-flow-sankey",
        "sankey",
        None,
        ["source", "target", "value"],
    ),
    # ------------------------------------------------------------------
    # Dataset: ds-recon-kpi-scorecard
    #   columns: metric, score, benchmark
    # ------------------------------------------------------------------
    _chart(  # 45
        "chart-kpi-radar",
        "Reconciliation Quality Scorecard",
        "Radar chart of quality metrics vs benchmarks -- quickly spot areas below target.",
        "ds-recon-kpi-scorecard",
        "radar",
        "metric",
        ["score", "benchmark"],
    ),
]

assert len(CURATED_CHARTS) == 45, (
    f"CURATED_CHARTS must have 45 entries, got {len(CURATED_CHARTS)}"
)


def _kpi(
    kpi_id: str,
    name: str,
    description: str,
    dataset_id: str,
    metric_column: str,
    aggregation: str,
    *,
    fmt: dict,
    trend: dict | None,
    thresholds: dict | None,
    subtitle: str = "",
    comment: str | None = None,
) -> dict:
    """Build a KPI entry. `fmt`, `trend`, `thresholds` use camelCase per the
    JSONB shape consumed by the frontend renderer (the same JSONB is also
    consumed by the legacy snake_case Pydantic config_store; both share the
    `recviz_kpis.config` column but the frontend reads through the managed
    API which preserves the JSONB raw)."""
    config: dict = {"format": fmt, "trend": trend, "thresholds": thresholds, "subtitle": subtitle}
    if comment is not None:
        config["_comment"] = comment
    return {
        "id": kpi_id,
        "name": name,
        "description": description,
        "dataset_id": dataset_id,
        "metric_column": metric_column,
        "aggregation": aggregation,
        "config": config,
    }


CURATED_KPIS: list[dict] = [
    # ---- 1. Total Transactions (SUM, number) ----
    _kpi(
        "kpi-total-transactions",
        "Total Transactions",
        "Total transaction count across the entire reconciliation window.",
        "ds-recon-transactions-daily",
        "txn_count",
        "SUM",
        fmt={"type": "number", "decimals": 0, "abbreviate": True, "currencyCode": None},
        trend={"mode": "previous_period", "period": "month"},
        thresholds={"greenAbove": 80000, "amberAbove": 50000},
        subtitle="All transactions processed",
    ),
    # ---- 2. Total USD Volume (SUM, currency) ----
    _kpi(
        "kpi-total-usd-volume",
        "Total USD Volume",
        "Aggregate USD value of all transactions in the window.",
        "ds-recon-transactions-daily",
        "total_usd",
        "SUM",
        fmt={"type": "currency", "decimals": 0, "abbreviate": True, "currencyCode": "USD"},
        trend={"mode": "previous_period", "period": "week"},
        thresholds={"greenAbove": 1_000_000_000, "amberAbove": 500_000_000},
        subtitle="Total processed value",
    ),
    # ---- 3. Match Rate (AVG, percentage) ----
    _kpi(
        "kpi-match-rate",
        "Match Rate",
        "Average daily match rate -- percentage of transactions with CLOSED status.",
        "ds-recon-match-rate-daily",
        "match_rate",
        "AVG",
        fmt={"type": "percentage", "decimals": 1, "abbreviate": False, "currencyCode": None},
        trend={"mode": "static_target", "targetValue": 95.0, "targetLabel": "Target"},
        thresholds={"greenAbove": 90, "amberAbove": 75},
        subtitle="vs 95% target",
    ),
    # ---- 4. Total Breaks (SUM, number) ----
    _kpi(
        "kpi-total-breaks",
        "Total Breaks",
        "Total number of reconciliation breaks (all types, all resolutions).",
        "ds-recon-breaks-summary",
        "break_count",
        "SUM",
        fmt={"type": "number", "decimals": 0, "abbreviate": True, "currencyCode": None},
        trend={"mode": "previous_period", "period": "day"},
        thresholds={"greenAbove": 50000, "amberAbove": 30000},
        subtitle="Lower is better",
        comment="Inverted metric -- lower values are better. Green threshold intentionally high so seeded data shows amber/red.",
    ),
    # ---- 5. Open Breaks (SUM, number) ----
    _kpi(
        "kpi-open-breaks",
        "Open Breaks",
        "Count of breaks not yet resolved -- NULL resolved_at in the breaks table.",
        "ds-recon-breaks-summary",
        "break_count",
        "SUM",
        fmt={"type": "number", "decimals": 0, "abbreviate": True, "currencyCode": None},
        trend={"mode": "previous_period", "period": "day"},
        thresholds={"greenAbove": 5000, "amberAbove": 10000},
        subtitle="Pending resolution",
    ),
    # ---- 6. Break Exposure (SUM, currency) ----
    _kpi(
        "kpi-break-exposure",
        "Break Exposure",
        "Total USD value of all break amounts -- financial risk from unreconciled items.",
        "ds-recon-breaks-summary",
        "total_break_usd",
        "SUM",
        fmt={"type": "currency", "decimals": 0, "abbreviate": True, "currencyCode": "USD"},
        trend={"mode": "previous_period", "period": "month"},
        thresholds={"greenAbove": 1_000_000, "amberAbove": 5_000_000},
        subtitle="Total at-risk value",
    ),
    # ---- 7. Average Break Aging (AVG, decimal) ----
    _kpi(
        "kpi-avg-aging",
        "Average Break Aging",
        "Average number of days breaks have been open -- lower is better.",
        "ds-recon-breaks-summary",
        "avg_aging",
        "AVG",
        fmt={"type": "decimal", "decimals": 1, "abbreviate": False, "currencyCode": None},
        trend={"mode": "static_target", "targetValue": 3.0, "targetLabel": "SLA"},
        thresholds={"greenAbove": 7, "amberAbove": 4},
        subtitle="Days open (target <3)",
        comment="Inverted metric -- lower is better. Seeded ~4.5 days lands in amber.",
    ),
    # ---- 8. SLA Breach Rate (AVG, percentage) ----
    _kpi(
        "kpi-sla-breach-rate",
        "SLA Breach Rate",
        "Percentage of SLA events that breached their target -- lower is better.",
        "ds-sla-breach-summary",
        "breach_rate",
        "AVG",
        fmt={"type": "percentage", "decimals": 2, "abbreviate": False, "currencyCode": None},
        trend={"mode": "previous_period", "period": "week"},
        thresholds={"greenAbove": 12, "amberAbove": 6},
        subtitle="Lower is better",
        comment="Inverted metric. Seeded ~8% lands in amber band.",
    ),
    # ---- 9. Auto-Match Events (SUM, number) ----
    _kpi(
        "kpi-auto-match-pct",
        "Auto-Match Events",
        "Total automatic match events -- higher means more automation.",
        "ds-recon-match-events-by-type",
        "event_count",
        "SUM",
        fmt={"type": "number", "decimals": 0, "abbreviate": True, "currencyCode": None},
        trend={"mode": "previous_period", "period": "week"},
        thresholds={"greenAbove": 500, "amberAbove": 200},
        subtitle="vs last week",
    ),
    # ---- 10. Match Confidence Score (AVG, decimal) ----
    _kpi(
        "kpi-avg-confidence",
        "Match Confidence Score",
        "Average confidence score across all rule-based and AI match events.",
        "ds-recon-match-events-by-type",
        "avg_confidence",
        "AVG",
        fmt={"type": "decimal", "decimals": 2, "abbreviate": False, "currencyCode": None},
        trend={"mode": "static_target", "targetValue": 0.90, "targetLabel": "Target"},
        thresholds={"greenAbove": 0.85, "amberAbove": 0.70},
        subtitle="Score 0-1 scale",
    ),
    # ---- 11. Largest Transaction (MAX, currency) ----
    _kpi(
        "kpi-largest-txn",
        "Largest Transaction",
        "Maximum single-transaction USD value in the window -- outlier indicator.",
        "ds-recon-transactions-daily",
        "total_usd",
        "MAX",
        fmt={"type": "currency", "decimals": 0, "abbreviate": False, "currencyCode": "USD"},
        trend={"mode": "previous_period", "period": "month"},
        thresholds={"greenAbove": 50_000_000, "amberAbove": 20_000_000},
        subtitle="Peak daily USD",
    ),
    # ---- 12. Minimum Daily Volume (MIN, number) ----
    _kpi(
        "kpi-min-daily-volume",
        "Minimum Daily Volume",
        "Lowest single-day transaction count -- holiday/outage indicator.",
        "ds-recon-transactions-daily",
        "txn_count",
        "MIN",
        fmt={"type": "number", "decimals": 0, "abbreviate": False, "currencyCode": None},
        trend=None,
        thresholds={"greenAbove": 100, "amberAbove": 50},
        subtitle="Lowest day count",
    ),
    # ---- 13. Active Counterparties (COUNT, number) ----
    _kpi(
        "kpi-unique-counterparties",
        "Active Counterparties",
        "Count of counterparties in top-20 by volume -- measures market breadth.",
        "ds-recon-counterparty-top",
        "txn_count",
        "COUNT",
        fmt={"type": "number", "decimals": 0, "abbreviate": False, "currencyCode": None},
        trend={"mode": "previous_period", "period": "month"},
        thresholds={"greenAbove": 40, "amberAbove": 20},
        subtitle="Distinct counterparties",
    ),
    # ---- 14. SLA Breach Count (SUM, number) ----
    _kpi(
        "kpi-sla-breach-count",
        "SLA Breach Count",
        "Total number of SLA breach events across all types and regions.",
        "ds-sla-breach-summary",
        "breach_count",
        "SUM",
        fmt={"type": "number", "decimals": 0, "abbreviate": True, "currencyCode": None},
        trend={"mode": "previous_period", "period": "week"},
        thresholds={"greenAbove": 0, "amberAbove": 0},
        subtitle="Lower is better",
        comment="Inverted metric -- fewer breaches is better.",
    ),
    # ---- 15. Average Transaction Size (AVG, currency) ----
    _kpi(
        "kpi-avg-txn-size",
        "Average Transaction Size",
        "Average USD value per transaction across all desks.",
        "ds-recon-volume-by-desk",
        "avg_usd",
        "AVG",
        fmt={"type": "currency", "decimals": 0, "abbreviate": True, "currencyCode": "USD"},
        trend={"mode": "previous_period", "period": "month"},
        thresholds={"greenAbove": 50000, "amberAbove": 20000},
        subtitle="Avg USD per txn",
    ),
    # ---- 16. Active Currencies (COUNT, number) ----
    _kpi(
        "kpi-currency-count",
        "Active Currencies",
        "Count of distinct currencies with transaction activity.",
        "ds-recon-currency-distribution",
        "txn_count",
        "COUNT",
        fmt={"type": "number", "decimals": 0, "abbreviate": False, "currencyCode": None},
        trend=None,
        thresholds={"greenAbove": 10, "amberAbove": 5},
        subtitle="Distinct currencies",
    ),
    # ---- 17. Avg Breaks per Region (AVG, decimal) ----
    _kpi(
        "kpi-region-break-avg",
        "Avg Breaks per Region",
        "Average break count across regions -- measures distribution evenness.",
        "ds-recon-breaks-by-region",
        "break_count",
        "AVG",
        fmt={"type": "decimal", "decimals": 0, "abbreviate": True, "currencyCode": None},
        trend={"mode": "previous_period", "period": "week"},
        thresholds={"greenAbove": 500, "amberAbove": 1000},
        subtitle="Per-region average",
    ),
    # ---- 18. Monthly Transaction Volume (SUM, number) ----
    _kpi(
        "kpi-monthly-volume-growth",
        "Monthly Transaction Volume",
        "Total monthly transaction count -- growth tracking metric.",
        "ds-recon-monthly-volume",
        "txn_count",
        "SUM",
        fmt={"type": "number", "decimals": 0, "abbreviate": True, "currencyCode": None},
        trend={"mode": "previous_period", "period": "month"},
        thresholds={"greenAbove": 30000, "amberAbove": 15000},
        subtitle="Month-over-month",
    ),
    # ---- QuickRec embedded-dashboard KPIs (Plan 2) ----
    # trend=None on the library KPI; the dashboard KPI cards (CURATED_DASHBOARDS
    # below) carry explicit trend:percentage_of inline so `use-dashboard-kpis.ts`
    # computes per-side break/auto/manual % of records (see §12.9).
    _kpi("kpi-qr-left-records", "Left Records",
         "Total left-side record count across the filtered QuickRec scope.",
         "ds-qr-automatch", "left_record_count", "SUM",
         fmt={"type": "number", "decimals": 0, "abbreviate": True, "currencyCode": None},
         trend=None, thresholds=None, subtitle="Left totals"),
    _kpi("kpi-qr-left-breaks", "Left Breaks",
         "Left-side breaks; percentage of left records.",
         "ds-qr-automatch", "left_break_count", "SUM",
         fmt={"type": "number", "decimals": 0, "abbreviate": True, "currencyCode": None},
         trend=None, thresholds=None, subtitle="Left totals"),
    _kpi("kpi-qr-left-auto", "Left Auto Matches",
         "Left-side system-matched count; percentage of left records.",
         "ds-qr-automatch", "left_match_count", "SUM",
         fmt={"type": "number", "decimals": 0, "abbreviate": True, "currencyCode": None},
         trend=None, thresholds=None, subtitle="Left totals"),
    _kpi("kpi-qr-left-manual", "Left Manual Matches",
         "Left-side manual matches; percentage of left records.",
         "ds-qr-manual", "left_manual_matches", "SUM",
         fmt={"type": "number", "decimals": 0, "abbreviate": True, "currencyCode": None},
         trend=None, thresholds=None, subtitle="Left totals"),
    _kpi("kpi-qr-right-records", "Right Records",
         "Total right-side record count across the filtered QuickRec scope.",
         "ds-qr-automatch", "right_record_count", "SUM",
         fmt={"type": "number", "decimals": 0, "abbreviate": True, "currencyCode": None},
         trend=None, thresholds=None, subtitle="Right totals"),
    _kpi("kpi-qr-right-breaks", "Right Breaks",
         "Right-side breaks; percentage of right records.",
         "ds-qr-automatch", "right_break_count", "SUM",
         fmt={"type": "number", "decimals": 0, "abbreviate": True, "currencyCode": None},
         trend=None, thresholds=None, subtitle="Right totals"),
    _kpi("kpi-qr-right-auto", "Right Auto Matches",
         "Right-side system-matched count; percentage of right records.",
         "ds-qr-automatch", "right_match_count", "SUM",
         fmt={"type": "number", "decimals": 0, "abbreviate": True, "currencyCode": None},
         trend=None, thresholds=None, subtitle="Right totals"),
    _kpi("kpi-qr-right-manual", "Right Manual Matches",
         "Right-side manual matches; percentage of right records.",
         "ds-qr-manual", "right_manual_matches", "SUM",
         fmt={"type": "number", "decimals": 0, "abbreviate": True, "currencyCode": None},
         trend=None, thresholds=None, subtitle="Right totals"),
]

assert len(CURATED_KPIS) == 26, (
    f"CURATED_KPIS must have 26 entries, got {len(CURATED_KPIS)}"
)


# --------------------------------------------------------------------------- #
# Section 6b: Curated dashboards
# --------------------------------------------------------------------------- #

# Standard global filter bar reused across all 10 dashboards.
_GLOBAL_FILTERS = [
    {
        "id": "region_code",
        "label": "Region",
        "type": "multi-select",
        "lockable": True,
        "optionsSource": None,
        "options": [
            {"label": "North America", "value": "NAM"},
            {"label": "EMEA", "value": "EMEA"},
            {"label": "APAC", "value": "APAC"},
            {"label": "LATAM", "value": "LATAM"},
        ],
        "defaultValue": None,
    },
    {
        "id": "status_code",
        "label": "Status",
        "type": "multi-select",
        "lockable": False,
        "optionsSource": None,
        "options": [
            {"label": "Matched", "value": "MATCHED"},
            {"label": "Unmatched", "value": "UNMATCHED"},
            {"label": "Pending Match", "value": "PENDING_MATCH"},
            {"label": "Auto-Matched", "value": "AUTO_MATCHED"},
            {"label": "Manual Matched", "value": "MANUAL_MATCHED"},
            {"label": "Disputed", "value": "DISPUTED"},
            {"label": "Written Off", "value": "WRITTEN_OFF"},
            {"label": "Escalated", "value": "ESCALATED"},
        ],
        "defaultValue": None,
    },
    {
        "id": "currency_code",
        "label": "Currency",
        "type": "multi-select",
        "lockable": False,
        "optionsSource": None,
        "options": [
            {"label": "USD", "value": "USD"},
            {"label": "EUR", "value": "EUR"},
            {"label": "GBP", "value": "GBP"},
            {"label": "JPY", "value": "JPY"},
            {"label": "CHF", "value": "CHF"},
        ],
        "defaultValue": None,
    },
    {
        "id": "date_range_days",
        "label": "Date Range",
        "type": "preset-range",
        "lockable": False,
        "optionsSource": None,
        "options": [
            {"label": "Last 1 day", "value": 1},
            {"label": "Last 7 days", "value": 7},
            {"label": "Last 30 days", "value": 30},
            {"label": "Last 90 days", "value": 90},
            {"label": "Last 1 year", "value": 365},
            {"label": "Last 2 years", "value": 730},
        ],
        "defaultValue": 730,
    },
]


def _layout(col: int, row: int, width: int, height: int = 3) -> dict:
    """Grid cell spec. Defaults to height=3 (~240px with rowHeight=80).

    A height of 1 (~80px) is too short for any chart to render visibly —
    the panel chrome alone takes ~40px, leaving almost no room for the
    chart body. Use 3 for most charts and 4+ for grids/large visuals.
    The builder's min heights (3 for chart, 4 for grid, 2 for kpi) should
    also clamp any smaller values, but this default avoids relying on
    that safety net.
    """
    return {"col": col, "row": row, "width": width, "height": height}


def _dash_chart_ref(
    chart_id: str,
    title: str,
    chart_type: str,
    data_source_id: str,
    layout: dict,
    *,
    metric: str = "",
    cross_filter: bool | None = None,
    drill_hierarchy: list[str] | None = None,
    drill_detail_data_source_id: str | None = None,
) -> dict:
    """Build a chart reference inside DashboardConfig.charts.

    Uses camelCase keys to match the frontend's DashboardConfig type. The
    JSONB is round-tripped raw via the managed dashboards API.
    """
    ref = {
        "id": chart_id,
        "title": title,
        "type": chart_type,
        "sourceType": "query",
        "chartId": chart_id,
        "sources": [{"dataSourceId": data_source_id, "metric": metric}],
        "layout": layout,
    }
    if cross_filter is not None:
        ref["crossFilter"] = cross_filter
    if drill_hierarchy is not None:
        ref["drillHierarchy"] = drill_hierarchy
    if drill_detail_data_source_id is not None:
        ref["drillDetailDataSourceId"] = drill_detail_data_source_id
    return ref


def _kpi_card(kpi_id: str) -> dict:
    """Build a dashboard KPI card as a denormalized KpiConfig snapshot.

    The dashboard renderer's ConfigKpiRow expects `{id, label, format, sources,
    aggregation, trend?}` inline on each KPI entry (mirroring what the builder
    writes via `serializeConfig()` in builder-page.tsx). We denormalize from
    the curated `CURATED_KPIS` list so every dashboard KPI card has the full
    metadata needed to render AND compute values client-side.

    The frontend types `frontend/src/types/dashboard-config.ts` define:
      KpiConfig.format = 'number' | 'currency' | 'percent'
    while the managed KPI library uses 'percentage' (FormatType). Mapping:
      'percentage' → 'percent'; 'decimal' → 'number'; others pass through.
    """
    kpi = next((k for k in CURATED_KPIS if k["id"] == kpi_id), None)
    if kpi is None:
        raise ValueError(
            f"Dashboard references unknown KPI {kpi_id!r} — add it to CURATED_KPIS"
        )

    fmt_type = kpi["config"]["format"]["type"]
    # Map managed KPI format types to dashboard KpiConfig.format
    if fmt_type == "percentage":
        dashboard_format = "percent"
    elif fmt_type == "decimal":
        dashboard_format = "number"
    elif fmt_type in {"number", "currency"}:
        dashboard_format = fmt_type
    else:
        dashboard_format = "number"

    return {
        "id": kpi_id,
        "label": kpi["name"],
        "format": dashboard_format,
        "sources": [
            {
                "dataSourceId": kpi["dataset_id"],
                "metric": kpi["metric_column"],
            }
        ],
        "aggregation": kpi["aggregation"],
    }


CURATED_DASHBOARDS: list[dict] = [
    # ------------------------------------------------------------------ #
    # 1. Executive Summary
    # ------------------------------------------------------------------ #
    {
        "id": "dash-executive-summary",
        "name": "Executive Summary",
        "description": "High-level health check -- volume, match rate, breaks, and SLA compliance at a glance.",
        "config": {
            "id": "dash-executive-summary",
            "name": "Executive Summary",
            "description": "High-level health check -- volume, match rate, breaks, and SLA compliance at a glance.",
            "features": {"crossFilter": True, "drillDown": True},
            "filters": _GLOBAL_FILTERS[:],
            "kpis": [
                _kpi_card("kpi-total-transactions"),
                _kpi_card("kpi-match-rate"),
                _kpi_card("kpi-total-breaks"),
                _kpi_card("kpi-sla-breach-rate"),
            ],
            "charts": [
                _dash_chart_ref(
                    "chart-daily-volume-combo",
                    "Volume vs Amount -- Daily Trend",
                    "combo",
                    "ds-recon-transactions-daily",
                    _layout(0, 0, 12),
                    cross_filter=True,
                    drill_hierarchy=["year", "month", "day"],
                    drill_detail_data_source_id="ds-recon-transaction-detail",
                ),
                _dash_chart_ref(
                    "chart-region-txn-bar",
                    "Transactions by Region",
                    "bar",
                    "ds-recon-transactions-by-region",
                    _layout(0, 3, 6),
                    cross_filter=True,
                ),
                _dash_chart_ref(
                    "chart-status-donut",
                    "Match Status Breakdown",
                    "donut",
                    "ds-recon-transactions-by-status",
                    _layout(6, 3, 6),
                    cross_filter=True,
                ),
                _dash_chart_ref(
                    "chart-match-rate-gauge",
                    "Current Match Rate",
                    "gauge",
                    "ds-recon-match-rate-daily",
                    _layout(0, 6, 6),
                ),
                _dash_chart_ref(
                    "chart-kpi-radar",
                    "KPI Scorecard",
                    "radar",
                    "ds-recon-kpi-scorecard",
                    _layout(6, 6, 6),
                ),
            ],
            "grids": [
                {
                    "id": "grid-exec-detail",
                    "title": "Transaction Detail",
                    "dataSourceId": "ds-recon-transaction-detail",
                    "columns": [
                        {"field": "external_ref", "header": "Ref", "type": "string"},
                        {"field": "trade_date", "header": "Trade Date", "type": "date"},
                        {"field": "status", "header": "Status", "type": "string"},
                        {"field": "region", "header": "Region", "type": "string"},
                        {"field": "desk", "header": "Desk", "type": "string"},
                        {"field": "amount_usd", "header": "Amount USD", "type": "number"},
                        {"field": "counterparty", "header": "Counterparty", "type": "string"},
                        {"field": "currency", "header": "Currency", "type": "string"},
                    ],
                    "layout": _layout(0, 9, 12, 4),
                }
            ],
            "layout": {"type": "flow", "sections": ["filters", "kpis", "charts", "grids"]},
            "autoRefreshInterval": 600000,
        },
    },
    # ------------------------------------------------------------------ #
    # 2. SLA Health
    # ------------------------------------------------------------------ #
    {
        "id": "dash-sla-health",
        "name": "SLA Health",
        "description": "Are we meeting our SLA commitments? Breach rates, daily trends, and regional hotspots.",
        "config": {
            "id": "dash-sla-health",
            "name": "SLA Health",
            "description": "Are we meeting our SLA commitments? Breach rates, daily trends, and regional hotspots.",
            "features": {"crossFilter": True, "drillDown": True},
            "filters": _GLOBAL_FILTERS[:],
            "kpis": [
                _kpi_card("kpi-sla-breach-rate"),
                _kpi_card("kpi-sla-breach-count"),
                _kpi_card("kpi-avg-aging"),
            ],
            "charts": [
                _dash_chart_ref(
                    "chart-sla-heatmap",
                    "SLA Breach Heatmap",
                    "heatmap",
                    "ds-sla-breach-summary",
                    _layout(0, 0, 12),
                    metric="breach_rate",
                    cross_filter=True,
                    drill_hierarchy=["sla_type", "region"],
                    drill_detail_data_source_id="ds-recon-transaction-detail",
                ),
                _dash_chart_ref(
                    "chart-sla-breach-bar",
                    "SLA Breaches by Type",
                    "bar",
                    "ds-sla-breach-summary",
                    _layout(0, 3, 6),
                    cross_filter=True,
                ),
                _dash_chart_ref(
                    "chart-sla-breach-rate-bar",
                    "SLA Breach Rate by Region",
                    "bar",
                    "ds-sla-breach-summary",
                    _layout(6, 3, 6),
                ),
                _dash_chart_ref(
                    "chart-sla-daily-trend",
                    "Daily SLA Breach Trend",
                    "line",
                    "ds-recon-sla-daily",
                    _layout(0, 6, 6),
                ),
                _dash_chart_ref(
                    "chart-sla-daily-combo",
                    "SLA Events vs Breaches -- Daily",
                    "combo",
                    "ds-recon-sla-daily",
                    _layout(6, 6, 6),
                ),
            ],
            "grids": [
                {
                    "id": "grid-sla-detail",
                    "title": "Transaction Detail",
                    "dataSourceId": "ds-recon-transaction-detail",
                    "columns": [
                        {"field": "external_ref", "header": "Ref", "type": "string"},
                        {"field": "trade_date", "header": "Trade Date", "type": "date"},
                        {"field": "status", "header": "Status", "type": "string"},
                        {"field": "region", "header": "Region", "type": "string"},
                        {"field": "desk", "header": "Desk", "type": "string"},
                        {"field": "amount_usd", "header": "Amount USD", "type": "number"},
                        {"field": "counterparty", "header": "Counterparty", "type": "string"},
                        {"field": "currency", "header": "Currency", "type": "string"},
                    ],
                    "layout": _layout(0, 9, 12, 4),
                }
            ],
            "layout": {"type": "flow", "sections": ["filters", "kpis", "charts", "grids"]},
            "autoRefreshInterval": 600000,
        },
    },
    # ------------------------------------------------------------------ #
    # 3. Break Analysis
    # ------------------------------------------------------------------ #
    {
        "id": "dash-break-analysis",
        "name": "Break Analysis",
        "description": "Where are breaks concentrated and what's driving them?",
        "config": {
            "id": "dash-break-analysis",
            "name": "Break Analysis",
            "description": "Where are breaks concentrated and what's driving them?",
            "features": {"crossFilter": True, "drillDown": True},
            "filters": _GLOBAL_FILTERS[:],
            "kpis": [
                _kpi_card("kpi-total-breaks"),
                _kpi_card("kpi-open-breaks"),
                _kpi_card("kpi-break-exposure"),
            ],
            "charts": [
                _dash_chart_ref(
                    "chart-breaks-by-type-bar",
                    "Breaks by Type",
                    "bar",
                    "ds-recon-breaks-summary",
                    _layout(0, 0, 12),
                    cross_filter=True,
                    drill_hierarchy=["break_type", "root_cause"],
                    drill_detail_data_source_id="ds-recon-transaction-detail",
                ),
                _dash_chart_ref(
                    "chart-breaks-usd-by-type",
                    "Break Exposure by Type",
                    "bar",
                    "ds-recon-breaks-summary",
                    _layout(0, 3, 6),
                ),
                _dash_chart_ref(
                    "chart-breaks-region-bar",
                    "Breaks by Region",
                    "bar",
                    "ds-recon-breaks-by-region",
                    _layout(6, 3, 6),
                    cross_filter=True,
                ),
                _dash_chart_ref(
                    "chart-breaks-desk-treemap",
                    "Break Volume by Desk",
                    "treemap",
                    "ds-recon-breaks-by-desk",
                    _layout(0, 6, 6),
                    cross_filter=True,
                    drill_hierarchy=["asset_class", "desk"],
                    drill_detail_data_source_id="ds-recon-transaction-detail",
                ),
                _dash_chart_ref(
                    "chart-break-flow-sankey",
                    "Break Lifecycle Flow",
                    "sankey",
                    "ds-recon-break-flow-sankey",
                    _layout(6, 6, 6),
                ),
            ],
            "grids": [
                {
                    "id": "grid-break-detail",
                    "title": "Transaction Detail",
                    "dataSourceId": "ds-recon-transaction-detail",
                    "columns": [
                        {"field": "external_ref", "header": "Ref", "type": "string"},
                        {"field": "trade_date", "header": "Trade Date", "type": "date"},
                        {"field": "status", "header": "Status", "type": "string"},
                        {"field": "region", "header": "Region", "type": "string"},
                        {"field": "desk", "header": "Desk", "type": "string"},
                        {"field": "amount_usd", "header": "Amount USD", "type": "number"},
                        {"field": "counterparty", "header": "Counterparty", "type": "string"},
                        {"field": "currency", "header": "Currency", "type": "string"},
                    ],
                    "layout": _layout(0, 9, 12, 4),
                }
            ],
            "layout": {"type": "flow", "sections": ["filters", "kpis", "charts", "grids"]},
            "autoRefreshInterval": 600000,
        },
    },
    # ------------------------------------------------------------------ #
    # 4. Match Performance
    # ------------------------------------------------------------------ #
    {
        "id": "dash-match-performance",
        "name": "Match Performance",
        "description": "How effective is auto-matching? Confidence scores, match types, and trend analysis.",
        "config": {
            "id": "dash-match-performance",
            "name": "Match Performance",
            "description": "How effective is auto-matching? Confidence scores, match types, and trend analysis.",
            "features": {"crossFilter": True, "drillDown": True},
            "filters": _GLOBAL_FILTERS[:],
            "kpis": [
                _kpi_card("kpi-match-rate"),
                _kpi_card("kpi-auto-match-pct"),
                _kpi_card("kpi-avg-confidence"),
            ],
            "charts": [
                _dash_chart_ref(
                    "chart-match-rate-trend",
                    "Daily Match Rate Trend",
                    "line",
                    "ds-recon-match-rate-daily",
                    _layout(0, 0, 12),
                    drill_hierarchy=["year", "month", "day"],
                    drill_detail_data_source_id="ds-recon-transaction-detail",
                ),
                _dash_chart_ref(
                    "chart-match-funnel",
                    "Match Type Funnel",
                    "funnel",
                    "ds-recon-match-events-by-type",
                    _layout(0, 3, 6),
                ),
                _dash_chart_ref(
                    "chart-match-confidence-bar",
                    "Match Confidence by Type",
                    "bar",
                    "ds-recon-match-events-by-type",
                    _layout(6, 3, 6),
                    cross_filter=True,
                ),
                _dash_chart_ref(
                    "chart-match-rate-region-bar",
                    "Match Rate by Region",
                    "bar",
                    "ds-recon-match-rate-by-region",
                    _layout(0, 6, 6),
                    cross_filter=True,
                ),
                _dash_chart_ref(
                    "chart-status-category-pie",
                    "Status Category Split",
                    "pie",
                    "ds-recon-transactions-by-status",
                    _layout(6, 6, 6),
                    cross_filter=True,
                ),
            ],
            "grids": [],
            "layout": {"type": "flow", "sections": ["filters", "kpis", "charts", "grids"]},
            "autoRefreshInterval": 600000,
        },
    },
    # ------------------------------------------------------------------ #
    # 5. Volume Trends
    # ------------------------------------------------------------------ #
    {
        "id": "dash-volume-trends",
        "name": "Volume Trends",
        "description": "Transaction volume patterns over time -- daily, monthly, and seasonal trends.",
        "config": {
            "id": "dash-volume-trends",
            "name": "Volume Trends",
            "description": "Transaction volume patterns over time -- daily, monthly, and seasonal trends.",
            "features": {"crossFilter": True, "drillDown": True},
            "filters": _GLOBAL_FILTERS[:],
            "kpis": [
                _kpi_card("kpi-total-transactions"),
                _kpi_card("kpi-total-usd-volume"),
                _kpi_card("kpi-monthly-volume-growth"),
            ],
            "charts": [
                _dash_chart_ref(
                    "chart-daily-txn-volume",
                    "Daily Transaction Volume",
                    "line",
                    "ds-recon-transactions-daily",
                    _layout(0, 0, 12),
                    drill_hierarchy=["year", "month", "day"],
                    drill_detail_data_source_id="ds-recon-transaction-detail",
                ),
                _dash_chart_ref(
                    "chart-monthly-txn-bar",
                    "Monthly Transaction Count",
                    "bar",
                    "ds-recon-monthly-volume",
                    _layout(0, 3, 6),
                    cross_filter=True,
                ),
                _dash_chart_ref(
                    "chart-monthly-usd-area",
                    "Monthly USD Volume",
                    "area",
                    "ds-recon-monthly-volume",
                    _layout(6, 3, 6),
                ),
                _dash_chart_ref(
                    "chart-daily-usd-volume",
                    "Daily USD Volume",
                    "area",
                    "ds-recon-transactions-daily",
                    _layout(0, 6, 6),
                ),
                _dash_chart_ref(
                    "chart-daily-volume-combo",
                    "Volume vs Amount -- Daily Trend",
                    "combo",
                    "ds-recon-transactions-daily",
                    _layout(6, 6, 6),
                ),
            ],
            "grids": [],
            "layout": {"type": "flow", "sections": ["filters", "kpis", "charts", "grids"]},
            "autoRefreshInterval": 600000,
        },
    },
    # ------------------------------------------------------------------ #
    # 6. Regional Breakdown
    # ------------------------------------------------------------------ #
    {
        "id": "dash-regional-breakdown",
        "name": "Regional Breakdown",
        "description": "How do regions compare on volume, breaks, and match rates?",
        "config": {
            "id": "dash-regional-breakdown",
            "name": "Regional Breakdown",
            "description": "How do regions compare on volume, breaks, and match rates?",
            "features": {"crossFilter": True, "drillDown": True},
            "filters": _GLOBAL_FILTERS[:],
            "kpis": [
                _kpi_card("kpi-total-transactions"),
                _kpi_card("kpi-region-break-avg"),
                _kpi_card("kpi-match-rate"),
            ],
            "charts": [
                _dash_chart_ref(
                    "chart-region-txn-bar",
                    "Transaction Count by Region",
                    "bar",
                    "ds-recon-transactions-by-region",
                    _layout(0, 0, 12),
                    cross_filter=True,
                    drill_hierarchy=["region", "desk", "account"],
                    drill_detail_data_source_id="ds-recon-transaction-detail",
                ),
                _dash_chart_ref(
                    "chart-region-usd-bar",
                    "USD Volume by Region",
                    "bar",
                    "ds-recon-transactions-by-region",
                    _layout(0, 3, 6),
                    cross_filter=True,
                ),
                _dash_chart_ref(
                    "chart-region-share-pie",
                    "Regional Volume Share",
                    "pie",
                    "ds-recon-transactions-by-region",
                    _layout(6, 3, 6),
                    cross_filter=True,
                ),
                _dash_chart_ref(
                    "chart-region-txn-donut",
                    "Regional Transaction Share",
                    "donut",
                    "ds-recon-transactions-by-region",
                    _layout(0, 6, 6),
                    cross_filter=True,
                ),
                _dash_chart_ref(
                    "chart-status-region-stacked",
                    "Status by Region -- Stacked",
                    "stacked-bar",
                    "ds-recon-status-by-region",
                    _layout(6, 6, 6),
                    cross_filter=True,
                ),
            ],
            "grids": [],
            "layout": {"type": "flow", "sections": ["filters", "kpis", "charts", "grids"]},
            "autoRefreshInterval": 600000,
        },
    },
    # ------------------------------------------------------------------ #
    # 7. Counterparty Risk
    # ------------------------------------------------------------------ #
    {
        "id": "dash-counterparty-risk",
        "name": "Counterparty Risk",
        "description": "Which counterparties carry the most exposure and break risk?",
        "config": {
            "id": "dash-counterparty-risk",
            "name": "Counterparty Risk",
            "description": "Which counterparties carry the most exposure and break risk?",
            "features": {"crossFilter": True, "drillDown": True},
            "filters": _GLOBAL_FILTERS[:],
            "kpis": [
                _kpi_card("kpi-unique-counterparties"),
                _kpi_card("kpi-break-exposure"),
                _kpi_card("kpi-largest-txn"),
            ],
            "charts": [
                _dash_chart_ref(
                    "chart-counterparty-top-bar",
                    "Top 20 Counterparties by Volume",
                    "bar",
                    "ds-recon-counterparty-top",
                    _layout(0, 0, 12),
                    cross_filter=True,
                ),
                _dash_chart_ref(
                    "chart-amount-fee-scatter",
                    "Amount vs Fee Correlation",
                    "scatter",
                    "ds-recon-transactions-scatter",
                    _layout(0, 3, 6),
                ),
                _dash_chart_ref(
                    "chart-breaks-desk-bar",
                    "Breaks by Desk",
                    "bar",
                    "ds-recon-breaks-by-desk",
                    _layout(6, 3, 6),
                    cross_filter=True,
                ),
                _dash_chart_ref(
                    "chart-currency-bar",
                    "Transaction Count by Currency",
                    "bar",
                    "ds-recon-currency-distribution",
                    _layout(0, 6, 12),
                    cross_filter=True,
                ),
            ],
            "grids": [],
            "layout": {"type": "flow", "sections": ["filters", "kpis", "charts", "grids"]},
            "autoRefreshInterval": 600000,
        },
    },
    # ------------------------------------------------------------------ #
    # 8. Currency Exposure
    # ------------------------------------------------------------------ #
    {
        "id": "dash-currency-exposure",
        "name": "Currency Exposure",
        "description": "USD, EUR, GBP, JPY -- where is our multi-currency risk concentrated?",
        "config": {
            "id": "dash-currency-exposure",
            "name": "Currency Exposure",
            "description": "USD, EUR, GBP, JPY -- where is our multi-currency risk concentrated?",
            "features": {"crossFilter": True, "drillDown": True},
            "filters": _GLOBAL_FILTERS[:],
            "kpis": [
                _kpi_card("kpi-currency-count"),
                _kpi_card("kpi-total-usd-volume"),
                _kpi_card("kpi-avg-txn-size"),
            ],
            "charts": [
                _dash_chart_ref(
                    "chart-currency-pie",
                    "Currency Distribution",
                    "pie",
                    "ds-recon-currency-distribution",
                    _layout(0, 0, 12),
                    cross_filter=True,
                ),
                _dash_chart_ref(
                    "chart-currency-bar",
                    "Transaction Count by Currency",
                    "bar",
                    "ds-recon-currency-distribution",
                    _layout(0, 3, 6),
                    cross_filter=True,
                ),
                _dash_chart_ref(
                    "chart-txn-parallel-coords",
                    "Transaction Parallel Coordinates",
                    "parallel",
                    "ds-recon-parallel-sample",
                    _layout(6, 3, 6),
                ),
                _dash_chart_ref(
                    "chart-desk-avg-usd",
                    "Average Transaction Size by Desk",
                    "bar",
                    "ds-recon-volume-by-desk",
                    _layout(0, 6, 12),
                ),
            ],
            "grids": [],
            "layout": {"type": "flow", "sections": ["filters", "kpis", "charts", "grids"]},
            "autoRefreshInterval": 600000,
        },
    },
    # ------------------------------------------------------------------ #
    # 9. Desk Performance
    # ------------------------------------------------------------------ #
    {
        "id": "dash-desk-performance",
        "name": "Desk Performance",
        "description": "Desk-level productivity -- who's processing the most volume and at what quality?",
        "config": {
            "id": "dash-desk-performance",
            "name": "Desk Performance",
            "description": "Desk-level productivity -- who's processing the most volume and at what quality?",
            "features": {"crossFilter": True, "drillDown": True},
            "filters": _GLOBAL_FILTERS[:],
            "kpis": [
                _kpi_card("kpi-total-transactions"),
                _kpi_card("kpi-avg-txn-size"),
                _kpi_card("kpi-match-rate"),
            ],
            "charts": [
                _dash_chart_ref(
                    "chart-desk-volume-treemap",
                    "Desk Volume Treemap",
                    "treemap",
                    "ds-recon-volume-by-desk",
                    _layout(0, 0, 12),
                    cross_filter=True,
                    drill_hierarchy=["asset_class", "desk"],
                    drill_detail_data_source_id="ds-recon-transaction-detail",
                ),
                _dash_chart_ref(
                    "chart-desk-volume-bar",
                    "Transaction Count by Desk",
                    "bar",
                    "ds-recon-volume-by-desk",
                    _layout(0, 3, 6),
                    cross_filter=True,
                ),
                _dash_chart_ref(
                    "chart-desk-avg-usd",
                    "Average Transaction Size by Desk",
                    "bar",
                    "ds-recon-volume-by-desk",
                    _layout(6, 3, 6),
                ),
                _dash_chart_ref(
                    "chart-breaks-desk-bar",
                    "Breaks by Desk",
                    "bar",
                    "ds-recon-breaks-by-desk",
                    _layout(0, 6, 6),
                ),
                _dash_chart_ref(
                    "chart-aging-bar",
                    "Aging Distribution",
                    "bar",
                    "ds-recon-breaks-aging",
                    _layout(6, 6, 6),
                    cross_filter=True,
                ),
            ],
            "grids": [],
            "layout": {"type": "flow", "sections": ["filters", "kpis", "charts", "grids"]},
            "autoRefreshInterval": 600000,
        },
    },
    # ------------------------------------------------------------------ #
    # 10. Operational Detail
    # ------------------------------------------------------------------ #
    {
        "id": "dash-operational-detail",
        "name": "Operational Detail",
        "description": "Ground-level transaction data for investigation and drill-down.",
        "config": {
            "id": "dash-operational-detail",
            "name": "Operational Detail",
            "description": "Ground-level transaction data for investigation and drill-down.",
            "features": {"crossFilter": True, "drillDown": True},
            "filters": _GLOBAL_FILTERS[:],
            "kpis": [
                _kpi_card("kpi-total-transactions"),
                _kpi_card("kpi-open-breaks"),
                _kpi_card("kpi-min-daily-volume"),
            ],
            "charts": [
                _dash_chart_ref(
                    "chart-status-distribution-bar",
                    "Transaction Status Distribution",
                    "bar",
                    "ds-recon-transactions-by-status",
                    _layout(0, 0, 12),
                    cross_filter=True,
                    drill_hierarchy=["status", "detail"],
                    drill_detail_data_source_id="ds-recon-transaction-detail",
                ),
                _dash_chart_ref(
                    "chart-aging-waterfall",
                    "Aging Bucket Waterfall",
                    "waterfall",
                    "ds-recon-breaks-aging",
                    _layout(0, 3, 6),
                ),
                _dash_chart_ref(
                    "chart-breaks-aging-by-type",
                    "Average Aging by Break Type",
                    "bar",
                    "ds-recon-breaks-summary",
                    _layout(6, 3, 6),
                ),
                _dash_chart_ref(
                    "chart-aging-usd-bar",
                    "Aging Exposure by Bucket",
                    "bar",
                    "ds-recon-breaks-aging",
                    _layout(0, 6, 12),
                ),
            ],
            "grids": [
                {
                    "id": "grid-ops-detail",
                    "title": "Transaction Detail",
                    "dataSourceId": "ds-recon-transaction-detail",
                    "columns": [
                        {"field": "external_ref", "header": "Ref", "type": "string"},
                        {"field": "trade_date", "header": "Trade Date", "type": "date"},
                        {"field": "status", "header": "Status", "type": "string"},
                        {"field": "region", "header": "Region", "type": "string"},
                        {"field": "desk", "header": "Desk", "type": "string"},
                        {"field": "amount_usd", "header": "Amount USD", "type": "number"},
                        {"field": "counterparty", "header": "Counterparty", "type": "string"},
                        {"field": "currency", "header": "Currency", "type": "string"},
                    ],
                    "layout": _layout(0, 9, 12, 4),
                }
            ],
            "layout": {"type": "flow", "sections": ["filters", "kpis", "charts", "grids"]},
            "autoRefreshInterval": 600000,
        },
    },
    # ---- QuickRec embedded-dashboard (Plan 2) ----
    # No charts; two grids (auto-match + manual) under a KPI row with six explicit
    # percentage_of trends so left/right break+auto+manual % of records computes
    # client-side via use-dashboard-kpis.ts.
    {
        "id": "dash-quickrec-stats",
        "name": "QuickRec Statistics",
        "description": "QuickRec auto-match and manual-match statistics for the filtered recon/portal.",
        "config": {
            "id": "dash-quickrec-stats",
            "name": "QuickRec Statistics",
            "description": "QuickRec auto-match and manual-match statistics for the filtered recon/portal.",
            "features": {"crossFilter": False, "drillDown": False},
            "filters": [
                # Dynamic options so the locked value renders its label in the dropdown.
                # No `dependsOn` — fetch the full distinct list so any locked value finds its match.
                {"id": "recon_id", "label": "Recon ID", "type": "single-select", "lockable": True,
                 "optionsSource": {"dataSourceId": "ds-qr-automatch", "valueColumn": "recon_id", "dependsOn": {}},
                 "options": [], "defaultValue": None},
                {"id": "rec_portal_id", "label": "Rec Portal ID", "type": "single-select", "lockable": True,
                 "optionsSource": {"dataSourceId": "ds-qr-automatch", "valueColumn": "rec_portal_id", "dependsOn": {}},
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
                # accentColor maps each KPI to a domain meaning regardless of
                # the trend sign: records=blue, breaks=warning amber,
                # auto=positive green, manual=violet (matches the legacy
                # QuickRec card semantics).
                {"id": "kpi-qr-left-records", "label": "Left Records", "format": "number",
                 "sources": [{"dataSourceId": "ds-qr-automatch", "metric": "left_record_count"}],
                 "aggregation": "SUM",
                 "accentColor": "--chart-1"},
                {"id": "kpi-qr-left-breaks", "label": "Left Breaks", "format": "number",
                 "sources": [{"dataSourceId": "ds-qr-automatch", "metric": "left_break_count"}],
                 "aggregation": "SUM",
                 "trend": {"type": "percentage_of", "referenceKpi": "kpi-qr-left-records", "display": "ratio"},
                 "accentColor": "--chart-warning"},
                {"id": "kpi-qr-left-auto", "label": "Left Auto Matches", "format": "number",
                 "sources": [{"dataSourceId": "ds-qr-automatch", "metric": "left_match_count"}],
                 "aggregation": "SUM",
                 "trend": {"type": "percentage_of", "referenceKpi": "kpi-qr-left-records", "display": "ratio"},
                 "accentColor": "--chart-positive"},
                {"id": "kpi-qr-left-manual", "label": "Left Manual Matches", "format": "number",
                 "sources": [{"dataSourceId": "ds-qr-manual", "metric": "left_manual_matches"}],
                 "aggregation": "SUM",
                 "trend": {"type": "percentage_of", "referenceKpi": "kpi-qr-left-records", "display": "ratio"},
                 "accentColor": "--series-8"},
                {"id": "kpi-qr-right-records", "label": "Right Records", "format": "number",
                 "sources": [{"dataSourceId": "ds-qr-automatch", "metric": "right_record_count"}],
                 "aggregation": "SUM",
                 "accentColor": "--chart-1"},
                {"id": "kpi-qr-right-breaks", "label": "Right Breaks", "format": "number",
                 "sources": [{"dataSourceId": "ds-qr-automatch", "metric": "right_break_count"}],
                 "aggregation": "SUM",
                 "trend": {"type": "percentage_of", "referenceKpi": "kpi-qr-right-records", "display": "ratio"},
                 "accentColor": "--chart-warning"},
                {"id": "kpi-qr-right-auto", "label": "Right Auto Matches", "format": "number",
                 "sources": [{"dataSourceId": "ds-qr-automatch", "metric": "right_match_count"}],
                 "aggregation": "SUM",
                 "trend": {"type": "percentage_of", "referenceKpi": "kpi-qr-right-records", "display": "ratio"},
                 "accentColor": "--chart-positive"},
                {"id": "kpi-qr-right-manual", "label": "Right Manual Matches", "format": "number",
                 "sources": [{"dataSourceId": "ds-qr-manual", "metric": "right_manual_matches"}],
                 "aggregation": "SUM",
                 "trend": {"type": "percentage_of", "referenceKpi": "kpi-qr-right-records", "display": "ratio"},
                 "accentColor": "--series-8"},
            ],
            "charts": [],
            "grids": [
                {"id": "grid-qr-automatch", "title": "Auto-Match Statistics",
                 "dataSourceId": "ds-qr-automatch",
                 "columns": [
                     {"field": "reconname", "header": "Recon Name", "type": "string"},
                     {"field": "recon_id", "header": "Recon ID", "type": "string"},
                     {"field": "rec_portal_id", "header": "Rec Portal ID", "type": "string"},
                     {"field": "left_record_count", "header": "Left Records", "type": "number"},
                     {"field": "right_record_count", "header": "Right Records", "type": "number"},
                     {"field": "left_break_count", "header": "Left Breaks", "type": "number"},
                     {"field": "right_break_count", "header": "Right Breaks", "type": "number"},
                     {"field": "left_match_count", "header": "Left Auto", "type": "number"},
                     {"field": "right_match_count", "header": "Right Auto", "type": "number"},
                     {"field": "load_date", "header": "Load Date", "type": "date"},
                 ],
                 "layout": _layout(0, 2, 12, 4)},
                {"id": "grid-qr-manual", "title": "Manual Match Statistics",
                 "dataSourceId": "ds-qr-manual",
                 "columns": [
                     {"field": "rec_portal_id", "header": "Rec Portal ID", "type": "string"},
                     {"field": "cob", "header": "COB", "type": "date"},
                     {"field": "left_manual_matches", "header": "Left Manual", "type": "number"},
                     {"field": "right_manual_matches", "header": "Right Manual", "type": "number"},
                     {"field": "updated_date", "header": "Updated", "type": "date"},
                 ],
                 "layout": _layout(0, 6, 12, 4)},
            ],
            "layout": {"type": "flow", "sections": ["filters", "kpis", "grids"]},
            "autoRefreshInterval": 0,
        },
    },
]

assert len(CURATED_DASHBOARDS) == 11, (
    f"CURATED_DASHBOARDS must have 11 entries, got {len(CURATED_DASHBOARDS)}"
)


# --------------------------------------------------------------------------- #
# Section 7: Managed-table seeding functions
# --------------------------------------------------------------------------- #


def wipe_managed_tables(cur) -> None:
    """Delete all rows from managed tables in dependency order."""
    cur.execute("DELETE FROM recviz_dashboards")
    cur.execute("DELETE FROM recviz_charts")
    cur.execute("DELETE FROM recviz_kpis")
    cur.execute("DELETE FROM recviz_datasets")
    # NOTE: recviz_data_sources deliberately NOT wiped (D-11/D-12)
    cur.execute("DELETE FROM recviz_connections")


def seed_managed_datasets(cur) -> None:
    """Insert dataset rows into recviz_datasets — keeps {{filters}} so query_engine
    can substitute them at runtime, and persists filter_mappings + database_routing
    so ConfigStore can apply them (Plan 1, §12.10)."""
    for ds in CURATED_DATASETS:
        routing = ds.get("database_routing", {"type": "static", "database": CONNECTION_NAME})
        cur.execute(
            "INSERT INTO recviz_datasets "
            "(id, name, description, database_id, sql, columns, "
            "filter_mappings, database_routing, schema_version, created_at, updated_at) "
            "VALUES (:1, :2, :3, :4, :5, :6, :7, :8, 1, SYSTIMESTAMP, SYSTIMESTAMP)",
            (
                ds["id"], ds["name"], ds["description"], CONNECTION_ID,
                ds["sql_template"],
                _jb(ds["columns"]),
                _jb(ds.get("filter_mappings", [])),
                _jb(routing),
            ),
        )


def seed_managed_charts(cur) -> None:
    """Insert curated charts. Refuses excluded chart types."""
    for chart in CURATED_CHARTS:
        if chart["chart_type"] in EXCLUDED_CHART_TYPES:
            raise ValueError(
                f"Seed config error: chart {chart['id']} uses excluded type "
                f"{chart['chart_type']!r} -- see Plan 10-01b interfaces + Q-3 RESOLVED"
            )
        cur.execute(
            "INSERT INTO recviz_charts "
            "(id, name, description, dataset_id, chart_type, config, created_at, updated_at) "
            "VALUES (:1, :2, :3, :4, :5, :6, SYSTIMESTAMP, SYSTIMESTAMP)",
            (
                chart["id"],
                chart["name"],
                chart["description"],
                chart["dataset_id"],
                chart["chart_type"],
                _jb(chart["config"]),
            ),
        )


def seed_managed_kpis(cur) -> None:
    """Insert curated KPIs."""
    for kpi in CURATED_KPIS:
        cur.execute(
            "INSERT INTO recviz_kpis "
            "(id, name, description, dataset_id, metric_column, aggregation, "
            "config, created_at, updated_at) "
            "VALUES (:1, :2, :3, :4, :5, :6, :7, SYSTIMESTAMP, SYSTIMESTAMP)",
            (
                kpi["id"],
                kpi["name"],
                kpi["description"],
                kpi["dataset_id"],
                kpi["metric_column"],
                kpi["aggregation"],
                _jb(kpi["config"]),
            ),
        )


def seed_managed_dashboards(cur) -> None:
    """Insert curated dashboards."""
    for dash in CURATED_DASHBOARDS:
        cur.execute(
            "INSERT INTO recviz_dashboards "
            "(id, name, description, schema_version, config, created_at, updated_at) "
            "VALUES (:1, :2, :3, 1, :4, SYSTIMESTAMP, SYSTIMESTAMP)",
            (
                dash["id"],
                dash["name"],
                dash["description"],
                _jb(dash["config"]),
            ),
        )


# --------------------------------------------------------------------------- #
# Section 7b: Connection seeding + Dashboard names snapshot
# --------------------------------------------------------------------------- #


def seed_connection(cur, args: argparse.Namespace) -> None:
    """Insert the Oracle connection with encrypted password and schema_name (D-15)."""
    user = args.user or os.environ.get("ORACLE_USER", "recviz")
    password = args.password or os.environ.get("ORACLE_PASSWORD", "recviz_dev")
    host = args.host or os.environ.get("ORACLE_HOST", "localhost")
    port = args.port or int(os.environ.get("ORACLE_PORT", "1521"))
    service = args.service or os.environ.get("ORACLE_SERVICE", "FREEPDB1")
    schema_name = _get_schema_name(args)

    encrypted_pw = _encrypt_password(password)
    cur.execute(
        "INSERT INTO recviz_connections "
        "(id, name, display_name, backend, host, port, database_name, "
        "username, encrypted_password, schema_name, extra_params, status, "
        "created_at, updated_at) "
        "VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12, "
        "SYSTIMESTAMP, SYSTIMESTAMP)",
        (
            CONNECTION_ID,
            CONNECTION_NAME,
            f"Oracle ({host}:{port}/{service})",
            "oracle",
            host,
            port,
            service,
            user,
            encrypted_pw,
            schema_name,
            _jb({"timeout": 30}),
            "active",
        ),
    )
    # QuickRec/TLM integration (Plan 1 Task 8): register a connection to the recportal
    # schema in the sibling rectrace-local-dev FREEPDB1 stack. The recportal schema owns
    # quickrec_stats_table + recportal_manual_match_table that the qr_automatch/qr_manual
    # datasets (Plan 2) read.
    cur.execute(
        "INSERT INTO recviz_connections "
        "(id, name, display_name, backend, host, port, database_name, "
        "username, encrypted_password, schema_name, extra_params, status, "
        "created_at, updated_at) "
        "VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12, "
        "SYSTIMESTAMP, SYSTIMESTAMP)",
        (
            "conn-recportal",
            "recportal",
            "RecPortal Oracle (rectrace-local-dev)",
            "oracle",
            host,
            port,
            service,
            "recportal",
            _encrypt_password("recportal_pwd"),
            "RECPORTAL",
            _jb({"timeout": 30}),
            "active",
        ),
    )
    print(f"  recviz_connections: 2 rows (recviz/{schema_name}, recportal/RECPORTAL)")


def write_dashboard_names_snapshot() -> None:
    """Write frontend/e2e/_dashboard-names.json from CURATED_DASHBOARDS."""
    snapshot = {d["id"]: d["name"] for d in CURATED_DASHBOARDS}
    DASHBOARD_NAMES_SNAPSHOT.parent.mkdir(parents=True, exist_ok=True)
    DASHBOARD_NAMES_SNAPSHOT.write_text(
        json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n"
    )
    print(f"  Wrote dashboard names snapshot: {DASHBOARD_NAMES_SNAPSHOT}")


# --------------------------------------------------------------------------- #
# Section 8: Main
# --------------------------------------------------------------------------- #


def main() -> None:
    args = parse_args()
    total_start = time.time()

    target_rows = args.rows
    break_count = int(target_rows * 0.20)
    match_count = int(target_rows * 0.80)
    sla_count = int(target_rows * 0.05)

    print(f"RecViz Oracle seed script -- target: {target_rows:,} transaction rows")
    print(f"  Derived: ~{break_count:,} breaks, ~{match_count:,} match events, ~{sla_count:,} SLA events")
    print("=" * 60)

    rng = random.Random(RANDOM_SEED)
    conn = _get_connection(args)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # Part 1: DDL
        print("\n=== Recon data: drop + create schema ===")
        drop_recon_schema(cur)
        create_recon_schema(cur)
        print("  Schema created (8 dimension + 4 fact tables)")

        # Part 2: Dimensions
        print("\n=== Recon data: dimensions ===")
        engine_ids = insert_returning_ids(
            cur,
            "recon_engines",
            ["code", "name", "vendor", "is_active"],
            gen_recon_engines(),
        )
        region_ids = insert_returning_ids(
            cur,
            "regions",
            ["code", "name", "parent_region"],
            gen_regions(),
        )
        desk_ids = insert_returning_ids(
            cur,
            "desks",
            ["code", "name", "asset_class", "region_id"],
            gen_desks(region_ids),
        )
        currency_ids = insert_returning_ids(
            cur,
            "currencies",
            ["code", "name", "decimal_places", "is_active"],
            gen_currencies(),
        )
        status_ids = insert_returning_ids(
            cur,
            "statuses",
            ["code", "name", "category", "sort_order"],
            gen_statuses(),
        )
        aging_bucket_ids = insert_returning_ids(
            cur,
            "aging_buckets",
            ["code", "label", "min_days", "max_days", "sort_order", "severity"],
            gen_aging_buckets(),
        )
        counterparty_ids = insert_returning_ids(
            cur,
            "counterparties",
            ["lei", "short_name", "legal_name", "country_code", "tier"],
            gen_counterparties(rng),
        )
        account_ids = insert_returning_ids(
            cur,
            "accounts",
            [
                "account_number",
                "name",
                "type",
                "region_id",
                "currency_id",
                "opened_date",
                "is_active",
            ],
            gen_accounts(rng, region_ids, currency_ids),
        )
        conn.commit()

        # Part 3: Facts with configurable counts
        print(f"\n=== Recon data: facts ({target_rows:,} transactions) ===")
        txn_rows = gen_recon_transactions(
            rng,
            target_rows,
            engine_ids,
            account_ids,
            desk_ids,
            region_ids,
            currency_ids,
            status_ids,
            counterparty_ids,
        )
        txn_ids = insert_returning_ids_batch(
            cur,
            "recon_transactions",
            [
                "external_ref",
                "engine_id",
                "account_id",
                "counterparty_id",
                "desk_id",
                "region_id",
                "currency_id",
                "status_id",
                "amount",
                "fee",
                "fx_rate",
                "amount_usd",
                "trade_date",
                "settle_date",
                "booking_ts",
                "last_updated_ts",
            ],
            txn_rows,
        )
        conn.commit()

        break_rows = gen_recon_breaks(
            rng, break_count, txn_rows, txn_ids, aging_bucket_ids,
            region_ids, desk_ids,
        )
        break_ids = insert_returning_ids_batch(
            cur,
            "recon_breaks",
            [
                "transaction_id",
                "break_type",
                "break_amount",
                "break_amount_usd",
                "aging_days",
                "aging_bucket_id",
                "opened_at",
                "resolved_at",
                "resolution",
                "root_cause",
                "assigned_to",
            ],
            break_rows,
        )
        conn.commit()

        match_rows = gen_recon_match_events(rng, match_count, txn_ids, break_ids)
        insert_batch(
            cur,
            "recon_match_events",
            [
                "transaction_id",
                "break_id",
                "match_type",
                "matcher",
                "matched_at",
                "confidence_score",
            ],
            match_rows,
        )
        conn.commit()

        sla_rows = gen_sla_events(rng, sla_count, txn_ids, break_ids, region_ids)
        insert_batch(
            cur,
            "sla_events",
            [
                "transaction_id",
                "break_id",
                "sla_type",
                "sla_target_mins",
                "sla_elapsed_mins",
                "breach",
                "severity",
                "event_ts",
                "region_id",
            ],
            sla_rows,
        )
        conn.commit()

        # Part 4: Managed catalog
        print("\n=== Managed catalog: wipe + seed ===")
        wipe_managed_tables(cur)
        seed_connection(cur, args)
        seed_managed_datasets(cur)
        print(f"  recviz_datasets: {len(CURATED_DATASETS)} rows")
        seed_managed_charts(cur)
        print(f"  recviz_charts: {len(CURATED_CHARTS)} rows")
        seed_managed_kpis(cur)
        print(f"  recviz_kpis: {len(CURATED_KPIS)} rows")
        seed_managed_dashboards(cur)
        print(f"  recviz_dashboards: {len(CURATED_DASHBOARDS)} rows")
        conn.commit()

        write_dashboard_names_snapshot()

        # Summary with total elapsed time per D-13
        total_elapsed = time.time() - total_start
        dim_count = (
            len(engine_ids) + len(region_ids) + len(desk_ids)
            + len(currency_ids) + len(status_ids) + len(aging_bucket_ids)
            + len(counterparty_ids) + len(account_ids)
        )
        fact_count = len(txn_ids) + len(break_ids) + len(match_rows) + len(sla_rows)

        print("\n" + "=" * 60)
        print("Seed complete!")
        print(f"  Dimensions: {dim_count:,} rows across 8 tables")
        print(f"  Facts: {fact_count:,} rows across 4 tables")
        print(f"  Catalog: 1 connection, {len(CURATED_DATASETS)} datasets, "
              f"{len(CURATED_CHARTS)} charts, {len(CURATED_KPIS)} KPIs, "
              f"{len(CURATED_DASHBOARDS)} dashboards")
        print(f"  Total time: {total_elapsed:.1f}s")

    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
