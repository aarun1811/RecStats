# Phase 10: Comprehensive Testing with Advanced Seed Data - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 10 is the **release-readiness milestone** for the v1 RecViz product. It validates everything built in Phases 1–9 against a realistic, GRU-domain reconciliation dataset. It is **not** a feature phase — no new product capabilities are added beyond a richer seed and a curated test catalog.

The phase delivers four things in this order:

1. **Clean-slate advanced seed:** drop the existing tiny seed and all existing managed entities (datasets/charts/KPIs/dashboards). Replace with a new GRU-realistic schema and a 100k-row fact tier. Schema is drafted by Claude during planning and approved by the user before execution.
2. **Curated test catalog (full coverage):** ≥10 datasets, ≥20 charts (every supported AG Charts and ECharts type with realistic mappings), ≥10 KPIs (every format and trend mode), 4–5 recon-domain dashboards (SLA, Aging, Match Rate, Volume, Breaks Summary) wired with global filters, cross-filter sources, and drill-down hierarchies.
3. **Autonomous Claude pre-flight (Playwright MCP):** Claude walks every page and every flow, surfaces issues, and fixes them via decimal sub-phases (10.1, 10.2, …) — immediately or deferred per Claude's judgment. Loops until Claude declares the build clean.
4. **User manual regression UAT:** the user walks the phase-by-phase UAT runbook as the final signoff. Phase 10 ships when every UAT item is ticked, the smoke pass is green, zero mock/fallback paths render anywhere, and all P0/P1 findings are fixed.

**Out of scope (deferred to Phase 11 or beyond):**
- 1M and 10M row stress tiers (Phase 11)
- Performance budgets / timing assertions (Phase 10 records observations only)
- Visual regression / pixel snapshots
- Backend load / concurrency testing
- Reports page and Export endpoints (already marked "coming soon", left as-is)
- Elasticsearch (DATA-03) — still deferred from Phase 4
- Saved Views (SHAR-01) — deferred from Phase 9 to next milestone

</domain>

<decisions>
## Implementation Decisions

### Seed Data Shape & Volume

- **D-01:** **Clean-slate replace.** Phase 10 drops all existing recon source tables (`bank`, `message_feed`, `item`, `recon_bank`, `tlm_bdr_relationship_header`, `reconmgmt.mr_csum_man_match_stats_hist`) AND all existing managed entities (`managed_datasets`, `managed_charts`, `managed_kpis`, `managed_dashboards`). The legacy `showcase_*` tables are also dropped. The seed script is rewritten end-to-end. Existing E2E specs that depend on these tables (`chart-showcase.spec.ts`, `tlm-stats-regression.spec.ts`, `share-link.spec.ts`, `embed.spec.ts`, `dashboard-edit-regression.spec.ts`, `dashboard-view-regression.spec.ts`, `command-palette.spec.ts`) are rewritten to point at the new advanced seed.

- **D-02:** **100k-row tier in Phase 10.** Fact tables target 100k rows. Dimension tables sized realistically (recon engines: ~5, accounts: ~5k, regions: ~10, currencies: ~30, statuses: ~8, aging buckets: ~6). Date range covers 2 years to exercise time-series filters and Y/Y trends. Volume scaling to 1M and 10M rows is **explicitly Phase 11** and out of scope here.

- **D-03:** **GRU-realistic schema, drafted by Claude, approved by user.** During the research/planning step (`/gsd-plan-phase 10`), Claude proposes the full schema in `10-RESEARCH.md` and surfaces it inside `10-01-PLAN.md` as an artifact requiring user approval before execution. Schema seeds for richness over realism — must support every chart type, every KPI format, every filter type, every drill level. Approximate entity list to seed:
  - **Fact tables:** `recon_transactions` (100k, the primary fact), `recon_breaks` (~20k breaks linked to transactions), `recon_match_events` (~80k), `sla_events` (~5k)
  - **Dimensions:** `recon_engines`, `accounts`, `regions`, `desks`, `currencies`, `statuses`, `aging_buckets`, `counterparties`
  - **Time:** every fact has at least one timestamp column; dates span 2 leap-year-spanning years with deliberate DST and year-boundary records
  - Final shape may evolve during planning — this is the working sketch.

