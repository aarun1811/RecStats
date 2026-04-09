# Feature Landscape: Superset Removal -- Direct Query Engine

**Domain:** Replacing Apache Superset with direct SQLAlchemy query engine in FastAPI
**Researched:** 2026-04-09
**Confidence:** HIGH (primary sources: existing codebase audit, SQLAlchemy 2.0/2.1 official docs, python-oracledb docs)

## Context: What Superset Actually Does for RecViz Today

Based on a complete audit of `superset_client.py`, the API routes, `query_engine.py`, `database_registrar.py`, `dataset_sync.py`, and the Superset config, here is every Superset capability RecViz exercises:

### Superset API Endpoints Actually Called

| Superset Endpoint | RecViz Caller | Purpose |
|---|---|---|
| `POST /api/v1/security/login` | `SupersetClient.authenticate()` | Get JWT token |
| `GET /api/v1/security/csrf_token/` | `SupersetClient.authenticate()` | Get CSRF token for mutations |
| `POST /api/v1/sqllab/execute/` | `QueryEngine.execute()`, `sql.py` | **Core: execute raw SQL against a database** |
| `POST /api/v1/chart/data` | `datasets.py:get_dataset_data()` | Query dataset with adhoc filters (pagination, sort) |
| `GET /api/v1/database/` | `DatabaseRegistrar.sync()`, `databases.py`, `sql.py` | List registered databases |
| `GET /api/v1/database/{id}` | `databases.py:get_database()` | Get single database details |
| `POST /api/v1/database/` | `DatabaseRegistrar.sync()`, `databases.py` | Register a new database connection |
| `PUT /api/v1/database/{id}` | `databases.py:update_database()` | Update database connection |
| `DELETE /api/v1/database/{id}` | `databases.py:delete_database()` | Delete database connection |
| `POST /api/v1/database/test_connection/` | `databases.py:test_connection()` | Test database connectivity |
| `GET /api/v1/dataset/` | `datasets.py:list_datasets()` | List Superset virtual datasets |
| `GET /api/v1/dataset/{id}` | `datasets.py:get_dataset()` | Get dataset with column metadata |
| `POST /api/v1/dataset/` | `DatasetSyncService.sync_dataset()` | Create virtual dataset in Superset |
| `PUT /api/v1/dataset/{id}` | `DatasetSyncService.sync_dataset()` | Update virtual dataset SQL |
| `DELETE /api/v1/dataset/{id}` | `DatasetSyncService.delete_synced()` | Delete virtual dataset |
| `GET /api/v1/chart/` | `SupersetClient.list_charts()` | **Not called by any route** |
| `GET /api/v1/chart/{id}` | `SupersetClient.list_charts()` | **Not called by any route** |
| `GET /api/v1/dashboard/` | `SupersetClient.list_dashboards()` | **Not called by any route** |
| `GET /api/v1/dashboard/{id}` | `SupersetClient.get_dashboard()` | **Not called by any route** |

### What Superset Provides Under the Hood

When RecViz calls `POST /api/v1/sqllab/execute/`, Superset internally:
1. Looks up the database by `database_id` (connection string stored in its metadata DB)
2. Creates a SQLAlchemy engine for that database dialect
3. Executes the SQL with a row limit
4. Returns `{columns: [{name, type, is_date}], data: [{col: val, ...}], status: "success"}`
5. Optionally caches results in Redis (configured in `superset_config.py`)

When RecViz calls `POST /api/v1/chart/data`, Superset:
1. Looks up the virtual dataset (SQL + database)
2. Applies adhoc_filters as WHERE clauses to the SQL
3. Applies row_limit, row_offset, orderby
4. Executes the modified SQL
5. Returns `{result: [{data: [...], rowcount: N, ...}]}`

---

## Table Stakes (Must Replicate from Superset for v1.0 Parity)

Features users and the system depend on today. Dropping any of these breaks existing functionality.

### TS-1: Raw SQL Execution Against Configured Databases

