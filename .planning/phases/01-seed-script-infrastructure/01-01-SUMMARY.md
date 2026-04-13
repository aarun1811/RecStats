---
phase: 01-seed-script-infrastructure
plan: 01
subsystem: seed-script
tags: [cli, dimensions, batch-helpers, argparse]
dependency_graph:
  requires: []
  provides: [cli-parsing, enriched-dimensions, timed-batch-helpers, schema-name-helper]
  affects: [scripts/seed-oracle.py]
tech_stack:
  added: [argparse]
  patterns: [3-tier-config-fallback, fernet-env-key-resolution]
key_files:
  created: []
  modified:
    - scripts/seed-oracle.py
decisions:
  - "Use argparse stdlib for CLI parsing (D-03)"
  - "3-tier fallback: CLI arg > env var > hardcoded default (D-02)"
  - "Fernet key reads RECVIZ_ENCRYPTION_KEY env > backend/.env > hardcoded fallback (D-16)"
  - "Weighted tier distribution for counterparties: 35% Tier 1, 45% Tier 2, 20% Tier 3"
metrics:
  duration: 5m 4s
  completed: 2026-04-13
---

# Phase 01 Plan 01: CLI, Dimensions, and Batch Helpers Summary

Argparse CLI with 6 connection/row args, enriched dimension generators meeting SEED-04 minimums (14 regions, 8 engines, 10 statuses, 8 aging buckets, 62 counterparty names), and timed batch insert helpers with 100K progress output.

## What Was Done

### Task 1: Rewrite CLI parsing and connection factory
- Added `parse_args()` with `--rows`, `--host`, `--port`, `--service`, `--user`, `--password`
- Rewrote `_get_connection(args)` with 3-tier fallback: CLI arg > env var > hardcoded default
- Removed localhost-only safety check (RECVIZ_ENV=production guard is sufficient)
- Rewrote `_encrypt_password()` to read key from `RECVIZ_ENCRYPTION_KEY` env var, then `backend/.env`, then hardcoded fallback
- Added `_get_schema_name(args)` helper returning uppercased username
- Preserved `_jb()`, safety guard, all constants (RANDOM_SEED, DATE_ANCHOR, etc.)
- **Commit:** c5d2c91

### Task 2: Enrich dimension generators to SEED-04 minimums
- `gen_regions()`: 10 -> 14 rows (4 top-level + 10 sub-regions, added CA, DE, FR, BR)
- `gen_recon_engines()`: 5 -> 8 rows (added Gresham, Fenergo, Broadridge)
- `gen_statuses()`: 8 -> 10 rows (added AWAITING_DOCS, CANCELLED)
- `gen_aging_buckets()`: 6 -> 8 rows (finer 0D, 1D, 31-60D, 60D+ granularity)
- `gen_counterparties()`: 38 -> 62 unique institution names, 22 countries, weighted tier distribution
- `gen_accounts()`: Added SUSPENSE and COLLATERAL account types (4 -> 6 types)
- `gen_currencies()` and `gen_desks()` unchanged (already exceeded minimums)
- **Commit:** e8d0bf2

### Task 3: Enhance batch insert helpers with timing and progress
- `insert_batch()`: Added time.time() timing, prints row count + elapsed seconds, 100K progress for large tables
- `insert_returning_ids()`: Added timing, prints row count + elapsed seconds
- `insert_returning_ids_batch()`: Added timing, prints row count + elapsed seconds, 100K progress
- **Commit:** 5c103ee

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed CURATED_DATASETS assertion count**
- **Found during:** Task 1
- **Issue:** `assert len(CURATED_DATASETS) == 16` fails because there are actually 17 dataset entries (ds-recon-transaction-detail was the 17th, previously uncounted)
- **Fix:** Updated assertion to `== 17`
- **Files modified:** scripts/seed-oracle.py
- **Commit:** c5d2c91

**2. [Rule 3 - Blocking] Updated fact generator bucket/status weights for new dimension counts**
- **Found during:** Task 2
- **Issue:** `gen_recon_breaks` referenced 6 aging buckets (hardcoded indices 0-5 and 6-element `aging_day_ranges`), but enriched `gen_aging_buckets` now returns 8 buckets. Similarly, `gen_recon_transactions` had 8-status weights but `gen_statuses` now returns 10.
- **Fix:** Extended `bucket_weights` to 8 entries, updated `aging_day_ranges` to match 8 buckets. Extended `status_weights` to 10 entries redistributing probabilities.
- **Files modified:** scripts/seed-oracle.py
- **Commit:** e8d0bf2

## Verification Results

| Check | Result |
|-------|--------|
| `--help` shows all 6 args | PASS |
| 14 regions with hierarchy | PASS |
| 25 desks across 6 asset classes | PASS |
| 30 currencies | PASS |
| 10 statuses (OPEN/CLOSED/PENDING) | PASS |
| 8 aging buckets (OK/WARN/CRIT) | PASS |
| 200 counterparties with 62 names | PASS |
| 8 recon engines | PASS |
| 5000 accounts with 6 types | PASS |
| Batch helpers have timing | PASS |
| Full file syntax valid | PASS |

## Self-Check: PASSED

- scripts/seed-oracle.py: FOUND
- 01-01-SUMMARY.md: FOUND
- Commit c5d2c91 (Task 1): FOUND
- Commit e8d0bf2 (Task 2): FOUND
- Commit 5c103ee (Task 3): FOUND
