<!-- generated-by: gsd-doc-writer -->
# Testing

RecViz uses a multi-layer testing strategy covering the frontend (React/TypeScript) and backend (Python/FastAPI) independently. Unit tests run with Vitest (frontend) and pytest (backend). End-to-end tests use Playwright against the full stack.

## Test Framework and Setup

### Frontend: Vitest

- **Framework:** Vitest 4.1.2
- **Environment:** `node` by default (per `vitest.config.ts`); individual test files can opt into `jsdom` via the `// @vitest-environment jsdom` pragma
- **DOM testing:** `@testing-library/react` 16.3.2 and `@testing-library/jest-dom` 6.9.1 for component rendering and assertions
- **Configuration:** `frontend/vitest.config.ts`
- **Globals:** `true` (describe, it, expect available without imports, though most test files import them explicitly)
- **Path alias:** `@` maps to `frontend/src/`
- **Exclusions:** `e2e/**` and `node_modules/**` are excluded from the Vitest runner

### Frontend: Playwright (E2E)

- **Framework:** Playwright 1.59.1
- **Configuration:** `frontend/playwright.config.ts`
- **Test directory:** `frontend/e2e/`
- **Browser:** Chromium (Desktop Chrome) only
- **Base URL:** `http://localhost:5173`
- **Timeout:** 30 seconds per test, 10 seconds for expect assertions
- **Retries:** 0 locally, 2 in CI
- **Workers:** 1 (sequential execution; `fullyParallel: false`)
- **Reporter:** HTML
- **Web server:** Auto-starts `pnpm dev` if no server is already running on port 5173 (120-second startup timeout)
- **Prerequisites:** The full stack (Docker Compose, Superset, FastAPI backend) must be running before E2E tests execute

### Backend: pytest

- **Framework:** pytest (available via system Python / pyenv; not listed in `backend/requirements.txt`)
- **Async support:** Tests use `@pytest.mark.asyncio` for async test functions (requires `pytest-asyncio`)
- **HTTP testing:** FastAPI's `TestClient` for synchronous endpoint tests
- **Mocking:** `unittest.mock` (AsyncMock, MagicMock)
- **Test directory:** `backend/tests/`

## Running Tests

### Frontend Unit Tests (Vitest)

Run the full frontend unit test suite:

```bash
cd frontend
npx vitest run
```

Run tests in watch mode during development:

```bash
cd frontend
npx vitest
```

Run a specific test file:

```bash
cd frontend
npx vitest run src/lib/formatters.test.ts
```

Run tests matching a pattern:

```bash
cd frontend
npx vitest run -t "formatValue"
```

### Frontend E2E Tests (Playwright)

E2E tests require the full stack to be running. Start the infrastructure first:

```bash
# Terminal 1: Docker services (PostgreSQL + Redis)
docker compose up -d

# Terminal 2: Superset
# (must be running before backend)

# Terminal 3: FastAPI backend
cd backend
uvicorn app.main:app --reload

# Terminal 4: Run E2E tests (auto-starts frontend dev server if needed)
cd frontend
npx playwright test --reporter=list
```

Run a specific E2E spec:

```bash
cd frontend
npx playwright test e2e/chart-showcase.spec.ts
```

View the HTML report after a test run:

```bash
cd frontend
npx playwright show-report
```

### Backend Tests (pytest)

Run the full backend test suite:

```bash
cd backend
pytest tests/ -v
```

Run a specific test file:

```bash
cd backend
pytest tests/test_query_engine.py -v
```

Run tests matching a keyword:

```bash
cd backend
pytest tests/ -k "database" -v
```

## Writing New Tests

### Frontend Unit Tests

**File naming:** `{name}.test.ts` for pure logic, `{name}.test.tsx` for component tests. Test files live alongside the source file they test.

**Current test file locations:**

| File | Tests |
|------|-------|
| `src/lib/formatters.test.ts` | Number, currency, percentage, and decimal formatting |
| `src/lib/cross-filter.test.ts` | Cross-filter application and row filtering logic |
| `src/lib/kpi-aggregator.test.ts` | KPI recomputation with cross-filter support |
| `src/lib/chart-export.test.ts` | CSV/TSV building, filename sanitization, clipboard copy |
| `src/lib/column-detection.test.ts` | Auto-detection of column types and roles |
| `src/lib/column-merge.test.ts` | Column merge strategy (unchanged/new/missing) |
| `src/lib/chart-compatibility.test.ts` | Chart type compatibility with dataset shapes |
| `src/stores/filter-store.test.ts` | Zustand filter store cross-filter actions |
| `src/stores/drill-store.test.ts` | Zustand drill store navigation actions |
| `src/hooks/use-auto-refresh.test.ts` | Auto-refresh hook with timer and countdown |
| `src/components/charts/ag-chart-wrapper.test.ts` | AG Charts series building for all chart types |
| `src/components/charts/chart-factory.test.tsx` | Chart factory routing (AG Charts vs ECharts) |
| `src/components/dashboard/grid-toolbar.test.tsx` | Grid toolbar rendering and button interactions |

