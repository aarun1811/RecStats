# RecViz (RecStats) — Citi VM Deployment Guide

End-to-end steps to clone, configure, build, and run **RecViz** on a Citi Linux VM. The frontend bundle lives inside the FastAPI app; you deploy ONE service.

> **Sibling app**: RecViz dashboards are EMBEDDED inside the rectrace app's TLM-stats / QuickRec modals via iframes. You typically deploy RecViz first (rectrace's React app needs the RecViz origin to build embed URLs). See `autosys-job-explorer/DEPLOY.md` in the sibling repo.

---

## 1. Prerequisites on the Citi VM

| Item | Version | Why |
|---|---|---|
| Python | 3.11+ | RecViz backend |
| Node.js | 20+ | Build the React frontend |
| pnpm | 9+ | Frontend package manager (`npm i -g pnpm@9`) |
| Oracle Instant Client (thick mode) | 21+ | RecViz uses `python-oracledb` in thick mode |
| Oracle wallet directory | n/a | TLS connection to Citi Oracle |
| Citi CA truststore | n/a | For HTTPS Oracle connections |
| Citi password-fetch script | n/a | Sources env vars from your secrets vault |

Recommend a service user (e.g. `recviz`) with home directory `/opt/recviz`. All paths below assume this.

### Oracle Instant Client setup

Download Citi-approved Instant Client (Basic + SDK) and extract to `/opt/oracle/instantclient`. Then ensure:

```bash
export LD_LIBRARY_PATH=/opt/oracle/instantclient:$LD_LIBRARY_PATH
```

(systemd unit in step 8 sets this for the service.)

---

## 2. Clone + checkout

```bash
# As the recviz service user
cd /opt/recviz
git clone git@github.com:aarun1811/RecStats.git recviz
cd recviz
git checkout main
```

To update later: `git pull origin main` from `/opt/recviz/recviz`.

---

## 3. One-time config — `recviz-prod.env`

RecViz reads its configuration from a `.env`-style file at a path supplied via the `RECVIZ_CONFIG_PATH` env var at startup. Create the file outside the repo so updates don't conflict with `git pull`.

### 3.1 Create `/opt/recviz/config/recviz-prod.env`

```bash
mkdir -p /opt/recviz/config
chmod 700 /opt/recviz/config
```

Then create `/opt/recviz/config/recviz-prod.env` with this shape:

```env
# Oracle (RecViz catalog DB — holds recviz_connections, recviz_datasets, recviz_kpis, recviz_dashboards)
RECVIZ_DB_URL=oracle+oracledb://recviz:${RECVIZ_DB_PASSWORD}@<oracle_host>:1521/?service_name=<prod_service_name>
# RECVIZ_DB_PASSWORD is sourced from the Citi password-fetch script below — NOT in this file
RECVIZ_DB_SCHEMA=RECVIZ

# Oracle Instant Client + Wallet (Citi-managed)
ORACLE_CLIENT_LIB_DIR=/opt/oracle/instantclient
TNS_ADMIN=/opt/recviz/oracle-wallet

# CORS — the rectrace prod portal origin (only rectrace's React app should be able to call RecViz APIs cross-origin)
RECVIZ_CORS_ALLOWED_ORIGINS=https://portal.citi.intra,https://rectrace.citi.intra

# Frame-ancestors — for iframe embed from the rectrace React app
# This drives X-Frame-Options / Content-Security-Policy frame-ancestors
RECVIZ_EMBED_FRAME_ANCESTORS=https://portal.citi.intra https://rectrace.citi.intra

# Connection-password encryption key (encrypts the passwords stored in recviz_connections.encrypted_password)
# Must be a 32-byte base64-encoded value. Generate once with: python -c "import os, base64; print(base64.urlsafe_b64encode(os.urandom(32)).decode())"
RECVIZ_ENCRYPTION_KEY=<32-byte base64; set via Citi password-fetch script>

# Server
RECVIZ_HOST=0.0.0.0
RECVIZ_PORT=8000
```

`chmod 600 /opt/recviz/config/recviz-prod.env` so only the service user can read it.

### 3.2 Duplicate for UAT

Create `/opt/recviz/config/recviz-uat.env` with the same shape but UAT-specific Oracle host / CORS origins / encryption key.

### 3.3 If the existing backend doesn't yet support `RECVIZ_CONFIG_PATH`

Verify by inspecting `backend/app/config.py` (the Pydantic Settings module). If the current code only reads from `.env` in CWD, extend it:

```python
# backend/app/config.py — add config_file_path support
import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=os.environ.get("RECVIZ_CONFIG_PATH", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )
    # ... existing fields ...
```

This change is small but currently NOT on `main` — apply it as part of your first deploy commit on a separate branch (e.g. `deploy/config-path-support`) and merge before deploying.

---

## 4. Oracle wallet

Copy the Citi prod Oracle wallet (cwallet.sso, ewallet.p12, tnsnames.ora, sqlnet.ora) into:

```
/opt/recviz/oracle-wallet/
```

