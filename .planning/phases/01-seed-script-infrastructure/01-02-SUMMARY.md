---
phase: 01-seed-script-infrastructure
plan: 02
subsystem: seed-script
tags: [distributions, pareto, seasonal, bimodal, oracle-ddl, data-sources-removal]
dependency_graph:
  requires: [cli-parsing, enriched-dimensions, timed-batch-helpers, schema-name-helper]
  provides: [pareto-counterparties, seasonal-dates, clustered-breaks, decaying-aging, bimodal-confidence, configurable-row-counts, oracle-native-ddl, seed-connection-with-schema, no-data-sources-writes]
  affects: [scripts/seed-oracle.py]
tech_stack:
  added: [oracledb]
  removed: [psycopg2]
  patterns: [pareto-weighted-selection, rejection-sampling-seasonal, exponential-decay-buckets, bimodal-gaussian-mix, oracle-identity-columns]
key_files:
  created: []
  modified:
    - scripts/seed-oracle.py
decisions:
  - "Pareto shape=1.16 gives ~78% volume to top 20% counterparties at 1K rows (D-06)"
  - "Seasonal dates use rejection sampling: 75% weekend rejection, month-end boost, growth trend (D-07)"
  - "Break clustering: APAC sub-regions 2x, FX desks 1.5x, NAM+RATES 0.3x (D-08)"
  - "Aging decay: exp(-0.5*i) weights, most breaks in 0-1 day buckets (D-09)"
  - "Bimodal confidence: 70% gauss(0.92,0.04) + 30% gauss(0.25,0.08) for RULE/AI matches (D-10)"
  - "MANUAL matches get uniform high confidence 0.85-0.99, AUTO gets NULL"
  - "Renamed seed-postgres.py to seed-oracle.py, converted all DDL to Oracle 19c syntax"
  - "Removed psycopg2 entirely, using oracledb as sole database driver"
metrics:
  duration: 9m 43s
  completed: 2026-04-13
---

# Phase 01 Plan 02: Fact Generators, main() Wiring, and data_sources Removal Summary

Pareto counterparty distribution, seasonal date generation, break clustering by region+desk, exponential aging decay, bimodal match confidence, configurable row counts via --rows, complete Oracle DDL conversion, data_sources elimination, schema_name from --user, and total elapsed timing.

## What Was Done

### Task 1: Rewrite fact generators with realistic distributions
- Added `_build_pareto_weights(n, shape=1.16)` for Pareto counterparty selection (D-06)
- Added `_seasonal_date(rng, anchor, range_days)` with weekday bias (75% weekend rejection), month-end spike, and growth trend (D-07)
- Added `_bimodal_confidence(rng)` with 70% high-cluster gauss(0.92,0.04) + 30% low-cluster gauss(0.25,0.08) (D-10)
- `gen_recon_transactions()` now accepts `target_count` parameter, uses Pareto counterparty weights, seasonal dates for non-edge-case rows
- `gen_recon_breaks()` now accepts `target_count, transaction_data, transaction_ids, aging_bucket_ids, region_ids, desk_ids` -- break clustering weights: APAC sub-regions 2x, FX desks 1.5x, NAM+RATES combo 0.3x (D-08); aging uses exponential decay `exp(-0.5*i)` (D-09)
- `gen_recon_match_events()` now accepts `target_count` -- bimodal confidence for RULE_BASED/AI_ASSISTED, high uniform for MANUAL, NULL for AUTO (D-10)
- `gen_sla_events()` now accepts `target_count` -- expanded from 5 to 8 SLA types (D-04)
- Proportional counts: breaks=20%, matches=80%, SLA=5% of --rows
- **Also in this commit (Rule 3 - blocking):** Renamed `seed-postgres.py` to `seed-oracle.py`, replaced psycopg2 with oracledb, converted all DDL from PostgreSQL to Oracle 19c (SERIAL->IDENTITY, BOOLEAN->NUMBER(1), VARCHAR->VARCHAR2, TIMESTAMPTZ->TIMESTAMP WITH TIME ZONE), rewrote insert_batch to use Oracle executemany, removed dual-write function, rewrote managed seed functions for Oracle bind syntax, rewrote main() with CLI args wiring
- Restored missing `ds-recon-status-by-region` dataset (17th entry lost in cherry-pick merge)
- **Commit:** 91d6285

