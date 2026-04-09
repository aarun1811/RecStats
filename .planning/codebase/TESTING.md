# Testing Patterns

**Analysis Date:** 2026-04-09

## Test Frameworks

### Frontend Unit Tests

**Runner:**
- Vitest 4.1+ (latest major)
- Config: `frontend/vitest.config.ts`

**Assertion Library:**
- Vitest built-in (`expect`, `describe`, `it`, `vi`)
- `@testing-library/jest-dom` available but NOT globally wired (no `setupFiles` in vitest config)
- Use `expect(element).toBeDefined()` or `expect(element).toBeTruthy()` instead of `toBeInTheDocument()`

**Run Commands:**
```bash
cd frontend
npx vitest                   # Watch mode (default)
npx vitest run               # Single run
npx vitest run --coverage    # Coverage (no coverage config detected)
```

**Environment:**
- Default: `node` (from `frontend/vitest.config.ts`: `environment: 'node'`)
- Override per-file with `// @vitest-environment jsdom` at top of file (used for component tests and DOM-dependent utils)
- `jsdom` v29 available as devDependency
- E2E tests excluded: `exclude: ['e2e/**', 'node_modules/**']`

### Frontend E2E Tests

**Runner:**
- Playwright 1.59+
- Config: `frontend/playwright.config.ts`

**Run Commands:**
```bash
cd frontend
npx playwright test --reporter=list    # Run all E2E tests
npx playwright test embed.spec.ts      # Run a specific spec
npx playwright show-report             # View HTML report
```

**Prerequisites:**
- Full stack must be running: Docker Compose (PostgreSQL + Redis), Superset, FastAPI backend, frontend dev server
- Frontend dev server auto-started by `webServer` config if not already running
- Seeded curated test data must exist in the database (via `seed-postgres.py`)

**Configuration:**
- `testDir`: `./e2e`
- `fullyParallel`: false (sequential)
- `workers`: 1
- `timeout`: 30 seconds
- `expect.timeout`: 10 seconds
- `baseURL`: `http://localhost:5173`
- `trace`: on first retry
- `screenshot`: only on failure
- Browser: Chromium (Desktop Chrome) only
- Retries: 0 locally, 2 on CI

### Backend Tests

**Runner:**
- pytest (version from requirements not pinned, installed in venv)
- No pytest config file detected (no `pytest.ini`, `pyproject.toml`, or `setup.cfg`)

**Assertion Library:**
- Standard `assert` statements
- `pytest.raises` for exception assertions

**Run Commands:**
```bash
cd backend
python -m pytest tests/         # Run all backend tests
python -m pytest tests/ -v      # Verbose output
python -m pytest tests/test_query_engine.py  # Run specific file
```

**Async Support:**
- `pytest-asyncio` for async test functions
- Decorator: `@pytest.mark.asyncio`

## Test File Organization

**Frontend Unit Tests — Co-located:**
```
frontend/src/
  lib/
    cross-filter.ts              # Source
    cross-filter.test.ts         # Test (same directory)
    formatters.ts
    formatters.test.ts
    kpi-aggregator.ts
    kpi-aggregator.test.ts
  stores/
    filter-store.ts
    filter-store.test.ts
    drill-store.ts
    drill-store.test.ts
  components/
    charts/
      ag-chart-wrapper.tsx
      ag-chart-wrapper.test.ts   # Pure logic test (node env)
      ag-chart-wrapper.rules-of-hooks.test.tsx  # Component render test (jsdom)
      chart-factory.tsx
      chart-factory.test.tsx
    dashboard/
      grid-toolbar.tsx
      grid-toolbar.test.tsx
  routes/
    embed/dashboards/
      $dashboardId.tsx
      $dashboardId.test.tsx       # Wiring test with mocked deps
```

**Frontend E2E Tests — Separate directory:**
```
frontend/e2e/
  _fixtures.ts                    # Shared test fixtures (CURATED_DASHBOARDS, CURATED_CHARTS, etc.)
  _dashboard-names.json           # Dashboard name cross-check data
  chart-showcase.spec.ts          # Dashboard smoke tests (all 5 curated dashboards)
  command-palette.spec.ts         # Cmd+K palette search tests
  dashboard-edit-regression.spec.ts  # Builder page mount regression
  dashboard-view-regression.spec.ts  # View route hook regression
  embed.spec.ts                   # Embed mode tests (8 tests for hide/theme/filter params)
  share-link.spec.ts              # Share URL bidirectional sync tests
```

