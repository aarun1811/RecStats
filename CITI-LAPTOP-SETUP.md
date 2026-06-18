# RecViz on a Citi laptop — first-run setup

This is the minimal path to get RecViz (FastAPI backend + Vite frontend) running on a Citi Windows laptop pointed at the real Citi Oracle. Companion to `autosys-job-explorer/CITI-LAPTOP-SETUP.md` — bring rectrace up first if you haven't already.

**Prereqs on the laptop**
- Python 3.11+
- Node 20+ (npm ships with Node — no separate package-manager install needed)
- Oracle Instant Client 21+ (Basic + SDK), Windows x64 build, installed somewhere like `C:\oracle\instantclient_21_x`
- Git Bash (for running shell scripts; PowerShell works for npm/python alone)
- Network access to Citi Oracle host:port

## 1. Clone the repo

Clone from your Citi-internal git host into your workspace, e.g. `C:\Users\<you>\Workspace\RecViz`.

## 2. Configure `backend/.env`

Copy the Citi template:

```bash
cp backend/.env.citi.example backend/.env
```

Open `backend/.env` and replace every `<CITI_*>` placeholder:

| Key | What goes here |
|---|---|
| `RECVIZ_DB_URL` | `oracle+oracledb://<user>:<password>@<host>:<port>/?service_name=<service>` — your Citi RECVIZ DB credentials |
| `RECVIZ_DB_SCHEMA` | Citi RecViz schema owner (often `RECVIZ`) |
| `ORACLE_CLIENT_LIB_DIR` | Path to the Instant Client lib directory (e.g. `C:/oracle/instantclient_21_13`) |
| `RECVIZ_ENCRYPTION_KEY` | Generate ONCE locally with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` and paste the output |

`RECVIZ_CORS_ALLOWED_ORIGINS` + `RECVIZ_EMBED_FRAME_ANCESTORS` + `VITE_API_BASE_URL` already have correct defaults for the laptop case (rectrace on `localhost:5173`, RecViz on `localhost:8000`). Leave them alone unless you change ports.

**Security**: `backend/.env` is gitignored. The `.env.citi.example` template is committed; the filled `.env` is not. If you accidentally commit a filled `.env`, rotate the DB credentials before pushing.

## 3. Install Python deps

```bash
cd backend
python -m venv venv
# Activate venv (Git Bash):
source venv/Scripts/activate
# OR (PowerShell):  .\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## 4. Run backend

```bash
# In backend/ with venv activated:
set -a && . .env && set +a
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

On PowerShell the env-load is different — easier to use Git Bash for this command. Watch for `Uvicorn running on http://0.0.0.0:8000`.

**Smoke check** (new terminal):
```bash
curl -s http://localhost:8000/health
# expected: {"status":"healthy",...}

curl -s http://localhost:8000/api/data-sources | head -c 200
# expected: JSON array of data sources (may be empty until you configure them)
```

If health is 500 / connection refused on the Oracle side, the `RECVIZ_DB_URL` or `ORACLE_CLIENT_LIB_DIR` is off. The uvicorn console will print the SQLAlchemy/oracledb error.

## 5. Run frontend (Vite dev)

In another terminal:

```bash
cd frontend
npm ci
npm run dev
```

Vite serves on `http://localhost:5173` (separate from rectrace's `:5173` — they collide if both run on the same port). Actually — wait, this **conflicts** with the rectrace frontend port. Two options:

- **Option A (recommended on the laptop)**: skip Vite dev for RecViz; instead, run `npm run build` once and let the FastAPI backend serve the built bundle from `backend/app/static/` at `http://localhost:8000/`. You'll iterate on rectrace far more than on RecViz, so this is the natural split.
  ```bash
  cd frontend
  npm run build
  ```
  Then refresh `http://localhost:8000/` — RecViz UI renders from the built bundle.

- **Option B**: run RecViz Vite on a different port and update rectrace's `VITE_RECVIZ_ORIGIN` to match.
  ```bash
  cd frontend
  npm run dev -- --port 5174
  ```
  In rectrace `frontend-react/.env`:
  ```
  VITE_RECVIZ_ORIGIN=http://localhost:5174
  ```

## 6. Configure the embedded dashboards (`dash-tlm-stats`, `dash-quickrec-stats`)

These two dashboards are what the rectrace cell-click modal embeds. They're stored in the `recviz_dashboards` table with connection references that point at the local Docker Oracle by default. On the Citi laptop you need to point them at Citi Oracle.

Two approaches, pick whichever is faster:

### 6a. Edit via RecViz Admin UI (when it exists)

Open `http://localhost:8000/dashboards`, find the dashboards listed there, and edit the connection on each. Future-proof, no SQL needed.

### 6b. Update the `recviz_connections` table directly

```bash
# Connect to your Citi Oracle as RECVIZ_DB_SCHEMA, then:
UPDATE recviz_connections
SET url = 'oracle+oracledb://<user>:<password>@<host>:<port>/?service_name=<service>'
WHERE id IN (
  SELECT connection_id FROM recviz_datasets
  WHERE dataset_id IN (
    -- list the dataset IDs the two dashboards reference
    SELECT dataset_id FROM recviz_dashboards WHERE id IN ('dash-tlm-stats','dash-quickrec-stats')
  )
);
COMMIT;
```

If the password field is encrypted at rest (Fernet), you'll need the Admin UI path 6a — direct SQL update bypasses encryption.

### 6c. Verify via rectrace

Once dashboards are repointed, navigate `http://localhost:5173/search?q=<a-real-tlm-instance>` in rectrace. Click a TLM-stats cell → the modal should open and the embedded RecViz dashboard should render Citi data, not "no data" or a connection error.

## 7. Things deliberately out of scope for the first laptop run

- **Citi auth (CitiPortal/SiteMinder)** — handled by a separate Citi team. RecViz currently has no auth chain by design; the CORS + frame-ancestors allow-lists are the only access control.
- **Splunk shipping** — DEPLOY.md covers the production Splunk wiring. For the laptop, logs go to stdout from uvicorn — that's fine for first-run validation.
- **RHEL VM deployment** — see `DEPLOY.md` for the production VM walkthrough (systemd unit, recviz-prod.env, etc.). The Citi laptop is a stepping stone.

## 8. Known gotchas on Windows

- **Git Bash for the uvicorn env-load** — the `set -a && . .env && set +a` pattern is bash syntax. On PowerShell you'd use `Get-Content .env | ForEach-Object { ... }` which is uglier. Use Git Bash.
- **Oracle Instant Client requires the Visual C++ Redistributable** — most Citi Windows builds already have it; if `oracledb` fails to load the client with "DPI-1047", install the redist from Microsoft's download page.
- **`npm run dev` on Windows** — works fine in Git Bash, PowerShell, or CMD.

## 9. Reference

- `DEPLOY.md` — production Citi VM deployment (RHEL, systemd, recviz-prod.env)
- `backend/.env.example` — macOS-Docker dev template
- `backend/.env.citi.example` — Citi laptop template (this guide assumes you copied from here)
- Companion: `autosys-job-explorer/CITI-LAPTOP-SETUP.md` — rectrace first-run setup