- **D-04:** **Full-coverage curated catalog.** The seed creates the following entities directly in the managed tables (not via UI clicks), so the test bed exists immediately on first run:
  - **≥10 managed datasets** — at least one per chart type's data shape (categorical, time-series, distribution, scatter, heatmap, treemap, waterfall, funnel, sankey, radar, gauge), plus 2–3 recon-realistic datasets (breaks summary, SLA report, aging analysis)
  - **≥20 managed charts** — every supported AG Charts type (line, bar, area, pie, donut, scatter, heatmap, treemap, waterfall, bullet, box plot, combo) and every supported ECharts type (sankey, sunburst, radar, network, gauge, parallel coordinates, funnel) with realistic mappings against the curated datasets
  - **≥10 managed KPIs** — covering all four formats (currency, percentage, number, decimal), both trend modes (`previous_period` and `static_target`), and all three threshold band states (green/amber/red)
  - **4–5 managed dashboards** — recon-domain themes: `sla-dashboard`, `aging-analysis`, `match-rate-tracker`, `volume-dashboard`, `breaks-summary`. Each has a global filter bar, ≥2 cross-filter source charts, and ≥1 drill-down hierarchy (breakdown level + detail level). Together they exercise every panel type, every interaction, and every filter pattern.

- **D-05:** **Edge cases baked into the seed:** NULLs sprinkled in both measure and dimension columns, at least one high-cardinality dimension (≥10k unique values, e.g., `account_id` or `transaction_ref`), and date records spanning leap-year days, DST switches, and year boundaries. Extreme number values (trillions, micro-decimals, negatives, zero) are not deliberately seeded but will be naturally present via realistic monetary distributions.

- **D-06:** **Seed script idempotency:** the new seed script is fully idempotent. Running it on a fresh DB and on a re-run produces identical results. Drop-and-recreate at the top, no `IF NOT EXISTS` shortcuts that would leave stale rows. The script lives at `scripts/seed-postgres.py` (replacing the current file) and is the single source of truth.

### Test Surface & UAT Structure

- **D-07:** **Phase-by-phase UAT runbook.** Single artifact at `.planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-UAT-RUNBOOK.md`. One section per phase 1–9. Each section lists the user-facing capabilities that phase delivered with concrete steps, expected outcomes, and a checkbox per item. Findings logged inline as `**Issue:** ...` notes. Mirrors the roadmap so regressions trace cleanly back to the phase that introduced them.

- **D-08:** **Markdown-only, version-controlled.** UAT runbook lives in the phase directory as a `.md` file, committed to git. No spreadsheets, no external tools. A separate `10-FINDINGS.md` may emerge if issue volume warrants structured triage, but the default is inline notes in the runbook.

- **D-09:** **Two readers, one document:** the same UAT runbook is used by Claude during autonomous pre-flight (D-12) AND by the user during the final manual regression. Claude generates the runbook as part of the test catalog work and ticks items as it walks the build; the user re-walks the same items as the final signoff after Claude declares the build clean.

- **D-10:** **Existing E2E specs are rewritten.** The seven existing Playwright spec files in `frontend/e2e/` are rewritten to point at the new advanced seed entities (new dashboard slugs, new chart titles, new dataset names). They are NOT extended into a comprehensive coverage suite — manual UAT is the comprehensive coverage. The rewritten E2E specs serve as a smoke regression net for future changes.

- **D-11:** **One Playwright MCP smoke pass, all 4–5 dashboards.** As part of the autonomous pre-flight, Claude walks every curated dashboard once via Playwright MCP: load → take screenshot → click a chart segment for cross-filter sanity → click a drill row for drill sanity → verify no error panels and no skeletons stuck → verify command palette finds them. This is the visual sanity gate before user UAT begins.

