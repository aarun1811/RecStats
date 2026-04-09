# Testing Patterns

**Analysis Date:** 2026-04-09

## Test Framework

**Frontend Unit Tests:**
- Runner: Vitest 4.1.2
- Config: `frontend/vitest.config.ts`
- Environment: `node` by default, `jsdom` via per-file `// @vitest-environment jsdom` pragma
- Assertion library: Vitest built-in (`expect`, `describe`, `it`)
- React testing: `@testing-library/react` 16.3.2 + `@testing-library/jest-dom` 6.9.1
- JSDOM: `jsdom` 29.0.1 (devDependency)

**Frontend E2E Tests:**
- Runner: Playwright 1.59.1
- Config: `frontend/playwright.config.ts`
- Browser: Chromium only (Desktop Chrome device)
- Sequential execution: `fullyParallel: false`, `workers: 1`
- Timeout: 30s per test, 10s per assertion, 120s for webServer startup
- Auto-starts `pnpm dev` if not already running (reuses existing server)
- Reporter: HTML
- Traces: on first retry only
- Screenshots: only on failure

**Backend Unit Tests:**
- Runner: pytest (not in `requirements.txt` -- installed separately)
- Async support: `pytest-asyncio` (via `@pytest.mark.asyncio`)
- HTTP testing: `fastapi.testclient.TestClient` (sync wrapper)
- Mocking: `unittest.mock` (`MagicMock`, `AsyncMock`, `patch`)
- No conftest.py detected
- No pytest config file detected (no `pytest.ini`, `pyproject.toml`, `setup.cfg`)

**Run Commands:**
```bash
# Frontend unit tests
cd frontend && npx vitest              # Watch mode (default)
cd frontend && npx vitest run          # Single run
cd frontend && npx vitest run --coverage  # Coverage (not configured yet)

# Frontend E2E tests (requires full stack running)
cd frontend && npx playwright test --reporter=list

# Backend tests
cd backend && python -m pytest tests/  # Run all backend tests
cd backend && python -m pytest tests/test_query_engine.py  # Single file
```

## Test File Organization

**Frontend Unit Tests -- co-located with source:**
```
frontend/src/
├── lib/
│   ├── cross-filter.ts
│   ├── cross-filter.test.ts          # Tests next to source
│   ├── formatters.ts
│   ├── formatters.test.ts
│   ├── kpi-aggregator.ts
│   ├── kpi-aggregator.test.ts
│   ├── kpi-utils.ts
│   ├── kpi-utils.test.ts
│   ├── dashboard-url-state.ts
│   ├── dashboard-url-state.test.ts
│   ├── chart-compatibility.ts
│   ├── chart-compatibility.test.ts
│   ├── chart-export.ts
│   ├── chart-export.test.ts
│   ├── column-detection.ts
│   ├── column-detection.test.ts
│   ├── column-merge.ts
│   └── column-merge.test.ts
├── stores/
│   ├── filter-store.ts
│   ├── filter-store.test.ts
│   ├── drill-store.ts
│   └── drill-store.test.ts
├── hooks/
│   ├── use-auto-refresh.ts
│   └── use-auto-refresh.test.ts
└── components/
    └── charts/
        └── ag-chart-wrapper.rules-of-hooks.test.tsx
```

**Frontend E2E Tests -- separate directory:**
```
frontend/e2e/
├── _fixtures.ts                       # Shared fixtures (curated entity catalog)
├── chart-showcase.spec.ts             # Dashboard smoke tests (all 5 curated)
├── command-palette.spec.ts            # Cmd+K palette search tests
├── dashboard-edit-regression.spec.ts  # Builder edit regression
├── dashboard-view-regression.spec.ts  # View route hook regression
├── embed.spec.ts                      # Embed mode (?theme, ?filter, ?hide)
├── share-link.spec.ts                 # URL filter-state sync + Share button
├── parity-builder.spec.ts            # Builder parity after engine migration
├── parity-connections.spec.ts         # Connections page parity
├── parity-dashboards.spec.ts         # Dashboard rendering + cross-filter parity
└── parity-explorer.spec.ts           # SQL Explorer parity
```

