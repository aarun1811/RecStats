# Testing Patterns

**Analysis Date:** 2026-04-11

## Test Framework

**Frontend unit / component tests:**
- Vitest 4.1.2 — runner (`frontend/package.json`)
- Config: `frontend/vitest.config.ts`
- Environment: `node` by default; individual test files override to `jsdom` via top-of-file comment `// @vitest-environment jsdom` when they need DOM (component tests, hook tests)
- `globals: true` — no need to import `describe`/`it`/`expect` explicitly (though files typically do anyway for clarity)
- Aliases: `@` → `frontend/src`
- Excludes: `e2e/**`, `node_modules/**`
- jsdom 29.0.1 provides the DOM for `@vitest-environment jsdom` files

**Frontend component assertions:**
- `@testing-library/react` 16.3.2 — `render`, `screen`, `fireEvent`, `waitFor`, `renderHook`, `act`
- `@testing-library/jest-dom` 6.9.1 — DOM matchers (though tests typically use `toBeDefined()` / `toBeNull()` from Vitest directly)

**Frontend E2E:**
- Playwright 1.59.1 — config at `frontend/playwright.config.ts`
- Test dir: `frontend/e2e/`
- Browser: Chromium only (Desktop Chrome)
- `fullyParallel: false`, `workers: 1` — tests run sequentially to avoid cross-test state leakage (curated catalog is shared)
- Base URL: `http://localhost:5173`
- Test timeout: 30s, expect timeout: 10s
- `retries: 2` in CI, `0` locally
- Trace on first retry, screenshot only on failure
- `webServer`: auto-starts `pnpm dev` with `reuseExistingServer: true`

**Backend tests:**
- pytest (imported directly; not pinned in `backend/requirements.txt`, installed in local venv)
- Test dir: `backend/tests/`
- Shared fixture at `backend/tests/conftest.py` sets `RECVIZ_ENCRYPTION_KEY` env var before any `app.*` import happens at collection time

**Run Commands:**
```bash
# Frontend unit tests
cd frontend && pnpm vitest              # watch mode
cd frontend && pnpm vitest run          # single run

# Frontend E2E
cd frontend && npx playwright test --reporter=list
cd frontend && npx playwright test --ui

# Frontend lint
cd frontend && pnpm lint

# Backend tests
cd backend && source venv/bin/activate && pytest
cd backend && pytest tests/test_uri_builder.py -v
```

## Test File Organization

**Frontend unit tests — co-located:**
Unit and component tests live in the same directory as the source file with a `.test.ts` or `.test.tsx` suffix. Examples:
- `frontend/src/lib/cross-filter.ts` ↔ `frontend/src/lib/cross-filter.test.ts`
- `frontend/src/lib/formatters.ts` ↔ `frontend/src/lib/formatters.test.ts`
- `frontend/src/lib/kpi-aggregator.ts` ↔ `frontend/src/lib/kpi-aggregator.test.ts`
- `frontend/src/stores/filter-store.ts` ↔ `frontend/src/stores/filter-store.test.ts`
- `frontend/src/stores/drill-store.ts` ↔ `frontend/src/stores/drill-store.test.ts`
- `frontend/src/hooks/use-auto-refresh.ts` ↔ `frontend/src/hooks/use-auto-refresh.test.ts`
- `frontend/src/components/charts/chart-factory.tsx` ↔ `frontend/src/components/charts/chart-factory.test.tsx`
- `frontend/src/components/explorer/schema-browser.tsx` ↔ `frontend/src/components/explorer/schema-browser.test.tsx`

**Current unit test coverage areas:**
- `frontend/src/lib/` — most pure util modules have tests (cross-filter, column-detection, column-merge, chart-compatibility, chart-export, dashboard-url-state, formatters, kpi-aggregator, kpi-utils)
- `frontend/src/stores/` — filter-store, drill-store tests
- `frontend/src/hooks/` — use-auto-refresh only
- `frontend/src/components/` — sparse: chart-factory, ag-chart-wrapper, schema-browser, data-source-sheet

**Frontend E2E — flat under `frontend/e2e/`:**
- `frontend/e2e/_fixtures.ts` — shared test catalog (dashboard IDs, chart IDs, dataset IDs, KPI IDs, helper `waitForDashboardLoad`)
- `frontend/e2e/_dashboard-names.json` — seed mirror file
- `frontend/e2e/chart-showcase.spec.ts` — dashboard smoke across curated set
- `frontend/e2e/command-palette.spec.ts`
- `frontend/e2e/dashboard-view-regression.spec.ts`
- `frontend/e2e/dashboard-edit-regression.spec.ts`
- `frontend/e2e/embed.spec.ts` — `/embed/dashboards/:id` rendering
- `frontend/e2e/parity-builder.spec.ts`
- `frontend/e2e/parity-connections.spec.ts`
- `frontend/e2e/parity-dashboards.spec.ts`
- `frontend/e2e/parity-explorer.spec.ts`
- `frontend/e2e/share-link.spec.ts`

