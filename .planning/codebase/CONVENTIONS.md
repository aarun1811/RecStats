# Coding Conventions

**Analysis Date:** 2026-04-11

## Naming Patterns

**Files:**
- TypeScript/TSX: `kebab-case.(ts|tsx)` — e.g. `frontend/src/components/dashboard/dashboard-list-card.tsx`, `frontend/src/lib/cross-filter.ts`, `frontend/src/hooks/use-managed-dashboards.ts`
- React hooks: `use-{name}.ts` prefix is mandatory — e.g. `frontend/src/hooks/use-auto-refresh.ts`, `frontend/src/hooks/use-data-source-query.ts`
- Zustand stores: `{name}-store.ts` — e.g. `frontend/src/stores/filter-store.ts`, `frontend/src/stores/drill-store.ts`, `frontend/src/stores/builder-store.ts`
- Python: `snake_case.py` — e.g. `backend/app/services/query_engine.py`, `backend/app/api/managed_dashboards.py`
- TanStack Router pages: `index.tsx` for list pages, `$paramName.tsx` for detail — e.g. `frontend/src/routes/_app/dashboards/index.tsx`
- Tests: co-located `{name}.test.(ts|tsx)` — e.g. `frontend/src/lib/cross-filter.test.ts` next to `cross-filter.ts`
- Python tests: `test_{name}.py` under `backend/tests/`

**Functions:**
- TypeScript functions, variables, props: `camelCase` — e.g. `applyCrossFilters`, `useManagedDashboards`, `countPanels`
- React component functions: `PascalCase`, named function declarations (not arrow functions) — e.g. `function DashboardListCard(...)`, `function ChartFactory(...)`
- Python functions: `snake_case` — e.g. `list_managed_dashboards`, `_to_response`, `_resolve_database`
- Private Python helpers: prefix with underscore — e.g. `_build_sql`, `_handle_connection_error`
- Constants (both languages): `UPPER_SNAKE_CASE` — e.g. `DATA_KEYS` in `frontend/src/lib/api-client.ts`, `DEFAULT_MAX_ROWS` in `backend/app/services/query_engine.py`, `EXPORT_PIXEL_RATIO` in `frontend/src/lib/chart-export.ts`

**Variables:**
- TypeScript: `camelCase`
- Python: `snake_case`
- Booleans prefix with `is`/`has`: `isActive`, `isEChart`, `hasError`

**Types:**
- TypeScript interfaces/types: `PascalCase` — e.g. `FilterStore`, `ChartWrapperProps`, `ManagedDashboard`
- React component props: named `{ComponentName}Props` and declared directly above the component:
  ```tsx
  interface DashboardListCardProps {
    dashboard: ManagedDashboard
    onClick: () => void
    onDelete?: () => void
  }

  export function DashboardListCard({ dashboard, onClick, onDelete }: DashboardListCardProps) { ... }
  ```
- Pydantic models: `PascalCase` — e.g. `DashboardCreate`, `DashboardResponse`, `DashboardUpdate` in `backend/app/models/managed_dashboard.py`
- All Pydantic request/response models inherit from `CamelModel` in `backend/app/models/base.py` for automatic camelCase alias generation

## Code Style

**Formatting:**
- **No Prettier config** — formatting enforced by ESLint + editor conventions
- No Python formatter config (no ruff/black config files)
- TypeScript: 2-space indent, no semicolons, single quotes, trailing commas in multi-line
- Python: 4-space indent, double quotes (follows FastAPI/Pydantic convention)

