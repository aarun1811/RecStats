# Domain Pitfalls: Removing Superset, Building Direct Database Engine

**Domain:** Removing heavyweight dependency (Superset) from working BI platform, replacing with direct SQLAlchemy query engine
**Researched:** 2026-04-09
**Confidence:** HIGH (verified via codebase analysis, SQLAlchemy 2.0/2.1 docs, python-oracledb docs, and cross-referenced community patterns)

---

## Critical Pitfalls

Mistakes that cause rewrites, data corruption, or production outages.

---

### Pitfall 1: PostgreSQL JSONB Columns in Every ORM Model Break on Oracle

**What goes wrong:**
Every metadata model in the codebase uses `JSONB` imported directly from `sqlalchemy.dialects.postgresql`:

```python
from sqlalchemy.dialects.postgresql import JSONB
# Used in: RecvizDataSource, RecvizDataset, RecvizDashboard, RecvizChart, RecvizKpi
config: Mapped[dict] = mapped_column(JSONB, nullable=False)
```

Oracle does not have a native JSONB type. SQLAlchemy's oracledb dialect does not yet support the generic `JSON` type with full round-trip fidelity for Oracle. When you switch `recviz_db_url` to an Oracle connection string, every `CREATE TABLE` and every ORM query touching these columns will fail. This is not a runtime subtlety -- it is a hard crash on startup when Alembic tries to run migrations.

**Why it happens:**
During v1.0, the dev environment was PostgreSQL and production was planned as PostgreSQL (for metadata). The JSONB import was the natural choice. Nobody tested against Oracle because Superset owned the data-query connections and metadata lived in PostgreSQL. Now that production targets Oracle for everything (metadata + data queries), every model is dialect-incompatible.

**Consequences:**
- Application cannot start in production
- Alembic migrations fail against Oracle
- All 5 Alembic migration files explicitly reference `JSONB`
- Every ORM model file imports from `sqlalchemy.dialects.postgresql`

**Prevention:**
Replace all `JSONB` columns with a cross-dialect type. Two options:

1. **`with_variant()` pattern** (recommended):
   ```python
   from sqlalchemy import JSON
   from sqlalchemy.dialects.postgresql import JSONB
   
   # Use JSONB on PostgreSQL (dev), generic JSON on Oracle (prod)
   JsonColumn = JSON().with_variant(JSONB(), "postgresql")
   ```

2. **Custom TypeDecorator** wrapping CLOB for Oracle:
   ```python
   class CrossDbJSON(TypeDecorator):
       impl = Text  # Falls back to CLOB on Oracle
       cache_ok = True
       def process_bind_param(self, value, dialect):
           return json.dumps(value) if value is not None else None
       def process_result_value(self, value, dialect):
           return json.loads(value) if value is not None else None
   ```

Option 1 is simpler if Oracle 21c+ is available (native JSON type). Option 2 works on Oracle 12c+. The existing five migration files must also be rewritten to use the same cross-dialect type.

**Detection:** Try running Alembic against an Oracle database. It will fail immediately.

**Phase:** Must be addressed in Phase 1 (engine/model foundation) before anything else works.

---

### Pitfall 2: Superset Response Shape is Deeply Embedded in Frontend

**What goes wrong:**
The current `QueryEngine.execute()` returns a response shaped by Superset's SQL Lab API:
```python
{
    "columns": result.get("columns", []),  # Superset column format
    "rows": result.get("data", []),        # Superset uses "data" key
    "row_count": len(rows),
    "truncated": truncated,
}
```

Meanwhile, `sql.py` (SQL Explorer) returns the raw Superset shape:
```python
{
    "status": "success",
    "columns": result.get("columns", []),
    "data": result.get("data", []),
    "row_count": len(result.get("data", [])),
}
```

Superset's `columns` format is `[{"column_name": "FOO", "name": "FOO", "type": "STRING", ...}]`. The frontend's `builder-panel-content.tsx` has explicit normalization code:
```typescript
/** Normalize column names returned by /api/sql/execute (may be strings or {column_name, name}). */
```

