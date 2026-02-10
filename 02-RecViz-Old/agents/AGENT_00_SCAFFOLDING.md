# Agent 00 — Project Scaffolding

## Mission

Set up the complete RecViz project from scratch. Create both frontend and backend project structures, install all dependencies, configure all build tools, and create every foundational file so that subsequent agents can immediately start writing feature code.

**You are the first agent.** Nothing exists yet. You create everything.

## Prerequisites

- Read `CLAUDE.md` in the project root (`/Users/aarun/Workspace/Projects/RecStats/02-RecViz/CLAUDE.md`) first. It defines all conventions you must follow.
- Read `RECVIZ_PLAN.md` in the project root for full architecture context.

## Working Directory

All work happens inside: `/Users/aarun/Workspace/Projects/RecStats/02-RecViz/recviz/`

Create the `recviz/` directory as the monorepo root.

---

## Part 1: Frontend Scaffolding

### 1.1 Initialize Vite + React + TypeScript

```bash
cd /Users/aarun/Workspace/Projects/RecStats/02-RecViz
npm create vite@latest recviz/frontend -- --template react-ts
cd recviz/frontend
npm install
```

### 1.2 Install Frontend Dependencies

**Core:**
```bash
npm install react@19 react-dom@19
npm install @tanstack/react-router @tanstack/react-query
npm install zustand
npm install framer-motion
npm install lucide-react
npm install date-fns
npm install clsx tailwind-merge class-variance-authority
```

**AG Grid & AG Charts (Enterprise):**
```bash
npm install ag-grid-community ag-grid-enterprise ag-grid-react
npm install ag-charts-community ag-charts-enterprise ag-charts-react
```

**ECharts (for exotic charts only):**
```bash
npm install echarts echarts-for-react
```

**Monaco Editor:**
```bash
npm install @monaco-editor/react
```

**Dev dependencies:**
```bash
npm install -D tailwindcss @tailwindcss/vite
npm install -D @tanstack/react-router-devtools @tanstack/react-query-devtools
npm install -D @types/react @types/react-dom
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
npm install -D eslint @eslint/js typescript-eslint eslint-plugin-react-hooks
npm install -D prettier prettier-plugin-tailwindcss
```

### 1.3 Configure Tailwind CSS 4

Tailwind v4 uses the new CSS-first configuration. Update `src/index.css`:

```css
@import "tailwindcss";

/* === Shadcn/ui CSS Variable Theme === */
@theme inline {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-card: hsl(var(--card));
  --color-card-foreground: hsl(var(--card-foreground));
  --color-popover: hsl(var(--popover));
  --color-popover-foreground: hsl(var(--popover-foreground));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  --color-secondary: hsl(var(--secondary));
  --color-secondary-foreground: hsl(var(--secondary-foreground));
  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));
  --color-accent: hsl(var(--accent));
  --color-accent-foreground: hsl(var(--accent-foreground));
  --color-destructive: hsl(var(--destructive));
  --color-destructive-foreground: hsl(var(--destructive-foreground));
  --color-border: hsl(var(--border));
  --color-input: hsl(var(--input));
  --color-ring: hsl(var(--ring));
  --color-chart-1: hsl(var(--chart-1));
  --color-chart-2: hsl(var(--chart-2));
  --color-chart-3: hsl(var(--chart-3));
  --color-chart-4: hsl(var(--chart-4));
  --color-chart-5: hsl(var(--chart-5));
  --color-sidebar-background: hsl(var(--sidebar-background));
  --color-sidebar-foreground: hsl(var(--sidebar-foreground));
  --color-sidebar-primary: hsl(var(--sidebar-primary));
  --color-sidebar-primary-foreground: hsl(var(--sidebar-primary-foreground));
  --color-sidebar-accent: hsl(var(--sidebar-accent));
  --color-sidebar-accent-foreground: hsl(var(--sidebar-accent-foreground));
  --color-sidebar-border: hsl(var(--sidebar-border));
  --color-sidebar-ring: hsl(var(--sidebar-ring));
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

/* Light theme variables */
:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --card: 0 0% 100%;
  --card-foreground: 240 10% 3.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 240 10% 3.9%;
  --primary: 240 5.9% 10%;
  --primary-foreground: 0 0% 98%;
  --secondary: 240 4.8% 95.9%;
  --secondary-foreground: 240 5.9% 10%;
  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;
  --accent: 240 4.8% 95.9%;
  --accent-foreground: 240 5.9% 10%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 0 0% 98%;
  --border: 240 5.9% 90%;
  --input: 240 5.9% 90%;
  --ring: 240 5.9% 10%;
  --radius: 0.625rem;
  --chart-1: 220 70% 50%;
  --chart-2: 160 60% 45%;
  --chart-3: 30 80% 55%;
  --chart-4: 280 65% 60%;
  --chart-5: 340 75% 55%;
  --sidebar-background: 0 0% 98%;
  --sidebar-foreground: 240 5.3% 26.1%;
  --sidebar-primary: 240 5.9% 10%;
  --sidebar-primary-foreground: 0 0% 98%;
  --sidebar-accent: 240 4.8% 95.9%;
  --sidebar-accent-foreground: 240 5.9% 10%;
  --sidebar-border: 220 13% 91%;
  --sidebar-ring: 217.2 91.2% 59.8%;
}

/* Dark theme variables */
.dark {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  --card: 240 10% 3.9%;
  --card-foreground: 0 0% 98%;
  --popover: 240 10% 3.9%;
  --popover-foreground: 0 0% 98%;
  --primary: 0 0% 98%;
  --primary-foreground: 240 5.9% 10%;
  --secondary: 240 3.7% 15.9%;
  --secondary-foreground: 0 0% 98%;
  --muted: 240 3.7% 15.9%;
  --muted-foreground: 240 5% 64.9%;
  --accent: 240 3.7% 15.9%;
  --accent-foreground: 0 0% 98%;
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 0 0% 98%;
  --border: 240 3.7% 15.9%;
  --input: 240 3.7% 15.9%;
  --ring: 240 4.9% 83.9%;
  --chart-1: 220 70% 50%;
  --chart-2: 160 60% 45%;
  --chart-3: 30 80% 55%;
  --chart-4: 280 65% 60%;
  --chart-5: 340 75% 55%;
  --sidebar-background: 240 5.9% 10%;
  --sidebar-foreground: 240 4.8% 95.9%;
  --sidebar-primary: 224.3 76.3% 48%;
  --sidebar-primary-foreground: 0 0% 100%;
  --sidebar-accent: 240 3.7% 15.9%;
  --sidebar-accent-foreground: 240 4.8% 95.9%;
  --sidebar-border: 240 3.7% 15.9%;
  --sidebar-ring: 217.2 91.2% 59.8%;
}

/* Base styles */
@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-family: 'Inter', 'Geist', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}
```

Update `vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
```

Update `tsconfig.json` to add path alias:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src", "vite-env.d.ts"]
}
```

Also create `tsconfig.app.json` if Vite generated one - make sure it extends the base and includes the paths config.

### 1.4 Set Up Shadcn/ui

Initialize Shadcn:
```bash
npx shadcn@latest init
```

When prompted:
- Style: Default
- Base color: Neutral
- CSS variables: Yes

Then add ALL required components:
```bash
npx shadcn@latest add button card command dialog dropdown-menu input popover select separator sheet sidebar skeleton table tabs toast tooltip badge scroll-area collapsible breadcrumb calendar toggle toggle-group avatar label switch checkbox radio-group sonner
```

This populates `src/components/ui/` with owned component code.

### 1.5 Create Directory Structure

Create all directories under `frontend/src/`:

```
src/
├── components/
│   ├── ui/              ← (already created by shadcn)
│   ├── layout/
│   ├── dashboard/
│   ├── charts/
│   ├── grid/
│   │   └── cell-renderers/
│   ├── explorer/
│   └── shared/
├── pages/
│   ├── dashboard/
│   ├── explorer/
│   ├── reports/
│   └── settings/
├── hooks/
├── stores/
├── lib/
└── types/
```

### 1.6 Create Foundational Files

#### `src/lib/utils.ts`
```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100)
}
```

#### `src/lib/constants.ts`
```typescript
/** Chart color palette — matches CSS --chart-1 through --chart-5 */
export const CHART_COLORS = {
  primary: 'hsl(220, 70%, 50%)',
  secondary: 'hsl(160, 60%, 45%)',
  tertiary: 'hsl(30, 80%, 55%)',
  quaternary: 'hsl(280, 65%, 60%)',
  quinary: 'hsl(340, 75%, 55%)',
} as const

