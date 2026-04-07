# Phase 9: Sharing and Views - Research

**Researched:** 2026-04-08
**Domain:** URL state sync (TanStack Router), iframe embedding, FastAPI search rewrite against managed Postgres tables
**Confidence:** HIGH

## Summary

Phase 9 is a hardening + rewiring phase, not a build-from-scratch phase. SHAR-02 (URL filter sync), SHAR-03 (embed mode hardening), and SHAR-04 (command palette rewrite) all build on existing scaffold from Phases 1-8. The dominant risk is *not* about new features — it is about **runtime correctness of three pieces of legacy plumbing** that the discuss-phase scout already flagged:

1. The legacy `useDashboardConfig` hook is still wired into BOTH `routes/_app/dashboards/$dashboardId.tsx`, `routes/_app/dashboards/$dashboardId.edit.tsx`, AND `routes/embed/dashboards/$dashboardId.tsx`. The Phase 8 `08-10` decision in STATE.md claims the view page was switched, but the file on disk still imports `useDashboardConfig`. **The supposed switch never happened in code.** This must be verified and fixed in Phase 9.
2. `backend/app/api/search.py` queries Superset for chart/dataset search — completely disconnected from the Phase 6/7 `recviz_charts` and `recviz_kpis` tables. Users searching for a chart they just built in the library find nothing.
3. The embed route's filter parser is duplicated logic that wants to be lifted to a shared util so the regular view route can reuse it for SHAR-02.

The good news: the legacy `/api/dashboards/{id}` endpoint (`useDashboardConfig`) and the new `/api/dashboards/managed/{id}` endpoint (`useManagedDashboard`) **both read from the same `recviz_dashboards` SQLAlchemy table**. This was traced through `backend/app/services/config_store.py:29` (`session.get(RecvizDashboard, ...)`) and `backend/app/api/managed_dashboards.py:78` (`select(RecvizDashboard).where(...)`). So the upgrade is semantic, not data-restoration: both endpoints currently work on Phase 8 dashboards, but the legacy endpoint is V1 plumbing destined for deprecation, and the managed endpoint exposes the wrapper metadata (createdAt, updatedAt, name, description as fields rather than buried in the config blob).

**Primary recommendation:** Upgrade view + edit + embed routes to `useManagedDashboard` as the very first task in Plan 1. Then lift the embed filter parser to `lib/dashboard-url-state.ts` and reuse it on the view route for the share-link feature. Then rewrite `search.py` to query the four `recviz_*` tables with raw SQLAlchemy in the route handler (matching the existing precedent set by `managed_charts.py`, `managed_kpis.py`, `managed_datasets.py`, `managed_dashboards.py` — none of which use a service layer despite CLAUDE.md saying they should).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### URL State Sync (SHAR-02)

- **D-01:** URL encoding format is **per-filter query params**, identical to the existing embed route format. Example: `/dashboards/abc?filter.region=APAC&filter.product=A,B,C`. Multi-select values are comma-separated. Bookmarkable, hand-editable, debuggable. Reuses the existing parser pattern from `routes/embed/dashboards/$dashboardId.tsx`.
- **D-02:** URL state scope is **filters only**. Drill-down state, cross-filter active selection, grid sort/column state, fullscreen state are NOT encoded. Opening a shared link resets these to defaults. Aligns exactly with SHAR-02 wording: "filter state encoded in URL params."
- **D-03:** Sync timing is **live, debounced (~300ms)** using router `replace` (not `push`). The URL stays current as the user adjusts filters; the back button is not polluted with intermediate filter states. No explicit "Generate link" action required — every URL is always shareable.
- **D-04:** Share UI is a **single "Copy link" button** in the dashboard view-mode toolbar. Click → copies current URL to clipboard → toast "Link copied". No popover, no preview, no advanced options. Smallest scope, ships fastest.
- **D-05:** Stale-link handling is **Claude's discretion** for the planner: if a shared link references a filter that no longer exists on the dashboard (filter was deleted by builder), the unknown filter param is ignored silently. Known filters apply as normal.

#### Embed Mode (SHAR-03)

- **D-06:** **Keep `EmbedTopbar`** as-is. No fully-chromeless mode in Phase 9. The slim topbar stays as the default for embedded dashboards. (Granular hiding via `?hide=` in D-08 lets the host portal hide individual sections if needed.)
- **D-07:** Existing URL params are kept and confirmed: `?theme=dark|light`, `?filter.<id>=<value>`, `?filter.lock=<id1>,<id2>`. These already work in `routes/embed/dashboards/$dashboardId.tsx`.
- **D-08:** **New URL param `?hide=`** with comma-separated tokens for granular section hiding. Initial supported tokens: `filter-bar`, `title`, `toolbar`. Example: `?hide=filter-bar,title`. Any future hide tokens use the same param.
- **D-09:** Single-tile embed (`?single=chart-id`) is **NOT in scope**. Embed mode is whole-dashboard only. Single-tile is a future enhancement if portal teams ask for it.
- **D-10:** **Full interactivity in embed mode**. Cross-filter, drill-down, fullscreen chart view, manual refresh, auto-refresh all work the same as the regular `/_app/dashboards/:id` route. Embed is purely "chromeless rendering" — same renderer, same behaviors. Locked filters (via `?filter.lock=`) are the only interactivity restriction.
- **D-11:** **No auth** for embed in v1 — anyone with the URL can load the embed. Matches the rest of the v1 product (auth deferred). Document the trust assumption in code: corporate intranet only, all RecViz URLs are equally accessible. Revisit when SSO arrives.
- **D-12:** **Embed route MUST be upgraded** from the legacy `useDashboardConfig` hook to `useManagedDashboard`. The same upgrade applies to the regular view route at `routes/_app/dashboards/$dashboardId.tsx` if it has not already been done.

#### Command Palette (SHAR-04)

- **D-13:** Search **all four managed entity types**: dashboards (`managed_dashboards`), charts (`managed_charts`), datasets (`managed_datasets`), KPIs (`managed_kpis`). KPIs are a NEW source — not searched in the current implementation.
- **D-14:** **Clean rewrite** of `backend/app/api/search.py`. Drop all Superset calls. Query the four managed tables directly via the existing repository/store layer.
- **D-15:** Result ordering is **grouped by type, alphabetical within group**. Sections in this order: Dashboards → Charts → Datasets → KPIs. Within each section, name-prefix matches before substring matches, then alphabetical.
- **D-16:** **Search-only palette**. No quick actions, no recently-visited items in the empty state, no keyboard hints in the footer. The current behavior (recent search terms in localStorage when empty) is kept as-is.
- **D-17:** Frontend palette navigation routes are updated where needed: chart and KPI results route to their `/charts/:id/edit` and `/kpis/:id/edit` pages from the managed library, not to a dashboard. Dataset results route to `/datasets/:id/edit`. Dashboard results route to `/dashboards/:id` (view mode).

#### Cross-cutting

- **D-18:** Saved-view scaffold (`use-saved-views.ts`, `types/views.ts`, `backend/app/api/views.py`, `backend/app/models/views.py`) is **NOT touched** by Phase 9.
- **D-19:** No new database tables in Phase 9. No Alembic migration required.

### Claude's Discretion

- Stale-link filter handling (silent ignore vs warn vs error) — planner picks.
- Debounce duration for URL push (200ms vs 300ms vs 500ms) — planner picks.
- Toast styling/copy for "Link copied" — planner picks.
- Result limit per palette type group (top 5? top 10?) — planner picks.
- Whether to show a small "embedded dashboard" indicator in the EmbedTopbar — planner picks.

### Deferred Ideas (OUT OF SCOPE)

