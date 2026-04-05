# Phase 4: Data Source Connectivity - Research

**Researched:** 2026-04-06
**Domain:** Database driver installation, Superset database connectivity, connection management UI
**Confidence:** HIGH

## Summary

Phase 4 connects Oracle and Hive databases through Superset and upgrades the existing connection management UI with dynamic forms, status tracking, and test-before-save enforcement. Elasticsearch (DATA-03) is deferred to a future phase.

The existing codebase is 70-80% built: full CRUD routes (`databases.py`), complete TanStack Query hooks (`use-databases.ts`), working card/list views with search, and a slide-over sheet for create/edit/detail. The remaining work is: (1) install `oracledb` and `pyhive` drivers in the Superset Dockerfile, (2) configure the cx_Oracle aliasing workaround in `superset_config.py`, (3) update `uri_builder.py` to use `oracle://` format (not `oracle+oracledb://`), (4) add dynamic backend-specific form fields, (5) implement connection status tracking with colored dots, (6) enforce test-before-save on create, and (7) support environment-specific config files.

**Primary recommendation:** Install `oracledb` (thin mode) + `pyhive` + `thrift` in the Superset Dockerfile, apply the `sys.modules["cx_Oracle"] = oracledb` alias in `superset_config.py`, and use `oracle://` URI scheme (NOT `oracle+oracledb://`) because Superset 6.0.0 ships SQLAlchemy 1.4 which lacks native `oracle+oracledb` dialect support.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Dynamic form fields per backend type. User selects backend (Oracle, PostgreSQL, Hive) first, then the form shows only fields relevant to that backend. Oracle: host, port, service_name, schema. Hive: host, port, database, auth type. PostgreSQL: host, port, database.
- **D-02:** Oracle connections use service_name only -- no SID or TNS alias support. Modern Oracle standard. Matches the existing `uri_builder.py` pattern.
- **D-03:** Test Connection is required before first save (create). Prevents orphaned broken connections. Edit mode allows saving without re-testing if only the display name changed.
- **D-04:** Connection pool settings (pool_size, max_overflow, timeout) are config-only -- managed in `superset_config.py` or `databases.json`, not exposed in the UI.
- **D-05:** Passwords are never returned to the frontend. Superset stores credentials in its database but the API never sends them back. Edit form shows a placeholder -- user must re-enter password only when changing it.
- **D-06:** On-demand test only -- no background health checks. Status updates when user clicks "Test Connection" or when a query fails. Three states: `connected` (last test/query passed), `unreachable` (last test/query failed), `untested` (never tested).
- **D-07:** Query failures propagate to status. When `QueryEngine` gets a connection error for a database, mark that database as `unreachable` in the management UI. Status clears to `connected` on next successful test or query.
- **D-08:** Minimal metadata in detail view: backend type, created date, last tested date, current status, dataset count. No query analytics.
- **D-09:** Colored dot status indicator on data source cards -- green (connected), red (unreachable), gray (untested). Subtle, space-efficient.
- **D-10:** Install all database drivers in the Superset Docker image: `python-oracledb` (thin mode -- no Oracle Client libraries needed), `pyhive` + `thrift` for Hive, `psycopg2-binary` for PostgreSQL. Image is production-ready regardless of which databases are configured.
- **D-11:** Use `python-oracledb` instead of `cx_Oracle`. Modern replacement, thin mode is pure Python. Update `uri_builder.py` to generate correct URIs.
- **D-12:** Separate config files per environment: `databases.json` (dev), `databases.prod.json` (production). `DATABASES_CONFIG_PATH` env var selects which file to load. Dev configs stay hardcoded to PostgreSQL; prod configs point to real Oracle/Hive instances.
- **D-13:** PostgreSQL-only for local dev. No Hive or Oracle containers in docker-compose. Drivers are installed in the Superset image but PostgreSQL stands in for all databases locally.
- **D-14:** Connection management stays under Settings > Data Sources tab (existing location). No dedicated top-level nav item.

### Claude's Discretion
- Dynamic form field layout and validation messaging
- DataSourceSheet component refactoring to support backend-specific form sections
- How connection status state is tracked (in-memory cache, database column, or Zustand store)
- How QueryEngine propagates connection errors back to status tracking
- Hive auth mechanism fields (Kerberos, LDAP, or none -- depends on Superset support)
- Last tested timestamp storage location

