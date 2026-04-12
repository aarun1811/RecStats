# Roadmap: RecViz — Oracle-Only Cutover + Frontend Colorization

## Milestone Overview

**Milestone:** Oracle-Only Cutover + Frontend Colorization
**Phases:** 8
**Requirements:** 68 (all v1, 100% mapped)
**Granularity:** standard
**Branch:** `feature/add-color-remove-postgres` (no phase branches)
**Verification mode:** manual only — automated tests deferred to a future milestone

**Core value:** Business users can view, interact with, and customize reconciliation dashboards against Citi's production Oracle 19c environment, with zero local-vs-prod drift — what works locally must work on Citi's servers.

**Delivery strategy:** A brownfield consolidation milestone delivered page-by-page. Phase 1 rebuilds the infrastructure (Oracle 19c via Oracle Cloud Always Free, thick-mode `oracledb`, sync SQLAlchemy, fresh Alembic migration, PG/Docker/Superset/Redis residue removed) and lays down the global shadcn color palette with chart-theme rewiring. Phases 2–7 each take one page (Settings → Datasets → Charts → KPIs → Dashboards → Explorer), colorize it using the Phase 1 palette tokens, fix issues discovered during phase discuss, and verify against live Oracle in the browser. Phase 8 runs a global Alembic audit, dead-code sweep (using the `.planning/USAGE-TRACKER.md` accumulated across all phases), memory cleanup, and milestone-end smoke test. No automated tests are written. No separate branches are cut. Every phase must leave a working app.

## Phases

- [ ] **Phase 1: Infrastructure Cutover** - Oracle 19c wiring, async/PG/Docker/Superset/Redis residue removed, global shadcn palette + chart theme rewired
- [ ] **Phase 2: Settings Page** - Colorize Appearance/Saved Views/Data Sources tabs; verify Data Sources CRUD end-to-end against Oracle
- [ ] **Phase 3: Datasets Page** - Colorize list/create/edit; verify dataset CRUD and parameterized SQL execution against Oracle
- [ ] **Phase 4: Charts Page** - Colorize list/builder; audit hard-coded hex; verify AG Charts + ECharts rendering with new palette
- [ ] **Phase 5: KPIs Page** - Colorize list/create/edit; verify KPI CRUD and animated counter rendering against Oracle
- [ ] **Phase 6: Dashboards Page** - Colorize; fix `recviz_data_sources` renderer gap; delete legacy dead code; verify dashboards and embed route end-to-end
- [ ] **Phase 7: Explorer Page** - Colorize; migrate AG Grid to Theming API; verify SQL execution via sync `oracledb`
- [ ] **Phase 8: Alembic Audit + Dead Code Sweep + Memory Cleanup** - Final consolidation, milestone-end smoke test, requirements prune, memory cleanup

## Phase Dependency Graph

```
Phase 1 (Infrastructure + Global Palette)
   |
   v
Phase 2 (Settings)
   |
   v
Phase 3 (Datasets)
   |
   v
Phase 4 (Charts)
   |
   v
Phase 5 (KPIs)
   |
   v
Phase 6 (Dashboards)        <-- fixes broken pipeline, deletes legacy dead code
   |
   v
Phase 7 (Explorer)
   |
   v
Phase 8 (Alembic Audit + Dead Code Sweep + Memory Cleanup)
```

Dependencies are strictly linear. Every page phase depends on Phase 1's global palette and Oracle infrastructure being live. Phase 8 depends on every previous phase because it consumes the accumulated `.planning/USAGE-TRACKER.md` and requires a complete app to smoke-test.

## Phase Details

