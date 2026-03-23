# RecViz Real Data Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace mock data with a real database pipeline routed through Apache Superset, working locally with a SQLite seed database and in production with ~35 Oracle databases.

**Architecture:** Three-layer config model — `databases.json` (where to connect) → data source configs (how to query) → dashboard configs (what to show). FastAPI's QueryEngine builds SQL from templates, resolves database routing via DatabaseRegistrar, and executes via Superset's SQL Lab API.

**Tech Stack:** Python 3.12, FastAPI, Pydantic v2, httpx, Apache Superset 6.0.0, SQLite (dev), Oracle + oracledb (prod)

**Spec:** `docs/superpowers/specs/2026-03-23-recviz-superset-real-data-pipeline-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|----------------|
| `backend/app/models/database_config.py` | Pydantic models: DatabaseEntry, DatabasesConfig |
| `backend/app/services/database_registrar.py` | Syncs databases.json into Superset, caches name → Superset numeric ID, provides resolve/dialect/schema accessors |
| `backend/app/config/databases.json` | Database registry — logical names → SQLAlchemy URIs (env-specific) |
| `backend/app/config/seed/` | Directory for generated seed.db (gitignored) |
| `backend/tests/test_database_registrar.py` | Tests for DatabaseRegistrar sync, resolve, negative cache |
| `superset/superset_config_local.py` | Lightweight Superset config (SQLite metadata + SimpleCache, no Redis) |
| `scripts/setup-superset-local.sh` | One-time Superset bootstrap script |
| `scripts/generate-seed-db.py` | Generates 1M+ row SQLite seed database |

### Modified Files

| File | Change |
|------|--------|
| `backend/app/services/config_store.py` | Load from `config/` instead of `mock/` |
| `backend/app/services/query_engine.py` | Remove mock path, add DatabaseRegistrar for ID resolution, add SQLite dialect, schema stripping |
| `backend/app/services/superset_client.py` | Remove hardcoded `schema="public"` default in `execute_sql()` |
| `backend/app/main.py` | Updated lifespan — hard Superset requirement, DatabaseRegistrar init |
| `backend/app/config.py` | Add `databases_config_path` setting |
| `backend/tests/test_query_engine.py` | Update fixture to use new QueryEngine constructor, add dialect/schema tests |
| `backend/tests/test_config_store.py` | Update to load from `config/` |

### Moved (Rename)

| From | To |
|------|-----|
| `backend/app/mock/dashboards/` | `backend/app/config/dashboards/` |
| `backend/app/mock/data_sources/` | `backend/app/config/data_sources/` |

### Deleted Files

| File | Reason |
|------|--------|
| `backend/app/mock/query_results.py` | No more mock fallback |
| `backend/app/mock/__init__.py` | Directory removed |

---

## Task 1: Config Directory Restructure

**Files:**
- Move: `backend/app/mock/dashboards/` → `backend/app/config/dashboards/`
- Move: `backend/app/mock/data_sources/` → `backend/app/config/data_sources/`
- Modify: `backend/app/services/config_store.py`

Note: `backend/app/mock/query_results.py` and `backend/app/mock/__init__.py` are NOT deleted here — `query_engine.py` still imports from mock until Task 6. They are deleted in Task 6 after the QueryEngine is refactored.

- [ ] **Step 1: Move config directories**

```bash
cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz
mkdir -p backend/app/config
git mv backend/app/mock/dashboards backend/app/config/dashboards
git mv backend/app/mock/data_sources backend/app/config/data_sources
```

- [ ] **Step 2: Update ConfigStore to load from config/**

In `backend/app/services/config_store.py`, change `MOCK_DIR` to `CONFIG_DIR` and update the path:

```python
# Change this line:
MOCK_DIR = Path(__file__).parent.parent / "mock"
# To:
CONFIG_DIR = Path(__file__).parent.parent / "config"
```

Rename `_load_mock_configs` to `_load_configs` and update both references from `MOCK_DIR` to `CONFIG_DIR`.

- [ ] **Step 3: Verify all tests still pass**

The `mock/` directory still has `query_results.py` and `__init__.py` — QueryEngine still imports from there. Config tests load from the new path. All tests should pass:

```bash
cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/backend && python -m pytest tests/ -v
```

Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz
git add backend/app/config/ backend/app/services/config_store.py
git commit -m "refactor: move config from mock/ to config/ directory"
```

---

## Task 2: Database Config Pydantic Models

**Files:**
- Create: `backend/app/models/database_config.py`

- [ ] **Step 1: Create DatabaseEntry and DatabasesConfig models**

Create `backend/app/models/database_config.py`:

```python
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class DatabaseEntry(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str
    display_name: str
    sqlalchemy_uri: str
    dialect: str = "oracle"
    schema_name: str = Field(default="", alias="schema")
    type: str = ""
    superset_id: int | None = None


class DatabasesConfig(BaseModel):
    databases: list[DatabaseEntry]
```

- [ ] **Step 2: Verify imports work**

```bash
cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/backend && python -c "from app.models.database_config import DatabaseEntry, DatabasesConfig; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/database_config.py
git commit -m "feat: add Pydantic models for database config registry"
```

---

## Task 3: databases.json Config File

**Files:**
- Create: `backend/app/config/databases.json`
- Modify: `backend/app/config.py`

- [ ] **Step 1: Add databases_config_path to settings**

In `backend/app/config.py`, add after `recon_db_url`:

```python
databases_config_path: str = str(
    Path(__file__).parent / "config" / "databases.json"
)
```

Add `from pathlib import Path` at the top of the file.

- [ ] **Step 2: Create databases.json for local dev**

Create `backend/app/config/databases.json`. The `sqlalchemy_uri` uses a relative path placeholder — the seed DB path will be resolved at generation time:

```json
{
  "databases": [
    {
      "name": "superset_db_TCOSPRD",
      "display_name": "TLM Consumer (TCOSPRD) — Local Dev",
      "sqlalchemy_uri": "sqlite:////Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/backend/app/config/seed/seed.db",
      "dialect": "sqlite",
      "type": "tlm"
    },
    {
      "name": "superset_db_TFINPRD",
      "display_name": "TLM Finance (TFINPRD) — Local Dev",
      "sqlalchemy_uri": "sqlite:////Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/backend/app/config/seed/seed.db",
      "dialect": "sqlite",
      "type": "tlm"
    },
    {
      "name": "superset_db_TWMPRD",
      "display_name": "TLM Wealth (TWMPRD) — Local Dev",
      "sqlalchemy_uri": "sqlite:////Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/backend/app/config/seed/seed.db",
      "dialect": "sqlite",
      "type": "tlm"
    },
    {
      "name": "superset_db_reconmgmt",
      "display_name": "ReconMgmt — Local Dev",
      "sqlalchemy_uri": "sqlite:////Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/backend/app/config/seed/seed.db",
      "dialect": "sqlite",
      "schema": "",
      "type": "reconmgmt"
    }
  ]
}
```

- [ ] **Step 3: Add seed.db to gitignore**

Add to the root `.gitignore` (at `/Users/aarun/Workspace/Projects/RecStats/.gitignore`):

```
# RecViz seed database (generated, large)
**/seed.db
```

- [ ] **Step 4: Create seed directory**

```bash
mkdir -p /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/backend/app/config/seed
```

- [ ] **Step 5: Verify config loads**

```bash
cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/backend && python -c "
from app.config import settings
from app.models.database_config import DatabasesConfig
import json
from pathlib import Path

raw = json.loads(Path(settings.databases_config_path).read_text())
config = DatabasesConfig.model_validate(raw)
print(f'Loaded {len(config.databases)} databases')
for db in config.databases:
    print(f'  {db.name} dialect={db.dialect} schema={db.schema_name!r}')
"
```

Expected: `Loaded 4 databases` with all names printed

- [ ] **Step 6: Commit**

```bash
git add backend/app/config/databases.json backend/app/config.py .gitignore
git commit -m "feat: add databases.json registry and config path setting"
```

---

## Task 4: DatabaseRegistrar Service

**Files:**
- Create: `backend/app/services/database_registrar.py`
- Create: `backend/tests/test_database_registrar.py`

- [ ] **Step 1: Write tests for DatabaseRegistrar**

Create `backend/tests/test_database_registrar.py`:

```python
import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock

from app.models.database_config import DatabaseEntry, DatabasesConfig
from app.services.database_registrar import DatabaseRegistrar


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
        DatabaseEntry(
            name="db_two",
            display_name="DB Two",
            sqlalchemy_uri="sqlite:///test.db",
            dialect="oracle",
            schema_name="myschema",
            type="test",
        ),
    ]


def _make_superset_mock(existing_dbs: list[dict] | None = None) -> AsyncMock:
    mock = AsyncMock()
    mock.list_databases = AsyncMock(
        return_value=existing_dbs or []
    )
    mock.create_database = AsyncMock(
        side_effect=lambda payload: {"id": 99, "result": {"id": 99}}
    )
    return mock


@pytest.mark.asyncio
async def test_sync_creates_missing_databases():
    superset = _make_superset_mock(existing_dbs=[])
    registrar = DatabaseRegistrar(superset_client=superset, config_path=None)
    registrar._entries = _make_entries()
    await registrar.sync()
    assert superset.create_database.call_count == 2


@pytest.mark.asyncio
async def test_sync_skips_existing_databases():
    existing = [{"id": 5, "database_name": "db_one"}]
    superset = _make_superset_mock(existing_dbs=existing)
    registrar = DatabaseRegistrar(superset_client=superset, config_path=None)
    registrar._entries = _make_entries()
    await registrar.sync()
    # Only db_two should be created
    assert superset.create_database.call_count == 1


@pytest.mark.asyncio
async def test_resolve_returns_superset_id():
    existing = [
        {"id": 5, "database_name": "db_one"},
        {"id": 10, "database_name": "db_two"},
    ]
    superset = _make_superset_mock(existing_dbs=existing)
    registrar = DatabaseRegistrar(superset_client=superset, config_path=None)
    registrar._entries = _make_entries()
    await registrar.sync()
    assert await registrar.resolve("db_one") == 5
    assert await registrar.resolve("db_two") == 10


@pytest.mark.asyncio
async def test_resolve_unknown_raises():
    superset = _make_superset_mock(existing_dbs=[])
    registrar = DatabaseRegistrar(superset_client=superset, config_path=None)
    registrar._entries = []
    await registrar.sync()
    with pytest.raises(ValueError, match="not registered"):
        await registrar.resolve("nonexistent")


def test_get_dialect():
    superset = _make_superset_mock()
    registrar = DatabaseRegistrar(superset_client=superset, config_path=None)
    registrar._entries = _make_entries()
    # Populate cache manually for unit test (sync not called)
    for entry in registrar._entries:
        registrar._cache[entry.name] = entry
    assert registrar.get_dialect("db_one") == "sqlite"
    assert registrar.get_dialect("db_two") == "oracle"


def test_get_schema():
    superset = _make_superset_mock()
    registrar = DatabaseRegistrar(superset_client=superset, config_path=None)
    registrar._entries = _make_entries()
    for entry in registrar._entries:
        registrar._cache[entry.name] = entry
    assert registrar.get_schema("db_one") == ""
    assert registrar.get_schema("db_two") == "myschema"


def test_get_all_schemas():
    superset = _make_superset_mock()
    registrar = DatabaseRegistrar(superset_client=superset, config_path=None)
    registrar._entries = _make_entries()
    for entry in registrar._entries:
        registrar._cache[entry.name] = entry
    schemas = registrar.get_all_schemas()
    assert "myschema" in schemas
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/backend && python -m pytest tests/test_database_registrar.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.database_registrar'`

