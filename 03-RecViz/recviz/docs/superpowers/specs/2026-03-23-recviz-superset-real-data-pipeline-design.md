# RecViz — Real Data Pipeline via Superset

**Goal:** Replace the mock data fallback with a real database pipeline routed through Apache Superset as a headless SQL execution engine. The system must work locally with a SQLite seed database and in production with ~35 Oracle databases — with only a single config file change between environments.

**Architecture:**

```
Frontend → FastAPI → QueryEngine → SupersetClient → Superset SQL Lab API → Database (SQLite local / Oracle prod)
                                  ↑
                      DatabaseRegistrar (syncs databases.json → Superset)
```

**Key constraint:** Superset is a hard dependency. If Superset is down, the API returns errors. No mock fallback.

---

## 1. Config Layer Restructure

### Current State

Dashboard and data source configs live in `backend/app/mock/`. The naming is misleading — these are the real config format, not temporary mocks.

### Change

Rename `mock/` → `config/`. Add database registry and seed layers.

```
backend/app/config/
├── dashboards/
│   └── tlm-stats.json              ← Dashboard config (unchanged)
├── data_sources/
│   ├── tlm_breaks.json             ← Data source config (unchanged)
│   ├── tlm_automatch.json
│   ├── reconmgmt_manual.json
│   └── reconmgmt_recon_bank.json
├── databases.json                  ← NEW: logical name → SQLAlchemy URI mapping
└── seed/
    └── seed.db                     ← NEW: generated SQLite seed DB (gitignored)
```

### databases.json Structure

This is the **only file that changes per environment**.

```json
{
  "databases": [
    {
      "name": "superset_db_TCOSPRD",
      "display_name": "TLM Consumer (TCOSPRD)",
      "sqlalchemy_uri": "sqlite:////absolute/path/to/seed.db",
      "dialect": "sqlite",
      "type": "tlm"
    },
    {
      "name": "superset_db_TFINPRD",
      "display_name": "TLM Finance (TFINPRD)",
      "sqlalchemy_uri": "sqlite:////absolute/path/to/seed.db",
      "dialect": "sqlite",
      "type": "tlm"
    },
    {
      "name": "superset_db_TWMPRD",
      "display_name": "TLM Wealth (TWMPRD)",
      "sqlalchemy_uri": "sqlite:////absolute/path/to/seed.db",
      "dialect": "sqlite",
      "type": "tlm"
    },
    {
      "name": "superset_db_reconmgmt",
      "display_name": "ReconMgmt",
      "sqlalchemy_uri": "sqlite:////absolute/path/to/seed.db",
      "dialect": "sqlite",
      "schema": "",
      "type": "reconmgmt"
    }
  ]
}
```

For production deployment, swap to Oracle:

```json
{
  "name": "superset_db_TCOSPRD",
  "display_name": "TLM Consumer (TCOSPRD)",
  "sqlalchemy_uri": "oracle+oracledb://user:pass@host:1521/?service_name=TCOSPRD",
  "dialect": "oracle",
  "type": "tlm"
}
```

### Field Definitions

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Logical name referenced by data source configs in `database_routing.mapping` and `database_routing.database` |
| `display_name` | Yes | Human-readable name shown in Superset |
| `sqlalchemy_uri` | Yes | SQLAlchemy connection string |
| `dialect` | No | SQL dialect for template adaptation. Defaults to `"oracle"`. Options: `"oracle"`, `"sqlite"`, `"postgresql"` |
| `schema` | No | Default schema prefix. For Oracle: `"reconmgmt"`. For SQLite: omit or `""` |
| `type` | No | Grouping label for admin purposes (`"tlm"`, `"reconmgmt"`, `"risk"`, etc.) |

### ConfigStore Update

`ConfigStore.__init__()` updated to load from `backend/app/config/` instead of `backend/app/mock/`. Same loading logic — reads JSON files from `dashboards/` and `data_sources/` directories.

---

## 2. Database Registrar

A new service that syncs `databases.json` into Superset at FastAPI startup and provides name → numeric ID resolution.

### File: `backend/app/services/database_registrar.py`

### Responsibilities

1. **Sync**: Read `databases.json`, ensure each database is registered in Superset
2. **Cache**: Maintain an in-memory `dict[str, DatabaseEntry]` mapping logical name → full config (including Superset numeric ID)
3. **Resolve**: Provide `resolve(name: str) -> int` for QueryEngine (returns Superset numeric ID)
4. **Accessors**: Provide `get_dialect(name: str) -> str` and `get_schema(name: str) -> str` for QueryEngine SQL building

