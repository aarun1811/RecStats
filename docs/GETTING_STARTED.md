<!-- generated-by: gsd-doc-writer -->
# Getting Started

This guide walks you through setting up RecViz for local development from a fresh clone to a running application.

---

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| **Node.js** | 20+ | `node --version` |
| **pnpm** | 10+ | `pnpm --version` |
| **Python** | 3.12+ | `python3 --version` |
| **Docker** | 24+ (Docker Compose v2 included) | `docker --version` |
| **Git** | 2.30+ | `git --version` |

RecViz has three layers that all run locally: a React frontend (pnpm), a FastAPI backend (Python), and Apache Superset as a headless query engine (Python, installed in a virtualenv). Docker is used for PostgreSQL 16 and Redis 7 supporting services.

### Installing prerequisites (macOS)

```bash
brew install node python@3.12 git
npm install -g pnpm
```

Docker Desktop for Mac provides both `docker` and `docker compose`.

---

## Installation Steps

### 1. Clone the repository

```bash
git clone <repository-url>
cd RecViz
```

### 2. Start Docker services (PostgreSQL + Redis)

```bash
docker compose up -d
```

This starts:

| Service | Container | Port |
|---------|-----------|------|
| PostgreSQL 16 | `recviz-postgres` | 5432 |
| Redis 7 | `recviz-redis` | 6379 |

PostgreSQL is initialized with two databases: `superset_meta` (Superset metadata and RecViz managed tables) and `recon_data` (reconciliation data for queries). The init script at `docker/init-db.sql` creates the `recon_data` database automatically.

Wait for both services to be healthy:

```bash
docker compose ps
```

Both containers should show `healthy` status.

### 3. Set up the Python virtual environment

