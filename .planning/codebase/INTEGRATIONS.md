# External Integrations

**Analysis Date:** 2026-04-04

## APIs & External Services

### Apache Superset (Headless BI Engine)

The central external integration. Superset is used exclusively as a query engine -- no Superset UI is exposed to end users. All communication flows through the FastAPI backend.

- **SDK/Client:** Custom async client at `backend/app/services/superset_client.py` using `httpx.AsyncClient`
- **Auth:** JWT-based. Login via `POST /api/v1/security/login` with username/password. CSRF token fetched from `/api/v1/security/csrf_token/`. Tokens auto-refresh after 25 minutes.
- **Env vars:** `SUPERSET_URL`, `SUPERSET_USERNAME`, `SUPERSET_PASSWORD` (in `backend/app/config.py`)
- **Connection:** HTTP REST API (Superset v1 API)
- **Endpoints consumed:**
  - `POST /api/v1/security/login` - Authentication
  - `GET /api/v1/security/csrf_token/` - CSRF token
  - `POST /api/v1/chart/data` - Chart data queries
  - `GET /api/v1/chart/` - List charts
  - `GET /api/v1/chart/{id}` - Get chart
  - `GET /api/v1/dataset/` - List datasets
  - `GET /api/v1/dataset/{id}` - Get dataset
  - `POST /api/v1/sqllab/execute/` - Execute raw SQL
  - `GET /api/v1/dashboard/` - List dashboards
  - `GET /api/v1/dashboard/{id}` - Get dashboard
  - `GET /api/v1/database/` - List databases
  - `GET /api/v1/database/{id}` - Get database
  - `POST /api/v1/database/` - Create database
  - `PUT /api/v1/database/{id}` - Update database
  - `DELETE /api/v1/database/{id}` - Delete database
  - `POST /api/v1/database/test_connection/` - Test database connection
- **Retry strategy:** Auto-retry on 401 (re-authenticate then replay request)
- **Lifecycle:** Created during FastAPI lifespan startup, shared via `app.state.superset`

### FastAPI Backend API (Frontend -> Backend)

The frontend communicates exclusively with the FastAPI backend. It never talks to Superset directly.

- **Client:** Custom fetch-based client at `frontend/src/lib/api-client.ts`
- **Base URL:** `VITE_API_BASE_URL` env var (default `http://localhost:8000`)
- **Auth:** None (no authentication implemented yet)
- **Key behaviors:**
  - Automatic snake_case to camelCase key transformation on all responses
  - Data keys (`rows`, `columns`) are excluded from key transformation to preserve DB column names
  - Throws `ApiError` on non-2xx responses (TanStack Query handles error state)
- **API routes consumed (defined in `backend/app/api/router.py`):**
  - `GET /api/dashboards` - List config-driven dashboards
  - `GET /api/dashboards/{id}` - Get dashboard config (JSON)
  - `POST /api/dashboards/{id}/kpis` - Compute KPI values
  - `POST /api/data-sources/{id}/query` - Execute data source query
  - `POST /api/data-sources/merge` - Merge multiple data source results
  - `GET /api/data-sources/{id}/distinct/{column}` - Get distinct filter values
  - `GET /api/databases` - List registered databases
  - `GET /api/databases/{id}` - Get database details
  - `GET /api/databases/{id}/datasets` - List datasets for database
  - `POST /api/databases` - Create database
  - `PUT /api/databases/{id}` - Update database
  - `DELETE /api/databases/{id}` - Delete database
  - `POST /api/databases/test` - Test database connection
  - `POST /api/databases/{id}/sync` - Sync datasets for database
  - `GET /api/charts` - List Superset charts (proxied)
  - `GET /api/datasets` - List Superset datasets (proxied)
  - `GET /api/datasets/{id}` - Get dataset details (proxied)
  - `POST /api/sql/execute` - Execute SQL (via Superset SQL Lab or mock fallback)
  - `GET /api/sql/history` - Get query history (in-memory)
  - `GET /api/sql/databases` - List databases for SQL Lab
  - `POST /api/search` - Search across dashboards/charts/datasets
  - `POST /api/export/pdf` - Export to PDF (stub -- returns job ID, not implemented)
  - `POST /api/export/excel` - Export to Excel (stub -- returns job ID, not implemented)
  - `GET /api/export/{id}/status` - Check export status (stub)
  - `GET /api/views` - List saved views (in-memory)
  - `POST /api/views` - Create saved view (in-memory)
  - `DELETE /api/views/{id}` - Delete saved view (in-memory)

