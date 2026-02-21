# RecViz — Gap Analysis

**Date:** 2026-02-11
**Scope:** Full technical audit of `recviz/` codebase vs `RECVIZ_PLAN.md`
**Branch:** `feat/recviz-initial-build`

---

## Executive Summary

The RecViz codebase has a **strong frontend** (~90% feature-complete) and a **partially-implemented backend** (~55% production-ready). The application runs in mock mode without external dependencies, which is good for demos but masks the fact that critical production features — caching, persistence, export, Elasticsearch, async tasks — are completely unimplemented.

| Layer | Completion | Verdict |
|-------|-----------|---------|
| Frontend Components | 90% | Production-quality UI, minor gaps |
| Frontend State/Hooks | 85% | Cross-filter & drill-down working, missing smart prefetch |
| Backend API Routes | 70% | All endpoints exist, most return mock data |
| Backend Services | 40% | Only SupersetClient implemented; no ES, cache, export, aggregation |
| Infrastructure | 25% | Docker Compose (Postgres+Redis only), no Dockerfiles/Nginx/Makefile |
| Testing | 0% | Zero test files for frontend or backend |

---

## 1. Frontend Gaps

### 1.1 Missing Stores (Plan §5.3 vs Implementation)

The plan specifies 4 Zustand stores. Only 2 exist:

| Store | Plan | Implemented | Notes |
|-------|------|-------------|-------|
| `filter-store.ts` | Yes | **Yes** | Fully working — global + cross-filter state |
| `drill-store.ts` | Yes | **Yes** | Fully working — breadcrumb navigation |
| `theme-store.ts` | Yes | **No** | Replaced by `theme-provider.tsx` (React Context). Functional but deviates from spec. |
| `sidebar-store.ts` | Yes | **No** | Shadcn's built-in `useSidebar()` hook used instead. Acceptable deviation. |

**Impact:** Low — the alternatives work correctly.

### 1.2 Missing Lib Files (Plan §12 vs Implementation)

| File | Plan | Implemented | Notes |
|------|------|-------------|-------|
| `api-client.ts` | Yes | **Yes** | Clean fetch-based client with snake→camelCase transform |
| `utils.ts` | Yes | **Yes** | `cn()` utility |
| `chart-themes.ts` | Yes | **Yes** | Named `chart-themes.ts`, AG Charts theme builder |
| `cross-filter.ts` | N/A | **Yes** | Extra — cross-filter utilities (not in plan) |
| `query-client.ts` | N/A | **Yes** | Extra — TanStack Query client config |
| `constants.ts` | Yes | **No** | Chart colors, breakpoints, etc. not centralized |
| `ag-grid-config.ts` | Yes | **No** | Shared AG Grid config not extracted — inline in `data-grid.tsx` |
| `filter-utils.ts` | Yes | **No** | Filter serialization, URL encoding not implemented |

**Impact:** Medium — `filter-utils.ts` gap means filter state is not URL-shareable (Plan §11.4 "Share views via URL" requires this).

### 1.3 Theme Provider Bug — `next-themes` Conflict

**File:** `frontend/src/components/ui/sonner.tsx:8`

```tsx
import { useTheme } from "next-themes"  // <-- Wrong provider!
```

The app uses a custom `theme-provider.tsx` (React Context) but the Sonner toast component imports `useTheme` from `next-themes`. The `next-themes` package is in `package.json` as a dependency but the rest of the app never uses it.

**Impact:** Medium — Toasts won't respect the app's theme state. Dark mode toasts may render with light theme or vice versa.

**Fix:** Replace `next-themes` import in `sonner.tsx` with the custom provider, or switch the app to use `next-themes` consistently.

### 1.4 Cross-Filter Rules Not Enforced

**Plan §10.1** defines `CrossFilterRule` to control which charts can filter which:

```typescript
// Plan: Rules restrict who filters whom
{ sourceChartId: 'breaks-by-desk', targetChartIds: ['*'], targetField: 'desk' }
{ sourceChartId: 'breaks-by-type', targetChartIds: ['trend-chart', 'detail-grid'], targetField: 'break_type' }
```

**Implementation:** `cross-filter.ts` filters ALL data against ALL cross-filters. The `CrossFilterRule` type exists in `types/filter.ts` and the `useCrossFilter` hook accepts rules, but `chart-grid.tsx` passes an empty rules array and uses the simpler `applyCrossFilters()` utility which doesn't check rules at all.