**Backend Tests — Separate `tests/` directory:**
```
backend/tests/
  __init__.py
  test_config_store.py            # ConfigStore unit tests
  test_connection_status.py       # Connection status tracker tests
  test_database_registrar.py      # Database registrar (async, mocked Superset)
  test_dataset_sync.py            # Dataset sync service tests
  test_managed_charts.py          # Chart CRUD API endpoint tests
  test_managed_datasets.py        # Dataset CRUD API endpoint tests
  test_managed_kpis.py            # KPI CRUD API endpoint tests
  test_merge_engine.py            # MergeEngine unit tests
  test_query_engine.py            # QueryEngine SQL building + routing tests
  test_search.py                  # Search API endpoint tests
  test_seed_script.py             # Seed script validation tests
  test_uri_builder.py             # URI builder utility tests
```

## Test Structure

### Frontend Unit Test Pattern (Pure Logic)

Tests for pure functions use `describe/it` blocks with direct imports:

```typescript
import { describe, it, expect } from 'vitest'
import type { CrossFilter } from '@/types/filter'
import { applyCrossFilters, rowPassesCrossFilters } from './cross-filter'

describe('applyCrossFilters', () => {
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
  })
})
```

### Frontend Unit Test Pattern (Zustand Store)

Store tests use `useStore.setState()` for setup and `useStore.getState()` for assertions:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useFilterStore } from './filter-store'

describe('filter-store crossFilters', () => {
  beforeEach(() => {
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

### Frontend Unit Test Pattern (Component Render)

Component tests use `@testing-library/react` with `jsdom` environment:

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

describe('GridToolbar', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders search input with placeholder', () => {
    render(<GridToolbar {...defaultProps} />)
    expect(screen.getByPlaceholderText('Quick filter...')).toBeDefined()
  })

  it('calls gridApi on button click', () => {
    const api = mockGridApi()
    render(<GridToolbar {...defaultProps} gridApi={api as never} />)
    fireEvent.click(screen.getByRole('button', { name: /csv/i }))
    expect(api.exportDataAsCsv).toHaveBeenCalledTimes(1)
  })
})
```

### Frontend Unit Test Pattern (Hook Render)

Hook tests use `renderHook` from `@testing-library/react`:

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

E2E tests use Playwright with shared fixtures from `frontend/e2e/_fixtures.ts`:

```typescript
import { expect, test } from '@playwright/test'
import { CURATED_DASHBOARDS, waitForDashboardLoad } from './_fixtures'

const { volume } = CURATED_DASHBOARDS

test.describe('Dashboard view route', () => {
  test('loads with title visible', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await page.goto(`/dashboards/${volume.id}`)
    await waitForDashboardLoad(page, volume.name)

    await expect(page.locator('h1', { hasText: volume.name })).toBeVisible()
    await expect(page.locator('text=Dashboard not found')).toHaveCount(0)
    expect(consoleErrors).toHaveLength(0)
  })
})
```

### Backend Test Pattern (Service Unit)

Pure unit tests using pytest fixtures and standard assertions:

```python
import pytest
from unittest.mock import MagicMock
from app.services.query_engine import QueryEngine

@pytest.fixture
def mock_registrar():
    registrar = MagicMock()
    registrar.get_dialect.return_value = "oracle"
    return registrar

@pytest.fixture
def engine(mock_registrar):
    return QueryEngine(superset_client=MagicMock(), database_registrar=mock_registrar)

def test_build_sql_with_filters(engine):
    sql = engine._build_sql(data_source_id="tlm_breaks", filters={"recon": ["AGENT_01"]})
    assert "b.agent_code IN ('AGENT_01')" in sql
```

### Backend Test Pattern (API Endpoint)

API tests create a minimal FastAPI app with mocked dependencies:

```python
from unittest.mock import AsyncMock, MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient

def _make_chart_row(*, chart_id: str = "chart-uuid-1", name: str = "Test") -> MagicMock:
    row = MagicMock()
    row.id = chart_id
    row.name = name
    row.config = {"column_mapping": {...}}
    return row

def _create_test_app(session_mock: AsyncMock) -> FastAPI:
    from app.api.managed_charts import router
    from app.core.dependencies import get_db_session

    test_app = FastAPI()
    test_app.include_router(router)

    async def override_db():
        yield session_mock

    test_app.dependency_overrides[get_db_session] = override_db
    return test_app

def test_list_managed_charts_returns_list():
    row = _make_chart_row()
    session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=[row])))
    session.execute = AsyncMock(return_value=mock_result)

    app = _create_test_app(session)
    client = TestClient(app)

    resp = client.get("/api/charts/managed")
    assert resp.status_code == 200
    assert len(resp.json()) == 1
```

### Backend Test Pattern (Async Service)

Async tests use `@pytest.mark.asyncio` with `AsyncMock`:

```python
import pytest
from unittest.mock import AsyncMock

