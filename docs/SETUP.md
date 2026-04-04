# RecViz — Setup Guide

Complete instructions to clone, install, and run RecViz on a fresh machine.

RecViz is a custom visualization platform: **React frontend** + **FastAPI backend** + optional **Apache Superset** as a headless query engine. The app runs fully in **mock mode** without Superset/Postgres/Redis — perfect for development and demos.

---

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| **Node.js** | 20+ (recommended 22+) | `node --version` |
| **npm** | 10+ | `npm --version` |
| **Python** | 3.11+ (recommended 3.12) | `python3 --version` or `python --version` |
| **Git** | 2.30+ | `git --version` |
| **Docker** (optional) | 24+ | `docker --version` |

### Install prerequisites if missing

**macOS:**
```bash
brew install node python@3.12 git
```

**Ubuntu/Debian:**
```bash
sudo apt update && sudo apt install -y nodejs npm python3 python3-pip python3-venv git
```

**Windows:**
- Install [Node.js LTS](https://nodejs.org/) (includes npm)
- Install [Python 3.12+](https://www.python.org/downloads/) — **check "Add to PATH" during install**
- Install [Git for Windows](https://git-scm.com/download/win)
- Use **PowerShell** or **Git Bash** for all commands below

---

## Quick Start (Mock Mode — No Docker needed)

This gets the app running with mock data in under 5 minutes. No Postgres, Redis, or Superset required.

### 1. Clone the repository

```bash
git clone https://github.com/aarun1811/RecStats.git
cd RecStats
git checkout feat/recviz-initial-build
```

### 2. Start the backend (FastAPI)

**macOS / Linux:**
```bash
cd 03-RecViz/recviz

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install backend dependencies (skip apache-superset for mock mode)
pip install fastapi==0.128.6 uvicorn==0.40.0 httpx==0.28.1 pydantic==2.12.5 pydantic-settings==2.12.0 python-dotenv==1.2.1

# Start the backend
cd backend
uvicorn app.main:app --reload --port 8000
```

**Windows (PowerShell):**
```powershell
cd 03-RecViz\recviz

# Create virtual environment
python -m venv .venv
.venv\Scripts\Activate.ps1

# Install backend dependencies
pip install fastapi==0.128.6 uvicorn==0.40.0 httpx==0.28.1 pydantic==2.12.5 pydantic-settings==2.12.0 python-dotenv==1.2.1

# Start the backend
cd backend
uvicorn app.main:app --reload --port 8000
```

**Windows (Git Bash):**
```bash
cd 03-RecViz/recviz

python -m venv .venv
source .venv/Scripts/activate

pip install fastapi==0.128.6 uvicorn==0.40.0 httpx==0.28.1 pydantic==2.12.5 pydantic-settings==2.12.0 python-dotenv==1.2.1

cd backend
uvicorn app.main:app --reload --port 8000
```

You should see:
```
INFO:     Superset unavailable at startup: ... — running in mock mode
INFO:     Uvicorn running on http://127.0.0.1:8000
```

The "Superset unavailable" warning is expected in mock mode. The backend will serve mock data automatically.

### 3. Start the frontend (React + Vite)

Open a **new terminal** (keep the backend running):

**macOS / Linux:**
```bash
cd RecStats/03-RecViz/recviz/frontend

npm install
npm run dev
```

**Windows:**
```powershell
cd RecStats\03-RecViz\recviz\frontend

npm install
npm run dev
```

You should see:
```
VITE v7.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
```

### 4. Open the app

Open **http://localhost:5173** in your browser.

That's it! You should see the RecViz app with:
- **Dashboards** — Dashboard list → click to see KPIs, charts, and data grid
- **Data Explorer** — SQL editor with Monaco, schema browser, query execution
- **Reports** — Scheduled report cards with Generate Now
- **Settings** — Theme switcher (light/dark/system), saved views, data sources

---

## Verify Everything Works

| Feature | How to test |
|---------|-------------|
| Dashboard list | Navigate to `/dashboards` — see "Recon Overview" card |
| Dashboard detail | Click the card — see KPI cards, charts, filter bar, data grid |
| Cross-filtering | Click a bar in any chart — all other charts filter instantly |
| Drill-down | Click a bar segment → breadcrumb trail appears → drill deeper |
| Data Explorer | Navigate to `/explorer` → click "Run Query" → see 20 rows |
| Schema Browser | Expand a table in the left sidebar → see columns with types |
| Chart Builder | After running a query, click "Chart It" → see bar chart |
| Reports | Navigate to `/reports` → click "Generate Now" → see toast |
| Dark Mode | Navigate to `/settings` → click "Dark" → entire app switches |
| Save View | On dashboard, click "Save View" → enter name → save |
| Command Palette | Press `Cmd+K` (Mac) or `Ctrl+K` (Windows) → search |

---

## Full Setup (With Docker Services)

If you want to run with real Postgres and Redis (still mock data but closer to production):

### 1. Start Docker services

```bash
cd 03-RecViz/recviz
docker compose up -d
```

This starts:
- **PostgreSQL** on port `5432` (user: `recviz`, password: `recviz_dev`)
- **Redis** on port `6379`

### 2. Start backend and frontend

Follow Steps 2-4 from Quick Start above. The backend will detect Postgres/Redis and use them.

### 3. Stop Docker services

```bash
docker compose down        # Stop containers, keep data
docker compose down -v     # Stop containers AND delete data
```

---

## Project Structure

```
03-RecViz/recviz/
├── backend/                 # FastAPI backend (Python)
│   └── app/
│       ├── main.py          # FastAPI app entry point
│       ├── config.py        # Settings (env vars)
│       ├── api/             # Route handlers
│       ├── models/          # Pydantic models
│       ├── services/        # Superset client, etc.
│       └── mock_data.py     # Mock datasets, charts, break rows
├── frontend/                # React SPA (TypeScript)
│   ├── src/
│   │   ├── routes/          # TanStack Router pages
│   │   ├── components/      # UI components
│   │   ├── hooks/           # TanStack Query hooks
│   │   ├── stores/          # Zustand state stores
│   │   ├── lib/             # API client, utils
│   │   └── types/           # TypeScript types
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml       # Postgres + Redis
├── docker/                  # DB init scripts
├── seed/                    # Data seeding scripts
├── superset/                # Superset config
└── requirements.txt         # Python dependencies
```

---

## Ports

| Service | Port | URL |
|---------|------|-----|
| Frontend (Vite) | 5173 | http://localhost:5173 |
| Backend (FastAPI) | 8000 | http://localhost:8000 |
| PostgreSQL | 5432 | — |
| Redis | 6379 | — |
| Superset (optional) | 8088 | http://localhost:8088 |

---

## Environment Variables (Optional)

The backend reads from `03-RecViz/recviz/backend/.env` if it exists. Defaults work for mock mode.

```env
SUPERSET_URL=http://localhost:8088
SUPERSET_USERNAME=admin
SUPERSET_PASSWORD=admin
REDIS_URL=redis://localhost:6379/0
RECON_DB_URL=postgresql://recviz:recviz_dev@localhost:5432/recon_data
```

---

## Troubleshooting

### `npm install` fails

Make sure you're in the `frontend/` directory:
```bash
cd 03-RecViz/recviz/frontend
npm install
```

If you get permission errors on macOS/Linux:
```bash
sudo chown -R $(whoami) ~/.npm
npm install
```

### `uvicorn: command not found`

Make sure your virtual environment is activated:
```bash
# macOS/Linux
source .venv/bin/activate

# Windows PowerShell
.venv\Scripts\Activate.ps1

# Windows Git Bash
source .venv/Scripts/activate
```

### Port already in use

Kill the process using the port:
```bash
# macOS/Linux
lsof -ti:8000 | xargs kill -9   # Backend
lsof -ti:5173 | xargs kill -9   # Frontend
```

```powershell
# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

### Python version issues

RecViz requires Python 3.11+. Check your version:
```bash
python3 --version   # macOS/Linux
python --version    # Windows
```

### Frontend shows "Network Error" or blank page

Make sure the backend is running on port 8000:
```bash
curl http://localhost:8000/health
# Should return: {"status":"ok","superset":false}
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 7, TanStack Router + Query |
| UI | Tailwind CSS 4, Shadcn UI, Radix Primitives |
| Charts | AG Charts Enterprise, ECharts |
| Grid | AG Grid Enterprise |
| Editor | Monaco Editor |
| State | Zustand |
| Animations | Motion (framer-motion) |
| Backend | FastAPI, Pydantic v2, HTTPX |
| Database | PostgreSQL 16 (optional), Redis 7 (optional) |
| Query Engine | Apache Superset (optional, headless) |
