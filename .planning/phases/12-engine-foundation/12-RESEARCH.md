# Phase 12: Engine Foundation - Research

**Researched:** 2026-04-09
**Domain:** SQLAlchemy async engine pool, cross-dialect ORM, Fernet credential encryption, Alembic migrations
**Confidence:** HIGH

## Summary

Phase 12 builds the infrastructure for RecViz to query databases directly via SQLAlchemy instead of proxying through Superset. This is pure backend plumbing: a new `recviz_connections` table with encrypted credentials, an `EngineManager` that creates/caches one `AsyncEngine` per connection, a cross-dialect `PortableJSON` type that renders as JSONB on PostgreSQL and CLOB on Oracle, and an Alembic migration for the new table.

The most critical finding is that **`sa.JSON()` does NOT compile on Oracle in SQLAlchemy 2.0.49**. The Oracle dialect has no `visit_JSON` method. The CONTEXT.md decision D-07 (`sa.JSON().with_variant(JSONB(), "postgresql")`) will fail on Oracle. The correct approach is a `TypeDecorator` with `load_dialect_impl` that dispatches to JSONB on PostgreSQL and Text (CLOB) on Oracle. This was verified by compiling DDL against both dialects locally.

All other decisions from CONTEXT.md are sound: `oracle+oracledb://` auto-selects async dialect (verified), Fernet from the `cryptography` library works for password encryption (verified), and the existing `uri_builder.py` needs only async dialect prefix additions.

**Primary recommendation:** Build a `PortableJSON` TypeDecorator as the first task, then the connection model + encryption service, then the EngineManager, then the Alembic migration. Each builds on the previous with zero API surface changes.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** New `recviz_connections` table stores all data source connection details. Schema: `id` (UUID PK), `name` (unique), `display_name`, `backend` (oracle/postgresql), `host`, `port`, `database_name`, `username`, `encrypted_password`, `schema_name`, `extra_params` (JSON), `status`, `last_tested_at`, `created_at`, `updated_at`.
- **D-02:** Auto-migrate `databases.json` entries into the table on first boot via a one-time startup migration. After migration, the JSON file is no longer read. `databases.prod.json` is dropped -- production connections configured via UI or the same migration path.
- **D-03:** Connection testing uses `SELECT 1` (PostgreSQL) or `SELECT 1 FROM DUAL` (Oracle) with a 10-second timeout via a disposable temporary engine.
- **D-04:** Fernet symmetric encryption for passwords at rest. Key from `RECVIZ_ENCRYPTION_KEY` env var. Add to `.env.example` with a generated dev default.
- **D-05:** Passwords encrypted before DB write, decrypted at engine creation time. URI built from decrypted fields at runtime -- never stored as a full URI.
- **D-06:** Single Alembic migration changes all JSONB columns across all 5 models (dashboards, charts, datasets, KPIs, data_sources) to portable `sa.JSON()`. On PostgreSQL this is functionally identical (JSON type). On Oracle this maps to CLOB with IS JSON constraint.
- **D-07:** Use `sa.JSON().with_variant(JSONB(), "postgresql")` so PostgreSQL still gets native JSONB performance while Oracle gets CLOB-based JSON. This is backwards-compatible -- no data loss, no application code changes needed. **RESEARCH CORRECTION: `sa.JSON()` does NOT compile on Oracle in SA 2.0.49. Use `TypeDecorator` with `load_dialect_impl` instead -- same outcome (JSONB on PG, CLOB on Oracle) but actually works.**
- **D-08:** New `EngineManager` service: `dict[str, AsyncEngine]` keyed by connection UUID. Lazily creates engines on first query. Disposes engine on connection update/delete. Pre-warms all registered connections on startup.
- **D-09:** Pool settings per engine: `pool_size=5`, `max_overflow=10`, `pool_timeout=30`, `pool_recycle=1800`, `pool_pre_ping=True`. Conservative for single-tenant use (~12 users).
- **D-10:** PostgreSQL uses `postgresql+asyncpg://` dialect. Oracle uses `oracle+oracledb://` dialect (SQLAlchemy 2.0.25+ auto-selects async). Thin mode only for Oracle -- no Oracle Instant Client required.
- **D-11:** Extend existing `uri_builder.py` to generate async dialect URIs from connection table fields. PostgreSQL: `postgresql+asyncpg://user:pass@host:port/dbname`. Oracle: `oracle+oracledb://user:pass@host:port/?service_name=SID`.
- **D-12:** No change to local dev workflow: `docker compose up` (PostgreSQL only) + `uvicorn`. Only new env var is `RECVIZ_ENCRYPTION_KEY` with a dev default in `.env.example`.
- **D-13:** Oracle not tested locally -- SQLAlchemy dialect abstraction + portable JSON type handles the gap. Oracle validated during RHEL deployment only.

