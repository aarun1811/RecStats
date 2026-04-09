# Architecture: Removing Superset -- Direct Database Query Engine

**Domain:** BI platform backend migration (Superset proxy to direct SQLAlchemy)
**Researched:** 2026-04-09
**Overall confidence:** HIGH -- based on existing codebase analysis + verified SQLAlchemy/Alembic docs

## Current Architecture (What Exists)

```
React SPA --> FastAPI --> Superset REST API --> Oracle/PostgreSQL
                |
                +--> SQLAlchemy (metadata only) --> PostgreSQL
                |         recviz_dashboards
                |         recviz_data_sources
                |         recviz_datasets
                |         recviz_charts
                |         recviz_kpis
                |
                +--> ConnectionStatusTracker (in-memory)
```

### Existing Components (backend/app/)

| Component | Role | Superset-Dependent? |
|-----------|------|---------------------|
| `db/engine.py` | Single async engine for metadata DB | NO -- keep as-is |
| `db/base.py` | DeclarativeBase for ORM models | NO -- keep as-is |
| `db/models/` | 5 ORM tables (dashboard, data_source, dataset, chart, kpi) | NO -- extend |
| `services/superset_client.py` | HTTP proxy to Superset REST API | YES -- **DELETE** |
| `services/database_registrar.py` | Syncs databases.json to Superset IDs | YES -- **REPLACE** |
| `services/query_engine.py` | Builds SQL, routes to DB, executes via Superset | PARTIALLY -- **REWRITE** |
| `services/dataset_sync.py` | Syncs datasets to Superset virtual datasets | YES -- **DELETE** |
| `services/connection_status.py` | In-memory health tracking by Superset ID | PARTIALLY -- **ADAPT** |
| `services/config_store.py` | DB-backed data source config lookup | NO -- keep as-is |
| `services/merge_engine.py` | Client-side join of query results | NO -- keep as-is |
| `services/uri_builder.py` | Builds SQLAlchemy URIs from form fields | NO -- keep as-is |
| `api/databases.py` | Database CRUD (proxies to Superset) | YES -- **REWRITE** |
| `api/sql.py` | SQL Explorer execution (proxies to Superset) | YES -- **REWRITE** |
| `api/data_sources.py` | Data source query endpoint | NO -- keep (uses QueryEngine) |
| `api/managed_datasets.py` | Dataset CRUD | PARTIALLY -- remove sync logic |
| `api/managed_charts.py` | Chart CRUD | NO -- keep as-is |
| `api/managed_kpis.py` | KPI CRUD | NO -- keep as-is |
| `api/managed_dashboards.py` | Dashboard CRUD | NO -- keep as-is |
| `config.py` | Settings (has superset_url, superset_username, etc.) | YES -- **CLEAN** |
| `main.py` | Lifespan: creates SupersetClient, registers DBs | YES -- **REWRITE** |

**Summary: 7 files to delete/rewrite, 10+ files unchanged, 3 files need minor edits.**

---

## Target Architecture

```
React SPA --> FastAPI --> SQLAlchemy async engines --> PostgreSQL (dev) / Oracle (prod)
                |
                +--> metadata_engine (existing) --> recviz_* tables
                |         recviz_dashboards
                |         recviz_data_sources
                |         recviz_datasets
                |         recviz_charts
                |         recviz_kpis
                |         recviz_connections (NEW)
                |
                +--> DataSourceEnginePool (NEW)
                |         Manages N async engines for user-created connections
                |         Engine per unique connection URI
                |         Lazy creation + LRU eviction
                |
                +--> QueryExecutor (REWRITTEN query_engine.py)
                          Builds SQL (reuse existing logic)
                          Executes via raw text() on data source engines
                          Returns same response shape as today
```

---

## Component Architecture

### 1. Dual Engine Strategy

**Metadata engine** -- the existing `db/engine.py`. Single async engine pointing at the RecViz metadata database (PostgreSQL in dev, Oracle in prod). Used for all ORM operations on `recviz_*` tables. No changes needed except cleaning the connection URL in config.

**Data source engine pool** -- NEW. A registry of async engines, one per user-defined database connection. These engines execute raw SQL (SELECT queries only) against data source databases. They do NOT use ORM models -- they execute `text()` SQL and return rows as dicts.