- **SHAR-01 Saved Views** — full feature deferred to next milestone alongside reports, exports, templates. The existing scaffold (`use-saved-views.ts`, `types/views.ts`, `backend/app/api/views.py` in-memory store, `backend/app/models/views.py`) is left in place untouched.
- **Single-tile embed** (`?single=chart-id-or-kpi-id`).
- **Server-side short-ID share links** (`?s=ax7k2`).
- **Quick actions in command palette** (verb-launcher).
- **Recently-visited items in palette empty state**.
- **Token-gated embeds / referer allowlist**.
- **Drill state in URL** (`?drill.chart-1=EMEA,UK,Q3`).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHAR-02 | Shareable URLs — filter state encoded in URL params, recipient opens exact same view | TanStack Router `validateSearch` + `useSearch` + `navigate({ search, replace: true })` pattern verified via official docs and Leonardo Montini guide. Existing embed parser at `routes/embed/dashboards/$dashboardId.tsx:24-36` is the canonical pattern to lift into `lib/dashboard-url-state.ts`. `DashboardRenderer` already accepts `initialFilters` + `lockedFilters` props (verified at `components/dashboard/dashboard-renderer.tsx:20-30`). `navigator.clipboard.writeText` already used at `lib/chart-export.ts:69`. Sonner toast wired in dashboard-renderer for `toast.success()` pattern. |
| SHAR-03 | Embed loads from managed_dashboards, supports `?theme`, `?filter.X`, `?filter.lock`, new `?hide=filter-bar,title,toolbar` | Hook upgrade is the primary fix — `useDashboardConfig` (legacy V1, queries `/api/dashboards/{id}`) → `useManagedDashboard` (queries `/api/dashboards/managed/{id}`). Both currently read same `recviz_dashboards` table; upgrade is semantic. `?hide=` parser is a small extension to existing search-parsing loop. `EmbedTopbar` is 27 lines, takes `title`, `dashboardId`, `filterParams` props — adding hide-section support is a 1-prop extension. |
| SHAR-04 | Cmd+K searches dashboards/charts/datasets/KPIs from managed tables, results grouped by type, navigate directly | All four managed tables (`recviz_dashboards`, `recviz_charts`, `recviz_kpis`, `recviz_datasets`) exposed via SQLAlchemy `Base` models. Existing CRUD route handlers (`managed_*.py`) demonstrate the raw `select(RecvizX).where(...)` pattern with `DbSessionDep`. Frontend `command-palette.tsx` is 270 lines and already does most of the UX; only `typeRoutes`, `groupLabels`, `typeIcons`, `SearchResult.type` union, and result rendering need KPI added. Recent searches localStorage already works (D-16 keeps it). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

These are absolute rules from the project's CLAUDE.md and must be honored by every plan in Phase 9:

### TypeScript / React
- Strict TypeScript. **No `any`. No `@ts-ignore`.** Use `unknown` + type narrowing.
- Functional components only. Named exports for components/hooks/stores/utilities (page components are the only exception with `default export` for TanStack Router).
- One primary component per file. No barrel exports.
- Imports order: React → external → internal absolute → relative → types, with blank lines between groups.
- Hooks return objects, not arrays.

### Styling
- ONLY Shadcn CSS variable colors (`text-foreground`, `bg-background`, `text-muted-foreground`, etc.). **NEVER hardcode hex/rgb/hsl.**
- Tailwind utility classes preferred. Avoid custom CSS files.
- Status colors: `text-green-600 dark:text-green-400` style — always include dark variant.
- Page padding `p-6`. Section gaps `gap-6`. Grid gaps `gap-4`.

### Animation
- `motion/react` (NOT `framer-motion`). Page transitions 200ms ease-out. Tooltip delay 300ms. Toast via Sonner.

### State
- Zustand for client state. TanStack Query for server state. **Never store fetched data in Zustand.**
- Use selectors to avoid re-renders.
- Cross-filter and drill-down state lives in Zustand (`filter-store`, `drill-store`).

### File naming
- Components `kebab-case.tsx`. Hooks `use-{name}.ts`. Stores `{name}-store.ts`. Utils `kebab-case.ts`. Tests `{name}.test.ts(x)`. Python `snake_case.py`.

### API client
- Single `lib/api-client.ts` using `fetch`. Throws on non-2xx. `transformKeys` runs snake→camel except for `DATA_KEYS = {'rows', 'columns', 'data', 'config'}`.

### Python / FastAPI
- Async everywhere. Pydantic 2 models for I/O.
- Service layer pattern documented: route handlers should call services. **NOTE: Phases 5-8 broke this rule** — `managed_charts.py`, `managed_kpis.py`, `managed_datasets.py`, `managed_dashboards.py` all do raw `select(RecvizX)` inside the route handler with no service wrapper. The Phase 9 search rewrite has two valid options: (a) follow the established precedent and put SQLAlchemy in `search.py` directly, or (b) build the service layer that should have existed all along. **The planner must pick one explicitly.**
- Dependency injection via `Depends()`.

### Dark mode
- Every component must work in both light and dark mode. No exceptions. Test both before marking complete.

### Workflow
- Every phase must leave a working testable product (memory: `feedback_incremental_testing.md`).
- Playwright MCP visual verification required, not just compile/unit tests (memory: `feedback_playwright_thoroughness.md`).
- No mock/hardcoded data shortcuts (memory: `feedback_no_mock_shortcuts.md`).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-router | 1.159.5 (codebase) / 1.168.10 (current) [VERIFIED: npm view @tanstack/react-router version → 1.168.10] | Bidirectional URL search-state via `validateSearch` + `useSearch` + `navigate({ search, replace })` | Already installed; only router in this codebase; canonical type-safe filter-in-URL pattern |
| sonner | 2.0.7 [VERIFIED: package.json + npm view] | Toast notifications for "Link copied" | Already installed; existing patterns at `dashboard-renderer.tsx:55`, `grid-toolbar.tsx:62,78` |
| zustand | 5.0.11 [VERIFIED: package.json] | `filter-store` is the state bridge between URL and the renderer | Already installed; existing `applyFilters()` action publishes to `applied` snapshot which the URL writer reads from |
| react | 19.2.0 [VERIFIED: package.json] | `useEffect` for URL→store init on mount, `useEffect` for store→URL write on `applied` change | Already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-query | 5.90.20 [VERIFIED: package.json] | Wrap `useManagedDashboard` (already wired) | Replaces `useDashboardConfig` invocations on view/edit/embed routes |
| Browser `navigator.clipboard.writeText` | Native | Copy share link to clipboard | Already used at `lib/chart-export.ts:69` and `query-results.tsx:67` — same pattern, no library needed |
| sqlalchemy | 2.0.49 (async) [VERIFIED: backend/requirements.txt] | Backend search rewrite — `select(RecvizDashboard).where(name.ilike('%' + q + '%'))` | Async session via `DbSessionDep` (existing dependency) |
| FastAPI TestClient | bundled with FastAPI 0.128.6 [VERIFIED: requirements.txt] | Test the rewritten `search.py` | Existing test pattern: `tests/test_managed_charts.py` mocks `MagicMock` rows |
| @playwright/test | 1.59.1 [VERIFIED: package.json] | E2E share-link copy + palette navigation flow | Existing `frontend/playwright.config.ts` runs against `http://localhost:5173` with `webServer: pnpm dev` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TanStack Router `useSearch` + `useNavigate` | `window.history.replaceState` + manual URL parsing | Loses type safety; loses validateSearch; not idiomatic in this codebase |
| Lifting filter parser to shared util | Duplicate parser inline in view route | Less DRY, two places to fix when SHAR-01 saved views eventually need it |
| Raw SQLAlchemy in `search.py` route handler | New `app/services/managed_search.py` service wrapper | Service layer is cleaner per CLAUDE.md but breaks consistency with `managed_*.py` precedent — see Architecture Patterns below |
| Single combined search query (UNION ALL across 4 tables) | Four separate queries in parallel via `asyncio.gather` | UNION is harder to type; gather is consistent with managed table pattern; small N (4 tables) makes overhead negligible |

**Installation:**
```bash
# Nothing new to install. All dependencies already in package.json and requirements.txt.
```

**Version verification:**
- `@tanstack/react-router 1.159.5` (codebase) — confirmed via `frontend/package.json`. Latest npm version is `1.168.10`. The codebase version is acceptable for Phase 9; no upgrade needed.
- `sonner 2.0.7` — codebase matches latest [VERIFIED: npm view sonner version → 2.0.7].
- `vitest 4.1.2`, `@playwright/test 1.59.1`, `@testing-library/react 16.3.2` — all installed.

## Architecture Patterns

### Recommended Project Structure (additions only — Phase 9 is mostly editing existing files)
```
frontend/src/
├── lib/
│   └── dashboard-url-state.ts       # NEW — extracted filter URL parser + writer
├── routes/
│   ├── _app/
│   │   └── dashboards/
│   │       ├── $dashboardId.tsx     # EDIT — add validateSearch, useSearch, useNavigate, Share button, hook upgrade
│   │       └── $dashboardId.edit.tsx # EDIT — hook upgrade (legacy → managed)
│   └── embed/
│       └── dashboards/
│           └── $dashboardId.tsx     # EDIT — hook upgrade, ?hide= parser, pass-through to renderer
├── components/
│   ├── dashboard/
│   │   ├── dashboard-renderer.tsx   # EDIT — accept hideFilterBar/hideToolbar/hideTitle props (or planner picks: handle hiding in route)
│   │   └── share-link-button.tsx    # NEW — small button + clipboard + toast
│   ├── embed/
│   │   └── embed-topbar.tsx         # EDIT — accept hideTitle prop (or hide entire topbar via ?hide=toolbar)
│   └── layout/
│       └── command-palette.tsx      # EDIT — add KPI to typeIcons/typeRoutes/groupLabels, fix chart route from /dashboards/${id} → /charts/${id}/edit, add dataset edit route

backend/app/api/
├── search.py                        # REWRITE — drop Superset, query 4 managed tables
└── (no other backend files change)

# Optional, depending on planner choice for service layer:
backend/app/services/
└── managed_search.py                # NEW (optional) — wraps the 4 SELECT queries in a service class
```