**Impact:** Medium — Currently every chart cross-filters every other chart. Works for the demo dashboard but violates the plan's targeted filtering model. Could cause confusing behavior with multiple dashboards.

### 1.5 Smart Prefetching Not Implemented

**Plan §9.4** describes prefetching per-filter-value:

```typescript
// Plan: Prefetch each desk in background so drill feels instant
desks.forEach(desk => {
  queryClient.prefetchQuery({
    queryKey: ['chart-data', chartId, { ...globalFilters, desk }],
    ...
  })
})
```

**Implementation:** `use-prefetch.ts` only prefetches the 6 main chart IDs with empty filters. No per-value prefetching.

**Impact:** Low — Feature optimization, not a blocker.

### 1.6 Missing Chart Types in AG Charts Wrapper

**Plan §8.1** lists these AG Charts types: Line, Bar, Area, Pie, Donut, Scatter, Bubble, Histogram, Heatmap, Treemap, Waterfall, Bullet, Range Bar/Area, Box Plot, Candlestick, Combo.

**Implementation (`ag-chart-wrapper.tsx`)** supports: bar, stacked-bar, line, area, pie, donut, scatter, histogram, waterfall, combo.

**Missing:** Heatmap, Treemap, Bubble, Bullet, Range Bar/Area, Box Plot, Candlestick.

**Impact:** Low — These are specialized chart types not used in the current dashboard. Can be added when needed.

### 1.7 No Test Suite

**Plan §18.2** references `make test-fe` (Vitest). Zero test files exist:
- No `vitest.config.ts`
- No `*.test.tsx` files
- No testing dependencies in `package.json` (`vitest`, `@testing-library/react`, `msw`)

**Impact:** High — No regression safety net. Any refactoring risks breaking working features.

### 1.8 Hardcoded KPI Trend Values

**File:** `frontend/src/components/dashboard/kpi-row.tsx`

KPI trend percentages are hardcoded: `3.2%`, `5.1%`, `1.8%`, `12.5%`. These should be computed from the data or returned by the backend.

**Impact:** Low — Cosmetic issue, trends don't reflect actual data changes.

### 1.9 Package Manager Inconsistency

- `SETUP.md` instructs users to run `npm install`
- `pnpm-lock.yaml` exists in the repo (pnpm was used)
- CLAUDE.md doesn't specify npm vs pnpm

**Impact:** Low — Confusing for contributors.

### 1.10 No Code Splitting / Lazy Loading

**Plan §13.2** specifies `React.lazy()` for page components (route-based code splitting). The implementation does not use `React.lazy()` — all routes are eagerly imported.

**Impact:** Low for now (small app), but will matter as the app grows.

---

## 2. Backend Gaps

### 2.1 CRITICAL: No Caching Layer

**Plan §16** defines a 3-layer caching strategy:
1. TanStack Query (browser) — **Implemented**
2. Superset Redis Cache (server) — **Superset config exists**, FastAPI doesn't use it
3. Data Source query — N/A

**Backend reality:** Every API request goes directly to Superset with zero caching in the FastAPI layer. The `cache.py` service file from the plan doesn't exist.

**Missing files:**
- `backend/app/services/cache.py` — Redis cache helpers

**Impact:** Critical — Under concurrent load, every chart refresh hits Superset. KPI calculations query multiple Superset endpoints per request.

### 2.2 CRITICAL: Export Service Is a Stub

**Plan §11.3** specifies:
- PDF via WeasyPrint with branded headers, page numbers, TOC
- Excel via openpyxl with multiple sheets, formatting, conditional colors
- Scheduling via Celery for periodic generation

**Implementation (`backend/app/api/export.py`):** Endpoints exist but return mock job IDs. No actual processing:
- No WeasyPrint integration
- No openpyxl integration
- No Celery workers
- In-memory job store (lost on restart)

**Missing dependencies (not in `requirements.txt`):**
- `celery`
- `weasyprint` (or `playwright`)
- `openpyxl`

**Impact:** Critical — Reports page UI exists but "Generate Now" button does nothing real.

### 2.3 CRITICAL: All Persistence Is In-Memory

| Feature | Storage | Survives restart? |
|---------|---------|-------------------|
| Saved Views | Python dict | **No** |
| Query History | Python list (max 50) | **No** |
| Export Jobs | Python dict | **No** |
| Dashboard Configs | Mock data constant | N/A (hardcoded) |