### Sync Logic

```
for each entry in databases.json:
    existing = find in Superset by database_name match
    if exists:
        cache[name] = existing entry (with superset_id = existing.id)
    else:
        result = SupersetClient.create_database(...)
        cache[name] = entry (with superset_id = result.id)
```

**Important:** Sync only creates missing databases — it does **not** update existing ones by comparing URIs. Superset masks/redacts passwords in returned `sqlalchemy_uri` values (e.g., `oracle+oracledb://user:XXXXXXXXX@host...`), so a naive string comparison would always detect a "change" and trigger unnecessary updates on every startup for all 35+ databases. If a connection string needs updating, do it via Superset's admin UI or a dedicated management command — not on every FastAPI restart.

### Resolve Logic

```python
async def resolve(self, name: str) -> int:
    if name in self._cache:
        entry = self._cache[name]
        if entry.superset_id is not None:
            return entry.superset_id
    if name in self._negative_cache:
        raise ValueError(f"Database '{name}' not registered in Superset")
    # Cache miss — refresh with async lock + cooldown to prevent concurrent storms
    async with self._refresh_lock:
        # Double-check after acquiring lock (another coroutine may have refreshed)
        if name in self._cache and self._cache[name].superset_id is not None:
            return self._cache[name].superset_id
        # Rate limit: max one refresh per 30 seconds
        if (time.time() - self._last_refresh) > 30:
            await self._refresh_cache()
    if name in self._cache and self._cache[name].superset_id is not None:
        return self._cache[name].superset_id
    # Cache negative result to prevent repeated lookups
    self._negative_cache.add(name)
    raise ValueError(f"Database '{name}' not registered in Superset")
```

Concurrency protection:
- `_refresh_lock` is an `asyncio.Lock` — ensures only one coroutine refreshes at a time
- `_last_refresh` timestamp + 30-second cooldown — prevents repeated API calls
- `_negative_cache` is a `set[str]` — cleared on each successful `sync()` or `_refresh_cache()`

### Database Config Model

```python
from pydantic import BaseModel, ConfigDict, Field

class DatabaseEntry(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str
    display_name: str
    sqlalchemy_uri: str
    dialect: str = "oracle"
    schema_name: str = Field(default="", alias="schema")  # JSON uses "schema", Pydantic uses schema_name
    type: str = ""
    superset_id: int | None = None  # populated after sync with Superset

class DatabasesConfig(BaseModel):
    databases: list[DatabaseEntry]
```

The `superset_id` field is populated at runtime during sync — not stored in JSON.

### Superset API Interaction

Uses existing `SupersetClient` methods:
- `list_databases()` — get all registered databases
- `create_database(payload)` — register a new database
- `update_database(db_id, payload)` — update connection string

The payload for create/update:
```python
{
    "database_name": entry.name,
    "sqlalchemy_uri": entry.sqlalchemy_uri,
    "expose_in_sqllab": True,
    "allow_run_async": False,
    "allow_ctas": False,
    "allow_cvas": False,
}
```

---

## 3. QueryEngine Changes

### Remove Mock Path

- Delete `_execute_mock()` method
- Delete `from app.mock.query_results import ...`
- `execute()` always calls `_execute_via_superset()`
- Constructor: `superset_client` is required (not `Any | None`)

**Note:** The current `_execute_via_superset()` has a latent type bug — it passes the string name from `_resolve_database()` directly as `database_id` to `execute_sql()`, which expects `int`. This never surfaced because the mock path was always used. The DatabaseRegistrar resolves this by providing the string → int mapping.

### Add DatabaseRegistrar Dependency

Constructor gains `database_registrar: DatabaseRegistrar` parameter.

### Updated `_execute_via_superset()`

```python
async def _execute_via_superset(self, data_source_id, filters, max_rows):
    db_name = self._resolve_database(data_source_id, filters)  # returns string
    db_id = self._database_registrar.resolve(db_name)           # string → int
    dialect = self._database_registrar.get_dialect(db_name)      # get dialect for SQL building
    schema = self._database_registrar.get_schema(db_name)        # get schema for SQL + Superset
    sql = self._build_sql(data_source_id, filters, dialect=dialect, db_name=db_name)
    result = await self._superset.execute_sql(
        database_id=db_id,
        sql=sql,
        schema=schema or "",   # pass correct schema to Superset (not hardcoded "public")
        limit=max_rows,        # forward max_rows to Superset's row limit
    )
    # ... process result
```

