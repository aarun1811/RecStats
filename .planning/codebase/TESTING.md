# Testing Patterns

**Analysis Date:** 2026-04-06

## Test Frameworks

### Frontend Unit Tests

**Runner:**
- Vitest 4.1.2
- Config: `frontend/vitest.config.ts`

**Assertion Library:**
- Vitest built-in (`expect`, `describe`, `it`)
- `@testing-library/jest-dom` for DOM matchers (available but used sparingly)

**DOM Testing:**
- `@testing-library/react` (v16.3.2) for component rendering
- `jsdom` (v29.0.1) for browser environment simulation
- Environment set per-file via `// @vitest-environment jsdom` comment directive (default is `node`)

**Run Commands:**
```bash
cd frontend
npx vitest                  # Run all tests (watch mode by default)
npx vitest run              # Run all tests once
npx vitest run --reporter=verbose   # Verbose output
```

### Frontend E2E Tests

**Runner:**
- Playwright 1.59.1
- Config: `frontend/playwright.config.ts`

**Run Commands:**
```bash
cd frontend
npx playwright test                     # Run all E2E tests
npx playwright test --reporter=list     # List reporter
npx playwright test --ui                # Interactive UI mode
```

**Prerequisites:** Full stack must be running (Docker Compose, Superset, FastAPI backend, Frontend dev server). Playwright auto-starts the frontend dev server via `webServer` config if not already running.

**Configuration:**
- Test directory: `frontend/e2e/`
- Single worker (`workers: 1`), not fully parallel (`fullyParallel: false`)
- Chromium only (`Desktop Chrome`)
- Base URL: `http://localhost:5173`
- Timeout: 30s per test, 10s per assertion
- Screenshots: only on failure
- Trace: on first retry

### Backend Unit Tests

**Runner:**
- pytest (installed in venv, not in `requirements.txt` -- dev dependency)
- pytest-asyncio for async test functions

**Run Commands:**
```bash
cd backend
python -m pytest tests/                 # Run all backend tests
python -m pytest tests/ -v              # Verbose output
python -m pytest tests/test_query_engine.py  # Single file
```

**No pytest config file** (no `pytest.ini`, `pyproject.toml`, or `setup.cfg`). Uses default pytest discovery.

## Test File Organization

**Frontend Unit Tests - Co-located:**
- Tests live alongside their source files
- Naming: `{source-name}.test.ts` or `{source-name}.test.tsx`
- Excluded from Vitest: `e2e/**` and `node_modules/**` via `vitest.config.ts`

```
frontend/src/
├── lib/
│   ├── formatters.ts
│   ├── formatters.test.ts          # Unit test for formatters
│   ├── cross-filter.ts
│   ├── cross-filter.test.ts        # Unit test for cross-filter logic
│   ├── kpi-aggregator.ts
│   ├── kpi-aggregator.test.ts
│   ├── chart-export.ts
│   ├── chart-export.test.ts
│   ├── column-detection.ts
│   ├── column-detection.test.ts
│   ├── column-merge.ts
│   ├── column-merge.test.ts
│   ├── chart-compatibility.ts
│   └── chart-compatibility.test.ts
├── stores/
│   ├── filter-store.ts
│   ├── filter-store.test.ts
│   ├── drill-store.ts
│   └── drill-store.test.ts
├── hooks/
│   ├── use-auto-refresh.ts
│   └── use-auto-refresh.test.ts
└── components/
    ├── dashboard/
    │   ├── grid-toolbar.tsx
    │   └── grid-toolbar.test.tsx
    └── charts/
        ├── chart-factory.tsx
        ├── chart-factory.test.tsx
        ├── ag-chart-wrapper.tsx
        └── ag-chart-wrapper.test.ts
```

**Frontend E2E Tests - Separate directory:**
```
frontend/e2e/
├── chart-showcase.spec.ts      # Chart rendering + cross-filter + drill-down
└── tlm-stats-regression.spec.ts  # Regression tests for production dashboard
```

**Backend Tests - Separate `tests/` directory:**
```
backend/tests/
├── __init__.py
├── test_config_store.py
├── test_database_registrar.py
├── test_merge_engine.py
├── test_query_engine.py
├── test_uri_builder.py
├── test_connection_status.py
├── test_dataset_sync.py
├── test_managed_datasets.py
└── test_managed_charts.py
```

## Test Structure

### Frontend Unit Test Pattern