There are two virtualenvs in the project. The **root-level** `.venv` is for Superset (which has heavy dependencies and must be isolated). The **backend/** `venv` is for the FastAPI backend.

#### Superset virtualenv (root `.venv`)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install apache-superset oracledb psycopg2-binary
deactivate
```

#### Backend virtualenv (`backend/venv`)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate
cd ..
```

### 4. Initialize Superset (one-time setup)

```bash
./scripts/setup-superset-local.sh
```

This script:
- Activates the root `.venv`
- Runs `superset db upgrade` to create Superset's metadata tables
- Creates an admin user (`admin` / `admin`)
- Runs `superset init`

Superset metadata is stored in SQLite at `~/.superset/superset_local.db` for local development (no PostgreSQL dependency for Superset metadata in this mode).

### 5. Generate the seed database

```bash
python scripts/generate-seed-db.py
```

This creates a SQLite seed database at `backend/app/config/seed/seed.db` with sample reconciliation data across multiple TLM instances. The seed database is used by Superset as a data source in local development.

For a more production-like setup using PostgreSQL as the data source:

```bash
source backend/venv/bin/activate
python scripts/seed-postgres.py
deactivate
```

This populates the `recon_data` PostgreSQL database with ~1M transactions, ~150K breaks, and supporting reference data.

### 6. Install frontend dependencies

```bash
cd frontend
pnpm install
cd ..
```

---

## First Run

You need three terminals, one for each service. **Start them in this order** -- the backend requires Superset to be running first.

### Terminal 1: Superset

```bash
cd RecViz
SUPERSET_CONFIG_PATH=superset/superset_config_local.py .venv/bin/superset run -p 8088
```

Wait until you see `Running on http://127.0.0.1:8088`. Verify:

```bash
curl http://localhost:8088/health
```

Should return `OK`.

### Terminal 2: FastAPI backend

```bash
cd RecViz/backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

On successful startup you should see:

```
Superset client ready
Registered database 'superset_db_TCOSPRD' in Superset (id=1)
Registered database 'superset_db_TFINPRD' in Superset (id=2)
Registered database 'superset_db_TWMPRD' in Superset (id=3)
Registered database 'superset_db_reconmgmt' in Superset (id=4)
DatabaseRegistrar synced
ConnectionStatusTracker initialized
QueryEngine initialized — ready to serve
DatasetSyncService initialized
Dataset reconciliation complete
```

Verify:

```bash
curl http://localhost:8000/health
```

Should return `{"status":"ok","superset":true}`.

### Terminal 3: Frontend

```bash
cd RecViz/frontend
pnpm dev
```

Output:

```
VITE vX.X.X  ready in xxx ms

  ➜  Local:   http://localhost:5173/
```

Open **http://localhost:5173** in your browser. Navigate to `/dashboards/tlm-stats` to see the TLM Statistics Dashboard with KPI cards, charts, filter bar, and data grid.

---

## Common Setup Issues

### Superset fails to start: "No module named 'superset'"

You are not using the correct virtualenv. Superset is installed in the root-level `.venv`, not in `backend/venv`:

```bash
# Use the root .venv, NOT backend/venv
SUPERSET_CONFIG_PATH=superset/superset_config_local.py .venv/bin/superset run -p 8088
```

### Backend fails to start: "Superset unavailable"

The backend requires Superset to be running and authenticated before it can start. Ensure Superset is running on port 8088 and responding to health checks before starting the backend:

```bash
curl http://localhost:8088/health
# Must return: OK
```

### Backend migration errors: "recviz_alembic_version"

RecViz uses a separate Alembic version table (`recviz_alembic_version`) to avoid conflicting with Superset's own migrations in the same `superset_meta` database. If you get migration errors, run Alembic explicitly:

```bash
cd backend
source venv/bin/activate
cd app/migrations
alembic upgrade head
```

### SQLite dialect error: "SQLiteDialect cannot be used as a data source"

This happens when Superset blocks SQLite connections by default. The local config (`superset/superset_config_local.py`) sets `PREVENT_UNSAFE_DB_CONNECTIONS = False` to allow it. Make sure you are passing the local config:

```bash
SUPERSET_CONFIG_PATH=superset/superset_config_local.py .venv/bin/superset run -p 8088
```

### Port already in use

Kill the process occupying the port:

```bash
lsof -ti:8088 | xargs kill -9   # Superset
lsof -ti:8000 | xargs kill -9   # Backend
lsof -ti:5173 | xargs kill -9   # Frontend
```

### `pnpm install` fails with peer dependency errors

Make sure you are using pnpm 10+:

```bash
pnpm --version
```

If outdated, update with `npm install -g pnpm`.

### Docker containers not starting

Ensure Docker Desktop is running and ports 5432/6379 are free:

```bash
docker compose down
docker compose up -d
docker compose ps   # Both should show "healthy"
```

---

## Service Ports

| Service | Port | URL |
|---------|------|-----|
| Frontend (Vite dev server) | 5173 | http://localhost:5173 |
| FastAPI backend | 8000 | http://localhost:8000 |
| Apache Superset | 8088 | http://localhost:8088 |
| PostgreSQL | 5432 | -- |
| Redis | 6379 | -- |

---

## Quick Verification

After all three services are running, verify the full data pipeline:

```bash
# 1. Health checks
curl http://localhost:8088/health          # OK
curl http://localhost:8000/health          # {"status":"ok","superset":true}

# 2. Filter options (should return real data from seed DB)
curl -s http://localhost:8000/api/data-sources/reconmgmt_recon_bank/distinct/recon_engine_env
# Expected: {"values":["TLMP_CONSUMER","TLMP_FINANCE","TLMP_WEALTH"]}

# 3. Open the dashboard
open http://localhost:5173/dashboards/tlm-stats
```

On the TLM Statistics Dashboard you should see:
- **Filter bar** at the top with TLM Instance and Recon dropdowns
- **KPI cards** showing break counts, match rates, and trends
- **Charts** (bar, pie, line) rendered by AG Charts
- **Data grid** at the bottom powered by AG Grid

---

## Next Steps

- **[ARCHITECTURE.md](ARCHITECTURE.md)** -- Understand the three-layer architecture, component diagram, and data flow
- **[CONFIGURATION.md](CONFIGURATION.md)** -- Full reference for environment variables, database config, and data source definitions
- **[CODEBASE_GUIDE.md](CODEBASE_GUIDE.md)** -- File-level reference of the entire codebase, including the two parallel dashboard systems