**Linting:**
- ESLint flat config at `frontend/eslint.config.js`
- Plugins: `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- Extends: `js.configs.recommended`, `tseslint.configs.recommended`, `reactHooks.configs.flat.recommended`, `reactRefresh.configs.vite`
- Run command: `pnpm lint` (frontend only)
- No Python linter configured (no ruff/flake8/mypy config)

**TypeScript strict flags (from `frontend/tsconfig.app.json`):**
- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`
- `noUncheckedSideEffectImports: true`
- `verbatimModuleSyntax: true` — type-only imports must use `import type`
- `erasableSyntaxOnly: true`
- Target: ES2022, Module: ESNext, JSX: react-jsx
- Path alias: `@/*` maps to `frontend/src/*`
- Never use `any`. Never use `@ts-ignore`. Use `unknown` + type narrowing instead

## Import Organization

**Order (TypeScript):**
1. React / third-party libs (`react`, `@tanstack/*`, `motion`, `lucide-react`, `sonner`, etc.)
2. Internal absolute imports via `@/*` alias
3. Relative imports (`./`, `../`)
4. Type imports (usually inlined with `import type`)

Blank line between groups. Type-only imports use `import type { ... }` syntax (required by `verbatimModuleSyntax`).

**Example from `frontend/src/components/dashboard/dashboard-list-card.tsx`:**
```tsx
import { useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { BarChart3, Gauge, LayoutDashboard, Table2, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { DashboardMiniMap } from './dashboard-mini-map'
import type { ManagedDashboard } from '@/types/managed-dashboard'
```

**Order (Python):**
1. `from __future__ import annotations` (required at top of every file)
2. Standard library
3. Third-party (`fastapi`, `sqlalchemy`, `pydantic`, `httpx`)
4. Internal `app.*` modules

**Path Aliases:**
- Frontend: `@/*` → `frontend/src/*` (configured in `frontend/tsconfig.json`, `frontend/vite.config.ts`, `frontend/vitest.config.ts`)

**No barrel exports.** No `index.ts` re-exporting from a folder. Import directly from the source file.

## Component Patterns

**All React components are functional.** The single exception is `frontend/src/components/shared/error-boundary.tsx` which must be a class component because React requires class components for error boundaries (`getDerivedStateFromError` lifecycle).

**Named function declarations, not arrow functions:**
```tsx
export function ChartFactory(props: ChartWrapperProps) { ... }
```

**Props interface** defined directly above the component, named `{ComponentName}Props`. Destructure props in the function signature.

**One primary component per file.** Small private helpers used only by the primary component live in the same file, separated by a comment divider, and are NOT exported:
```tsx
interface PanelCounts { kpis: number; charts: number; grids: number }

function countPanels(config: unknown): PanelCounts { ... }

export function DashboardListCard(...) { ... }
```

**Named exports only.** Exception: page-level route components use the `function ComponentName()` pattern with `export const Route = createFileRoute(...)` (TanStack Router file-based routing requirement):
```tsx
// frontend/src/routes/_app/dashboards/index.tsx
export const Route = createFileRoute('/_app/dashboards/')({
  component: DashboardListPage,
})

function DashboardListPage() { ... }
```

## State Management (Zustand)

**One store per concern:**
- `frontend/src/stores/filter-store.ts` — global filter values, applied snapshot, locked set, cross-filters
- `frontend/src/stores/drill-store.ts` — per-chart drill level stacks
- `frontend/src/stores/builder-store.ts` — dashboard builder state with dirty tracking
- `frontend/src/stores/layout-history-store.ts` — undo/redo for builder canvas layouts

**Store pattern:** Interface declared above `create<T>()`, named `{Name}Store`. Actions use `set((s) => ({ ... }))` with spread-based immutable updates:
```ts
interface FilterStore {
  values: Record<string, FilterValue>
  locked: Set<string>
  applied: Record<string, FilterValue>
  setFilterValue: (filterId: string, value: FilterValue) => void
  // ...
}

export const useFilterStore = create<FilterStore>((set) => ({
  values: {},
  locked: new Set<string>(),
  applied: {},
  setFilterValue: (filterId, value) =>
    set((s) => ({ values: { ...s.values, [filterId]: value } })),
  // ...
}))
```

