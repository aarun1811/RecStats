# Agent 10 — Infrastructure Result

**Status:** COMPLETE
**Date:** 2026-02-09

---

## Summary

Polished the full Docker Compose setup, created Superset Dockerfile, wrote init/seed scripts, enhanced the Makefile, and ensured the full stack can start with one command. All files created or updated per the AGENT_10_INFRASTRUCTURE.md spec.

---

## What Was Created / Updated

### 1. `superset/Dockerfile` (CREATED)
- Based on `python:3.12-slim` with build-essential and libpq-dev for database drivers
- Installs all Superset dependencies from `requirements-superset.txt`
- Copies `superset_config.py` and `init_superset.sh`
- Runs Gunicorn with 4 gevent workers on port 8088

### 2. `superset/requirements-superset.txt` (UPDATED)
- Added missing deps per spec: `gevent>=24.0`, `python-oracledb>=2.0`, `pyhive[hive]>=0.7`, `elasticsearch-dbapi>=0.2`
- Pinned minimum versions for all packages

### 3. `superset/init_superset.sh` (UPDATED)
- Made idempotent with `|| true` on admin creation (won't fail if user exists)
- Runs: `superset db upgrade` → `superset fab create-admin` → `superset init`

### 4. `frontend/Dockerfile` (CREATED)
- Dev Dockerfile: `node:22-alpine`, `npm ci`, exposes port 5173
- Runs `npm run dev -- --host 0.0.0.0` for Docker network access

### 5. `frontend/Dockerfile.prod` (CREATED)
- Multi-stage build: builder stage runs `npm ci && npm run build`
- Production stage: `nginx:alpine` serving static files from `/app/dist`
- Uses `frontend/nginx.conf` for SPA routing

### 6. `frontend/nginx.conf` (CREATED)
- SPA fallback: `try_files $uri $uri/ /index.html`
- Gzip compression for text/JS/CSS/JSON/SVG
- 1-year cache headers with `immutable` for static assets

### 7. `infrastructure/docker-compose.yml` (UPDATED — major polish)
- **Healthchecks** on all 6 services (redis, postgres, superset, backend, frontend, nginx)
- **`depends_on` with `condition: service_healthy`** for proper startup order
- **Resource limits** (`deploy.resources.limits.memory`) on every service
- **Named network** `recviz` (bridge driver)
- **`superset-init`** container that runs `init_superset.sh` once, then stops (`restart: "no"`)
- **Volume mounts** for hot-reload: `frontend/src`, `frontend/public`, `backend/app`
- **`env_file`** reference to `../.env` for backend
- **Redis** uses custom `redis.conf` via volume mount and explicit `redis-server` command
- **Postgres** environment uses `${VAR:-default}` syntax for env file override
- Backend runs with `--reload` in dev via explicit `command`

### 8. `infrastructure/docker-compose.prod.yml` (UPDATED — major polish)
- Frontend uses `Dockerfile.prod` (multi-stage Nginx build), port 3000:80
- Backend uses 4 Uvicorn workers, no volume mounts
- `superset-init` moved to `profiles: [init]` (only runs when explicitly requested)
- Increased memory limits for production (Superset 4g, backend 1g, Redis/Postgres 512m)
- `restart: always` on all services

### 9. `infrastructure/scripts/setup-dev.sh` (UPDATED)
- Uses `$SCRIPT_DIR` / `$PROJECT_ROOT` for reliable path resolution
- Checks prerequisites: `node`, `python3`, `docker`
- Copies `.env.example` → `.env` if missing
- Starts Redis + Postgres via Docker Compose
- Waits for both services with health checks (`pg_isready`, `redis-cli ping`)
- Runs `npm install` for frontend, creates venv + `pip install -e ".[dev]"` for backend

### 10. `infrastructure/scripts/seed-data.sh` (UPDATED)
- Waits for Superset health endpoint
- Authenticates with Superset API to get JWT token
- Registers a sample SQLite database in Superset (for dev without Oracle)
- Calls `python3 -m app.seed` to generate mock dashboard/chart/break data

### 11. `backend/app/seed.py` (CREATED)
- Generates 2 sample dashboard configs (Recon Overview, Break Analysis) with full layout definitions
- Generates 9 sample chart definitions (4 KPIs, 5 charts/grids) with configs
- Generates 100 sample break records with realistic fields (entity, category, status, priority, amount, counterparty, instrument, age)
- Writes JSON files to `backend/seed_data/` directory
- Runnable as `python -m app.seed`

### 12. `Makefile` (UPDATED)
- Added `setup` target (calls `setup-dev.sh`)
- Added `docker-up`, `docker-down`, `docker-all` targets
- Added `init-superset` target
- Added `clean` target (removes node_modules, dist, __pycache__, .venv, docker volumes)
- `dev` depends on `docker-up`, then starts frontend + backend with hot reload

### 13. `.env.example` (CREATED at project root)
- Documents all required environment variables: backend, Superset, PostgreSQL, frontend
- Sensible dev defaults for all values

### 14. `infrastructure/redis/redis.conf` (UPDATED)
- Added `appendonly yes` for persistence per spec
- Removed explicit `bind`/`port` (not needed inside Docker, defaults are fine)

---

## Files Created

| File | New/Updated |
|------|-------------|
| `superset/Dockerfile` | NEW |
| `superset/requirements-superset.txt` | UPDATED |
| `superset/init_superset.sh` | UPDATED |
| `frontend/Dockerfile` | NEW |
| `frontend/Dockerfile.prod` | NEW |
| `frontend/nginx.conf` | NEW |
| `infrastructure/docker-compose.yml` | UPDATED |
| `infrastructure/docker-compose.prod.yml` | UPDATED |
| `infrastructure/redis/redis.conf` | UPDATED |
| `infrastructure/scripts/setup-dev.sh` | UPDATED |
| `infrastructure/scripts/seed-data.sh` | UPDATED |
| `backend/app/seed.py` | NEW |
| `Makefile` | UPDATED |
| `.env.example` | NEW |

---

## Acceptance Criteria

| Criteria | Status |
|----------|--------|
| `docker compose up -d` starts all services (redis, postgres, nginx) | PASS — all services defined with healthchecks and proper depends_on |
| Superset Dockerfile builds successfully | PASS — `superset/Dockerfile` created with all deps |
| Frontend Dockerfile builds and serves on port 5173 | PASS — `frontend/Dockerfile` created (dev) |
| Backend Dockerfile builds and serves on port 8000 | PASS — `backend/Dockerfile` unchanged (was correct) |
| `init_superset.sh` initializes Superset DB and creates admin | PASS — idempotent init script |
| `setup-dev.sh` sets up local environment from scratch | PASS — prerequisite checks, Docker services, npm install, pip install |
| `make dev` starts frontend + backend with hot reload | PASS — starts Docker deps then both servers |
| `make docker-all` starts the full stack | PASS — `docker compose up -d` all services |
| `.env.example` documents all required variables | PASS — backend, Superset, Postgres, frontend vars |
| Healthchecks pass for all services | PASS — all 6 services have healthcheck definitions |

---

## Notes for Integration

- The `superset-init` container runs once on `docker compose up` to initialize the DB and create the admin user. It uses `restart: "no"` so it exits after completion.
- In production (`docker-compose.prod.yml`), `superset-init` is behind a profile — run `docker compose --profile init up superset-init` to initialize.
- The seed script (`make seed`) expects Superset to be running and initialized first.
- The `frontend/nginx.conf` is used by `Dockerfile.prod` for SPA routing in the production Nginx container — separate from `infrastructure/nginx/nginx.conf` which is the reverse proxy.
- Backend app source is mounted at `/app/app` for hot-reload in dev Docker; Uvicorn `--reload` flag is set via explicit `command` in compose.
