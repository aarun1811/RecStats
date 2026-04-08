---
phase: 10-comprehensive-testing-with-advanced-seed-data
plan: 01b
subsystem: testing
tags: [seed, postgres, psycopg2, pytest, managed-tables, a10-pairing, m-3-crosscheck, inverted-kpis]

# Dependency graph
requires:
  - phase: 10-01a
    provides: _fixtures.ts DASHBOARD_NAMES constant (M-3 cross-check source), test_seed_script.py scaffold (16 skipped tests), mock-audit.sh baseline
provides:
  - 100k-row recon_data test bed (4 facts + 8 dimensions with every D-05 edge case)
  - 16 curated datasets + 22 curated charts (all 18 working types) + 12 curated KPIs + 5 curated dashboards in the managed tables
  - A10 dual-row pairing guard enforced at unit-test AND live-DB levels
  - M-3 dashboard-name cross-check artifact (frontend/e2e/_dashboard-names.json)
  - Inverted KPI threshold demonstration (3 KPIs with _comment-documented numerical inversion)
  - 18-test pytest seed regression suite with zero skips
affects: [10-01c, 10-02, 10-03]

# Tech tracking
tech-stack:
  added:
    - "psycopg2-binary 2.9.11 installed in backend/.venv (was listed in requirements.txt but missing from venv)"
  patterns:
    - "Dual-row seed helper (seed_curated_dataset_pair) inserts paired recviz_datasets + recviz_data_sources rows with the SAME string id -- THE A10 guard"
    - "psycopg2.extras.execute_values(fetch=True, page_size=1000) for bulk inserts that return SERIAL ids across batches (default page_size=100 truncated to last page)"
    - "Index-bucketed fact generator forces specific edge-case rows (leap day, DST hour, year boundaries, range boundaries) while keeping the rest uniform"
    - "EXCLUDED_CHART_TYPES guard refuses bullet/box-plot/sunburst in seed_managed_charts -- runtime assert plus unit test"
    - "JSONB dashboard config stored in camelCase to match what the managed dashboards API round-trips raw through api-client DATA_KEYS skip (config field)"

key-files:
  created:
    - frontend/e2e/_dashboard-names.json (8 lines, written by seed_postgres.write_dashboard_names_snapshot)
  modified:
    - scripts/seed-postgres.py (2627 lines, full rewrite replacing the legacy 825-line seed)
    - backend/tests/test_seed_script.py (431 lines, 18 implemented tests replacing 16 scaffold stubs)

key-decisions:
  - "JSONB dashboard config uses camelCase (not snake_case) because useManagedDashboard + DashboardRenderer read the config value as-is. The api-client DATA_KEYS skip set bypasses transformation for the 'config' key, so what's in the JSONB is what reaches the renderer. The plan's interfaces block correctly called this out."
  - "insert_returning_ids must use fetch=True + page_size=1000. Default page_size=100 + fetch=False meant the cursor's fetchall() only saw the LAST paged batch, silently truncating counterparties/accounts/transactions to ~100 rows. Found on first real seed run; auto-fixed (Rule 3)."
  - "Force 10 rows at 2024-01-01 and 10 rows at 2025-12-31 via index buckets so test_date_range_spans_two_years deterministically sees a 730-day span. Uniform sampling alone left the endpoint at 729 days on seed(42) -- auto-fixed (Rule 3)."
  - "test count is 18, not the 17 the orchestrator estimated. Includes the 16 scaffold tests + test_no_excluded_chart_types_in_catalog (added per orchestrator brief) + test_no_f_string_sql_with_data (listed in the plan's <behavior> block). All 18 pass."
  - "psycopg2-binary was missing from backend/.venv despite being in requirements.txt. Installed ad-hoc to unblock the seed run."

