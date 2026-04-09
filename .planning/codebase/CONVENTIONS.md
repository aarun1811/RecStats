# Coding Conventions

**Analysis Date:** 2026-04-09

## Naming Patterns

**Files:**
- Components: `kebab-case.tsx` (e.g., `config-filter-bar.tsx`, `dashboard-list-card.tsx`)
- Hooks: `use-{name}.ts` (e.g., `use-data-source-query.ts`, `use-managed-dashboards.ts`)
- Stores: `{name}-store.ts` (e.g., `filter-store.ts`, `drill-store.ts`, `builder-store.ts`)
- Types: `{name}.ts` in `frontend/src/types/` (e.g., `chart.ts`, `filter.ts`, `dashboard-config.ts`)
- Utils/lib: `kebab-case.ts` in `frontend/src/lib/` (e.g., `api-client.ts`, `cross-filter.ts`, `formatters.ts`)
- Route pages: `index.tsx` for list pages, `$paramName.tsx` for detail pages (TanStack Router file-based routing)
- Tests: `{name}.test.ts(x)` co-located with source file (e.g., `cross-filter.test.ts` next to `cross-filter.ts`)
- Python: `snake_case.py` (e.g., `superset_client.py`, `query_engine.py`, `managed_dashboards.py`)

**Functions:**
- TypeScript: `camelCase` (e.g., `useDataSourceQuery`, `applyCrossFilters`, `buildSeries`)
- Python: `snake_case` (e.g., `list_managed_dashboards`, `_build_sql`, `_resolve_database`)
- Private Python helpers: prefix with underscore (e.g., `_to_response`, `_is_connection_failure`)

**Variables:**
- TypeScript: `camelCase` for variables and props (e.g., `crossFilters`, `appliedFilters`, `dataSourceId`)
- Python: `snake_case` (e.g., `superset_client`, `database_registrar`, `status_tracker`)
- Constants: `UPPER_SNAKE_CASE` in both languages (e.g., `DEFAULT_MAX_ROWS`, `DATA_KEYS`, `EXPORT_PIXEL_RATIO`)

**Types/Interfaces:**
- TypeScript interfaces: `PascalCase` (e.g., `FilterStore`, `ChartWrapperProps`, `ChartDataResponse`)
- Props interface: named `{ComponentName}Props` and defined directly above the component
- Python Pydantic models: `PascalCase` (e.g., `DashboardCreate`, `DashboardResponse`, `CamelModel`)

**React Components:**
- `PascalCase` function names (e.g., `ConfigFilterBar`, `DashboardRenderer`, `ErrorPanel`)
- Named exports for all components, hooks, stores, and utilities
- Exception: page-level route components use `function ComponentName()` locally and `export const Route = createFileRoute(...)` for the route

## Code Style

**Formatting:**
- No Prettier config file detected; formatting enforced by ESLint + TypeScript
- Semicolons: omitted (no semicolons in TypeScript files)
- Trailing commas: used in multi-line parameter lists and arrays
- Single quotes for strings in TypeScript
- Double quotes for strings in Python (convention follows FastAPI/Pydantic ecosystem)
- 2-space indentation in TypeScript, 4-space in Python

**Linting:**
- ESLint flat config at `frontend/eslint.config.js`
- Plugins: `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `typescript-eslint`
- Extends: `js.configs.recommended`, `tseslint.configs.recommended`, `reactHooks.configs.flat.recommended`, `reactRefresh.configs.vite`
- TypeScript strict mode enabled in `frontend/tsconfig.app.json`: `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`
- No Python linter config detected (no ruff, flake8, or mypy config files)

**TypeScript Strictness:**
- `strict: true` in `tsconfig.app.json`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`
- `verbatimModuleSyntax: true`
- `erasableSyntaxOnly: true`
- Target: ES2022, Module: ESNext, JSX: react-jsx

## Import Organization

**Order (TypeScript):**
1. React imports (`import { useMemo, useRef, useEffect } from 'react'`)
2. External library imports (`import { AgCharts } from 'ag-charts-react'`, `import { keepPreviousData, useQuery } from '@tanstack/react-query'`)
3. Internal absolute paths via `@/` alias (`import { api } from '@/lib/api-client'`, `import { useFilterStore } from '@/stores/filter-store'`)
4. Relative imports (`import { ColumnMissingError } from './column-missing-error'`)
5. Type-only imports (`import type { ChartWrapperProps } from '@/types/chart'`)
- Blank line between groups
- Type imports use `import type { ... }` syntax (enforced by `verbatimModuleSyntax`)

**Order (Python):**
1. `from __future__ import annotations` (first line in most files)
2. Standard library imports
3. Third-party imports (`from fastapi import ...`, `from sqlalchemy import ...`)
4. Local imports (`from app.core.dependencies import ...`, `from app.models import ...`)

**Path Aliases:**
- `@/*` maps to `frontend/src/*` (configured in `tsconfig.json`, `vite.config.ts`, and `vitest.config.ts`)

## Component Patterns

