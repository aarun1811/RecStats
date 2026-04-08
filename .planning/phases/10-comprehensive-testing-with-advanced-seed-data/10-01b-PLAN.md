---
phase: 10-comprehensive-testing-with-advanced-seed-data
plan: 01b
type: execute
wave: 2
depends_on:
  - 10-01a
files_modified:
  - scripts/seed-postgres.py
  - backend/tests/test_seed_script.py
  - frontend/e2e/_dashboard-names.json
autonomous: true
requirements:
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

must_haves:
  truths:
    - "scripts/seed-postgres.py is rewritten end-to-end and produces 100k recon_transactions, ~20k breaks, ~80k match events, ~5k SLA events, 16 curated datasets, 22 curated charts (covering all 18 working chart types), 12 curated KPIs, 5 curated dashboards — NO chart uses vizType in {bullet, box-plot, sunburst} per user correction 2026-04-08"
    - "Every curated dataset in recviz_datasets has a matching recviz_data_sources row with the SAME string id (dual-row A10 guard)"
    - "Every CURATED_DASHBOARDS[*].name uses the 'Phase 10 ·' prefix convention defined in _fixtures.ts DASHBOARD_NAMES (M-3 cross-check)"
    - "The seed script emits frontend/e2e/_dashboard-names.json after seeding so _fixtures.ts can cross-verify name drift"
    - "`chart-txn-trend-area` is placed on dash-volume per Q-3b RESOLVED in RESEARCH.md"
    - "Inverted KPIs (`kpi-total-breaks`, `kpi-avg-aging-days`, `kpi-sla-breach-rate`) have numerically-inverted thresholds with config-level comments explaining the inversion per Q-4 RESOLVED"
    - "All 17 tests in backend/tests/test_seed_script.py pass (no skips), including test_dataset_data_source_pairing (A10 guard) and test_dashboard_names_match_fixtures (M-3 cross-check)"
    - "Running python scripts/seed-postgres.py end-to-end on a fresh docker compose stack populates both recon_data and superset_meta databases with expected row counts"
    - "psql spot-check confirms every managed dataset has a paired data source row (dual-row guard enforced against live DB state)"
  artifacts:
    - path: "scripts/seed-postgres.py"
      provides: "Idempotent end-to-end seed for recon_data schema + 100k facts + curated catalog in managed tables"
      contains: "recon_transactions"
    - path: "frontend/e2e/_dashboard-names.json"
      provides: "Seed-generated snapshot of dashboard names for M-3 cross-check"
      contains: "dash-sla"
    - path: "backend/tests/test_seed_script.py"
      provides: "17 implemented tests (no skips) including A10 pairing guard and M-3 name cross-check"
      contains: "test_dataset_data_source_pairing"
  key_links:
    - from: "scripts/seed-postgres.py"
      to: "recviz_datasets + recviz_data_sources"
      via: "paired INSERT with same string id"
      pattern: "INSERT INTO recviz_data_sources"
    - from: "scripts/seed-postgres.py CURATED_DASHBOARDS[*].name"
      to: "frontend/e2e/_fixtures.ts DASHBOARD_NAMES"
      via: "seed emits _dashboard-names.json; test_dashboard_names_match_fixtures asserts equality"
      pattern: "Phase 10 ·"
    - from: "backend/tests/test_seed_script.py"
      to: "scripts/seed-postgres.py"
      via: "module import + generator function calls"
      pattern: "from scripts|_load_seed_module"

user_setup: []
---

<objective>
Plan 10-01b is the seed script rewrite — the load-bearing task of Phase 10. It takes an isolated plan so its sole task (Task 3: rewrite `scripts/seed-postgres.py`) can spend the full context budget on getting the seed right.

Two tasks:
1. **Task 3 (from original 10-01) — Rewrite scripts/seed-postgres.py:** schema DDL + 100k facts + 16 datasets + **22 charts** + 12 KPIs + 5 dashboards. Must use the dual-row pairing pattern for every managed dataset. Must emit `frontend/e2e/_dashboard-names.json` after seeding for M-3 cross-check. Must place `chart-txn-trend-area` on dash-volume per Q-3b RESOLVED. Must use numerically-inverted thresholds for the 3 inverted KPIs per Q-4 RESOLVED. **MUST NOT include any chart with `vizType` in `{'bullet', 'box-plot', 'sunburst'}` — user correction 2026-04-08 removes these from the working set (fall back to bar / need hierarchical transform).**
2. **Task 4 (from original 10-01) — Run the seed + implement test_seed_script.py assertions:** unskip every test, run against live Postgres, verify row counts, A10 pairing guard, AND the new `test_no_excluded_chart_types_in_catalog` test that asserts no chart in CURATED_CHARTS has vizType in the excluded set.

Purpose: Produce the canonical test bed (both the schema + facts + curated catalog) so Plan 10-01c can rewrite E2E specs against stable slugs and Plan 10-02 can run the autonomous walkthrough. The seed is the Phase 10 linchpin.

Output: A running seed script, a populated database, a fully-passing test_seed_script.py, and a dashboard name snapshot file that cross-checks against _fixtures.ts.
</objective>