requirements-completed:
  - INFR-04
  - INFR-06
  - DSET-01
  - DSET-02
  - DSET-03
  - DSET-04
  - DSET-05
  - CHRT-01
  - CHRT-02
  - CHRT-03
  - CHRT-04
  - CHRT-05
  - CHRT-06
  - CHRT-07
  - KPI-01
  - KPI-02
  - KPI-03

# Metrics
duration: ~15min
completed: 2026-04-08
---

# Phase 10 Plan 01b: Seed Script Rewrite Summary

**The Phase 10 linchpin: `scripts/seed-postgres.py` rewritten end-to-end as a 2627-line advanced seed. 100k recon facts across 4 fact tables + 8 dimensions + 16 curated datasets + 22 curated charts covering all 18 working chart types + 12 curated KPIs (3 with inverted thresholds) + 5 curated dashboards with the `Phase 10 ·` prefix convention. Verified at unit-test AND live-DB level; A10 dual-row guard holds; M-3 cross-check artifact emitted; 18/18 tests pass.**

## Performance

- **Duration:** ~15 min wall time
- **Started:** 2026-04-08T04:55:48Z
- **Completed:** 2026-04-08T05:11:29Z
- **Tasks:** 2 (Task 3 rewrite + Task 4 test implementation & verification)
- **Files modified:** 3 (seed-postgres.py, test_seed_script.py, _dashboard-names.json)
- **Seed wall time:** 9 seconds end-to-end on fresh docker compose Postgres

## Accomplishments

- **scripts/seed-postgres.py rewritten end-to-end (2627 lines).** Replaces the legacy 825-line toy seed. Sections: header + localhost safety guards → schema DDL (drop + create 12 tables with 16 indexes) → dimension generators → fact generators → batch insert helpers → dual-row pairing helper → curated catalog constants (16+22+12+5) → managed-table seeding functions → dashboard names snapshot writer → guarded main(). Imports cleanly; smoke check confirms 16/22/12/5 catalog counts and all 18 working chart types covered.
- **A10 dual-row pairing enforced at BOTH the unit-test and live-DB levels.** The `seed_curated_dataset_pair(cur, ...)` helper inserts matching rows into `recviz_datasets` and `recviz_data_sources` with the SAME string id in a single call site. The unit test `test_dataset_data_source_pairing` asserts every chart/KPI dataset reference and every `drillDetailDataSourceId` resolves to a member of `CURATED_DATASETS`. The live-DB check `SELECT ... LEFT JOIN ... WHERE data_source_id IS NULL` returns zero rows.
- **M-3 dashboard-name cross-check working end-to-end.** `CURATED_DASHBOARDS[*].name` uses the `Phase 10 ·` prefix convention. `test_dashboard_names_match_fixtures` parses the `DASHBOARD_NAMES` block out of `frontend/e2e/_fixtures.ts` via a bounded regex (to avoid colliding with the `CURATED_DASHBOARDS` camelCase keys in the same file) and byte-compares against the seed module constant. `frontend/e2e/_dashboard-names.json` is emitted as a cross-check snapshot.
- **chart-txn-trend-area placed on dash-volume per Q-3b RESOLVED.** Full D4 grid: Row 1 treemap (12c, cross-filter source), Row 2 region-bar 6c + currency-pie 6c, Row 3 counterparty-bar 6c + scatter 6c, Row 4 `chart-txn-trend-area` 6c, Row 5 parallel 12c.
- **Inverted KPI thresholds documented per Q-4 RESOLVED.** `kpi-total-breaks` uses `green_above=50000, amber_above=30000` (seeded ~20k → RED). `kpi-avg-aging-days` uses `green_above=7, amber_above=4` (seeded ~4.5 → AMBER). `kpi-sla-breach-rate` uses `green_above=12, amber_above=6` (seeded ~8 → AMBER). Each of the three has a `_comment` field inside the JSONB config explaining the inversion so a future reader doesn't "fix" it.
- **EXCLUDED_CHART_TYPES guard at runtime and test time.** `seed_managed_charts(cur)` raises `ValueError` if any CURATED_CHARTS entry has `chart_type` in `{"bullet", "box-plot", "sunburst"}`. `test_no_excluded_chart_types_in_catalog` asserts catalog size == 22 and all 18 working types present.
- **All D-05 edge cases baked in.** Leap day (295 rows on 2024-02-29), DST spring-forward hour (55 rows in 2024-03-10 06:00-07:00 UTC), year boundaries (165 rows on 2024-12-31 + 198 rows on 2025-01-01), range boundary (10 rows forced on 2024-01-01 + 10 forced on 2025-12-31 to guarantee the 730-day span), NULL fees (15,223 / ~15%), NULL counterparty_id (5,062 / ~5%), negative amounts (10,072 / ~10%), log-normal money distribution capped at $10M, 100,000 unique external_refs.
- **18/18 tests pass in 6.55s.** Hermetic: no DB connection in the test layer. `_gen_txns()` helper burns the dim-gen calls so each test sees the same RNG state as main().
- **Seed runs in 9 seconds end-to-end** on a clean `docker compose down -v && docker compose up -d postgres` reset. `psycopg2.extras.execute_values(fetch=True, page_size=1000)` is fast enough; no need for COPY FROM.
- **mock-audit.sh stays clean** after the seed changes.