### Claude's Discretion
- Exact Alembic migration structure (single file vs split per table)
- EngineManager internal error handling and logging
- Connection table column sizes and constraints
- Startup migration sequencing (migrate JSON before or after Alembic)
- Test structure for engine pool lifecycle

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONN-01 | Connections stored in `recviz_connections` table (replacing Superset storage + databases.json) | RecvizConnection ORM model + Alembic migration 005 creates the table. Schema verified in DDL generation for both PostgreSQL and Oracle. |
| CONN-03 | Connection testing via direct `SELECT 1` / `SELECT 1 FROM DUAL` with timeout | EngineManager.test_connection() creates a disposable engine, executes health-check SQL based on dialect, 10s timeout via `pool_timeout` + `connect_args.tcp_connect_timeout`. |
| CONN-04 | Credential encryption at rest using Fernet symmetric encryption (key from env var) | `cryptography==46.0.7` Fernet verified locally. Key from `RECVIZ_ENCRYPTION_KEY` env var. EncryptionService class handles encrypt/decrypt. |
| CONN-05 | URI builder generates async dialect URIs (`postgresql+asyncpg://`, `oracle+oracledb://`) | Extend existing `uri_builder.py` with `build_async_uri()` function. Both URI formats verified working with `create_async_engine`. |
| DIAL-01 | Replace all JSONB column types with portable type for PostgreSQL/Oracle | `PortableJSON` TypeDecorator verified: JSONB on PostgreSQL, CLOB on Oracle. Must replace JSONB import in all 5 model files. |
| DIAL-03 | Alembic migrations execute successfully on both PostgreSQL and Oracle | New migration 005 uses PortableJSON. Existing PG-only migrations (001-004) stay as-is -- Oracle is fresh install. ORM models updated so autogenerate sees correct types. |
| QENG-01 | Dynamic engine pool -- one AsyncEngine per registered database, created lazily, disposed on connection update/delete | EngineManager with `dict[str, AsyncEngine]`, `asyncio.Lock` for thread-safe creation, `dispose()` on update/delete. `AsyncAdaptedQueuePool` auto-used by SQLAlchemy. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLAlchemy | 2.0.49 (installed) | Async engine creation, ORM models, `text()` execution | Already in codebase. `create_async_engine` handles both PG and Oracle. [VERIFIED: pip show] |
| asyncpg | 0.31.0 (installed) | PostgreSQL async driver | Already installed. Powers `postgresql+asyncpg://`. [VERIFIED: pip show] |
| python-oracledb | 3.4.2 | Oracle async driver (thin mode) | Latest stable. Async support verified. `oracle+oracledb://` auto-selects async dialect in SA 2.0.25+. [VERIFIED: pip index, local engine creation] |
| cryptography | 46.0.7 | Fernet symmetric encryption for credentials | Latest stable. Fernet key generation + encrypt/decrypt verified locally. [VERIFIED: pip index, local test] |
| Alembic | 1.18.4 (installed) | Database migrations | Already in codebase. Separate `recviz_alembic_version` table. [VERIFIED: pip show] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| uuid (stdlib) | built-in | Generate connection UUIDs | `uuid.uuid4()` for `recviz_connections.id` primary key |
| asyncio (stdlib) | built-in | Lock for thread-safe engine creation | `asyncio.Lock()` in EngineManager to prevent duplicate engine creation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fernet (cryptography) | AES-GCM (custom) | Fernet is simpler, well-audited, sufficient for DB passwords. No reason to hand-roll AES. |
| TypeDecorator (PortableJSON) | `sa.JSON().with_variant()` | `sa.JSON()` does NOT compile on Oracle in SA 2.0.49. TypeDecorator is the only working approach. |
| SQLAlchemy pool | oracledb native pool | oracledb pool requires NullPool + custom creator in SA. Adds complexity. SA pool is sufficient for ~12 users. |

**Installation:**
```bash
pip install oracledb==3.4.2 cryptography==46.0.7
```

