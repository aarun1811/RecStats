# RecViz — RHEL + Oracle + No-Sudo Deployment Design

**Date:** 2026-04-09
**Status:** Design approved, awaiting implementation plan
**Audience:** GRU dev team installing RecViz on a shared RHEL server as the `rectify` user
**Supersedes:** nothing — this *complements* `docs/DEPLOYMENT-ORACLE.md` with the adaptations required when sudo, systemd, nginx, and Docker are all unavailable

---

## 1. Why this document exists

The existing runbook at `docs/DEPLOYMENT-ORACLE.md` assumes a production deployment with full administrative control of the server:

- `sudo dnf install python3.12 nginx gcc make git nodejs`
- `sudo useradd recviz`
- `sudo systemctl enable recviz-{superset,backend}.service`
- `/etc/nginx/conf.d/recviz.conf`
- Port 80/443 bound as root

**None of those are available in the target environment for this deployment.** The operator is a non-root user (`rectify`, home at `/opt/rectify`), has no sudo, has no systemd-root, and cannot install system packages. Elevation via `pbrun -u rectify` gets into the service user account but does not grant root.

The runbook's sections covering Oracle wiring (§3), backend install + Alembic (§4), Superset install + metadata (§5), frontend build (§6), smoke tests (§9), troubleshooting (§10), and backups (§11) are all reusable with minor modification. The sections covering prerequisites (§1), systemd units (§7), and nginx (§8) must be replaced entirely.

This document captures those replacements and the user-level architecture they force.

## 2. Locked-in decisions (from brainstorming dialogue)

| # | Decision | Answer |
|---|---|---|
| 1 | Network egress | Internal PyPI mirror works as `rectify` (confirmed). npm mirror exists but will not be used — see decision 3. |
| 2 | Python | System `python3.12` (3.12.8) is installed. No pyenv / conda / modules needed. |
| 3 | Frontend build | Built on the Citi laptop with `pnpm build`, the resulting `dist/` is shipped in a tarball. Node is never installed on the RHEL server. |
| 4 | Oracle instance | 19c Enterprise (19.29.0.0.0), reachable on port **8889** (not 1521) from both the laptop and the RHEL server. Thin-mode `python-oracledb` works from the server without Instant Client. |
| 5 | Schema layout | Single Oracle schema `RECTRACE` co-hosts Superset's ~60 metadata tables AND RecViz's 6 `RECVIZ_*` tables. Collision check against 49 pre-existing tables returned zero matches. |
| 6 | Oracle grants | Operator confirmed `CREATE TABLE / CREATE SEQUENCE / CREATE INDEX / DROP / ALTER` are available via the `CITI_CONNECT` / `CITI_SCHEMA` roles. Tablespace quota on `WIN_ITEM_TABLE` is `-1` (UNLIMITED). |
| 7 | Code transport | `scp` from laptop — git clone is blocked on the server. |
| 8 | Ingress | Direct HTTP from user workstations to `http://<server>:<PORT>/`. No corporate LB, no TLS, no HTTPS redirect. `<PORT>` chosen via `lsof` at install time. |
| 9 | Day-1 data sources | `databases.json` ships with one real recon entry for end-to-end validation; the remaining recon schemas are added post-install. |
| 10 | Process management | `nohup` + pidfiles + three bash scripts. No tmux (not installed), no supervisord, no systemctl. Auto-restart is deliberately deferred. |
| 11 | Authentication | None — accepted gap from v1 closeout. Ingress is gated by the corporate firewall on `<PORT>`. |

## 3. Architectural shape (deviation from the runbook)