If the new direct query engine returns columns in a different format (SQLAlchemy's `cursor.description` returns tuples of `(name, type_code, ...)`), every frontend consumer will break silently -- charts render empty, grids show no columns, KPI cards show zero.

**Why it happens:**
The Superset API has an idiosyncratic response shape that frontend code has adapted to over 11 phases. The response contract is implicit (no shared schema), so changes to the backend response shape cascade unpredictably.

**Consequences:**
- Charts render with no data (columns don't match expected keys)
- AG Grid shows "No Rows To Show" even when data exists
- KPI cards compute as 0/NaN
- SQL Explorer results panel breaks
- Cross-filter and drill-down break (they parse column metadata)

**Prevention:**
1. Document the exact response contract Superset currently returns (column format, data format, error format)
2. Build the new query engine to return the **exact same response shape**
3. Write integration tests that assert response shape before and after
4. Key fields to preserve: `columns` (array of objects with `column_name` and `name` keys), `data`/`rows` (array of row-objects keyed by column name), `status`, `row_count`

**Detection:** Run the full seed data suite from Phase 10 against the new engine. If any dashboard, chart, or KPI card renders differently, the shape changed.

**Phase:** Phase 1 (query engine replacement). Build a response adapter that normalizes SQLAlchemy results into the existing Superset shape.

---

### Pitfall 3: Connection Pool Exhaustion Under Concurrent Dashboard Load

**What goes wrong:**
The current architecture uses a single httpx client to proxy queries through Superset. Superset manages its own connection pools to databases. When you replace this with direct SQLAlchemy engines, you own every connection pool.

A dashboard with 6 charts, 4 KPIs, and filter-option queries fires 12-15 concurrent requests on page load. If 10 users load dashboards simultaneously, that is 120-150 concurrent database connections. SQLAlchemy's default `pool_size=5` with `max_overflow=10` means a maximum of 15 connections per engine. With 4 database entries (TCOSPRD, TFINPRD, TWMPRD, reconmgmt), that is 60 max connections total -- but all hitting the same Oracle instance.

Oracle's default `PROCESSES` parameter is often 150-300. You will exhaust it. When you do, new connections hang for `pool_timeout` seconds (default 30), then raise `TimeoutError`. The user sees every chart stuck in loading state for 30 seconds, then a cascade of errors.

**Why it happens:**
Superset managed connection pooling internally and recycled connections across its own workers. The FastAPI app was a thin HTTP proxy that never held database connections. Now every concurrent request needs a real database connection, and the pool math changes dramatically.

**Consequences:**
- Dashboard pages hang for 30+ seconds under moderate load
- `QueuePool limit of size X overflow Y reached` errors
- Oracle `ORA-12519: TNS:no appropriate service handler found` errors
- Cascading timeouts that make the entire app appear down

**Prevention:**
1. **Size pools based on dashboard concurrency, not the number of databases.** Formula: `pool_size = max_concurrent_users * avg_queries_per_page_load / num_workers`. For 10 users, 15 queries each, 4 workers: `pool_size = ceil(10 * 15 / 4) = 38` per engine is too high. Instead, use `pool_size=10, max_overflow=20` and rely on query queuing.

2. **Use `pool_pre_ping=True`** to detect stale connections before checkout (Oracle connections go stale after network timeouts, firewall idle kills).

3. **Use `pool_recycle=1800`** (30 minutes) to prevent Oracle from killing idle connections.

4. **Set `pool_timeout=10`** (not the default 30) so users get a fast error instead of a 30-second hang.

5. **Monitor pool usage** by logging `engine.pool.status()` on a periodic task.

6. **Consider python-oracledb's native connection pool** (`oracledb.create_pool_async()`) instead of SQLAlchemy's pool for data-query engines. It supports Oracle Application Continuity, dead connection detection, and connection draining -- features SQLAlchemy's pool lacks.

**Detection:** Load test with 5+ concurrent users each loading a dashboard with 10+ data panels.

**Phase:** Phase 1 (engine setup). Pool configuration must be correct from the start; retrofitting under load is painful.

---

### Pitfall 4: Two Engines for One App -- Metadata vs Data Query Lifecycle Mismatch

**What goes wrong:**
The app needs two kinds of database access:
1. **Metadata engine** (fixed, known at startup): reads/writes `recviz_*` tables. Currently `db/engine.py` -- one engine, one session factory.
2. **Data-query engines** (dynamic, per-connection-config): executes user-provided SQL against various databases. Currently done via Superset; needs to become direct SQLAlchemy.

The metadata engine has a clean lifecycle (create at startup, dispose at shutdown). Data-query engines are more complex: they are created when a user adds a database connection, updated when connection params change, and should be disposed when a connection is deleted.

The pitfall: storing data-query engines in a global dictionary (`dict[str, AsyncEngine]`) and forgetting to dispose them on update/delete. Each undisposed engine leaks its entire connection pool. If a user updates a connection's password 5 times, you have 5 orphaned pools holding connections to Oracle.

**Why it happens:**
The current `DatabaseRegistrar` stores name-to-Superset-ID mappings and doesn't manage any connection objects. The new registrar must manage actual SQLAlchemy engines, which have lifecycles. It is natural to treat engine creation as cheap (it is not -- each engine creates a pool and background threads).

**Consequences:**
- Connection pool leaks (each leaked engine holds `pool_size` connections)
- Oracle connection limit slowly consumed until restart
- Memory leak from orphaned pool threads
- `dispose()` not awaited properly in async context causes warnings

**Prevention:**
1. Wrap data-query engines in a `ConnectionRegistry` class with explicit `add`, `update`, `remove` methods
2. `update` must `await old_engine.dispose()` before creating a new engine
3. `remove` must `await engine.dispose()`
4. Use `weakref.ref` or explicit reference counting if engines are shared across concurrent requests during disposal
5. On shutdown, iterate all engines and dispose them (add to lifespan handler)
6. Write a test that creates/updates/removes connections and asserts pool status returns to zero

**Detection:** Monitor Oracle's `V$SESSION` view for sessions from your app. If the count grows after connection updates, you have leaks.

**Phase:** Phase 1 (connection management). The `ConnectionRegistry` pattern must be designed before any data queries execute.

---

### Pitfall 5: The `superset_id` Column and Sync Machinery Breaks Feature Parity

**What goes wrong:**
The `RecvizDataset` model has a `superset_id` column (Integer, nullable) and a `sync_status` column. The entire `DatasetSyncService` exists to sync datasets bidirectionally with Superset. The frontend's dataset management UI shows sync status indicators.

When Superset is removed:
- `superset_id` becomes meaningless but still exists in the DB schema and ORM model
- `sync_status` (unsynced/synced/error) no longer makes sense
- `DatasetSyncService.reconcile()` runs on every startup and will crash without Superset
- The `database_id` field currently stores **Superset's** database ID (an integer assigned by Superset), not the logical database name. After removal, there is no Superset to assign IDs.

**Why it happens:**
The dataset model was designed around Superset as the query execution target. The `database_id` field is a Superset foreign key, not a RecViz concept. Removing Superset means this field has no referent.

**Consequences:**
- Startup crash from `DatasetSyncService.reconcile()` trying to call Superset
- Existing datasets in the database have `database_id` values that reference Superset IDs, not logical database names
- Frontend dataset forms select databases using Superset IDs; these must change to logical names
- Data migration needed: map old Superset IDs to new logical database names

**Prevention:**
1. Add a new `database_name` field (String) to `RecvizDataset` referencing the logical name from `databases.json`
2. Write a data migration that maps existing `database_id` (Superset integer) to the corresponding `database_name` (from the registrar cache)
3. Remove `superset_id` and `sync_status` columns in a migration
4. Remove `DatasetSyncService` entirely
5. Update frontend to use `database_name` (string) instead of `database_id` (integer)
6. Do NOT just skip this -- orphaned Superset-specific columns will confuse future developers

**Detection:** Try to create a new dataset after removing Superset. The database selection dropdown will either be empty or show meaningless integer IDs.

**Phase:** Phase 2 (schema migration after engine foundation is in place).

---

## Major Pitfalls

Mistakes that cause significant rework or subtle bugs.

---

### Pitfall 6: Oracle SQL Dialect Differences That Silently Return Wrong Data

**What goes wrong:**
The codebase already has dialect-aware SQL generation in `QueryEngine._build_date_range_clause()` with separate Oracle and PostgreSQL branches. But user-written dataset SQL (from the Dataset Builder) and data-source config SQL are written by the dev team and stored in the database. These queries likely use PostgreSQL syntax during development and Oracle syntax in production.

Key differences that **silently return wrong results** (no error, just wrong data):

| Pattern | PostgreSQL | Oracle | Silent Failure Mode |
|---------|-----------|--------|-------------------|
| NULL concatenation | `'a' \|\| NULL` = NULL | `'a' \|\| NULL` = `'a'` | Filters break: WHERE clause evaluates differently |
| Date arithmetic | `CURRENT_DATE - INTERVAL '7 days'` | `SYSDATE - 7` | PostgreSQL syntax errors on Oracle; Oracle syntax errors on PostgreSQL |
| TRUNC on dates | `date_trunc('month', col)` | `TRUNC(col, 'MM')` | Function not found error |
| Boolean values | `WHERE col = true` | `WHERE col = 1` | Oracle has no boolean literal `true`/`false` in SQL |
| LIMIT | `LIMIT 100` | `FETCH FIRST 100 ROWS ONLY` (12c+) or `WHERE ROWNUM <= 100` | Syntax error on Oracle |
| String quoting | Single or double quotes for identifiers (`"col"`) | Double quotes for identifiers, single for strings | Case sensitivity: `"Status"` vs `STATUS` |
| Empty string vs NULL | `''` is empty string | `''` is NULL | `WHERE col = ''` returns 0 rows on Oracle |
| NVL vs COALESCE | COALESCE only | NVL or COALESCE | NVL doesn't exist in PostgreSQL |
| DECODE | Not available | `DECODE(col, 'A', 1, 'B', 2, 0)` | Used in existing `_build_date_range_clause()` -- breaks on PostgreSQL |
| FROM DUAL | Not needed | Required for `SELECT SYSDATE FROM DUAL` | Syntax error or different behavior |

**Why it happens:**
Developers write and test SQL against PostgreSQL locally. Oracle-specific syntax is never tested until production. The current `_build_date_range_clause` method shows this awareness for date ranges but it is not applied systematically. User-defined dataset SQL has no dialect validation at all.

**Consequences:**
- Dashboards show correct data in dev, wrong data in prod
- Date-range filters silently exclude rows on one platform but not the other
- NULL handling differences cause aggregate mismatches (SUM, COUNT)
- Filter values that work in dev fail in prod

**Prevention:**
1. **Enforce a "portable SQL subset" for user-written dataset SQL.** Document which functions are safe: COALESCE (not NVL), CASE (not DECODE), ISO date literals, standard JOIN syntax.
2. **Add a dialect-aware SQL validator** that parses user SQL and flags Oracle-isms or PostgreSQL-isms.
3. **Move the date-range clause pattern to a general SQL dialect adapter** that handles all known dialect differences (not just date ranges).
4. **The `_build_date_range_clause` method already uses `DECODE` for Oracle** -- this must be preserved but should be part of a broader `DialectAdapter` class.
5. **Test every seed dataset SQL against both PostgreSQL and Oracle** (even if the Oracle test is via a CI container).

**Detection:** Compare query results row-by-row between PostgreSQL dev and Oracle prod for the same dataset with the same filters. Differences mean dialect bugs.

**Phase:** Phase 1 (build dialect awareness into the new query engine from day one). Phase 3 (add SQL validation to dataset management).

---

### Pitfall 7: python-oracledb Async Only Works in Thin Mode

**What goes wrong:**
python-oracledb has two modes:
- **Thin mode** (default): Pure Python, no Oracle Client libraries needed. Supports asyncio.
- **Thick mode**: Requires Oracle Client libraries (like `instantclient`). Does NOT support asyncio.

If someone calls `oracledb.init_oracle_client()` anywhere in the codebase (even in a utility script or test), the entire process switches to Thick mode permanently. After that, all async operations (`create_async_engine` with `oracle+oracledb://`) will fail with cryptic errors about coroutines.

The RHEL production servers may have Oracle Client libraries installed system-wide. If python-oracledb auto-detects them and switches to Thick mode, async breaks.

**Why it happens:**
python-oracledb's mode selection is process-global and happens once. There is no per-engine mode setting. Thick mode is required for certain features (Kerberos auth, Oracle wallet with auto-login, LDAP lookups, Advanced Queuing) but is incompatible with async.

**Consequences:**
- App works in dev (no Oracle Client installed, Thin mode auto-selected)
- App crashes in production if `init_oracle_client()` is called or if thick mode is triggered
- Error messages are confusing: `TypeError: An asyncio.Future, a coroutine or an awaitable is required` or similar

**Prevention:**
1. **Never call `oracledb.init_oracle_client()`** anywhere in the codebase
2. **Add a startup check:**
   ```python
   import oracledb
   if oracledb.is_thin_mode() is False:
       raise RuntimeError("python-oracledb is in Thick mode; async is not supported")
   ```
3. **Document this constraint** in deployment guides
4. **Use `service_name` (not SID)** in connection strings -- Thin mode requires Easy Connect syntax which only supports service names

**Detection:** Add the thin mode check to the FastAPI lifespan startup. Log the mode on startup.

**Phase:** Phase 1 (engine setup). This is a configuration/deployment concern, not a code complexity concern.

---

### Pitfall 8: Alembic Migrations Must Work on Both PostgreSQL and Oracle

**What goes wrong:**
Current Alembic migrations import PostgreSQL-specific types:
```python
from sqlalchemy.dialects.postgresql import JSONB
sa.Column("config", JSONB, nullable=False)
```

The Alembic env uses `recviz_db_url` which will be an Oracle URL in production. Running these migrations against Oracle will fail because JSONB doesn't exist in Oracle's dialect.

But you cannot simply delete the old migrations and write new ones. If any dev or staging environment has already run the existing migrations, Alembic's `recviz_alembic_version` table tracks which migration was last applied. Deleting or modifying existing migration files breaks that lineage.

**Why it happens:**
Alembic migrations are immutable history. You can write new migrations that alter column types, but you cannot retroactively change what migration 001 does without breaking environments that already ran it.

**Consequences:**
- Fresh Oracle deployments fail on migration 001 (JSONB)
- Existing PostgreSQL dev environments fail if old migrations are modified
- If migration history is reset, existing data is lost

**Prevention:**
1. **Write a new migration (005 or later) that alters column types** from PostgreSQL-specific to cross-dialect. For PostgreSQL environments, this is a no-op (JSON and JSONB are compatible). For Oracle environments, this migration does the initial type setup.
2. **Use `op.alter_column()` with dialect-conditional logic:**
   ```python
   from alembic import op
   import sqlalchemy as sa
   
   def upgrade():
       bind = op.get_bind()
       if bind.dialect.name == "oracle":
           # Oracle: alter to CLOB or JSON (21c+)
           ...
       # PostgreSQL: no change needed (JSONB stays)
   ```
3. **Or: create a separate migration path for Oracle** using Alembic's `branching` feature. This is more complex but cleaner for long-term maintenance.
4. **Best option for a clean break:** Since this is v2.0 and production has never run (metadata is new), consider resetting the migration lineage for Oracle with a single `001_v2_initial.py` that creates tables with cross-dialect types. Keep old migrations for PostgreSQL dev continuity.

**Detection:** Run `alembic upgrade head` against an Oracle test database. It will fail on the first migration.

**Phase:** Phase 1 (must be resolved before any production deployment).

---

### Pitfall 9: The `database_id` Semantic Shift Breaks Data Query Routing

**What goes wrong:**
Throughout the codebase, `database_id` means "the integer ID that Superset assigned to this database connection." This appears in:
- `RecvizDataset.database_id` (ORM model)
- `DatabaseRegistrar.resolve()` returns a Superset integer ID
- `QueryEngine.execute()` passes `db_id` (Superset integer) to `superset.execute_sql(database_id=db_id, ...)`
- Frontend SQL Explorer sends `database_id: int` in `SqlRequest`
- Frontend dataset forms store `database_id` as an integer

After removing Superset, databases are identified by logical name (string like "superset_db_TCOSPRD") or by a RecViz-assigned ID. The integer IDs from Superset are meaningless.

**Why it happens:**
Superset's API uses integer IDs for everything. The entire data flow was built around "get integer ID from Superset, pass it to Superset." Now the ID space changes.

**Consequences:**
- SQL Explorer sends `database_id: 1` but the new engine has no concept of integer database IDs
- Datasets reference `database_id: 3` but the new registrar uses string names
- API contracts between frontend and backend break
- Existing dataset records in the database have orphaned integer references

**Prevention:**
1. **Define a new identifier scheme early.** Use the logical database `name` from `databases.json` as the canonical identifier. It is already unique and human-readable.
2. **Update all API contracts** to accept `database_name: str` (or `database: str`) instead of `database_id: int`
3. **Write a data migration** for existing `RecvizDataset` records: map Superset integer IDs to logical names using the `DatabaseRegistrar._cache` (which holds both)
4. **Update the frontend forms** to show a dropdown of database names instead of passing integer IDs
5. **The SQL Explorer's `SqlRequest` model** must change from `database_id: int = 1` to `database: str`
6. **Deprecation path:** Accept both `database_id` (int) and `database` (str) in API endpoints during migration, prefer string

**Detection:** After switching to the new engine, try the SQL Explorer. If `database_id` is still an integer, the query will route to the wrong database or fail.

**Phase:** Phase 2 (API contract changes). Coordinate with frontend changes.

---

### Pitfall 10: Losing Superset's Built-In Query Security (SQL Injection Surface)

**What goes wrong:**
Superset validates and sandboxes SQL queries before execution. It strips dangerous statements (DROP, ALTER, DELETE, INSERT, UPDATE), enforces row limits, and restricts access to specific schemas. The current RecViz code passes raw SQL directly to Superset and relies on Superset's safeguards.

When you execute SQL directly via SQLAlchemy, there is no sandboxing layer. The `QueryEngine._build_sql()` method uses string interpolation to inject filter values:
```python
quoted = f"'{str(fval).replace(chr(39), chr(39)*2)}'"
expr = expr.replace("{{value}}", str(val).replace("'", "''"))
```

This escaping is manual and fragile. If a filter value contains `' OR 1=1 --`, the current escaping handles it (single-quote doubling), but the defense is one missed edge case from a SQL injection.

Additionally, the SQL Explorer allows dev-team users to execute arbitrary SQL. Without Superset's guardrails, a typo like `DROP TABLE` actually executes.

**Why it happens:**
Superset was acting as a security boundary that nobody explicitly designed for. Removing it removes that boundary without replacing it.

**Consequences:**
- SQL injection via maliciously crafted filter values
- Accidental destructive SQL from the SQL Explorer
- No row limit enforcement (a `SELECT *` from a 10M row table returns all rows)

**Prevention:**
1. **Use SQLAlchemy's `text()` with bound parameters** instead of string interpolation for filter values:
   ```python
   from sqlalchemy import text
   stmt = text("SELECT ... WHERE col = :value")
   result = await conn.execute(stmt, {"value": filter_value})
   ```
2. **Enforce read-only mode** on data-query connections. Use SQLAlchemy's `execution_options(postgresql_readonly=True)` for PostgreSQL, or `SET TRANSACTION READ ONLY` for Oracle.
3. **Enforce row limits** in the query engine: wrap user SQL in a limiting outer query or use `FETCH FIRST N ROWS ONLY`.
4. **Add a SQL statement classifier** that rejects DDL and DML (only allow SELECT and WITH statements). A simple regex check: if the statement does not start with `SELECT` or `WITH`, reject it.
5. **The filter interpolation in `_build_sql`** must be migrated to parameterized queries. The `{{value}}` template pattern must use bind parameters, not string replacement.

**Detection:** Code review the query engine for any string concatenation or `.replace()` calls that build SQL. Every one is a potential injection point.

**Phase:** Phase 1 (build parameterized query support into the new engine from day one). This is not something to retrofit later.

---

## Moderate Pitfalls

Mistakes that cause significant debugging time or poor UX.

---

### Pitfall 11: Oracle Identifier Case Sensitivity Surprise

**What goes wrong:**
Oracle stores all unquoted identifiers in UPPERCASE. SQLAlchemy returns column names from `cursor.description` in the case the database stores them. If your table was created with `CREATE TABLE recon_data (status VARCHAR2(50))`, Oracle stores the column as `STATUS`.

When the query engine returns results, column names will be `STATUS`, `RECON_ID`, `MATCH_RATE` etc. But the frontend's chart configs, KPI configs, and dashboard data-source configs all reference columns in lowercase: `status`, `recon_id`, `match_rate`.

This means every chart will have zero data because the column mapping fails silently.

**Why it happens:**
Superset normalized column names to lowercase. The SQLAlchemy raw SQL result does not perform this normalization by default.

**Consequences:**
- All charts show empty (column names don't match config)
- AG Grid shows columns but no data in cells
- KPI calculations return 0/NaN
- Debugging is frustrating because the data is there -- it is just keyed by `STATUS` instead of `status`

**Prevention:**
1. **Lowercase all column names in the query engine's result adapter:**
   ```python
   columns = [col.lower() for col in result.keys()]
   rows = [dict(zip(columns, row)) for row in result.fetchall()]
   ```
2. **Add this normalization once in the query engine**, not in every consumer
3. **Test with Oracle tables that have UPPERCASE column names** (which is all Oracle tables by default)

**Detection:** Run a dashboard against Oracle data. If everything shows empty but the raw SQL returns data, it is a case mismatch.

**Phase:** Phase 1 (result normalization in the query engine).

---

### Pitfall 12: Async Session Leaks from Exception Paths

**What goes wrong:**
The current `get_db_session()` dependency properly handles commit/rollback:
```python
async with async_session_factory() as session:
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
```

But when you add data-query engines (separate from the metadata engine), the pattern is different. Data queries use raw connections, not ORM sessions. A common mistake:
```python
async with engine.connect() as conn:
    result = await conn.execute(text(sql))
    # If an exception occurs here, the connection context manager handles it
    # But if you return a streaming result...
    return result  # Connection closed, result cursor invalidated!
```

The danger is fetching results lazily. If you return a result proxy from an `async with` block, the connection closes and the result becomes unusable.

**Why it happens:**
ORM sessions and raw connections have different lifecycles. The ORM session dependency pattern (yield in a generator) works because FastAPI manages the generator lifecycle. Raw connections don't have this automatic management.

**Consequences:**
- Intermittent `InterfaceError: connection already closed` errors
- Results that sometimes work and sometimes don't (race condition)
- Connection pool gradually fills with connections in unknown states
- Hard to reproduce: depends on timing and garbage collection

**Prevention:**
1. **Always fetch all results within the connection context:**
   ```python
   async with engine.connect() as conn:
       result = await conn.execute(text(sql))
       rows = result.fetchall()
       columns = list(result.keys())
   # Return the fully-materialized data, not the result proxy
   return {"columns": columns, "rows": rows}
   ```
2. **Never yield a connection or result proxy** from a FastAPI dependency
3. **Use `result.mappings().all()`** to get dict-like rows instead of tuples
4. **Set `pool_pre_ping=True`** to catch stale connections from interrupted requests

**Detection:** Run load tests and watch for `connection already closed` or `cursor already closed` errors in logs.

**Phase:** Phase 1 (query execution patterns).

---

### Pitfall 13: Removing Superset But Keeping Its Ghost in Config and Startup

**What goes wrong:**
The removal is not just deleting `superset_client.py`. Superset is woven throughout:

1. **`config.py`**: `superset_url`, `superset_username`, `superset_password` settings
2. **`main.py`**: Entire lifespan imports and initializes SupersetClient, authenticates, creates DatabaseRegistrar with Superset, creates DatasetSyncService with Superset
3. **`dependencies.py`**: `SupersetDep` dependency, `get_superset_client()`
4. **`requirements.txt`**: `httpx` (still needed for other things?), `redis`, `psycopg2-binary` (still needed?)
5. **`databases.json`**: Database names prefixed `superset_db_*`
6. **Docker Compose**: Superset container, Redis container
7. **`.env` files**: Superset credentials
8. **Health check**: `/health` endpoint reports `"superset": True`
9. **Test superset endpoint**: `/api/test-superset`
10. **Alembic config**: `alembic.ini` hardcodes `postgresql+asyncpg://` URL
11. **29 files reference Superset** (from grep results)

If even one import path is missed, the app crashes on startup with `ModuleNotFoundError` or `AttributeError`.

**Why it happens:**
Superset integration was built incrementally over 11 phases. It is not isolated behind a single interface -- it leaked into config, startup, dependencies, error handling, tests, and even database naming conventions.

**Consequences:**
- ImportError crashes from stale imports
- Startup hangs trying to connect to non-existent Superset
- Dead config values confuse new developers
- Tests fail because they mock `SupersetClient` which no longer exists

**Prevention:**
1. **Use `grep -r superset` systematically** to find every reference (already done: 29 files)
2. **Remove in dependency order:** config -> client -> services -> dependencies -> routes -> tests -> docker
3. **Do NOT leave any Superset code "commented out for later."** Delete it.
4. **Rename `superset_db_*` database names** to just the logical names (`TCOSPRD`, `TFINPRD`, etc.)
5. **Update the health endpoint** to report database connectivity instead of Superset status
6. **Remove `redis` from requirements.txt** (no longer needed)
7. **Keep `httpx`** only if needed for other external API calls; otherwise remove it
8. **Update `databases_config_path` default** and the JSON file content

**Detection:** After removal, run `grep -ri superset` across the entire codebase. Any remaining references (outside comments explaining the migration) are incomplete removal.

**Phase:** Phase 3 (cleanup phase after the new engine is working). Do not remove Superset code in the same phase you build the replacement -- build the replacement first, verify it works, then remove the old code.

---

### Pitfall 14: Oracle Connection String Differences Between Dev and Prod

**What goes wrong:**
The current `uri_builder.py` builds Oracle URIs as:
```python
f"oracle://{user_part}{host}:{port}/?service_name={db_part}"
```

For the new async engine, the URI must be:
```python
f"oracle+oracledb://{user_part}{host}:{port}/?service_name={db_part}"
```

Note the `+oracledb` driver specifier. Without it, SQLAlchemy tries to use `cx_Oracle` (the old, deprecated driver). With `create_async_engine`, it must be `oracle+oracledb://` (which auto-selects async) or explicitly `oracle+oracledb_async://`.

Additionally, Oracle Easy Connect strings have different formats depending on Oracle version:
- Oracle 12c+: `host:port/service_name`
- Oracle 19c+: `host:port/service_name?connect_timeout=5&transport_connect_timeout=3`
- TNS alias: requires `tnsnames.ora` configuration

The RHEL production servers may use TNS aliases, not host:port connection strings. python-oracledb Thin mode supports TNS aliases only if `tnsnames.ora` is in a known location or `TNS_ADMIN` env var is set.

**Why it happens:**
The URI builder was written for Superset's consumption (which uses cx_Oracle under the hood). The driver prefix, async suffix, and connection parameter format are all different for direct SQLAlchemy + python-oracledb.

**Consequences:**
- `ModuleNotFoundError: No module named 'cx_Oracle'` if driver prefix is wrong
- Silent fallback to sync mode if `_async` suffix is missing with `create_async_engine`
- Connection failures in production if TNS configuration is not set up
- Timeout differences between dev (localhost PostgreSQL) and prod (network Oracle)

**Prevention:**
1. **Update `uri_builder.py`** to generate `oracle+oracledb://` format
2. **Add a `for_async` parameter** that appends `_async` suffix when needed
3. **Support TNS alias connections** via `connect_args`:
   ```python
   create_async_engine(
       "oracle+oracledb://@",
       connect_args={"user": "...", "password": "...", "dsn": "tns_alias"}
   )
   ```
4. **Add connection timeout parameters** for production (network latency):
   ```python
   connect_args={"tcp_connect_timeout": 5}
   ```
5. **Test the URI builder** with both PostgreSQL and Oracle URLs, both sync and async

**Detection:** Try to create an async engine with the current URI builder output. It will either use the wrong driver or fail to connect.

**Phase:** Phase 1 (engine setup).

---

### Pitfall 15: No Query Timeout Without Superset

**What goes wrong:**
Superset enforces query timeouts. The current httpx client has a 120-second timeout (`httpx.AsyncClient(timeout=120.0)`). When you remove Superset, there is no timeout on direct database queries.

A user writes `SELECT * FROM large_table` (10M rows). Without a timeout, the query runs until it exhausts memory, crashes the connection, or the user gives up and refreshes (which starts a new query while the old one still runs, consuming the connection).

Oracle queries can also encounter lock waits. A query blocked by a row lock will wait indefinitely by default.

**Why it happens:**
Superset's SQL Lab has built-in query timeout enforcement. The httpx client had a timeout. Direct SQLAlchemy connections have no timeout by default.

**Consequences:**
- Runaway queries consume connections from the pool indefinitely
- Memory exhaustion from unbounded result sets
- Users trigger multiple retries, each consuming a connection
- Oracle lock contention causes indefinite hangs

**Prevention:**
1. **Set `statement_timeout` on the connection level:**
   - PostgreSQL: `SET statement_timeout = '60s'` (via `connect_args` or execution options)
   - Oracle: `ALTER SESSION SET SQL_TRACE = FALSE; -- No direct equivalent; use python-oracledb's cancel()`
2. **Use python-oracledb's `call_timeout`** parameter:
   ```python
   connect_args={"call_timeout": 60000}  # milliseconds
   ```
3. **Wrap query execution in `asyncio.wait_for()`:**
   ```python
   try:
       result = await asyncio.wait_for(conn.execute(stmt), timeout=60.0)
   except asyncio.TimeoutError:
       # Connection may be in unknown state; dispose it
   ```
4. **Enforce row limits** at the SQL level: wrap user queries in `SELECT * FROM (user_query) WHERE ROWNUM <= 10001` (Oracle) or `LIMIT 10001` (PostgreSQL). The +1 detects truncation.
5. **The SQL Explorer should have its own timeout** separate from dashboard queries (higher limit for ad-hoc exploration).

**Detection:** Execute a `SELECT * FROM` on a large table. Without timeouts, it will hang.

**Phase:** Phase 1 (query engine). Timeouts must be present from the first query execution.

---

## Minor Pitfalls

Mistakes that cause confusion or require small fixes.

---

### Pitfall 16: Oracle's Empty String = NULL Surprises

**What goes wrong:**
In Oracle, an empty string `''` is treated as `NULL`. In PostgreSQL, `''` and `NULL` are distinct values. This affects:
- `WHERE status = ''` returns zero rows on Oracle (should use `WHERE status IS NULL`)
- `INSERT INTO t(col) VALUES ('')` stores NULL in Oracle
- `COALESCE(col, '')` behaves differently: on PostgreSQL it returns `''` for NULL values; on Oracle it still returns NULL if the column is empty-string-as-NULL

**Prevention:**
1. Never store empty strings in columns that should be nullable; use NULL consistently
2. In filter generation, map empty string filter values to `IS NULL` checks
3. Document this for the dev team writing dataset SQL

**Phase:** Phase 1 (dialect adapter).

---

### Pitfall 17: Forgetting to Remove Redis Dependencies

**What goes wrong:**
`requirements.txt` includes `redis==4.6.0`. The config has `redis_url` setting. Even though Redis is not imported directly in current app code (Superset used it internally), leaving the dependency:
- Confuses developers about what the app needs
- May cause import errors if redis package is not installed in the production venv
- Docker Compose still starts a Redis container, wasting resources

**Prevention:**
1. Remove `redis` from `requirements.txt`
2. Remove `redis_url` from `Settings` class
3. Remove Redis from Docker Compose
4. Verify no imports of redis exist

**Phase:** Phase 3 (cleanup).

---

### Pitfall 18: The `psycopg2-binary` vs `asyncpg` Confusion

**What goes wrong:**
`requirements.txt` has both `psycopg2-binary` (sync PostgreSQL driver) and `asyncpg` (async PostgreSQL driver). The metadata engine uses `asyncpg` (via `postgresql+asyncpg://`). The `psycopg2-binary` is there because Superset needed it (or old sync code). After removal, having both causes confusion about which driver is canonical.

In production (Oracle), neither is needed for data queries -- only `python-oracledb` is needed. But metadata might still be in PostgreSQL (dev) or Oracle (prod).

**Prevention:**
1. For dev: keep `asyncpg` for metadata PostgreSQL
2. For prod: add `python-oracledb` for both metadata and data queries
3. Remove `psycopg2-binary` unless explicitly needed (check if Alembic offline mode uses it)
4. Document which driver is used for which purpose

**Phase:** Phase 1 (requirements cleanup).

---

### Pitfall 19: Testing Against PostgreSQL Gives False Confidence for Oracle

**What goes wrong:**
All development and testing happens against PostgreSQL. The test suite (`test_query_engine.py`, `test_database_registrar.py`, etc.) only covers PostgreSQL behavior. Tests pass. Production runs Oracle and behaves differently.

Specific test blind spots:
- JSONB operations work in tests, fail on Oracle
- Column names are lowercase in test results, uppercase in Oracle
- Date arithmetic uses PostgreSQL syntax in test data
- Empty string handling is PostgreSQL-semantic in tests

**Prevention:**
1. **Add an Oracle test profile** that runs key integration tests against an Oracle container (Oracle XE 21c is available as a Docker image for CI)
2. **If Oracle containers are not available** (corporate policy), at minimum:
   - Write unit tests that mock Oracle-style column names (UPPERCASE)
   - Write unit tests for the dialect adapter's Oracle branches
   - Write tests for the JSONB->CLOB type decorator
3. **Document known differences** in a developer-facing reference table

**Phase:** Throughout all phases. Each phase should include dialect-aware test coverage.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Engine Foundation (Phase 1) | JSONB columns crash on Oracle | Use `with_variant()` or TypeDecorator from day one |
| Engine Foundation (Phase 1) | Connection pool exhaustion | Size pools for dashboard concurrency, not demo data |
| Engine Foundation (Phase 1) | No query timeout | Add `call_timeout` + `asyncio.wait_for()` from first query |
| Engine Foundation (Phase 1) | Oracle case sensitivity | Lowercase all column names in result adapter |
| Engine Foundation (Phase 1) | python-oracledb Thick mode | Add thin mode startup check |
| Engine Foundation (Phase 1) | URI format wrong for async | Update `uri_builder.py` for `oracle+oracledb://` |
| Schema Migration (Phase 2) | `database_id` references Superset IDs | Migrate to `database_name` (string) |
| Schema Migration (Phase 2) | `superset_id` column orphaned | Remove via Alembic migration |
| Schema Migration (Phase 2) | Alembic migrations use JSONB | Write cross-dialect migration |
| API Parity (Phase 2) | Response shape mismatch | Build adapter matching Superset's exact response format |
| API Parity (Phase 2) | Frontend sends integer `database_id` | Accept both int and string during transition |
| SQL Security (Phase 1-2) | No query sandboxing | Parameterized queries + read-only mode + row limits |
| Superset Removal (Phase 3) | Incomplete removal (29 files) | Systematic grep + ordered removal |
| Superset Removal (Phase 3) | Redis dependency left behind | Remove from requirements, config, Docker |
| Dialect Compatibility (All) | PostgreSQL SQL works in dev, fails in prod | Portable SQL subset + dialect adapter + Oracle test profile |
| Dataset SQL (Phase 2-3) | User SQL uses PostgreSQL-isms | SQL validator + developer documentation |

---

## Sources

- [SQLAlchemy 2.1 Oracle Dialect Documentation](https://docs.sqlalchemy.org/en/21/dialects/oracle.html)
- [SQLAlchemy 2.0 Connection Pooling](https://docs.sqlalchemy.org/en/20/core/pooling.html)
- [python-oracledb Async Programming](https://python-oracledb.readthedocs.io/en/latest/user_guide/asyncio.html)
- [python-oracledb Thin vs Thick Mode](https://python-oracledb.readthedocs.io/en/latest/user_guide/appendix_b.html)
- [python-oracledb Connection Handling](https://python-oracledb.readthedocs.io/en/latest/user_guide/connection_handling.html)
- [Oracle to PostgreSQL Conversion Guide (PostgreSQL Wiki)](https://wiki.postgresql.org/wiki/Oracle_to_Postgres_Conversion)
- [FastAPI SQLAlchemy QueuePool Exhaustion Discussion](https://github.com/fastapi/fastapi/discussions/10450)
- [FastAPI Async Session Lifecycle Discussion](https://github.com/fastapi/fastapi/discussions/11321)
- [SQLAlchemy JSON Column Support for Oracle Discussion](https://github.com/sqlalchemy/sqlalchemy/discussions/10374)
- [python-oracledb JSON Data Type Support](https://python-oracledb.readthedocs.io/en/latest/user_guide/json_data_type.html)
- [EDB: Porting Between Oracle and PostgreSQL](https://www.enterprisedb.com/postgres-tutorials/porting-between-oracle-and-postgresql)
- [Oracle to PostgreSQL ROWNUM Migration](https://www.enterprisedb.com/blog/oracle-postgresql-rownum-and-rowid)