@pytest.mark.asyncio
async def test_sync_creates_missing_databases():
    superset = AsyncMock()
    superset.list_databases = AsyncMock(return_value=[])
    superset.create_database = AsyncMock(side_effect=lambda p: {"id": 99})
    registrar = DatabaseRegistrar(superset_client=superset, config_path=None)
    registrar._entries = _make_entries()
    await registrar.sync()
    assert superset.create_database.call_count == 2
```

## Mocking

### Frontend Mocking (Vitest)

**Framework:** `vi` from Vitest (built-in)

**Module Mocking:**
```typescript
// Mock entire modules
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/chart-export', () => ({
  sanitizeFilename: (name: string) => name.toLowerCase().replace(/\s+/g, '-'),
}))

// Mock chart libraries to avoid canvas/DOM dependencies
vi.mock('ag-charts-react', () => ({
  AgCharts: () => null,
}))

// Mock hooks to isolate component wiring
const useManagedDashboardMock = vi.fn()
vi.mock('@/hooks/use-managed-dashboards', () => ({
  useManagedDashboard: (id: string | null) => useManagedDashboardMock(id),
}))

// Mock React component to spy on props
const dashboardRendererSpy = vi.fn()
vi.mock('@/components/dashboard/dashboard-renderer', () => ({
  DashboardRenderer: (props: Record<string, unknown>) => {
    dashboardRendererSpy(props)
    return <div data-testid="dashboard-renderer-mock" />
  },
}))
```

**Spy Functions:**
```typescript
const mockClick = vi.fn()
const onChange = vi.fn()
vi.spyOn(console, 'error').mockImplementation(() => {})
```

**Fake Timers:**
```typescript
vi.useFakeTimers()
vi.setSystemTime(new Date('2026-04-05T12:00:00Z'))
vi.advanceTimersByTime(61_000)
vi.useRealTimers()
```

**Browser API Mocking:**
```typescript
// ResizeObserver
class MockResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
;(globalThis as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver = MockResizeObserver

// Clipboard
const writeText = vi.fn().mockResolvedValue(undefined)
Object.assign(navigator, { clipboard: { writeText } })

// URL.createObjectURL
globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:test-url')
globalThis.URL.revokeObjectURL = vi.fn()
```

**What to Mock:**
- External chart libraries (AG Charts, ECharts) — heavy DOM/canvas dependencies
- Third-party toast libraries (Sonner)
- Browser APIs not available in jsdom (ResizeObserver, clipboard, URL.createObjectURL)
- Hooks when testing component wiring (isolate the SUT)
- Network-dependent services (TanStack Router, API client)
- Theme provider when testing components

**What NOT to Mock:**
- Pure logic functions (cross-filter, formatters, URL state, column detection) — test directly
- Zustand stores — test via `getState()` / `setState()` (no mocking needed)
- Pydantic models and data transformations

### Backend Mocking (Python)

**Framework:** `unittest.mock` (MagicMock, AsyncMock, patch)

**SQLAlchemy Session Mocking:**
```python
session = AsyncMock()
mock_result = MagicMock()
mock_result.scalar_one_or_none = MagicMock(return_value=row)
session.execute = AsyncMock(return_value=mock_result)

# Multi-query mocking via side_effect
session.execute = AsyncMock(side_effect=[result1, result2, result3])
```

**Dependency Override Pattern:**
```python
async def override_db():
    yield session_mock

test_app.dependency_overrides[get_db_session] = override_db
```

**Service Mocking:**
```python
sync_service = MagicMock(spec=DatasetSyncService)
sync_service.sync_dataset = AsyncMock(return_value=42)
sync_service.delete_synced = AsyncMock()
```

## Fixtures and Factories

### Frontend Test Data Factories

**Inline factory functions at the top of test files:**
```typescript
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

### Frontend E2E Fixtures

**Curated test catalog in `frontend/e2e/_fixtures.ts`:**
- `DASHBOARD_NAMES` — canonical dashboard name strings (matched by seed script)
- `CURATED_DASHBOARDS` — 5 dashboards keyed by handle (sla, aging, matchRate, volume, breaksSummary)
- `CURATED_CHARTS` — 22 charts covering all 18 chart types
- `CURATED_DATASETS` — 16 datasets
- `CURATED_KPIS` — 12 KPIs
- `waitForDashboardLoad(page, name)` — shared helper that waits for h1 + skeleton removal

### Backend Test Data Factories

**Factory functions per entity:**
```python
def _make_chart_row(*, chart_id: str = "chart-uuid-1", name: str = "Test Chart") -> MagicMock:
    row = MagicMock()
    row.id = chart_id
    row.name = name
    row.config = {...}
    row.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return row
```

**Shared constants for valid request bodies:**
```python
VALID_CREATE_BODY = {
    "name": "My Chart",
    "description": "Testing",
    "datasetId": "dataset-uuid-1",
    "chartType": "bar",
    "config": {...},
}
```

## Coverage

**Requirements:** No coverage thresholds enforced. No coverage tooling configured.

**View Coverage:**
```bash
cd frontend && npx vitest run --coverage   # Vitest coverage (not configured)
cd backend && python -m pytest --cov=app tests/  # If pytest-cov is installed
```

## Test Types

### Unit Tests (Frontend)

**17 test files** across:
- Pure logic utilities: `frontend/src/lib/` (8 files: cross-filter, formatters, kpi-aggregator, kpi-utils, chart-compatibility, chart-export, column-detection, column-merge, dashboard-url-state)
- Zustand stores: `frontend/src/stores/` (2 files: filter-store, drill-store)
- Component logic: `frontend/src/components/charts/` (3 files: ag-chart-wrapper, chart-factory, rules-of-hooks)
- Component render: `frontend/src/components/dashboard/` (1 file: grid-toolbar)
- Hook behavior: `frontend/src/hooks/` (1 file: use-auto-refresh)
- Route wiring: `frontend/src/routes/embed/` (1 file: embed route)

**Scope:** Pure functions, store state transitions, component rendering, hook lifecycle, route wiring.

### Unit Tests (Backend)

**12 test files** covering:
- Service logic: `test_query_engine.py`, `test_merge_engine.py`, `test_uri_builder.py`, `test_config_store.py`, `test_database_registrar.py`, `test_connection_status.py`, `test_dataset_sync.py`
- API endpoints: `test_managed_charts.py`, `test_managed_datasets.py`, `test_managed_kpis.py`, `test_search.py`
- Seed validation: `test_seed_script.py`

**Scope:** SQL building, data merging, URI construction, CRUD operations, search ranking, config loading.

### E2E Tests (Playwright)

**6 spec files** covering:
- `chart-showcase.spec.ts` — Smoke test all 5 curated dashboards (no errors, charts render, KPIs show values)
- `command-palette.spec.ts` — Cmd+K search against curated entities (navigation, type ordering)
- `dashboard-edit-regression.spec.ts` — Builder page mount regression
- `dashboard-view-regression.spec.ts` — View route hook upgrade regression
- `embed.spec.ts` — Embed mode (8 tests: theme, filters, lock, hide params)
- `share-link.spec.ts` — Bidirectional URL sync, clipboard, replace mode

**Scope:** Full-stack integration against seeded data. Real API, real database, real rendering.

## Common Patterns

### Async Testing (Frontend)

```typescript
it('calls gridApi.exportDataAsExcel on Excel button click', async () => {
  const api = mockGridApi()
  render(<GridToolbar {...defaultProps} gridApi={api as never} />)
  fireEvent.click(screen.getByRole('button', { name: /excel/i }))
  await waitFor(() => {
    expect(api.exportDataAsExcel).toHaveBeenCalledTimes(1)
  })
})
```

### Error Testing (Frontend)

```typescript
it('shows error toast when clipboard fails', async () => {
  const { toast } = await import('sonner')
  const writeText = vi.fn().mockRejectedValue(new Error('denied'))
  Object.assign(navigator, { clipboard: { writeText } })
  await copyToClipboard(['a'], [{ a: 1 }])
  expect(toast.error).toHaveBeenCalledWith('Failed to copy to clipboard')
})
```

### Error Testing (Backend)

```python
def test_resolve_database_dynamic_missing_filter(engine):
    with pytest.raises(ValueError, match="required filter"):
        engine._resolve_database(data_source_id="tlm_breaks", filters={})
```

### Null/Undefined/Edge Case Testing

```typescript
it('returns undefined data as-is', () => {
  const result = applyCrossFilters(undefined, [
    { sourceChartId: 'a', column: 'x', value: 'y' },
  ], 'b')
  expect(result).toBeUndefined()
})

it('returns empty string for null', () => {
  expect(formatValue(null, { type: 'number' })).toBe('')
})
```

### Console Error Spy Pattern (E2E)

```typescript
test('loads without console errors', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  await page.goto(`/dashboards/${volume.id}`)
  await waitForDashboardLoad(page, volume.name)
  expect(consoleErrors).toHaveLength(0)
})
```

### Module Re-import Pattern (Wiring Tests)

For tests that need fresh module state after mock changes:

```typescript
async function importEmbedPage() {
  const mod = await import('./$dashboardId')
  const route = mod.Route as unknown as { component: () => JSX.Element }
  return route.component
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.resetModules()
})
```

---

*Testing analysis: 2026-04-09*