**Plan §11.4** specifies PostgreSQL or Redis for saved views. Plan §12 shows `alembic/` for DB migrations.

**Missing entirely:**
- `backend/alembic/` directory (migrations)
- `alembic.ini`
- Database schema for app metadata (views, user prefs, dashboard layouts)

**Impact:** Critical — Users lose all saved views and query history on any server restart.

### 2.4 No Elasticsearch Integration

**Plan §4.2, §6.1, §11.1** specify:
- Direct ES queries via `elasticsearch-py` for complex aggregations
- Full-text search across recon data
- Sidecar endpoints for nested aggregations, relevance scoring

**Implementation:** Zero Elasticsearch code exists:
- No `elasticsearch-py` in `requirements.txt`
- No `backend/app/services/elasticsearch.py` (plan §12)
- Search endpoint (`api/search.py`) only does substring matching on mock data

**Impact:** High — Full-text search, real-time aggregations, and all ES-dependent features are non-functional.

### 2.5 No Aggregation Service

**Plan §11.2** specifies custom aggregation endpoints for:
- Weighted aging score
- Rolling reconciliation rate
- Break velocity
- Counterparty risk scoring

**Implementation:** `api/custom.py` has KPI and counterparty endpoints but no `backend/app/services/aggregation_service.py`. Custom calculations are inline stubs.

**Impact:** Medium — Domain-specific analytics not available.

### 2.6 Silent Error Handling

Multiple route handlers use bare `except` blocks that swallow errors:

```python
# Example pattern found in charts.py, datasets.py, sql.py
try:
    result = await superset.some_call()
except:
    pass  # Falls through to mock data
```

**Missing from plan §6.1:**
- `backend/app/core/exceptions.py` — Custom exception handlers
- Structured logging
- Error response models

**Impact:** High — Impossible to debug failures in production. Errors silently return mock data, masking real issues.

### 2.7 Datasets Endpoint Always Returns Mock

**File:** `backend/app/api/datasets.py` — The `GET /api/datasets` endpoint has a comment: "Always return mock datasets" and never calls Superset even when connected.

**Impact:** Medium — Schema browser in the Data Explorer shows only mock table schemas, not the real database.

### 2.8 No Test Suite

**Plan §12** shows `backend/tests/` with `conftest.py`, `test_charts.py`, `test_datasets.py`, `test_sql.py`, `test_export.py`, `test_custom.py`.

**Implementation:** Zero test files. No `pytest` in `requirements.txt`.

**Impact:** High — Same as frontend: no regression safety.

### 2.9 Hardcoded Configuration

**File:** `backend/app/api/charts.py` contains a hardcoded `CHART_DATASOURCE_MAP`:

```python
CHART_DATASOURCE_MAP = {
    "break-trend": {"dataset_id": 2, "columns": [...], ...},
    "breaks-by-category": {"dataset_id": 2, ...},
    ...
}
```

Chart-to-Superset-dataset mappings, column definitions, and metric definitions are all hardcoded. Should be configured per-dashboard.

**Impact:** Medium — Adding new dashboards or charts requires code changes.

### 2.10 Missing Backend Files vs Plan

| Planned File | Exists? | Notes |
|---|---|---|
| `services/superset_client.py` | **Yes** | 95% complete |
| `services/elasticsearch.py` | **No** | Not created |
| `services/export_service.py` | **No** | Not created |
| `services/aggregation_service.py` | **No** | Not created |
| `services/cache.py` | **No** | Not created |
| `core/exceptions.py` | **No** | Not created |
| `tests/conftest.py` | **No** | Not created |
| `tests/test_*.py` (5 files) | **No** | Not created |

---

## 3. Infrastructure Gaps

### 3.1 No Dockerfiles

**Plan §12** shows:
- `backend/Dockerfile` — FastAPI container
- Implied frontend Dockerfile for production builds

**Implementation:** Neither exists. Only `docker-compose.yml` with PostgreSQL + Redis.

**Impact:** High — Cannot containerize the application for deployment.

### 3.2 No Nginx Reverse Proxy

**Plan §2.1, §12, §17** show Nginx as the reverse proxy handling:
- TLS termination
- Routing `/api/*` to FastAPI, `/superset-api/*` to Superset
- Static file serving for frontend

**Missing:**
- `infrastructure/nginx/nginx.conf`
- Nginx service in `docker-compose.yml`

