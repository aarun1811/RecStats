# RecViz

## What This Is

RecViz is an internal BI and visualization platform for Citi's Global Reconciliation Unit (GRU). A dev team creates parameterized datasets (SQL queries against Oracle) and business users build, view, and customize dashboards from those datasets — no dependency on another team for every change. FastAPI serves a sync SQLAlchemy query engine against Oracle; a custom React frontend delivers the premium UI and builder experience.

## Core Value

Business users can view, interact with, and customize reconciliation dashboards against Citi's production Oracle 19c environment, **with zero local-vs-prod drift** — what works locally must work in Citi's servers.

## Milestone: Production Demo Seed (v2.0)

Rewrite the seed script with production-quality demo data for stakeholder demos. 40-50 charts across 10+ story-driven dashboards, 15-20 KPIs, rich dimension/fact tables with realistic distributions, and configurable row counts (100K default, 1-5M demo, 10M stress test). Eliminate all `recviz_data_sources` writes — seed only writes to `recviz_datasets` + `recviz_connections`. DB connection is configurable via CLI args. All chart configs validated against builder schema — no mismatches.

Previous milestone (v1.0: Oracle-Only Cutover + Frontend Colorization) completed — 8 phases, all pages colorized, pipeline fix shipped, dead code swept.

## Requirements

### Validated

<!-- Inferred from existing code via .planning/codebase/ map. These capabilities exist today and must continue to work. -->

- ✓ FastAPI backend with sync SQLAlchemy query engine (mostly converted from async already) — existing
- ✓ JSON-config-driven dashboard system (dashboards, charts, KPIs, datasets, data sources as `recviz_*` tables) — existing
- ✓ Dashboard CRUD with drag-and-drop builder (react-grid-layout), layout history with undo/redo — existing
- ✓ Chart CRUD with AG Charts + ECharts factory pattern — existing
- ✓ KPI CRUD with animated counters and trend display — existing
- ✓ Dataset CRUD with parameterized SQL templates and filter mappings — existing
- ✓ Data source CRUD with connection test flow — existing
- ✓ Filter bar with global filters, locked filters, URL-synced state — existing
- ✓ Cross-filter + drill-down logic (in config-driven dashboards) — existing
- ✓ SQL Explorer with Monaco editor and results grid — existing
- ✓ Saved views (filter + layout snapshots per dashboard) — existing
- ✓ Dashboard embed route (`/embed/dashboards/:id`) with URL-based filter + hide parameters — existing
- ✓ Settings page with theme toggle, saved views list, data sources tab — existing
- ✓ Alembic migrations using isolated `recviz_alembic_version` table — existing
- ✓ `oracledb` already present in requirements.txt at `>=3.3.0` — existing
- ✓ TanStack Query client-side caching (replaces previous Redis cache) — existing

### Active

<!-- Current milestone scope. Phase-grained breakdown lives in ROADMAP.md. -->

- [ ] **Infrastructure cutover:** Oracle Cloud Autonomous 19c Free Tier provisioning, thick-mode driver via Oracle Instant Client, all async/asyncpg/Postgres/Docker/Superset/Redis residue removed
- [ ] **Initial Alembic migration → Oracle 19c:** one clean migration that creates all `recviz_*` tables on a fresh Oracle schema; `recviz_alembic_version` table name retained
- [ ] **CLAUDE.md refresh:** slim rewrite, drops Tableau/Qlik framing, Postgres, Superset, Docker, legacy dashboard system; adds Oracle-only hard rule
- [ ] **Global shadcn color palette:** research shadcn's recent color release, pick one palette in Phase 1's UI-SPEC gate, apply globally via CSS variables; frontend-design skill guides per-page application
- [ ] **Settings page (Phase 2):** colorize; discover and fix; manually verify; Data Sources tab is the priority tab
- [ ] **Datasets page (Phase 3):** colorize; discover and fix; manually verify
- [ ] **Charts page (Phase 4):** colorize; discover and fix; manually verify
- [ ] **KPIs page (Phase 5):** colorize; discover and fix; manually verify
- [ ] **Dashboards page (Phase 6):** colorize; discover and fix; manually verify; fix `recviz_data_sources` gap that breaks rendering; delete legacy dead dashboard code (filter-bar.tsx, kpi-row.tsx, chart-grid.tsx, old store shapes); verify `/embed/dashboards/:id` works
- [ ] **Explorer page (Phase 7):** colorize; discover and fix; manually verify; SQL execution path resolves fully via sync oracledb
- [ ] **Alembic audit + dead code sweep (final phase):** audit all alembic migrations fresh against live Oracle; ensure only intended tables are created; global dead code sweep using `.planning/USAGE-TRACKER.md`; prune requirements.txt; memory cleanup
- [ ] **Dead code tracker:** `.planning/USAGE-TRACKER.md` accumulates across all phases, used by final phase for sweep

