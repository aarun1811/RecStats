# Phase 1: Infrastructure Cutover - Research

**Researched:** 2026-04-12
**Domain:** Oracle database migration, Python oracledb thick mode, Alembic migrations, shadcn/ui palette theming, chart color token rewiring
**Confidence:** HIGH

## Summary

Phase 1 replaces the PostgreSQL-based development environment with Oracle (Docker `gvenzl/oracle-free:latest` locally, Oracle 19c in prod), enforces `oracledb` thick mode unconditionally, rewrites the Alembic migration stack for Oracle DDL, removes all PG/async/Docker-compose/Superset/Redis residue, and lays down the global Mist+Blue shadcn color palette with chart theme rewiring.

The user has pivoted from Oracle Cloud Always Free to a local Docker container (`gvenzl/oracle-free:latest` = Oracle 23ai Free). This simplifies connection (direct TCP, no wallet, no TNS_ADMIN) but introduces a version gap (23ai locally vs 19c in prod). Code MUST target 19c capabilities only -- no `BOOLEAN` column type, no `IF NOT EXISTS` DDL, no JSON-relational duality views, no `JSON` native column type.

**Primary recommendation:** Structure work as backend infrastructure first (config, engine, types, migration, thick mode, residue removal), then frontend palette/theme second, then cross-cutting validation (boot test, grep audit, USAGE-TRACKER init).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use Docker `gvenzl/oracle-free:latest` (Oracle 23ai Free) for local dev database instead of Oracle Cloud Always Free. Run via manual `docker run` command, not docker-compose.
- **D-02:** Code targets Oracle 19c capabilities only -- no 23ai-specific features (BOOLEAN column type, IF NOT EXISTS DDL, JSON-relational duality views, etc.). The version gap (23ai locally vs 19c in prod) is the only accepted drift.
- **D-03:** Connection string: `oracle+oracledb://recviz:recviz_dev@localhost:1521/FREEPDB1`. App user `recviz`, ADMIN user for DBA tasks only.
- **D-04:** Direct TCP connection on both local and prod (no wallet, no TNS_ADMIN, no oracle_config_dir, no wallet_password).
- **D-05:** Thick mode enforced on all environments -- no exceptions. No local/prod drift on driver mode.
- **D-06:** Oracle Instant Client 23.x for macOS ARM64 installed at `~/oracle/instantclient`. RHEL server uses `/opt/oraclient/19.3_64/lib/`.
- **D-07:** `ORACLE_CLIENT_LIB_DIR` env var required. Boot fails if unset or empty -- no silent thin mode fallback.
- **D-08:** Startup assertion checks `v$session_connect_info.client_driver` -- refuses boot if `python-oracledb thn` detected.
- **D-09:** Single connection URL via `RECVIZ_DB_URL` env var (no individual user/password/dsn fields). No default value -- app fails to start if missing.
- **D-10:** `ORACLE_CLIENT_LIB_DIR` as separate env var (not embedded in URL).
- **D-11:** `.env.example` documents four required vars: `RECVIZ_DB_URL`, `ORACLE_CLIENT_LIB_DIR`, `RECVIZ_ENCRYPTION_KEY`, `VITE_API_BASE_URL`.
- **D-12:** Drop `recon_db_url`, `superset_meta` default, and all asyncpg/PG references from config.py.
- **D-13:** Mist + Blue palette applied globally. Cool, professional BI feel with muted gray surfaces and blue accents.
- **D-14:** CSS variables updated in `frontend/src/index.css` for both light and dark mode.
- **D-15:** Start from shadcn's built-in `--chart-1` through `--chart-5`, extend to 8 categorical series vars (`--series-1` through `--series-8`) by deriving 3 more from the same hue family.
- **D-16:** Add semantic/ramp vars for specialized chart types: `--color-ramp-low`/`--color-ramp-high` for heatmap/treemap, `--chart-positive`/`--chart-negative` for waterfall/gauge.
- **D-17:** `chart-themes.ts` rewired to read CSS vars at render time via `getComputedStyle()` instead of hard-coded hex array.
- **D-18:** `OracleJSON(TypeDecorator, SchemaType)` stores via `BLOB IS JSON` with `CheckConstraint`. Primary type name is `OracleJSON`.
- **D-19:** `PortableJSON = OracleJSON` alias retained for one-milestone grace. Phase 8 removes the alias and updates all imports.
- **D-20:** Delete all 7 existing PG-targeted Alembic migrations.
- **D-21:** New `001_initial_oracle_schema.py` includes all 6 `recviz_*` tables including `recviz_data_sources` (seed script and existing code depend on it; Phase 6 handles the architectural fix).
- **D-22:** Hand-review against 9-point checklist: six tables, `BLOB IS JSON` on config/columns/extra_params, `VARCHAR2(128 CHAR)` PKs, `CLOB` for sql/encrypted_password, `TIMESTAMP(6) WITH TIME ZONE` defaults, expected indexes, `UniqueConstraint` on `recviz_connections.name`.
- **D-23:** Delete `docker-compose.yml` (PG container definition).
- **D-24:** Delete `scripts/setup-superset-local.sh` and all other PG/Superset setup scripts.
- **D-25:** Rewrite `scripts/seed-postgres.py` as `scripts/seed-oracle.py` for Oracle. Seed data gives something to work with in Phase 2+. Delete the seed script entirely in Phase 8.
- **D-26:** Delete dead dialect paths from `uri_builder.py` (elasticsearch, hive, postgresql) -- Oracle only.
- **D-27:** `engine_manager.py` supports Oracle only -- remove PostgreSQL dialect handling entirely.
- **D-28:** Delete entire `docs/` directory (all stale Superset-era files).
- **D-29:** Repo-wide grep audit for `postgresql`, `JSONB`, `asyncpg`, `psycopg2`, `superset`, `redis`, `celery` -- zero hits outside `.git/`.
- **D-30:** Initialize `.planning/USAGE-TRACKER.md`. Claude designs the format during planning to serve Phase 8 dead code sweep.

