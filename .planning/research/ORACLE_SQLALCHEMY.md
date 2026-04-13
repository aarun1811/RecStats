# Oracle 19c + SQLAlchemy 2 + oracledb (thick) + Alembic — Cutover Research

**Researched:** 2026-04-11
**For milestone:** Oracle-Only Cutover + Frontend Colorization, Phase 1 infrastructure planning
**Scope:** Prescriptive guidance for swapping sync SQLAlchemy 2 + `oracledb` thick mode + Alembic targeting Oracle 19c in the `backend/` tree, including the exact column types, session lifecycle, and migration strategy the planner should use.

**Assumptions (from reading the existing codebase, not invented):**
- All primary keys are `String(128)` holding UUIDs. **There are zero integer autoincrement PKs.** No sequences, no `Identity()`. This eliminates an entire class of Oracle pain up front.
- `PortableJSON` TypeDecorator already exists at `backend/app/db/types.py` with `impl = Text`, PG branch `JSONB`, Oracle branch `Text`. It stays — but needs a better Oracle-side implementation.
- Sync engine + `sessionmaker` already exists at `backend/app/db/engine.py`. The change is the URL string and driver-specific kwargs, not the engine pattern.
- `get_db_session()` in `backend/app/core/dependencies.py` is already a sync generator-based FastAPI dependency. Its shape is correct for `def` handlers in the Starlette threadpool; contents only need checking, not a rewrite.
- `env.py` already uses sync `create_engine` and already sets `version_table="recviz_alembic_version"` in both offline and online branches. Only the URL and a couple of flags change.
- The three `async def` handlers in `backend/app/api/views.py` are **in-memory only** (no DB) — flipping them to `def` is a one-line-per-handler change, not a session lifecycle rewrite.

---

## 1. Sync SQLAlchemy 2 + `oracledb` thick mode — the exact incantation

**Short answer.** Use `create_engine("oracle+oracledb://...")` and pass `thick_mode` as a **dict of `init_oracle_client()` kwargs** directly to `create_engine`. SQLAlchemy 2 forwards the dict to `oracledb.init_oracle_client()` internally at engine-initialization time. Do **not** call `oracledb.init_oracle_client()` yourself in application code — let SQLAlchemy do it. Do **not** pass thick-mode toggles via URL query string. Do **not** pass them via `connect_args`.

**Why a dict and not `thick_mode=True`.** `thick_mode=True` (bare boolean) will start thick mode but gives you no way to point at a non-default Oracle Instant Client location or a non-default wallet / `tnsnames.ora` directory. On macOS (personal dev machine for this project, per PROJECT.md) and on the RHEL prod target, you typically need at least `config_dir` (for wallet + tnsnames) and on macOS frequently `lib_dir` too. Pass the dict form from day one and you have one pattern that works everywhere.

**Minimum viable pattern — macOS local dev against Oracle Cloud Autonomous DB:**

```python
# backend/app/db/engine.py
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings

engine = create_engine(
    settings.recviz_db_url,                  # oracle+oracledb://USER:PW@TNS_ALIAS
    thick_mode={
        "lib_dir": settings.oracle_client_lib_dir,     # "/Users/aarun/instantclient_23_3"
        "config_dir": settings.oracle_config_dir,      # wallet + tnsnames.ora directory
        "driver_name": "recviz:1.0",                   # shows in V$SESSION_CONNECT_INFO
    },
    echo=False,
    pool_size=10,
    max_overflow=5,
    pool_pre_ping=True,
)

session_factory = sessionmaker(
    engine,
    class_=Session,
    expire_on_commit=False,
)
```

**RHEL prod caveat (important):** on Linux, **do not pass `lib_dir`** to `init_oracle_client()`. The `oracledb` docs are explicit that on Linux the Oracle Client libraries must be on the system library search path *before the Python process starts* (`LD_LIBRARY_PATH` or `/etc/ld.so.conf.d/` entry, wired up at process-launch time). Passing `lib_dir` on Linux "does not behave as you might expect." So the production `thick_mode` dict is typically:

```python
thick_mode={
    "config_dir": "/opt/oracle/wallet",
    "driver_name": "recviz:1.0",
}
```

**This means `lib_dir` should be optional in config and only included in the dict when set.** Recommended pattern for `backend/app/db/engine.py`:

```python
thick_mode_args: dict[str, str] = {
    "config_dir": settings.oracle_config_dir,
    "driver_name": "recviz:1.0",
}
if settings.oracle_client_lib_dir:  # set locally on macOS, unset on RHEL
    thick_mode_args["lib_dir"] = settings.oracle_client_lib_dir

engine = create_engine(
    settings.recviz_db_url,
    thick_mode=thick_mode_args,
    ...
)
```

**Once-per-process constraint.** `init_oracle_client()` can only be called before any connection or pool is created, and the mode cannot be changed after. Because SQLAlchemy calls it lazily from engine init, **every engine in the process must use thick mode** — you cannot mix thick and thin in one process. Since the project is Oracle-only and the secondary engines (recon data connections created by `EngineManager`) also target Oracle, make sure those use the same thick-mode convention. **Action item:** audit `backend/app/services/engine_manager.py` (not in `files_to_read`, but inferred from `dependencies.py` to exist) and make sure any `create_engine` call it makes also passes `thick_mode=...`.

Confidence: HIGH — confirmed via SQLAlchemy 2.0 Oracle dialect docs, the Christopher Jones (Oracle) Medium article on SQLAlchemy 2.0 + python-oracledb, and the python-oracledb `initialization.rst` doc.

---

## 2. Session lifecycle — what changes (hint: almost nothing)

**The current `get_db_session()` dependency is already correct.** It is a plain generator function that wraps `session_factory()` in a `with` block, commits on success, rolls back on exception. That is the exact pattern FastAPI + SQLAlchemy 2 + sync sessions want:

```python
# backend/app/core/dependencies.py -- already in place, keep as-is
def get_db_session() -> Generator[Session, None, None]:
    with session_factory() as session:
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise

DbSessionDep = Annotated[Session, Depends(get_db_session)]
```

**Why this works under Starlette's threadpool.**

1. FastAPI runs any `def` (not `async def`) path-operation handler in Starlette's threadpool (`anyio.to_thread.run_sync`), one task per request. Each request gets a fresh thread from a bounded pool (default ≈ `cpu_count + 4`, capped at 32 for anyio).
2. Each request gets a fresh `Session` via `session_factory()`, so no two threads ever touch the same `Session` object. Sessions are **not** thread-safe, but "not thread-safe" only matters if you share one across threads — which this pattern never does.
3. The connection pool *is* thread-safe. `pool_size=10, max_overflow=5, pool_pre_ping=True` gives a pool of up to 15 checkout slots, which is the upper bound on concurrent sync DB calls in this process. For a low-concurrency internal BI app this is plenty.