- [ ] **Step 3: Implement DatabaseRegistrar**

Create `backend/app/services/database_registrar.py`:

```python
from __future__ import annotations

import asyncio
import json
import logging
import time
from pathlib import Path
from typing import Any

from app.models.database_config import DatabaseEntry, DatabasesConfig

logger = logging.getLogger(__name__)


class DatabaseRegistrar:
    """Syncs databases.json into Superset and caches name → Superset ID."""

    def __init__(
        self,
        superset_client: Any,
        config_path: str | None = None,
    ) -> None:
        self._superset = superset_client
        self._config_path = config_path
        self._entries: list[DatabaseEntry] = []
        self._cache: dict[str, DatabaseEntry] = {}
        self._negative_cache: set[str] = set()
        self._refresh_lock = asyncio.Lock()
        self._last_refresh: float = 0.0

        if config_path:
            self._load_config(config_path)

    def _load_config(self, path: str) -> None:
        raw = json.loads(Path(path).read_text())
        config = DatabasesConfig.model_validate(raw)
        self._entries = config.databases

    async def sync(self) -> None:
        """Register missing databases in Superset, populate cache."""
        existing = await self._superset.list_databases()
        existing_by_name: dict[str, dict] = {
            db.get("database_name", ""): db for db in existing
        }

        for entry in self._entries:
            if entry.name in existing_by_name:
                entry.superset_id = existing_by_name[entry.name]["id"]
                self._cache[entry.name] = entry
                logger.info(
                    "Database '%s' already registered (id=%d)",
                    entry.name,
                    entry.superset_id,
                )
            else:
                try:
                    result = await self._superset.create_database(
                        {
                            "database_name": entry.name,
                            "sqlalchemy_uri": entry.sqlalchemy_uri,
                            "expose_in_sqllab": True,
                            "allow_run_async": False,
                            "allow_ctas": False,
                            "allow_cvas": False,
                        }
                    )
                    entry.superset_id = result.get("id") or result.get("result", {}).get("id")
                    self._cache[entry.name] = entry
                    logger.info(
                        "Registered database '%s' in Superset (id=%s)",
                        entry.name,
                        entry.superset_id,
                    )
                except Exception as e:
                    logger.warning(
                        "Failed to register '%s' — have you run "
                        "'python scripts/generate-seed-db.py'? Error: %s",
                        entry.name,
                        e,
                    )

        self._negative_cache.clear()
        self._last_refresh = time.time()

    async def _refresh_cache(self) -> None:
        """Refresh cache from Superset's database list."""
        existing = await self._superset.list_databases()
        existing_by_name = {
            db.get("database_name", ""): db for db in existing
        }
        for entry in self._entries:
            if entry.name in existing_by_name:
                entry.superset_id = existing_by_name[entry.name]["id"]
                self._cache[entry.name] = entry
        self._negative_cache.clear()
        self._last_refresh = time.time()

    async def resolve(self, name: str) -> int:
        """Resolve logical database name to Superset numeric ID."""
        if name in self._cache:
            entry = self._cache[name]
            if entry.superset_id is not None:
                return entry.superset_id
        if name in self._negative_cache:
            raise ValueError(f"Database '{name}' not registered in Superset")
        async with self._refresh_lock:
            # Double-check after acquiring lock
            if name in self._cache and self._cache[name].superset_id is not None:
                return self._cache[name].superset_id
            if (time.time() - self._last_refresh) > 30:
                await self._refresh_cache()
        if name in self._cache and self._cache[name].superset_id is not None:
            return self._cache[name].superset_id
        self._negative_cache.add(name)
        raise ValueError(f"Database '{name}' not registered in Superset")

    def get_dialect(self, name: str) -> str:
        """Get SQL dialect for a database."""
        entry = self._cache.get(name)
        return entry.dialect if entry else "oracle"

    def get_schema(self, name: str) -> str:
        """Get schema name for a database."""
        entry = self._cache.get(name)
        return entry.schema_name if entry else ""

    def get_all_schemas(self) -> set[str]:
        """Get all known schema names (for schema prefix stripping)."""
        return {e.schema_name for e in self._cache.values() if e.schema_name}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/backend && python -m pytest tests/test_database_registrar.py -v
```

Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/database_registrar.py backend/tests/test_database_registrar.py
git commit -m "feat: add DatabaseRegistrar service with Superset sync and ID resolution"
```

---

## Task 5: Update SupersetClient

**Files:**
- Modify: `backend/app/services/superset_client.py:137-154`

- [ ] **Step 1: Update execute_sql signature**

In `backend/app/services/superset_client.py`, change the `execute_sql` method. Replace:

```python
    async def execute_sql(
        self,
        database_id: int,
        sql: str,
        schema: str = "public",
        limit: int = 1000,
    ) -> dict[str, Any]:
```

With:

```python
    async def execute_sql(
        self,
        database_id: int,
        sql: str,
        schema: str = "",
        limit: int = 10000,
    ) -> dict[str, Any]:
```

Also update the JSON body to pass `limit`:

```python
        return await self._post(
            "/api/v1/sqllab/execute/",
            json={
                "database_id": database_id,
                "sql": sql,
                "schema": schema,
                "runAsync": False,
                "select_as_cta": False,
                "expand_data": True,
                "row_limit": limit,
            },
        )
