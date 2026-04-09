# Coding Conventions

**Analysis Date:** 2026-04-09

## Naming Patterns

**Files:**
- Components: `kebab-case.tsx` (e.g., `config-filter-bar.tsx`, `dashboard-list-card.tsx`, `ag-chart-wrapper.tsx`)
- Hooks: `use-{name}.ts` (e.g., `use-data-source-query.ts`, `use-managed-dashboards.ts`)
- Stores: `{name}-store.ts` (e.g., `filter-store.ts`, `drill-store.ts`, `builder-store.ts`)
- Types: `{name}.ts` in `frontend/src/types/` (e.g., `chart.ts`, `filter.ts`, `dashboard-config.ts`)
- Utils/lib: `kebab-case.ts` in `frontend/src/lib/` (e.g., `api-client.ts`, `cross-filter.ts`, `formatters.ts`)
- Route pages: `index.tsx` for list pages, `$paramName.tsx` for detail pages (TanStack Router file-based routing)
- Tests: `{name}.test.ts(x)` co-located with source file (e.g., `cross-filter.test.ts` next to `cross-filter.ts`)
- E2E tests: `{name}.spec.ts` in `frontend/e2e/` directory
- Python modules: `snake_case.py` (e.g., `superset_client.py`, `query_engine.py`, `managed_dashboards.py`)

**Functions:**
- TypeScript: `camelCase` (e.g., `useDataSourceQuery`, `applyCrossFilters`, `buildSeries`)
- React components: `PascalCase` named function declarations (e.g., `function ConfigFilterBar()`)
- Python: `snake_case` (e.g., `list_managed_dashboards`, `_build_sql`, `_resolve_database`)
- Python private helpers: prefix with underscore (e.g., `_to_response`, `_is_connection_failure`)

**Variables:**
- TypeScript: `camelCase` for variables and props (e.g., `crossFilters`, `appliedFilters`, `dataSourceId`)
- Python: `snake_case` (e.g., `superset_client`, `database_registrar`, `status_tracker`)
- Constants: `UPPER_SNAKE_CASE` in both languages (e.g., `DEFAULT_MAX_ROWS`, `DATA_KEYS`, `EXPORT_PIXEL_RATIO`)

**Types:**
- TypeScript interfaces: `PascalCase` (e.g., `FilterStore`, `ChartWrapperProps`, `ChartDataResponse`)
- Props interfaces: named `{ComponentName}Props`, defined directly above the component
- Python Pydantic models: `PascalCase` (e.g., `DashboardCreate`, `DashboardResponse`, `CamelModel`)
- Annotated dependency types: `PascalCase` with `Dep` suffix (e.g., `DbSessionDep`, `QueryEngineDep`, `ConfigStoreDep`)

## Code Style

**Formatting:**
- No Prettier configured. Formatting enforced by ESLint + TypeScript strict mode.
- Semicolons: omitted in TypeScript files
- Trailing commas: used in multi-line parameter lists and arrays
- Single quotes for strings in TypeScript
- Double quotes for strings in Python
- 2-space indentation in TypeScript, 4-space in Python