**Pure function tests (most common):**
```typescript
import { describe, it, expect } from 'vitest'
import { formatValue, formatValueFull } from './formatters'

describe('formatValue', () => {
  describe('null/undefined handling', () => {
    it('returns empty string for null', () => {
      expect(formatValue(null, { type: 'number' })).toBe('')
    })
  })

  describe('number formatting', () => {
    it('formats with abbreviation (compact notation)', () => {
      const result = formatValue(1234567, { type: 'number', abbreviate: true })
      expect(result).toMatch(/1\.2M/i)
    })
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

  it('toggles: same sourceChartId+column+value removes the filter', () => {
    const { addCrossFilter } = useFilterStore.getState()
    addCrossFilter({ sourceChartId: 'chart-a', column: 'region', value: 'APAC' })
    expect(useFilterStore.getState().crossFilters).toHaveLength(1)

    addCrossFilter({ sourceChartId: 'chart-a', column: 'region', value: 'APAC' })
    expect(useFilterStore.getState().crossFilters).toHaveLength(0)
  })
})
```

**Component tests (jsdom environment):**
```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

import { GridToolbar } from './grid-toolbar'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

describe('GridToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders search input with placeholder', () => {
    render(<GridToolbar {...defaultProps} />)
    expect(screen.getByPlaceholderText('Quick filter...')).toBeDefined()
  })
})
```

**Hook tests (jsdom environment):**
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

### Frontend E2E Test Pattern

```typescript
import { test, expect, type Page } from '@playwright/test'

async function waitForDashboardLoad(page: Page): Promise<void> {
  await page.locator('text=Bar Chart').waitFor({ state: 'visible', timeout: 15_000 })
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0, { timeout: 15_000 })
}

test.describe('Chart Showcase - Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboards/chart-showcase')
    await waitForDashboardLoad(page)
  })

  // Parameterized: iterate over chart types
  for (const chartTitle of chartTypes) {
    test(`${chartTitle} renders without error`, async ({ page }) => {
      const titleEl = page.locator(`text="${chartTitle}"`).first()
      await expect(titleEl).toBeVisible()
      // Assert no error panels
      await expect(content.locator('text=Column mapping error')).toHaveCount(0)
    })
  }
})
```

### Backend Unit Test Pattern

**Pure function tests:**
```python
from app.services.merge_engine import MergeEngine

def test_outer_join():
    left = {"columns": ["k", "v1"], "rows": [...], "row_count": 2}
    right = {"columns": ["k", "v2"], "rows": [...], "row_count": 1}
    result = MergeEngine.merge([left, right], merge_on=["k"], merge_type="outer_join")
    assert result["row_count"] == 3
```

**Async service tests:**
```python
import pytest
from unittest.mock import AsyncMock, MagicMock

@pytest.mark.asyncio
async def test_sync_creates_missing_databases():
    superset = AsyncMock()
    superset.list_databases = AsyncMock(return_value=[])
    superset.create_database = AsyncMock(side_effect=lambda payload: {"id": 99})
    registrar = DatabaseRegistrar(superset_client=superset, config_path=None)
    registrar._entries = _make_entries()
    await registrar.sync()
    assert superset.create_database.call_count == 2
```

**FastAPI endpoint tests (TestClient):**
```python
from fastapi import FastAPI
from fastapi.testclient import TestClient

def _create_test_app(session_mock, sync_mock):
    test_app = FastAPI()
    test_app.include_router(router)
    test_app.state.dataset_sync = sync_mock

    async def override_db():
        yield session_mock
    test_app.dependency_overrides[get_db_session] = override_db
    return test_app

def test_create_managed_dataset_returns_201():
    session = AsyncMock()
    sync_service = MagicMock(spec=DatasetSyncService)
    sync_service.sync_dataset = AsyncMock(return_value=42)
    app = _create_test_app(session, sync_service)
    client = TestClient(app)
    resp = client.post("/api/datasets/managed", json=VALID_CREATE_BODY)
    assert resp.status_code == 201
```

## Mocking

### Frontend Mocking

**Framework:** `vi.mock()` and `vi.fn()` from Vitest