```python
# Conceptual structure
class DataSourceEnginePool:
    _engines: dict[str, AsyncEngine]   # connection_id -> engine
    _lock: asyncio.Lock

    async def get_engine(self, connection_id: str) -> AsyncEngine:
        """Get or create an engine for a connection. Reads URI from DB."""

    async def remove_engine(self, connection_id: str) -> None:
        """Dispose engine when connection is deleted/updated."""

    async def dispose_all(self) -> None:
        """Shutdown: dispose all engines."""
```

**Why separate engines, not separate sessions on one engine:** Each data source connection points to a different physical database (different hosts, credentials, even different database types). SQLAlchemy engines are bound to a specific URI. You cannot use one engine to talk to multiple databases. This is not multi-tenancy (same schema, different data) -- it is multi-database (different servers entirely).

### 2. Connection Storage (recviz_connections table)

Currently, connections are stored in two places:
1. `databases.json` -- static config file, synced to Superset on startup
2. Superset's internal metadata -- the canonical store after sync

Both go away. Replace with a `recviz_connections` table in the metadata DB.

```python
class RecvizConnection(Base):
    __tablename__ = "recviz_connections"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String(256), nullable=False)
    backend: Mapped[str] = mapped_column(String(32), nullable=False)  # oracle, postgresql
    host: Mapped[str] = mapped_column(String(256), nullable=False)
    port: Mapped[int] = mapped_column(Integer, nullable=False)
    database: Mapped[str] = mapped_column(String(256), nullable=False)
    schema_name: Mapped[str] = mapped_column(String(256), server_default="")
    username: Mapped[str] = mapped_column(String(256), nullable=False)
    encrypted_password: Mapped[str] = mapped_column(Text, nullable=False)
    dialect: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), server_default="untested")
    last_tested: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

**Credential encryption:** Passwords stored encrypted using Fernet symmetric encryption. Key derived from an env var (`RECVIZ_ENCRYPTION_KEY`). The `uri_builder.py` already exists and constructs URIs from individual fields -- it will be reused. The URI is built at runtime from decrypted fields, never stored in plaintext.

**Migration from databases.json:** A one-time migration script reads `databases.json`, creates rows in `recviz_connections`, and the JSON files become unnecessary. Keep them as a fallback/seed mechanism for fresh installs.

### 3. DataSourceEnginePool (NEW service)

```
DataSourceEnginePool
  |
  +--> _engines: dict[str, AsyncEngine]
  |       Keyed by connection ID (not name)
  |       Created lazily on first query to that connection
  |       Disposed on connection delete/update or shutdown
  |
  +--> get_engine(connection_id) -> AsyncEngine
  |       1. Check cache
  |       2. If miss: load RecvizConnection from metadata DB
  |       3. Decrypt password, build URI via uri_builder
  |       4. create_async_engine(uri, pool_size=5, max_overflow=3)
  |       5. Cache and return
  |
  +--> execute_raw(connection_id, sql, params?) -> list[dict]
  |       1. Get engine
  |       2. async with engine.connect() as conn:
  |       3.     result = await conn.execute(text(sql))
  |       4.     return [dict(row._mapping) for row in result]
  |
  +--> test_connection(connection_id | uri) -> bool
  |       1. Create temporary engine (or use cached)
  |       2. Execute "SELECT 1" (PostgreSQL) or "SELECT 1 FROM DUAL" (Oracle)
  |       3. Return success/failure
  |
  +--> invalidate(connection_id) -> None
  |       Dispose cached engine (force reconnect on next use)
  |
  +--> dispose_all() -> None
          Shutdown hook: dispose all engines
```

**Pool sizing rationale:** Each data source engine gets `pool_size=5, max_overflow=3`. With ~4 data sources typical in the current config, that is 20 base connections + 12 overflow = 32 total max connections to data databases. Reasonable for a single-server BI tool. The metadata engine keeps its existing `pool_size=10, max_overflow=5`.

**Engine dialect selection:** The URI scheme determines the dialect automatically.
- PostgreSQL (dev): `postgresql+asyncpg://...` -- uses asyncpg driver
- Oracle (prod): `oracle+oracledb://...` -- uses python-oracledb in thin mode (async supported since SQLAlchemy 2.0.25 + python-oracledb 2.0+)

### 4. QueryExecutor (REWRITTEN services/query_engine.py)

