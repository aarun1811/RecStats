# Testing Patterns

**Analysis Date:** 2026-04-04

## Test Framework

**Backend (Python):**

**Runner:**
- pytest (version not pinned in `requirements.txt` but present via `.pytest_cache`)
- pytest-asyncio for async test support
- No config file (`pytest.ini`, `pyproject.toml`, `conftest.py` not present)

**Assertion Library:**
- Built-in `assert` statements (pytest native)

**Mocking:**
- `unittest.mock` (`MagicMock`, `AsyncMock`)

**Run Commands:**
```bash
cd backend && python -m pytest tests/       # Run all tests
cd backend && python -m pytest tests/ -v     # Verbose output
cd backend && python -m pytest tests/test_query_engine.py  # Single file
```

**Frontend (TypeScript/React):**

**Runner:**
- No test framework configured. No vitest, jest, or testing-library in `package.json`
- No test files exist in `frontend/src/`
- No test scripts in `frontend/package.json`

**Status:** Frontend testing is **completely absent**. There are zero test files, no test runner installed, and no test configuration.

## Test File Organization

**Backend:**

**Location:**
- Separate `backend/tests/` directory (not co-located with source)

**Naming:**
- `test_{module_name}.py` (e.g., `test_config_store.py`, `test_query_engine.py`)

**Structure:**
```
backend/
├── tests/
│   ├── __init__.py
│   ├── test_config_store.py       # Tests for ConfigStore service
│   ├── test_database_registrar.py # Tests for DatabaseRegistrar service
│   ├── test_merge_engine.py       # Tests for MergeEngine service
│   └── test_query_engine.py       # Tests for QueryEngine service
```

**Frontend:**
```
# No test files exist. Expected pattern (from CLAUDE.md):
frontend/src/
├── components/
│   └── dashboard/
│       ├── kpi-card.tsx
│       └── kpi-card.test.tsx      # Co-located (convention, not yet created)
├── hooks/
│   └── use-chart-data.test.ts     # Co-located (convention, not yet created)
└── lib/
    └── cross-filter.test.ts       # Co-located (convention, not yet created)
```

## Test Structure (Backend)

**Suite Organization:**
```python
# Pattern from backend/tests/test_query_engine.py
import pytest
from unittest.mock import MagicMock

from app.services.query_engine import QueryEngine
from app.services.config_store import ConfigStore


@pytest.fixture
def mock_registrar():
    registrar = MagicMock()
    registrar.get_dialect.return_value = "oracle"
    registrar.get_schema.return_value = ""
    registrar.get_all_schemas.return_value = {"reconmgmt"}
    return registrar


@pytest.fixture
def engine(mock_registrar):
    return QueryEngine(
        config_store=ConfigStore(),
        superset_client=MagicMock(),
        database_registrar=mock_registrar,
    )


def test_build_sql_with_filters(engine):
    sql = engine._build_sql(
        data_source_id="tlm_breaks",
        filters={"recon": ["AGENT_01"], "date_range": 1},
    )
    assert "b.agent_code IN ('AGENT_01')" in sql
    assert "flag_2 = 0" in sql
```

**Patterns:**
- Fixtures defined at file scope using `@pytest.fixture`
- Fixtures compose: `engine` fixture takes `mock_registrar` fixture as parameter
- Tests are standalone functions (not classes)
- Test function naming: `test_{what_is_tested}` (e.g., `test_build_sql_with_filters`, `test_resolve_database_dynamic`)
- Descriptive names that encode the scenario being tested

**Async Testing:**
```python
# Pattern from backend/tests/test_database_registrar.py
@pytest.mark.asyncio
async def test_sync_creates_missing_databases():
    superset = _make_superset_mock(existing_dbs=[])
    registrar = DatabaseRegistrar(superset_client=superset, config_path=None)
    registrar._entries = _make_entries()
    await registrar.sync()
    assert superset.create_database.call_count == 2
```

## Mocking

**Framework:** `unittest.mock` (stdlib)

**Patterns:**

**MagicMock for sync dependencies:**
```python
# Pattern from backend/tests/test_query_engine.py
@pytest.fixture
def mock_registrar():
    registrar = MagicMock()
    registrar.get_dialect.return_value = "oracle"
    registrar.get_schema.return_value = ""
    registrar.get_all_schemas.return_value = {"reconmgmt"}
    return registrar
```

**AsyncMock for async dependencies:**
```python
# Pattern from backend/tests/test_database_registrar.py
def _make_superset_mock(existing_dbs: list[dict] | None = None) -> AsyncMock:
    mock = AsyncMock()
    mock.list_databases = AsyncMock(return_value=existing_dbs or [])
    mock.create_database = AsyncMock(
        side_effect=lambda payload: {"id": 99, "result": {"id": 99}}
    )
    return mock
```

**What is mocked:**
- External service clients (SupersetClient mocked as `AsyncMock`)
- Database registrar (mocked with `MagicMock` when testing QueryEngine)
- Return values set via `return_value` and `side_effect`

**What is NOT mocked:**
- `ConfigStore` is used with real config files (reads from `backend/app/config/`)
- `MergeEngine` is tested with real data (pure function, no dependencies)
- Pydantic models are constructed with real data