**Module mocking pattern:**
```typescript
// Mock external dependencies
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// Mock internal modules
vi.mock('@/lib/chart-export', () => ({
  sanitizeFilename: (name: string) => name.toLowerCase().replace(/\s+/g, '-'),
}))

// Mock chart wrappers to avoid browser dependencies
vi.mock('./ag-chart-wrapper', () => ({
  AgChartWrapper: (props: { config?: { vizType?: string } }) =>
    React.createElement('div', { 'data-testid': 'ag-chart', 'data-viztype': props.config?.vizType }),
}))
```

**API mock pattern:** Mock the AG Grid API object with `vi.fn()` methods:
```typescript
function mockGridApi() {
  return {
    exportDataAsCsv: vi.fn(),
    exportDataAsExcel: vi.fn(),
    getColumns: vi.fn(() => [
      { getColId: () => 'name', getColDef: () => ({ headerName: 'Name' }), isVisible: () => true },
    ]),
    autoSizeAllColumns: vi.fn(),
  }
}
```

**Timer mocking:** `vi.useFakeTimers()` / `vi.useRealTimers()` with `vi.advanceTimersByTime()`.

**What to mock:**
- External services (sonner toast, chart libraries)
- Browser APIs (clipboard, DOM creation, URL.createObjectURL)
- Timer-dependent code

**What NOT to mock:**
- Pure utility functions under test
- Zustand stores (test directly via `getState()` / `setState()`)
- Type imports

### Backend Mocking

**Framework:** `unittest.mock` (`AsyncMock`, `MagicMock`, `patch`)

**Async mock pattern:**
```python
superset = AsyncMock()
superset.create_dataset = AsyncMock(return_value={"id": 55})
superset.list_databases = AsyncMock(return_value=[{"id": 5, "database_name": "db_one"}])
```

**FastAPI dependency override:**
```python
async def override_db():
    yield session_mock
test_app.dependency_overrides[get_db_session] = override_db
```

**SQLAlchemy result mocking:**
```python
mock_result = MagicMock()
mock_result.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=[row])))
session.execute = AsyncMock(return_value=mock_result)
```

**What to mock:**
- Superset HTTP client (`AsyncMock`)
- Database sessions (`AsyncMock` + `MagicMock` result chains)
- External services
- Internal private state for edge cases (e.g., `registrar._cache.clear()`, `registrar._last_refresh = 0.0`)

**What NOT to mock:**
- `ConfigStore` (tested against real JSON config files on disk)
- Pure logic like `MergeEngine`, `uri_builder`, `ConnectionStatusTracker`
- Pydantic model validation

## Fixtures and Factories

### Frontend Test Data Factories

```typescript
// Inline factory function pattern
const makeData = (rows: Record<string, unknown>[]): ChartDataResponse => ({
  chartId: 'test',
  columns: Object.keys(rows[0] ?? {}),
  data: rows,
  rowCount: rows.length,
})

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

**Location:** Inline within each test file. No shared fixture files.

### Backend Test Data Factories

```python
def _make_dataset_row(*, dataset_id="test-uuid-1", name="Test Dataset", ...):
    """Create a mock RecvizDataset row."""
    row = MagicMock()
    row.id = dataset_id
    row.name = name
    # ...
    return row

def _make_entries() -> list[DatabaseEntry]:
    return [
        DatabaseEntry(name="db_one", display_name="DB One", sqlalchemy_uri="sqlite:///test.db", ...),
    ]
```

**Pattern:** Private `_make_*` factory functions at module top. Use `MagicMock` for ORM rows, real Pydantic models for config objects.

**pytest fixtures:**
```python
@pytest.fixture
def store():
    return ConfigStore()

@pytest.fixture
def mock_registrar():
    registrar = MagicMock()
    registrar.get_dialect.return_value = "oracle"
    return registrar

@pytest.fixture
def engine(mock_registrar):
    return QueryEngine(config_store=ConfigStore(), superset_client=MagicMock(), database_registrar=mock_registrar)
