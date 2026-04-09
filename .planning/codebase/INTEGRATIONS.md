# External Integrations

**Analysis Date:** 2026-04-09

## APIs & External Services

**None.** RecViz is a fully self-contained, on-prem application. It does not call any external SaaS APIs, third-party services, or cloud endpoints. All data access is direct database connections managed internally.

**Internal API (Frontend to Backend):**
- Frontend SPA communicates with FastAPI backend via REST API
- Base URL: `VITE_API_BASE_URL` (defaults to `http://localhost:8000`)
- Client: Custom `fetch`-based API client at `frontend/src/lib/api-client.ts`
- Auto snake_case-to-camelCase key transformation on responses
- Structured error handling via `ApiError` class
- No authentication tokens or API keys required (auth not implemented)

## Data Storage

### Databases

**PostgreSQL 16 (Metadata + Dev Data):**
- Container: `recviz-postgres` via `docker-compose.yml`
- Two databases on the same instance:
  - `superset_meta` - RecViz application metadata (dashboards, charts, KPIs, datasets, data sources, connections)
  - `recon_data` - Development stand-in for Oracle recon data
- Init script: `docker/init-db.sql` creates the `recon_data` database
- Metadata connection (async): `recviz_db_url` env var, uses `asyncpg` driver
  - Engine: `backend/app/db/engine.py` - pool_size=10, max_overflow=5
  - Session factory: `async_session_factory` with `expire_on_commit=False`
- ORM: SQLAlchemy 2.0 declarative style with `Mapped[T]` + `mapped_column()`
- Base class: `backend/app/db/base.py`
- All table names prefixed with `recviz_` (e.g., `recviz_dashboards`, `recviz_connections`)
- Portable JSON type: `backend/app/db/types.py` - `PortableJSON` uses JSONB on PostgreSQL, CLOB+JSON serialization on Oracle

**Oracle (Production Recon Data):**
- Driver: `oracledb` thin mode (no Oracle Instant Client required)
- Async dialect: `oracle+oracledb://` via SQLAlchemy `create_async_engine`
- URI builder: `backend/app/services/uri_builder.py` - supports `oracle`, `postgresql`, `hive`, `elasticsearch` backends
- Default port: 1521
- Connection format: `oracle+oracledb://user:pass@host:port/?service_name=SID`
- SQL dialect handling: Oracle-specific date functions (`SYSDATE`, `TRUNC`, `DECODE`), `OFFSET FETCH` pagination, UPPERCASE column normalization

**Connection Management (Dynamic):**
- Connections stored in `recviz_connections` table (`backend/app/db/models/connection.py`)
- Fields: id, name, display_name, backend, host, port, database_name, username, encrypted_password, schema_name, extra_params, status
- Passwords encrypted at rest via Fernet (AES-128-CBC + HMAC-SHA256): `backend/app/services/encryption.py`
- Encryption key: `RECVIZ_ENCRYPTION_KEY` env var (Fernet-generated, URL-safe base64, 32 bytes)
- Engine pool per connection: `backend/app/services/engine_manager.py`
  - Pool settings: pool_size=5, max_overflow=10, pool_timeout=30s, pool_recycle=1800s, pool_pre_ping=True
  - Engines created lazily, cached by connection UUID, disposed on update/delete
  - Pre-warmed at startup for all registered connections
- Connection resolver: `backend/app/services/connection_resolver.py` - in-memory cache of name-to-UUID mappings (no passwords cached)
- Connection status tracker: `backend/app/services/connection_status.py` - in-memory, resets on restart
- Test endpoint: `POST /api/databases/test` - creates disposable single-connection engine, executes health check
- CRUD: `backend/app/api/databases.py` - full create/read/update/delete for connections

### Database Models (RecViz Metadata)

| Table | Model File | Purpose |
|-------|-----------|---------|
| `recviz_connections` | `backend/app/db/models/connection.py` | Database connection credentials |
| `recviz_dashboards` | `backend/app/db/models/dashboard.py` | Dashboard definitions (JSONB config) |
| `recviz_charts` | `backend/app/db/models/chart.py` | Chart definitions |
| `recviz_kpis` | `backend/app/db/models/kpi.py` | KPI definitions |
| `recviz_datasets` | `backend/app/db/models/dataset.py` | Dataset definitions |
| `recviz_data_sources` | `backend/app/db/models/data_source.py` | Data source query configs (JSONB) |

### Migrations

- Alembic with async support: `backend/app/migrations/`
- Uses `recviz_alembic_version` table (not default `alembic_version`) to avoid conflicts with Superset
- 7 migrations: initial schema through connection/portable-JSON additions
- Config: `backend/app/migrations/alembic.ini`

**File Storage:**
- Local filesystem only (no S3, Azure Blob, or equivalent)
- Export endpoints (`backend/app/api/export.py`) are stubs - no actual file generation

**Caching:**
- No server-side cache (Redis removed with Superset)
- Client-side: TanStack Query with staleTime=5min, gcTime=30min (`frontend/src/lib/query-client.ts`)
- In-memory caches in backend:
  - `ConnectionResolver._cache` - name-to-UUID mappings, synced from DB at startup
  - `ConnectionStatusTracker._status` - connection health, resets on restart
  - `EngineManager._engines` - SQLAlchemy engine pool per connection
  - `_query_history` in `backend/app/api/sql.py` - last 200 SQL Explorer queries (single-worker only)

## Authentication & Identity

