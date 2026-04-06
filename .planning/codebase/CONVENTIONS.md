# Coding Conventions

**Analysis Date:** 2026-04-06

## Naming Patterns

**Files:**
- Components: `kebab-case.tsx` (e.g., `config-kpi-row.tsx`, `chart-factory.tsx`, `error-panel.tsx`)
- Hooks: `use-{name}.ts` (e.g., `use-chart-data.ts`, `use-managed-datasets.ts`)
- Stores: `{name}-store.ts` (e.g., `filter-store.ts`, `drill-store.ts`)
- Types: `{domain}.ts` (e.g., `filter.ts`, `chart.ts`, `managed-dataset.ts`)
- Utils/lib: `kebab-case.ts` (e.g., `api-client.ts`, `cross-filter.ts`, `chart-themes.ts`)
- Tests: `{name}.test.ts(x)` co-located with source (e.g., `formatters.test.ts` next to `formatters.ts`)
- Pages/Routes: `$paramName.tsx` or `index.tsx` in TanStack Router file-based dirs
- Python: `snake_case.py` (e.g., `superset_client.py`, `query_engine.py`, `managed_dataset.py`)

**Functions:**
- React components: `PascalCase` (e.g., `ConfigKpiRow`, `ChartFactory`, `ErrorPanel`)
- Hooks: `useCamelCase` (e.g., `useChartData`, `useManagedDatasets`, `useAutoRefresh`)
- Utility functions: `camelCase` (e.g., `buildSeries`, `formatValue`, `applyCrossFilters`)
- Python functions: `snake_case` (e.g., `build_sql`, `resolve_database`, `sync_dataset`)

**Variables:**
- TypeScript: `camelCase` (e.g., `crossFilters`, `queryClient`, `appliedFilters`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `EXPORT_PIXEL_RATIO`, `DATA_KEYS`, `CHART_REQUIREMENTS`)
- Python: `snake_case` (e.g., `superset_client`, `config_store`)

**Types/Interfaces:**
- TypeScript interfaces: `PascalCase` (e.g., `ChartWrapperProps`, `CrossFilter`, `KpiConfig`)
- Type aliases: `PascalCase` (e.g., `ChartType`, `FilterValue`, `ColumnRole`)
- Props interfaces: `{ComponentName}Props` pattern (e.g., `ConfigKpiRowProps`, `ErrorPanelProps`)
- Python Pydantic models: `PascalCase` (e.g., `DatasetCreate`, `ColumnMetaSchema`, `CamelModel`)

## Code Style

**Formatting:**
- No Prettier configured. Code formatting relies on ESLint + manual consistency.
- TypeScript: 2-space indentation, single quotes, no trailing semicolons (observed in most files)
- Python: Standard PEP 8 (4-space indent, double quotes for docstrings)

**Linting:**
- ESLint 9 flat config at `frontend/eslint.config.js`
- Extends: `@eslint/js` recommended, `typescript-eslint` recommended, `react-hooks` recommended, `react-refresh` vite
- No custom rules configured beyond defaults
- No Python linter config (no ruff.toml, pyproject.toml, or .flake8 found)

**TypeScript Strictness:**
- `strict: true` in `frontend/tsconfig.app.json`
- `noUnusedLocals: true`, `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`
- `verbatimModuleSyntax: true` (requires `type` keyword on type-only imports)
- Target: `ES2022`

## Import Organization

**Order (observed consistently):**
1. React core imports (`import { useMemo, useRef } from 'react'`)
2. External library imports (`import { AgCharts } from 'ag-charts-react'`)
3. Internal absolute path imports (`import { Skeleton } from '@/components/ui/skeleton'`)
4. Relative imports (`import { ColumnMissingError } from './column-missing-error'`)
5. Type-only imports (`import type { ChartWrapperProps } from '@/types/chart'`)

Type imports use `import type` syntax consistently, as enforced by `verbatimModuleSyntax`.

**Path Aliases:**
- `@/*` maps to `./src/*` (configured in `frontend/tsconfig.json` and `frontend/vite.config.ts`)
- Used universally for cross-directory imports
- Relative imports (`./ ` or `../`) only for same-directory or parent-child within a feature

**No barrel exports:** No `index.ts` re-export files. Every import targets the specific file directly.

## Error Handling

**Frontend Patterns:**
- `ApiError` class in `frontend/src/lib/api-client.ts` wraps non-2xx responses with structured fields (`status`, `code`, `userMessage`, `detail`, `retryAfter`)
- `ErrorBoundary` class component (`frontend/src/components/shared/error-boundary.tsx`) catches render errors with retry
- `ErrorPanel` functional component (`frontend/src/components/shared/error-panel.tsx`) for data fetch errors, with optional detail expansion and retry button
- TanStack Query `onError` in `QueryCache` (`frontend/src/lib/query-client.ts`) shows toast via Sonner for `ApiError` instances
- Pattern: check `error instanceof ApiError` to extract user-facing message, fall back to generic
- `throw` on non-2xx in API client; TanStack Query handles the error state

**Backend Patterns:**
- `ValueError` raised in services for business logic errors, caught by route handlers and converted to `HTTPException(400)`
- `HTTPException(404)` for not-found resources
- `HTTPException(409)` for conflict (e.g., deleting dataset referenced by charts)
- `sanitize_detail()` in `backend/app/core/errors.py` truncates and redacts connection strings before sending to client
- Service layer catches external failures (Superset down) and returns `None` instead of raising, letting the endpoint decide the status code
- `from __future__ import annotations` used in all Python modules for forward reference support

## Logging