The `TNS_ADMIN` env var in `recviz-prod.env` points at this directory; oracledb (thick mode) reads the wallet from there at connection time.

---

## 5. Citi password-fetch script wrapper

Wrap Citi's secret-retrieval script so systemd can `source` it before launching uvicorn. Create `/opt/recviz/config/recviz-env.sh`:

```bash
#!/bin/bash
# Sources Citi's password-fetch + sets RecViz secrets.
# Called by systemd as ExecStartPre.

# Adjust the path to whatever Citi's actual script is
source /opt/citi/cyberark/fetch-secret.sh recviz-prod

# fetch-secret.sh should have set:
#   RECVIZ_DB_PASSWORD          — for the catalog DB
#   RECVIZ_ENCRYPTION_KEY       — for at-rest password encryption
#   CONN_TCOSPRD_PASSWORD       — used at seed time if you re-seed
#   CONN_RECONMGMT_PASSWORD     — same
#   CONN_RECPORTAL_PASSWORD     — same
#
# If your secrets store uses different var names, re-export them here:
# export RECVIZ_DB_PASSWORD="$ORACLE_PROD_RECVIZ_PWD"

# Append to the env file so systemd's EnvironmentFile picks them up
{
    echo "RECVIZ_DB_PASSWORD=$RECVIZ_DB_PASSWORD"
    echo "RECVIZ_ENCRYPTION_KEY=$RECVIZ_ENCRYPTION_KEY"
} > /opt/recviz/config/recviz-secrets.env

chmod 600 /opt/recviz/config/recviz-secrets.env
```

`chmod 700 /opt/recviz/config/recviz-env.sh`.

---

## 6. Build

From `/opt/recviz/recviz`:

```bash
# 6.1 Build the React frontend
cd frontend
pnpm install --frozen-lockfile
pnpm build
# Output: frontend/dist/ — FastAPI's static mount picks this up automatically

# 6.2 Backend: create venv and install deps
cd ../backend
python -m venv venv
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt
```

If your Citi VM is air-gapped from PyPI, use Citi's internal Artifactory mirror:
```bash
./venv/bin/pip install --index-url https://artifactory.citi.intra/pypi/simple -r requirements.txt
```

---

## 7. Seed the catalog DB (first deploy only)

RecViz stores its dashboard / dataset / KPI catalog in Oracle tables. On a fresh DB, run the seed once:

```bash
# Source secrets so the seed can talk to Oracle
source /opt/recviz/config/recviz-env.sh
cat /opt/recviz/config/recviz-secrets.env >> /opt/recviz/config/recviz-prod.env

# Run Alembic migrations to create the schema
cd /opt/recviz/recviz/backend
set -a; source /opt/recviz/config/recviz-prod.env; set +a
./venv/bin/alembic upgrade head

# Run the seed (creates connections, datasets, KPIs, dashboards)
PYTHONPATH=. ./venv/bin/python ../scripts/seed-oracle.py
```

Expected output tail:
```
recviz_connections: <N> rows
recviz_datasets: 28 rows
recviz_charts: 45 rows
recviz_kpis: 30 rows
recviz_dashboards: 12 rows
```

> **Connection passwords**: the seed encrypts and writes passwords for `conn-tcosprd`, `conn-reconmgmt`, `conn-recportal` into `recviz_connections.encrypted_password`. The plaintext for these comes from the env vars (`CONN_TCOSPRD_PASSWORD` etc.) set by the password-fetch wrapper. If those env vars aren't set, the seed uses dev defaults — **NOT safe for production**. Verify they're set before seeding.

---

## 8. Run

### Manual (smoke-test)

```bash
source /opt/recviz/config/recviz-env.sh

cd /opt/recviz/recviz/backend
RECVIZ_CONFIG_PATH=/opt/recviz/config/recviz-prod.env \
  ORACLE_CLIENT_LIB_DIR=/opt/oracle/instantclient \
  ./venv/bin/uvicorn app.main:app --port 8000 --host 0.0.0.0
```

The app listens on `http://localhost:8000`.

### systemd

Create `/etc/systemd/system/recviz.service`:

```ini
[Unit]
Description=RecViz FastAPI service
After=network.target

[Service]
Type=simple
User=recviz
Group=recviz
WorkingDirectory=/opt/recviz/recviz/backend
Environment=RECVIZ_CONFIG_PATH=/opt/recviz/config/recviz-prod.env
Environment=ORACLE_CLIENT_LIB_DIR=/opt/oracle/instantclient
Environment=LD_LIBRARY_PATH=/opt/oracle/instantclient
EnvironmentFile=-/opt/recviz/config/recviz-prod.env
EnvironmentFile=-/opt/recviz/config/recviz-secrets.env
ExecStartPre=/bin/bash /opt/recviz/config/recviz-env.sh
ExecStart=/opt/recviz/recviz/backend/venv/bin/uvicorn app.main:app --port 8000 --host 0.0.0.0
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable recviz
sudo systemctl start recviz
sudo systemctl status recviz
```

---

## 9. Verify