Leading underscore (`_fixtures.ts`, `_dashboard-names.json`) marks files that are NOT tests themselves — Playwright's default `testDir` picks up `*.spec.ts` only, so these are safe as regular imports.

**Backend tests — flat under `backend/tests/`:**
- `backend/tests/conftest.py` — global pytest config / env setup
- `backend/tests/test_connection_model.py`
- `backend/tests/test_connection_status.py`
- `backend/tests/test_db_status_persistence.py`
- `backend/tests/test_description_none_coercion.py` — Oracle-empty-string-as-null regression
- `backend/tests/test_encryption.py` — Fernet round-trips
- `backend/tests/test_merge_engine.py` — join logic for multi-dataset merge
- `backend/tests/test_portable_json.py`
- `backend/tests/test_query_utils.py`
- `backend/tests/test_schema_introspection.py`
- `backend/tests/test_seed_script.py` — cross-checks seed names against E2E `_dashboard-names.json`
- `backend/tests/test_test_connection_by_id.py`
- `backend/tests/test_uri_builder.py` — URI dialect tests
- `backend/tests/test_utc_datetime_fix.py`

**Test types NOT present:**
- No frontend snapshot tests
- No Storybook / visual regression
- No formal coverage config (`--coverage` works via Vitest default but isn't wired into CI)
- No pytest coverage config

## Test Structure

**Vitest unit test** — pure logic (from `frontend/src/lib/cross-filter.test.ts`):
```ts
import { describe, it, expect } from 'vitest'
import type { CrossFilter } from '@/types/filter'
import type { ChartDataResponse } from '@/types/chart'
import {
  applyCrossFilters,
  rowPassesCrossFilters,
  applyCrossFiltersToRows,
} from './cross-filter'

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

**Zustand store test** with `setState` reset (from `frontend/src/stores/filter-store.test.ts`):
```ts
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
  })
})
```

**Component test with jsdom** (from `frontend/src/components/charts/chart-factory.test.tsx`):
```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'

import { ChartFactory } from './chart-factory'

// Mock chart wrappers to avoid AG Charts/ECharts browser dependencies
vi.mock('./ag-chart-wrapper', () => ({
  AgChartWrapper: (props: { config?: { vizType?: string } }) => (
    React.createElement('div', { 'data-testid': 'ag-chart', 'data-viztype': props.config?.vizType })
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

**Hook test with fake timers** (from `frontend/src/hooks/use-auto-refresh.test.ts`):
```ts
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

**Playwright E2E** (from `frontend/e2e/chart-showcase.spec.ts`):
```ts
import { expect, test } from '@playwright/test'
import { CURATED_DASHBOARDS, waitForDashboardLoad } from './_fixtures'

for (const [key, dashboard] of Object.entries(CURATED_DASHBOARDS)) {
  test.describe(`${dashboard.name} (${key})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/dashboards/${dashboard.id}`)
      await waitForDashboardLoad(page, dashboard.name)
    })

    test('renders without error panels', async ({ page }) => {
      await expect(page.locator('text=Failed to load')).toHaveCount(0)
      await expect(page.locator('text=Dashboard not found')).toHaveCount(0)
    })
  })
}
```

**Pytest** — pure logic, no fixtures needed (from `backend/tests/test_uri_builder.py`):
```python
import pytest
from app.services.uri_builder import build_sqlalchemy_uri

def test_oracle_full_uri():
    """Oracle with all fields uses oracle:// dialect and service_name param."""
    result = build_sqlalchemy_uri(
        "oracle", host="orahost", port=1521, database="MYSERVICE",
        username="user", password="pass",
    )
    assert result == "oracle://user:pass@orahost:1521/?service_name=MYSERVICE"
```

**Pytest with TestClass grouping** (from `backend/tests/test_encryption.py`):
```python
class TestEncryptionRoundTrip:
    """Verify encrypt/decrypt round-trips produce the original plaintext."""

    def test_round_trip_simple_password(self):
        key = Fernet.generate_key().decode()
        svc = EncryptionService(key)
        plaintext = "simple_password_123"
        assert svc.decrypt(svc.encrypt(plaintext)) == plaintext
