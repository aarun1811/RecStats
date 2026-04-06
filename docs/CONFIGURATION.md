<!-- generated-by: gsd-doc-writer -->
# Configuration

RecViz has three independently configured layers: the **FastAPI backend**, the **React frontend**, and the **Superset query engine**. Each layer reads its settings from a different source (environment variables, Vite env, Python config file). Supporting infrastructure (PostgreSQL, Redis) is configured via Docker Compose.

## Environment Variables

### FastAPI Backend (`backend/.env`)

The backend uses [pydantic-settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/) to load configuration. Settings are defined in `backend/app/config.py` as a `BaseSettings` class that reads from a `.env` file in the `backend/` directory.

| Variable | Required | Default | Description |
|---|---|---|---|
| `SUPERSET_URL` | Optional | `http://localhost:8088` | Base URL of the Superset instance the backend proxies to |
| `SUPERSET_USERNAME` | Optional | `admin` | Username for Superset API authentication |
| `SUPERSET_PASSWORD` | Optional | `admin` | Password for Superset API authentication |
| `REDIS_URL` | Optional | `redis://localhost:6379/0` | Redis connection URL (used by the backend if needed) |
| `RECON_DB_URL` | Optional | `postgresql://recviz:recviz_dev@localhost:5432/recon_data` | SQLAlchemy URI for the reconciliation data database |
| `RECVIZ_DB_URL` | Optional | `postgresql+asyncpg://recviz:recviz_dev@localhost:5432/superset_meta` | Async SQLAlchemy URI for the RecViz metadata tables (dashboards, data sources, datasets) |
| `DATABASES_CONFIG_PATH` | Optional | `backend/app/config/databases.json` | Path to the JSON file defining database connections to register in Superset |

The `Settings` class in `backend/app/config.py`:

```python
class Settings(BaseSettings):
    superset_url: str = "http://localhost:8088"
    superset_username: str = "admin"
    superset_password: str = "admin"
    redis_url: str = "redis://localhost:6379/0"
    recon_db_url: str = "postgresql://recviz:recviz_dev@localhost:5432/recon_data"
    recviz_db_url: str = "postgresql+asyncpg://recviz:recviz_dev@localhost:5432/superset_meta"
    databases_config_path: str = str(
        Path(__file__).parent / "config" / "databases.json"
    )

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}
```

All variables have defaults suitable for local development. For production, override them via the `.env` file or system environment variables. pydantic-settings automatically maps `SUPERSET_URL` (env var) to `superset_url` (field name).

### React Frontend

The frontend uses Vite's built-in environment variable system. Variables must be prefixed with `VITE_` to be exposed to client code.

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_BASE_URL` | Optional | `http://localhost:8000` | Base URL of the FastAPI backend |

Set in a `.env` file in the `frontend/` directory (not checked in). The value is consumed in `frontend/src/lib/api-client.ts`:

```typescript
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
```

No `.env` file is required for local development -- the default points to the standard backend port.

### Superset (Docker)

Superset reads environment variables inside its Docker container, defined in `docker-compose.yml` and consumed in `superset/superset_config.py`.

| Variable | Required | Default | Description |
|---|---|---|---|
| `POSTGRES_HOST` | Optional | `localhost` | PostgreSQL hostname (set to `postgres` in Docker Compose) |
| `REDIS_HOST` | Optional | `localhost` | Redis hostname (set to `redis` in Docker Compose) |
| `SECRET_KEY` | Optional | `recviz-dev-secret-key-change-in-prod` | Flask secret key for session signing |

These are set automatically by Docker Compose's `environment` block and should not need manual configuration in development.

### Superset (Local / Native)

When running Superset natively (not in Docker), the local config at `superset/superset_config_local.py` is used instead. It eliminates the Redis and PostgreSQL dependencies:

- Metadata stored in SQLite at `~/.superset/superset_local.db`
- In-memory caching (`SimpleCache`) instead of Redis
- File-based SQL Lab results at `~/.superset/sqllab_results/`
- No Celery (synchronous queries only)

Activate the local config by setting the environment variable:

```bash
export SUPERSET_CONFIG_PATH=/path/to/recviz/superset/superset_config_local.py
```

The `scripts/setup-superset-local.sh` script sets this automatically.

## Config File Format

### Database Connections (`backend/app/config/databases.json`)

Defines the database connections that the FastAPI backend registers into Superset at startup. The `DatabaseRegistrar` service reads this file and ensures each entry exists in Superset's database list.

```json
{
  "databases": [
    {
      "name": "superset_db_TCOSPRD",
      "display_name": "TLM Consumer (TCOSPRD) -- Local Dev",
      "sqlalchemy_uri": "postgresql://recviz:recviz_dev@postgres:5432/recon_data",
      "dialect": "postgresql",
      "type": "tlm"
    },
    {
      "name": "superset_db_reconmgmt",
      "display_name": "ReconMgmt -- Local Dev",
      "sqlalchemy_uri": "postgresql://recviz:recviz_dev@postgres:5432/recon_data",
      "dialect": "postgresql",
      "schema": "",
      "type": "reconmgmt"
    }
  ]
}
```

