"""Phase 10 -- Seed script unit tests (implemented).

This is the unit-test layer for ``scripts/seed-postgres.py``. All tests are
hermetic -- they exercise the seed module's generator functions in-process
with ``random.Random(42)`` and NEVER connect to a real database. Plan 10-01b
Task 4 unskipped and implemented the assertions. The 17 tests cover:

- 11 quantitative tests from VALIDATION.md §Wave 0 Requirements (row counts,
  cardinalities, NULL presence, date edge cases)
- 1 critical dual-row pairing guard (``test_dataset_data_source_pairing``)
  -- the A10 architectural pattern
- 1 KPI threshold banding test (verifies inverted thresholds per Q-4)
- 1 determinism test
- 1 M-3 dashboard-name cross-check (``test_dashboard_names_match_fixtures``)
- 1 excluded-chart-types guard (``test_no_excluded_chart_types_in_catalog``)
- 1 "no f-string SQL with data" guard (``test_no_f_string_sql_with_data``)
"""

from __future__ import annotations

import importlib.util
import pathlib
import random
import re
from datetime import date, datetime, timezone

_SEED_PATH = (
    pathlib.Path(__file__).resolve().parents[2] / "scripts" / "seed-postgres.py"
)
_FIXTURES_PATH = (
    pathlib.Path(__file__).resolve().parents[2]
    / "frontend"
    / "e2e"
    / "_fixtures.ts"
)