**Impact:** Medium — CORS workarounds needed in dev. Production deployment blocked.

### 3.3 No Makefile

**Plan §18.2** specifies:
```
make dev, make frontend, make backend, make superset, make test,
make test-fe, make test-be, make lint, make build, make seed
```

None of these exist. `SETUP.md` provides manual instructions instead.

**Impact:** Low — Developer convenience, not functional.

### 3.4 No `.env.example`

**Plan §12** shows `.env.example` as a template. Only `.env` exists (with actual credentials committed to git).

**Impact:** Medium — Credentials in repo (dev-only, but bad practice). New devs don't know required env vars.

### 3.5 Docker Compose Is Minimal

**Plan §17.1** shows services: frontend, backend, superset, superset-worker, redis, postgres, nginx.

**Implementation:** Only postgres + redis. Missing 5 services.

**Impact:** Medium — Can't spin up full stack with `docker compose up`.

### 3.6 No Documentation Directory

**Plan §12** shows:
- `docs/api-reference.md`
- `docs/dashboard-config-guide.md`

Neither exists.

**Impact:** Low — Documentation can come later.

---

## 4. Superset Configuration Gaps

### 4.1 Missing Database Drivers

**Plan §3.3** lists drivers for production data sources:

| Driver | Plan | In requirements.txt? | Configured? |
|--------|------|----------------------|-------------|
| `python-oracledb` | Oracle connectivity | **No** | No |
| `pyhive` | Hive connectivity | **No** | No |
| `elasticsearch-dbapi` | ES SQL interface | **No** | No |
| `psycopg2-binary` | PostgreSQL | **Yes** | **Yes** |

**Impact:** High for production — Can't connect to Oracle, Hive, or ES data sources.

### 4.2 Hardcoded Secrets

`superset/superset_config.py` has hardcoded:
- `SECRET_KEY = "recviz-dev-secret-key-change-in-prod"`
- Database credentials in `SQLALCHEMY_DATABASE_URI`
- Redis URLs with no auth

**Impact:** Medium — Acceptable for dev, must be externalized for production.

### 4.3 No Superset Init Script

**Plan §12** shows `superset/init_superset.sh` for bootstrapping:
- `superset db upgrade`
- `superset fab create-admin`
- `superset init`
- Register database connections

**Implementation:** The `seed/register_superset.py` handles Superset registration but there's no shell script for the init sequence. `SETUP.md` doesn't document how to initialize Superset.

**Impact:** Medium — Manual Superset setup required.

---

## 5. Architectural Deviations

### 5.1 Filtering Architecture (Plan §9 vs Reality)

| Tier | Plan | Implemented | Correct? |
|------|------|-------------|----------|
| Tier 1: Global Filters | Backend WHERE clauses via Superset | **Yes** | Yes — filters sent in POST body, Superset generates SQL |
| Tier 2: Cross-Filters | Client-side via Zustand + useMemo | **Yes** | Partially — works but doesn't enforce `CrossFilterRule` targeting |
| Tier 3: Drill-Down | Client-side for aggregated, backend for detail | **Yes** | Yes — re-aggregation in `use-drill-down.ts`, grid external filter at detail level |

**Overall:** 85% correct. The cross-filter rule system is defined but bypassed.

### 5.2 Dashboard Configuration Storage

**Plan §Key Decisions:** "Dashboard layout configs stored in sidecar DB (Oracle), not in Superset."

**Implementation:** Dashboard configs are hardcoded in `backend/app/mock_data.py`. No sidecar DB schema exists.

**Impact:** High — Can't create, edit, or persist custom dashboards. The "dashboard builder" from Phase 4 has no foundation.

### 5.3 Frontend Never Talks to Superset Directly (Plan §Key Decisions)

**Implementation:** Correct. All API calls go through FastAPI. Frontend `api-client.ts` points only at `localhost:8000`.

### 5.4 AG Charts Primary, ECharts Exotic Only (Plan §8)

**Implementation:** Correct. `chart-factory.tsx` routes to ECharts only for: sankey, radar, sunburst, gauge, funnel, graph, parallel. Everything else goes to AG Charts.

---

## 6. Dependency Audit

### 6.1 Frontend — `package.json` vs Plan