```

- [ ] **Step 2: Verify no import errors**

```bash
cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/backend && python -c "from app.services.superset_client import SupersetClient; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/superset_client.py
git commit -m "fix: remove hardcoded schema default and forward row limit in execute_sql"
```

---

## Task 6: Update QueryEngine — Remove Mock, Add Registrar

**Files:**
- Modify: `backend/app/services/query_engine.py`
- Modify: `backend/tests/test_query_engine.py`
- Delete: `backend/app/mock/query_results.py`
- Delete: `backend/app/mock/__init__.py` (and remove `mock/` directory)

- [ ] **Step 1: Update QueryEngine constructor and imports**

In `backend/app/services/query_engine.py`, replace the imports and constructor:

```python
from __future__ import annotations

import re
from typing import Any

from app.models.data_source_config import DataSourceConfig
from app.services.config_store import ConfigStore
from app.services.database_registrar import DatabaseRegistrar

DEFAULT_MAX_ROWS = 10_000


class QueryEngine:
    """Builds SQL from config templates, resolves dynamic DB routing,
    and executes queries via Superset."""

    def __init__(
        self,
        config_store: ConfigStore,
        superset_client: Any,
        database_registrar: DatabaseRegistrar,
    ) -> None:
        self._config_store = config_store
        self._superset = superset_client
        self._registrar = database_registrar
```

- [ ] **Step 2: Add SQLite dialect to _build_date_range_clause**

Replace the existing `_build_date_range_clause` method:

```python
    def _build_date_range_clause(self, value: int, dialect: str = "oracle") -> str:
        if dialect == "oracle":
            if value == 1:
                return (
                    "BETWEEN TRUNC(SYSDATE) - "
                    "DECODE(TO_CHAR(SYSDATE,'D'), '1',2, '2',3, '7',1, 1) "
                    "AND SYSDATE"
                )
            return f"BETWEEN SYSDATE - {value} AND SYSDATE"
        elif dialect == "sqlite":
            return f"BETWEEN date('now', '-{value} days') AND date('now')"
        else:
            return f"BETWEEN CURRENT_DATE - INTERVAL '{value} days' AND CURRENT_DATE"
```

- [ ] **Step 3: Add schema stripping to _build_sql**

Add a `db_name` parameter to `_build_sql` and add schema stripping after the `{{filters}}` replacement. In the method signature, add `db_name: str | None = None`:

```python
    def _build_sql(
        self,
        data_source_id: str,
        filters: dict,
        column: str | None = None,
        dialect: str = "oracle",
        db_name: str | None = None,
    ) -> str:
```

After the line `sql = re.sub(r"\{\{[^}]+\}\}", "", sql)` (the template cleanup), add:

```python
        # Strip schema prefixes for databases without a configured schema (e.g., SQLite)
        if db_name:
            schema = self._registrar.get_schema(db_name)
            if not schema:
                for known_schema in self._registrar.get_all_schemas():
                    if known_schema:
                        sql = re.sub(rf'\b{re.escape(known_schema)}\.', '', sql)

        return sql
```

- [ ] **Step 4: Replace execute() — remove mock path**

Replace the `execute`, `_execute_via_superset`, `_execute_mock`, `execute_distinct`, `_execute_distinct_via_superset`, and `_execute_distinct_mock` methods with:

```python
    async def execute(
        self,
        data_source_id: str,
        filters: dict,
        max_rows: int = DEFAULT_MAX_ROWS,
    ) -> dict:
        db_name = self._resolve_database(data_source_id, filters)
        db_id = await self._registrar.resolve(db_name)
        dialect = self._registrar.get_dialect(db_name)
        schema = self._registrar.get_schema(db_name)
        sql = self._build_sql(
            data_source_id, filters, dialect=dialect, db_name=db_name
        )
        result = await self._superset.execute_sql(
            database_id=db_id,
            sql=sql,
            schema=schema or "",
            limit=max_rows,
        )
        if result and result.get("status") == "success":
            rows = result.get("data", [])
            truncated = len(rows) > max_rows
            if truncated:
                rows = rows[:max_rows]
            return {
                "columns": result.get("columns", []),
                "rows": rows,
                "row_count": len(rows),
                "truncated": truncated,
            }
        return {"columns": [], "rows": [], "row_count": 0, "truncated": False}

    async def execute_distinct(
        self,
        data_source_id: str,
        column: str,
        filters: dict,
    ) -> list[str]:
        db_name = self._resolve_database(data_source_id, filters)
        db_id = await self._registrar.resolve(db_name)
        dialect = self._registrar.get_dialect(db_name)
        schema = self._registrar.get_schema(db_name)
        sql = self._build_sql(
            data_source_id, filters, column=column, dialect=dialect, db_name=db_name
        )
        result = await self._superset.execute_sql(
            database_id=db_id,
            sql=sql,
            schema=schema or "",
        )
        if result and result.get("status") == "success" and result.get("data"):
            return [str(row.get(column, "")) for row in result["data"]]
        return []
