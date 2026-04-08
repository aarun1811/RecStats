<!-- generated-by: gsd-doc-writer -->
# Deployment

RecViz is an on-premises application designed for corporate environments with no cloud service dependencies. All components are self-hostable. This document covers the deployment targets, build pipeline, environment configuration, rollback strategy, and monitoring for each layer of the stack.

## Deployment Targets

RecViz consists of four deployable components, each with its own deployment mechanism:

| Component | Technology | Config File | Default Port |
|-----------|-----------|-------------|-------------|
| **Frontend** (React SPA) | Vite build, static files served by a reverse proxy | `frontend/vite.config.ts` | 5173 (dev) |
| **Backend** (FastAPI sidecar) | Uvicorn ASGI server | `backend/.env`, `backend/app/config.py` | 8000 |
| **Superset** (headless query engine) | Docker container | `superset/Dockerfile`, `superset/superset_config.py` | 8088 |
| **Supporting services** (PostgreSQL + Redis) | Docker Compose | `docker-compose.yml` | 5432, 6379 |

### Docker Compose (Development / Staging)

The `docker-compose.yml` at the project root defines three services:

- **postgres** — PostgreSQL 16 (Alpine). Creates two databases: `superset_meta` (Superset internal metadata, set via `POSTGRES_DB` env var) and `recon_data` (seed reconciliation data, created by `docker/init-db.sql`). Credentials: `recviz` / `recviz_dev`.
- **redis** — Redis 7 (Alpine). No authentication. Used for Superset query cache (db 0-1), Celery broker (db 2), Celery results (db 3), and SQL Lab results backend (db 4).
- **superset** — Built from `superset/Dockerfile` using Python 3.12-slim. Installs `apache-superset`, `psycopg2-binary`, `redis`, `cachelib`, `oracledb`, `pyhive`, and `thrift`. Runs the entrypoint script that performs database migrations, creates an admin user, and starts Superset on port 8088.

```bash
# Start all supporting services + Superset
docker compose up -d

# Verify health
docker compose ps
curl http://localhost:8088/health
```

### Superset Docker Image

The `superset/Dockerfile` builds a self-contained Superset image:

```dockerfile
FROM python:3.12-slim
# Installs: build-essential, libpq-dev, postgresql-client, libsasl2-dev
# Pip: apache-superset, psycopg2-binary, redis, cachelib, oracledb, pyhive, thrift
```

The entrypoint script (`superset/superset-entrypoint.sh`) runs on container start:

1. Waits for PostgreSQL to become ready (`pg_isready`)
2. Runs `superset db upgrade` (Alembic migrations)
3. Creates the admin user (`admin` / `admin`) if it does not already exist
4. Runs `superset init` (role and permission initialization)
5. Starts Superset on `0.0.0.0:8088`

### Frontend Static Build

The frontend is a React SPA built with Vite. In production it should be served as static files behind a reverse proxy (Nginx, Apache, or similar):

```bash
cd frontend
pnpm install
pnpm build
```

This runs `tsc -b && vite build` and outputs static assets to `frontend/dist/`. The `VITE_API_BASE_URL` environment variable must be set before the build to point to the production FastAPI URL (it is baked into the bundle at build time).

### FastAPI Backend

The backend runs as an ASGI application via Uvicorn:

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

For production, omit `--reload` and consider running behind Gunicorn with Uvicorn workers:

```bash
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

## Build Pipeline

No CI/CD pipeline is currently configured in the repository. There are no GitHub Actions workflows, Jenkinsfiles, or other pipeline definitions present.

### Manual Build Steps

**Frontend:**

```bash
cd frontend
pnpm install --frozen-lockfile
VITE_API_BASE_URL=https://<fastapi-host>:8000 pnpm build
# Output: frontend/dist/
```

**Backend:**

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**Superset:**

```bash
docker compose build superset
```

### Database Migrations

RecViz uses Alembic for its own database migrations (separate from Superset's internal migrations). The migration config is at `backend/app/migrations/alembic.ini` and targets the `superset_meta` PostgreSQL database.

RecViz uses a separate Alembic version table (`recviz_alembic_version`) to avoid conflicts with Superset's own migration history in the same database.

```bash
cd backend
alembic -c app/migrations/alembic.ini upgrade head
```

### Data Seeding

Two seeding strategies exist depending on the deployment mode:

| Script | Target | Purpose |
|--------|--------|---------|
| `scripts/generate-seed-db.py` | SQLite (`backend/app/config/seed/seed.db`) | Generates a local SQLite seed database for native dev (no Docker needed) |
| `scripts/seed-postgres.py` | PostgreSQL (`recon_data` + `superset_meta`) | Seeds reconciliation data tables and RecViz dashboard/data-source configs into Docker PostgreSQL |

For Docker-based deployments, run the PostgreSQL seeder after starting services:

```bash
docker compose up -d
python scripts/seed-postgres.py
```

## Environment Setup

Production deployment requires overriding all default credentials and configuring connections to real data sources. See [CONFIGURATION.md](./CONFIGURATION.md) for the complete environment variable reference.

### Critical Production Overrides

| Variable / Setting | Dev Default | Production Requirement |
|-------------------|-------------|----------------------|
| `SECRET_KEY` (Superset) | `recviz-dev-secret-key-change-in-prod` | Strong random value (32+ characters) |
| `SUPERSET_PASSWORD` | `admin` | Strong password for Superset admin account |
| `SUPERSET_USERNAME` | `admin` | Change or create a service account |
| `RECON_DB_URL` | `postgresql://recviz:recviz_dev@localhost:5432/recon_data` | Oracle production URI |
| `RECVIZ_DB_URL` | `postgresql+asyncpg://recviz:recviz_dev@localhost:5432/superset_meta` | Production PostgreSQL URI |
| `REDIS_URL` | `redis://localhost:6379/0` | Production Redis instance |
| `DATABASES_CONFIG_PATH` | Points to `databases.json` (PostgreSQL) | Point to `databases.prod.json` or a production-specific file |
| `VITE_API_BASE_URL` | `http://localhost:8000` | Production FastAPI URL (set at build time) |
| `SUPERSET_CONFIG_PATH` | `superset/superset_config.py` | Production Superset config with real `SECRET_KEY`, hostnames |
| PostgreSQL credentials | `recviz` / `recviz_dev` | Production-grade credentials |

### Database Connection Configuration

RecViz connects to recon data sources through Superset. The database connection registry is defined in JSON config files:

- **Development**: `backend/app/config/databases.json` -- PostgreSQL standing in for Oracle
- **Production**: `backend/app/config/databases.prod.json` -- Real Oracle and Hive connections

The production config (`databases.prod.json`) defines connections to:

| Database | Dialect | Purpose |
|----------|---------|---------|
| `superset_db_TCOSPRD` | Oracle | TLM Consumer reconciliation data |
| `superset_db_TFINPRD` | Oracle | TLM Finance reconciliation data |
| `superset_db_hive_historical` | Hive | Historical batch data |

<!-- VERIFY: Actual production Oracle hostnames, service names, and Hive cluster address -->

Switch to production database connections by setting the environment variable:

```bash
export DATABASES_CONFIG_PATH=/path/to/databases.prod.json
```

The Oracle driver (`oracledb`) runs in thin mode -- no Oracle Instant Client is required.

### Superset Configuration

Two Superset config files exist:

| Config | Use Case | Metadata DB | Cache | Celery |
|--------|---------|-------------|-------|--------|
| `superset/superset_config.py` | Docker / production | PostgreSQL | Redis | Redis-backed |
| `superset/superset_config_local.py` | Native local dev | SQLite (`~/.superset/superset_local.db`) | SimpleCache (in-memory) | Disabled |

Production deployments must use `superset_config.py` (or a custom production variant) with:

- `SECRET_KEY` set to a strong random value
- `POSTGRES_HOST` pointing to the production PostgreSQL host
- `REDIS_HOST` pointing to the production Redis host
- `CORS_OPTIONS.origins` updated with the production frontend URL

### Reverse Proxy Configuration

<!-- VERIFY: Production reverse proxy (Nginx/Apache) configuration and hostname -->

In production, a reverse proxy should sit in front of all services:

```
Client → Reverse Proxy (Nginx/Apache)
           ├── /          → Frontend static files (frontend/dist/)
           ├── /api/      → FastAPI backend (:8000)
           └── (internal) → Superset (:8088, not exposed externally)
```

Superset should not be exposed to end users. The FastAPI backend proxies all Superset API calls -- the frontend never communicates with Superset directly.

## Rollback Procedure

No automated rollback mechanism is configured. Use the following manual approach:

### Frontend Rollback

1. Keep previous build artifacts (`frontend/dist/`) or tag them with the git commit hash before deploying a new version.
2. To roll back, replace the current `dist/` contents with the previous version's build output.
3. No server restart needed -- the reverse proxy serves static files directly.

### Backend Rollback

1. Stop the Uvicorn/Gunicorn process.
2. Checkout the previous known-good commit: `git checkout <commit-hash> -- backend/`
3. Reinstall dependencies: `pip install -r backend/requirements.txt`
4. If Alembic migrations were applied, downgrade: `alembic -c backend/app/migrations/alembic.ini downgrade -1`
5. Restart the backend process.

### Superset Rollback

1. Rebuild the Superset Docker image from the previous commit: `docker compose build superset`
2. Restart the container: `docker compose up -d superset`
3. Superset runs its own Alembic migrations on startup via `superset db upgrade`. Downgrading Superset versions may require manual migration rollback.

### Database Rollback

- **RecViz migrations**: Use Alembic downgrade commands (`alembic downgrade -1`).
- **Superset migrations**: Superset manages its own Alembic history. Do not run Superset downgrades unless you are certain of the target revision.
- **Seed data**: Re-run `scripts/seed-postgres.py` to reset seed data (this script is idempotent -- it drops and recreates tables).

## Monitoring

No application monitoring libraries (Sentry, Datadog, New Relic, OpenTelemetry) are currently integrated into the codebase.

### Available Health Checks

| Endpoint / Check | Service | Method |
|-----------------|---------|--------|
| `GET /health` | FastAPI backend | Returns `{"status": "ok", "superset": true}` |
| `GET /api/test-superset` | FastAPI backend | Tests Superset connectivity and lists registered datasets |
| `curl http://localhost:8088/health` | Superset | Built-in Superset health endpoint |
| Docker healthchecks | PostgreSQL, Redis, Superset | Defined in `docker-compose.yml` with interval/timeout/retry configs |

### Docker Compose Health Checks

The `docker-compose.yml` defines health checks for all services:

- **PostgreSQL**: `pg_isready -U recviz` (every 5s, 3s timeout, 5 retries)
- **Redis**: `redis-cli ping` (every 5s, 3s timeout, 5 retries)
- **Superset**: `curl -f http://localhost:8088/health` (every 15s, 10s timeout, 10 retries, 60s start period)

### Recommended Production Monitoring

<!-- VERIFY: Production monitoring stack and dashboard URLs -->

For production deployments, consider integrating:

- **Application Performance Monitoring (APM)**: Instrument the FastAPI backend with an APM agent (e.g., Sentry, Datadog, or OpenTelemetry) to track request latency, error rates, and slow queries.
- **Log aggregation**: Centralize logs from FastAPI (Python `logging`), Superset, PostgreSQL, and Redis into a log management system.
- **Database monitoring**: Monitor PostgreSQL connection pool usage (the backend uses a pool of 10 connections with 5 overflow, configured in `backend/app/db/engine.py`), query duration, and cache hit rates in Redis.
- **Process supervision**: Use systemd, supervisord, or a container orchestrator (Docker Swarm, Kubernetes) to ensure all services auto-restart on failure.

## Service Startup Order

Services must start in a specific order due to dependencies:

```
1. PostgreSQL (metadata store)
2. Redis (cache + Celery broker)
3. Superset (depends on PostgreSQL + Redis, runs migrations on start)
4. FastAPI backend (authenticates to Superset on startup, registers databases)
5. Frontend (static files, can be served anytime but requires backend to be running)
```

Docker Compose enforces steps 1-3 via `depends_on` with health check conditions. The FastAPI backend and frontend are started manually (or via a process manager in production).

If the FastAPI backend starts before Superset is ready, it will fail during the lifespan startup (Superset authentication is a hard requirement -- see `backend/app/main.py`).