### Autonomous Pre-Flight & Issue Handling

- **D-12:** **Autonomous Claude pre-flight is the second build phase.** After the seed and catalog are in place (Plan 10-01), Claude enters autonomous mode (Plan 10-02): exhaustively walks every page in the app (`/dashboards`, `/dashboards/:id`, `/dashboards/:id/edit`, `/dashboards/new`, `/charts`, `/charts/:id/edit`, `/charts/new`, `/kpis`, `/kpis/:id/edit`, `/kpis/new`, `/datasets`, `/datasets/:id/edit`, `/datasets/new`, `/explorer`, `/embed/dashboards/:id`, `/settings/data-sources`, the Cmd+K palette, the share link flow), exercises every flow against the new seed, and surfaces every issue. Claude fixes issues as it goes — either inline within Plan 10-02 if trivial, or via decimal sub-phases (10.1, 10.2, …) if substantive. The loop terminates when Claude believes the build is clean.

- **D-13:** **Decimal sub-phases for non-trivial fixes.** When Claude finds a bug or regression that needs more than a one-line fix, it spawns a decimal sub-phase (e.g., `10.1-fix-cross-filter-on-high-cardinality`, `10.2-fix-dataset-edit-regression`) with its own PLAN.md and atomic commits. This keeps Phase 10's intent (testing) clean while still shipping the fixes inside the v1 milestone. Trivial fixes (≤10 lines, no behavior change) can land inline within Plan 10-02.

- **D-14:** **Claude declares "ready for UAT" before user steps in.** After the autonomous loop terminates, Claude posts a summary of what was tested, what was fixed, and what (if anything) was deferred. Only then does the user start the manual regression UAT walkthrough.

### Done Criteria & Mock Audit

- **D-15:** **Phase 10 ships when ALL of the following are true:**
  1. Every checkbox in `10-UAT-RUNBOOK.md` is ticked off by the user (`[x]`)
  2. The Playwright MCP smoke pass walks all 4–5 curated dashboards green
  3. **Zero mock/fallback paths render anywhere in the frontend** — no fabricated data, no hardcoded fixtures in service code masquerading as real responses (the Reports page and Export buttons already render explicit "Coming Soon" empty states and are NOT in scope)
  4. All P0 (broken / wrong data) and P1 (broken UX, blocker) findings are fixed before close
  5. P2/P3 findings can be deferred to the next milestone with explicit log entries

- **D-16:** **Mock/fallback audit is three-pronged.** Phase 10 must NOT trust that Phase 1's INFR-04 cleanup is still clean. The audit:
  1. **Codebase grep:** scan for known mock-shortcut patterns — placeholder data literals, hardcoded fixtures in service code, `"pending"` job returns, hardcoded Superset dataset IDs (`CHART_DATASOURCE_MAP`, `CHART_QUERIES` in `backend/app/api/charts.py`), the in-memory stores flagged in `.planning/codebase/CONCERNS.md`
  2. **Endpoint review:** every API route confirmed to hit a real data path. Known offenders per CONCERNS.md to verify or kill: `/api/custom/kpi`, the legacy `charts.py` router with hardcoded dataset IDs, the in-memory `_query_history`, `_jobs`, `_views` stores
  3. **UAT validation:** during the manual walkthrough, every screen verified to show real data. Watch for placeholder strings like `"Lorem"`, `"TBD"`, `"coming soon"` (other than the deliberate Reports/Export Empty states), `"pending"`, hardcoded numbers that look fabricated

- **D-17:** **Reports and Export stubs stay as-is.** Both surfaces already render explicit "Coming Soon" empty states (Shadcn `Empty` component) and are intentionally part of the v1 navigation as visible roadmap items. Phase 10 does NOT delete or modify them. They are exempt from the mock audit because they are honest empty states, not fake-data shims.

### Test Mix (Discretion locked)