### Pattern 1: TanStack Router URL state sync (bidirectional, replace, debounced)

**What:** Read URL → store on mount; write store → URL on `applied` change. Use `replace: true` to avoid history pollution.
**When to use:** Any route where filter/UI state should be shareable via URL but not pollute browser history.

**Example pattern:**
```tsx
// Source: https://leonardomontini.dev/tanstack-router-query-params/ [CITED]
// Source: TanStack Router v1 official docs (validateSearch + useSearch + useNavigate)
// Pattern verified against existing embed route at routes/embed/dashboards/$dashboardId.tsx

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createFileRoute('/_app/dashboards/$dashboardId')({
  // Permissive validateSearch — pass everything through, parsing is downstream.
  // Matches the existing pattern in routes/embed/dashboards/$dashboardId.tsx:13
  validateSearch: (search: Record<string, unknown>) => search,
  component: DashboardPage,
})

function DashboardPage() {
  const { dashboardId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  // 1) URL → store (run once per dashboardId on mount)
  const initialFilters = parseFilterParams(search) // from lib/dashboard-url-state.ts
  // pass to <DashboardRenderer initialFilters={initialFilters} /> — already supported

  // 2) Store → URL (run on applied filter change, debounced)
  const applied = useFilterStore((s) => s.applied)
  useEffect(() => {
    const handle = setTimeout(() => {
      navigate({
        // Use a function form so existing non-filter params (e.g. ?theme=) survive.
        search: (prev) => ({
          ...stripFilterParams(prev),
          ...serializeFilterParams(applied),
        }),
        replace: true, // history.replaceState — does NOT push a new history entry
      })
    }, 300) // D-03 debounce
    return () => clearTimeout(handle)
  }, [applied, navigate])

  // ...
}
```

**Critical detail about `replace: true`:** Per TanStack Router v1 docs, `replace: true` calls `history.replaceState()` instead of `pushState()` — exactly what's needed to keep the URL current without polluting back-button history. [CITED: leonardomontini.dev TanStack Router guide]

**Critical detail about `search: (prev) => (...)`:** The function form is mandatory — passing a plain object replaces ALL search params, wiping out things like `?theme=dark`. Always spread `prev` first. [CITED: leonardomontini.dev]

### Pattern 2: Filter URL parser and serializer (lift from embed route)

**What:** Convert `?filter.region=APAC&filter.product=A,B,C` ⇄ `Record<string, FilterValue>`.

**Source location to lift from:** `routes/embed/dashboards/$dashboardId.tsx:21-36` (the existing canonical implementation).

**New shared util shape:**
```ts
// frontend/src/lib/dashboard-url-state.ts
import type { FilterValue } from '@/types/filter'

const FILTER_PREFIX = 'filter.'
const LOCK_KEY = 'filter.lock'
const HIDE_KEY = 'hide'
const THEME_KEY = 'theme'

export function parseFilterParams(
  search: Record<string, unknown>,
): Record<string, FilterValue> {
  const out: Record<string, FilterValue> = {}
  for (const [key, val] of Object.entries(search)) {
    if (key === LOCK_KEY) continue
    if (key.startsWith(FILTER_PREFIX) && typeof val === 'string') {
      const filterId = key.slice(FILTER_PREFIX.length)
      // Comma-separated → array (multi-select), otherwise scalar string
      out[filterId] = val.includes(',') ? val.split(',') : val
    }
  }
  return out
}

export function parseLockedFilters(search: Record<string, unknown>): string[] {
  const raw = search[LOCK_KEY]
  return typeof raw === 'string' && raw.length > 0 ? raw.split(',') : []
}

export function parseHideTokens(search: Record<string, unknown>): Set<string> {
  const raw = search[HIDE_KEY]
  return typeof raw === 'string' ? new Set(raw.split(',')) : new Set()
}

export function serializeFilterParams(
  applied: Record<string, FilterValue>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [filterId, val] of Object.entries(applied)) {
    if (val == null) continue
    if (Array.isArray(val)) {
      if (val.length === 0) continue // empty array → omit
      out[`${FILTER_PREFIX}${filterId}`] = val.join(',')
    } else {
      out[`${FILTER_PREFIX}${filterId}`] = String(val)
    }
  }
  return out
}

export function stripFilterParams(
  prev: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(prev)) {
    if (!k.startsWith(FILTER_PREFIX)) out[k] = v
  }
  return out
}

export function buildShareUrl(
  pathname: string,
  applied: Record<string, FilterValue>,
): string {
  const params = serializeFilterParams(applied)
  const qs = new URLSearchParams(params).toString()
  return qs ? `${pathname}?${qs}` : pathname
}
```

**Why split into multiple small functions:** The view route needs `parseFilterParams` + `serializeFilterParams` + `stripFilterParams` for read-write sync. The embed route needs `parseFilterParams` + `parseLockedFilters` + `parseHideTokens`. The Share button needs `buildShareUrl`. Splitting keeps each function single-purpose and trivially testable.

### Pattern 3: Backend search rewrite — parallel queries to managed tables

**What:** `search.py` runs four `SELECT` queries in parallel, sorts results within each group (prefix-match → substring-match → alphabetical), and returns a flat list grouped by type.

**Verified precedent:** The existing managed `*.py` files (`managed_charts.py`, `managed_kpis.py`, `managed_datasets.py`, `managed_dashboards.py`) all do `select(RecvizX).where(...)` directly in route handlers using `DbSessionDep`. This sets the precedent.

```python
# backend/app/api/search.py — REWRITE
from __future__ import annotations

import asyncio
from fastapi import APIRouter
from sqlalchemy import or_, select

from app.core.dependencies import DbSessionDep
from app.db.models.dashboard import RecvizDashboard
from app.db.models.chart import RecvizChart
from app.db.models.kpi import RecvizKpi
from app.db.models.dataset import RecvizDataset
from app.models.base import CamelModel

router = APIRouter(prefix="/api/search", tags=["search"])


class SearchRequest(CamelModel):
    query: str
    types: list[str] | None = None  # subset of ["dashboard", "chart", "dataset", "kpi"]
    limit_per_type: int = 10        # default top-10 per group


class SearchResult(CamelModel):
    type: str            # "dashboard" | "chart" | "dataset" | "kpi"
    id: str
    name: str
    description: str | None = None


class SearchResponse(CamelModel):
    query: str
    results: list[SearchResult]
    total: int


def _rank_results(rows: list[tuple[str, str, str | None]], q: str) -> list[tuple[str, str, str | None]]:
    """Order: name-prefix matches first, then substring, then alphabetical. Per D-15."""
    q_lower = q.lower()
    def sort_key(row: tuple[str, str, str | None]) -> tuple[int, str]:
        name_lower = row[1].lower()
        if name_lower.startswith(q_lower):
            return (0, name_lower)
        return (1, name_lower)
    return sorted(rows, key=sort_key)


@router.post("", response_model=SearchResponse)
async def search(body: SearchRequest, session: DbSessionDep) -> SearchResponse:
    q = body.query.strip()
    if not q:
        return SearchResponse(query=body.query, results=[], total=0)

    types = set(body.types) if body.types else {"dashboard", "chart", "dataset", "kpi"}
    pattern = f"%{q}%"
    limit = body.limit_per_type

    async def fetch_dashboards() -> list[SearchResult]:
        if "dashboard" not in types:
            return []
        stmt = (
            select(RecvizDashboard.id, RecvizDashboard.name, RecvizDashboard.description)
            .where(or_(RecvizDashboard.name.ilike(pattern), RecvizDashboard.description.ilike(pattern)))
        )
        result = await session.execute(stmt)
        rows = list(result.all())
        ranked = _rank_results([(r[0], r[1], r[2]) for r in rows], q)[:limit]
        return [SearchResult(type="dashboard", id=r[0], name=r[1], description=r[2]) for r in ranked]

    async def fetch_charts() -> list[SearchResult]:
        if "chart" not in types:
            return []
        stmt = (
            select(RecvizChart.id, RecvizChart.name, RecvizChart.description)
            .where(or_(RecvizChart.name.ilike(pattern), RecvizChart.description.ilike(pattern)))
        )
        result = await session.execute(stmt)
        rows = list(result.all())
        ranked = _rank_results([(r[0], r[1], r[2]) for r in rows], q)[:limit]
        return [SearchResult(type="chart", id=r[0], name=r[1], description=r[2]) for r in ranked]

    async def fetch_datasets() -> list[SearchResult]:
        if "dataset" not in types:
            return []
        stmt = (
            select(RecvizDataset.id, RecvizDataset.name, RecvizDataset.description)
            .where(or_(RecvizDataset.name.ilike(pattern), RecvizDataset.description.ilike(pattern)))
        )
        result = await session.execute(stmt)
        rows = list(result.all())
        ranked = _rank_results([(r[0], r[1], r[2]) for r in rows], q)[:limit]
        return [SearchResult(type="dataset", id=r[0], name=r[1], description=r[2]) for r in ranked]

    async def fetch_kpis() -> list[SearchResult]:
        if "kpi" not in types:
            return []
        stmt = (
            select(RecvizKpi.id, RecvizKpi.name, RecvizKpi.description)
            .where(or_(RecvizKpi.name.ilike(pattern), RecvizKpi.description.ilike(pattern)))
        )
        result = await session.execute(stmt)
        rows = list(result.all())
        ranked = _rank_results([(r[0], r[1], r[2]) for r in rows], q)[:limit]
        return [SearchResult(type="kpi", id=r[0], name=r[1], description=r[2]) for r in ranked]

    # NOTE: A single AsyncSession is NOT safe for parallel queries.
    # Run sequentially OR use a fresh session per parallel branch.
    # See "Common Pitfalls" → SQLAlchemy async session reuse.
    dashboards = await fetch_dashboards()
    charts = await fetch_charts()
    datasets = await fetch_datasets()
    kpis = await fetch_kpis()

    results = dashboards + charts + datasets + kpis
    return SearchResponse(query=body.query, results=results, total=len(results))
```

