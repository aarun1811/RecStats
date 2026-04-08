"""Phase 10 — Seed script unit tests (scaffold).

All test functions in this module are currently `@pytest.mark.skip`. Plan
10-01a produces the scaffold only; Plan 10-01b Task 4 unskips them and
implements real assertions once `scripts/seed-postgres.py` has been rewritten
to expose the generator helpers at module level (guarded by
`if __name__ == "__main__":`).

The 16 test functions cover:

- 11 quantitative tests from VALIDATION.md §Wave 0 Requirements (row counts,
  cardinalities, NULL presence, date edge cases).
- 1 critical dual-row pairing guard (`test_dataset_data_source_pairing`) —
  the A10 architectural pattern that is the #1 structural risk in the seed.
- 1 KPI threshold banding test.
- 1 determinism test.
- 1 M-3 dashboard-name cross-check (`test_dashboard_names_match_fixtures`)
  verifying `CURATED_DASHBOARDS[*].name` in the seed module matches
  `DASHBOARD_NAMES` in `frontend/e2e/_fixtures.ts`.
"""

from __future__ import annotations

import importlib.util
import pathlib

import pytest

# Paths used by Plan 10-01b Task 4 when the skips are lifted. Keeping them
# here so tests don't need to re-derive them once unskipped.
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
    """Import `scripts/seed-postgres.py` as a Python module.

    The dash in the filename blocks normal imports. This helper uses
    `importlib.util.spec_from_file_location` to sidestep that. Plan 10-01b
    Task 3 guarantees the seed script is importable (main() guarded by
    `if __name__ == "__main__":`).
    """
    spec = importlib.util.spec_from_file_location("seed_postgres", _SEED_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


_UNSKIP_REASON = "Plan 10-01b Task 4 will unskip and implement"


# --------------------------------------------------------------------------- #
# Row counts (§Wave 0 Requirements items 1-4)
# --------------------------------------------------------------------------- #


@pytest.mark.skip(reason=_UNSKIP_REASON)
def test_recon_transactions_row_count_is_100k():
    """Assert the `recon_transactions` fact table is seeded with exactly
    100_000 rows per D-02 (the 100k fact tier)."""
    module = _load_seed_module()
    del module  # Plan 10-01b implements


@pytest.mark.skip(reason=_UNSKIP_REASON)
def test_recon_breaks_row_count_in_range():
    """Assert `recon_breaks` has ~20_000 rows (±5%) per D-03 working sketch."""
    module = _load_seed_module()
    del module  # Plan 10-01b implements


@pytest.mark.skip(reason=_UNSKIP_REASON)
def test_recon_match_events_row_count_in_range():
    """Assert `recon_match_events` has ~80_000 rows (±5%) per D-03 working
    sketch."""
    module = _load_seed_module()
    del module  # Plan 10-01b implements


@pytest.mark.skip(reason=_UNSKIP_REASON)
def test_sla_events_row_count_in_range():
    """Assert `sla_events` has ~5_000 rows (±5%) per D-03 working sketch."""
    module = _load_seed_module()
    del module  # Plan 10-01b implements


# --------------------------------------------------------------------------- #
# Dimension cardinalities + high-cardinality dimension (§Wave 0 items 5-6)
# --------------------------------------------------------------------------- #


@pytest.mark.skip(reason=_UNSKIP_REASON)
def test_dimension_table_cardinalities():
    """Assert dimension table sizes match the sketch:
    `recon_engines`=5, `regions`=10, `desks`=25, `currencies`=30,
    `statuses`=8, `aging_buckets`=6, `counterparties`=200, `accounts`=5000
    (per D-02 and RESEARCH.md §1)."""
    module = _load_seed_module()
    del module  # Plan 10-01b implements


@pytest.mark.skip(reason=_UNSKIP_REASON)
def test_high_cardinality_dimension_has_10k_plus_uniques():
    """Assert the designated high-cardinality column (expected:
    `recon_transactions.external_ref`) has ≥10_000 distinct values per D-05.

    D-05 requires at least one high-cardinality dimension (≥10k uniques) to
    exercise the filter/facet UI under real-world cardinality pressure."""
    module = _load_seed_module()
    del module  # Plan 10-01b implements


# --------------------------------------------------------------------------- #
# NULL presence in measure + dimension columns (§Wave 0 items 7-8)
# --------------------------------------------------------------------------- #


@pytest.mark.skip(reason=_UNSKIP_REASON)
def test_nulls_present_in_measure_columns():
    """Assert every fact table has ≥1 row with a NULL in a designated measure
    column (e.g., `recon_transactions.fee` NULL ~15%, `recon_breaks`
    `break_amount_usd` sparse). Per D-05 edge-case contract."""
    module = _load_seed_module()
    del module  # Plan 10-01b implements


@pytest.mark.skip(reason=_UNSKIP_REASON)
def test_nulls_present_in_dimension_columns():
    """Assert every fact table has ≥1 row with a NULL in a designated dim
    column (e.g., `recon_transactions.counterparty_id` NULL ~5%). Per D-05."""
    module = _load_seed_module()
    del module  # Plan 10-01b implements


# --------------------------------------------------------------------------- #
# Date edge cases (§Wave 0 items 9-12)
# --------------------------------------------------------------------------- #


@pytest.mark.skip(reason=_UNSKIP_REASON)
def test_date_range_spans_two_years():
    """Assert `recon_transactions.trade_date` MIN/MAX are ≥730 days apart
    per D-02 (2-year date range covering leap year + DST + year boundary)."""
    module = _load_seed_module()
    del module  # Plan 10-01b implements


@pytest.mark.skip(reason=_UNSKIP_REASON)
def test_leap_day_record_present():
    """Assert at least one `recon_transactions` row has
    `trade_date = 2024-02-29` (leap day) per D-05 edge-case contract."""
    module = _load_seed_module()
    del module  # Plan 10-01b implements


@pytest.mark.skip(reason=_UNSKIP_REASON)
def test_dst_record_present():
    """Assert at least one fact row lands inside the DST spring-forward hour
    on 2024-03-10 (US/Eastern). The column is a timestamp; the test looks for
    any row whose timestamp is between 02:00 and 03:00 on that date. Per
    D-05 edge-case contract."""
    module = _load_seed_module()
    del module  # Plan 10-01b implements


@pytest.mark.skip(reason=_UNSKIP_REASON)
def test_year_boundary_records_present():
    """Assert rows exist on 2024-12-31 AND 2025-01-01 — the year-boundary
    edge case required by D-05."""
    module = _load_seed_module()
    del module  # Plan 10-01b implements


# --------------------------------------------------------------------------- #
# CRITICAL: Dual-row dataset/data-source pairing (A10 pattern guard)
# --------------------------------------------------------------------------- #


@pytest.mark.skip(reason=_UNSKIP_REASON)
def test_dataset_data_source_pairing():
    """A10 DUAL-ROW PAIRING GUARD — the #1 structural risk in the seed.

    For every row the seed inserts into `recviz_datasets`, there MUST be a
    matching row in `recviz_data_sources` with the SAME string id. Without
    this pairing, the dashboard renderer crashes with "Data source not
    found" because the builder writes the managed dataset's id directly into
    `DashboardChartConfig.sources[0].dataSourceId`, which the renderer
    resolves via `ConfigStore.get_data_source()` → a SELECT against
    `recviz_data_sources`.

    Additional assertions once implemented in Plan 10-01b Task 4:

    1. `recviz_datasets.columns` (JSONB list) matches the `columns` field
       inside `recviz_data_sources.config` for every row — the column
       metadata should be consistent across both tables or the builder UI
       and the runtime query mapping will drift.
    2. Every `ds-*` id referenced by any curated chart/KPI/dashboard has a
       row in BOTH tables.

    Source of truth for the list of expected dataset ids: the seed module's
    `CURATED_DATASETS` constant OR `RESEARCH.md §2.1` (16 datasets).
    """
    module = _load_seed_module()
    del module  # Plan 10-01b implements


# --------------------------------------------------------------------------- #
# KPI threshold banding + determinism (§Wave 0 items 13-14)
# --------------------------------------------------------------------------- #


@pytest.mark.skip(reason=_UNSKIP_REASON)
def test_kpi_thresholds_seed_into_correct_bands():
    """For each curated KPI, the seed data must produce a baseline aggregated
    value that lands in the intended threshold band. Per D-04 and RESEARCH.md
    §2.3 — specifically the "seed precisely to exercise one KPI in each band"
    requirement:

    - Green band: `kpi-match-rate` should compute ~92% (>90 threshold)
    - Amber band: `kpi-avg-confidence` should sit ~0.77 (between 0.70 and 0.85)
    - Red band: `kpi-total-breaks` should land in the red bucket (precise
      target depends on seed totals — 22k for amber or 26k for red)

    This test iterates each curated KPI, runs its aggregation against the
    seed data, and asserts the computed value falls in the documented band.
    """
    module = _load_seed_module()
    del module  # Plan 10-01b implements


@pytest.mark.skip(reason=_UNSKIP_REASON)
def test_seed_is_deterministic():
    """Running the seed twice with the same RNG seed (`random.seed(42)`) must
    produce byte-identical inserts per D-06 idempotency contract.

    Implementation sketch (Plan 10-01b Task 4): invoke the generator helpers
    twice in-process, compare the serialized outputs row-by-row. Do NOT run
    the full drop-create-insert against a real DB — this is a pure function
    test."""
    module = _load_seed_module()
    del module  # Plan 10-01b implements


# --------------------------------------------------------------------------- #
# M-3 Dashboard-name cross-check (canonical-name convention guard)
# --------------------------------------------------------------------------- #


@pytest.mark.skip(reason=_UNSKIP_REASON)
def test_dashboard_names_match_fixtures():
    """M-3 CROSS-CHECK — guarantees that the canonical `DASHBOARD_NAMES`
    constant in `frontend/e2e/_fixtures.ts` and the seed module's
    `CURATED_DASHBOARDS` name values are kept in lock-step.

    Implementation sketch (Plan 10-01b Task 4):

    1. Load `_FIXTURES_PATH` as text.
    2. Parse the `DASHBOARD_NAMES` TypeScript object literal via a tolerant
       regex that captures `'dash-<slug>': '<display name>',` pairs. This is
       safe because the file is hand-maintained and the shape is stable.
    3. Load the seed module via `_load_seed_module()` and read its
       `CURATED_DASHBOARDS` constant.
    4. Assert both maps have the same keys and the same display-name values
       (character-for-character — no normalization).

    Failure here means either (a) the seed drifted from the fixture without
    updating the fixture, or (b) the fixture was updated without updating
    the seed. Either way, the E2E specs, the seed, and the UAT runbook will
    disagree on what the dashboards are called.
    """
    assert _FIXTURES_PATH.exists(), (
        f"Fixture file missing at {_FIXTURES_PATH}. "
        "Plan 10-01a Task 1 should have created it."
    )
    module = _load_seed_module()
    del module  # Plan 10-01b implements