### Phase 1: Infrastructure Cutover
**Goal**: Get the app running against Docker Oracle (gvenzl/oracle-free locally, Oracle 19c in prod) in thick mode with zero PG/async/Docker-compose/Superset/Redis residue, plus lay down the global Mist+Blue shadcn color palette and chart theme rewiring that every subsequent phase will consume.
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07, INFRA-08, INFRA-09, INFRA-10, INFRA-11, INFRA-12, INFRA-13, INFRA-14, INFRA-15, INFRA-16, INFRA-17, INFRA-18, INFRA-19, INFRA-20, INFRA-21, INFRA-22, INFRA-23, INFRA-24, INFRA-25
**Success Criteria** (what must be TRUE):
  1. User can run `sqlplus ADMIN@recvizdev_low` and `SELECT sysdate FROM dual;` returns a row (Oracle Cloud wallet + Instant Client wired end-to-end on the dev machine)
  2. Backend boots via `uvicorn` against Oracle, `GET /health` returns 200, and the startup log shows `Oracle client driver: python-oracledb` with no `thn` suffix (thick mode enforced)
  3. `alembic upgrade head` applies the single new `001_initial_oracle_schema.py` migration cleanly against a fresh Oracle schema, creating all six `recviz_*` tables with `BLOB IS JSON` on config columns
  4. Frontend loads in the browser with the new global palette applied in both light and dark mode — sidebar, primary buttons, and at least one chart all reflect the new tokens (no grayscale-only surfaces)
  5. A repo-wide grep for `postgresql`, `JSONB`, `asyncpg`, `psycopg2`, `superset`, `redis`, `celery` shows zero hits outside `.git/`, AND the same grep against `CLAUDE.md` also shows zero hits (CLAUDE.md verified clean), AND the `docs/` directory is deleted entirely
**Plans**: 6 plans
Plans:
- [x] 01-01-PLAN.md — Backend config + deps + types (config.py, requirements.txt, .env.example, types.py, base.py)
- [x] 01-02-PLAN.md — Backend engine + main.py + services (engine.py, main.py, engine_manager.py, uri_builder.py, views.py)
- [x] 01-03-PLAN.md — Alembic migration (delete old, rewrite env.py/alembic.ini, generate new migration)
- [x] 01-04-PLAN.md — Frontend palette + chart themes (index.css Mist+Blue, series vars, AG Grid bridge, chart-themes.ts)
- [x] 01-05-PLAN.md — Residue removal + CLAUDE.md verification (delete files/dirs, seed-oracle.py, grep audit)
- [x] 01-06-PLAN.md — Boot validation + USAGE-TRACKER init (end-to-end smoke test, human verify, tracker init)
**UI hint**: yes
**Known risks / gotchas**:
  - **Phase 1 has a HARD user gate.** Oracle Cloud signup + 19c provisioning + wallet download + Instant Client install + `sqlplus` smoke test are manual USER steps that must complete *before* any Claude code work begins. Tenancy home region is a one-shot choice (cannot change later). 19c radio must appear before committing the tenancy.
  - **NCS 871 character-set parity gap is permanent.** Oracle Cloud Always Free is locked to `AL32UTF8`/`AL16UTF16`; Citi prod uses NCS 871 (CESU-8). Mitigation is procedural only: force thick mode unconditionally, startup assertion refuses boot if thin mode engages, document loudly. NCHAR-specific bugs cannot surface locally.
  - **Once-per-process thick-mode constraint.** Every engine in the process must use thick mode. `EngineManager` secondary engines must go through the new `build_oracle_engine()` helper, otherwise whole process locks into thin mode.
  - **`chart-themes.ts` hard-coded hex is the single biggest blocker** to the palette swap landing cleanly. Surfaces will colorize but charts stay gray unless the series array is rewired to read CSS vars. Must land in Phase 1 or Phase 4 charts phase will look broken.
  - **Oracle DDL auto-commits.** Half-applied migrations cannot roll back — recovery is manual `DROP TABLE ... CASCADE CONSTRAINTS`. Document in Phase 1 runbook.
  - **Free Tier quota constraints:** 7-day inactivity auto-stop (weekly ping cron needed), 90 cumulative stopped days = permanent reclaim + delete, 30 simultaneous session hard cap (pool sized `pool_size=5, max_overflow=5` = 10 ceiling).
  - **Alembic autogenerate is not trustworthy** for `IS JSON` check constraints. Hand-review against the 9-point checklist (six tables, `BLOB IS JSON`, `VARCHAR2(128 CHAR)` PKs, `CLOB` for `sql`/`encrypted_password`, `TIMESTAMP(6) WITH TIME ZONE` defaults, expected indexes, `UniqueConstraint` on `recviz_connections.name`) and manually add anything it drops.
  - **`shadcn apply` rewrites `index.css` in place.** Git-commit first, diff after, restore clobbered `@layer components` custom rules.