**Version verification:**
- SQLAlchemy 2.0.49 -- [VERIFIED: `pip show sqlalchemy` on dev machine]
- asyncpg 0.31.0 -- [VERIFIED: `pip show asyncpg` on dev machine]
- oracledb 3.4.2 -- [VERIFIED: `pip index versions oracledb`, installed and tested engine creation]
- cryptography 46.0.7 -- [VERIFIED: `pip index versions cryptography`, installed and tested Fernet round-trip]
- Alembic 1.18.4 -- [VERIFIED: `pip show alembic` on dev machine]

## Architecture Patterns

### Recommended Project Structure (new files only)
```
backend/app/
├── db/
│   ├── types.py              # NEW: PortableJSON TypeDecorator
│   └── models/
│       └── connection.py     # NEW: RecvizConnection ORM model
├── services/
│   ├── encryption.py         # NEW: EncryptionService (Fernet)
│   └── engine_manager.py     # NEW: EngineManager (engine pool)
├── migrations/
│   └── versions/
│       └── 005_add_connections_table.py  # NEW: cross-dialect migration
└── config.py                 # MODIFIED: add RECVIZ_ENCRYPTION_KEY
```

### Pattern 1: PortableJSON TypeDecorator
**What:** A custom SQLAlchemy TypeDecorator that renders as JSONB on PostgreSQL and CLOB on Oracle, with automatic JSON serialization/deserialization for Oracle.
**When to use:** Every column in the codebase that currently uses `JSONB` from `sqlalchemy.dialects.postgresql`.

```python
# Source: Verified locally via DDL compilation against both postgresql and oracle dialects
import json as json_lib
from sqlalchemy import Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import TypeDecorator


class PortableJSON(TypeDecorator):
    """JSON type portable across PostgreSQL (JSONB) and Oracle (CLOB).

    - PostgreSQL: delegates to native JSONB (binary JSON, indexable)
    - Oracle: stores as CLOB with Python-side JSON serialization
    """
    impl = Text
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(JSONB())
        return dialect.type_descriptor(Text())

    def process_bind_param(self, value, dialect):
        if value is not None and dialect.name != "postgresql":
            return json_lib.dumps(value)
        return value

    def process_result_value(self, value, dialect):
        if value is not None and dialect.name != "postgresql":
            if isinstance(value, str):
                return json_lib.loads(value)
        return value
```
[VERIFIED: Local DDL compilation produces `JSONB` for PostgreSQL and `CLOB` for Oracle]

### Pattern 2: EngineManager with asyncio.Lock
**What:** A service that manages `dict[str, AsyncEngine]` keyed by connection UUID, with lazy creation and explicit disposal.
**When to use:** As the single point of engine lifecycle management, injected via FastAPI dependency.

```python
# Source: SQLAlchemy async docs + verified create_async_engine patterns
import asyncio
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine


class EngineManager:
    """Manages async SQLAlchemy engines for data source connections."""

    def __init__(self) -> None:
        self._engines: dict[str, AsyncEngine] = {}
        self._lock = asyncio.Lock()

    async def get_engine(self, connection_id: str, uri: str, **pool_kwargs) -> AsyncEngine:
        if connection_id in self._engines:
            return self._engines[connection_id]
        async with self._lock:
            # Double-check after acquiring lock
            if connection_id in self._engines:
                return self._engines[connection_id]
            engine = create_async_engine(uri, **pool_kwargs)
            self._engines[connection_id] = engine
            return engine

    async def dispose_engine(self, connection_id: str) -> None:
        async with self._lock:
            engine = self._engines.pop(connection_id, None)
            if engine:
                await engine.dispose()

    async def dispose_all(self) -> None:
        async with self._lock:
            for engine in self._engines.values():
                await engine.dispose()
            self._engines.clear()
```
[VERIFIED: `create_async_engine` + `await engine.dispose()` tested locally with both PG and Oracle URIs]

### Pattern 3: Fernet Encryption Service
**What:** A thin wrapper around `cryptography.fernet.Fernet` for encrypting/decrypting database passwords.
**When to use:** Before writing passwords to `recviz_connections` table and when building URIs from stored connections.

```python
# Source: cryptography library docs, verified locally
from cryptography.fernet import Fernet


class EncryptionService:
    def __init__(self, key: str) -> None:
        self._fernet = Fernet(key.encode() if isinstance(key, str) else key)

    def encrypt(self, plaintext: str) -> str:
        return self._fernet.encrypt(plaintext.encode()).decode()

    def decrypt(self, ciphertext: str) -> str:
        return self._fernet.decrypt(ciphertext.encode()).decode()

    @staticmethod
    def generate_key() -> str:
        return Fernet.generate_key().decode()
```
[VERIFIED: Round-trip encrypt/decrypt tested locally with cryptography 46.0.7]