**SupersetClient change:** Update `execute_sql()` to not hardcode `schema: str = "public"`. The caller always passes the schema explicitly. This makes `superset_client.py` a modified file.

### Dialect-Aware SQL Building

`_build_sql()` already accepts a `dialect` parameter. Changes:

1. `_build_date_range_clause()` — add `sqlite` dialect:
   ```python
   if dialect == "sqlite":
       return f"BETWEEN date('now', '-{value} days') AND date('now')"
   ```

2. Schema prefix handling — add to `_build_sql()`:
   ```python
   schema = self._database_registrar.get_schema(db_name)
   if schema:
       # Schema is configured — SQL uses schema-qualified names as-is (Oracle)
       pass
   else:
       # No schema (SQLite/dev) — strip only known schema prefixes from SQL
       # Must NOT strip table aliases like "b.agent_code" or "mf.bran_code"
       # Strategy: strip prefixes that match known schema names from all data source configs
       for known_schema in self._database_registrar.get_all_schemas():
           if known_schema:
               sql = re.sub(rf'\b{re.escape(known_schema)}\.', '', sql)
   ```

   This handles `reconmgmt.mr_csum_man_match_stats_hist` → `mr_csum_man_match_stats_hist` for SQLite, while leaving table aliases like `b.agent_code` and `mf.bran_code` untouched.

   **Important:** The regex targets specific schema names (e.g., `reconmgmt\.`), not a generic `word.` pattern. A generic regex like `\b\w+\.(?=\w+)` would destroy table aliases in JOIN queries.

### execute_distinct Update

Same pattern — resolve name → ID, use dialect, execute via Superset. Currently this method uses mock data; it will be updated to execute `SELECT DISTINCT {{column}} FROM ...` via Superset.

---

## 4. Superset Local Setup

### Goal

Run Superset natively from the existing venv (`recviz/.venv`) with minimal infrastructure — SQLite for metadata, in-memory cache, no Redis, no Docker.

### Existing State

- Superset 6.0.0 installed in `recviz/.venv`
- `psycopg2-binary` available (PostgreSQL driver)
- `oracledb` not yet installed (needed for Oracle connections in prod)

### New File: `superset/superset_config_local.py`

```python
import os

SECRET_KEY = "recviz-local-dev-key"

# SQLite for metadata — persists across restarts
SQLALCHEMY_DATABASE_URI = "sqlite:///" + os.path.expanduser("~/.superset/superset_local.db")

# In-memory cache — no Redis needed
CACHE_CONFIG = {"CACHE_TYPE": "SimpleCache", "CACHE_DEFAULT_TIMEOUT": 300}
DATA_CACHE_CONFIG = {"CACHE_TYPE": "SimpleCache", "CACHE_DEFAULT_TIMEOUT": 600}
FILTER_STATE_CACHE_CONFIG = {"CACHE_TYPE": "SimpleCache", "CACHE_DEFAULT_TIMEOUT": 600}

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

### New File: `scripts/setup-superset-local.sh`

```bash
#!/bin/bash
set -e

VENV_DIR="$(dirname "$0")/../.venv"
export SUPERSET_CONFIG_PATH="$(dirname "$0")/../superset/superset_config_local.py"

# Ensure venv is active
source "$VENV_DIR/bin/activate"