## Task Commits

1. **Task 3: Rewrite scripts/seed-postgres.py** — `8308f0d` (feat) — 2497 insertions / 721 deletions. Full rewrite with 8 sections, the dual-row helper, the 3 curated catalog constants (datasets/charts/kpis/dashboards), the EXCLUDED_CHART_TYPES guard, the snapshot writer, and the guarded main(). Smoke-check confirms all invariants.
2. **Task 4: Implement test_seed_script.py + run seed + verify** — `5d09c36` (test) — 338 insertions / 157 deletions. Replaces the 16 `@pytest.mark.skip` stubs with real assertions, adds 2 new tests (excluded chart types + no-f-string-sql), fixes two blocking seed bugs (insert_returning_ids fetch=True; forced range-boundary rows), and switches the snapshot writer to `ensure_ascii=False`.

## Seed Run Row Counts (live docker compose Postgres)

### recon_data

| Table               | Rows       |
| ------------------- | ---------- |
| recon_engines       | 5          |
| regions             | 10         |
| desks               | 25         |
| currencies          | 30         |
| statuses            | 8          |
| aging_buckets       | 6          |
| counterparties      | 200        |
| accounts            | 5,000      |
| recon_transactions  | **100,000** |
| recon_breaks        | 20,000     |
| recon_match_events  | 80,000     |
| sla_events          | 5,000      |

### superset_meta

| Table                | Rows |
| -------------------- | ---- |
| recviz_datasets      | 16   |
| recviz_data_sources  | 16   |
| recviz_charts        | 22   |
| recviz_kpis          | 12   |
| recviz_dashboards    | 5    |

## Edge-case Verification (psql spot checks)

| Check                                  | Result     | Expected    |
| -------------------------------------- | ---------- | ----------- |
| `COUNT(DISTINCT external_ref)`         | 100,000    | 100,000     |
| `MAX(trade_date) - MIN(trade_date)`    | 730 days   | ≥730 days   |
| Rows on 2024-02-29 (leap day)          | 295        | ≥1          |
| Rows in 2024-03-10 06:00-07:00 UTC     | 55         | ≥1          |
| Rows on 2024-12-31                     | 165        | ≥1          |
| Rows on 2025-01-01                     | 198        | ≥1          |
| NULL fees                              | 15,223     | ~15%        |
| NULL counterparty_id                   | 5,062      | ~5%         |
| Negative amounts                       | 10,072     | ~10%        |

## A10 Dual-Row Guard (live-DB check)