<execution_context>
@/Users/aarun/Workspace/Projects/RecViz/.claude/get-shit-done/workflows/execute-plan.md
@/Users/aarun/Workspace/Projects/RecViz/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-CONTEXT.md
@.planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-RESEARCH.md
@.planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-VALIDATION.md
@.planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-01a-SUMMARY.md
@.planning/codebase/STACK.md
@CLAUDE.md

<interfaces>
<!-- Key types and contracts the executor needs — extracted verbatim. -->

From backend/app/db/models/dataset.py (RecvizDataset → recviz_datasets):
```python
class RecvizDataset(Base):
    __tablename__ = "recviz_datasets"
    id: Mapped[str]               # STRING id (stable slug)
    name: Mapped[str]
    description: Mapped[str | None]
    database_id: Mapped[int]
    superset_id: Mapped[int | None]  # seed sets NULL
    sql: Mapped[str]
    columns: Mapped[dict]          # JSONB
    sync_status: Mapped[str]       # "synced" | "error" | "pending"
    schema_version: Mapped[int]
    created_at, updated_at: Mapped[datetime]
```

From backend/app/db/models/data_source.py (RecvizDataSource → recviz_data_sources):
```python
class RecvizDataSource(Base):
    __tablename__ = "recviz_data_sources"
    id: Mapped[str]               # MUST MATCH the paired RecvizDataset id
    name: Mapped[str]
    schema_version: Mapped[int]
    config: Mapped[dict]          # JSONB: {id, name, database_routing, query (with {{filters}}), filter_mappings, columns}
```

From backend/app/db/models/chart.py (RecvizChart → recviz_charts):
```python
class RecvizChart(Base):
    __tablename__ = "recviz_charts"
    id: Mapped[str]
    name: Mapped[str]
    description: Mapped[str | None]
    dataset_id: Mapped[str]
    chart_type: Mapped[str]
    config: Mapped[dict]           # {columnMapping, appearance}
    schema_version: Mapped[int]
    created_at, updated_at: Mapped[datetime]
```

From backend/app/db/models/kpi.py (RecvizKpi → recviz_kpis):
```python
class RecvizKpi(Base):
    __tablename__ = "recviz_kpis"
    id: Mapped[str]
    name: Mapped[str]
    description: Mapped[str | None]
    dataset_id: Mapped[str]
    config: Mapped[dict]           # {metricColumn, aggregation, format, trend, thresholds}
    schema_version: Mapped[int]
```

From backend/app/db/models/dashboard.py (RecvizDashboard → recviz_dashboards):
```python
class RecvizDashboard(Base):
    __tablename__ = "recviz_dashboards"
    id: Mapped[str]
    name: Mapped[str]               # 'Phase 10 · {Title}' (M-3 convention pinned in _fixtures.ts DASHBOARD_NAMES)
    description: Mapped[str | None]
    config: Mapped[dict]           # DashboardConfig JSONB
    schema_version: Mapped[int]
```

Chart factory declared types (frontend/src/components/charts/chart-factory.tsx):
```typescript
export const SUPPORTED_AG_TYPES = new Set([
  'bar', 'stacked-bar', 'line', 'area', 'pie', 'donut', 'scatter',
  'heatmap', 'treemap', 'waterfall', 'combo', 'histogram', 'bullet', 'box-plot'
])
export const ECHART_TYPES = new Set([
  'sankey', 'radar', 'sunburst', 'gauge', 'funnel', 'graph', 'parallel'
])
```

**ONLY 18 of these render their declared type** (user correction 2026-04-08 during D-03 approval gate). The seed's CURATED_CHARTS map uses these 18 working types only:

- **AG working (12):** `bar`, `stacked-bar`, `line`, `area`, `pie`, `donut`, `scatter`, `heatmap`, `treemap`, `waterfall`, `combo`, `histogram`
- **ECharts working (6):** `sankey`, `radar`, `gauge`, `funnel`, `graph`, `parallel`
- **Excluded (3) — NOT in CURATED_CHARTS:** `bullet` (falls back to bar per `ag-chart-wrapper.tsx:179-187`), `box-plot` (falls back to bar per `ag-chart-wrapper.tsx:189-197`), `sunburst` (needs hierarchical data transform not wired). No seed entry, no dashboard reference.

The seed MUST NOT create any chart with `vizType` set to `'bullet'`, `'box-plot'`, or `'sunburst'`. The catalog count is **22 charts (not 24)** covering all 18 working types. The 5 dashboards reference only these 22 charts. If any `CURATED_DASHBOARDS[*].config.charts[*].chartId` references an excluded chart, the seed must fail with a clear error during initialization — see Task 4 `test_no_excluded_chart_types_in_catalog`.