The existing `QueryEngine` has two excellent pieces of reusable logic:
1. **`_resolve_database()`** -- routes a DataSourceConfig to a database name via static/dynamic routing
2. **`_build_sql()`** -- template engine for SQL with filter injection, date range clauses, dialect-aware syntax

These stay. What changes is the execution path:

**Before:** `QueryEngine.execute()` -> `self._superset.execute_sql(database_id, sql, schema, limit)`
**After:** `QueryExecutor.execute()` -> `self._pool.execute_raw(connection_id, sql)`

```python
class QueryExecutor:
    """Builds SQL from data source configs and executes via direct DB connections."""

    def __init__(
        self,
        engine_pool: DataSourceEnginePool,
        connection_resolver: ConnectionResolver,
        status_tracker: ConnectionStatusTracker,
    ) -> None:
        self._pool = engine_pool
        self._resolver = connection_resolver
        self._status = status_tracker

    # _resolve_database() -- REUSED from current QueryEngine
    # _build_sql() -- REUSED from current QueryEngine
    # _build_date_range_clause() -- REUSED from current QueryEngine

    async def execute(self, ds: DataSourceConfig, filters: dict, max_rows: int = 10_000) -> dict:
        db_name = self._resolve_database(ds, filters)
        connection_id = await self._resolver.resolve_name_to_id(db_name)
        dialect = self._resolver.get_dialect(db_name)
        schema = self._resolver.get_schema(db_name)
        sql = self._build_sql(ds, filters, dialect=dialect, db_name=db_name)

        try:
            rows = await self._pool.execute_raw(connection_id, sql)
        except Exception as exc:
            self._status.mark_unreachable(connection_id)
            raise

        self._status.mark_connected(connection_id)

        columns = list(rows[0].keys()) if rows else []
        truncated = len(rows) > max_rows
        if truncated:
            rows = rows[:max_rows]

        return {
            "columns": columns,
            "rows": rows,
            "row_count": len(rows),
            "truncated": truncated,
        }
```

**Response shape is identical to today.** The frontend sees `{ columns, rows, row_count, truncated }` -- no changes needed.

### 5. ConnectionResolver (REPLACES DatabaseRegistrar)

The current `DatabaseRegistrar` resolves logical database names to Superset numeric IDs. The new `ConnectionResolver` resolves logical database names to `recviz_connections` row IDs.

```python
class ConnectionResolver:
    """Resolves logical database names to connection IDs from recviz_connections table."""

    _cache: dict[str, ConnectionInfo]  # name -> {id, dialect, schema}

    async def sync(self, session: AsyncSession) -> None:
        """Load all connections from DB into cache. Called at startup."""

    async def resolve_name_to_id(self, name: str) -> str:
        """Resolve logical name to connection ID."""

    def get_dialect(self, name: str) -> str
    def get_schema(self, name: str) -> str
    def get_all_schemas(self) -> set[str]

    async def invalidate(self) -> None:
        """Force reload from DB (after connection CRUD)."""
```

**API surface is identical to DatabaseRegistrar** -- same methods, just returns string IDs instead of int Superset IDs. This means `QueryExecutor._resolve_database()` works unchanged.

### 6. Updated ConnectionStatusTracker

Minor change: currently keyed by Superset int ID, needs to be keyed by connection string ID instead.

```python
class ConnectionStatusTracker:
    _status: dict[str, dict]  # connection_id (str) -> {status, last_tested}
    # Same API: get_status, mark_connected, mark_unreachable, remove
```

### 7. API Layer Changes

#### databases.py -> connections.py (REWRITE)

Currently proxies every CRUD operation to Superset. Rewrite to use direct SQLAlchemy ORM against `recviz_connections` table.

**Endpoint mapping (API contracts preserved):**

| Current Endpoint | New Endpoint | Change |
|-----------------|-------------|--------|
| `GET /api/databases` | `GET /api/databases` | Same URL, reads from recviz_connections |
| `GET /api/databases/{id}` | `GET /api/databases/{id}` | Same URL, reads from recviz_connections |
| `POST /api/databases` | `POST /api/databases` | Same URL, writes to recviz_connections |
| `PUT /api/databases/{id}` | `PUT /api/databases/{id}` | Same URL, writes to recviz_connections |
| `DELETE /api/databases/{id}` | `DELETE /api/databases/{id}` | Same URL, deletes from recviz_connections |
| `POST /api/databases/test` | `POST /api/databases/test` | Same URL, tests via DataSourceEnginePool |
| `GET /api/databases/{id}/datasets` | `GET /api/databases/{id}/datasets` | Same URL, queries recviz_datasets |