```sql
SELECT d.id AS dataset_id, ds.id AS data_source_id
FROM recviz_datasets d
LEFT JOIN recviz_data_sources ds ON d.id = ds.id
WHERE ds.id IS NULL;
-- 0 rows returned
```

Every `recviz_datasets` row has a matching `recviz_data_sources` row with the same string id. Zero dual-row violations.

## M-3 Dashboard Names Snapshot

`frontend/e2e/_dashboard-names.json`:

```json
{
  "dash-sla": "Phase 10 · SLA Overview",
  "dash-aging": "Phase 10 · Aging Analysis",
  "dash-match-rate": "Phase 10 · Match Rate Tracker",
  "dash-volume": "Phase 10 · Volume Dashboard",
  "dash-breaks-summary": "Phase 10 · Breaks Summary"
}
```

Byte-matches the `DASHBOARD_NAMES` constant in `frontend/e2e/_fixtures.ts`.

## Decisions Made

- **JSONB dashboard config uses camelCase.** The frontend renderer reads `config.features.crossFilter`, `config.autoRefreshInterval`, etc. The api-client's `DATA_KEYS = {'rows', 'columns', 'data', 'config'}` skip set means the VALUE under the `config` key in the managed dashboards API response is NOT transformed. So whatever shape lives in the JSONB is what reaches the renderer. Stored camelCase.
- **The legacy `/api/dashboards/{id}/kpis` endpoint will fail validation on a camelCase JSONB.** That endpoint reads through `config_store.get_dashboard()` which validates against the snake_case `DashboardConfig` Pydantic model. But that endpoint is only called by `useDashboardKpis(... enabled: filters > 0)` — empty initial state won't trigger it, and all dashboard-renderer KPI paths now go through `useCrossFilterData` / local KPI layers. This is a pre-existing structural inconsistency, out of scope for Plan 10-01b. Logged for deferred review (will need to be addressed if the legacy endpoint becomes critical again).
- **Test count is 18, not the 17 the orchestrator estimated.** The plan's `<behavior>` block lists 17 tests; I also added `test_no_f_string_sql_with_data` (which the plan also listed) and `test_no_excluded_chart_types_in_catalog` (explicit orchestrator directive). Counting: 4 row counts + 1 dim cardinalities + 1 high cardinality + 2 NULL tests + 4 date tests + 1 A10 pairing + 1 kpi thresholds + 1 determinism + 1 dashboard names cross-check + 1 excluded chart types + 1 no-f-string-sql = 18 tests. All pass.
- **psycopg2-binary installed at run-time.** Listed in `backend/requirements.txt` but missing from `backend/.venv`. Installed directly with pip instead of rebuilding the venv from scratch.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] psycopg2.extras.execute_values fetch semantics**

- **Found during:** First real seed run (Task 4, Step 3)
- **Issue:** `insert_returning_ids` used default `execute_values(cur, sql, rows)` → `cur.fetchall()`. With default `page_size=100` and `fetch=False`, only the LAST page's RETURNING rows remain queryable via the cursor. On 200 counterparties, 5000 accounts, and 100_000 transactions, this silently truncated the return value to the last-batch ids (~100 rows), which cascaded into `rng.sample(txn_ids, 20_000)` raising `ValueError: Sample larger than population`.
- **Fix:** Switch to `psycopg2.extras.execute_values(cur, sql, rows, page_size=1000, fetch=True)` and use the returned list directly instead of `fetchall()`. All ids come back in insertion order across all batches.
- **Files modified:** `scripts/seed-postgres.py` — `insert_returning_ids` helper only.
- **Committed in:** `5d09c36`

**2. [Rule 3 - Blocking] Date range span off by one day**