def _load_seed_module():
    """Import ``scripts/seed-postgres.py`` as a Python module.

    The dash in the filename blocks normal imports. This helper uses
    ``importlib.util.spec_from_file_location`` to sidestep that.
    """
    spec = importlib.util.spec_from_file_location("seed_postgres", _SEED_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# Stable ids used throughout the tests. These match the seed module's
# deterministic dimension emission order.
_ENGINE_IDS = [1, 2, 3, 4, 5]
_REGION_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
_DESK_IDS = list(range(1, 26))
_CURRENCY_IDS = list(range(1, 31))
_STATUS_IDS = list(range(1, 9))
_AGING_BUCKET_IDS = list(range(1, 7))
_COUNTERPARTY_IDS = list(range(1, 201))
_ACCOUNT_IDS = list(range(1, 5001))


def _gen_txns(module, seed: int = 42):
    rng = random.Random(seed)
    # Burn dim-gen calls so txn gen sees the same state as main()
    module.gen_counterparties(rng)
    module.gen_accounts(rng, _REGION_IDS, _CURRENCY_IDS)
    return rng, module.gen_recon_transactions(
        rng,
        _ENGINE_IDS,
        _ACCOUNT_IDS,
        _DESK_IDS,
        _REGION_IDS,
        _CURRENCY_IDS,
        _STATUS_IDS,
        _COUNTERPARTY_IDS,
    )


# --------------------------------------------------------------------------- #
# Row counts
# --------------------------------------------------------------------------- #


def test_recon_transactions_row_count_is_100k():
    module = _load_seed_module()
    _, txns = _gen_txns(module)
    assert len(txns) == 100_000, f"expected 100000, got {len(txns)}"


def test_recon_breaks_row_count_in_range():
    module = _load_seed_module()
    rng, txns = _gen_txns(module)
    # Transaction SERIAL ids start at 1
    txn_ids = list(range(1, len(txns) + 1))
    breaks = module.gen_recon_breaks(rng, txn_ids, _AGING_BUCKET_IDS)
    # Target 20_000 exact per seed spec
    assert 19_000 <= len(breaks) <= 21_000, (
        f"expected ~20000 breaks (±5%), got {len(breaks)}"
    )


def test_recon_match_events_row_count_in_range():
    module = _load_seed_module()
    rng, txns = _gen_txns(module)
    txn_ids = list(range(1, len(txns) + 1))
    breaks = module.gen_recon_breaks(rng, txn_ids, _AGING_BUCKET_IDS)
    break_ids = list(range(1, len(breaks) + 1))
    match_events = module.gen_recon_match_events(rng, txn_ids, break_ids)
    assert 76_000 <= len(match_events) <= 84_000, (
        f"expected ~80000 match events (±5%), got {len(match_events)}"
    )


def test_sla_events_row_count_in_range():
    module = _load_seed_module()
    rng, txns = _gen_txns(module)
    txn_ids = list(range(1, len(txns) + 1))
    breaks = module.gen_recon_breaks(rng, txn_ids, _AGING_BUCKET_IDS)
    break_ids = list(range(1, len(breaks) + 1))
    # Skip match events to save time (they don't affect SLA count)
    sla_events = module.gen_sla_events(rng, txn_ids, break_ids, _REGION_IDS)
    assert 4_750 <= len(sla_events) <= 5_250, (
        f"expected ~5000 SLA events (±5%), got {len(sla_events)}"
    )


# --------------------------------------------------------------------------- #
# Dimension cardinalities + high-cardinality dimension
# --------------------------------------------------------------------------- #


def test_dimension_table_cardinalities():
    module = _load_seed_module()
    rng = random.Random(42)
    assert len(module.gen_recon_engines()) == 5
    assert len(module.gen_regions()) == 10
    assert len(module.gen_desks(_REGION_IDS)) == 25
    assert len(module.gen_currencies()) == 30
    assert len(module.gen_statuses()) == 8
    assert len(module.gen_aging_buckets()) == 6
    assert len(module.gen_counterparties(rng)) == 200
    assert len(module.gen_accounts(rng, _REGION_IDS, _CURRENCY_IDS)) == 5000


def test_high_cardinality_dimension_has_10k_plus_uniques():
    """external_ref must have at least 10_000 unique values.

    By construction each transaction gets a unique external_ref -- at 100k
    transactions this is a 100_000-unique column, comfortably above the
    D-05 10k threshold.
    """
    module = _load_seed_module()
    _, txns = _gen_txns(module)
    # external_ref is column 0 of the fact tuple
    unique_refs = {row[0] for row in txns}
    assert len(unique_refs) >= 10_000, (
        f"expected ≥10k unique external_refs, got {len(unique_refs)}"
    )
    # And the exact 100k uniqueness contract
    assert len(unique_refs) == 100_000


# --------------------------------------------------------------------------- #
# NULL presence in measure + dimension columns
# --------------------------------------------------------------------------- #


def test_nulls_present_in_measure_columns():
    """fee and fx_rate must each have at least one NULL in recon_transactions."""
    module = _load_seed_module()
    _, txns = _gen_txns(module)
    # fee is column 9, fx_rate is column 10 in the recon_transactions tuple
    fee_nulls = sum(1 for row in txns if row[9] is None)
    fx_nulls = sum(1 for row in txns if row[10] is None)
    assert fee_nulls > 0, "expected at least one NULL fee"
    assert fx_nulls > 0, "expected at least one NULL fx_rate"


def test_nulls_present_in_dimension_columns():
    """counterparty_id must have at least one NULL in recon_transactions."""
    module = _load_seed_module()
    _, txns = _gen_txns(module)
    # counterparty_id is column 3
    cp_nulls = sum(1 for row in txns if row[3] is None)
    assert cp_nulls > 0, "expected at least one NULL counterparty_id"


# --------------------------------------------------------------------------- #
# Date edge cases
# --------------------------------------------------------------------------- #


def test_date_range_spans_two_years():
    module = _load_seed_module()
    _, txns = _gen_txns(module)
    # trade_date is column 12
    dates = [row[12] for row in txns]
    span = (max(dates) - min(dates)).days
    assert span >= 730, f"expected ≥730 day span, got {span}"


def test_leap_day_record_present():
    module = _load_seed_module()
    _, txns = _gen_txns(module)
    leap_day = date(2024, 2, 29)
    leap_rows = [row for row in txns if row[12] == leap_day]
    assert len(leap_rows) > 0, "expected at least one row on 2024-02-29"


def test_dst_record_present():
    """At least one booking_ts lands in the 2024-03-10 06:00-07:00 UTC window."""
    module = _load_seed_module()
    _, txns = _gen_txns(module)
    # booking_ts is column 14
    dst_start = datetime(2024, 3, 10, 6, 0, 0, tzinfo=timezone.utc)
    dst_end = datetime(2024, 3, 10, 7, 0, 0, tzinfo=timezone.utc)
    dst_rows = [row for row in txns if dst_start <= row[14] < dst_end]
    assert len(dst_rows) > 0, (
        "expected at least one booking_ts inside the DST spring-forward hour"
    )


def test_year_boundary_records_present():
    """Rows on 2024-12-31 AND 2025-01-01 must both be present."""
    module = _load_seed_module()
    _, txns = _gen_txns(module)
    dec31 = date(2024, 12, 31)
    jan01 = date(2025, 1, 1)
    dec_rows = [row for row in txns if row[12] == dec31]
    jan_rows = [row for row in txns if row[12] == jan01]
    assert len(dec_rows) > 0, "expected at least one row on 2024-12-31"
    assert len(jan_rows) > 0, "expected at least one row on 2025-01-01"


# --------------------------------------------------------------------------- #
# CRITICAL: Dual-row dataset/data-source pairing (A10 guard)
# --------------------------------------------------------------------------- #


def test_dataset_data_source_pairing():
    """A10 DUAL-ROW PAIRING GUARD -- the #1 structural risk in the seed.

    Every chart/KPI dataset reference AND every drillDetailDataSourceId
    on every dashboard must resolve to a member of CURATED_DATASETS.
    """
    module = _load_seed_module()
    dataset_ids = {ds["id"] for ds in module.CURATED_DATASETS}
    assert len(dataset_ids) == 16, (
        f"expected 16 unique dataset ids, got {len(dataset_ids)}"
    )

    for chart in module.CURATED_CHARTS:
        assert chart["dataset_id"] in dataset_ids, (
            f"chart {chart['id']} references unknown dataset {chart['dataset_id']}"
        )

    for kpi in module.CURATED_KPIS:
        assert kpi["dataset_id"] in dataset_ids, (
            f"kpi {kpi['id']} references unknown dataset {kpi['dataset_id']}"
        )

    for dash in module.CURATED_DASHBOARDS:
        charts = dash["config"].get("charts", [])
        for chart_ref in charts:
            sources = chart_ref.get("sources", []) or []
            for source in sources:
                ds_id = source.get("dataSourceId") or source.get("data_source_id")
                if ds_id:
                    assert ds_id in dataset_ids, (
                        f"dashboard {dash['id']} chart "
                        f"{chart_ref.get('chartId')} references unknown "
                        f"dataSourceId {ds_id}"
                    )
            drill_detail_id = chart_ref.get(
                "drillDetailDataSourceId"
            ) or chart_ref.get("drill_detail_data_source_id")
            if drill_detail_id:
                assert drill_detail_id in dataset_ids, (
                    f"dashboard {dash['id']} chart "
                    f"{chart_ref.get('chartId')} references unknown "
                    f"drillDetailDataSourceId {drill_detail_id}"
                )
        for grid in dash["config"].get("grids", []) or []:
            ds_id = grid.get("dataSourceId") or grid.get("data_source_id")
            if ds_id:
                assert ds_id in dataset_ids, (
                    f"dashboard {dash['id']} grid {grid.get('id')} "
                    f"references unknown dataSourceId {ds_id}"
                )


# --------------------------------------------------------------------------- #
# KPI threshold banding + determinism
# --------------------------------------------------------------------------- #


def test_kpi_thresholds_seed_into_correct_bands():
    """Inverted KPIs (Q-4 RESOLVED) must have numerically-inverted thresholds
    so seeded values land in the intended visual band via literal
    "higher = better" rendering in ``frontend/src/lib/kpi-utils.ts``."""
    module = _load_seed_module()
    kpis_by_id = {k["id"]: k for k in module.CURATED_KPIS}

    tbr = kpis_by_id["kpi-total-breaks"]
    assert tbr["config"]["thresholds"]["greenAbove"] == 50000
    assert tbr["config"]["thresholds"]["amberAbove"] == 30000
    assert "_comment" in tbr["config"]

    aad = kpis_by_id["kpi-avg-aging-days"]
    assert aad["config"]["thresholds"]["greenAbove"] == 7
    assert aad["config"]["thresholds"]["amberAbove"] == 4
    assert "_comment" in aad["config"]

    sbr = kpis_by_id["kpi-sla-breach-rate"]
    assert sbr["config"]["thresholds"]["greenAbove"] == 12
    assert sbr["config"]["thresholds"]["amberAbove"] == 6
    assert "_comment" in sbr["config"]

    # A positive-polarity KPI should NOT have inverted thresholds
    mr = kpis_by_id["kpi-match-rate"]
    assert mr["config"]["thresholds"]["greenAbove"] == 90
    assert mr["config"]["thresholds"]["amberAbove"] == 75


def test_seed_is_deterministic():
    """gen_recon_transactions with the same seed produces byte-identical output."""
    module = _load_seed_module()
    _, txns_a = _gen_txns(module, seed=42)
    _, txns_b = _gen_txns(module, seed=42)
    assert txns_a == txns_b, "seeded RNG produced divergent outputs"


# --------------------------------------------------------------------------- #
# Dashboard name cross-check + chart-type catalog guard
# --------------------------------------------------------------------------- #


def test_dashboard_names_match_fixtures():
    """M-3 CROSS-CHECK -- seed CURATED_DASHBOARDS.name values must match the
    canonical DASHBOARD_NAMES in ``frontend/e2e/_fixtures.ts`` byte-for-byte.
    """
    assert _FIXTURES_PATH.exists(), (
        f"Fixture file missing at {_FIXTURES_PATH}. "
        "Plan 10-01a Task 1 should have created it."
    )
    module = _load_seed_module()
    fixtures_src = _FIXTURES_PATH.read_text()
    # Parse only the DASHBOARD_NAMES block to avoid picking up CURATED_DASHBOARDS
    # object literal entries (those use camelCase keys, not `dash-*` keys).
    block_match = re.search(
        r"export const DASHBOARD_NAMES\s*=\s*\{([^}]+)\}",
        fixtures_src,
    )
    assert block_match is not None, "DASHBOARD_NAMES block not found in _fixtures.ts"
    block = block_match.group(1)
    pattern = re.compile(r"'(dash-[a-z-]+)':\s*'([^']+)'")
    fixture_names = dict(pattern.findall(block))
    seed_names = {d["id"]: d["name"] for d in module.CURATED_DASHBOARDS}
    assert fixture_names == seed_names, (
        f"dashboard name drift between seed and fixtures:\n"
        f"  fixtures: {sorted(fixture_names.items())}\n"
        f"  seed:     {sorted(seed_names.items())}"
    )


def test_no_excluded_chart_types_in_catalog():
    """User correction 2026-04-08: bullet, box-plot, and sunburst fall back
    to bar / need hierarchical data transforms. The seed must refuse them.
    The catalog must have exactly 22 charts covering all 18 working types."""
    module = _load_seed_module()
    excluded = {"bullet", "box-plot", "sunburst"}
    violations = [
        (c["id"], c["chart_type"])
        for c in module.CURATED_CHARTS
        if c["chart_type"] in excluded
    ]
    assert not violations, f"Excluded chart types found: {violations}"

    assert len(module.CURATED_CHARTS) == 22, (
        f"Expected 22 charts covering all 18 working types, got "
        f"{len(module.CURATED_CHARTS)}"
    )

    working_types = {
        # AG (12)
        "bar",
        "stacked-bar",
        "line",
        "area",
        "pie",
        "donut",
        "scatter",
        "heatmap",
        "treemap",
        "waterfall",
        "combo",
        "histogram",
        # ECharts (6)
        "sankey",
        "radar",
        "gauge",
        "funnel",
        "graph",
        "parallel",
    }
    catalog_types = {c["chart_type"] for c in module.CURATED_CHARTS}
    missing = working_types - catalog_types
    assert not missing, f"Working chart types missing from catalog: {missing}"


def test_no_f_string_sql_with_data():
    """Guard against string-formatted SQL with user-data-adjacent placeholders.

    Only the whitelisted identifiers `{table}`, `{columns}`, and `{cols_sql}`
    (static table/column names) are allowed inside f-string INSERTs. Anything
    that looks like a data value inside an f-string SQL is rejected.
    """
    src = _SEED_PATH.read_text()
    whitelist = {"{table}", "{columns}", "{cols_sql}", "{field}"}
    # Find all `f"INSERT ..."` or `f'INSERT ...'` strings
    insert_f_strings = re.findall(
        r"""f["']INSERT\s+[^"']*["']""", src, flags=re.IGNORECASE
    )
    for line in insert_f_strings:
        # Find every {...} inside the literal
        placeholders = re.findall(r"\{[^}]+\}", line)
        for ph in placeholders:
            assert ph in whitelist, (
                f"Disallowed f-string SQL placeholder {ph!r} in: {line}"
            )