**Backend Tests -- separate `tests/` directory:**
```
backend/tests/
├── __init__.py
├── test_config_store.py               # ConfigStore CRUD
├── test_connection_model.py           # Connection ORM model
├── test_connection_resolver.py        # ConnectionResolver logic
├── test_connection_status.py          # ConnectionStatusTracker
├── test_databases_api.py              # Database management API endpoints
├── test_encryption.py                 # EncryptionService (Fernet)
├── test_engine_manager.py             # EngineManager pool management
├── test_managed_charts.py             # Chart CRUD API endpoints
├── test_managed_datasets.py           # Dataset CRUD API endpoints
├── test_managed_kpis.py               # KPI CRUD API endpoints
├── test_merge_engine.py               # MergeEngine join logic
├── test_portable_json.py              # Portable JSON export/import
├── test_query_engine.py               # QueryExecutor (direct DB execution)
├── test_query_utils.py                # Query utility functions
├── test_search.py                     # Search API
├── test_seed_script.py                # Seed script validation
├── test_sql_api.py                    # SQL Explorer API + read-only enforcement
└── test_uri_builder.py                # URI builder (Oracle/Hive/PostgreSQL)
```

**Naming convention:**
- Frontend unit: `{source-file-name}.test.ts(x)` co-located with source
- Frontend E2E: `{feature-name}.spec.ts` in `frontend/e2e/`
- Backend: `test_{module_name}.py` in `backend/tests/`

## Test Structure

**Frontend Unit Test Pattern (pure logic -- `lib/`, `stores/`):**
```typescript
import { describe, it, expect } from 'vitest'
import { applyCrossFilters } from './cross-filter'
import type { CrossFilter } from '@/types/filter'

describe('applyCrossFilters', () => {
  const makeData = (rows: Record<string, unknown>[]) => ({
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

**Frontend Zustand Store Test Pattern:**
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

**Frontend Hook Test Pattern (jsdom required):**
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

**Frontend Component Test Pattern (jsdom, mocks):**
```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { AgChartWrapper } from './ag-chart-wrapper'

// Mock heavy dependencies
vi.mock('ag-charts-react', () => ({ AgCharts: () => null }))
vi.mock('@/lib/chart-themes', () => ({
  getAgChartsTheme: () => ({ palette: { fills: [], strokes: [] }, overrides: {} }),
}))

describe('AgChartWrapper -- Rules of Hooks guard', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => { consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}) })
  afterEach(() => { consoleErrorSpy.mockRestore(); cleanup() })

  it('renders isLoading state without hook count warnings', () => {
    render(<AgChartWrapper chartId="test" config={BASE_CONFIG} isLoading={true} />)
    for (const call of consoleErrorSpy.mock.calls) {
      expect(String(call[0] ?? '')).not.toMatch(/Rendered fewer hooks/)
    }
  })
})
```

**Backend Unit Test Pattern (sync functions):**
```python
def test_oracle_full_uri():
    """Oracle with all fields uses oracle:// dialect and service_name param."""
    result = build_sqlalchemy_uri(
        "oracle", host="orahost", port=1521, database="MYSERVICE",
        username="user", password="pass",
    )
    assert result == "oracle://user:pass@orahost:1521/?service_name=MYSERVICE"
```

**Backend Async Test Pattern:**
```python
@pytest.mark.asyncio
async def test_get_data_source():
    config = _sample_config("tlm_breaks", "dynamic")
    row = _make_data_source_row("tlm_breaks", "TLM Breaks", config)

    session = AsyncMock()
    session.get = AsyncMock(return_value=row)

    store = ConfigStore(session=session)
    result = await store.get_data_source("tlm_breaks")

    assert result is not None
    assert isinstance(result, DataSourceConfig)
    assert result.id == "tlm_breaks"
```

**Backend API Test Pattern (FastAPI TestClient):**
```python
def _create_test_app(session_mock: AsyncMock) -> FastAPI:
    """Create a minimal FastAPI app with mocked dependencies."""
    from app.api.managed_charts import router
    from app.core.dependencies import get_db_session

    test_app = FastAPI()
    test_app.include_router(router)

    async def override_db():
        yield session_mock

    test_app.dependency_overrides[get_db_session] = override_db
    return test_app

def test_create_managed_chart_returns_201():
    session = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()

    app = _create_test_app(session)
    client = TestClient(app)

    resp = client.post("/api/charts/managed", json=VALID_CREATE_BODY)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "My Chart"