Dual-row seed helper (Pattern 1 — THE A10 guard):
```python
def seed_curated_dataset_pair(cur, dataset_id, name, description, database_id, database_name, sql_template, managed_sql, columns, filter_mappings):
    cur.execute(
        "INSERT INTO recviz_datasets (id, name, description, database_id, superset_id, sql, columns, sync_status, schema_version, created_at, updated_at) "
        "VALUES (%s, %s, %s, %s, NULL, %s, %s::jsonb, 'synced', 1, NOW(), NOW())",
        (dataset_id, name, description, database_id, managed_sql, json.dumps(columns))
    )
    ds_config = {
        "id": dataset_id,              # SAME ID — A10 guard
        "name": name,
        "database_routing": {"type": "static", "database": database_name},
        "query": sql_template,
        "filter_mappings": filter_mappings,
        "columns": [{"name": c["name"], "type": c["data_type"]} for c in columns],
    }
    cur.execute(
        "INSERT INTO recviz_data_sources (id, name, schema_version, config) "
        "VALUES (%s, %s, 1, %s::jsonb)",
        (dataset_id, name, json.dumps(ds_config))
    )
```

KPI threshold semantics (per Q-4 RESOLVED in RESEARCH.md §Open Questions):
- The renderer at `frontend/src/lib/kpi-utils.ts:5-13` uses literal "higher = better" semantics.
- For inverted KPIs (`kpi-total-breaks`, `kpi-avg-aging-days`, `kpi-sla-breach-rate`), set numerically-inverted thresholds.
- Example for `kpi-total-breaks` (seeded value ~20000, want visual RED):
  - `green_above = 50000`, `amber_above = 30000` → value 20000 < 30000 → RED
  - Add config comment: `"_comment": "Lower is better for this metric. Numerically inverted thresholds: green = room above 50k, amber = room above 30k, red = below 30k. Seeded value ~20k lands in red band."`
- Example for `kpi-avg-aging-days` (seeded value ~4.5, want visual AMBER):
  - `green_above = 7`, `amber_above = 4` → value 4.5 ≥ 4 → AMBER
- Example for `kpi-sla-breach-rate` (seeded value ~8%, want visual AMBER):
  - `green_above = 12`, `amber_above = 6` → value 8 ≥ 6 → AMBER

`chart-txn-trend-area` placement (per Q-3b RESOLVED):
- D4 dash-volume chart list expands from 6 to 7: [treemap 12c, (region-bar 6c + currency-pie 6c), (counterparty-bar 6c + scatter 6c), (**chart-txn-trend-area 6c** + placeholder or merge), parallel 12c]. Grid math: 12 + 12 + 12 + 12 + 12 = 5 rows, 60 grid units total. Layout is authoritative in the seed (Section 7 CURATED_DASHBOARDS D4 entry).
</interfaces>
</context>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Developer machine → PostgreSQL (localhost:5432) | Seed script writes DDL + 100k rows |
| Seed script → recviz_datasets / recviz_data_sources tables | Data that drives the runtime dashboard renderer |
| Seed script → frontend/e2e/_dashboard-names.json | Generated cross-check artifact written after seeding |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10b-01 | Tampering (T) | Seed script accidentally destroying production data | mitigate | Hardcode RECON_DB_URL / RECVIZ_DB_URL to localhost; script aborts with sys.exit(1) if host not in {"localhost", "127.0.0.1"}; refuses if `RECVIZ_ENV=production`. Guards in first 30 lines before any SQL. |
| T-10b-02 | Tampering (T) | SQL injection via string interpolation | mitigate | psycopg2 `%s` parameterization for every user-data field. Only DDL uses static strings. Unit test `test_no_f_string_sql_with_data` greps the file. |
| T-10b-03 | Information disclosure (I) | Fabricated PII in counterparties | mitigate | Counterparty names are synthetic short-names ("GS Intl", "JPMC", "DB Global"). LEIs are random 20-char strings, not real LEIs. No real PII. |
| T-10b-04 | Denial of Service (D) | Batch INSERT memory blowup at 100k rows | accept | psycopg2 execute_values in 5k-10k batches keeps memory bounded (~200MB worst case). |

All high-rated threats have mitigations.
</threat_model>

<tasks>

<task type="auto">
  <name>Task 3: Rewrite scripts/seed-postgres.py with schema DDL + 100k facts + curated catalog</name>
  <files>scripts/seed-postgres.py, frontend/e2e/_dashboard-names.json</files>
  <read_first>
    - scripts/seed-postgres.py (CURRENT file — use its structure as template: psycopg2.connect pattern, drop → create → insert, random.seed(42), two-DB connection, batch executemany)
    - .planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-RESEARCH.md §1 (FULL schema DDL — every CREATE TABLE and index)
    - .planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-RESEARCH.md §2.1 (all 16 datasets)
    - .planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-RESEARCH.md §2.2 (all 22 charts — user correction 2026-04-08: bullet, box-plot, sunburst EXCLUDED)
    - .planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-RESEARCH.md §2.3 (all 12 KPIs) — pay CLOSE ATTENTION to Q-4 RESOLVED for inverted KPI thresholds
    - .planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-RESEARCH.md §2.4 (all 5 dashboard configs) — D4 dash-volume must include chart-txn-trend-area per Q-3b RESOLVED (new 7-chart layout)
    - .planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-RESEARCH.md §Open Questions RESOLVED (all 6 questions now have concrete answers)
    - .planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-RESEARCH.md §Architecture Pattern 1 (dual-row seed function — use verbatim)
    - frontend/e2e/_fixtures.ts (from Plan 10-01a — DASHBOARD_NAMES is the canonical source for dashboard name strings; the seed mirrors these)
    - backend/app/db/models/{dataset,data_source,chart,kpi,dashboard}.py (SQLAlchemy models)
    - backend/app/models/managed_{dataset,chart,kpi}.py (Pydantic DTOs for JSONB shapes)
    - backend/app/models/dashboard_config.py (DashboardConfig — camelCase field names)
  </read_first>
  <action>