```
                        User workstation
                              │
                              │  http://<server>:<PORT>/
                              ▼
    ┌──────────────────────────────────────────────────┐
    │  FastAPI / uvicorn on 0.0.0.0:<PORT>             │   ← ONE public port
    │                                                  │
    │  Routes:                                         │
    │    /health     → backend health endpoint        │
    │    /api/*      → FastAPI route handlers          │──┐
    │    /*          → StaticFiles mount from          │  │
    │                  /opt/rectify/rectrace/recviz/   │  │
    │                  app/frontend/dist/              │  │
    │    404 fallback → index.html (SPA client routes) │  │
    └──────────────────────────────────────────────────┘  │
                                                          │ httpx
                                                          ▼
                     ┌──────────────────────────────────────┐
                     │  Superset / gunicorn                 │
                     │  on 127.0.0.1:8088                   │   ← localhost-only,
                     │  (never exposed to users)            │     invisible to users
                     └──────────────────────────────────────┘
                                         │
                                         │  python-oracledb (thin mode)
                                         ▼
                     ┌──────────────────────────────────────┐
                     │  Oracle 19c @ <host>:8889             │
                     │                                      │
                     │  RECTRACE schema:                    │
                     │    • 6 recviz_* tables (Alembic)     │
                     │    • ~60 Superset metadata tables    │
                     │    • 49 pre-existing tables          │
                     │                                      │
                     │  Other schemas (read-only):          │
                     │    • recon source data (TLM, etc.)   │
                     └──────────────────────────────────────┘
```

**Key deviation from the runbook:** the runbook puts nginx in front, serving `frontend/dist/` as static files and reverse-proxying `/api/` to the backend on 127.0.0.1:8000. We cannot run nginx without sudo. Instead, **FastAPI serves both the static files AND the API from a single public port** via a `StaticFiles` mount plus a 404 fallback that returns `index.html` for client-side routes. One process, one public port, two venvs (backend + Superset). Superset stays bound to `127.0.0.1` and never receives user traffic.

**Trade-offs accepted:**

- FastAPI's `StaticFiles` is slower at serving assets than nginx (no pre-compression, no cache headers beyond ETag). Acceptable at internal LAN traffic volume.
- No TLS. Acceptable because the corporate firewall controls ingress on `<PORT>` and all traffic stays inside Citi's network.
- A backend crash takes the entire app offline (no nginx to show a maintenance page). Acceptable for v1 — monitoring + restart procedures are documented.
- Single worker (`--workers 1` for both uvicorn and gunicorn). This is mandatory, not a trade-off: the backend's `DatabaseRegistrar` cache and Superset's `SimpleCache` are both in-process and would diverge across workers.

## 4. Directory layout

```
/opt/rectify/rectrace/recviz/              # ~rectify/rectrace/recviz
│
├── app/                                   # REPLACEABLE CODE (scp target per release)
│   ├── backend/
│   │   ├── app/                           # FastAPI source
│   │   ├── venv/                          # backend Python venv (created on-server)
│   │   └── requirements.txt               # patched to include oracledb
│   ├── frontend/
│   │   └── dist/                          # pre-built SPA (from laptop)
│   ├── superset/
│   │   ├── venv/                          # separate Superset venv (created on-server)
│   │   └── superset_config_prod.py        # Oracle metadata, SimpleCache, no Celery
│   └── scripts/
│       ├── start-all.sh
│       ├── stop-all.sh
│       ├── status.sh
│       └── rotate-logs.sh
│
├── .env                                   # SECRETS (chmod 600, survives releases)
├── databases.json                         # recon source registry (survives releases)
├── logs/                                  # LOG FILES (survives releases)
│   ├── backend.log
│   ├── backend.err
│   ├── superset.log
│   ├── superset-access.log
│   ├── superset-error.log
│   └── superset-bootstrap.log             # created once in Phase 6
└── run/                                   # PID FILES (survives releases)
    ├── backend.pid
    └── superset.pid
```

**Why this layout:** releases replace `app/` wholesale via `scp` + untar; `.env`, `databases.json`, `logs/`, and `run/` are outside `app/` and survive releases untouched. The three bash scripts hard-code `/opt/rectify/rectrace/recviz/` as their root so they can be invoked from any working directory.