---

### Phase 2: Settings Page
**Goal**: Colorize the Settings page end-to-end and verify the Data Sources tab (the highest-value tab) is fully functional against live Oracle, plus resolve the dead UI stubs in the Appearance tab.
**Depends on**: Phase 1
**Requirements**: SETT-01, SETT-02, SETT-03, SETT-04, SETT-05, SETT-06, SETT-07
**Success Criteria** (what must be TRUE):
  1. User can open the Settings page and see all three tabs (Appearance, Saved Views, Data Sources) rendered with the Phase 1 global palette in both light and dark mode
  2. User can list existing data sources, create a new data source, test its connection, edit it, and delete it — all operations round-trip against Oracle 19c
  3. User can toggle light/dark theme via the Appearance tab and the entire Settings page re-themes correctly with no gray-only holdouts
  4. User can list, load, and delete Saved Views from the Saved Views tab against Oracle
  5. The previously-dead "Density" and "Font Size" buttons are either functional or removed (no non-functional stubs remain in the Appearance tab)
**Plans**: TBD
**UI hint**: yes
**Known risks / gotchas**:
  - Data Sources tab depends on the Oracle connection flow working — if Phase 1's `build_oracle_engine()` helper isn't also used by connection testing, new user-created sources may silently fall back to thin mode.
  - Dead UI stubs (Density, Font Size) require a discuss-gate decision: implement or delete. No hand-waving.

---

### Phase 3: Datasets Page
**Goal**: Colorize the Datasets page (list + create + edit) and verify dataset CRUD plus parameterized SQL execution works end-to-end against Oracle via the sync `oracledb` driver.
**Depends on**: Phase 1
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06
**Success Criteria** (what must be TRUE):
  1. User can view the Datasets list page with the global palette applied in both light and dark mode
  2. User can create a new dataset with a parameterized SQL template (using `{{filters}}`, `{{values}}`, `{{date_range_clause}}` placeholders), save it, re-open it for edit, and delete it — all against Oracle
  3. User can execute a sample query on a dataset from the edit page and see real rows returned from Oracle 19c (no mock data, no thin-mode fallback)
  4. Dataset create/edit pages reflect the global palette in both light and dark mode — form controls, buttons, code editor chrome all re-themed
**Plans**: TBD
**UI hint**: yes
**Known risks / gotchas**:
  - Parameterized SQL template rendering (`_build_sql()` in `query_engine.py`) is sync-path critical — any residual async wrapping needs to be caught here.
  - NCHAR/NVARCHAR2 columns in user SQL cannot be exercised against Oracle Cloud (NCS 871 gap). Mental check only: does this dataset touch NCHAR? If yes, manually verify in Citi post-milestone.

---

### Phase 4: Charts Page
**Goal**: Colorize the Charts page (list + builder wizard), verify all supported chart types (AG Charts + ECharts) render with the new palette, and purge hard-coded hex from chart config shapes and stored dashboard JSON.
**Depends on**: Phase 1
**Requirements**: CHRT-01, CHRT-02, CHRT-03, CHRT-04, CHRT-05, CHRT-06, CHRT-07, CHRT-08
**Success Criteria** (what must be TRUE):
  1. User can view the Charts list page with the global palette applied in both light and dark mode
  2. User can open the chart builder, preview each supported AG Charts type (line, bar, area, pie, donut, scatter, heatmap, treemap, waterfall, bullet, box plot, combo) and each supported ECharts type (Sankey, sunburst, radar, gauge, parallel coords, funnel), and every chart renders with palette-derived colors (no leftover hex)
  3. User can save a chart and re-open it for edit without any gray-only or mis-themed rendering
  4. Stored chart config JSON in `recviz_charts.config` is audited and any stale hex color overrides from earlier builds are migrated or purged
**Plans**: TBD
**UI hint**: yes
**Known risks / gotchas**:
  - `frontend/src/types/chart.ts` and `frontend/src/components/charts/builder/step-appearance.tsx` may carry hard-coded hex in chart config defaults — must grep and replace with CSS variable references.
  - `recviz_charts.config` may store hex color overrides from pre-Phase-1 builds. Need read-all-configs audit pass; migration may be ALTER-free (just a JSON rewrite) but plan for breakage.
  - ECharts exotic charts (Sankey, gauge, radar, etc.) use different color-injection APIs than AG Charts; wrapper in `EChartWrapper` needs a pass to confirm it reads the new `--series-1..8` tokens.