- **Found during:** Task 4 initial test run
- **Issue:** `test_date_range_spans_two_years` expects `max(trade_date) - min(trade_date) >= 730 days`. The seed uniformly sampled trade dates across `DATE_RANGE_DAYS=730`, which produced a range span of 729 days on `random.seed(42)` because neither the minimum nor the maximum endpoint was forced.
- **Fix:** Add two new index buckets inside `gen_recon_transactions`: rows 230-239 forced on 2024-01-01 (RANGE_START_BOUNDARY) and rows 240-249 forced on 2025-12-31 (RANGE_END_BOUNDARY). Deterministically guarantees a 730-day span.
- **Files modified:** `scripts/seed-postgres.py` — added `RANGE_START_BOUNDARY` + `RANGE_END_BOUNDARY` constants and two elif branches.
- **Verification:** After the fix, `MIN(trade_date) = 2024-01-01`, `MAX(trade_date) = 2025-12-31`, span = 730 days.
- **Committed in:** `5d09c36`

**3. [Rule 2 - Missing critical functionality] Snapshot writer used ASCII escapes**

- **Found during:** Reading the first successful run's `_dashboard-names.json`
- **Issue:** `json.dumps(snapshot, indent=2)` default `ensure_ascii=True` escaped the `·` character to `\u00b7`. The M-3 cross-check test still passed (it compares decoded strings, not file bytes), but the snapshot file was harder to eyeball.
- **Fix:** `json.dumps(snapshot, indent=2, ensure_ascii=False)` so the raw character survives.
- **Files modified:** `scripts/seed-postgres.py` — `write_dashboard_names_snapshot` only.
- **Committed in:** `5d09c36`

**4. [Rule 3 - Blocking] psycopg2-binary missing from venv**

- **Found during:** Initial `python3 -c "import psycopg2"` check before writing the seed
- **Issue:** `psycopg2-binary==2.9.11` is in `backend/requirements.txt` but was not installed in `backend/.venv/`.
- **Fix:** `pip install psycopg2-binary==2.9.11` into the existing venv (does not touch the requirements file).
- **Files modified:** None in-repo.
- **Verification:** `python -c "import psycopg2; print(psycopg2.__version__)"` → `2.9.11 (dt dec pq3 ext lo64)`

---

**Total deviations:** 4 auto-fixed (all Rule 3 or Rule 2, all necessary to land a working seed). **No Rule 4 (architectural) deviations.** No scope creep.

## Deferred Issues

**Legacy `/api/dashboards/{id}/kpis` endpoint snake_case validation vs camelCase JSONB.** The endpoint reads through `config_store.get_dashboard()` which runs `DashboardConfig.model_validate(...)` on a snake_case Pydantic model. With the new camelCase JSONB, this call will fail Pydantic validation (missing required fields like `data_source_id`, `cross_filter`). Impact is bounded: the endpoint is only called by `useDashboardKpis(... enabled: Object.keys(filters).length > 0)` — empty initial state won't trigger it. **However**, applying a filter on any curated dashboard will likely produce a 400/500 response from this endpoint. Plan 10-02 autonomous walkthrough will surface this; fix belongs in either (a) a new data-layer that reads from `recviz_kpis` directly and aggregates via `ds_config.get_data_source(kpi.dataset_id)`, or (b) backfilling the `DashboardConfig` Pydantic model with `CamelModel` / `alias_generator=to_camel` so it validates camelCase keys. Added to `deferred-items.md`.

## Verification

- `python scripts/seed-postgres.py` → 9 seconds, exit 0, all row counts correct
- `cd backend && python -m pytest tests/test_seed_script.py -v` → **18/18 pass** in 6.55s
- `docker compose exec postgres psql ... COUNT(*) FROM recon_transactions` → 100000
- `docker compose exec postgres psql ... COUNT(DISTINCT external_ref)` → 100000
- `docker compose exec postgres psql ... LEFT JOIN recviz_data_sources` → 0 unpaired rows (A10 guard)
- `docker compose exec postgres psql ... SELECT id, name FROM recviz_dashboards` → all 5 names prefixed `Phase 10 ·`
- `cat frontend/e2e/_dashboard-names.json` → byte-matches the 5 DASHBOARD_NAMES entries
- `bash scripts/mock-audit.sh` → `mock-audit: clean`, exit 0
- Seed module smoke check via `importlib.util.spec_from_file_location` → 16/22/12/5 counts correct, all 18 working chart types covered, no excluded types, chart-txn-trend-area on dash-volume, all dashboard names prefixed, 3 inverted KPIs have `_comment` fields