export const CHART_COLOR_ARRAY = Object.values(CHART_COLORS)

/** Default query/cache timing */
export const QUERY_STALE_TIME = 5 * 60 * 1000   // 5 minutes
export const QUERY_GC_TIME = 30 * 60 * 1000     // 30 minutes

/** Pagination */
export const DEFAULT_PAGE_SIZE = 500
export const GRID_PAGE_SIZE = 100

/** API */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

/** Breakpoints (desktop-first app, but useful for reference) */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const
```

#### `src/lib/api-client.ts`
```typescript
import { API_BASE_URL } from './constants'

class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: unknown,
  ) {
    super(`API Error ${status}: ${statusText}`)
    this.name = 'ApiError'
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ApiError(response.status, response.statusText, body)
  }

  return response.json()
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),

  post: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  put: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  delete: <T>(endpoint: string) =>
    request<T>(endpoint, { method: 'DELETE' }),
}

export { ApiError }
```

#### `src/types/filter.ts`
```typescript
export interface DateRange {
  from: Date
  to: Date
}

export interface GlobalFilters {
  dateRange: DateRange
  entities: string[]
  statuses: string[]
  desks: string[]
}

export interface CrossFilter {
  chartId: string
  field: string
  value: string | string[]
}

export interface DrillLevel {
  label: string
  filters: Record<string, unknown>
  granularity: 'month' | 'day' | 'category' | 'detail'
}

export interface DrillState {
  chartId: string
  levels: DrillLevel[]
  currentLevel: number
}
```

#### `src/types/chart.ts`
```typescript
export type ChartLibrary = 'ag-charts' | 'echarts'

export type AgChartType =
  | 'line' | 'bar' | 'area' | 'pie' | 'donut'
  | 'scatter' | 'bubble' | 'histogram' | 'heatmap'
  | 'treemap' | 'waterfall' | 'bullet' | 'box-plot'
  | 'range-bar' | 'range-area' | 'candlestick' | 'combo'

export type EChartType =
  | 'sankey' | 'sunburst' | 'radar' | 'graph'
  | 'gauge' | 'parallel' | 'funnel'

export type ChartType = AgChartType | EChartType

export interface ChartConfig {
  id: string
  title: string
  type: ChartType
  library: ChartLibrary
  datasetId?: number
  superset_chart_id?: number
  options: Record<string, unknown>
}

export interface ChartClickEvent {
  field: string
  value: string | number
  data: Record<string, unknown>
}

export interface ChartDataResponse {
  data: Record<string, unknown>[]
  columns: string[]
  rowCount: number
}
```

#### `src/types/dataset.ts`
```typescript
export interface DatasetColumn {
  name: string
  type: string
  isFilterable: boolean
  isGroupable: boolean
}

export interface Dataset {
  id: number
  name: string
  database: string
  schema: string
  tableName: string
  columns: DatasetColumn[]
}

export interface DatasetDataRequest {
  filters: Record<string, unknown>[]
  orderBy: { column: string; direction: 'asc' | 'desc' }[]
  offset: number
  limit: number
}

export interface DatasetDataResponse {
  data: Record<string, unknown>[]
  columns: string[]
  totalCount: number
  nextOffset: number | null
}
```

#### `src/types/api.ts`
```typescript
export interface ApiListResponse<T> {
  count: number
  result: T[]
}

export interface SqlExecuteRequest {
  databaseId: number
  sql: string
  schema?: string
  limit?: number
}

export interface SqlExecuteResponse {
  data: Record<string, unknown>[]
  columns: { name: string; type: string }[]
  query: {
    executionTime: number
    rowCount: number
  }
}

export interface ExportRequest {
  format: 'pdf' | 'excel'
  dashboardId: string
  filters: Record<string, unknown>
  options?: {
    title?: string
    includeCharts?: boolean
    includeGrid?: boolean
  }
}

export interface DashboardConfig {
  id: string
  title: string
  description?: string
  charts: import('./chart').ChartConfig[]
  crossFilterRules: CrossFilterRule[]
  layout: DashboardLayoutItem[]
}

export interface CrossFilterRule {
  sourceChartId: string
  sourceField: string
  targetChartIds: string[]  // ["*"] for all
  targetField: string
}