**IMPORTANT:** SQLAlchemy async session is **not** safe to use across parallel `asyncio.gather()` branches with the same session — it will raise `IllegalStateChangeError`. The pattern above runs sequentially for safety. Four small queries against indexed `name`/`description` columns will return in <50ms total even at 10K rows per table, so the perf cost of sequential is negligible for this scale. If parallelism is needed later, use `asyncio.gather` with separate `async_sessionmaker` invocations.

### Pattern 4: Hook upgrade (legacy → managed)

**What:** Replace `useDashboardConfig(id)` → `useManagedDashboard(id)` in three route files. The shape difference is wrapper-level: legacy returns `DashboardConfig` directly; managed returns `{id, name, description, config: DashboardConfig, createdAt, updatedAt}`.

```tsx
// BEFORE (current state of routes/_app/dashboards/$dashboardId.tsx)
const { data: config, isLoading } = useDashboardConfig(dashboardId)
// config is DashboardConfig

// AFTER
const { data: dashboard, isLoading } = useManagedDashboard(dashboardId)
const config = dashboard?.config
// dashboard.name, dashboard.description, dashboard.createdAt available as siblings
```

**Why this matters semantically even though both endpoints currently work:**
- The legacy endpoint at `GET /api/dashboards/{id}` is V1 plumbing destined for cleanup. It runs `migrate_config()` (currently a no-op since `CURRENT_SCHEMA_VERSION=1`) but is the intended migration boundary.
- The managed endpoint exposes `name`, `description`, `createdAt`, `updatedAt` as top-level fields rather than buried in the config dict. The view route currently re-reads `config.name` from inside the config blob, which is fine but is the wrong field for "freshness" UX (nothing in the legacy path tells you when the dashboard was last saved).
- Phase 8 builder writes via the managed path. Search results in Phase 9 will return `id` from the managed table. The view route needs to consistently work against the managed shape so the data flow is end-to-end coherent.

### Pattern 5: Command palette KPI integration

**Current state:** `command-palette.tsx` has `typeIcons`, `typeRoutes`, `groupLabels` maps for `dashboard | chart | dataset`. The chart route is wrong: it points to `/dashboards/${id}` (a leftover from when charts were Superset slices embedded in dashboards). It should point to `/charts/${id}/edit`.

**Required edits:**
```tsx
// command-palette.tsx — additions
const typeIcons: Record<string, React.ElementType> = {
  dashboard: LayoutDashboard,
  chart: FileBarChart,
  dataset: Database,
  kpi: Gauge, // NEW — pick from lucide-react
}

const typeRoutes: Record<string, (id: string | number) => string> = {
  dashboard: (id) => `/dashboards/${id}`,
  chart: (id) => `/charts/${id}/edit`,    // FIX — was /dashboards/${id}
  dataset: (id) => `/datasets/${id}/edit`, // FIX — was /explorer
  kpi: (id) => `/kpis/${id}/edit`,        // NEW
}

const groupLabels: Record<string, string> = {
  dashboard: 'Dashboards',
  chart: 'Charts',
  dataset: 'Datasets',
  kpi: 'KPIs', // NEW
}
```

And the `SearchResult` type in `frontend/src/types/api.ts` needs the union widened:
```ts
// types/api.ts — current
export interface SearchResult {
  type: 'dashboard' | 'chart' | 'dataset'
  id: string | number
  name: string
}

// types/api.ts — Phase 9
export interface SearchResult {
  type: 'dashboard' | 'chart' | 'dataset' | 'kpi'
  id: string
  name: string
  description?: string
}
```

**Note on `id` type narrowing:** The current `SearchResult.id: string | number` is overly permissive — managed tables all use `string` UUIDs (verified across `recviz_dashboards`, `recviz_charts`, `recviz_kpis`). Narrow to `string`. The legacy Superset numeric IDs are gone after the rewrite.

### Anti-Patterns to Avoid

- **Don't write URL on every keystroke.** The filter store has separate `values` (uncommitted) and `applied` (committed via Apply button) state. URL sync should hang off `applied`, not `values` — otherwise the URL updates while the user is mid-typing in a multi-select, causing flicker and wasted history writes. Verified at `stores/filter-store.ts:49-54`.
- **Don't replace search params with a plain object.** `navigate({ search: { foo: 'bar' }, replace: true })` wipes `?theme=dark` and `?filter.lock=region`. Always use the function form: `navigate({ search: (prev) => ({ ...stripFilterParams(prev), ...serializeFilterParams(applied) }), replace: true })`.
- **Don't put the URL→store init in the same `useEffect` as the store→URL write.** The two effects WILL fire each other in a loop. Init runs on `[dashboardId]`; write runs on `[applied]`. Ref guard (`hasInitializedRef`) on the write effect to skip the first render after init.
- **Don't query 4 tables in parallel with the same async session.** SQLAlchemy `AsyncSession` is not concurrent-safe. Use sequential `await` calls (queries are fast enough) or open separate sessions per branch.
- **Don't drop the filter prefix when parsing.** `?filter.lock=region` and `?filter.region=APAC` are both `filter.*` keys but mean different things. The lock key check must happen BEFORE the prefix check, or `parseFilterParams` will treat `lock` as a filter named "lock".
- **Don't hardcode `/api/dashboards` paths in tests.** Use the API client; integration tests should hit the real router via `TestClient(app)` so the route order (`managed_*` registered before legacy) is exercised.
- **Don't use `framer-motion`.** This codebase imports from `motion/react`. CLAUDE.md is explicit.
- **Don't add `any` to `validateSearch`.** The codebase uses `(search: Record<string, unknown>) => search` which is the canonical permissive shape and passes strict TypeScript.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL search-state sync | Custom `window.history.pushState` wrapper or `useEffect` directly on `location.search` | TanStack Router `useSearch` + `useNavigate({ search, replace })` | Type-safe, integrates with route lifecycle, no race with router internal state |
| Search-param parsing | Custom `URLSearchParams` regex/split | The `validateSearch` function returning `Record<string, unknown>` + per-key parsing in `lib/dashboard-url-state.ts` | TanStack Router already runs `validateSearch` for you on every navigation |
| Toast notifications | Custom notification component | Sonner via `import { toast } from 'sonner'` | Already wired in `dashboard-renderer.tsx`, `grid-toolbar.tsx`. Single line: `toast.success('Link copied')` |
| Clipboard copy | `document.execCommand('copy')` polyfill | `await navigator.clipboard.writeText(url)` | Already used at `chart-export.ts:69`. Modern browsers only — corporate intranet environment guarantees Chromium. |
| Debouncing | Custom timer | `setTimeout` inside `useEffect` cleanup OR existing `useDebounce` hook from `command-palette.tsx:48-55` (could lift to `lib/use-debounce.ts`) | Either works; the inline setTimeout pattern is fine for a single use site |
| Backend search ranking | Full-text search engine, Elasticsearch index | Postgres `ILIKE '%q%'` + in-memory prefix-match sort | At <10K rows per table, ILIKE is sub-50ms. Elasticsearch is overkill and adds infra. |
| Search result grouping | Custom group/sort utility | Frontend `Object.groupBy` (or simple reduce — already done at `command-palette.tsx:145-153`) | Already done correctly |
| Cmd+K keyboard shortcut | New hook | Existing effect at `command-palette.tsx:79-88` | No changes needed |

**Key insight:** Phase 9 is a "rewire and lift" phase. Almost everything needed already exists in the codebase — the work is connecting existing pieces correctly, not building new ones. The two pieces of NEW code are: (1) `lib/dashboard-url-state.ts` (the lifted parser/serializer), and (2) the rewritten `backend/app/api/search.py`. Everything else is editing existing files.