**Selectors** are used in components to avoid unnecessary re-renders:
```tsx
const dateRange = useFilterStore((s) => s.globalFilters.dateRange)
```

**Strict separation of server vs client state:**
- Zustand holds UI state only (filters, drills, builder state, layout)
- TanStack Query holds all server data — never store fetched data in Zustand

## Data Fetching (TanStack Query)

**Every data-fetching operation is wrapped in a custom hook** under `frontend/src/hooks/`. Hooks return the `useQuery`/`useMutation` result directly (unwrapped):
```ts
// frontend/src/hooks/use-managed-dashboards.ts
export function useManagedDashboards() {
  return useQuery({
    queryKey: ['managed-dashboards'],
    queryFn: () => api.get<ManagedDashboard[]>('/api/dashboards/managed'),
  })
}
```

**Query key convention:** `['entity', identifier?, ...filters?]`
- `['managed-dashboards']`
- `['managed-dashboard', id]`
- `['data-source', dataSourceId, filters]`
- `['chart-data', chartId, globalFilters]`

**Defaults set in `frontend/src/lib/query-client.ts`:**
- `staleTime`: `5 * 60 * 1000` (5 min)
- `gcTime`: `30 * 60 * 1000` (30 min)
- `retry`: 1
- `refetchOnWindowFocus`: false
- Global `QueryCache.onError` handler: toasts `ApiError.userMessage` via Sonner

**Mutations invalidate related query keys in `onSuccess`:**
```ts
return useMutation({
  mutationFn: (data: DashboardCreate) => api.post<ManagedDashboard>('/api/dashboards/managed', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['managed-dashboards'] })
  },
})
```

## API Client

- Single `frontend/src/lib/api-client.ts` using native `fetch` (no axios — keep it lightweight)
- Base URL from `import.meta.env.VITE_API_BASE_URL`, defaults to `http://localhost:8000`
- Typed requests via generics: `api.get<T>(path)`, `api.post<T>(path, body)`, `api.put<T>`, `api.delete`
- Automatic `snake_case` to `camelCase` key transformation on responses via `transformKeys()`
- **`DATA_KEYS` skip set** (`rows`, `columns`, `data`, `config`) — values inside these keys are NOT transformed so DB column names and opaque JSONB configs are preserved. This is a gotcha to know when adding new API endpoints
- 204 responses return `undefined` (not JSON-parsed)
- Non-2xx responses throw `ApiError` with structured fields: `status`, `code`, `userMessage`, `detail`, `retryAfter`

## Error Handling

**Frontend:**
- `ApiError` class in `frontend/src/lib/api-client.ts` — structured error with `status`, `code`, `userMessage`, `detail`, `retryAfter`
- Global TanStack Query `queryCache.onError` handler toasts `ApiError.userMessage` via Sonner (`frontend/src/lib/query-client.ts`)
- Component-level: check `isError` from useQuery, render `<ErrorPanel>` with retry callback
- `frontend/src/components/shared/error-boundary.tsx` wraps the root outlet to catch React rendering errors; logs to console, renders retry panel
- Pattern: `const apiError = error instanceof ApiError ? error : null`

**Backend:**
- FastAPI `HTTPException(status_code=..., detail=...)` for client errors (404, 409, 422)
- `sanitize_detail()` in `backend/app/core/errors.py` truncates messages to 500 chars and regex-redacts SQLAlchemy connection URIs before returning to client
- Route handlers log full exceptions server-side via `logger.exception(...)` before calling `sanitize_detail()` on the client response
- Connection-level failures caught via `httpx.ConnectError`, `httpx.HTTPStatusError`, `httpx.TimeoutException`, `sqlalchemy.exc.OperationalError`, `sqlalchemy.exc.DBAPIError` — mapped to 503 with `retry_after` hint
- `ConnectionStatusTracker` updates per-database connectivity state so subsequent requests can fail fast
- `DbSessionDep` auto-commits on handler success, auto-rollbacks on exception (via `get_db_session` generator in `backend/app/core/dependencies.py`)