**Deliberate departure from the runbook:** the runbook's `databases.json` lives at `backend/app/config/databases.json` — inside the code directory, overwritten on every release. We promote it to `/opt/rectify/rectrace/recviz/databases.json` (sibling of `app/`) and set `DATABASES_CONFIG_PATH=/opt/rectify/rectrace/recviz/databases.json` in `.env`. The `DATABASES_CONFIG_PATH` setting in `backend/app/config.py:13` was built for exactly this use case.

## 5. Code changes required

All four changes are applied to a deploy branch on the laptop, committed, and included in the shipped tarball. None of them break the existing Postgres-based local dev setup.

### 5.1 JSONB → JSON in Alembic migrations (#1)

**File(s):** `backend/app/migrations/versions/001_initial_schema.py` and any of 002/003/004 with the same pattern.

**Current (Postgres-specific):**
```python
from sqlalchemy.dialects.postgresql import JSONB
# ...
sa.Column("config", JSONB, nullable=False),
```

**After:**
```python
import sqlalchemy as sa
# ...
sa.Column("config", sa.JSON(), nullable=False),
```

**Why it works on both Postgres and Oracle:**
- On Postgres, `sa.JSON()` renders as `JSON` (not `JSONB`). We lose some JSONB-specific indexing features we do not use.
- On Oracle 19c, `sa.JSON()` renders as `CLOB` with an implicit `IS JSON` check constraint. JSON path queries still work via `JSON_VALUE`, `JSON_QUERY`, etc.

**Blast radius:** Alembic-only. Runtime code does not care because the ORM serializes/deserializes JSON transparently.

### 5.2 Async → sync SQLAlchemy engine (#2)

**File:** `backend/app/db/engine.py` — and every call site that uses `async_session_factory`.

**Why:** `create_async_engine` with `oracle+oracledb://` is not supported in SQLAlchemy 2.0.49. The async oracledb dialect is newer and not part of this pin. Options were (a) upgrade SQLAlchemy, (b) use an experimental async dialect string, (c) convert the backend's DB access to sync. Option (c) is the safest — it preserves the pinned dependency versions and works on both Postgres and Oracle.

**Change shape:**
```python
# before
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
engine = create_async_engine(settings.recviz_db_url, pool_size=10, max_overflow=5)
async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# after
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
engine = create_engine(settings.recviz_db_url, pool_size=10, max_overflow=5)
session_factory = sessionmaker(engine, class_=Session, expire_on_commit=False)
```

All call sites that did `async with async_session_factory() as session:` become `with session_factory() as session:`. The enclosing route handlers stay `async def` — they simply call sync DB methods, which blocks one uvicorn worker during the call. At expected traffic (tens of concurrent users, sub-second queries) this is invisible.

**Local-dev impact (IMPORTANT):** the existing dev `.env` uses `RECVIZ_DB_URL=postgresql+asyncpg://...` (asyncpg is async-only). With `create_engine` (sync), asyncpg fails at connect time. Dev team members must update their local `.env` to use `postgresql://` (which defaults to psycopg2) or explicitly `postgresql+psycopg2://`. The default in `backend/app/config.py:12` should also be updated in the same patch so new dev installs get the working URL out of the box. `psycopg2-binary` is already in `requirements.txt`, so no new dependency is needed for Postgres.

**Blast radius:** `backend/app/db/engine.py` itself, `backend/app/config.py` (change default URL scheme), and every file that imports `async_session_factory`. Exact count and locations determined during implementation patch writing; estimated at <10 files, <50 lines of change total.

### 5.3 StaticFiles mount + SPA 404 fallback (#3)

**File:** `backend/app/main.py`

**Change shape:**
```python
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.requests import Request

# after all API routers are registered:
FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="spa")

    @app.exception_handler(404)
    async def spa_fallback(request: Request, exc):
        # API 404s stay as 404s; UI 404s return index.html so TanStack Router handles them
        if request.url.path.startswith("/api/"):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        return FileResponse(FRONTEND_DIST / "index.html")
```