### Out of Scope

- **Automated tests** — deferred to a future milestone; all verification in this milestone is manual
- **Reports page** (`/reports`) — entirely mock data today; dropped from this milestone entirely, not colorized, not backed
- **PostgreSQL support** — removed entirely, dev + prod both Oracle 19c
- **Docker / containerization** — removed entirely, dev + prod both run natively
- **Superset** — already ditched; this milestone removes any lingering references
- **Redis** — not used anywhere; removed from deps if present
- **Celery / background tasks** — not used; removed from deps if present
- **Authentication / SSO / SAML / OIDC** — still TBD, not part of this milestone
- **Mobile / tablet responsive design** — desktop-only, large-screen data density
- **New user-facing features** — only discovered fixes and small enhancements per page; no greenfield feature work
- **Async DB** — Oracle 19c does not support async; sync SQLAlchemy + Starlette threadpool is the model

## Context

**Environment reality.** Citi production Oracle 19c uses NCS 871 character set, which the `oracledb` thin-mode driver does not support. Production must use thick mode with Oracle Instant Client. To avoid the local/prod drift that has repeatedly burned this project, local dev mimics Citi exactly: Oracle 19c (via Oracle Cloud Always Free Autonomous DB), thick mode with locally-installed Instant Client.

**Personal dev machine.** Local development happens on a personal (non-Citi) machine, so Oracle Cloud access with a personal account is allowed for this project. Citi's actual Oracle instances remain inaccessible from this machine — the Oracle Cloud instance stands in for them during development.

**History of rework.** This project started with Superset + PostgreSQL + async SQLAlchemy assuming parity with Citi's environment. That assumption broke piece by piece once deployment to Citi servers began: Superset was ditched, async was rolled back, PostgreSQL exposed Oracle-specific bugs, Docker was dropped from the prod target. This milestone is the final consolidation — one codebase, one database engine, zero environmental assumptions left over.

**Async cutover status.** The async-to-sync cutover is mostly complete. Residual stragglers: 3 `async def` handlers in `backend/app/api/views.py`, the default URL string in `backend/app/config.py` (still `postgresql+asyncpg://...`), and `alembic.ini` URL. Phase 1 closes these.

**Broken dashboard pipeline.** Post-Superset, the chart renderer still reads `recviz_data_sources` which is never written — dashboards do not render end-to-end today. Fixed inside the Dashboards phase as part of that phase's scope.

**Dead legacy code.** A legacy hardcoded dashboard system exists alongside the config-driven one (`filter-bar.tsx`, `kpi-row.tsx`, `chart-grid.tsx`, old store shapes). It would crash at runtime but references useful cross-filter/drill-down logic. Deleted inside the Dashboards phase.

**Dead UI stubs.** Settings page has non-functional "Density" and "Font Size" buttons in the Appearance tab. Addressed inside the Settings phase.

**Reference UI kit.** `_references/shadcn-ui-kit-dashboard/` stays as the visual baseline for the frontend-design skill during per-page phases.