- **D-18:** **Performance: light, observation-only.** During the Playwright MCP smoke pass and the user manual UAT, Claude records actual timings for heavy operations (initial dashboard load, filter apply, cross-filter response, drill-down detail fetch, command palette search) into `.planning/phases/10-.../10-PERF-OBSERVATIONS.md`. No assertions, no budgets, no test failures. The numbers exist so the user has data when deciding what's acceptable for the Phase 11 (1M/10M) scaling pass.

- **D-19:** **Visual regression: NO.** No screenshot snapshot tests. Charts and dashboards are too dynamic (live data, animations, theme variants) for snapshot diffs to add value over manual UAT. Playwright already captures failure screenshots for debugging.

- **D-20:** **Backend load testing: NO.** RecViz is single-tenant on internal corporate network at v1. Concurrency / connection pool concerns are real at production scale (Oracle/Hive, multi-user) but not at 100k rows in dev. Defer to Phase 11 or to a future hardening pass.

### Build Sequence (Plan ordering)

- **D-21:** **Plan 10-01 builds the test bed.** Schema + seed script + curated catalog (full coverage: 10+ datasets, 20+ charts, 10+ KPIs, 4–5 dashboards) + UAT runbook (initial draft, capability checklists per phase) + rewritten E2E specs pointing at new entities. After 10-01, the test bed is ready and Claude can begin autonomous pre-flight.

- **D-22:** **Plan 10-02 is the autonomous pre-flight loop.** Claude walks every page with Playwright MCP, fixes trivial issues inline, spawns decimal sub-phases for substantive ones, updates the UAT runbook with notes from the walk, and terminates when Claude judges the build clean. May spawn 10.1, 10.2, … as needed.

- **D-23:** **Plan 10-03 generates the final UAT runbook delta + hands off to user.** After autonomous pre-flight stabilizes, Claude finalizes the UAT runbook (resolves any inline notes, marks Claude-walked items as `[Claude-checked]`), records perf observations, posts the "ready for UAT" summary, and the user begins the manual regression walkthrough. Phase 10 closes after the user ticks the runbook clean.

### Claude's Discretion

- Exact column lists and FK relationships within the proposed schema (will be drafted in `10-RESEARCH.md` and surfaced in `10-01-PLAN.md` for user approval before execution)
- Exact recon-domain dashboard themes within the 4–5 dashboard catalog (SLA/Aging/Match-Rate/Volume/Breaks-Summary is a working list — Claude may merge or rename based on what the schema makes natural)
- Whether to spawn a decimal sub-phase or fix inline within 10-02 (Claude judges by fix complexity)
- The exact ordering of pages walked during autonomous pre-flight
- The format of `10-PERF-OBSERVATIONS.md` (plain table is fine)
- Whether the rewritten E2E specs become 7 spec files (one-to-one with current files) or get reorganized

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project / requirements
- `.planning/PROJECT.md` — project vision, validated requirements (Phases 1–9), constraints (desktop-only, on-prem, millions of rows, no auth in v1), Out of Scope list
- `.planning/REQUIREMENTS.md` — full v1 requirement traceability (INFR/INTR/DATA/DSET/CHRT/KPI/BLDR/SHAR), all complete except SHAR-01 and DATA-03 (deferred)
- `.planning/ROADMAP.md` §"Phase 10" — current entry says "[To be planned]"; this CONTEXT.md is the planning input

### Codebase maps (read for current state)
- `.planning/codebase/STACK.md` — full tech stack reference
- `.planning/codebase/STRUCTURE.md` — repo layout
- `.planning/codebase/TESTING.md` — current test frameworks (Vitest 4, Playwright 1.59, pytest), existing test files, factory patterns
- `.planning/codebase/CONCERNS.md` — KNOWN tech debt and stub endpoints. **Critical for the mock audit (D-16):** lists every known offender — legacy `charts.py` with `CHART_DATASOURCE_MAP`, hardcoded dataset IDs, `_query_history`/`_jobs`/`_views` in-memory stores, `useBreaksData` dead hook, React Rules of Hooks violation in `ag-chart-wrapper.tsx`
- `.planning/codebase/CONVENTIONS.md` — coding conventions
- `.planning/codebase/INTEGRATIONS.md` — external service integrations