## Common Pitfalls

### Pitfall 1: SQLAlchemy AsyncSession concurrent access
**What goes wrong:** `await asyncio.gather(fetch_dashboards(), fetch_charts(), ...)` raises `sqlalchemy.exc.IllegalStateChangeError: This session is provisioning a new connection; concurrent operations are not permitted`.
**Why it happens:** A single `AsyncSession` is bound to one connection. Parallel coroutines fight for the same connection.
**How to avoid:** Run queries sequentially in `search.py` (the queries are fast, total <50ms). If parallelism is later needed, use `async_sessionmaker` to create a fresh session per branch.
**Warning signs:** "concurrent operations are not permitted" in test logs.

### Pitfall 2: URL→store→URL infinite loop
**What goes wrong:** First effect reads URL and calls `initializeFilters`. Second effect watches `applied` and writes URL. The init triggers an `applied` change (because `initializeFilters` calls happen before the route mounts the renderer). The write effect fires and pushes the URL. The URL change triggers the init effect again.
**Why it happens:** Effects don't know which side initiated the change.
**How to avoid:** Use a `hasInitializedRef = useRef(false)` guard on the write effect. Skip the first run when `hasInitializedRef.current === false`, then set it true. Alternatively, key the init effect on `[dashboardId]` only (not `[search]`) so it only runs on mount/dashboard change. The existing `DashboardRenderer` already does exactly this for `initializeFilters` — see `dashboard-renderer.tsx:72-84` where `useEffect(..., [config.id])` is intentional.
**Warning signs:** Browser dev tools network/console flooding with navigation events. URL appears stuck.

### Pitfall 3: Hook divergence — one endpoint returning stale data
**What goes wrong:** Phase 8 builder writes via `POST /api/dashboards/managed`. View route reads via `GET /api/dashboards/{id}` (legacy). User saves a dashboard, navigates to view, sees... actually it works, because `ConfigStore.get_dashboard()` reads the same `recviz_dashboards` table. **But this is a coincidence.** If someone refactors `dashboards.py` to read from a different source (e.g., a cache, a different table), the view route silently breaks for new dashboards.
**Why it happens:** Two endpoints, two hooks, two code paths reading the same data — but only by accident of current implementation.
**How to avoid:** Phase 9 D-12 makes this an explicit decision: upgrade view + edit + embed routes to `useManagedDashboard`. Then the legacy `GET /api/dashboards/{id}` endpoint can be deprecated in a future phase without touching the view UI.
**Warning signs:** "Dashboard not found" on a freshly-saved dashboard. Verify by hitting both endpoints with curl: `curl localhost:8000/api/dashboards/{id}` vs `curl localhost:8000/api/dashboards/managed/{id}`.

### Pitfall 4: `?hide=toolbar` vs hiding the entire EmbedTopbar
**What goes wrong:** D-08 says `?hide=toolbar` is one of the supported tokens. But "toolbar" is ambiguous — is it the dashboard's `DashboardToolbar` (refresh button + auto-refresh control), or the `EmbedTopbar` (the slim title + Open in RecViz bar at the top of embed)?
**Why it happens:** Naming collision. "Topbar" and "toolbar" sound similar.
**How to avoid:** Resolve in planning. Recommended mapping:
  - `?hide=title` → hide the title text inside `EmbedTopbar` (a 1-line conditional)
  - `?hide=toolbar` → hide the `DashboardToolbar` component (refresh + auto-refresh) inside `DashboardRenderer`
  - `?hide=filter-bar` → hide `ConfigFilterBar` inside `DashboardRenderer`
  - The slim `EmbedTopbar` (host link + title strip) stays visible always per D-06 ("keep EmbedTopbar as-is"). If a future portal team needs full chromeless, that's a future enhancement.
**Warning signs:** Confusion in plan reviews. Force the planner to commit to specific selectors before writing tasks.

### Pitfall 5: Multi-select filter value with a comma in it
**What goes wrong:** If a filter value literally contains a comma (e.g., a region name like "Asia, Pacific"), it gets split incorrectly when parsing `?filter.region=APAC,Asia, Pacific,EMEA`.
**Why it happens:** The encoding format uses comma as the array delimiter without escaping.
**How to avoid:** Either (a) accept this limitation and document it (current embed route does NOT escape — verified at `routes/embed/dashboards/$dashboardId.tsx:28`), or (b) URL-encode commas inside values before joining. Recommended: (a) — document the limitation in the JSDoc of `serializeFilterParams`. RecViz filter values are dataset column distincts (region, product, status), which in practice never contain commas. If a real customer dataset has commas in distinct values, escape them in a future fix.
**Warning signs:** Shared link returns wrong data when a value has a comma. Edge case — unlikely in recon data.

### Pitfall 6: `validateSearch` strict typing breaks `Route.useSearch`
**What goes wrong:** A typed `validateSearch` like `(search): { theme?: 'dark' | 'light' } => ({ theme: search.theme })` strips out unknown keys (the `filter.*` ones), so `Route.useSearch()` doesn't see them.
**Why it happens:** TanStack Router validates and narrows search params strictly when you give it a typed shape.
**How to avoid:** Use the permissive form `(search: Record<string, unknown>) => search` — exactly what the embed route already does at line 13. This passes everything through and lets `lib/dashboard-url-state.ts` parse it.
**Warning signs:** `Route.useSearch()` returns an empty object even though the URL has params. Type-check the validateSearch return.

### Pitfall 7: Description field nullability across managed tables
**What goes wrong:** Backend search query orders by `name.ilike OR description.ilike` — but `RecvizChart.description` defaults to empty string `""` (not NULL), so `description.ilike('%foo%')` returns False for empty description. That's fine. BUT `RecvizDashboard.description` is `String(1024), default=""` and the legacy `dashboards.py` returns `description: str` (defaulting to empty). Some old rows might have `NULL` if migrated from a pre-Phase-1 source.
**Why it happens:** Schema evolution.
**How to avoid:** Use `or_(RecvizX.name.ilike(pattern), func.coalesce(RecvizX.description, '').ilike(pattern))` defensively. Verified columns are `default=""` in all four models, so the `coalesce` is belt-and-suspenders.
**Warning signs:** None expected; defensive measure.

### Pitfall 8: api-client snake→camel transform on managed dashboard config
**What goes wrong:** The `api-client.ts` runs `transformKeys` snake→camel on response bodies, with `DATA_KEYS = {'rows', 'columns', 'data', 'config'}` as the skip-set. This means everything inside `config` (the dashboard config blob) is preserved as-is. Good — that's why Phase 6 added `'config'` to the skip set.
**Why it could go wrong in Phase 9:** If the search rewrite returns `{ "type": "dashboard", "id": "...", "name": "...", "description": "..." }` and the frontend expects camelCase, the snake→camel transform handles the snake_case keys. Description has no underscores, so it survives. **No new DATA_KEYS additions needed for Phase 9.**
**Warning signs:** None.

## Code Examples

Verified patterns from official sources and existing codebase:

### Example 1: TanStack Router URL state read + write [VERIFIED: existing codebase pattern]
```tsx
// File: frontend/src/routes/embed/dashboards/$dashboardId.tsx (lines 11-45)
// Already in codebase — proves the read pattern works.
export const Route = createFileRoute('/embed/dashboards/$dashboardId')({
  component: EmbedDashboardPage,
  validateSearch: (search: Record<string, unknown>) => search,
})

function EmbedDashboardPage() {
  const { dashboardId } = Route.useParams()
  const search = Route.useSearch()
  // Parse filter params from search...
}
```

### Example 2: Filter store apply pattern [VERIFIED: existing codebase pattern]
```ts
// File: frontend/src/stores/filter-store.ts (lines 49-54)
// Apply commits values → applied snapshot. URL sync hangs off `applied`, not `values`.
applyFilters: () =>
  set((s) => ({
    applied: Object.fromEntries(
      Object.entries(s.values).filter(([, v]) => v != null),
    ),
  })),
```

### Example 3: Sonner toast usage [VERIFIED: existing codebase pattern]
```tsx
// File: frontend/src/components/dashboard/dashboard-renderer.tsx (line 55)
import { toast } from 'sonner'
toast.success('Dashboard refreshed')
// For Phase 9 share button:
toast.success('Link copied')
```

### Example 4: Clipboard write [VERIFIED: existing codebase pattern]
```ts
// File: frontend/src/lib/chart-export.ts (line 69)
await navigator.clipboard.writeText(tsv)
// For Phase 9 share button:
await navigator.clipboard.writeText(window.location.href)
```

### Example 5: Backend test pattern with mocked SQLAlchemy [VERIFIED: existing codebase pattern]
```python
# File: backend/tests/test_managed_charts.py (lines 13-40)
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient

def _make_chart_row(*, chart_id="chart-1", name="Test Chart", ...) -> MagicMock:
    row = MagicMock()
    row.id = chart_id
    row.name = name
    # ...
    return row

# Test pattern: mock the session.execute() return, hit the route via TestClient.
```