## Constraints

- **Database**: Oracle 19c only — no PostgreSQL, no other engines. Production character set is NCS 871.
- **Driver mode**: `oracledb` thick mode locally and in production — Instant Client required. Thin mode is explicitly rejected because NCS 871 is unsupported in thin mode.
- **Async**: No async DB anywhere. Sync SQLAlchemy `Session`, sync `oracledb`, FastAPI route handlers as plain `def` (Starlette threadpool). The ASGI framework itself remains async at the boundaries (lifespan, middleware) — that is fine.
- **Docker**: Not used in dev, not used in production. Deleted from the repo.
- **Tech stack (frontend)**: React 19 + Vite 6 + TypeScript 5 + Shadcn/ui + Tailwind 4 + AG Grid Enterprise 35 + AG Charts Enterprise 13 + ECharts (exotic charts only) + TanStack Router + TanStack Query + Zustand + motion/react — locked.
- **Tech stack (backend)**: FastAPI 0.128 + Pydantic 2 + sync SQLAlchemy 2 + `oracledb` (thick) + Alembic. No `asyncpg`, no `psycopg2`, no `sqlalchemy[asyncio]`.
- **Desktop only**: Large-screen data density, no mobile/tablet responsive design.
- **Corporate environment**: On-prem deployment. No cloud services in production. Oracle Cloud is for local dev only.
- **Data volume**: Millions of rows — aggregation-first queries, client-side TanStack Query caching.
- **No automated tests in this milestone**: All verification is manual via browser + real Oracle connection.
- **Execution cadence**: One page per phase. Each phase: colorize, fix discovered issues, manual verify, commit. No page skipped, no tests added.
- **Branching**: Stays on `feature/add-color-remove-postgres`. No phase branches, no milestone branches.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Move metadata + all DB to Oracle 19c | Prod is Oracle 19c only; any dual-engine setup leaks back in via defaults and seed scripts | — Pending |
| `oracledb` thick mode in dev + prod | NCS 871 character set unsupported in thin mode; need local-prod parity to avoid repeat incidents | — Pending |
| Oracle Cloud Always Free Autonomous 19c for local dev | Mimics Citi exactly, free, no local installer pain, real 19c | — Pending |
| No Docker anywhere | Prod doesn't have it; dev having it created false positives | — Pending |
| Sync SQLAlchemy, FastAPI `def` handlers, Starlette threadpool | Oracle 19c doesn't support async; cleaner than `run_in_threadpool` wrappers everywhere | — Pending |
| Retain `recviz_alembic_version` table name | Workaround originally added for Superset co-existence; keeping avoids a rename migration now | — Pending |
| One phase per page, no grouping | User preference for clean isolated scopes | — Pending |
| Settings page first, then datasets → charts → kpis → dashboards → explorer | Settings is smallest and surfaces Data Sources tab (highest user value); natural functional chain after | — Pending |
| Reports page dropped entirely | Mock-data only, no production path, not worth colorizing | — Pending |
| Fixes and enhancements discovered per-phase in discuss, not inventoried upfront | User preference — lighter upfront planning | — Pending |
| Shadcn palette picked once in Phase 1, applied globally via CSS variables | Page phases apply tokens, not invent colors | — Pending |
| `.planning/USAGE-TRACKER.md` accumulates across phases | Dead code sweep requires cross-phase memory | — Pending |
| CLAUDE.md rewritten during project init (before Phase 1) | Cleaner baseline for every subsequent phase's context | — Pending |
| Automated tests deferred to a future milestone | User preference — this milestone focuses on Oracle parity + color | — Pending |
| Memory cleanup deferred to milestone close | Milestone-scoped — stale memory entries pruned after final phase commits | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state
5. **This milestone:** memory cleanup (stale `project_superset_*`, `project_broken_dashboard_pipeline`, `project_local_dev_setup` entries pruned or updated)

---
*Last updated: 2026-04-11 after initialization*