### Claude's Discretion
- USAGE-TRACKER.md format design
- Exact series color hex values (derived from Mist+Blue + shadcn chart vars)
- AG Grid `.ag-theme-quartz` override block specifics in index.css
- Startup assertion implementation details
- Pool sizing and connection args for Oracle engine
- Alembic env.py online mode configuration details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | Oracle Cloud provisioned (REPLACED by Docker gvenzl/oracle-free per D-01) | Docker image already pulled locally; `docker run` command documented in CONTEXT.md specifics |
| INFRA-02 | Wallet setup (REPLACED -- no wallet needed per D-04) | Direct TCP connection eliminates wallet entirely |
| INFRA-03 | Oracle Instant Client macOS ARM64 installed | Native ARM64 DMG available from Oracle; install at ~/oracle/instantclient per D-06 |
| INFRA-04 | TNS_ADMIN/sqlplus smoke test (REPLACED by Docker health check) | `SELECT sysdate FROM dual` via python oracledb against localhost:1521/FREEPDB1 |
| INFRA-05 | requirements.txt pruned | Remove psycopg2-binary, asyncpg, sqlalchemy[asyncio] extra; keep plain sqlalchemy==2.0.49 |
| INFRA-06 | config.py updated with Oracle fields | Single RECVIZ_DB_URL + ORACLE_CLIENT_LIB_DIR; drop recon_db_url and PG defaults |
| INFRA-07 | engine.py rewritten for Oracle | build_oracle_engine() helper, connect_args, pool sizing, thick mode |
| INFRA-08 | types.py rewritten to OracleJSON | BLOB IS JSON pattern via TypeDecorator + SchemaType with CheckConstraint |
| INFRA-09 | MetaData naming_convention applied | SQLAlchemy naming convention dict on Base.metadata for predictable constraint names |
| INFRA-10 | engine_manager.py uses build_oracle_engine | Ensures secondary engines share thick mode (once-per-process constraint) |
| INFRA-11 | 3 async def handlers in views.py converted to def | views.py has 3 async def handlers: list_views, create_view, delete_view |
| INFRA-12 | main.py lifespan adds thick mode assertion | Query v$session_connect_info.client_driver; refuse boot if 'thn' detected |
| INFRA-13 | alembic.ini + env.py rewritten for Oracle | Clear sqlalchemy.url; env.py wires thick mode + connect_args + Oracle-specific config |
| INFRA-14 | All 7 PG migrations deleted | 001 through 007 in backend/app/migrations/versions/ |
| INFRA-15 | New 001_initial_oracle_schema.py migration | Autogenerate + hand-review against 9-point checklist |
| INFRA-16 | .env.example updated | Four required vars: RECVIZ_DB_URL, ORACLE_CLIENT_LIB_DIR, RECVIZ_ENCRYPTION_KEY, VITE_API_BASE_URL |
| INFRA-17 | PG/Docker/Superset/Redis residue deleted | docker-compose.yml, docker/, deployment/, docs/, scripts cleanup; grep audit |
| INFRA-18 | Global shadcn Mist+Blue palette applied | CSS variables in index.css for both light and dark; UI-SPEC has exact oklch values |
| INFRA-19 | --series-1..8 CSS variable extension | 8 categorical chart colors added to index.css; values from UI-SPEC |
| INFRA-20 | .ag-theme-quartz CSS override block | AG Grid reads shadcn tokens via CSS variable bridge |
| INFRA-21 | chart-themes.ts rewired to CSS vars | Replace hard-coded hex series with resolveColor('--series-N'); update heatmap/treemap/waterfall |
| INFRA-22 | USAGE-TRACKER.md initialized | Format designed by Claude during planning |
| INFRA-23 | Backend boots, /health returns 200, frontend loads | End-to-end smoke test against Oracle |
| INFRA-24 | docs/ directory deleted entirely | All stale Superset-era documentation removed |
| INFRA-25 | CLAUDE.md verified fresh | Zero references to postgresql, asyncpg, superset, docker, redis, celery |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Oracle 19c only.** No PostgreSQL. No other databases.
- **oracledb thick mode only.** NCS 871 requires it.
- **No async DB.** Sync SQLAlchemy Session, sync oracledb, plain `def` handlers.
- **No Docker** in dev/prod (but Docker IS used to run the Oracle DB container -- the app itself is not containerized).
- **No Redis, no Celery, no Superset.**
- **No automated tests** this milestone.
- **Desktop only.**
- **Before using Edit/Write, start work through a GSD command.**
- **Strict TypeScript, no `any`, no `@ts-ignore`.**
- **Functional components only, named exports.**
- **No barrel exports.**
- **Semicolons omitted, single quotes, 2-space indent.**
- **`from __future__ import annotations`** at top of every Python file.
- **Route handlers are `def`, not `async def`.**
- **Table names prefixed `recviz_`.**
- **Alembic table: `recviz_alembic_version`.**

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| oracledb | 3.4.2 (installed) | Oracle driver, thick mode | [VERIFIED: pip show oracledb] Only driver supporting thick mode for NCS 871 |
| SQLAlchemy | 2.0.49 (installed) | ORM/Core, sync engine | [VERIFIED: pip show sqlalchemy] Sync-only, no asyncio extra |
| Alembic | 1.18.4 (installed) | Schema migrations | [VERIFIED: pip show alembic] Uses recviz_alembic_version table |
| FastAPI | 0.128.6 (installed) | HTTP API framework | [VERIFIED: pip show fastapi] Handlers as plain `def` |
| Pydantic | 2.12.5 (installed) | Validation + settings | [VERIFIED: pip show pydantic] BaseSettings for env config |
| cryptography | 46.0.7 (installed) | Fernet encryption | [VERIFIED: pip show cryptography] DB password encryption at rest |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| python-dotenv | 1.2.1 | .env file loading | Auto-loaded by pydantic-settings |
| uvicorn | 0.40.0 | ASGI server | Dev: `--reload`; prod: direct |