Each entry has the following fields (defined in `backend/app/models/database_config.py`):

| Field | Required | Default | Description |
|---|---|---|---|
| `name` | Yes | -- | Unique logical name used internally to identify this database |
| `display_name` | Yes | -- | Human-readable label shown in the UI |
| `sqlalchemy_uri` | Yes | -- | Full SQLAlchemy connection URI |
| `dialect` | No | `oracle` | SQL dialect (`oracle`, `postgresql`, `hive`, `elasticsearch`) |
| `schema` | No | `""` | Default schema name (e.g., `RECON_OWNER` for Oracle) |
| `type` | No | `""` | Logical grouping (`tlm`, `reconmgmt`, `historical`) |

A production variant exists at `backend/app/config/databases.prod.json` with Oracle and Hive URIs. Switch between them by setting the `DATABASES_CONFIG_PATH` environment variable.

### Data Source Configs (`backend/app/config/data_sources/*.json`)

Each JSON file defines a data source -- a parameterized SQL query that powers dashboard widgets. These files are loaded into the database via a seed script and stored in the `recviz_data_sources` table.

```json
{
  "id": "tlm_automatch",
  "name": "TLM Automatch Statistics",
  "database_routing": {
    "type": "dynamic",
    "route_by_filter": "tlm_instance",
    "mapping": {
      "TLMP_CONSUMER": "superset_db_TCOSPRD",
      "TLMP_FINANCE": "superset_db_TFINPRD"
    }
  },
  "query": "SELECT ... WHERE 1=1 {{filters}} GROUP BY ...",
  "filter_mappings": [
    { "filter_id": "recon", "sql_expr": "b.agent_code IN ({{values}})" }
  ],
  "columns": [
    { "name": "agent_code", "type": "string" }
  ]
}
```

Key concepts:

- **`database_routing.type: "dynamic"`** -- Routes the query to different databases based on a filter value. The `mapping` object maps filter option values to logical database names from `databases.json`.
- **`database_routing.type: "static"`** -- Always routes to a single database specified in `database_routing.database`.
- **`{{filters}}`** -- Placeholder in the SQL query where filter conditions are injected.
- **`filter_mappings`** -- Defines how each dashboard filter translates to a SQL WHERE clause fragment.

### Dashboard Configs (`backend/app/config/dashboards/*.json`)

Each JSON file defines a complete dashboard layout including filters, KPIs, charts, and grids. These are loaded into the `recviz_dashboards` table via the seed script.

The top-level structure:

| Key | Description |
|---|---|
| `id` | Unique dashboard identifier (used in URL routing) |
| `name` | Display name |
| `description` | Dashboard description |
| `features` | Feature flags (`cross_filter`, `drill_down`) |
| `filters` | Array of filter definitions with cascade dependencies |
| `kpis` | Array of KPI card definitions with data source references |
| `charts` | Array of chart definitions with type and layout |
| `grids` | Array of AG Grid definitions with column schemas |
| `layout` | Layout type and section ordering |

See `backend/app/config/dashboards/tlm-stats.json` for a complete example.

## Required vs Optional Settings

### Settings that cause startup failure if absent

The FastAPI backend will fail to start if:

1. **Superset is unreachable** -- The `lifespan` handler calls `superset.authenticate()` at startup. If the Superset instance at `SUPERSET_URL` is not running or credentials are wrong, the backend raises an unhandled exception and exits.

2. **`databases.json` is missing or malformed** -- The `DatabaseRegistrar` reads this file during startup. A missing file or invalid JSON causes a startup error. Individual database registration failures are logged as warnings but do not prevent startup.

3. **PostgreSQL is unreachable** -- The `RECVIZ_DB_URL` database must be available for the async SQLAlchemy engine. If the database is down, the backend cannot serve requests involving dashboards or data sources.

### Settings with defaults (safe to omit in development)

All environment variables in `backend/app/config.py` have sensible defaults for local development. The backend starts correctly with no `.env` file as long as:

- PostgreSQL is running on `localhost:5432` with user `recviz` and database `superset_meta`
- Superset is running on `localhost:8088` with admin/admin credentials
- The `databases.json` file exists at the default path

## Defaults