**Functional Components Only:**
- All React components are functional. No class components anywhere in the codebase.
- Components use named function declarations, not arrow functions:
```tsx
export function ConfigKpiRow({ kpis, crossFilteredKpis }: ConfigKpiRowProps) {
  // ...
}
```

**Props Interface Pattern:**
- Define `{ComponentName}Props` interface directly above the component:
```tsx
interface ErrorPanelProps {
  message: string
  detail?: string
  onRetry?: () => void
  className?: string
  compact?: boolean
}

export function ErrorPanel({ message, detail, onRetry, className, compact = false }: ErrorPanelProps) {
  // ...
}
```

**Helper Components in Same File:**
- Small helper components (used only by the primary component) live in the same file
- Separated by comment dividers:
```tsx
// ---------------------------------------------------------------------------
// Individual filter control dispatcher
// ---------------------------------------------------------------------------
```
- Private helpers are not exported (no `export` keyword)

**No Barrel Exports:**
- No `index.ts` re-exporting. Import directly from the source file:
```tsx
import { ConfigFilterBar } from '@/components/dashboard/config-filter-bar'
```

## State Management (Zustand)

**Store Pattern:**
- One store per concern: `filter-store.ts`, `drill-store.ts`, `builder-store.ts`, `layout-history-store.ts`
- Interface defined above the store, named `{Name}Store`:
```tsx
interface FilterStore {
  values: Record<string, FilterValue>
  locked: Set<string>
  applied: Record<string, FilterValue>
  setFilterValue: (filterId: string, value: FilterValue) => void
  applyFilters: () => void
  // ...
}

export const useFilterStore = create<FilterStore>((set) => ({
  // state + actions
}))
```

**Selectors for Re-render Prevention:**
```tsx
const appliedFilters = useFilterStore((s) => s.applied)
const crossFilters = useFilterStore((s) => s.crossFilters)
```

**State vs. Server Data:**
- Zustand: UI state only (filters, drill state, builder state, layout)
- TanStack Query: all server data. Never store fetched data in Zustand.

## Data Fetching (TanStack Query)

**Custom Hook Pattern:**
- Every data-fetching operation wrapped in a custom hook in `frontend/src/hooks/`:
```tsx
export function useDataSourceQuery(
  dataSourceId: string,
  filters: Record<string, FilterValue>,
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: ['data-source', dataSourceId, filters],
    queryFn: () => api.post<DataSourceQueryResponse>(`/api/data-sources/${dataSourceId}/query`, { filters }),
    enabled: enabled && !!dataSourceId,
    placeholderData: keepPreviousData,
  })
}
```

**Query Key Convention:** `['entity-name', identifier, filters]`
- Examples: `['managed-dashboards']`, `['managed-dashboard', id]`, `['data-source', dataSourceId, filters]`

**Mutation Pattern with Cache Invalidation:**
```tsx
export function useDeleteDashboard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/dashboards/managed/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-dashboards'] })
    },
  })
}
```

**Defaults** (from `frontend/src/lib/query-client.ts`):
- `staleTime`: 5 minutes
- `gcTime`: 30 minutes
- `retry`: 1
- `refetchOnWindowFocus`: false
- Global error handler: toasts `ApiError.userMessage` via Sonner

## API Client

**Location:** `frontend/src/lib/api-client.ts`

**Key Behaviors:**
- Uses native `fetch` (no axios)
- Base URL from `import.meta.env.VITE_API_BASE_URL`, defaults to `http://localhost:8000`
- Automatic `snake_case` to `camelCase` key transformation on responses
- `DATA_KEYS` set (`rows`, `columns`, `data`, `config`) are skip-transformed to preserve DB column names
- 204 responses return `undefined`
- Non-2xx responses throw `ApiError` with structured fields: `status`, `code`, `userMessage`, `detail`, `retryAfter`

**API Object:**
```tsx
export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
```

## Error Handling

**Frontend:**
- `ApiError` class in `frontend/src/lib/api-client.ts` — structured error with `status`, `code`, `userMessage`, `detail`
- Global TanStack Query error handler toasts `ApiError.userMessage` via Sonner
- Component-level: check `isError` from useQuery, render `<ErrorPanel>` with retry callback
- `<ErrorBoundary>` component wraps route outlet in `frontend/src/routes/_app.tsx`
- Pattern: `const apiError = error instanceof ApiError ? error : null`

**Backend:**
- FastAPI `HTTPException` for client errors (404, 409, 422)
- `sanitize_detail()` in `backend/app/core/errors.py` — truncates long messages, redacts DB connection strings
- Route handlers log full exceptions server-side, return sanitized details to clients
- Connection-level failures detected via pattern matching on Superset error text (`_CONNECTION_FAILURE_PATTERNS`)

## Logging

**Frontend:** Console only. No structured logging framework.
- Errors surface via TanStack Query's global error handler + Sonner toasts

**Backend:**
- Python `logging` module with `logging.basicConfig(level=logging.INFO)` in `backend/app/main.py`
- Logger created per-module: `logger = logging.getLogger(__name__)`
- Used for startup events, sync status, and error context before sanitization

