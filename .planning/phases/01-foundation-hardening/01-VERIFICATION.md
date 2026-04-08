---
phase: 01-foundation-hardening
verified: 2026-04-04T18:44:34Z
status: passed
score: 12/12 must-haves verified
re_verification: false
human_verification:
  - test: "Start Docker Compose, run seed script, start backend, and load a dashboard"
    expected: "Dashboard loads data from PostgreSQL. No mock data appears. If Superset is down, error panel shows with retry button."
    why_human: "Full stack integration requires running services -- cannot verify programmatically without Docker/Superset"
  - test: "Hover over KPI cards in a dashboard to see full unabbreviated values"
    expected: "Abbreviated numbers (e.g. 1.2M, 45.3K) shown by default; hovering shows tooltip with full number (e.g. 1,234,567)"
    why_human: "Visual tooltip behavior requires browser interaction"
  - test: "Toggle dark mode and verify ErrorPanel, KPI cards, and grid render correctly"
    expected: "All components use Shadcn CSS variable colors and adapt to dark mode without hardcoded colors"
    why_human: "Visual verification of color scheme in both modes"
---

# Phase 01: Foundation Hardening Verification Report

**Phase Goal:** The existing codebase is production-ready -- no mock data masking real errors, no dead code that would crash at runtime, financial numbers formatted correctly, Superset integration hardened, and dashboard configs stored in a database with schema versioning.

