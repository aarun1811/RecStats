# Coding Conventions

**Analysis Date:** 2026-04-04

## Naming Patterns

**Files (Frontend):**
- Components: `kebab-case.tsx` (e.g., `kpi-card.tsx`, `config-filter-bar.tsx`, `ag-chart-wrapper.tsx`)
- Hooks: `use-{name}.ts` (e.g., `use-chart-data.ts`, `use-dashboard-config.ts`, `use-cross-filter.ts`)
- Stores: `{name}-store.ts` (e.g., `filter-store.ts`, `drill-store.ts`)
- Types: `{name}.ts` in `types/` (e.g., `chart.ts`, `filter.ts`, `dashboard-config.ts`)
- Utils/lib: `kebab-case.ts` (e.g., `api-client.ts`, `chart-themes.ts`, `cross-filter.ts`)
- Pages/routes: `index.tsx` for directory indices, `$paramName.tsx` for dynamic params (e.g., `$dashboardId.tsx`)

**Files (Backend):**
- All Python files use `snake_case.py` (e.g., `superset_client.py`, `config_store.py`, `query_engine.py`)
- Test files: `test_{module}.py` in `backend/tests/` (e.g., `test_config_store.py`, `test_query_engine.py`)

**Functions (Frontend):**
- React components: `PascalCase` (e.g., `KpiCard`, `ConfigFilterBar`, `AgChartWrapper`)
- Hooks: `useCamelCase` (e.g., `useChartData`, `useDashboardConfig`, `useCrossFilter`)
- Utility functions: `camelCase` (e.g., `applyCrossFilters`, `rowPassesCrossFilters`, `formatDates`)

**Functions (Backend):**
- All functions and methods: `snake_case` (e.g., `list_dashboards`, `get_chart_data`, `_build_sql`)
- Private/internal methods: prefixed with underscore `_` (e.g., `_build_sql`, `_resolve_database`, `_load_configs`)

**Variables (Frontend):**
- `camelCase` for all variables and properties
- Constants: `UPPER_SNAKE_CASE` for module-level constants (e.g., `ECHART_TYPES`, `DEFAULT_COL_DEF`, `PAGE_SIZE`)

**Variables (Backend):**
- `snake_case` for variables and function parameters
- Module constants: `UPPER_SNAKE_CASE` (e.g., `DEFAULT_MAX_ROWS`, `TOKEN_REFRESH_BUFFER`, `CHART_DATASOURCE_MAP`)

**Types/Interfaces (Frontend):**
- Props interfaces: `{ComponentName}Props` defined above the component (e.g., `KpiCardProps`, `ConfigFilterBarProps`)
- Type aliases: `PascalCase` (e.g., `ChartType`, `FilterValue`, `ChartClickEvent`)
- Use `interface` for object shapes, `type` for unions and aliases

**Models (Backend):**
- Pydantic models: `PascalCase` (e.g., `DashboardConfig`, `DataSourceConfig`, `FilterConfig`)
- Request/response models defined either in `app/models/` or inline in route files

## Code Style

**Formatting (Frontend):**
- No Prettier config detected. Code style enforced via ESLint + TypeScript strict mode
- Single quotes for strings (consistent throughout codebase)
- Trailing commas in multi-line arrays/objects
- No semicolons (appears to be the convention based on all source files)
- 2-space indentation (TypeScript/TSX files)

**Formatting (Backend):**
- No explicit formatter config (no `pyproject.toml`, no Black/Ruff config)
- 4-space indentation (Python standard)
- Double quotes for strings (Python convention)
- Type hints used extensively via `from __future__ import annotations`