| Dependency | Plan | Installed | Version Match? |
|---|---|---|---|
| React | 19.x | **Yes** | 19.2 |
| Vite | 6.x | **Yes** | 7.3 (newer than plan) |
| TypeScript | 5.x | **Yes** | 5.9 |
| Shadcn/ui + Radix | Latest | **Yes** | Via shadcn CLI |
| Tailwind CSS | 4.x | **Yes** | 4.1 |
| AG Grid Enterprise | 33.x | **Yes** | 35.0 (newer than plan) |
| AG Charts Enterprise | 11.x | **Yes** | 13.0 (newer than plan) |
| TanStack Router | 1.x | **Yes** | 1.159 |
| TanStack Query | 5.x | **Yes** | 5.90 |
| Zustand | 5.x | **Yes** | 5.0 |
| Motion | (was Framer Motion 11.x) | **Yes** | 12.34 — correctly uses `motion` package, not `framer-motion` |
| Lucide React | Latest | **Yes** | 0.563 |
| date-fns | 4.x | **Yes** | 4.1 |
| Monaco Editor | Latest | **Yes** | 4.7 (react wrapper) |
| ECharts | 5.x | **Yes** | 6.0 (newer) |
| react-resizable-panels | N/A | **Yes** | 4.6 |
| `next-themes` | **Not in plan** | **Installed** | Unnecessary — only used by Sonner toast |

**Unneeded dependency:** `next-themes` — should be removed and Sonner updated to use the custom theme provider.

### 6.2 Backend — `requirements.txt` vs Plan

| Dependency | Plan | Installed | Notes |
|---|---|---|---|
| FastAPI | 0.115+ | **Yes** | 0.128 |
| Uvicorn | Latest | **Yes** | 0.40 |
| Pydantic 2 | Yes | **Yes** | 2.12 |
| httpx | Latest | **Yes** | 0.28 |
| apache-superset | Yes | **Yes** | Unpinned |
| psycopg2-binary | Implicit | **Yes** | 2.9 |
| redis | Implicit | **Yes** | 4.6 |
| `elasticsearch-py` 8 | **Yes** | **No** | ES integration not built |
| `celery` 5 | **Yes** | **No** | Async tasks not built |
| `weasyprint` | **Yes** | **No** | PDF export not built |
| `openpyxl` | **Yes** | **No** | Excel export not built |
| `pydantic-settings` | **Yes** | **Yes** | 2.12 |
| `sqlalchemy` 2.x | **Yes** | **No** | No direct DB access layer |
| `python-oracledb` | **Yes** | **No** | Oracle driver |
| `pyhive` | **Yes** | **No** | Hive driver |
| `elasticsearch-dbapi` | **Yes** | **No** | ES SQL driver for Superset |

**7 planned dependencies are missing.**

---

## 7. Prioritized Fix List

### P0 — Critical (Must fix for functional product)

| # | Gap | Effort | Location |
|---|-----|--------|----------|
| 1 | **Add persistence layer** — Saved views, query history, export jobs to PostgreSQL + Alembic migrations | Large | Backend |
| 2 | **Implement backend caching** — Redis cache service for chart data, KPIs, dataset metadata | Medium | Backend |
| 3 | **Implement export service** — Celery + WeasyPrint + openpyxl for PDF/Excel generation | Large | Backend |
| 4 | **Fix error handling** — Replace bare `except: pass` with proper logging + error responses, add exception handler middleware | Medium | Backend |
| 5 | **Fix Sonner theme bug** — Replace `next-themes` import with custom theme provider | Small | Frontend |

### P1 — High (Needed for production readiness)

| # | Gap | Effort | Location |
|---|-----|--------|----------|
| 6 | **Add Elasticsearch integration** — elasticsearch-py service + search endpoints | Large | Backend |
| 7 | **Add test suites** — Vitest (frontend) + pytest (backend) with core path coverage | Large | Both |
| 8 | **Unblock datasets endpoint** — Make `GET /api/datasets` call Superset when available | Small | Backend |
| 9 | **Add Dockerfiles** — Backend + frontend containers | Medium | Infra |
| 10 | **Add Nginx config** — Reverse proxy for dev + prod | Medium | Infra |
| 11 | **Implement dashboard CRUD** — Database schema + endpoints for dashboard configs | Large | Backend |
| 12 | **Add structured logging** — JSON logger middleware, request/response logging | Medium | Backend |

### P2 — Medium (Important for completeness)