## Logging

**Frontend:**
- No dedicated logger — errors surface via TanStack Query's global `onError` + Sonner toasts
- `console.error` in `ErrorBoundary.componentDidCatch` only
- Avoid adding `console.log` to production code

**Backend:**
- Python `logging` module, configured via `logging.basicConfig(level=logging.INFO)` at the top of `backend/app/main.py` (before any `app.*` import)
- Per-module logger: `logger = logging.getLogger(__name__)` at the top of every module
- Used for: startup/lifespan events, connection sweeps, sync status, error context before sanitization
- Example: `logger.info("Pre-warmed engine for connection: %s", conn.name)`, `logger.warning("oracledb thick mode init failed (%s) -- falling back to thin mode", e)`

## Comments

**JSDoc/docstrings:**
- TypeScript: JSDoc-style `/** */` on exported functions with non-obvious behavior — see `frontend/src/lib/formatters.ts` `formatValue()`
- Python: triple-quoted docstrings on every exported function/class. Route handlers have a short one-line description. Services have multi-line docstrings describing architecture decisions (e.g. `QueryExecutor` in `backend/app/services/query_engine.py`)

**Comment dividers** between logical sections within a file (both languages):
```python
# ── Helpers ─────────────────────────────────────────────────────

# ── Endpoints ───────────────────────────────────────────────────
```
```tsx
// --------------------------------------------------------------------------- #
// ResolvedDataSourceDep -- eliminates lookup + 404 duplication across endpoints
// --------------------------------------------------------------------------- #
```

**Inline comments** for business logic, Oracle/driver quirks, and non-obvious decisions. Example in `backend/app/api/managed_dashboards.py`:
```python
# Note on description: Oracle treats empty strings as NULL at the
# DB level (a well-known Oracle quirk). A row saved with
# description="" comes back as None on Oracle...
```

Test file headers use `/** */` blocks to explain scope, context, and preconditions (e.g. `frontend/e2e/chart-showcase.spec.ts`).

Simple getters, setters, and obvious component wiring are not commented.

## Function Design

**Hooks** return the TanStack Query result object directly (not wrapped in a custom shape), or an object with state + actions for store hooks or effect hooks:
```ts
export function useAutoRefresh(intervalMs: number, onRefresh: () => void) {
  return { isActive, remainingMs, resetTimer }
}
```

**Utility functions** return typed values. Prefer explicit return types on exported functions.

**Route handler functions** (FastAPI) are thin — validate input, call service, return response. No direct HTTP/DB calls (except simple SQLAlchemy CRUD queries). See `backend/app/api/managed_dashboards.py` for the canonical thin handler pattern.

## Module Design

**No default exports** except the implicit route exports generated by TanStack Router file-based routing (`routeTree.gen.ts`).

**No barrel files.** Import directly from the source file, not from a folder-level `index.ts`.

**Service layer pattern (backend):**
- Route handlers in `backend/app/api/` — thin, validate input, call service, return response
- Services in `backend/app/services/` — business logic, external API calls, DB queries, connection management
- Models in `backend/app/models/` — Pydantic request/response models
- DB models in `backend/app/db/models/` — SQLAlchemy ORM models (table names prefixed `recviz_`, e.g. `recviz_dashboards`)
- Core utilities in `backend/app/core/` — DI dependencies, error helpers

## Python / FastAPI Conventions

**Sync DB, async handlers rule:**
- DB sessions are **sync** (`sqlalchemy.orm.Session`) — see `backend/app/db/engine.py` for rationale (driver compatibility with oracledb thick mode)
- Route handlers that use `DbSessionDep` MUST be declared as `def` (not `async def`) so FastAPI runs them in its threadpool rather than blocking the event loop
- `lifespan` is still declared `async def` because FastAPI requires it, but the body is synchronous

