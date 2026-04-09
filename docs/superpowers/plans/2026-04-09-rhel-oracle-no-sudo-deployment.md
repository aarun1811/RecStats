# RecViz — RHEL + Oracle + No-Sudo Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy RecViz v1 to a Citi RHEL server running as the non-root user `rectify`, backed by an Oracle 19c database (schema `RECTRACE`) on port 8889, without sudo, systemd, Docker, nginx, or Redis.

**Architecture:** FastAPI serves both `/api/*` and the SPA static assets from a single public port; Superset runs on `127.0.0.1:8088` (invisible to users); both talk to Oracle via `python-oracledb` in thin mode. Two services run under `nohup` controlled by bash lifecycle scripts.

**Tech Stack:** Python 3.12.8 (system), FastAPI + uvicorn, Apache Superset 6.0.0 + gunicorn, SQLAlchemy 2.0.49 with async oracledb dialect, Oracle 19c, React SPA pre-built on a Citi laptop and shipped as static `dist/`.

**Design doc:** `docs/superpowers/specs/2026-04-09-rhel-oracle-no-sudo-deployment-design.md` (commit `ae6f2a8`).

---

## Prerequisites (confirm before Task 1)

- [ ] RecViz repo clone exists on the Citi laptop (not the server)
- [ ] Citi laptop has Node 22 + pnpm 9 installed (`node -v`, `pnpm -v`)
- [ ] `scp` + `pbrun -u rectify` access to the RHEL server
- [ ] Oracle credentials for `RECTRACE` (user, password, host, service_name)
- [ ] At least one recon source with credentials for day-1 test
- [ ] Approved lsof port for the backend (free on server AND reachable through corporate firewall)
- [ ] ~90 minutes of uninterrupted time

---

# Part A — Laptop code changes and build

## Task 1: Set up the deploy workspace and branch

**Files:**
- Working directory: `~/Workspace/recviz-prod-build` (fresh clone — do not reuse your dev checkout)

- [ ] **Step 1: Fresh clone**

```bash
cd ~/Workspace
rm -rf recviz-prod-build                    # only if a stale workspace exists
git clone <your-internal-recviz-git-url> recviz-prod-build
cd recviz-prod-build
```

Expected: clone succeeds, `.git/` exists, HEAD is at `main`.

- [ ] **Step 2: Create a deploy branch**

```bash
git checkout -b deploy/oracle-rhel-20260409
```

Expected: `Switched to a new branch 'deploy/oracle-rhel-20260409'`.

- [ ] **Step 3: Verify the expected files exist**

```bash
ls backend/app/migrations/versions/
ls backend/app/main.py
ls backend/requirements.txt
ls frontend/package.json
```

Expected: four migration files (`001_initial_schema.py`, `002_add_datasets.py`, `003_add_charts.py`, `004_add_kpis.py`), plus the other three.

- [ ] **Step 4: Verify Python 3.12 and pnpm are available**

```bash
python3.12 --version
pnpm --version
```

Expected: `Python 3.12.x` and `9.x.x` (or the installed pnpm version — 9.x is the pinned version per `package.json`).

---

## Task 2: Patch all four Alembic migrations — JSONB → JSON

**Files:**
- Modify: `backend/app/migrations/versions/001_initial_schema.py:12` (import), `:28`, `:48` (column declarations)
- Modify: `backend/app/migrations/versions/002_add_datasets.py:12`, `:30`
- Modify: `backend/app/migrations/versions/003_add_charts.py:12`, `:29`
- Modify: `backend/app/migrations/versions/004_add_kpis.py:12`, `:30`

**Why:** `JSONB` is a Postgres-specific column type imported from `sqlalchemy.dialects.postgresql`. On Oracle, importing it raises `NotImplementedError` at migration runtime. `sa.JSON()` renders as `JSONB` on Postgres and `CLOB` with `IS JSON` check constraint on Oracle 19c — works on both.

- [ ] **Step 1: Patch `001_initial_schema.py`**

Open `backend/app/migrations/versions/001_initial_schema.py`:

**Remove line 12:**
```python
from sqlalchemy.dialects.postgresql import JSONB
```

**Replace the two column definitions:**

Line 28:
```python
        sa.Column("config", JSONB, nullable=False),
```
becomes:
```python
        sa.Column("config", sa.JSON(), nullable=False),
```

Line 48:
```python
        sa.Column("config", JSONB, nullable=False),
```
becomes:
```python
        sa.Column("config", sa.JSON(), nullable=False),
```

- [ ] **Step 2: Patch `002_add_datasets.py`**

Remove line 12 (`from sqlalchemy.dialects.postgresql import JSONB`).

Line 30:
```python
        sa.Column("columns", JSONB, nullable=False, server_default="[]"),
```
becomes:
```python
        sa.Column("columns", sa.JSON(), nullable=False, server_default="[]"),
```

- [ ] **Step 3: Patch `003_add_charts.py`**

Remove line 12 (`from sqlalchemy.dialects.postgresql import JSONB`).

Line 29:
```python
        sa.Column("config", JSONB, nullable=False, server_default="{}"),
```
becomes:
```python
        sa.Column("config", sa.JSON(), nullable=False, server_default="{}"),
```

- [ ] **Step 4: Patch `004_add_kpis.py`**

Remove line 12 (`from sqlalchemy.dialects.postgresql import JSONB`).

Line 30:
```python
        sa.Column("config", JSONB, nullable=False, server_default="{}"),
```
becomes:
```python
        sa.Column("config", sa.JSON(), nullable=False, server_default="{}"),
```

- [ ] **Step 5: Verify no JSONB references remain**

```bash
grep -r 'JSONB' backend/app/migrations/
```

Expected: NO output. Every reference has been removed.

- [ ] **Step 6: Verify Python syntax is valid for all four files**

```bash
python3.12 -m py_compile \
    backend/app/migrations/versions/001_initial_schema.py \
    backend/app/migrations/versions/002_add_datasets.py \
    backend/app/migrations/versions/003_add_charts.py \
    backend/app/migrations/versions/004_add_kpis.py && echo "OK"
```

Expected: `OK` (and no traceback).

---

## Task 3: Verify migration patches against a SQLite smoke test

**Files:**
- No source changes. This task just proves the patched migrations still work on a real database.

**Why:** We can't easily run Alembic against Oracle from the laptop (no Oracle client). But `sa.JSON()` works on SQLite too, and running Alembic against a throwaway SQLite file catches any remaining Postgres-specific code we missed.

- [ ] **Step 1: Create a throwaway SQLite DB and run migrations against it**

```bash
cd backend
python3.12 -m venv venv-deploy-test
source venv-deploy-test/bin/activate
pip install --upgrade pip wheel
pip install -r requirements.txt
```