**Frontend:** `console.error` in `ErrorBoundary.componentDidCatch`. No structured logging framework.

**Backend:**
- Python standard `logging` module
- `logging.basicConfig(level=logging.INFO)` in `backend/app/main.py`
- Per-module loggers: `logger = logging.getLogger(__name__)`
- `logger.info()` for startup milestones, `logger.error()` for caught exceptions in services
- No external logging service (Datadog, Sentry, etc.)

## Comments

**When to Comment:**
- JSDoc block comments (`/** ... */`) on exported public functions, especially `buildSeries`, `formatValue`, imperative handle interfaces
- Inline comments for non-obvious logic (e.g., `// Don't transform values inside these keys -- they contain DB column names`)
- Python docstrings on modules and public functions (one-line or multi-line)
- `TODO: Phase X` comments reference planned work (e.g., `// TODO: Phase 2 -- port chart data fetching logic`)

**JSDoc/TSDoc:**
- Used on interfaces (`AgChartRef`, `EChartRef`, `ChartRef`) to document each method
- Used on exported utility functions for context
- Not used on React components (props interface is self-documenting)

## Component Design

**Functional components only.** One exception: `ErrorBoundary` which requires `componentDidCatch` lifecycle (class component).

**One primary component per file.** Small helpers (like `KpiSkeleton` inside `config-kpi-row.tsx`) are allowed in the same file.

**Props pattern:**
```tsx
interface ConfigKpiRowProps {
  dashboardId: string
  kpis: KpiConfig[]
  crossFilteredKpis?: KpiResult[] | null
  partialMatches?: KpiPartialMatch[]
}

export function ConfigKpiRow({ dashboardId, kpis, crossFilteredKpis, partialMatches }: ConfigKpiRowProps) {
  // ...
}
```

**Named exports** for all components, hooks, stores, and utilities. Route components use named `Route` export via `createFileRoute()` plus a local component function.

**Loading states:** Use `Skeleton` component from `@/components/ui/skeleton` for all loading states. Never show blank areas.

**Error states:** Use `ErrorPanel` for data errors with optional retry callback.

## Hook Design

**TanStack Query wrappers:**
```tsx
export function useDataSourceQuery(dataSourceId: string, filters: Record<string, FilterValue>, enabled = true) {
  return useQuery({
    queryKey: ['data-source', dataSourceId, filters],
    queryFn: () => api.post<DataSourceQueryResponse>(`/api/data-sources/${dataSourceId}/query`, { filters }),
    enabled: enabled && !!dataSourceId,
    placeholderData: keepPreviousData,
  })
}
```

**Mutation hooks:** Follow CRUD naming: `useCreateDataset`, `useUpdateDataset`, `useDeleteDataset`. Invalidate relevant query keys on success.

**Query key convention:** `['entity', identifier, filters]` -- hierarchical structure enabling targeted invalidation.

## Zustand Store Design

**Stores hold state + simple setters.** No async logic or complex business rules.
```tsx
export const useFilterStore = create<FilterStore>((set) => ({
  values: {},
  locked: new Set<string>(),
  applied: {},
  setFilterValue: (filterId, value) => set((s) => ({ values: { ...s.values, [filterId]: value } })),
  // ...
}))
```

**Selectors for performance:**
```tsx
const appliedFilters = useFilterStore((s) => s.applied)
```

**Separate stores for separate concerns:** `filter-store.ts`, `drill-store.ts` -- not one monolithic store.

## Module Design

**Exports:** Named exports only (`export function`, `export const`, `export class`). No default exports except where required by TanStack Router.

**API boundary:** Backend uses `CamelModel` base class (`backend/app/models/base.py`) with Pydantic `alias_generator=to_camel` so JSON responses are camelCase. Frontend API client additionally transforms snake_case keys to camelCase via `transformKeys()`, but skips transformation inside data payload keys (`rows`, `columns`, `data`, `config`).

## Tailwind / Styling Conventions

**Color references:** Only Shadcn CSS variables -- `text-foreground`, `bg-background`, `text-muted-foreground`, `bg-card`, `border`, `bg-destructive/10`, etc. No hardcoded hex/rgb values.

**Dark mode:** `dark:` variant classes always paired with light variants for status colors (e.g., `text-green-600 dark:text-green-400`).

**Spacing:** Page padding `p-6`, section gaps `space-y-6` or `gap-6`, card internal padding from Shadcn defaults.

**Typography:** `text-2xl font-semibold tracking-tight` for page titles, `text-sm text-muted-foreground` for descriptions, `text-xs` for captions.

**`cn()` utility:** Always use `cn()` from `@/lib/utils` for conditional class merging, never manual template literals.

## Backend API Conventions

**Router pattern:**
```python
router = APIRouter(prefix="/api/data-sources", tags=["data-sources"])
```

**Dependency injection:** Use FastAPI `Depends()` with typed aliases:
```python
DbSessionDep = Annotated[AsyncSession, Depends(get_db_session)]
QueryEngineDep = Annotated[QueryEngine, Depends(get_query_engine)]
ResolvedDataSourceDep = Annotated[DataSourceConfig, Depends(get_resolved_data_source)]
```

**Thin route handlers:** Validate input, call service, return response. No direct DB/HTTP calls in handlers.

**Async everywhere:** All endpoints `async def`. Use `httpx.AsyncClient` for Superset. Use `asyncpg` + `sqlalchemy[asyncio]` for DB.

**Config:** `pydantic-settings` `BaseSettings` class in `backend/app/config.py` reading from env vars with `.env` fallback.

---

*Convention analysis: 2026-04-06*