**Linting (Frontend):**
- ESLint 9 with flat config at `frontend/eslint.config.js`
- Plugins: `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- Uses `js.configs.recommended` + `tseslint.configs.recommended` + `reactHooks.configs.flat.recommended`
- Run via: `pnpm lint`

**Linting (Backend):**
- No linter config detected. No flake8, ruff, or pylint configuration

**TypeScript:**
- Strict mode enabled in `frontend/tsconfig.app.json`: `"strict": true`
- Additional strict checks: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports`
- `verbatimModuleSyntax` enabled (requires `type` keyword for type-only imports)
- Target: ES2022, module: ESNext, JSX: react-jsx
- Path alias: `@/*` maps to `./src/*`

## Import Organization

**Order (Frontend):**
1. React imports (`import { useState, useEffect, useMemo } from 'react'`)
2. External libraries (`import { useQuery } from '@tanstack/react-query'`, `import { motion } from 'motion/react'`)
3. Internal absolute imports via `@/` alias (`import { api } from '@/lib/api-client'`)
4. Relative imports (`import { NavMain } from './nav-main'`)
5. Type-only imports use `import type { ... }` syntax (required by `verbatimModuleSyntax`)

Blank lines separate groups. Example from `frontend/src/components/dashboard/config-filter-bar.tsx`:
```tsx
import { useEffect, useMemo, useState } from 'react'
import { ChevronsUpDown, Lock, RotateCcw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
// ... more @/ imports

import { useFilterOptions } from '@/hooks/use-filter-options'
import { useFilterStore } from '@/stores/filter-store'
import { cn } from '@/lib/utils'
import type { FilterConfig } from '@/types/dashboard-config'
import type { FilterValue } from '@/types/filter'
```

**Order (Backend):**
1. `from __future__ import annotations` (always first when present)
2. Standard library imports
3. Third-party imports (`fastapi`, `pydantic`, `httpx`)
4. Internal imports (`from app.services...`, `from app.models...`, `from app.core...`)

**Path Aliases:**
- Frontend: `@/*` resolves to `frontend/src/*` (configured in `tsconfig.json` and `vite.config.ts`)
- Backend: Uses relative Python imports from `app.` root (e.g., `from app.services.config_store import ConfigStore`)

## Component Patterns

**Functional components only.** The sole exception is `ErrorBoundary` at `frontend/src/components/shared/error-boundary.tsx` (React class component required for error boundary API).

**Named exports** for all components, hooks, stores, and utilities. The exception: `App.tsx` uses `export default` and page components use unnamed local functions with TanStack Router's `createFileRoute`.

**Props interface above component:**
```tsx
// Pattern from frontend/src/components/dashboard/kpi-card.tsx
interface KpiCardProps {
  title: string
  value: number
  icon: LucideIcon
  format?: 'number' | 'currency' | 'percent' | 'decimal'
  trend?: { value: number; isPositive: boolean }
}

export function KpiCard({ title, value, icon: Icon, format = 'number', trend }: KpiCardProps) {
  // ...
}
```

**Skeleton loading companion components** are co-located in the same file:
```tsx
// Pattern from frontend/src/components/dashboard/kpi-card.tsx
export function KpiCardSkeleton() {
  return (
    <Card>
      <Skeleton className="h-8 w-32" />
    </Card>
  )
}
```

**Helper components** used by only one parent live in the same file (e.g., `FilterControl`, `SingleSelectFilter`, `MultiSelectFilter` in `config-filter-bar.tsx`). These are NOT exported.

**No barrel exports** except `frontend/src/types/index.ts` which re-exports all type modules. This is the only barrel file.

## State Management Patterns

**Zustand stores** at `frontend/src/stores/`:
- `filter-store.ts`: Global filter values, locked filters, applied filters, cross-filters
- `drill-store.ts`: Drill-down state (source chart, breadcrumb levels)
- Stores hold state + simple setters. No business logic in stores.
- Use selectors to avoid re-renders:
```tsx
// Pattern: select individual pieces, not the whole store
const values = useFilterStore((s) => s.values)
const setFilterValue = useFilterStore((s) => s.setFilterValue)
```