| Aspect | Detail |
|---|---|
| **What it does** | Accept SQL string + database identifier, execute against the correct database, return rows + column metadata |
| **Current path** | `QueryEngine.execute()` -> `SupersetClient.execute_sql()` -> Superset `/api/v1/sqllab/execute/` |
| **Replacement** | Direct SQLAlchemy `text()` execution via async engine. `async with engine.connect() as conn: result = await conn.execute(text(sql))` |
| **Complexity** | MEDIUM |
| **Column type detection** | Superset returns `{name, type, is_date}` per column. SQLAlchemy's `result.cursor.description` provides column names and DB-API type codes. Map these to the same string types (`VARCHAR`, `NUMERIC`, `DATE`, `TIMESTAMP`). For the RecViz column model (`string`, `number`, `date`, `currency`), this is sufficient. |
| **Row limit** | Superset applies row limit server-side. Replace with `SELECT * FROM (user_sql) sub LIMIT :limit` for PostgreSQL or `SELECT * FROM (user_sql) sub WHERE ROWNUM <= :limit` for Oracle. Better: wrap in a CTE or use `text(sql).limit(n)` -- but `text()` does not support `.limit()`. Use SQL wrapping. |
| **Error handling** | Superset returns structured errors for bad SQL, connection failures, timeouts. Replace with try/except on `sqlalchemy.exc.OperationalError`, `sqlalchemy.exc.ProgrammingError`, `asyncio.TimeoutError`. Map to the same HTTP error structure the frontend expects. |
| **Dependencies** | Requires TS-2 (connection management) to know which engine to use |

### TS-2: Database Connection Management (CRUD + Storage)

| Aspect | Detail |
|---|---|
| **What it does** | Create, read, update, delete database connections. Store connection URIs. Map logical name -> connection details. |
| **Current path** | `databases.py` -> `SupersetClient` -> Superset REST API. Superset stores connections in its PostgreSQL metadata DB. `databases.json` defines initial connections, `DatabaseRegistrar` syncs them to Superset on startup. |
| **Replacement** | Store connections in a new `recviz_databases` table in the metadata DB (PostgreSQL dev / Oracle prod). CRUD endpoints stay at `/api/databases`. Remove all Superset proxy calls. |
| **Complexity** | MEDIUM |
| **Schema design** | `recviz_databases` table: `id` (int, PK auto), `name` (unique), `display_name`, `backend` (oracle/postgresql), `host`, `port`, `database_name`, `username`, `encrypted_password`, `schema_name`, `dialect`, `extra_params` (JSONB), `status`, `last_tested_at`, `created_at`, `updated_at` |
| **Credential storage** | Currently stored in plaintext in `databases.json` and Superset metadata. For v2.0: use Fernet symmetric encryption for passwords at rest (Python `cryptography` library). Encryption key from env var. Not enterprise KMS, but better than plaintext. |
| **URI construction** | `uri_builder.py` already builds SQLAlchemy URIs from form fields. Keep this, extend to generate async URIs (`postgresql+asyncpg://`, `oracle+oracledb_async://`). |
| **Initial data** | Migrate `databases.json` entries into the new table on first startup. One-time migration, then the file becomes unnecessary. |
| **Dependencies** | None -- this is foundational |

### TS-3: Database Connection Testing

| Aspect | Detail |
|---|---|
| **What it does** | Test if a database connection works before saving it. Return success/failure with error message. |
| **Current path** | `databases.py:test_connection()` -> `SupersetClient.test_connection()` -> Superset `POST /api/v1/database/test_connection/` |
| **Replacement** | Create a temporary async engine, attempt `SELECT 1` (PostgreSQL) or `SELECT 1 FROM DUAL` (Oracle). Timeout after 10 seconds. Return success/failure. Dispose engine after test. |
| **Complexity** | LOW |
| **Connection status tracking** | `ConnectionStatusTracker` (in-memory) already works. Update it when test succeeds/fails. Keep the same `/api/databases/test` endpoint shape. |
| **Dependencies** | Requires TS-2 for connection details |

### TS-4: Dynamic Engine Pool Management