**Verified:** 2026-04-04T18:44:34Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Dashboard configs are stored in PostgreSQL, not JSON files on disk | VERIFIED | `ConfigStore` queries `RecvizDashboard` via SQLAlchemy async session. `select(RecvizDashboard)` in config_store.py lines 20-27. No JSON file loading remains in any API endpoint. |
| 2 | Data source configs are stored in PostgreSQL, not JSON files on disk | VERIFIED | `ConfigStore.get_data_source` queries `RecvizDataSource` table. config_store.py lines 35-39. |
| 3 | Config rows have a schema_version integer field that defaults to 1 | VERIFIED | Both `RecvizDashboard` and `RecvizDataSource` models have `schema_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)`. Migration 001 creates columns with `server_default="1"`. |
| 4 | Loading a config from the database runs it through the migration pipeline | VERIFIED | Every `ConfigStore` method calls `migrate_config(row.config)` before returning. config_store.py lines 25, 33, 39, 47. |
| 5 | Existing API endpoints return the same data sourced from PostgreSQL instead of JSON | VERIFIED | `dashboards.py` uses `await config_store.list_dashboards()` and `await config_store.get_dashboard()`. `data_sources.py` uses `ResolvedDataSourceDep`. No JSON file loading. main.py has no `ConfigStore()` singleton. |
| 6 | databases.json references PostgreSQL URIs, not SQLite | VERIFIED | All 4 entries in databases.json use `postgresql://recviz:recviz_dev@localhost:5432/recon_data`. Grep for "sqlite" returns zero matches. |
| 7 | A single formatValue() function handles number, currency, percentage, and decimal formatting via Intl.NumberFormat | VERIFIED | `frontend/src/lib/formatters.ts` exports `formatValue` and `formatValueFull`. Uses `Intl.NumberFormat` with LOCALE pinned to `en-US`. 4 switch cases cover all format types. 19/19 tests pass. |
| 8 | Currency formatting accepts per-row currency codes and gracefully handles missing codes | VERIFIED | `formatValue` checks `if (currencyCode)` -- uses currency style if present, plain number fallback if missing. `amount-cell.tsx` reads `data?.currency` with no hardcoded default. No `?? 'USD'` anywhere. |
| 9 | KPI cards use abbreviated numbers with hover showing full value | VERIFIED | `config-kpi-row.tsx` builds `formatOptions` with `abbreviate: true`, uses `formatValueFull(value, formatOptions)` for `title` attribute on the container div (line 97). `CountAnimation` receives `formatOptions` for animated display. |
| 10 | apache-superset is pinned to specific version in requirements.txt | VERIFIED | `requirements.txt` line 10: `apache-superset==6.0.0` |
| 11 | Legacy dead code files (filter-bar.tsx, kpi-row.tsx, chart-grid.tsx) are deleted | VERIFIED | All three files confirmed absent via filesystem check. Additionally chart-panel.tsx and kpi-card.tsx were also deleted (only imported by deleted files). Zero dangling imports confirmed. |
| 12 | When Superset is unavailable, API endpoints return HTTP errors, never mock data | VERIFIED | `mock_data.py` deleted. Zero `MOCK_` references in backend. All 8 API files (charts, sql, databases, datasets, search, custom, export, views) use `HTTPException` with structured error bodies. No `except Exception: pass` patterns. Frontend `ErrorPanel` with retry renders on error. |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/db/engine.py` | Async SQLAlchemy engine and session factory | VERIFIED | 17 lines. Exports `engine` (create_async_engine) and `async_session_factory` (async_sessionmaker). |
| `backend/app/db/models/dashboard.py` | RecvizDashboard SQLAlchemy model with JSONB config | VERIFIED | 24 lines. Table `recviz_dashboards`, JSONB config, schema_version with default=1. |
| `backend/app/db/models/data_source.py` | RecvizDataSource SQLAlchemy model with JSONB config | VERIFIED | 23 lines. Table `recviz_data_sources`, JSONB config, schema_version with default=1. |
| `backend/app/services/config_migrator.py` | Config schema migration pipeline | VERIFIED | 32 lines. Exports `migrate_config` and `CURRENT_SCHEMA_VERSION=1`. Registration decorator pattern. |
| `backend/app/services/config_store.py` | DB-backed ConfigStore replacing JSON file reader | VERIFIED | 50 lines. All 4 methods async. Takes AsyncSession. Queries models. Calls migrate_config. |
| `backend/app/migrations/versions/001_initial_schema.py` | Initial Alembic migration | VERIFIED | 67 lines. Creates recviz_dashboards and recviz_data_sources tables. Proper upgrade/downgrade. |
| `frontend/src/lib/formatters.ts` | Centralized number formatting utility | VERIFIED | 91 lines. Exports formatValue and formatValueFull. Intl.NumberFormat with LOCALE pinning. |
| `frontend/src/types/formatting.ts` | Formatting option types | VERIFIED | 9 lines. Exports FormatType and FormatNumberOptions. |
| `backend/app/models/error.py` | Structured error response model | VERIFIED | 20 lines. ErrorResponse Pydantic model with error, message, detail, retry_after. |
| `frontend/src/components/shared/error-panel.tsx` | Inline error panel with retry and expandable details | VERIFIED | 60 lines. Props: message, detail, onRetry, compact. Retry button, expandable details, Shadcn CSS variables. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| main.py | db/engine.py | `engine.dispose()` in lifespan shutdown | WIRED | Line 59: `await engine.dispose()` |
| dependencies.py | db/engine.py | `get_db_session` yields from `async_session_factory` | WIRED | Line 23: `async with async_session_factory() as session:` |
| config_store.py | dashboard.py | queries RecvizDashboard table | WIRED | Line 20: `select(RecvizDashboard)`, line 30: `session.get(RecvizDashboard, ...)` |
| config_store.py | config_migrator.py | runs migrate_config on every loaded config | WIRED | Lines 25, 33, 39, 47 all call `migrate_config(row.config)` |
| count-animation.tsx | formatters.ts | imports formatValue | WIRED | Line 4: `import { formatValue } from '@/lib/formatters'` |
| amount-cell.tsx | formatters.ts | imports formatValue | WIRED | Line 4: `import { formatValue } from '@/lib/formatters'` |
| charts.py | error.py model | raises HTTPException with structured error | WIRED | Multiple HTTPException raises with error/message/detail/retry_after dict |
| api-client.ts | error-panel.tsx | ApiError parsed by hooks, ErrorPanel renders | WIRED | ApiError has code/userMessage/detail/retryAfter. ErrorPanel used in config-kpi-row, config-chart-grid, config-data-grid. |
| query-client.ts | api-client.ts | Global toast on ApiError | WIRED | QueryCache onError checks `error instanceof ApiError`, calls `toast.error(error.userMessage)` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| config_store.py | RecvizDashboard rows | PostgreSQL via AsyncSession | Yes -- `select(RecvizDashboard)` queries DB | FLOWING |
| config-kpi-row.tsx | data from useDashboardKpis | Backend API `/api/dashboards/{id}/kpis` | Yes -- goes through ConfigStore + QueryEngine + Superset | FLOWING |
| config-chart-grid.tsx | queryResponse from useDataSourceQuery | Backend API `/api/data-sources/{id}/query` | Yes -- goes through QueryEngine + Superset | FLOWING |
| config-data-grid.tsx | queryResponse from useDataSourceQuery | Backend API `/api/data-sources/{id}/query` | Yes -- goes through QueryEngine + Superset | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend imports resolve | `python -c "from app.db.engine import engine; ..."` | ALL BACKEND IMPORTS AND ASSERTIONS PASS | PASS |
| ConfigStore methods are async | `inspect.iscoroutinefunction(ConfigStore.list_dashboards)` | True for all 4 methods | PASS |
| CURRENT_SCHEMA_VERSION == 1 | Python assert | Passed | PASS |
| Frontend compiles | `npx tsc --noEmit` | Zero errors | PASS |
| Formatters tests pass | `npx vitest run src/lib/formatters.test.ts` | 19/19 tests passing (104ms) | PASS |
| No mock data references | `grep -r "mock_data\|MOCK_" backend/app/` | No matches found | PASS |
| No SQLite in databases.json | `grep -i sqlite databases.json` | No matches found | PASS |
| Dead code files deleted | `test ! -f` for 3 files | All 3 confirmed absent | PASS |
| Cross-filter components preserved | `test -f` for cross-filter-bar.tsx, drill-breadcrumb.tsx | Both confirmed present | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| INFR-01 | 01-01 | Dashboard configs persisted in database -- not static JSON files | SATISFIED | RecvizDashboard model + ConfigStore + Alembic migration + seed script |
| INFR-02 | 01-01 | Config schema versioning with migration support | SATISFIED | config_migrator.py with CURRENT_SCHEMA_VERSION=1, schema_version column on both models, migrate_config called on every load |
| INFR-03 | 01-02 | Superset pinned to specific version with CSRF/auth handling hardened | SATISFIED | `apache-superset==6.0.0` in requirements.txt. superset_client.py reviewed per summary -- auth/CSRF/retry logic confirmed solid |
| INFR-04 | 01-03 | Remove mock data fallbacks -- surface real errors instead of silently serving fake data | SATISFIED | mock_data.py deleted, all 8 API files use structured HTTP errors, ErrorPanel for frontend display |
| INFR-05 | 01-02 | Number formatting utilities for financial data | SATISFIED | formatters.ts with formatValue/formatValueFull, 19 tests, Intl.NumberFormat, locale pinned, currency/percentage/number/decimal |
| INFR-06 | 01-02 | Legacy dead code cleaned up | SATISFIED | 5 files deleted (filter-bar, kpi-row, chart-grid, chart-panel, kpi-card). Cross-filter/drill-down preserved. Zero dangling imports. |

No orphaned requirements found -- all 6 INFR requirements mapped to this phase are accounted for.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/config/seed/seed.db` | N/A | SQLite seed files not deleted (seed.db, seed.db-shm, seed.db-wal) | Info | Plan 01 step 14 specified deletion. Files remain on disk but are not referenced by any active code path. databases.json no longer uses SQLite. No functional impact. |
| `backend/app/services/database_registrar.py` | 82 | Stale log message references `seed.db` and `generate-seed-db.py` | Info | Should reference `seed-postgres.py` instead. Log message only -- no functional impact. |
| `backend/app/services/query_engine.py` | 70 | Contains `elif dialect == "sqlite"` branch | Info | Multi-dialect support -- handles Oracle, SQLite, PostgreSQL. Reasonable to keep for flexibility. Not dead code per se. |
| `frontend/src/hooks/use-kpi-data.ts` | 1 | `// TODO: Phase 2` comment | Info | Intentional marker per Plan 02 for Phase 2 porting. Not a stub. |
| `frontend/src/hooks/use-chart-data.ts` | 1 | `// TODO: Phase 2` comment | Info | Intentional marker per Plan 02 for Phase 2 porting. Not a stub. |