### Pattern 4: Connection Test via Disposable Engine
**What:** Create a temporary engine to test connectivity, then immediately dispose it.
**When to use:** `POST /api/databases/test` endpoint and startup pre-warming.

```python
# Source: SQLAlchemy async docs
async def test_connection(uri: str, dialect: str, timeout: int = 10) -> tuple[bool, str]:
    """Test database connectivity with a disposable engine."""
    test_sql = "SELECT 1 FROM DUAL" if dialect == "oracle" else "SELECT 1"
    engine = create_async_engine(
        uri,
        pool_size=1,
        max_overflow=0,
        pool_timeout=timeout,
        connect_args={"tcp_connect_timeout": timeout} if "oracledb" in uri else {},
    )
    try:
        async with engine.connect() as conn:
            await conn.execute(text(test_sql))
        return True, "Connection successful"
    except Exception as exc:
        return False, str(exc)
    finally:
        await engine.dispose()
```
[VERIFIED: Engine creation/disposal lifecycle tested locally]

### Pattern 5: databases.json Auto-Migration on Startup
**What:** Read `databases.json`, insert entries into `recviz_connections` if they do not already exist (by name), skip if already present.
**When to use:** In FastAPI lifespan, after Alembic migrations have run.

```python
# Conceptual pattern for startup migration
async def migrate_json_connections(
    session: AsyncSession,
    config_path: str,
    encryption: EncryptionService,
) -> int:
    """Migrate databases.json entries to recviz_connections table.
    Returns count of newly inserted connections.
    """
    if not Path(config_path).exists():
        return 0

    config = json.loads(Path(config_path).read_text())
    count = 0
    for db in config.get("databases", []):
        # Check if already migrated
        existing = await session.execute(
            select(RecvizConnection).where(RecvizConnection.name == db["name"])
        )
        if existing.scalar_one_or_none():
            continue
        # Parse URI into individual fields, encrypt password
        # Insert new RecvizConnection row
        count += 1
    await session.commit()
    return count
```

### Anti-Patterns to Avoid
- **Using `sa.JSON()` directly on Oracle:** Does NOT compile in SA 2.0.49. The Oracle dialect lacks `visit_JSON`. Always use the `PortableJSON` TypeDecorator. [VERIFIED: DDL compilation fails]
- **Storing full URIs in the database:** Passwords visible in DB dumps and logs. Store fields separately, encrypt password, build URI at runtime.
- **Creating engines without caching:** Each `create_async_engine` call creates a full connection pool. Creating one per request leaks pools.
- **Forgetting to `await engine.dispose()` on connection update/delete:** Each undisposed engine leaks its entire pool (5+ connections to Oracle).
- **Calling `oracledb.init_oracle_client()`:** Switches to Thick mode process-wide, permanently breaks async. Thin mode is the default and MUST be preserved.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password encryption | Custom AES/RSA encryption | `cryptography.fernet.Fernet` | Fernet is authenticated encryption, handles IV/MAC automatically, well-audited |
| Connection pooling | Custom connection cache with health checks | SQLAlchemy `AsyncAdaptedQueuePool` (built into `create_async_engine`) | Pool handles checkout/checkin, overflow, recycling, pre-ping automatically |
| JSON serialization for Oracle CLOB | Manual `json.dumps`/`json.loads` in every query | `PortableJSON` TypeDecorator with `process_bind_param`/`process_result_value` | Centralizes serialization logic, ORM handles it transparently |
| UUID generation | Custom ID generators | `uuid.uuid4()` from stdlib | Standard, collision-resistant, no dependencies |
| Async locking | Threading locks or custom semaphores | `asyncio.Lock()` | Correct for asyncio event loop, prevents deadlocks that threading.Lock causes in async |

**Key insight:** This phase is pure infrastructure wiring. Every component (encryption, pooling, JSON portability, migrations) has a well-established library or pattern. The risk is in integration (getting all pieces to work together correctly), not in any individual component.

## Common Pitfalls