### Seed and infrastructure (will be replaced)
- `scripts/seed-postgres.py` — current tiny seed (~50–500 rows per table) — REPLACED in Plan 10-01
- `scripts/generate-seed-db.py` — current SQLite generator — review for relevance, likely also replaced or deleted
- `seed/create_recon_db.py` — current recon DB creation script — review and likely replaced
- `seed/register_test_datasets.py` — current dataset registration — REPLACED in Plan 10-01
- `seed/register_superset.py` — Superset database registration — kept (still needed)
- `infrastructure/` (Docker Compose) — Postgres + Redis services, keep as-is
- `backend/app/config/seed/seed.db` — SQLite seed file, review relevance

### Existing E2E specs (will be rewritten in Plan 10-01)
- `frontend/e2e/chart-showcase.spec.ts` — depends on `chart-showcase` dashboard + showcase tables (gone after D-01)
- `frontend/e2e/tlm-stats-regression.spec.ts` — depends on `tlm-stats` dashboard + recon tables (gone after D-01)
- `frontend/e2e/share-link.spec.ts` — depends on a managed dashboard
- `frontend/e2e/embed.spec.ts` — depends on a managed dashboard
- `frontend/e2e/dashboard-edit-regression.spec.ts` — depends on a managed dashboard
- `frontend/e2e/dashboard-view-regression.spec.ts` — depends on a managed dashboard
- `frontend/e2e/command-palette.spec.ts` — depends on managed entities being seeded for search

### Managed-table models (the source of truth)
- `backend/app/models/managed_dashboards.py` — Phase 8
- `backend/app/models/managed_charts.py` — Phase 6
- `backend/app/models/managed_datasets.py` — Phase 5
- `backend/app/models/managed_kpis.py` — Phase 7

### Source-of-truth API routers
- `backend/app/api/router.py` — registration order critical; managed_* routers MUST register before legacy routers
- `backend/app/api/managed_dashboards.py`, `managed_charts.py`, `managed_kpis.py`, `managed_datasets.py`, `search.py` (Phase 9 rewrite)

### Frontend route map (everything that gets walked in autonomous pre-flight)
- `frontend/src/routes/` — TanStack Router file-based routes; the autonomous walkthrough hits every route in `_app/`, `embed/`, plus the Cmd+K palette and share-link flow

### Conventions and feedback (project-wide)
- `CLAUDE.md` §"Coding Conventions" — TS strict, named exports, kebab-case files, Shadcn ownership, Tailwind CSS variables, motion/react (NOT framer-motion), filter/cross-filter/drill-down model
- `CLAUDE.md` §"Current State" — Two parallel dashboard systems warning, critical gaps list
- `recviz/CODEBASE_GUIDE.md` — file-level codebase reference (referenced in CLAUDE.md as "READ THIS FIRST" for agents)

### Memory references (NON-NEGOTIABLE for Phase 10)
- `feedback_no_mock_shortcuts.md` — **REAFFIRMED by user during this discussion.** Never use mock or fallback responses, always verify against the real query pipeline. This is a Phase 10 acceptance gate (D-15.3, D-16).
- `feedback_playwright_thoroughness.md` — Playwright MCP visual test every plan, not just compile/unit tests. Phase 10 walkthrough is exactly this rule applied at scale.
- `feedback_playwright_verification.md` — Use Playwright MCP to visually verify UI changes, don't just compile and claim done.
- `feedback_executor_quality.md` — Executors produce shallow work, verify with real API + Playwright before marking done.
- `feedback_incremental_testing.md` — Every phase must leave a working testable product, fix issues before moving on. Phase 10 IS this principle applied to the whole milestone.
- `feedback_research_rigor.md` — Don't dismiss tech based on toy assumptions, reason about real production data volumes. Schema design in 10-RESEARCH.md must reflect actual GRU domain volumes.
- `project_local_dev_setup.md` — Docker + backend + frontend startup; Superset must start before backend; Alembic gotchas
- `project_superset_alembic.md` — RecViz uses separate `recviz_alembic_version` table to avoid Superset migration conflicts
- `project_dashboard_config_conventions.md` — JSON must use snake_case; static data sources need explicit `database` field
- `project_api_client_gotchas.md` — DATA_KEYS skip set, 204 handling — relevant for any new schema-driven payloads