**Response shapes stay identical.** The frontend DatabaseCreate/DatabaseUpdate/DatabaseInfo models already match. The `id` field changes from Superset int to RecViz string UUID, but the frontend already handles string IDs elsewhere (charts, dashboards, datasets all use string UUIDs).

**IMPORTANT: ID type change from int to string.** Current `/api/databases/{db_id}` uses `db_id: int` (Superset ID). New version uses `db_id: str` (UUID). The frontend connection management UI sends IDs it received from the list endpoint, so this is transparent AS LONG AS:
1. The list endpoint returns the new string IDs
2. The frontend doesn't assume integer arithmetic on database IDs

Review of frontend code shows `database_id` is treated as opaque (passed through, never parsed). Safe to change.

#### sql.py (REWRITE)

Currently calls `superset.execute_sql()`. Rewrite to use `DataSourceEnginePool.execute_raw()` directly.

```python
@router.post("/execute")
async def execute_sql(body: SqlRequest, pool: DataSourceEnginePoolDep):
    rows = await pool.execute_raw(body.database_id, body.sql)
    columns = list(rows[0].keys()) if rows else []
    return {
        "status": "success",
        "columns": columns,
        "data": rows,
        "row_count": len(rows),
    }
```

Response shape matches current output. The `database_id` field in `SqlRequest` changes from Superset int to connection string ID.

#### managed_datasets.py (MINOR EDIT)

Remove all `DatasetSyncService` references. The `superset_id` and `sync_status` columns become unnecessary (mark as deprecated or remove in migration). Dataset records become purely metadata -- the SQL is stored but not synced to Superset.

### 8. Lifespan (main.py REWRITE)

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Create DataSourceEnginePool
    pool = DataSourceEnginePool(metadata_session_factory=async_session_factory)
    app.state.engine_pool = pool

    # 2. Create ConnectionResolver and sync from DB
    resolver = ConnectionResolver()
    async with async_session_factory() as session:
        await resolver.sync(session)
    app.state.connection_resolver = resolver

    # 3. Create ConnectionStatusTracker
    status = ConnectionStatusTracker()
    app.state.connection_status = status

    # 4. Create QueryExecutor
    app.state.query_engine = QueryExecutor(
        engine_pool=pool,
        connection_resolver=resolver,
        status_tracker=status,
    )

    yield

    # Shutdown
    await pool.dispose_all()
    await engine.dispose()  # metadata engine
```

**No httpx client.** No Superset authentication. No database registration into Superset. Startup is faster and has zero external dependencies (just the metadata DB needs to be reachable).

---

## Data Flow

### Dashboard Rendering (unchanged for frontend)

```
1. Frontend: GET /api/dashboards/managed/{id}
   -> Returns dashboard config with data_source references

2. Frontend: POST /api/data-sources/{ds_id}/query  {filters: {...}}
   -> FastAPI: ConfigStore.get_data_source(ds_id) -> DataSourceConfig
   -> FastAPI: QueryExecutor.execute(ds_config, filters)
     -> _resolve_database(ds_config, filters) -> "superset_db_TCOSPRD"
     -> ConnectionResolver.resolve_name_to_id("superset_db_TCOSPRD") -> "abc-123"
     -> _build_sql(ds_config, filters, dialect="postgresql") -> "SELECT ..."
     -> DataSourceEnginePool.execute_raw("abc-123", sql)
       -> get_engine("abc-123") -> create_async_engine if not cached
       -> engine.connect() -> execute(text(sql)) -> rows
     -> Return {columns, rows, row_count, truncated}

3. Frontend: renders AG Charts/Grid with the data
```

### Connection CRUD (simplified)

```
1. POST /api/databases {name, backend, host, port, ...}
   -> Encrypt password with Fernet
   -> INSERT into recviz_connections
   -> ConnectionResolver.invalidate() (refresh cache)
   -> Return connection info

2. POST /api/databases/test {backend, host, port, ...}
   -> Build URI via uri_builder
   -> DataSourceEnginePool.test_connection(uri)
   -> Return {success, message}

3. DELETE /api/databases/{id}
   -> DataSourceEnginePool.invalidate(id) (dispose cached engine)
   -> DELETE from recviz_connections
   -> ConnectionResolver.invalidate()