export interface DashboardLayoutItem {
  chartId: string
  row: number
  col: number
  width: number   // grid columns (out of 12)
  height: number  // grid rows
}
```

#### `src/stores/filter-store.ts`
```typescript
import { create } from 'zustand'
import type { GlobalFilters, CrossFilter } from '@/types/filter'

interface FilterState {
  globalFilters: GlobalFilters
  crossFilters: Record<string, CrossFilter>

  setGlobalFilter: <K extends keyof GlobalFilters>(
    key: K,
    value: GlobalFilters[K],
  ) => void
  setGlobalFilters: (filters: Partial<GlobalFilters>) => void
  resetGlobalFilters: () => void

  setCrossFilter: (chartId: string, field: string, value: string | string[]) => void
  removeCrossFilter: (chartId: string) => void
  clearCrossFilters: () => void
}

const defaultGlobalFilters: GlobalFilters = {
  dateRange: {
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  },
  entities: [],
  statuses: [],
  desks: [],
}

export const useFilterStore = create<FilterState>((set) => ({
  globalFilters: defaultGlobalFilters,
  crossFilters: {},

  setGlobalFilter: (key, value) =>
    set((state) => ({
      globalFilters: { ...state.globalFilters, [key]: value },
    })),

  setGlobalFilters: (filters) =>
    set((state) => ({
      globalFilters: { ...state.globalFilters, ...filters },
    })),

  resetGlobalFilters: () =>
    set({ globalFilters: defaultGlobalFilters, crossFilters: {} }),

  setCrossFilter: (chartId, field, value) =>
    set((state) => ({
      crossFilters: {
        ...state.crossFilters,
        [chartId]: { chartId, field, value },
      },
    })),

  removeCrossFilter: (chartId) =>
    set((state) => {
      const { [chartId]: _, ...rest } = state.crossFilters
      return { crossFilters: rest }
    }),

  clearCrossFilters: () => set({ crossFilters: {} }),
}))
```

#### `src/stores/drill-store.ts`
```typescript
import { create } from 'zustand'
import type { DrillLevel } from '@/types/filter'

interface DrillState {
  drills: Record<string, {
    levels: DrillLevel[]
    currentLevel: number
  }>

  drillDown: (chartId: string, level: DrillLevel) => void
  drillUp: (chartId: string) => void
  resetDrill: (chartId: string) => void
  resetAllDrills: () => void
}

export const useDrillStore = create<DrillState>((set) => ({
  drills: {},

  drillDown: (chartId, level) =>
    set((state) => {
      const current = state.drills[chartId] ?? { levels: [], currentLevel: -1 }
      const nextLevel = current.currentLevel + 1
      const levels = [...current.levels.slice(0, nextLevel), level]
      return {
        drills: {
          ...state.drills,
          [chartId]: { levels, currentLevel: nextLevel },
        },
      }
    }),

  drillUp: (chartId) =>
    set((state) => {
      const current = state.drills[chartId]
      if (!current || current.currentLevel <= 0) return state
      return {
        drills: {
          ...state.drills,
          [chartId]: { ...current, currentLevel: current.currentLevel - 1 },
        },
      }
    }),

  resetDrill: (chartId) =>
    set((state) => {
      const { [chartId]: _, ...rest } = state.drills
      return { drills: rest }
    }),

  resetAllDrills: () => set({ drills: {} }),
}))
```

#### `src/stores/theme-store.ts`
```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark' | 'system'
type Density = 'comfortable' | 'compact'

interface ThemeState {
  theme: Theme
  density: Density
  setTheme: (theme: Theme) => void
  setDensity: (density: Density) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      density: 'comfortable',
      setTheme: (theme) => set({ theme }),
      setDensity: (density) => set({ density }),
    }),
    { name: 'recviz-theme' },
  ),
)
```

#### `src/stores/sidebar-store.ts`
```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SidebarState {
  collapsed: boolean
  toggle: () => void
  setCollapsed: (collapsed: boolean) => void
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: false,
      toggle: () => set((state) => ({ collapsed: !state.collapsed })),
      setCollapsed: (collapsed) => set({ collapsed }),
    }),
    { name: 'recviz-sidebar' },
  ),
)
```

#### `src/app.tsx`
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { QUERY_STALE_TIME, QUERY_GC_TIME } from '@/lib/constants'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_STALE_TIME,
      gcTime: QUERY_GC_TIME,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* RouterProvider will be added by the frontend shell agent */}
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">RecViz — Shell loading...</p>
      </div>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

#### `src/main.tsx`
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

#### `src/lib/ag-grid-config.ts`
```typescript
import type { GridOptions } from 'ag-grid-community'