**Rewrite scripts/seed-postgres.py completely.** Structure in this exact order:

1. **Header + safety guards (first 30 lines):**
   ```python
   """Phase 10 seed script — clean-slate advanced seed for RecViz testing.

   Rewrites recon_data schema + inserts 100k fact rows + seeds the curated
   Phase 10 catalog (16 datasets, 22 charts, 12 KPIs, 5 dashboards) into
   the managed tables. Idempotent — drop-and-recreate on every run.
   NOTE: 22 charts covers all 18 WORKING chart types. bullet, box-plot,
   sunburst are declared but fall back to bar / need hierarchical transform —
   excluded from the curated catalog per user correction 2026-04-08.

   SAFETY: Hard-coded to localhost. Refuses to run against non-localhost
   databases. Refuses if RECVIZ_ENV=production.
   """
   import json
   import os
   import pathlib
   import random
   import sys
   from datetime import datetime, timedelta, timezone
   from urllib.parse import urlparse

   import psycopg2
   import psycopg2.extras

   RECON_DB_URL = "postgresql://postgres:postgres@localhost:5432/recon_data"
   RECVIZ_DB_URL = "postgresql://postgres:postgres@localhost:5432/superset_meta"

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

   REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
   DASHBOARD_NAMES_SNAPSHOT = REPO_ROOT / "frontend" / "e2e" / "_dashboard-names.json"
   ```

2. **Schema DDL (Section 1 — drops + creates):** Function `drop_recon_schema(cur)` running `DROP TABLE IF EXISTS recon_transactions, recon_breaks, recon_match_events, sla_events, accounts, counterparties, desks, currencies, statuses, aging_buckets, regions, recon_engines CASCADE;` plus legacy table drops. Function `create_recon_schema(cur)` running every CREATE TABLE + index from RESEARCH.md §1.2 and §1.3 verbatim.

3. **Dimension generators (Section 2 — pure Python, no DB):** Top-level functions:
   - `gen_recon_engines() -> list[tuple]` — 5 rows
   - `gen_regions() -> list[tuple]` — 10 rows
   - `gen_desks(region_ids)` — 25 rows
   - `gen_currencies()` — 30 rows
   - `gen_statuses()` — 8 rows
   - `gen_aging_buckets()` — 6 rows
   - `gen_counterparties(rng)` — 200 rows
   - `gen_accounts(rng, region_ids, currency_ids)` — 5000 rows

   All take a pre-seeded `random.Random(RANDOM_SEED)` — NO module-level `random.seed()`.

4. **Fact generators (Section 3):**
   - `gen_recon_transactions(rng, engine_ids, account_ids, desk_ids, region_ids, currency_ids, status_ids, counterparty_ids) -> list[tuple]` — EXACTLY 100000 rows. Includes:
     - 100k unique external_ref (`f"TXN-{i:08d}"`)
     - ~5% counterparty_id = NULL
     - ~15% fee = NULL
     - fx_rate = NULL when currency = USD
     - ~140 rows with trade_date = 2024-02-29
     - ~50 rows between 2024-03-10 06:00-07:00 UTC
     - ~20 rows on 2024-12-31 23:55 UTC and ~20 on 2025-01-01 00:05 UTC
     - ~10% negative amounts
     - log-normal amount_usd distribution, mean ~$50k, capped at $10M
   - `gen_recon_breaks(rng, transaction_rows)` — ~20000 rows. 60/15/10/10/5 distribution. ~40% open. Seeded values: total ~20000 breaks (the "inverted" KPI value that must land RED via inverted thresholds per Q-4 RESOLVED).
   - `gen_recon_match_events(rng, transaction_rows, break_rows)` — ~80000 rows. 65/20/10/5.
   - `gen_sla_events(rng, transaction_rows, break_rows, region_ids)` — ~5000 rows. ~8% breach rate (per Q-4 RESOLVED, inverted amber).

5. **Batch insert helper (Section 4):**
   ```python
   def insert_batch(cur, table, columns, rows, batch_size=5000):
       sql = f"INSERT INTO {table} ({','.join(columns)}) VALUES %s"
       for i in range(0, len(rows), batch_size):
           psycopg2.extras.execute_values(cur, sql, rows[i:i+batch_size])
           print(f"  {table}: inserted {min(i+batch_size, len(rows))}/{len(rows)}")
   ```
   Uses `execute_values` (faster than executemany) but stays parameterized.

6. **Dual-row dataset pairing helper (Section 5 — A10 guard):** Paste `seed_curated_dataset_pair` verbatim from <interfaces> block.

