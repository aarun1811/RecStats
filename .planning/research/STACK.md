# Technology Stack: v2.0 Remove Superset -- Direct Database Engine

**Project:** RecViz v2.0
**Domain:** Internal BI/Dashboard Builder -- Superset removal, direct SQLAlchemy query engine
**Researched:** 2026-04-09
**Overall Confidence:** HIGH

---

## Context: What This Milestone Changes

v1.0 uses Apache Superset as a headless query engine. All data queries flow through `httpx -> Superset REST API -> database`. v2.0 replaces this with direct SQLAlchemy connections from FastAPI to the target databases. This eliminates Superset, Redis, and the httpx proxy layer entirely.

**What stays the same:** The entire frontend stack, FastAPI framework, Pydantic models, Alembic migrations, async SQLAlchemy for metadata. The CLAUDE.md frontend stack section and the v1.0 STACK.md builder additions (react-grid-layout, react-hook-form, zod, etc.) remain unchanged.

**What changes:** The query execution path, connection management, result serialization, and the Superset/Redis infrastructure dependencies.

---

## Recommended Stack Changes

### 1. Core Query Engine Libraries

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| SQLAlchemy | 2.0.49 (already installed) | Async ORM + raw SQL execution engine | Already in the codebase for metadata. The `create_async_engine` API handles both PostgreSQL (asyncpg) and Oracle (oracledb) via dialect swapping. `text()` for raw SQL execution replaces Superset's SQL Lab API. | HIGH |
| asyncpg | 0.31.0 (already installed) | PostgreSQL async driver for dev | Already installed. The fastest Python PostgreSQL driver. Powers `postgresql+asyncpg://` URIs in `create_async_engine`. No changes needed. | HIGH |
| python-oracledb | 3.4.2 | Oracle async driver for production | Replaces the v1.0 pin of 2.5.1 (used only for Superset's cx_Oracle shim). v3.4.2 is the latest stable (Jan 2026). Async support is production-ready since 2.0. Thin mode (no Oracle Client libraries) works for asyncio. SQLAlchemy auto-selects async dialect with `oracle+oracledb://` in `create_async_engine`. | HIGH |
| Alembic | 1.18.4 (already installed) | Database migrations | Already in the codebase. No version change needed. Cross-database migration strategy documented below. | HIGH |

**Key version decisions:**
- **python-oracledb 3.4.2 over 2.5.1**: The 3.x series adds centralized configuration providers, connection pool improvements, and pipeline support. No breaking changes from the async API used in RecViz. The version jump is safe because RecViz only uses thin-mode async connections and `create_async_engine` -- the SQLAlchemy dialect interface is stable.
- **SQLAlchemy 2.0.49 stays**: Already installed and confirmed working with async Oracle. SQLAlchemy 2.1.0 is in beta (Jan 2026) -- do NOT upgrade to 2.1.x during this milestone. The 2.0.x series is the stable production line.

### 2. Connection Pool Management

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| SQLAlchemy AsyncAdaptedQueuePool | built-in | Connection pooling for data source engines | When `create_async_engine()` is called, SQLAlchemy automatically uses `AsyncAdaptedQueuePool` -- an asyncio-compatible queue pool. No additional library needed. Configure `pool_size`, `max_overflow`, `pool_timeout`, `pool_recycle` per engine. | HIGH |

**Do NOT use python-oracledb's native connection pool** for this project. While Oracle's driver pool offers high-availability features (dead connection detection, DRCP, Application Continuity), it requires `pool_class=NullPool` in SQLAlchemy and custom `creator` functions, adding complexity. Since RecViz runs against a single Oracle instance (not RAC/Data Guard), SQLAlchemy's built-in pool is sufficient and keeps the code database-agnostic.

**Confidence:** HIGH -- SQLAlchemy's pool has been the standard for 15+ years. The async variant (`AsyncAdaptedQueuePool`) is mature since SQLAlchemy 2.0.

### 3. Result Serialization

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| SQLAlchemy `Row._mapping` | built-in | Convert query results to dicts | `result.mappings().all()` returns `RowMapping` objects that behave like dicts. Direct replacement for Superset's `{"columns": [...], "data": [...]}` response format. Zero additional libraries needed. | HIGH |
| `json` (stdlib) | built-in | Serialize Decimal, datetime, date in results | Oracle returns `Decimal` for NUMBER columns. Need a custom JSON encoder that handles `Decimal -> float`, `datetime -> ISO string`, `date -> ISO string`. Stdlib `json.JSONEncoder` subclass is sufficient. | HIGH |

**Do NOT add** `orjson` or `ujson` for this milestone. The query result sets are already capped at 10,000 rows (`DEFAULT_MAX_ROWS`). Python's stdlib `json` handles this volume in <10ms. Optimization is premature.

**Confidence:** HIGH -- SQLAlchemy's Row/RowMapping API is well-documented and stable.

---

## What Gets Removed

| Technology | Why Removed | Impact |
|------------|-------------|--------|
| Apache Superset | Entire query engine replaced by direct SQLAlchemy | Remove `superset/` directory, `superset_config.py`, Docker container, all Superset API calls |
| Redis | Was only used for Superset query cache + Celery broker. No Celery in v2.0, client-side caching via TanStack Query replaces server cache | Remove from Docker Compose, remove `redis` pip package, remove Redis URL from config |
| httpx | Was only used for Superset HTTP proxy calls | Remove from requirements.txt. FastAPI's TestClient uses httpx internally for testing, but that's a dev dependency. |
| psycopg2-binary | Sync PostgreSQL driver. Was used by Superset. RecViz uses asyncpg for async access | Remove from requirements.txt |
| requests | Was a transitive dependency for Superset communication | Remove from requirements.txt |

---

## Detailed Integration Design

### 3.1 Async Engine URL Strategy

The existing pattern in `engine.py` already works:

```python
# Dev (PostgreSQL):
RECVIZ_DB_URL=postgresql+asyncpg://recviz:recviz_dev@localhost:5432/superset_meta

# Prod (Oracle 19c):
RECVIZ_DB_URL=oracle+oracledb://RECTRACE:<password>@<host>:8889/?service_name=<service>
```

SQLAlchemy auto-detects the async dialect:
- `postgresql+asyncpg://` -> uses asyncpg driver (already works)
- `oracle+oracledb://` -> auto-selects `oracledb_async` dialect (confirmed in SQLAlchemy 2.0.25+, verified present in 2.0.49)

**No code changes to `engine.py` for the metadata engine.** The URL swap is purely a `.env` configuration change.

### 3.2 Data Source Engine Pool (NEW)

The current architecture routes data queries through Superset using `superset_client.execute_sql()`. The replacement needs a **pool of async engines** -- one per configured data source connection.

**New component: `DataSourceEnginePool`**

```python
# Conceptual design -- not final implementation
class DataSourceEnginePool:
    """Manages async SQLAlchemy engines for data source connections."""
    
    _engines: dict[str, AsyncEngine]  # keyed by connection name
    
    def get_engine(self, connection_name: str) -> AsyncEngine
    def create_engine(self, connection_name: str, uri: str, **pool_kwargs) -> AsyncEngine
    async def dispose_engine(self, connection_name: str) -> None
    async def dispose_all(self) -> None
    async def test_connection(self, uri: str) -> bool
```

**Pool sizing per engine:**
- `pool_size=5` -- 5 persistent connections per data source (sufficient for internal tool with ~50 concurrent users max)
- `max_overflow=10` -- burst to 15 total connections during peak
- `pool_timeout=30` -- wait 30s for connection before error
- `pool_recycle=3600` -- recycle connections every hour (Oracle TNS timeout protection)
- `pool_pre_ping=True` -- verify connection liveness before checkout (critical for Oracle, which drops idle connections)

**Confidence:** HIGH -- this pattern is standard for multi-database FastAPI applications.

### 3.3 Query Execution (Replacing Superset SQL Lab)

The current `QueryEngine.execute()` calls `superset_client.execute_sql()`. The replacement uses SQLAlchemy's `text()` + `AsyncConnection.execute()`:

```python
from sqlalchemy import text

async with engine.connect() as conn:
    result = await conn.execute(text(sql))
    columns = [{"name": col, "type": str(result.cursor.description[i][1].__name__)} 
               for i, col in enumerate(result.keys())]
    rows = [dict(row._mapping) for row in result.fetchmany(max_rows)]
    return {"columns": columns, "rows": rows, "row_count": len(rows)}
```

**Key differences from Superset's execute_sql:**
1. No authentication dance (Superset required JWT + CSRF tokens)
2. No HTTP overhead (direct database wire protocol)
3. Column type information comes from cursor description, not Superset's type guessing
4. Connection errors are SQLAlchemy exceptions, not httpx exceptions

**The `_build_sql()` method stays almost unchanged** -- it constructs SQL strings with filter placeholders. The only change: the `dialect` parameter is read from the engine's dialect instead of the `DatabaseRegistrar` cache.

**Confidence:** HIGH -- `text()` execution is SQLAlchemy's most basic operation.

### 3.4 JSONB to JSON Column Migration (Cross-Database)

All 6 RecViz tables use `JSONB` from `sqlalchemy.dialects.postgresql`:

| Table | JSONB Columns |
|-------|---------------|
| `recviz_dashboards` | `config` |
| `recviz_data_sources` | `config` |
| `recviz_datasets` | `columns` |
| `recviz_charts` | `config` |
| `recviz_kpis` | `config` |

**Required change:** Replace `JSONB` with `sa.JSON()` in both ORM models and Alembic migrations.

**Behavior per database:**
- **PostgreSQL:** `sa.JSON()` renders as `JSON` (not `JSONB`). Loses JSONB-specific GIN indexing. RecViz does NOT use JSON path queries or GIN indexes on these columns -- they store/retrieve whole documents only. No functional impact.
- **Oracle 19c:** `sa.JSON()` renders as `CLOB` with an implicit `IS JSON` check constraint. JSON path queries work via `JSON_VALUE()`, `JSON_QUERY()`. The ORM transparently serializes/deserializes Python dicts.

**Why NOT use `with_variant(JSONB, "postgresql")`:** Adds complexity for zero benefit. RecViz never queries inside JSON columns at the SQL level -- it loads the whole document and works with it in Python. The generic `sa.JSON()` type is sufficient for both databases.

**Confidence:** HIGH -- verified in the existing deployment design doc (`docs/superpowers/specs/2026-04-09-rhel-oracle-no-sudo-deployment-design.md` section 5.1). Confirmed working on Oracle 19c.

### 3.5 Alembic Cross-Database Migrations

**Current state:** Migrations import `from sqlalchemy.dialects.postgresql import JSONB` -- this crashes on Oracle.

**Strategy:** Write a single new migration that replaces JSONB references with `sa.JSON()` and is idempotent on both databases. Do NOT rewrite the 4 existing migrations -- write a v2 migration (`005_cross_database_compat.py`) that:

1. For tables with existing JSONB columns: `op.alter_column()` to change type to `sa.JSON()` (on PostgreSQL this is a no-op cast; on Oracle this runs only if the table was just created with the corrected model)
2. Adjusts any `server_default=func.now()` to database-compatible defaults (PostgreSQL `now()` vs Oracle `SYSDATE`)

**Alembic `env.py` changes:**
- The `version_table="recviz_alembic_version"` is already set (avoids Superset migration conflicts)
- No changes needed to the async migration runner
- The engine URL automatically determines the dialect

**The `func.now()` situation:**
- PostgreSQL: `func.now()` -> `now()` (works)
- Oracle: `func.now()` -> `CURRENT_TIMESTAMP` (works, SQLAlchemy handles this)

Both work without changes. SQLAlchemy's `func.now()` is dialect-aware.

**Confidence:** HIGH -- `func.now()` cross-database behavior is well-documented. The JSONB->JSON migration is straightforward.

### 3.6 FastAPI Dependency Injection Changes

**Current DI structure:**
```
get_superset_client() -> SupersetClient (from app.state)
get_query_engine() -> QueryEngine (from app.state, depends on SupersetClient)
get_db_session() -> AsyncSession (metadata DB)
```

**New DI structure:**
```
get_db_session() -> AsyncSession (metadata DB, UNCHANGED)
get_engine_pool() -> DataSourceEnginePool (from app.state, NEW)
get_query_engine() -> QueryEngine (from app.state, REWRITTEN to use engine pool)
```

**Remove:** `get_superset_client()`, `SupersetDep`, `DatasetSyncDep` (Superset dataset sync no longer needed)

**Add:** `get_engine_pool()` -> `EnginePoolDep`

**The `QueryEngine` class gets rewritten** but keeps the same public interface:
- `execute(ds, filters, max_rows)` -> same return shape `{"columns": [...], "rows": [...], "row_count": N, "truncated": bool}`
- `execute_distinct(ds, column, filters)` -> same return shape `{"values": [...]}`

Frontend code does NOT change because the API response shape stays identical.

**Confidence:** HIGH -- the DI pattern is straightforward FastAPI.

### 3.7 Configuration Changes

**Current `Settings`:**
```python
superset_url: str          # REMOVE
superset_username: str     # REMOVE
superset_password: str     # REMOVE
redis_url: str             # REMOVE
recon_db_url: str          # KEEP (sync URL for scripts)
recviz_db_url: str         # KEEP (async URL for metadata)
databases_config_path: str # EVOLVE (move to DB table)
```

**New `Settings`:**
```python
recviz_db_url: str                     # KEEP -- metadata engine
databases_config_path: str | None      # KEEP for bootstrapping, but connections should migrate to DB table
default_pool_size: int = 5             # NEW
default_max_overflow: int = 10         # NEW  
default_pool_recycle: int = 3600       # NEW
query_timeout: int = 120               # NEW -- per-query timeout in seconds
max_query_rows: int = 10000            # NEW -- moved from QueryEngine constant
```

**Confidence:** HIGH.

---

## Database Connection Registry: File vs Database

**Current:** Connections are defined in `databases.json` and synced to Superset at startup via `DatabaseRegistrar`.

**v2.0 Target:** Connections should be stored in a `recviz_connections` database table, managed through the existing Connection Management UI (built in v1.0 Phase 4). The `databases.json` file becomes a bootstrap/seed mechanism.

**New table:**
```sql
CREATE TABLE recviz_connections (
    id VARCHAR(128) PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    display_name VARCHAR(256) NOT NULL,
    backend VARCHAR(32) NOT NULL,        -- 'oracle' or 'postgresql'
    sqlalchemy_uri TEXT NOT NULL,         -- encrypted in prod
    dialect VARCHAR(32) NOT NULL,
    schema_name VARCHAR(128) DEFAULT '',
    pool_size INTEGER DEFAULT 5,
    max_overflow INTEGER DEFAULT 10,
    status VARCHAR(32) DEFAULT 'untested',
    last_tested_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Confidence:** MEDIUM -- the table structure is clear, but the migration from JSON config to DB table needs careful sequencing (chicken-and-egg: need a connection to read connections).

---

## Libraries NOT to Add

| Library | Why Not | What to Use Instead |
|---------|---------|---------------------|
| `databases` (encode/databases) | Adds another abstraction layer over SQLAlchemy. Redundant when SQLAlchemy 2.0 has native async. Maintenance has slowed. | SQLAlchemy `create_async_engine` + `text()` |
| `orjson` / `ujson` | Premature optimization. Result sets are capped at 10K rows. Stdlib `json` is fast enough. Add later if profiling shows serialization bottleneck. | `json` (stdlib) + custom encoder for Decimal/datetime |
| `aiocache` / `cachetools` | Redis is being removed. Server-side caching is NOT being replaced with another cache layer. TanStack Query handles client-side caching with `staleTime: 5 min`. | TanStack Query (frontend), no server cache |
| `celery` | Was used with Redis for async tasks. No background tasks needed in v2.0. If needed later, use FastAPI BackgroundTasks for simple cases. | FastAPI `BackgroundTasks` for fire-and-forget |
| `SQLModel` | Tiangolo's SQLAlchemy wrapper. Mixes Pydantic + SQLAlchemy models. RecViz already has clean separation: SQLAlchemy ORM models in `db/models/`, Pydantic models in `models/`. SQLModel would blur this boundary. | Keep separate SQLAlchemy + Pydantic models |
| `pgbouncer` / connection proxy | Unnecessary for internal tool with <50 concurrent users. SQLAlchemy's built-in pool is sufficient. Add if scaling requires it later. | SQLAlchemy `AsyncAdaptedQueuePool` |

---

## Updated requirements.txt

```txt
# RecViz Backend v2.0 -- Direct Database Engine
fastapi==0.128.6
uvicorn==0.40.0
pydantic==2.12.5
pydantic-settings==2.12.0
python-dotenv==1.2.1

# Database
sqlalchemy[asyncio]==2.0.49
asyncpg==0.31.0
oracledb==3.4.2
alembic==1.18.4
```

**Removed:**
- `httpx==0.28.1` -- was only for Superset proxy. Note: keep as dev dependency if using FastAPI TestClient.
- `psycopg2-binary==2.9.11` -- sync driver, replaced by asyncpg
- `redis==4.6.0` -- no longer needed
- `requests==2.32.5` -- no longer needed

**Changed:**
- `oracledb` upgraded from 2.5.1 to 3.4.2 (latest stable)

**Unchanged:**
- `sqlalchemy[asyncio]==2.0.49` -- already at latest 2.0.x
- `asyncpg==0.31.0` -- already at latest
- `alembic==1.18.4` -- already at latest

---

## Docker Compose Changes

**Current:** PostgreSQL + Redis + Superset containers
**New:** PostgreSQL only

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: recviz
      POSTGRES_PASSWORD: recviz_dev
      POSTGRES_DB: superset_meta
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./scripts/init-postgres.sql:/docker-entrypoint-initdb.d/init.sql

volumes:
  pgdata:
```

The `init-postgres.sql` script should create both `superset_meta` (metadata) and `recon_data` (dev data) databases, replacing what Superset's init script used to do.

---

## Version Compatibility Matrix

| Package | Version | Async Support | Oracle 19c | PostgreSQL 16 | Verified |
|---------|---------|---------------|------------|---------------|----------|
| SQLAlchemy | 2.0.49 | Yes (since 2.0.0) | Yes (`oracle+oracledb://` auto-async since 2.0.25) | Yes (`postgresql+asyncpg://`) | PyPI, official docs |
| asyncpg | 0.31.0 | Native async | N/A | Yes (PG 9.5+) | PyPI |
| python-oracledb | 3.4.2 | Yes (thin mode since 2.0) | Yes (12.1+ thin mode) | N/A | PyPI, official docs |
| Alembic | 1.18.4 | Async runner | Yes (Oracle dialect) | Yes (PG dialect) | PyPI |
| FastAPI | 0.128.6 | Native async | N/A (framework) | N/A (framework) | Already installed |

---

## Risks and Mitigations

### Risk 1: Oracle JSON Column Performance
**Risk:** `sa.JSON()` renders as `CLOB` on Oracle 19c. CLOB reads are slower than native JSON type (Oracle 21c+).
**Mitigation:** RecViz metadata tables are small (<1000 rows). CLOB performance for whole-document read/write is acceptable. If Oracle 21c+ is available later, a simple migration can switch to native JSON type.
**Confidence:** HIGH -- verified in deployment design doc, confirmed with Oracle 19c testing.

### Risk 2: SQL Dialect Differences in Data Queries
**Risk:** Dataset SQL queries written for Oracle may not work on PostgreSQL dev and vice versa.
**Mitigation:** The `QueryEngine._build_sql()` already has dialect-aware date range generation. Extend this pattern: detect dialect from engine, apply appropriate syntax. Dev datasets should use PostgreSQL-compatible SQL; prod datasets use Oracle SQL. The `dialect` field on connections makes this explicit.
**Confidence:** MEDIUM -- existing pattern works, but edge cases in SQL syntax (Oracle `ROWNUM` vs PostgreSQL `LIMIT`, `NVL` vs `COALESCE`) will need case-by-case handling.

### Risk 3: Connection Pool Exhaustion
**Risk:** Multiple data source engines each with `pool_size=5` could exhaust database connection limits.
**Mitigation:** 4 data sources x 5 connections = 20 connections. Oracle's default max is typically 150+. Monitor with `pool.status()`. Make pool sizes configurable per connection.
**Confidence:** HIGH -- pool sizes are conservative for the expected load.

---

## Sources

- [SQLAlchemy 2.0 Oracle Dialect](https://docs.sqlalchemy.org/en/20/dialects/oracle.html) -- connection URL format, dialect behavior
- [SQLAlchemy 2.0 Async IO](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html) -- async engine, session, pool documentation
- [SQLAlchemy 2.0 Connection Pooling](https://docs.sqlalchemy.org/en/20/core/pooling.html) -- pool configuration, AsyncAdaptedQueuePool
- [SQLAlchemy 2.0.25 Release](https://www.sqlalchemy.org/blog/2024/01/03/sqlalchemy-2.0.25-released/) -- added oracledb_async dialect
- [SQLAlchemy Oracle Async Issue #10679](https://github.com/sqlalchemy/sqlalchemy/issues/10679) -- implementation discussion and resolution
- [python-oracledb PyPI](https://pypi.org/project/oracledb/) -- version 3.4.2, Python 3.9-3.14 support
- [python-oracledb Async Documentation](https://python-oracledb.readthedocs.io/en/latest/user_guide/asyncio.html) -- asyncio usage, thin mode requirement
- [python-oracledb AsyncConnectionPool API](https://python-oracledb.readthedocs.io/en/latest/api_manual/async_connection_pool.html) -- native pool API (not recommended for RecViz)
- [asyncpg PyPI](https://pypi.org/project/asyncpg/) -- version 0.31.0
- [Alembic 1.18.4 Documentation](https://alembic.sqlalchemy.org/) -- migration patterns, Oracle/PostgreSQL support
- [SQLAlchemy JSON Type Discussion #10374](https://github.com/sqlalchemy/sqlalchemy/discussions/10374) -- Oracle JSON column limitations
- [SQLAlchemy JSON with_variant Discussion #9112](https://github.com/sqlalchemy/sqlalchemy/discussions/9112) -- cross-database JSON patterns
- [Oracle 21c JSON Data Type](https://oracle-base.com/articles/21c/json-data-type-21c) -- native JSON vs CLOB comparison
- [RecViz RHEL Oracle Deployment Design](docs/superpowers/specs/2026-04-09-rhel-oracle-no-sudo-deployment-design.md) -- verified async Oracle, JSON column behavior on 19c
- [Building Async APIs with FastAPI + SQLAlchemy 2.0](https://leapcell.io/blog/building-high-performance-async-apis-with-fastapi-sqlalchemy-2-0-and-asyncpg) -- patterns and best practices

---

*Stack research for: RecViz v2.0 Superset Removal -- Direct Database Engine*
*Researched: 2026-04-09*