**TanStack Query** for all server state:
- Custom hooks in `frontend/src/hooks/` wrap `useQuery` / `useMutation`
- Query key convention: `['entity', identifier, filters]` (e.g., `['chart-data', chartId, globalFilters]`)
- Global defaults in `frontend/src/lib/query-client.ts`: `staleTime: 5min`, `gcTime: 30min`, `retry: 1`, `refetchOnWindowFocus: false`
- Use `keepPreviousData` / `placeholderData` for smooth filter transitions

**Never store fetched data in Zustand.** Server data lives exclusively in TanStack Query cache.

## API Client Pattern

**Single API client** at `frontend/src/lib/api-client.ts`:
- Uses native `fetch` (no axios)
- Generic typed methods: `api.get<T>()`, `api.post<T>()`, `api.put<T>()`, `api.delete<T>()`
- Custom `ApiError` class with `status` and `body` properties
- Auto-transforms snake_case response keys to camelCase (except data keys like `rows`, `columns`)
- Base URL from `import.meta.env.VITE_API_BASE_URL`, fallback `http://localhost:8000`
- Throws on non-2xx responses. TanStack Query handles errors.

## Error Handling

**Frontend Patterns:**
- `ErrorBoundary` class component at `frontend/src/components/shared/error-boundary.tsx` wraps the main app layout
- Chart wrappers show inline error states with retry buttons (see `frontend/src/components/charts/ag-chart-wrapper.tsx`)
- API client throws `ApiError` on non-2xx; TanStack Query catches and surfaces via `error` property
- Route-level errors handled by TanStack Router's `errorComponent`
- Loading states: Skeleton components for every data component. Never show blank screens.
- Empty states: "No data available" inline messages

**Backend Patterns:**
- `HTTPException` raised in route handlers for known errors (404 not found, 400 bad request)
- `ValueError` raised in service layer, caught by route handlers and converted to `HTTPException`
- Superset client: auto-retries on 401 (re-authenticates), raises `httpx` errors for other failures
- Some endpoints silently fall through to mock data on Superset errors (e.g., `charts.py`, `sql.py`)
- `try/except Exception: pass` pattern used for Superset fallback (broad catch, silent fail)

## Backend Architecture Patterns

**Service layer pattern:**
- Route handlers are thin: validate input, call service, return response
- Services live in `backend/app/services/`: `SupersetClient`, `ConfigStore`, `QueryEngine`, `DatabaseRegistrar`, `MergeEngine`
- Dependency injection via FastAPI `Depends()` with typed aliases at `backend/app/core/dependencies.py`:
```python
SupersetDep = Annotated[SupersetClient | None, Depends(get_superset_client)]
ConfigStoreDep = Annotated[ConfigStore, Depends(get_config_store)]
QueryEngineDep = Annotated[QueryEngine, Depends(get_query_engine)]
```

**Pydantic v2 models:**
- All request/response bodies use Pydantic models
- `CamelModel` base class at `backend/app/models/base.py` with `alias_generator = to_camel` for JSON camelCase serialization
- Some route handlers define inline request/response models (e.g., `KpiRequest`, `KpiResponse` in `dashboards.py`)
- Config models at `backend/app/models/dashboard_config.py` and `backend/app/models/data_source_config.py`

**Async everywhere:**
- All route handlers are `async def`
- `httpx.AsyncClient` for Superset HTTP calls
- Shared HTTP client created in lifespan, stored on `app.state`

**Router organization:**
- Each feature has its own router module in `backend/app/api/`
- All routers aggregated in `backend/app/api/router.py`
- URL prefix pattern: `/api/{resource}` (e.g., `/api/dashboards`, `/api/data-sources`, `/api/sql`)
- Tags match resource names for OpenAPI docs

## Routing Patterns (Frontend)

**TanStack Router file-based routing** at `frontend/src/routes/`:
- Root route: `__root.tsx` (providers: ThemeProvider, QueryClientProvider, Toaster)
- Layout route: `_app.tsx` (sidebar, header, error boundary, page transitions)
- Page routes: `_app/dashboards/index.tsx`, `_app/explorer/index.tsx`, etc.
- Dynamic routes: `$dashboardId.tsx` for parameterized pages
- Root redirect: `/` redirects to `/dashboards`
- Route tree auto-generated in `frontend/src/routeTree.gen.ts` (do not edit manually)