### Prior phase contexts (carry-forward decisions still in effect)
- `.planning/phases/01-foundation-hardening/01-CONTEXT.md` — Foundation, financial formatting, mock removal
- `.planning/phases/02-cross-filtering-and-drill-down/02-CONTEXT.md` — Cross-filter and drill-down architecture; Phase 10 dashboards must exercise this
- `.planning/phases/02.1-chart-rendering-foundation/02.1-CONTEXT.md` — Chart wrapper conventions; Phase 10 catalog uses every supported type
- `.planning/phases/03-chart-and-grid-interactions/03-CONTEXT.md` — Export, fullscreen, refresh; Phase 10 walks each
- `.planning/phases/04-data-source-connectivity/04-CONTEXT.md` — Data source connection UI (PostgreSQL is the dev target)
- `.planning/phases/05-dataset-management/05-CONTEXT.md` — Dataset model and column metadata patterns
- `.planning/phases/06-chart-library/06-CONTEXT.md` — Chart builder mapping conventions
- `.planning/phases/07-kpi-library/07-CONTEXT.md` — KPI format/threshold/trend model; Phase 10 catalog must exercise every variant
- `.planning/phases/08-dashboard-builder/08-CONTEXT.md` — Builder + grid layout + filter bar
- `.planning/phases/09-sharing-and-views/09-CONTEXT.md` — Share URL, embed, command palette

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Existing seed script (`scripts/seed-postgres.py`)** — file structure (DROP TABLE IF EXISTS → CREATE → INSERT loops, idempotency contract, two DBs `recon_data` + `superset_meta`) is the template for the rewritten seed. The new script reuses the same pattern but rebuilds the entire schema and entity catalog.
- **`backend/app/config/seed/seed.db`** — SQLite seed file; review whether the SQLite path is still in use anywhere or whether Postgres is the only target now.
- **Existing managed_* router patterns** — direct INSERT into `recviz_dashboards` / `managed_charts` / `managed_kpis` / `managed_datasets` from a Python script is fine (the seed script already does this for `recviz_dashboards` and `recviz_data_sources`). The new seed extends this to all four managed tables.
- **`frontend/e2e/chart-showcase.spec.ts`** — `waitForDashboardLoad` helper, the parameterized chart-type loop, the no-skeleton-stuck assertion. The rewritten specs reuse these patterns against the new dashboard slugs and chart titles.
- **Playwright config (`frontend/playwright.config.ts`)** — Chromium-only, single worker, base URL `http://localhost:5173`, 30s timeout. No changes needed; rewritten specs run under the same config.
- **Showcase dashboard pattern** — `chart-showcase.json` config + dedicated data sources per chart type proved that "one chart per dashboard panel exercises one chart type" works. The new curated catalog scales this to ≥20 charts spread across 4–5 themed dashboards.

### Established Patterns