```

**Patterns:**
- Setup: `beforeEach` (Vitest) / `test.beforeEach` (Playwright) / `setup` fixtures (pytest)
- Teardown: `afterEach` (Vitest) with `vi.useRealTimers()` etc.
- Assertions: `expect(x).toBe(y)`, `expect(x).toHaveLength(n)`, `expect(x).toEqual({...})`, `expect(locator).toBeVisible()`, `expect(locator).toHaveCount(n)` for Playwright
- Python: plain `assert` statements (no assertion library)

## Mocking

**Framework:** `vi.mock()` + `vi.fn()` from Vitest. No MSW for frontend (no API request mocking at the network layer).

**Mock external chart libs** to avoid browser deps in jsdom (from `frontend/src/components/charts/chart-factory.test.tsx`):
```tsx
vi.mock('./ag-chart-wrapper', () => ({
  AgChartWrapper: (props: { config?: { vizType?: string } }) => (
    React.createElement('div', { 'data-testid': 'ag-chart', 'data-viztype': props.config?.vizType })
  ),
}))
vi.mock('./echart-wrapper', () => ({
  EChartWrapper: (props: { config?: { vizType?: string } }) => (
    React.createElement('div', { 'data-testid': 'echart', 'data-viztype': props.config?.vizType })
  ),
}))
```

**Mock custom hooks** so the component under test gets a controlled data shape (from `frontend/src/components/explorer/schema-browser.test.tsx`):
```tsx
vi.mock('@/hooks/use-databases', () => ({
  useDatabases: () => ({
    data: [
      { id: 'db-1', databaseName: 'Prod Oracle', backend: 'oracle', status: 'connected', ... },
    ],
    isLoading: false,
  }),
}))

vi.mock('@/hooks/use-tables', () => ({
  useTables: (dbId: string | null) => ({
    data: dbId ? [...] : undefined,
    isLoading: false,
    error: null,
  }),
}))
```

**Mock factory pattern** — export a `vi.fn()` as part of the module so tests can inspect call history:
```tsx
vi.mock('@/hooks/use-table-columns', () => {
  const mockFn = vi.fn((_dbId, tableName) => ({ ... }))
  return { useTableColumns: mockFn, __mockFn: mockFn }
})

// Then in the test:
const useTableColumnsMock = (useTableColumnsModule as unknown as {
  __mockFn: ReturnType<typeof vi.fn>
}).__mockFn

beforeEach(() => { useTableColumnsMock.mockClear() })
```

**Wrap rendered components in QueryClientProvider** for component tests that use TanStack Query hooks:
```tsx
function renderWithQuery(ui: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}
```

**What to mock:**
- External chart libs (AG Charts, ECharts) — too heavy for jsdom
- Custom data-fetching hooks — gives the component under test controlled data without needing a real server
- Timers via `vi.useFakeTimers()` — for hooks that use `setInterval`/`setTimeout`

**What NOT to mock:**
- Pure utility functions — test them directly
- Zustand stores — use `useFilterStore.setState({...})` to seed state (see `frontend/src/stores/filter-store.test.ts`)
- Query client defaults — instantiate a fresh `QueryClient` in the test helper

**Backend mocking:**
Backend tests currently avoid mocks entirely — they test pure logic (encryption, URI building, merge engine, query utils) or instantiate real SQLAlchemy ORM objects in-memory with fixed values (see `backend/tests/test_description_none_coercion.py`).

## Fixtures and Factories

**Frontend E2E — shared fixture module:**
`frontend/e2e/_fixtures.ts` is the single source of truth for the curated test catalog:
- `DASHBOARD_NAMES` — slug → display name (Oracle-compatible)
- `CURATED_DASHBOARDS` — 5 dashboards keyed by short handle
- `CURATED_CHARTS` — 22 charts covering all 18 working chart types
- `CURATED_DATASETS` — 16 datasets
- `CURATED_KPIS` — 12 KPIs
- `waitForDashboardLoad(page, dashboardName)` — helper that waits for the `<h1>` to be visible and all `[data-slot="skeleton"]` instances to disappear

Seed script mirrors these names character-for-character; `backend/tests/test_seed_script.py` cross-checks via `test_dashboard_names_match_fixtures`.

**Frontend unit tests — inline factories:**
Small inline helpers declared inside `describe` blocks, e.g. `makeData` in `frontend/src/lib/cross-filter.test.ts`. No standalone factory modules.

**Backend — in-test ORM instances:**
Tests construct `RecvizDashboard`, `RecvizKpi`, etc. ORM instances with hardcoded field values and pass them to the `_to_response` helpers directly — see `backend/tests/test_description_none_coercion.py`. No factory library like `factory_boy`.

## Coverage

**Frontend:** No coverage threshold enforced. Vitest supports `--coverage` via c8/istanbul but it is not wired into CI or the `package.json` scripts.

**Backend:** No coverage config. `pytest-cov` not in `backend/requirements.txt`.

**Known gap:** 10 async-mocked backend test files were deleted in the Unit 0 cleanup (post-Superset pivot). Seven API surface areas currently have zero regression tests:
- `backend/app/api/data_sources.py`
- `backend/app/api/databases.py`
- `backend/app/api/managed_charts.py` (partial coverage via `test_description_none_coercion.py` only)
- `backend/app/api/managed_kpis.py` (partial coverage via `test_description_none_coercion.py` only)
- `backend/app/api/managed_datasets.py` (partial coverage via `test_description_none_coercion.py` only)
- `backend/app/api/search.py`
- `backend/app/api/sql.py`

When restoring tests for these routes, prefer the `fastapi.testclient.TestClient` + real in-memory SQLite pattern over async mocks — the Unit 0 cleanup removed the async-mocked versions specifically because they broke after the sync-handler + sync-session conversion.

## Test Types

**Unit Tests (Vitest):**
- Scope: pure functions, Zustand stores, individual hooks, isolated components
- Approach: no network, mock external heavy deps, test behavior not implementation
- Location: co-located `.test.ts(x)` files

**Component Tests (Vitest + @testing-library/react + jsdom):**
- Scope: single component with mocked hooks / providers
- Approach: render, query with `screen.getByText/getByTestId/getByPlaceholderText`, fire events with `fireEvent`, assert DOM
- Must opt into jsdom via `// @vitest-environment jsdom` at the top of the file
- Wrap in `QueryClientProvider` when the component uses TanStack Query

