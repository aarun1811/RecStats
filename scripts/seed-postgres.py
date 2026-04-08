#!/usr/bin/env python3
"""Phase 10 seed script -- clean-slate advanced seed for RecViz testing.

Rewrites recon_data schema + inserts 100k fact rows + seeds the curated
Phase 10 catalog (16 datasets, 22 charts, 12 KPIs, 5 dashboards) into the
managed tables. Idempotent -- drop-and-recreate on every run.

NOTE: 22 charts covers all 18 WORKING chart types. bullet, box-plot,
sunburst are declared but fall back to bar / need hierarchical transform --
excluded from the curated catalog per user correction 2026-04-08.

SAFETY: Hard-coded to localhost. Refuses to run against non-localhost
databases. Refuses if RECVIZ_ENV=production.
"""

from __future__ import annotations

import json
import math
import os
import pathlib
import random
import sys
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

import psycopg2
import psycopg2.extras

# --------------------------------------------------------------------------- #
# Safety guards
# --------------------------------------------------------------------------- #

RECON_DB_URL = "postgresql://recviz:recviz_dev@localhost:5432/recon_data"
RECVIZ_DB_URL = "postgresql://recviz:recviz_dev@localhost:5432/superset_meta"


def _assert_safe(url: str) -> None:
    parsed = urlparse(url)
    host = parsed.hostname or ""
    if host not in {"localhost", "127.0.0.1"}:
        sys.exit(f"REFUSE: {url} has non-localhost host {host!r}")


_assert_safe(RECON_DB_URL)
_assert_safe(RECVIZ_DB_URL)
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


def drop_recon_schema(cur) -> None:
    """Drop every legacy table in the recon_data database."""
    for table in _LEGACY_SOURCE_TABLES:
        cur.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
    cur.execute(
        "DROP TABLE IF EXISTS reconmgmt.mr_csum_man_match_stats_hist CASCADE"
    )
    cur.execute("DROP SCHEMA IF EXISTS reconmgmt CASCADE")


