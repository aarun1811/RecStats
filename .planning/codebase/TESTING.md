# Testing Patterns

**Analysis Date:** 2026-04-05

## Test Frameworks

### Frontend Unit Tests

**Runner:**
- Vitest 4.1.2
- Config: `frontend/vitest.config.ts`
- Default environment: `node` (override per-file with `// @vitest-environment jsdom`)

**Assertion Library:**
- Vitest built-in (`expect`, `describe`, `it`)
- `@testing-library/jest-dom` 6.9.1 (for DOM assertions)
- `@testing-library/react` 16.3.2 (for component rendering)

**Run Commands:**
```bash
cd frontend && npx vitest          # Run all tests (watch mode)
cd frontend && npx vitest run      # Run all tests once
cd frontend && npx vitest run --coverage  # With coverage (if configured)
```

Note: No `test` script defined in `package.json`. Run vitest directly via npx.

### Frontend E2E Tests

**Runner:**
- Playwright 1.59.1
- Config: `frontend/playwright.config.ts`
- Test directory: `frontend/e2e/`

**Run Commands:**
```bash
cd frontend && npx playwright test --reporter=list   # Run all E2E tests
cd frontend && npx playwright test --ui               # Interactive mode
```

**Prerequisites:** Full stack must be running (Docker Compose + Superset + FastAPI + Frontend dev server).

### Backend Tests

**Runner:**
- pytest (from `requirements.txt`)
- pytest-asyncio (for async test functions)
- No config file detected (no `pytest.ini`, `pyproject.toml`, `conftest.py`)

**Run Commands:**
```bash
cd backend && python -m pytest tests/ -v    # Run all backend tests
cd backend && python -m pytest tests/test_query_engine.py -v  # Run specific file
```

## Test File Organization

### Frontend Unit Tests

**Location:** Co-located with source files (test file sits next to the module it tests).

**Naming:** `{module-name}.test.ts` or `{component-name}.test.tsx`

**Structure:**
```
frontend/src/
├── lib/
│   ├── formatters.ts
│   ├── formatters.test.ts          # Tests for formatters
│   ├── cross-filter.ts
│   ├── cross-filter.test.ts        # Tests for cross-filter logic
│   ├── kpi-aggregator.ts
│   ├── kpi-aggregator.test.ts      # Tests for KPI aggregation
│   ├── chart-export.ts
│   └── chart-export.test.ts        # Tests for export utilities
├── stores/
│   ├── filter-store.ts
│   ├── filter-store.test.ts        # Tests for filter store
│   ├── drill-store.ts
│   └── drill-store.test.ts         # Tests for drill store
├── hooks/
│   ├── use-auto-refresh.ts
│   └── use-auto-refresh.test.ts    # Tests for auto-refresh hook
└── components/
    ├── charts/
    │   ├── ag-chart-wrapper.tsx
    │   ├── ag-chart-wrapper.test.ts  # Tests for buildSeries logic
    │   ├── chart-factory.tsx
    │   └── chart-factory.test.tsx    # Tests for chart routing
    └── dashboard/
        ├── grid-toolbar.tsx
        └── grid-toolbar.test.tsx     # Tests for toolbar UI
```

### Frontend E2E Tests

**Location:** Separate `frontend/e2e/` directory.

**Naming:** `{feature-name}.spec.ts`

**Files:**
- `frontend/e2e/chart-showcase.spec.ts` -- Chart rendering validation, cross-filter, drill-down
- `frontend/e2e/tlm-stats-regression.spec.ts` -- Regression tests for production dashboard

### Backend Tests

**Location:** Separate `backend/tests/` directory.

**Naming:** `test_{module}.py`

**Files:**
- `backend/tests/test_config_store.py` -- Config store CRUD
- `backend/tests/test_database_registrar.py` -- Database sync/resolve
- `backend/tests/test_merge_engine.py` -- Data merging logic
- `backend/tests/test_query_engine.py` -- SQL building, dialect handling, filter injection

## Test Structure

### Vitest Unit Test Pattern

**Pure logic tests (no DOM):**
```typescript
import { describe, it, expect } from 'vitest'
import { applyCrossFilters, rowPassesCrossFilters } from './cross-filter'
import type { CrossFilter } from '@/types/filter'
import type { ChartDataResponse } from '@/types/chart'

describe('applyCrossFilters', () => {
  // Helper factory at top of describe block
  const makeData = (rows: Record<string, unknown>[]): ChartDataResponse => ({
    chartId: 'test',
    columns: Object.keys(rows[0] ?? {}),
    data: rows,
    rowCount: rows.length,
  })

  it('filters rows where column matches', () => {
    const data = makeData([
      { region: 'APAC', count: 10 },
      { region: 'EMEA', count: 20 },
    ])
    const filters: CrossFilter[] = [
      { sourceChartId: 'chart-a', column: 'region', value: 'APAC' },
    ]
    const result = applyCrossFilters(data, filters, 'chart-b')
    expect(result?.data).toHaveLength(1)
    expect(result?.data.every((r) => r.region === 'APAC')).toBe(true)
  })
})
```

