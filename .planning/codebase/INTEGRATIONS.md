# External Integrations

**Analysis Date:** 2026-04-11

## APIs & External Services

**Data Query (internal FastAPI -> target DBs):**
- No external HTTP APIs are called from the backend. FastAPI is the only backend service, and it talks directly to databases via SQLAlchemy engines managed in `backend/app/services/engine_manager.py`.
- Previous Superset HTTP integration has been removed. No `httpx` or `requests` HTTP client dependency is declared in `backend/requirements.txt`.
- A historical/obsolete reference to an Elasticsearch URI builder survives in `backend/app/services/uri_builder.py` (`DEFAULT_PORTS["elasticsearch"] = 9200`, branch for `backend == "elasticsearch"`), but no Elasticsearch client is installed and no call site uses it.

**Frontend -> Backend:**
- The React SPA calls FastAPI directly via `frontend/src/lib/api-client.ts`. Base URL from `import.meta.env.VITE_API_BASE_URL` (default `http://localhost:8000`).
- In production the SPA is served by the same FastAPI process (`frontend/dist/` is mounted at `/` in `backend/app/main.py`), so the only cross-service boundary is FastAPI -> database.

## Data Storage

**Primary RecViz Metadata DB (required):**
- Type/Provider: PostgreSQL 16 (dev, via Docker `postgres:16-alpine` in `docker-compose.yml`) or Oracle (prod)
- Connection: `RECVIZ_DB_URL` env var, read by `backend/app/config.py`
- Default dev URI: `postgresql+asyncpg://recviz:recviz_dev@localhost:5432/superset_meta` (the `+asyncpg` prefix is legacy from the async era and is tolerated by the sync `create_engine` call in `backend/app/db/engine.py`)
- Client: SQLAlchemy 2.0.49 sync engine + sessionmaker in `backend/app/db/engine.py`
- Pool config: `pool_size=10, max_overflow=5, pool_pre_ping=True`
- ORM models under `backend/app/db/models/`:
  - `RecvizConnection` (`connection.py`) - Registered data source connections, with Fernet-encrypted passwords
  - `RecvizDashboard` (`dashboard.py`) - Dashboard configs (JSONB)
  - `RecvizChart` (`chart.py`)
  - `RecvizKpi` (`kpi.py`)
  - `RecvizDataset` (`dataset.py`)
  - `RecvizDataSource` (`data_source.py`)
- Migrations: Alembic 1.18.4 at `backend/app/migrations/`, versions in `backend/app/migrations/versions/` (currently through `007_dataset_database_id_to_string.py`). Uses a custom version table `recviz_alembic_version` (configured in `backend/app/migrations/env.py`) to avoid collisions with any pre-existing Superset metadata.

**Recon Data DB (dev stand-in):**
- Type/Provider: PostgreSQL 16 (same container as metadata DB; separate database `recon_data` created by `docker/init-db.sql`)
- Connection: `RECON_DB_URL` env var, default `postgresql://recviz:recviz_dev@localhost:5432/recon_data`
- Note: Referenced in `backend/app/config.py` but the active query path goes through `RecvizConnection` rows via `ConnectionResolver` + `EngineManager`, so `RECON_DB_URL` functions mainly as a seed script target and legacy value.

**User-Registered Data Sources (dynamic, at runtime):**
- Supported backends (per `backend/app/services/uri_builder.py` `SYNC_DIALECTS`):
  - Oracle: `oracle+oracledb://...?service_name=...` (thick mode via Instant Client at `/opt/oraclient/19.3_64/lib/`, initialized in `backend/app/main.py`)
  - PostgreSQL: `postgresql+psycopg2://...`
- Historical backend strings still referenced in port defaults but NOT in `SYNC_DIALECTS`: `hive`, `elasticsearch`. These are dead code paths — no driver is installed.
- Registration: `POST /api/databases` via `backend/app/api/databases.py`
- Encryption at rest: Fernet (AES-128-CBC + HMAC-SHA256) via `backend/app/services/encryption.py`, keyed by `RECVIZ_ENCRYPTION_KEY`
- Engine management: `EngineManager` in `backend/app/services/engine_manager.py`
  - Pool defaults: `pool_size=5, max_overflow=10, pool_timeout=30, pool_recycle=1800, pool_pre_ping=True`
  - Per-query execution timeout: 60s, enforced via `statement_timeout` connect option for PostgreSQL, and via a `connect` event listener that sets `dbapi_conn.call_timeout` for Oracle (`call_timeout` is a `Connection` attribute on python-oracledb, not a `connect()` kwarg)
  - Pre-warmed at app startup in the `lifespan` handler (`backend/app/main.py` lines 80-90)
  - Health-check sweep runs at startup via a `ThreadPoolExecutor(max_workers=4)` (`backend/app/main.py` lines 93-157), using `EngineManager.test_connection` which runs `SELECT 1` (PG) or `SELECT 1 FROM DUAL` (Oracle) and writes results back to `recviz_connections.status`

**File Storage:**
- Local filesystem only. Static frontend build served from `frontend/dist/` (path computed in `backend/app/main.py` as `Path(__file__).resolve().parents[2] / "frontend" / "dist"`).