7. **Curated catalog data (Section 6 — top-level constants):**
   - `CURATED_DATASETS: list[dict]` — the 16 dicts from §2.1, each with: id, name, description, database_id (use 1 — superset_db_reconmgmt), database_name ("superset_db_reconmgmt"), sql_template, managed_sql, columns (metadata dicts), filter_mappings
   - `CURATED_CHARTS: list[dict]` — the **22 dicts from §2.2** (user correction 2026-04-08 removed `chart-breaks-bullet` and `chart-aging-boxplot`), each with: id, name, description, dataset_id, chart_type, config (columnMapping + appearance). **NO chart may use `chart_type` in `{'bullet', 'box-plot', 'sunburst'}` — see `EXCLUDED_CHART_TYPES` guard below.**

   Add a top-level guard constant:
   ```python
   EXCLUDED_CHART_TYPES = frozenset({"bullet", "box-plot", "sunburst"})
   ```
   And in `seed_managed_charts(cur)`, before insertion:
   ```python
   for chart in CURATED_CHARTS:
       if chart["chart_type"] in EXCLUDED_CHART_TYPES:
           raise ValueError(
               f"Seed config error: chart {chart['id']} uses excluded type "
               f"{chart['chart_type']!r} — see Plan 10-01b interfaces + Q-3 RESOLVED"
           )
   ```
   - `CURATED_KPIS: list[dict]` — the 12 dicts from §2.3. **CRITICAL per Q-4 RESOLVED:** For `kpi-total-breaks`, `kpi-avg-aging-days`, `kpi-sla-breach-rate`, use numerically-inverted thresholds and include a `_comment` field explaining the inversion. Exact values documented in <interfaces> block above.
   - `CURATED_DASHBOARDS: list[dict]` — the 5 dicts from §2.4. **CRITICAL per M-3:** each `name` field MUST use the 'Phase 10 ·' prefix matching the DASHBOARD_NAMES constant in `frontend/e2e/_fixtures.ts`. Exact names: `Phase 10 · SLA Overview`, `Phase 10 · Aging Analysis`, `Phase 10 · Match Rate Tracker`, `Phase 10 · Volume Dashboard`, `Phase 10 · Breaks Summary`.
   - **CRITICAL per Q-3b RESOLVED:** The dash-volume (D4) entry MUST include `chart-txn-trend-area` as its 7th chart. Authoritative grid layout (5 rows, 60 grid units total):
     - Row 1: chart-volume-desk-treemap (12c, cross-filter source)
     - Row 2: chart-txn-by-region-bar (6c, cross-filter source) + chart-currency-pie (6c)
     - Row 3: chart-counterparty-top-bar (6c) + chart-txn-scatter (6c)
     - Row 4: chart-txn-trend-area (6c) + [empty-6c or placeholder]
     - Row 5: chart-txn-parallel (12c)
   - Dashboard config JSONB shape must match `DashboardConfig` Pydantic model (camelCase: `crossFilter`, `drillDown`, `chartId`, `sourceType`, `drillHierarchy`, `drillDetailDataSourceId`).

8. **Managed-table seeding functions (Section 7):**
   - `wipe_managed_tables(cur)` — DELETE in dependency order: dashboards → charts → kpis → datasets → data_sources
   - `seed_managed_datasets(cur)` — iterates CURATED_DATASETS, calls `seed_curated_dataset_pair` for each (dual-row pattern)
   - `seed_managed_charts(cur)` — iterates CURATED_CHARTS
   - `seed_managed_kpis(cur)` — iterates CURATED_KPIS
   - `seed_managed_dashboards(cur)` — iterates CURATED_DASHBOARDS

9. **Dashboard names snapshot writer (Section 7b — M-3 cross-check):**
   ```python
   def write_dashboard_names_snapshot() -> None:
       """Write frontend/e2e/_dashboard-names.json from CURATED_DASHBOARDS for M-3 cross-check."""
       snapshot = {d["id"]: d["name"] for d in CURATED_DASHBOARDS}
       DASHBOARD_NAMES_SNAPSHOT.parent.mkdir(parents=True, exist_ok=True)
       DASHBOARD_NAMES_SNAPSHOT.write_text(json.dumps(snapshot, indent=2) + "\n")
       print(f"  Wrote dashboard names snapshot: {DASHBOARD_NAMES_SNAPSHOT}")
   ```

10. **Main (Section 8):**
    ```python
    def main() -> None:
        print("Phase 10 seed script — clean-slate rebuild")
        rng = random.Random(RANDOM_SEED)

        with psycopg2.connect(RECON_DB_URL) as recon_conn:
            recon_conn.autocommit = False
            with recon_conn.cursor() as cur:
                print("\n=== recon_data: drop + create schema ===")
                drop_recon_schema(cur)
                create_recon_schema(cur)
                print("\n=== recon_data: dimensions ===")
                # ... insert all 8 dimensions
                print("\n=== recon_data: facts (100k) ===")
                # ... insert all 4 fact tables
            recon_conn.commit()

        with psycopg2.connect(RECVIZ_DB_URL) as recviz_conn:
            recviz_conn.autocommit = False
            with recviz_conn.cursor() as cur:
                print("\n=== superset_meta: wipe + seed managed catalog ===")
                wipe_managed_tables(cur)
                seed_managed_datasets(cur)
                seed_managed_charts(cur)
                seed_managed_kpis(cur)
                seed_managed_dashboards(cur)
            recviz_conn.commit()

        write_dashboard_names_snapshot()
        print("\nSeed complete.")

    if __name__ == "__main__":
        main()
    ```

