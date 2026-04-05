# Coding Conventions

**Analysis Date:** 2026-04-05

## Naming Patterns

**Files:**
- Components: `kebab-case.tsx` (e.g., `config-filter-bar.tsx`, `kpi-card.tsx`, `error-panel.tsx`)
- Hooks: `use-{name}.ts` (e.g., `use-chart-data.ts`, `use-auto-refresh.ts`)
- Stores: `{name}-store.ts` (e.g., `filter-store.ts`, `drill-store.ts`)
- Types: `{name}.ts` in `types/` (e.g., `filter.ts`, `chart.ts`, `dashboard-config.ts`)
- Utilities: `kebab-case.ts` (e.g., `api-client.ts`, `cross-filter.ts`, `chart-themes.ts`)
- Tests: `{name}.test.ts(x)` co-located with source (e.g., `formatters.test.ts` next to `formatters.ts`)
- Page routes: `$paramName.tsx` or `index.tsx` following TanStack Router file-based routing
- Python: `snake_case.py` (e.g., `superset_client.py`, `config_store.py`, `data_sources.py`)

**Functions:**
- camelCase for all TypeScript functions and methods
- snake_case for all Python functions
- React components: PascalCase (e.g., `ConfigFilterBar`, `ErrorPanel`, `CountAnimation`)
- Hooks: `use` prefix + camelCase (e.g., `useChartData`, `useAutoRefresh`, `useDashboardConfig`)

**Variables:**
- camelCase for TypeScript (e.g., `crossFilters`, `queryClient`, `metricColumns`)
- snake_case for Python (e.g., `kpi_values`, `data_source_id`, `filter_mappings`)
- Constants: SCREAMING_SNAKE_CASE (e.g., `LOCALE`, `EXPORT_PIXEL_RATIO`, `DATA_KEYS`)

**Types/Interfaces:**
- PascalCase with descriptive suffixes: `{Name}Props`, `{Name}Config`, `{Name}Response`
- Examples: `ConfigFilterBarProps`, `DashboardConfig`, `ChartDataResponse`, `KpiResult`
- Prefer `interface` over `type` for object shapes
- Use `type` for unions and aliases (e.g., `type FormatType = 'number' | 'currency' | ...`)
- Python models: PascalCase Pydantic `BaseModel` subclasses (e.g., `DataSourceConfig`, `ErrorResponse`)

## Code Style

**Formatting:**
- No dedicated formatter config file (no Prettier); rely on ESLint + editor defaults
- Consistent single quotes in TypeScript
- No semicolons (implicit ASI style throughout)
- 2-space indentation in TypeScript/TSX
- 4-space indentation in Python

**Linting:**
- ESLint 9 flat config at `frontend/eslint.config.js`
- Extends: `@eslint/js` recommended, `typescript-eslint` recommended, `react-hooks` recommended, `react-refresh` vite
- Ignores: `dist/`
- Python: no linter config detected (no ruff, flake8, or mypy config)

**TypeScript Strictness:**
- `strict: true` in `frontend/tsconfig.app.json`
- `noUnusedLocals: true`, `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`
- `verbatimModuleSyntax: true` (forces explicit `import type`)
- Target: ES2022, Module: ESNext, JSX: react-jsx
- No `any` allowed per project rules; use `unknown` + type narrowing

## Import Organization

**Order:**
1. React core (`react`, `react-dom`)
2. External libraries (`@tanstack/react-query`, `zustand`, `lucide-react`, `ag-charts-react`, etc.)
3. Internal absolute paths via `@/` alias (`@/components/...`, `@/hooks/...`, `@/lib/...`, `@/stores/...`, `@/types/...`)
4. Relative imports (`./column-missing-error`, `./ag-chart-wrapper`)
5. Type imports use `import type` syntax (enforced by `verbatimModuleSyntax`)

**Blank line between groups.** Example from `frontend/src/components/dashboard/config-kpi-row.tsx`:
```tsx
import { useMemo } from 'react'
import { Info, TrendingDown, TrendingUp } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, ... } from '@/components/ui/tooltip'
import { CountAnimation } from '@/components/shared/count-animation'
import { useDashboardKpis } from '@/hooks/use-dashboard-kpis'
import { useFilterStore } from '@/stores/filter-store'
import { formatValueFull } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api-client'
import type { KpiConfig, KpiResult } from '@/types/dashboard-config'
import type { FormatType, FormatNumberOptions } from '@/types/formatting'
```