---

### Phase 5: KPIs Page
**Goal**: Colorize the KPIs page (list + create + edit) and verify KPI CRUD plus animated counter rendering works end-to-end against Oracle.
**Depends on**: Phase 1
**Requirements**: KPI-01, KPI-02, KPI-03, KPI-04, KPI-05
**Success Criteria** (what must be TRUE):
  1. User can view the KPIs list page with the global palette applied in both light and dark mode
  2. User can create a new KPI, save it, re-open it for edit, and delete it — all against Oracle
  3. User can view a KPI card and see the animated counter roll up smoothly with palette-themed accent colors (trend arrows, positive/negative semantic colors both work in light and dark mode)
  4. KPI create/edit pages reflect the global palette in both light and dark mode
**Plans**: TBD
**UI hint**: yes
**Known risks / gotchas**:
  - KPI counter animation uses `motion/react` — ensure the trend color semantics (`text-green-600 dark:text-green-400` / red equivalent) survive the palette swap. Status colors are intentionally kept as semantic utilities, not tokenized.
  - Smallest of the page phases. If discuss surfaces a large discovery, push back or split.

---

### Phase 6: Dashboards Page
**Goal**: Colorize all dashboard-related pages, fix the `recviz_data_sources` renderer gap that currently blocks end-to-end rendering, delete the legacy dead dashboard code, and verify dashboards (including the embed route) work fully against Oracle.
**Depends on**: Phase 1
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07, DASH-08, DASH-09, DASH-10
**Success Criteria** (what must be TRUE):
  1. User can view a dashboard end-to-end — charts render with real data from Oracle, KPIs animate, filter bar applies, cross-filters interact, drill-down navigates through levels, all without errors
  2. User can exercise dashboard CRUD (list, create, edit via drag-and-drop builder with undo/redo, save, delete) against Oracle 19c, and all operations round-trip correctly
  3. User can open `/embed/dashboards/:id?filter.foo=bar&filter.lock=foo&hide=sidebar,header&theme=dark` and the dashboard renders in embed mode with filters applied, locked, and chrome hidden as specified
  4. All dashboard pages (list, detail, create, edit) reflect the global palette in both light and dark mode
  5. The legacy dead dashboard code (`filter-bar.tsx`, `kpi-row.tsx`, `chart-grid.tsx`, old store shapes) is deleted from the repo — grep shows zero remaining references
**Plans**: TBD
**UI hint**: yes
**Known risks / gotchas**:
  - **This is the second biggest phase after Phase 1.** Contains four distinct workstreams: colorization, broken-pipeline fix, legacy code deletion, embed route verification. Plan-phase should split into multiple plans.
  - **`recviz_data_sources` gap is architectural, not cosmetic.** Post-Superset, the chart renderer still reads from a table that is never written. Likely fix is rerouting reads through `recviz_datasets` or `recviz_connections`. Discovery happens in phase discuss, not upfront.
  - **Legacy dead code contains useful cross-filter + drill-down logic.** Before deletion, confirm the config-driven path already has equivalent logic in `frontend/src/lib/cross-filter.ts` + `drill-store`. If not, port first, then delete.
  - **Embed route verification is a success criterion, not a separate phase.** Do not split it out.
  - `dashboard-url-state.ts` filter round-tripping must survive the refactor — any breakage to URL search param sync surfaces here.

---

### Phase 7: Explorer Page
**Goal**: Colorize the SQL Explorer page, migrate the AG Grid query results from the legacy CSS-class theme to the new Theming API, and verify arbitrary SQL execution resolves end-to-end through sync `oracledb`.
**Depends on**: Phase 1
**Requirements**: EXPL-01, EXPL-02, EXPL-03, EXPL-04, EXPL-05, EXPL-06, EXPL-07
**Success Criteria** (what must be TRUE):
  1. User can open the Explorer page with the global palette applied to the Monaco editor chrome, schema browser, and query results grid in both light and dark mode
  2. User can type arbitrary SQL into the Monaco editor, pick a registered Oracle data source, run the query, and see real rows returned in the AG Grid results pane
  3. AG Grid results grid uses the Theming API (`themeQuartz.withPart(colorSchemeDark)`) and re-themes instantly on dark/light toggle — no residual `ag-theme-quartz-dark` CSS class references
  4. User can execute a query returning a large result set (thousands of rows) without the grid crashing, and columns render correctly
  5. Schema browser (if present) lists Oracle tables and columns fetched from live data source metadata