# Install Oracle driver (needed for prod, harmless for local)
pip install oracledb

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
echo "  SUPERSET_CONFIG_PATH=$SUPERSET_CONFIG_PATH superset run -p 8088"
echo ""
echo "IMPORTANT: Generate the seed database BEFORE starting FastAPI:"
echo "  python scripts/generate-seed-db.py"
```

### Running Superset Locally

One-time setup:
```bash
./scripts/setup-superset-local.sh
```

Start Superset:
```bash
SUPERSET_CONFIG_PATH=superset/superset_config_local.py .venv/bin/superset run -p 8088
```

---

## 5. SQLite Seed Database

### Goal

A SQLite database with 1M+ rows of realistic data matching the Oracle schema, so the dashboard demonstrates real query performance.

### Tables

**TLM tables** (used by `tlm_breaks` and `tlm_automatch` data sources):

| Table | Rows | Key Columns |
|-------|------|-------------|
| `bank` | ~5,000 | agent_code, corr_acc_no, local_acc_no |
| `message_feed` | ~10,000 | corr_acc_no, bran_code |
| `item` | ~1,000,000 | corr_acc_no, stmt_date, flag_2 |
| `tlm_bdr_relationship_header` | ~800,000 | corr_acc_no, last_action_owner |

**ReconMgmt tables** (used by `reconmgmt_manual` and `reconmgmt_recon_bank` data sources):

| Table | Rows | Key Columns |
|-------|------|-------------|
| `recon_bank` | ~200 | recon_engine, recon_engine_env, agent_code, local_acc_no |
| `mr_csum_man_match_stats_hist` | ~50,000 | agent_code, setid, stmt_date, bran_code, corr_acc_no, total_items, automatch_items, total_manual_match_count, tlm_instance |

### Data Distribution

| Dimension | Values | Count |
|-----------|--------|-------|
| Agents | AGENT_01 through AGENT_20 | 20 |
| Set IDs | SET_001 through SET_050 | 50 |
| Branches | BR001 through BR020 | 20 |
| TLM Instances | TLMP_CONSUMER, TLMP_FINANCE, TLMP_WEALTH | 3 |
| Corr Accounts | CA0001 through CA0050 | 50 |
| Date Range | 90 days back from generation date | 90 |
| flag_2 values | 0 (break), 1 (matched), 11 (pending) | 3 |
| last_action_owner | SYSTEM, AUTONET, MANUAL_USER_* | ~5 |

### Generation Script: `scripts/generate-seed-db.py`

- Uses Python `sqlite3` module with batch inserts (`executemany` with 10K row batches)
- Deterministic seed (`random.seed(42)`) for reproducible data
- Creates indexes on JOIN columns for query performance
- Output: `backend/app/config/seed/seed.db` (gitignored, ~200-300MB)
- Runtime: ~30-60 seconds for 1M+ rows

### Indexes

```sql
CREATE INDEX idx_bank_corr ON bank(corr_acc_no);
CREATE INDEX idx_bank_agent ON bank(agent_code);
CREATE INDEX idx_mf_corr ON message_feed(corr_acc_no);
CREATE INDEX idx_item_corr ON item(corr_acc_no);
CREATE INDEX idx_item_stmt_date ON item(stmt_date);
CREATE INDEX idx_item_flag2 ON item(flag_2);
CREATE INDEX idx_th_corr ON tlm_bdr_relationship_header(corr_acc_no);
CREATE INDEX idx_rb_engine ON recon_bank(recon_engine, recon_engine_env);
CREATE INDEX idx_mrh_agent ON mr_csum_man_match_stats_hist(agent_code);
CREATE INDEX idx_mrh_tlm ON mr_csum_man_match_stats_hist(tlm_instance);
```

---

## 6. SQL Template Compatibility

### Problem

Data source SQL templates are written for Oracle. The local dev environment uses SQLite. Key incompatibilities must be handled at runtime without modifying the templates.

### Dialect-Driven Adaptation

The `dialect` field in `databases.json` drives SQL adaptation in `QueryEngine._build_sql()`. Two specific adaptations:

### 6a. Date Range Clauses

`_build_date_range_clause()` already handles `oracle` and `postgresql`. Add `sqlite`:

| Dialect | Expression |
|---------|-----------|
| `oracle` | `BETWEEN TRUNC(SYSDATE) - N AND SYSDATE` |
| `postgresql` | `BETWEEN CURRENT_DATE - INTERVAL 'N days' AND CURRENT_DATE` |
| `sqlite` | `BETWEEN date('now', '-N days') AND date('now')` |

### 6b. Schema Prefix Stripping

Oracle data sources may reference schema-qualified tables (e.g., `reconmgmt.mr_csum_man_match_stats_hist`). SQLite has no schema concept.

The `schema` field in `databases.json` controls this:
- If `schema` is non-empty (Oracle): SQL used as-is. Oracle data sources without explicit schema prefixes (e.g., `recon_bank` in `reconmgmt_recon_bank.json`) rely on the Superset database connection's default schema, which is passed via `execute_sql(schema=...)`.
- If `schema` is empty/omitted (SQLite): Strip only known schema name prefixes (e.g., `reconmgmt.`) from table references. Table aliases like `b.agent_code` are never touched.

Implementation: `_build_sql()` collects known schema names from the DatabaseRegistrar and uses targeted regex replacement: `re.sub(rf'\b{re.escape(schema_name)}\.', '', sql)` for each known schema.

### SQL Template Authoring Rules

The `data_sources/*.json` files remain Oracle-native. All dialect adaptation happens in the QueryEngine at runtime. When deploying to Oracle, set `dialect: "oracle"` and `schema: "reconmgmt"` in `databases.json` — the SQL templates work as-is.

**Important constraint for local dev compatibility**: The dialect layer handles date functions and schema prefixes only. It does **not** rewrite Oracle-specific vendor functions. Data source SQL templates should:
- Use `COALESCE()` instead of `NVL()`
- Use standard `CAST()` instead of `TO_CHAR()`/`TO_DATE()`
- Avoid `DECODE()` outside of the date range clause (which is already handled)
- Use ANSI SQL JOINs (already the case in current templates)

If a production SQL template must use Oracle-specific functions, add the corresponding SQLite adaptation to `_build_sql()` as needed.

---

## 7. FastAPI Startup Flow

### Updated Lifespan

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    http = httpx.AsyncClient(timeout=30.0)
    superset = SupersetClient(http)

    # 1. Authenticate to Superset (hard requirement)
    await superset.authenticate()
    app.state.superset = superset

    # 2. Load configs
    config_store = ConfigStore()
    app.state.config_store = config_store

    # 3. Sync databases into Superset
    registrar = DatabaseRegistrar(superset_client=superset)
    await registrar.sync()
    app.state.database_registrar = registrar

    # 4. Create QueryEngine
    app.state.query_engine = QueryEngine(
        config_store=config_store,
        superset_client=superset,
        database_registrar=registrar,
    )

    yield

    await http.aclose()
```

### Error Behavior

- **Superset unreachable at startup**: FastAPI crashes with clear error message. Intentional — no silent fallback.
- **Database sync fails**: Log warning per failed database with explicit message (e.g., "Failed to register superset_db_TCOSPRD — have you run `python scripts/generate-seed-db.py`?"). Continue with partial cache. Some dashboards may not work but the app still starts.
- **Database lookup miss at request time**: `DatabaseRegistrar.resolve()` checks negative cache first, then attempts one rate-limited cache refresh. If still missing, returns 400 to frontend. Negative results are cached to prevent Superset API flooding.

### Dependencies Update

`backend/app/core/dependencies.py` — no changes needed. `QueryEngineDep` type annotation stays the same. `DatabaseRegistrar` is only used internally by QueryEngine (passed via constructor in lifespan), not injected into route handlers.

---

## 8. File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `backend/app/config/databases.json` | Database registry — logical names → connection URIs |
| `backend/app/services/database_registrar.py` | Syncs databases.json into Superset, caches name → ID |
| `superset/superset_config_local.py` | Lightweight Superset config (SQLite metadata + SimpleCache) |
| `scripts/setup-superset-local.sh` | One-time Superset bootstrap |
| `scripts/generate-seed-db.py` | Generates 1M+ row SQLite seed database |

### Modified Files

| File | Change |
|------|--------|
| `backend/app/services/query_engine.py` | Remove mock path, add DatabaseRegistrar for ID resolution, add SQLite dialect |
| `backend/app/services/superset_client.py` | Update `execute_sql()` — remove hardcoded `schema="public"` default, caller passes schema explicitly |
| `backend/app/services/config_store.py` | Load from `config/` instead of `mock/` |
| `backend/app/main.py` | Updated lifespan — hard Superset requirement, DatabaseRegistrar init |
| `backend/app/config.py` | Add `databases_config_path` setting |
| `.gitignore` | Add `backend/app/config/seed/seed.db` |

### Deleted Files

| File | Reason |
|------|--------|
| `backend/app/mock/query_results.py` | No more mock fallback |
| `backend/app/mock/__init__.py` | Directory removed |

### Moved (Rename)

| From | To |
|------|-----|
| `backend/app/mock/dashboards/` | `backend/app/config/dashboards/` |
| `backend/app/mock/data_sources/` | `backend/app/config/data_sources/` |

### Unchanged

- `backend/app/config/dashboards/tlm-stats.json`
- `backend/app/config/data_sources/*.json`
- `backend/app/services/superset_client.py`
- All frontend code

---

## Deployment Checklist

To deploy RecViz with real Oracle databases:

1. **Edit `databases.json`**: Update `sqlalchemy_uri` to Oracle connection strings, set `dialect: "oracle"`, set `schema` where needed
2. **Update data source SQL** (if needed): The current SQL templates in `data_sources/*.json` are simplified versions of the real Oracle queries. If the real Oracle schema differs (different table names, column names, JOIN structure), update the SQL templates to match. The dialect adaptation layer only handles date functions and schema prefixes — it does not rewrite query structure.
3. **Install `oracledb`**: `pip install oracledb` in the deployment environment
4. **Configure Superset**: Point to production PostgreSQL metadata DB + Redis cache (use existing `superset_config.py`)
5. **Start services**: Superset → FastAPI → Frontend

No frontend code changes. No backend code changes. Config and SQL template updates only.