**Why the `if FRONTEND_DIST.exists()` guard:** on a laptop dev setup, `frontend/dist/` doesn't exist because the frontend runs via `pnpm dev` on 5173. The guard makes the mount a no-op in dev. On the server, `dist/` is shipped in the tarball so the mount becomes active.

**Blast radius:** `main.py` only. No impact on dev.

### 5.4 oracledb in requirements.txt (#4)

**File:** `backend/requirements.txt`

Add: `oracledb==2.5.1`

Optional cleanup: remove `psycopg2-binary==2.9.11` and `asyncpg==0.31.0` since they're now unused on the prod path. Keep them if you want the same pinned file to install on a dev Postgres box — they'll just sit idle on Oracle.

## 6. Install flow — 11 phases

### Phase 1 — Pre-flight checklist (5 min)

- [ ] Oracle details: `<host>`, `8889`, `<service_name>`, `RECTRACE`, `<password>`
- [ ] At least one recon source with credentials for the day-1 test
- [ ] `lsof`-chosen port that is free AND reachable from user subnets through the corporate firewall
- [ ] Citi laptop with Node 22 + pnpm 9 installed
- [ ] `scp` + `pbrun -u rectify` access to the RHEL server
- [ ] ~90 minutes of uninterrupted time for first install

### Phase 2 — Laptop-side prep (20 min)

1. `git clone` RecViz into a clean build workspace on the laptop.
2. `git checkout -b deploy/oracle-rhel-<yyyymmdd>`.
3. Apply the four code changes from §5 (shipped as a patch file in the implementation plan).
4. `cd backend && python3.12 -m venv venv && source venv/bin/activate && pip install -r requirements.txt && pytest tests/` — the 27 existing tests (10+3+8+6) must still pass against the Postgres dev database.
5. `cd frontend && echo 'VITE_API_BASE_URL=' > .env.production && pnpm install --frozen-lockfile && pnpm build`. The empty `VITE_API_BASE_URL` causes the SPA to issue API calls to its own origin, which the backend handles because it serves both `/` and `/api/*`.
6. `tar --exclude='backend/venv' --exclude='backend/__pycache__' --exclude='frontend/node_modules' --exclude='.git' -czf ~/recviz-deploy-<yyyymmdd-hhmm>.tar.gz backend frontend/dist superset` — expected tarball size 20–50 MB.

### Phase 3 — scp + untar (3 min)

```bash
# laptop
scp ~/recviz-deploy-*.tar.gz rectify@<server>:/tmp/

# server (as rectify)
mkdir -p /opt/rectify/rectrace/recviz/{app,logs,run}
cd /opt/rectify/rectrace/recviz/app
tar xzf /tmp/recviz-deploy-*.tar.gz
```

### Phase 4 — Server-side secrets + databases.json (10 min)

Create `/opt/rectify/rectrace/recviz/.env` with Oracle credentials, Superset URL (`http://127.0.0.1:8088`), `DATABASES_CONFIG_PATH` pointing at the new location, `REDIS_URL` as a dummy (unused in prod but required by the Settings class), `RECVIZ_PUBLIC_PORT`, and a placeholder `SECRET_KEY` (filled in Phase 6).

Create `/opt/rectify/rectrace/recviz/databases.json` with one day-1 recon source. The sqlalchemy_uri format MUST be `oracle://` (no driver suffix) — see gotcha §11e.7 for why.

`chmod 600` on `.env`.

### Phase 5 — Backend venv + RecViz Alembic migrations (10 min)

1. `python3.12 -m venv venv` in `app/backend/`.
2. `pip install -r requirements.txt` (now includes `oracledb==2.5.1`).
3. `set -a && source /opt/rectify/rectrace/recviz/.env && set +a`.
4. `python -m alembic -c app/migrations/alembic.ini upgrade head`.
5. Verify the 6 `RECVIZ_*` tables exist via a Python oracledb one-liner (sqlplus not available on the server).