### Deferred Ideas (OUT OF SCOPE)
- **Elasticsearch integration (DATA-03)** -- Dual path via Superset SQL (elasticsearch-dbapi) and sidecar (elasticsearch-py). Deferred to a future phase.
- **Connection pool settings in UI** -- Pool size, max overflow, timeout configurable per connection. Currently config-file-only.
- **Query analytics per database** -- Total queries, average latency, last query time. Monitoring concern, not v1.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | Oracle database fully integrated via Superset -- connection pooling, query execution, result caching all working reliably at production scale | oracledb 3.4.2 thin mode + cx_Oracle aliasing in superset_config.py; `oracle://` URI scheme; connection pooling via Superset `extra` field `engine_params`; Redis caching already configured |
| DATA-02 | Hive database integrated via Superset for historical/batch queries with appropriate caching for slow queries | PyHive 0.7.0 + thrift; `hive://` URI scheme; extended DATA_CACHE_CONFIG timeout for slow Hive queries |
| DATA-03 | Elasticsearch integrated (DEFERRED per CONTEXT.md) | Out of scope for this phase |
| DATA-04 | Database connection management UI for dev team -- add, edit, test connections | Existing DataSourceSheet needs dynamic form fields, test-before-save enforcement, status tracking with colored dots |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Strict TypeScript**: No `any`, no `@ts-ignore`. Use `unknown` + type narrowing.
- **Named exports** for all components/hooks/stores. Page components use `default export`.
- **Props interface** named `{ComponentName}Props` defined above component.
- **No barrel exports** -- import directly from file.
- **Shadcn/ui components** in `src/components/ui/`. Extend via composition, do not modify base files.
- **CSS variable colors only**: Never hardcode hex/rgb/hsl. Use `text-foreground`, `bg-background`, etc.
- **Dark mode required**: Every component must work in both light and dark.
- **FastAPI async everywhere**: All endpoints `async def`. Service layer pattern.
- **Pydantic v2** for all request/response models.
- **CamelModel** base for API-facing models (auto camelCase aliasing).
- **Desktop-first** -- optimize for large screens and data density.
- **Motion from `motion/react`** -- NOT `framer-motion`.
- **File naming**: kebab-case for components, `use-{name}` for hooks, snake_case for Python.

## Standard Stack

### Core (Already in project)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| Apache Superset | 6.0.0 | Headless query engine | Installed in Docker [VERIFIED: `docker exec` pip show] |
| SQLAlchemy | 1.4.54 | ORM/database abstraction (Superset dependency) | Installed in Docker [VERIFIED: `docker exec` pip show] |
| psycopg2-binary | (bundled) | PostgreSQL driver | Already in Dockerfile [VERIFIED: Dockerfile line 18] |
| Redis | 7 | Query cache + Celery broker | Already in docker-compose [VERIFIED: docker-compose.yml] |

### New Drivers (to install in Superset Dockerfile)
| Library | Version | Purpose | Why This |
|---------|---------|---------|----------|
| oracledb | 3.4.2 | Oracle database driver (thin mode) | Modern replacement for cx_Oracle. Pure Python thin mode -- no Oracle Client libs needed. [VERIFIED: pypi.org/project/oracledb] |
| PyHive | 0.7.0 | Hive database driver | Standard Hive driver for SQLAlchemy/Superset. [VERIFIED: pypi.org/project/PyHive] |
| thrift | (latest) | Hive transport protocol | Required by PyHive for Hive connections. [VERIFIED: PyHive docs] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| oracledb (thin) | cx_Oracle + Oracle Instant Client | cx_Oracle deprecated. Instant Client is ~200MB, requires system libs, architecture-specific. Thin mode avoids all this. |
| PyHive | impyla | impyla has better Kerberos support but less Superset ecosystem adoption. PyHive is standard for Superset. |

**Installation (Dockerfile addition):**
```dockerfile
RUN pip install --no-cache-dir \
    oracledb \
    pyhive \
    thrift
```

## Architecture Patterns

### Critical: SQLAlchemy Version Constraint

**Superset 6.0.0 ships with SQLAlchemy 1.4.54, NOT 2.0.** [VERIFIED: `docker exec recviz-superset pip show sqlalchemy`]