**Dependency injection** via `Annotated[Type, Depends(factory)]` pattern in `backend/app/core/dependencies.py`:
- `DbSessionDep = Annotated[Session, Depends(get_db_session)]`
- `ConfigStoreDep`, `QueryEngineDep`, `EngineManagerDep`, `ConnectionResolverDep`, `ResolvedDataSourceDep`
- Use these in handlers as type hints — no boilerplate `Depends()` in the function signature

**Pydantic v2** models for all request bodies and responses:
- Base class `CamelModel` in `backend/app/models/base.py` auto-generates camelCase aliases via `alias_generator=to_camel` and `populate_by_name=True`
- All request/response models inherit `CamelModel`
- Field validation via `Field(min_length=1, max_length=256)` etc. — see `backend/app/models/managed_dashboard.py`

**SQLAlchemy 2.0 style ORM:**
- `Mapped[T]` + `mapped_column()` syntax
- Table names prefixed `recviz_` (e.g. `recviz_dashboards`, `recviz_charts`) to avoid conflicts with Superset metadata tables in the same database
- JSONB columns for flexible config storage

**`from __future__ import annotations`** at top of every Python file for forward references and cleaner type hints.

**Router aggregation:** Each entity has its own router file in `backend/app/api/` (e.g. `managed_dashboards.py`, `managed_kpis.py`). Each router uses `prefix="/api/..."` and `tags=[...]`. Aggregated in `backend/app/api/router.py` via `api_router.include_router(...)`.

## Shadcn/ui Rules

- Config at `frontend/components.json`:
  - Style: `new-york`
  - Base color: `neutral`
  - CSS variables enabled
  - Icon library: `lucide`
- All Shadcn components live in `frontend/src/components/ui/`. They are **owned code** — copy-pasted in, not a dependency
- Use `cn()` from `frontend/src/lib/utils.ts` (clsx + tailwind-merge) for class merging
- **Extend** Shadcn via composition. Do NOT modify base `ui/` files unless absolutely necessary
- Custom domain components (filter bar, KPI card, chart factory) compose Shadcn primitives

## Tailwind CSS Rules

- Shadcn CSS variable theming in `frontend/src/index.css`
- Colors reference CSS variables: `text-foreground`, `bg-background`, `text-muted-foreground`, `bg-muted`, `border`, `bg-primary`, `text-primary-foreground`
- **Never** hardcode hex/rgb/hsl values
- Status colors always include dark variant: `text-green-600 dark:text-green-400` (positive), `text-red-600 dark:text-red-400` (negative)
- Chart colors: `--color-chart-1` through `--color-chart-5` (read via `getComputedStyle` when AG Charts/ECharts need palette)
- Dark mode: `dark` class on `<html>` element, custom variant `@custom-variant dark (&:is(.dark *));`
- Every component MUST work in both light and dark mode
- **Desktop-only** — no mobile/tablet responsive design, fixed widths for filter controls (e.g. `w-[180px]`, `w-[200px]`)

## Spacing and Typography

- Page padding: `p-6` (each page owns its padding, layout provides none)
- Section gaps: `space-y-6` between major sections (filter bar → KPIs → charts → grid)
- Card padding: Shadcn defaults (not overridden)
- Grid gaps: `gap-3` for KPI rows, `gap-4` for chart grids
- Page title: `text-2xl font-semibold tracking-tight`
- Section title: `text-lg font-medium`
- Body: `text-sm` (14px default)
- Caption/label: `text-xs text-muted-foreground`; KPI labels use `text-[11px] font-medium uppercase tracking-wider text-muted-foreground`
- Monospace (code/SQL): `font-mono text-sm`
- Animation durations: 200-300ms page/chart transitions, ~1s KPI counter roll-up via `motion/react`, 300ms tooltip delay

---

*Convention analysis: 2026-04-11*