### Removed (Phase 1)

| Library | Version | Why Removed |
|---------|---------|-------------|
| psycopg2-binary | 2.9.11 | PostgreSQL driver -- no PG in stack |
| asyncpg | 0.31.0 | Async PG driver -- no async, no PG |
| sqlalchemy[asyncio] | 2.0.49 | Async extra -- sync-only model |

**Installation (after cleanup):**
```bash
# requirements.txt final state:
fastapi==0.128.6
uvicorn==0.40.0
pydantic==2.12.5
pydantic-settings==2.12.0
python-dotenv==1.2.1
sqlalchemy==2.0.49
alembic==1.18.4
cryptography==44.0.3
oracledb>=3.3.0
```

Note: `cryptography` pin in requirements.txt is `44.0.3` but `46.0.7` is installed in venv. The requirements.txt pin is a floor -- leaving it as-is is fine. [VERIFIED: backend/requirements.txt shows 44.0.3; pip show shows 46.0.7]

## Architecture Patterns

### Oracle Thick Mode Initialization

The thick mode `init_oracle_client()` call is **once-per-process** and irreversible. It must happen before ANY oracledb import or engine creation. [CITED: python-oracledb docs initialization page]

**Current pattern (main.py line 20):**
```python
oracledb.init_oracle_client(lib_dir="/opt/oraclient/19.3_64/lib")
```

**Target pattern:**
```python
import os
import oracledb

lib_dir = os.environ.get('ORACLE_CLIENT_LIB_DIR')
if not lib_dir:
    raise RuntimeError(
        "FATAL: ORACLE_CLIENT_LIB_DIR is not set. "
        "Set it to the Oracle Instant Client directory."
    )

oracledb.init_oracle_client(lib_dir=lib_dir)
```

The `ORACLE_CLIENT_LIB_DIR` env var is read directly by `main.py` before pydantic Settings loads, because thick mode init must happen before any module that imports oracledb. [ASSUMED -- this is an architectural choice; pydantic Settings could also work if imported early enough, but the existing pattern of early init in main.py is correct]

### Thick Mode Verification via v$session_connect_info

The `client_driver` column in `V$SESSION_CONNECT_INFO` shows:
- Thick mode: `python-oracledb thk : X.Y.Z` [CITED: python-oracledb docs]
- Thin mode: `python-oracledb thn : X.Y.Z` [CITED: python-oracledb docs]

**Startup assertion pattern:**
```python
from sqlalchemy import text

def assert_thick_mode(engine):
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT client_driver FROM v$session_connect_info WHERE sid = SYS_CONTEXT('USERENV', 'SID')")
        )
        row = result.fetchone()
        if row and 'thn' in row[0]:
            raise RuntimeError(
                "FATAL: Oracle thick mode not detected. "
                f"client_driver={row[0]}. "
                "Refusing to start."
            )
```

**Caveat:** Querying `v$session_connect_info` requires the `SELECT` privilege on this view. The `recviz` app user on the Docker container (created via `APP_USER` env) should have this by default for gvenzl/oracle-free, but this needs verification. If not, the ADMIN user must grant it: `GRANT SELECT ON v$session_connect_info TO recviz;` [ASSUMED -- needs verification at execution time]

### OracleJSON TypeDecorator + SchemaType Pattern

The `BLOB IS JSON` pattern works on Oracle 19c. The native `JSON` type is 21c+ only. [CITED: Oracle 19c docs, python-oracledb JSON docs]

```python
import json as json_lib
from sqlalchemy import BLOB, CheckConstraint, event
from sqlalchemy.types import SchemaType, TypeDecorator

class OracleJSON(TypeDecorator, SchemaType):
    """JSON stored as BLOB with IS JSON check constraint on Oracle."""
    impl = BLOB
    cache_ok = True

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def _set_table(self, column, table):
        # SchemaType hook: add IS JSON check constraint when table is created
        event.listen(
            table,
            "after_create",
            lambda *a, **kw: None  # constraint added via __table_args__
        )
        # Add check constraint
        constraint_name = f"ck_{table.name}_{column.name}_json"
        table.append_constraint(
            CheckConstraint(
                f"{column.name} IS JSON",
                name=constraint_name,
            )
        )

    def process_bind_param(self, value, dialect):
        if value is not None:
            return json_lib.dumps(value).encode('utf-8')
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            if isinstance(value, bytes):
                return json_lib.loads(value.decode('utf-8'))
            if isinstance(value, str):
                return json_lib.loads(value)
        return value

# Grace alias (D-19)
PortableJSON = OracleJSON
```