| Setting | Default Value | Source |
|---|---|---|
| `superset_url` | `http://localhost:8088` | `backend/app/config.py` |
| `superset_username` | `admin` | `backend/app/config.py` |
| `superset_password` | `admin` | `backend/app/config.py` |
| `redis_url` | `redis://localhost:6379/0` | `backend/app/config.py` |
| `recon_db_url` | `postgresql://recviz:recviz_dev@localhost:5432/recon_data` | `backend/app/config.py` |
| `recviz_db_url` | `postgresql+asyncpg://recviz:recviz_dev@localhost:5432/superset_meta` | `backend/app/config.py` |
| `VITE_API_BASE_URL` | `http://localhost:8000` | `frontend/src/lib/api-client.ts` |
| Superset `SECRET_KEY` | `recviz-dev-secret-key-change-in-prod` | `superset/superset_config.py` |
| Superset cache timeout | 300s (metadata), 600s (data) | `superset/superset_config.py` |
| SQLAlchemy pool size | 10 connections, 5 overflow | `backend/app/db/engine.py` |
| httpx client timeout | 120 seconds | `backend/app/main.py` |
| Superset token refresh | Re-authenticate after 25 minutes | `backend/app/services/superset_client.py` |

## Per-Environment Overrides

RecViz supports three deployment contexts with different configuration sources:

### Local Development (Native)

- **Superset**: Uses `superset_config_local.py` (SQLite + SimpleCache, no Docker needed)
- **Backend**: Reads from `backend/.env` (all defaults work out of the box)
- **Frontend**: No `.env` file needed (defaults to `http://localhost:8000`)
- **Databases**: Uses `databases.json` pointing to PostgreSQL standing in for Oracle

Start with:
```bash
# Terminal 1 — Superset
SUPERSET_CONFIG_PATH=superset/superset_config_local.py superset run -p 8088

# Terminal 2 — Backend
cd backend && uvicorn app.main:app --reload

# Terminal 3 — Frontend
cd frontend && pnpm dev
```

### Docker Compose Development

- **Superset**: Uses `superset_config.py` with Redis + PostgreSQL (Docker service names as hostnames)
- **PostgreSQL**: Configured via `docker-compose.yml` environment block (`POSTGRES_USER=recviz`, `POSTGRES_PASSWORD=recviz_dev`, `POSTGRES_DB=superset_meta`)
- **Redis**: No authentication, default port 6379
- **Init script**: `docker/init-db.sql` creates the `recon_data` database alongside `superset_meta`

Start with:
```bash
docker compose up -d
```

### Production

<!-- VERIFY: Production deployment infrastructure and configuration mechanism -->

- **Superset config**: Override `SECRET_KEY` with a strong random value. Set `POSTGRES_HOST` and `REDIS_HOST` to production service hostnames.
- **Database connections**: Set `DATABASES_CONFIG_PATH` to point to `databases.prod.json` (or a production-specific file) with real Oracle/Hive URIs and credentials.
- **Frontend**: Set `VITE_API_BASE_URL` to the production FastAPI URL before building.
- **Credentials**: Replace all default passwords (`recviz_dev`, `admin`) with production secrets managed through the deployment platform's secret store.

## Superset Cache Configuration

Superset uses Redis for multiple cache layers, each on a separate Redis database number:

| Cache Layer | Redis DB | Key Prefix | Timeout | Purpose |
|---|---|---|---|---|
| Metadata cache | `0` | `recviz_` | 300s | Dashboard/chart metadata |
| Data cache | `1` | `recviz_data_` | 600s | Query result data |
| Filter state cache | `1` | `recviz_filter_` | 600s | Saved filter selections |
| Celery broker | `2` | -- | -- | Async task queue |
| Celery result backend | `3` | -- | -- | Task results |
| SQL Lab results | `4` | `recviz_results_` | 600s | SQL Lab query results |

In the local-dev native setup (no Docker), all caches use `SimpleCache` (in-memory) and SQL Lab results use `FileSystemCache` at `~/.superset/sqllab_results/`.

## Alembic Migrations

RecViz maintains its own database tables (`recviz_dashboards`, `recviz_data_sources`, `recviz_datasets`, `recviz_charts`) in the same PostgreSQL database as Superset's metadata. To avoid conflicts with Superset's own Alembic migrations, RecViz uses a separate version table: `recviz_alembic_version`.

Configuration is in `backend/app/migrations/alembic.ini`:

```ini
[alembic]
script_location = %(here)s
sqlalchemy.url = postgresql+asyncpg://recviz:recviz_dev@localhost:5432/superset_meta
```

Run migrations with:

```bash
cd backend && alembic -c app/migrations/alembic.ini upgrade head
```

## CORS Configuration

Both the FastAPI backend and Superset are configured to accept requests from the frontend dev server:

**FastAPI** (`backend/app/main.py`):
- Allowed origins: `http://localhost:5173`, `http://localhost:3000`, `http://localhost:4200`

**Superset** (`superset/superset_config.py`):
- Allowed origins: `http://localhost:5173`, `http://localhost:8000`
- Applies to `/api/*` paths only