**Page component pattern:**
```tsx
export const Route = createFileRoute('/_app/dashboards/$dashboardId')({
  component: DashboardPage,
})

function DashboardPage() {
  const { dashboardId } = Route.useParams()
  // ... render with skeleton loading, error states
}
```

## Tailwind CSS & Styling

**Tailwind CSS 4** with Shadcn's CSS variable theming system:
- CSS variables defined in `frontend/src/index.css` using `oklch` color space
- Both light (`:root`) and dark (`.dark`) themes defined
- Dark mode via class strategy: `.dark` on `<html>` element
- Use only Shadcn semantic color classes: `text-foreground`, `bg-background`, `text-muted-foreground`, `bg-muted`, `border`, etc.
- Status colors: `text-green-600 dark:text-green-400` for positive, `text-red-600 dark:text-red-400` for negative

**Utility `cn()`** from `frontend/src/lib/utils.ts` for merging Tailwind classes (uses `clsx` + `tailwind-merge`).

**Spacing conventions:**
- Page padding: `p-6`
- Section gaps: `gap-4` to `gap-6`
- Card padding: Shadcn Card defaults

**Micro-interactions** defined in `frontend/src/index.css`:
- Card hover: subtle lift (`translateY(-1px)`) + shadow (`box-shadow: 0 4px 12px`)
- Smooth focus transitions on interactive elements
- Page transitions: 200ms ease-out fade+slide via `motion/react` (see `frontend/src/components/shared/page-transition.tsx`)

**Font:** Inter loaded via CSS `font-family: "Inter", system-ui, sans-serif`

## Chart Conventions

**AG Charts (primary):** All standard chart types - bar, line, area, pie, donut, scatter, histogram, waterfall, combo, stacked-bar
- Wrapper: `frontend/src/components/charts/ag-chart-wrapper.tsx`
- Theme reads CSS variables, updates on theme toggle

**ECharts (exotic only):** sankey, radar, sunburst, gauge, funnel, graph, parallel
- Wrapper: `frontend/src/components/charts/echart-wrapper.tsx`
- Factory: `frontend/src/components/charts/chart-factory.tsx` routes to correct wrapper based on `vizType`

**Chart themes** at `frontend/src/lib/chart-themes.ts`:
- `getAgChartsTheme()` and `getEChartsTheme()` read Shadcn CSS variables from DOM
- Series palette: 10 distinct colors starting with primary

## Logging

**Frontend:** `console.error` only (in ErrorBoundary's `componentDidCatch`)

**Backend:**
- Python `logging` module with `basicConfig(level=logging.INFO)` in `backend/app/main.py`
- Logger per module: `logger = logging.getLogger(__name__)`
- `logger.info()` for startup events, `logger.warning()` for recoverable errors

## Comments

**When to comment:**
- JSDoc-style `/** ... */` comments on exported utility functions explaining purpose and behavior
- Section separators using `// ----` comment lines in large files (see `config-filter-bar.tsx`)
- Inline comments explaining non-obvious behavior (e.g., key transform skip logic in `api-client.ts`)

**Python docstrings:**
- Module-level docstrings in service files (e.g., `"""Async Superset API client with auto-authentication and retry on 401."""`)
- Method docstrings for complex methods (e.g., `_build_sql`, `resolve`)
- Comments using `# ── Section ──` style in `superset_client.py`

## Module Design

**Exports:** Named exports only. No default exports except `App.tsx` and the `CountAnimation` component (which has both named and default).

**Barrel Files:** Only `frontend/src/types/index.ts` acts as a barrel, re-exporting with `export type * from './...'`. No other barrel files exist. Import directly from the file.

---

*Convention analysis: 2026-04-04*