- **Two-DB seeding** — `recon_data` (source) and `superset_meta` (Superset internal). Both must be seeded. Confirmed by the existing script.
- **Superset registration via `seed/register_superset.py`** — registers the Postgres source database with Superset so SQLLab can run queries. Phase 10 keeps this; the new seed re-uses it.
- **`recviz__{uuid}` table_name format** — Phase 5 decision for Superset virtual dataset uniqueness. New datasets follow this convention.
- **Managed-table router-registration order** — `managed_*` routers register BEFORE legacy routers in `router.py`. Phase 10 doesn't change this but verifies it remains intact during the mock audit.
- **`api-client` `DATA_KEYS` skip set** — payloads with arbitrary user keys (filter values, mappings, configs) live in DATA_KEYS to avoid camelCase mangling. Schema-driven payloads from the new seed must respect this if surfaced through TanStack Query.
- **`buildSeries` chart type gating (Phase 02.1)** — `SUPPORTED_AG_TYPES` constant in `chart-factory.tsx` determines what AG can render; everything else routes to ECharts. The catalog respects this split (D-04).
- **`MAPPING_FIELD_LABELS` (Phase 6)** — chart-type-aware field labels (Source/Target for Sankey, X-Axis/Y-Axis for bar). Curated charts must align with these labels so the builder UI looks coherent during UAT.

### Integration Points

- **`scripts/seed-postgres.py`** — the rewritten seed script is the ONE entry point for the test bed. `make seed`, `python scripts/seed-postgres.py`, or any equivalent CLI invocation produces a reproducible test environment.
- **`infrastructure/` Docker Compose** — Postgres + Redis services already in place. The seed script targets `localhost:5432` Postgres directly. No infra changes needed.
- **Superset bootstrap** — `seed/register_superset.py` registers the data source database with Superset after the seed runs. Order: docker compose up → seed → register superset → start backend → start frontend. Already documented in `project_local_dev_setup.md`.
- **Alembic migrations** — RecViz uses a separate `recviz_alembic_version` table per `project_superset_alembic.md`. The seed script does NOT touch Alembic; it operates directly on the schema produced by `alembic upgrade head`. If new tables are introduced for the schema, they go through Alembic, NOT the seed script.
- **`frontend/src/routes/`** — every route under `_app/` and `embed/` is a target of the autonomous Playwright MCP walkthrough (D-12).
- **TanStack Router file-based routing** — page-component default exports per CLAUDE.md, named exports everywhere else. Test catalog datasets must NOT introduce new routes, only new entities.

### Known offender list (mock audit reference, from CONCERNS.md)

- `backend/app/api/charts.py` — `CHART_DATASOURCE_MAP`, `CHART_QUERIES` with hardcoded Superset dataset IDs (3, 4, 5, 6). Audit and likely DELETE the legacy charts router entirely as part of mock cleanup.
- `backend/app/api/custom.py` — `/api/custom/kpi` endpoint with hardcoded dataset IDs. Migrate to config-driven or delete.
- `backend/app/api/sql.py` — `_query_history` in-memory list. Stub; review whether SQL Explorer query history is exercised by Phase 10 UAT and decide whether to fix or accept.
- `backend/app/api/export.py` — `_jobs` in-memory dict, `/api/export/pdf` and `/api/export/excel` return `{"status": "pending"}`. ALREADY MARKED COMING SOON (D-17), exempt from audit.
- `backend/app/api/views.py` — `_views` in-memory store. Saved-view scaffold left in place (Phase 9 D-18). Exempt from audit, will be addressed in next milestone.
- `frontend/src/hooks/use-chart-data.ts`, `use-kpi-data.ts`, `use-breaks-data.ts` — dead hooks reading nonexistent `s.globalFilters`. DELETE during mock cleanup.
- `frontend/src/hooks/use-prefetch.ts` — hardcoded chart IDs hitting old endpoints. DELETE during mock cleanup.
- `frontend/src/types/index.ts` — barrel export against convention. DELETE during mock cleanup.
- `frontend/src/components/charts/ag-chart-wrapper.tsx` lines 367-368 — Rules of Hooks violation. FIX during mock cleanup.

</code_context>

<specifics>
## Specific Ideas