**Critical:** Every data value that flows through a variable MUST use `%s` parameterization or `execute_values` — NEVER f-string concatenation. DDL may use static strings.
  </action>
  <verify>
    <automated>cd /Users/aarun/Workspace/Projects/RecViz && python -c "import importlib.util, pathlib; spec = importlib.util.spec_from_file_location('seed', pathlib.Path('scripts/seed-postgres.py')); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); assert len(m.CURATED_DATASETS) == 16, f'expected 16 datasets, got {len(m.CURATED_DATASETS)}'; assert len(m.CURATED_CHARTS) == 24; assert len(m.CURATED_KPIS) == 12; assert len(m.CURATED_DASHBOARDS) == 5; import random; rng = random.Random(42); assert len(m.gen_recon_engines()) == 5; names = {d['id']: d['name'] for d in m.CURATED_DASHBOARDS}; assert all(n.startswith('Phase 10 ·') for n in names.values()), f'dashboard names missing prefix: {names}'; dash_volume_charts = [c.get('chartId') for c in next(d for d in m.CURATED_DASHBOARDS if d['id'] == 'dash-volume')['config']['charts']]; assert 'chart-txn-trend-area' in dash_volume_charts, f'chart-txn-trend-area not on dash-volume: {dash_volume_charts}'; print('seed module smoke OK')"</automated>
  </verify>
  <done>
scripts/seed-postgres.py imports cleanly, all CURATED_* constants have correct counts (16/24/12/5), all dashboard names begin with `Phase 10 ·`, chart-txn-trend-area is placed on dash-volume, dimension generators return correct counts. DDL contains all 4 fact table names. Dual-row pattern function exists. Safety guards pass on localhost.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Run seed + implement test_seed_script.py assertions (A10 guard + M-3 cross-check + row counts + edge cases)</name>
  <files>backend/tests/test_seed_script.py (implement), scripts/seed-postgres.py (tweaks if needed), frontend/e2e/_dashboard-names.json (seed-generated)</files>
  <read_first>
    - scripts/seed-postgres.py (the file from Task 3)
    - backend/tests/test_seed_script.py (the scaffold from Plan 10-01a Task 1)
    - .planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-VALIDATION.md lines 85-101 (exact test list)
    - .planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-RESEARCH.md §A10 Assumption (dual-row rationale)
    - frontend/e2e/_fixtures.ts (DASHBOARD_NAMES — M-3 cross-check source)
  </read_first>
  <behavior>
    - test_recon_transactions_row_count_is_100k: len == 100000
    - test_recon_breaks_row_count_in_range: 19000 <= len <= 21000
    - test_recon_match_events_row_count_in_range: 76000 <= len <= 84000
    - test_sla_events_row_count_in_range: 4750 <= len <= 5250
    - test_dimension_table_cardinalities: engines=5, regions=10, desks=25, currencies=30, statuses=8, aging_buckets=6, counterparties=200, accounts=5000
    - test_high_cardinality_dimension_has_10k_plus_uniques: unique external_ref >= 10000
    - test_nulls_present_in_measure_columns: fee=None and fx_rate=None present
    - test_nulls_present_in_dimension_columns: counterparty_id=None present
    - test_date_range_spans_two_years: max(trade_date) - min(trade_date) >= 730 days
    - test_leap_day_record_present: trade_date == date(2024,2,29) present
    - test_dst_record_present: rows in 2024-03-10 06:00-07:00 UTC present
    - test_year_boundary_records_present: rows on 2024-12-31 and 2025-01-01 present
    - test_dataset_data_source_pairing (A10 guard): every CURATED_CHART.dataset_id, CURATED_KPI.dataset_id, and dashboard drillDetailDataSourceId resolves to a CURATED_DATASETS id
    - test_kpi_thresholds_seed_into_correct_bands: for inverted KPIs, seeded values land in the intended band (kpi-total-breaks RED, kpi-avg-aging-days AMBER, kpi-sla-breach-rate AMBER)
    - test_seed_is_deterministic: gen_recon_transactions twice with Random(42) → byte-identical
    - test_no_f_string_sql_with_data: no f-string INSERT with non-whitelisted placeholders (whitelist `{table}`, `{columns}`)
    - test_dashboard_names_match_fixtures (M-3 cross-check): parse frontend/e2e/_fixtures.ts DASHBOARD_NAMES via regex, compare against CURATED_DASHBOARDS name values — must be byte-identical
  </behavior>
  <action>
**Step 1 — Implement every test function in backend/tests/test_seed_script.py.** Remove `@pytest.mark.skip` decorators and write assertion bodies. Use generators via `_load_seed_module()`. Do NOT connect to a real database for these tests — they're pure-Python and hermetic.