### Task 2: Wire main(), remove data_sources writes, set schema_name, add total timing
- Removed `seed_curated_dataset_pair()` function entirely (D-11)
- `seed_managed_datasets()` writes ONLY to recviz_datasets (no recviz_data_sources)
- `wipe_managed_tables()` does NOT delete from recviz_data_sources, now includes recviz_connections
- Added `seed_connection(cur, args)` writing schema_name from uppercased --user (D-15)
- main() calls `parse_args()`, derives break/match/SLA counts from --rows
- Total elapsed time printed at summary line
- Cleaned comment/docstring references to recviz_data_sources string
- **Commit:** ab39af7

### Task 3: Dry-run validation at low row count
- `py_compile.compile` succeeds (valid Python)
- `--help` exits 0 with all 6 args displayed
- All generators produce exact row counts at 500 target: 500 txn, 100 breaks, 400 matches, 25 SLA
- Pareto ratio: top 20% counterparties hold 78% of volume at 1K rows
- Bimodal confidence: 212 high (>=0.75) vs 47 low (<0.5) out of 259 scored
- 8 SLA types confirmed: MATCH_WITHIN_4H, BREAK_RESOLVE_24H, DAILY_CLOSE, SETTLEMENT_T2, REGULATORY_REPORT, ESCALATION_RESPONSE, HIGH_VALUE_REVIEW, COUNTERPARTY_CONFIRM
- Only 1 reference to recviz_data_sources remains (comment in wipe_managed_tables)
- No code changes needed -- validation only
- **Commit:** (no changes)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] PostgreSQL-to-Oracle full conversion**
- **Found during:** Task 1
- **Issue:** The source file was `seed-postgres.py` using psycopg2, PostgreSQL DDL (SERIAL, BOOLEAN, TIMESTAMPTZ), and `psycopg2.extras.execute_values`. Plan assumed `seed-oracle.py` with Oracle code already in place.
- **Fix:** Renamed file, replaced psycopg2 with oracledb, converted all DDL to Oracle 19c syntax (GENERATED ALWAYS AS IDENTITY, NUMBER(1), VARCHAR2, TIMESTAMP WITH TIME ZONE), rewrote insert_batch to use Oracle executemany, added Oracle-safe `_drop_table_if_exists` (no IF EXISTS in Oracle 19c), rewrote all managed catalog INSERT statements from %s to :N bind syntax with SYSTIMESTAMP.
- **Files modified:** scripts/seed-oracle.py (renamed from seed-postgres.py)
- **Commit:** 91d6285

**2. [Rule 1 - Bug] Restored missing dataset from cherry-pick**
- **Found during:** Task 1
- **Issue:** Cherry-pick merge with `--strategy-option theirs` lost the `ds-recon-status-by-region` dataset (17th entry). The `assert len(CURATED_DATASETS) == 17` from Plan 01-01 failed with 16 entries.
- **Fix:** Re-extracted the missing dataset from Plan 01-01 commit and added it to CURATED_DATASETS.
- **Files modified:** scripts/seed-oracle.py
- **Commit:** 91d6285

## Verification Results

| Check | Result |
|-------|--------|
| File compiles (py_compile) | PASS |
| --help shows all 6 args | PASS |
| gen_recon_transactions(500) -> 500 rows | PASS |
| gen_recon_breaks(100) -> 100 rows | PASS |
| gen_recon_match_events(400) -> 400 rows | PASS |
| gen_sla_events(25) -> 25 rows | PASS |
| Pareto: top 20% hold 78% volume | PASS |
| Bimodal: high > low confidence | PASS |
| 8 SLA types present | PASS |
| No INSERT INTO recviz_data_sources | PASS |
| No DELETE FROM recviz_data_sources | PASS |
| seed_curated_dataset_pair removed | PASS |
| schema_name set from --user | PASS |
| Total elapsed time in output | PASS |
| 17 CURATED_DATASETS entries | PASS |

## Self-Check: PASSED

- scripts/seed-oracle.py: FOUND
- 01-02-SUMMARY.md: FOUND
- Commit 91d6285 (Task 1): FOUND
- Commit ab39af7 (Task 2): FOUND