This means:
- The `oracle+oracledb://` dialect is **NOT available** -- that is a SQLAlchemy 2.0+ feature [VERIFIED: github.com/sqlalchemy/sqlalchemy/discussions/8412]
- Must use `oracle://` URI scheme with `sys.modules["cx_Oracle"] = oracledb` aliasing [VERIFIED: Superset GitHub discussion #37428, Medium article by Christopher Jones]
- The aliasing goes in `superset_config.py` which runs before any SQLAlchemy imports

### Pattern 1: cx_Oracle Module Aliasing (superset_config.py)
**What:** Make Superset use python-oracledb via cx_Oracle compatibility alias
**When to use:** Always -- required because Superset 6.0.0 + SQLAlchemy 1.4 expect cx_Oracle
**Example:**
```python
# Source: https://github.com/apache/superset/discussions/37428
# Source: https://cjones-oracle.medium.com/using-python-oracledb-1-0-with-sqlalchemy-pandas-django-and-flask-5d84e910cb19
# MUST be at the very top of superset_config.py, before any SQLAlchemy imports
import sys
import oracledb
oracledb.version = "8.3.0"  # Compatibility version string
sys.modules["cx_Oracle"] = oracledb
```

### Pattern 2: URI Format for Oracle with SQLAlchemy 1.4
**What:** Correct Oracle URI format when using the cx_Oracle alias
**When to use:** All Oracle connections via Superset
**Example:**
```python
# Source: https://cjones-oracle.medium.com/using-python-oracledb-1-0-with-sqlalchemy-pandas-django-and-flask-5d84e910cb19
# CORRECT (SQLAlchemy 1.4 + oracledb aliased as cx_Oracle):
"oracle://user:pass@host:1521/?service_name=MYSERVICE"

# WRONG (SQLAlchemy 2.0+ only):
"oracle+oracledb://user:pass@host:1521/?service_name=MYSERVICE"

# WRONG (old cx_Oracle dialect -- not available since we install oracledb, not cx_Oracle):
"oracle+cx_oracle://user:pass@host:1521/?service_name=MYSERVICE"
```

### Pattern 3: uri_builder.py Update
**What:** Update the Oracle URI generation to use `oracle://` instead of `oracle+cx_oracle://`
**Current code (line 40):**
```python
return f"oracle+cx_oracle://{user_part}{host}:{port}/?service_name={db_part}"
```
**Updated code:**
```python
return f"oracle://{user_part}{host}:{port}/?service_name={db_part}"
```

### Pattern 4: Hive URI Format
**What:** Standard Hive connection URI for Superset
**Example:**
```python
# Source: https://superset.apache.org/user-docs/6.0.0/configuration/databases
# Without auth:
"hive://host:10000/default"

# With username:
"hive://user@host:10000/database"

# With auth:
"hive://user:pass@host:10000/database?auth=CUSTOM"

# NOSASL (no authentication):
"hive://host:10000/database?auth=NOSASL"
```
The existing `uri_builder.py` already generates `hive://` correctly. No change needed for the basic case.

### Pattern 5: Connection Status Tracking
**What:** Track connection status in-memory on the backend, propagate from QueryEngine errors
**Recommendation (Claude's Discretion):** Use an in-memory dict on the backend (not DB, not Zustand store). Reasoning:
- Status is transient -- no need to persist across restarts (starts fresh as "untested")
- Small number of databases (< 20) -- no scalability concern
- Backend owns the truth -- frontend just displays what the API returns
- QueryEngine error propagation writes to the same dict

```python
# In a new module or on DatabaseRegistrar:
_connection_status: dict[int, dict] = {}
# key = superset_id, value = {"status": "connected"|"unreachable"|"untested", "last_tested": datetime|None}
```

### Pattern 6: Dynamic Form Fields (Frontend)
**What:** Show different form fields based on selected backend type
**Recommendation (Claude's Discretion):** Define a field config per backend, render fields from config.

```typescript
// Source: project convention, not external library
interface BackendFieldConfig {
  fields: Array<{
    name: string
    label: string
    placeholder: string
    type: 'text' | 'password' | 'number'
    required: boolean
    gridSpan?: number  // for grid layout
  }>
}

const BACKEND_FIELDS: Record<DatabaseBackend, BackendFieldConfig> = {
  oracle: {
    fields: [
      { name: 'host', label: 'Host', placeholder: 'oracle-host.example.com', type: 'text', required: true, gridSpan: 2 },
      { name: 'port', label: 'Port', placeholder: '1521', type: 'number', required: true },
      { name: 'database', label: 'Service Name', placeholder: 'MYSERVICE', type: 'text', required: true },
      { name: 'schemaName', label: 'Schema', placeholder: 'MYSCHEMA', type: 'text', required: false },
      { name: 'username', label: 'Username', placeholder: 'db_user', type: 'text', required: true },
      { name: 'password', label: 'Password', placeholder: '', type: 'password', required: true },
    ],
  },
  hive: {
    fields: [
      { name: 'host', label: 'Host', placeholder: 'hive-host.example.com', type: 'text', required: true, gridSpan: 2 },
      { name: 'port', label: 'Port', placeholder: '10000', type: 'number', required: true },
      { name: 'database', label: 'Database', placeholder: 'default', type: 'text', required: true },
      { name: 'username', label: 'Username', placeholder: 'hive_user', type: 'text', required: false },
      { name: 'password', label: 'Password', placeholder: '', type: 'password', required: false },
    ],
  },
  postgresql: {
    fields: [
      { name: 'host', label: 'Host', placeholder: 'pg-host.example.com', type: 'text', required: true, gridSpan: 2 },
      { name: 'port', label: 'Port', placeholder: '5432', type: 'number', required: true },
      { name: 'database', label: 'Database', placeholder: 'mydb', type: 'text', required: true },
      { name: 'username', label: 'Username', placeholder: 'db_user', type: 'text', required: true },
      { name: 'password', label: 'Password', placeholder: '', type: 'password', required: true },
    ],
  },
  elasticsearch: {
    fields: [], // Deferred -- DATA-03 out of scope
  },
}
```

### Pattern 7: Test-Before-Save Enforcement
**What:** Require successful connection test before allowing first save
**Recommendation (Claude's Discretion):**

```typescript
// Frontend: track test state, disable Save button until test passes
const [hasPassedTest, setHasPassedTest] = useState(false)

// On create mode: Save disabled unless hasPassedTest is true
// On edit mode: Save enabled if only displayName changed (no re-test needed)
const canSave = mode === 'create'
  ? !!(displayName.trim() && hasPassedTest)
  : !!(displayName.trim())  // edit mode: always saveable if name filled
```

### Pattern 8: Environment-Specific Config Files
**What:** Load different database configs per environment
**Recommendation:**

```python
# backend/app/config.py -- already has databases_config_path
# The env var DATABASES_CONFIG_PATH overrides the default
databases_config_path: str = str(
    Path(__file__).parent / "config" / "databases.json"
)
```
Create `databases.prod.json` with Oracle/Hive entries. Set `DATABASES_CONFIG_PATH=backend/app/config/databases.prod.json` in production.

### Pattern 9: Superset Connection Pool Configuration
**What:** Configure connection pooling per database via Superset's `extra` JSON field
**When to use:** Production Oracle connections (config-only, per D-04)
**Example:**
```python
# Source: https://superset.apache.org/user-docs/6.0.0/configuration/databases
# The Superset database 'extra' field accepts JSON:
{
  "engine_params": {
    "pool_size": 10,
    "max_overflow": 20,
    "pool_recycle": 3600,
    "pool_pre_ping": true
  }
}
```
**Important caveat:** Superset may use NullPool by default for analytics databases, which ignores pool_size/max_overflow. The `extra` field is set via the Superset database creation API payload. For config-file-driven databases, the DatabaseRegistrar can include `extra` in the create_database payload. [ASSUMED -- needs verification against Superset 6.0.0 source]

### Anti-Patterns to Avoid
- **Do NOT use `oracle+oracledb://`:** SQLAlchemy 1.4 does not support this dialect. Use `oracle://` with the cx_Oracle alias.
- **Do NOT use `oracle+cx_oracle://`:** This also fails when only oracledb is installed (no cx_Oracle package). The generic `oracle://` works with the alias.
- **Do NOT install Oracle Instant Client:** python-oracledb thin mode is pure Python. Installing Instant Client adds ~200MB and architecture-specific binaries to the Docker image for no benefit.
- **Do NOT store connection status in PostgreSQL:** Status is transient. Persisting it adds complexity (migrations, writes on every query) for no user-facing benefit. In-memory dict resets to "untested" on restart, which is correct behavior.
- **Do NOT remove the "Advanced" SQLAlchemy URI tab:** Power users may need to paste raw URIs. Keep it as a secondary option.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Oracle connectivity | Custom TCP/OCI bindings | oracledb (thin mode) | Pure Python, no system deps, Oracle-maintained |
| Hive connectivity | Custom Thrift client | PyHive + thrift | Standard, Superset-tested combination |
| Connection pooling | Custom pool manager | Superset's built-in SQLAlchemy pool config via `extra` field | Superset manages engine lifecycle |
| URI construction | Manual string concatenation | `uri_builder.py` (existing) | Already handles escaping, defaults, backend-specific formats |
| Password encryption | Custom encryption | Superset's internal credential storage | Superset encrypts passwords in its metadata DB with AES128 |

**Key insight:** The Superset API handles the hard parts (connection testing, credential storage, pool management). The FastAPI backend is a thin proxy. Do not duplicate Superset's database management -- proxy to it.

## Common Pitfalls

### Pitfall 1: Wrong Oracle URI Dialect
**What goes wrong:** Using `oracle+oracledb://` or `oracle+cx_oracle://` results in `NoSuchModuleError` or `ModuleNotFoundError`.
**Why it happens:** Superset 6.0.0 bundles SQLAlchemy 1.4.54 which only has the generic `oracle://` dialect (using cx_Oracle under the hood). The `oracle+oracledb://` dialect was added in SQLAlchemy 2.0.
**How to avoid:** Use `oracle://` and alias oracledb as cx_Oracle in `superset_config.py`. The CONTEXT.md decision D-11 says "Update uri_builder.py to generate `oracle+oracledb://` URIs" -- this must be corrected to `oracle://`.
**Warning signs:** Import errors, `NoSuchModuleError: Can't load plugin: sqlalchemy.dialects:oracle.oracledb` at startup.

### Pitfall 2: oracledb Version String Missing
**What goes wrong:** Some Superset/SQLAlchemy code paths check `cx_Oracle.version` and fail if it returns an unexpected format.
**Why it happens:** oracledb's version is e.g. "3.4.2", but code may expect cx_Oracle-style versions like "8.x.x".
**How to avoid:** Set `oracledb.version = "8.3.0"` before the module alias.
**Warning signs:** `AttributeError` or version comparison failures in Superset startup logs.

### Pitfall 3: PyHive SASL Dependencies
**What goes wrong:** `pip install pyhive[hive]` pulls in `sasl` which fails to build on Python 3.12+ or in slim Docker images.
**Why it happens:** The `sasl` package is unmaintained and requires system-level SASL libraries (`libsasl2-dev`).
**How to avoid:** Install `pyhive` and `thrift` separately (without the `[hive]` extra). Only install `sasl` + `thrift-sasl` if Kerberos/SASL auth is actually needed. For non-authenticated or NOSASL Hive, the base packages suffice. Add `libsasl2-dev` to the Dockerfile apt-get if SASL auth is required in production.
**Warning signs:** Build failures during `pip install`, `ImportError: No module named 'sasl'` at runtime if SASL auth is attempted.

### Pitfall 4: Passwords Leaking via GET Endpoints
**What goes wrong:** Frontend displays actual passwords or raw SQLAlchemy URIs containing credentials.
**Why it happens:** Superset's GET `/api/v1/database/{id}` returns the `sqlalchemy_uri` with the password portion (though Superset redacts it with `XXXXXXXXXX`). The backend must strip/redact before sending to frontend.
**How to avoid:** The existing `databases.py` routes already construct clean response objects that omit URI fields. Verify this pattern is maintained for all new response fields.
**Warning signs:** Password visible in browser dev tools network tab.

### Pitfall 5: Connection Status Not Updating on Query Failures
**What goes wrong:** Database shows "connected" status even after queries fail, because the status update path from QueryEngine to the status tracker is not wired.
**Why it happens:** QueryEngine and the status tracker are separate concerns -- the connection needs explicit wiring.
**How to avoid:** Add a try/except in QueryEngine.execute() that catches connection-level exceptions (httpx.ConnectError, httpx.HTTPStatusError with 500/502/503) and calls the status tracker. Distinguish between "database unreachable" (connection error) and "query error" (bad SQL) -- only the former should mark the database as unreachable.
**Warning signs:** Stale "connected" status after a database goes down.

### Pitfall 6: Docker Build Cache Invalidation
**What goes wrong:** Adding new pip packages triggers a full rebuild of the Superset Docker image, which takes several minutes.
**Why it happens:** Docker layer caching -- changing a RUN pip install line invalidates all subsequent layers.
**How to avoid:** Group all pip installs in a single RUN command (already the pattern). Consider a requirements.txt for better cache management. This is a one-time cost.
**Warning signs:** Slow docker-compose builds after Dockerfile changes.

## Code Examples

### Example 1: Updated superset_config.py (Top Section)
```python
# Source: https://github.com/apache/superset/discussions/37428
# MUST be at the very top, before any other imports
import sys
import oracledb
oracledb.version = "8.3.0"
sys.modules["cx_Oracle"] = oracledb

import os
# ... rest of superset_config.py follows
```

### Example 2: Updated uri_builder.py Oracle Case
```python
# Source: project codebase analysis + SQLAlchemy 1.4 constraint
if backend == "oracle":
    db_part = database or "ORCL"
    return f"oracle://{user_part}{host}:{port}/?service_name={db_part}"
```

### Example 3: Updated Dockerfile
```dockerfile
# Source: project Dockerfile analysis
# Install Superset + all database drivers
RUN pip install --no-cache-dir \
    apache-superset \
    psycopg2-binary \
    redis \
    cachelib \
    oracledb \
    pyhive \
    thrift
```

### Example 4: Connection Status API Response (Backend)
```python
# Source: project convention
@router.get("")
async def list_databases(superset: SupersetDep) -> list[dict]:
    raw = await superset.list_databases()
    return [
        {
            "id": db.get("id"),
            "database_name": db.get("database_name", ""),
            "backend": db.get("backend", ""),
            "created_on": db.get("created_on"),
            "expose_in_sqllab": db.get("expose_in_sqllab", True),
            "dataset_count": 0,
            "status": _get_status(db.get("id")),  # NEW: from status tracker
            "last_tested": _get_last_tested(db.get("id")),  # NEW
        }
        for db in raw
    ]
```

### Example 5: Status Dot Component (Frontend)
```tsx
// Source: project convention -- colored dot per D-09
function StatusDot({ status }: { status: ConnectionStatus }) {
  const colors: Record<ConnectionStatus, string> = {
    connected: 'bg-green-500',
    unreachable: 'bg-red-500',
    untested: 'bg-gray-400',
  }
  return (
    <span
      className={cn('inline-block size-2 rounded-full', colors[status])}
      aria-label={status}
    />
  )
}
```

### Example 6: databases.prod.json Template
```json
{
  "databases": [
    {
      "name": "superset_db_TCOSPRD",
      "display_name": "TLM Consumer (TCOSPRD)",
      "sqlalchemy_uri": "oracle://recon_user:{{password}}@oracle-prod:1521/?service_name=TCOSPRD",
      "dialect": "oracle",
      "schema": "RECON_OWNER",
      "type": "tlm"
    },
    {
      "name": "superset_db_hive_historical",
      "display_name": "Historical Data (Hive)",
      "sqlalchemy_uri": "hive://hive_user@hive-prod:10000/recon_history",
      "dialect": "hive",
      "type": "historical"
    }
  ]
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| cx_Oracle + Oracle Instant Client | oracledb thin mode (pure Python) | 2022 (oracledb 1.0) | No system dependencies, smaller Docker image, easier CI/CD |
| `oracle+cx_oracle://` URI | `oracle://` with alias (SA 1.4) or `oracle+oracledb://` (SA 2.0+) | SA 2.0 (2023) | Must use alias approach until Superset upgrades to SA 2.0 |
| cx_Oracle package | oracledb package (pip install oracledb) | 2022 | cx_Oracle is deprecated, oracledb is the successor |

**Deprecated/outdated:**
- `cx_Oracle`: Deprecated by Oracle in favor of `python-oracledb`. Last release was 2021. [VERIFIED: oracle.github.io/python-oracledb]
- `oracle+cx_oracle://` dialect: Still works in SQLAlchemy 1.4 but only if cx_Oracle is installed. Since we install oracledb, not cx_Oracle, this will fail.

## Assumptions Log

> List all claims tagged `[ASSUMED]` in this research.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Superset may use NullPool by default for analytics databases, which ignores pool_size/max_overflow settings in the `extra` field | Architecture Patterns > Pattern 9 | Connection pooling config in `databases.json` would have no effect. Mitigation: test pooling behavior with Superset 6.0.0 directly. For local dev with PostgreSQL, default pooling is fine. |
| A2 | PyHive 0.7.0 works with Python 3.12 when installed without SASL extras | Common Pitfalls > Pitfall 3 | Build failure in Docker. Mitigation: test the Docker build. If SASL is needed, add `libsasl2-dev` to apt-get. |
| A3 | Hive auth in production will use NOSASL or simple auth (not Kerberos) | Claude's Discretion area | If Kerberos is required, additional SASL dependencies and config are needed. User should confirm Hive auth mechanism. |

## Open Questions

1. **Hive Authentication Mechanism**
   - What we know: PyHive supports NOSASL, CUSTOM, KERBEROS, LDAP auth types via URI query param `?auth=X`
   - What's unclear: What auth mechanism does the production Hive cluster use?
   - Recommendation: Default to NOSASL for dev. Add an "Auth Type" dropdown to the Hive form fields. If Kerberos is needed, additional system packages (`libsasl2-dev`, `sasl`, `thrift-sasl`) must be added to the Dockerfile.

2. **Superset 6.0.0 Connection Pooling Behavior**
   - What we know: The `extra` field's `engine_params` are passed to `create_engine()`. Superset may use NullPool for analytics databases.
   - What's unclear: Whether Superset 6.0.0 actually uses NullPool for user-registered databases (vs only for Celery workers).
   - Recommendation: Connection pooling is config-only (D-04), so this does not affect the UI. Document the `extra` field format in `databases.prod.json` comments. Verify pooling behavior during production deployment.

3. **CONTEXT.md D-11 URI Correction**
   - What we know: D-11 says "Update `uri_builder.py` to generate `oracle+oracledb://` URIs". But Superset 6.0.0 + SQLAlchemy 1.4 cannot use this dialect.
   - What's unclear: Whether the user is aware of this constraint.
   - Recommendation: Implement `oracle://` URI scheme instead. This achieves the same goal (using oracledb driver instead of cx_Oracle) via the module alias approach. The planner should note this correction.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | Superset container | TBD (check at runtime) | -- | Required, no fallback |
| PostgreSQL (Docker) | Metadata DB, dev data | Yes | 16-alpine | -- |
| Redis (Docker) | Superset cache | Yes | 7-alpine | -- |
| Superset (Docker) | Query engine | Yes | 6.0.0 | -- |
| Node.js / pnpm | Frontend build | Yes (project runs) | -- | -- |
| Python 3.12+ | Backend | Yes (project runs) | -- | -- |
| Oracle database | DATA-01 production testing | No (dev uses PostgreSQL) | -- | PostgreSQL stand-in for local dev (D-13) |
| Hive database | DATA-02 production testing | No (dev uses PostgreSQL) | -- | PostgreSQL stand-in for local dev (D-13) |

**Missing dependencies with no fallback:** None -- all dependencies available for local dev.

**Missing dependencies with fallback:**
- Oracle and Hive databases not available locally -- PostgreSQL stands in (by design, D-13). Drivers are installed in Docker image for production readiness.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Frontend Framework | Vitest (config at `frontend/vitest.config.ts`) |
| Backend Framework | pytest + pytest-asyncio |
| Frontend quick run | `cd frontend && pnpm vitest run --reporter=verbose` |
| Backend quick run | `cd backend && python -m pytest tests/ -x -q` |
| E2E Framework | Playwright (existing specs in `frontend/e2e/`) |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | Oracle URI generation with oracledb alias | unit | `cd backend && python -m pytest tests/test_uri_builder.py -x` | No -- Wave 0 |
| DATA-01 | cx_Oracle aliasing works in superset_config | smoke | Docker build + container start | No -- manual |
| DATA-02 | Hive URI generation | unit | `cd backend && python -m pytest tests/test_uri_builder.py -x` | No -- Wave 0 |
| DATA-04 | Connection status tracking | unit | `cd backend && python -m pytest tests/test_connection_status.py -x` | No -- Wave 0 |
| DATA-04 | Dynamic form rendering per backend | unit | `cd frontend && pnpm vitest run src/components/settings/ --reporter=verbose` | No -- Wave 0 |
| DATA-04 | Test-before-save enforcement | unit | `cd frontend && pnpm vitest run src/components/settings/ --reporter=verbose` | No -- Wave 0 |
| DATA-04 | Database CRUD with status | unit | `cd backend && python -m pytest tests/test_databases_api.py -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/ -x -q`
- **Per wave merge:** `cd backend && python -m pytest tests/ -x -q && cd ../frontend && pnpm vitest run --reporter=verbose`
- **Phase gate:** Full suite green + Docker build succeeds + visual verification of data sources UI

### Wave 0 Gaps
- [ ] `backend/tests/test_uri_builder.py` -- unit tests for Oracle (`oracle://`), Hive, PostgreSQL URI generation
- [ ] `backend/tests/test_connection_status.py` -- unit tests for status tracker
- [ ] `frontend/src/components/settings/__tests__/data-source-sheet.test.tsx` -- dynamic form field rendering per backend type

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (auth deferred to SECU-01) | -- |
| V3 Session Management | No | -- |
| V4 Access Control | No (no user roles yet) | -- |
| V5 Input Validation | Yes | Pydantic v2 models validate all API inputs; SQLAlchemy parameterized queries via Superset |
| V6 Cryptography | Yes | Superset encrypts DB credentials with AES128 (SECRET_KEY-derived); never expose passwords via API |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Credential leakage in API responses | Information Disclosure | Superset redacts passwords in GET responses; backend constructs clean response objects omitting URI |
| SQL injection via URI builder | Tampering | `urllib.parse.quote_plus()` for username/password in `uri_builder.py`; Superset parameterized queries |
| Test connection as SSRF vector | Spoofing/Tampering | Superset's `test_connection` validates URI format; no direct network calls from FastAPI backend |
| Plaintext credentials in config files | Information Disclosure | `databases.prod.json` should use env var substitution or Superset's `SQLALCHEMY_CUSTOM_PASSWORD_STORE` for production credentials |

## Sources

### Primary (HIGH confidence)
- Docker exec `pip show` commands -- verified Superset 6.0.0, SQLAlchemy 1.4.54 installed versions
- [pypi.org/project/oracledb](https://pypi.org/project/oracledb/) -- oracledb 3.4.2 (Jan 2026)
- [pypi.org/project/PyHive](https://pypi.org/project/PyHive/) -- PyHive 0.7.0 (Aug 2023)
- Codebase analysis -- all canonical reference files from CONTEXT.md read and analyzed

### Secondary (MEDIUM confidence)
- [Superset GitHub Discussion #37428](https://github.com/apache/superset/discussions/37428) -- cx_Oracle aliasing workaround, verified approach
- [SQLAlchemy GitHub Discussion #8412](https://github.com/sqlalchemy/sqlalchemy/discussions/8412) -- confirms oracle+oracledb requires SA 2.0+
- [Christopher Jones Medium article](https://cjones-oracle.medium.com/using-python-oracledb-1-0-with-sqlalchemy-pandas-django-and-flask-5d84e910cb19) -- oracledb module aliasing code with SA 1.4
- [Superset Databases Documentation](https://superset.apache.org/user-docs/6.0.0/configuration/databases) -- Hive URI format, extra field structure
- [Superset GitHub Issue #6930](https://github.com/apache/superset/issues/6930) -- engine_params in extra field, NullPool caveat

### Tertiary (LOW confidence)
- [PyHive GitHub Issue #380](https://github.com/dropbox/PyHive/issues/380) -- SASL compatibility concerns with newer Python (needs validation with actual Docker build)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- oracledb and PyHive versions verified against PyPI, Superset version verified via Docker
- Architecture: HIGH -- SQLAlchemy version constraint verified, aliasing approach confirmed from multiple authoritative sources
- Pitfalls: HIGH -- URI dialect issue verified empirically (SA 1.4 confirmed in container), SASL concern documented with mitigation
- Frontend patterns: HIGH -- existing codebase fully analyzed, clear extension points identified

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable -- driver versions unlikely to change in 30 days)