/** Shared AG Grid defaults for all grids in RecViz */
export const defaultGridOptions: GridOptions = {
  animateRows: true,
  rowSelection: { mode: 'multiRow' },
  suppressCellFocus: false,
  enableCellTextSelection: true,
  pagination: false,
  headerHeight: 36,
  rowHeight: 34,
  defaultColDef: {
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 80,
  },
}
```

#### `src/lib/ag-chart-themes.ts`
```typescript
/**
 * AG Charts theme that matches the Shadcn/ui design system.
 * Uses CSS variables so it auto-adapts to light/dark mode.
 */
export const recvizChartTheme = {
  baseTheme: 'ag-default' as const,
  palette: {
    fills: [
      'hsl(220, 70%, 50%)',
      'hsl(160, 60%, 45%)',
      'hsl(30, 80%, 55%)',
      'hsl(280, 65%, 60%)',
      'hsl(340, 75%, 55%)',
    ],
    strokes: [
      'hsl(220, 70%, 40%)',
      'hsl(160, 60%, 35%)',
      'hsl(30, 80%, 45%)',
      'hsl(280, 65%, 50%)',
      'hsl(340, 75%, 45%)',
    ],
  },
  overrides: {
    common: {
      title: {
        fontSize: 16,
        fontWeight: 600,
        fontFamily: 'Inter, Geist, system-ui, sans-serif',
      },
      subtitle: {
        fontSize: 13,
        fontFamily: 'Inter, Geist, system-ui, sans-serif',
      },
      legend: {
        item: {
          label: {
            fontSize: 12,
            fontFamily: 'Inter, Geist, system-ui, sans-serif',
          },
        },
      },
    },
  },
}

export const recvizChartThemeDark = {
  ...recvizChartTheme,
  baseTheme: 'ag-default-dark' as const,
}
```

#### `src/lib/filter-utils.ts`
```typescript
import type { GlobalFilters } from '@/types/filter'

/** Serialize global filters into Superset-compatible filter format */
export function toSupersetFilters(filters: GlobalFilters) {
  const result: { col: string; op: string; val: unknown }[] = []

  if (filters.dateRange.from && filters.dateRange.to) {
    result.push({
      col: 'date',
      op: 'BETWEEN',
      val: [
        filters.dateRange.from.toISOString().split('T')[0],
        filters.dateRange.to.toISOString().split('T')[0],
      ],
    })
  }

  if (filters.entities.length > 0) {
    result.push({ col: 'entity', op: 'IN', val: filters.entities })
  }

  if (filters.statuses.length > 0) {
    result.push({ col: 'status', op: 'IN', val: filters.statuses })
  }

  if (filters.desks.length > 0) {
    result.push({ col: 'desk', op: 'IN', val: filters.desks })
  }

  return result
}

/** Encode filters into URL search params for shareable links */
export function filtersToSearchParams(filters: GlobalFilters): URLSearchParams {
  const params = new URLSearchParams()
  params.set('from', filters.dateRange.from.toISOString())
  params.set('to', filters.dateRange.to.toISOString())
  if (filters.entities.length) params.set('entities', filters.entities.join(','))
  if (filters.statuses.length) params.set('statuses', filters.statuses.join(','))
  if (filters.desks.length) params.set('desks', filters.desks.join(','))
  return params
}

/** Decode URL search params back to filters */
export function searchParamsToFilters(params: URLSearchParams): Partial<GlobalFilters> {
  const filters: Partial<GlobalFilters> = {}

  const from = params.get('from')
  const to = params.get('to')
  if (from && to) {
    filters.dateRange = { from: new Date(from), to: new Date(to) }
  }

  const entities = params.get('entities')
  if (entities) filters.entities = entities.split(',')

  const statuses = params.get('statuses')
  if (statuses) filters.statuses = statuses.split(',')

  const desks = params.get('desks')
  if (desks) filters.desks = desks.split(',')

  return filters
}
```

#### `.env` and `.env.example`
```
VITE_API_BASE_URL=/api
```

#### `frontend/.prettierrc`
```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

---

## Part 2: Backend Scaffolding

### 2.1 Create Backend Project

