<!-- generated-by: gsd-doc-writer -->
# RecViz

A custom visualization and analytics platform for reconciliation data, built as an internal replacement for Tableau and Qlik View. RecViz uses Apache Superset as a headless query engine with a completely custom React frontend and FastAPI backend.

## Architecture

```
React SPA (frontend)  -->  FastAPI (backend/proxy)  -->  Superset (headless engine)  -->  Oracle / Hive / ES
       :5173                     :8000                        :8088
                                   \--> Sidecar endpoints (direct ES, exports, custom aggs)
```

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript 5, Vite 7, Tailwind CSS 4, Shadcn/ui |
| Data Grid | AG Grid Enterprise 33 |
| Charts | AG Charts Enterprise 13 (primary), ECharts 6 (exotic chart types only) |
| Routing / State | TanStack Router 1, TanStack Query 5, Zustand 5 |
| Backend | FastAPI 0.128, Python 3.12, Pydantic 2, httpx |
| Query Engine | Apache Superset (headless, REST API only) |
| Database | PostgreSQL 16, Redis 7 |
| Data Sources | Oracle (primary recon data), Hive (historical), Elasticsearch (realtime) |

## Installation

### Prerequisites

- **Node.js** 20+ (npm ships with Node)
- **Python** 3.12+
- **Docker** 24+ (for PostgreSQL and Redis)

### 1. Clone and install dependencies

```bash
git clone <repository-url>
cd RecViz
```

Install frontend dependencies:

```bash
cd frontend
npm ci
cd ..
```

Install backend dependencies:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

### 2. Start infrastructure services

```bash
docker compose up -d
```

This starts PostgreSQL 16 (port 5432) and Redis 7 (port 6379). Superset runs as a Docker container on port 8088 and will initialize automatically.

### 3. Seed the database

```bash
cd seed
python3 create_recon_db.py
python3 register_superset.py
python3 register_test_datasets.py
cd ..
```

## Quick Start

1. **Start Docker services** (PostgreSQL, Redis, Superset):
   ```bash
   docker compose up -d
   ```

2. **Start the backend** (in `backend/` with the virtual environment activated):
   ```bash
   cd backend
   source .venv/bin/activate
   uvicorn app.main:app --reload --port 8000
   ```

3. **Start the frontend** (in a separate terminal):
   ```bash
   cd frontend
   npm run dev
   ```

4. **Open the app** at [http://localhost:5173](http://localhost:5173).

## Usage

### Dashboards

Browse and interact with reconciliation dashboards. Each dashboard displays KPI cards, interactive charts (AG Charts and ECharts), and a data grid (AG Grid). Dashboards are config-driven -- defined by JSON configuration files that specify layout, data sources, and chart types.

Navigate to `/dashboards` to see the dashboard list, then click a dashboard to view its detail page with filter bar, KPIs, charts, and data grid.

### Data Explorer

A SQL editor powered by Monaco Editor with a schema browser. Navigate to `/explorer` to write and execute SQL queries against connected databases, browse table schemas, and visualize query results.

### Chart and Dataset Management

Create and manage reusable chart definitions at `/charts` and dataset definitions at `/datasets`. Charts and datasets are stored in the backend database and registered with Superset for query execution.

### Embeddable Dashboards

Dashboards can be embedded in external applications via the `/embed/dashboards/:id` route.

## Project Structure

```
RecViz/
├── frontend/                  # React SPA (TypeScript)
│   └── src/
│       ├── components/        # UI components (ui/, layout/, dashboard/, charts/, grid/, etc.)
│       ├── routes/            # TanStack Router file-based pages
│       ├── hooks/             # Custom hooks (TanStack Query wrappers)
│       ├── stores/            # Zustand state stores (filter, drill, theme, sidebar)
│       ├── lib/               # API client, utilities, constants
│       └── types/             # Shared TypeScript types
├── backend/                   # FastAPI backend (Python)
│   └── app/
│       ├── api/               # Route handlers (dashboards, charts, datasets, sql, export, etc.)
│       ├── services/          # Business logic (superset_client, query_engine, dataset_sync)
│       ├── models/            # Pydantic models
│       ├── config/            # Database connection configs
│       ├── db/                # SQLAlchemy engine and session
│       └── migrations/        # Alembic migrations
├── superset/                  # Superset Docker config and settings
│   ├── Dockerfile
│   ├── superset_config.py
│   └── superset-entrypoint.sh
├── docker/                    # DB init scripts (init-db.sql)
├── seed/                      # Data seeding scripts
├── scripts/                   # Setup and utility scripts
├── docs/                      # Project documentation
└── docker-compose.yml         # PostgreSQL + Redis + Superset
```

## API Endpoints

The FastAPI backend (port 8000) exposes the following route groups:

| Route Group | Purpose |
|-------------|---------|
| `/api/dashboards` | Dashboard CRUD and configuration |
| `/api/data-sources` | Data source management |
| `/api/databases` | Database connection management |
| `/api/charts` | Chart definition management |
| `/api/managed-charts` | Managed chart lifecycle |
| `/api/datasets` | Dataset CRUD |
| `/api/managed-datasets` | Managed dataset lifecycle and Superset sync |
| `/api/sql` | SQL query execution via Superset |
| `/api/search` | Search across entities |
| `/api/export` | Data export (PDF, Excel) |
| `/api/views` | Saved view management |
| `/api/custom` | Custom aggregation endpoints |
| `/health` | Health check |

## Services

| Port | Service |
|------|---------|
| 5173 | Frontend (Vite dev server) |
| 8000 | Backend (FastAPI / Uvicorn) |
| 5432 | PostgreSQL 16 |
| 6379 | Redis 7 |
| 8088 | Apache Superset |

## Documentation

- [Setup Guide](docs/SETUP.md) -- Detailed installation and configuration
- [Getting Started](docs/GETTING_STARTED.md) -- First-run walkthrough
- [Codebase Guide](docs/CODEBASE_GUIDE.md) -- File-level reference for every component and endpoint