**Auth Provider:** None implemented

- No authentication middleware on any endpoint
- No authorization checks
- CORS configured for localhost origins: `http://localhost:5173`, `http://localhost:3000`, `http://localhost:4200`
- X-Frame-Options: SAMEORIGIN (set via `XFrameOptionsMiddleware` in `backend/app/main.py`)
- Future auth strategy: likely SSO/SAML/OIDC (noted in CLAUDE.md, not implemented)

## Monitoring & Observability

**Error Tracking:**
- No external error tracking service (no Sentry, Datadog, etc.)
- Backend: Python `logging` module, `logging.basicConfig(level=logging.INFO)` in `backend/app/main.py`
- Frontend: TanStack Query `onError` handler toasts errors via Sonner (`frontend/src/lib/query-client.ts`)

**Logs:**
- Backend: Standard Python logging, one logger per module (`logger = logging.getLogger(__name__)`)
- Used for: startup events, connection status, query execution errors
- Error sanitization: `backend/app/core/errors.py` - `sanitize_detail()` truncates to 500 chars, redacts connection URIs
- No structured logging (no JSON log format)
- No log aggregation service

**Health Check:**
- `GET /health` returns `{"status": "ok"}` (`backend/app/main.py`)
- Database connection health tracked in-memory by `ConnectionStatusTracker`

## CI/CD & Deployment

**Hosting:**
- On-prem RHEL servers (corporate environment)
- No cloud hosting

**CI Pipeline:**
- None configured
- No `.github/workflows/`, Jenkinsfile, or CI config files present
- No automated test execution in CI

**Docker (Development Only):**
- `docker-compose.yml` - PostgreSQL 16 Alpine container only
- No application Dockerfiles (no `frontend/Dockerfile` or `backend/Dockerfile`)
- Docker not used in production

## Environment Configuration

**Required env vars:**
- `RECVIZ_ENCRYPTION_KEY` - Fernet encryption key for database credential encryption (**mandatory, no default**)
- `recon_db_url` - PostgreSQL connection string for recon data (has dev default)
- `recviz_db_url` - Async PostgreSQL connection for RecViz metadata (has dev default)
- `VITE_API_BASE_URL` - Frontend API target (defaults to `http://localhost:8000`)

**Secrets location:**
- `backend/.env` file (exists, not committed to git)
- Database passwords encrypted in `recviz_connections.encrypted_password` column via Fernet

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## API Routes

All backend API routes registered in `backend/app/api/router.py`:

| Route Prefix | File | Purpose |
|-------------|------|---------|
| `/api/dashboards` | `backend/app/api/managed_dashboards.py` | Dashboard CRUD |
| `/api/data-sources` | `backend/app/api/data_sources.py` | Data source config + query execution |
| `/api/databases` | `backend/app/api/databases.py` | Database connection CRUD + test |
| `/api/kpis` | `backend/app/api/managed_kpis.py` | KPI CRUD |
| `/api/charts` | `backend/app/api/managed_charts.py` | Chart CRUD |
| `/api/datasets` | `backend/app/api/managed_datasets.py` | Dataset CRUD |
| `/api/sql` | `backend/app/api/sql.py` | SQL Explorer (execute, databases, history) |
| `/api/search` | `backend/app/api/search.py` | Cross-entity search (ilike on name/description) |
| `/api/export` | `backend/app/api/export.py` | PDF/Excel export stubs (not implemented) |
| `/api/views` | `backend/app/api/views.py` | Saved views |
| `/health` | `backend/app/main.py` | Health check endpoint |

## Query Execution Pipeline

Direct database execution (no Superset proxy):

1. **Frontend** calls `api.get('/api/data-sources/{id}/data?filters=...')` via `frontend/src/lib/api-client.ts`
2. **Route handler** resolves data source config via `ConfigStoreDep` (`backend/app/core/dependencies.py`)
3. **QueryExecutor** (`backend/app/services/query_engine.py`):
   - Resolves target database via `ConnectionResolver` (static or dynamic routing)
   - Builds SQL from template: replaces `{{filters}}`, `{{values}}`, `{{date_range_clause}}` placeholders
   - Wraps with dialect-aware pagination (`backend/app/services/query_utils.py`)
   - Executes via `EngineManager.get_engine_for_connection()` -> `AsyncEngine.connect()` -> `text(sql)`
   - 30-second timeout for dashboard queries, 60-second for SQL Explorer
4. **Response** shaped by `build_result_response()` - normalizes Oracle UPPERCASE columns, maps DB types to RecViz types (string/number/date)
5. **Frontend** receives response, TanStack Query caches it for 5 minutes

## Supported Database Backends

| Backend | Async Driver | Sync Driver | Dialect | Default Port | Status |
|---------|-------------|-------------|---------|--------------|--------|
| PostgreSQL | `asyncpg` | `psycopg2` | `postgresql+asyncpg` | 5432 | Active (dev + metadata) |
| Oracle | `oracledb` | `oracledb` | `oracle+oracledb` | 1521 | Production target |
| Hive | Not async | `pyhive` | `hive` | 10000 | URI builder only (no async support) |
| Elasticsearch | Not async | N/A | `elasticsearch+http(s)` | 9200 | URI builder only (not in requirements) |

Note: Hive and Elasticsearch are defined in `uri_builder.py` sync URI builder but lack async dialect support. Only PostgreSQL and Oracle are supported for async execution via `EngineManager`.

---

*Integration audit: 2026-04-09*