## Data Storage

### PostgreSQL 16

**Purpose:** Superset metadata database + recon data (dev stand-in for Oracle)

- **Container:** `recviz-postgres` via `docker-compose.yml`
- **Databases:**
  - `superset_meta` - Superset internal metadata (created by `POSTGRES_DB` env var)
  - `recon_data` - Reconciliation data tables (created by `docker/init-db.sql`)
- **Connection:** `postgresql://recviz:recviz_dev@localhost:5432/superset_meta`
- **Recon data URI:** `postgresql://recviz:recviz_dev@localhost:5432/recon_data`
- **Schema (recon_data):** `counterparties`, `transactions` (1M rows), `breaks` (~150K rows), `daily_metrics` (365 rows)
- **Seed script:** `seed/create_recon_db.py` (uses `psycopg2` directly)
- **Tables are defined and seeded outside Superset** -- Superset connects to them as a data source

### SQLite (Local Dev Alternative)

**Purpose:** Seed database for config-driven dashboards when running without Docker

- **Location:** `backend/app/config/seed/seed.db`
- **Generated by:** `scripts/generate-seed-db.py`
- **Tables:** `bank`, `message_feed`, `item`, `tlm_bdr_relationship_header`, `recon_bank`, `mr_csum_man_match_stats_hist`
- **Registered via:** `backend/app/config/databases.json` (4 logical databases, all pointing to same seed.db)
- **Also used for Superset metadata in local mode** via `superset/superset_config_local.py` at `~/.superset/superset_local.db`

### Redis 7

**Purpose:** Multi-purpose caching and task queue

- **Container:** `recviz-redis` via `docker-compose.yml`
- **Connection:** `redis://localhost:6379`
- **Databases used (separated by Redis DB number):**
  - DB 0: Superset general cache (`CACHE_CONFIG`)
  - DB 1: Superset data cache + filter state cache (`DATA_CACHE_CONFIG`, `FILTER_STATE_CACHE_CONFIG`)
  - DB 2: Celery broker (`CeleryConfig.broker_url`)
  - DB 3: Celery result backend (`CeleryConfig.result_backend`)
  - DB 4: SQL Lab results backend (`RESULTS_BACKEND`)
- **Configuration:** `superset/superset_config.py`
- **Not required for local dev** -- `superset_config_local.py` uses `SimpleCache` instead

### Production Target Databases (Not Yet Connected)

**Oracle:**
- Primary production data source for reconciliation data
- URI pattern: `oracle+cx_oracle://{user}:{pass}@{host}:{port}/?service_name={db}` (built by `backend/app/services/uri_builder.py`)
- Default port: 1521
- Driver: `oracledb` (optionally installed in `scripts/setup-superset-local.sh`)
- SQL dialect handling: Oracle-specific `SYSDATE`, `TRUNC()`, `DECODE()`, `TO_CHAR()` in `backend/app/services/query_engine.py`

**Hive:**
- Historical/batch data source
- URI pattern: `hive://{user}:{pass}@{host}:{port}/{db}`
- Default port: 10000
- Not yet connected in any config

**Elasticsearch:**
- Search/realtime data source
- URI pattern: `elasticsearch+{http|https}://{host}:{port}/`
- Default port: 9200
- `elasticsearch-py` referenced in CLAUDE.md but NOT in `backend/requirements.txt` (not yet installed)
- No ES client service exists yet in `backend/app/services/`

**File Storage:**
- Local filesystem only (no S3, GCS, or blob storage)
- SQL Lab results cached to `~/.superset/sqllab_results/` in local dev mode

