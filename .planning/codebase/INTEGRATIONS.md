# External Integrations

**Analysis Date:** 2026-04-05

## APIs & External Services

### Apache Superset (Headless Query Engine)

The primary external integration. Superset runs as a Docker container and is accessed exclusively via its REST API through the FastAPI backend. The frontend never communicates with Superset directly.

- **SDK/Client:** Custom async client at `backend/app/services/superset_client.py`
- **Transport:** `httpx.AsyncClient` with 120s timeout
- **Auth:** Username/password login to `/api/v1/security/login`, receives JWT access token + CSRF token
- **Token Management:** Auto-refresh when token is older than 25 minutes (Superset default expiry is 30 min). Auto-retry on 401 with re-authentication.
- **Base URL env var:** `superset_url` (default: `http://localhost:8088`)
- **Credentials env vars:** `superset_username`, `superset_password`

**Superset API Endpoints Used:**

| Endpoint | Method | Used In | Purpose |
|----------|--------|---------|---------|
| `/api/v1/security/login` | POST | `superset_client.py:authenticate()` | JWT token acquisition |
| `/api/v1/security/csrf_token/` | GET | `superset_client.py:authenticate()` | CSRF token for mutations |
| `/api/v1/chart/data` | POST | `superset_client.py:get_chart_data()` | Execute aggregation queries via chart data API |
| `/api/v1/sqllab/execute/` | POST | `superset_client.py:execute_sql()` | Execute raw SQL (SQL Lab, config-driven queries) |
| `/api/v1/chart/` | GET | `superset_client.py:list_charts()` | List registered charts |
| `/api/v1/chart/{id}` | GET | `superset_client.py:get_chart()` | Get single chart metadata |
| `/api/v1/dataset/` | GET | `superset_client.py:list_datasets()` | List registered datasets |
| `/api/v1/dataset/{id}` | GET | `superset_client.py:get_dataset()` | Get dataset with columns |
| `/api/v1/database/` | GET/POST | `superset_client.py:list_databases()`, `create_database()` | Database CRUD |
| `/api/v1/database/{id}` | GET/PUT/DELETE | `superset_client.py:get/update/delete_database()` | Individual database management |
| `/api/v1/database/test_connection/` | POST | `superset_client.py:test_connection()` | Validate connection string |

**Two Query Paths:**

1. **Chart Data API** (`/api/v1/chart/data`) - Used by legacy `backend/app/api/charts.py` and `backend/app/api/custom.py` for aggregation queries with Superset's adhoc_filters format
2. **SQL Lab API** (`/api/v1/sqllab/execute/`) - Used by `backend/app/services/query_engine.py` for config-driven dashboards that build raw SQL from templates

### FastAPI Backend API (Frontend Integration)

The React frontend communicates exclusively with the FastAPI backend.

- **Client:** Custom fetch wrapper at `frontend/src/lib/api-client.ts`
- **Base URL env var:** `VITE_API_BASE_URL` (default: `http://localhost:8000`)
- **Auth:** None (no authentication implemented yet)
- **Response Transformation:** Automatic snake_case to camelCase key conversion on all responses (except `rows` and `columns` keys which contain DB column names)
- **Error Handling:** `ApiError` class with structured error codes, user messages, and retry-after hints

**Backend API Routes (consumed by frontend):**

| Route Prefix | File | Purpose |
|-------------|------|---------|
| `/api/dashboards` | `backend/app/api/dashboards.py` | List dashboards, get config, compute KPIs |
| `/api/data-sources` | `backend/app/api/data_sources.py` | Query data sources, merge data, distinct values |
| `/api/charts` | `backend/app/api/charts.py` | Legacy chart data via Superset chart data API |
| `/api/datasets` | `backend/app/api/datasets.py` | List/get datasets, paginated dataset data |
| `/api/databases` | `backend/app/api/databases.py` | Database CRUD (proxied to Superset) |
| `/api/sql` | `backend/app/api/sql.py` | SQL Lab execution, query history, database listing |
| `/api/search` | `backend/app/api/search.py` | Cross-entity search (dashboards, charts, datasets) |
| `/api/custom` | `backend/app/api/custom.py` | KPI aggregations, counterparty lookup |
| `/api/export` | `backend/app/api/export.py` | PDF/Excel export (STUBBED, returns job IDs only) |
| `/api/views` | `backend/app/api/views.py` | Saved views CRUD (in-memory store, not persisted) |