```bash
# Health
curl http://localhost:8000/health
# → {"status":"healthy","driver":"python-oracledb","mode":"thick"}

# Dashboards list (proves catalog DB reachable + seed ran)
curl http://localhost:8000/api/dashboards/managed/ | python -m json.tool | head -20
# → array of 12 dashboards

# TLM dashboard config (proves the Plan 4 dashboard is present)
curl http://localhost:8000/api/dashboards/managed/dash-tlm-stats | python -m json.tool | head -30

# Embed page (in browser)
# Open: http://<vm-host>:8000/embed/dashboards/dash-tlm-stats?filter.tlm_instance=<one>&filter.lock=tlm_instance&theme=light
```

Expected:
- `/health` → `{"status":"healthy",...}`
- The embed page renders the dashboard layout (filters → KPIs → donut → grids)

---

## 10. Re-deploy (when you push new commits)

```bash
cd /opt/recviz/recviz
git pull origin main

# Frontend
cd frontend && pnpm install --frozen-lockfile && pnpm build

# Backend deps (if requirements.txt changed)
cd ../backend && ./venv/bin/pip install -r requirements.txt

# Re-run Alembic if there are new migrations
set -a; source /opt/recviz/config/recviz-prod.env; set +a
./venv/bin/alembic upgrade head

# Re-seed if dataset/KPI/dashboard config changed (idempotent — wipes managed tables first)
PYTHONPATH=. ./venv/bin/python ../scripts/seed-oracle.py

sudo systemctl restart recviz
```

Or wrap as `/opt/recviz/deploy.sh` and `sudo` it.

---

## 11. Logs

```bash
sudo journalctl -u recviz -f                  # tail live
sudo journalctl -u recviz --since "1 hour ago"
```

By default uvicorn logs request access + app logs to stdout, which systemd captures into the journal. If you need Splunk integration, configure `logging.config.dictConfig` in `backend/app/main.py` to add a Splunk HEC handler.

---

## 12. Common issues

| Symptom | Cause | Fix |
|---|---|---|
| `cx_Oracle.DatabaseError: DPI-1047: Cannot locate ...libclntsh.so` | Oracle Instant Client not on `LD_LIBRARY_PATH` | Set `ORACLE_CLIENT_LIB_DIR` + `LD_LIBRARY_PATH` in the systemd unit |
| `ORA-01017: invalid username/password` | `RECVIZ_DB_PASSWORD` env var not set OR wrong | Verify Citi password-fetch script populated it; check by `sudo systemctl show -p Environment recviz` |
| Embed iframe shows "Refused to display in a frame because of X-Frame-Options" | `RECVIZ_EMBED_FRAME_ANCESTORS` doesn't include the calling rectrace origin | Add the rectrace prod origin (space-separated for multiple) to the env file and restart |
| Cross-origin fetch from rectrace gets CORS error | `RECVIZ_CORS_ALLOWED_ORIGINS` doesn't include the rectrace origin | Add it (comma-separated) to the env file and restart |
| Dashboard renders but KPIs all show `0` | Filter values not matching seeded data | Verify dataset SQL filters are reachable from the connection; curl a dataset query directly to see actual rows |
| `400 Bad Request: requires filter 'tlm_instance' for dynamic DB routing` | A dynamic-routed dataset fetched without the routing filter | Locked filters in the dashboard config should auto-provide the filter; check that `tlm_instance` is in the URL when the dashboard is opened from rectrace |

---

## Appendix: env vars cheat sheet

These are the env vars `/opt/recviz/config/recviz-prod.env` (plus the secrets file from the Citi password-fetch script) defines.

| Var | Example | Set by |
|---|---|---|
| `RECVIZ_DB_URL` | `oracle+oracledb://recviz:${RECVIZ_DB_PASSWORD}@<host>:1521/?service_name=<svc>` | `recviz-prod.env` |
| `RECVIZ_DB_PASSWORD` | (secret) | Citi password-fetch script |
| `RECVIZ_DB_SCHEMA` | `RECVIZ` | `recviz-prod.env` |
| `ORACLE_CLIENT_LIB_DIR` | `/opt/oracle/instantclient` | `recviz-prod.env` |
| `TNS_ADMIN` | `/opt/recviz/oracle-wallet` | `recviz-prod.env` |
| `RECVIZ_CORS_ALLOWED_ORIGINS` | `https://portal.citi.intra` | `recviz-prod.env` |
| `RECVIZ_EMBED_FRAME_ANCESTORS` | `https://portal.citi.intra` | `recviz-prod.env` |
| `RECVIZ_ENCRYPTION_KEY` | (32-byte base64 secret) | Citi password-fetch script |
| `RECVIZ_HOST` | `0.0.0.0` | `recviz-prod.env` |
| `RECVIZ_PORT` | `8000` | `recviz-prod.env` |
| `RECVIZ_CONFIG_PATH` | `/opt/recviz/config/recviz-prod.env` | systemd unit |

---

For the rectrace side that EMBEDS these dashboards, see **`autosys-job-explorer/DEPLOY.md`** in the sibling repo.