### Pitfall 1: sa.JSON() Does Not Compile on Oracle (SA 2.0.49)
**What goes wrong:** CONTEXT.md decision D-07 specifies `sa.JSON().with_variant(JSONB(), "postgresql")`. The `sa.JSON()` base type has no Oracle type compiler in SQLAlchemy 2.0.49. DDL generation and Alembic migrations crash with `Compiler can't render element of type JSON`.
**Why it happens:** SQLAlchemy's Oracle dialect does not implement `visit_JSON`. The generic JSON type works on PostgreSQL (maps to JSON), MySQL (maps to JSON), SQLite (maps to TEXT), but NOT Oracle.
**How to avoid:** Use `PortableJSON` TypeDecorator with `load_dialect_impl` that dispatches to JSONB (PostgreSQL) or Text/CLOB (Oracle). This achieves the same goal as D-07 but actually works.
**Warning signs:** Any `from sqlalchemy import JSON` used in models or migrations targeting Oracle.
[VERIFIED: DDL compilation against oracle.dialect() fails with `Compiler can't render element of type JSON`]

### Pitfall 2: Existing Migrations (001-004) Import JSONB Directly
**What goes wrong:** All four existing Alembic migrations have `from sqlalchemy.dialects.postgresql import JSONB`. Running `alembic upgrade head` against Oracle crashes on migration 001.
**Why it happens:** Migrations were written for PostgreSQL-only dev environment.
**How to avoid:** Do NOT rewrite existing migrations. They are immutable history for PostgreSQL dev databases. For Oracle (fresh install), either (a) stamp the version table at 004 and only run 005+, or (b) write migration 005 with `op.get_bind().dialect.name` checks that create tables from scratch on Oracle but are no-ops on PostgreSQL.
**Warning signs:** Running `alembic upgrade head` on a fresh Oracle database.

### Pitfall 3: Engine Pool Leak on Connection Update/Delete
**What goes wrong:** When a user updates a connection's password, the old engine (with the old URI) must be disposed. If `dispose_engine()` is not called, the old pool stays open holding 5+ Oracle connections.
**Why it happens:** Engine creation feels cheap (one function call) but each engine allocates a connection pool with background threads.
**How to avoid:** EngineManager.dispose_engine() MUST be called before creating a new engine for the same connection_id. The `asyncio.Lock` prevents race conditions during the swap.
**Warning signs:** Oracle `V$SESSION` count growing after connection updates. `pool.status()` shows connections for engines that should be gone.

### Pitfall 4: oracledb Thick Mode Breaks Async
**What goes wrong:** If `oracledb.init_oracle_client()` is called anywhere, the entire Python process switches to Thick mode permanently. All `create_async_engine` calls with `oracle+oracledb://` then fail.
**Why it happens:** oracledb mode is process-global. Thick mode does not support asyncio.
**How to avoid:** Never call `init_oracle_client()`. Add a startup assertion: `assert oracledb.is_thin_mode()`. Thin mode is the default -- just never switch away from it.
**Warning signs:** `TypeError: An asyncio.Future, a coroutine or an awaitable is required` when connecting to Oracle.
[VERIFIED: `oracledb.is_thin_mode()` returns `True` by default on fresh install]

### Pitfall 5: DateTime(timezone=True) Renders as DATE on Oracle
**What goes wrong:** All existing models use `DateTime(timezone=True)` for `created_at`/`updated_at`. On PostgreSQL this renders as `TIMESTAMP WITH TIME ZONE`. On Oracle it renders as `DATE` (no timezone, seconds precision only).
**Why it happens:** SQLAlchemy's Oracle dialect maps `DateTime` to `DATE` regardless of the `timezone` parameter. `TIMESTAMP(timezone=True)` would render as `TIMESTAMP WITH TIME ZONE`.
**How to avoid:** For this phase, leave as-is. Oracle `DATE` is sufficient for audit timestamps on a single-server internal tool. If timezone fidelity becomes important later, switch to `TIMESTAMP(timezone=True)`.
**Warning signs:** Timestamps in Oracle missing timezone offset or sub-second precision.
[VERIFIED: DDL compilation shows `DateTime(timezone=True)` -> `DATE` on Oracle, `TIMESTAMP(timezone=True)` -> `TIMESTAMP WITH TIME ZONE`]