## Data Storage

### PostgreSQL 16 (Docker)

**Two logical databases in a single PostgreSQL instance:**

1. **`superset_meta`** - Superset internal metadata + RecViz config tables
   - Connection: `recviz_db_url` env var (async: `postgresql+asyncpg://...`)
   - Client: SQLAlchemy 2.0 async engine (`backend/app/db/engine.py`)
   - Pool: 10 connections, max overflow 5
   - Tables:
     - `recviz_dashboards` - Dashboard JSON configs (JSONB column) - `backend/app/db/models/dashboard.py`
     - `recviz_data_sources` - Data source JSON configs (JSONB column) - `backend/app/db/models/data_source.py`
     - Superset internal tables (managed by Superset's own migrations)
   - Migrations: Alembic at `backend/app/migrations/` with custom `recviz_alembic_version` table to avoid conflicts with Superset's Alembic

2. **`recon_data`** - Reconciliation data (stands in for Oracle in dev)
   - Connection: `recon_db_url` env var (sync: `postgresql://...`)
   - Client: Superset executes SQL against this via SQL Lab API
   - Tables: `bank`, `message_feed`, `item`, `tlm_bdr_relationship_header`, `recon_bank`, `reconmgmt.mr_csum_man_match_stats_hist`, plus `showcase_*` tables
   - Seeded by: `scripts/seed-postgres.py`

**Docker initialization:**
- `docker/init-db.sql` creates the `recon_data` database; `superset_meta` is created via `POSTGRES_DB` env var

### Redis 7 (Docker)

Used by Superset for multiple cache layers. Not directly accessed by FastAPI backend code (despite `redis` being in requirements.txt).

- **DB 0:** Superset general cache (`CACHE_KEY_PREFIX: recviz_`)
- **DB 1:** Superset data cache + filter state cache (`CACHE_KEY_PREFIX: recviz_data_`, `recviz_filter_`)
- **DB 2:** Celery broker (configured but Celery not yet running)
- **DB 3:** Celery result backend (configured but not active)
- **DB 4:** Superset SQL Lab results backend (`CACHE_KEY_PREFIX: recviz_results_`)
- Config: `superset/superset_config.py` lines 12-55

### File Storage

- **Local filesystem only** - Dashboard and data source configs stored as JSON files in `backend/app/config/dashboards/` and `backend/app/config/data_sources/` (seeded into PostgreSQL at startup)
- **No blob/object storage** configured

### Caching

**Server-side:**
- Redis (via Superset) - Query result caching with 5-10 minute TTL
- No direct Redis usage in FastAPI backend yet

**Client-side:**
- TanStack Query - `staleTime: 5 min`, `gcTime: 30 min`, configured in `frontend/src/lib/query-client.ts`

## Authentication & Identity

**Auth Provider:** None implemented

- No authentication middleware on FastAPI endpoints
- No user session management
- Superset uses hardcoded admin/admin credentials (`backend/app/config.py`)
- CORS allows `localhost:5173`, `localhost:3000`, `localhost:4200` (`backend/app/main.py` line 66)
- Future plan: SSO/SAML/OIDC (per CLAUDE.md)

## Monitoring & Observability

**Error Tracking:** None (no Sentry, Datadog, etc.)

**Logging:**
- Backend: Python `logging` module, `basicConfig(level=INFO)` in `backend/app/main.py`
- Frontend: `console` only (via TanStack Query `onError` callback + `sonner` toasts in `frontend/src/lib/query-client.ts`)
- Superset: Default Superset logging

**Health Checks:**
- FastAPI: `GET /health` returns `{"status": "ok", "superset": true}` (`backend/app/main.py` line 87)
- Superset: Docker healthcheck via `curl http://localhost:8088/health` (15s interval, 60s start period)
- PostgreSQL: `pg_isready` healthcheck (5s interval)
- Redis: `redis-cli ping` healthcheck (5s interval)

## CI/CD & Deployment

**Hosting:** On-premises (Citi corporate environment)

**CI Pipeline:** None configured (no `.github/workflows/`, no Jenkinsfile, no `.gitlab-ci.yml`)

**Docker:**
- `docker-compose.yml` at project root defines postgres, redis, superset services
- Superset has a custom `superset/Dockerfile` (Python 3.12-slim base with `apache-superset` + `psycopg2-binary` + `redis` + `cachelib`)
- Frontend and backend run natively (not containerized for dev)

## Environment Configuration

**Required env vars (backend):**
| Variable | Default | Required |
|----------|---------|----------|
| `superset_url` | `http://localhost:8088` | Yes |
| `superset_username` | `admin` | Yes |
| `superset_password` | `admin` | Yes |
| `redis_url` | `redis://localhost:6379/0` | For cache |
| `recon_db_url` | `postgresql://recviz:recviz_dev@localhost:5432/recon_data` | Yes |
| `recviz_db_url` | `postgresql+asyncpg://recviz:recviz_dev@localhost:5432/superset_meta` | Yes |
| `databases_config_path` | Auto-detected from `backend/app/config/databases.json` | Yes |

**Required env vars (frontend):**
| Variable | Default | Required |
|----------|---------|----------|
| `VITE_API_BASE_URL` | `http://localhost:8000` | No (has default) |

**Secrets location:**
- Backend: `backend/.env` file (exists, not committed to git)
- Superset: Docker environment variables in `docker-compose.yml` (non-sensitive defaults)

## Database Connectivity (Production Data Sources)

The `DatabaseRegistrar` service (`backend/app/services/database_registrar.py`) syncs database definitions from `backend/app/config/databases.json` into Superset at startup. The `QueryEngine` (`backend/app/services/query_engine.py`) resolves logical database names to Superset IDs for query execution.

**Supported backends** (via `backend/app/services/uri_builder.py`):
- Oracle (`oracle+cx_oracle://`) - Primary production data source
- PostgreSQL (`postgresql://`) - Local dev stand-in for Oracle
- Hive (`hive://`) - Historical/batch data
- Elasticsearch (`elasticsearch+http[s]://`) - Search/realtime data

**Current dev databases** (from `backend/app/config/databases.json`):
- `superset_db_TCOSPRD` - TLM Consumer (PostgreSQL in dev, Oracle in prod)
- `superset_db_TFINPRD` - TLM Finance
- `superset_db_TWMPRD` - TLM Wealth
- `superset_db_reconmgmt` - ReconMgmt

**Dynamic database routing:** Data sources can route queries to different databases based on filter values (e.g., TLM instance filter determines which Oracle database to query). Configured via `database_routing` in data source JSON configs.

## Webhooks & Callbacks

**Incoming:** None

**Outgoing:** None

## Planned but Not Yet Implemented

| Integration | Status | Notes |
|------------|--------|-------|
| Elasticsearch direct client | Not implemented | `elasticsearch-py` not in requirements, URI builder supports ES |
| Celery task queue | Not implemented | Superset has Celery config but no RecViz workers |
| PDF export (WeasyPrint/Playwright) | Stubbed | `backend/app/api/export.py` returns pending job IDs |
| Excel export (openpyxl) | Stubbed | Same stub as PDF |
| Authentication (SSO/SAML/OIDC) | Not started | No auth on any endpoint |
| Saved views persistence | In-memory only | `backend/app/api/views.py` uses dict, lost on restart |
| SQL query history persistence | In-memory only | `backend/app/api/sql.py` uses list, lost on restart |

---

*Integration audit: 2026-04-05*