**Caching:**
- Redis (Docker mode) or SimpleCache (local mode) -- see Redis section above

## Authentication & Identity

**Auth Provider:** None implemented

- No authentication on any FastAPI endpoint
- No auth middleware in `backend/app/main.py`
- Superset authentication is backend-to-backend only (admin/admin credentials)
- Frontend has no login page, no token management, no auth headers
- CLAUDE.md notes: "Auth strategy TBD (will be added later, likely SSO/SAML/OIDC)"

**CORS Configuration:**
- FastAPI allows origins: `http://localhost:5173`, `http://localhost:3000`, `http://localhost:4200`
- Superset allows origins: `http://localhost:5173`, `http://localhost:8000`
- Both allow all methods and headers with credentials

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, DataDog, or similar)

**Logging:**
- Python `logging` module (configured in `backend/app/main.py` via `logging.basicConfig(level=logging.INFO)`)
- Frontend: no structured logging framework (browser console only)

**Health Checks:**
- `GET /health` on FastAPI (`backend/app/main.py`) -- returns `{"status": "ok", "superset": true}`
- `GET /api/test-superset` -- tests Superset connectivity and lists datasets
- Docker Compose health checks on PostgreSQL (`pg_isready`), Redis (`redis-cli ping`), and Superset (`curl /health`)

## CI/CD & Deployment

**Hosting:** Not yet defined

**CI Pipeline:** None configured (no `.github/workflows/`, no `Jenkinsfile`, no `Makefile`)

**Docker:**
- `docker-compose.yml` -- PostgreSQL 16 + Redis 7 + Superset (3 services)
- `superset/Dockerfile` -- Python 3.12-slim with Superset + psycopg2 + redis + cachelib
- No Dockerfile for FastAPI backend
- No Dockerfile for frontend build

## Webhooks & Callbacks

**Incoming:** None

**Outgoing:** None

## Environment Configuration

**Required env vars for production:**
- `SUPERSET_URL` - Superset API endpoint
- `SUPERSET_USERNAME` / `SUPERSET_PASSWORD` - Superset service account
- `REDIS_URL` - Redis for caching
- `RECON_DB_URL` - Primary recon database
- `VITE_API_BASE_URL` - Backend URL for frontend build
- `SECRET_KEY` - Superset Flask secret
- `POSTGRES_HOST` / `REDIS_HOST` - Service discovery (Docker)

**Required env vars for local dev:**
- None strictly required -- all have defaults in `backend/app/config.py`
- `backend/.env` file present for overrides

**Secrets location:**
- `backend/.env` (local dev)
- No secrets management service configured for production

## Database Registration & Routing

**Config-driven database management:**

The `DatabaseRegistrar` at `backend/app/services/database_registrar.py` reads `backend/app/config/databases.json` at startup and:
1. Compares entries against databases already registered in Superset
2. Creates missing databases in Superset via its REST API
3. Caches logical name -> Superset numeric ID mappings
4. Supports cache refresh with lock and negative caching

**Dynamic database routing:**

Data source configs (e.g., `backend/app/config/data_sources/tlm_breaks.json`) can specify dynamic routing:
- `route_by_filter`: a filter ID determines which database to query
- `mapping`: maps filter values to database names
- Example: filter `tlm_instance=TLMP_CONSUMER` routes to database `superset_db_TCOSPRD`

This is handled by `QueryEngine._resolve_database()` at `backend/app/services/query_engine.py`.

## Mock Data Fallback

When Superset is unavailable, most API endpoints fall back to mock data defined in `backend/app/mock_data.py`:
- Mock KPIs, datasets, charts, dashboards, databases
- 200 mock break rows with randomized data
- Mock SQL execution with basic SELECT/WHERE/LIMIT parsing

This dual-mode design is visible across `backend/app/api/sql.py`, `backend/app/api/databases.py`, `backend/app/api/search.py`, etc. Each checks `if superset:` before falling back.

---

*Integration audit: 2026-04-04*
