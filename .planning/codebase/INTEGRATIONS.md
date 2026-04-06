# External Integrations

**Analysis Date:** 2026-04-06

## APIs & External Services

**Apache Superset (Headless Query Engine):**
- Purpose: SQL query execution, dataset management, database registration, chart data aggregation
- Container: `recviz-superset` on `http://localhost:8088` (Docker) or native install
- SDK/Client: Custom async client at `backend/app/services/superset_client.py` using `httpx.AsyncClient`
- Auth: Username/password login via `/api/v1/security/login`, JWT access token + CSRF token
- Token lifecycle: Auto-refresh after 25 minutes (Superset default expiry is 30 min), auto-retry on 401
- API endpoints used:
  - `POST /api/v1/security/login` - Authentication
  - `GET /api/v1/security/csrf_token/` - CSRF token fetch
  - `POST /api/v1/chart/data` - Chart data queries
  - `GET/POST /api/v1/chart/` - Chart CRUD
  - `GET/POST/PUT/DELETE /api/v1/dataset/` - Dataset CRUD (virtual datasets)
  - `POST /api/v1/sqllab/execute/` - Raw SQL execution
  - `GET/POST/PUT/DELETE /api/v1/database/` - Database connection CRUD
  - `POST /api/v1/database/test_connection/` - Connection testing
  - `GET /api/v1/dashboard/` - Dashboard listing (Superset-native, not primary)
- Auth env vars: `SUPERSET_USERNAME`, `SUPERSET_PASSWORD` (via `backend/app/config.py`)
- Connection env var: `SUPERSET_URL` (default: `http://localhost:8088`)

**Frontend-to-Backend:**
- Custom `fetch`-based API client at `frontend/src/lib/api-client.ts`
- Base URL: `VITE_API_BASE_URL` env var (default: `http://localhost:8000`)
- Auto snake_case-to-camelCase key transformation (skips `rows`, `columns`, `data`, `config` keys)
- Error handling: `ApiError` class with status, code, userMessage, retryAfter
- No auth headers (authentication not yet implemented)

## Data Storage

**PostgreSQL 16 (Docker):**
- Container: `recviz-postgres`
- Two databases on same instance:
  1. `superset_meta` - Superset internal metadata (created by `POSTGRES_DB` env var)
  2. `recon_data` - Reconciliation data (created by `docker/init-db.sql`)
- Connection: `postgresql://recviz:recviz_dev@localhost:5432/superset_meta` (Superset metadata)
- Connection: `postgresql+asyncpg://recviz:recviz_dev@localhost:5432/superset_meta` (RecViz async ORM)
- Connection: `postgresql://recviz:recviz_dev@localhost:5432/recon_data` (recon data via Superset)
- ORM: SQLAlchemy 2.0 async with `asyncpg` driver (`backend/app/db/engine.py`)
- Session factory: `async_sessionmaker` with pool_size=10, max_overflow=5
- Migrations: Alembic with async engine, uses `recviz_alembic_version` table (`backend/app/migrations/env.py`)
- RecViz tables:
  - `recviz_dashboards` - Dashboard config storage (`backend/app/db/models/dashboard.py`)
  - `recviz_data_sources` - Data source config storage (`backend/app/db/models/data_source.py`)
  - `recviz_datasets` - Managed dataset metadata (`backend/app/db/models/dataset.py`)
  - `recviz_charts` - Managed chart metadata (`backend/app/db/models/chart.py`)

**Oracle (Production - not connected in dev):**
- Primary reconciliation data source
- Accessed via Superset using `oracledb` driver in thin mode (no Oracle Instant Client needed)
- Driver compatibility: `oracledb` aliased as `cx_Oracle` for SQLAlchemy 1.4 compat (`superset/superset_config.py`)
- URI pattern: `oracle://{user}:{pass}@{host}:{port}/?service_name={db}`
- Connection builder: `backend/app/services/uri_builder.py`
- Default port: 1521
- Database routing: Static or dynamic per data source config (`backend/app/services/query_engine.py`)

**Hive (Production - not connected in dev):**
- Historical/batch reconciliation data
- Accessed via Superset using `pyhive` + `thrift` drivers
- URI pattern: `hive://{user}:{pass}@{host}:{port}/{db}`
- Default port: 10000
- Installed in Superset Docker image with `libsasl2-dev` system dependency

**Elasticsearch (Production - not connected in dev):**
- Search/realtime reconciliation data
- URI pattern: `elasticsearch+{http|https}://{host}:{port}/`
- Default port: 9200
- URI builder supports it (`backend/app/services/uri_builder.py`) but no direct `elasticsearch-py` client is currently implemented in backend code
- Listed in CLAUDE.md as planned but not yet integrated

**Redis 7 (Docker):**
- Container: `recviz-redis` on port 6379
- Used by Superset (not directly by FastAPI backend):
  - DB 0: General cache (`CACHE_CONFIG`)
  - DB 1: Data cache + filter state cache (`DATA_CACHE_CONFIG`, `FILTER_STATE_CACHE_CONFIG`)
  - DB 2: Celery broker (`CeleryConfig.broker_url`)
  - DB 3: Celery result backend
  - DB 4: SQL Lab results backend (`RESULTS_BACKEND`)
- Backend has `redis` package installed but no direct Redis usage in FastAPI code yet
- Env var: `REDIS_URL` (default: `redis://localhost:6379/0`)

**File Storage:**
- Local filesystem only. No cloud storage integration.