| Aspect | Detail |
|---|---|
| **What it does** | Maintain a pool of SQLAlchemy async engines, one per registered database. Create engines lazily on first use. Dispose on database deletion or update. |
| **Current path** | Superset manages its own engine pool internally. RecViz has no visibility into it. |
| **Replacement** | New `EngineManager` service: `dict[int, AsyncEngine]`. On first query to a database, create `create_async_engine()` with pool settings. Cache the engine. On connection update/delete, `await engine.dispose()` and remove from cache. On startup, pre-warm engines for all registered databases. |
| **Complexity** | MEDIUM |
| **Pool settings** | `pool_size=5` per database (conservative -- RecViz is single-tenant). `max_overflow=10`. `pool_timeout=30`. `pool_recycle=1800` (30 min). `pool_pre_ping=True` (detect stale connections). |
| **Oracle specifics** | Use `oracle+oracledb_async://` dialect string. Requires SQLAlchemy 2.0.25+. Thin mode only (no Oracle Instant Client). Connection string format: `oracle+oracledb_async://user:pass@host:port/?service_name=SID`. |
| **PostgreSQL specifics** | Use `postgresql+asyncpg://` (already used for metadata DB). |
| **Dependencies** | Requires TS-2 for connection details |

### TS-5: Dataset SQL Execution with Filter Injection

| Aspect | Detail |
|---|---|
| **What it does** | Execute a managed dataset's SQL query with runtime filter injection, pagination, and sorting. This powers every chart and grid on every dashboard. |
| **Current path** | Two paths: (A) `data_sources.py` -> `QueryEngine.execute()` -> builds SQL from config template with `{{filters}}` -> `SupersetClient.execute_sql()`. (B) `datasets.py:get_dataset_data()` -> `SupersetClient.get_chart_data()` with adhoc_filters, row_limit, row_offset, orderby. |
| **Replacement** | Unify into one path. `QueryEngine.execute()` already builds SQL with filter injection. Replace `self._superset.execute_sql()` call with direct `engine.execute(text(sql))` using the engine from TS-4. The SQL template system (`{{filters}}`, `{{values}}`, `{{date_range_clause}}`) stays unchanged -- it is RecViz's own code, not Superset's. |
| **Complexity** | LOW-MEDIUM (mostly wiring change) |
| **Pagination** | Currently done via `row_limit` and `row_offset` in Superset's adhoc query format. Replace with SQL-level `LIMIT/OFFSET` (PostgreSQL) or `OFFSET FETCH` (Oracle 12c+) wrapping. |
| **Sorting** | Currently `orderby` in Superset's query format. Replace with `ORDER BY` clause appended to SQL before limit/offset wrapping. |
| **Dependencies** | Requires TS-1, TS-4 |

### TS-6: Dataset Metadata Management (Without Superset Sync)

| Aspect | Detail |
|---|---|
| **What it does** | Create, update, delete managed datasets. Currently each dataset is dual-stored: RecViz metadata in `recviz_datasets` table + a "virtual dataset" mirrored in Superset via `DatasetSyncService`. |
| **Replacement** | Drop the Superset sync entirely. Remove `superset_id`, `sync_status` columns from `recviz_datasets`. Remove `DatasetSyncService`. Dataset CRUD becomes purely local -- write to `recviz_datasets`, done. The `managed_datasets.py` endpoints simplify dramatically. |
| **Complexity** | LOW (removing code is easier than adding it) |
| **Column metadata** | Already stored in `recviz_datasets.columns` as JSONB. The `ColumnMetaSchema` model (`name`, `display_name`, `data_type`, `role`, `aggregation`, `format_preset`, `format_string`) is RecViz-owned. No Superset involvement. |
| **What disappears** | `DatasetSyncService` class, `dataset_sync.py` file, startup reconciliation loop, `superset_id` field, `sync_status` field, Superset virtual dataset concept entirely. |
| **Dependencies** | None -- can be done independently |

### TS-7: Schema Browser (Table/Column Introspection)

| Aspect | Detail |
|---|---|
| **What it does** | SQL Explorer's schema browser shows tables and columns for a database. Used by dev team when writing dataset SQL. |
| **Current path** | Not currently implemented in RecViz -- the SQL Explorer lists databases via `sql.py:list_databases()` -> Superset, but has no table/column browser. Devs write SQL from memory or external tools. |
| **Replacement** | Use SQLAlchemy Inspector via `run_sync`: `inspector = inspect(conn)`, `inspector.get_table_names(schema=...)`, `inspector.get_columns(table_name, schema=...)`. New endpoints: `GET /api/databases/{id}/schemas`, `GET /api/databases/{id}/tables?schema=X`, `GET /api/databases/{id}/columns?schema=X&table=Y`. |
| **Complexity** | MEDIUM |
| **Oracle specifics** | Oracle has many system tables. Filter to user-owned tables: `inspector.get_table_names(schema=owner)`. Oracle schemas = Oracle users. |
| **Caching** | Schema metadata changes rarely. Cache introspection results in-memory with 5-minute TTL. Use `cachetools.TTLCache`. |
| **Dependencies** | Requires TS-4 (engine pool) |