**Path Aliases:**
- `@/*` maps to `./src/*` (configured in `frontend/tsconfig.json` and `frontend/vite.config.ts`)
- Vite alias: `{ '@': path.resolve(__dirname, './src') }` in `frontend/vite.config.ts`

**Python imports:**
- `from __future__ import annotations` at top of every file (PEP 563 deferred evaluation)
- stdlib, then third-party, then `app.*` internal

## Error Handling

**Frontend Patterns:**

1. **ApiError class** (`frontend/src/lib/api-client.ts`): Custom error thrown on non-2xx responses. Parses `status`, `code`, `userMessage`, `detail`, `retryAfter` from response body.

2. **TanStack Query global error handler** (`frontend/src/lib/query-client.ts`): `QueryCache.onError` catches `ApiError` and shows toast via Sonner:
   ```tsx
   onError: (error) => {
     if (error instanceof ApiError) {
       toast.error(error.userMessage, {
         description: `Error code: ${error.code}`,
       })
     }
   }
   ```

3. **ErrorBoundary** (`frontend/src/components/shared/error-boundary.tsx`): Class component wrapping React subtrees. Catches rendering crashes with retry button.

4. **ErrorPanel** (`frontend/src/components/shared/error-panel.tsx`): Reusable inline error display with message, expandable detail, and optional retry callback. Use for data-fetch errors within components.

5. **Component-level error handling**: Components check `isError` from `useQuery`, render `ErrorPanel` with retry:
   ```tsx
   if (isError) {
     const apiError = error instanceof ApiError ? error : null
     return (
       <ErrorPanel
         message={apiError?.userMessage ?? 'Failed to load KPI data'}
         detail={apiError?.detail}
         onRetry={() => refetch()}
         compact
       />
     )
   }
   ```

**Backend Patterns:**

1. **HTTPException with structured detail**: Route handlers catch `ValueError` and raise `HTTPException(status_code=400, detail=str(e))`.

2. **Structured error model** (`backend/app/models/error.py`): `ErrorResponse` Pydantic model with `error`, `message`, `detail`, `retry_after` fields. Machine-readable error codes like `"superset_unavailable"`, `"query_timeout"`.

3. **Service layer raises ValueError**: Business logic in services raises `ValueError` for validation failures; route handlers convert to HTTP 400/404.

## Logging

**Frontend:** `console.error` in ErrorBoundary. No structured logging framework.

**Backend:** Python `logging` module.
- `logging.basicConfig(level=logging.INFO)` in `backend/app/main.py`
- `logger = logging.getLogger(__name__)` per module
- Use `logger.info()` for lifecycle events (startup, sync), `logger.error()` for failures

## Comments

**When to Comment:**
- Section dividers: Dashed line comments for visual separation within files:
  ```tsx
  // ---------------------------------------------------------------------------
  // Individual filter control dispatcher
  // ---------------------------------------------------------------------------
  ```
- JSDoc on public utility functions explaining purpose, parameters, returns
- Inline comments for non-obvious logic (dialect switches, cross-filter self-exclusion, epoch detection)
- TODO comments with phase references: `// TODO: Phase 2 -- port chart data fetching logic`

**JSDoc/TSDoc:**
- Used on hooks and utility functions with `@param` and `@returns`
- Not used on React components (Props interface is self-documenting)
- Python: module-level docstrings (`"""..."""`) and class docstrings on Pydantic models

## Function Design

**Size:** Small focused functions. Utility functions typically 10-30 lines. Components can be 50-180 lines.

**Parameters:**
- React components: destructured Props interface, always typed
- Hooks: positional parameters with defaults (e.g., `useChartData(chartId: string, enabled = true)`)
- Python: type-annotated parameters with defaults

**Return Values:**
- Hooks return `useQuery` results directly (object with `data`, `isLoading`, `isError`, `error`, `refetch`)
- Custom hooks like `useAutoRefresh` return typed objects (not arrays): `{ remainingMs, isActive, reset }`
- Zustand stores: state + action methods in single interface
- Python: route handlers return Pydantic models or dicts; services return raw dicts

## Component Design

**Functional components only.** Exception: `ErrorBoundary` uses class component (React requirement for `getDerivedStateFromError`).