**Patterns used in existing tests:**

- **Pure logic tests** import from `vitest` and test functions directly. No DOM environment needed:
  ```ts
  import { describe, it, expect } from 'vitest'
  import { myFunction } from './my-module'

  describe('myFunction', () => {
    it('does something', () => {
      expect(myFunction(input)).toBe(expected)
    })
  })
  ```

- **Component tests** use the `// @vitest-environment jsdom` pragma and `@testing-library/react`:
  ```tsx
  // @vitest-environment jsdom
  import { describe, it, expect, vi } from 'vitest'
  import { render, screen } from '@testing-library/react'
  import { MyComponent } from './my-component'

  describe('MyComponent', () => {
    it('renders correctly', () => {
      render(<MyComponent prop="value" />)
      expect(screen.getByText('value')).toBeDefined()
    })
  })
  ```

- **Hook tests** use `renderHook` from `@testing-library/react` with `vi.useFakeTimers()` for time-dependent behavior.

- **Mocking:** Use `vi.mock()` for module mocking (e.g., `sonner` for toast notifications, chart wrapper components to avoid browser dependencies).

- **Zustand store tests** use `store.getState()` and `store.setState()` directly, with `beforeEach` to reset state.

### Frontend E2E Tests

**File naming:** `{name}.spec.ts` in the `frontend/e2e/` directory.

**Current E2E specs:**

| File | Tests |
|------|-------|
| `e2e/chart-showcase.spec.ts` | All 12 chart types render, cross-filter interaction, drill-down interaction |
| `e2e/tlm-stats-regression.spec.ts` | TLM Stats dashboard loads and renders without column mapping errors |

**Patterns:**

- Tests navigate to a dashboard URL and wait for loading skeletons to disappear before asserting
- Chart rendering validation checks for `<canvas>` elements (AG Charts) or `[_echarts_instance_]` attributes (ECharts)
- Interactive tests (cross-filter, drill-down) click on canvas elements at approximate coordinates and check for UI state changes
- A separate TypeScript config (`tsconfig.e2e.json`) targets ES2023 without DOM libs

### Backend Tests

**File naming:** `test_{name}.py` in `backend/tests/`.

**Current test files:**

| File | Tests |
|------|-------|
| `tests/test_config_store.py` | Dashboard and data source config loading |
| `tests/test_connection_status.py` | Database connection status tracking |
| `tests/test_uri_builder.py` | SQLAlchemy URI construction (Oracle, Hive, PostgreSQL) |
| `tests/test_database_registrar.py` | Database registration and Superset ID resolution |
| `tests/test_dataset_sync.py` | Dataset CRUD sync with Superset, reconciliation |
| `tests/test_managed_datasets.py` | Managed dataset API endpoints (CRUD, references, validation) |
| `tests/test_managed_charts.py` | Managed chart API endpoints (CRUD, references, dataset blocking) |
| `tests/test_merge_engine.py` | Multi-result merge (inner join, outer join) |
| `tests/test_query_engine.py` | SQL building, filter injection, dialect handling, schema stripping |

**Patterns used in existing tests:**

- **Service unit tests** instantiate the service class directly with mocked dependencies:
  ```python
  def test_something():
      service = MyService(dependency=MagicMock())
      result = service.method(input)
      assert result == expected
  ```

- **Async tests** use `@pytest.mark.asyncio` with `AsyncMock`:
  ```python
  @pytest.mark.asyncio
  async def test_async_operation():
      mock_client = AsyncMock()
      mock_client.some_method = AsyncMock(return_value={"id": 1})
      service = MyService(client=mock_client)
      result = await service.do_something()
      assert result == 1
  ```

- **API endpoint tests** use FastAPI's `TestClient` with dependency overrides:
  ```python
  def test_endpoint():
      session = AsyncMock()
      app = FastAPI()
      app.include_router(router)
      app.dependency_overrides[get_db_session] = lambda: session
      client = TestClient(app)
      resp = client.get("/api/endpoint")
      assert resp.status_code == 200
  ```

## Coverage Requirements

No coverage threshold is configured for either the frontend or backend test suites. Coverage reporting is not currently set up in `vitest.config.ts` or pytest configuration.

## CI Integration

No CI/CD pipeline is currently configured for the project. There are no `.github/workflows/` files in the repository. Tests are run manually during local development.

**Recommended local workflow before committing:**

```bash
# Frontend unit tests
cd frontend && npx vitest run

# Backend tests
cd backend && pytest tests/ -v

# E2E tests (requires full stack running)
cd frontend && npx playwright test --reporter=list
```