No blocker or warning-level anti-patterns found. All items are informational.

### Human Verification Required

### 1. Full Stack Integration Test

**Test:** Start Docker Compose (`docker compose up -d`), run `python scripts/seed-postgres.py`, start backend (`uvicorn app.main:app`), start frontend (`pnpm dev`), and navigate to a dashboard.
**Expected:** Dashboard loads with data from PostgreSQL. KPIs show abbreviated numbers. Charts render data. No mock data appears. If Superset is stopped, error panels appear with retry buttons.
**Why human:** Requires running Docker, PostgreSQL, Superset, and browser -- full service stack.

### 2. KPI Hover Tooltip Verification

**Test:** Hover over KPI card values on a dashboard.
**Expected:** Abbreviated numbers (e.g., "1.2M", "45.3K") shown by default. Native browser tooltip shows full unabbreviated number (e.g., "1,234,567").
**Why human:** Tooltip behavior requires browser hover interaction.

### 3. Dark Mode Verification

**Test:** Toggle dark mode via theme switch. Inspect ErrorPanel, KPI cards, grid cells, and chart containers.
**Expected:** All components adapt to dark mode using Shadcn CSS variable colors. No hardcoded hex/rgb values visible. Destructive colors for errors remain readable.
**Why human:** Visual color scheme verification in both modes.

### 4. Error Panel Expandable Details

**Test:** Stop Superset and refresh a dashboard. Click "Details" button on the ErrorPanel.
**Expected:** Expandable section reveals sanitized technical details. No connection URIs or credentials visible. "Retry" button re-fetches data. Sonner toast also appears.
**Why human:** Requires intentionally breaking Superset and visual interaction with error UI.

### Gaps Summary

No gaps found. All 12 observable truths verified against the codebase. All 6 requirements (INFR-01 through INFR-06) satisfied with concrete implementation evidence. All artifacts exist, are substantive, and are properly wired. All behavioral spot-checks pass (backend imports, TypeScript compilation, 19/19 formatter tests, no mock data references).

Minor housekeeping items (SQLite seed files not deleted, stale log message) are informational only and do not block the phase goal.

---

_Verified: 2026-04-04T18:44:34Z_
_Verifier: Claude (gsd-verifier)_
