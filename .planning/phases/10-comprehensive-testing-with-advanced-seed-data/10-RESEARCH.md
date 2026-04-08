# Phase 10: Comprehensive Testing with Advanced Seed Data — Research

**Researched:** 2026-04-08
**Domain:** Release-readiness validation — schema design, curated test catalog, mock cleanup, autonomous pre-flight walkthrough
**Confidence:** HIGH for schema + catalog + mock cleanup (verified against codebase grep); MEDIUM for walkthrough timing budgets (depends on actual 100k perf, observed not predicted)

## Summary

Phase 10 is a v1 release-readiness milestone, not a feature phase. It replaces the tiny toy seed and the two legacy dashboards (`chart-showcase`, `tlm-stats`) with (1) a GRU-realistic recon schema at 100k-row tier, (2) a curated test catalog (10+ datasets, 20+ charts, 10+ KPIs, 4–5 themed dashboards), (3) an autonomous Playwright MCP pre-flight sweep, and (4) a phase-by-phase manual UAT runbook. It ships when every UAT checkbox is ticked, mock/fallback rendering is zero, and all P0/P1 issues are fixed.

The single most load-bearing research deliverable is **Section 1 (schema)**. Under CONTEXT.md D-03 the schema is drafted here and surfaced in `10-01-PLAN.md` for user approval before any code runs. Section 2 (curated catalog) builds directly on that schema.

A critical architectural finding surfaced during research — documented in §1.4 — is that **the dashboard renderer reads `recviz_data_sources` by the ID that the builder wrote into `DashboardChartConfig.sources[0].dataSourceId`, which the builder populated from `RecvizChart.datasetId` (a managed dataset ID)**. In practice this means the seed MUST create a `recviz_data_sources` row whose `id` equals the managed dataset's `id` for every dataset that any curated dashboard chart references. This is the #1 thing that will break if ignored.

**Primary recommendation:** Build the seed as a single idempotent Python script that (a) drops every legacy source and managed table row, (b) creates the new schema DDL (8 dims + 4 facts) with indexes, (c) inserts 100k fact rows deterministically (seeded RNG for reproducibility), (d) creates matched pairs of `recviz_datasets` AND `recviz_data_sources` rows sharing the same string ID, (e) inserts managed charts + KPIs that reference those datasets, (f) inserts 5 curated dashboards whose `config.charts[].sources[0].dataSourceId` points at those same string IDs, then (g) rewrites the 7 E2E specs against the new entity names.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Seed Data Shape & Volume**

- **D-01 — Clean-slate replace.** Drop all existing recon source tables (`bank`, `message_feed`, `item`, `recon_bank`, `tlm_bdr_relationship_header`, `reconmgmt.mr_csum_man_match_stats_hist`), all `showcase_*` tables, and all rows in `managed_datasets`/`managed_charts`/`managed_kpis`/`managed_dashboards`. Rewrite `scripts/seed-postgres.py` end-to-end. Rewrite the 7 E2E specs in `frontend/e2e/` to point at the new seed entities.
- **D-02 — 100k row tier.** Facts target 100k rows. Dimensions sized realistically (engines: ~5, accounts: ~5k, regions: ~10, currencies: ~30, statuses: ~8, aging buckets: ~6). Date range covers 2 years. Volume scaling to 1M/10M is **explicitly Phase 11 and out of scope**.
- **D-03 — GRU-realistic schema drafted by Claude, approved by user.** Full schema drafted in this RESEARCH.md and surfaced in `10-01-PLAN.md` for user approval before execution. Richness over realism: must support every chart type, every KPI format, every filter type, every drill level. Working sketch: facts `recon_transactions` (100k), `recon_breaks` (~20k), `recon_match_events` (~80k), `sla_events` (~5k); dims `recon_engines`, `accounts`, `regions`, `desks`, `currencies`, `statuses`, `aging_buckets`, `counterparties`. Final shape may evolve during planning.
- **D-04 — Full-coverage curated catalog.** Directly inserted into managed tables (not via UI): ≥10 datasets, ≥20 charts (every supported AG + ECharts type), ≥10 KPIs (all formats × both trend modes × all 3 threshold bands), 4–5 recon-domain dashboards (SLA / Aging / Match Rate / Volume / Breaks Summary themes) with global filters, ≥2 cross-filter source charts per dashboard, ≥1 drill-down hierarchy per dashboard.
- **D-05 — Edge cases baked in.** NULLs in both measure and dimension columns, ≥1 high-cardinality dimension (≥10k uniques), date records on leap-year days, DST switches, year boundaries. Extreme money values not deliberately seeded.
- **D-06 — Idempotency.** Fully idempotent seed script. Drop-and-recreate at top, no `IF NOT EXISTS` shortcuts. Lives at `scripts/seed-postgres.py` (replacing current file) as single source of truth.

**Test Surface & UAT Structure**

- **D-07 — Phase-by-phase UAT runbook.** Single `10-UAT-RUNBOOK.md` with one section per phase 1–9. Each section lists capabilities delivered, concrete steps, expected outcomes, and a checkbox per item. Findings logged inline as `**Issue:** ...` notes. Optional `10-FINDINGS.md` if issue volume warrants structured triage.
- **D-08 — Markdown-only, version-controlled.** No spreadsheets, no external tools. Lives in phase directory as `.md` file, committed to git.
- **D-09 — Two readers, one document.** Same UAT runbook used by Claude during autonomous pre-flight AND by the user during final manual regression.
- **D-10 — Existing E2E specs are rewritten** — not extended. Manual UAT is comprehensive coverage. Rewritten specs serve as a thin smoke regression net.
- **D-11 — One Playwright MCP smoke pass, all 4–5 dashboards.** Load → screenshot → click a chart segment for cross-filter sanity → click a drill row for drill sanity → verify no error panels / stuck skeletons → verify command palette finds them.

**Autonomous Pre-Flight & Issue Handling**

- **D-12 — Autonomous Claude pre-flight is Plan 10-02.** Exhaustively walks every page in the app (full list in D-12 and echoed in §5 below), exercises every flow, surfaces every issue. Fixes inline (trivial ≤10 LOC) or via decimal sub-phases (10.1, 10.2, …) for substantive fixes. Loop terminates when Claude declares the build clean.
- **D-13 — Decimal sub-phases for non-trivial fixes.** Each spawned sub-phase gets its own PLAN.md and atomic commits.
- **D-14 — Claude declares "ready for UAT" before user steps in.** Summary of what was tested, what was fixed, what (if anything) was deferred.

**Done Criteria & Mock Audit**

- **D-15 — Phase 10 ships when:**
  1. Every `10-UAT-RUNBOOK.md` checkbox ticked by user (`[x]`)
  2. Playwright MCP smoke pass walks all 4–5 curated dashboards green
  3. **Zero mock/fallback paths render anywhere in the frontend** — no fabricated data, no hardcoded fixtures in service code masquerading as real responses
  4. All P0 (broken / wrong data) and P1 (broken UX, blocker) findings fixed
  5. P2/P3 findings can be deferred to next milestone with explicit log entries
- **D-16 — Mock/fallback audit is three-pronged.** (1) Codebase grep for placeholder literals, hardcoded fixtures, hardcoded dataset IDs, the offenders in CONCERNS.md. (2) Endpoint review — every API route confirmed to hit a real data path. (3) UAT validation — every screen verified to show real data, watching for placeholder strings.
- **D-17 — Reports and Export stubs stay as-is.** Both render explicit "Coming Soon" empty states already. Exempt from mock audit because they are honest empty states.

**Test Mix**

- **D-18 — Performance: light, observation-only.** Record timings for initial dashboard load, filter apply, cross-filter response, drill-down detail fetch, command palette search into `10-PERF-OBSERVATIONS.md`. No assertions, no budgets, no test failures.
- **D-19 — Visual regression: NO.** No screenshot snapshot tests. Playwright captures failure screenshots for debugging only.
- **D-20 — Backend load testing: NO.** Defer to Phase 11 or future hardening.

**Build Sequence**

- **D-21 — Plan 10-01:** Schema + seed script + curated catalog + UAT runbook (initial draft) + rewritten E2E specs.
- **D-22 — Plan 10-02:** Autonomous pre-flight loop. Walks every page via Playwright MCP, fixes trivial issues inline, spawns decimal sub-phases for substantive ones, updates UAT runbook with walk notes, terminates when Claude judges build clean.
- **D-23 — Plan 10-03:** Finalize UAT runbook delta + write `10-PERF-OBSERVATIONS.md` + post "ready for UAT" summary → hand off to user manual regression.

### Claude's Discretion

- Exact column lists and FK relationships within the proposed schema (drafted below, requires user approval)
- Exact recon-domain dashboard themes within the 4–5 dashboard catalog (SLA/Aging/Match-Rate/Volume/Breaks-Summary is a working list — may merge or rename based on what the schema makes natural)
- Whether to spawn a decimal sub-phase or fix inline within 10-02 (judge by fix complexity)
- Exact ordering of pages walked during autonomous pre-flight
- Format of `10-PERF-OBSERVATIONS.md` (plain table is fine)
- Whether rewritten E2E specs become 7 files one-to-one or get reorganized

### Deferred Ideas (OUT OF SCOPE)

Pushed to **Phase 11**: 1M row tier, 10M row tier, performance budgets / timing assertions, backend load / concurrency testing, connection pool tuning.