**Caching:**
- None on the backend. Redis is explicitly not used (see CLAUDE.md "No Redis" constraint).
- Client-side caching only via TanStack Query (`frontend/src/lib/query-client.ts`): `staleTime: 5 min`, `gcTime: 30 min`, `retry: 1`, `refetchOnWindowFocus: false`.

## Authentication & Identity

**Auth Provider:**
- None. No authentication middleware, no login routes, no session management, and no user model in the database schema.
- Access control is perimeter-based (on-prem / VPN / reverse proxy level), not enforced by the app.
- `backend/app/main.py` adds two middlewares only: `CORSMiddleware` (allows `http://localhost:5173`, `http://localhost:3000`, `http://localhost:4200` with credentials) and `XFrameOptionsMiddleware` (sets `X-Frame-Options: SAMEORIGIN`).

**Credential Storage:**
- Database credentials for registered data sources are encrypted at rest in the `recviz_connections.encrypted_password` column (Text) via Fernet. Plaintext lives only in memory inside `EngineManager` long enough to build a SQLAlchemy URI via `build_sync_uri()` and create the engine.
- Engine manager fast path avoids decrypting the password when the engine is already cached (`backend/app/services/engine_manager.py` `get_engine_for_connection`).

## Monitoring & Observability

**Error Tracking:**
- No external error tracker. No Sentry, Datadog, or similar SDK in the codebase.
- Frontend surface: TanStack Query `QueryCache.onError` handler (`frontend/src/lib/query-client.ts`) shows `ApiError.userMessage` via Sonner toasts.

**Logging:**
- Python `logging` module, configured via `logging.basicConfig(level=logging.INFO)` in `backend/app/main.py` line 14.
- Per-module loggers: `logger = logging.getLogger(__name__)` (consistent convention).
- Credential-scrubbing: `EngineManager.test_connection` strips URIs of `user:pass@` via regex (`backend/app/services/engine_manager.py` lines 205-208). Error detail sanitization via `sanitize_detail()` in `backend/app/core/errors.py`.

**Health Endpoints:**
- `GET /health` returns `{"status": "ok"}` (`backend/app/main.py` lines 212-213). Registered BEFORE the SPA static mount, per the comment in `main.py`.
- Per-connection status is tracked in memory by `ConnectionStatusTracker` (`backend/app/services/connection_status.py`), resets on backend restart, and persisted to `recviz_connections.status` at startup sweep time.

## CI/CD & Deployment

**Hosting:**
- Production: RHEL on-prem, native processes (no Docker in prod). See `project_rhel_deploy_state` memory and `docs/DEPLOYMENT.md` for state.
- Frontend prod delivery: bundled `frontend/dist/` served by the FastAPI process itself via `StaticFiles(html=True)` mount at `/` in `backend/app/main.py`, with a 404 handler that falls through to `index.html` for client-side routes but preserves JSON 404s for `/api/*`.

**CI Pipeline:**
- No CI config files detected (no `.github/workflows/`, no `.gitlab-ci.yml`, no `.circleci/`).

**Deployment Artifacts:**
- Frontend: `pnpm build` produces `frontend/dist/`
- Backend: Python venv at `backend/venv/`, started via `uvicorn app.main:app`
- DB migrations: `alembic upgrade head` from `backend/app/migrations/`
- Oracle driver requires `/opt/oraclient/19.3_64/lib/` (Instant Client) pre-installed on RHEL

## Environment Configuration

**Required env vars (backend):**
- `RECVIZ_ENCRYPTION_KEY` - **REQUIRED**, no default in `backend/app/config.py` `Settings` (typed as `SecretStr`). Backend will fail to start without this. Fernet URL-safe base64 32-byte key.
- `RECVIZ_DB_URL` - Metadata DB URI (has default for local dev)
- `RECON_DB_URL` - Legacy dev recon DB URI (has default)

**Required env vars (frontend):**
- `VITE_API_BASE_URL` - Optional, defaults to `http://localhost:8000` in `frontend/src/lib/api-client.ts`

**Secrets location:**
- `backend/.env` (present; not committed; existence noted only)
- `backend/.env.example` documents the three backend variables
- Production: env vars set at the process level on RHEL (exact mechanism deferred to infra)

## Webhooks & Callbacks

**Incoming:**
- None. No webhook endpoints in `backend/app/api/`.
- Routers registered in `backend/app/api/router.py`: `managed_dashboards`, `data_sources`, `databases`, `managed_kpis`, `managed_charts`, `managed_datasets`, `sql`, `search`, `views`. All are CRUD / query endpoints consumed by the RecViz SPA.

**Outgoing:**
- None. Backend has no HTTP client dependency and makes no outbound HTTP calls.

## Summary

RecViz v2 has an unusually small integration surface:

1. FastAPI <-> PostgreSQL (metadata DB) via SQLAlchemy sync engine (`backend/app/db/engine.py`)
2. FastAPI <-> user-registered Oracle/PostgreSQL data sources via per-connection SQLAlchemy engines (`backend/app/services/engine_manager.py`)
3. React SPA <-> FastAPI via `fetch` (`frontend/src/lib/api-client.ts`)

There are no third-party APIs, no cloud services, no auth providers, no message queues, no caches, no webhooks. This is intentional — the "no cloud services, fully self-hostable" and "no Redis" constraints in CLAUDE.md, plus the v2 decision to drop Superset entirely.

---

*Integration audit: 2026-04-11*