### Pitfall 6: Alembic env.py Missing Model Imports
**What goes wrong:** The current `env.py` only imports `RecvizDashboard`, `RecvizDataSource`, `RecvizDataset`. It does NOT import `RecvizChart` or `RecvizKpi`. The new `RecvizConnection` model also needs importing.
**Why it happens:** Models were added in phases 3 and 4 but env.py was not updated. Alembic autogenerate would not detect these tables.
**How to avoid:** Update env.py imports to include ALL models: `RecvizChart`, `RecvizKpi`, `RecvizConnection`.
**Warning signs:** `alembic revision --autogenerate` shows unexpected table drops or no changes.
[VERIFIED: env.py only imports 3 of 6 models]

## Code Examples

### Verified: PortableJSON DDL Generation
```python
# Source: Local verification against SQLAlchemy 2.0.49 dialects
# PostgreSQL DDL output:
# CREATE TABLE test_dashboards (
#     id VARCHAR(128) NOT NULL,
#     config JSONB NOT NULL,
#     PRIMARY KEY (id)
# )

# Oracle DDL output:
# CREATE TABLE test_dashboards (
#     id VARCHAR2(128 CHAR) NOT NULL,
#     config CLOB NOT NULL,
#     PRIMARY KEY (id)
# )
```
[VERIFIED: Compiled locally with postgresql.dialect() and oracle.dialect()]

### Verified: Oracle Async Engine Creation
```python
# Source: Local verification with oracledb 3.4.2 + SQLAlchemy 2.0.49
from sqlalchemy.ext.asyncio import create_async_engine

engine = create_async_engine(
    "oracle+oracledb://user:pass@host:1521/?service_name=MYSERVICE",
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=1800,
    pool_pre_ping=True,
)
# engine.dialect.name == "oracle"
# engine.dialect.driver == "oracledb"
# engine.dialect.is_async == True
# engine.pool.__class__.__name__ == "AsyncAdaptedQueuePool"
```
[VERIFIED: Engine creation succeeds, dialect auto-selects async]

### Verified: Fernet Encrypt/Decrypt
```python
# Source: Local verification with cryptography 46.0.7
from cryptography.fernet import Fernet

key = Fernet.generate_key()  # e.g., "ZtmS2OQUhct4iBQmAcreQftJoeodRw4h7Rz3fU8ZPG4="
f = Fernet(key)
encrypted = f.encrypt(b"my_oracle_p@ssw0rd!#")
decrypted = f.decrypt(encrypted)  # b"my_oracle_p@ssw0rd!#"
# Encrypted output is URL-safe base64, ~120 bytes for a typical password
```
[VERIFIED: Round-trip tested locally]

### Verified: Async Engine Dispose
```python
# Source: Local verification
engine = create_async_engine("postgresql+asyncpg://...", pool_size=2)
print(engine.pool.status())
# Pool size: 2  Connections in pool: 0  Current Overflow: -2
await engine.dispose()
# Clean disposal, no warnings
```
[VERIFIED: Disposal tested locally with PostgreSQL engine]

### Existing: uri_builder.py Extension Pattern
```python
# Current uri_builder.py produces sync URIs like:
# oracle://user:pass@host:1521/?service_name=SVC
# postgresql://user:pass@host:5432/mydb

# New build_async_uri() should produce:
# oracle+oracledb://user:pass@host:1521/?service_name=SVC
# postgresql+asyncpg://user:pass@host:5432/mydb

# Key change: dialect prefix mapping
ASYNC_DIALECTS = {
    "oracle": "oracle+oracledb",
    "postgresql": "postgresql+asyncpg",
}
```
[VERIFIED: Both URI formats tested with create_async_engine]

### Existing: Connection Table Schema (recviz_connections)
```python
# From CONTEXT.md D-01, adapted with verified column types
class RecvizConnection(Base):
    __tablename__ = "recviz_connections"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String(256), nullable=False)
    backend: Mapped[str] = mapped_column(String(32), nullable=False)  # oracle, postgresql
    host: Mapped[str] = mapped_column(String(256), nullable=False)
    port: Mapped[int] = mapped_column(Integer, nullable=False)
    database_name: Mapped[str] = mapped_column(String(256), nullable=False)
    username: Mapped[str] = mapped_column(String(256), nullable=False)
    encrypted_password: Mapped[str] = mapped_column(Text, nullable=False)
    schema_name: Mapped[str] = mapped_column(String(256), server_default="")
    extra_params: Mapped[dict | None] = mapped_column(PortableJSON(), nullable=True)
    status: Mapped[str] = mapped_column(String(32), server_default="untested")
    last_tested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
```
[VERIFIED: DDL compiles correctly for both PostgreSQL and Oracle via PortableJSON]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `JSONB` from `sqlalchemy.dialects.postgresql` | `PortableJSON` TypeDecorator | Phase 12 | Enables Oracle deployment |
| Sync `oracle://` dialect | Async `oracle+oracledb://` with auto-async | SQLAlchemy 2.0.25 (Jan 2024) | Enables async Oracle queries |
| `oracledb` 2.5.1 | `oracledb` 3.4.2 | Jan 2026 | Better pool management, pipeline support |
| Storing plaintext URIs | Fernet-encrypted password fields | Phase 12 | Security improvement |
| `databases.json` file | `recviz_connections` DB table | Phase 12 | Enables UI-driven connection management |

