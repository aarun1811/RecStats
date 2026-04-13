# Phase 1: Seed Script Infrastructure - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — requirements are specific enough)

<domain>
## Phase Boundary

Rewrite the seed script (`scripts/seed-oracle.py`) to support configurable DB connection and row counts, enrich dimension tables, generate realistic fact data with proper statistical distributions, and eliminate all `recviz_data_sources` writes. The script must remain idempotent (DELETE + INSERT) and print progress.

</domain>

<decisions>
## Implementation Decisions

### CLI Arguments
- **D-01:** `--rows N` controls fact table row count. Default 100000. Named presets: `--rows 100000` (default), `--rows 1000000` (demo), `--rows 5000000` (large demo), `--rows 10000000` (stress test).
- **D-02:** DB connection via `--host`, `--port`, `--service`, `--user`, `--password` CLI args. Falls back to env vars (`ORACLE_HOST`, `ORACLE_PORT`, `ORACLE_SERVICE`, `ORACLE_USER`, `ORACLE_PASSWORD`). Falls back to current hardcoded defaults (`localhost`, `1521`, `FREEPDB1`, `recviz`, `recviz_dev`) as last resort.
- **D-03:** Use `argparse` for CLI parsing — it's stdlib, no new deps.

### Dimension Tables
- **D-04:** Enrich dimensions to these minimums: 8 regions (NAM, EMEA, APAC, LATAM + sub-regions like US, UK, JP, SG, HK, AU, DE, FR), 25+ desks (FX, Rates, Credit, Equity, Commodities with sub-desks), 50+ counterparties (realistic bank/institution names), 12+ currencies (USD, EUR, GBP, JPY, CHF, CAD, AUD, NZD, HKD, SGD, CNY, INR + more), 8+ SLA types, 6+ match types, 6+ aging buckets, 20+ accounts.
- **D-05:** Dimension IDs use the existing UUID-like pattern or short slugs — keep consistent with existing approach.

### Fact Table Distributions
- **D-06:** Counterparty distribution: Pareto (80/20) — top 10 counterparties account for ~80% of transaction volume.
- **D-07:** Volume seasonality: higher volume on weekdays, monthly spikes at month-end, gradual growth trend over the date range.
- **D-08:** Break clustering: certain region+desk combinations have higher break rates (e.g., APAC+FX has 3x the break rate of NAM+Rates).
- **D-09:** Aging: time-decaying distribution — most breaks resolved in 0-3 days, exponential tail for older breaks.
- **D-10:** Match confidence: bimodal — most matches are high-confidence (0.85-0.99) or low-confidence (0.1-0.4), few in the middle.

### recviz_data_sources Elimination
- **D-11:** Remove ALL `INSERT INTO recviz_data_sources` statements from seed script. Remove the `seed_curated_dataset_pair` function or refactor it to only write `recviz_datasets`. Remove `DELETE FROM recviz_data_sources` from the wipe function.
- **D-12:** The `recviz_data_sources` table itself is NOT dropped (no migration change) — it just won't be populated by the seed anymore.

### Progress Output
- **D-13:** Print per-table row counts as they're inserted: `  recon_transactions: 100,000 rows (3.2s)`. Print total time at the end.
- **D-14:** For large row counts (1M+), print progress every 100K rows: `  recon_transactions: 500,000 / 1,000,000 (50%)`.

### Connection Config
- **D-15:** All seeded `recviz_connections` rows get `schema_name` set from the `--user` arg (uppercased, since Oracle schema = username).
- **D-16:** Encryption password for seeded connections uses the same Fernet key as the running backend (read from `.env` or `ENCRYPTION_KEY` env var).

### Claude's Discretion
- Exact dimension data values (counterparty names, desk names, etc.)
- Statistical distribution implementation details (numpy vs pure Python)
- Batch insert sizes for large row counts
- Date range for generated data (suggest 2 years of history)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — SEED-01 through SEED-08
- `.planning/ROADMAP.md` — Phase 1 details, success criteria

### Seed script (primary target)
- `scripts/seed-oracle.py` — Current seed script to rewrite

### Backend (reference for schema + encryption)
- `backend/app/db/models/` — ORM models defining table schemas
- `backend/app/services/encryption.py` — Fernet encryption for passwords
- `backend/app/db/types.py` — OracleJSON type

### Frontend types (reference for config shapes)
- `frontend/src/types/managed-dataset.ts` — RecvizDataset type
- `frontend/src/types/managed-chart.ts` — RecvizChart type
- `frontend/src/types/managed-kpi.ts` — RecvizKpi type

</canonical_refs>

<code_context>
## Existing Code Insights

### Current Seed Script
- `scripts/seed-oracle.py` (~2600 lines): Generates 8 dimension tables, 4 fact tables, 16 curated datasets, 22 charts, 12 KPIs, 5 dashboards
- Uses `oracledb` directly with thick mode
- Hardcoded connection: `localhost:1521/FREEPDB1`, user `recviz`
- Row counts: ~250 per fact table (thin)
- Writes to both `recviz_datasets` AND `recviz_data_sources` (dual-write pattern from Phase 6 discussion)

### Key Patterns to Preserve
- `_jb()` helper for JSON BLOB encoding
- `_encrypt_password()` using Fernet
- `insert_batch()` for chunked inserts
- `drop_recon_schema()` + `create_recon_schema()` for idempotent DDL
- `wipe_managed_tables()` for catalog table cleanup

</code_context>

<specifics>
## Specific Ideas

- The seed script is the ONLY deliverable for Phase 1 — no frontend or backend code changes
- numpy is acceptable as a dev dependency for statistical distributions (not in requirements.txt since it's only used by the seed script)
- Date range: 2 years of history (2024-01-01 to 2025-12-31) gives enough data for seasonal patterns
- The script should work identically whether pointed at Docker Oracle locally or Oracle Cloud

</specifics>

<deferred>
## Deferred Ideas

- Charts, KPIs, and dashboards seeding — Phase 2 and Phase 3
- Performance benchmarking at 10M rows — Phase 3 verification

</deferred>

---

*Phase: 01-seed-script-infrastructure*
*Context gathered: 2026-04-13*