**Plans**: TBD
**UI hint**: yes
**Known risks / gotchas**:
  - Monaco editor theme must re-theme on toggle. `vs-dark` vs `vs-light` switch lives in the editor wrapper and needs a theme subscription.
  - AG Grid Theming API migration is a breaking change to the existing `query-results.tsx` import surface — grep all Explorer files for legacy `ag-theme-*` classes.
  - Large result sets against Oracle Cloud Free Tier may hit the 30-session cap if the query runs across pool boundary — monitor.

---

### Phase 8: Alembic Audit + Dead Code Sweep + Memory Cleanup
**Goal**: Final milestone consolidation — audit Alembic fresh against live Oracle, execute the dead code sweep using the accumulated `.planning/USAGE-TRACKER.md`, prune `requirements.txt`, remove the `PortableJSON` alias, clean stale memory entries, and run the milestone-end smoke test.
**Depends on**: Phase 1, Phase 2, Phase 3, Phase 4, Phase 5, Phase 6, Phase 7
**Requirements**: FINAL-01, FINAL-02, FINAL-03, FINAL-04, FINAL-05, FINAL-06, FINAL-07, FINAL-08, FINAL-09
**Success Criteria** (what must be TRUE):
  1. Running `alembic upgrade head` against a freshly provisioned Oracle schema creates only the intended six `recviz_*` tables — no extraneous objects, no orphaned indexes, no Superset/PG residue
  2. The dead code sweep has executed against `.planning/USAGE-TRACKER.md` — user-approved candidates are deleted, a grep pass confirms no broken imports remain
  3. `backend/requirements.txt` contains only dependencies that are actually imported somewhere in `backend/app/`, and the `PortableJSON` alias is removed with all imports updated to `OracleJSON` directly
  4. Stale memory entries (`project_superset_alembic`, `project_superset_ditched`, `project_broken_dashboard_pipeline`, `project_local_dev_setup`) are pruned or rewritten to reflect Oracle-only reality; `project_backend_test_coverage_gap` is retained since tests are still deferred
  5. Milestone-end smoke test passes — full app boots, every page (Settings, Datasets, Charts, KPIs, Dashboards, Explorer) renders in both light and dark mode, data sources connect to Oracle, dashboards render with real data
**Plans**: TBD
**Known risks / gotchas**:
  - `v$parameter` for `COMPATIBLE` must be queried and documented — on Oracle Cloud it's expected at 19.0.0 (128-byte identifier limit), but the value for Citi prod is unknown until someone runs it there. Longest constraint name in the schema is currently 42 bytes, well under either limit, but this needs to be captured for future reference.
  - `USAGE-TRACKER.md` accuracy depends on every earlier phase actually updating it. Plan-phase for earlier phases must enforce this or Phase 8 has nothing to sweep.
  - Memory cleanup is milestone-scoped work — it should happen at the end, not mid-milestone, to avoid pruning entries that are still load-bearing for earlier phases.
  - No automated tests means smoke test failure leaves no safety net. Run the smoke test on a fresh `alembic upgrade head` against a throwaway schema if possible.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infrastructure Cutover | 0/6 | Planned | - |
| 2. Settings Page | 0/TBD | Not started | - |
| 3. Datasets Page | 0/TBD | Not started | - |
| 4. Charts Page | 0/TBD | Not started | - |
| 5. KPIs Page | 0/TBD | Not started | - |
| 6. Dashboards Page | 0/TBD | Not started | - |
| 7. Explorer Page | 0/TBD | Not started | - |
| 8. Alembic Audit + Dead Code Sweep + Memory Cleanup | 0/TBD | Not started | - |

---
*Roadmap created: 2026-04-11*