### Example 6: TanStack Router navigate with search function [CITED: leonardomontini.dev]
```ts
// Source: https://leonardomontini.dev/tanstack-router-query-params/
const navigate = useNavigate({ from: Route.fullPath })

const updateFilters = (name: keyof ItemFilters, value: unknown) => {
  navigate({ search: (prev) => ({ ...prev, [name]: value }) })
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useDashboardConfig` reading from `/api/dashboards/{id}` (legacy V1 path) | `useManagedDashboard` reading from `/api/dashboards/managed/{id}` (Phase 8 path) | Phase 8 (2026-04-06) | Both currently read same `recviz_dashboards` table; semantic upgrade, not data restoration |
| `search.py` querying Superset slices/datasets | `search.py` querying `recviz_*` managed tables | Phase 9 (in progress) | Eliminates stale Superset dependency for search; KPI search becomes possible |
| In-memory `views.py` saved-views store | (Deferred to next milestone) | — | Scaffold preserved, untouched |
| Filter parser inline in embed route | Lifted to `lib/dashboard-url-state.ts` shared util | Phase 9 (in progress) | View route can reuse for SHAR-02 |

**Deprecated/outdated:**
- `search.py` Superset calls (`superset.list_charts()`, `superset.list_datasets()`) — completely removed in Phase 9 rewrite.
- Hardcoded `chart: (id) => /dashboards/${id}` in `command-palette.tsx:64` — wrong route, fixed in Phase 9.
- `dataset: () => /explorer` in `command-palette.tsx:65` — should be `/datasets/${id}/edit` per D-17.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Both `/api/dashboards/{id}` and `/api/dashboards/managed/{id}` currently work for Phase 8-saved dashboards because `ConfigStore.get_dashboard()` reads the same `recviz_dashboards` table that `managed_dashboards.py` writes to | Pattern 4, Pitfall 3 | If the legacy endpoint actually queries a different source (e.g., a JSON file fallback) we missed in `config_store.py`, the view route is silently broken today and Phase 8 only worked because the user always navigated via the builder's post-save redirect |
| A2 | `recviz_charts.description`, `recviz_kpis.description`, `recviz_datasets.description` are non-NULL with default `""` per the SQLAlchemy models | Pitfall 7 | Defensive `coalesce` mitigates regardless |
| A3 | Description field exists on all four managed tables and is searchable | Pattern 3, Pitfall 7 | Verified by reading all 4 SQLAlchemy model files; HIGH confidence |
| A4 | TanStack Router v1.159.5 (codebase) supports `navigate({ search: fn, replace: true })` exactly the same as v1.168.10 (latest) | Pattern 1 | API has been stable for the entire v1 line; LOW risk |
| A5 | `navigator.clipboard.writeText` works in the corporate Chromium environment without permission prompts when triggered by user click | Don't Hand-Roll | LOW risk — already used elsewhere in codebase without issues |
| A6 | The `?hide=toolbar` token maps to hiding `DashboardToolbar` (refresh + auto-refresh), not `EmbedTopbar` | Pitfall 4 | Planner must confirm or override |
| A7 | Multi-select filter values do not contain literal commas in real recon data (region, product, status, currency) | Pitfall 5 | Edge case; deferred fix acceptable |
| A8 | Search results limited to top-10 per type group (configurable via `limit_per_type`) is sufficient — the palette UI doesn't need pagination | Pattern 3 | D-15 says "top 5? top 10?" is Claude's discretion. Top-10 default is conservative |
| A9 | The Phase 8 `08-10` STATE.md decision claiming "View page switched from useDashboardConfig to useManagedDashboard" was never actually implemented — the file on disk still imports `useDashboardConfig` | Summary, Hook Divergence | VERIFIED via direct file read of `routes/_app/dashboards/$dashboardId.tsx:7,16`. NOT an assumption — confirmed fact |

**A9 is confirmed fact, not assumption.** Listing here so the planner is aware.

## Open Questions

1. **Does the planner want a service layer for search?**
   - What we know: CLAUDE.md says service-layer pattern is required. Phases 5-8 (`managed_charts.py`, `managed_kpis.py`, `managed_datasets.py`, `managed_dashboards.py`) all violate this and put SQLAlchemy directly in route handlers. Search rewrite has two valid options.
   - What's unclear: Whether Phase 9 should follow the broken precedent or correct it.
   - Recommendation: Follow the precedent (raw SQLAlchemy in `search.py`) for consistency. Flag the broader service-layer cleanup as a tech-debt item for a future phase. Don't slow Phase 9 down to fix Phases 5-8.

2. **Should the Share button live in `DashboardToolbar` or as a sibling next to it?**
   - What we know: `DashboardToolbar` currently has Refresh + AutoRefreshControl. Adding a third button is fine. The view route renders `DashboardToolbar` inside `DashboardRenderer`.
   - What's unclear: Whether the share button is a property of the renderer (works in embed mode too?) or only the view route. D-04 says "view-mode toolbar."
   - Recommendation: Render the Share button at the route level (in `routes/_app/dashboards/$dashboardId.tsx`), NOT inside `DashboardRenderer`. Reasons: (a) embed mode doesn't need it (you don't share an iframe URL), (b) keeps the renderer agnostic of routing, (c) the route knows the current URL.

3. **Should `parseHideTokens` accept `kpi-bar`, `cross-filter-bar` tokens for future use?**
   - What we know: D-08 lists `filter-bar`, `title`, `toolbar` as initial tokens.
   - What's unclear: Whether to define an exhaustive enum or accept any string.
   - Recommendation: Accept any string (Set<string>), parse loosely. Each rendering branch checks `hide.has('its-token')`. Adding a new token in the future is one if-branch. Don't over-engineer.

4. **What does the Edit button on the view route do once the hook is upgraded?**
   - What we know: The view route currently has an Edit button (lines 49-61 of `routes/_app/dashboards/$dashboardId.tsx`) that navigates to the edit route. The edit route ALSO uses `useDashboardConfig` (verified) — needs the same upgrade.
   - What's unclear: Whether the Phase 9 hook upgrade for the view route includes the edit route as a sibling task or a separate plan.
   - Recommendation: Bundle both routes' hook upgrades into the same task. They're 2-line edits each and share the same risk profile.

5. **Are there any in-flight Phase 8 dashboards in the test database that would expose schema_version=0 migration paths?**
   - What we know: `migrate_config()` runs in `ConfigStore.get_dashboard()` but `CURRENT_SCHEMA_VERSION=1` and no migrations are registered (`_migrations` dict is empty).
   - What's unclear: Whether the managed endpoint (which does NOT call `migrate_config`) could return stale-schema rows.
   - Recommendation: NOT a Phase 9 concern. Both endpoints currently treat schema_version as a no-op. If Phase 10+ adds a v2 schema, the managed endpoint would need to call the migrator. Document for future-Phase-X.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Frontend dev/build/test | ✓ (assumed — Phase 8 verified) | matches package.json engines | — |