**Zustand store tests:**
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useFilterStore } from './filter-store'

describe('filter-store crossFilters', () => {
  beforeEach(() => {
    // Reset store state before each test
    useFilterStore.setState({
      crossFilters: [],
      values: {},
      locked: new Set<string>(),
      applied: {},
    })
  })

  describe('addCrossFilter', () => {
    it('toggles: same sourceChartId+column+value removes the filter', () => {
      const { addCrossFilter } = useFilterStore.getState()
      addCrossFilter({ sourceChartId: 'chart-a', column: 'region', value: 'APAC' })
      expect(useFilterStore.getState().crossFilters).toHaveLength(1)
      // Same filter again -- toggles off
      addCrossFilter({ sourceChartId: 'chart-a', column: 'region', value: 'APAC' })
      expect(useFilterStore.getState().crossFilters).toHaveLength(0)
    })
  })
})
```

**Key pattern:** Zustand stores are tested without React rendering. Use `useStore.getState()` to call actions and `useStore.setState()` to reset state.

**Component tests (jsdom required):**
```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

import { ChartFactory } from './chart-factory'

// Mock dependencies
vi.mock('./ag-chart-wrapper', () => ({
  AgChartWrapper: (props: { config?: { vizType?: string } }) => (
    React.createElement('div', { 'data-testid': 'ag-chart' })
  ),
}))

describe('ChartFactory', () => {
  it('routes bar to AgChartWrapper', () => {
    const { getByTestId } = render(
      <ChartFactory chartId="test-1" config={{ ...baseConfig, vizType: 'bar' }} />,
    )
    expect(getByTestId('ag-chart')).toBeDefined()
  })
})
```

**Hook tests (jsdom required):**
```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useAutoRefresh } from './use-auto-refresh'

describe('useAutoRefresh', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('calls onRefresh after intervalMs elapses', () => {
    const onRefresh = vi.fn()
    renderHook(() => useAutoRefresh(60_000, onRefresh))
    act(() => { vi.advanceTimersByTime(61_000) })
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })
})
```

### Playwright E2E Pattern

```typescript
import { test, expect, type Page } from '@playwright/test'

test.describe('Chart Showcase - Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboards/chart-showcase')
    await waitForDashboardLoad(page)
  })

  test('Bar Chart renders without error', async ({ page }) => {
    const titleEl = page.locator('text="Bar Chart"').first()
    await expect(titleEl).toBeVisible()
    // Navigate to card, check no error messages
    await expect(content.locator('text=Column mapping error')).toHaveCount(0)
    // Assert chart canvas exists
    const hasCanvas = await content.locator('canvas').count()
    expect(hasCanvas).toBeGreaterThan(0)
  })
})
```

**Playwright config highlights:**
- `fullyParallel: false`, `workers: 1` -- sequential execution
- `timeout: 30_000` per test, `expect.timeout: 10_000`
- `trace: 'on-first-retry'`, `screenshot: 'only-on-failure'`
- Single project: Chromium desktop
- `webServer` config auto-starts `pnpm dev` and reuses existing server

### Backend Test Pattern (pytest)

**Synchronous tests:**
```python
def test_outer_join():
    left = {"columns": ["k", "v1"], "rows": [...], "row_count": 2}
    right = {"columns": ["k", "v2"], "rows": [...], "row_count": 1}
    result = MergeEngine.merge([left, right], merge_on=["k"], merge_type="outer_join")
    assert result["row_count"] == 1
```

**Async tests:**
```python
import pytest
from unittest.mock import AsyncMock

@pytest.mark.asyncio
async def test_sync_creates_missing_databases():
    superset = _make_superset_mock(existing_dbs=[])
    registrar = DatabaseRegistrar(superset_client=superset, config_path=None)
    registrar._entries = _make_entries()
    await registrar.sync()
    assert superset.create_database.call_count == 2
```

**Fixtures:**
```python
@pytest.fixture
def mock_registrar():
    registrar = MagicMock()
    registrar.get_dialect.return_value = "oracle"
    registrar.get_schema.return_value = ""
    return registrar