For the A10 guard (`test_dataset_data_source_pairing`):
```python
def test_dataset_data_source_pairing():
    m = _load_seed_module()
    dataset_ids = {ds["id"] for ds in m.CURATED_DATASETS}
    assert len(dataset_ids) == 16, f"expected 16 unique dataset ids, got {len(dataset_ids)}"
    for chart in m.CURATED_CHARTS:
        assert chart["dataset_id"] in dataset_ids, f"chart {chart['id']} references unknown dataset {chart['dataset_id']}"
    for kpi in m.CURATED_KPIS:
        assert kpi["dataset_id"] in dataset_ids, f"kpi {kpi['id']} references unknown dataset {kpi['dataset_id']}"
    for dash in m.CURATED_DASHBOARDS:
        for chart_ref in dash["config"].get("charts", []):
            for source in chart_ref.get("sources", []):
                ds_id = source.get("dataSourceId") or source.get("data_source_id")
                if ds_id:
                    assert ds_id in dataset_ids, f"dashboard {dash['id']} chart {chart_ref.get('chartId')} references unknown dataSourceId {ds_id}"
            drill_detail_id = chart_ref.get("drillDetailDataSourceId") or chart_ref.get("drill_detail_data_source_id")
            if drill_detail_id:
                assert drill_detail_id in dataset_ids, f"dashboard {dash['id']} chart {chart_ref.get('chartId')} references unknown drillDetailDataSourceId {drill_detail_id}"
```

For the M-3 cross-check (`test_dashboard_names_match_fixtures`):
```python
import re

def test_dashboard_names_match_fixtures():
    """M-3: seed-generated dashboard names must match the canonical DASHBOARD_NAMES in _fixtures.ts."""
    m = _load_seed_module()
    fixtures_src = _FIXTURES_PATH.read_text()
    # Parse: 'dash-sla': 'Phase 10 · SLA Overview',
    pattern = re.compile(r"'(dash-[a-z-]+)':\s*'([^']+)'")
    fixture_names = dict(pattern.findall(fixtures_src))
    seed_names = {d["id"]: d["name"] for d in m.CURATED_DASHBOARDS}
    assert fixture_names == seed_names, (
        f"dashboard name drift between seed and fixtures:\n"
        f"  fixtures: {sorted(fixture_names.items())}\n"
        f"  seed:     {sorted(seed_names.items())}"
    )
```

For excluded chart types guard (`test_no_excluded_chart_types_in_catalog` — user correction 2026-04-08):
```python
def test_no_excluded_chart_types_in_catalog():
    """Bullet, box-plot, and sunburst fall back to bar / need hierarchical
    data transforms — none of them render their declared type. User explicitly
    excluded them during the D-03 approval gate. The seed must refuse them."""
    m = _load_seed_module()
    EXCLUDED = {"bullet", "box-plot", "sunburst"}
    violations = [
        (c["id"], c["chart_type"]) for c in m.CURATED_CHARTS
        if c["chart_type"] in EXCLUDED
    ]
    assert not violations, f"Excluded chart types found in CURATED_CHARTS: {violations}"
    # Also assert the catalog stays at 22 charts (the working set)
    assert len(m.CURATED_CHARTS) == 22, (
        f"Expected 22 charts in CURATED_CHARTS (all 18 working types covered), "
        f"got {len(m.CURATED_CHARTS)}"
    )
    # Sanity: every working chart type appears at least once
    WORKING_TYPES = {
        # AG (12)
        "bar", "stacked-bar", "line", "area", "pie", "donut",
        "scatter", "heatmap", "treemap", "waterfall", "combo", "histogram",
        # ECharts (6)
        "sankey", "radar", "gauge", "funnel", "graph", "parallel",
    }
    catalog_types = {c["chart_type"] for c in m.CURATED_CHARTS}
    missing = WORKING_TYPES - catalog_types
    assert not missing, f"Working chart types missing from CURATED_CHARTS: {missing}"
```

For inverted threshold verification (`test_kpi_thresholds_seed_into_correct_bands`):
```python
def test_kpi_thresholds_seed_into_correct_bands():
    m = _load_seed_module()
    kpis_by_id = {k["id"]: k for k in m.CURATED_KPIS}
    # Inverted KPIs per Q-4 RESOLVED — seeded values must land in correct visual bands.
    # Values below amber_above → red; between amber_above and green_above → amber; above green_above → green
    tbr = kpis_by_id["kpi-total-breaks"]
    assert tbr["config"]["thresholds"]["greenAbove"] == 50000
    assert tbr["config"]["thresholds"]["amberAbove"] == 30000
    # seeded value ~20000 < 30000 → red (visually "too many breaks")
    aad = kpis_by_id["kpi-avg-aging-days"]
    assert aad["config"]["thresholds"]["greenAbove"] == 7
    assert aad["config"]["thresholds"]["amberAbove"] == 4
    # seeded value ~4.5 → amber
    sbr = kpis_by_id["kpi-sla-breach-rate"]
    assert sbr["config"]["thresholds"]["greenAbove"] == 12
    assert sbr["config"]["thresholds"]["amberAbove"] == 6
    # seeded value ~8 → amber
```