**Props interface** defined above component, named `{ComponentName}Props`:
```tsx
interface ErrorPanelProps {
  message: string
  detail?: string
  onRetry?: () => void
  className?: string
  compact?: boolean
}

export function ErrorPanel({ message, detail, onRetry, className, compact = false }: ErrorPanelProps) {
```

**Named exports** for all components, hooks, stores, utilities. Exception: page route components are not exported (TanStack Router uses `Route.component`).

**One primary component per file.** Helper components used only by the primary component are defined in the same file (e.g., `FilterControl`, `SingleSelectFilter` inside `config-filter-bar.tsx`; `KpiSkeleton` inside `config-kpi-row.tsx`).

**No barrel exports** -- no `index.ts` re-export files. Import directly from the source file.

## Module Design

**Exports:** Named exports everywhere. No default exports except `App.tsx` (entry point).

**Barrel Files:** Not used. Direct imports only.

**Zustand Store Pattern:**
```tsx
import { create } from 'zustand'

interface FilterStore {
  // State
  values: Record<string, FilterValue>
  // Actions
  setFilterValue: (filterId: string, value: FilterValue) => void
}

export const useFilterStore = create<FilterStore>((set) => ({
  values: {},
  setFilterValue: (filterId, value) =>
    set((s) => ({ values: { ...s.values, [filterId]: value } })),
}))
```

**TanStack Query Hook Pattern:**
```tsx
export function useDashboardConfig(dashboardId: string) {
  return useQuery({
    queryKey: ['dashboard-config', dashboardId],
    queryFn: () => api.get<DashboardConfig>(`/api/dashboards/${dashboardId}`),
    enabled: !!dashboardId,
    staleTime: 10 * 60 * 1000,
  })
}
```

**Query key convention:** `['entity', identifier, filters]` -- always array, entity first, identifiers second, filter state third.

**API client pattern:** Single `api` object with typed generic methods:
```tsx
export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
}
```

## Tailwind / Styling Conventions

**CSS Variables:** All colors via Shadcn CSS variable system (`text-foreground`, `bg-background`, `text-muted-foreground`, `bg-muted`, `border`, `bg-destructive/10`, etc.). Never hardcode hex/rgb values.

**Dark Mode:** Class strategy via `dark:` variant. Every status color includes dark variant:
```tsx
'text-green-600 dark:text-green-400'  // positive
'text-red-600 dark:text-red-400'      // negative
```

**cn() utility:** Always use `cn()` from `@/lib/utils` for conditional/merged class strings:
```tsx
className={cn(
  'flex flex-col items-center justify-center gap-2',
  compact && 'gap-1 p-2',
  className,
)}
```

**Spacing:** Pages own `p-6`. Section gaps `gap-6` or `space-y-6`. Card internal uses component defaults. Grid gaps `gap-3` or `gap-4`.

**Typography:** `text-2xl font-semibold tracking-tight` for page titles. `text-xs font-medium uppercase text-muted-foreground` for labels. `text-sm` for body text.

## Backend Conventions (Python/FastAPI)

**Async everywhere:** All endpoints `async def`. `httpx.AsyncClient` for HTTP. `AsyncSession` for DB.

**Dependency injection:** `Annotated` type aliases for dependencies:
```python
ConfigStoreDep = Annotated[ConfigStore, Depends(get_config_store)]
QueryEngineDep = Annotated[QueryEngine, Depends(get_query_engine)]
ResolvedDataSourceDep = Annotated[DataSourceConfig, Depends(get_resolved_data_source)]
```

**Route handler pattern:** Thin handlers validate input, call service, return response:
```python
@router.post("/{data_source_id}/query")
async def query_data_source(
    ds_config: ResolvedDataSourceDep,
    body: QueryRequest,
    query_engine: QueryEngineDep,
):
    try:
        result = await query_engine.execute(ds_config, body.filters)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return result
```

**Pydantic models:** All request/response bodies modeled. Inline models in route files for request bodies, shared models in `backend/app/models/`.

**Config:** `pydantic-settings` `BaseSettings` class in `backend/app/config.py` reading from env vars with `.env` fallback.

**Lifespan pattern:** Startup/shutdown managed via `@asynccontextmanager` lifespan function in `backend/app/main.py`. Shared services stored on `app.state`.

---

*Convention analysis: 2026-04-05*