```

## E2E Test Structure

**Shared fixtures in `frontend/e2e/_fixtures.ts`:**
```typescript
export const CURATED_DASHBOARDS = {
  sla: { id: 'dash-sla', name: 'Phase 10 · SLA Overview' },
  aging: { id: 'dash-aging', name: 'Phase 10 · Aging Analysis' },
  // ...
} as const

export async function waitForDashboardLoad(page: Page, dashboardName: string): Promise<void> {
  await page.locator('h1', { hasText: dashboardName }).waitFor({ state: 'visible', timeout: 15_000 })
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0, { timeout: 15_000 })
}
```

**E2E Test Pattern (Playwright):**
```typescript
import { expect, test } from '@playwright/test'
import { CURATED_DASHBOARDS, waitForDashboardLoad } from './_fixtures'

test.describe('Dashboard view route', () => {
  test('curated dashboard loads with title visible and no console errors', async ({ page }) => {
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

**E2E conventions:**
- Curated test entities seeded by `seed-postgres.py` (slugs in `_fixtures.ts`)
- `waitForDashboardLoad()` shared helper waits for h1 + all skeletons removed
- Console error capture via `page.on('console')` with filtering for expected noise
- Generous timeouts: 15s for dashboard load, 10s for element visibility, 5s for UI transitions
- `data-slot="skeleton"` used as stability indicator (0 skeletons = fully loaded)
- `test.setTimeout(60_000)` for tests involving Monaco editor or query execution

## Mocking

**Frontend -- Vitest `vi.mock()`:**
```typescript
// Module-level mock (hoisted automatically)
vi.mock('ag-charts-react', () => ({ AgCharts: () => null }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/chart-themes', () => ({
  getAgChartsTheme: () => ({ palette: { fills: [], strokes: [] }, overrides: {} }),
}))

// Per-test spies
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

// Fake timers
vi.useFakeTimers()
vi.advanceTimersByTime(61_000)
vi.useRealTimers()

// Browser API stubs
globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:test-url')
globalThis.URL.revokeObjectURL = vi.fn()
Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
```

**Backend -- `unittest.mock`:**
```python
from unittest.mock import AsyncMock, MagicMock, patch

# Mock ORM rows with spec
row = MagicMock(spec=RecvizDataSource)
row.id = "ds1"
row.config = {...}

# Mock async session
session = AsyncMock()
session.get = AsyncMock(return_value=row)
session.execute = AsyncMock(return_value=mock_result)
session.flush = AsyncMock()

# Mock async context manager (for engine.connect())
class _AsyncContextManager:
    def __init__(self, value):
        self._value = value
    async def __aenter__(self):
        return self._value
    async def __aexit__(self, *args):
        return False

# Patch module-level dependency
with patch("app.services.query_engine.async_session_factory", mock_factory):
    await executor.execute(ds, filters={})
```

**What to Mock:**
- External services (Superset, databases) -- always mock in unit tests
- AG Charts enterprise components (`ag-charts-react`) -- mock to avoid canvas/WebGL
- Browser APIs (`ResizeObserver`, `clipboard`, `URL.createObjectURL`) -- stub in jsdom
- Theme provider (`useTheme`) -- mock to return fixed theme in component tests
- DB sessions and ORM results -- mock with `AsyncMock` / `MagicMock`

**What NOT to Mock:**
- Pure functions (cross-filter, formatters, URL state, column detection) -- test directly
- Zustand stores -- test via `getState()` / `setState()` (no mocking needed)
- Pydantic models -- test validation directly
- Query utility functions -- test directly

## Fixtures and Factories

**Frontend -- inline factory helpers:**
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

function makeMeta(overrides: Partial<DatasetColumnMeta> & { name: string }): DatasetColumnMeta {
  return {
    displayName: overrides.name,
    dataType: 'string',
    role: 'dimension',
    aggregation: 'NONE',
    formatPreset: 'none',
    formatString: '',
    ...overrides,
  }
}
```

**Backend -- private factory functions (prefixed with underscore):**
```python
def _make_data_source_row(ds_id: str, name: str, config: dict) -> MagicMock:
    """Create a mock RecvizDataSource row."""
    row = MagicMock(spec=RecvizDataSource)
    row.id = ds_id
    row.name = name
    row.config = config
    return row

def _make_ds(
    ds_id: str = "test_ds",
    query: str = "SELECT * FROM test_table WHERE 1=1 {{filters}}",
    database: str = "test_db",
    routing_type: str = "static",
) -> DataSourceConfig:
    """Create a DataSourceConfig for testing."""
    return DataSourceConfig(id=ds_id, ...)
```

**Backend -- pytest fixtures:**
```python
@pytest.fixture
def mock_resolver():
    resolver = MagicMock()
    resolver.resolve = AsyncMock(return_value="uuid-1234")
    resolver.get_dialect.return_value = "postgresql"
    return resolver

@pytest.fixture
def mock_engine_manager():
    mgr = MagicMock()
    mgr.get_engine_for_connection = AsyncMock()
    return mgr
```

**E2E fixtures:** Curated entity catalog in `frontend/e2e/_fixtures.ts` -- shared across all specs. Entities are seeded by `seed-postgres.py` and verified by `test_seed_script.py`.

## Coverage

**Requirements:** None enforced. No coverage thresholds configured.

**View Coverage:**
```bash
cd frontend && npx vitest run --coverage  # Vitest coverage (requires @vitest/coverage-v8)
cd frontend && npx playwright test --reporter=list  # Playwright has built-in reporter
```

**Note:** Coverage tooling (`@vitest/coverage-v8` or `@vitest/coverage-istanbul`) is not in `package.json` devDependencies. Must be installed separately to generate coverage reports.

## Test Types

**Unit Tests (Frontend -- 17 files, ~2500 lines):**
- Pure logic: `cross-filter.test.ts`, `formatters.test.ts`, `kpi-aggregator.test.ts`, `kpi-utils.test.ts`, `dashboard-url-state.test.ts`, `chart-compatibility.test.ts`, `chart-export.test.ts`, `column-detection.test.ts`, `column-merge.test.ts`
- Store state: `filter-store.test.ts`, `drill-store.test.ts`
- Hook behavior: `use-auto-refresh.test.ts`
- Component rendering: `ag-chart-wrapper.rules-of-hooks.test.tsx`
- Scope: Test pure functions, store mutations, and hook lifecycle. No network calls.

**Unit Tests (Backend -- 19 files, ~4500 lines):**
- Service logic: `test_query_engine.py`, `test_config_store.py`, `test_merge_engine.py`, `test_uri_builder.py`, `test_encryption.py`, `test_connection_status.py`, `test_connection_resolver.py`, `test_engine_manager.py`, `test_query_utils.py`
- API endpoints: `test_managed_charts.py`, `test_managed_datasets.py`, `test_managed_kpis.py`, `test_databases_api.py`, `test_sql_api.py`, `test_search.py`
- Data integrity: `test_seed_script.py`, `test_portable_json.py`, `test_connection_model.py`
- Scope: Test services with mocked DB/engine. Test API endpoints with FastAPI TestClient + dependency overrides.

**E2E Tests (Frontend -- 10 files, ~1300 lines):**
- Dashboard rendering: `chart-showcase.spec.ts`, `dashboard-view-regression.spec.ts`, `parity-dashboards.spec.ts`
- Dashboard editing: `dashboard-edit-regression.spec.ts`, `parity-builder.spec.ts`
- Features: `embed.spec.ts`, `share-link.spec.ts`, `command-palette.spec.ts`
- Connections: `parity-connections.spec.ts`
- SQL Explorer: `parity-explorer.spec.ts`
- Scope: Full-stack tests requiring Docker + backend + frontend running. Test against seeded curated data.

**Integration Tests:**
- Not a distinct category. Backend API tests with `FastAPI.TestClient` serve as integration tests (test route -> handler -> mock service).
- E2E tests serve as true integration tests (browser -> frontend -> backend -> database).

## Common Patterns

**Async Testing (Backend):**
```python
@pytest.mark.asyncio
async def test_execute_calls_resolver_resolve(
    mock_resolver, mock_engine_manager, mock_status_tracker, mock_conn_record
):
    from app.services.query_engine import QueryExecutor

    ds = _make_ds(database="my_db")
    engine, _ = _build_mock_engine(rows=[(1, "a")], cursor_description=[...])
    mock_engine_manager.get_engine_for_connection.return_value = engine

    executor = QueryExecutor(
        engine_manager=mock_engine_manager,
        connection_resolver=mock_resolver,
        status_tracker=mock_status_tracker,
    )

    with _patch_session(mock_conn_record):
        await executor.execute(ds, filters={})

    mock_resolver.resolve.assert_awaited_once_with("my_db")
```

**Error Testing (Backend):**
```python
def test_resolve_database_dynamic_missing_filter_raises(mock_resolver):
    ds = _make_ds(routing_type="dynamic", route_by_filter="region", mapping={"US": "us_db"})
    executor = QueryExecutor(engine_manager=MagicMock(), connection_resolver=mock_resolver)

    with pytest.raises(ValueError, match="required filter"):
        executor._resolve_database(ds, filters={})
```

**Parametrized Testing (Backend):**
```python
@pytest.mark.parametrize("sql,label", [
    ("INSERT INTO users (name) VALUES ('x')", "INSERT"),
    ("DELETE FROM users WHERE id = 1", "DELETE"),
    ("DROP TABLE users", "DROP TABLE"),
])
def test_destructive_sql_rejected(self, sql, label):
    resp = client.post("/api/sql/execute", json={"sql": sql, "database_id": "uuid-1234"})
    assert resp.status_code == 400
```

**Class-based Test Organization (Backend -- larger test files):**
```python
class TestReadOnlyEnforcement:
    """Tests 2-7: POST /api/sql/execute with destructive SQL returns 400."""

    @pytest.mark.parametrize(...)
    def test_destructive_sql_rejected(self, sql, label):
        ...

class TestHistoryTracking:
    def test_success_records_history(self):
        ...
```

**Console Error Monitoring (E2E):**
```typescript
test('renders without console errors', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (text.includes('Failed to load resource')) return  // Filter noise
    consoleErrors.push(text)
  })

  await page.goto('/dashboards/dash-sla')
  await waitForDashboardLoad(page, 'Phase 10 · SLA Overview')
  expect(consoleErrors, consoleErrors.join('\n')).toHaveLength(0)
})
```

**FastAPI Dependency Override Pattern (Backend):**
```python
def _create_test_app():
    from app.api.sql import router
    from app.core.dependencies import get_db_session, get_engine_manager

    app = FastAPI()
    app.include_router(router)
    return app

def _override_deps(app, engine_manager=None, session=None):
    from app.core.dependencies import get_db_session, get_engine_manager

    if engine_manager is not None:
        app.dependency_overrides[get_engine_manager] = lambda: engine_manager
    if session is not None:
        async def override_session():
            yield session
        app.dependency_overrides[get_db_session] = override_session
```

## Where to Add New Tests

**New frontend pure logic:**
- Create `{module-name}.test.ts` next to the source file in `frontend/src/lib/`
- Import from `vitest`: `describe`, `it`, `expect`
- Use inline factory helpers for test data

**New frontend hook:**
- Create `use-{name}.test.ts` next to the hook in `frontend/src/hooks/`
- Add `// @vitest-environment jsdom` pragma at top
- Use `renderHook` from `@testing-library/react`

**New frontend component:**
- Create `{component-name}.test.tsx` next to the component
- Add `// @vitest-environment jsdom` pragma
- Mock heavy dependencies (AG Charts, Monaco, theme provider)

**New frontend store:**
- Create `{name}-store.test.ts` next to the store in `frontend/src/stores/`
- Reset store state in `beforeEach` via `useStore.setState()`
- Test via `useStore.getState().action()` + `useStore.getState().field`

**New E2E test:**
- Create `{feature}.spec.ts` in `frontend/e2e/`
- Import shared fixtures from `_fixtures.ts`
- Use `waitForDashboardLoad()` for dashboard-dependent tests

**New backend service test:**
- Create `test_{service_name}.py` in `backend/tests/`
- Use `@pytest.mark.asyncio` for async tests
- Create `_make_*` factory helpers and `@pytest.fixture` for shared mocks

**New backend API test:**
- Create `test_{router_name}.py` in `backend/tests/`
- Use `_create_test_app()` + `TestClient` + dependency overrides pattern
- Test all CRUD operations: 201 create, 200 read, 200 update, 204 delete, 404 not found

---

*Testing analysis: 2026-04-09*