**Linting:**
- ESLint flat config at `frontend/eslint.config.js`
- Plugins: `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `typescript-eslint`
- Extends: `js.configs.recommended`, `tseslint.configs.recommended`, `reactHooks.configs.flat.recommended`, `reactRefresh.configs.vite`
- TypeScript strict mode in `frontend/tsconfig.app.json`:
  - `strict: true`
  - `noUnusedLocals: true`
  - `noUnusedParameters: true`
  - `noFallthroughCasesInSwitch: true`
  - `verbatimModuleSyntax: true` (enforces `import type` syntax)
  - `erasableSyntaxOnly: true`
- No Python linter config detected (no ruff, flake8, black, or mypy config files)

## Import Organization

**Order:**
1. React core imports (`react`, `react-dom`)
2. External library imports (`lucide-react`, `zustand`, `@tanstack/*`, etc.)
3. Internal absolute path imports (`@/components/*`, `@/hooks/*`, `@/stores/*`, `@/lib/*`)
4. Relative path imports (`./`, `../`)
5. Type-only imports (`import type { ... }`) -- enforced by `verbatimModuleSyntax`

Blank line between each group.

**Path Aliases:**
- `@/*` maps to `frontend/src/*` (configured in `frontend/tsconfig.app.json`, `frontend/vite.config.ts`, and `frontend/vitest.config.ts`)

**Example from `frontend/src/components/dashboard/config-filter-bar.tsx`:**
```tsx
import { useEffect, useMemo, useState } from 'react'
import { ChevronsUpDown, Lock, RotateCcw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useFilterOptions } from '@/hooks/use-filter-options'
import { useFilterStore } from '@/stores/filter-store'
import { cn } from '@/lib/utils'
import type { FilterConfig } from '@/types/dashboard-config'
import type { FilterValue } from '@/types/filter'
```

## Component Patterns

**All React components are functional.** No class components anywhere in the codebase.

**Named function declarations, not arrow functions:**
```tsx
export function ConfigFilterBar({ filters }: ConfigFilterBarProps) {
  // ...
}
```

**Props interface defined directly above the component:**
```tsx
interface ConfigFilterBarProps {
  filters: FilterConfig[]
}

export function ConfigFilterBar({ filters }: ConfigFilterBarProps) {
  // ...
}
```

**Named exports for all components, hooks, stores, and utilities.** No default exports except implicit route exports from TanStack Router file-based routing.

**No barrel exports** (no `index.ts` re-exporting). Import directly from the source file:
```tsx
import { ConfigFilterBar } from '@/components/dashboard/config-filter-bar'
```

**One primary component per file.** Small helper components used only by the primary component can live in the same file, separated by comment dividers and not exported.

## Error Handling

**Frontend Patterns:**
- `ApiError` class in `frontend/src/lib/api-client.ts` -- structured error with `status`, `code`, `userMessage`, `detail`, `retryAfter`
- Non-2xx `fetch` responses throw `ApiError`; TanStack Query retries once then exposes error to components
- Global TanStack Query `QueryCache.onError` toasts `ApiError.userMessage` via Sonner (`frontend/src/lib/query-client.ts`)
- Component-level: check `isError` from `useQuery`, render `<ErrorPanel>` with retry callback
- `<ErrorBoundary>` component (`frontend/src/components/shared/error-boundary.tsx`) wraps route outlet

**Backend Patterns:**
- FastAPI `HTTPException` for client errors (404, 409, 422)
- `sanitize_detail()` in `backend/app/core/errors.py` -- truncates long messages to 500 chars, redacts DB connection strings with regex
- Route handlers log full exceptions server-side via `logger`, return sanitized details to clients
- DB session dependency (`get_db_session` in `backend/app/core/dependencies.py`) auto-commits on success, auto-rollbacks on exception
- Structured error responses use `detail` dict with `error` code field (e.g., `{"detail": {"error": "read_only_violation"}}`)

## Logging

**Frontend:**
- No structured logging framework. Errors surface via TanStack Query's global error handler + Sonner toasts.
- Console errors are monitored in E2E tests via `page.on('console')`.

**Backend:**
- Python `logging` module with `logging.basicConfig(level=logging.INFO)` in `backend/app/main.py`
- Logger created per-module: `logger = logging.getLogger(__name__)`
- Used for startup events (`lifespan`), sync status, and error context before sanitization

## Comments

**When to Comment:**
- JSDoc-style `/** */` comments on exported functions that have non-obvious behavior
- Comment dividers between logical sections within a file: `// ── Section Name ──────────────`
- Python uses `# ── Section Name ──────────────────` dividers in the same style
- Inline comments for business logic, workarounds, and non-obvious decisions
- Test file headers with `/** */` blocks explaining scope, context, and preconditions

**JSDoc/TSDoc:**
- Used on exported utility functions and test fixture helpers
- Not required on simple getters, setters, or obvious component wiring

## State Management (Zustand)

**One store per concern:**
- `frontend/src/stores/filter-store.ts` -- filter values, applied snapshot, locked set, cross-filters
- `frontend/src/stores/drill-store.ts` -- per-chart drill level stacks
- `frontend/src/stores/builder-store.ts` -- dashboard layout being edited, dirty tracking
- `frontend/src/stores/layout-history-store.ts` -- undo/redo for builder canvas layouts

**Store pattern:**
```typescript
interface FilterStore {
  values: Record<string, FilterValue>
  // ... state fields
  setFilterValue: (filterId: string, value: FilterValue) => void
  // ... action methods
}

export const useFilterStore = create<FilterStore>((set) => ({
  values: {},
  setFilterValue: (filterId, value) =>
    set((s) => ({ values: { ...s.values, [filterId]: value } })),
}))
```

**Rules:**
- Stores hold state + simple setters. No complex business logic in stores.
- Use selectors to avoid unnecessary re-renders: `const dateRange = useFilterStore((s) => s.globalFilters.dateRange)`
- Zustand: UI state only (filters, drill state, builder state, layout)
- TanStack Query: all server data. Never store fetched data in Zustand.

## Data Fetching (TanStack Query)

**Custom hooks wrap all queries/mutations in `frontend/src/hooks/`:**
```typescript
export function useManagedDashboards() {
  return useQuery({
    queryKey: ['managed-dashboards'],
    queryFn: () => api.get<ManagedDashboard[]>('/api/dashboards/managed'),
  })
}
```