### Phase 6 — Superset venv + bootstrap (20 min) — THE RISKIEST PHASE

1. Separate `python3.12 -m venv venv` in `app/superset/`.
2. `pip install apache-superset==6.0.0 oracledb==2.5.1 gunicorn==22.0.0`.
3. Generate `SECRET_KEY` once: `python3.12 -c 'import secrets; print(secrets.token_hex(32))'` and append to `.env`.
4. Export `SUPERSET_CONFIG_PATH=/opt/rectify/rectrace/recviz/app/superset/superset_config_prod.py`.
5. `superset db upgrade` — ~100 Alembic migrations run against Oracle 19c. Expected duration 2–5 minutes. **Capture output to `logs/superset-bootstrap.log`** so that if anything fails, the error is recoverable.
6. `superset fab create-admin --username admin ...` with a strong password.
7. `superset init` — seeds default roles and permissions.
8. Manually edit `.env` to set `SUPERSET_PASSWORD=<the-admin-password>`.

After Phase 6, `RECTRACE` holds ~70 tables (6 RecViz + ~60 Superset + 49 pre-existing), but NO services are running yet.

### Phase 7 — Port allocation + lifecycle scripts (15 min)

1. `lsof -i -P -n | awk '/LISTEN/ {print $9}' | sort -u` — pick a free high port.
2. `lsof -iTCP:$PORT -sTCP:LISTEN` — confirm nothing's on it.
3. Confirm the port is reachable from user subnets through the corporate firewall (firewall ticket if not).
4. `echo "RECVIZ_PUBLIC_PORT=$PORT" >> /opt/rectify/rectrace/recviz/.env`.
5. Write `start-all.sh`, `stop-all.sh`, `status.sh`, `rotate-logs.sh` into `app/scripts/`. Exact contents in §7.

### Phase 8 — First real start (10 min)

`bash start-all.sh`. Expected output: two "healthy" lines, summary with URLs. `status.sh` should show both services running. Tail both logs for 30 seconds to spot any async errors.

### Phase 9 — Smoke test from a real browser (5 min)

From a Citi user workstation (not the server), open `http://<server>:<PORT>/` and validate:

1. Page loads, sidebar + header visible, empty dashboard list.
2. Settings → Data Sources → day-1 recon DB shows green (connected).
3. Theme toggle works in both directions.
4. DevTools Network tab: no 4xx / 5xx on page load.

If any of those fail, consult §11d troubleshooting matrix.

### Phase 10 — First real Oracle data in the UI (15–30 min)

Build one dataset + one chart + one dashboard through the UI, using your real recon data. Exact click-path in runbook §9a. When the dashboard renders real Oracle data, the install is done — hand it to the business users.

### Phase 11 — Day-2 operational runbook

Covered in detail in §7 (lifecycle scripts) and §8 (operational procedures) below. The headline is: restart via `stop-all && start-all`, logs under `logs/`, releases via stop-swap-restart, backup `.env` and the Oracle schema.

## 7. Lifecycle scripts (sketch, not final)

### `start-all.sh`

- Source `.env`, export `SUPERSET_CONFIG_PATH`
- Idempotent: skip a service if its pidfile is alive
- Start Superset: `nohup gunicorn --bind 127.0.0.1:8088 --workers 1 --timeout 120 ... &`, PID to file
- Poll `http://127.0.0.1:8088/health` up to 90 seconds (first-start cold bootstrap)
- Start backend: `nohup uvicorn app.main:app --host 0.0.0.0 --port $RECVIZ_PUBLIC_PORT --workers 1 ... &`, PID to file
- Poll `http://127.0.0.1:$PORT/health` up to 30 seconds
- Print both URLs

### `stop-all.sh`

