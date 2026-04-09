# External Integrations

**Analysis Date:** 2026-04-09

## APIs & External Services

**Apache Superset (Headless Query Engine):**
- Purpose: SQL query execution, dataset management, database connection management
- SDK/Client: Custom async client (`backend/app/services/superset_client.py`) using `httpx.AsyncClient`
- Auth: Username/password login to `/api/v1/security/login`, JWT Bearer token + CSRF token
- Token refresh: Auto re-auth on 401 or after 25 minutes (Superset default expiry is 30 min)
- Base URL env var: `superset_url` (default: `http://localhost:8088`)
- Credentials env vars: `superset_username`, `superset_password`
- Superset API endpoints used:
  - `POST /api/v1/security/login` - Authentication
  - `GET /api/v1/security/csrf_token/` - CSRF token
  - `POST /api/v1/chart/data` - Chart data queries
  - `GET/POST /api/v1/chart/` - Chart CRUD
  - `GET/POST/PUT/DELETE /api/v1/dataset/` - Dataset CRUD
  - `POST /api/v1/sqllab/execute/` - Ad-hoc SQL execution
  - `GET/POST/PUT/DELETE /api/v1/database/` - Database connection CRUD
  - `POST /api/v1/database/test_connection/` - Database connection testing
  - `GET /api/v1/dashboard/` - Dashboard listing

**Frontend API Client:**
- Implementation: Custom `fetch`-based client (`frontend/src/lib/api-client.ts`)
- Base URL: `VITE_API_BASE_URL` env var (default: `http://localhost:8000`)
- Features: Auto snake_case-to-camelCase key transformation (skips `rows`, `columns`, `data`, `config` keys), structured `ApiError` class
- Frontend never talks to Superset directly; all requests go through FastAPI

## Data Storage

**PostgreSQL 16 (Docker):**
- Purpose 1: Superset metadata store
  - Connection: `postgresql://recviz:recviz_dev@localhost:5432/superset_meta`
  - Managed by: Superset's internal Alembic migrations
- Purpose 2: RecViz application metadata (dashboards, charts, datasets, KPIs, data sources)
  - Connection env var: `recviz_db_url` (default: `postgresql+asyncpg://recviz:recviz_dev@localhost:5432/superset_meta`)
  - Client: SQLAlchemy 2.0 async with asyncpg driver (`backend/app/db/engine.py`)
  - Session factory: `async_session_factory` (pool_size=10, max_overflow=5)
  - Migrations: Alembic with custom `recviz_alembic_version` table (avoids Superset migration conflicts)
  - Tables: `recviz_dashboards`, `recviz_charts`, `recviz_datasets`, `recviz_kpis`, `recviz_data_sources`
  - All use JSONB columns for flexible config storage
- Purpose 3: Recon data (dev stand-in for Oracle)
  - Connection env var: `recon_db_url` (default: `postgresql://recviz:recviz_dev@localhost:5432/recon_data`)
  - Database created by: `docker/init-db.sql`
  - Seeded by: `scripts/seed-postgres.py`
- Docker config: `docker-compose.yml` service `postgres` (image: `postgres:16-alpine`)

**Oracle (Production):**
- Purpose: Primary reconciliation data (TLM Consumer, TLM Finance, TLM Wealth, ReconMgmt)
- Driver: `python-oracledb` in thin mode (no Oracle Instant Client required)
- Compatibility shim: `superset/superset_config.py` aliases `oracledb` as `cx_Oracle` and sets `oracledb.version = "8.3.0"` for SQLAlchemy 1.4 compatibility
- Connection pattern: `oracle://user:pass@host:1521/?service_name=SERVICE`
- Schema: `RECON_OWNER` (production), empty in dev
- Configured via: `backend/app/config/databases.prod.json`
- Query dialect handling: `backend/app/services/query_engine.py` generates Oracle-specific SQL (SYSDATE, TRUNC, DECODE for date ranges)

**Hive (Production - Historical):**
- Purpose: Historical/batch reconciliation data
- Driver: `pyhive` + `thrift` (installed in Superset container)
- Connection pattern: `hive://user@host:10000/database`
- Configured via: `backend/app/config/databases.prod.json`

**Redis 7 (Docker):**
- Purpose 1: Superset query result cache (DB 0 for general, DB 1 for data + filter state)
- Purpose 2: Superset Celery broker (DB 2) and result backend (DB 3)
- Purpose 3: Superset SQL Lab results backend (DB 4, via `cachelib.redis.RedisCache`)
- Connection: `redis://localhost:6379` (env var: `redis_url`)
- Docker config: `docker-compose.yml` service `redis` (image: `redis:7-alpine`)
- Note: Backend has `redis` Python package installed but does not directly use Redis yet

**SQLite (Local Dev Alternative):**
- Purpose: Superset metadata when running Superset natively (not in Docker)
- Location: `~/.superset/superset_local.db`
- Configured in: `superset/superset_config_local.py`
- SQL Lab results: `~/.superset/sqllab_results` (FileSystemCache)

**File Storage:**
- No external file storage service
- Dashboard configs stored in PostgreSQL JSONB columns
- Database connection configs stored as JSON files: `backend/app/config/databases.json`

**Caching:**
- Server-side: Redis via Superset (query results cached 5-10 minutes)
- Client-side: TanStack Query (`frontend/src/lib/query-client.ts`)
  - `staleTime`: 5 minutes
  - `gcTime`: 30 minutes
  - `retry`: 1
  - `refetchOnWindowFocus`: false