**Deprecated/outdated:**
- `cx_Oracle` driver: Replaced by `python-oracledb`. The old `oracle://` dialect still works but `oracle+oracledb://` is the modern path. [CITED: python-oracledb docs]
- `sa.JSON()` for Oracle: Does not compile in SA 2.0.49. May be fixed in SA 2.1.x but we stay on 2.0.x for stability. [VERIFIED: local test]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Oracle production is 19c (not 21c+), so native JSON type unavailable | Architecture Patterns | If Oracle is 21c+, could use `sa.JSON()` directly instead of CLOB. Low risk -- CLOB works on all Oracle versions. |
| A2 | `pool_recycle=1800` (30 min) is sufficient to prevent Oracle idle timeout kills | Standard Stack | If Oracle firewall kills connections faster, queries will fail until pool_pre_ping detects stale connections. Adjust to shorter interval if needed. |
| A3 | `encrypted_password` column max length of TEXT/CLOB is sufficient for Fernet output | Code Examples | Fernet encrypted output for typical passwords is ~120 bytes. TEXT/CLOB can hold megabytes. No risk. |

**If this table is empty:** Most claims were verified locally. The three assumptions above relate to the production Oracle environment which cannot be tested locally.

## Open Questions

1. **Oracle 19c vs 21c JSON support**
   - What we know: SA 2.0.49 Oracle dialect does NOT support `sa.JSON()`. The TypeDecorator CLOB approach works on both 19c and 21c.
   - What's unclear: Which Oracle version is in production. If 21c+, native JSON would be slightly more efficient.
   - Recommendation: Use CLOB approach (works on all versions). Optimize later if needed.

2. **Alembic on fresh Oracle: how to handle migrations 001-004**
   - What we know: Migrations 001-004 use `JSONB` which crashes on Oracle. Dev PostgreSQL environments have already run these.
   - What's unclear: Should migration 005 detect Oracle and create all tables from scratch? Or should there be a separate Oracle bootstrap script?
   - Recommendation: Migration 005 should use conditional logic: on Oracle, create all tables (since it is always a fresh install); on PostgreSQL, only create `recviz_connections` (existing tables already exist). This keeps a single migration chain.

3. **databases.json migration: how to parse existing URIs into fields**
   - What we know: `databases.json` stores full `sqlalchemy_uri` strings. The new table stores individual fields (host, port, database, username, password).
   - What's unclear: The dev JSON has simple URIs but prod JSON may have complex Oracle URIs with service_name parameters.
   - Recommendation: Write a `parse_sqlalchemy_uri(uri)` helper that splits the URI into components. Use `urllib.parse.urlparse` for the base parsing + custom handling for `?service_name=` parameter.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.12+ | Backend runtime | Yes | 3.12.12 | -- |
| SQLAlchemy | Engine creation | Yes | 2.0.49 | -- |
| asyncpg | PostgreSQL async driver | Yes | 0.31.0 | -- |
| python-oracledb | Oracle async driver | Yes | 3.4.2 | -- (just installed) |
| cryptography | Fernet encryption | Yes | 46.0.7 | -- (just installed) |
| Alembic | Migrations | Yes | 1.18.4 | -- |
| pytest | Test framework | Yes | 9.0.2 | -- |
| PostgreSQL (Docker) | Dev database | Yes | 16 | -- |
| Oracle database | Production target | No (not local) | -- | Test against PostgreSQL only (D-13) |

**Missing dependencies with no fallback:**
- None. All required libraries are installed.