@pytest.fixture
def engine(mock_registrar):
    return QueryEngine(
        config_store=ConfigStore(),
        superset_client=MagicMock(),
        database_registrar=mock_registrar,
    )
```

## Mocking

### Frontend (Vitest)

**Framework:** `vi` from Vitest (compatible with Jest API)

**Module mocking:**
```typescript
// Mock entire modules
vi.mock('./ag-chart-wrapper', () => ({
  AgChartWrapper: (props) => React.createElement('div', { 'data-testid': 'ag-chart' }),
}))

// Mock external packages
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// Mock internal utilities
vi.mock('@/lib/chart-export', () => ({
  sanitizeFilename: (name: string) => name.toLowerCase().replace(/\s+/g, '-'),
}))
```

**Function mocking:**
```typescript
const onRefresh = vi.fn()
const mockClick = vi.fn()
const mockCreateObjectURL = vi.fn().mockReturnValue('blob:test-url')
```

**Timer mocking (for auto-refresh, intervals):**
```typescript
beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

vi.setSystemTime(new Date('2026-04-05T12:00:00Z'))
vi.advanceTimersByTime(61_000)
```

**Spy pattern:**
```typescript
const mockCreateElement = vi.spyOn(document, 'createElement').mockReturnValue({...})
// ...
mockCreateElement.mockRestore()
```

**What to mock:**
- External chart libraries (AG Charts, ECharts) -- avoid browser canvas dependencies in unit tests
- Toast notifications (`sonner`)
- Browser APIs (`navigator.clipboard`, `URL.createObjectURL`, `document.createElement`)
- Time-dependent logic (`vi.useFakeTimers`)

**What NOT to mock:**
- Zustand stores -- test with real store via `getState()`/`setState()`
- Pure utility functions (formatters, cross-filter logic, CSV builders)
- Type definitions

### Backend (pytest)

**Framework:** `unittest.mock` (`MagicMock`, `AsyncMock`)

**Patterns:**
```python
from unittest.mock import MagicMock, AsyncMock

# Sync mocks
registrar = MagicMock()
registrar.get_dialect.return_value = "oracle"

# Async mocks for Superset client
mock = AsyncMock()
mock.list_databases = AsyncMock(return_value=[])
mock.create_database = AsyncMock(
    side_effect=lambda payload: {"id": 99, "result": {"id": 99}}
)
```

**What to mock in backend tests:**
- Superset client (external HTTP calls)
- Database registrar (when testing QueryEngine)
- Never mock Pydantic models or pure business logic (MergeEngine, ConfigStore)

## Fixtures and Factories

### Frontend Test Data

**Factory functions** defined at top of test files:
```typescript
function makeData(rows: Record<string, unknown>[]): ChartDataResponse {
  return {
    chartId: 'test',
    columns: Object.keys(rows[0] ?? {}),
    data: rows,
    rowCount: rows.length,
  }
}

function makeKpiConfig(overrides: Partial<KpiConfig> & { id: string }): KpiConfig {
  return {
    label: overrides.id,
    format: 'number',
    sources: [],
    aggregation: 'sum',
    ...overrides,
  }
}
```

**Pattern:** Each test file defines its own minimal factory functions. No shared fixture directory.

**Grid API mock factory** (for AG Grid component tests):
```typescript
function mockGridApi() {
  return {
    exportDataAsCsv: vi.fn(),
    exportDataAsExcel: vi.fn(),
    getColumns: vi.fn(() => [...]),
    setColumnsVisible: vi.fn(),
    autoSizeAllColumns: vi.fn(),
  }
}
```

### Backend Fixtures

**Factory functions** at module level (prefixed with `_make_`):
```python
def _make_entries() -> list[DatabaseEntry]:
    return [
        DatabaseEntry(name="db_one", display_name="DB One", ...),
        DatabaseEntry(name="db_two", display_name="DB Two", ...),
    ]

def _make_superset_mock(existing_dbs=None) -> AsyncMock:
    mock = AsyncMock()
    mock.list_databases = AsyncMock(return_value=existing_dbs or [])
    return mock
```

**pytest fixtures** for reusable setup:
```python
@pytest.fixture
def store():
    return ConfigStore()

@pytest.fixture
def engine(mock_registrar):
    return QueryEngine(config_store=ConfigStore(), ...)