Expected: install completes without error. (This is a throwaway venv — we'll delete it in Step 6.)

- [ ] **Step 2: Point Alembic at a SQLite file via env override**

```bash
export RECVIZ_DB_URL="sqlite+aiosqlite:///./test-deploy-migration.db"
pip install aiosqlite  # needed for SQLite async driver
```

Expected: `aiosqlite` installs cleanly (it's tiny).

- [ ] **Step 3: Run the migrations**

```bash
python -m alembic -c app/migrations/alembic.ini upgrade head
```

Expected output:
```
INFO  [alembic.runtime.migration] Running upgrade  -> 001, Initial schema: recviz_dashboards and recviz_data_sources
INFO  [alembic.runtime.migration] Running upgrade 001 -> 002, Add recviz_datasets table
INFO  [alembic.runtime.migration] Running upgrade 002 -> 003, Add recviz_charts table
INFO  [alembic.runtime.migration] Running upgrade 003 -> 004, Add recviz_kpis table
```

If anything errors, STOP. Read the traceback and fix the offending migration file before continuing.

- [ ] **Step 4: Verify the tables exist in SQLite**

```bash
python3.12 -c "
import sqlite3
conn = sqlite3.connect('./test-deploy-migration.db')
for row in conn.execute(\"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name\"):
    print(row[0])
"
```

Expected output includes: `recviz_alembic_version`, `recviz_charts`, `recviz_dashboards`, `recviz_data_sources`, `recviz_datasets`, `recviz_kpis`, and `ix_recviz_charts_dataset_id`, `ix_recviz_kpis_dataset_id` indexes.

- [ ] **Step 5: Run the existing backend test suite to confirm no regressions**

```bash
unset RECVIZ_DB_URL              # don't let SQLite override leak into pytest
pytest tests/ -v
```

Expected: all 27 tests pass (10 in test_query_engine, 3 in test_merge_engine, 8 in test_database_registrar, 6 in test_config_store).

- [ ] **Step 6: Clean up the throwaway test artifacts**

```bash
rm -f test-deploy-migration.db
deactivate
rm -rf venv-deploy-test
cd ..
```

Expected: no leftover files, `pwd` is back at `~/Workspace/recviz-prod-build`.

---

## Task 4: Add StaticFiles mount and SPA fallback to `main.py`

**Files:**
- Modify: `backend/app/main.py`

**Why:** Without nginx, FastAPI needs to serve both the SPA static files (at `/`) and the API (at `/api/*`) from a single port. `StaticFiles(html=True)` serves index.html for directory paths, but we also need a 404 fallback so TanStack Router's client-side routes (like `/dashboards/tlm-stats`) return index.html when hit directly.

- [ ] **Step 1: Add new imports at the top of `main.py`**

At the top of `backend/app/main.py`, below the existing `from starlette.responses import Response` line (currently line 13), add:

```python
from pathlib import Path
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
```

- [ ] **Step 2: Add the StaticFiles mount and 404 fallback after `app.include_router(api_router)`**

Currently `main.py` ends with:
```python
app.include_router(api_router)


@app.get("/health")
async def health():
    return {"status": "ok", "superset": True}


@app.get("/api/test-superset")
async def test_superset():
    # ...
```

Insert a new block **immediately after `app.include_router(api_router)`** and **before** the `@app.get("/health")` line, so the block reads:

```python
app.include_router(api_router)


# --------------------------------------------------------------------------- #
# Static SPA serving — Production only.
#
# In dev (pnpm dev on :5173), frontend/dist/ does not exist and these mounts
# silently skip. In prod, the tarball ships a pre-built frontend/dist/ and
# FastAPI serves the SPA on / while continuing to handle /api/* above.
# --------------------------------------------------------------------------- #
FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"

if FRONTEND_DIST.exists():
    logger.info("Frontend dist/ found at %s — mounting SPA", FRONTEND_DIST)

    @app.exception_handler(404)
    async def spa_fallback(request: Request, exc):
        # API 404s stay as JSON 404s — do NOT fall through to index.html
        if request.url.path.startswith("/api/") or request.url.path == "/health":
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        # Everything else: serve index.html so TanStack Router handles it client-side
        return FileResponse(FRONTEND_DIST / "index.html")

    # Mount must come AFTER the 404 handler is registered
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="spa")
else:
    logger.info("Frontend dist/ NOT found at %s — SPA serving disabled (dev mode)", FRONTEND_DIST)


@app.get("/health")
async def health():
    return {"status": "ok", "superset": True}
```

Note: `Request` is already imported on line 12 (`from starlette.requests import Request`) — don't re-import it.

- [ ] **Step 3: Verify `main.py` parses**

```bash
python3.12 -m py_compile backend/app/main.py && echo "OK"
```

Expected: `OK`.

- [ ] **Step 4: Quick dev-mode smoke test that the guard doesn't break the dev server**

```bash
cd backend
source venv/bin/activate    # your existing dev venv, not the one from Task 3
python3.12 -c "
from app.main import app, FRONTEND_DIST
print('FRONTEND_DIST:', FRONTEND_DIST)
print('exists:', FRONTEND_DIST.exists())
# In a dev checkout without a built frontend, expect False.
# The app should import without errors regardless.
print('app routes:', len(app.routes))
"
deactivate
cd ..
```

Expected: prints the resolved path, `exists: False` on a fresh dev checkout (no `pnpm build` ran), and a positive route count. No import errors.

---

## Task 5: Add `oracledb==2.5.1` to `backend/requirements.txt`

**Files:**
- Modify: `backend/requirements.txt`

**Why:** The backend will import `oracledb` via SQLAlchemy's `oracle+oracledb://` dialect when the `.env` switches `RECVIZ_DB_URL` to Oracle. Without the package in `requirements.txt`, `pip install` on the server won't pull it.

- [ ] **Step 1: Append `oracledb==2.5.1` to `requirements.txt`**

Open `backend/requirements.txt`. It currently ends at line 22 with `alembic==1.18.4`. Append a new section:

```
# Oracle driver (python-oracledb in thin mode — no Oracle Instant Client needed)
# Required by the prod deployment (see docs/superpowers/specs/2026-04-09-rhel-oracle-no-sudo-deployment-design.md)
oracledb==2.5.1
```

- [ ] **Step 2: Verify the file is still valid pip-requirements format**

```bash
cat backend/requirements.txt | tail -5
```

Expected: the last 5 lines include the new `oracledb==2.5.1` entry and no syntax issues (no unclosed quotes, no stray characters).

- [ ] **Step 3: Verify oracledb 2.5.1 is available from your internal PyPI mirror**

**From the Citi laptop** (the build machine), in a throwaway venv:

```bash
python3.12 -m venv /tmp/oracle-availability-check
source /tmp/oracle-availability-check/bin/activate
pip install oracledb==2.5.1
python3.12 -c "import oracledb; print('oracledb version:', oracledb.__version__)"
deactivate
rm -rf /tmp/oracle-availability-check
```

Expected: `oracledb version: 2.5.1`. If this fails with a mirror-not-found error, STOP and work with your Artifactory admin to mirror oracledb before continuing.

---

## Task 6: Commit all code changes

**Files:** none new — just git operations.

- [ ] **Step 1: Review the diff**

```bash
git status
git diff --stat
```

Expected: 6 files modified:
- `backend/app/migrations/versions/001_initial_schema.py`
- `backend/app/migrations/versions/002_add_datasets.py`
- `backend/app/migrations/versions/003_add_charts.py`
- `backend/app/migrations/versions/004_add_kpis.py`
- `backend/app/main.py`
- `backend/requirements.txt`

- [ ] **Step 2: Stage all six files**

```bash
git add \
  backend/app/migrations/versions/001_initial_schema.py \
  backend/app/migrations/versions/002_add_datasets.py \
  backend/app/migrations/versions/003_add_charts.py \
  backend/app/migrations/versions/004_add_kpis.py \
  backend/app/main.py \
  backend/requirements.txt
```

- [ ] **Step 3: Commit**

```bash
git commit -m "deploy(oracle): port backend to Oracle 19c + serve SPA from FastAPI

- Replace JSONB (postgres-specific) with sa.JSON() in all 4 Alembic
  migrations. sa.JSON() renders as JSONB on Postgres (no functional
  change for dev) and as CLOB with IS JSON check constraint on Oracle.
- Mount frontend/dist/ via StaticFiles + add a 404 fallback that returns
  index.html for non-/api/ paths, so FastAPI serves the SPA in prod
  where nginx is unavailable. Guarded by a Path.exists() check so dev
  setups without a built dist/ are unaffected.
- Add oracledb==2.5.1 to requirements.txt. python-oracledb runs in thin
  mode — no Oracle Instant Client required. SQLAlchemy 2.0.25+ auto-selects
  the async dialect when using oracle+oracledb:// with create_async_engine.

No async->sync refactor needed — the existing async DB code works
unchanged on Oracle via the native OracleDialectAsync_oracledb."
```

Expected: commit succeeds. Record the commit SHA for later reference.

---

## Task 7: Build the frontend on the laptop

**Files:**
- Output: `frontend/dist/` (generated, not tracked by git)

**Why:** We ship the pre-built static assets in the tarball; Node is never installed on the server.

- [ ] **Step 1: Install frontend dependencies from the internal mirror**

```bash
cd frontend
pnpm install --frozen-lockfile
```

Expected: completes without error. The `--frozen-lockfile` flag ensures the exact versions from `pnpm-lock.yaml` are used (no surprises).

- [ ] **Step 2: Set the API base URL for same-origin deployment**

```bash
echo 'VITE_API_BASE_URL=' > .env.production
```

**Why empty:** the FastAPI backend serves the SPA AND the API from the same origin (`http://server:PORT/`). An empty `VITE_API_BASE_URL` causes the SPA to issue API requests to its own origin (`/api/...`), which Nginx-style proxying isn't needed for — the backend's own route handlers catch them.

- [ ] **Step 3: Build**

```bash
pnpm build
```

Expected: runs `tsc -b && vite build`, outputs to `dist/`, takes 20–60 seconds. Look for `✓ built in Xms` at the end.

- [ ] **Step 4: Verify the build output**

```bash
ls -la dist/
ls dist/assets/ | head
cat dist/index.html | head -20
```

Expected:
- `dist/index.html` exists (the entry point)
- `dist/assets/` contains hashed `.js` and `.css` files
- `index.html` references the hashed assets in `<script type="module" src="/assets/...">` tags

- [ ] **Step 5: Quick size check**

```bash
du -sh dist/
```

Expected: ~5–20 MB (RecViz's SPA is AG Grid + ECharts + Monaco which are big; don't be alarmed).

- [ ] **Step 6: Return to repo root**

```bash
cd ..
```

---

## Task 8: Bundle the deployment tarball

**Files:**
- Output: `~/recviz-deploy-20260409-<HHMM>.tar.gz` (on the laptop)

**Why:** A single file to scp to the server. Contains the patched backend source, the built frontend dist, and the superset config directory.

- [ ] **Step 1: Create the tarball**

```bash
TIMESTAMP=$(date +%Y%m%d-%H%M)
tar --exclude='backend/venv' \
    --exclude='backend/venv-deploy-test' \
    --exclude='backend/__pycache__' \
    --exclude='backend/.pytest_cache' \
    --exclude='backend/**/__pycache__' \
    --exclude='frontend/node_modules' \
    --exclude='frontend/.vite' \
    --exclude='.git' \
    -czf ~/recviz-deploy-${TIMESTAMP}.tar.gz \
    backend \
    frontend/dist \
    superset
```

Expected: tar runs without error. If it complains about missing `superset/` directory, run `ls` to check; the `superset/` directory at the repo root holds the config files. If it doesn't exist on your branch, add `echo "no superset/ dir yet — that's OK"` and skip that argument.

- [ ] **Step 2: Verify tarball contents and size**

```bash
ls -lh ~/recviz-deploy-${TIMESTAMP}.tar.gz
tar tzf ~/recviz-deploy-${TIMESTAMP}.tar.gz | head -30
tar tzf ~/recviz-deploy-${TIMESTAMP}.tar.gz | wc -l
```

Expected:
- Size: 20–50 MB
- Contents include `backend/app/main.py`, `backend/requirements.txt`, `backend/app/migrations/versions/001_initial_schema.py`, `frontend/dist/index.html`
- Total file count: a few hundred to a few thousand

- [ ] **Step 3: Verify the built frontend is actually inside the tarball**

```bash
tar tzf ~/recviz-deploy-${TIMESTAMP}.tar.gz | grep 'frontend/dist/index.html'
```

Expected: one line with the path. If empty, the tarball is missing the built frontend — re-check Task 7 and re-bundle.

- [ ] **Step 4: Record the tarball path for Task 9**

```bash
echo "TARBALL: ~/recviz-deploy-${TIMESTAMP}.tar.gz"
```

Save this path — you'll use it in Task 9.

---

# Part B — Server transport and setup

> From here on, commands run **on the RHEL server as user `rectify`** unless explicitly marked `# on laptop`. Get to that shell now via `pbrun -u rectify /bin/bash` from your normal account, or however you normally get into the `rectify` account.

## Task 9: scp the tarball and create the directory skeleton

**Files:**
- Create (on server): `/opt/rectify/rectrace/recviz/{app,logs,run}` (empty dirs)
- Transport: `/tmp/recviz-deploy-<timestamp>.tar.gz`

- [ ] **Step 1: scp from laptop to server**

On the **laptop**:
```bash
# on laptop
scp ~/recviz-deploy-*.tar.gz rectify@<server-hostname>:/tmp/
```

Expected: transfer completes. Tarball is now at `/tmp/recviz-deploy-*.tar.gz` on the server.

- [ ] **Step 2: On the server, create the directory skeleton**

```bash
# on server as rectify
mkdir -p /opt/rectify/rectrace/recviz/{app,logs,run}
ls -la /opt/rectify/rectrace/recviz/
```

Expected: output shows `app/`, `logs/`, `run/` as empty subdirectories.

- [ ] **Step 3: Untar into `app/`**

```bash
cd /opt/rectify/rectrace/recviz/app
tar xzf /tmp/recviz-deploy-*.tar.gz
ls -la
```

Expected: `backend/`, `frontend/dist/`, `superset/` now visible in `app/`.

- [ ] **Step 4: Verify key files extracted correctly**

```bash
ls app/backend/app/main.py 2>/dev/null || ls backend/app/main.py
ls app/frontend/dist/index.html 2>/dev/null || ls frontend/dist/index.html
ls app/backend/requirements.txt 2>/dev/null || ls backend/requirements.txt
```

Expected: all three exist. If the tarball extracted into a subdirectory (because of `tar -C` behavior), adjust the paths accordingly.

- [ ] **Step 5: Confirm the JSONB patches came through**

```bash
cd /opt/rectify/rectrace/recviz/app
grep -r JSONB backend/app/migrations/ || echo "clean"
```

Expected: `clean`. If it prints any `JSONB` match, the tarball was built from an unpatched branch — go back to Task 2.

---

## Task 10: Create the `.env` file with Oracle + Superset secrets

**Files:**
- Create: `/opt/rectify/rectrace/recviz/.env` (outside `app/`, survives releases)

**Why:** Pydantic Settings reads this file at backend startup to populate `settings.recviz_db_url`, `settings.superset_url`, etc. It also gets sourced by the lifecycle scripts.

- [ ] **Step 1: Write the `.env` template**

```bash
cat > /opt/rectify/rectrace/recviz/.env <<'EOF'
# === Oracle 19c connection (RECTRACE schema) ===
# Replace all <...> placeholders with the real values
RECVIZ_ORACLE_HOST=<oracle-host>
RECVIZ_ORACLE_PORT=8889
RECVIZ_ORACLE_SERVICE=<service-name>
RECVIZ_ORACLE_USER=RECTRACE
RECVIZ_ORACLE_PASSWORD=<password>

# === Backend metadata DB URL ===
# SQLAlchemy 2.0.25+ auto-selects the async oracledb dialect when
# create_async_engine is called with oracle+oracledb:// (verified against
# the installed sqlalchemy==2.0.49 in the venv). No code changes needed.
RECVIZ_DB_URL=oracle+oracledb://RECTRACE:<password>@<oracle-host>:8889/?service_name=<service-name>

# === RECON_DB_URL (unused in prod, but Pydantic Settings requires it) ===
# Set to any syntactically valid URL; the backend does not connect to it.
RECON_DB_URL=oracle+oracledb://RECTRACE:<password>@<oracle-host>:8889/?service_name=<service-name>

# === Superset (backend talks to it over HTTP on localhost) ===
SUPERSET_URL=http://127.0.0.1:8088
SUPERSET_USERNAME=admin
SUPERSET_PASSWORD=<SET-THIS-AFTER-TASK-19>

# === Redis is NOT used in prod but Pydantic Settings has it as a required field ===
# Dummy value — nothing connects to it.
REDIS_URL=redis://localhost:6379/0

# === Path to databases.json (sibling of recviz/, not inside app/) ===
DATABASES_CONFIG_PATH=/opt/rectify/rectrace/recviz/databases.json

# === Superset SECRET_KEY — generated in Task 17, DO NOT LOSE ===
SECRET_KEY=<SET-THIS-IN-TASK-17>

# === Public port the backend binds to — set in Task 20 ===
RECVIZ_PUBLIC_PORT=<SET-THIS-IN-TASK-20>

# === Environment marker ===
RECVIZ_ENV=production
EOF
```

- [ ] **Step 2: Replace the Oracle placeholders with real values**

Using `vi` or `nano`, open `/opt/rectify/rectrace/recviz/.env` and replace:
- `<oracle-host>` → your Oracle hostname
- `<service-name>` → your Oracle service name
- `<password>` → your RECTRACE password (appears 3 times)

Leave `<SET-THIS-AFTER-TASK-19>`, `<SET-THIS-IN-TASK-17>`, and `<SET-THIS-IN-TASK-20>` as placeholders — they get filled in later.

- [ ] **Step 3: Lock down file permissions**

```bash
chmod 600 /opt/rectify/rectrace/recviz/.env
ls -l /opt/rectify/rectrace/recviz/.env
```

Expected: `-rw------- 1 rectify <group> <size> <date> /opt/rectify/rectrace/recviz/.env`.

- [ ] **Step 4: Verify no placeholders remain for the Oracle section**

```bash
grep -c '<oracle-host>\|<service-name>' /opt/rectify/rectrace/recviz/.env
```

Expected: `0`. If nonzero, you forgot to replace one of the placeholders.

- [ ] **Step 5: Test-load the file into a shell and verify key variables**

```bash
set -a
source /opt/rectify/rectrace/recviz/.env
set +a
echo "Oracle: $RECVIZ_ORACLE_HOST:$RECVIZ_ORACLE_PORT/$RECVIZ_ORACLE_SERVICE"
echo "Backend DB: $RECVIZ_DB_URL"
```

Expected: no errors, both lines print values with no `<placeholder>` text visible.

---

## Task 11: Create `databases.json` with one day-1 recon source

**Files:**
- Create: `/opt/rectify/rectrace/recviz/databases.json`

**Why:** The backend's `DatabaseRegistrar.sync()` reads this at startup and registers each entry in Superset's `dbs` table. At minimum, we need one entry for end-to-end validation.

> **CRITICAL:** the `sqlalchemy_uri` in this file uses the `oracle://` dialect form (NO `+oracledb` suffix), because Superset's SQLAlchemy 1.4 resolves `oracle://` through its `cx_Oracle` dialect, which the shim in `superset_config_prod.py` aliases to the `oracledb` package. The backend's own `RECVIZ_DB_URL` uses `oracle+oracledb://` because the backend is on SQLAlchemy 2.x. **Do not mix up the two URL forms.** See gotcha §10.7 in the design doc.

- [ ] **Step 1: Write the template**

```bash
cat > /opt/rectify/rectrace/recviz/databases.json <<'EOF'
{
  "databases": [
    {
      "name": "superset_db_<logical-name>",
      "display_name": "<Human Readable Label>",
      "sqlalchemy_uri": "oracle://<recon-user>:<recon-password>@<recon-host>:8889/?service_name=<recon-service>",
      "dialect": "oracle",
      "type": "<category-e.g-tlm>",
      "schema": "<DEFAULT_SCHEMA>"
    }
  ]
}
EOF
```

- [ ] **Step 2: Replace placeholders with real day-1 recon source values**

Edit `/opt/rectify/rectrace/recviz/databases.json` with your day-1 recon source details:
- `<logical-name>` → internal identifier (e.g., `TCOSPRD` → `superset_db_TCOSPRD`)
- `<Human Readable Label>` → UI display label
- `<recon-user>`, `<recon-password>`, `<recon-host>`, `<recon-service>` → credentials for the read-only recon account
- `<category>` → a category tag like `tlm`, `reconmgmt`, `historical`
- `<DEFAULT_SCHEMA>` → the Oracle schema containing the recon tables (e.g., `TLM_CONSUMER`), or empty string `""` if none

- [ ] **Step 3: Validate the JSON is syntactically correct**

```bash
python3.12 -c "import json; print(json.load(open('/opt/rectify/rectrace/recviz/databases.json'))['databases'][0]['name'])"
```

Expected: prints the `name` field (e.g., `superset_db_TCOSPRD`) — no JSON parse error.

- [ ] **Step 4: Validate all placeholders were replaced**

```bash
grep -c '<.*>' /opt/rectify/rectrace/recviz/databases.json || echo "0"
```

Expected: `0` — no `<placeholder>` text left.

---

## Task 12: Pre-flight: verify Oracle connectivity from the server with the real credentials

**Files:** none (verification only)

**Why:** Before we start installing venvs and running migrations, prove the `.env` credentials actually connect. Saves debugging time later.

- [ ] **Step 1: Install `oracledb` in a throwaway venv**

```bash
python3.12 -m venv ~/tmp-preflight
source ~/tmp-preflight/bin/activate
pip install oracledb==2.5.1
```

Expected: install completes from internal mirror.

- [ ] **Step 2: Connect to Oracle using the .env values**

```bash
set -a
source /opt/rectify/rectrace/recviz/.env
set +a
python3.12 <<'PY'
import oracledb, os
conn = oracledb.connect(
    user=os.environ["RECVIZ_ORACLE_USER"],
    password=os.environ["RECVIZ_ORACLE_PASSWORD"],
    dsn=f"{os.environ['RECVIZ_ORACLE_HOST']}:{os.environ['RECVIZ_ORACLE_PORT']}/{os.environ['RECVIZ_ORACLE_SERVICE']}",
)
print("Connected to Oracle", conn.version)
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM user_tables")
print(f"Pre-install table count in RECTRACE: {cur.fetchone()[0]}")
conn.close()
PY
```

Expected output:
```
Connected to Oracle 19.29.0.0.0
Pre-install table count in RECTRACE: 49
```

The table count should match the 49 we verified earlier. If it's higher, someone else has been modifying the schema — stop and investigate before running any migrations.

- [ ] **Step 3: Clean up the preflight venv**

```bash
deactivate
rm -rf ~/tmp-preflight
```

---

# Part C — Backend venv and RecViz Alembic migrations

## Task 13: Create the backend venv and install dependencies

**Files:**
- Create: `/opt/rectify/rectrace/recviz/app/backend/venv/` (full Python venv)

- [ ] **Step 1: Create the venv**

```bash
cd /opt/rectify/rectrace/recviz/app/backend
python3.12 -m venv venv
source venv/bin/activate
pip install --upgrade pip wheel
```

Expected: venv creates successfully, pip upgrades to latest.

- [ ] **Step 2: Install backend requirements**

```bash
pip install -r requirements.txt
```

Expected: installs ~20 packages including `fastapi==0.128.6`, `uvicorn==0.40.0`, `sqlalchemy[asyncio]==2.0.49`, `alembic==1.18.4`, `oracledb==2.5.1`, `asyncpg==0.31.0`. The install takes 30–90 seconds depending on network speed.

- [ ] **Step 3: Verify oracledb installed with async support**

```bash
python3.12 -c "
import oracledb
import asyncio
print('oracledb version:', oracledb.version)
print('has connect_async:', hasattr(oracledb, 'connect_async'))
"
```

Expected:
```
oracledb version: 2.5.1
has connect_async: True
```

- [ ] **Step 4: Verify SQLAlchemy's async Oracle dialect is resolvable**

```bash
python3.12 -c "
from sqlalchemy.dialects import oracle
from sqlalchemy.dialects.oracle import oracledb
print('async dialect class:', oracle.dialect_async.__name__)
print('is_async:', oracle.dialect_async.is_async)
"
```

Expected:
```
async dialect class: OracleDialectAsync_oracledb
is_async: True
```

If this errors, `oracledb` or `sqlalchemy` didn't install correctly — STOP and investigate before running migrations.

- [ ] **Step 5: Deactivate (we'll re-activate per command as needed)**

```bash
deactivate
```

---

## Task 14: Run RecViz Alembic migrations against Oracle RECTRACE

**Files:** no source changes — this task runs the migrations and verifies the resulting tables.

**Why:** Creates the 6 RecViz-owned tables (`recviz_alembic_version`, `recviz_dashboards`, `recviz_data_sources`, `recviz_datasets`, `recviz_charts`, `recviz_kpis` + their indexes) in RECTRACE.

- [ ] **Step 1: Activate the backend venv and source the env**

```bash
cd /opt/rectify/rectrace/recviz/app/backend
source venv/bin/activate
set -a
source /opt/rectify/rectrace/recviz/.env
set +a
```

- [ ] **Step 2: Run the migrations**

```bash
python -m alembic -c app/migrations/alembic.ini upgrade head
```

Expected output:
```
INFO  [alembic.runtime.migration] Context impl OracleImpl.
INFO  [alembic.runtime.migration] Will assume non-transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade  -> 001, Initial schema: recviz_dashboards and recviz_data_sources
INFO  [alembic.runtime.migration] Running upgrade 001 -> 002, Add recviz_datasets table
INFO  [alembic.runtime.migration] Running upgrade 002 -> 003, Add recviz_charts table
INFO  [alembic.runtime.migration] Running upgrade 003 -> 004, Add recviz_kpis table
```

If any migration fails:
1. Read the full traceback — capture it for debugging.
2. If it's a Postgres-specific thing we missed (e.g., `timestamp with time zone` — Oracle accepts this, but if something errors, switch to `sa.DateTime()` without timezone), fix the migration file and re-run.
3. To recover from a partial run: `python -m alembic -c app/migrations/alembic.ini downgrade base` then fix and retry.

- [ ] **Step 3: Verify the 6 RecViz tables exist in RECTRACE**

```bash
python3.12 <<'PY'
import oracledb, os
conn = oracledb.connect(
    user=os.environ["RECVIZ_ORACLE_USER"],
    password=os.environ["RECVIZ_ORACLE_PASSWORD"],
    dsn=f"{os.environ['RECVIZ_ORACLE_HOST']}:{os.environ['RECVIZ_ORACLE_PORT']}/{os.environ['RECVIZ_ORACLE_SERVICE']}",
)
cur = conn.cursor()
cur.execute("SELECT table_name FROM user_tables WHERE table_name LIKE 'RECVIZ%' ORDER BY 1")
tables = [r[0] for r in cur]
print(f"Found {len(tables)} RECVIZ tables:")
for t in tables:
    print(f"  {t}")
expected = {"RECVIZ_ALEMBIC_VERSION", "RECVIZ_CHARTS", "RECVIZ_DASHBOARDS",
            "RECVIZ_DATASETS", "RECVIZ_DATA_SOURCES", "RECVIZ_KPIS"}
missing = expected - set(tables)
if missing:
    print(f"MISSING: {missing}")
    raise SystemExit(1)
print("All 6 expected RecViz tables exist.")
conn.close()
PY
```

Expected: 6 tables listed, "All 6 expected RecViz tables exist." printed. If any are missing, the migration ran partially — check the Alembic output for errors.

- [ ] **Step 4: Verify the current Alembic revision is 004**

```bash
python -m alembic -c app/migrations/alembic.ini current
```

Expected: `004 (head)`.

- [ ] **Step 5: Deactivate**

```bash
deactivate
```

---

# Part D — Superset venv, config, and bootstrap

## Task 15: Create the Superset venv and install

**Files:**
- Create: `/opt/rectify/rectrace/recviz/app/superset/venv/` (separate from backend venv)

**Why:** Superset has ~200 transitive dependencies. Keeping it in a separate venv from the FastAPI backend prevents dependency conflicts.

- [ ] **Step 1: Create the Superset venv**

```bash
cd /opt/rectify/rectrace/recviz/app/superset
python3.12 -m venv venv
source venv/bin/activate
pip install --upgrade pip wheel
```

Expected: venv creates, pip upgrades. Note: if `app/superset/` doesn't exist in the extracted tarball, create it first: `mkdir -p /opt/rectify/rectrace/recviz/app/superset && cd /opt/rectify/rectrace/recviz/app/superset`.

- [ ] **Step 2: Install Apache Superset**

```bash
pip install apache-superset==6.0.0
```

Expected: install takes 2–5 minutes. ~200 packages.

- [ ] **Step 3: Install Oracle driver and gunicorn**

```bash
pip install oracledb==2.5.1 gunicorn==22.0.0
```

Expected: both install quickly (oracledb may be a no-op if pip cache has it from the backend install).

- [ ] **Step 4: Verify Superset CLI is available**

```bash
superset --version
```

Expected: `Superset version: 6.0.0` (or similar).

- [ ] **Step 5: Deactivate for now**

```bash
deactivate
```

---

## Task 16: Create `superset_config_prod.py`

**Files:**
- Create: `/opt/rectify/rectrace/recviz/app/superset/superset_config_prod.py`

**Why:** Superset's default config assumes Postgres metadata + Redis cache + Celery. We need Oracle metadata + SimpleCache + no Celery. Plus the `cx_Oracle` → `oracledb` shim for SQLAlchemy 1.4 compatibility.

- [ ] **Step 1: Write the config file**

```bash
cat > /opt/rectify/rectrace/recviz/app/superset/superset_config_prod.py <<'PYEOF'
"""
RecViz production Superset config.

Oracle 19c metadata, SimpleCache (no Redis), no Celery.
Single-worker gunicorn deployment under nohup on a no-sudo RHEL server.

See docs/superpowers/specs/2026-04-09-rhel-oracle-no-sudo-deployment-design.md
for the full design rationale.
"""
import logging
import os
import sys

# ============================================================================
# python-oracledb shim for SQLAlchemy 1.4
# ============================================================================
# Superset 6.0 uses SQLAlchemy 1.4. SQLAlchemy 1.4's cx_Oracle dialect handler
# tries to import cx_Oracle at startup. We alias python-oracledb (thin mode,
# pure Python, no Instant Client) as cx_Oracle so the import succeeds and
# Oracle works out of the box. DO NOT REMOVE THESE 3 LINES.
import oracledb
oracledb.version = "8.3.0"
sys.modules["cx_Oracle"] = oracledb

# ============================================================================
# Secrets
# ============================================================================
SECRET_KEY = os.environ["SECRET_KEY"]  # raises KeyError if missing — deliberate

# ============================================================================
# Metadata database — Oracle RECTRACE schema
# ============================================================================
# NOTE: plain oracle:// dialect (not oracle+oracledb://) because SQLAlchemy
# 1.4 routes oracle:// through its cx_Oracle dialect handler, which the shim
# above aliases to python-oracledb.
SQLALCHEMY_DATABASE_URI = (
    f"oracle://{os.environ['RECVIZ_ORACLE_USER']}:"
    f"{os.environ['RECVIZ_ORACLE_PASSWORD']}@"
    f"{os.environ['RECVIZ_ORACLE_HOST']}:{os.environ['RECVIZ_ORACLE_PORT']}/"
    f"?service_name={os.environ['RECVIZ_ORACLE_SERVICE']}"
)

# ============================================================================
# Caching — no Redis, use in-process SimpleCache
# ============================================================================
# Trade-off: cache does not persist across restarts and does not share across
# workers. We run --workers 1 so the second problem doesn't apply. The first
# problem just means first-page-load after restart is slower.
CACHE_CONFIG = {"CACHE_TYPE": "SimpleCache"}
DATA_CACHE_CONFIG = {"CACHE_TYPE": "SimpleCache"}
FILTER_STATE_CACHE_CONFIG = {"CACHE_TYPE": "SimpleCache"}
EXPLORE_FORM_DATA_CACHE_CONFIG = {"CACHE_TYPE": "SimpleCache"}

# ============================================================================
# Celery — disabled
# ============================================================================
# Celery would need Redis as a broker. We don't have Redis. Async SQL Lab and
# background report generation are unavailable; queries run synchronously.
CELERY_CONFIG = None
RESULTS_BACKEND = None

# ============================================================================
# Feature flags
# ============================================================================
FEATURE_FLAGS = {
    "ENABLE_TEMPLATE_PROCESSING": True,   # Jinja in SQL templates — backend uses this
    "GLOBAL_ASYNC_QUERIES": False,        # Needs Celery + Redis — keep disabled
}

# ============================================================================
# CORS — allow ONLY the local backend, Superset is not user-visible
# ============================================================================
ENABLE_CORS = True
CORS_OPTIONS = {
    "supports_credentials": True,
    "allow_headers": ["*"],
    "resources": ["/api/*"],
    "origins": ["http://127.0.0.1:8000"],  # backend only
}

# ============================================================================
# Misc
# ============================================================================
ENABLE_JAVASCRIPT_CONTROLS = False
SUPERSET_WEBSERVER_TIMEOUT = 120
SUPERSET_WORKERS = 1  # MUST match --workers 1 in gunicorn — SimpleCache is process-local

# ============================================================================
# Logging — write to a file the lifecycle scripts can tail
# ============================================================================
LOG_LEVEL = "INFO"
logging.basicConfig(level=logging.INFO)
PYEOF
```

- [ ] **Step 2: Verify the file parses as valid Python**

```bash
python3.12 -m py_compile /opt/rectify/rectrace/recviz/app/superset/superset_config_prod.py && echo "OK"
```

Expected: `OK`.

- [ ] **Step 3: Verify it can be imported with a fake SECRET_KEY set**

```bash
cd /opt/rectify/rectrace/recviz/app/superset
source venv/bin/activate
set -a && source /opt/rectify/rectrace/recviz/.env && set +a
SECRET_KEY=placeholder python3.12 -c "
import sys
sys.path.insert(0, '/opt/rectify/rectrace/recviz/app/superset')
import superset_config_prod
print('Config loaded OK')
print('SQLALCHEMY_DATABASE_URI starts with:', superset_config_prod.SQLALCHEMY_DATABASE_URI[:30])
print('CACHE_CONFIG:', superset_config_prod.CACHE_CONFIG)
print('CELERY_CONFIG:', superset_config_prod.CELERY_CONFIG)
"
deactivate
```

Expected:
```
Config loaded OK
SQLALCHEMY_DATABASE_URI starts with: oracle://RECTRACE:...
CACHE_CONFIG: {'CACHE_TYPE': 'SimpleCache'}
CELERY_CONFIG: None
```

---

## Task 17: Generate `SECRET_KEY` and persist it to `.env`

**Files:**
- Modify: `/opt/rectify/rectrace/recviz/.env` — set `SECRET_KEY` to a real value

**Why:** Superset uses SECRET_KEY to sign session cookies and encrypt stored database passwords in the `dbs` table. Generate it ONCE and never change it — changing it invalidates all sessions and orphans encrypted DB passwords.

- [ ] **Step 1: Generate a new 64-character hex SECRET_KEY**

```bash
SECRET_KEY=$(python3.12 -c 'import secrets; print(secrets.token_hex(32))')
echo "Generated SECRET_KEY (save this somewhere safe too): $SECRET_KEY"
```

Expected: 64 hex characters printed. Copy it to your password vault IMMEDIATELY — losing it is recoverable but painful.

- [ ] **Step 2: Update `.env` — replace the `<SET-THIS-IN-TASK-17>` placeholder**

```bash
# use sed to replace the placeholder line
sed -i "s|SECRET_KEY=<SET-THIS-IN-TASK-17>|SECRET_KEY=$SECRET_KEY|" /opt/rectify/rectrace/recviz/.env
grep SECRET_KEY /opt/rectify/rectrace/recviz/.env
```

Expected: `SECRET_KEY=<64-char-hex>` printed, no placeholder remaining.

- [ ] **Step 3: Verify the value is correctly loaded**

```bash
set -a
source /opt/rectify/rectrace/recviz/.env
set +a
echo "SECRET_KEY length: ${#SECRET_KEY}"
```

Expected: `SECRET_KEY length: 64`.

---

## Task 18: Run `superset db upgrade` — THE RISKIEST STEP

**Files:** no source changes — creates ~60 Superset metadata tables in RECTRACE.

**Why:** Apache Superset's own Alembic migrations run against the Oracle metadata database. This is the step most likely to fail because the Superset project hasn't extensively tested Oracle as a metadata backend. Expect to spend 10–30 minutes here; plan for the possibility of editing one or two Superset migration files.

- [ ] **Step 1: Activate Superset venv and load environment**

```bash
cd /opt/rectify/rectrace/recviz/app/superset
source venv/bin/activate
set -a
source /opt/rectify/rectrace/recviz/.env
set +a
export SUPERSET_CONFIG_PATH=/opt/rectify/rectrace/recviz/app/superset/superset_config_prod.py
```

- [ ] **Step 2: Run `superset db upgrade` with full output capture**

```bash
superset db upgrade 2>&1 | tee /opt/rectify/rectrace/recviz/logs/superset-bootstrap.log
```

Expected:
- Process runs for 2–5 minutes
- ~100 `INFO [alembic.runtime.migration] Running upgrade ...` lines
- No `ORA-xxxxx` errors
- Exits with status 0 (last line of tee output should have "database upgrade complete" or equivalent)

**If a migration fails:**
1. Read the error in `logs/superset-bootstrap.log`
2. Common Oracle issues:
   - **Reserved word conflict** (e.g., `LEVEL` as column name) → the migration file in `venv/lib/python3.12/site-packages/superset/migrations/versions/<rev>_<name>.py` needs quoting around the identifier
   - **Identifier longer than 30 chars (Oracle <12c limit)** → very unlikely on 19c (max is 128 chars)
   - **`TEXT` column type mapped to CLOB but used in a unique constraint** → Oracle doesn't allow unique on CLOB, change to VARCHAR2(4000)
3. Edit the offending migration file, then re-run `superset db upgrade` — Alembic resumes from the last successful revision
4. If you can't easily fix it and need to start clean: drop all Superset tables and re-run. **Do NOT** drop the `RECVIZ_*` tables — those are separate (see Task 14 verification).

- [ ] **Step 3: Verify Superset metadata tables were created**

```bash
python3.12 <<'PY'
import oracledb, os
conn = oracledb.connect(
    user=os.environ["RECVIZ_ORACLE_USER"],
    password=os.environ["RECVIZ_ORACLE_PASSWORD"],
    dsn=f"{os.environ['RECVIZ_ORACLE_HOST']}:{os.environ['RECVIZ_ORACLE_PORT']}/{os.environ['RECVIZ_ORACLE_SERVICE']}",
)
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM user_tables")
total = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM user_tables WHERE table_name IN ('AB_USER', 'AB_ROLE', 'DBS', 'DASHBOARDS', 'SLICES', 'ALEMBIC_VERSION')")
core_count = cur.fetchone()[0]
print(f"Total tables in RECTRACE: {total}")
print(f"Core Superset tables found (of 6 expected): {core_count}")
assert core_count == 6, f"Missing core Superset tables — only {core_count}/6 found"
print("Superset metadata schema looks correct.")
conn.close()
PY
```

Expected:
```
Total tables in RECTRACE: ~120  # 49 pre-existing + 6 recviz + ~60 superset + indexes
Core Superset tables found (of 6 expected): 6
Superset metadata schema looks correct.
```

- [ ] **Step 4: Deactivate**

```bash
deactivate
```

---

## Task 19: Create the Superset admin user and initialize roles

**Files:** no source changes — creates one `ab_user` row and populates `ab_role`, `ab_permission`, `ab_view_menu`, `ab_permission_view`.

- [ ] **Step 1: Re-activate Superset venv and load env**

```bash
cd /opt/rectify/rectrace/recviz/app/superset
source venv/bin/activate
set -a
source /opt/rectify/rectrace/recviz/.env
set +a
export SUPERSET_CONFIG_PATH=/opt/rectify/rectrace/recviz/app/superset/superset_config_prod.py
```

- [ ] **Step 2: Create the admin user**

Choose a strong password now (12+ chars, mixed case + numbers + symbols). You'll need this password in Step 4 AND in every subsequent session when troubleshooting Superset directly. Write it down.

```bash
superset fab create-admin \
  --username admin \
  --firstname RecViz \
  --lastname Admin \
  --email admin@local.internal \
  --password 'PASTE-YOUR-CHOSEN-PASSWORD-HERE'
```

Expected output ends with `Admin User admin created.`. If it says `Admin User admin already exists.`, someone (or a previous run) already created one — check who and whether the password is known before continuing.

- [ ] **Step 3: Run `superset init` to seed default roles and permissions**

```bash
superset init
```

Expected: prints "Syncing role definitions", "Syncing Admin perms", etc., exits with 0. Takes 30–60 seconds.

- [ ] **Step 4: Update `.env` — set `SUPERSET_PASSWORD` to the password you just used**

```bash
# replace <admin-password> below with what you typed in Step 2
ADMIN_PW='PASTE-THE-SAME-PASSWORD-HERE'
sed -i "s|SUPERSET_PASSWORD=<SET-THIS-AFTER-TASK-19>|SUPERSET_PASSWORD=$ADMIN_PW|" /opt/rectify/rectrace/recviz/.env
grep SUPERSET_PASSWORD /opt/rectify/rectrace/recviz/.env
unset ADMIN_PW    # don't leave it in shell history
```

Expected: `SUPERSET_PASSWORD=<your-password>` with no placeholder remaining.

- [ ] **Step 5: Verify the admin user exists in Oracle**

```bash
python3.12 <<'PY'
import oracledb, os
conn = oracledb.connect(
    user=os.environ["RECVIZ_ORACLE_USER"],
    password=os.environ["RECVIZ_ORACLE_PASSWORD"],
    dsn=f"{os.environ['RECVIZ_ORACLE_HOST']}:{os.environ['RECVIZ_ORACLE_PORT']}/{os.environ['RECVIZ_ORACLE_SERVICE']}",
)
cur = conn.cursor()
cur.execute("SELECT username, email, active FROM ab_user")
for row in cur:
    print(row)
cur.execute("SELECT name FROM ab_role ORDER BY name")
print("Roles:", [r[0] for r in cur])
conn.close()
PY
```

Expected:
```
('admin', 'admin@local.internal', 1)
Roles: ['Admin', 'Alpha', 'Gamma', 'Public', 'granter', 'sql_lab']
```

- [ ] **Step 6: Deactivate**

```bash
deactivate
```

---

# Part E — Lifecycle scripts, first start, verification

## Task 20: Pick the public port, write the 4 lifecycle scripts

**Files:**
- Modify: `/opt/rectify/rectrace/recviz/.env` — set `RECVIZ_PUBLIC_PORT`
- Create: `/opt/rectify/rectrace/recviz/app/scripts/start-all.sh`
- Create: `/opt/rectify/rectrace/recviz/app/scripts/stop-all.sh`
- Create: `/opt/rectify/rectrace/recviz/app/scripts/status.sh`
- Create: `/opt/rectify/rectrace/recviz/app/scripts/rotate-logs.sh`

- [ ] **Step 1: Find and confirm a free port**

```bash
# list currently-bound ports
lsof -i -P -n | awk '/LISTEN/ {print $9}' | sort -u

# pick a candidate — change 8090 below to whatever works for you
CANDIDATE_PORT=8090
lsof -iTCP:$CANDIDATE_PORT -sTCP:LISTEN && echo "IN USE — pick another" || echo "FREE"
```

Expected: `FREE` for your chosen port. If `IN USE`, try a different one.

- [ ] **Step 2: Confirm ingress through the corporate firewall**

From a USER workstation (not the server), try:
```bash
# on laptop
nc -vz <server-hostname> 8090   # or whatever your CANDIDATE_PORT is
```

Expected: either `succeeded` (firewall is open — proceed) or a timeout (firewall is closed — file a firewall ticket and wait before continuing). If the firewall is closed, you can still finish the install but users won't be able to reach it until the ticket lands.

- [ ] **Step 3: Persist the port to .env**

```bash
sed -i "s|RECVIZ_PUBLIC_PORT=<SET-THIS-IN-TASK-20>|RECVIZ_PUBLIC_PORT=$CANDIDATE_PORT|" /opt/rectify/rectrace/recviz/.env
grep RECVIZ_PUBLIC_PORT /opt/rectify/rectrace/recviz/.env
```

Expected: `RECVIZ_PUBLIC_PORT=8090` (or your chosen port).

- [ ] **Step 4: Create the scripts directory**

```bash
mkdir -p /opt/rectify/rectrace/recviz/app/scripts
```

- [ ] **Step 5: Write `start-all.sh`**

```bash
cat > /opt/rectify/rectrace/recviz/app/scripts/start-all.sh <<'SHEOF'
#!/bin/bash
# Start Superset + backend under nohup. Idempotent.
set -euo pipefail

RECVIZ_ROOT=/opt/rectify/rectrace/recviz
APP=$RECVIZ_ROOT/app
LOGS=$RECVIZ_ROOT/logs
RUN=$RECVIZ_ROOT/run

mkdir -p "$LOGS" "$RUN"

# Load environment
set -a
source "$RECVIZ_ROOT/.env"
set +a
export SUPERSET_CONFIG_PATH="$APP/superset/superset_config_prod.py"

# -------- Superset on 127.0.0.1:8088 (localhost-only) --------
if [ -f "$RUN/superset.pid" ] && kill -0 "$(cat "$RUN/superset.pid")" 2>/dev/null; then
    echo "Superset already running (pid $(cat "$RUN/superset.pid"))"
else
    echo "Starting Superset on 127.0.0.1:8088..."
    cd "$APP/superset"
    nohup venv/bin/gunicorn \
        --bind 127.0.0.1:8088 \
        --workers 1 \
        --timeout 120 \
        --pid "$RUN/superset.pid" \
        --access-logfile "$LOGS/superset-access.log" \
        --error-logfile "$LOGS/superset-error.log" \
        "superset.app:create_app()" \
        > "$LOGS/superset.log" 2>&1 &

    # Wait up to 90 seconds for Superset to become healthy
    for i in $(seq 1 45); do
        if curl -sf http://127.0.0.1:8088/health > /dev/null 2>&1; then
            echo "  Superset healthy after ${i}x2 seconds"
            break
        fi
        sleep 2
        if [ "$i" -eq 45 ]; then
            echo "  Superset FAILED to come up in 90s — check $LOGS/superset.log"
            exit 1
        fi
    done
fi

# -------- Backend on 0.0.0.0:$RECVIZ_PUBLIC_PORT (public) --------
if [ -f "$RUN/backend.pid" ] && kill -0 "$(cat "$RUN/backend.pid")" 2>/dev/null; then
    echo "Backend already running (pid $(cat "$RUN/backend.pid"))"
else
    echo "Starting backend on 0.0.0.0:$RECVIZ_PUBLIC_PORT..."
    cd "$APP/backend"
    nohup venv/bin/uvicorn app.main:app \
        --host 0.0.0.0 \
        --port "$RECVIZ_PUBLIC_PORT" \
        --workers 1 \
        --log-level info \
        > "$LOGS/backend.log" 2> "$LOGS/backend.err" &
    echo $! > "$RUN/backend.pid"

    # Wait up to 30 seconds for backend to become healthy
    for i in $(seq 1 15); do
        if curl -sf "http://127.0.0.1:$RECVIZ_PUBLIC_PORT/health" > /dev/null 2>&1; then
            echo "  Backend healthy after ${i}x2 seconds"
            break
        fi
        sleep 2
        if [ "$i" -eq 15 ]; then
            echo "  Backend FAILED to come up in 30s — check $LOGS/backend.err"
            exit 1
        fi
    done
fi

echo ""
echo "=== RecViz running ==="
echo "  Superset: http://127.0.0.1:8088          (localhost only, not user-visible)"
echo "  Backend:  http://0.0.0.0:$RECVIZ_PUBLIC_PORT  (public — this is the user URL)"
SHEOF
chmod +x /opt/rectify/rectrace/recviz/app/scripts/start-all.sh
```

- [ ] **Step 6: Write `stop-all.sh`**

```bash
cat > /opt/rectify/rectrace/recviz/app/scripts/stop-all.sh <<'SHEOF'
#!/bin/bash
# Stop backend + Superset. Gracefully, then force.
RUN=/opt/rectify/rectrace/recviz/run

# Stop backend FIRST (reverse of start order)
for svc in backend superset; do
    PID_FILE="$RUN/$svc.pid"
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            echo "Stopping $svc (pid $PID)..."
            kill "$PID"
            for i in $(seq 1 10); do
                if ! kill -0 "$PID" 2>/dev/null; then
                    echo "  $svc stopped gracefully"
                    break
                fi
                sleep 1
            done
            if kill -0 "$PID" 2>/dev/null; then
                echo "  force-killing $svc"
                kill -9 "$PID"
            fi
        else
            echo "$svc was not running (stale pidfile)"
        fi
        rm -f "$PID_FILE"
    else
        echo "$svc: no pidfile"
    fi
done
echo "Done."
SHEOF
chmod +x /opt/rectify/rectrace/recviz/app/scripts/stop-all.sh
```

- [ ] **Step 7: Write `status.sh`**

```bash
cat > /opt/rectify/rectrace/recviz/app/scripts/status.sh <<'SHEOF'
#!/bin/bash
# Show current status of both services
RECVIZ_ROOT=/opt/rectify/rectrace/recviz
RUN=$RECVIZ_ROOT/run
PORT=$(grep ^RECVIZ_PUBLIC_PORT "$RECVIZ_ROOT/.env" | cut -d= -f2)

check_svc() {
    local name=$1
    local pid_file="$RUN/$name.pid"
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            echo "$name: RUNNING (pid $pid)"
        else
            echo "$name: DEAD (stale pidfile, pid $pid not running)"
        fi
    else
        echo "$name: NOT STARTED (no pidfile)"
    fi
}

echo "=== Process status ==="
check_svc superset
check_svc backend

echo ""
echo "=== Health checks ==="
curl -sf http://127.0.0.1:8088/health > /dev/null && echo "  superset /health: OK" || echo "  superset /health: FAIL"
curl -sf "http://127.0.0.1:$PORT/health" > /dev/null && echo "  backend  /health: OK" || echo "  backend  /health: FAIL"
curl -sf "http://127.0.0.1:$PORT/" > /dev/null && echo "  frontend /: OK" || echo "  frontend /: FAIL"
SHEOF
chmod +x /opt/rectify/rectrace/recviz/app/scripts/status.sh
```

- [ ] **Step 8: Write `rotate-logs.sh`**

```bash
cat > /opt/rectify/rectrace/recviz/app/scripts/rotate-logs.sh <<'SHEOF'
#!/bin/bash
# Rotate logs >10 MB, gzip >1 day old, delete >30 days old
LOGS=/opt/rectify/rectrace/recviz/logs
cd "$LOGS" || exit 1

# For each log file >10MB, rename with timestamp + truncate in place
# (truncate-in-place preserves the file descriptor that nohup is writing to)
for log in backend.log backend.err superset.log superset-access.log superset-error.log; do
    if [ -f "$log" ] && [ "$(stat -c %s "$log")" -gt 10485760 ]; then
        cp "$log" "${log}.$(date +%Y%m%d-%H%M%S)"
        : > "$log"
    fi
done

# Gzip rotated files older than 1 day
find . -name '*.log.*[0-9]' -mtime +1 -not -name '*.gz' -exec gzip {} \; 2>/dev/null

# Delete gzipped archives older than 30 days
find . -name '*.log.*.gz' -mtime +30 -delete 2>/dev/null

echo "Rotation complete at $(date)"
SHEOF
chmod +x /opt/rectify/rectrace/recviz/app/scripts/rotate-logs.sh
```

- [ ] **Step 9: Verify all 4 scripts are executable**

```bash
ls -l /opt/rectify/rectrace/recviz/app/scripts/
```

Expected: 4 files, all with `-rwxr-xr-x` permissions.

---

## Task 21: First start — bring both services up

**Files:** none — just running the scripts.

- [ ] **Step 1: Run `start-all.sh`**

```bash
cd /opt/rectify/rectrace/recviz/app/scripts
bash start-all.sh
```

Expected output:
```
Starting Superset on 127.0.0.1:8088...
  Superset healthy after 12x2 seconds    # or similar — first start is slower
Starting backend on 0.0.0.0:8090...
  Backend healthy after 3x2 seconds
=== RecViz running ===
  Superset: http://127.0.0.1:8088          (localhost only, not user-visible)
  Backend:  http://0.0.0.0:8090           (public — this is the user URL)
```

If either service fails:
- `tail -100 /opt/rectify/rectrace/recviz/logs/superset.log` for Superset errors
- `tail -100 /opt/rectify/rectrace/recviz/logs/backend.err` for backend errors
- Common first-start failures:
  - **Backend: "Superset authentication failed"** → `SUPERSET_PASSWORD` in `.env` does not match what you entered in Task 19. Edit `.env` and `bash stop-all.sh && bash start-all.sh`.
  - **Backend: "ImportError: cannot import name 'JSONB'"** → the JSONB patch didn't apply — go back to Task 2.
  - **Superset: "ORA-xxxxx"** → Oracle issue, either the SECRET_KEY env var is missing or the SQLALCHEMY_DATABASE_URI is wrong. Re-check Task 17 + Task 10.

- [ ] **Step 2: Confirm processes are alive**

```bash
bash status.sh
```

Expected:
```
=== Process status ===
superset: RUNNING (pid XXXXX)
backend: RUNNING (pid XXXXX)

=== Health checks ===
  superset /health: OK
  backend  /health: OK
  frontend /: OK
```

All three health checks must be OK.

- [ ] **Step 3: Tail logs for 30 seconds to spot any delayed errors**

```bash
timeout 30 tail -F /opt/rectify/rectrace/recviz/logs/backend.log /opt/rectify/rectrace/recviz/logs/superset-error.log
```

Expected things that are NOT errors but look scary:
- `INFO: Application startup complete.` (uvicorn is ready)
- `DatabaseRegistrar: synced 1 databases` (backend registered your day-1 recon source)
- `WARNING: The DBs table is empty` (Superset pre-backend-registration warning, one-off)

Things that ARE errors:
- Any `ERROR` or `CRITICAL` line
- `DPY-6001: cannot connect to database` — Oracle unreachable
- `superset-auth failed after 3 retries` — wrong SUPERSET_PASSWORD

If you see errors, stop and fix before proceeding.

---

# Part F — Smoke tests and end-to-end data validation

## Task 22: Server-side curl battery (6 checks)

**Files:** none — verification only.

- [ ] **Step 1: Source port for convenience**

```bash
PORT=$(grep ^RECVIZ_PUBLIC_PORT /opt/rectify/rectrace/recviz/.env | cut -d= -f2)
echo "Using PORT=$PORT"
```

- [ ] **Step 2: Run the 6 curl checks**

```bash
echo "--- Check 1: Superset /health (internal only) ---"
curl -sf http://127.0.0.1:8088/health && echo " ← OK" || echo " ← FAIL"

echo "--- Check 2: Backend /health ---"
curl -sf "http://127.0.0.1:$PORT/health" && echo " ← OK" || echo " ← FAIL"

echo "--- Check 3: Backend -> Superset link ---"
curl -s "http://127.0.0.1:$PORT/api/test-superset" | python3.12 -m json.tool

echo "--- Check 4: databases.json loaded, 1 entry registered ---"
curl -s "http://127.0.0.1:$PORT/api/databases" | python3.12 -m json.tool | head -30

echo "--- Check 5: Frontend static files served from / ---"
curl -sI "http://127.0.0.1:$PORT/" | head -3
# expect HTTP/1.1 200 OK, content-type: text/html

echo "--- Check 6: SPA fallback for client-side routes ---"
curl -sI "http://127.0.0.1:$PORT/dashboards" | head -1
curl -sI "http://127.0.0.1:$PORT/settings" | head -1
# both should return 200 OK (the 404 handler serves index.html)
```

Expected:
1. Check 1: `{"status":"OK"}` and `← OK`
2. Check 2: `{"status":"ok","superset":true}` and `← OK`
3. Check 3: `"connected": true` with a list of dataset names
4. Check 4: JSON array with at least one entry matching your day-1 `databases.json` name
5. Check 5: `HTTP/1.1 200 OK` and `content-type: text/html`
6. Check 6: both `200 OK` (NOT 404)

If any check fails, consult the troubleshooting matrix in the design doc §9 OR `logs/backend.err`.

---

## Task 23: Browser smoke test from a real user machine

**Files:** none — visual inspection only.

**Why:** proves the full path works over the real corporate network.

- [ ] **Step 1: From a user workstation (NOT the server), open the URL**

In Chrome or Edge, navigate to:
```
http://<server-hostname>:<PORT>/
```

(Replace with your server hostname and the port from `.env`.)

- [ ] **Step 2: Verify visual correctness**

Check all of:
- [ ] Page loads within ~3 seconds, no error messages
- [ ] Left sidebar shows 4 items: Dashboards, Explorer, Reports, Settings
- [ ] Top header has a theme toggle (sun/moon icon)
- [ ] Main area shows "Dashboards" page with an empty state ("No dashboards yet" or similar)
- [ ] No red/error banners

- [ ] **Step 3: Verify data source connectivity**

- [ ] Click **Settings** in the sidebar
- [ ] Click the **Data Sources** tab
- [ ] Verify your day-1 recon source shows up as a card/row
- [ ] Check the status dot is GREEN (connected)
- [ ] If RED: click into it, read the error message, fix (usually Oracle credentials in `databases.json`), and restart

- [ ] **Step 4: Verify theme toggle works**

Click the sun/moon toggle in the header. The entire app should flip between light and dark mode smoothly, no flash of unstyled content.

- [ ] **Step 5: Verify DevTools Network tab looks clean**

Open DevTools (F12) → Network tab → reload the page.

Expected:
- `GET /` → 200, text/html (index.html)
- `GET /assets/index-*.js` → 200, application/javascript
- `GET /assets/index-*.css` → 200, text/css
- `GET /api/dashboards` → 200, application/json (empty array `[]`)
- `GET /api/databases` → 200, application/json (array with your day-1 entry)

No 4xx or 5xx responses. No CORS errors in the Console tab.

---

## Task 24: End-to-end first real dashboard

**Files:** none — UI work.

**Why:** proves the full stack works with real Oracle data, end to end, and leaves behind one working dashboard as a checkpoint.

- [ ] **Step 1: Build your first dataset**

- [ ] In the browser, navigate to **Datasets** in the sidebar (if present — otherwise the builder may be nested under "Explorer" or similar per your current UI)
- [ ] Click **New Dataset** / **Create**
- [ ] Select your day-1 recon database from the dropdown
- [ ] In the SQL editor, write a small, bounded query. Example (adjust table name to match your real recon schema):
   ```sql
   SELECT
       agent_code,
       COUNT(*) AS record_count
   FROM <your-real-table-name>
   GROUP BY agent_code
   FETCH FIRST 100 ROWS ONLY
   ```
- [ ] Click **Run** — verify real data returns (not empty, not an error)
- [ ] Click **Save** and give it a name like `test-e2e-agent-counts`

- [ ] **Step 2: Build your first chart from the dataset**

- [ ] Navigate to **Charts** → **New Chart**
- [ ] Select the dataset you just saved
- [ ] Chart type: **Bar chart** (simplest to verify)
- [ ] X-axis: `agent_code`
- [ ] Y-axis: `record_count`
- [ ] Click **Render** — you should see bars with real data
- [ ] Save with a name like `test-e2e-bar`

- [ ] **Step 3: Build your first dashboard**

- [ ] Navigate to **Dashboards** → **New Dashboard**
- [ ] Name it `E2E Test Dashboard`
- [ ] Drag the chart from the left panel onto the canvas
- [ ] Save

- [ ] **Step 4: View the dashboard**

- [ ] Open the dashboard. The bar chart should render with real Oracle data.
- [ ] Apply any available filter — the chart should refresh accordingly.

- [ ] **Step 5: Confirm in logs that the query actually went to Oracle**

Back on the server:
```bash
tail -20 /opt/rectify/rectrace/recviz/logs/backend.log | grep -i 'oracle\|executed\|query'
```

Expected: you should see at least one log line indicating a query was sent to Oracle — confirms the backend actually talked to Oracle (not a cached result or mock data).

**IF THIS PHASE SUCCEEDS, THE DEPLOYMENT IS COMPLETE.** You can now:
1. Hand the URL to business users
2. Add remaining recon data sources to `databases.json`
3. Build real dashboards

---

# Part G — Optional hardening (recommended but not required for go-live)

## Task 25: Add log rotation and reboot auto-start to crontab

**Files:** modifies `rectify`'s user crontab.

**Why:** without this, logs grow forever and a server reboot leaves RecViz down until a human manually restarts it.

- [ ] **Step 1: Check current crontab**

```bash
crontab -l 2>/dev/null || echo "(empty)"
```

Expected: either an empty crontab or whatever is currently scheduled.

- [ ] **Step 2: Add rotation + reboot entries**

```bash
(crontab -l 2>/dev/null; cat <<'EOF'
# RecViz log rotation — 2am daily
0 2 * * * /opt/rectify/rectrace/recviz/app/scripts/rotate-logs.sh >> /opt/rectify/rectrace/recviz/logs/rotation.log 2>&1

# RecViz auto-start on reboot
@reboot /opt/rectify/rectrace/recviz/app/scripts/start-all.sh >> /opt/rectify/rectrace/recviz/logs/reboot.log 2>&1
EOF
) | crontab -
```

- [ ] **Step 3: Verify crontab was updated**

```bash
crontab -l | tail -10
```

Expected: both entries visible at the bottom.

- [ ] **Step 4: Manually trigger `rotate-logs.sh` to confirm it runs**

```bash
bash /opt/rectify/rectrace/recviz/app/scripts/rotate-logs.sh
tail -3 /opt/rectify/rectrace/recviz/logs/rotation.log 2>/dev/null || echo "no rotation log yet"
```

Expected: rotation script runs without error and prints its completion timestamp.

---

## Task 26: Back up `.env` and record the deployment

**Files:** copying `.env` off-server + recording install-day notes.

**Why:** the `.env` contains your Oracle credentials AND the Superset `SECRET_KEY`. Losing any of those is painful. Corporate password vaults are the right place.

- [ ] **Step 1: Print the `.env` contents for manual copy**

```bash
cat /opt/rectify/rectrace/recviz/.env
```

Copy the output into your personal password manager (1Password, Bitwarden, or the Citi-approved password vault). Store under a name like `RecViz prod .env - 2026-04-09`.

- [ ] **Step 2: Write an install-day note**

```bash
cat > /opt/rectify/rectrace/recviz/INSTALLED.txt <<EOF
RecViz installed on $(date) by $(whoami)@$(hostname)
Design doc: docs/superpowers/specs/2026-04-09-rhel-oracle-no-sudo-deployment-design.md
Plan: docs/superpowers/plans/2026-04-09-rhel-oracle-no-sudo-deployment.md
Git commit: <paste-commit-SHA-from-Task-6>
Oracle: $(grep RECVIZ_ORACLE_HOST /opt/rectify/rectrace/recviz/.env | cut -d= -f2):$(grep RECVIZ_ORACLE_PORT /opt/rectify/rectrace/recviz/.env | cut -d= -f2)/$(grep RECVIZ_ORACLE_SERVICE /opt/rectify/rectrace/recviz/.env | cut -d= -f2)
Public URL: http://$(hostname):$(grep RECVIZ_PUBLIC_PORT /opt/rectify/rectrace/recviz/.env | cut -d= -f2)/
EOF
cat /opt/rectify/rectrace/recviz/INSTALLED.txt
```

Expected: file created with basic install metadata for future reference.

- [ ] **Step 3: Save the tarball off-server for rollback**

```bash
# on laptop
ls -lh ~/recviz-deploy-*.tar.gz
# confirm you still have the tarball on the laptop — it's your rollback asset
# optionally copy it to a shared drive / artifact repo for longer retention
```

---

# Done

At this point, RecViz is running on RHEL, serving real Oracle data, over a single nohup-managed port, with automated log rotation and reboot recovery in place. Hand the URL to business users and monitor `logs/backend.err` and `logs/superset-error.log` over the next few days for anything unexpected.

---

## Plan self-review

### Spec coverage check

Every major section of the design doc has a task:

| Design section | Implemented by task(s) |
|---|---|
| §2 Decisions — locked in | Encoded as facts in Task descriptions throughout |
| §3 Architecture | Task 4 (StaticFiles mount) + Task 21 (services running) |
| §4 Directory layout | Task 9 (dir skeleton) + Task 10/11 (env + databases.json locations) |
| §5.1 JSONB→JSON | Task 2 + Task 3 (verify) |
| §5.2 Async engine (no change needed) | Task 13 Step 4 verifies SQLAlchemy async dialect |
| §5.3 StaticFiles mount | Task 4 + Task 22 Checks 5/6 verify |
| §5.4 oracledb dependency | Task 5 + Task 13 Step 3 verify |
| §6 Install phases 1–10 | Tasks 1–24 mapped 1:1 to the design phases |
| §7 Lifecycle scripts | Task 20 |
| §8.1 Routine ops | Task 21 (start) + Task 22 (status) |
| §8.2 Releasing new version | Deferred — documented in design §8, not part of first-install plan |
| §8.3 Backups | Task 26 |
| §9 Troubleshooting | Referenced inline in Task 21 Step 1 troubleshooting block |
| §10 Gotchas | Called out inline in Task 11, Task 16, Task 21 |
| §11 Deferred items | Task 25 is optional hardening |

Coverage looks complete. Release procedure is intentionally scoped out of the first-install plan — it's a separate runbook that applies after install.

### Placeholder scan

Searched for "TBD", "TODO", "fill in details", "similar to Task N" — none found. The only `<placeholder>` markers in the document are inside user-filled fields (passwords, hostnames) in the `.env` template and `databases.json` template, which is correct.

### Type consistency

The scripts `start-all.sh`, `stop-all.sh`, `status.sh` consistently reference:
- `$RUN/backend.pid` and `$RUN/superset.pid` (not `backend-pid` or `backend.pidfile`)
- `$LOGS/backend.log`, `$LOGS/backend.err`, `$LOGS/superset.log`, `$LOGS/superset-access.log`, `$LOGS/superset-error.log`
- `127.0.0.1:8088` for Superset, `0.0.0.0:$RECVIZ_PUBLIC_PORT` for backend
- `.env` as `/opt/rectify/rectrace/recviz/.env` in all three scripts

Consistent throughout. No function/variable name drift between tasks.

### Scope check

Single subsystem (RecViz deployment), single environment (RHEL + Oracle), single install pass. Does not try to refactor RecViz features or add functionality. Appropriately scoped.

---

**End of plan.**