| # | Gap | Effort | Location |
|---|-----|--------|----------|
| 13 | **Enforce cross-filter rules** — Use `CrossFilterRule` to target specific charts | Medium | Frontend |
| 14 | **Add filter-utils.ts** — URL-encode filter state for shareable links | Medium | Frontend |
| 15 | **Add missing chart types** — Heatmap, treemap, etc. in AG Charts wrapper | Medium | Frontend |
| 16 | **Add Makefile** — Common dev commands | Small | Infra |
| 17 | **Add `.env.example`** — Template env file, remove `.env` from git | Small | Infra |
| 18 | **Compute KPI trends** — Derive from data instead of hardcoding | Small | Frontend+Backend |
| 19 | **Add aggregation service** — Weighted aging, rolling rates, etc. | Medium | Backend |
| 20 | **Add Superset init script** — Automate `superset db upgrade` + admin creation | Medium | Infra |

### P3 — Low (Nice to have)

| # | Gap | Effort | Location |
|---|-----|--------|----------|
| 21 | **Smart prefetching** — Per-filter-value cache warming | Medium | Frontend |
| 22 | **Code splitting** — `React.lazy()` for route pages | Small | Frontend |
| 23 | **Remove `next-themes` dep** — Clean unused dependency | Small | Frontend |
| 24 | **Add docs directory** — API reference, dashboard config guide | Medium | Docs |
| 25 | **Centralize constants** — Extract chart colors, breakpoints to `constants.ts` | Small | Frontend |
| 26 | **Full Docker Compose** — All 7 services from plan | Medium | Infra |

---

## 8. What's Working Well

Credit where due — these areas are solid and should not be reworked:

1. **Component architecture** — Clean separation of layout → pages → domain → shared
2. **Cross-filtering** — Client-side instant filtering with zero network calls works correctly
3. **Drill-down** — Multi-level drill with client-side re-aggregation and detail mode switch
4. **AG Charts integration** — 10+ chart types with theme matching, click handlers, selection highlighting
5. **ECharts integration** — 7 exotic chart types with proper registration and theme sync
6. **AG Grid** — Full-featured data grid with external filters, custom cell renderers, pagination
7. **Data Explorer** — Monaco SQL editor, schema browser, query execution, chart builder
8. **SupersetClient** — Async client with JWT auth, CSRF handling, auto-retry on 401
9. **Seed scripts** — 1M transactions, 150K breaks, realistic distributions, proper indexing
10. **Shadcn theming** — CSS variable system with dark mode, consistent design tokens
11. **Motion animations** — Page transitions, KPI counters, breadcrumb enter/exit
12. **Command palette** — Cmd+K search with debounced API, recent searches, grouped results
13. **API client** — Typed fetch wrapper with automatic snake_case → camelCase key transformation
14. **Mock data fallback** — Every backend route gracefully falls back to mock data when Superset is unavailable

---

## Appendix: Files in Plan But Not in Codebase

```
backend/app/core/exceptions.py
backend/app/services/elasticsearch.py
backend/app/services/export_service.py
backend/app/services/aggregation_service.py
backend/app/services/cache.py
backend/tests/conftest.py
backend/tests/test_charts.py
backend/tests/test_datasets.py
backend/tests/test_sql.py
backend/tests/test_export.py
backend/tests/test_custom.py
backend/Dockerfile
backend/alembic/
backend/alembic.ini
frontend/src/lib/constants.ts
frontend/src/lib/ag-grid-config.ts
frontend/src/lib/filter-utils.ts
frontend/src/components/shared/loading-skeleton.tsx   (skeleton.tsx exists in ui/, no page-level version)
frontend/src/components/shared/empty-state.tsx        (empty.tsx exists in ui/, no domain-level version)
frontend/src/components/grid/grid-status-bar.tsx
frontend/src/components/grid/cell-renderers/date-cell.tsx
frontend/src/components/grid/cell-renderers/sparkline-cell.tsx
frontend/src/hooks/use-grid-data.ts                   (use-breaks-data.ts used instead)
frontend/src/stores/theme-store.ts                    (theme-provider.tsx used instead)
frontend/src/stores/sidebar-store.ts                  (Shadcn useSidebar used instead)
infrastructure/nginx/nginx.conf
infrastructure/docker-compose.prod.yml
infrastructure/redis/redis.conf
infrastructure/scripts/setup-dev.sh
infrastructure/scripts/seed-data.sh
superset/requirements-superset.txt
superset/init_superset.sh
docs/api-reference.md
docs/dashboard-config-guide.md
Makefile
.env.example
.gitignore                                            (may exist but not verified)
```