```bash
cd /Users/aarun/Workspace/Projects/RecStats/02-RecViz/recviz
mkdir -p backend
cd backend
```

Create `pyproject.toml`:
```toml
[project]
name = "recviz-backend"
version = "0.1.0"
description = "RecViz Backend - FastAPI sidecar and Superset proxy"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.30.0",
    "httpx>=0.27.0",
    "pydantic>=2.0",
    "pydantic-settings>=2.0",
    "redis>=5.0",
    "celery>=5.3",
    "elasticsearch>=8.0",
    "openpyxl>=3.1",
    "weasyprint>=60.0",
    "python-multipart>=0.0.6",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.23",
    "httpx",
    "ruff>=0.3",
]

[tool.ruff]
target-version = "py312"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "N", "UP", "B", "A", "SIM"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

### 2.2 Create Backend Directory Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── api/
│   │   ├── __init__.py
│   │   ├── router.py
│   │   ├── charts.py
│   │   ├── datasets.py
│   │   ├── sql.py
│   │   ├── dashboards.py
│   │   ├── search.py
│   │   ├── custom.py
│   │   ├── export.py
│   │   └── views.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── superset_client.py
│   │   ├── elasticsearch.py
│   │   ├── export_service.py
│   │   ├── aggregation_service.py
│   │   └── cache.py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── filters.py
│   │   ├── chart_data.py
│   │   ├── dataset.py
│   │   ├── export.py
│   │   └── views.py
│   └── core/
│       ├── __init__.py
│       ├── dependencies.py
│       └── exceptions.py
├── tests/
│   ├── __init__.py
│   └── conftest.py
├── pyproject.toml
├── Dockerfile
└── requirements.txt
```

### 2.3 Create Backend Foundational Files

#### `app/__init__.py` — empty

#### `app/config.py`
```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    app_name: str = "RecViz Backend"
    debug: bool = False

    # Superset
    superset_url: str = "http://localhost:8088"
    superset_username: str = "admin"
    superset_password: str = "admin"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Elasticsearch
    elasticsearch_url: str = "http://localhost:9200"

    # CORS
    cors_origins: list[str] = ["http://localhost:5173"]

    model_config = {"env_prefix": "RECVIZ_", "env_file": ".env"}


settings = Settings()
```

#### `app/main.py`
```python
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create shared HTTP client for Superset
    app.state.superset_http = httpx.AsyncClient(
        base_url=settings.superset_url,
        timeout=30.0,
    )
    yield
    # Shutdown: close HTTP client
    await app.state.superset_http.aclose()


app = FastAPI(
    title=settings.app_name,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}
```

#### `app/api/router.py`
```python
from fastapi import APIRouter

from app.api import charts, custom, dashboards, datasets, export, search, sql, views

api_router = APIRouter()

api_router.include_router(charts.router, prefix="/charts", tags=["charts"])
api_router.include_router(datasets.router, prefix="/datasets", tags=["datasets"])
api_router.include_router(sql.router, prefix="/sql", tags=["sql"])
api_router.include_router(dashboards.router, prefix="/dashboards", tags=["dashboards"])
api_router.include_router(search.router, prefix="/search", tags=["search"])
api_router.include_router(custom.router, prefix="/custom", tags=["custom"])
api_router.include_router(export.router, prefix="/export", tags=["export"])
api_router.include_router(views.router, prefix="/views", tags=["views"])
```

#### Each `app/api/*.py` route file — create as stub:
```python
from fastapi import APIRouter

router = APIRouter()

# Endpoints will be implemented by the backend services agent
```

#### `app/services/__init__.py` — empty
#### `app/models/__init__.py` — empty
#### `app/core/__init__.py` — empty

#### `app/core/dependencies.py`
```python
from fastapi import Request

from app.services.superset_client import SupersetClient


async def get_superset_client(request: Request) -> SupersetClient:
    """FastAPI dependency that provides an authenticated Superset client."""
    http_client = request.app.state.superset_http
    client = SupersetClient(http_client)
    await client.ensure_authenticated()
    return client
```

#### `app/core/exceptions.py`
```python
from fastapi import Request
from fastapi.responses import JSONResponse


class SupersetError(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail


class SidecarError(Exception):
    def __init__(self, detail: str):
        self.detail = detail


async def superset_error_handler(request: Request, exc: SupersetError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": "superset_error", "detail": exc.detail},
    )


async def sidecar_error_handler(request: Request, exc: SidecarError):
    return JSONResponse(
        status_code=500,
        content={"error": "sidecar_error", "detail": exc.detail},
    )
```