**Direct internal method testing:**
- Tests access private methods directly (e.g., `engine._build_sql(...)`, `engine._resolve_database(...)`)
- This is intentional for unit testing SQL generation and routing logic

## Fixtures and Factories

**Test Data:**
```python
# Pattern: Helper functions that create test fixtures
# From backend/tests/test_database_registrar.py
def _make_entries() -> list[DatabaseEntry]:
    return [
        DatabaseEntry(
            name="db_one",
            display_name="DB One",
            sqlalchemy_uri="sqlite:///test.db",
            dialect="sqlite",
            schema_name="",
            type="test",
        ),
    ]

# Pattern: Inline dict literals for merge test data
# From backend/tests/test_merge_engine.py
def test_outer_join():
    left = {
        "columns": ["agent_code", "set_id", "total_items"],
        "rows": [
            {"agent_code": "A1", "set_id": "S1", "total_items": 100},
        ],
        "row_count": 1,
    }
```

**Location:**
- Fixtures defined within each test file (no shared `conftest.py`)
- Factory helper functions prefixed with `_make_` (e.g., `_make_entries`, `_make_superset_mock`)

## Coverage

**Requirements:** No coverage requirements enforced. No coverage tool configured.

**View Coverage:**
```bash
# Not currently set up. To add:
cd backend && python -m pytest tests/ --cov=app --cov-report=term-missing
```

## Test Types

**Unit Tests (backend only):**
- `backend/tests/test_config_store.py` (5 tests): ConfigStore loading, lookup, missing items
- `backend/tests/test_query_engine.py` (10 tests): SQL building, filter injection, dialect switching, schema stripping, SQL injection prevention
- `backend/tests/test_merge_engine.py` (3 tests): Outer join, inner join, empty data
- `backend/tests/test_database_registrar.py` (8 tests): Sync, resolve, caching, negative cache, dialect/schema lookup

**Integration Tests:**
- Not present. No tests exercise FastAPI endpoints (no `TestClient` usage).
- No tests for the Superset proxy chain or end-to-end API flows.

**E2E Tests:**
- Not present. No Playwright, Cypress, or similar framework.

**Frontend Tests:**
- Not present. No test files, no test framework, no test runner.

## Common Test Patterns

**Async Testing:**
```python
# Decorator pattern used consistently
@pytest.mark.asyncio
async def test_sync_creates_missing_databases():
    superset = _make_superset_mock(existing_dbs=[])
    registrar = DatabaseRegistrar(superset_client=superset, config_path=None)
    registrar._entries = _make_entries()
    await registrar.sync()
    assert superset.create_database.call_count == 2
```

**Error/Exception Testing:**
```python
# Pattern: pytest.raises with match string
def test_resolve_database_dynamic_missing_filter(engine):
    with pytest.raises(ValueError, match="required filter"):
        engine._resolve_database(
            data_source_id="tlm_breaks",
            filters={},
        )

# Pattern: Testing invalid input
def test_build_sql_invalid_column_raises(engine):
    with pytest.raises(ValueError, match="not in data source"):
        engine._build_sql(
            data_source_id="reconmgmt_recon_bank",
            filters={},
            column="malicious_column",
        )
```

**Assertion Patterns:**
```python
# String containment for SQL output
assert "b.agent_code IN ('AGENT_01')" in sql
assert "reconmgmt." not in sql

# Exact equality
assert result["row_count"] == 3
assert db_id == "superset_db_TCOSPRD"

# None checks
assert config is None
assert ds is not None

# Collection membership
assert "myschema" in schemas

# Call counting on mocks
assert superset.create_database.call_count == 2
```

**Fixture Composition:**
```python
# Fixtures can depend on other fixtures
@pytest.fixture
def mock_registrar():
    registrar = MagicMock()
    registrar.get_dialect.return_value = "oracle"
    return registrar

@pytest.fixture
def engine(mock_registrar):  # <-- takes mock_registrar fixture
    return QueryEngine(
        config_store=ConfigStore(),
        superset_client=MagicMock(),
        database_registrar=mock_registrar,
    )
```

**Internal state manipulation for testing:**
```python
# Pattern: Setting internal state directly to test edge cases
# From backend/tests/test_database_registrar.py
registrar._cache.clear()
registrar._last_refresh = 0.0
```

## Test Gaps and Recommendations

**Critical gaps:**
1. **No frontend tests at all** -- zero test files, no runner configured
2. **No API endpoint tests** -- FastAPI `TestClient` not used anywhere
3. **No `conftest.py`** -- shared fixtures would reduce duplication across test files
4. **No coverage tracking** -- no enforcement of minimum coverage

**What should be tested first (by priority):**
1. `frontend/src/lib/cross-filter.ts` -- Pure logic, easy to unit test
2. `frontend/src/lib/api-client.ts` -- Core data layer
3. `frontend/src/hooks/use-drill-down.ts` -- Complex re-aggregation logic (`applyDrillFilters`, `drillRowFilter`)
4. Backend API endpoints via `TestClient` -- integration tests for `/api/dashboards/*`, `/api/data-sources/*`
5. `frontend/src/stores/filter-store.ts` -- State management correctness

**To set up frontend testing, install:**
```bash
cd frontend && pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Then create `frontend/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

---

*Testing analysis: 2026-04-04*