**Step 2 — Run the tests (scaffold stage, before seed run):**
```
cd backend && python -m pytest tests/test_seed_script.py -v
```
All pure-Python tests (NOT test_dashboard_names_match_fixtures, which needs the seed to have run) must pass. The M-3 cross-check test initially runs against the _fixtures.ts file — which already exists from Plan 10-01a — and directly compares against the seed module's CURATED_DASHBOARDS, so it can actually pass WITHOUT running the seed. Confirm.

**Step 3 — Run the actual seed against localhost PostgreSQL:**
```
cd /Users/aarun/Workspace/Projects/RecViz
docker compose down -v
docker compose up -d
sleep 10
python scripts/seed-postgres.py
```
Expected: progress messages per dimension/fact, then `Wrote dashboard names snapshot: frontend/e2e/_dashboard-names.json`, then `Seed complete.` in 30-60 seconds.

**Step 4 — Verify seed landed in Postgres:**
```
docker compose exec -T postgres psql -U postgres -d recon_data -c "SELECT COUNT(*) FROM recon_transactions;"
# expected: 100000
docker compose exec -T postgres psql -U postgres -d recon_data -c "SELECT COUNT(DISTINCT external_ref) FROM recon_transactions;"
# expected: 100000
docker compose exec -T postgres psql -U postgres -d recon_data -c "SELECT COUNT(*) FROM recon_breaks;"
docker compose exec -T postgres psql -U postgres -d recon_data -c "SELECT COUNT(*) FROM recon_match_events;"
docker compose exec -T postgres psql -U postgres -d recon_data -c "SELECT COUNT(*) FROM sla_events;"
```

And against superset_meta:
```
docker compose exec -T postgres psql -U postgres -d superset_meta -c "SELECT COUNT(*) FROM recviz_datasets;"
# expected: 16
docker compose exec -T postgres psql -U postgres -d superset_meta -c "SELECT COUNT(*) FROM recviz_data_sources;"
# expected: 16
docker compose exec -T postgres psql -U postgres -d superset_meta -c "SELECT COUNT(*) FROM recviz_charts;"
# expected: 24
docker compose exec -T postgres psql -U postgres -d superset_meta -c "SELECT COUNT(*) FROM recviz_kpis;"
# expected: 12
docker compose exec -T postgres psql -U postgres -d superset_meta -c "SELECT COUNT(*) FROM recviz_dashboards;"
# expected: 5
docker compose exec -T postgres psql -U postgres -d superset_meta -c "SELECT d.id AS dataset_id, ds.id AS data_source_id FROM recviz_datasets d LEFT JOIN recviz_data_sources ds ON d.id = ds.id WHERE ds.id IS NULL;"
# expected: zero rows (A10 guard against live DB state)
docker compose exec -T postgres psql -U postgres -d superset_meta -c "SELECT id, name FROM recviz_dashboards ORDER BY id;"
# expected: all 5 names begin with 'Phase 10 ·'
```

**Step 5 — Confirm _dashboard-names.json was written:**
```
test -f frontend/e2e/_dashboard-names.json && cat frontend/e2e/_dashboard-names.json
```

**Step 6 — Mock-audit sanity check:**
```
bash scripts/mock-audit.sh
```
Still exits 0.
  </action>
  <verify>
    <automated>cd /Users/aarun/Workspace/Projects/RecViz/backend && python -m pytest tests/test_seed_script.py -v && cd /Users/aarun/Workspace/Projects/RecViz && bash scripts/mock-audit.sh && test -f frontend/e2e/_dashboard-names.json</automated>
  </verify>
  <done>
All 17 tests in test_seed_script.py pass (no skips). The real seed runs against localhost Postgres without errors, row counts match, A10 pairing check returns zero missing rows, `frontend/e2e/_dashboard-names.json` is written. mock-audit.sh still exits 0.
  </done>
</task>

</tasks>

<verification>
Plan 10-01b is complete when:

1. scripts/seed-postgres.py rewritten end-to-end, imports cleanly, has all CURATED_* constants with correct counts
2. Dashboard names use 'Phase 10 ·' prefix convention (M-3)
3. chart-txn-trend-area is placed on dash-volume (Q-3b)
4. Inverted KPIs use numerically-inverted thresholds with config comments (Q-4)
5. seed-postgres.py runs end-to-end in <90s on fresh docker compose
6. backend/tests/test_seed_script.py: all 17 tests pass (A10 guard + M-3 cross-check + all row counts + edge cases)
7. psql confirms managed table row counts and zero dual-row violations
8. frontend/e2e/_dashboard-names.json generated and matches DASHBOARD_NAMES
9. `bash scripts/mock-audit.sh` still exits 0
</verification>

<success_criteria>
After Plan 10-01b:
- The complete, reproducible test bed exists at the data layer
- The A10 guard is enforced at unit test + live DB levels
- The M-3 cross-check prevents dashboard name drift
- Plan 10-01c can rewrite E2E specs against known-stable slugs and names
</success_criteria>

<output>
After completion, create `.planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-01b-SUMMARY.md` documenting:
- scripts/seed-postgres.py line count and section layout
- Seed run wall time
- Row counts for recon_data and superset_meta tables
- test_seed_script.py: 17/17 passing
- A10 pairing check live-DB result
- M-3 dashboard names snapshot contents
- Any tweaks made to the seed during test implementation
</output>