#### `app/models/filters.py`
```python
from datetime import date

from pydantic import BaseModel


class DateRange(BaseModel):
    from_date: date
    to_date: date


class GlobalFilters(BaseModel):
    date_range: DateRange | None = None
    entities: list[str] = []
    statuses: list[str] = []
    desks: list[str] = []


class SupersetFilter(BaseModel):
    col: str
    op: str
    val: str | list[str] | list[date]
```

#### `app/services/superset_client.py` — stub:
```python
import httpx

from app.config import settings


class SupersetClient:
    """Async client wrapping Superset REST API."""

    def __init__(self, http_client: httpx.AsyncClient):
        self._client = http_client
        self._access_token: str | None = None

    async def ensure_authenticated(self) -> None:
        """Authenticate with Superset if not already authenticated."""
        if self._access_token:
            return
        response = await self._client.post(
            "/api/v1/security/login",
            json={
                "username": settings.superset_username,
                "password": settings.superset_password,
                "provider": "db",
            },
        )
        response.raise_for_status()
        self._access_token = response.json()["access_token"]

    @property
    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._access_token}"}

    # Methods will be fully implemented by the backend services agent
    async def get_chart_data(self, chart_id: int, filters: list[dict]) -> dict:
        """POST /api/v1/chart/data — fetch chart data with filters."""
        raise NotImplementedError

    async def execute_sql(self, database_id: int, sql: str, limit: int = 1000) -> dict:
        """POST /api/v1/sqllab/execute/ — execute ad-hoc SQL."""
        raise NotImplementedError

    async def list_datasets(self) -> list[dict]:
        """GET /api/v1/dataset/ — list available datasets."""
        raise NotImplementedError

    async def get_dataset(self, dataset_id: int) -> dict:
        """GET /api/v1/dataset/{id} — get dataset details."""
        raise NotImplementedError
```

#### `tests/conftest.py`
```python
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)
```

#### `backend/Dockerfile`
```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ app/

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Generate `requirements.txt` from pyproject.toml after creating it:
```bash
pip install pip-tools 2>/dev/null || true
# Or just manually list deps in requirements.txt matching pyproject.toml
```

---

## Part 3: Infrastructure Scaffolding

### 3.1 Directory Structure

```
recviz/
├── infrastructure/
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   ├── nginx/
│   │   └── nginx.conf
│   ├── redis/
│   │   └── redis.conf
│   └── scripts/
│       ├── setup-dev.sh
│       └── seed-data.sh
├── superset/
│   ├── superset_config.py
│   ├── requirements-superset.txt
│   └── init_superset.sh
```

### 3.2 Create `infrastructure/docker-compose.yml`
```yaml
services:
  frontend:
    build: ../frontend
    ports:
      - "5173:5173"
    volumes:
      - ../frontend/src:/app/src
    environment:
      - VITE_API_BASE_URL=/api

  backend:
    build: ../backend
    ports:
      - "8000:8000"
    environment:
      - RECVIZ_SUPERSET_URL=http://superset:8088
      - RECVIZ_REDIS_URL=redis://redis:6379/0
      - RECVIZ_ELASTICSEARCH_URL=http://elasticsearch:9200
    depends_on:
      - superset
      - redis

  superset:
    build:
      context: ..
      dockerfile: superset/Dockerfile
    ports:
      - "8088:8088"
    environment:
      - SUPERSET_CONFIG_PATH=/app/superset_config.py
    depends_on:
      - redis
      - postgres

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=superset_meta
      - POSTGRES_USER=recviz
      - POSTGRES_PASSWORD=recviz_dev
    volumes:
      - pgdata:/var/lib/postgresql/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - frontend
      - backend
      - superset

volumes:
  pgdata:
  redis-data:
```

### 3.3 Create `infrastructure/nginx/nginx.conf`
```nginx
events {
    worker_connections 1024;
}