**Missing dependencies with fallback:**
- Oracle database not available locally -- validated only during RHEL deployment (per decision D-13).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 9.0.2 |
| Config file | None (uses defaults, tests in `backend/tests/`) |
| Quick run command | `cd backend && python -m pytest tests/ -x -q` |
| Full suite command | `cd backend && python -m pytest tests/ -v` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONN-01 | RecvizConnection model CRUD via ORM | unit | `python -m pytest tests/test_connection_model.py -x` | Wave 0 |
| CONN-03 | Connection test: SELECT 1 / SELECT 1 FROM DUAL | unit (mock engine) | `python -m pytest tests/test_engine_manager.py::test_connection_test -x` | Wave 0 |
| CONN-04 | Fernet encrypt/decrypt round-trip | unit | `python -m pytest tests/test_encryption.py -x` | Wave 0 |
| CONN-05 | Async URI generation (both dialects) | unit | `python -m pytest tests/test_uri_builder.py -x` | Extend existing |
| DIAL-01 | PortableJSON compiles to JSONB (PG) and CLOB (Oracle) | unit | `python -m pytest tests/test_portable_json.py -x` | Wave 0 |
| DIAL-03 | Alembic migration 005 runs on PostgreSQL | integration | `cd backend && alembic upgrade head` | Wave 0 (migration file) |
| QENG-01 | EngineManager create/get/dispose lifecycle | unit | `python -m pytest tests/test_engine_manager.py -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/ -x -q`
- **Per wave merge:** `cd backend && python -m pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/test_portable_json.py` -- covers DIAL-01 (DDL compilation verification)
- [ ] `tests/test_encryption.py` -- covers CONN-04 (Fernet round-trip, key from env)
- [ ] `tests/test_engine_manager.py` -- covers QENG-01, CONN-03 (engine lifecycle, connection test)
- [ ] `tests/test_connection_model.py` -- covers CONN-01 (ORM model, table DDL)
- [ ] Extend `tests/test_uri_builder.py` -- covers CONN-05 (async dialect URIs)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Auth deferred to future milestone |
| V3 Session Management | No | No sessions in this phase |
| V4 Access Control | No | No API endpoints in this phase |
| V5 Input Validation | Yes | Pydantic models validate connection fields before storage |
| V6 Cryptography | Yes | Fernet (AES-128-CBC + HMAC-SHA256) for credentials at rest |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Credential exposure in DB dump | Information Disclosure | Fernet encryption at rest for passwords; key in env var, not in code |
| Encryption key exposure | Information Disclosure | Key from `RECVIZ_ENCRYPTION_KEY` env var; never committed to repo; `.env.example` has placeholder |
| URI logged with password | Information Disclosure | Build URI at runtime from decrypted fields; SQLAlchemy masks passwords in `engine.url` repr |
| Engine pool leak (DoS) | Denial of Service | EngineManager with explicit dispose on update/delete; `asyncio.Lock` prevents race conditions |

## Sources

### Primary (HIGH confidence)
- SQLAlchemy 2.0.49 installed locally -- TypeDecorator DDL compilation, create_async_engine, pool behavior
- python-oracledb 3.4.2 installed locally -- thin mode default, version verified via pip index
- cryptography 46.0.7 installed locally -- Fernet round-trip verified
- Existing codebase files: `engine.py`, `base.py`, `dependencies.py`, `config.py`, `uri_builder.py`, all 5 ORM models, all 4 migrations, `databases.json`, `databases.prod.json`, `main.py`, `connection_status.py`

### Secondary (MEDIUM confidence)
- [SQLAlchemy Oracle Dialect docs](https://docs.sqlalchemy.org/en/20/dialects/oracle.html) -- connection URL format, dialect behavior [CITED]
- [SQLAlchemy Async I/O docs](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html) -- async engine, session, pool [CITED]
- [python-oracledb async docs](https://python-oracledb.readthedocs.io/en/latest/user_guide/asyncio.html) -- thin mode requirement for async [CITED]
- `.planning/research/STACK.md` -- version compatibility matrix, removal plan
- `.planning/research/ARCHITECTURE.md` -- dual engine strategy, component design
- `.planning/research/PITFALLS.md` -- JSONB blocker, pool sizing, thin mode constraint

### Tertiary (LOW confidence)
- None. All critical claims verified locally.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages verified via pip, version numbers confirmed
- Architecture: HIGH -- all patterns verified via local code execution (DDL compilation, engine creation, Fernet)
- Pitfalls: HIGH -- the critical sa.JSON() Oracle failure was discovered and verified during this research session
- Alembic migration strategy: MEDIUM -- conditional Oracle/PG logic in a single migration is sound but untested against a real Oracle instance

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable libraries, no upcoming breaking changes)