- **Phase 10 is a release-readiness phase, not a feature phase.** The deliverable is "v1 RecViz works end-to-end against realistic data and the user has manually walked every flow." The advanced seed and curated catalog are means, not ends.
- **The seed is also a demo asset.** The full-coverage curated catalog (4–5 recon-domain dashboards with realistic data) doubles as a demo environment for stakeholders. Build it with that in mind — the dashboards should look credible, not like test fixtures with `lorem_ipsum_chart_3` titles.
- **"Lots of manual testing being done"** is the user's framing. Treat the manual UAT as the comprehensive coverage and the automated specs as a thin smoke regression net. Don't try to compete with manual UAT by building a giant Playwright suite.
- **"You will do seed + schema + load all pages and see if everything is working as expected. I will be putting you in autonomous mode at that point. Fix all the issues as phases immediately or later as it should be done. Once you feel there are no more issues, I step in and do the manual regress UAT testing."** — direct quote, captured as D-12 / D-13 / D-14 / D-22. Claude does the pre-flight, fixes everything fixable, then hands off to the user.
- **"No mock or fallback response should render in frontend or get propagated to frontend bro."** — direct quote. Captured as D-15.3 and D-16. This is THE non-negotiable for Phase 10. Cited memory: `feedback_no_mock_shortcuts.md`.
- **The schema design is not yet locked.** It's being delegated to research/planning (D-03). The CONTEXT.md commits to the SHAPE of the schema (recon-realistic, exercises all features, 100k facts, 2-year date range) but not the exact table list. The RESEARCH.md and PLAN.md must surface a concrete schema for user approval before execution.
- **Volume scaling is Phase 11's problem.** Don't let Phase 10 scope-creep into 1M/10M row work. If perf at 100k is bad, log it in `10-PERF-OBSERVATIONS.md` and move on — the user will decide what's worth fixing in Phase 11.
- **Decimal sub-phases are the safety valve.** When Claude's autonomous pre-flight finds something that needs more than a trivial fix, spawn 10.1, 10.2, … with their own PLAN.md. This is the established RecViz pattern (Phase 02.1 was inserted, and Phase 02 had similar "fix while testing" needs).

</specifics>

<deferred>
## Deferred Ideas

### Pushed to Phase 11 (volume scaling)

- **1M row tier** — fact tables at 1M, exercise true production-scale aggregation, caching, and pagination behavior
- **10M row tier** — stress tier; expose Superset query timeouts, Postgres index plans, AG Grid pagination at the top end
- **Performance budgets / timing assertions** — once 100k baseline observations exist (D-18), Phase 11 can lock in budgets
- **Backend load / concurrency testing** — meaningful only at 1M+ tiers and only when concurrency matters
- **Connection pool tuning** — Postgres + Superset pool sizing; relevant at scale, not at 100k

### Pushed to next milestone (post-v1)

- **Saved Views (SHAR-01)** — already deferred from Phase 9, stays deferred
- **Reports / PDF export / Excel export / Email reports** — already deferred per PROJECT.md Out of Scope; the "Coming Soon" empty states stay
- **Authentication / SSO / RBAC** — deferred per PROJECT.md
- **Visual regression / pixel snapshot testing** — only worth adding if v2 introduces a stable UI surface that doesn't move with data
- **Comprehensive E2E suite** — manual UAT is the comprehensive coverage in v1; automated comprehensive coverage waits until UI churn slows
- **Elasticsearch (DATA-03)** — still deferred from Phase 4
- **`/api/sql/execute` endpoint hardening (statement allowlisting, audit logging)** — security concern from CONCERNS.md, defer to a security pass after auth lands

### Issues raised but not in scope here

- **Tooling-based mock detector / CI check** — would be sustainable but adds infra; defer until v2 hardening
- **Single-tile embed (`?single=chart-id`)** — Phase 9 deferred, still deferred
- **Drill state in URL** — Phase 9 deferred, still deferred
- **Server-side short-ID share links** — Phase 9 deferred, still deferred
- **Quick actions in command palette** — Phase 9 deferred, still deferred
- **Recently-visited items in palette empty state** — Phase 9 deferred, still deferred

</deferred>

---

*Phase: 10-comprehensive-testing-with-advanced-seed-data*
*Context gathered: 2026-04-08*