http {
    upstream frontend {
        server frontend:5173;
    }

    upstream backend {
        server backend:8000;
    }

    upstream superset {
        server superset:8088;
    }

    server {
        listen 80;

        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
        }

        # RecViz Backend API
        location /api/ {
            proxy_pass http://backend/api/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        # Superset API (proxied through backend, not exposed directly)
        # This route is for internal/admin use only
        location /superset-api/ {
            proxy_pass http://superset/api/v1/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
```

### 3.4 Create `superset/superset_config.py`
```python
import os

SECRET_KEY = os.environ.get("SUPERSET_SECRET_KEY", "recviz-dev-secret-key-change-in-prod")

SQLALCHEMY_DATABASE_URI = os.environ.get(
    "SUPERSET_METADATA_DB",
    "postgresql://recviz:recviz_dev@postgres:5432/superset_meta",
)

CACHE_CONFIG = {
    "CACHE_TYPE": "redis",
    "CACHE_DEFAULT_TIMEOUT": 300,
    "CACHE_KEY_PREFIX": "recviz_",
    "CACHE_REDIS_URL": os.environ.get("REDIS_URL", "redis://redis:6379/0"),
}

DATA_CACHE_CONFIG = {
    "CACHE_TYPE": "redis",
    "CACHE_DEFAULT_TIMEOUT": 600,
    "CACHE_KEY_PREFIX": "recviz_data_",
    "CACHE_REDIS_URL": os.environ.get("REDIS_URL", "redis://redis:6379/1"),
}

FEATURE_FLAGS = {
    "ENABLE_TEMPLATE_PROCESSING": True,
}


class CeleryConfig:
    broker_url = os.environ.get("REDIS_URL", "redis://redis:6379/2")
    result_backend = os.environ.get("REDIS_URL", "redis://redis:6379/3")


CELERY_CONFIG = CeleryConfig

ENABLE_CORS = True
CORS_OPTIONS = {
    "supports_credentials": True,
    "allow_headers": ["*"],
    "resources": ["/api/*"],
    "origins": ["http://localhost:5173", "http://localhost:80"],
}
```

### 3.5 Create Root `Makefile`

Create at `recviz/Makefile`:
```makefile
.PHONY: dev frontend backend superset test test-fe test-be lint build seed

dev:
	docker compose -f infrastructure/docker-compose.yml up -d redis postgres
	@echo "Starting frontend..."
	cd frontend && npm run dev &
	@echo "Starting backend..."
	cd backend && uvicorn app.main:app --reload --port 8000 &

frontend:
	cd frontend && npm run dev

backend:
	cd backend && uvicorn app.main:app --reload --port 8000

superset:
	superset run -h 0.0.0.0 -p 8088

test: test-fe test-be

test-fe:
	cd frontend && npm run test

test-be:
	cd backend && pytest

lint:
	cd frontend && npm run lint
	cd backend && ruff check .

build:
	cd frontend && npm run build
	docker compose -f infrastructure/docker-compose.yml build

seed:
	bash infrastructure/scripts/seed-data.sh
```

### 3.6 Create Root `.gitignore`

At `recviz/.gitignore`:
```
# Dependencies
node_modules/
__pycache__/
*.pyc
.venv/
venv/

# Build
dist/
build/
*.egg-info/

# Environment
.env
.env.local
.env.production

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Data
*.sqlite
pgdata/
redis-data/
```

---

## Verification Checklist

After completing all steps, verify:

1. **Frontend starts:** `cd frontend && npm run dev` → opens on http://localhost:5173 without errors
2. **TypeScript compiles:** `cd frontend && npx tsc --noEmit` → no errors
3. **Backend starts:** `cd backend && pip install -e ".[dev]" && uvicorn app.main:app --reload` → opens on http://localhost:8000
4. **Health check:** `curl http://localhost:8000/health` → `{"status": "ok"}`
5. **All directories exist** as specified above
6. **All files exist** as specified above
7. **Shadcn components installed:** `ls frontend/src/components/ui/` shows all listed components
8. **Imports resolve:** The `@/` path alias works in TypeScript files

---

## What NOT To Do

- Do NOT write any feature components (dashboard, charts, grid, explorer). Those are for other agents.
- Do NOT implement Superset client methods beyond the stub. That's for the backend services agent.
- Do NOT implement route handler logic beyond the stub. That's for the backend core agent.
- Do NOT set up TanStack Router routes/pages. That's for the frontend shell agent.
- Do NOT create any page content. Just the project structure and foundational code.
- Do NOT install AG Grid or AG Charts license keys. We'll handle that separately.