**Do not use `scoped_session`.** SQLAlchemy 2 explicitly discourages `scoped_session` for new code. `scoped_session` with thread-local scoping also interacts badly with FastAPI because some of the request path runs on the event loop (not a worker thread) and the thread-local state gets confusing. The FastAPI dependency-injection pattern you already have is the recommended approach.

**Do not make `get_db_session` async.** It is a sync generator. FastAPI accepts sync dependencies for sync handlers without complaint; if you converted it to `async def` you would need `AsyncSession`, and this whole milestone is killing async.

**What about the `_connection_failure_patterns` in the error handler?** `QueryEngine._handle_connection_error` currently matches on PostgreSQL/Superset error text. Expand the regex to include Oracle error signatures — `ORA-12154` (TNS name not found), `ORA-12170` (connect timeout), `ORA-01017` (invalid username/password), `ORA-12541` (no listener), `DPY-4011` (connection was closed by peer, common in Autonomous DB idle timeouts), `DPY-6005`, `DPI-1047` (cannot locate Oracle Client — thick mode init failure). **This is a Phase 1 task, not design research, but flag it for the planner.**

Confidence: HIGH for the session pattern. MEDIUM for the specific Oracle error codes to add (verified codes exist, but the exhaustive list for this app's use cases needs to come from running against real Oracle during Phase 1).

---

## 3. JSONB on Oracle 19c — the `PortableJSON` replacement

**The hard constraint.** Oracle 19c has **no native `JSON` datatype**. That type was added in Oracle 21c and backported *later* to 19c only via patch in very recent 19.x releases (19.24+), and is not something you can rely on being available on a random 19c instance. Citi prod is pinned to a specific 19c release and the safe assumption for this project is **"19c, no native JSON type available."**

What 19c *does* have since 12.1.0.2 is a **check constraint**, `IS JSON`, that you add to a `VARCHAR2`, `CLOB`, or `BLOB` column to let the database validate and index the content as JSON. This is the correct pattern for 19c.

**The recommended storage type is `BLOB` with an `IS JSON` check constraint.** Not `CLOB`, not `VARCHAR2`:

- `VARCHAR2` is out because it is hard-capped at 4000 bytes (STANDARD mode) or 32767 bytes (EXTENDED mode). Dashboard configs (which store full layout + chart definitions) can and will exceed 4000 bytes — the existing PG test data already has configs well over that. You cannot rely on EXTENDED being set on Citi prod either.
- `CLOB` works but is slower than `BLOB` for JSON round-trips because of character-set conversion on read/write. The Oracle JSON docs and multiple community sources (Jeff Smith / AskTom / Oracle Docs) consistently recommend `BLOB IS JSON` over `CLOB IS JSON` on 19c.
- `BLOB IS JSON` stores the JSON as bytes, skips the NLS character-set pass, supports the same `JSON_VALUE` / `JSON_QUERY` / `JSON_TABLE` / `JSON_EXISTS` functions as `CLOB`, and is indexable via the JSON search index.

**The concrete replacement type.** Rewrite `backend/app/db/types.py` so the `PortableJSON` Oracle branch maps to `BLOB` with an `IS JSON` check constraint. Because this milestone kills PostgreSQL entirely, you can drop the PG branch. Rename to `OracleJSON` and keep `PortableJSON` as an alias during the transition, or just rename everywhere (the file is small and only imported from the models and migration 001/005).

**Recommended new implementation:**

```python
# backend/app/db/types.py -- rewritten for Oracle 19c only

from __future__ import annotations

import json as json_lib
from typing import Any

from sqlalchemy import BLOB, CheckConstraint, text
from sqlalchemy.engine import Dialect
from sqlalchemy.types import TypeDecorator, SchemaType


class OracleJSON(TypeDecorator, SchemaType):
    """JSON column stored as Oracle BLOB with an IS JSON check constraint.

    Oracle 19c has no native JSON datatype (that is 21c+, or patched 19.24+
    only). The recommended portable pattern is BLOB IS JSON, which is faster
    than CLOB IS JSON because it skips NLS character-set conversion on
    read/write. Application code sees plain Python dicts / lists.
    """

    impl = BLOB
    cache_ok = True

    def process_bind_param(self, value: Any | None, dialect: Dialect) -> Any:
        if value is None:
            return None
        # Oracle BLOB wants bytes; json.dumps returns str.
        return json_lib.dumps(value).encode("utf-8")

    def process_result_value(self, value: Any | None, dialect: Dialect) -> Any:
        if value is None:
            return None
        if isinstance(value, bytes):
            return json_lib.loads(value.decode("utf-8"))
        if isinstance(value, str):
            return json_lib.loads(value)
        return value

    def _set_table(self, column, table):
        """Attach an 'IS JSON' CHECK constraint when the column joins a table."""
        constraint = CheckConstraint(
            text(f'"{column.name}" IS JSON'),
            name=f"ck_{table.name}_{column.name}_is_json",
            _type_bound=True,
        )
        constraint._set_parent(table)
```

**Two things to understand about the `SchemaType` + `_set_table` trick.**

1. `TypeDecorator` alone cannot attach table-level constraints (check constraints are table-scoped). Mixing in `SchemaType` gives the type access to the `_set_table` hook, which SQLAlchemy calls when the column is attached to a `Table`. Inside `_set_table` you can create a `CheckConstraint` and set its parent to the table.
2. The `_type_bound=True` flag tells Alembic autogenerate to treat the constraint as "owned by" the type, so it won't keep churning on autogenerate runs.

**What this compiles to on Oracle 19c:**

```sql
CREATE TABLE recviz_dashboards (
    id VARCHAR2(128) NOT NULL,
    name VARCHAR2(256) NOT NULL,
    description VARCHAR2(1024),
    schema_version NUMBER(10) NOT NULL,
    config BLOB NOT NULL,
    created_at TIMESTAMP(6) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_recviz_dashboards_config_is_json CHECK ("config" IS JSON),
    PRIMARY KEY (id)
);
```

**Heads-up on autogenerate.** Alembic's Oracle dialect will not see a `BLOB IS JSON` column as meaningfully different from a plain `BLOB` during diff, so if you later add a non-JSON `BLOB` column autogenerate may get confused. Phase 1's initial migration should be hand-reviewed; do not trust autogenerate to reproduce the `IS JSON` constraint exactly without checking.

**Known limitation of `BLOB IS JSON` on 19c.** Functional indexes on specific JSON paths (`JSON_VALUE(config, '$.layout.version')`) work fine. The "JSON Search Index" (`CREATE SEARCH INDEX ... FOR JSON`) also works on `BLOB IS JSON` columns on 19c. What does **not** work on 19c is the `JSON_TRANSFORM` operator — that's 21c+. RecViz doesn't need it; noting for completeness.

Confidence: HIGH. This is the canonical pattern documented in Oracle's own JSON developer guide for 19c, cross-referenced against SQLAlchemy GitHub discussion #10374 and #9112 where the maintainer (zzzeek) and community confirmed the `TypeDecorator + SchemaType + _set_table` approach.

---

## 4. Primary keys — not a problem here

**Every `recviz_*` table uses `String(128)` UUIDs.** Confirmed by reading all six model files:

| Table | PK column | PK type |
|---|---|---|
| `recviz_dashboards` | `id` | `String(128)` |
| `recviz_data_sources` | `id` | `String(128)` |
| `recviz_datasets` | `id` | `String(128)` |
| `recviz_charts` | `id` | `String(128)` |
| `recviz_kpis` | `id` | `String(128)` |
| `recviz_connections` | `id` | `String(128)` |

**Result: no identity columns, no sequences, no triggers needed.** The application generates UUIDs in Python and inserts them explicitly. This is one of the least Oracle-hostile choices possible and means the cutover does not need to make any autoincrement decisions.

**If new integer-PK tables are added later**, use the modern `Identity` construct (Oracle 12c+):

```python
from sqlalchemy import Identity
from sqlalchemy.orm import Mapped, mapped_column

class Foo(Base):
    id: Mapped[int] = mapped_column(primary_key=True, server_default=Identity(always=False, start=1))
```

This compiles to `GENERATED BY DEFAULT AS IDENTITY` on 19c and to `SERIAL`/`GENERATED ... AS IDENTITY` elsewhere. Do **not** use `autoincrement=True` alone on Oracle without `Identity` — bare integer PKs on older SQLAlchemy + Oracle combos fell back to "no sequence, manual SQL error." SQLAlchemy 2.0 is better but the explicit `Identity()` form is unambiguous.

**Flag for the planner:** this is a "might come up" item for future phases, not Phase 1 scope. No action needed now.

Confidence: HIGH. Trivially verified by reading the model files.

---

## 5. String columns — `String(n)` compiles to `VARCHAR2(n CHAR)`

**What SQLAlchemy does on Oracle.** `String(n)` compiles to `VARCHAR2(n CHAR)` (character semantics, not bytes — note the `CHAR` keyword), which is what you want for multi-byte character sets. SQLAlchemy's Oracle dialect has done this by default since forever.

**The hard limit.** `VARCHAR2` is capped at **4000 bytes** in STANDARD mode or **32767 bytes** in EXTENDED mode. **Critically, the limit is in BYTES, not characters, even when you declare character semantics.** A `VARCHAR2(4000 CHAR)` column on a UTF-8 instance can still only hold characters that fit in 4000 bytes of storage. NCS 871 (Citi prod) is a single-byte character set for Latin-1 data — so in practice you get close to 4000 characters — but don't assume.

**Audit of the existing models against the 4000-byte limit:**

| Model | Column | Declared | OK? |
|---|---|---|---|
| `RecvizDashboard` | `id` | `String(128)` | OK |
| `RecvizDashboard` | `name` | `String(256)` | OK |
| `RecvizDashboard` | `description` | `String(1024)` | OK |
| `RecvizDataSource` | all strings | `String(≤256)` | OK |
| `RecvizDataset` | `id`, `name`, `database_id` | `String(≤256)` | OK |
| `RecvizDataset` | `sql` | `Text` | **needs attention — see below** |
| `RecvizChart` | `id`, `name`, `dataset_id`, `chart_type` | `String(≤256)` | OK |
| `RecvizChart` | `description` | `String(1024)` | OK |
| `RecvizKpi` | `id`, `name`, `dataset_id`, `metric_column` | `String(≤256)` | OK |
| `RecvizKpi` | `aggregation` | `String(32)` | OK |
| `RecvizConnection` | `id`, `name`, `display_name`, `host`, `database_name`, `username`, `schema_name` | `String(≤256)` | OK |
| `RecvizConnection` | `backend` | `String(32)` | OK |
| `RecvizConnection` | `encrypted_password` | `Text` | **needs attention — see below** |

**`Text` columns in the codebase.** There are two: `RecvizDataset.sql` and `RecvizConnection.encrypted_password`. SQLAlchemy's `Text` type on Oracle compiles to **`CLOB`**, which has no length limit and is the right answer for both columns. `sql` can legitimately be thousands of characters (parameterized SELECT with CTEs, subqueries, filter placeholders); `encrypted_password` is a Fernet-encrypted bytes-as-base64 string that's short but benefits from being a CLOB for future-proofing.

**Note: `CLOB` has `>=4000 byte` operational overhead.** Reads/writes against `CLOB` go through a different code path than `VARCHAR2`. This matters for `sql` because every query execution reads this column. In practice for an internal BI app the overhead is negligible. If it ever *does* become a problem the fix is a conditional `VARCHAR2(4000) + CLOB overflow` design, not something to worry about in Phase 1.

**Recommended default length policy:**

| Usage | Default length | Rationale |
|---|---|---|
| IDs (UUIDs) | `String(128)` | Current convention, room for prefixed IDs |
| Short enum-like (`backend`, `aggregation`, `status`) | `String(32)` | Current convention |
| Display names | `String(256)` | Current convention |
| Descriptions | `String(1024)` | Current convention |
| Host/URL-ish | `String(256)` | Current convention |
| Anything that might exceed ~3500 chars | `Text` | Safe — compiles to `CLOB` on Oracle |
| Anything that is guaranteed JSON | `OracleJSON` | See §3 |

**Codify this in a brief comment in `backend/app/db/types.py` so future devs don't guess.** No other action needed — every existing string column already fits within 4000 bytes.

Confidence: HIGH. Verified against Oracle 19c datatype limits docs, SQLAlchemy Oracle dialect source, and hand-checked every model file.

---

## 6. `alembic.ini` URL format for sync `oracledb`

**The URL format.** Drop `+asyncpg`, use `oracle+oracledb`, point at a TNS alias (not a hostname/port — Autonomous DB connections are wallet-authenticated via tnsnames.ora). Credentials go in the userinfo portion of the URL. The wallet location and `config_dir` do **not** go in the URL — they go in `thick_mode` kwargs to `create_engine`, which `env.py` controls. `alembic.ini` just holds the URL; `env.py` is where you wire up thick mode.

**Recommended `alembic.ini` line:**

```ini
# backend/app/migrations/alembic.ini
[alembic]
script_location = %(here)s
sqlalchemy.url = oracle+oracledb://RECVIZ:${RECVIZ_DB_PASSWORD}@recviz_medium
```

…where `recviz_medium` is the TNS alias you define in the Autonomous DB wallet's `tnsnames.ora` (Oracle Cloud always gives you `<dbname>_low`, `<dbname>_medium`, `<dbname>_high` out of the box — pick `_medium` for dev, which is a middle-ground concurrency/resource setting).

**Do not put the URL in `alembic.ini` at all if you can avoid it.** The cleaner pattern — and one that already matches how `env.py` works today — is to pull the URL from `settings.recviz_db_url` inside `env.py` and leave `alembic.ini`'s `sqlalchemy.url` empty. That way the URL is set in one place (`backend/.env`), and Alembic, FastAPI, and any one-off scripts all share it.

**Strongly recommended `alembic.ini`:**

```ini
[alembic]
script_location = %(here)s
# URL is set programmatically from app.config.settings in env.py.
# Leave this blank so `alembic` commands fail loudly if env.py is not wired.
sqlalchemy.url =
```

The URL loader in `env.py` already does `url = settings.recviz_db_url` and `create_engine(settings.recviz_db_url)`, so nothing else needs to change in the URL-loading path. The value in `alembic.ini` becomes purely cosmetic / placeholder.

**Password in URL — escape gotcha.** If the password contains special characters (`@`, `/`, `:`, `+`, `?`, `%`, `#`), you must `urllib.parse.quote_plus` it. Oracle Autonomous DB passwords are system-generated and often contain `#` and `$`. Two mitigations:

1. Don't put the password in the URL at all — use `connect_args={"user": ..., "password": ..., "dsn": "recviz_medium"}` and keep the URL as `oracle+oracledb://@` (empty userinfo). This is the pattern the Oracle Medium article shows.
2. Alternatively, construct the URL with `urllib.parse.quote_plus(settings.recviz_db_password)` at startup.

**Recommended: option 1.** Put the password in `settings.recviz_db_password` as a `SecretStr`, build `connect_args` in `backend/app/db/engine.py`, leave the URL as `oracle+oracledb://@recviz_medium`. No escaping, no URL mangling, credential stays a `SecretStr` until it hits the driver. This also removes one difference between the `.env` config and the engine code.

**Also note.** `oracledb` does not have a separate "async" driver dialect (unlike Postgres where `postgresql+asyncpg` and `postgresql+psycopg` are different). There is exactly one dialect — `oracle+oracledb` — and it supports both sync and async, with async being **permanently thin-mode only**. Since this project is sync-only anyway, this is a non-issue: `oracle+oracledb` is the only name you ever use.

Confidence: HIGH. Verified against SQLAlchemy 2.0 Oracle dialect docs, the Oracle OPAL blog post on SQLAlchemy + Autonomous DB, and the python-oracledb connection-handling docs.

---

## 7. `env.py` changes

**Current state (`backend/app/migrations/env.py`).** Already sync, already pulls URL from `settings.recviz_db_url`, already sets `version_table="recviz_alembic_version"` in both offline and online modes. Remarkably clean starting point. The changes are small.

**What needs to change:**

1. **Drop the hardcoded URL dependency in `alembic.ini`** (already covered in §6). `env.py` keeps pulling from `settings`.
2. **Wire up `thick_mode` in `run_migrations_online`.** `create_engine` in `env.py` today is bare — no `thick_mode` argument. Alembic cannot run against Oracle Autonomous DB without thick mode (because thin mode can't use wallet-auth config_dir the same way). Reuse the same helper that `app/db/engine.py` uses.
3. **Add `compare_type=True`** (actually already the default as of Alembic 1.12, so this is belt-and-braces). Add `compare_server_default=True` so server defaults like `func.now()` are tracked on autogenerate — useful for the initial-migration-generation step.
4. **Add `include_schemas=False`** explicitly (the default, but make it explicit since you're in an Oracle environment where a schema is a user and you do **not** want Alembic scanning `SYSTEM`, `SYS`, etc.).
5. **Set `transaction_per_migration=True`.** Oracle auto-commits DDL; see §10 for the reasoning. Setting this tells Alembic to wrap each migration file in its own transaction block so the semantic is "each migration file is one unit," even though Oracle's actual DDL is already committed by the time the `COMMIT` lands.

**Recommended rewritten `env.py`:**

```python
# backend/app/migrations/env.py
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine

from app.config import settings
from app.db.base import Base

# Import all models so they register with Base.metadata for autogenerate
from app.db.models import (  # noqa: F401
    RecvizChart,
    RecvizConnection,
    RecvizDashboard,
    RecvizDataSource,
    RecvizDataset,
    RecvizKpi,
)

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _build_thick_mode() -> dict[str, str]:
    """Build thick_mode kwargs matching app/db/engine.py."""
    thick_mode_args: dict[str, str] = {
        "config_dir": settings.oracle_config_dir,
        "driver_name": "recviz-alembic:1.0",
    }
    if settings.oracle_client_lib_dir:
        thick_mode_args["lib_dir"] = settings.oracle_client_lib_dir
    return thick_mode_args


def _build_connect_args() -> dict[str, str]:
    """Build connect_args matching app/db/engine.py."""
    return {
        "user": settings.recviz_db_user,
        "password": settings.recviz_db_password.get_secret_value(),
        "dsn": settings.recviz_db_dsn,          # TNS alias, e.g. "recviz_medium"
    }


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode -- emits SQL to stdout, no connection."""
    # Offline mode cannot use thick_mode/connect_args; it compiles against a URL
    # string only. Pass the URL from settings so we never carry a hardcoded URL.
    context.configure(
        url=settings.recviz_db_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        version_table="recviz_alembic_version",
        compare_type=True,
        compare_server_default=True,
        include_schemas=False,
        transaction_per_migration=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode with a sync thick-mode engine."""
    connectable = create_engine(
        settings.recviz_db_url,
        thick_mode=_build_thick_mode(),
        connect_args=_build_connect_args(),
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            version_table="recviz_alembic_version",
            compare_type=True,
            compare_server_default=True,
            include_schemas=False,
            transaction_per_migration=True,
        )

        with context.begin_transaction():
            context.run_migrations()

    connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

**One non-obvious issue.** Offline mode (`alembic upgrade head --sql`) cannot emit correctly for `thick_mode` because there is no connection — it compiles SQL against the dialect only. This is fine for CI dry-runs but means you cannot do an offline `--sql` dump targeting Autonomous DB unless you have a TNS alias resolvable *at generation time*. In practice for this project, offline mode is useful as a sanity-check step in Phase 1 (`alembic upgrade head --sql` to print what *would* run before running it online), but it's not load-bearing.

Confidence: HIGH for the basic structure. MEDIUM for `compare_server_default=True` — it's correct in theory but Oracle server defaults compare *can* produce false positives for `func.now()` columns because Oracle renders them as `CURRENT_TIMESTAMP` while SQLAlchemy's `func.now()` autogen-compares as the Python-side expression. If autogenerate starts churning on timestamp columns in Phase 1, flip this to `False`.

---

## 8. Initial migration strategy — decisive recommendation

**Recommendation: nuke the existing `versions/` directory and generate one clean `001_initial_oracle_schema.py` that creates every `recviz_*` table directly.**

**Why nuke not migrate.** The seven existing migrations (`001_initial_schema` → `007_dataset_database_id_to_string`) were written against PostgreSQL with `JSONB` types, `postgresql_using` cast clauses for type changes, and a legacy `superset_id` / `sync_status` churn in `002 → 006`. Re-running this history against Oracle is pointless for three reasons:

1. **The target is a fresh Oracle schema.** PROJECT.md is explicit: Oracle Cloud Autonomous 19c Free Tier, brand new, empty. Nothing to preserve. No one has `recviz_*` data on the local PostgreSQL they care about.
2. **PG-specific DDL doesn't run on Oracle.** Migration 007 uses `postgresql_using="database_id::text"`, which is a PG-only clause. Alembic ignores unknown dialect kwargs silently on the wrong backend, so this migration would *look* like it ran but actually do nothing on Oracle. Worse, the schema would be wrong and no error would fire. Not a risk worth taking.
3. **The migration history is already non-linear semantically.** `002` creates `recviz_datasets` with `superset_id` and `sync_status`; `006` drops both. Replaying that history on Oracle creates columns just to drop them. The final state after `007` is the only thing that matters, and that state can be captured in one clean migration with a dozen `create_table` calls.

**The alternative — "keep history but add an Oracle-compat migration on top"** — is the wrong choice because the PG-specific DDL in migrations 001-007 will fail or silently misbehave on Oracle before the "on top" migration even runs. You'd be forcing yourself to also rewrite 001-007 to be Oracle-compatible, which is effectively the same amount of work as nuking-and-regenerating plus more risk.

**Concrete Phase 1 task list for the migration:**

1. Delete `backend/app/migrations/versions/001_initial_schema.py` through `007_dataset_database_id_to_string.py`.
2. Rewrite `backend/app/db/types.py` per §3 (`OracleJSON` with `BLOB IS JSON`).
3. Make sure every model file imports the new type (or that `PortableJSON` stays as an alias so they keep working with no import change — simpler).
4. Make sure `backend/app/db/models/__init__.py` imports all six models so `Base.metadata` is fully populated.
5. Run `alembic revision --autogenerate -m "initial oracle schema"` against an **empty** Oracle schema.
6. **Hand-review the generated `versions/001_initial_oracle_schema.py`.** Autogenerate is not trustworthy. Specifically verify:
   - Every `recviz_*` table is created (six of them: `recviz_dashboards`, `recviz_data_sources`, `recviz_datasets`, `recviz_charts`, `recviz_kpis`, `recviz_connections`).
   - JSON columns (`config`, `columns`, `extra_params`) compile to `BLOB` with `IS JSON` check constraint.
   - PK columns are `String(128)` (compiling to `VARCHAR2(128 CHAR) NOT NULL PRIMARY KEY`).
   - `Text` columns (`sql`, `encrypted_password`) compile to `CLOB`.
   - Timestamp columns use `TIMESTAMP WITH TIME ZONE` with server defaults.
   - The `ix_recviz_charts_dataset_id` and `ix_recviz_kpis_dataset_id` indexes are present.
   - The `UniqueConstraint("name")` on `recviz_connections` is present.
7. **Manually add** `op.create_check_constraint()` calls for the `IS JSON` constraints if autogenerate didn't emit them (it may not — see §3 note about autogenerate not "seeing" the JSON constraint through the type).
8. Run `alembic upgrade head` against the empty Oracle schema.
9. Inspect the result with a SQL client (Oracle SQL Developer or `sqlplus`): confirm every table, every column type, every constraint matches the ORM.
10. Commit as a single Phase 1 "initial Oracle schema" migration.

**Pitfalls to call out to the planner:**

- **Do not run `alembic stamp head` on a non-empty database.** That is the "mark history as applied without running DDL" escape hatch. It's correct for brownfield migrations on an existing prod DB, but this milestone is targeting an empty Autonomous DB, so plain `alembic upgrade head` is what you want.
- **The `_type_bound=True` trick on check constraints may or may not survive autogenerate.** If Phase 1 regenerates the migration after tweaking `OracleJSON`, the check constraint may appear or disappear in autogen diffs. Expect to hand-correct.
- **The `recviz_alembic_version` table will be created automatically** on the first `alembic upgrade head` run against the empty schema. You do not need a `CREATE TABLE` for it in your migration.
- **Drop-all is not in scope.** Oracle `DROP TABLE ... CASCADE CONSTRAINTS` would be the sync-from-broken-state escape; the planner can use this manually during Phase 1 iteration if the schema gets wedged, but don't code it into a migration.

Confidence: HIGH for the "nuke and regenerate" recommendation. The PG-specific clauses in the existing migrations (confirmed by reading all seven files) plus the fresh-Oracle-target make this a clear call.

---

## 9. Retaining `recviz_alembic_version` table name

**Already wired up correctly.** The existing `env.py` passes `version_table="recviz_alembic_version"` to both `context.configure()` calls. The recommended rewrite in §7 keeps it. Nothing else is needed.

**One "gotcha" worth noting.** You can also set this in `alembic.ini` with `version_table = recviz_alembic_version`, but doing so creates two sources of truth (`alembic.ini` + `env.py`) and if they disagree, the `env.py` value wins. **Do not set it in `alembic.ini`.** Keep it in `env.py` only.

**Another "gotcha."** The `version_table_schema` option is for placing the version table in a specific schema (Oracle "schema" = Oracle "user"). By default it lives in the schema of the connecting user, which is `RECVIZ` on the Autonomous DB. That's the right answer — don't set `version_table_schema` unless you explicitly want the migration state to live in a shared schema separate from the app user.

Confidence: HIGH.

---

## 10. Oracle 19c gotchas (specific to this stack, not generic)

**Identifier length.** Oracle 19c with `COMPATIBLE ≥ 12.2` allows 128-byte identifiers. Oracle 19c with `COMPATIBLE < 12.2` caps at 30 bytes. **Default for Oracle Cloud Autonomous 19c is `COMPATIBLE = 19.0.0`, so you get 128 bytes.** Citi prod should be the same (19c default), but this is one of those things a prod DBA can set to something unusual, so **flag it for a Phase 1 sanity check** — run `SELECT name, value FROM v$parameter WHERE name = 'compatible';` against the Autonomous DB and again against a Citi target when available.

Current identifier audit (all well under 30, so this only matters for the `ck_recviz_*_is_json` check constraint names the new `OracleJSON` type generates):

| Identifier | Bytes | 30-byte OK? |
|---|---|---|
| `ix_recviz_charts_dataset_id` | 27 | Yes |
| `ix_recviz_kpis_dataset_id` | 25 | Yes |
| `ck_recviz_dashboards_config_is_json` | 35 | **No — would fail under `COMPATIBLE < 12.2`** |
| `ck_recviz_data_sources_config_is_json` | 37 | **No — would fail under `COMPATIBLE < 12.2`** |
| `ck_recviz_connections_extra_params_is_json` | 42 | **No — would fail under `COMPATIBLE < 12.2`** |

**Mitigation:** use shorter constraint names. The `_set_table` method in `OracleJSON` can generate `ck_{column.name}_json` (dropping the table prefix) or use a hash. For 128-byte-identifier environments this is a non-issue; for 30-byte environments it would fail at DDL time.

**Recommendation: keep long names, verify `COMPATIBLE ≥ 12.2` on target environments in Phase 1.** If Citi prod turns out to be `COMPATIBLE = 11.2` (unlikely but possible), shorten the constraint naming template to `ck_{column_name}_json` (max 18 bytes for our longest column name `encrypted_password` — wait, `extra_params` is `ck_extra_params_json` = 20 bytes — fine).

**Reserved keywords.** Oracle reserved words that would collide with existing column names: checked all six models — **none of the column names match Oracle 19c reserved words.** The closest risks would be if someone later adds columns named `user`, `number`, `date`, `comment`, `level`, `size`, `type`, `mode`, `group`, `order`, `start`. Watch for these in future model additions. SQLAlchemy's Oracle dialect will auto-quote reserved words with double quotes when generating DDL, which works but creates case-sensitive identifiers that are ugly to query directly. Better to just not use reserved words as column names.

**Case sensitivity of identifiers.** Unquoted identifiers in Oracle are **folded to uppercase**. So `CREATE TABLE recviz_dashboards` creates a table whose actual stored name is `RECVIZ_DASHBOARDS`. Queries like `SELECT * FROM recviz_dashboards` then work (because the parser also uppercases). Quoted identifiers (`"recviz_dashboards"`) are case-sensitive and stay lowercase. **SQLAlchemy's Oracle dialect by default emits unquoted identifiers for names matching the all-lowercase convention, and then in `SELECT` compiles them back as lowercase — which Oracle uppercases. This works and is standard.** You should not see this manifest as a problem; noting for awareness when querying the schema via `sqlplus` (you'll see the table names in uppercase in `USER_TABLES`).

**DDL transaction semantics — Oracle auto-commits DDL.** This is the subtlest pitfall. In PostgreSQL, `CREATE TABLE` inside a transaction is rolled back if the transaction fails. In Oracle, `CREATE TABLE` issues an **implicit commit** immediately before and after it runs. This means:

1. If Alembic runs `create_table(A); create_table(B);` and `create_table(B)` fails, `create_table(A)` is **already committed** and will not roll back. You get a half-applied migration.
2. Alembic's `transaction_per_migration=True` flag (recommended in §7) wraps each migration *file* in a transaction, but Oracle ignores the transaction for DDL. So the flag is ceremonial on Oracle — it doesn't actually give you per-migration atomicity.
3. Alembic also bumps the `recviz_alembic_version` row in a `COMMIT` at the end of each migration, and that single INSERT/UPDATE is transactional. But the schema changes that preceded it are already committed by Oracle.

**Mitigation:** for the initial migration in Phase 1, the only thing you can do is make sure all `create_table` calls are in a sensible order (no FK dependencies between them since the models don't have FKs — verified by reading the files, no `ForeignKey` anywhere). If a `create_table` fails midway, you'll need to manually `DROP TABLE ... CASCADE CONSTRAINTS` the partially-created tables and re-run. **Document this manual-recovery step in the Phase 1 runbook.**

**NLS character set note.** Citi prod is NCS 871. Oracle Cloud Autonomous DB defaults to `AL32UTF8` (character set) + `AL16UTF16` (national character set). **These are different character sets, but thick-mode oracledb handles the conversion transparently.** Your Python strings are always Unicode; the driver decodes from whatever NLS_CHARACTERSET the server uses. This works **only in thick mode** — thin mode has the NCS 871 gap that this entire milestone is motivated by. As long as thick mode is enabled (confirmed via §1), character-set drift between local dev (AL32UTF8) and prod (NCS 871 + WE8ISO8859P1 or similar) is handled by the driver. This is why local-prod parity on *driver mode* matters more than parity on NLS character set.

**`TIMESTAMP WITH TIME ZONE` + `func.now()` server default.** Oracle's DDL for `DateTime(timezone=True)` + `server_default=func.now()` compiles to `TIMESTAMP(6) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`. This works on 19c. Caveat: `CURRENT_TIMESTAMP` in Oracle returns session-time-zone-adjusted; `SYSTIMESTAMP` returns database-server TZ. SQLAlchemy's `func.now()` compiles to `CURRENT_TIMESTAMP`. For a dev laptop in US Eastern connecting to an Autonomous DB on UTC, rows will have `created_at` in the session's TZ, not database TZ. Not a bug, but **document it** — rows created from a non-UTC session will show in that session's offset when read back.

**`onupdate=func.now()` — Oracle does not support `ON UPDATE CURRENT_TIMESTAMP`.** This is a MySQL/PostgreSQL feature. SQLAlchemy's `onupdate=func.now()` is a Python-side trigger — SQLAlchemy sets the column value to `CURRENT_TIMESTAMP` in the UPDATE statement, not as a column-level trigger in the DDL. **This works fine on Oracle**, because the update happens inside SQLAlchemy's statement compiler, not as DDL. No action needed; just be aware that your DDL won't have anything `ON UPDATE`-related.

**`Integer` columns compile to `NUMBER(10)`.** Oracle doesn't have a native 32-bit integer type — `Integer` in SQLAlchemy compiles to `NUMBER(10)` on Oracle, which holds any value that would fit in a 32-bit int. Multi-gigabyte row counts are not possible anyway for this app (`schema_version` goes up by 1, `port` is 1-65535), so `NUMBER(10)` is fine for every existing `Integer` column.

**Primary-key constraint naming.** Alembic autogenerate may emit `op.create_table(..., sa.PrimaryKeyConstraint("id", name="pk_recviz_dashboards"))`. Oracle will create a system-named constraint (`SYS_C00123456`) if you don't name it. Best practice is to let Alembic emit explicit names for the initial migration for cleaner inspection later. You can either configure SQLAlchemy's `MetaData` with `naming_convention={"pk": "pk_%(table_name)s", ...}` (belongs in `backend/app/db/base.py`) or accept system names. **Recommendation: add a `naming_convention` to `Base`'s `MetaData`.** One-time change, improves DDL readability for the lifetime of the project:

```python
# backend/app/db/base.py
from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
```

This is a low-risk, high-value change to ship as part of Phase 1 before running autogenerate. It interacts cleanly with the `OracleJSON._set_table` constraint creation — the naming convention will kick in for the check constraint too, giving you a `ck_recviz_dashboards_config_is_json`-style name automatically.

Confidence: HIGH for everything in this section. These are all in the SQLAlchemy / Oracle docs and have been hit by this project's author in past projects.

---

## Summary of Phase 1 design decisions the planner needs to make explicit

This section exists so the Phase 1 planner can bundle these into the UI-SPEC / DISCUSS gate without re-researching:

| # | Decision | Recommended | Alternatives | Risk if wrong |
|---|---|---|---|---|
| 1 | Thick-mode API surface | `thick_mode` dict to `create_engine`, never call `init_oracle_client()` yourself | bare `thick_mode=True` | Cannot override `lib_dir`/`config_dir`; macOS dev will break |
| 2 | `lib_dir` handling | Conditional — set locally on macOS, omit on Linux prod | Always set | Linux prod will fail `DPI-1047` |
| 3 | Session lifecycle | Keep current `get_db_session` generator pattern | `scoped_session` | Thread-local confusion under FastAPI |
| 4 | JSON storage | `BLOB` with `IS JSON` check constraint | `CLOB IS JSON`, `VARCHAR2(4000) IS JSON` | Slower reads, or hitting 4000-byte limit on large configs |
| 5 | JSON type implementation | `TypeDecorator + SchemaType` with `_set_table` to attach `CheckConstraint` | Simple `TypeDecorator` with manual constraints in migrations | Hand-maintenance of constraints per migration |
| 6 | Integer PKs | N/A — project has none; note `Identity()` for future | `Sequence` | Future churn if not documented |
| 7 | String default length policy | Current model lengths are all fine; codify in comment | Migrate to shorter defaults | No real risk — already fits |
| 8 | `Text` columns | Keep as `Text` (compiles to `CLOB`) for `sql` and `encrypted_password` | `String(4000)` | `String(4000)` is risky — full 4000 bytes not always available |
| 9 | `alembic.ini` URL | Leave blank, load from `settings` in `env.py` | Hardcode URL | Two sources of truth, escape hell |
| 10 | Password in URL | Pass via `connect_args`, never in URL | URL-encode | Special-char breakage |
| 11 | `env.py` thick-mode | Wire up `thick_mode` dict + `connect_args` in online mode | Bare `create_engine` | Alembic can't connect to Autonomous DB |
| 12 | Autogen flags | `compare_type=True`, `compare_server_default=True`, `transaction_per_migration=True`, `include_schemas=False` | Defaults | Churn or missed changes |
| 13 | Initial migration | Delete `versions/*`, one clean autogen + hand review | Keep history | PG-specific DDL breaks on Oracle |
| 14 | `version_table` | Keep `recviz_alembic_version`, env.py only | alembic.ini too | Two sources, conflict risk |
| 15 | Metadata naming convention | Add explicit `MetaData(naming_convention=...)` to `Base` | Accept Oracle system names | Ugly system-generated constraint names |
| 16 | DDL transaction semantics | Document manual recovery (drop partial tables + re-run) | Pretend Alembic rollback works | Half-applied migration with no clear recovery |

**Design decisions that need user confirmation in Phase 1 DISCUSS:**

- **(A)** New `Settings` fields: `oracle_client_lib_dir: str | None`, `oracle_config_dir: str`, `recviz_db_user: str`, `recviz_db_password: SecretStr`, `recviz_db_dsn: str`. Adding these to `backend/app/config.py` and updating `.env.example`. Should the password stay `SecretStr` or become a plain `str` for simplicity?
- **(B)** Whether to rename `PortableJSON` to `OracleJSON` (cleaner) or keep the name (fewer import changes). Recommendation: rename to `OracleJSON`, alias `PortableJSON = OracleJSON` for one migration of grace, delete in the final cleanup phase. But this is a taste call.
- **(C)** Whether to delete the old migrations (`versions/001_initial_schema.py` … `007_dataset_database_id_to_string.py`) in the same commit as the new `001_initial_oracle_schema.py`, or keep them around for reference in a `versions/archive/` folder. Recommendation: delete outright. They're in git history if anyone needs them. But keeping an archive folder is defensible.
- **(D)** Whether `backend/app/db/engine.py` should build a second pattern for "secondary" engines used by `EngineManager` when connecting to user-defined data sources (Citi recon data). Those engines also need thick mode. Recommendation: extract a `build_oracle_engine(url, connect_args)` helper in `engine.py` and reuse from `EngineManager`. This is adjacent to Phase 1 scope — call it out and let the planner decide whether it lands in Phase 1 or gets deferred.

---

## Concrete file-level change list for Phase 1 (the "paste-this-into-the-plan" checklist)

**Files that change:**

| File | Change type | What changes |
|---|---|---|
| `backend/requirements.txt` | Modify | Remove `psycopg2-binary`, `asyncpg`, remove `[asyncio]` extra from `sqlalchemy` (pin stays at `2.0.49` or bump to latest 2.0.x). Remove `redis` line if present (already not used). |
| `backend/app/config.py` | Modify | Drop `recon_db_url` default (it references Postgres). Replace `recviz_db_url` default with `oracle+oracledb://@recviz_medium`. Add `oracle_client_lib_dir: str \| None = None`, `oracle_config_dir: str`, `recviz_db_user: str`, `recviz_db_password: SecretStr`, `recviz_db_dsn: str`. |
| `backend/app/db/engine.py` | Modify | Build `thick_mode` dict and `connect_args` per §1. Keep `sessionmaker` + `Session` class. |
| `backend/app/db/base.py` | Modify | Add `MetaData(naming_convention=...)` to `Base` per §10. |
| `backend/app/db/types.py` | Rewrite | Replace `PortableJSON` with `OracleJSON` using `BLOB` + `_set_table` check constraint per §3. Drop `JSONB` import and PG branch. |
| `backend/app/core/dependencies.py` | No change | `get_db_session` generator is already correct. |
| `backend/app/api/views.py` | Modify | Flip three `async def` handlers to `def`. Zero-behavior change (they touch an in-memory dict only). |
| `backend/app/migrations/alembic.ini` | Modify | Clear `sqlalchemy.url =` to empty. |
| `backend/app/migrations/env.py` | Modify | Add `thick_mode` + `connect_args` in online mode. Add `compare_type`, `compare_server_default`, `include_schemas`, `transaction_per_migration` flags. See §7 for full rewrite. |
| `backend/app/migrations/versions/001_initial_schema.py` | **Delete** | PG-specific, superseded by new initial migration. |
| `backend/app/migrations/versions/002_add_datasets.py` | **Delete** | PG-specific, superseded. |
| `backend/app/migrations/versions/003_add_charts.py` | **Delete** | PG-specific, superseded. |
| `backend/app/migrations/versions/004_add_kpis.py` | **Delete** | PG-specific, superseded. |
| `backend/app/migrations/versions/005_add_connections_portable_json.py` | **Delete** | PG-specific, superseded. |
| `backend/app/migrations/versions/006_remove_dataset_superset_fields.py` | **Delete** | Churn-only migration, superseded. |
| `backend/app/migrations/versions/007_dataset_database_id_to_string.py` | **Delete** | Uses `postgresql_using` clause, superseded. |
| `backend/app/migrations/versions/001_initial_oracle_schema.py` | **Create** | New, autogenerated + hand-reviewed, creates all 6 `recviz_*` tables against empty Oracle schema. |
| `backend/app/services/engine_manager.py` *(not in files_to_read; confirm existence)* | Modify | Apply same `thick_mode` pattern to any `create_engine` it calls for user data sources. |
| `backend/.env.example` *(create if missing)* | Create/Modify | Document all new Oracle-related env vars. |
| `.env` *(user-managed, local)* | Modify | Wire up Oracle Cloud Autonomous DB wallet + credentials. |

**Files that the research recommends not touching in Phase 1:**

- `backend/app/db/models/*.py` — the models themselves are fine as-is. They already use `PortableJSON` (which becomes `OracleJSON` via alias or rename), already use `String(128)` PKs, already use `Text` correctly. **No model file should need a content change for the Oracle cutover** unless the rename-vs-alias decision goes the "rename" way and you have to update imports.
- `backend/app/core/dependencies.py` — already sync, already has the right generator-based dependency pattern.

**Verification steps at the end of Phase 1** (what the planner should build into the phase's VERIFY gate):

1. `backend/requirements.txt` has no `asyncpg`, no `psycopg2-binary`, no `sqlalchemy[asyncio]`.
2. `grep -rn "async def" backend/app/api/` returns zero results (or only lifespan/middleware, which is fine).
3. `grep -rn "postgresql" backend/` returns only comments and seed files.
4. `grep -rn "JSONB" backend/app/db/` returns zero results.
5. `alembic upgrade head` succeeds against a fresh Oracle Cloud Autonomous 19c schema.
6. `alembic current` shows `001_initial_oracle_schema (head)`.
7. Hand-verify via `sqlplus` or SQL Developer: every `recviz_*` table exists with the expected columns and check constraints.
8. Start `uvicorn`, hit `GET /health`, see `200 OK` and a live sync engine.
9. Create a dashboard via `POST /api/dashboards` with a non-trivial config (≥ 5 KB JSON) and confirm it round-trips correctly through the `BLOB IS JSON` column.

---

## Sources (ranked by confidence contribution)

- **SQLAlchemy 2.0 Oracle dialect docs** — https://docs.sqlalchemy.org/en/20/dialects/oracle.html — primary source for `oracle+oracledb` URL format, `thick_mode` kwarg, Identity column handling.
- **python-oracledb initialization docs** — https://python-oracledb.readthedocs.io/en/latest/user_guide/initialization.html — `init_oracle_client()` signature, `lib_dir` platform notes, thick-mode constraints.
- **python-oracledb connection_handling** — https://python-oracledb.readthedocs.io/en/latest/user_guide/connection_handling.html — wallet / Autonomous DB / tnsnames patterns.
- **Christopher Jones (Oracle) — "Using SQLAlchemy 2.0 with python-oracledb"** — https://medium.com/oracledevs/using-the-development-branch-of-sqlalchemy-2-0-with-python-oracledb-d6e89090899c — verbatim code examples for thick mode + wallet + create_engine.
- **SQLAlchemy GitHub Discussion #10374** — https://github.com/sqlalchemy/sqlalchemy/discussions/10374 — JSON on Oracle, BLOB + CheckConstraint pattern, maintainer guidance.
- **SQLAlchemy GitHub Discussion #9112** — https://github.com/sqlalchemy/sqlalchemy/discussions/9112 — full `OracleJSON` TypeDecorator + `_set_table` pattern verbatim.
- **Oracle 19c database object names docs** — https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Database-Object-Names-and-Qualifiers.html — identifier length + `COMPATIBLE` parameter.
- **Oracle 19c SQL reserved words** — https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Oracle-SQL-Reserved-Words.html — for the keyword-collision audit.
- **Alembic 1.18 runtime docs** — https://alembic.sqlalchemy.org/en/latest/api/runtime.html — `configure()` parameters, `version_table`, `transaction_per_migration`, `compare_type`.
- **Alembic autogenerate docs** — https://alembic.sqlalchemy.org/en/latest/autogenerate.html — brownfield strategy, autogenerate limitations.
- **Oracle SQL/JSON conditions docs** — https://docs.oracle.com/en/database/oracle/oracle-database/19/adjsn/conditions-is-json-and-is-not-json.html — `IS JSON` constraint syntax on 19c.
- **Oracle 19c MAX_STRING_SIZE docs** — https://docs.oracle.com/en/database/oracle/oracle-database/26/refrn/MAX_STRING_SIZE.html — VARCHAR2 length limits + EXTENDED mode.
- **ORACLE-BASE — JSON data type in 21c** — https://oracle-base.com/articles/21c/json-data-type-21c — confirmation that native JSON type is 21c+, not 19c.
- **FastAPI async docs** — https://fastapi.tiangolo.com/async/ — sync handlers run in threadpool, no extra work needed for sync DB.
- **SQLAlchemy GitHub Issue #4857** — https://github.com/sqlalchemy/sqlalchemy/issues/4857 — 128-character identifier support on `COMPATIBLE ≥ 12.2`.

---

## Confidence assessment

| Topic | Confidence | Notes |
|---|---|---|
| Thick mode API surface (Q1) | HIGH | Multiple verified sources, including Oracle's own SQLAlchemy guide |
| Session lifecycle (Q2) | HIGH | Current code already correct; guidance verified against FastAPI docs |
| JSON column type (Q3) | HIGH | Canonical Oracle 19c pattern confirmed via SQLAlchemy GitHub + Oracle docs |
| Primary keys (Q4) | HIGH | Trivially verified by reading six model files — no integer PKs exist |
| String column lengths (Q5) | HIGH | Every column hand-audited against Oracle 19c limits |
| Alembic URL format (Q6) | HIGH | Verified against SQLAlchemy 2.0 Oracle dialect docs and Oracle blog |
| `env.py` changes (Q7) | HIGH for structure; MEDIUM for `compare_server_default` (may cause autogen churn in Phase 1) |
| Initial migration strategy (Q8) | HIGH | PG-specific clauses in existing migrations definitively break on Oracle |
| `version_table` retention (Q9) | HIGH | Already correctly wired in existing env.py |
| 19c gotchas (Q10) | HIGH | All documented in Oracle 19c reference docs |

**Overall confidence: HIGH.** The research pointed at concrete, decisive answers for every question. The two items flagged MEDIUM are minor implementation details that will shake out during the first Phase 1 autogen run and are easy to adjust.