### TS-8: SQL Explorer Direct Execution

| Aspect | Detail |
|---|---|
| **What it does** | Dev team types arbitrary SQL in Monaco editor, hits "Run", sees results in a grid. Separate from dashboard query execution. |
| **Current path** | `sql.py:execute_sql()` -> `SupersetClient.execute_sql()` with `database_id`, `sql`, `schema`, `limit` |
| **Replacement** | Same as TS-1 but exposed via the `/api/sql/execute` endpoint. Accept `database_id`, `sql`, `schema`, `limit`. Look up engine from TS-4, execute with `text()`, return `{columns, data, row_count}`. Keep query history in-memory (already implemented). |
| **Complexity** | LOW (it is TS-1 behind a different endpoint) |
| **Safety** | Add query timeout (configurable, default 60s). Add read-only enforcement: reject statements starting with `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `CREATE`, `TRUNCATE`. This is a defense-in-depth measure -- the database user should also be read-only. |
| **Dependencies** | Requires TS-1, TS-4 |

---

## Differentiators (Things We Can Do BETTER Without Superset)

Removing Superset is not just about parity -- it unlocks improvements that were impossible with a proxied architecture.

### D-1: Faster Query Execution (Eliminate Double-Hop)

| Aspect | Detail |
|---|---|
| **What improves** | Every query currently goes: FastAPI -> HTTP -> Superset -> SQLAlchemy -> Database -> Superset -> HTTP -> FastAPI. Removing Superset eliminates the HTTP hop, JSON serialization/deserialization, Superset's auth check, Superset's query parsing. Direct path: FastAPI -> SQLAlchemy -> Database -> FastAPI. |
| **Expected improvement** | 50-200ms latency reduction per query. On dashboards with 10+ queries, this is 0.5-2 seconds of wall time saved. |
| **Complexity** | FREE (inherent to the removal) |
| **Confidence** | HIGH -- the HTTP serialization overhead is measurable |

### D-2: Better Error Messages

| Aspect | Detail |
|---|---|
| **What improves** | Superset wraps database errors in its own error format, sometimes losing the original Oracle error code (ORA-XXXXX) or PostgreSQL error detail. Direct SQLAlchemy exceptions preserve the full `orig` attribute with the native database error. |
| **Replacement** | Catch `sqlalchemy.exc.OperationalError` and extract `e.orig` for the native error. Return structured errors with the Oracle error code or PostgreSQL SQLSTATE. Dev team debugging SQL queries gets the real error, not Superset's interpretation. |
| **Complexity** | LOW |

### D-3: Streaming Large Result Sets

| Aspect | Detail |
|---|---|
| **What improves** | Superset loads the entire result set into memory before returning JSON. For 100K+ row exports, this is a memory bottleneck. Direct SQLAlchemy supports `result.partitions(batch_size)` for server-side cursors, enabling streaming responses. |
| **What to build** | `StreamingResponse` for CSV/Excel export endpoints. Fetch 1000 rows at a time, write to response stream. Never hold the full result in memory. |
| **Complexity** | MEDIUM |
| **Dependencies** | Requires TS-1, TS-4. Useful for export endpoints (currently stubbed). |

### D-4: Connection Pool Observability

| Aspect | Detail |
|---|---|
| **What improves** | Superset's connection pool is opaque -- no metrics exposed. Direct SQLAlchemy engines expose pool stats: `engine.pool.status()` returns pool size, checked-out connections, overflow count. |
| **What to build** | `GET /api/health/pools` endpoint showing pool stats per database. Useful for production monitoring. |
| **Complexity** | LOW |

### D-5: Simplified Infrastructure (No Superset, No Redis)

| Aspect | Detail |
|---|---|
| **What improves** | Current dev setup requires Docker with PostgreSQL + Redis + pip install Superset + Superset startup + database initialization + Alembic migration conflicts (`recviz_alembic_version` workaround). Production requires Superset process + Redis process + separate metadata DB. |
| **After removal** | Dev: Docker with PostgreSQL only + `uvicorn` + `pnpm dev`. Production: FastAPI + Oracle. Two processes total (FastAPI + frontend static files). |
| **Complexity** | FREE (inherent to removal) |
| **Impact** | Dramatically simpler onboarding for new developers. Faster CI/CD. Fewer moving parts to debug in production. |

### D-6: Query Timeout Control

| Aspect | Detail |
|---|---|
| **What improves** | Superset has a global query timeout. Direct SQLAlchemy allows per-query timeout via `conn.execution_options(timeout=N)` or by wrapping in `asyncio.wait_for()`. Different queries can have different timeouts. |
| **What to build** | SQL Explorer queries: 60s timeout. Dashboard chart queries: 30s timeout. Schema introspection: 10s timeout. Configurable per-database. |
| **Complexity** | LOW |

### D-7: True Async All the Way Down

| Aspect | Detail |
|---|---|
| **What improves** | Current architecture is fake-async: FastAPI is async, but `httpx` calls to Superset block on Superset's synchronous processing. With direct async engines (`oracledb_async`, `asyncpg`), the entire path is truly non-blocking. |
| **Impact** | Better concurrency under load. A slow Oracle query does not block other requests from being served. |
| **Complexity** | FREE (inherent to using async engines) |

---

## Anti-Features (Superset Complexity We Must NOT Replicate)

Superset has many features we never used and should not rebuild. Explicitly listing them prevents scope creep.

### AF-1: Superset Virtual Dataset Abstraction

| What it is | Why NOT to replicate |
|---|---|
| Superset's concept of "virtual datasets" -- SQL saved as a named object in Superset with its own ID, column detection, metric definitions, and "explore" interface | RecViz already has `recviz_datasets` table with its own metadata model (`ColumnMetaSchema` with display names, roles, aggregation defaults, format presets). The Superset virtual dataset was a redundant mirror. Removing it simplifies the data model. Datasets are RecViz-managed, period. |

### AF-2: Superset Chart Data API (Adhoc Query Builder)

| What it is | Why NOT to replicate |
|---|---|
| Superset's `/api/v1/chart/data` endpoint accepts a complex JSON query format with `datasource`, `queries[]` containing `columns`, `metrics`, `filters`, `orderby`, `row_limit`, `row_offset`, `extras`, `time_range`, etc. It is essentially a JSON-to-SQL compiler. | RecViz's `QueryEngine` already builds SQL from templates with `{{filters}}` placeholders. This is simpler, more transparent (the SQL is visible in the dataset definition), and easier to debug. Do not rebuild Superset's JSON-to-SQL layer. Instead, use the existing template-based SQL builder and enhance it with LIMIT/OFFSET/ORDER BY support. |

### AF-3: Superset Result Caching (Redis)

| What it is | Why NOT to replicate |
|---|---|
| Superset caches query results in Redis with configurable TTL (300s metadata, 600s data). Cache keys based on query hash. | RecViz uses TanStack Query on the client side with 5-minute stale time and 30-minute garbage collection. This is sufficient for the use case: single-tenant, desktop app, ~12 concurrent users. Server-side caching adds infrastructure (Redis) for marginal benefit. If server-side caching is needed later, use `cachetools.TTLCache` in-memory (see Optional section below). Do not bring back Redis. |

### AF-4: Superset Authentication / RBAC

| What it is | Why NOT to replicate |
|---|---|
| Superset's Flask-AppBuilder auth system with roles, permissions, row-level security, JWT tokens, CSRF tokens, OAuth support | RecViz explicitly defers auth to a future milestone. No auth system needed for v2.0. When auth is added, it will be SSO/SAML/OIDC at the FastAPI level, not a Superset-style permission system. |

### AF-5: Superset Metadata Database

| What it is | Why NOT to replicate |
|---|---|
| Superset maintains its own PostgreSQL metadata database with 50+ tables: `ab_user`, `ab_role`, `dashboards`, `slices`, `tables`, `columns`, `metrics`, `query`, `saved_query`, `logs`, `annotation`, `report_schedule`, etc. | RecViz has 5 managed tables (`recviz_dashboards`, `recviz_charts`, `recviz_datasets`, `recviz_kpis`, `recviz_data_sources`). Adding `recviz_databases` makes 6. That is the entire metadata layer. Do not create a parallel Superset-sized schema. |

### AF-6: Superset Chart/Dashboard Objects

| What it is | Why NOT to replicate |
|---|---|
| Superset has its own chart and dashboard objects (`/api/v1/chart/`, `/api/v1/dashboard/`). The `SupersetClient` has methods `list_charts()`, `get_chart()`, `list_dashboards()`, `get_dashboard()`. | These methods exist in `superset_client.py` but are **never called by any route handler**. They are dead code. RecViz manages charts and dashboards entirely in its own tables. Drop them. |

### AF-7: Celery Async Query Execution

| What it is | Why NOT to replicate |
|---|---|
| Superset can run queries asynchronously via Celery, storing results in Redis. The `execute_sql()` call uses `"runAsync": False` (synchronous mode). | RecViz never uses async query execution. All queries run synchronously with a timeout. For large exports, use streaming (D-3) instead of background jobs. Do not add Celery infrastructure. |

### AF-8: Superset Template Processing

| What it is | Why NOT to replicate |
|---|---|
| Superset has Jinja2 template processing in SQL (`FEATURE_FLAGS: ENABLE_TEMPLATE_PROCESSING`). Allows `{{ current_username() }}`, `{{ url_param('x') }}`, etc. | RecViz has its own simpler template system (`{{filters}}`, `{{values}}`, `{{date_range_clause}}`, `{{column}}`). These are processed in `QueryEngine._build_sql()`. Keep this. Do not add Jinja2 complexity. |

---

## Optional Features (Nice to Have, Not Required for Parity)

### OPT-1: In-Memory Query Result Cache

| Aspect | Detail |
|---|---|
| **What** | TTL-based in-memory cache for query results on the server side. Prevents re-executing identical queries within a short window. |
| **When needed** | If TanStack Query client-side caching proves insufficient -- e.g., multiple users viewing the same dashboard trigger duplicate database queries. |
| **Implementation** | `cachetools.TTLCache(maxsize=200, ttl=300)` keyed by hash of `(database_id, sql, params)`. ~50 lines of code. |
| **Complexity** | LOW |
| **Decision** | Defer. Implement only if query load becomes a measured problem. TanStack Query with 5-min stale time means each client caches independently. With ~12 concurrent users this is likely fine. |

### OPT-2: Query History Persistence

| Aspect | Detail |
|---|---|
| **What** | SQL Explorer query history is currently in-memory (`_query_history: list[dict]`). Lost on restart. |
| **Implementation** | Add `recviz_query_history` table. Store last 500 queries per database. Show in SQL Explorer sidebar. |
| **Complexity** | LOW |
| **Decision** | Nice to have. In-memory works for dev usage. Persist if users request it. |

### OPT-3: Query Cost Estimation

| Aspect | Detail |
|---|---|
| **What** | Before executing a query, run `EXPLAIN` (PostgreSQL) or `EXPLAIN PLAN FOR` (Oracle) to estimate cost/rows. Warn if estimated rows exceed threshold. |
| **Complexity** | MEDIUM |
| **Decision** | Defer. Useful for protecting production databases, but not needed for v2.0 parity. |

---

## Feature Dependencies

```
TS-2: Database Connection Management (CRUD + Storage)
  |
  +--enables--> TS-3: Connection Testing
  |
  +--enables--> TS-4: Dynamic Engine Pool
                  |
                  +--enables--> TS-1: Raw SQL Execution
                  |               |
                  |               +--enables--> TS-5: Dataset SQL with Filters
                  |               |
                  |               +--enables--> TS-8: SQL Explorer Execution
                  |
                  +--enables--> TS-7: Schema Browser
                  |
                  +--enables--> D-3: Streaming Results
                  |
                  +--enables--> D-4: Pool Observability