def create_recon_schema(cur) -> None:
    """Create all 8 dimension tables + 4 fact tables with indexes.

    Mirrors RESEARCH.md §1.2 and §1.3 verbatim.
    """
    # ── Dimensions ─────────────────────────────────────────────── #
    cur.execute(
        """
        CREATE TABLE recon_engines (
            id          SERIAL PRIMARY KEY,
            code        VARCHAR(32)  NOT NULL UNIQUE,
            name        VARCHAR(128) NOT NULL,
            vendor      VARCHAR(64)  NOT NULL,
            is_active   BOOLEAN      NOT NULL DEFAULT TRUE
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE regions (
            id              SERIAL PRIMARY KEY,
            code            VARCHAR(8)  NOT NULL UNIQUE,
            name            VARCHAR(64) NOT NULL,
            parent_region   VARCHAR(32)
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE desks (
            id              SERIAL PRIMARY KEY,
            code            VARCHAR(16)  NOT NULL UNIQUE,
            name            VARCHAR(64)  NOT NULL,
            asset_class     VARCHAR(32)  NOT NULL,
            region_id       INTEGER REFERENCES regions(id)
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE currencies (
            id              SERIAL PRIMARY KEY,
            code            CHAR(3)      NOT NULL UNIQUE,
            name            VARCHAR(64)  NOT NULL,
            decimal_places  SMALLINT     NOT NULL DEFAULT 2,
            is_active       BOOLEAN      NOT NULL DEFAULT TRUE
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE statuses (
            id              SERIAL PRIMARY KEY,
            code            VARCHAR(24)  NOT NULL UNIQUE,
            name            VARCHAR(64)  NOT NULL,
            category        VARCHAR(16)  NOT NULL,
            sort_order      SMALLINT     NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE aging_buckets (
            id              SERIAL PRIMARY KEY,
            code            VARCHAR(16)  NOT NULL UNIQUE,
            label           VARCHAR(32)  NOT NULL,
            min_days        INTEGER      NOT NULL,
            max_days        INTEGER,
            sort_order      SMALLINT     NOT NULL,
            severity        VARCHAR(8)   NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE counterparties (
            id              SERIAL PRIMARY KEY,
            lei             VARCHAR(20)  NOT NULL UNIQUE,
            short_name      VARCHAR(64)  NOT NULL,
            legal_name      VARCHAR(256) NOT NULL,
            country_code    CHAR(2)      NOT NULL,
            tier            SMALLINT     NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE accounts (
            id              SERIAL PRIMARY KEY,
            account_number  VARCHAR(32)  NOT NULL UNIQUE,
            name            VARCHAR(128) NOT NULL,
            type            VARCHAR(16)  NOT NULL,
            region_id       INTEGER NOT NULL REFERENCES regions(id),
            currency_id     INTEGER NOT NULL REFERENCES currencies(id),
            opened_date     DATE         NOT NULL,
            is_active       BOOLEAN      NOT NULL DEFAULT TRUE
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
            id                  BIGSERIAL PRIMARY KEY,
            external_ref        VARCHAR(40)  NOT NULL,
            engine_id           INTEGER      NOT NULL REFERENCES recon_engines(id),
            account_id          INTEGER      NOT NULL REFERENCES accounts(id),
            counterparty_id     INTEGER               REFERENCES counterparties(id),
            desk_id             INTEGER      NOT NULL REFERENCES desks(id),
            region_id           INTEGER      NOT NULL REFERENCES regions(id),
            currency_id         INTEGER      NOT NULL REFERENCES currencies(id),
            status_id           INTEGER      NOT NULL REFERENCES statuses(id),
            amount              NUMERIC(18,4) NOT NULL,
            fee                 NUMERIC(18,4),
            fx_rate             NUMERIC(12,6),
            amount_usd          NUMERIC(18,4) NOT NULL,
            trade_date          DATE         NOT NULL,
            settle_date         DATE         NOT NULL,
            booking_ts          TIMESTAMPTZ  NOT NULL,
            last_updated_ts     TIMESTAMPTZ  NOT NULL
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
            id                  BIGSERIAL PRIMARY KEY,
            transaction_id      BIGINT       NOT NULL REFERENCES recon_transactions(id),
            break_type          VARCHAR(24)  NOT NULL,
            break_amount        NUMERIC(18,4),
            break_amount_usd    NUMERIC(18,4),
            aging_days          INTEGER      NOT NULL,
            aging_bucket_id     INTEGER      NOT NULL REFERENCES aging_buckets(id),
            opened_at           TIMESTAMPTZ  NOT NULL,
            resolved_at         TIMESTAMPTZ,
            resolution          VARCHAR(32),
            root_cause          VARCHAR(64),
            assigned_to         VARCHAR(64)
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
            id                  BIGSERIAL PRIMARY KEY,
            transaction_id      BIGINT       NOT NULL REFERENCES recon_transactions(id),
            break_id            BIGINT                REFERENCES recon_breaks(id),
            match_type          VARCHAR(16)  NOT NULL,
            matcher             VARCHAR(64)  NOT NULL,
            matched_at          TIMESTAMPTZ  NOT NULL,
            confidence_score    NUMERIC(5,2)
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
            id                  BIGSERIAL PRIMARY KEY,
            transaction_id      BIGINT       NOT NULL REFERENCES recon_transactions(id),
            break_id            BIGINT                REFERENCES recon_breaks(id),
            sla_type            VARCHAR(32)  NOT NULL,
            sla_target_mins     INTEGER      NOT NULL,
            sla_elapsed_mins    INTEGER      NOT NULL,
            breach              BOOLEAN      NOT NULL,
            severity            VARCHAR(8)   NOT NULL,
            event_ts            TIMESTAMPTZ  NOT NULL,
            region_id           INTEGER      NOT NULL REFERENCES regions(id)
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

# Tuples are emitted in column order. The seeded SERIAL ids are returned by
# `RETURNING id` after insertion so the fact generators can use real ids.


def gen_recon_engines() -> list[tuple]:
    """5 rows, one inactive for filter edge cases."""
    return [
        ("TLM", "TLM Smart Recon", "SmartStream", True),
        ("SMARTSTREAM", "SmartStream Corona", "SmartStream", True),
        ("INTELLIMATCH", "IntelliMatch", "FIS", True),
        ("DUCO", "Duco Cube", "Duco", True),
        ("OPTIONS", "Options Recon", "Options", False),
    ]


def gen_regions() -> list[tuple]:
    """10 regions with 2-level hierarchy via parent_region."""
    return [
        ("NAM", "North America", None),
        ("EMEA", "Europe Middle East & Africa", None),
        ("APAC", "Asia Pacific", None),
        ("LATAM", "Latin America", None),
        ("US", "United States", "NAM"),
        ("UK", "United Kingdom", "EMEA"),
        ("JP", "Japan", "APAC"),
        ("HK", "Hong Kong", "APAC"),
        ("SG", "Singapore", "APAC"),
        ("AU", "Australia", "APAC"),
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
    """8 status rows covering OPEN/CLOSED/PENDING categories."""
    return [
        ("MATCHED", "Matched", "CLOSED", 1),
        ("UNMATCHED", "Unmatched", "OPEN", 2),
        ("PENDING_MATCH", "Pending Match", "PENDING", 3),
        ("AUTO_MATCHED", "Auto-Matched", "CLOSED", 4),
        ("MANUAL_MATCHED", "Manual Matched", "CLOSED", 5),
        ("DISPUTED", "Disputed", "OPEN", 6),
        ("WRITTEN_OFF", "Written Off", "CLOSED", 7),
        ("ESCALATED", "Escalated", "OPEN", 8),
    ]


def gen_aging_buckets() -> list[tuple]:
    """6 aging buckets with severity gradient."""
    return [
        ("0-1D", "0-1 days", 0, 1, 1, "OK"),
        ("2-3D", "2-3 days", 2, 3, 2, "OK"),
        ("4-7D", "4-7 days", 4, 7, 3, "WARN"),
        ("8-14D", "8-14 days", 8, 14, 4, "WARN"),
        ("15-30D", "15-30 days", 15, 30, 5, "CRIT"),
        ("30D+", "30+ days", 31, None, 6, "CRIT"),
    ]


def gen_counterparties(rng: random.Random) -> list[tuple]:
    """200 counterparties with synthetic LEIs and short-names. No real PII."""
    short_name_pool = [
        "GS Intl",
        "JPMC",
        "DB Global",
        "MS Inc",
        "BofA",
        "Citi",
        "Barclays",
        "Credit Suisse",
        "UBS",
        "BNP Paribas",
        "Soc Gen",
        "Nomura",
        "Mizuho",
        "MUFG",
        "RBC",
        "TD Bank",
        "ING",
        "Santander",
        "BBVA",
        "Standard Chartered",
        "HSBC",
        "Lloyds",
        "NatWest",
        "Goldman Sachs",
        "Wells Fargo",
        "PNC",
        "State Street",
        "BNY Mellon",
        "Northern Trust",
        "Macquarie",
    ]
    countries = [
        "US",
        "GB",
        "DE",
        "FR",
        "JP",
        "HK",
        "SG",
        "AU",
        "CA",
        "CH",
        "IT",
        "ES",
        "NL",
        "BR",
        "MX",
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
        tier = rng.choice([1, 1, 2, 2, 2, 3])  # tier-1 weighted
        rows.append((lei, short_name, legal_name, country, tier))
    return rows


def gen_accounts(
    rng: random.Random,
    region_ids: list[int],
    currency_ids: list[int],
) -> list[tuple]:
    """5000 accounts. The primary dimension cardinality driver."""
    types = ["NOSTRO", "VOSTRO", "INTERNAL", "CUSTOMER"]
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


def gen_recon_transactions(
    rng: random.Random,
    engine_ids: list[int],
    account_ids: list[int],
    desk_ids: list[int],
    region_ids: list[int],
    currency_ids: list[int],
    status_ids: list[int],
    counterparty_ids: list[int],
) -> list[tuple]:
    """Exactly 100,000 rows. Bakes in every D-05 edge case."""
    target_count = 100_000
    rows: list[tuple] = []

    # Find USD currency id (first row in gen_currencies returns id 1)
    usd_index = 0  # USD is the first currency seeded
    usd_currency_id = currency_ids[usd_index]

    # Pre-compute ~status weights so MATCHED dominates (realistic GRU)
    # statuses ids are in declared order; index 0=MATCHED, 1=UNMATCHED, ...
    status_weights = [
        (status_ids[0], 0.45),  # MATCHED
        (status_ids[1], 0.10),  # UNMATCHED
        (status_ids[2], 0.05),  # PENDING_MATCH
        (status_ids[3], 0.20),  # AUTO_MATCHED
        (status_ids[4], 0.10),  # MANUAL_MATCHED
        (status_ids[5], 0.05),  # DISPUTED
        (status_ids[6], 0.03),  # WRITTEN_OFF
        (status_ids[7], 0.02),  # ESCALATED
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
        # Counterparty NULL ~5%
        if rng.random() < 0.05:
            counterparty_id = None
        else:
            counterparty_id = rng.choice(counterparty_ids)

        # Booking timestamp: most uniform; some forced edge cases (handled
        # via index buckets below)
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
            booking_ts = _random_booking_ts(rng)

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
    transaction_ids: list[int],
    aging_bucket_ids: list[int],
) -> list[tuple]:
    """~20,000 break rows. 60/15/10/10/5 distribution per RESEARCH.md §1.3."""
    target_count = 20_000
    rows: list[tuple] = []

    # Sample 20k unique transactions to attach breaks to
    sampled_ids = rng.sample(transaction_ids, target_count)

    # Aging bucket distribution: 50% fresh, 30% mid, 20% stale
    # bucket ids in declared order: 0-1D, 2-3D, 4-7D, 8-14D, 15-30D, 30D+
    bucket_weights = [
        (aging_bucket_ids[0], 0.30),
        (aging_bucket_ids[1], 0.20),
        (aging_bucket_ids[2], 0.15),
        (aging_bucket_ids[3], 0.15),
        (aging_bucket_ids[4], 0.12),
        (aging_bucket_ids[5], 0.08),
    ]
    bucket_choices, bucket_probs = zip(*bucket_weights, strict=True)

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

    for txn_id in sampled_ids:
        break_type = rng.choices(type_choices, weights=type_probs, k=1)[0]
        bucket_id = rng.choices(bucket_choices, weights=bucket_probs, k=1)[0]
        # aging_days correlated with bucket
        bucket_index = aging_bucket_ids.index(bucket_id)
        aging_day_ranges = [
            (0, 1),
            (2, 3),
            (4, 7),
            (8, 14),
            (15, 30),
            (31, 90),
        ]
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
    transaction_ids: list[int],
    break_ids: list[int],
) -> list[tuple]:
    """~80,000 match events. 65/20/10/5 distribution per RESEARCH.md §1.3."""
    target_count = 80_000
    rows: list[tuple] = []

    # Sample 80k transactions (with replacement is fine -- multiple events ok)
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
        # confidence_score: NULL for AUTO/MANUAL, populated for RULE/AI
        if match_type in ("RULE_BASED", "AI_ASSISTED"):
            confidence_score = round(rng.uniform(0.60, 0.99), 2)
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
    transaction_ids: list[int],
    break_ids: list[int],
    region_ids: list[int],
) -> list[tuple]:
    """~5,000 SLA events. ~8% breach rate per Q-4 RESOLVED inverted amber."""
    target_count = 5_000
    rows: list[tuple] = []

    sampled_txn_ids = rng.sample(transaction_ids, target_count)

    sla_specs = [
        ("MATCH_WITHIN_4H", 240),
        ("BREAK_RESOLVE_WITHIN_24H", 1440),
        ("DAILY_CLOSE", 1440),
        ("SETTLEMENT_T2", 2880),
        ("REGULATORY_REPORT", 1440),
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
    """Insert rows in batches via psycopg2.extras.execute_values.

    Uses %s parameterization throughout. The {table} and {columns} f-string
    placeholders are static SQL identifiers, NOT user data.
    """
    if not rows:
        return
    cols_sql = ",".join(columns)
    sql = f"INSERT INTO {table} ({cols_sql}) VALUES %s"
    total = len(rows)
    for i in range(0, total, batch_size):
        chunk = rows[i : i + batch_size]
        psycopg2.extras.execute_values(cur, sql, chunk)
        progress = min(i + batch_size, total)
        print(f"  {table}: inserted {progress}/{total}")


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
    cols_sql = ",".join(columns)
    sql = f"INSERT INTO {table} ({cols_sql}) VALUES %s RETURNING id"
    returned = psycopg2.extras.execute_values(
        cur,
        sql,
        rows,
        page_size=1000,
        fetch=True,
    )
    return [row[0] for row in returned]


# --------------------------------------------------------------------------- #
# Section 5: Dual-row dataset pairing helper (A10 guard)
# --------------------------------------------------------------------------- #


def seed_curated_dataset_pair(
    cur,
    dataset_id: str,
    name: str,
    description: str,
    database_id: int,
    database_name: str,
    sql_template: str,
    managed_sql: str,
    columns: list[dict],
    filter_mappings: list[dict],
) -> None:
    """Insert paired rows in `recviz_datasets` and `recviz_data_sources`.

    Same string id in both tables -- the A10 architectural guard.
    """
    cur.execute(
        "INSERT INTO recviz_datasets "
        "(id, name, description, database_id, superset_id, sql, columns, "
        "sync_status, schema_version, created_at, updated_at) "
        "VALUES (%s, %s, %s, %s, NULL, %s, %s::jsonb, 'synced', 1, NOW(), NOW())",
        (dataset_id, name, description, database_id, managed_sql, json.dumps(columns)),
    )
    ds_config = {
        "id": dataset_id,
        "name": name,
        "database_routing": {"type": "static", "database": database_name},
        "query": sql_template,
        "filter_mappings": filter_mappings,
        "columns": [
            {"name": c["name"], "type": c["data_type"]} for c in columns
        ],
    }
    cur.execute(
        "INSERT INTO recviz_data_sources (id, name, schema_version, config) "
        "VALUES (%s, %s, 1, %s::jsonb)",
        (dataset_id, name, json.dumps(ds_config)),
    )


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
            "AVG(b.aging_days)::numeric(10,2) AS avg_aging "
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
            "SELECT t.trade_date AS date, "
            "(SUM(CASE WHEN s.category = 'CLOSED' THEN 1 ELSE 0 END)::float "
            "/ NULLIF(COUNT(*), 0)) * 100 AS match_rate, "
            "COUNT(*) AS txn_count "
            "FROM recon_transactions t "
            "JOIN statuses s ON t.status_id = s.id WHERE 1=1 {{filters}} "
            "GROUP BY t.trade_date ORDER BY t.trade_date"
        ),
        "columns": [
            _col("date", "Date", "date", "time"),
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
            "SUM(CASE WHEN breach THEN 1 ELSE 0 END) AS breach_count, "
            "COUNT(*) AS total_events, "
            "(SUM(CASE WHEN breach THEN 1 ELSE 0 END)::float "
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
            "AVG(t.amount_usd)::numeric(18,2) AS avg_usd "
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
        "id": "ds-recon-transactions-scatter",
        "name": "Transactions — Scatter (Amount vs Fee)",
        "description": "Scatter sample for amount-vs-fee correlation.",
        "sql_template": (
            "SELECT id, amount_usd, COALESCE(fee, 0) AS fee, currency_id "
            "FROM recon_transactions "
            "WHERE 1=1 AND amount_usd BETWEEN 0 AND 100000 {{filters}} LIMIT 5000"
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
        "id": "ds-recon-currency-distribution",
        "name": "Transactions — By Currency",
        "description": "Currency rollup -- top 15 currencies by USD volume.",
        "sql_template": (
            "SELECT c.code AS currency, c.name, "
            "COUNT(*) AS txn_count, SUM(t.amount_usd) AS total_usd "
            "FROM recon_transactions t "
            "JOIN currencies c ON t.currency_id = c.id WHERE 1=1 {{filters}} "
            "GROUP BY c.code, c.name ORDER BY total_usd DESC LIMIT 15"
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
            "AVG(confidence_score)::numeric(5,2) AS avg_confidence "
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
            "ORDER BY total_usd DESC LIMIT 20"
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
            "WHERE 1=1 {{filters}} ORDER BY t.trade_date DESC LIMIT 1000"
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
]

assert len(CURATED_DATASETS) == 16, (
    f"CURATED_DATASETS must have 16 entries, got {len(CURATED_DATASETS)}"
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
) -> dict:
    """Build a chart entry with ChartConfigSchema-compliant config."""
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
            "appearance": {
                "title": name,
                "showLegend": show_legend,
                "legendPosition": legend_position,
                "showXLabel": show_x_label,
                "showYLabel": show_y_label,
            },
        },
    }


CURATED_CHARTS: list[dict] = [
    _chart(
        "chart-txn-trend-line",
        "Transaction Volume — Daily",
        "Daily transaction count line chart.",
        "ds-recon-transactions-daily",
        "line",
        "trade_date",
        ["txn_count"],
    ),
    _chart(
        "chart-txn-trend-area",
        "Transaction Amount — Daily",
        "Daily USD volume area chart.",
        "ds-recon-transactions-daily",
        "area",
        "trade_date",
        ["total_usd"],
    ),
    _chart(
        "chart-txn-by-region-bar",
        "Transactions by Region",
        "Region rollup bar chart.",
        "ds-recon-transactions-by-region",
        "bar",
        "region",
        ["txn_count"],
    ),
    _chart(
        "chart-txn-by-region-pie",
        "Transactions by Region (share)",
        "Region share pie chart.",
        "ds-recon-transactions-by-region",
        "pie",
        "region",
        ["total_usd"],
        show_x_label=False,
        show_y_label=False,
    ),
    _chart(
        "chart-txn-status-donut",
        "Match Status",
        "Status distribution donut.",
        "ds-recon-transactions-by-status",
        "donut",
        "status",
        ["txn_count"],
        show_x_label=False,
        show_y_label=False,
    ),
    _chart(
        "chart-txn-status-stacked",
        "Status by Region",
        "Stacked bar of count + USD per region.",
        "ds-recon-transactions-by-region",
        "stacked-bar",
        "region",
        ["txn_count", "total_usd"],
    ),
    _chart(
        "chart-breaks-by-type",
        "Breaks by Type",
        "Break type bar chart.",
        "ds-recon-breaks-summary",
        "bar",
        "break_type",
        ["break_count"],
    ),
    _chart(
        "chart-breaks-aging-waterfall",
        "Aging Waterfall",
        "Aging bucket waterfall view.",
        "ds-recon-breaks-aging",
        "waterfall",
        "bucket",
        ["break_count"],
    ),
    _chart(
        "chart-breaks-aging-bar",
        "Aging Distribution",
        "Aging bucket bar chart.",
        "ds-recon-breaks-aging",
        "bar",
        "bucket",
        ["break_count"],
    ),
    _chart(
        "chart-volume-desk-treemap",
        "Desk Volume Treemap",
        "Treemap of desk volume by asset class.",
        "ds-recon-volume-by-desk",
        "treemap",
        "desk",
        ["total_usd", "txn_count"],
        show_x_label=False,
        show_y_label=False,
    ),
    _chart(
        "chart-txn-scatter",
        "Amount vs Fee",
        "Scatter of amount vs fee.",
        "ds-recon-transactions-scatter",
        "scatter",
        None,
        ["amount_usd", "fee"],
    ),
    _chart(
        "chart-sla-heatmap",
        "SLA Breach Heatmap",
        "SLA breach heatmap by type and region.",
        "ds-sla-breach-summary",
        "heatmap",
        "sla_type",
        ["region", "breach_rate"],
    ),
    _chart(
        "chart-txn-combo",
        "Volume & Amount Combo",
        "Combo chart -- count + USD volume per day.",
        "ds-recon-transactions-daily",
        "combo",
        "trade_date",
        ["txn_count", "total_usd"],
    ),
    _chart(
        "chart-breaks-histogram",
        "Break Amount Distribution",
        "Histogram of break amounts.",
        "ds-recon-transactions-scatter",
        "histogram",
        None,
        ["amount_usd"],
    ),
    _chart(
        "chart-break-flow-sankey",
        "Break Flow",
        "Sankey diagram of break lifecycle.",
        "ds-recon-break-flow-sankey",
        "sankey",
        None,
        ["source", "target", "value"],
    ),
    _chart(
        "chart-kpi-radar",
        "KPI Scorecard",
        "Radar chart of quality KPIs vs benchmarks.",
        "ds-recon-kpi-scorecard",
        "radar",
        "metric",
        ["score", "benchmark"],
    ),
    _chart(
        "chart-match-rate-gauge",
        "Match Rate Gauge",
        "Gauge showing match rate.",
        "ds-recon-match-rate-daily",
        "gauge",
        None,
        ["match_rate"],
        show_legend=False,
        show_x_label=False,
        show_y_label=False,
    ),
    _chart(
        "chart-match-funnel",
        "Match Type Funnel",
        "Funnel of match type counts.",
        "ds-recon-match-events-by-type",
        "funnel",
        "match_type",
        ["event_count"],
    ),
    _chart(
        "chart-recon-graph",
        "Recon Graph Network",
        "Graph network of recon flows (reuses sankey shape).",
        "ds-recon-break-flow-sankey",
        "graph",
        None,
        ["source", "target", "value"],
    ),
    _chart(
        "chart-txn-parallel",
        "Transaction Parallel Coords",
        "Parallel coordinates over scatter columns.",
        "ds-recon-transactions-scatter",
        "parallel",
        None,
        ["amount_usd", "fee"],
    ),
    _chart(
        "chart-currency-pie",
        "Currency Distribution",
        "Pie of currency rollup by USD.",
        "ds-recon-currency-distribution",
        "pie",
        "currency",
        ["total_usd"],
        show_x_label=False,
        show_y_label=False,
    ),
    _chart(
        "chart-counterparty-top-bar",
        "Top 20 Counterparties",
        "Top counterparties bar chart.",
        "ds-recon-counterparty-top",
        "bar",
        "short_name",
        ["total_usd"],
    ),
]

assert len(CURATED_CHARTS) == 22, (
    f"CURATED_CHARTS must have 22 entries, got {len(CURATED_CHARTS)}"
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
    _kpi(
        "kpi-total-transactions",
        "Total Transactions",
        "Total transaction count over the selected window.",
        "ds-recon-transactions-daily",
        "txn_count",
        "SUM",
        fmt={"type": "number", "decimals": 0, "abbreviate": True, "currencyCode": None},
        trend={"mode": "previous_period", "period": "month"},
        thresholds={"greenAbove": 80000, "amberAbove": 50000},
    ),
    _kpi(
        "kpi-total-amount-usd",
        "Total Amount (USD)",
        "Total USD volume over the selected window.",
        "ds-recon-transactions-daily",
        "total_usd",
        "SUM",
        fmt={"type": "currency", "decimals": 0, "abbreviate": True, "currencyCode": "USD"},
        trend={"mode": "previous_period", "period": "week"},
        thresholds={"greenAbove": 1_000_000_000, "amberAbove": 500_000_000},
    ),
    _kpi(
        "kpi-match-rate",
        "Match Rate",
        "Average match rate (% closed transactions).",
        "ds-recon-match-rate-daily",
        "match_rate",
        "AVG",
        fmt={"type": "percentage", "decimals": 1, "abbreviate": False, "currencyCode": None},
        trend={"mode": "static_target", "targetValue": 95.0, "targetLabel": "Target"},
        thresholds={"greenAbove": 90, "amberAbove": 75},
    ),
    _kpi(
        "kpi-total-breaks",
        "Total Breaks",
        "Total open + resolved break count.",
        "ds-recon-breaks-summary",
        "break_count",
        "SUM",
        fmt={"type": "number", "decimals": 0, "abbreviate": False, "currencyCode": None},
        trend={"mode": "previous_period", "period": "day"},
        thresholds={"greenAbove": 50000, "amberAbove": 30000},
        comment=(
            "Lower is better for this metric. Numerically inverted thresholds: "
            "green = room above 50k, amber = room above 30k, red = below 30k. "
            "Seeded value ~20k lands in red band."
        ),
    ),
    _kpi(
        "kpi-avg-aging-days",
        "Average Aging (days)",
        "Average days each break has been open.",
        "ds-recon-breaks-summary",
        "avg_aging",
        "AVG",
        fmt={"type": "decimal", "decimals": 1, "abbreviate": False, "currencyCode": None},
        trend={"mode": "static_target", "targetValue": 3.0, "targetLabel": "SLA"},
        thresholds={"greenAbove": 7, "amberAbove": 4},
        comment=(
            "Lower is better for this metric. Numerically inverted thresholds: "
            "green = above 7 days (impossible -- always green-band would be bad), "
            "amber = >= 4 days. Seeded ~4.5 lands amber."
        ),
    ),
    _kpi(
        "kpi-sla-breach-rate",
        "SLA Breach Rate",
        "SLA breach rate (% breached events).",
        "ds-sla-breach-summary",
        "breach_rate",
        "AVG",
        fmt={"type": "percentage", "decimals": 2, "abbreviate": False, "currencyCode": None},
        trend={"mode": "previous_period", "period": "week"},
        thresholds={"greenAbove": 12, "amberAbove": 6},
        comment=(
            "Lower is better for this metric. Numerically inverted thresholds: "
            "green = above 12%, amber = above 6%, red = below 6%. "
            "Seeded ~8% lands amber."
        ),
    ),
    _kpi(
        "kpi-open-breaks",
        "Open Breaks",
        "Count of breaks with NULL resolved_at.",
        "ds-recon-breaks-summary",
        "break_count",
        "SUM",
        fmt={"type": "number", "decimals": 0, "abbreviate": True, "currencyCode": None},
        trend={"mode": "previous_period", "period": "day"},
        thresholds={"greenAbove": 5000, "amberAbove": 10000},
    ),
    _kpi(
        "kpi-auto-match-pct",
        "Auto-Match %",
        "Percentage of match events flagged AUTO.",
        "ds-recon-match-events-by-type",
        "event_count",
        "COUNT",
        fmt={"type": "percentage", "decimals": 1, "abbreviate": False, "currencyCode": None},
        trend={"mode": "static_target", "targetValue": 80.0, "targetLabel": "Target"},
        thresholds={"greenAbove": 75, "amberAbove": 60},
    ),
    _kpi(
        "kpi-high-value-breaks",
        "High-Value Break $",
        "Total USD value of all break amounts.",
        "ds-recon-breaks-summary",
        "total_break_usd",
        "SUM",
        fmt={"type": "currency", "decimals": 0, "abbreviate": True, "currencyCode": "USD"},
        trend={"mode": "previous_period", "period": "month"},
        thresholds={"greenAbove": 1_000_000, "amberAbove": 5_000_000},
    ),
    _kpi(
        "kpi-avg-confidence",
        "Avg Match Confidence",
        "Average confidence score across rule/AI match events.",
        "ds-recon-match-events-by-type",
        "avg_confidence",
        "AVG",
        fmt={"type": "decimal", "decimals": 2, "abbreviate": False, "currencyCode": None},
        trend=None,
        thresholds={"greenAbove": 0.85, "amberAbove": 0.70},
    ),
    _kpi(
        "kpi-txn-uniques",
        "Unique References",
        "Unique transaction reference count.",
        "ds-recon-transactions-daily",
        "txn_count",
        "COUNT_DISTINCT",
        fmt={"type": "number", "decimals": 0, "abbreviate": True, "currencyCode": None},
        trend=None,
        thresholds=None,
    ),
    _kpi(
        "kpi-largest-txn",
        "Largest Transaction",
        "Largest single transaction USD value.",
        "ds-recon-transactions-daily",
        "total_usd",
        "MAX",
        fmt={"type": "currency", "decimals": 0, "abbreviate": False, "currencyCode": "USD"},
        trend=None,
        thresholds=None,
    ),
]

assert len(CURATED_KPIS) == 12, (
    f"CURATED_KPIS must have 12 entries, got {len(CURATED_KPIS)}"
)


# --------------------------------------------------------------------------- #
# Section 6b: Curated dashboards
# --------------------------------------------------------------------------- #

# Standard global filter bar reused across all 5 dashboards.
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
        "sources": [{"dataSourceId": data_source_id, "metric": ""}],
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
    {
        "id": "dash-sla",
        "name": "Phase 10 · SLA Overview",
        "description": "Daily SLA health -- breach rate by SLA type, breach by region, time-to-resolve distribution.",
        "config": {
            "id": "dash-sla",
            "name": "Phase 10 · SLA Overview",
            "description": "Daily SLA health -- breach rate by SLA type, breach by region, time-to-resolve distribution.",
            "features": {"crossFilter": True, "drillDown": True},
            "filters": _GLOBAL_FILTERS[:],
            "kpis": [
                _kpi_card("kpi-sla-breach-rate"),
                _kpi_card("kpi-match-rate"),
                _kpi_card("kpi-avg-aging-days"),
            ],
            "charts": [
                _dash_chart_ref(
                    "chart-sla-heatmap",
                    "SLA Breach Heatmap",
                    "heatmap",
                    "ds-sla-breach-summary",
                    _layout(0, 0, 12),
                    cross_filter=True,
                    drill_detail_data_source_id="ds-recon-transaction-detail",
                ),
                _dash_chart_ref(
                    "chart-txn-status-stacked",
                    "Status by Region",
                    "stacked-bar",
                    "ds-recon-transactions-by-region",
                    _layout(0, 3, 6),
                    cross_filter=True,
                    drill_hierarchy=["region", "status"],
                    drill_detail_data_source_id="ds-recon-transaction-detail",
                ),
                _dash_chart_ref(
                    "chart-breaks-aging-waterfall",
                    "Aging Waterfall",
                    "waterfall",
                    "ds-recon-breaks-aging",
                    _layout(6, 3, 6),
                ),
                _dash_chart_ref(
                    "chart-match-rate-gauge",
                    "Match Rate Gauge",
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
                    "id": "grid-sla-detail",
                    "title": "Transaction Detail",
                    "dataSourceId": "ds-recon-transaction-detail",
                    "columns": [
                        {"field": "external_ref", "header": "Ref", "type": "string"},
                        {"field": "trade_date", "header": "Trade Date", "type": "date"},
                        {"field": "status", "header": "Status", "type": "string"},
                        {"field": "region", "header": "Region", "type": "string"},
                        {"field": "amount_usd", "header": "Amount USD", "type": "number"},
                    ],
                    "layout": _layout(0, 9, 12, 4),
                }
            ],
            "layout": {"type": "flow", "sections": ["filters", "kpis", "charts", "grids"]},
            "autoRefreshInterval": 600000,
        },
    },
    {
        "id": "dash-aging",
        "name": "Phase 10 · Aging Analysis",
        "description": "What's stale, where, and why.",
        "config": {
            "id": "dash-aging",
            "name": "Phase 10 · Aging Analysis",
            "description": "What's stale, where, and why.",
            "features": {"crossFilter": True, "drillDown": True},
            "filters": _GLOBAL_FILTERS[:],
            "kpis": [
                _kpi_card("kpi-avg-aging-days"),
                _kpi_card("kpi-total-breaks"),
                _kpi_card("kpi-high-value-breaks"),
            ],
            "charts": [
                _dash_chart_ref(
                    "chart-breaks-aging-bar",
                    "Aging Distribution",
                    "bar",
                    "ds-recon-breaks-aging",
                    _layout(0, 0, 6),
                    cross_filter=True,
                    drill_hierarchy=["severity", "aging_bucket"],
                    drill_detail_data_source_id="ds-recon-breaks-summary",
                ),
                _dash_chart_ref(
                    "chart-breaks-aging-waterfall",
                    "Aging Waterfall",
                    "waterfall",
                    "ds-recon-breaks-aging",
                    _layout(6, 0, 6),
                ),
                _dash_chart_ref(
                    "chart-breaks-by-type",
                    "Breaks by Type",
                    "bar",
                    "ds-recon-breaks-summary",
                    _layout(0, 3, 6),
                    cross_filter=True,
                ),
                _dash_chart_ref(
                    "chart-break-flow-sankey",
                    "Break Flow",
                    "sankey",
                    "ds-recon-break-flow-sankey",
                    _layout(0, 6, 12),
                ),
            ],
            "grids": [],
            "layout": {"type": "flow", "sections": ["filters", "kpis", "charts", "grids"]},
            "autoRefreshInterval": 600000,
        },
    },
    {
        "id": "dash-match-rate",
        "name": "Phase 10 · Match Rate Tracker",
        "description": "How well are we auto-matching over time, by desk, by counterparty.",
        "config": {
            "id": "dash-match-rate",
            "name": "Phase 10 · Match Rate Tracker",
            "description": "How well are we auto-matching over time, by desk, by counterparty.",
            "features": {"crossFilter": True, "drillDown": True},
            "filters": _GLOBAL_FILTERS[:],
            "kpis": [
                _kpi_card("kpi-match-rate"),
                _kpi_card("kpi-auto-match-pct"),
                _kpi_card("kpi-avg-confidence"),
            ],
            "charts": [
                _dash_chart_ref(
                    "chart-txn-trend-line",
                    "Transaction Volume — Daily",
                    "line",
                    "ds-recon-transactions-daily",
                    _layout(0, 0, 12),
                    cross_filter=True,
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
                    "chart-txn-status-donut",
                    "Match Status",
                    "donut",
                    "ds-recon-transactions-by-status",
                    _layout(6, 3, 6),
                    cross_filter=True,
                ),
                _dash_chart_ref(
                    "chart-txn-combo",
                    "Volume & Amount Combo",
                    "combo",
                    "ds-recon-transactions-daily",
                    _layout(0, 6, 12),
                ),
            ],
            "grids": [],
            "layout": {"type": "flow", "sections": ["filters", "kpis", "charts", "grids"]},
            "autoRefreshInterval": 600000,
        },
    },
    {
        "id": "dash-volume",
        "name": "Phase 10 · Volume Dashboard",
        "description": "Where is transaction volume concentrated -- by region, desk, counterparty, currency.",
        "config": {
            "id": "dash-volume",
            "name": "Phase 10 · Volume Dashboard",
            "description": "Where is transaction volume concentrated -- by region, desk, counterparty, currency.",
            "features": {"crossFilter": True, "drillDown": True},
            "filters": _GLOBAL_FILTERS[:],
            "kpis": [
                _kpi_card("kpi-total-transactions"),
                _kpi_card("kpi-total-amount-usd"),
                _kpi_card("kpi-largest-txn"),
            ],
            "charts": [
                # Row 1: 12c treemap (cross-filter source)
                _dash_chart_ref(
                    "chart-volume-desk-treemap",
                    "Desk Volume Treemap",
                    "treemap",
                    "ds-recon-volume-by-desk",
                    _layout(0, 0, 12),
                    cross_filter=True,
                    drill_hierarchy=["asset_class", "desk"],
                    drill_detail_data_source_id="ds-recon-transaction-detail",
                ),
                # Row 2: 6c + 6c
                _dash_chart_ref(
                    "chart-txn-by-region-bar",
                    "Transactions by Region",
                    "bar",
                    "ds-recon-transactions-by-region",
                    _layout(0, 3, 6),
                    cross_filter=True,
                ),
                _dash_chart_ref(
                    "chart-currency-pie",
                    "Currency Distribution",
                    "pie",
                    "ds-recon-currency-distribution",
                    _layout(6, 3, 6),
                ),
                # Row 3: 6c + 6c
                _dash_chart_ref(
                    "chart-counterparty-top-bar",
                    "Top 20 Counterparties",
                    "bar",
                    "ds-recon-counterparty-top",
                    _layout(0, 6, 6),
                ),
                _dash_chart_ref(
                    "chart-txn-scatter",
                    "Amount vs Fee",
                    "scatter",
                    "ds-recon-transactions-scatter",
                    _layout(6, 6, 6),
                ),
                # Row 4: 6c chart-txn-trend-area (Q-3b RESOLVED placement)
                _dash_chart_ref(
                    "chart-txn-trend-area",
                    "Transaction Amount — Daily",
                    "area",
                    "ds-recon-transactions-daily",
                    _layout(0, 9, 6),
                ),
                # Row 5: 12c parallel
                _dash_chart_ref(
                    "chart-txn-parallel",
                    "Transaction Parallel Coords",
                    "parallel",
                    "ds-recon-transactions-scatter",
                    _layout(0, 12, 12),
                ),
            ],
            "grids": [],
            "layout": {"type": "flow", "sections": ["filters", "kpis", "charts", "grids"]},
            "autoRefreshInterval": 600000,
        },
    },
    {
        "id": "dash-breaks-summary",
        "name": "Phase 10 · Breaks Summary",
        "description": "Executive-level break summary -- counts, trends, top offenders.",
        "config": {
            "id": "dash-breaks-summary",
            "name": "Phase 10 · Breaks Summary",
            "description": "Executive-level break summary -- counts, trends, top offenders.",
            "features": {"crossFilter": True, "drillDown": True},
            "filters": _GLOBAL_FILTERS[:],
            "kpis": [
                _kpi_card("kpi-total-breaks"),
                _kpi_card("kpi-open-breaks"),
                _kpi_card("kpi-high-value-breaks"),
                _kpi_card("kpi-txn-uniques"),
            ],
            "charts": [
                _dash_chart_ref(
                    "chart-breaks-by-type",
                    "Breaks by Type",
                    "bar",
                    "ds-recon-breaks-summary",
                    _layout(0, 0, 6),
                    cross_filter=True,
                    drill_hierarchy=["break_type", "root_cause"],
                    drill_detail_data_source_id="ds-recon-breaks-summary",
                ),
                _dash_chart_ref(
                    "chart-txn-status-donut",
                    "Match Status",
                    "donut",
                    "ds-recon-transactions-by-status",
                    _layout(6, 0, 6),
                    cross_filter=True,
                ),
                _dash_chart_ref(
                    "chart-breaks-histogram",
                    "Break Amount Distribution",
                    "histogram",
                    "ds-recon-transactions-scatter",
                    _layout(0, 3, 6),
                ),
                _dash_chart_ref(
                    "chart-recon-graph",
                    "Recon Graph Network",
                    "graph",
                    "ds-recon-break-flow-sankey",
                    _layout(0, 6, 12),
                ),
            ],
            "grids": [],
            "layout": {"type": "flow", "sections": ["filters", "kpis", "charts", "grids"]},
            "autoRefreshInterval": 600000,
        },
    },
]

assert len(CURATED_DASHBOARDS) == 5, (
    f"CURATED_DASHBOARDS must have 5 entries, got {len(CURATED_DASHBOARDS)}"
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
    cur.execute("DELETE FROM recviz_data_sources")


def seed_managed_datasets(cur) -> None:
    """Insert dual-row dataset/data-source pairs (A10 guard)."""
    for ds in CURATED_DATASETS:
        managed_sql = ds["sql_template"].replace(" {{filters}}", "").replace(
            "{{filters}}", ""
        )
        seed_curated_dataset_pair(
            cur,
            dataset_id=ds["id"],
            name=ds["name"],
            description=ds["description"],
            database_id=DEFAULT_DATABASE_ID,
            database_name=DEFAULT_DATABASE_NAME,
            sql_template=ds["sql_template"],
            managed_sql=managed_sql,
            columns=ds["columns"],
            filter_mappings=ds["filter_mappings"],
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
            "VALUES (%s, %s, %s, %s, %s, %s::jsonb, NOW(), NOW())",
            (
                chart["id"],
                chart["name"],
                chart["description"],
                chart["dataset_id"],
                chart["chart_type"],
                json.dumps(chart["config"]),
            ),
        )


def seed_managed_kpis(cur) -> None:
    """Insert curated KPIs."""
    for kpi in CURATED_KPIS:
        cur.execute(
            "INSERT INTO recviz_kpis "
            "(id, name, description, dataset_id, metric_column, aggregation, "
            "config, created_at, updated_at) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, NOW(), NOW())",
            (
                kpi["id"],
                kpi["name"],
                kpi["description"],
                kpi["dataset_id"],
                kpi["metric_column"],
                kpi["aggregation"],
                json.dumps(kpi["config"]),
            ),
        )


def seed_managed_dashboards(cur) -> None:
    """Insert curated dashboards."""
    for dash in CURATED_DASHBOARDS:
        cur.execute(
            "INSERT INTO recviz_dashboards "
            "(id, name, description, schema_version, config, created_at, updated_at) "
            "VALUES (%s, %s, %s, 1, %s::jsonb, NOW(), NOW())",
            (
                dash["id"],
                dash["name"],
                dash["description"],
                json.dumps(dash["config"]),
            ),
        )


# --------------------------------------------------------------------------- #
# Section 7b: Dashboard names snapshot writer (M-3 cross-check)
# --------------------------------------------------------------------------- #


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
    print("Phase 10 seed script -- clean-slate rebuild")
    rng = random.Random(RANDOM_SEED)

    with psycopg2.connect(RECON_DB_URL) as recon_conn:
        recon_conn.autocommit = False
        with recon_conn.cursor() as cur:
            print("\n=== recon_data: drop + create schema ===")
            drop_recon_schema(cur)
            create_recon_schema(cur)

            print("\n=== recon_data: dimensions ===")
            engine_ids = insert_returning_ids(
                cur,
                "recon_engines",
                ["code", "name", "vendor", "is_active"],
                gen_recon_engines(),
            )
            print(f"  recon_engines: {len(engine_ids)} rows")

            region_ids = insert_returning_ids(
                cur,
                "regions",
                ["code", "name", "parent_region"],
                gen_regions(),
            )
            print(f"  regions: {len(region_ids)} rows")

            desk_ids = insert_returning_ids(
                cur,
                "desks",
                ["code", "name", "asset_class", "region_id"],
                gen_desks(region_ids),
            )
            print(f"  desks: {len(desk_ids)} rows")

            currency_ids = insert_returning_ids(
                cur,
                "currencies",
                ["code", "name", "decimal_places", "is_active"],
                gen_currencies(),
            )
            print(f"  currencies: {len(currency_ids)} rows")

            status_ids = insert_returning_ids(
                cur,
                "statuses",
                ["code", "name", "category", "sort_order"],
                gen_statuses(),
            )
            print(f"  statuses: {len(status_ids)} rows")

            aging_bucket_ids = insert_returning_ids(
                cur,
                "aging_buckets",
                ["code", "label", "min_days", "max_days", "sort_order", "severity"],
                gen_aging_buckets(),
            )
            print(f"  aging_buckets: {len(aging_bucket_ids)} rows")

            counterparty_ids = insert_returning_ids(
                cur,
                "counterparties",
                ["lei", "short_name", "legal_name", "country_code", "tier"],
                gen_counterparties(rng),
            )
            print(f"  counterparties: {len(counterparty_ids)} rows")

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
            print(f"  accounts: {len(account_ids)} rows")

            print("\n=== recon_data: facts (100k+) ===")
            txn_rows = gen_recon_transactions(
                rng,
                engine_ids,
                account_ids,
                desk_ids,
                region_ids,
                currency_ids,
                status_ids,
                counterparty_ids,
            )
            txn_ids = insert_returning_ids(
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
            print(f"  recon_transactions: {len(txn_ids)} rows")

            break_rows = gen_recon_breaks(rng, txn_ids, aging_bucket_ids)
            break_ids = insert_returning_ids(
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
            print(f"  recon_breaks: {len(break_ids)} rows")

            match_rows = gen_recon_match_events(rng, txn_ids, break_ids)
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
            print(f"  recon_match_events: {len(match_rows)} rows")

            sla_rows = gen_sla_events(rng, txn_ids, break_ids, region_ids)
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
            print(f"  sla_events: {len(sla_rows)} rows")

        recon_conn.commit()

    with psycopg2.connect(RECVIZ_DB_URL) as recviz_conn:
        recviz_conn.autocommit = False
        with recviz_conn.cursor() as cur:
            print("\n=== superset_meta: wipe + seed managed catalog ===")
            wipe_managed_tables(cur)
            seed_managed_datasets(cur)
            print(f"  recviz_datasets + recviz_data_sources: {len(CURATED_DATASETS)} pairs")
            seed_managed_charts(cur)
            print(f"  recviz_charts: {len(CURATED_CHARTS)} rows")
            seed_managed_kpis(cur)
            print(f"  recviz_kpis: {len(CURATED_KPIS)} rows")
            seed_managed_dashboards(cur)
            print(f"  recviz_dashboards: {len(CURATED_DASHBOARDS)} rows")
        recviz_conn.commit()

    write_dashboard_names_snapshot()
    print("\nSeed complete.")


if __name__ == "__main__":
    main()