```

**Location:** Fixtures defined in each test file. No shared `conftest.py`.

## Coverage

**Requirements:** Not enforced. No coverage thresholds configured.

**Current coverage profile:**
- Pure logic utilities: Well-tested (`formatters`, `cross-filter`, `kpi-aggregator`, `chart-export`)
- Zustand stores: Well-tested (`filter-store`, `drill-store`)
- Chart components: Partially tested (`buildSeries` function, `ChartFactory` routing)
- UI components: Minimal (only `grid-toolbar.test.tsx`)
- Hooks: Minimal (only `use-auto-refresh.test.ts`)
- Backend services: Moderate (query engine, database registrar, merge engine, config store)
- Backend API routes: Not tested
- E2E: 2 spec files covering chart showcase and TLM stats regression

## Test Types

**Unit Tests (Vitest):**
- Scope: Individual functions, stores, hooks, component routing logic
- 10 test files, co-located with source
- Tests for: formatters, cross-filter logic, KPI aggregation, chart series building, chart factory routing, store state management, auto-refresh hook, grid toolbar UI, chart export utilities

**Integration Tests:**
- Backend `test_config_store.py` reads real JSON config files from disk
- Backend `test_query_engine.py` tests SQL building with real config data

**E2E Tests (Playwright):**
- Scope: Full stack (frontend + backend + Superset + databases)
- 2 spec files: chart showcase rendering (12 chart types), TLM stats dashboard regression
- Validates: chart rendering, cross-filter badge bar, drill-down breadcrumb, error-free loading

## Common Patterns

**Async Testing (hooks):**
```typescript
// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react'

const { result, rerender } = renderHook(
  ({ interval }) => useAutoRefresh(interval, onRefresh),
  { initialProps: { interval: 60_000 } },
)

act(() => { vi.advanceTimersByTime(30_000) })
expect(result.current.remainingMs).toBeLessThanOrEqual(59_000)

rerender({ interval: 300_000 })
expect(result.current.remainingMs).toBe(300_000)
```

**Error Testing:**
```typescript
it('does not crash when currencyCode is undefined', () => {
  expect(() =>
    formatValue(1234.56, { type: 'currency', currencyCode: undefined }),
  ).not.toThrow()
})
```

```python
def test_resolve_database_dynamic_missing_filter(engine):
    with pytest.raises(ValueError, match="required filter"):
        engine._resolve_database(data_source_id="tlm_breaks", filters={})
```

**Boundary/Edge Case Testing:**
```typescript
it('returns original data when no cross-filters', () => {
  const result = applyCrossFilters(data, [], 'chart-a')
  expect(result).toBe(data)  // same reference -- no unnecessary copy
})

it('returns undefined data as-is', () => {
  const result = applyCrossFilters(undefined, [...], 'b')
  expect(result).toBeUndefined()
})
```

**Environment Override Pattern:**
```typescript
// @vitest-environment jsdom
```
Use the `// @vitest-environment jsdom` comment at file top for tests requiring DOM (component rendering, clipboard API, document manipulation). Default environment is `node` for pure logic tests.

## Vitest Configuration Reference

`frontend/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- `globals: true` -- `describe`, `it`, `expect` available globally (though tests still import them explicitly)
- `environment: 'node'` -- default; override with `// @vitest-environment jsdom` per file
- Path alias `@` mirrors Vite config for consistent import resolution in tests

## Adding New Tests

**For a new utility function:**
1. Create `{name}.test.ts` next to the source file
2. Import from vitest: `import { describe, it, expect } from 'vitest'`
3. Write factory helpers at top of file for test data
4. Group related tests in nested `describe` blocks

**For a new React component:**
1. Create `{name}.test.tsx` next to the component
2. Add `// @vitest-environment jsdom` at top
3. Mock heavy dependencies (chart libraries, external packages)
4. Use `render()` from `@testing-library/react` and `screen` for queries

**For a new hook:**
1. Create `use-{name}.test.ts` next to the hook
2. Add `// @vitest-environment jsdom` at top
3. Use `renderHook()` and `act()` from `@testing-library/react`
4. Use `vi.useFakeTimers()` for time-dependent hooks

**For a new backend service:**
1. Create `test_{module}.py` in `backend/tests/`
2. Use `pytest.fixture` for service setup with mocked dependencies
3. Use `@pytest.mark.asyncio` and `AsyncMock` for async services
4. Test public methods; use `_private_method` access for unit-testing internal logic

**For a new E2E scenario:**
1. Create `{feature}.spec.ts` in `frontend/e2e/`
2. Use `test.describe` / `test.beforeEach` structure
3. Wait for data loading with `waitFor` + skeleton disappearance checks
4. Assert error-free rendering before checking positive conditions

---

*Testing analysis: 2026-04-05*