TS-6: Dataset Metadata (No Sync) -- INDEPENDENT, can be done first or in parallel

D-1: Faster Queries -- FREE, automatic with removal
D-2: Better Errors -- FREE, falls out of direct exception handling
D-5: Simpler Infra -- FREE, result of removing Superset + Redis
D-6: Timeout Control -- LOW, add after TS-4
D-7: True Async -- FREE, inherent to async engine usage
```

### Critical Path

```
TS-2 (DB storage) -> TS-4 (engine pool) -> TS-1 (SQL execution) -> TS-5 (dataset queries)
```

Everything else branches off TS-4. TS-6 (removing DatasetSyncService) is independent and can be done early as a cleanup win.

---

## Migration Surface Analysis

### API Endpoints That Change

| Endpoint | Current (Superset Proxy) | After (Direct) | Frontend Impact |
|---|---|---|---|
| `GET /api/databases` | Proxies Superset list | Queries `recviz_databases` table | Response shape stays identical -- no frontend change |
| `GET /api/databases/{id}` | Proxies Superset get | Queries `recviz_databases` table | No frontend change |
| `POST /api/databases` | Creates in Superset | Inserts into `recviz_databases` | No frontend change |
| `PUT /api/databases/{id}` | Updates in Superset | Updates `recviz_databases` + disposes cached engine | No frontend change |
| `DELETE /api/databases/{id}` | Deletes from Superset | Deletes from `recviz_databases` + disposes cached engine | No frontend change |
| `POST /api/databases/test` | Superset test_connection | Direct `SELECT 1` via temp engine | No frontend change |
| `POST /api/data-sources/{id}/query` | QueryEngine -> Superset execute_sql | QueryEngine -> direct engine execute | No frontend change |
| `GET /api/data-sources/{id}/distinct/{col}` | QueryEngine -> Superset execute_sql | QueryEngine -> direct engine execute | No frontend change |
| `POST /api/data-sources/merge` | QueryEngine -> Superset execute_sql | QueryEngine -> direct engine execute | No frontend change |
| `POST /api/sql/execute` | Superset sqllab execute | Direct engine execute | No frontend change |
| `GET /api/sql/databases` | Superset list databases | Queries `recviz_databases` | No frontend change |
| `GET /api/datasets` | Superset list datasets | **Remove or redirect to managed** | Minor frontend change (if used) |
| `GET /api/datasets/{id}` | Superset get dataset | **Remove or redirect to managed** | Minor frontend change (if used) |
| `POST /api/datasets/{id}/data` | Superset chart/data | **Replace with direct query** | Response shape change possible |
| `POST /api/datasets/managed` | Creates in RecViz + syncs to Superset | Creates in RecViz only | No frontend change (sync was non-blocking) |
| `PUT /api/datasets/managed/{id}` | Updates in RecViz | Updates in RecViz only | No frontend change |
| `DELETE /api/datasets/managed/{id}` | Deletes from RecViz + Superset | Deletes from RecViz only | No frontend change |

### Frontend Impact Summary

**Zero frontend changes required** for the core migration. All API response shapes can remain identical. The frontend talks to FastAPI endpoints, not to Superset. The proxy layer is transparent.

The only endpoints that might change shape are the Superset-native dataset routes (`/api/datasets`, `/api/datasets/{id}`, `/api/datasets/{id}/data`) which either get removed (if unused) or consolidated into the managed dataset endpoints (if used).

### Files to Delete

| File | Reason |
|---|---|
| `backend/app/services/superset_client.py` | No longer needed |
| `backend/app/services/dataset_sync.py` | No longer needed |
| `backend/app/services/database_registrar.py` | Replaced by direct DB table |
| `backend/app/api/datasets.py` (Superset proxy routes) | Replaced by managed_datasets or new direct routes |
| `backend/app/models/database_config.py` | `DatabaseEntry` model for JSON config file, replaced by DB model |
| `backend/app/config/databases.json` | Connections stored in DB |
| `superset/superset_config.py` | No Superset |
| `superset/superset_config_local.py` | No Superset |
| `superset/` directory | Entirely |

### Files to Modify

| File | Change |
|---|---|
| `backend/app/main.py` | Remove Superset client init, registrar sync, dataset reconciliation. Add engine manager init. |
| `backend/app/config.py` | Remove `superset_url`, `superset_username`, `superset_password`, `redis_url`. Add `encryption_key` for credential storage. |
| `backend/app/core/dependencies.py` | Remove `SupersetDep`, `DatasetSyncDep`. Add `EngineManagerDep`. |
| `backend/app/services/query_engine.py` | Replace `self._superset.execute_sql()` with direct engine execution. Remove httpx error handling. |
| `backend/app/api/databases.py` | Replace Superset proxy calls with direct DB queries. Remove httpx error mapping. |
| `backend/app/api/sql.py` | Replace Superset proxy calls with direct engine execution. |
| `backend/app/api/managed_datasets.py` | Remove sync_service calls, superset_id references. |
| `backend/app/db/models/dataset.py` | Remove `superset_id`, `sync_status` columns. |
| `backend/app/models/managed_dataset.py` | Remove `superset_id`, `sync_status` from response model. |
| `backend/app/services/connection_status.py` | Change from Superset ID tracking to RecViz database ID tracking. |

### New Files to Create

| File | Purpose |
|---|---|
| `backend/app/services/engine_manager.py` | Dynamic engine pool management |
| `backend/app/db/models/database_connection.py` | SQLAlchemy model for `recviz_databases` table |
| `backend/app/models/database_connection.py` | Pydantic request/response models |
| `backend/app/services/credential_encryption.py` | Fernet encryption for stored passwords |
| `backend/app/api/schema_browser.py` | Schema introspection endpoints (tables, columns) |
| `backend/app/migrations/versions/NNN_add_databases_table.py` | Alembic migration |
| `backend/app/migrations/versions/NNN_remove_superset_fields.py` | Remove superset_id, sync_status from datasets |

---

## Complexity Summary

| Feature | Complexity | Lines of Code (Estimate) | Risk |
|---|---|---|---|
| TS-2: Database Connection Storage | MEDIUM | ~200 (model + migration + CRUD) | Low -- straightforward CRUD |
| TS-3: Connection Testing | LOW | ~50 | Low |
| TS-4: Engine Pool Manager | MEDIUM | ~150 | Medium -- async engine lifecycle, Oracle dialect quirks |
| TS-1: Raw SQL Execution | MEDIUM | ~100 | Medium -- error mapping, column type detection |
| TS-5: Dataset Query with Filters | LOW-MEDIUM | ~80 (mostly modifying existing QueryEngine) | Low -- existing SQL builder stays |
| TS-6: Remove Dataset Sync | LOW | Net negative (deleting code) | Low |
| TS-7: Schema Browser | MEDIUM | ~150 | Medium -- Oracle schema introspection can be slow |
| TS-8: SQL Explorer Execution | LOW | ~50 | Low |
| D-3: Streaming Results | MEDIUM | ~100 | Low |
| Cleanup (delete Superset files) | LOW | Net negative | Low |
| **Total new code** | | **~880 lines** | |
| **Total deleted code** | | **~800+ lines** (superset_client, dataset_sync, registrar, Superset configs) | |

The migration is roughly code-neutral: we write ~880 lines and delete ~800+.

---

## Sources

- [SQLAlchemy 2.0 Oracle Dialect Documentation](https://docs.sqlalchemy.org/en/20/dialects/oracle.html) -- oracledb_async dialect support
- [SQLAlchemy 2.0 Connection Pooling](https://docs.sqlalchemy.org/en/20/core/pooling.html) -- AsyncAdaptedQueuePool, pool settings
- [SQLAlchemy 2.0 Async I/O](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html) -- run_sync for Inspector, async engine patterns
- [python-oracledb Asyncio Documentation](https://python-oracledb.readthedocs.io/en/latest/user_guide/asyncio.html) -- AsyncConnection, thin mode, async pooling
- [SQLAlchemy Oracle Async Support Issue #10679](https://github.com/sqlalchemy/sqlalchemy/issues/10679) -- oracledb_async integration status
- [SQLAlchemy Reflecting Database Objects](https://docs.sqlalchemy.org/en/20/core/reflection.html) -- Inspector.get_table_names(), get_columns()
- [FastAPI Async Database Connections 2026](https://oneuptime.com/blog/post/2026-02-02-fastapi-async-database/view) -- async engine patterns with FastAPI
- [TTL LRU Cache in Python/FastAPI](https://medium.com/@priyanshu009ch/ttl-lru-cache-in-python-fastapi-2ca2a39258dc) -- in-memory caching without Redis
- Existing codebase: `superset_client.py`, `query_engine.py`, `database_registrar.py`, `dataset_sync.py`, `databases.py`, `datasets.py`, `sql.py`, `managed_datasets.py`

---
*Feature research for: RecViz v2.0 -- Superset Removal, Direct Query Engine*
*Researched: 2026-04-09*