```

## Coverage

**Requirements:** Not enforced. No coverage thresholds configured.

**View Coverage (Frontend):**
```bash
cd frontend
npx vitest run --coverage
```

**View Coverage (Backend):**
```bash
cd backend
python -m pytest tests/ --cov=app --cov-report=html
```
(Requires `pytest-cov` to be installed.)

## Test Types

### Unit Tests (Frontend - 13 test files)

**Scope:** Pure logic, store state management, component rendering, hook behavior.

**Tested areas:**
- `frontend/src/lib/formatters.test.ts` -- Number/currency/percentage formatting
- `frontend/src/lib/cross-filter.test.ts` -- Cross-filter application logic
- `frontend/src/lib/kpi-aggregator.test.ts` -- KPI recomputation with cross-filters
- `frontend/src/lib/chart-export.test.ts` -- CSV/TSV generation, file download, clipboard
- `frontend/src/lib/column-detection.test.ts` -- Auto-detection of column types from data
- `frontend/src/lib/column-merge.test.ts` -- Column schema merge (unchanged/new/missing)
- `frontend/src/lib/chart-compatibility.test.ts` -- Chart type vs dataset shape validation
- `frontend/src/stores/filter-store.test.ts` -- Cross-filter toggle/replace/clear
- `frontend/src/stores/drill-store.test.ts` -- Drill-down state per chart
- `frontend/src/hooks/use-auto-refresh.test.ts` -- Timer-based auto-refresh hook
- `frontend/src/components/dashboard/grid-toolbar.test.tsx` -- Grid toolbar rendering and actions
- `frontend/src/components/charts/chart-factory.test.tsx` -- Chart type routing (AG vs ECharts)
- `frontend/src/components/charts/ag-chart-wrapper.test.ts` -- Series builder config mapping

### E2E Tests (Frontend - 2 test files)

**Scope:** Full-stack rendering validation against real backend data.

**Tested areas:**
- `frontend/e2e/chart-showcase.spec.ts` -- 12 chart types render without error, cross-filter activation, drill-down navigation
- `frontend/e2e/tlm-stats-regression.spec.ts` -- Production dashboard regression (column mapping refactor)

### Unit Tests (Backend - 9 test files)

**Scope:** Service logic, API endpoints, data transformations.

**Tested areas:**
- `backend/tests/test_config_store.py` -- Dashboard/data-source JSON config loading
- `backend/tests/test_database_registrar.py` -- Superset database sync, resolve, cache
- `backend/tests/test_merge_engine.py` -- Multi-source data merge (outer/inner join)
- `backend/tests/test_query_engine.py` -- SQL building, dialect handling, filter injection, SQL injection prevention
- `backend/tests/test_uri_builder.py` -- SQLAlchemy URI construction for Oracle/Hive/PostgreSQL
- `backend/tests/test_connection_status.py` -- In-memory connection status tracking
- `backend/tests/test_dataset_sync.py` -- Superset dataset CRUD sync, reconciliation
- `backend/tests/test_managed_datasets.py` -- Dataset API CRUD endpoints (201, 404, 422, 204, 409)
- `backend/tests/test_managed_charts.py` -- Chart API CRUD endpoints + reference checks

## Common Patterns

### Async Testing (Backend)

```python
@pytest.mark.asyncio
async def test_sync_creates_missing_databases():
    superset = AsyncMock()
    registrar = DatabaseRegistrar(superset_client=superset, config_path=None)
    await registrar.sync()
    assert superset.create_database.call_count == 2
```

### Error Testing

**Frontend:**
```typescript
it('does not crash when currencyCode is undefined', () => {
  expect(() => formatValue(1234.56, { type: 'currency', currencyCode: undefined })).not.toThrow()
})
```

**Backend:**
```python
def test_resolve_unknown_raises():
    with pytest.raises(ValueError, match="not registered"):
        await registrar.resolve("nonexistent")

def test_create_managed_dataset_empty_name_returns_422():
    resp = client.post("/api/datasets/managed", json=body)
    assert resp.status_code == 422
```

### Environment Directive Pattern (Frontend)

Tests that need browser APIs use a per-file directive instead of global config:
```typescript
// @vitest-environment jsdom
```
This keeps the default environment as `node` (faster) and only uses `jsdom` where needed. This is configured in `frontend/vitest.config.ts`:
```typescript
test: {
  globals: true,
  environment: 'node',
  exclude: ['e2e/**', 'node_modules/**'],
}
```

### Test Data Conventions

- Use realistic domain data (regions: 'APAC'/'EMEA', desks: 'FX'/'EQ', columns: 'break_count', 'amount')
- Test edge cases: `null`, `undefined`, empty arrays, empty Maps
- Test both positive and negative paths for every function
- Verify same-reference returns when no filtering needed (performance optimization tests)

### Vitest Globals

`globals: true` in `vitest.config.ts` means `describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach` are globally available. However, the codebase explicitly imports them:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
```
This is the preferred pattern -- always import explicitly for clarity.

---

*Testing analysis: 2026-04-06*