| pnpm | Frontend package manager | ✓ (assumed — Phase 8 verified) | — | — |
| Python 3.12+ | Backend | ✓ (assumed — Phase 8 verified) | — | — |
| PostgreSQL 16 (Docker) | `recviz_*` managed tables | ✓ (assumed — Phase 1+ verified) | 16 | — |
| Redis 7 (Docker) | TanStack Query cache (indirect via Superset cache) | ✓ (assumed — Phase 1+ verified) | 7 | — |
| Apache Superset | Currently called by `search.py` (will be REMOVED) | ✓ (assumed) | 6.0.0 pinned | Phase 9 ELIMINATES the dependency from search.py — search no longer needs Superset |
| Playwright (Chromium) | E2E test for share-link copy + palette navigation | ✓ [VERIFIED: package.json has @playwright/test 1.59.1, frontend/playwright.config.ts present, frontend/e2e/*.spec.ts present] | 1.59.1 | — |
| `navigator.clipboard` API | Share button "Copy link" | ✓ (modern Chromium, corporate intranet) | — | If unavailable: fallback to selecting text in a hidden input + `document.execCommand('copy')`. Not needed in practice. |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

**Net effect of Phase 9 on environment:** Phase 9 *reduces* the runtime dependency surface — `search.py` no longer needs Superset. No new dependencies added.

## Validation Architecture

**Note:** `workflow.nyquist_validation: true` in `.planning/config.json`. This section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Frontend unit tests | vitest 4.1.2 [VERIFIED: package.json + vitest.config.ts] |
| Frontend E2E tests | @playwright/test 1.59.1 [VERIFIED: package.json + playwright.config.ts] |
| Backend tests | pytest (via FastAPI TestClient pattern, see `backend/tests/test_managed_charts.py`) |
| Frontend test config | `frontend/vitest.config.ts` (env: node, alias: `@` → `./src`, exclude `e2e/**`) |
| Frontend E2E config | `frontend/playwright.config.ts` (chromium, baseURL `http://localhost:5173`, webServer `pnpm dev`) |
| Backend test config | No `pytest.ini` or `conftest.py` found at the repo root — tests live in `backend/tests/test_*.py` and run via `pytest backend/tests/` |
| Frontend quick run | `pnpm vitest run <path>` |
| Frontend full suite | `pnpm vitest run` |
| Backend quick run | `pytest backend/tests/test_search.py -x` (after Wave 0 creates this file) |
| Backend full suite | `pytest backend/tests/` |
| Playwright run | `cd frontend && npx playwright test --reporter=list` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHAR-02 | Filter parser lifted from embed route correctly parses `?filter.region=APAC&filter.product=A,B,C` | unit | `pnpm vitest run src/lib/dashboard-url-state.test.ts` | ❌ Wave 0 |
| SHAR-02 | Filter serializer round-trips `Record<string, FilterValue>` → URL string → parser | unit | `pnpm vitest run src/lib/dashboard-url-state.test.ts` | ❌ Wave 0 |
| SHAR-02 | View route hydrates filter store from URL on mount | integration (component) | `pnpm vitest run src/routes/_app/dashboards/$dashboardId.test.tsx` | ❌ Wave 0 |
| SHAR-02 | View route writes URL on `applied` filter change with `replace: true` (no history pollution) | E2E | `cd frontend && npx playwright test e2e/share-link.spec.ts` | ❌ Wave 0 |
| SHAR-02 | "Copy link" button copies current URL to clipboard and shows toast | E2E | `cd frontend && npx playwright test e2e/share-link.spec.ts` (uses Playwright `context.grantPermissions(['clipboard-read', 'clipboard-write'])`) | ❌ Wave 0 |
| SHAR-02 | Stale filter ID in shared URL is silently ignored, known filters apply | unit | `pnpm vitest run src/lib/dashboard-url-state.test.ts` | ❌ Wave 0 |
| SHAR-03 | Embed route loads dashboard from managed endpoint (not legacy) | integration (mocked fetch) | `pnpm vitest run src/routes/embed/dashboards/$dashboardId.test.tsx` | ❌ Wave 0 |
| SHAR-03 | `?theme=dark` applies dark theme on embed | E2E | `cd frontend && npx playwright test e2e/embed.spec.ts` | ❌ Wave 0 |
| SHAR-03 | `?filter.region=APAC` pre-applies region filter on embed | E2E | `cd frontend && npx playwright test e2e/embed.spec.ts` | ❌ Wave 0 |
| SHAR-03 | `?filter.lock=region` disables the region filter UI on embed | E2E | `cd frontend && npx playwright test e2e/embed.spec.ts` | ❌ Wave 0 |
| SHAR-03 | `?hide=filter-bar` hides filter bar on embed | E2E | `cd frontend && npx playwright test e2e/embed.spec.ts` | ❌ Wave 0 |
| SHAR-03 | `?hide=title` hides title in EmbedTopbar on embed | E2E | `cd frontend && npx playwright test e2e/embed.spec.ts` | ❌ Wave 0 |
| SHAR-03 | `?hide=toolbar` hides DashboardToolbar (refresh+auto-refresh) on embed | E2E | `cd frontend && npx playwright test e2e/embed.spec.ts` | ❌ Wave 0 |
| SHAR-03 | Cross-filter and drill-down still work on embed (D-10 full interactivity) | E2E | `cd frontend && npx playwright test e2e/embed.spec.ts` | ❌ Wave 0 |
| SHAR-04 | `POST /api/search` returns dashboards from managed table by name match | unit | `pytest backend/tests/test_search.py::test_search_dashboards_by_name -x` | ❌ Wave 0 |
| SHAR-04 | `POST /api/search` returns charts from managed_charts table | unit | `pytest backend/tests/test_search.py::test_search_charts_by_name -x` | ❌ Wave 0 |
| SHAR-04 | `POST /api/search` returns datasets from managed_datasets table | unit | `pytest backend/tests/test_search.py::test_search_datasets_by_name -x` | ❌ Wave 0 |
| SHAR-04 | `POST /api/search` returns KPIs from managed_kpis table (NEW source) | unit | `pytest backend/tests/test_search.py::test_search_kpis_by_name -x` | ❌ Wave 0 |
| SHAR-04 | `POST /api/search` does NOT call Superset (no httpx requests) | unit (assert no Superset client invoked) | `pytest backend/tests/test_search.py::test_search_no_superset_calls -x` | ❌ Wave 0 |
| SHAR-04 | `POST /api/search` returns results ordered: prefix-match → substring → alphabetical, grouped by type | unit | `pytest backend/tests/test_search.py::test_search_ranking -x` | ❌ Wave 0 |
| SHAR-04 | `POST /api/search` filters by `types: ['dashboard']` | unit | `pytest backend/tests/test_search.py::test_search_type_filter -x` | ❌ Wave 0 |
| SHAR-04 | Cmd+K palette renders KPI results with `Gauge` icon and routes to `/kpis/:id/edit` | E2E | `cd frontend && npx playwright test e2e/command-palette.spec.ts` | ❌ Wave 0 |
| SHAR-04 | Selecting a chart result navigates to `/charts/:id/edit` (NOT `/dashboards/:id`) | E2E | `cd frontend && npx playwright test e2e/command-palette.spec.ts` | ❌ Wave 0 |
| SHAR-04 | Selecting a dataset result navigates to `/datasets/:id/edit` (NOT `/explorer`) | E2E | `cd frontend && npx playwright test e2e/command-palette.spec.ts` | ❌ Wave 0 |
| Cross-cutting | Existing dashboards saved by Phase 8 builder still load in view route after hook upgrade | E2E (regression) | `cd frontend && npx playwright test e2e/dashboard-view-regression.spec.ts` | ❌ Wave 0 |
| Cross-cutting | Existing dashboards saved by Phase 8 builder still load in edit route after hook upgrade | E2E (regression) | `cd frontend && npx playwright test e2e/dashboard-edit-regression.spec.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm vitest run src/lib/dashboard-url-state.test.ts && pytest backend/tests/test_search.py -x`
- **Per wave merge:** `pnpm vitest run && pytest backend/tests/`
- **Phase gate:** Full vitest suite + full pytest suite + Playwright E2E suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `frontend/src/lib/dashboard-url-state.test.ts` — covers SHAR-02 parser/serializer/round-trip
- [ ] `frontend/src/routes/_app/dashboards/$dashboardId.test.tsx` — integration test for view route URL→store hydration
- [ ] `frontend/src/routes/embed/dashboards/$dashboardId.test.tsx` — integration test for embed route hook upgrade
- [ ] `frontend/e2e/share-link.spec.ts` — Playwright E2E for SHAR-02 (URL sync + Copy link button)
- [ ] `frontend/e2e/embed.spec.ts` — Playwright E2E for SHAR-03 (theme, filter, lock, hide tokens, interactivity)
- [ ] `frontend/e2e/command-palette.spec.ts` — Playwright E2E for SHAR-04 (KPI, route corrections)
- [ ] `frontend/e2e/dashboard-view-regression.spec.ts` — regression: Phase 8 dashboards still load in view mode
- [ ] `frontend/e2e/dashboard-edit-regression.spec.ts` — regression: Phase 8 dashboards still load in edit mode
- [ ] `backend/tests/test_search.py` — covers SHAR-04 (all 4 managed table queries, ranking, type filter, no-Superset assertion)
- [ ] Playwright clipboard-permission setup for share-link test (use `context.grantPermissions(['clipboard-read', 'clipboard-write'])` per browser context — see Playwright docs)

**Regression class to watch:** Hook upgrade is the highest-risk change. The two regression tests above (view + edit) are mandatory — they exercise the path "save dashboard via builder → reload page → navigate to view → confirm renders." If either fails, the upgrade has gone wrong and Phase 9 must not merge.

## Security Domain

`workflow.security_enforcement` is not explicitly set in `.planning/config.json` → treat as enabled. Phase 9 is light-touch but still needs threat-modeling because it adds new attack surface (URL params, embed iframe, search input).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | NO | D-11 explicitly defers auth to v2 — corporate intranet trust assumption documented |
| V3 Session Management | NO | No session changes in Phase 9 |
| V4 Access Control | NO | No access control changes; embed has no auth per D-11 |
| V5 Input Validation | YES | URL params (filter values, hide tokens, theme), search query string. Use TanStack Router `validateSearch` permissive shape + per-key parser in `lib/dashboard-url-state.ts`. Backend search uses Pydantic 2 `SearchRequest` with field constraints. |
| V6 Cryptography | NO | No crypto in Phase 9 |
| V7 Error Handling | YES | Backend search.py errors must not leak SQL or stack traces — use existing `sanitize_detail` pattern from `core/errors.py` (already imported in current `search.py:7`). |
| V8 Data Protection | NO | No new data persistence |
| V12 Files and Resources | NO | No file uploads |
| V13 API and Web Services | YES | New `?hide=` param adds API surface; rewritten `/api/search` is a behavioral change. Both must be Pydantic-validated. |
| V14 Configuration | NO | No config changes |

### Known Threat Patterns for {React 19 + FastAPI + Postgres + iframe embed}

| Pattern | STRIDE | Standard Mitigation | Phase 9 Status |
|---------|--------|---------------------|----------------|
| XSS via URL filter param injection | Tampering / Information Disclosure | React 19 auto-escapes JSX text; values pass through `filter-store` as data, never as HTML. Verify nothing in `DashboardRenderer`/`ConfigFilterBar` renders filter values via `dangerouslySetInnerHTML`. | ✓ Verified by reading `config-filter-bar.tsx` — all filter values render as `<span>{value}</span>` or pass to `<SelectItem>`. SAFE. |
| SQL injection via filter values reaching the dataset query | Tampering | Filter values are passed to `query_engine.execute(ds_config, filters)` as a `dict[str, ...]`. SQLAlchemy parameterized queries upstream. The `query_engine` is unchanged in Phase 9. | ✓ Pre-existing mitigation. NO Phase 9 code adds raw SQL interpolation. |
| SQL injection via search query | Tampering | Postgres `ILIKE :pattern` with parameter binding. Never f-string the query into the SQL. | ✓ Phase 9 search.py uses `RecvizX.name.ilike(pattern)` — SQLAlchemy parameterizes. SAFE. |
| Open-redirect via Share button | Tampering | The Share button copies `window.location.href` (or a constructed path with current dashboard ID + filter params). Never redirects elsewhere. | ✓ Read-only operation. SAFE. |
| Iframe clickjacking on embed route | Tampering | D-11 says no auth in v1 — accept the trust assumption. Future SSO phase should add `Content-Security-Policy: frame-ancestors` headers. | ⚠ Documented assumption per D-11 |
| `?hide=` token injection (e.g., `?hide=<script>`) | Tampering | `parseHideTokens` returns `Set<string>`. Each rendering branch checks `hide.has('filter-bar')` etc. — string equality, no execution. | ✓ Verified pattern is safe |
| Filter ID enumeration leak | Information Disclosure | Stale filter IDs in URL are silently ignored per D-05. The presence/absence of a filter ID does not leak schema information beyond what the dashboard config already exposes. | ✓ Acceptable for v1 |
| Search results expose unauthorized entities | Information Disclosure | D-11: no auth in v1. Search returns all dashboards/charts/datasets/KPIs. Future SSO phase will need row-filtered queries. | ⚠ Pre-existing scope; not new in Phase 9 |
| Clipboard hijacking | Tampering | `navigator.clipboard.writeText` requires user gesture (button click). React event handler satisfies this. | ✓ SAFE |
| Description field XSS in palette result rendering | XSS | Palette renders `<span>{item.name}</span>` — auto-escaped by React. NEW: if Phase 9 adds `description` to the rendered output, must also be `<span>` not `dangerouslySetInnerHTML`. | ✓ Plan must enforce |

### Output Encoding

- All filter values, search results, and dashboard names render via React JSX text — auto-escaped.
- "Copy link" button writes a URL string built from `URLSearchParams`, which is `encodeURIComponent`-encoded. SAFE.
- Backend `SearchResult` JSON is serialized by Pydantic — no manual encoding needed.

### Phase 9 Threat Model Summary

Phase 9 adds NO new authentication, NO new authorization, NO new persistence, NO new file handling, NO new crypto. The only new attack surface is:
1. URL filter params (already mitigated by React auto-escape + SQLAlchemy parameterization)
2. `?hide=` tokens (Set membership check, no eval)
3. Search input (Postgres ILIKE with parameter binding)

**Net security impact:** Neutral to slightly positive. Phase 9 *removes* the Superset HTTP dependency from search.py, eliminating a class of "Superset error message leaks via search response" risks.

**Action items for the planner:** Add an explicit "no `dangerouslySetInnerHTML` anywhere new" check to the verification step. Add the regression check that `search.py` makes zero outbound HTTP calls (test by mocking httpx and asserting no calls).

## Sources

### Primary (HIGH confidence)
- `frontend/src/routes/embed/dashboards/$dashboardId.tsx` (lines 11-83) — existing canonical filter parser pattern
- `frontend/src/routes/_app/dashboards/$dashboardId.tsx` (lines 1-66) — current view route, confirms legacy hook still in use
- `frontend/src/routes/_app/dashboards/$dashboardId.edit.tsx` (lines 1-52) — current edit route, confirms legacy hook still in use
- `frontend/src/hooks/use-dashboard-config.ts` (lines 1-13) — legacy hook implementation
- `frontend/src/hooks/use-managed-dashboards.ts` (lines 16-22) — Phase 8 managed hook implementation
- `frontend/src/components/dashboard/dashboard-renderer.tsx` (lines 1-162) — confirms `initialFilters`/`lockedFilters` props already exist
- `frontend/src/components/dashboard/config-filter-bar.tsx` (lines 1-328) — confirms filter store integration and rendering
- `frontend/src/stores/filter-store.ts` (lines 1-99) — confirms `applied` snapshot is the URL sync source
- `frontend/src/components/embed/embed-topbar.tsx` (lines 1-27) — embed topbar implementation
- `frontend/src/components/layout/command-palette.tsx` (lines 1-272) — command palette implementation
- `frontend/src/types/api.ts` (lines 49-60) — current SearchResult type
- `frontend/src/types/managed-dashboard.ts` (lines 1-23) — ManagedDashboard wrapper type
- `frontend/src/types/dashboard-config.ts` (lines 1-148) — DashboardConfig shape
- `frontend/src/lib/api-client.ts` (lines 36-75) — DATA_KEYS skip set
- `backend/app/api/search.py` (lines 1-74) — current Superset-based search
- `backend/app/api/managed_dashboards.py` (lines 1-126) — managed CRUD pattern
- `backend/app/api/managed_charts.py` (lines 1-148) — managed CRUD pattern
- `backend/app/api/managed_kpis.py` (lines 1-152) — managed CRUD pattern
- `backend/app/api/managed_datasets.py` (lines 1-50+) — managed CRUD pattern
- `backend/app/api/dashboards.py` (lines 1-84) — legacy dashboards endpoint
- `backend/app/api/router.py` (lines 1-36) — confirms managed routers registered before legacy
- `backend/app/services/config_store.py` (lines 1-50) — proves both endpoints read `recviz_dashboards`
- `backend/app/services/config_migrator.py` (lines 1-32) — current schema_version=1 no-op
- `backend/app/db/models/dashboard.py`, `chart.py`, `kpi.py`, `dataset.py` — schema confirmation
- `backend/app/models/managed_dashboard.py` — Pydantic response shape
- `backend/tests/test_managed_charts.py` (lines 1-40) — backend test pattern reference
- `frontend/playwright.config.ts` — E2E setup
- `frontend/vitest.config.ts` — unit test setup
- `frontend/package.json` — version verification
- `backend/requirements.txt` — version verification
- `.planning/phases/09-sharing-and-views/09-CONTEXT.md` — locked decisions
- `.planning/STATE.md` — Phase 8 history
- `CLAUDE.md` — project conventions

### Secondary (MEDIUM confidence)
- [TanStack Router v1 docs (search params)](https://tanstack.com/router/v1/docs/framework/react/guide/search-params) — official documentation referenced for `validateSearch`/`useSearch`/`navigate` patterns
- [TanStack Router useSearch hook reference](https://tanstack.com/router/v1/docs/framework/react/api/router/useSearchHook) — official API reference
- [Leonardo Montini — TanStack Router Query Params guide](https://leonardomontini.dev/tanstack-router-query-params/) — practical patterns including `navigate({ search: prev => ... })`
- [npm view @tanstack/react-router] — version 1.168.10 latest, codebase has 1.159.5 (acceptable)
- [npm view sonner] — version 2.0.7 (matches codebase)

### Tertiary (LOW confidence)
- None — all critical claims verified against codebase or official sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed via package.json + npm view; patterns confirmed in existing code
- Architecture: HIGH — TanStack Router pattern confirmed via official docs + existing embed route; backend pattern confirmed via 4 sibling managed_*.py files
- Pitfalls: HIGH — SQLAlchemy async session concurrency is well-documented; URL loop is a real React pitfall; hook divergence is verified via direct file read
- Security: MEDIUM-HIGH — pattern is well-understood; D-11 deferral of auth is a known accepted risk
- Validation: HIGH — vitest + pytest + Playwright all installed and patterns exist in codebase

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (30 days for stable codebase + stable upstream libs)

---

*Phase: 09-sharing-and-views*
*Research completed: 2026-04-08*