```

### SQL Explorer (simplified)

```
1. POST /api/sql/execute {sql, database_id, schema, limit}
   -> DataSourceEnginePool.execute_raw(database_id, sql + " FETCH FIRST {limit} ROWS ONLY")
   -> Return {status, columns, data, row_count}

2. GET /api/sql/databases
   -> SELECT id, name, display_name, backend FROM recviz_connections
   -> Return [{id, database_name, backend}]
```

---

## Alembic Migration Strategy

### Problem: JSONB is PostgreSQL-specific

Current migrations use `from sqlalchemy.dialects.postgresql import JSONB` directly. This will fail on Oracle.

### Solution: Cross-dialect JSON type with with_variant

Define a portable JSON type:

```python
# app/db/types.py
import json as json_lib
from sqlalchemy import JSON, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import TypeDecorator

# For Oracle 19c (no native JSON type), store as CLOB with manual serialization
class OracleJSON(TypeDecorator):
    impl = Text       # Maps to CLOB on Oracle
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            return json_lib.dumps(value)
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            return json_lib.loads(value)
        return value

# Use JSONB on PostgreSQL (efficient binary JSON with indexing)
# Use CLOB-based custom type on Oracle 19c
# Use generic JSON elsewhere (SQLite, etc.)
PortableJSON = JSON().with_variant(JSONB, "postgresql").with_variant(OracleJSON(), "oracle")
```

For Oracle 21c+, `sa.JSON` maps natively. Since the target Oracle is likely 19c (corporate), the CLOB approach with `TypeDecorator` is the safe path. If the production Oracle turns out to be 21c+, simplify to `JSON().with_variant(JSONB, "postgresql")`.

### Migration env.py changes

The existing `env.py` already uses `recviz_alembic_version` as the version table (separate from Superset). No changes needed to the migration framework itself.

New migration scripts should use `PortableJSON` instead of `JSONB`:

```python
# In new migration files
from app.db.types import PortableJSON

op.create_table(
    "recviz_connections",
    sa.Column("id", sa.String(128), primary_key=True),
    ...
)
```

### Migration for new table

A new Alembic migration (005) creates `recviz_connections` and optionally drops `superset_id`/`sync_status` from `recviz_datasets` (or leaves them as deprecated nullable columns for safety).

### Retroactive migration for existing tables

Existing migrations (001-004) hardcode `JSONB`. Two options:
1. **Leave as-is** -- only affects fresh PostgreSQL installs, which is the dev environment. Oracle installs start from a clean schema anyway.
2. **Add migration 005** that alters existing JSONB columns -- unnecessary complexity for dev-only databases.

**Recommendation:** Leave existing migrations PostgreSQL-only. Add a separate Oracle init script (or conditional logic in env.py) for production. The metadata DB in production will be Oracle from the start, so migrations run against Oracle with the PortableJSON type.

---

## What Can Be Reused vs Must Be Rewritten

### Reuse directly (zero changes)
- `db/engine.py` -- metadata engine
- `db/base.py` -- DeclarativeBase
- `db/models/dashboard.py` -- RecvizDashboard
- `db/models/data_source.py` -- RecvizDataSource
- `db/models/chart.py` -- RecvizChart
- `db/models/kpi.py` -- RecvizKpi
- `services/config_store.py` -- data source config lookup
- `services/merge_engine.py` -- client-side join
- `services/uri_builder.py` -- URI construction from fields
- `models/data_source_config.py` -- DataSourceConfig Pydantic model
- `models/database.py` -- DatabaseCreate/Update/Info Pydantic models
- `api/data_sources.py` -- data source query endpoints
- `api/managed_charts.py` -- chart CRUD
- `api/managed_kpis.py` -- KPI CRUD
- `api/managed_dashboards.py` -- dashboard CRUD
- `api/search.py` -- global search
- `api/export.py` -- export endpoints
- `api/views.py` -- saved views

### Reuse with modifications
- `services/query_engine.py` -> `QueryExecutor`: keep `_build_sql()`, `_resolve_database()`, `_build_date_range_clause()`, rewrite `execute()` and `execute_distinct()`
- `services/connection_status.py`: change key type from `int` to `str`
- `db/models/dataset.py`: drop `superset_id` and `sync_status` columns (or mark deprecated)
- `api/managed_datasets.py`: remove DatasetSyncService usage
- `config.py`: remove Superset settings, add encryption key setting
- `core/dependencies.py`: remove SupersetDep, add DataSourceEnginePoolDep

### Delete entirely
- `services/superset_client.py` -- the entire Superset HTTP proxy
- `services/database_registrar.py` -- Superset DB registration logic
- `services/dataset_sync.py` -- Superset dataset syncing

### New files
- `db/models/connection.py` -- RecvizConnection ORM model
- `db/types.py` -- PortableJSON cross-dialect type
- `services/engine_pool.py` -- DataSourceEnginePool
- `services/connection_resolver.py` -- ConnectionResolver (replaces DatabaseRegistrar)
- `services/encryption.py` -- Fernet encrypt/decrypt for credentials
- `migrations/versions/005_*.py` -- migration for recviz_connections + dataset cleanup

---

## Suggested Build Order (Dependencies)

```
Phase 1: Foundation
  1a. recviz_connections table + ORM model + Alembic migration
  1b. PortableJSON type + encryption service
  1c. DataSourceEnginePool (core: create/dispose engines, execute_raw, test_connection)
  1d. ConnectionResolver (replaces DatabaseRegistrar)