**Key points:**
- `impl = BLOB` because Oracle 19c does not have native JSON type [CITED: sqlalchemy/sqlalchemy#10374]
- `SchemaType` mixin provides `_set_table` hook to auto-add `IS JSON` check constraint [CITED: SQLAlchemy type_basics docs]
- The check constraint ensures Oracle validates JSON on insert/update [CITED: Oracle docs on IS JSON constraint]
- `process_bind_param` must encode to bytes (BLOB expects bytes, not str) [ASSUMED -- standard BLOB pattern]
- `process_result_value` handles both bytes (BLOB read) and str (edge cases) [ASSUMED]

### MetaData Naming Convention

Required by INFRA-09 and critical for Alembic autogenerate to produce deterministic constraint names on Oracle (Oracle generates random alphanumeric names without this). [CITED: Alembic naming convention docs]

```python
from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

convention = {
    "ix": "ix_%(table_name)s_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=convention)
```

### Alembic env.py for Oracle

The env.py must:
1. Initialize thick mode before creating an engine (or confirm it was already init'd in main.py)
2. Use `settings.recviz_db_url` as the connection URL
3. Set `version_table="recviz_alembic_version"`
4. Use `transaction_per_migration=True` because Oracle DDL auto-commits -- a failed migration cannot be rolled back within a transaction [CITED: Oracle DDL auto-commit behavior]
5. Set `compare_type=True` for autogenerate to detect type changes
6. Clear the `sqlalchemy.url` in alembic.ini (force env.py to control the URL)

**Critical Oracle gotcha:** DDL statements (`CREATE TABLE`, `ALTER TABLE`) in Oracle auto-commit the current transaction. This means if a migration has multiple DDL statements and the second one fails, the first one is already committed. Recovery requires manual `DROP TABLE ... CASCADE CONSTRAINTS`. [VERIFIED: ROADMAP.md known risks]

### Engine Configuration for Oracle Metadata DB

```python
from sqlalchemy import create_engine

engine = create_engine(
    settings.recviz_db_url,  # oracle+oracledb://recviz:recviz_dev@localhost:1521/FREEPDB1
    echo=False,
    pool_size=5,
    max_overflow=5,
    pool_pre_ping=True,
    pool_recycle=1800,
)
```

Pool sizing: `pool_size=5, max_overflow=5` = max 10 connections. This is appropriate for the metadata DB (low concurrency). Per D-07 in REQUIREMENTS, the original spec says the same numbers. [VERIFIED: INFRA-07 in REQUIREMENTS.md]

### Oracle-Specific SQLAlchemy Column Type Mapping

| Python/SA Type | Oracle DDL Output | Notes |
|----------------|-------------------|-------|
| `String(128)` | `VARCHAR2(128 CHAR)` | SA Oracle dialect auto-emits CHAR semantics [ASSUMED] |
| `String(256)` | `VARCHAR2(256 CHAR)` | |
| `String(1024)` | `VARCHAR2(1024 CHAR)` | |
| `Text` | `CLOB` | For long SQL, encrypted passwords |
| `Integer` | `NUMBER(38,0)` | Oracle has no INT type, uses NUMBER |
| `DateTime(timezone=True)` | `TIMESTAMP(6) WITH TIME ZONE` | SA maps this correctly for Oracle dialect [ASSUMED] |
| `OracleJSON` (BLOB) | `BLOB` + `IS JSON` constraint | Custom TypeDecorator |
| `func.now()` | `SYSTIMESTAMP` | SA Oracle dialect renders func.now() as SYSTIMESTAMP [ASSUMED] |

**Oracle `String` encoding caveat:** `VARCHAR2(128 CHAR)` means 128 characters, not 128 bytes. This is critical for multi-byte character sets like NCS 871. SQLAlchemy's Oracle dialect uses `CHAR` semantics by default when you specify `String(N)`. [ASSUMED -- needs verification that the oracledb dialect does this automatically]

### Seed Script Oracle Rewrite

The existing `seed-postgres.py` (2680 lines) uses `psycopg2` directly with raw SQL. The Oracle rewrite needs to:

1. Replace `psycopg2` with `oracledb` (or use SQLAlchemy Core `text()` for portability)
2. Replace `%s` placeholders with `:1, :2` (Oracle bind variable style) or named `:param` style
3. Replace `NOW()` with `SYSTIMESTAMP`
4. Replace `::jsonb` casts with raw JSON string insertion (BLOB handles it)
5. Replace `SERIAL` / `BIGSERIAL` with Oracle sequences or use string IDs (already string-based)
6. Replace `CREATE TABLE IF NOT EXISTS` with plain `CREATE TABLE` (19c doesn't support IF NOT EXISTS)
7. Replace `ON CONFLICT` / `INSERT ... ON DUPLICATE KEY` with `MERGE INTO` if needed
8. Replace `TRUNCATE ... CASCADE` with `DELETE FROM` + handle FK constraints
9. Maintain the same seed data so Phase 2+ has data to work with

**Recommended approach:** Use `oracledb` directly (matching the existing pattern of using psycopg2 directly) rather than SQLAlchemy ORM, to keep the seed script simple and self-contained. [ASSUMED -- Claude's discretion per CONTEXT.md]

### Frontend Color Palette Application

All exact oklch color values are documented in the UI-SPEC at `.planning/phases/01-infrastructure-cutover/01-UI-SPEC.md`. The implementation pattern is:

1. Replace CSS variable values in `:root` and `.dark` blocks in `index.css`
2. Add new `--series-1..8`, `--color-ramp-low/high`, `--chart-positive/negative` variables
3. Add corresponding `@theme inline` entries for Tailwind utility class access
4. Add `.ag-theme-quartz` CSS override block
5. Rewire `chart-themes.ts` series array and chart-type-specific overrides
6. Update `frontend/components.json` baseColor from `"neutral"` to `"mist"`

### Residue Removal Scope

**Files to delete:**
- `docker-compose.yml` [VERIFIED: exists at repo root]
- `docker/init-db.sql` [VERIFIED: exists]
- `deployment/` (empty directory) [VERIFIED: exists, empty]
- `docs/` (entire directory -- 10+ stale files) [VERIFIED: exists with stale Superset-era content]
- `scripts/setup-superset-local.sh` [VERIFIED: exists]
- `scripts/generate-seed-db.py` [VERIFIED: exists]
- `scripts/mock-audit.sh` [VERIFIED: exists]
- `scripts/seed-postgres.py` (replaced by seed-oracle.py) [VERIFIED: exists, 2680 lines]
- All 7 existing Alembic migrations [VERIFIED: 001-007 exist]

**Files to modify (residue cleanup within):**
- 25 backend files with PG/Superset/Redis references [VERIFIED: grep audit]
- 13 frontend files with PG/Superset references [VERIFIED: grep audit]
- Most are comments/docstrings that need cleanup; some are functional code

**Grep audit targets:** `postgresql`, `JSONB`, `asyncpg`, `psycopg2`, `superset`, `redis`, `celery`

### uri_builder.py Oracle-Only Rewrite

Current state has `DEFAULT_PORTS` for oracle, postgresql, hive, elasticsearch and two builder functions (`build_sqlalchemy_uri`, `build_sync_uri`) with multi-dialect support. [VERIFIED: read uri_builder.py]

Target state: Oracle-only. Remove `postgresql`, `hive`, `elasticsearch` entries from `DEFAULT_PORTS` and `SYNC_DIALECTS`. Remove `build_sqlalchemy_uri` entirely (only `build_sync_uri` is used). Simplify `build_sync_uri` to Oracle-only path.

### engine_manager.py Oracle-Only Rewrite

Current state has PostgreSQL-specific `_connect_args_for_backend` (statement_timeout) and Oracle-specific `_install_oracle_call_timeout`. [VERIFIED: read engine_manager.py]

Target state: Remove PostgreSQL path from `_connect_args_for_backend`. Remove `HEALTH_CHECK_SQL` PostgreSQL entry. Remove PostgreSQL branches from `test_connection`. Only Oracle remains.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON storage on Oracle 19c | Custom CLOB + manual JSON parsing | `OracleJSON(TypeDecorator, SchemaType)` with `BLOB IS JSON` | Oracle validates JSON via check constraint; BLOB handles binary JSON efficiently |
| Constraint naming | Anonymous constraints (Oracle default) | `MetaData(naming_convention={...})` | Oracle generates random names without this; Alembic needs deterministic names |
| CSS color resolution | Manual hex-to-oklch conversion | Existing `resolveColor()` + `cssColorToHex()` in chart-themes.ts | Already handles oklch, hsl, rgb, bare HSL formats |
| Oracle driver mode detection | Parse oracledb internal attributes | Query `v$session_connect_info.client_driver` | Official Oracle-documented approach |
| Password encryption | Custom crypto | Existing `EncryptionService` with Fernet | Already built, works, no changes needed |

## Common Pitfalls

### Pitfall 1: Once-Per-Process Thick Mode Constraint
**What goes wrong:** Calling `init_oracle_client()` multiple times or calling it after any oracledb connection has been established raises an error or silently locks into thin mode.
**Why it happens:** The Oracle Client library initialization is process-global and irreversible. [CITED: python-oracledb initialization docs]
**How to avoid:** Call `init_oracle_client(lib_dir=...)` exactly once, at the very top of `main.py`, before any other app module imports. The `EngineManager.get_engine()` method must NOT call init_oracle_client -- it just uses the already-initialized thick mode.
**Warning signs:** `python-oracledb thn` appearing in `v$session_connect_info.client_driver` when thick mode was expected.

### Pitfall 2: Oracle DDL Auto-Commit
**What goes wrong:** If an Alembic migration contains multiple DDL statements and a later one fails, the earlier ones are already committed. The migration is partially applied and Alembic's version tracking is inconsistent.
**Why it happens:** Oracle automatically commits the current transaction before and after every DDL statement (CREATE, ALTER, DROP). [VERIFIED: ROADMAP.md known risks]
**How to avoid:** Use `transaction_per_migration=True` in Alembic config so each migration runs in its own "transaction" (though DDL still auto-commits). Test migrations against a throwaway schema. If a migration fails, recovery is manual: `DROP TABLE ... CASCADE CONSTRAINTS`.
**Warning signs:** Alembic reporting a version mismatch; some tables existing but not others.

### Pitfall 3: BLOB IS JSON vs Native JSON Type
**What goes wrong:** Using Oracle's native `JSON` column type or `JSON_VALUE` / `JSON_QUERY` functions that are 21c+ only, causing errors on Citi's 19c production.
**Why it happens:** The Docker container runs Oracle 23ai which supports native JSON. Code that works locally fails in prod.
**How to avoid:** Always use `BLOB IS JSON` pattern (19c compatible). Never use `JSON` column type, `IS JSON` path expressions (dot-notation access), or 21c+ JSON functions in SQL. [VERIFIED: D-02 in CONTEXT.md]
**Warning signs:** Any `JSON` column type in migration DDL, any `json_value()` or `json_query()` in SQL templates.

### Pitfall 4: VARCHAR2 Byte vs Char Semantics
**What goes wrong:** Using `VARCHAR2(128)` without specifying `CHAR` semantics can result in 128-byte limit instead of 128-character limit, causing truncation with multi-byte characters.
**Why it happens:** Oracle's default `VARCHAR2` semantics depend on the `NLS_LENGTH_SEMANTICS` parameter, which can differ between local and prod.
**How to avoid:** SQLAlchemy's Oracle dialect should emit `VARCHAR2(N CHAR)` when you use `String(N)`. Verify this in the generated migration DDL. [ASSUMED -- needs verification]
**Warning signs:** `ORA-12899: value too large for column` errors with non-ASCII characters.

### Pitfall 5: func.now() on Oracle
**What goes wrong:** `server_default=func.now()` on Oracle may not render correctly in migration DDL, or may produce `CURRENT_TIMESTAMP` instead of `SYSTIMESTAMP`.
**Why it happens:** SQLAlchemy's rendering of `func.now()` varies by dialect. On Oracle, `SYSTIMESTAMP` includes timezone information; `CURRENT_TIMESTAMP` is session-timezone-dependent.
**How to avoid:** Use `server_default=text("SYSTIMESTAMP")` explicitly in the Oracle migration if autogenerate doesn't produce the right DDL. Verify the autogenerated migration against the 9-point checklist. [ASSUMED]
**Warning signs:** Timestamps stored without timezone info; timestamps in unexpected timezones.

### Pitfall 6: Seed Script Oracle Syntax Differences
**What goes wrong:** Direct copy-paste of PostgreSQL SQL into Oracle fails due to syntax differences.
**Why it happens:** Oracle uses different placeholder syntax (`:param` vs `%s`), different DDL keywords (no `IF NOT EXISTS`, no `SERIAL`, no `::jsonb` cast), different string concatenation (`||` vs `+`).
**How to avoid:** Use `oracledb` cursor with named bind variables (`:name` style). Use `MERGE INTO` instead of `ON CONFLICT`. Use `SYSTIMESTAMP` instead of `NOW()`. Use raw string for BLOB JSON columns (oracledb handles encoding).
**Warning signs:** `ORA-00933: SQL command not properly ended`, `ORA-00911: invalid character`, `ORA-01756: quoted string not properly terminated`.

### Pitfall 7: Oracle Instant Client Not Found
**What goes wrong:** `oracledb.init_oracle_client()` fails silently or the app falls back to thin mode without the developer noticing.
**Why it happens:** The Instant Client isn't installed, `ORACLE_CLIENT_LIB_DIR` is wrong, or the dynamic library path isn't configured.
**How to avoid:** D-07 requires boot to FAIL if `ORACLE_CLIENT_LIB_DIR` is unset. The startup assertion (D-08) double-checks by querying the driver mode. Never catch and swallow `init_oracle_client` exceptions with a "fallback to thin" -- the current code does this and must be fixed.
**Warning signs:** The current `main.py` line 26-28 has a `logger.warning("... falling back to thin mode")` -- this MUST be changed to a hard failure.

### Pitfall 8: gvenzl/oracle-free APP_USER Privileges
**What goes wrong:** The `recviz` app user created by `APP_USER` env var may not have sufficient privileges to query `v$session_connect_info` or create tables in the pluggable DB.
**Why it happens:** The `gvenzl/oracle-free` image creates the APP_USER with limited default grants.
**How to avoid:** Verify grants after container creation. If needed, connect as ADMIN and grant: `GRANT SELECT ON v$session_connect_info TO recviz; GRANT CREATE TABLE TO recviz; GRANT UNLIMITED TABLESPACE TO recviz;`. [ASSUMED -- needs verification at execution time]
**Warning signs:** `ORA-00942: table or view does not exist` when querying v$ views; `ORA-01031: insufficient privileges` when creating tables.

## Code Examples

### Docker Oracle Container Startup

```bash
docker run -d \
  --name oracle-26ai \
  -p 1521:1521 \
  -e ORACLE_PASSWORD=RecViz2026 \
  -e APP_USER=recviz \
  -e APP_USER_PASSWORD=recviz_dev \
  gvenzl/oracle-free:latest
```
Source: CONTEXT.md specifics section [VERIFIED]

Connection string: `oracle+oracledb://recviz:recviz_dev@localhost:1521/FREEPDB1`
Source: D-03 [VERIFIED]

### Oracle Instant Client Install (macOS ARM64)

```bash
# Download from https://www.oracle.com/database/technologies/instant-client/macos-arm64-downloads.html
# Mount the DMG and run:
/Volumes/instantclient-basic-macos.arm64-23.x.x.x.x/install_ic.sh
# Move to target location:
mkdir -p ~/oracle
mv ~/Downloads/instantclient_23_* ~/oracle/instantclient
```
Source: [CITED: Oracle Instant Client installation guide for macOS ARM64, medium.com/oracledevs]

### .env.example Target State

```bash
# Oracle connection URL (REQUIRED -- no default, app refuses to start without it)
RECVIZ_DB_URL=oracle+oracledb://recviz:recviz_dev@localhost:1521/FREEPDB1

# Oracle Instant Client lib directory (REQUIRED -- thick mode enforcement)
# macOS ARM64: ~/oracle/instantclient
# RHEL prod: /opt/oraclient/19.3_64/lib/
ORACLE_CLIENT_LIB_DIR=/Users/yourname/oracle/instantclient

# Fernet encryption key for database credentials at rest (REQUIRED)
# Generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
RECVIZ_ENCRYPTION_KEY=

# Frontend API base URL
VITE_API_BASE_URL=http://localhost:8000
```

### config.py Target State

```python
from __future__ import annotations

from pydantic import SecretStr
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    recviz_db_url: str  # No default -- MUST be set via RECVIZ_DB_URL env var
    oracle_client_lib_dir: str  # No default -- MUST be set
    recviz_encryption_key: SecretStr  # No default -- MUST be set

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
```

### chart-themes.ts Series Array Target

```typescript
// Source: UI-SPEC + existing resolveColor() utility
const series = [
  resolveColor('--series-1'),
  resolveColor('--series-2'),
  resolveColor('--series-3'),
  resolveColor('--series-4'),
  resolveColor('--series-5'),
  resolveColor('--series-6'),
  resolveColor('--series-7'),
  resolveColor('--series-8'),
]
```

### Heatmap/Treemap/Waterfall Overrides Target

```typescript
// Heatmap
heatmap: {
  series: {
    colorRange: [resolveColor('--color-ramp-low'), resolveColor('--color-ramp-high')],
    // ...
  },
},
// Treemap
treemap: {
  series: {
    colorRange: [resolveColor('--chart-positive'), resolveColor('--chart-negative')],
    // ...
  },
},
// Pie sectorLabel
pie: {
  series: {
    sectorLabel: { color: resolveColor('--primary-foreground'), fontSize: 11 },
    // ...
  },
},
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PostgreSQL metadata DB | Oracle 19c metadata DB | Phase 1 (now) | All SQLAlchemy types, migrations, connection patterns change |
| JSONB column type | BLOB IS JSON (Oracle 19c) | Phase 1 (now) | TypeDecorator rewrite, check constraints added |
| asyncpg + async SQLAlchemy | sync oracledb + sync SQLAlchemy | Started 2026-04-10, completed Phase 1 | All async patterns removed |
| Hardcoded hex chart colors | CSS variable reads via resolveColor() | Phase 1 (now) | Charts auto-theme with dark mode toggle |
| Neutral shadcn base | Mist base + Blue accent | Phase 1 (now) | Cool-tinted professional BI feel |
| Docker Compose for PG | Docker `docker run` for Oracle | Phase 1 (now) | No compose file, manual docker run |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | SQLAlchemy Oracle dialect emits `VARCHAR2(N CHAR)` for `String(N)` | Architecture Patterns | Multi-byte character truncation in prod |
| A2 | `func.now()` renders as `SYSTIMESTAMP` on Oracle dialect | Architecture Patterns | Timestamps without timezone info |
| A3 | `process_bind_param` for BLOB should encode to bytes | OracleJSON pattern | Insert failures for JSON columns |
| A4 | gvenzl/oracle-free APP_USER has SELECT on v$session_connect_info | Pitfall 8 | Thick mode assertion query fails |
| A5 | ORACLE_CLIENT_LIB_DIR read in main.py before pydantic Settings | Architecture Patterns | Could use Settings if import order is careful |
| A6 | Oracle oracledb cursor uses `:name` bind variable syntax | Seed Script | Seed script insert failures |

## Open Questions

1. **Oracle Instant Client installation on this specific dev machine**
   - What we know: macOS ARM64 DMGs are available from Oracle. D-06 says install at `~/oracle/instantclient`.
   - What's unclear: The Instant Client is NOT currently installed on this machine (verified: no files found in ~/oracle/ or /opt/oracle/).
   - Recommendation: This is a manual user step. Plan should include a prerequisite checklist noting this must be done before code execution begins.

2. **v$session_connect_info grant for APP_USER on gvenzl/oracle-free**
   - What we know: The Docker image creates APP_USER automatically, but the default grants may not include `v$` views.
   - What's unclear: Exact grant set given to APP_USER by gvenzl/oracle-free.
   - Recommendation: Include a verification step after container startup. If grant is missing, add it via ADMIN user.

3. **func.now() Oracle rendering in Alembic autogenerate**
   - What we know: SQLAlchemy should render `SYSTIMESTAMP` for Oracle dialect.
   - What's unclear: Whether autogenerate produces the correct DDL or if manual fixup is needed.
   - Recommendation: The 9-point checklist (D-22) already requires hand-review of the migration. Inspect the DDL for timestamp defaults.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | Oracle dev DB container | Yes | 29.3.1 | -- |
| gvenzl/oracle-free image | Local Oracle DB | Yes (pulled) | latest (23.26.0) | -- |
| Python 3.12+ | Backend | Yes | 3.12.12 | -- |
| Node.js | Frontend dev | Yes | v24.13.0 | -- |
| pnpm | Frontend packages | Yes | 10.29.2 | -- |
| pip | Backend packages | Yes | 25.0.1 | -- |
| oracledb (Python) | Oracle driver | Yes (in venv) | 3.4.2 | -- |
| Oracle Instant Client | Thick mode | **NO** | -- | Must install before code work |
| sqlplus | Oracle CLI tool | **NO** | -- | Use Python oracledb for verification instead |

**Missing dependencies with no fallback:**
- **Oracle Instant Client** -- Must be installed at `~/oracle/instantclient` before backend can boot in thick mode. This is a manual user prerequisite.

**Missing dependencies with fallback:**
- **sqlplus** -- Not strictly needed; can verify Oracle connectivity via Python oracledb directly. The INFRA-04 requirement (sqlplus smoke test) is replaced by the Docker + Python approach per D-01/D-04.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual verification only (no automated tests this milestone) |
| Config file | N/A |
| Quick run command | `curl http://localhost:8000/health` |
| Full suite command | Manual: boot backend, load frontend, check both light/dark mode |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01..04 | Docker Oracle container running, connectable | manual | `docker ps; python -c "import oracledb; ..."` | N/A |
| INFRA-05 | requirements.txt has no PG deps | manual | `grep -E 'psycopg2\|asyncpg' backend/requirements.txt` | N/A |
| INFRA-06 | config.py has Oracle fields only | manual | read config.py | N/A |
| INFRA-07 | engine.py creates Oracle engine | manual | backend boots | N/A |
| INFRA-08 | OracleJSON type works | manual | alembic upgrade head + insert test | N/A |
| INFRA-09 | naming_convention applied | manual | inspect migration DDL for named constraints | N/A |
| INFRA-12 | thick mode assertion at startup | manual | boot backend, check logs for driver line | N/A |
| INFRA-13..15 | Alembic migration applies cleanly | manual | `alembic upgrade head` | N/A |
| INFRA-17 | residue removed | manual | `grep -rn 'postgresql\|asyncpg\|psycopg2\|superset\|redis\|celery' --include='*.py' --include='*.ts' --include='*.tsx' --include='*.yml' --include='*.json'` | N/A |
| INFRA-18..21 | palette + chart themes applied | manual | load frontend, toggle dark mode, inspect chart colors | N/A |
| INFRA-23 | end-to-end boot | manual | backend boots + frontend loads | N/A |
| INFRA-25 | CLAUDE.md clean | manual | grep CLAUDE.md | N/A |

### Sampling Rate
- **Per task commit:** `curl http://localhost:8000/health` (backend up check)
- **Per wave merge:** Full boot test (backend + frontend + dark mode)
- **Phase gate:** All INFRA-* requirements verified manually

### Wave 0 Gaps
None -- no automated test infrastructure needed for this milestone. All verification is manual per project constraint.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Deferred to v2 (AUTH-*) |
| V3 Session Management | no | No sessions implemented |
| V4 Access Control | no | No access control this milestone |
| V5 Input Validation | yes | Pydantic v2 on all request bodies; `validate_read_only()` for SQL explorer |
| V6 Cryptography | yes | Fernet encryption via `EncryptionService` for DB passwords at rest; key from `RECVIZ_ENCRYPTION_KEY` env var |

### Known Threat Patterns for Oracle + FastAPI Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via raw SQL explorer | Tampering | `validate_read_only()` rejects non-SELECT; parameterized queries for template SQL |
| Connection string leakage in errors | Information Disclosure | `sanitize_detail()` redacts URIs; no default DB URL (prevents accidental exposure) |
| DB password exposure | Information Disclosure | Fernet encryption at rest; decrypted only on hot path in EngineManager |
| Thick mode fallback to thin | Elevation of Privilege | Hard failure on missing ORACLE_CLIENT_LIB_DIR; startup assertion queries driver mode |

## Sources

### Primary (HIGH confidence)
- **Codebase files** -- Read and verified: config.py, engine.py, types.py, main.py, engine_manager.py, uri_builder.py, chart-themes.ts, index.css, base.py, all ORM models, alembic.ini, env.py, views.py, requirements.txt, .env.example, components.json, seed-postgres.py (partial)
- **01-CONTEXT.md** -- All 30 locked decisions
- **01-UI-SPEC.md** -- Exact oklch color values for all CSS variables, series tokens, ramp tokens, AG Grid bridge
- **REQUIREMENTS.md** -- All 25 INFRA-* requirements
- **ROADMAP.md** -- Phase 1 details, success criteria, known risks
- **CONCERNS.md** -- Active tech debt and known bugs

### Secondary (MEDIUM confidence)
- [Oracle Instant Client macOS ARM64 downloads](https://www.oracle.com/database/technologies/instant-client/macos-arm64-downloads.html) -- ARM64 DMGs confirmed available
- [python-oracledb initialization docs](https://python-oracledb.readthedocs.io/en/latest/user_guide/initialization.html) -- thick mode init_oracle_client(), v$session_connect_info
- [gvenzl/oracle-free Docker image](https://hub.docker.com/r/gvenzl/oracle-free) -- latest = Oracle AI 23.26.0 Free, multi-arch
- [SQLAlchemy naming convention](https://alembic.sqlalchemy.org/en/latest/naming.html) -- MetaData naming_convention for Alembic
- [SQLAlchemy/GitHub #10374](https://github.com/sqlalchemy/sqlalchemy/discussions/10374) -- JSON column support for oracledb dialect
- [python-oracledb JSON data docs](https://python-oracledb.readthedocs.io/en/latest/user_guide/json_data_type.html) -- BLOB IS JSON pattern
- [Oracle 19c datetime types](https://docs.oracle.com/en/database/oracle/oracle-database/19/nlspg/datetime-data-types-and-time-zone-support.html) -- TIMESTAMP WITH TIME ZONE

### Tertiary (LOW confidence)
- [shadcn/ui theming docs](https://ui.shadcn.com/docs/theming) -- oklch color space usage (confirmed by UI-SPEC, which has exact values)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages verified installed with exact versions
- Architecture: HIGH -- existing codebase patterns understood, Oracle-specific patterns researched
- Pitfalls: HIGH -- well-documented Oracle gotchas, verified against roadmap known risks
- Frontend palette: HIGH -- exact values provided in UI-SPEC
- Seed script rewrite: MEDIUM -- approach is clear but 2680-line script is substantial

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (stable -- Oracle 19c is mature, oracledb 3.x API is stable)