## Comments

**When to Comment:**
- JSDoc-style `/** */` comments on exported functions that have non-obvious behavior
- Comment dividers between logical sections within a file:
```tsx
// ---------------------------------------------------------------------------
// Single-select filter (Shadcn Select)
// ---------------------------------------------------------------------------
```
- Inline comments for business logic, workarounds, and non-obvious decisions
- Test file headers with `/** */` blocks explaining scope, context, and preconditions

**No Comments on Obvious Code:**
- Simple getters, setters, and obvious component wiring are not commented

## Function Design

**Size:** Functions are kept focused. Complex components break helper logic into separate functions in the same file or in `lib/`.

**Parameters:** Destructured props for components. Named parameters for hooks and utilities.

**Return Values:**
- Hooks return the TanStack Query result object directly (not wrapped)
- Store hooks return objects with state + actions
- Utility functions return typed values

## Module Design

**Exports:** Named exports everywhere. `export function`, `export const`, `export class`.
- No default exports except implicit route exports from TanStack Router file-based routing.

**No Barrel Files:** Each file exports its own symbols. Import from the file directly.

## Python / FastAPI Conventions

**Async Everywhere:**
- All route handlers are `async def`
- Services use `async` methods for I/O operations
- `httpx.AsyncClient` for outbound HTTP, `asyncpg` for database

**Service Layer Pattern:**
- Route handlers in `backend/app/api/` — thin, validate input, call service, return response
- Services in `backend/app/services/` — business logic, external API calls, DB queries
- No direct DB/HTTP calls in route handlers (except simple SQLAlchemy queries for CRUD)

**Dependency Injection:**
- `Annotated[Type, Depends(factory)]` pattern for type-safe DI
- Named dependency types: `DbSessionDep`, `SupersetDep`, `ConfigStoreDep`, `QueryEngineDep`, `DatasetSyncDep`, `ResolvedDataSourceDep`
- Session lifecycle managed via `get_db_session()` generator with auto commit/rollback

**Pydantic Models:**
- Base class `CamelModel` in `backend/app/models/base.py` auto-generates camelCase aliases
- All request/response models inherit `CamelModel`
- Field validation via `Field(min_length=1, max_length=256)` etc.
- `from __future__ import annotations` at top of every Python file for forward references

**SQLAlchemy Models:**
- Located in `backend/app/db/models/`
- Use `Mapped[T]` + `mapped_column()` (SQLAlchemy 2.0 style)
- Table names prefixed with `recviz_` (e.g., `recviz_dashboards`, `recviz_charts`)
- JSONB for flexible config storage

**Router Organization:**
- Each entity has its own router file in `backend/app/api/` (e.g., `managed_dashboards.py`, `managed_charts.py`)
- Routers use `prefix="/api/..."` and `tags=[...]`
- Aggregated in `backend/app/api/router.py` via `api_router.include_router()`

## Shadcn/ui Rules

**Location:** All Shadcn components in `frontend/src/components/ui/` (owned code, copy-pasted in)
- Style: `new-york` (from `frontend/components.json`)
- Base color: `neutral`
- CSS variables enabled
- Icon library: Lucide React

**Composition Pattern:**
- Use `cn()` from `frontend/src/lib/utils.ts` for class merging (clsx + tailwind-merge)
- Extend Shadcn via composition, not modification of base `ui/` files
- Domain components compose Shadcn primitives (e.g., `ConfigFilterBar` composes `Select`, `Popover`, `Command`, `Button`)

## Tailwind CSS Rules

**CSS Variables:**
- Shadcn CSS variable theming in `frontend/src/index.css`
- Colors reference variables: `text-foreground`, `bg-background`, `text-muted-foreground`, `bg-muted`, `border`, `bg-primary`
- Status colors: `text-green-600 dark:text-green-400` (positive), `text-red-600 dark:text-red-400` (negative)
- Chart colors: `--color-chart-1` through `--color-chart-5`

**Dark Mode:**
- Class strategy: `dark` class on `<html>` element
- Custom variant: `@custom-variant dark (&:is(.dark *));`
- Every component must include `dark:` variants for colors
- ThemeProvider at `frontend/src/components/layout/theme-provider.tsx`

**Desktop First:**
- No mobile/tablet responsive design. Desktop-optimized layouts.
- Fixed widths for filter controls (e.g., `w-[180px]`, `w-[200px]`)

## Spacing and Typography

**Page Layout:**
- Page padding: `p-6` (each page owns its padding)
- Section gaps: `space-y-6` between major sections
- Card padding: Shadcn defaults (not overridden)
- Grid gaps: `gap-3` for KPI rows, `gap-4` for chart grids

**Typography:**
- Page title: `text-2xl font-semibold tracking-tight`
- Section title: `text-lg font-medium`
- Body: `text-sm` (14px default)
- Caption/label: `text-xs text-muted-foreground`, `text-[11px] font-medium uppercase tracking-wider text-muted-foreground` for KPI labels
- Monospace: `font-mono text-sm`

---

*Convention analysis: 2026-04-09*