- Read pidfiles (backend first, Superset second — reverse start order)
- SIGTERM, wait up to 10 seconds, SIGKILL if still alive
- Remove pidfiles (stale or not)

### `status.sh`

- For each service: pidfile exists? process alive? health curl?
- Three-line summary

### `rotate-logs.sh`

- For each log file >10 MB: `mv` to timestamped suffix, truncate in place (preserves nohup file descriptor)
- `gzip` anything older than 1 day
- Delete `.gz` anything older than 30 days
- Scheduled via `crontab -e` as `0 2 * * * /opt/rectify/rectrace/recviz/app/scripts/rotate-logs.sh`

### Optional: `@reboot` crontab entry

```
@reboot /opt/rectify/rectrace/recviz/app/scripts/start-all.sh > /opt/rectify/rectrace/recviz/logs/reboot.log 2>&1
```

Adds auto-start on server reboot. Recommended after the first successful install.

## 8. Day-2 operations

### Routine

- **Status:** `bash app/scripts/status.sh`
- **Live logs:** `tail -F logs/backend.log logs/superset-error.log`
- **Full restart:** `bash app/scripts/stop-all.sh && bash app/scripts/start-all.sh`
- **Backend-only restart:** `kill $(cat run/backend.pid) && bash app/scripts/start-all.sh` (the script is idempotent and skips Superset)

### Releasing a new version

1. Laptop: `git checkout <new-tag>`, re-apply Oracle patches if needed, `pnpm install && pnpm build`, re-bundle tarball.
2. `scp` new tarball to `/tmp/` on the server.
3. Server: `bash app/scripts/stop-all.sh`.
4. `mv app app.old.<timestamp>` (rollback archive; keep the last 2).
5. `mkdir app && cd app && tar xzf /tmp/recviz-deploy-<new>.tar.gz`.
6. Re-create venvs IF `requirements.txt` changed. (If unchanged, `mv app.old.<timestamp>/backend/venv app/backend/venv` and `mv app.old.<timestamp>/superset/venv app/superset/venv` skips reinstall entirely.)
7. Run any new RecViz Alembic migrations: `source venv/bin/activate && python -m alembic -c app/migrations/alembic.ini upgrade head`.
8. `bash app/scripts/start-all.sh`.
9. Smoke test per §Phase 9.

**Rollback** (if step 8 or 9 fails): `bash app/scripts/stop-all.sh && rm -rf app && mv app.old.<timestamp> app && bash app/scripts/start-all.sh`.

### Backups

| What | How | When |
|---|---|---|
| Oracle RECTRACE schema | DBA team via RMAN | DBA's nightly cadence |
| `/opt/rectify/rectrace/recviz/.env` | Personal password vault or offline copy | After first install, after any credential change |
| Last 2 deployment tarballs | On the server or laptop | After each deploy |

Everything else (code, venvs, `dist/`, logs) is reproducible or ephemeral.

## 9. Troubleshooting matrix

| Symptom | First check | Usual cause |
|---|---|---|
| `start-all.sh` fails at "Superset failed to come up" | `tail -200 logs/superset.log` | Oracle creds, SECRET_KEY missing, config syntax |
| `start-all.sh` fails at "Backend failed to come up" | `tail -200 logs/backend.err` | Wrong `SUPERSET_PASSWORD` in `.env`, Oracle unreachable |
| Browser shows blank page | `curl -sI http://server:$PORT/` | StaticFiles mount path wrong, or `dist/` missing |
| Browser shows 404 on `/dashboards` | SPA 404 fallback handler not applied | Re-check main.py patch |
| Data source shows red dot in UI | `curl /api/databases/<id>/test` | `databases.json` not loaded, or Oracle creds wrong |
| Dataset query returns Oracle error | `tail logs/backend.log` for the actual SQL sent | Oracle dialect quirk — `LIMIT` → `FETCH FIRST`, cast syntax, reserved words |
| Chart renders empty | DevTools → `POST /api/data-sources/<id>/query` response | Query returned empty OR chart axis mapping mismatch |
| Server reboot → app gone | Expected with nohup | Add optional `@reboot` crontab entry |
| Disk filling up | `du -sh logs/` | `rotate-logs.sh` cron not running |
| `DPY-6001: cannot connect to database` | Oracle URI in `.env`, port 8889, network reachability | Usually TNS alias typo or firewall change |