## Issues Encountered

- **psycopg2.extras.execute_values fetch semantics** blocked the first seed run (see Deviation 1 above).
- **729-day span instead of 730** caused one test to fail before the boundary fix (see Deviation 2 above).
- **psycopg2-binary missing from venv** blocked the smoke-check import until installed (see Deviation 4 above).
- **Unicode escape in snapshot file** was cosmetic only (see Deviation 3 above).
- **No user-facing issues.** Seed + tests green. Mock audit clean. Docker compose reset + seed + verify completes cleanly in under a minute.

## User Setup Required

None. The seed is idempotent — re-running drops and recreates everything in the `recon_data` database and wipes + re-seeds the managed tables in `superset_meta`. The only external prerequisite is `docker compose up -d postgres`, which is the canonical dev reset sequence.

## Next Phase Readiness

**Plan 10-01c can proceed immediately** against a stable test bed:

- The 5 curated dashboards all exist in `recviz_dashboards` at known ids (`dash-sla`, `dash-aging`, `dash-match-rate`, `dash-volume`, `dash-breaks-summary`) with known names (`Phase 10 ·` prefixed).
- The 22 curated charts, 12 KPIs, and 16 datasets exist at stable ids matching `_fixtures.ts` CURATED_* constants.
- The A10 dual-row pairing guard holds at both unit-test and live-DB levels. Plan 10-01c's E2E rewrite can reference dataset ids knowing every one has a matching data_source row.
- `frontend/e2e/_dashboard-names.json` is available as a secondary artifact if any Plan 10-01c spec needs to cross-check dashboard names.
- `bash scripts/mock-audit.sh` still exits clean — no regressions.

**Blockers:** None.

**Concerns for Plan 10-01c:**
- The legacy `/api/dashboards/{id}/kpis` endpoint Pydantic validation issue (Deferred Issues section above) will surface when Plan 10-02 applies filters on curated dashboards. Plan 10-01c's smoke specs should avoid applying filters until that's fixed, OR Plan 10-01c Task 0 can prepend a fix for this before the smoke specs run.
- The `recviz_datasets.database_id` is set to `1` for all 16 datasets. This is a placeholder because `superset_id = NULL + sync_status = 'synced'` means dataset-sync doesn't fire, so the literal value is never used at runtime. If the user later edits a dataset through the UI, the dataset-sync service will try to create a Superset virtual dataset against database_id=1, which may or may not exist in Superset's metadata. Out of scope for 10-01b; flag for Plan 10-02's walkthrough of `/datasets/:id/edit`.

## Self-Check: PASSED

Verified post-write:

- `scripts/seed-postgres.py` — FOUND (2627 lines)
- `backend/tests/test_seed_script.py` — FOUND (431 lines)
- `frontend/e2e/_dashboard-names.json` — FOUND (8 lines, correct dashboard names, raw `·` character)
- Commit `8308f0d` (Task 3 seed rewrite) — FOUND
- Commit `5d09c36` (Task 4 tests + fixes) — FOUND
- `python scripts/seed-postgres.py` → seed runs in 9s, exit 0
- `pytest tests/test_seed_script.py` → 18/18 pass in 6.55s
- `psql SELECT COUNT(*) FROM recon_transactions` → 100000 ✓
- `psql LEFT JOIN recviz_data_sources` → 0 unpaired rows ✓
- `bash scripts/mock-audit.sh` → clean, exit 0 ✓

---
*Phase: 10-comprehensive-testing-with-advanced-seed-data*
*Completed: 2026-04-08*