Phase 2: Query execution
  2a. QueryExecutor (rewrite execute path, reuse SQL builder)
  2b. ConnectionStatusTracker key type change (int -> str)

Phase 3: API migration
  3a. databases.py rewrite (CRUD against recviz_connections)
  3b. sql.py rewrite (execute via engine pool)
  3c. managed_datasets.py cleanup (remove sync logic)
  3d. main.py lifespan rewrite
  3e. config.py + dependencies.py cleanup

Phase 4: Cleanup
  4a. Delete superset_client.py, database_registrar.py, dataset_sync.py
  4b. Remove Superset from docker-compose.yml
  4c. Remove Redis from docker-compose.yml
  4d. Seed migration script (databases.json -> recviz_connections rows)
  4e. Remove Superset settings from config, .env, etc.

Phase 5: Verification
  5a. All existing API contracts produce identical response shapes
  5b. Frontend loads dashboards with zero changes
  5c. SQL Explorer works against PostgreSQL dev DB
  5d. Connection management UI works (create, test, delete)
  5e. Dataset management works without sync_status
```

**Phase 1 has no API-visible effects** -- it is pure infrastructure. Phase 2 can be tested by swapping the lifespan wiring. Phase 3 is where the frontend starts talking to the new code. Phase 4 is safe cleanup after Phase 3 is verified. Phase 5 is validation.

---

## Security Considerations

### SQL Injection in Query Execution

The current `QueryEngine._build_sql()` uses string interpolation for filter values (e.g., `f"'{v.replace(chr(39), chr(39)*2)}'"` for escaping quotes). This is inherited from the Superset-era design where Superset provided a secondary security boundary.

**With direct execution, this is now the ONLY defense.** Recommendations:
1. **Data source queries** (from `DataSourceConfig.query`): These are dev-authored SQL templates stored in the DB. Safe because devs control the SQL; filter values are the only user input, and they go through the existing escaping.
2. **SQL Explorer** (`/api/sql/execute`): User types raw SQL. This is inherently dangerous. Mitigation: the SQL Explorer is dev-team-only. Add a read-only mode: wrap user SQL in a read-only transaction or validate it starts with SELECT.
3. **Future:** When auth is added, restrict SQL Explorer to admin role.

### Credential Storage

- Passwords encrypted with Fernet (symmetric, key from env var)
- Key rotation: re-encrypt all passwords when key changes (migration script)
- Never log or return passwords in API responses
- URI built at runtime, never stored

---

## Cross-Dialect Compatibility

### SQL differences between PostgreSQL and Oracle

The `_build_date_range_clause()` already handles PostgreSQL vs Oracle syntax. Other areas:

| Feature | PostgreSQL | Oracle | Strategy |
|---------|-----------|--------|----------|
| JSONB columns | Native JSONB | CLOB + TypeDecorator | PortableJSON type |
| `CURRENT_TIMESTAMP` | Supported | Supported | Use as-is |
| `SYSDATE` | Not supported | Supported | Already handled in _build_sql |
| `LIMIT N` | `LIMIT N` | `FETCH FIRST N ROWS ONLY` (12c+) | Handle in execute_raw |
| `INTERVAL` | `INTERVAL '7 days'` | `SYSDATE - 7` | Already handled |
| JSON query | `->`, `->>` operators | `JSON_VALUE`, `JSON_QUERY` | Avoid in metadata queries; data queries are author-controlled |
| `func.now()` | `now()` | `SYSTIMESTAMP` | SQLAlchemy handles via ORM |
| Identifier quoting | `"column_name"` | `"COLUMN_NAME"` | Oracle uppercases unquoted identifiers |

### Model changes for Oracle compatibility

Current ORM models use `from sqlalchemy.dialects.postgresql import JSONB`. Replace with `PortableJSON` in all model files:
- `RecvizDashboard.config`
- `RecvizDataSource.config`
- `RecvizDataset.columns`
- `RecvizChart.config`
- `RecvizKpi.config`

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Shared engine for all databases
**What:** Using one engine with connection-level database switching
**Why bad:** SQLAlchemy engines are bound to a URI. You cannot switch databases per-request on the same engine.
**Instead:** One engine per unique connection URI (the DataSourceEnginePool approach).

### Anti-Pattern 2: Sync engines for data queries
**What:** Using `create_engine` (sync) with `run_sync` wrappers
**Why bad:** Blocks the async event loop during long queries (data queries can take seconds on millions of rows).
**Instead:** Use `create_async_engine` with `asyncpg` (PostgreSQL) or `oracledb_async` (Oracle).

### Anti-Pattern 3: Storing plaintext connection URIs
**What:** Saving full SQLAlchemy URIs (with passwords) in the database
**Why bad:** Password visible in DB dumps, logs, error messages.
**Instead:** Store fields separately, encrypt password, build URI at runtime.

### Anti-Pattern 4: Unlimited engine creation
**What:** Creating engines on every request without caching or limits
**Why bad:** Each engine creates a connection pool. Unbounded engine creation = unbounded connections.
**Instead:** Cache engines by connection ID, limit total engines (8-16 max), evict idle engines.

### Anti-Pattern 5: Using ORM for data queries
**What:** Creating ORM models for recon data tables and using `session.query()`
**Why bad:** Recon tables have unknown schemas (defined by dev SQL). ORM requires static model definitions.
**Instead:** Use `text()` + raw result sets for data queries. ORM is only for RecViz metadata tables.

---

## Scalability Notes

| Concern | Current (with Superset) | Target (direct) |
|---------|------------------------|-----------------|
| Connection overhead | FastAPI -> HTTP -> Superset -> SQLAlchemy -> DB | FastAPI -> SQLAlchemy -> DB (one fewer hop) |
| Startup time | ~15s (auth + DB sync + dataset reconciliation) | ~2s (just load connections from metadata DB) |
| Query latency | +50-200ms (Superset HTTP overhead) | Direct (no proxy overhead) |
| Connection pooling | Superset manages pools | DataSourceEnginePool manages pools |
| Max concurrent queries | Limited by Superset workers | Limited by pool_size per engine |
| Memory | Superset process (~500MB-1GB) + FastAPI | FastAPI only (~100-200MB) |

---

## Sources

- [SQLAlchemy 2.0 Async I/O docs](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html) -- HIGH confidence
- [SQLAlchemy 2.1 Oracle dialect](https://docs.sqlalchemy.org/en/21/dialects/oracle.html) -- HIGH confidence
- [SQLAlchemy Connection Pooling](https://docs.sqlalchemy.org/en/20/core/pooling.html) -- HIGH confidence
- [SQLAlchemy Type Basics (with_variant)](https://docs.sqlalchemy.org/en/20/core/type_basics.html) -- HIGH confidence
- [python-oracledb asyncio docs](https://python-oracledb.readthedocs.io/en/latest/user_guide/asyncio.html) -- HIGH confidence
- [Oracle async in SQLAlchemy (issue #10679)](https://github.com/sqlalchemy/sqlalchemy/issues/10679) -- HIGH confidence, confirmed implemented in 2.0.25
- [Alembic dialect support](https://deepwiki.com/sqlalchemy/alembic/3.4-dialect-support) -- MEDIUM confidence
- [Fernet encryption with SQLAlchemy](https://blog.miguelgrinberg.com/post/encryption-at-rest-with-sqlalchemy) -- HIGH confidence
- [Multi-tenant FastAPI patterns](https://makimo.com/blog/asynchronous-sqlalchemy-and-multiple-databases/) -- MEDIUM confidence