Pushed to **next milestone (post-v1)**: Saved Views (SHAR-01), Reports / PDF export / Excel export / Email reports, Authentication / SSO / RBAC, visual regression / pixel snapshot testing, comprehensive E2E suite (manual UAT is v1's comprehensive coverage), Elasticsearch (DATA-03), `/api/sql/execute` hardening.

Raised but not in scope: tooling-based mock detector / CI check, single-tile embed, drill state in URL, server-side short-ID share links, quick actions in palette, recently-visited items in palette empty state.

## Phase Requirements

No REQ-IDs are directly assigned in REQUIREMENTS.md. Phase 10 is a quality-bar phase that **revalidates every v1 requirement end-to-end against the new advanced seed**. The requirements revalidated:

| ID(s) | Area | Research Support |
|-------|------|------------------|
| INFR-01..06 | Foundation | Mock audit §3 verifies INFR-04 is still clean; schema + catalog verifies INFR-01 (configs in DB), INFR-02 (schema versioning), INFR-03 (Superset hardening survives seed wipe), INFR-05 (number formatting across all KPI formats), INFR-06 (dead code stays removed) |
| INTR-01..09 | Dashboard interactions | Curated catalog exercises cross-filter (INTR-01/02), drill-down (INTR-03/04), fullscreen (INTR-05), chart export (INTR-06), grid export (INTR-07), manual/auto refresh (INTR-08/09) |
| DATA-01..04 (excl. 03) | Data sources | Dev PostgreSQL stands in for Oracle (DATA-01); DATA-02 Hive unreachable locally so covered by Phase 4 tests only; DATA-04 connection UI walked during autonomous pre-flight |
| DSET-01..05 | Datasets | Dev-team dataset CRUD exercised against 10+ seeded datasets |
| CHRT-01..07 | Charts | 20+ seeded charts covering every AG + EChart type — CHRT-05/06 coverage matrix |
| KPI-01..03 | KPIs | 10+ seeded KPIs covering all formats, both trend modes, all 3 threshold bands |
| BLDR-01..08 | Dashboard Builder | 4–5 seeded dashboards verify BLDR-07 (save/clone/delete), BLDR-08 (list page); autonomous walk exercises BLDR-01..06 live |
| SHAR-02..04 | Sharing | URL filter sync, embed, command palette exercised on new dashboards; SHAR-01 stays deferred |

## Project Constraints (from CLAUDE.md)

Downstream plans must honor these directives verbatim:

**TypeScript / React**
- Strict TS. No `any`. No `@ts-ignore`. Use `unknown` + narrowing. [VERIFIED: CLAUDE.md §Coding Conventions]
- Functional components only. Named exports (except page components which default-export per TanStack Router file-based routing). One primary component per file. Props interface `{ComponentName}Props`.
- No barrel exports (no `index.ts` re-exporting everything from a folder). Import directly. **Relevant offender: `frontend/src/types/index.ts` is a barrel — must be deleted (mock cleanup §3).**

**File naming**
- Components: `kebab-case.tsx`. Hooks: `use-{name}.ts`. Stores: `{name}-store.ts`. Python: `snake_case.py`. Tests: `{name}.test.ts(x)`. Routes: `index.tsx` or `$paramName.tsx`.

**Shadcn/Tailwind**
- Shadcn components in `src/components/ui/` are owned code. Extend via composition, do NOT modify.
- ONLY CSS variable colors (`text-foreground`, `bg-background`, `text-muted-foreground`, etc.). NEVER hardcode hex/rgb/hsl. Status: `text-green-600 dark:text-green-400` etc. — always include dark variant.
- Desktop-first. Responsive is secondary. Dark mode is first-class — every component MUST work in both.

**Animations**
- `motion/react` (NOT `framer-motion`). Durations: 200-300ms page / 200ms chart load / ~1s KPI counter / 300ms tooltip. [VERIFIED: CLAUDE.md §Animation Durations]

**Charts**
- AG Charts for 90% of viz. ECharts ONLY for exotic types: Sankey, sunburst, radar, network, gauge, parallel coordinates, funnel. Never use ECharts for a type AG Charts supports. [VERIFIED: CLAUDE.md §Charting Rules, CODE: `frontend/src/components/charts/chart-factory.tsx` lines 17-43]

**State**
- Zustand for client state, TanStack Query for server state. Stores hold state + simple setters, no complex business logic. Never store fetched data in Zustand.

**Backend**
- Async everywhere. Pydantic v2. Service layer pattern — route handlers are thin: validate input, call service, return response.

**Test conventions**
- Co-located Vitest unit tests for frontend utils/components/hooks/stores. Playwright specs in `frontend/e2e/`. Backend pytest in `backend/tests/`. [VERIFIED: `.planning/codebase/TESTING.md`]
- Playwright config: Chromium only, single worker, base URL `http://localhost:5173`, 30s test timeout, 10s assertion timeout. [VERIFIED: `frontend/playwright.config.ts`]

**CRITICAL Phase 10 acceptance gate:**
- `feedback_no_mock_shortcuts.md` — never mock/hardcode data to fake features working. Always verify against the real query pipeline. [USER REAFFIRMED in 10-CONTEXT.md §specifics]

## Standard Stack

Phase 10 does not introduce new libraries. Everything below is already in use and locked.

### Core (verified via `frontend/package.json` and `backend/requirements.txt` + `.planning/codebase/STACK.md`)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python 3.12 | 3.12+ | Seed script runtime | Backend standard [CITED: STACK.md] |
| psycopg2-binary | 2.9 | PostgreSQL sync driver for seed script | Current seed uses psycopg2 (sync is fine for a one-shot seed); async not needed |
| Vitest | 4.1 | Frontend unit tests | Already wired [CITED: STACK.md] |
| Playwright | 1.59 | E2E tests | Already wired. Chromium only, single worker [CITED: playwright.config.ts] |
| pytest | — | Backend unit tests | Already wired, no pytest config file (default discovery) [CITED: TESTING.md §"Backend Unit Tests"] |
| AG Grid Enterprise | 35 | Grids | Quartz theme + colorSchemeDark [MEMORY: project_ag_grid_theme.md] |
| AG Charts Enterprise | 13 | 90% of charts | AllEnterpriseModule registered for heatmap/treemap/waterfall [MEMORY: project_ag_charts_gotchas.md] |
| ECharts | 6.0 | Exotic charts only | Sankey/radar/sunburst/gauge/funnel/graph/parallel [CITED: `chart-factory.tsx` ECHART_TYPES] |

### Version verification (performed at plan-time)

The seed script and E2E specs will run on the already-installed versions. No `npm view` verification needed because Phase 10 installs nothing new. The plan should verify `python3 -c "import psycopg2; print(psycopg2.__version__)"` prints successfully as a sanity check before running the rewritten seed.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Alembic migration for new schema | Drop-create in seed script (current approach) | **Stick with drop-create.** The schema lives in recon_data, not recviz_metadata. Recon tables are the "source" data, not RecViz application state. Alembic for recon tables would misuse Alembic (which already tracks `recviz_alembic_version` for managed_* tables only). Drop-create is the idempotent contract in D-06. |
| Faker for synthetic data | Seeded `random` stdlib | **Stick with stdlib `random`.** Faker adds a dep; stdlib `random.seed(42)` is reproducible and matches the existing showcase pattern (`random.seed(42)` in current `seed-postgres.py` line 375). |
| COPY FROM for 100k insert perf | `executemany` in batches | **executemany in chunks of 5k-10k** is fast enough at 100k. COPY FROM requires file I/O or `copy_expert` gymnastics and the perf win (~20s vs ~60s) is not worth the complexity for a one-shot dev seed. |
| Synchronous psycopg2 | asyncpg | **Stick with psycopg2 (sync).** Seed is a one-shot script, not a service. Async adds cognitive load with no throughput benefit. Current script is sync psycopg2 — continue the pattern. |
| Separate schema files | Everything in `scripts/seed-postgres.py` | **Everything in one file.** Per D-06 "single source of truth." A human should be able to read the entire seed top-to-bottom in one file and understand the contract. |

**Installation (verification only):**

```bash
cd backend && pip install psycopg2-binary  # already present, smoke check
python3 -c "import psycopg2; print('ok')"
```

## Architecture Patterns

### Recommended project structure (no new folders)

```
scripts/
└── seed-postgres.py              # REWRITTEN — single source of truth (D-06, D-21)

backend/app/config/
├── dashboards/                   # LEGACY, kept for Phase-1/2 dashboards if any remain
│   ├── chart-showcase.json       # DELETE in 10-01 (D-01)
│   └── tlm-stats.json            # DELETE in 10-01 (D-01)
└── data_sources/                 # LEGACY JSON configs
    ├── showcase_*.json           # DELETE in 10-01 (D-01)
    ├── tlm_*.json                # DELETE in 10-01 (D-01)
    └── reconmgmt_*.json          # DELETE in 10-01 (D-01)

backend/app/api/
├── charts.py                     # DELETE in 10-01 (mock cleanup §3 — CHART_DATASOURCE_MAP hardcoded IDs)
└── custom.py                     # DELETE in 10-01 (mock cleanup §3 — /api/custom/kpi hardcoded IDs)

frontend/src/hooks/
├── use-chart-data.ts             # DELETE (dead, reads s.globalFilters)
├── use-kpi-data.ts               # DELETE (dead, reads s.globalFilters)
├── use-breaks-data.ts            # DELETE (dead, hits /api/datasets/5/data 404)
└── use-prefetch.ts               # DELETE (hardcoded chart IDs, hits /api/custom/kpi)

frontend/src/types/
└── index.ts                      # DELETE (barrel export against convention)

frontend/src/components/charts/
└── ag-chart-wrapper.tsx          # FIX lines 378-379 (Rules of Hooks violation — move useRef/useState to top)

frontend/e2e/
├── chart-showcase.spec.ts        # REWRITE → first curated dashboard smoke
├── tlm-stats-regression.spec.ts  # REWRITE → second curated dashboard smoke
├── share-link.spec.ts            # REWRITE — seed fixtures use new names
├── embed.spec.ts                 # REWRITE — seed fixtures use new names
├── dashboard-edit-regression.spec.ts  # REWRITE — seed fixtures use new names
├── dashboard-view-regression.spec.ts  # REWRITE — seed fixtures use new names
└── command-palette.spec.ts       # REWRITE — search for new entity tokens

.planning/phases/10-.../
├── 10-CONTEXT.md                 # ALREADY WRITTEN
├── 10-RESEARCH.md                # THIS FILE
├── 10-01a-PLAN.md                # Wave 0 infra + mock cleanup + schema approval gate
├── 10-01b-PLAN.md                # Seed script rewrite + validation (A10 guard + M-3 cross-check)
├── 10-01c-PLAN.md                # E2E spec rewrite + UAT runbook draft + full-stack verification
├── 10-02-PLAN.md                 # Autonomous pre-flight walkthrough (57 checkpoints)
├── 10-03-PLAN.md                 # UAT runbook finalize + perf observations + handoff
├── 10-UAT-RUNBOOK.md             # Created by Plan 10-01c, walked by 10-02, finalized by 10-03
├── 10-PERF-OBSERVATIONS.md       # Plan 10-03 output
├── plan-10-02-mcp-probe.state    # Plan 10-02 Task 0 → consumed by Plan 10-03 Task 2 (m-4 fix)
└── 10.1…, 10.2…/                 # Decimal sub-phases, spawned dynamically during 10-02
```

### Pattern 1: Dual-row seed for managed entities (CRITICAL)

**What:** For every curated dataset, the seed MUST insert TWO rows that share the same string `id`:
1. A `recviz_datasets` row — managed dataset metadata (drives the Datasets library, Chart builder, KPI builder, Command palette)
2. A `recviz_data_sources` row — data source config (drives `/api/data-sources/{id}/query` which is what the DashboardRenderer actually calls)

**When to use:** Every curated dataset that is referenced by any curated chart, KPI, or dashboard.

**Why:** The dashboard builder's `serializeConfig()` at `frontend/src/components/builder/builder-page.tsx:55-76` writes `sources: [{ dataSourceId: item.chart!.datasetId, metric: '' }]` — it puts the **managed dataset's ID directly into the dashboard config's `dataSourceId` field**. The renderer then resolves that ID via `ConfigStore.get_data_source()` at `backend/app/services/config_store.py:35-39`, which is a `SELECT` against `recviz_data_sources`. If there is no matching `recviz_data_sources` row with that ID, the chart renders "Data source not found" and the dashboard breaks. [VERIFIED: codebase grep + file reads]

**Example seed snippet (pseudo-Python):**

```python
def seed_curated_dataset_pair(
    cur,
    dataset_id: str,
    name: str,
    description: str,
    database_id: int,
    database_name: str,            # e.g., "superset_db_reconmgmt"
    sql_template: str,             # with {{filters}} placeholder for data_source config
    managed_sql: str,              # plain SQL for dataset preview/builder
    columns: list[dict],           # managed dataset column metadata
    filter_mappings: list[dict],   # data source filter mappings
):
    """Insert paired rows. Same id in both tables."""
    # 1. Managed dataset (drives builders, library, palette)
    cur.execute(
        """
        INSERT INTO recviz_datasets
            (id, name, description, database_id, superset_id, sql, columns,
             sync_status, schema_version, created_at, updated_at)
        VALUES (%s, %s, %s, %s, NULL, %s, %s::jsonb, 'synced', 1, NOW(), NOW())
        """,
        (dataset_id, name, description, database_id, managed_sql,
         json.dumps(columns))
    )

    # 2. Data source config (drives DashboardRenderer data fetches)
    ds_config = {
        "id": dataset_id,           # SAME ID
        "name": name,
        "database_routing": {"type": "static", "database": database_name},
        "query": sql_template,
        "filter_mappings": filter_mappings,
        "columns": [{"name": c["name"], "type": c["data_type"]}
                    for c in columns],
    }
    cur.execute(
        """
        INSERT INTO recviz_data_sources (id, name, schema_version, config)
        VALUES (%s, %s, 1, %s::jsonb)
        """,
        (dataset_id, name, json.dumps(ds_config))
    )
```

**Why two different SQL strings?** The managed dataset's `sql` is the raw SELECT that devs write and preview in the dataset editor (no `{{filters}}` placeholder). The data source config's `query` is the templated SQL the QueryEngine expands at runtime with `{{filters}}`. The two may differ — the dataset-SQL is typically `SELECT ... FROM ... WHERE 1=1` and the data-source-SQL appends `{{filters}}`. If they're kept in sync (which they should be), the seed can derive one from the other: `managed_sql = data_source_sql.replace("{{filters}}", "")`.

### Pattern 2: Filter mappings for the global filter bar

**What:** Each `recviz_data_sources` row has a `filter_mappings[]` array that tells the QueryEngine how to translate a global filter value into a SQL WHERE clause.

**When:** Every data source that participates in the dashboard-level global filter bar must declare a mapping per expected filter.

**Example (from current `tlm_automatch.json` / new equivalent):**

```json
{
  "filter_mappings": [
    {"filter_id": "region_id", "sql_expr": "t.region_id IN ({{values}})"},
    {"filter_id": "recon_engine_id", "sql_expr": "t.recon_engine_id = {{value}}"},
    {"filter_id": "date_range", "sql_expr": "t.trade_date {{date_range_clause}}"}
  ]
}
```

Placeholders: `{{values}}` = SQL-quoted comma-separated list, `{{value}}` = single SQL-quoted value, `{{date_range_clause}}` = dialect-aware `BETWEEN ... AND ...`. [CITED: `backend/app/services/query_engine.py` `_build_sql` lines 105-163]

### Pattern 3: Curated-entity-name convention

**What:** Every curated entity gets a prefixed human-readable name + a stable lowercased slug ID. The ID is stable across seed runs; the name is prefixed `Phase 10 ·` so it's visually obvious these are the curated catalog and not user-created experiments.

| Entity type | ID pattern | Name pattern | Example |
|-------------|------------|--------------|---------|
| Dataset | `ds-{slug}` | `{title}` | `ds-recon-transactions-daily` / `Recon Transactions Daily` |
| Chart | `chart-{slug}` | `{title}` | `chart-volume-by-region` / `Volume by Region` |
| KPI | `kpi-{slug}` | `{title}` | `kpi-match-rate` / `Match Rate` |
| Dashboard | `dash-{slug}` | `{title}` | `dash-sla` / `SLA Overview` |

Stable IDs let the rewritten E2E specs reference specific dashboards by slug: `/dashboards/dash-sla`, etc. The existing command-palette spec uses `rv-09-03-*` random-suffix names — the new specs should reference `dash-sla`, `dash-aging`, `dash-match-rate`, `dash-volume`, `dash-breaks-summary` by stable ID instead so tests are deterministic and don't require seed cleanup.

### Pattern 4: Seeded random for reproducibility

**What:** Call `random.seed(42)` once at the top of the fact-data inserter. [VERIFIED: existing `seed-postgres.py` line 375 already does this for `seed_showcase_data`]

**Why:** Re-running the seed must produce byte-identical data for regression comparison and perf observation stability.

### Anti-Patterns to Avoid

- **Anti-pattern 1: Inserting managed dashboards via the POST `/api/dashboards/managed` endpoint.** The seed must write directly to the database (psycopg2), not hit the API. Why: the seed runs BEFORE backend startup (per `project_local_dev_setup.md` the order is docker → seed → register superset → backend → frontend). Hitting the API would require the backend to already be running, creating a chicken-and-egg.
- **Anti-pattern 2: Legacy JSON config files as dashboard source of truth.** The current `backend/app/config/dashboards/{chart-showcase,tlm-stats}.json` files get loaded via `seed_recviz_configs` → `INSERT ... ON CONFLICT DO UPDATE` into `recviz_dashboards`. Delete those JSON files in Plan 10-01; the new seed builds the DashboardConfig dicts in Python inline, no JSON round-trip.
- **Anti-pattern 3: One huge INSERT for 100k rows.** Use `executemany` in batches of 5,000–10,000 to keep memory bounded and provide progress output (`print(f"  inserted {n}/{total} transactions")`).
- **Anti-pattern 4: Forgetting to drop `managed_dashboards` / `managed_charts` / `managed_kpis` / `managed_datasets` rows.** Per D-01 the clean-slate drop MUST include managed-table row deletion. Otherwise stale Phase 2-9 entities will clutter the library pages.
- **Anti-pattern 5: Deliberately injecting extreme money values (trillions, micro-decimals).** Per D-05: "Extreme number values (trillions, micro-decimals, negatives, zero) are not deliberately seeded but will be naturally present via realistic monetary distributions." Stick with realistic log-normal or uniform money amounts in $100 — $10M range with some negatives (for break_amount = paid - received deltas). Don't force trillions.
- **Anti-pattern 6: Mixing managed dataset IDs with Superset virtual dataset IDs.** Per Phase 5 convention (`recviz__{uuid}` Superset table_name format), the managed dataset's `superset_id` is assigned by the Superset sync service at runtime. Phase 10 seed should write `superset_id = NULL` and `sync_status = 'synced'` for directly-inserted seed datasets, then rely on the backend startup's dataset-sync lifecycle to populate Superset. (If that's fragile, alternative is `sync_status = 'unsynced'` and let the user or UI trigger sync — but this may break drill-down detail grids which go through Superset SQL Lab. **Open question flagged — see §6.**)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Random data generation | Write your own RNG | Python stdlib `random` seeded with 42 | Existing pattern, reproducible, zero deps |
| SQL injection guard in seed script | String concatenation | psycopg2 `%s` parameterization | Seed is trusted (dev machine) but good habit; existing pattern uses `executemany` with `%s` |
| Playwright MCP smoke-pass scripting | Custom page-walker | Playwright MCP via direct Claude tool invocation | Claude already has Playwright MCP access for visual verification |
| Chart factory routing | Hardcode chart types in seed | Query `SUPPORTED_AG_TYPES` / `ECHART_TYPES` from `chart-factory.tsx` as source of truth | The seed's chart catalog must match what the factory can render — if they drift, charts break silently [CITED: `chart-factory.tsx` lines 17-43] |
| Idempotent re-seeding | Add `ON CONFLICT DO UPDATE` clauses | `DROP TABLE IF EXISTS` + plain `INSERT` at top | D-06 explicitly forbids `IF NOT EXISTS` shortcuts |
| UAT runbook format | Custom checklist DSL | Plain markdown with `- [ ]` checkboxes | D-08 markdown-only |
| Perf budget framework | pytest-benchmark / @pytest.mark.benchmark | Plain markdown table | D-18 observations only, no assertions |
| Data source ID generation for dual seed | Random UUIDs | Stable slugs (`ds-recon-transactions`) | Stable slugs let E2E specs hardcode URLs |

**Key insight:** Phase 10 is a testing phase — the temptation is to build testing tools. Resist. The job is to USE existing tools (Playwright MCP, pytest, markdown, the existing seed script template) against real data.

## Runtime State Inventory

> Phase 10 is a clean-slate replace phase — this section is REQUIRED to enumerate what survives the drop and what needs re-registration.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | `recon_data` database: current 6 legacy tables (`bank`, `message_feed`, `item`, `recon_bank`, `tlm_bdr_relationship_header`, `reconmgmt.mr_csum_man_match_stats_hist`) + 11 `showcase_*` tables. `superset_meta` database: 2 rows in `recviz_dashboards` (chart-showcase, tlm-stats) + 15 rows in `recviz_data_sources` + N rows in `recviz_datasets` / `recviz_charts` / `recviz_kpis` from Phase 5-9 testing. | **Full drop + rebuild in seed script.** Per D-01. The seed script drops source tables first (CASCADE), then `DELETE FROM` managed tables (do NOT DROP — Alembic owns the managed table schema per `project_superset_alembic.md`). |
| **Live service config** | **Superset metadata** — after seed wipe: Superset still remembers the logical database `superset_db_reconmgmt` (+ others) because they live in Superset's own metadata tables, NOT in recon_data. Superset virtual datasets synced by `dataset_sync.py` during Phase 5 may still point at now-deleted recon tables — these will 404 the next time Superset queries them. | **Re-register datasets after seed runs.** The startup lifecycle in `backend/app/main.py` calls `dataset_sync.sync_all()` — that should clean up stale Superset virtual datasets and create new ones matching the new seed. Needs verification in 10-01 that the sync handles **stale** Superset datasets whose source table no longer exists. **Open question §6.** Also: `seed/register_superset.py` registers the four logical databases — this script is kept as-is per CONTEXT.md. |
| **OS-registered state** | None. RecViz is a dev-machine service (docker + native python + native node). No Windows Task Scheduler, launchd, systemd, pm2 registrations. | None — verified by absence of registration scripts in `scripts/`, `infrastructure/`. |
| **Secrets / env vars** | `backend/.env` contains `SUPERSET_USERNAME/PASSWORD`, `RECON_DB_URL`, `RECVIZ_DB_URL`. These are environment-level and unaffected by a data drop. Default Superset creds committed to `backend/app/config.py` (per CONCERNS.md security note) but that's out of scope here. | None — schema drop does not touch secrets. Seed script should NOT read `.env`; it hardcodes `RECON_DB_URL` and `RECVIZ_DB_URL` to `localhost:5432` (current behavior). |
| **Build artifacts / installed packages** | None that embed data specifics. The `superset/` Docker image is rebuilt by `docker compose up` when needed, not tied to seed data. Alembic migrations in `backend/app/migrations/versions/` track `recviz_*` schemas only, not source tables — stable. | None — verified. |
| **In-memory backend stores** | `_query_history` (sql.py), `_jobs` (export.py), `_views` (views.py) — all reset on backend restart. | **None for Phase 10 from seed perspective.** These are already ephemeral. `_query_history` is exercised during SQL Explorer UAT walk but resets between backend restarts. `_jobs`/`_views` exempt per D-17. |

**The canonical question answered:** After every file in the repo is updated and the seed runs, what runtime systems still have stale data? Answer: **Superset's metadata** (virtual datasets pointing at dropped recon tables, possibly Redis query cache holding results from the old schema). Mitigation: flush Redis + re-run `dataset_sync.sync_all()` on backend startup, OR restart the backend after seeding. The plan should document the restart sequence as: **docker compose down → docker compose up -d → run seed script → restart backend → restart frontend**. See §6 Risks.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL 16 | recon_data + superset_meta databases | ✓ (docker compose) | 16 | — |
| Redis 7 | Superset query cache + Celery broker (Celery not used v1) | ✓ (docker compose) | 7 | — |
| Apache Superset | Query engine for dashboard data | ✓ (docker compose) | 6.0.0 | — |
| Python 3.12 + psycopg2 | Seed script execution | ✓ (backend venv) | 3.12 | — |
| Node + pnpm | Frontend build + Playwright | ✓ | — | — |
| Playwright + Chromium | E2E specs + MCP autonomous walkthrough | ✓ | 1.59 | — |
| **Playwright MCP (`mcp__playwright`)** | Autonomous walkthrough in Plan 10-02 | **REQUIRED** | — | If unavailable: degrade to manual Claude-led walk with screenshots via `page.screenshot()` inside an adhoc spec. Not ideal. |

**Missing dependencies with no fallback:** None — all stack components present locally.

**Missing dependencies with fallback:** Playwright MCP must be confirmed available before Plan 10-02 begins. If not, the walkthrough must be re-scoped to run through the standard Playwright spec runner, which is slower and less interactive. Plan 10-02 should probe MCP availability in its first task.

---

## Section 1: Proposed Schema (THE deliverable)

This schema is **drafted here per D-03 and requires user approval in `10-01-PLAN.md` before execution**. It targets the 100k fact-row tier at a 2-year date range. Cardinalities are sized so that 100k transactions distribute naturally across dimensions and stretch every supported filter/aggregation/chart type.

### 1.1 High-level entity diagram

```
                  ┌────────────────┐
                  │ recon_engines  │ (5)
                  └────────┬───────┘
                           │ 1:N
                           ▼
┌─────────────┐   ┌────────────────────────┐   ┌─────────────────┐
│  regions    │──▶│   recon_transactions   │◀──│   accounts      │
│  (10)       │N:1│        (~100,000)      │N:1│   (~5,000)      │
└─────────────┘   │                        │   └─────────────────┘
┌─────────────┐   │  FK: engine_id         │   ┌─────────────────┐
│  desks      │──▶│  FK: account_id        │◀──│ counterparties  │
│  (25)       │N:1│  FK: region_id         │N:1│   (~200)        │
└─────────────┘   │  FK: desk_id           │   └─────────────────┘
┌─────────────┐   │  FK: currency_id       │
│ currencies  │──▶│  FK: status_id         │
│  (30)       │N:1│  FK: counterparty_id   │
└─────────────┘   │  trade_date (2y range) │
┌─────────────┐   │  settle_date           │
│  statuses   │──▶│  amount, fee, fx_rate  │
│  (8)        │N:1│                        │
└─────────────┘   └──────────┬─────────────┘
                             │ 1:0..1
                             ▼
                  ┌─────────────────────┐           ┌──────────────┐
                  │    recon_breaks     │──────────▶│ aging_buckets│
                  │      (~20,000)      │ N:1       │     (6)      │
                  │  FK: transaction_id │           └──────────────┘
                  │  break_amount       │
                  │  break_type         │
                  │  aging_days         │
                  │  aging_bucket_id    │
                  │  opened_at          │
                  │  resolved_at        │
                  └──────┬──────────────┘
                         │ 1:N
                         ▼
                  ┌───────────────────────┐
                  │  recon_match_events   │
                  │      (~80,000)        │
                  │  FK: transaction_id   │
                  │  FK: break_id (nullable)│
                  │  match_type           │
                  │  matched_at           │
                  │  matcher              │
                  └───────────────────────┘

┌────────────────────┐
│     sla_events     │ (~5,000)
│ FK: transaction_id │
│ FK: break_id       │
│ sla_type           │
│ sla_target_mins    │
│ sla_elapsed_mins   │
│ breach (bool)      │
│ event_ts           │
└────────────────────┘
```

### 1.2 Dimension tables

All dimension tables live in the `recon_data` database, `public` schema. No separate `reconmgmt` schema — one schema per `project_dashboard_config_conventions.md` consistency. The existing `databases.json` registers four logical databases all pointing at the same PostgreSQL `recon_data` instance; the seed uses `superset_db_reconmgmt` as the default and drops the separate `reconmgmt` schema. [VERIFIED: `backend/app/config/databases.json`]

#### `recon_engines` (~5 rows)

```sql
CREATE TABLE recon_engines (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(32)  NOT NULL UNIQUE,         -- "TLM", "SMARTSTREAM", "INTELLIMATCH", "DUCO", "OPTIONS"
  name            VARCHAR(128) NOT NULL,                -- "TLM Smart Recon", "SmartStream Corona", etc.
  vendor          VARCHAR(64)  NOT NULL,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE
);
```

Rows: `TLM`, `SMARTSTREAM`, `INTELLIMATCH`, `DUCO`, `OPTIONS`. One inactive row for edge-case filter testing.

#### `regions` (~10 rows)

```sql
CREATE TABLE regions (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(8)   NOT NULL UNIQUE,         -- "NAM", "EMEA", "APAC", "LATAM", ...
  name            VARCHAR(64)  NOT NULL,                -- "North America", "Europe Middle East & Africa", ...
  parent_region   VARCHAR(32)                            -- nullable — 2-level region hierarchy for drill
);
```

Rows: `NAM`, `EMEA`, `APAC`, `LATAM`, `JP`, `UK`, `US`, `HK`, `SG`, `AU`. `parent_region` gives a 2-level drill hierarchy (region → country-like sub-region).

#### `desks` (~25 rows)

```sql
CREATE TABLE desks (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(16)  NOT NULL UNIQUE,         -- "FX_G10", "FX_EM", "RATES_US", ...
  name            VARCHAR(64)  NOT NULL,
  asset_class     VARCHAR(32)  NOT NULL,                -- "FX" | "RATES" | "EQUITIES" | "CREDIT" | "COMMODITIES" | "DERIVATIVES"
  region_id       INTEGER REFERENCES regions(id)
);
```

~25 desks across 6 asset classes (FX, Rates, Equities, Credit, Commodities, Derivatives). Gives a second drill hierarchy (asset_class → desk).

#### `currencies` (~30 rows)

```sql
CREATE TABLE currencies (
  id              SERIAL PRIMARY KEY,
  code            CHAR(3)      NOT NULL UNIQUE,         -- "USD", "EUR", "JPY", ...
  name            VARCHAR(64)  NOT NULL,
  decimal_places  SMALLINT     NOT NULL DEFAULT 2,      -- 0 for JPY, 2 for USD, 3 for BHD, etc.
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE
);
```

30 major world currencies. Mix of 0/2/3 decimal places exercises `decimal_places`-aware KPI format rendering.

#### `statuses` (~8 rows)

```sql
CREATE TABLE statuses (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(24)  NOT NULL UNIQUE,         -- "MATCHED", "UNMATCHED", "PENDING_MATCH", ...
  name            VARCHAR(64)  NOT NULL,
  category        VARCHAR(16)  NOT NULL,                -- "OPEN" | "CLOSED" | "PENDING"
  sort_order      SMALLINT     NOT NULL
);
```

Rows (exact 8): `MATCHED` (CLOSED), `UNMATCHED` (OPEN), `PENDING_MATCH` (PENDING), `AUTO_MATCHED` (CLOSED), `MANUAL_MATCHED` (CLOSED), `DISPUTED` (OPEN), `WRITTEN_OFF` (CLOSED), `ESCALATED` (OPEN).

#### `aging_buckets` (~6 rows)

```sql
CREATE TABLE aging_buckets (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(16)  NOT NULL UNIQUE,         -- "0-1D", "2-3D", "4-7D", "8-14D", "15-30D", "30D+"
  label           VARCHAR(32)  NOT NULL,
  min_days        INTEGER      NOT NULL,
  max_days        INTEGER,                              -- NULL for "30D+" open-ended
  sort_order      SMALLINT     NOT NULL,
  severity        VARCHAR(8)   NOT NULL                 -- "OK" | "WARN" | "CRIT"
);
```

Rows (exact 6): `0-1D` (OK), `2-3D` (OK), `4-7D` (WARN), `8-14D` (WARN), `15-30D` (CRIT), `30D+` (CRIT).

#### `counterparties` (~200 rows)

```sql
CREATE TABLE counterparties (
  id              SERIAL PRIMARY KEY,
  lei             VARCHAR(20)  NOT NULL UNIQUE,         -- 20-char LEI (Legal Entity Identifier)
  short_name      VARCHAR(64)  NOT NULL,                -- "GS Intl", "JPMC", "DB Global", ...
  legal_name      VARCHAR(256) NOT NULL,
  country_code    CHAR(2)      NOT NULL,
  tier            SMALLINT     NOT NULL                 -- 1 (tier 1 bank), 2, 3
);
```

200 counterparties — big enough to exercise multi-select filters + small enough to render in a pie chart legend without overflow. LEIs are randomly generated but follow the 20-char pattern.

#### `accounts` (~5,000 rows) — **the high-cardinality dimension**

```sql
CREATE TABLE accounts (
  id              SERIAL PRIMARY KEY,
  account_number  VARCHAR(32)  NOT NULL UNIQUE,         -- "ACC-NAM-0001", ...
  name            VARCHAR(128) NOT NULL,
  type            VARCHAR(16)  NOT NULL,                -- "NOSTRO" | "VOSTRO" | "INTERNAL" | "CUSTOMER"
  region_id       INTEGER NOT NULL REFERENCES regions(id),
  currency_id     INTEGER NOT NULL REFERENCES currencies(id),
  opened_date     DATE         NOT NULL,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_accounts_region_id   ON accounts(region_id);
CREATE INDEX idx_accounts_currency_id ON accounts(currency_id);
```

5,000 accounts is the primary dimension cardinality driver. **Note per D-05 we need a ≥10k unique high-cardinality dimension.** The 10k unique values do NOT have to be a dimension — they can be a high-cardinality *column* on the fact table. See `recon_transactions.external_ref` in §1.3 below.

### 1.3 Fact tables

#### `recon_transactions` (~100,000 rows) — **the primary fact**

```sql
CREATE TABLE recon_transactions (
  id                  BIGSERIAL PRIMARY KEY,
  external_ref        VARCHAR(40)  NOT NULL,            -- high-cardinality: exactly 100k unique values (one per row)
  engine_id           INTEGER      NOT NULL REFERENCES recon_engines(id),
  account_id          INTEGER      NOT NULL REFERENCES accounts(id),
  counterparty_id     INTEGER               REFERENCES counterparties(id),   -- NULLABLE (per D-05)
  desk_id             INTEGER      NOT NULL REFERENCES desks(id),
  region_id           INTEGER      NOT NULL REFERENCES regions(id),
  currency_id         INTEGER      NOT NULL REFERENCES currencies(id),
  status_id           INTEGER      NOT NULL REFERENCES statuses(id),
  amount              NUMERIC(18,4) NOT NULL,           -- trade amount in local currency
  fee                 NUMERIC(18,4),                    -- NULLABLE (per D-05)
  fx_rate             NUMERIC(12,6),                    -- NULLABLE (when currency = base ccy)
  amount_usd          NUMERIC(18,4) NOT NULL,           -- computed: amount * fx_rate, or = amount if USD
  trade_date          DATE         NOT NULL,            -- within 2-year range, INCLUDING leap day + DST + year boundaries
  settle_date         DATE         NOT NULL,            -- trade_date + T+2 typically
  booking_ts          TIMESTAMPTZ  NOT NULL,            -- TIMESTAMPTZ to catch DST properly
  last_updated_ts     TIMESTAMPTZ  NOT NULL
);

CREATE INDEX idx_txn_trade_date    ON recon_transactions(trade_date);
CREATE INDEX idx_txn_status_id     ON recon_transactions(status_id);
CREATE INDEX idx_txn_region_id     ON recon_transactions(region_id);
CREATE INDEX idx_txn_desk_id       ON recon_transactions(desk_id);
CREATE INDEX idx_txn_currency_id   ON recon_transactions(currency_id);
CREATE INDEX idx_txn_engine_id     ON recon_transactions(engine_id);
CREATE INDEX idx_txn_account_id    ON recon_transactions(account_id);
CREATE INDEX idx_txn_external_ref  ON recon_transactions(external_ref);  -- serves the high-cardinality lookup
CREATE INDEX idx_txn_counterparty  ON recon_transactions(counterparty_id);
-- Composite for the common "group by date + status" chart
CREATE INDEX idx_txn_date_status   ON recon_transactions(trade_date, status_id);
```

**Row-count target:** 100,000 exact. **Date range:** 2 years back from a fixed seed date (e.g., 2024-01-01 → 2025-12-31) — hardcoded anchor date avoids drift between runs.

**Edge case seeding (per D-05):**
- **10k+ uniques:** `external_ref` has 100,000 unique values by construction (one per row) — this IS the high-cardinality dimension column. `account_id` has 5k uniques, so a chart grouping by `external_ref` would hit the 10k threshold, while `account_id` stays under and serves as an entity for drill-down.
- **Leap day:** 2024-02-29 — insert ~140 transactions on that exact date.
- **DST spring-forward:** 2024-03-10 02:00–03:00 America/New_York (booking_ts in UTC — corresponds to 06:00–07:00 UTC). Insert records with `booking_ts` spanning that UTC hour.
- **DST fall-back:** 2024-11-03 — insert records at ambiguous local times (UTC unambiguous so TIMESTAMPTZ is safe).
- **Year boundary:** 2024-12-31 23:55 UTC and 2025-01-01 00:05 UTC records. Exercise the "year/month/quarter" group-by bucketing.
- **NULLs:** `counterparty_id NULL` on ~5% of rows (5k rows); `fee NULL` on ~15% (15k rows); `fx_rate NULL` when `currency_id` = USD (single-row natural null).
- **Negative amounts:** ~10% of transactions have negative `amount` to represent cancellations/reversals. Exercises signed number rendering in KPIs.
- **Money distribution:** log-normal, mean ~$50k USD, min ~$10, max ~$10M. No trillions, no micro-decimals by deliberate choice (per D-05).

#### `recon_breaks` (~20,000 rows)

```sql
CREATE TABLE recon_breaks (
  id                  BIGSERIAL PRIMARY KEY,
  transaction_id      BIGINT       NOT NULL REFERENCES recon_transactions(id),
  break_type          VARCHAR(24)  NOT NULL,            -- "AMOUNT" | "DATE" | "MISSING" | "DUPLICATE" | "COUNTERPARTY"
  break_amount        NUMERIC(18,4),                    -- difference; NULLABLE for non-amount break types
  break_amount_usd    NUMERIC(18,4),                    -- NULLABLE (same reason)
  aging_days          INTEGER      NOT NULL,            -- 0..60+
  aging_bucket_id     INTEGER      NOT NULL REFERENCES aging_buckets(id),
  opened_at           TIMESTAMPTZ  NOT NULL,
  resolved_at         TIMESTAMPTZ,                      -- NULLABLE (open break)
  resolution          VARCHAR(32),                      -- "FIXED" | "WRITTEN_OFF" | "ESCALATED" | NULL (open)
  root_cause          VARCHAR(64),                      -- "DATA_ENTRY" | "TIMING" | "SYSTEM" | "MISSING_DATA" | ...
  assigned_to         VARCHAR(64)                       -- analyst username, NULLABLE
);

CREATE INDEX idx_breaks_transaction_id ON recon_breaks(transaction_id);
CREATE INDEX idx_breaks_opened_at      ON recon_breaks(opened_at);
CREATE INDEX idx_breaks_aging_bucket   ON recon_breaks(aging_bucket_id);
CREATE INDEX idx_breaks_break_type     ON recon_breaks(break_type);
CREATE INDEX idx_breaks_resolution     ON recon_breaks(resolution);
```

20,000 breaks = 20% of transactions have an associated break (realistic GRU ratio). Distribution:
- `AMOUNT`: 60% (12,000)
- `DATE`: 15% (3,000)
- `MISSING`: 10% (2,000)
- `DUPLICATE`: 10% (2,000)
- `COUNTERPARTY`: 5% (1,000)

About 40% of breaks are OPEN (`resolved_at IS NULL`), 60% resolved. Open breaks have `NULL` resolution. Mix of aging: 50% in buckets 0-1D/2-3D (fresh), 30% in 4-7D/8-14D, 20% in 15-30D/30D+ (stale — drives SLA/aging dashboard).

#### `recon_match_events` (~80,000 rows)

```sql
CREATE TABLE recon_match_events (
  id                  BIGSERIAL PRIMARY KEY,
  transaction_id      BIGINT       NOT NULL REFERENCES recon_transactions(id),
  break_id            BIGINT                REFERENCES recon_breaks(id),   -- NULLABLE (auto-matches have no break)
  match_type          VARCHAR(16)  NOT NULL,            -- "AUTO" | "MANUAL" | "RULE_BASED" | "AI_ASSISTED"
  matcher             VARCHAR(64)  NOT NULL,            -- "system" or analyst username
  matched_at          TIMESTAMPTZ  NOT NULL,
  confidence_score    NUMERIC(5,2)                      -- 0.00–1.00 or NULL for non-ML matches
);

CREATE INDEX idx_match_transaction_id ON recon_match_events(transaction_id);
CREATE INDEX idx_match_matched_at     ON recon_match_events(matched_at);
CREATE INDEX idx_match_type           ON recon_match_events(match_type);
```

80,000 match events = ~80% of transactions get at least one match event. Distribution:
- `AUTO`: 65% (52,000) — system-matched at ingestion time
- `RULE_BASED`: 20% (16,000) — ruleset catches these
- `MANUAL`: 10% (8,000) — analyst-matched
- `AI_ASSISTED`: 5% (4,000) — ML-suggested matches
- `confidence_score` is NULL for AUTO and MANUAL; populated (0.6–0.99) for RULE_BASED and AI_ASSISTED.

#### `sla_events` (~5,000 rows)

```sql
CREATE TABLE sla_events (
  id                  BIGSERIAL PRIMARY KEY,
  transaction_id      BIGINT       NOT NULL REFERENCES recon_transactions(id),
  break_id            BIGINT                REFERENCES recon_breaks(id),   -- NULLABLE
  sla_type            VARCHAR(32)  NOT NULL,            -- "MATCH_WITHIN_4H" | "BREAK_RESOLVE_WITHIN_24H" | "DAILY_CLOSE" | ...
  sla_target_mins     INTEGER      NOT NULL,
  sla_elapsed_mins    INTEGER      NOT NULL,
  breach              BOOLEAN      NOT NULL,
  severity            VARCHAR(8)   NOT NULL,            -- "OK" | "WARN" | "CRIT"
  event_ts            TIMESTAMPTZ  NOT NULL,
  region_id           INTEGER      NOT NULL REFERENCES regions(id)  -- denormalized for SLA-by-region dashboards
);

CREATE INDEX idx_sla_event_ts    ON sla_events(event_ts);
CREATE INDEX idx_sla_breach      ON sla_events(breach);
CREATE INDEX idx_sla_type        ON sla_events(sla_type);
CREATE INDEX idx_sla_region_id   ON sla_events(region_id);
```

5,000 SLA events. ~30% breaches (1,500) drives the "SLA Breach Rate" KPI. 5 SLA types (`MATCH_WITHIN_4H`, `BREAK_RESOLVE_WITHIN_24H`, `DAILY_CLOSE`, `SETTLEMENT_T2`, `REGULATORY_REPORT`). Denormalized `region_id` because SLA reports slice by region often — avoids N:N joins at query time.

### 1.4 Integration with managed tables (the critical alignment)

For every curated dataset defined in §2 below, the seed inserts TWO rows with the SAME string ID (see §Architecture Pattern 1):

1. `recviz_datasets` row — driving the Dataset Library, Chart builder, KPI builder, Command palette.
2. `recviz_data_sources` row — driving `/api/data-sources/{id}/query` used by the Dashboard Renderer.

**The dataset ID space is a single namespace.** Every ID under `ds-*` must exist in BOTH tables.

### 1.5 Index strategy justification

Index pattern: every FK column on every fact table gets an index (seven indexes on `recon_transactions`). Composite `(trade_date, status_id)` for the primary time-series group-by. This is over-indexed for a 100k table, but Phase 10 is about feature validation, not write perf — reads dominate. Plan 10-01 should run `EXPLAIN ANALYZE` on two or three representative dashboard queries after seeding and log to `10-PERF-OBSERVATIONS.md`.

### 1.6 Schema versioning and Alembic

The schema above lives entirely in `recon_data` database. It is NOT managed by Alembic because Alembic owns `recviz_*` tables only (per `project_superset_alembic.md`). The seed script is the source of truth — drop-create every run.

Alembic migrations for the managed tables (001_initial, 002_datasets, 003_charts, 004_kpis) are untouched. Phase 10 does NOT add a new Alembic migration.

---

## Section 2: Curated Catalog Mapping

### 2.1 Datasets (target: ≥10)

Each row below is a dataset. The seed creates a dual pair `recviz_datasets` + `recviz_data_sources` with the same string ID. `sql_template` is what goes into `recviz_data_sources.config.query` (with `{{filters}}` placeholder). `managed_sql` is what goes into `recviz_datasets.sql` (preview-ready, no placeholders — just the same SQL with `{{filters}}` removed).

All datasets target the `superset_db_reconmgmt` logical database (all four registered databases point at the same PostgreSQL instance, so this is fine).

**Column metadata format** (for `recviz_datasets.columns` JSONB): `{name, display_name, data_type, role, aggregation, format_preset, format_string}` — matches `ColumnMetaSchema` in `backend/app/models/managed_dataset.py`.

| # | ID | Name | Query shape | Primary purpose |
|---|-----|------|-------------|-----------------|
| 1 | `ds-recon-transactions-daily` | Transactions — Daily Volume | `SELECT trade_date, COUNT(*) AS txn_count, SUM(amount_usd) AS total_usd FROM recon_transactions {{filters}} GROUP BY trade_date ORDER BY trade_date` | Time-series line/area charts — trend over 2 years |
| 2 | `ds-recon-transactions-by-region` | Transactions — By Region | `SELECT r.code AS region, r.name AS region_name, COUNT(*) AS txn_count, SUM(t.amount_usd) AS total_usd FROM recon_transactions t JOIN regions r ON t.region_id = r.id {{filters}} GROUP BY r.code, r.name ORDER BY txn_count DESC` | Bar / pie / donut of region distribution, drill source |
| 3 | `ds-recon-transactions-by-status` | Transactions — By Status | `SELECT s.code AS status, s.name AS status_name, s.category, COUNT(*) AS txn_count FROM recon_transactions t JOIN statuses s ON t.status_id = s.id {{filters}} GROUP BY s.code, s.name, s.category ORDER BY txn_count DESC` | Pie / donut / stacked-bar showing match-rate composition |
| 4 | `ds-recon-breaks-summary` | Breaks — Summary | `SELECT b.break_type, b.resolution, COUNT(*) AS break_count, SUM(b.break_amount_usd) AS total_break_usd, AVG(b.aging_days)::numeric(10,2) AS avg_aging FROM recon_breaks b {{filters}} GROUP BY b.break_type, b.resolution ORDER BY break_count DESC` | Breaks-by-type bar chart, breaks aging scatter |
| 5 | `ds-recon-breaks-aging` | Breaks — Aging Distribution | `SELECT ab.code AS bucket, ab.label, ab.sort_order, ab.severity, COUNT(b.id) AS break_count, SUM(b.break_amount_usd) AS total_usd FROM recon_breaks b JOIN aging_buckets ab ON b.aging_bucket_id = ab.id {{filters}} GROUP BY ab.code, ab.label, ab.sort_order, ab.severity ORDER BY ab.sort_order` | Bar / waterfall of aging distribution; severity-aware cell renderer |
| 6 | `ds-recon-match-rate-daily` | Match Rate — Daily | `SELECT t.trade_date AS date, (SUM(CASE WHEN s.category = 'CLOSED' THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0)) * 100 AS match_rate, COUNT(*) AS txn_count FROM recon_transactions t JOIN statuses s ON t.status_id = s.id {{filters}} GROUP BY t.trade_date ORDER BY t.trade_date` | Line chart, KPI source (current vs previous period match rate) |
| 7 | `ds-sla-breach-summary` | SLA — Breach Summary | `SELECT sla_type, r.code AS region, SUM(CASE WHEN breach THEN 1 ELSE 0 END) AS breach_count, COUNT(*) AS total_events, (SUM(CASE WHEN breach THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0)) * 100 AS breach_rate FROM sla_events s JOIN regions r ON s.region_id = r.id {{filters}} GROUP BY sla_type, r.code ORDER BY breach_count DESC` | Heatmap (sla_type × region), stacked-bar |
| 8 | `ds-recon-volume-by-desk` | Volume — By Desk | `SELECT d.asset_class, d.code AS desk, d.name AS desk_name, COUNT(*) AS txn_count, SUM(t.amount_usd) AS total_usd, AVG(t.amount_usd)::numeric(18,2) AS avg_usd FROM recon_transactions t JOIN desks d ON t.desk_id = d.id {{filters}} GROUP BY d.asset_class, d.code, d.name ORDER BY total_usd DESC` | Treemap (asset_class → desk), drill source |
| 9 | `ds-recon-transactions-scatter` | Transactions — Scatter (Amount vs Fee) | `SELECT id, amount_usd, COALESCE(fee, 0) AS fee, currency_id FROM recon_transactions {{filters}} WHERE amount_usd BETWEEN 0 AND 100000 LIMIT 5000` | Scatter chart — amount vs fee correlation |
| 10 | `ds-recon-currency-distribution` | Transactions — By Currency | `SELECT c.code AS currency, c.name, COUNT(*) AS txn_count, SUM(t.amount_usd) AS total_usd FROM recon_transactions t JOIN currencies c ON t.currency_id = c.id {{filters}} GROUP BY c.code, c.name ORDER BY total_usd DESC LIMIT 15` | Pie / bar of currency distribution |
| 11 | `ds-recon-match-events-by-type` | Match Events — By Type | `SELECT match_type, COUNT(*) AS event_count, AVG(confidence_score)::numeric(5,2) AS avg_confidence FROM recon_match_events {{filters}} GROUP BY match_type ORDER BY event_count DESC` | Funnel / bar — match type distribution |
| 12 | `ds-recon-counterparty-top` | Counterparties — Top by Volume | `SELECT cp.short_name, cp.country_code, cp.tier, COUNT(*) AS txn_count, SUM(t.amount_usd) AS total_usd FROM recon_transactions t JOIN counterparties cp ON t.counterparty_id = cp.id {{filters}} WHERE t.counterparty_id IS NOT NULL GROUP BY cp.short_name, cp.country_code, cp.tier ORDER BY total_usd DESC LIMIT 20` | Bar — top counterparties, grid drill detail |
| 13 | `ds-recon-break-flow-sankey` | Breaks — Flow (Sankey) | `SELECT 'Ingested' AS source, 'Matched' AS target, 80000 AS value UNION ALL SELECT 'Ingested', 'Unmatched', 20000 UNION ALL SELECT 'Unmatched', 'Resolved', 12000 UNION ALL SELECT 'Unmatched', 'Open', 8000` | Sankey — flow visualization (static counts, computed from real aggregates on seed run) |
| 14 | `ds-recon-kpi-scorecard` | KPI Scorecard (radar) | `SELECT 'Match Rate' AS metric, 92.5 AS score, 90.0 AS benchmark UNION ALL SELECT 'Auto-Match %', 81.3, 75.0 UNION ALL SELECT 'SLA Adherence', 88.7, 95.0 UNION ALL SELECT 'Aging < 3d', 72.4, 80.0 UNION ALL SELECT 'Zero Breaks Days', 60.2, 70.0` | Radar chart — 5 quality metrics (pre-computed in SQL) |
| 15 | `ds-recon-account-detail` | Accounts — Full Detail (Grid) | `SELECT a.account_number, a.name, a.type, r.code AS region, c.code AS currency, a.opened_date, a.is_active FROM accounts a JOIN regions r ON a.region_id = r.id JOIN currencies c ON a.currency_id = c.id {{filters}} ORDER BY a.account_number` | Data grid — 5000 rows, pagination, sorting, AG Grid export; drill-down detail source |
| 16 | `ds-recon-transaction-detail` | Transactions — Full Detail (Grid) | `SELECT t.external_ref, t.trade_date, s.code AS status, r.code AS region, d.code AS desk, c.code AS currency, t.amount_usd, cp.short_name AS counterparty FROM recon_transactions t JOIN statuses s ON t.status_id = s.id JOIN regions r ON t.region_id = r.id JOIN desks d ON t.desk_id = d.id JOIN currencies c ON t.currency_id = c.id LEFT JOIN counterparties cp ON t.counterparty_id = cp.id {{filters}} ORDER BY t.trade_date DESC LIMIT 1000` | Transaction detail grid — drill-down from aggregated charts |

**Count: 16 datasets** (exceeds ≥10). Covers every data shape AG Charts + ECharts need. Datasets #9, #13, and #14 are the "shape-forced" datasets for scatter, sankey, and radar respectively — these chart types require specific column layouts.

**Filter mappings** (identical template for all datasets that use global filters — documented once):

```json
"filter_mappings": [
  {"filter_id": "region_code", "sql_expr": "r.code IN ({{values}})"},
  {"filter_id": "status_code", "sql_expr": "s.code IN ({{values}})"},
  {"filter_id": "currency_code", "sql_expr": "c.code IN ({{values}})"},
  {"filter_id": "desk_code", "sql_expr": "d.code IN ({{values}})"},
  {"filter_id": "engine_code", "sql_expr": "e.code = {{value}}"},
  {"filter_id": "date_range_days", "sql_expr": "trade_date {{date_range_clause}}"}
]
```

Datasets that don't JOIN one of `regions`/`statuses`/etc. simply omit those filter mappings. Datasets #13 and #14 have empty `filter_mappings` because they're static SQL.

### 2.2 Charts (target: ≥20, every WORKING supported type)

**USER CORRECTION (2026-04-08):** Only **18 chart types** render their declared type in the current pipeline. The remaining 3 types declared in `SUPPORTED_AG_TYPES` / `ECHART_TYPES` (`bullet`, `box-plot`, `sunburst`) are NOT part of the working set and are EXCLUDED from the Phase 10 curated catalog:

- `bullet` — declared in `SUPPORTED_AG_TYPES` but `ag-chart-wrapper.tsx` lines 179-187 falls back to `type: 'bar'`. Does not render as a bullet.
- `box-plot` — declared in `SUPPORTED_AG_TYPES` but `ag-chart-wrapper.tsx` lines 189-197 falls back to `type: 'bar'`. Does not render as a box plot.
- `sunburst` — declared in `ECHART_TYPES` but requires a hierarchical data transform not wired in. `chart-showcase.json` already skips it.

Chart types actually used from `chart-factory.tsx` (verified):

- **AG (12 working types):** `bar`, `stacked-bar`, `line`, `area`, `pie`, `donut`, `scatter`, `heatmap`, `treemap`, `waterfall`, `combo`, `histogram`
- **ECharts (6 working types):** `sankey`, `radar`, `gauge`, `funnel`, `graph`, `parallel`
- **Total working supported:** **18 types**

Each chart in `recviz_charts` exercises one of these 18 types; multiple charts per type are allowed for variety (e.g., two `bar` charts with different datasets, two `pie` charts).

| # | ID | Name | Chart type | Dataset ID | Column mapping |
|---|-----|------|-----------|-----------|----------------|
| 1 | `chart-txn-trend-line` | Transaction Volume — Daily | `line` | `ds-recon-transactions-daily` | category=`trade_date`, metrics=[`txn_count`] |
| 2 | `chart-txn-trend-area` | Transaction Amount — Daily | `area` | `ds-recon-transactions-daily` | category=`trade_date`, metrics=[`total_usd`] |
| 3 | `chart-txn-by-region-bar` | Transactions by Region | `bar` | `ds-recon-transactions-by-region` | category=`region`, metrics=[`txn_count`] |
| 4 | `chart-txn-by-region-pie` | Transactions by Region (share) | `pie` | `ds-recon-transactions-by-region` | category=`region`, metrics=[`total_usd`] |
| 5 | `chart-txn-status-donut` | Match Status | `donut` | `ds-recon-transactions-by-status` | category=`status`, metrics=[`txn_count`] |
| 6 | `chart-txn-status-stacked` | Status by Region | `stacked-bar` | `ds-recon-transactions-by-region` | category=`region`, metrics=[`txn_count`, `total_usd`] |
| 7 | `chart-breaks-by-type` | Breaks by Type | `bar` | `ds-recon-breaks-summary` | category=`break_type`, metrics=[`break_count`] |
| 8 | `chart-breaks-aging-waterfall` | Aging Waterfall | `waterfall` | `ds-recon-breaks-aging` | category=`bucket`, metrics=[`break_count`] |
| 9 | `chart-breaks-aging-bar` | Aging Distribution | `bar` | `ds-recon-breaks-aging` | category=`bucket`, metrics=[`break_count`] |
| 10 | `chart-volume-desk-treemap` | Desk Volume Treemap | `treemap` | `ds-recon-volume-by-desk` | category=`desk`, metrics=[`total_usd`, `txn_count`] |
| 11 | `chart-txn-scatter` | Amount vs Fee | `scatter` | `ds-recon-transactions-scatter` | metrics=[`amount_usd`, `fee`] (X/Y positional) |
| 12 | `chart-sla-heatmap` | SLA Breach Heatmap | `heatmap` | `ds-sla-breach-summary` | category=`sla_type`, metrics=[`region`, `breach_rate`] (secondary dim in metricColumns[0]) |
| 13 | `chart-txn-combo` | Volume & Amount Combo | `combo` | `ds-recon-transactions-daily` | category=`trade_date`, metrics=[`txn_count`, `total_usd`] |
| 14 | `chart-breaks-histogram` | Break Amount Distribution | `histogram` | `ds-recon-transactions-scatter` | metrics=[`amount_usd`] |
| 15 | `chart-break-flow-sankey` | Break Flow | `sankey` | `ds-recon-break-flow-sankey` | positional: source/target/value |
| 16 | `chart-kpi-radar` | KPI Scorecard | `radar` | `ds-recon-kpi-scorecard` | category=`metric`, metrics=[`score`, `benchmark`] |
| 17 | `chart-match-rate-gauge` | Match Rate Gauge | `gauge` | `ds-recon-match-rate-daily` | metrics=[`match_rate`] (latest row) |
| 18 | `chart-match-funnel` | Match Type Funnel | `funnel` | `ds-recon-match-events-by-type` | category=`match_type`, metrics=[`event_count`] |
| 19 | `chart-recon-graph` | Recon Graph Network | `graph` | `ds-recon-break-flow-sankey` | positional (reuses sankey source/target/value) |
| 20 | `chart-txn-parallel` | Transaction Parallel Coords | `parallel` | `ds-recon-transactions-scatter` | metrics=[`amount_usd`, `fee`] (positional columns) |
| 21 | `chart-currency-pie` | Currency Distribution | `pie` | `ds-recon-currency-distribution` | category=`currency`, metrics=[`total_usd`] |
| 22 | `chart-counterparty-top-bar` | Top 20 Counterparties | `bar` | `ds-recon-counterparty-top` | category=`short_name`, metrics=[`total_usd`] |

**Total: 22 charts** (≥20) covering **all 18 working chart types**. `bullet`, `box-plot`, `sunburst` are NOT in the catalog and NOT tested by Plan 10-02 — they are documented in the UAT runbook as "declared but non-functional (renders as bar / requires hierarchical data)."

Column mapping config lives in `recviz_charts.config.columnMapping` per the `ChartConfigSchema` / `ColumnMappingSchema` Pydantic model (`backend/app/models/managed_chart.py`). Every chart also has an `appearance` block (title, showLegend, legendPosition, showXLabel, showYLabel) — the seed sets sensible defaults (`showLegend: true`, `legendPosition: 'bottom'`, both labels shown except pie/donut/gauge).

### 2.3 KPIs (target: ≥10, all formats × both trends × all threshold bands)

KPI schema (`backend/app/models/managed_kpi.py`):
- `format.type`: `number` | `currency` | `percentage` | `decimal`
- `trend`: `{mode: 'previous_period', period: 'day'|'week'|'month'}` OR `{mode: 'static_target', target_value: float, target_label: string}` OR `null`
- `thresholds`: `{green_above: float, amber_above: float}` (below amber = red)
- `aggregation`: `SUM` | `AVG` | `COUNT` | `MIN` | `MAX` | `COUNT_DISTINCT`

| # | ID | Name | Dataset | metric_column | Aggregation | Format | Trend | Thresholds |
|---|-----|------|---------|---------------|-------------|--------|-------|------------|
| 1 | `kpi-total-transactions` | Total Transactions | `ds-recon-transactions-daily` | `txn_count` | SUM | `number`, abbreviate | previous_period (month) | green_above=80000, amber_above=50000 (green band) |
| 2 | `kpi-total-amount-usd` | Total Amount (USD) | `ds-recon-transactions-daily` | `total_usd` | SUM | `currency`, USD, abbreviate | previous_period (week) | green_above=1e9, amber_above=5e8 |
| 3 | `kpi-match-rate` | Match Rate | `ds-recon-match-rate-daily` | `match_rate` | AVG | `percentage`, 1 decimal | static_target 95.0 "Target" | green_above=90, amber_above=75 (amber band — realistic GRU target) |
| 4 | `kpi-total-breaks` | Total Breaks | `ds-recon-breaks-summary` | `break_count` | SUM | `number`, no abbrev | previous_period (day) | green_above=0 (inverted - high = bad; seed sets green_above=15000, amber_above=25000 for red band demo) |
| 5 | `kpi-avg-aging-days` | Average Aging (days) | `ds-recon-breaks-summary` | `avg_aging` | AVG | `decimal`, 1 decimal | static_target 3.0 "SLA" | green_above=5 (inverted — seed config stays consistent, user reviews) |
| 6 | `kpi-sla-breach-rate` | SLA Breach Rate | `ds-sla-breach-summary` | `breach_rate` | AVG | `percentage`, 2 decimals | previous_period (week) | green_above=5, amber_above=10 (inverted, low = good — document in config) |
| 7 | `kpi-open-breaks` | Open Breaks | `ds-recon-breaks-summary` | `break_count` | SUM | `number`, abbreviate | previous_period (day) | green_above=5000, amber_above=10000 |
| 8 | `kpi-auto-match-pct` | Auto-Match % | `ds-recon-match-events-by-type` | `event_count` | COUNT | `percentage`, 1 decimal | static_target 80.0 "Target" | green_above=75, amber_above=60 |
| 9 | `kpi-high-value-breaks` | High-Value Break $ | `ds-recon-breaks-summary` | `total_break_usd` | SUM | `currency`, USD, abbreviate | previous_period (month) | green_above=1e6, amber_above=5e6 |
| 10 | `kpi-avg-confidence` | Avg Match Confidence | `ds-recon-match-events-by-type` | `avg_confidence` | AVG | `decimal`, 2 decimals | null (no trend) | green_above=0.85, amber_above=0.70 |
| 11 | `kpi-txn-uniques` | Unique References | `ds-recon-transactions-daily` | `txn_count` | COUNT_DISTINCT | `number`, abbreviate | null | null (no thresholds — exercises the "minimal KPI" path) |
| 12 | `kpi-largest-txn` | Largest Transaction | `ds-recon-transactions-daily` | `total_usd` | MAX | `currency`, USD, no abbrev | null | null (MAX aggregation path) |

**Count: 12 KPIs** (≥10). Coverage matrix:

- ✅ **Formats:** `number` (1,4,7,11) × `currency` (2,9,12) × `percentage` (3,6,8) × `decimal` (5,10)
- ✅ **Trends:** `previous_period` — day (4,7), week (2,6), month (1,9) × `static_target` (3,5,8) × `null` (10,11,12)
- ✅ **Threshold states:** Seed data will make each KPI land in a specific band at query-time:
  - Green band: `kpi-match-rate` (real match rate ~92% > 90) — drives the green visual
  - Amber band: `kpi-avg-confidence` will sit ~0.77 (between 0.70 and 0.85) — amber
  - Red band: `kpi-total-breaks` at 20,000 > 15,000 threshold, > 25,000 would be over red — set seed to land 22,000 in amber OR 26,000 in red. **Seed precisely to exercise one KPI in each band.**
- ✅ **Aggregations:** SUM (1,2,4,7,9), AVG (3,5,6,10), COUNT (8), COUNT_DISTINCT (11), MAX (12). No MIN — add one if an extra KPI is needed.

### 2.4 Dashboards (target: 4–5, themed)

Five dashboards, each composed of:
- A global filter bar (same 4 filters across all dashboards for consistency: Region, Status, Currency, Date Range)
- 2-3 KPIs
- 4-5 charts
- ≥1 cross-filter source chart + ≥1 drill-down hierarchy
- Optional drill-down detail grid

Dashboards are stored as rows in `recviz_dashboards` with the `config` JSONB column shaped per `DashboardConfig` Pydantic model (verified field names in camelCase for the JSONB: `features.crossFilter`, `features.drillDown`, `charts[].sourceType`, `charts[].crossFilter`, `charts[].drillHierarchy`, `charts[].drillDetailDataSourceId`).

#### D1: `dash-sla` — SLA Overview

**Theme:** Daily SLA health — breach rate by SLA type, breach by region, time-to-resolve distribution.

**Filters:** Region (multi-select), Status (multi-select), Currency (multi-select), Date Range (preset: 1d/7d/30d/90d/1y/2y)

**KPIs:** `kpi-sla-breach-rate`, `kpi-match-rate`, `kpi-avg-aging-days`

**Charts:**
- `chart-sla-heatmap` (Heatmap, cross-filter SOURCE) — 12 cols × 1 row
- `chart-txn-status-stacked` (Stacked Bar, cross-filter SOURCE) — 6 cols × 1 row
- `chart-breaks-aging-waterfall` — 6 cols × 1 row
- `chart-match-rate-gauge` — 6 cols × 1 row
- `chart-kpi-radar` — 6 cols × 1 row

**Drill hierarchy:** `chart-txn-status-stacked` has `drillHierarchy: ['region', 'status']`, detail = `ds-recon-transaction-detail`.

**Grid:** `ds-recon-transaction-detail` as a drill detail grid, `visibleWhen: null` (always visible at the bottom).

#### D2: `dash-aging` — Break Aging Analysis

**Theme:** What's stale, where, and why.

**Filters:** Region, Status, Currency, Date Range.

**KPIs:** `kpi-avg-aging-days`, `kpi-total-breaks`, `kpi-high-value-breaks`

**Charts:**
- `chart-breaks-aging-bar` (Bar, cross-filter SOURCE) — 6 cols × 1 row
- `chart-breaks-aging-waterfall` — 6 cols × 1 row
- `chart-breaks-by-type` (Bar, cross-filter SOURCE) — 6 cols × 1 row
- `chart-break-flow-sankey` — 12 cols × 1 row

**Drill hierarchy:** `chart-breaks-aging-bar` → `drillHierarchy: ['severity', 'aging_bucket']`, detail = `ds-recon-breaks-summary` (different layout at detail level).

#### D3: `dash-match-rate` — Match Rate Tracker

**Theme:** How well are we auto-matching over time, by desk, by counterparty.

**Filters:** Region, Status, Currency, Date Range.

**KPIs:** `kpi-match-rate`, `kpi-auto-match-pct`, `kpi-avg-confidence`

**Charts:**
- `chart-txn-trend-line` (Line, cross-filter SOURCE) — 12 cols × 1 row
- `chart-match-funnel` (Funnel) — 6 cols × 1 row
- `chart-txn-status-donut` (Donut, cross-filter SOURCE) — 6 cols × 1 row
- `chart-txn-combo` (Combo) — 12 cols × 1 row

**Drill hierarchy:** `chart-txn-trend-line` → `drillHierarchy: ['year', 'month', 'day']` (time-hierarchy drill), detail = `ds-recon-transaction-detail`.

#### D4: `dash-volume` — Volume Dashboard

**Theme:** Where is transaction volume concentrated — by region, desk, counterparty, currency.

**Filters:** Region, Status, Currency, Date Range.

**KPIs:** `kpi-total-transactions`, `kpi-total-amount-usd`, `kpi-largest-txn`

**Charts:**
- `chart-volume-desk-treemap` (Treemap, cross-filter SOURCE) — 12 cols × 1 row
- `chart-txn-by-region-bar` (Bar, cross-filter SOURCE) — 6 cols × 1 row
- `chart-currency-pie` (Pie) — 6 cols × 1 row
- `chart-counterparty-top-bar` (Bar) — 6 cols × 1 row
- `chart-txn-scatter` (Scatter) — 6 cols × 1 row
- `chart-txn-trend-area` (Area) — 12 cols × 1 row — placement per Q-3b resolution, covers the `area` chart type
- `chart-txn-parallel` (Parallel Coords) — 12 cols × 1 row

**Drill hierarchy:** `chart-volume-desk-treemap` → `drillHierarchy: ['asset_class', 'desk']`, detail = `ds-recon-transaction-detail`.

#### D5: `dash-breaks-summary` — Breaks Summary

**Theme:** Executive-level break summary — counts, trends, top offenders.

**Filters:** Region, Status, Currency, Date Range.

**KPIs:** `kpi-total-breaks`, `kpi-open-breaks`, `kpi-high-value-breaks`, `kpi-txn-uniques`

**Charts:**
- `chart-breaks-by-type` (Bar, cross-filter SOURCE) — 6 cols × 1 row
- `chart-txn-status-donut` (Donut, cross-filter SOURCE) — 6 cols × 1 row
- `chart-breaks-histogram` — 6 cols × 1 row
- `chart-recon-graph` (Graph) — 12 cols × 1 row

**Drill hierarchy:** `chart-breaks-by-type` → `drillHierarchy: ['break_type', 'root_cause']`, detail = `ds-recon-breaks-summary`.

### 2.5 Coverage matrix (verification)

| Dashboard | Charts | Cross-filter sources | Drill hierarchies | KPIs | Unique working chart types covered |
|-----------|--------|---------------------|-------------------|------|---------------------------|
| dash-sla | 5 | 2 (heatmap, stacked-bar) | 1 | 3 | heatmap, stacked-bar, waterfall, gauge, radar |
| dash-aging | 4 | 2 (bar, bar) | 1 | 3 | bar, waterfall, sankey |
| dash-match-rate | 4 | 2 (line, donut) | 1 | 3 | line, funnel, donut, combo |
| dash-volume | 7 | 2 (treemap, bar) | 1 | 3 | treemap, bar, pie, scatter, area, parallel |
| dash-breaks-summary | 4 | 2 (bar, donut) | 1 | 4 | bar, donut, histogram, graph |
| **Totals** | **24** | **10** | **5** | **16 (across, some shared)** | **18 working unique types (bullet, box-plot, sunburst EXCLUDED per user correction 2026-04-08)** |

**Chart type coverage of the 18 working types:**

- AG (12 working): ✅ bar, ✅ stacked-bar, ✅ line, ✅ area, ✅ pie, ✅ donut, ✅ scatter, ✅ heatmap, ✅ treemap, ✅ waterfall, ✅ combo, ✅ histogram
- ECharts (6 working): ✅ sankey, ✅ radar, ✅ gauge, ✅ funnel, ✅ graph, ✅ parallel

**Intentionally excluded (NOT tested in Phase 10):** `bullet` (falls back to bar), `box-plot` (falls back to bar), `sunburst` (requires hierarchical data transform not wired). Documented in UAT runbook as "declared but non-functional".

Requirements met:
- ✅ ≥10 datasets (16)
- ✅ ≥20 charts (22 catalogued, covering all 18 working chart types)
- ✅ ≥10 KPIs (12 covering all formats × trends × threshold bands)
- ✅ 4–5 dashboards (5)
- ✅ Each dashboard has ≥2 cross-filter sources
- ✅ Each dashboard has ≥1 drill hierarchy
- ✅ Each dashboard has a global filter bar with the same 4 filters

---

## Section 3: Mock Cleanup Plan

The acceptance gate D-15.3 is **"zero mock/fallback paths render anywhere in the frontend."** The audit is three-pronged per D-16. This section enumerates the known offenders identified via codebase grep and `.planning/codebase/CONCERNS.md`, plus files and lines for each.

### 3.1 Frontend dead hooks — DELETE

| File | Lines | Why dead | Safe to delete? |
|------|-------|---------|-----------------|
| `frontend/src/hooks/use-chart-data.ts` | all 45 | Reads `s.globalFilters` which doesn't exist on the store → returns `undefined`. Hits `/api/charts/{id}/data` which is the legacy hardcoded-ID router. | **YES** — grep confirms NO consumer imports this hook. [VERIFIED: `grep` across src excluding own file] |
| `frontend/src/hooks/use-kpi-data.ts` | all | Same `s.globalFilters` bug. Hits `/api/custom/kpi`. | **YES** — no consumer. |
| `frontend/src/hooks/use-breaks-data.ts` | all | Same bug + hits `/api/datasets/5/data` which doesn't exist. | **YES** — no consumer. |
| `frontend/src/hooks/use-prefetch.ts` | all 41 | Hardcodes chart IDs `break-trend`, `breaks-by-category`, etc. Hits legacy `/api/charts/*/data` and `/api/custom/kpi`. | **YES** — no consumer. Replace with a no-op OR delete the file. |

**Action (seed PR 10-01):** `rm frontend/src/hooks/use-{chart,kpi,breaks}-data.ts frontend/src/hooks/use-prefetch.ts`.

### 3.2 Frontend types barrel — DELETE

| File | Why offending | Safe to delete? |
|------|---------------|-----------------|
| `frontend/src/types/index.ts` | `export type * from './api' ...` — barrel export against CLAUDE.md convention "No barrel exports." | **YES** — grep for `from '@/types'` or `from '@/types/index'` returned 0 matches. All existing imports go directly to `@/types/chart`, `@/types/filter`, etc. |

**Action:** `rm frontend/src/types/index.ts`.

### 3.3 Frontend Rules of Hooks violation — FIX

| File | Lines | Violation | Fix |
|------|-------|-----------|-----|
| `frontend/src/components/charts/ag-chart-wrapper.tsx` | 378-379 | `useRef<HTMLDivElement>(null)` and `useState<{width, height} \| null>(null)` called AFTER early returns on lines 349-376 (`if (missingColumns.length > 0)`, `if (isLoading)`, `if (error)`, `if (!data?.data?.length)`). React throws "Rendered fewer hooks than expected" in dev. | Move both hook calls to the top of the component alongside the existing `useRef(null)` on line 230. Restructure: declare `containerRef`, `containerSize`, and the `useEffect` ResizeObserver wiring immediately after the existing `useState(() => getAgChartsTheme())` on line 246. |

**Action:** Edit `ag-chart-wrapper.tsx` to hoist the two hooks. Verify with `pnpm vitest run chart-factory`. Add a new unit test case that renders `<AgChartWrapper>` in each of the four early-return states and confirms no "Rendered fewer hooks than expected" warning.

### 3.4 Backend legacy charts router — DELETE

| File | Lines | Why delete | Risk |
|------|-------|-----------|------|
| `backend/app/api/charts.py` | all 290 | `CHART_DATASOURCE_MAP` + `CHART_QUERIES` hardcode Superset dataset IDs 3, 4, 5, 6 — these IDs won't exist after the Phase 10 re-seed. `/api/charts/{id}/data` is the legacy per-chart endpoint replaced entirely by config-driven `/api/data-sources/{id}/query`. `list_charts` / `get_chart` call Superset's chart API — these are Superset SLI charts, NOT managed charts, not used by the app. | **LOW** — no frontend hook that Phase 10 keeps calls this endpoint. Rewritten `use-prefetch.ts` is deleted; `use-chart-data.ts` is deleted. The managed-charts router `/api/charts/managed` is a different prefix and stays. |

**Action:** Delete the file, remove its import from `backend/app/api/router.py` (line 5 + line 28). Run `pytest backend/tests/` to confirm nothing broke.

### 3.5 Backend legacy custom router — DELETE

| File | Lines | Why delete | Risk |
|------|-------|-----------|------|
| `backend/app/api/custom.py` | all 216 | `/api/custom/kpi` hardcodes dataset IDs 5 and 6. `/api/custom/aggregations` defaults to dataset 5. `/api/custom/counterparties` hardcodes dataset 3. All rely on Superset dataset IDs that won't exist after re-seed. Modern KPIs go through `/api/dashboards/{id}/kpis` or directly through managed datasets. | **LOW** — grep `api/custom` in `frontend/src` returns only `use-prefetch.ts` (which is being deleted) and possibly dead hooks (also being deleted). |

**Action:** Delete the file, remove its import from `router.py` (line 6 + line 33). Run pytest.

### 3.6 Backend SQL query history — KEEP (reviewed)

| File | Lines | Concern | Decision |
|------|-------|---------|----------|
| `backend/app/api/sql.py` | 18 `_query_history: list[dict] = []` | In-memory list resets on restart. Unbounded growth. Capped on read to 50. | **KEEP AS-IS** for Phase 10. SQL Explorer is a dev-team tool. Query history is ephemeral and useful during a session. Moving to Redis is post-v1 work. The Phase 10 UAT runbook should still verify the SQL Explorer query history displays correctly after running 2-3 queries (D-16.3 validation). |

### 3.7 Backend saved views / export — EXEMPT

| File | Concern | Decision |
|------|---------|----------|
| `backend/app/api/views.py` | `_views: dict = {}` in-memory | **EXEMPT** per D-17 — Saved Views (SHAR-01) is deferred to next milestone, scaffold stays untouched. |
| `backend/app/api/export.py` | `_jobs: dict = {}`, returns `{"status": "pending"}` | **EXEMPT** per D-17 — Reports/Export already render explicit "Coming Soon" empty states. The buttons on chart/grid toolbars currently use inline CSV/PNG export (via `chart-export.ts` + AG Grid's built-in CSV/Excel export), NOT `/api/export/pdf` or `/api/export/excel`. Verify during UAT that the toolbar export buttons still work via the browser path, not the stub endpoints. |

### 3.8 Frontend "Coming Soon" Reports page — EXEMPT

| File | Concern | Decision |
|------|---------|----------|
| `frontend/src/routes/_app/reports/index.tsx` | Static placeholder ("coming soon") | **EXEMPT** per D-17. Verify during UAT that it renders the honest empty state (not a broken attempt to show data). |

### 3.9 Grep-based secondary audit

Plan 10-01 / 10-02 must run the following grep sweep and address any hits not in the table above:

```bash
# In backend/
grep -rn "\"pending\"" backend/app/api/ --include="*.py"        # Export stubs expected
grep -rn "hardcoded" backend/app --include="*.py"               # Dev comments flagging temp code
grep -rn "mock\|fixture\|placeholder" backend/app --include="*.py" | grep -v test   # Non-test mocks
grep -rn "TODO.*Phase.*data\|FIXME.*data" backend/app/          # Open data work
grep -rn "datasource_id.*=.*[0-9]\+" backend/app/              # Hardcoded dataset IDs

# In frontend/
grep -rn "lorem\|Lorem Ipsum" frontend/src --include="*.tsx"
grep -rn "placeholder\|mock\|fake" frontend/src/hooks --include="*.ts" | grep -v test
grep -rn "TODO.*data\|FIXME.*data" frontend/src/ --include="*.ts*"
grep -rn '\"chart-[a-z-]*\"' frontend/src --include="*.ts*" | grep -v e2e | grep -v test  # Hardcoded chart slugs
```

Any hit not already enumerated in §3.1-3.8 becomes a Plan 10-02 inline fix or spawns a decimal sub-phase.

### 3.10 Mock cleanup acceptance criteria

Plan 10-03 cannot post "ready for UAT" until:

1. All files in §3.1 are deleted
2. `frontend/src/types/index.ts` is deleted
3. `ag-chart-wrapper.tsx` Rules of Hooks violation is fixed + test added
4. `backend/app/api/charts.py` and `custom.py` are deleted + router.py cleaned up
5. The grep sweep §3.9 returns zero unexpected hits
6. Backend + frontend start cleanly with no 404s during initial page loads (watch browser Network tab)
7. No chart on any dashboard renders the "Column mapping error" or "Unsupported chart type" or "No data available" panel unless deliberately (empty-filter default state is acceptable; stuck-empty with filters applied is not)

---

## Section 4: E2E Spec Rewrite Plan

All 7 existing specs are rewritten in Plan 10-01 against the new curated catalog. The plan:

### Spec 1: `chart-showcase.spec.ts` → `dashboard-smoke.spec.ts` (rename or keep filename)

**Current:** Navigates `/dashboards/chart-showcase`, waits for Bar Chart, iterates 12 chart titles, asserts no error panels, asserts canvas or ECharts present.

**Rewrite:** Navigate to each of the 5 curated dashboards in turn. Per dashboard:
1. Navigate to `/dashboards/dash-{slug}`
2. Wait for dashboard title (`h1` with dashboard name) — deterministic selector
3. Wait for all skeletons to disappear (`data-slot="skeleton"` count = 0)
4. Assert no error panels (`text=Column mapping error`, `text=Unsupported chart type`, `text=Failed to load`, `text=Data source not found`)
5. Assert at least one `canvas` OR `[_echarts_instance_]` is rendered inside the main content area
6. Assert the KPI row has ≥3 numeric values (not `—` or blank)

**Chart type loop:** Per dashboard, parameterize across the chart titles listed in §2.4. One test per dashboard/chart pair asserting the chart card is visible and contains a canvas or ECharts instance (same pattern as current spec).

### Spec 2: `tlm-stats-regression.spec.ts` → remove or repurpose

**Current:** Loads `/dashboards/tlm-stats`, waits for "TLM Statistics" text.

**Rewrite:** The `tlm-stats` dashboard is DELETED in Plan 10-01. Options:
- **(A)** Delete this spec file entirely (preferred — we have `dashboard-smoke.spec.ts` for smoke coverage)
- **(B)** Repurpose as a regression for one specific dashboard (e.g., `dash-sla`) that asserts no column mapping errors after filter apply (the original intent of this spec).

**Recommendation:** Option A — delete. The new `dashboard-smoke.spec.ts` covers the intent.

### Spec 3: `share-link.spec.ts`

**Current:** Seeds an ephemeral dashboard via `POST /api/dashboards/managed`, tests URL filter sync + share button + back-button behavior.

**Rewrite:** Switch from seed-ephemeral to pointing at the stable curated dashboards. Use `/dashboards/dash-sla?filter.region_code=NAM` and verify the URL filter sync writes/reads properly. Drop the ephemeral POST/DELETE.

**Why:** Seed-ephemeral works but the test is slow and can leak rows if a `finally` misfires. Stable IDs + curated data is cleaner. The test becomes a genuine regression against real data.

**Exception:** The "back button does NOT unwind filter changes" test still works against a stable dashboard.

### Spec 4: `embed.spec.ts`

**Current:** Seeds an ephemeral dashboard for each of 7 tests.

**Rewrite:** Use stable `/embed/dashboards/dash-sla` as the base URL. Replace every ephemeral seed with direct navigation. Replace `seeded.name` assertions with the known dashboard name ("SLA Overview" or similar). Drop all `finally { deleteDashboard }`.

**Why:** Same reason — faster, cleaner, tests what users actually hit.

### Spec 5: `dashboard-edit-regression.spec.ts`

**Current:** Seeds ephemeral dashboard, navigates to `/dashboards/{id}/edit`, asserts BuilderPage renders without errors.

**Rewrite:** Navigate to `/dashboards/dash-sla/edit` (stable dashboard). Assert BuilderPage renders with the chart panels visible. Assert zero console errors. Drop ephemeral seed.

### Spec 6: `dashboard-view-regression.spec.ts`

**Current:** Seeds ephemeral dashboard, navigates to `/dashboards/{id}`, asserts title h1 + no "Dashboard not found" + no console errors.

**Rewrite:** Navigate to `/dashboards/dash-volume` (or any stable curated dashboard). Same assertions. Drop ephemeral seed.

### Spec 7: `command-palette.spec.ts`

**Current:** Seeds ephemeral dashboard/chart/dataset/KPI, opens palette, searches by generated name with timestamp.

**Rewrite:** Search for stable curated names: `SLA Overview`, `Total Transactions`, `Transactions — Daily Volume`, etc. Verify result groups render in the fixed order (Dashboards → Charts → Datasets → KPIs). Verify navigation goes to the correct routes:
- Dashboard → `/dashboards/dash-sla`
- Chart → `/charts/chart-txn-trend-line/edit`
- Dataset → `/datasets/ds-recon-transactions-daily/edit`
- KPI → `/kpis/kpi-match-rate/edit`

Drop ephemeral seed/cleanup.

### Shared helper refactor

All rewritten specs can share a helper file `frontend/e2e/_fixtures.ts` containing:

```typescript
export const CURATED_DASHBOARDS = {
  sla: { id: 'dash-sla', name: 'SLA Overview' },
  aging: { id: 'dash-aging', name: 'Break Aging Analysis' },
  matchRate: { id: 'dash-match-rate', name: 'Match Rate Tracker' },
  volume: { id: 'dash-volume', name: 'Volume Dashboard' },
  breaksSummary: { id: 'dash-breaks-summary', name: 'Breaks Summary' },
} as const

export async function waitForDashboardLoad(page: Page, dashboardName: string) {
  await page.locator('h1', { hasText: dashboardName }).waitFor({ state: 'visible', timeout: 15_000 })
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0, { timeout: 15_000 })
}
```

All rewritten specs import `CURATED_DASHBOARDS` and use `waitForDashboardLoad` — DRYs up the 7 files. This is a minor refactor and fits within Plan 10-01.

---

## Section 5: Plan 10-02 Autonomous Walkthrough Page List

Per D-12, Plan 10-02 walks every page in the app with Playwright MCP. Grouped by feature area, with the stable curated IDs from §2.4. The walkthrough must visit EACH of these URLs and run the listed checks.

### 5.1 Dashboards area

| # | URL | Check |
|---|-----|-------|
| 1 | `/dashboards` | List loads, 5 curated dashboards visible, search filter works |
| 2 | `/dashboards/dash-sla` | Renders, KPIs show values, all 6 charts render, cross-filter click activates, drill click navigates |
| 3 | `/dashboards/dash-sla?filter.region_code=NAM` | URL filter hydration works, URL round-trip clean |
| 4 | `/dashboards/dash-sla/edit` | BuilderPage opens, chart panels visible, save button present |
| 5 | `/dashboards/dash-aging` | Same checks as dash-sla |
| 6 | `/dashboards/dash-aging/edit` | Builder loads |
| 7 | `/dashboards/dash-match-rate` | Same |
| 8 | `/dashboards/dash-match-rate/edit` | Builder loads |
| 9 | `/dashboards/dash-volume` | Same |
| 10 | `/dashboards/dash-volume/edit` | Builder loads |
| 11 | `/dashboards/dash-breaks-summary` | Same |
| 12 | `/dashboards/dash-breaks-summary/edit` | Builder loads |
| 13 | `/dashboards/new` | BuilderPage in create mode, empty state visible |

### 5.2 Charts area

| # | URL | Check |
|---|-----|-------|
| 14 | `/charts` | Chart library list, 24 charts visible, search + filter by chart type |
| 15 | `/charts/new` | Chart builder wizard step 1 (dataset picker) loads |
| 16 | `/charts/chart-txn-trend-line/edit` | Edit mode loads existing chart config, preview renders |
| 17 | `/charts/chart-sla-heatmap/edit` | Heatmap chart edits correctly |
| 18 | `/charts/chart-break-flow-sankey/edit` | ECharts sankey edits correctly |

One chart of each "risky" type (AG heatmap, ECharts sankey, treemap, waterfall, combo) walked. Not all 24 — 5-6 representative.

### 5.3 KPIs area

| # | URL | Check |
|---|-----|-------|
| 19 | `/kpis` | KPI library list, 12 KPIs visible, search + filter |
| 20 | `/kpis/new` | KPI builder loads |
| 21 | `/kpis/kpi-match-rate/edit` | Edit mode loads, preview card shows correct value, static_target trend renders |
| 22 | `/kpis/kpi-total-transactions/edit` | previous_period trend renders |
| 23 | `/kpis/kpi-avg-confidence/edit` | decimal format + no trend renders |

### 5.4 Datasets area

| # | URL | Check |
|---|-----|-------|
| 24 | `/datasets` | Dataset library list, 16 datasets visible, search |
| 25 | `/datasets/new` | Dataset creator loads (Monaco SQL editor) |
| 26 | `/datasets/ds-recon-transactions-daily/edit` | Edit loads SQL + columns, preview runs against real data |
| 27 | `/datasets/ds-recon-transaction-detail/edit` | Grid-source dataset edits |

### 5.5 Explorer

| # | URL | Check |
|---|-----|-------|
| 28 | `/explorer` | Monaco loads, schema browser shows 8 dim + 4 fact tables, run SELECT query works, query history shows the run |

### 5.6 Settings

| # | URL | Check |
|---|-----|-------|
| 29 | `/settings` | Theme toggle visible, data-sources section visible with 4 logical databases |

Note: `/settings/data-sources` is NOT a separate route in the current codebase — settings is a single page with sections. The walkthrough verifies both theme and data-source UI are present on `/settings`.

### 5.7 Embed mode

| # | URL | Check |
|---|-----|-------|
| 30 | `/embed/dashboards/dash-sla` | Chromeless, topbar shows "Open in RecViz", data renders |
| 31 | `/embed/dashboards/dash-sla?theme=dark` | Dark mode applied to html tag |
| 32 | `/embed/dashboards/dash-sla?filter.region_code=EMEA` | Filter pre-applied |
| 33 | `/embed/dashboards/dash-sla?filter.lock=region_code` | Region filter is disabled |
| 34 | `/embed/dashboards/dash-sla?hide=filter-bar,title,toolbar` | All three surfaces hidden |

### 5.8 Command palette

| # | Action | Check |
|---|--------|-------|
| 35 | Press `Cmd+K` (or `Meta+k`) anywhere | Palette opens, placeholder reads "Search dashboards, charts, datasets, KPIs..." |
| 36 | Type "SLA" | `SLA Overview` appears under "Dashboards" group |
| 37 | Type "Match" | Match Rate chart + Match Rate Tracker dashboard + Match Rate KPI + KPI results appear under respective groups in correct order |
| 38 | Press Enter on a chart result | Navigates to `/charts/{id}/edit` |
| 39 | Press Enter on a dataset result | Navigates to `/datasets/{id}/edit` |
| 40 | Press Enter on a KPI result | Navigates to `/kpis/{id}/edit` |

### 5.9 Share link

| # | Action | Check |
|---|--------|-------|
| 41 | On a dashboard, apply a filter | URL updates with `filter.region_code=NAM` |
| 42 | Click "Share" button | Toast shows "Link copied", clipboard contains the URL |

### 5.10 Dashboard interaction (INTR-*)

| # | Action | Check |
|---|--------|-------|
| 43 | Click a chart segment on `dash-volume` | Cross-filter bar appears, "Filtered by: ..." |
| 44 | Click "Clear all" on cross-filter bar | Bar disappears, charts reset |
| 45 | Double-click a bar chart on `dash-volume` | Drill breadcrumb appears, detail level loads |
| 46 | Click "Overview" in drill breadcrumb | Returns to top of drill |
| 47 | Click fullscreen icon on a chart | Chart opens in fullscreen modal |
| 48 | Click chart export → PNG | File downloads |
| 49 | Click chart export → CSV | File downloads |
| 50 | Click chart export → Copy to clipboard | Toast "Copied to clipboard" |
| 51 | Click grid export → CSV | File downloads |
| 52 | Click grid export → Excel | File downloads |
| 53 | Click manual refresh button on dashboard | Skeletons flash, data re-renders |
| 54 | Wait for auto-refresh (or fast-forward via devtools) | Data re-fetches automatically |

### 5.11 Reports + SQL execute + data source management

| # | Action | Check |
|---|--------|-------|
| 55 | `/reports` | Shows "Coming soon" empty state (per D-17, exempt from data audit) |
| 56 | `/explorer` — run `SELECT COUNT(*) FROM recon_transactions` | Returns 100000 |
| 57 | `/settings` → data sources | All 4 logical databases show "Connected" status |

**Total: 57 checkpoints.** Each is an atomic verification. Plan 10-02 runs through them in order, logs result to `10-UAT-RUNBOOK.md` as `[Claude-checked]` or `[ISSUE: ...]`, fixes issues as they arise per D-12.

---

## Section 6: Risks, Unknowns, Open Questions

### Q-1: Dataset sync stale cleanup (HIGH risk)

**What's uncertain:** Does `DatasetSyncService.sync_all()` (backend startup) clean up stale Superset virtual datasets whose source tables were dropped by the new seed? If not, the old showcase + tlm datasets linger in Superset metadata, potentially causing drill-down detail queries to fail with "relation does not exist" if the frontend somehow resolves to an old Superset dataset ID.

**Mitigation in Plan 10-01:**
1. Before running the seed, stop the backend
2. After running the seed, either:
   - (A) Truncate Superset's dataset table directly (risky — Superset may cache IDs)
   - (B) Restart Superset container so it re-reads metadata (safest)
   - (C) Walk Superset UI via its own API and delete stale virtual datasets (cleanest but complex)
3. Verify during `10-02` autonomous walk by hitting `/api/datasets/managed` and checking `sync_status` of every seed dataset shows `'synced'` with a live `superset_id`

**Recommendation:** Document the full reset sequence in Plan 10-01:
```
docker compose down -v     # wipes superset_meta including Superset's own tables
docker compose up -d
wait for Superset health
python scripts/seed-postgres.py
wait for backend auth on startup
backend sync_all() runs
verify via /api/datasets/managed
```

### Q-2: Redis cache flush

**What's uncertain:** Superset caches query results in Redis. After the data wipe + re-seed, cached results reference old data. Cache keys are tied to dataset IDs + query hashes, so new datasets get new keys and the stale entries just expire naturally. **BUT** if a curated dataset's ID matches a previous ID (unlikely with new slugs), cached results could be served stale.

**Mitigation:** The new slugs (`ds-recon-*`) are completely different from the old (`showcase_*`, `tlm_*`), so key collision is impossible. No cache flush needed.

**Sanity check:** Add a single `redis-cli flushdb` step in the seed script runbook instructions, as a belt-and-braces measure. Document as optional.

### Q-3: Sunburst chart — include or skip

**Current state:** Existing `chart-showcase.json` explicitly comments that sunburst is skipped because the SQL pipeline returns flat rows and sunburst needs hierarchical JSON.

**Options:**
- **(A)** Skip sunburst from catalog entirely. Document the skip in the UAT runbook under "Known limitations."
- **(B)** Add a data source that returns flat rows AG Charts wrapper then transforms to hierarchical JSON before passing to ECharts. This requires a code change in `echart-wrapper.tsx` — probably scope creep for Phase 10.
- **(C)** Hand-write hierarchical JSON as a fixture and serve it via a NEW endpoint that returns the nested structure. Violates "no mock fallback" rule in spirit.

**Recommendation:** **Option A — skip, document.** 20 chart types × 5 dashboards is enough coverage. Sunburst's omission is already known. If the user rejects this during discussion, Plan 10-01 expands to include a minimal code change in `echart-wrapper.tsx` to detect and transform flat rows → hierarchical (small, contained).

### Q-4: Decimal sub-phase error budget

**What's uncertain:** How many decimal sub-phases (10.1, 10.2, …) is "too many" before we should stop and re-plan?

**Recommendation (Claude's discretion):** **Hard ceiling of 10 sub-phases.** If Plan 10-02 spawns 10.1–10.10 and there are still blocking issues, that's a signal the seed or the code has a structural defect that a plan loop can't fix. Pause, post a summary, and ask the user whether to continue, rewind, or take a different approach.

Soft warning at **5** sub-phases: Claude posts a status update to `10-DISCUSSION-LOG.md` reporting what's been fixed and what's still broken, so the user has a checkpoint.

### Q-5: Perf observations at 100k — first-load budget

**What's uncertain:** Will initial dashboard load at 100k feel "fast enough" on a dev machine? The dashboards join 3-4 tables with GROUP BY. Superset caches so second load is fast. First load (cold cache) is the concern.

**Known (from research rigor feedback):** Don't dismiss perf based on toy assumptions. Realistic number: a 100k JOIN + GROUP BY + index scan on PostgreSQL 16 on a modern dev machine should complete in ~200-500ms. Cold Superset cache adds 50-100ms overhead. Full dashboard first-load (parallel fetches) should be under 2s. [ASSUMED — to be measured in Plan 10-03]

**Action:** `10-PERF-OBSERVATIONS.md` records first-load timing for each curated dashboard. No budget, just data. Warning flagged if any dashboard takes >5s cold — that's phase 11 scope, not a Phase 10 blocker.

### Q-6: High-cardinality column on scatter chart

**What's uncertain:** `chart-txn-scatter` queries `ds-recon-transactions-scatter` which does `LIMIT 5000` — does AG Charts render 5000 scatter points performantly?

**Known:** AG Charts Enterprise 13 renders ~5000 scatter points fine on canvas. 10,000+ starts to stutter.

**Action:** Keep the `LIMIT 5000` in the SQL. Plan 10-03 records actual render time in perf observations.

### Q-7: Realistic monetary distribution that lands KPIs in each threshold band

**What's uncertain:** §2.3 calls for one KPI in green, one in amber, one in red. Seeding precisely to hit target values requires careful data math.

**Mitigation:** Plan 10-01 task 1 (schema + row generation) includes an explicit verification step: after inserting facts, run the KPI SQL directly against the seeded data and confirm each threshold-banded KPI lands in its intended band. If not, adjust the seed generator parameters and re-run.

### Q-8: Seed script run time at 100k

**What's uncertain:** How long does the seed script take to run at 100k facts?

**Estimate:** `psycopg2.executemany` in batches of 5k on localhost PostgreSQL runs at ~10k rows/sec. 100k facts = ~10 seconds. +20k breaks + 80k match events + 5k SLA events + 5k accounts + etc. ≈ **total 30-60 seconds**. That's acceptable for a dev reset. If it pushes past 2 minutes, switch to `COPY FROM STDIN` via `cur.copy_expert()`.

### Q-9: "Reports" route exempt status — verify honest empty state

**What's uncertain:** Does `/reports` definitely render the Shadcn `Empty` component as described, and not a broken attempt at data? Plan 10-02 walkthrough #55 verifies directly.

---

## Section 7: Validation Architecture

Per `nyquist_validation: true` in `.planning/config.json`, this phase needs an explicit validation architecture. Phase 10 is unusual: it IS the validation phase — its deliverable includes the UAT runbook and the smoke pass. This section describes the validation infra for the test bed work itself (Plan 10-01), not the UAT (which is the phase output).

### Test Framework

| Property | Value |
|----------|-------|
| Frontend unit | Vitest 4.1 (existing) |
| Frontend E2E | Playwright 1.59 (existing) |
| Backend unit | pytest (existing, no config file) |
| Config file (Vitest) | `frontend/vitest.config.ts` |
| Config file (Playwright) | `frontend/playwright.config.ts` |
| Config file (pytest) | none — default discovery |
| Quick run command (frontend unit) | `cd frontend && pnpm vitest run --reporter=verbose` |
| Quick run command (frontend E2E) | `cd frontend && pnpm exec playwright test --reporter=list` |
| Quick run command (backend) | `cd backend && python -m pytest tests/ -v` |
| Full suite command | `cd frontend && pnpm vitest run && pnpm exec playwright test && cd ../backend && python -m pytest tests/` |

### Phase requirements → test map

Phase 10 revalidates all v1 REQs. The validation strategy is 4-layered:

1. **Seed script validation** (Plan 10-01): Python unit tests against the seed script verifying each row-count target is met and each threshold-banded KPI lands in its band.
2. **Rewritten E2E smoke** (Plan 10-01): 7 Playwright specs pointing at stable curated entities; run via `pnpm exec playwright test`.
3. **Autonomous Claude walkthrough** (Plan 10-02): 57 checkpoints via Playwright MCP; result logged to `10-UAT-RUNBOOK.md`.
4. **Manual user UAT** (Plan 10-03 → user step): User walks the runbook, ticks checkboxes.

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFR-04 | No mock/fallback rendering | Grep sweep + UAT | Custom bash (§3.9) + Playwright smoke | ❌ Wave 0 (add grep sweep script) |
| INFR-05 | Number formatting | unit | `pnpm vitest run lib/formatters` | ✅ existing |
| INFR-06 | Legacy dead code removed | Grep sweep | Custom bash (§3.9) | ❌ Wave 0 (same script) |
| INTR-01..02 | Cross-filter | e2e | `pnpm exec playwright test dashboard-smoke.spec.ts` | 🔨 rewrite |
| INTR-03..04 | Drill-down | e2e | same | 🔨 rewrite |
| INTR-05 | Fullscreen | manual UAT | — | ✅ walkthrough |
| INTR-06 | Chart export | unit + manual UAT | `pnpm vitest run chart-export` + walk | ✅ existing |
| INTR-07 | Grid export | unit + manual UAT | `pnpm vitest run grid-toolbar` + walk | ✅ existing |
| INTR-08..09 | Refresh | unit + manual UAT | `pnpm vitest run use-auto-refresh` + walk | ✅ existing |
| DSET-01..05 | Dataset CRUD | backend unit + manual UAT | `pytest backend/tests/test_managed_datasets.py` | ✅ existing |
| CHRT-01..07 | Chart library + types | backend unit + e2e | `pytest backend/tests/test_managed_charts.py` + smoke | ✅ existing |
| KPI-01..03 | KPI library | backend unit + manual UAT | `pytest backend/tests/test_managed_kpis.py` + walk | ⚠ may not exist — verify in Wave 0 |
| BLDR-01..08 | Dashboard builder | e2e + manual UAT | `dashboard-edit-regression.spec.ts` + walk | 🔨 rewrite |
| SHAR-02..04 | Sharing | e2e | `share-link.spec.ts`, `embed.spec.ts`, `command-palette.spec.ts` | 🔨 rewrite (all 3) |

### Sampling rate

- **Per task commit:** `pnpm vitest run` (frontend) + `python -m pytest backend/tests/` (~1 min total) — unit tests only
- **Per wave merge:** Full suite including Playwright E2E (~5 min total)
- **Phase gate:** Autonomous Playwright MCP walkthrough green + full test suite green + grep sweep clean → user takes over for UAT

### Wave 0 gaps

Plan 10-01 must include a Wave 0 before touching production code:

- [ ] `scripts/mock-audit.sh` — grep sweep script encapsulating §3.9 greps. Exit code 0 = clean, nonzero = offenders found. Re-runnable locally and in 10-02 post-fix verification.
- [ ] `frontend/e2e/_fixtures.ts` — shared E2E fixture file with `CURATED_DASHBOARDS` map and `waitForDashboardLoad` helper (§4 shared helper).
- [ ] `backend/tests/test_seed_script.py` — new test file that imports the seed script as a module and unit-tests its row-generation helpers (deterministic output, correct cardinalities). May need to refactor `scripts/seed-postgres.py` to expose generator functions without calling `main()` at import time.
- [ ] Verify `backend/tests/test_managed_kpis.py` exists (KPI CRUD tests may have been skipped in Phase 7). If missing, add it as Wave 0.

### Playwright MCP smoke pass acceptance criteria (per dashboard, per D-11)

For each of 5 curated dashboards:

1. **Load**: Page loads, dashboard title visible, no "Dashboard not found" fallback
2. **No error panels**: Zero instances of `text=Column mapping error`, `text=Unsupported chart type`, `text=Failed to load`, `text=Data source not found`, `text=No data available` (with filters applied)
3. **No stuck skeletons**: `[data-slot="skeleton"]` count = 0 after 15s
4. **Chart content**: Each chart card has a `canvas` or `[_echarts_instance_]` or `.ag-charts-wrapper` element
5. **KPI row populated**: All KPIs show a numeric value (not `—`, not blank)
6. **Cross-filter**: Clicking a segment on a cross-filter source chart activates `text=Filtered by` bar
7. **Drill down**: Double-clicking a drill-source chart surfaces a `text=Overview` breadcrumb
8. **Filter bar**: Shadcn Select `[data-slot="select-trigger"]` for region filter visible
9. **Palette**: Pressing `Meta+K` opens palette, dashboard name is findable
10. **Screenshot**: Claude captures a screenshot and visually verifies no obvious broken rendering (blank areas, overflow, wrong colors)

### Mock audit acceptance criteria

- `scripts/mock-audit.sh` exits 0
- All offenders in §3.1-3.9 are addressed (deleted, fixed, or exempted with documented reason)
- Every chart in every dashboard shows real data (no hardcoded fabricated numbers visible in the UI)
- Every KPI in every dashboard computes against the seed (verify by changing a filter and watching the KPI value change)

### UAT runbook completion criteria

- Every checkbox in `10-UAT-RUNBOOK.md` is `[x]` (ticked by user)
- No unresolved `**Issue:**` notes
- All P0 and P1 issues have a resolution log entry (fix commit hash or explicit defer)
- User posts "UAT PASS" in the GSD state log

### Perf observation deliverable spec (`10-PERF-OBSERVATIONS.md`)

Plain markdown table shape:

```markdown
# Phase 10 — Performance Observations

**Measured:** {date}
**Dataset:** 100k recon_transactions + 20k breaks + 80k match events + 5k SLA events
**Hardware:** {dev machine spec}
**Filter set:** All dashboards with 'Region: NAM', 'Date Range: 30 days'

## First-load timing (cold Superset cache)

| Dashboard | Wall time (cold) | Wall time (warm) | Notes |
|-----------|------------------|------------------|-------|
| dash-sla | — ms | — ms | — |
| dash-aging | — ms | — ms | — |
| dash-match-rate | — ms | — ms | — |
| dash-volume | — ms | — ms | — |
| dash-breaks-summary | — ms | — ms | — |

## Interaction timing

| Action | Target dashboard | Response time | Notes |
|--------|------------------|---------------|-------|
| Apply filter (region=EMEA) | dash-sla | — ms | — |
| Cross-filter click | dash-volume | — ms | Client-side, should be <16ms |
| Drill down click | dash-volume | — ms | Network fetch for detail level |
| Command palette query "SLA" | — | — ms | Target <200ms |
| Full-page refresh | dash-sla | — ms | — |

## Observations

- {free-form notes from Claude during the walk — which dashboards felt slow, which cache hits, which surprising fast spots}

## Phase 11 recommendations

- {items to carry forward — e.g., "dashboard-renderer mounts 3 useQuery hooks per chart; at 1M rows this will thrash"}
```

No assertions. No thresholds. Pure observational data.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 100k rows × 5-table JOIN + GROUP BY runs in ~200-500ms on PostgreSQL 16 localhost | Q-5 | If 10x slower, user may perceive phase 10 as "unusable" and force scope expansion |
| A2 | `DatasetSyncService.sync_all()` cleans up stale Superset virtual datasets whose source tables were dropped | Q-1 | High — drill-down detail queries may 500 with "relation does not exist" |
| A3 | Superset caches expire naturally when dataset IDs change (new slug = new key) | Q-2 | Low — cache keys are hash-based; should evict naturally |
| A4 | Sunburst can be safely omitted from the catalog without violating D-04 "every supported type" | Q-3 / §2.2 | Medium — user may reject and force scope expansion |
| A5 | Playwright MCP is available for autonomous walkthrough (Plan 10-02) | §Environment Availability | High — if unavailable, Plan 10-02 falls back to slower manual Playwright spec authoring |
| A6 | 10 decimal sub-phases is the reasonable ceiling before pausing for re-planning | Q-4 | Low — it's a soft policy; Claude adjusts based on actual issue density |
| A7 | The seed's `random.seed(42)` produces byte-identical data across runs on the same Python version | §Architecture Pattern 4 | Low — stdlib `random` is well-defined and deterministic |
| A8 | `psycopg2.executemany` in batches of 5k-10k is fast enough at 100k rows without switching to `COPY FROM` | Q-8 / Alternatives | Low — falls back to `copy_expert` if too slow |
| A9 | AG Charts Enterprise 13 handles 5000 scatter points smoothly | Q-6 | Low — well-known AG capability |
| A10 | The managed dataset + data source dual-seed pattern correctly populates both paths without schema drift | §Architecture Pattern 1 | **HIGH** — if the two tables' shapes get out of sync the whole dashboard fetch pipeline silently breaks. This is the #1 structural risk in the seed script. Unit-test this pairing in Wave 0. |
| A11 | Phase 10 does NOT need a new Alembic migration (only operates on `recon_data` which is un-Alembic'd, and `DELETE FROM` rows on `recviz_*` which is Alembic-managed schema) | §1.6 | Low — per `project_superset_alembic.md` the schemas are separate. Confirm no new columns needed. |
| A12 | Seeding an exact integer count (100,000) for `recon_transactions` is possible with deterministic RNG | §1.3 | Low — generator is a fixed loop of 100_000 iterations |
| A13 | Each curated KPI's `metric_column` maps cleanly onto a column returned by its dataset's SQL | §2.3 | Medium — seed script's Wave 0 test must verify column-name alignment between `recviz_datasets.columns[]` and the SQL `SELECT` clause for every dataset |
| A14 | The curated chart catalog column mappings are compatible with `buildSeries()` in `ag-chart-wrapper.tsx` (i.e., the factory can actually render them) | §2.2 | Medium — Plan 10-01 must execute the rewritten `chart-showcase.spec.ts` replacement after seed, asserting every chart type renders without error |
| A15 | `project_ag_charts_gotchas.md` (AllEnterpriseModule registration, oklch→hex) is already handled; Phase 10 doesn't need to re-do it | §Stack | Low — Phase 02.1 shipped this |
| A16 | `project_api_client_gotchas.md` DATA_KEYS skip set correctly handles the new managed chart `columnMapping` JSONB during frontend serialization | §CLAUDE.md | Low — Phase 6 shipped this; existing tests cover it |

**Every `[ASSUMED]` claim in this research is captured above.** Items A2, A10, A13, A14 are the ones most likely to need verification before Plan 10-01 commits.

## Open Questions (RESOLVED)

All questions below were resolved in the planner revision pass (iteration 1 of 3) before Plan 10-01 split and Plan 10-02 fixes. Each has an explicit `**RESOLVED:**` marker followed by a concrete answer grounded in code inspection.

1. **Q-1: Stale Superset virtual datasets** — Can `DatasetSyncService.sync_all()` handle the stale-table case, or do we need an explicit cleanup step in the seed script?

   **RESOLVED:** Canonical reset sequence is `docker compose down -v && docker compose up -d && python scripts/seed-postgres.py`. The `down -v` nukes the `superset_meta` volume (including Superset's own dataset/table metadata), so there is no stale-dataset state to reconcile — Superset starts from an empty metadata DB on next `up -d`. This sequence is already the canonical reset in Plan 10-01c Task 7 (the full-stack verification checkpoint) and in Plan 10-02 Task 0 (dev stack verification). No code change required in `DatasetSyncService`. The `sync_all()` method runs at backend startup against the fresh Superset instance and registers every managed dataset idempotently. [CITED: `.planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-RESEARCH.md:1298-1307`, `10-01c-PLAN.md` Task 7 Step 1]

2. **Q-3: Sunburst + bullet + box-plot inclusion** — Accept skip with UAT doc note, or expand scope to make them render as their declared types?

   **RESOLVED (updated 2026-04-08 per user correction during D-03 approval gate):** Skip `sunburst`, `bullet`, AND `box-plot` from the curated catalog. The user explicitly stated "only 18 chart types supported bro" — which matches the code reality after verification: `ag-chart-wrapper.tsx:168-197` falls back `histogram`, `bullet`, `box-plot` all to `type: 'bar'`, but only `bullet` and `box-plot` are visually meaningful as a DIFFERENT type (a user seeing a "bullet chart" expects a bullet, not a bar). `histogram` is kept in the catalog because the user may reasonably want a "distribution bar chart" aesthetically and its fallback-to-bar is acceptable. `sunburst` additionally needs a hierarchical JSON transform in `echart-wrapper.tsx` that is out of scope for Phase 10. Document all 3 in `10-UAT-RUNBOOK.md` under Phase 02.1 / Phase 6 as "declared but non-functional — excluded from the curated catalog by design". If any of these become real requirements later, add hierarchical transform (sunburst) or wire the native AG Charts Enterprise `type: 'bullet'` / `type: 'box-plot'` series constructors in a future sub-phase. [CITED: `frontend/src/components/charts/ag-chart-wrapper.tsx:168-197` (bar fallback verified in session), RESEARCH.md §2.2 USER CORRECTION block]

3. **Q-3b (placement): `chart-txn-trend-area`** — Currently catalogued in §2.2 but not placed on any dashboard. Add to `dash-match-rate` or `dash-volume`?

   **RESOLVED:** Add to `dash-volume` in position after `chart-txn-scatter` (6 cols × 1 row). Full D4 chart list after the addition is 7 entries. The treemap stays first (cross-filter source, 12 cols), then a row of 6-col panels: `chart-txn-by-region-bar`, `chart-currency-pie`; then another row of 6-col: `chart-counterparty-top-bar`, `chart-txn-scatter`; then another row of 6-col: `chart-txn-trend-area`, (empty 6-col slot or merge into a 12-col row with `chart-txn-parallel`). Final D4 grid: 12 + (6+6) + (6+6) + (6+6) + 12 = 5 rows. Seed script authoritative grid coords are defined in Plan 10-01b Task 3 Section 7 CURATED_DASHBOARDS (D4 entry). [CITED: RESEARCH.md §2.4 D4 lines 908-924, §2.5 footer line 953]

4. **Q-4: KPI threshold band direction** — Several KPIs have "lower is better" semantics but `ThresholdConfig` only has `greenAbove` and `amberAbove`. Does the KPI renderer flip based on metric semantics, or does the seed pick thresholds that happen to align?

   **RESOLVED:** The KPI renderer does NOT flip direction. `ThresholdConfig` is strictly literal "higher = better". Evidence: `frontend/src/lib/kpi-utils.ts:5-13` defines `getThresholdLevel(value, thresholds)`:
   ```typescript
   if (value >= thresholds.greenAbove) return 'green'
   if (value >= thresholds.amberAbove) return 'amber'
   return 'red'
   ```
   No conditional, no metric-type check, no direction flag. The schema in `backend/app/models/managed_kpi.py:32-35` (`ThresholdConfig`) has only `green_above: float` and `amber_above: float` — no `direction` field.

   **Implication for the seed:** For "lower is better" metrics (`kpi-total-breaks`, `kpi-avg-aging-days`, `kpi-sla-breach-rate`), the seed cannot use the threshold system to show a RED state when the metric is high, because `green_above` is interpreted as "green floor" not "green ceiling". The two practical options are:
   - **(A) Invert the metric in the dataset SQL.** Instead of `COUNT(*) AS break_count`, emit `100000 - COUNT(*) AS breaks_headroom`. Now "higher = better" aligns with the renderer. Thresholds become literal.
   - **(B) Keep the raw metric and set thresholds so that a HIGH value lands in the RED band by NOT crossing the thresholds.** E.g., for `kpi-total-breaks` with seeded value ~20000, set `green_above=50000, amber_above=30000`. 20000 < 30000 → red. 30000 < value < 50000 → amber. > 50000 → green. The visual is "red when breaks are high", which matches the desired semantics, but the config comment must explain "lower is visually better for this metric — thresholds are numerically inverted".

   **Decision:** Use **(B)** for the 3 inverted KPIs (`kpi-total-breaks`, `kpi-avg-aging-days`, `kpi-sla-breach-rate`). Rationale: avoids mutating dataset SQL to encode presentation logic, keeps thresholds on the KPI config where they belong. Plan 10-01b Task 3 Section 7 MUST include a config comment above each of the 3 inverted KPI entries explaining the inversion. Plan 10-02 Task 2 checkpoint 21 (the `kpi-total-breaks/edit` walk) MUST verify the threshold badge renders RED against the seeded value, confirming the inversion works as expected. [CITED: `frontend/src/lib/kpi-utils.ts:5-13`, `backend/app/models/managed_kpi.py:32-35`, RESEARCH.md §2.3 lines 824-826]

5. **Q-5: Chart library routes — is `/charts/new` a single page or a wizard?**

   **RESOLVED:** Single page. `/charts/new` renders `<ChartBuilder mode="create" />` (file: `frontend/src/routes/_app/charts/new.tsx`). The chart builder is a same-page accordion wizard: `STEP_ORDER = ['dataset', 'type', 'mapping', 'appearance']` is held as local component state (`activeStep`, `completedSteps`), not as URL segments. No `/charts/new/step/:n` routes exist. Similarly `/charts/:chartId/edit` is a single page rendering `<ChartBuilder mode="edit" initialChart={...} />` (file: `frontend/src/routes/_app/charts/$chartId.edit.tsx`). Plan 10-02 checkpoints 15 (`/charts/new`) and 16-18 (`/charts/:id/edit`) walk SINGLE URLs — no URL-based step navigation. The builder's accordion expand/collapse interactions can be exercised within the same URL via Playwright MCP clicks on step headers. [CITED: `frontend/src/routes/_app/charts/new.tsx:6-20`, `frontend/src/routes/_app/charts/$chartId.edit.tsx:8-33`, `frontend/src/components/charts/chart-builder.tsx:22-197` — STEP_ORDER at lines 30-32, activeStep at 151-158]

6. **Q-6: Drill-down detail data source registration** — Some curated dashboards set `drillDetailDataSourceId` to `ds-recon-transaction-detail`. Since that's a managed-dataset ID, it must also exist in `recviz_data_sources` per §Architecture Pattern 1. Verify during plan.

   **RESOLVED:** Covered by the A10 dual-row pairing guard. Plan 10-01b Task 4 (`test_seed_script.py::test_dataset_data_source_pairing`) asserts that every `drillDetailDataSourceId` referenced in any `CURATED_DASHBOARDS[*].config.charts[*]` resolves to a member of the `CURATED_DATASETS` id set. Since every entry in `CURATED_DATASETS` is fed through `seed_curated_dataset_pair()` (which inserts matching rows into both `recviz_datasets` and `recviz_data_sources`), the test transitively guarantees that every `drillDetailDataSourceId` has a corresponding `recviz_data_sources` row. The 3 drill-detail data sources used across dashboards are: `ds-recon-transaction-detail` (dash-sla D1, dash-match-rate D3, dash-volume D4) and `ds-recon-breaks-summary` (dash-aging D2, dash-breaks-summary D5). Both IDs appear in the 16-entry `CURATED_DATASETS` list in RESEARCH.md §2.1, so the guard will pass. Runtime verification happens in Plan 10-02 Tasks 1-4 via direct navigation + drill-down clicks. [CITED: RESEARCH.md §2.1, §Architecture Pattern 1 lines 238-258, `backend/tests/test_seed_script.py::test_dataset_data_source_pairing` body spec in Plan 10-01b Task 4]

## Sources

### Primary (HIGH confidence — direct codebase read)

- `.planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-CONTEXT.md` — locked decisions D-01 through D-23
- `.planning/REQUIREMENTS.md` — v1 requirements and status
- `.planning/STATE.md` — current project state (100% plans complete, phase 10 context ready)
- `.planning/PROJECT.md` — project vision and constraints
- `.planning/codebase/STACK.md` — full tech stack with versions
- `.planning/codebase/STRUCTURE.md` — repo layout, route map, API prefixes
- `.planning/codebase/TESTING.md` — test frameworks, file organization, patterns
- `.planning/codebase/CONCERNS.md` — tech debt, mock offenders, security notes
- `scripts/seed-postgres.py` — current seed structure, psycopg2 patterns, validate_columns() helper
- `backend/app/db/models/{dashboard,dataset,chart,kpi}.py` — managed entity SQLAlchemy models
- `backend/app/models/managed_{dataset,chart,kpi,dashboard}.py` — Pydantic DTOs
- `backend/app/models/dashboard_config.py` — DashboardConfig schema (the JSONB shape)
- `backend/app/models/data_source_config.py` — DataSourceConfig schema (drives query engine)
- `backend/app/api/router.py` — router registration order
- `backend/app/api/charts.py` — legacy router to delete, hardcoded IDs confirmed
- `backend/app/api/custom.py` — legacy `/api/custom/kpi` to delete
- `backend/app/api/sql.py` — `_query_history` in-memory list
- `backend/app/api/managed_{dashboards,charts,kpis,datasets}.py` — managed CRUD patterns
- `backend/app/api/dashboards.py` — legacy `/api/dashboards/{id}/kpis` path
- `backend/app/api/data_sources.py` — `/api/data-sources/{id}/query` path
- `backend/app/api/search.py` — Phase 9 rewritten search against managed tables
- `backend/app/services/query_engine.py` — SQL template expansion, filter mappings, dialect handling
- `backend/app/services/config_store.py` — reads `recviz_data_sources` by ID
- `backend/app/config/databases.json` — 4 logical databases, all point at recon_data
- `backend/app/config/dashboards/chart-showcase.json` — chart type showcase structure (template for new catalog)
- `backend/app/config/data_sources/showcase_categories.json` — data source config format
- `frontend/src/components/charts/chart-factory.tsx` — SUPPORTED_AG_TYPES + ECHART_TYPES source of truth
- `frontend/src/components/charts/ag-chart-wrapper.tsx` lines 220-400 — Rules of Hooks violation at 378-379 confirmed
- `frontend/src/components/builder/builder-page.tsx` lines 55-76 — `serializeConfig()` confirms `datasetId` → `dataSourceId` mapping
- `frontend/src/components/dashboard/dashboard-renderer.tsx` — reads `useDashboardKpis` + `useDataSourceQuery`
- `frontend/src/hooks/use-data-source-query.ts` — posts to `/api/data-sources/{id}/query`
- `frontend/src/hooks/use-dashboard-kpis.ts` — posts to `/api/dashboards/{id}/kpis`
- `frontend/src/hooks/use-{chart,kpi,breaks}-data.ts` + `use-prefetch.ts` — dead hooks confirmed
- `frontend/src/types/index.ts` — barrel export confirmed
- `frontend/src/types/dashboard-config.ts` — DashboardChartConfig confirms `sources[].dataSourceId` field
- `frontend/src/routes/_app/dashboards/$dashboardId.tsx` — view route
- `frontend/src/routes/_app/reports/index.tsx` — honest Reports empty state confirmed
- `frontend/e2e/*.spec.ts` — all 7 existing specs read and documented for rewrite
- `frontend/playwright.config.ts` — Chromium single worker, base URL, timeouts
- `.planning/config.json` — confirms `nyquist_validation: true`, all web-search flags false

### Secondary (MEDIUM — project conventions + memory)

- `CLAUDE.md` — coding conventions, chart rules, Shadcn rules, animation rules, current state warning
- `project_local_dev_setup.md` [memory] — docker → seed → register → backend → frontend startup sequence
- `project_superset_alembic.md` [memory] — recviz_alembic_version table separation
- `project_dashboard_config_conventions.md` [memory] — snake_case JSON, explicit `database` field
- `project_api_client_gotchas.md` [memory] — DATA_KEYS skip set
- `project_ag_charts_gotchas.md` [memory] — AllEnterpriseModule + oklch→hex
- `project_ag_grid_theme.md` [memory] — themeQuartz + colorSchemeDark
- `feedback_no_mock_shortcuts.md` [memory] — REAFFIRMED in 10-CONTEXT.md as acceptance gate
- `feedback_playwright_thoroughness.md` [memory] — Playwright MCP visual verify every plan
- `feedback_research_rigor.md` [memory] — reason about real production volumes
- `feedback_incremental_testing.md` [memory] — every phase leaves working testable product
- `feedback_executor_quality.md` [memory] — verify via real API + Playwright before marking done
- `.planning/phases/02.1-chart-rendering-foundation/02.1-CONTEXT.md` — chart wrapper conventions carry-forward
- `.planning/phases/09-sharing-and-views/09-CONTEXT.md` — palette + embed + share-link current state

### Tertiary (LOW — observation-based)

- Context7 / WebFetch: **not consulted.** Phase 10 introduces no new libraries, so library docs are not on the critical path. All the libraries the phase touches (psycopg2, Playwright, Vitest, AG Charts, ECharts, FastAPI, SQLAlchemy, TanStack Query) are already in use and validated by prior phases. Research rigor demands NOT spending tool budget on something already known.

## Metadata

**Confidence breakdown:**

- Schema (§1): **HIGH** — derived directly from CONTEXT.md decisions, verified against existing managed-entity Pydantic models and the dual-seed architecture
- Catalog (§2): **HIGH** for count/coverage; **MEDIUM** for exact column mapping (depends on `buildSeries` behavior per chart type — Plan 10-01 must test each mapping)
- Mock cleanup (§3): **HIGH** — every offender identified via codebase grep with file + line + safe-to-delete verification
- E2E rewrite (§4): **HIGH** — every existing spec read, rewrite path identified
- Walkthrough (§5): **HIGH** — every route in `frontend/src/routes/` enumerated
- Risks (§6): **MEDIUM** — Q-1 (stale Superset datasets) is the biggest uncertainty, flagged explicitly
- Validation (§7): **HIGH** — existing frameworks confirmed, no new infra needed

**Research date:** 2026-04-08
**Valid until:** 2026-04-22 (14 days — schema is user-approval-dependent, treat as stable once approved)

## RESEARCH COMPLETE