**Integration Tests (pytest):**
- Scope: service-level logic with real SQLAlchemy / real Fernet / real ORM models but no external I/O
- Approach: construct objects in memory, call service methods, assert outputs
- Examples: `backend/tests/test_merge_engine.py`, `backend/tests/test_encryption.py`, `backend/tests/test_uri_builder.py`, `backend/tests/test_connection_status.py`

**E2E Tests (Playwright):**
- Scope: full stack — frontend dev server + FastAPI backend + PostgreSQL + seeded curated catalog
- Approach: navigate, wait for load, assert on visible DOM + absence of error panels, verify KPI numeric rendering, verify chart canvas/ECharts instance presence
- Prerequisites (documented at top of `frontend/playwright.config.ts`): Docker Compose running, FastAPI backend running, seeded curated catalog
- Sequential execution (`workers: 1`) to avoid cross-test state leakage

## Common Patterns

**Async testing (Vitest):**
```ts
it('filters tables by the search input', async () => {
  renderWithQuery(<SchemaBrowser onInsertTable={vi.fn()} onInsertColumn={vi.fn()} />)
  const filter = screen.getByPlaceholderText(/filter/i)
  fireEvent.change(filter, { target: { value: 'message' } })
  await waitFor(() => {
    expect(screen.getByText('MESSAGE_FEED')).toBeDefined()
    expect(screen.queryByText('ITEMS')).toBeNull()
  })
})
```

**Timer testing (Vitest):**
```ts
beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

it('calls onRefresh after intervalMs elapses', () => {
  const onRefresh = vi.fn()
  renderHook(() => useAutoRefresh(60_000, onRefresh))
  act(() => { vi.advanceTimersByTime(61_000) })
  expect(onRefresh).toHaveBeenCalledTimes(1)
})
```

**Playwright wait-for-stable pattern** (from `frontend/e2e/_fixtures.ts`):
```ts
export async function waitForDashboardLoad(page: Page, dashboardName: string): Promise<void> {
  await page
    .locator('h1', { hasText: dashboardName })
    .waitFor({ state: 'visible', timeout: 15_000 })
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0, {
    timeout: 15_000,
  })
}
```

**Playwright console error assertion** (from `frontend/e2e/dashboard-view-regression.spec.ts`):
```ts
const consoleErrors: string[] = []
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text())
})
await page.goto(`/dashboards/${volume.id}`)
await waitForDashboardLoad(page, volume.name)
expect(consoleErrors, consoleErrors.join('\n')).toHaveLength(0)
```

**Python test env setup** (from `backend/tests/conftest.py`):
```python
"""Sets required environment variables before app modules are imported
at collection time."""
import os
os.environ.setdefault(
    "RECVIZ_ENCRYPTION_KEY",
    "test-encryption-key-do-not-use-in-prod",
)
```
This runs at pytest collection time so `from app.config import settings` doesn't blow up for any test file that transitively imports it.

**Error path testing (pytest):**
Tests exercise both happy-path AND known-bug regressions. The Oracle-empty-string-as-null regression in `backend/tests/test_description_none_coercion.py` has one test per managed entity (`_to_response` in `managed_kpis.py`, `managed_datasets.py`, `managed_charts.py`, `managed_dashboards.py`) — all four tests are required because each entity has its own helper and regressions tend to cover three but miss the fourth.

---

*Testing analysis: 2026-04-11*
