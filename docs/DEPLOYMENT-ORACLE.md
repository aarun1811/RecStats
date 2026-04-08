# RecViz v1.0 — Production Deployment (Single Server, Oracle, No Redis)

**Audience:** GRU dev team installing RecViz on a Citi-managed Linux server.
**Topology:** ONE Linux server runs Frontend + FastAPI backend + Superset. Oracle is remote on Citi DBA-managed infrastructure.
**No Postgres. No Redis. No Docker in prod.**

This document is the canonical deployment runbook for v1.0. It diverges from the dev setup (`infrastructure/` Docker Compose) deliberately — production uses native services and Oracle.

> **Honest scope note.** RecViz v1.0 was developed end-to-end against Postgres in dev. The Oracle path was planned and the SQLAlchemy URI builder + python-oracledb shim were added in Phase 4, but the backend's metadata DB (the `recviz_*` tables) has only been exercised against Postgres. **Step 5 below includes a one-time Alembic migration on Oracle that has not been run before** — the first time someone follows this doc, they should expect to debug at least one Oracle-vs-Postgres SQL dialect quirk in the migrations. Plan a 30-minute buffer for that.

---

## 0. What you're installing

| Component | What | Where it runs | Port |
|---|---|---|---|
| **Frontend** | React/Vite SPA built to static files, served by Nginx | This server | 80 (or 443 with TLS) |
| **Backend** | FastAPI sidecar app via uvicorn | This server | 8000 (localhost only) |
| **Superset** | Apache Superset 6.0.0 headless query engine via gunicorn | This server | 8088 (localhost only) |
| **Oracle** | Recon source data + Superset metadata + RecViz managed tables, ALL in one schema | Remote Citi DBA box | 1521 |
| ~~PostgreSQL~~ | Not in prod | — | — |
| ~~Redis~~ | Not in prod | — | — |
| ~~Celery~~ | Not in prod (export endpoints stubbed) | — | — |

Nginx fronts the server. Public traffic hits port 80/443. Nginx serves the SPA static files at `/` and reverse-proxies `/api/*` to the backend on `:8000`. Superset on `:8088` is **NOT exposed publicly** — only the backend talks to it.

---

## 1. Prerequisites — Citi DBA + server admin checklist

Before you start the install, get these from your DBA / sysadmin:

**Oracle (from DBA):**
- Hostname or TNS alias of the Oracle instance
- Port (default 1521)
- Service name (e.g., `RECVIZPRD`)
- A dedicated Oracle schema/user named `RECVIZ` (or whatever Citi naming requires) with grants:
  - `CREATE SESSION`
  - `CREATE TABLE`, `CREATE INDEX`, `CREATE SEQUENCE`, `CREATE VIEW`
  - `ALTER TABLE`, `DROP TABLE` (Alembic needs these)
  - `UNLIMITED TABLESPACE` (or a quota of at least 5 GB on the default tablespace — Superset's metadata tables grow over time)
  - SELECT grants on whatever EXISTING recon tables this RECVIZ user needs to query (TLM tables, etc.)
- Confirm the schema is reachable from the deployment server: `tnsping` or `nc -vz <host> 1521` should succeed

**Server (Linux box):**
- RHEL 8/9 or Ubuntu 22.04+ (the doc is written assuming RHEL — adjust `dnf` → `apt` if Ubuntu)
- Root or sudo access for the install
- A non-root user `recviz` to run all services (`sudo useradd -m -s /bin/bash recviz`)
- Outbound network reachability to Oracle on port 1521
- Inbound port 80 (and 443 if TLS) open in the corporate firewall
- Enough disk for: Python venvs (~500 MB), Node + frontend build (~600 MB), Superset metadata growth (~1 GB year 1)

**Software dependencies (install via OS package manager):**
```bash
sudo dnf install -y python3.12 python3.12-devel python3-pip git nginx gcc make
# Node 22 LTS — install via NodeSource or nvm
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo dnf install -y nodejs
sudo npm install -g pnpm@9
```

> **Oracle Instant Client is NOT required.** RecViz uses `python-oracledb` in **thin mode**, which speaks the Oracle wire protocol natively in pure Python. The dev shim in `superset/superset_config.py` (lines 1–22) aliases `oracledb` as `cx_Oracle` for SQLAlchemy 1.4 compatibility — no native libs needed.

---

## 2. Clone the repo and lay out directories

As the `recviz` user:

```bash
sudo -iu recviz
mkdir -p ~/app ~/logs ~/run
cd ~/app
git clone <your-internal-git-url>/recviz.git .
git checkout v1.0    # the tag created at milestone close
```

Final layout:
```
/home/recviz/
├── app/                    # cloned repo
│   ├── backend/
│   ├── frontend/
│   ├── superset/
│   ├── docs/
│   └── ...
├── logs/                   # log files for systemd units
├── run/                    # pid + state files
└── .env                    # secrets file (NOT in git)
```

---

## 3. Oracle — confirm reachability and create a databases.json

### 3a. Verify the Oracle service is reachable from the server

```bash
nc -vz <oracle-host> 1521
# expect: succeeded
```

If this fails, get the firewall rule from your sysadmin before continuing.

### 3b. Create `~/.env` with the Oracle connection details

```bash
cat > /home/recviz/.env <<'EOF'
# === Oracle (single schema for everything) ===
RECVIZ_ORACLE_HOST=<oracle-host>
RECVIZ_ORACLE_PORT=1521
RECVIZ_ORACLE_SERVICE=<service-name>          # e.g., RECVIZPRD
RECVIZ_ORACLE_USER=RECVIZ
RECVIZ_ORACLE_PASSWORD=<your-oracle-password>

# === Backend metadata DB (RecViz Alembic-managed tables in the same Oracle schema) ===
# Per Phase 4 D-26: use plain `oracle://` dialect (NOT oracle+oracledb://) so SQLAlchemy
# 1.4's cx_Oracle dialect handler resolves it via the python-oracledb shim.
# For SQLAlchemy 2.x (used by the backend, not Superset), use oracle+oracledb://.
RECVIZ_DB_URL=oracle+oracledb://${RECVIZ_ORACLE_USER}:${RECVIZ_ORACLE_PASSWORD}@${RECVIZ_ORACLE_HOST}:${RECVIZ_ORACLE_PORT}/?service_name=${RECVIZ_ORACLE_SERVICE}

# === RECON_DB_URL is unused in prod ===
# The dev `recon_db_url` setting points at Postgres recon_data — not used in
# prod because the backend talks to Superset for queries, not the recon DB
# directly. Set to a dummy URI so Pydantic Settings doesn't complain.
RECON_DB_URL=oracle+oracledb://${RECVIZ_ORACLE_USER}:${RECVIZ_ORACLE_PASSWORD}@${RECVIZ_ORACLE_HOST}:${RECVIZ_ORACLE_PORT}/?service_name=${RECVIZ_ORACLE_SERVICE}

# === Superset connection (backend talks to Superset over HTTP) ===
SUPERSET_URL=http://localhost:8088
SUPERSET_USERNAME=admin
SUPERSET_PASSWORD=<set-this-during-superset-init-step-5>

# === Redis is NOT used in prod ===
# The dev Settings class has a redis_url default. Set it to a dummy value.
# Nothing actually connects to it in prod because no code path that needs
# Redis is wired (Celery + cache backends are disabled in superset_config.py).
REDIS_URL=redis://localhost:6379/0

# === RecViz environment marker ===
RECVIZ_ENV=production

# === Path to the multi-database routing config ===
# Default points at backend/app/config/databases.json — edit that file in
# step 3c BEFORE starting the backend.
DATABASES_CONFIG_PATH=/home/recviz/app/backend/app/config/databases.json
EOF

chmod 600 /home/recviz/.env
```

> The backend's `Settings` class (`backend/app/config.py`) reads `recon_db_url`, `recviz_db_url`, `redis_url`, `superset_url`, `superset_username`, `superset_password`, and `databases_config_path`. The names above match those env vars (Pydantic Settings reads UPPER_SNAKE → lower_snake automatically).

### 3c. Edit `backend/app/config/databases.json` to point at Oracle

The dev file lists 4 logical databases all pointing at Postgres `recon_data` via `postgres:5432` (the docker hostname). For prod, edit it so each entry points at the right Oracle service. **Use the `oracle://` dialect and a dummy `cx_Oracle` driver — the shim in superset_config.py converts it.**

```bash
cat > /home/recviz/app/backend/app/config/databases.json <<'EOF'
{
  "databases": [
    {
      "name": "superset_db_TCOSPRD",
      "display_name": "TLM Consumer (TCOSPRD)",
      "sqlalchemy_uri": "oracle://RECVIZ_RO:<password>@<oracle-host>:1521/?service_name=TCOSPRD",
      "dialect": "oracle",
      "type": "tlm",
      "schema": "TLM_CONSUMER"
    },
    {
      "name": "superset_db_TFINPRD",
      "display_name": "TLM Finance (TFINPRD)",
      "sqlalchemy_uri": "oracle://RECVIZ_RO:<password>@<oracle-host>:1521/?service_name=TFINPRD",
      "dialect": "oracle",
      "type": "tlm",
      "schema": "TLM_FINANCE"
    }
    /* ... more entries per Citi recon DB landscape ... */
  ]
}
EOF
```

The `databases.json` file is read by `DatabaseRegistrar` at backend startup and synced into Superset's `dbs` table via the Superset API. **Each entry here will become a registered database in Superset, queryable from the dataset/SQL editor.** Talk to the Citi DBA team to get the canonical list of recon DBs that should be exposed.

> **Why one Oracle entry per logical recon DB even if they're all in the same instance?** RecViz can route different datasets to different logical databases via the `database_routing.database` field on each data source. This is the foundation for charging-back queries to the right recon team and for future row-level security. Keep one entry per logical recon DB.

---

## 4. Backend — install + Alembic migration on Oracle

### 4a. Add Oracle support to the backend's Python environment

The dev `requirements.txt` does NOT include `oracledb` — only `psycopg2-binary` and `asyncpg`. For prod you must add Oracle support. Create a prod requirements overlay:

```bash
cd /home/recviz/app/backend
python3.12 -m venv venv
source venv/bin/activate
pip install --upgrade pip wheel
pip install -r requirements.txt
pip install oracledb==2.5.1   # python-oracledb thin mode, async-capable
```

> **Why oracledb==2.5.1?** It's the latest stable release with async support compatible with SQLAlchemy 2.x's `oracle+oracledb://` dialect. The dev shim in `superset_config.py` aliases it as `cx_Oracle` — that aliasing works for both 1.x and 2.x of oracledb.

### 4b. Run the RecViz Alembic migrations against Oracle

The backend has its own Alembic migrations under `backend/app/migrations/` that create the `recviz_dashboards`, `recviz_charts`, `recviz_kpis`, `recviz_datasets`, `recviz_data_sources` tables (and the separate `recviz_alembic_version` tracking table per `project_superset_alembic.md`).

```bash
cd /home/recviz/app/backend
set -a; source /home/recviz/.env; set +a    # load env vars into shell
python -m alembic -c app/migrations/alembic.ini upgrade head
```

**Expect at least one Oracle-vs-Postgres SQL incompatibility on the first run.** Common ones:
- `JSONB` columns — Oracle uses `CLOB` or `JSON` (12c+) instead. The migration likely uses `sa.JSON()` which Postgres dialects render as JSONB and Oracle dialects render as CLOB. Should work but test.
- `BIGSERIAL` / `SERIAL` — Oracle has no SERIAL type. Use `Identity()` columns (SQLAlchemy 1.4+) or sequences. Alembic generates `Identity()` correctly for Oracle when the migration was authored against a dialect-agnostic ORM.
- Reserved words — `RESOLUTION`, `TIMESTAMP`, etc. may need quoting in Oracle. The ORM should handle this, but watch the generated DDL.

If migration fails:
1. `python -m alembic -c app/migrations/alembic.ini downgrade base` (reset)
2. Read the SQL error, find the offending column/type
3. Edit the migration in `backend/app/migrations/versions/` to be Oracle-compatible
4. Re-run

### 4c. Verify the tables exist

Use `sqlplus` or any Oracle client:
```sql
SELECT table_name FROM user_tables WHERE table_name LIKE 'RECVIZ_%';
-- expect: RECVIZ_DASHBOARDS, RECVIZ_CHARTS, RECVIZ_KPIS, RECVIZ_DATASETS,
--         RECVIZ_DATA_SOURCES, RECVIZ_ALEMBIC_VERSION
```

---

## 5. Superset — install + Oracle metadata DB + bootstrap

Superset uses its OWN Python environment (separate from the backend) so its dependencies don't pollute the backend.

### 5a. Install Superset

```bash
cd /home/recviz/app/superset
python3.12 -m venv venv
source venv/bin/activate
pip install --upgrade pip wheel
pip install apache-superset==6.0.0
pip install oracledb==2.5.1                   # Oracle driver + the cx_Oracle alias shim works
pip install gunicorn==22.0.0                  # production WSGI server
```

### 5b. Patch `superset_config.py` for prod (Oracle, no Redis)

The dev `superset/superset_config.py` is hard-coded for Postgres + Redis. Create a prod-specific copy that drops Redis and uses Oracle. Save it as `/home/recviz/app/superset/superset_config_prod.py`:

```python
# /home/recviz/app/superset/superset_config_prod.py
# Production Superset config — Oracle metadata, no Redis, no Celery.

import os
import sys
import oracledb

# Oracle driver shim — keep this exactly as in the dev superset_config.py
# (Phase 4 D-26: SQLAlchemy 1.4's cx_Oracle dialect needs python-oracledb
# aliased as cx_Oracle and version set to a parseable string).
oracledb.version = "8.3.0"
sys.modules["cx_Oracle"] = oracledb

# === Secrets ===
SECRET_KEY = os.environ["SECRET_KEY"]   # MUST be set; raises if missing

# === Metadata DB → Oracle (same schema as recon_data per user choice) ===
SQLALCHEMY_DATABASE_URI = (
    f"oracle://{os.environ['RECVIZ_ORACLE_USER']}:"
    f"{os.environ['RECVIZ_ORACLE_PASSWORD']}@"
    f"{os.environ['RECVIZ_ORACLE_HOST']}:{os.environ['RECVIZ_ORACLE_PORT']}/"
    f"?service_name={os.environ['RECVIZ_ORACLE_SERVICE']}"
)

# === No Redis — use SimpleCache (in-process memory) ===
# This means no caching across Superset worker restarts and no shared cache
# between gunicorn workers. Acceptable for v1 single-worker deploy. Revisit
# in v1.1 if Superset query latency becomes a complaint.
CACHE_CONFIG = {"CACHE_TYPE": "SimpleCache"}
DATA_CACHE_CONFIG = {"CACHE_TYPE": "SimpleCache"}
FILTER_STATE_CACHE_CONFIG = {"CACHE_TYPE": "SimpleCache"}
EXPLORE_FORM_DATA_CACHE_CONFIG = {"CACHE_TYPE": "SimpleCache"}

# === No Celery — explicit None instead of CeleryConfig class ===
CELERY_CONFIG = None

# === No Results backend (sync queries only) ===
# RecViz frontend uses synchronous query execution; SQL Lab async results
# are not exercised in v1. Setting to None disables the warning.
RESULTS_BACKEND = None

FEATURE_FLAGS = {
    "ENABLE_TEMPLATE_PROCESSING": True,
    # Async query execution requires Celery + Redis — keep disabled in prod.
    "GLOBAL_ASYNC_QUERIES": False,
}

# === CORS — allow only the local FastAPI backend ===
ENABLE_CORS = True
CORS_OPTIONS = {
    "supports_credentials": True,
    "allow_headers": ["*"],
    "resources": ["/api/*"],
    "origins": ["http://localhost:8000"],   # backend only — Superset is not public
}

# === No public Superset UI ===
ENABLE_JAVASCRIPT_CONTROLS = False
SUPERSET_WEBSERVER_TIMEOUT = 120

# === Single worker — no shared cache available ===
SUPERSET_WORKERS = 1

# === Logging — write to a file the systemd unit can tail ===
import logging
LOG_LEVEL = "INFO"
ENABLE_TIME_ROTATE = True
TIME_ROTATE_LOG_LEVEL = "INFO"
FILENAME = "/home/recviz/logs/superset.log"
ROLLOVER = "midnight"
INTERVAL = 1
BACKUP_COUNT = 30
```

### 5c. Bootstrap Superset (one-time)

```bash
export SUPERSET_CONFIG_PATH=/home/recviz/app/superset/superset_config_prod.py
set -a; source /home/recviz/.env; set +a
export SECRET_KEY=$(python -c 'import secrets; print(secrets.token_hex(32))')
echo "SECRET_KEY=$SECRET_KEY" >> /home/recviz/.env  # persist for systemd

cd /home/recviz/app/superset
source venv/bin/activate

# Run Superset's own DB upgrade (creates Superset's metadata tables in Oracle)
superset db upgrade

# Create the admin user — the password you set here goes into SUPERSET_PASSWORD in .env
superset fab create-admin \
  --username admin \
  --firstname RecViz \
  --lastname Admin \
  --email admin@local \
  --password '<choose-a-strong-password-and-set-SUPERSET_PASSWORD-in-.env-too>'

# Initialize roles and permissions
superset init
```

> **`superset db upgrade` is the second risky Oracle migration step.** Superset's own migrations have been tested against Oracle by the upstream project, but watch for any errors during this step. If Oracle complains about reserved words or column types, file an issue against this doc and consult the Apache Superset Oracle deployment guide.

### 5d. Update SUPERSET_PASSWORD in .env

After `fab create-admin`, edit `/home/recviz/.env` and set `SUPERSET_PASSWORD=<the-password-you-typed>` so the backend can authenticate to Superset.

---

## 6. Frontend — build static assets

```bash
cd /home/recviz/app/frontend
pnpm install --frozen-lockfile
echo 'VITE_API_BASE_URL=' > .env.production    # empty = same-origin (Nginx proxies /api)
pnpm build
# output: /home/recviz/app/frontend/dist/
```

`dist/` is what Nginx will serve. The empty `VITE_API_BASE_URL` means the frontend will issue API requests to the SAME ORIGIN (e.g., `https://recviz.citi.internal/api/...`) — Nginx proxies those to the backend on `:8000`.

---

## 7. systemd units — Superset and backend as managed services

### 7a. Superset unit

```bash
sudo tee /etc/systemd/system/recviz-superset.service > /dev/null <<'EOF'
[Unit]
Description=RecViz Superset (headless query engine)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=recviz
Group=recviz
WorkingDirectory=/home/recviz/app/superset
EnvironmentFile=/home/recviz/.env
Environment=SUPERSET_CONFIG_PATH=/home/recviz/app/superset/superset_config_prod.py
ExecStart=/home/recviz/app/superset/venv/bin/gunicorn \
    --bind 127.0.0.1:8088 \
    --workers 1 \
    --timeout 120 \
    --log-level info \
    --access-logfile /home/recviz/logs/superset-access.log \
    --error-logfile /home/recviz/logs/superset-error.log \
    "superset.app:create_app()"
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
```

### 7b. Backend unit (depends on Superset being ready)

```bash
sudo tee /etc/systemd/system/recviz-backend.service > /dev/null <<'EOF'
[Unit]
Description=RecViz FastAPI backend (sidecar to Superset)
After=recviz-superset.service network-online.target
Requires=recviz-superset.service
Wants=network-online.target

[Service]
Type=simple
User=recviz
Group=recviz
WorkingDirectory=/home/recviz/app/backend
EnvironmentFile=/home/recviz/.env
ExecStart=/home/recviz/app/backend/venv/bin/uvicorn app.main:app \
    --host 127.0.0.1 \
    --port 8000 \
    --workers 1 \
    --log-level info
Restart=on-failure
RestartSec=10
StandardOutput=append:/home/recviz/logs/backend.log
StandardError=append:/home/recviz/logs/backend-error.log

[Install]
WantedBy=multi-user.target
EOF
```

> **Why `--workers 1`?** Two reasons. (1) The backend uses an in-memory `ConnectionStatusTracker` and a `DatabaseRegistrar` cache — multiple workers would have inconsistent state. Per `feedback_no_mock_shortcuts.md`, we don't want any process-local fakeness leaking into responses. (2) Superset's `SimpleCache` is also in-process — multi-worker would mean each worker has its own query cache, defeating the point. v1.1 should move to a real cache backend before scaling to multi-worker.

### 7c. Enable + start

```bash
sudo systemctl daemon-reload
sudo systemctl enable recviz-superset recviz-backend
sudo systemctl start recviz-superset
# wait for Superset to come up — first start takes ~30-60s on fresh Oracle
sleep 60
sudo systemctl start recviz-backend
sudo systemctl status recviz-superset recviz-backend
```

Both should show `active (running)`. If either fails:
```bash
sudo journalctl -u recviz-superset -n 50
sudo journalctl -u recviz-backend -n 50
```

---

## 8. Nginx — reverse proxy

```bash
sudo tee /etc/nginx/conf.d/recviz.conf > /dev/null <<'EOF'
upstream recviz_backend {
    server 127.0.0.1:8000;
    keepalive 32;
}

server {
    listen 80 default_server;
    server_name _;

    # Static SPA
    root /home/recviz/app/frontend/dist;
    index index.html;

    # Long cache for hashed assets, no cache for index.html
    location /assets/ {
        access_log off;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # API proxy → FastAPI backend
    location /api/ {
        proxy_pass http://recviz_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
        proxy_send_timeout 300;
    }

    # SPA fallback — let TanStack Router handle client-side routes
    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

sudo nginx -t                  # check config
sudo systemctl enable nginx
sudo systemctl start nginx
```

> **Notes on what's NOT in this Nginx config.** No TLS — get the cert from your Citi PKI team and add a `listen 443 ssl;` block + `ssl_certificate` lines. No HTTP→HTTPS redirect — add once TLS is in place. No `Content-Security-Policy` or `X-Frame-Options` — Phase 9's embed mode requires `X-Frame-Options: ALLOWALL` for the `/embed/` route, which is a known security gap (see `.planning/codebase/CONCERNS.md`). Lock this down with a referer allowlist before exposing publicly.

---

## 9. Smoke test — verify the install end-to-end

```bash
# 1. Backend health
curl -sf http://localhost:8000/docs > /dev/null && echo "backend ✓" || echo "backend ✗"

# 2. Backend → Superset auth
curl -sf http://localhost:8000/api/databases > /dev/null && echo "backend→superset ✓" || echo "backend→superset ✗"

# 3. Backend → Oracle (via Superset)
#    Pick a database from databases.json that has SELECT grants
curl -sf "http://localhost:8000/api/databases/superset_db_TCOSPRD/test" \
  -X POST -H 'Content-Type: application/json' -d '{}' \
  && echo "backend→oracle ✓" || echo "backend→oracle ✗"

# 4. Frontend served
curl -sf http://localhost/ > /dev/null && echo "frontend ✓" || echo "frontend ✗"

# 5. SPA routing (index.html fallback)
curl -sf http://localhost/dashboards > /dev/null && echo "spa-routing ✓" || echo "spa-routing ✗"

# 6. Mock audit — guard against any dev-only shims slipping into prod
cd /home/recviz/app && bash scripts/mock-audit.sh && echo "mock-audit ✓" || echo "mock-audit ✗"
```

All six should print `✓`. If any print `✗`, check the journalctl logs and the troubleshooting section below.

### 9a. End-to-end UI smoke

1. Open `http://<server-ip>/` in a browser (or `https://recviz.citi.internal/` once TLS lands)
2. You should see the empty Dashboards list (no managed entities yet — that's correct, this is a fresh install)
3. Navigate to **Settings → Data Sources**. The Oracle databases from `databases.json` should show as connected (green dots)
4. Navigate to **Datasets → New Dataset**. Pick a database, write a SELECT query against a real Oracle recon table, save the dataset
5. Navigate to **Charts → New Chart**, pick the dataset you just saved, build a chart, save it
6. Navigate to **KPIs → New KPI**, pick the dataset, configure thresholds, save
7. Navigate to **Dashboards → New Dashboard**, drag the chart and KPI onto the canvas, save
8. View the dashboard. Apply a filter. The values should refresh against real Oracle data.

If all 8 steps work, **the install is good**. The team can start building real dashboards.

---

## 10. Troubleshooting

### Oracle migration fails on `superset db upgrade` or `alembic upgrade head`
- Read the error. Most common: a column type that Postgres tolerated but Oracle doesn't (e.g., text columns >4000 bytes need `CLOB`, not `VARCHAR2`).
- Check the migration file under `backend/app/migrations/versions/` (for RecViz) or `superset/migrations/versions/` inside the venv (for Superset).
- Manually edit the migration to use Oracle-safe types, then retry.

### Backend startup fails with "DatabaseRegistrar synced 0 databases"
- The backend authenticated to Superset OK but `databases.json` is empty or pointing at unreachable Oracle services.
- Check `journalctl -u recviz-backend -n 50` for the underlying Oracle connection error.
- Test the Oracle URI manually with `sqlplus` or `python -c "import oracledb; oracledb.connect(...)"`.

### Backend returns 500 on `/api/data-sources/<id>/query`
- Likely an Oracle-vs-Postgres SQL dialect issue in a dataset's SQL template. Check the SQL in the dataset (Datasets → Edit). Common pitfalls: `LIMIT N` (Postgres) → `FETCH FIRST N ROWS ONLY` (Oracle), `::numeric` cast → `CAST(... AS NUMBER)`.
- The `query_engine._build_date_range_clause` already supports an Oracle dialect branch (lines 92–99 in `backend/app/services/query_engine.py`) — verify it's being hit by checking the resolved dialect for the database that returned the 500.

### Superset cache complaints in logs
- Expected. With `SimpleCache` in single-worker mode, cache works but doesn't persist across restarts. Ignore unless you see actual data correctness issues.

### Frontend shows "API error 502" everywhere
- Backend service is down. `sudo systemctl status recviz-backend`. Restart with `sudo systemctl restart recviz-backend`. Check `journalctl -u recviz-backend -n 100` for the root cause.

### "No dashboards" on a fresh install
- Correct. v1.0 deploys with an empty managed catalog per the user's deployment choice — recon analysts build datasets/charts/KPIs/dashboards from scratch via the UI. There is NO seed script for prod (the dev `scripts/seed-postgres.py` is Postgres-only and inserts synthetic data).

### Updating to v1.1 later
1. `cd /home/recviz/app && git fetch && git checkout v1.1`
2. `cd backend && source venv/bin/activate && pip install -r requirements.txt && python -m alembic -c app/migrations/alembic.ini upgrade head`
3. `cd ../superset && source venv/bin/activate && pip install -r requirements.txt && superset db upgrade`
4. `cd ../frontend && pnpm install --frozen-lockfile && pnpm build`
5. `sudo systemctl restart recviz-superset recviz-backend nginx`
6. Run the smoke test from §9.

---

## 11. Backups

Two things to back up:

1. **The Oracle schema** — your DBA team handles this via Citi's standard Oracle backup (RMAN, etc.). The `RECVIZ_*` tables and Superset metadata tables are all in one schema, so a single schema backup covers everything.
2. **`/home/recviz/.env`** — contains the SECRET_KEY and Oracle/Superset passwords. Back this up out-of-band (vault, password manager). Losing the SECRET_KEY invalidates all Superset session cookies and Flask-AppBuilder permission rows tied to that key — recoverable but disruptive.

The cloned git repo and built `dist/` are reproducible from the v1.0 tag, so they don't need their own backup.

---

## 12. Open items carried into production

These were known and accepted in `10-CLOSEOUT.md`. They're not deploy-blockers but are listed here so the on-prem team knows what's NOT done in v1.0:

- **No authentication.** Anyone with network access to the server can use the app and execute SQL via the explorer. Mitigate via Citi network ACLs until v1.x adds SSO.
- **`/api/sql/execute` accepts arbitrary SQL.** Users with network access can run any SELECT (or worse) the Oracle user has grants for. Audit the Oracle user's grants and consider a read-only role for the dataset path until SQL allowlisting lands.
- **Reports / Export endpoints are stubs** — they return "Coming Soon" empty states. Don't promise PDF/Excel export until the next milestone implements WeasyPrint + openpyxl.
- **SHAR-01 Saved Views deferred** — the UI scaffold exists (`/api/views`) but it's an in-memory store that resets on backend restart. Tell users not to rely on saved views until v1.x.
- **DATA-03 Elasticsearch deferred** — only Oracle and Hive are wired. ES datasets are not creatable.
- **Phase 10 visual issues:** the donut chart `Match Status` and combo chart `Volume & Amount` had column-mapping bugs in the dev seed catalog. These won't manifest in prod because prod has no curated catalog (you build dashboards manually) — but if you mimic the dev catalog as a starting point, watch for those two patterns.

See `.planning/phases/10-comprehensive-testing-with-advanced-seed-data/10-CLOSEOUT.md` and `.planning/codebase/CONCERNS.md` for the full list.

---

**End of deployment runbook.** If you hit anything not covered here, file a note at `docs/DEPLOYMENT-ORACLE.md` against the v1.0 tag and update this doc for the next person.