## 10. Gotchas — deployment-specific

1. **JSONB is banned.** Any new Alembic migration importing `sqlalchemy.dialects.postgresql.JSONB` breaks Oracle prod. Pre-release check: `grep -r JSONB backend/app/migrations/` should return nothing.
2. **Sync DB engine only.** New code using `async with session.begin()` or `await session.execute()` will not work on prod. Pattern is sync DB calls inside async route handlers.
3. **The `cx_Oracle` shim in `superset_config_prod.py`** (`oracledb.version = "8.3.0"; sys.modules["cx_Oracle"] = oracledb`) MUST NOT be removed. Without it, Superset's SQLAlchemy 1.4 crashes trying to import the real `cx_Oracle`.
4. **RECTRACE is co-tenant.** Superset metadata + RecViz `recviz_*` tables share one schema. Never `DROP USER RECTRACE CASCADE` — you'd lose everything. "Nuclear reset" only drops the specific Superset/RecViz table names, not the schema.
5. **`SECRET_KEY` is irreplaceable.** It encrypts DB passwords stored in Superset's `dbs` table. Losing it means re-entering every recon DB credential via the UI. Back up `.env` out-of-band.
6. **SimpleCache is in-process.** Restart clears the query cache. First page load after restart is slow; that's the cost of not running Redis.
7. **`databases.json` uses `oracle://`, `.env` uses `oracle+oracledb://`.** Different URI forms because Superset is on SQLAlchemy 1.4 (needs `oracle://` → `cx_Oracle` shim) and the backend is on SQLAlchemy 2.x (uses `oracle+oracledb://` directly). Do not mix them up.
8. **In-memory state resets on backend restart** — query history, saved views, mock database store. Users should not rely on these features in v1.
9. **No authentication.** Anyone with network access to `<PORT>` can use RecViz and execute arbitrary SELECT queries via the Explorer. Mitigation is the corporate firewall. Document this with InfoSec as an accepted v1 gap.

## 11. Open items deliberately deferred

- Auto-restart on crash (would require supervisord or systemctl --user with linger)
- Auto-start on server reboot (optional `@reboot` crontab, one-line add)
- TLS / HTTPS (would require either a user-mode reverse proxy or terminating TLS at a corporate LB)
- Authentication / SSO (v1 closeout item)
- Redis-backed query cache (would require running a user-mode Redis, not worth it for v1 traffic)
- Celery-backed async SQL Lab (requires Redis + a worker process)
- Export endpoints (PDF/Excel) — already stubbed in v1, not deployment-specific

## 12. References

- `docs/DEPLOYMENT-ORACLE.md` — the general Oracle production runbook this document adapts
- `docs/DEPLOYMENT.md` — generic deployment overview
- `docs/CONFIGURATION.md` — environment variables and config files
- `docs/CODEBASE_GUIDE.md` — code-level reference for debugging
- `backend/app/config.py` — Pydantic Settings class defining all env vars
- `backend/app/migrations/versions/` — Alembic migrations requiring the JSONB→JSON patch
- `backend/app/main.py` — target of the StaticFiles mount patch
- `backend/app/db/engine.py` — target of the async→sync engine patch
- Memory: `project_superset_alembic.md`, `project_local_dev_setup.md`, `project_dashboard_config_conventions.md`, `project_api_client_gotchas.md`

---

**End of design document.** Implementation plan to follow via the `writing-plans` skill once this design is reviewed and approved.