```

- [ ] **Step 5: Update tests**

Replace `backend/tests/test_query_engine.py` with updated fixture using a mock registrar:

```python
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
    store = ConfigStore()
    return QueryEngine(
        config_store=store,
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


def test_build_sql_no_filters(engine):
    sql = engine._build_sql(data_source_id="tlm_breaks", filters={})
    assert "{{filters}}" not in sql
    assert "flag_2 = 0" in sql


def test_resolve_database_dynamic(engine):
    db_id = engine._resolve_database(
        data_source_id="tlm_breaks",
        filters={"tlm_instance": "TLMP_CONSUMER"},
    )
    assert db_id == "superset_db_TCOSPRD"


def test_resolve_database_static(engine):
    db_id = engine._resolve_database(
        data_source_id="reconmgmt_manual",
        filters={},
    )
    assert db_id == "superset_db_reconmgmt"


def test_resolve_database_dynamic_missing_filter(engine):
    with pytest.raises(ValueError, match="required filter"):
        engine._resolve_database(
            data_source_id="tlm_breaks",
            filters={},
        )


def test_build_sql_sqlite_dialect(engine):
    sql = engine._build_sql(
        data_source_id="tlm_breaks",
        filters={"date_range": 7},
        dialect="sqlite",
    )
    assert "date('now', '-7 days')" in sql
    assert "date('now')" in sql


def test_build_sql_oracle_dialect(engine):
    sql = engine._build_sql(
        data_source_id="tlm_breaks",
        filters={"date_range": 7},
        dialect="oracle",
    )
    assert "SYSDATE - 7" in sql


def test_schema_stripping_for_sqlite(engine, mock_registrar):
    mock_registrar.get_schema.return_value = ""
    mock_registrar.get_all_schemas.return_value = {"reconmgmt"}
    sql = engine._build_sql(
        data_source_id="reconmgmt_manual",
        filters={},
        dialect="sqlite",
        db_name="superset_db_reconmgmt",
    )
    # Schema prefix should be stripped
    assert "reconmgmt." not in sql
    # But table aliases should survive
    assert "mr_csum_man_match_stats_hist" in sql


def test_schema_kept_for_oracle(engine, mock_registrar):
    mock_registrar.get_schema.return_value = "reconmgmt"
    sql = engine._build_sql(
        data_source_id="reconmgmt_manual",
        filters={},
        dialect="oracle",
        db_name="superset_db_reconmgmt",
    )
    assert "reconmgmt." in sql


def test_build_sql_escapes_single_quotes(engine):
    sql = engine._build_sql(
        data_source_id="tlm_breaks",
        filters={"recon": ["O'Brien"]},
    )
    assert "O''Brien" in sql


def test_build_sql_invalid_column_raises(engine):
    with pytest.raises(ValueError, match="Column"):
        engine._build_sql(
            data_source_id="reconmgmt_recon_bank",
            filters={},
            column="evil_column",
        )
```

- [ ] **Step 6: Run tests**

```bash
cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/backend && python -m pytest tests/test_query_engine.py -v
```

Expected: All tests PASS

- [ ] **Step 7: Run all tests**

```bash
cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/backend && python -m pytest tests/ -v
```

Expected: All tests PASS

- [ ] **Step 8: Delete mock fallback files**

Now that QueryEngine no longer imports from mock, delete the leftover files:

```bash
cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz
rm -rf backend/app/mock/
```

- [ ] **Step 9: Commit**

```bash
git add backend/app/services/query_engine.py backend/tests/test_query_engine.py
git rm -r backend/app/mock/
git commit -m "feat: remove mock fallback, add DatabaseRegistrar integration and dialect support to QueryEngine"
```

---

## Task 7: Update FastAPI Startup (main.py)

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Update lifespan function**

Replace the entire `lifespan` function in `backend/app/main.py`:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create shared HTTP client + Superset client
    http = httpx.AsyncClient(timeout=30.0)
    superset = SupersetClient(http)

    # 1. Authenticate to Superset (hard requirement)
    await superset.authenticate()
    app.state.superset = superset
    logger.info("Superset client ready")

    app.state.http = http

    # 2. Load configs
    config_store = ConfigStore()
    app.state.config_store = config_store

    # 3. Sync databases into Superset
    registrar = DatabaseRegistrar(
        superset_client=superset,
        config_path=settings.databases_config_path,
    )
    await registrar.sync()
    app.state.database_registrar = registrar
    logger.info("DatabaseRegistrar synced")

    # 4. Create QueryEngine
    app.state.query_engine = QueryEngine(
        config_store=config_store,
        superset_client=superset,
        database_registrar=registrar,
    )
    logger.info("QueryEngine initialized — ready to serve")

    yield

    # Shutdown
    await http.aclose()
```

- [ ] **Step 2: Update imports**

Add to imports at top of `main.py`:

```python
from app.services.database_registrar import DatabaseRegistrar
```

- [ ] **Step 3: Update health endpoint**

Replace the health endpoint to reflect Superset is always required:

```python
@app.get("/health")
async def health():
    return {"status": "ok", "superset": True}
```

- [ ] **Step 4: Verify file compiles**

```bash
cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/backend && python -c "from app.main import app; print('OK')"
```

Expected: `OK` (the lifespan won't run at import time)

- [ ] **Step 5: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: update lifespan to require Superset and sync databases on startup"
```

---

## Task 8: Superset Local Setup

**Files:**
- Create: `superset/superset_config_local.py`
- Create: `scripts/setup-superset-local.sh`

- [ ] **Step 1: Create superset_config_local.py**

Create `superset/superset_config_local.py`:

```python
import os

SECRET_KEY = "recviz-local-dev-key"

# SQLite for metadata — persists across restarts
SQLALCHEMY_DATABASE_URI = (
    "sqlite:///" + os.path.expanduser("~/.superset/superset_local.db")
)

# In-memory cache — no Redis needed
CACHE_CONFIG = {"CACHE_TYPE": "SimpleCache", "CACHE_DEFAULT_TIMEOUT": 300}
DATA_CACHE_CONFIG = {"CACHE_TYPE": "SimpleCache", "CACHE_DEFAULT_TIMEOUT": 600}
FILTER_STATE_CACHE_CONFIG = {
    "CACHE_TYPE": "SimpleCache",
    "CACHE_DEFAULT_TIMEOUT": 600,
}

# No Celery — synchronous queries only
class CeleryConfig:
    pass


CELERY_CONFIG = CeleryConfig

# Results backend for SQL Lab (local file-based)
from cachelib.file import FileSystemCache

RESULTS_BACKEND = FileSystemCache(
    os.path.expanduser("~/.superset/sqllab_results"), default_timeout=600
)

FEATURE_FLAGS = {"ENABLE_TEMPLATE_PROCESSING": True}

# CORS
ENABLE_CORS = True
CORS_OPTIONS = {
    "supports_credentials": True,
    "allow_headers": ["*"],
    "resources": ["/api/*"],
    "origins": ["http://localhost:5173", "http://localhost:8000"],
}

# Suppress browser warnings
TALISMAN_ENABLED = False
WTF_CSRF_ENABLED = False
```

- [ ] **Step 2: Create setup-superset-local.sh**

Create `scripts/setup-superset-local.sh`:

```bash
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$SCRIPT_DIR/../.venv"
export SUPERSET_CONFIG_PATH="$SCRIPT_DIR/../superset/superset_config_local.py"

# Ensure venv is active
source "$VENV_DIR/bin/activate"

# Install Oracle driver (needed for prod, harmless for local)
pip install oracledb 2>/dev/null || true

# Create metadata directory
mkdir -p ~/.superset

# Idempotent — skip heavy init if already done
if [ ! -f ~/.superset/superset_local.db ]; then
    echo "First-time setup — initializing Superset..."
    superset db upgrade
    superset fab create-admin \
        --username admin \
        --firstname Admin \
        --lastname User \
        --email admin@recviz.local \
        --password admin || true
    superset init
else
    echo "Superset already initialized. Running migrations only..."
    superset db upgrade
fi

echo ""
echo "Superset initialized. Start with:"
echo "  SUPERSET_CONFIG_PATH=$SUPERSET_CONFIG_PATH $VENV_DIR/bin/superset run -p 8088"
echo ""
echo "IMPORTANT: Generate the seed database BEFORE starting FastAPI:"
echo "  python scripts/generate-seed-db.py"
```

- [ ] **Step 3: Make script executable**

```bash
chmod +x /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/scripts/setup-superset-local.sh
```

- [ ] **Step 4: Commit**

```bash
git add superset/superset_config_local.py scripts/setup-superset-local.sh
git commit -m "feat: add local Superset setup with SQLite metadata and no Redis"
```

---

## Task 9: Seed Database Generator

**Files:**
- Create: `scripts/generate-seed-db.py`

- [ ] **Step 1: Create the seed generation script**

Create `scripts/generate-seed-db.py`:

```python
#!/usr/bin/env python3
"""Generate a SQLite seed database with 1M+ rows for RecViz local development.

Usage: python scripts/generate-seed-db.py
Output: backend/app/config/seed/seed.db
"""

import os
import random
import sqlite3
import time
from datetime import date, timedelta
from pathlib import Path

random.seed(42)

SCRIPT_DIR = Path(__file__).parent
SEED_DB_PATH = SCRIPT_DIR.parent / "backend" / "app" / "config" / "seed" / "seed.db"

# Data dimensions
AGENTS = [f"AGENT_{i:02d}" for i in range(1, 21)]  # 20 agents
SET_IDS = [f"SET_{i:03d}" for i in range(1, 51)]  # 50 set IDs
BRANCHES = [f"BR{i:03d}" for i in range(1, 21)]  # 20 branches
TLM_INSTANCES = ["TLMP_CONSUMER", "TLMP_FINANCE", "TLMP_WEALTH"]
CORR_ACCOUNTS = [f"CA{i:04d}" for i in range(1, 51)]  # 50 corr accounts
LAST_ACTION_OWNERS = ["SYSTEM", "system", "AUTONET", "MANUAL_USER_01", "MANUAL_USER_02"]
FLAG_2_VALUES = [0, 1, 11]  # 0=break, 1=matched, 11=pending
FLAG_2_WEIGHTS = [0.10, 0.80, 0.10]  # 10% breaks, 80% matched, 10% pending

TODAY = date.today()
DATES = [(TODAY - timedelta(days=d)).isoformat() for d in range(90)]

BATCH_SIZE = 10_000


def create_tables(conn: sqlite3.Connection) -> None:
    conn.executescript("""
        -- TLM tables
        CREATE TABLE IF NOT EXISTS bank (
            agent_code TEXT NOT NULL,
            corr_acc_no TEXT NOT NULL,
            local_acc_no TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS message_feed (
            corr_acc_no TEXT NOT NULL,
            bran_code TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS item (
            corr_acc_no TEXT NOT NULL,
            stmt_date TEXT NOT NULL,
            flag_2 INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tlm_bdr_relationship_header (
            corr_acc_no TEXT NOT NULL,
            last_action_owner TEXT NOT NULL
        );

        -- ReconMgmt tables
        CREATE TABLE IF NOT EXISTS recon_bank (
            recon_engine TEXT NOT NULL,
            recon_engine_env TEXT NOT NULL,
            agent_code TEXT NOT NULL,
            local_acc_no TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS mr_csum_man_match_stats_hist (
            agent_code TEXT NOT NULL,
            setid TEXT NOT NULL,
            stmt_date TEXT NOT NULL,
            bran_code TEXT NOT NULL,
            corr_acc_no TEXT NOT NULL,
            total_items INTEGER NOT NULL,
            automatch_items INTEGER NOT NULL,
            total_manual_match_count INTEGER NOT NULL,
            tlm_instance TEXT NOT NULL
        );
    """)


def create_indexes(conn: sqlite3.Connection) -> None:
    conn.executescript("""
        CREATE INDEX IF NOT EXISTS idx_bank_corr ON bank(corr_acc_no);
        CREATE INDEX IF NOT EXISTS idx_bank_agent ON bank(agent_code);
        CREATE INDEX IF NOT EXISTS idx_bank_local ON bank(local_acc_no);
        CREATE INDEX IF NOT EXISTS idx_mf_corr ON message_feed(corr_acc_no);
        CREATE INDEX IF NOT EXISTS idx_item_corr ON item(corr_acc_no);
        CREATE INDEX IF NOT EXISTS idx_item_stmt_date ON item(stmt_date);
        CREATE INDEX IF NOT EXISTS idx_item_flag2 ON item(flag_2);
        CREATE INDEX IF NOT EXISTS idx_th_corr ON tlm_bdr_relationship_header(corr_acc_no);
        CREATE INDEX IF NOT EXISTS idx_rb_engine ON recon_bank(recon_engine, recon_engine_env);
        CREATE INDEX IF NOT EXISTS idx_mrh_agent ON mr_csum_man_match_stats_hist(agent_code);
        CREATE INDEX IF NOT EXISTS idx_mrh_tlm ON mr_csum_man_match_stats_hist(tlm_instance);
        CREATE INDEX IF NOT EXISTS idx_mrh_stmt ON mr_csum_man_match_stats_hist(stmt_date);
    """)


def generate_bank(conn: sqlite3.Connection, target: int = 5_000) -> list[tuple[str, str, str]]:
    """Generate ~5K bank rows: multiple corr accounts per agent + local_acc combo."""
    rows = []
    for agent in AGENTS:
        for local_acc in SET_IDS:
            # Each agent+set_id combo can have multiple corr accounts
            n_corr = random.randint(3, 8)
            for _ in range(n_corr):
                corr = random.choice(CORR_ACCOUNTS)
                rows.append((agent, corr, local_acc))
            if len(rows) >= target:
                break
        if len(rows) >= target:
            break

    conn.executemany("INSERT INTO bank VALUES (?, ?, ?)", rows)
    conn.commit()
    print(f"  bank: {len(rows)} rows")
    return rows


def generate_message_feed(conn: sqlite3.Connection, bank_rows: list, target: int = 10_000) -> list[tuple[str, str]]:
    """Generate ~10K message_feed rows: multiple branches per corr account."""
    rows = []
    corr_accounts = list({corr for _, corr, _ in bank_rows})
    for corr in corr_accounts:
        for bran in BRANCHES:
            rows.append((corr, bran))
    # If not enough, add more combos
    while len(rows) < target:
        corr = random.choice(corr_accounts)
        bran = random.choice(BRANCHES)
        rows.append((corr, bran))

    conn.executemany("INSERT INTO message_feed VALUES (?, ?)", rows)
    conn.commit()
    print(f"  message_feed: {len(rows)} rows")
    return rows


def generate_items(conn: sqlite3.Connection, corr_accounts: list[str], target: int = 1_000_000) -> None:
    """Generate item rows: ~1M rows with realistic flag_2 distribution."""
    batch = []
    count = 0
    for i in range(target):
        corr = random.choice(corr_accounts)
        stmt_date = random.choice(DATES)
        flag_2 = random.choices(FLAG_2_VALUES, weights=FLAG_2_WEIGHTS, k=1)[0]
        batch.append((corr, stmt_date, flag_2))

        if len(batch) >= BATCH_SIZE:
            conn.executemany("INSERT INTO item VALUES (?, ?, ?)", batch)
            conn.commit()
            count += len(batch)
            batch = []
            if count % 100_000 == 0:
                print(f"    item: {count}/{target}...")

    if batch:
        conn.executemany("INSERT INTO item VALUES (?, ?, ?)", batch)
        conn.commit()
        count += len(batch)

    print(f"  item: {count} rows")


def generate_tlm_headers(conn: sqlite3.Connection, corr_accounts: list[str], target: int = 800_000) -> None:
    """Generate tlm_bdr_relationship_header rows."""
    batch = []
    count = 0
    for i in range(target):
        corr = random.choice(corr_accounts)
        owner = random.choice(LAST_ACTION_OWNERS)
        batch.append((corr, owner))

        if len(batch) >= BATCH_SIZE:
            conn.executemany("INSERT INTO tlm_bdr_relationship_header VALUES (?, ?)", batch)
            conn.commit()
            count += len(batch)
            batch = []
            if count % 100_000 == 0:
                print(f"    tlm_bdr_relationship_header: {count}/{target}...")

    if batch:
        conn.executemany("INSERT INTO tlm_bdr_relationship_header VALUES (?, ?)", batch)
        conn.commit()
        count += len(batch)

    print(f"  tlm_bdr_relationship_header: {count} rows")


def generate_recon_bank(conn: sqlite3.Connection) -> None:
    """Generate recon_bank rows: distinct filter combos."""
    rows = []
    for tlm_instance in TLM_INSTANCES:
        for agent in AGENTS:
            for local_acc in random.sample(SET_IDS, 3):
                rows.append(("TLM", tlm_instance, agent, local_acc))

    conn.executemany("INSERT INTO recon_bank VALUES (?, ?, ?, ?)", rows)
    conn.commit()
    print(f"  recon_bank: {len(rows)} rows")


def generate_manual_match_stats(conn: sqlite3.Connection, target: int = 50_000) -> None:
    """Generate mr_csum_man_match_stats_hist rows."""
    batch = []
    count = 0
    for i in range(target):
        agent = random.choice(AGENTS)
        setid = random.choice(SET_IDS)
        stmt_date = random.choice(DATES)
        bran = random.choice(BRANCHES)
        corr = random.choice(CORR_ACCOUNTS)
        total = random.randint(50, 500)
        automatch = int(total * random.uniform(0.7, 0.95))
        manual = random.randint(1, 30)
        tlm_instance = random.choice(TLM_INSTANCES)
        batch.append((agent, setid, stmt_date, bran, corr, total, automatch, manual, tlm_instance))

        if len(batch) >= BATCH_SIZE:
            conn.executemany("INSERT INTO mr_csum_man_match_stats_hist VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", batch)
            conn.commit()
            count += len(batch)
            batch = []

    if batch:
        conn.executemany("INSERT INTO mr_csum_man_match_stats_hist VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", batch)
        conn.commit()
        count += len(batch)

    print(f"  mr_csum_man_match_stats_hist: {count} rows")


def main() -> None:
    # Ensure output directory exists
    SEED_DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    # Remove existing DB
    if SEED_DB_PATH.exists():
        SEED_DB_PATH.unlink()
        print(f"Removed existing {SEED_DB_PATH}")

    print(f"Generating seed database at {SEED_DB_PATH}")
    start = time.time()

    conn = sqlite3.connect(str(SEED_DB_PATH))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=OFF")

    print("Creating tables...")
    create_tables(conn)

    print("Generating data...")
    bank_rows = generate_bank(conn)
    mf_rows = generate_message_feed(conn, bank_rows)
    corr_accounts = list({corr for corr, _ in mf_rows})
    generate_items(conn, corr_accounts)
    generate_tlm_headers(conn, corr_accounts)
    generate_recon_bank(conn)
    generate_manual_match_stats(conn)

    print("Creating indexes...")
    create_indexes(conn)

    conn.execute("ANALYZE")
    conn.close()

    size_mb = SEED_DB_PATH.stat().st_size / (1024 * 1024)
    elapsed = time.time() - start
    print(f"\nDone! {size_mb:.1f} MB in {elapsed:.1f}s")
    print(f"Path: {SEED_DB_PATH}")

    # Update databases.json with the correct absolute path to seed.db
    databases_json_path = SCRIPT_DIR.parent / "backend" / "app" / "config" / "databases.json"
    if databases_json_path.exists():
        import json as json_mod
        config = json_mod.loads(databases_json_path.read_text())
        abs_path = str(SEED_DB_PATH.resolve())
        sqlite_uri = f"sqlite:///{abs_path}"
        updated = False
        for db in config.get("databases", []):
            if db.get("dialect") == "sqlite" and db.get("sqlalchemy_uri") != sqlite_uri:
                db["sqlalchemy_uri"] = sqlite_uri
                updated = True
        if updated:
            databases_json_path.write_text(json_mod.dumps(config, indent=2) + "\n")
            print(f"Updated databases.json with seed.db path: {sqlite_uri}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Make script executable**

```bash
chmod +x /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/scripts/generate-seed-db.py
```

- [ ] **Step 3: Run the script**

```bash
cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz && python scripts/generate-seed-db.py
```

Expected: Output showing ~1M rows generated in 30-60 seconds, seed.db created at `backend/app/config/seed/seed.db`

- [ ] **Step 4: Verify seed DB is queryable**

```bash
cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz && python -c "
import sqlite3
conn = sqlite3.connect('backend/app/config/seed/seed.db')
for table in ['bank', 'message_feed', 'item', 'tlm_bdr_relationship_header', 'recon_bank', 'mr_csum_man_match_stats_hist']:
    count = conn.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0]
    print(f'{table}: {count:,} rows')
conn.close()
"
```

Expected: Row counts matching the spec (~5K bank, ~10K message_feed, ~1M item, etc.)

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-seed-db.py
git commit -m "feat: add seed database generator with 1M+ rows for local dev"
```

---

## Task 10: End-to-End Verification

**Files:** No new files — this is integration testing.

- [ ] **Step 1: Set up Superset locally**

```bash
cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz && ./scripts/setup-superset-local.sh
```

Expected: Superset initializes without errors.

- [ ] **Step 2: Start Superset**

In a separate terminal:

```bash
cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz
SUPERSET_CONFIG_PATH=superset/superset_config_local.py .venv/bin/superset run -p 8088
```

Expected: Superset starts on port 8088.

- [ ] **Step 3: Verify Superset is accessible**

```bash
curl -s http://localhost:8088/health | python3 -m json.tool
```

Expected: `{"status": "OK"}`

- [ ] **Step 4: Start FastAPI backend**

In another terminal:

```bash
cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/backend && uvicorn app.main:app --reload --port 8000
```

Expected: FastAPI starts, logs show:
- "Superset client ready"
- "DatabaseRegistrar synced"
- "QueryEngine initialized — ready to serve"

- [ ] **Step 5: Test the full pipeline via curl**

```bash
# Test KPIs
curl -s http://localhost:8000/api/dashboards/tlm-stats/kpis \
  -X POST -H "Content-Type: application/json" \
  -d '{"filters":{"tlm_instance":"TLMP_CONSUMER","date_range":7}}' | python3 -m json.tool

# Test data source query
curl -s http://localhost:8000/api/data-sources/tlm_breaks/query \
  -X POST -H "Content-Type: application/json" \
  -d '{"filters":{"tlm_instance":"TLMP_CONSUMER","date_range":7}}' | python3 -m json.tool

# Test filter options
curl -s "http://localhost:8000/api/data-sources/reconmgmt_recon_bank/distinct/recon_engine_env" | python3 -m json.tool
```

Expected: Real data from the SQLite seed database, not mock data.

- [ ] **Step 6: Test the frontend**

Open `http://localhost:5173/dashboards/tlm-stats` in the browser. Verify:
- KPI cards show numbers derived from 1M+ rows
- Charts render with real aggregated data
- Grids show real rows with pagination
- Filters work — selecting different TLM instances changes data

- [ ] **Step 7: Run all backend tests**

```bash
cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz/recviz/backend && python -m pytest tests/ -v
```

Expected: All tests PASS

- [ ] **Step 8: Final commit**

```bash
cd /Users/aarun/Workspace/Projects/RecStats/03-RecViz
git add -A
git commit -m "feat: complete real data pipeline — Superset + SQLite seed with 1M+ rows"
```