**Caching:**
- Server-side: Redis via Superset (query results cached 5-10 min)
- Client-side: TanStack Query (`frontend/src/lib/query-client.ts`)
  - `staleTime`: 5 minutes
  - `gcTime`: 30 minutes
  - `retry`: 1
  - `refetchOnWindowFocus`: false
  - Global error handler shows toast via Sonner

## Authentication & Identity

**Current State: No Authentication**
- No auth middleware on FastAPI endpoints
- No auth headers sent from frontend API client
- Superset auth is backend-to-Superset only (JWT, not exposed to users)
- CORS allows `localhost:5173`, `localhost:3000`, `localhost:4200`
- `X-Frame-Options: ALLOWALL` middleware (for embedding)

**Planned:**
- SSO/SAML/OIDC (strategy TBD, per CLAUDE.md)

## Database Registration & Routing

**Database Registrar (`backend/app/services/database_registrar.py`):**
- Reads `backend/app/config/databases.json` at startup
- Syncs configured databases into Superset (creates if missing, caches Superset IDs)
- Resolves logical database names to Superset numeric IDs at query time
- Caches name->entry mapping with negative cache for missing entries
- Auto-refreshes cache from Superset every 30 seconds on cache miss

**Database Config (`backend/app/config/databases.json`):**
- Current entries (all pointing to local PostgreSQL in dev):
  - `superset_db_TCOSPRD` - TLM Consumer
  - `superset_db_TFINPRD` - TLM Finance
  - `superset_db_TWMPRD` - TLM Wealth
  - `superset_db_reconmgmt` - ReconMgmt
- Each entry has: name, display_name, sqlalchemy_uri, dialect, schema, type

**Query Engine (`backend/app/services/query_engine.py`):**
- Resolves database routing (static or dynamic based on filter values)
- Builds SQL from data source config templates with filter clause injection
- Handles date range clauses for Oracle, PostgreSQL, and SQLite dialects
- Tracks connection health via `ConnectionStatusTracker` (`backend/app/services/connection_status.py`)
- Detects connection failures from Superset HTTP responses (including 400s with connection error bodies)

**Connection Status Tracker (`backend/app/services/connection_status.py`):**
- In-memory tracker (resets on process restart)
- States: `connected`, `unreachable`, `untested`
- Updated on every query execution success/failure
- Exposed via database list/detail API endpoints

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Datadog, etc.)

**Logs:**
- Python `logging` module (basic config in `backend/app/main.py`)
- INFO level by default
- Error sanitization: `backend/app/core/errors.py` strips connection URIs and truncates to 500 chars before sending to clients

## CI/CD & Deployment

**Hosting:**
- On-premises (Citi internal infrastructure)

**CI Pipeline:**
- None detected in repository (no `.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`)

**Docker:**
- `docker-compose.yml` at project root defines: PostgreSQL 16, Redis 7, Superset (custom build)
- Superset Dockerfile: `superset/Dockerfile` (Python 3.12-slim base)
- No Docker config for FastAPI backend or frontend (run natively in dev)

## Environment Configuration

**Required env vars (backend `backend/app/config.py`):**
- `SUPERSET_URL` - Superset API base URL (default: `http://localhost:8088`)
- `SUPERSET_USERNAME` - Superset admin username (default: `admin`)
- `SUPERSET_PASSWORD` - Superset admin password (default: `admin`)
- `REDIS_URL` - Redis connection string (default: `redis://localhost:6379/0`)
- `RECON_DB_URL` - Recon data database URI (default: PostgreSQL local)
- `RECVIZ_DB_URL` - RecViz metadata database URI (default: PostgreSQL async local)
- `DATABASES_CONFIG_PATH` - Path to databases.json (default: `backend/app/config/databases.json`)

**Required env vars (frontend):**
- `VITE_API_BASE_URL` - FastAPI backend URL (default: `http://localhost:8000`)

**Required env vars (Superset container):**
- `POSTGRES_HOST` - PostgreSQL host (default: `localhost`, Docker: `postgres`)
- `REDIS_HOST` - Redis host (default: `localhost`, Docker: `redis`)
- `SECRET_KEY` - Superset secret key (hardcoded dev default in config)

**Secrets location:**
- `backend/.env` file (gitignored, contains local dev credentials)
- Superset credentials hardcoded in `superset/superset_config.py` for dev
- Production secrets: TBD (no secrets management integration)

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Dataset Sync Pipeline

**DatasetSyncService (`backend/app/services/dataset_sync.py`):**
- Syncs RecViz-managed datasets to Superset as virtual datasets
- Creates on first sync (POST), updates on subsequent syncs (PUT)
- Reconciles unsynced datasets at startup (recovers from previous failures)
- Sync status tracked per dataset: `unsynced`, `synced`, `error`
- Non-blocking: save succeeds even if Superset sync fails

## Export (Stubbed)

**PDF Export (`backend/app/api/export.py`):**
- Endpoint exists (`POST /api/export/pdf`) but returns fake job ID
- In-memory job store, no actual PDF generation
- Planned: WeasyPrint or Playwright

**Excel Export (`backend/app/api/export.py`):**
- Endpoint exists (`POST /api/export/excel`) but returns fake job ID
- No actual Excel generation
- Planned: openpyxl

## Search Integration

**Internal Search (`backend/app/api/search.py`):**
- Searches dashboards (from ConfigStore/DB), charts (from Superset), datasets (from Superset)
- Simple string matching (case-insensitive `in` check)
- No external search engine (Elasticsearch client not integrated despite being in requirements plan)

---

*Integration audit: 2026-04-06*