- Local dev (native Superset): SimpleCache (in-memory, no Redis needed)

## Authentication & Identity

**Auth Provider:**
- None implemented for RecViz users
- Superset internal auth: username/password (`admin`/`admin` for dev)
- Backend authenticates to Superset via `POST /api/v1/security/login` at startup
- No user authentication on any RecViz API endpoint
- Planned: SSO/SAML/OIDC (not yet implemented)

**CORS Configuration:**
- FastAPI (`backend/app/main.py`): Allows `http://localhost:5173`, `http://localhost:3000`, `http://localhost:4200`
- Superset (`superset/superset_config.py`): Allows `http://localhost:5173`, `http://localhost:8000`
- X-Frame-Options: `ALLOWALL` (set via custom middleware for iframe embedding)

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Datadog, etc.)

**Logs:**
- Backend: Python `logging` module (basicConfig at INFO level in `backend/app/main.py`)
- Frontend: `sonner` toast notifications for API errors (via TanStack Query's `QueryCache.onError` in `frontend/src/lib/query-client.ts`)
- Superset: Default Superset logging
- Error sanitization: `backend/app/core/errors.py` strips connection strings and truncates to 500 chars

**Health Checks:**
- FastAPI: `GET /health` returns `{"status": "ok", "superset": true}` (`backend/app/main.py`)
- Superset: `GET /health` (checked by Docker healthcheck)
- PostgreSQL: `pg_isready` (Docker healthcheck)
- Redis: `redis-cli ping` (Docker healthcheck)
- Database connection status: In-memory tracker (`backend/app/services/connection_status.py`) with states: `connected`, `unreachable`, `untested`

## CI/CD & Deployment

**Hosting:**
- On-premises RHEL servers (corporate environment, no cloud)
- Deployment archive exists: `deployment/recviz-deploy-20260409-1134.tar.gz`

**CI Pipeline:**
- None detected (no `.github/workflows/`, no `Jenkinsfile`, no `.gitlab-ci.yml`)

**Docker:**
- `docker-compose.yml` - PostgreSQL 16 + Redis 7 + Superset (3 services)
- `superset/Dockerfile` - Custom Superset image with Oracle + Hive drivers
- `superset/superset-entrypoint.sh` - Runs DB migrations, creates admin user, starts Superset

## Environment Configuration

**Required env vars (backend):**
- `superset_url` - Superset base URL (default: `http://localhost:8088`)
- `superset_username` - Superset login (default: `admin`)
- `superset_password` - Superset login (default: `admin`)
- `redis_url` - Redis connection (default: `redis://localhost:6379/0`)
- `recon_db_url` - Recon data database (default: `postgresql://recviz:recviz_dev@localhost:5432/recon_data`)
- `recviz_db_url` - RecViz metadata database (default: `postgresql+asyncpg://recviz:recviz_dev@localhost:5432/superset_meta`)
- `databases_config_path` - Path to databases.json (default: `backend/app/config/databases.json`)

**Required env vars (frontend):**
- `VITE_API_BASE_URL` - FastAPI backend URL (default: `http://localhost:8000`)

**Secrets location:**
- `backend/.env` file (not committed to git)
- Docker Compose inline env vars for dev defaults
- Production database passwords in `databases.prod.json` (placeholder `CHANGE_ME` values)

## Database Registration Flow

**Startup sequence** (defined in `backend/app/main.py` lifespan):
1. Create shared `httpx.AsyncClient` (120s timeout)
2. Authenticate `SupersetClient` to Superset
3. `DatabaseRegistrar` reads `databases.json` and syncs entries to Superset via API
4. Initialize `ConnectionStatusTracker` (in-memory, resets on restart)
5. Create `QueryEngine` (routes queries through Superset SQL Lab)
6. `DatasetSyncService` reconciles unsynced RecViz datasets to Superset virtual datasets
7. On shutdown: dispose SQLAlchemy engine, close httpx client

**Dynamic database routing** (`backend/app/services/query_engine.py`):
- Data sources can use static routing (fixed database) or dynamic routing (database selected by filter value)
- `DatabaseRegistrar` maps logical names to Superset numeric IDs
- SQL dialect-aware query building: Oracle (SYSDATE, TRUNC), PostgreSQL (CURRENT_DATE, INTERVAL), SQLite (date())
- Schema prefix stripping when target database has no schema

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Export Integration

**Current state: Stubbed** (`backend/app/api/export.py`)
- `POST /api/export/pdf` - Returns pending job ID (no actual PDF generation)
- `POST /api/export/excel` - Returns pending job ID (no actual Excel generation)
- `GET /api/export/{job_id}/status` - In-memory job status lookup
- Planned: WeasyPrint or Playwright for PDF, openpyxl for Excel (per CLAUDE.md)

## Embed Support

**Dashboard embedding:**
- Route: `frontend/src/routes/embed/dashboards/`
- X-Frame-Options middleware set to `ALLOWALL` in `backend/app/main.py`
- Allows iframe embedding of dashboards in external applications

## Scripts & Tooling

**Setup scripts** (`scripts/`):
- `seed-postgres.py` - Seeds PostgreSQL with sample recon data
- `generate-seed-db.py` - Generates seed database content
- `setup-superset-local.sh` - Sets up Superset for native (non-Docker) local dev
- `mock-audit.sh` - Mock audit script

**Seed data** (`seed/`):
- `create_recon_db.py` - Creates recon database
- `register_superset.py` - Registers databases in Superset
- `register_test_datasets.py` - Creates test datasets

---

*Integration audit: 2026-04-09*