**Query key convention:** `['entity', identifier, filters]`
- Examples: `['managed-dashboards']`, `['managed-dashboard', id]`, `['data-source', dataSourceId, filters]`

**Default options** (from `frontend/src/lib/query-client.ts`):
- `staleTime`: 5 minutes
- `gcTime`: 30 minutes
- `retry`: 1
- `refetchOnWindowFocus`: false

**Mutations invalidate related query keys in `onSuccess`:**
```typescript
export function useCreateDashboard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: DashboardCreate) =>
      api.post<ManagedDashboard>('/api/dashboards/managed', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-dashboards'] })
    },
  })
}
```

## API Client

**Single file:** `frontend/src/lib/api-client.ts`
- Uses native `fetch` (no axios)
- Base URL from `import.meta.env.VITE_API_BASE_URL`, defaults to `http://localhost:8000`
- Automatic `snake_case` to `camelCase` key transformation on JSON responses
- `DATA_KEYS` set (`rows`, `columns`, `data`, `config`) -- values inside these keys are NOT transformed (preserves DB column names)
- 204 responses return `undefined`
- Non-2xx responses throw `ApiError` with structured fields

**Exported API object:**
```typescript
export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
```

## Python / FastAPI Conventions

**All route handlers are `async def`.** Services use `async` methods for I/O operations.

**Service layer pattern:**
- Route handlers in `backend/app/api/` -- thin, validate input, call service, return response
- Services in `backend/app/services/` -- business logic, external API calls, DB queries
- No direct DB/HTTP calls in route handlers (except simple SQLAlchemy queries for CRUD)

**Dependency injection via `Annotated[Type, Depends(factory)]`:**
```python
DbSessionDep = Annotated[AsyncSession, Depends(get_db_session)]
QueryEngineDep = Annotated[QueryEngine, Depends(get_query_engine)]
ConfigStoreDep = Annotated[ConfigStore, Depends(get_config_store)]
```

**Pydantic v2 models:**
- Base class `CamelModel` in `backend/app/models/base.py` auto-generates camelCase aliases via `alias_generator = to_camel`
- All request/response models inherit `CamelModel`
- Field validation via `Field(min_length=1, max_length=256)` etc.
- `from __future__ import annotations` at top of every Python file

**Router organization:**
- Each entity has its own router file in `backend/app/api/` (e.g., `managed_dashboards.py`, `managed_charts.py`)
- Routers use `prefix="/api/..."` and `tags=[...]`
- Aggregated in `backend/app/api/router.py` via `api_router.include_router()`

**Private helper convention:** Underscore prefix + section comment dividers:
```python
# ── Helpers ─────────────────────────────────────────────────────

def _to_response(dashboard: RecvizDashboard) -> DashboardResponse:
    """Convert a SQLAlchemy model to a Pydantic response."""
    ...

# ── Endpoints ───────────────────────────────────────────────────
```

## Shadcn/ui Rules

- Style: `new-york` (from `frontend/components.json`)
- Base color: `neutral`
- CSS variables enabled
- Icon library: Lucide React
- Use `cn()` from `frontend/src/lib/utils.ts` for class merging (`clsx` + `tailwind-merge`)
- Extend Shadcn via composition, not modification of base `ui/` files
- Domain components compose Shadcn primitives (e.g., `ConfigFilterBar` composes `Select`, `Popover`, `Command`, `Button`)

## Tailwind CSS Rules

- Shadcn CSS variable theming in `frontend/src/index.css`
- Colors ONLY via Shadcn CSS variables: `text-foreground`, `bg-background`, `text-muted-foreground`, `bg-muted`, `border`, `bg-primary`
- NEVER hardcode hex/rgb/hsl values
- Status colors: `text-green-600 dark:text-green-400` (positive), `text-red-600 dark:text-red-400` (negative)
- Chart colors: `--color-chart-1` through `--color-chart-5`
- Dark mode: `dark` class on `<html>` via `@custom-variant dark (&:is(.dark *));`
- Every component MUST include `dark:` variants
- Desktop-first. No mobile/tablet responsive design.

## Spacing and Typography

- Page padding: `p-6` (each page owns its padding)
- Section gaps: `space-y-6` between major sections
- Card padding: Shadcn defaults (not overridden)
- Grid gaps: `gap-3` for KPI rows, `gap-4` for chart grids
- Page title: `text-2xl font-semibold tracking-tight`
- Section title: `text-lg font-medium`
- Body: `text-sm` (14px default)
- Caption/label: `text-xs text-muted-foreground`
- Monospace: `font-mono text-sm`

---

*Convention analysis: 2026-04-09*
