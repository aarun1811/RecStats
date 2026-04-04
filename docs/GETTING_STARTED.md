# RecViz — Getting Started

## Architecture

```
Frontend (React)  →  FastAPI Backend  →  Superset (SQL Engine)  →  Database (SQLite local / Oracle prod)
   :5173               :8000               :8088
```

---

## Local Development Setup

### Prerequisites

- Python 3.12+ (via pyenv)
- Node.js 20+ / pnpm
- The `.venv` at `recviz/.venv` with `apache-superset` installed

### 1. One-time Superset Setup

```bash
cd recviz
./scripts/setup-superset-local.sh
```

This initializes Superset with SQLite metadata, creates an admin user (`admin/admin`), and installs the `oracledb` driver.

### 2. Generate Seed Database

```bash
python scripts/generate-seed-db.py
```

Creates `backend/app/config/seed/seed.db` (~12K rows across 6 tables) and auto-updates `databases.json` with the correct path.

### 3. Start Superset

```bash
SUPERSET_CONFIG_PATH=superset/superset_config_local.py .venv/bin/superset run -p 8088
```

Wait until you see `Running on http://127.0.0.1:8088`. Verify: `curl http://localhost:8088/health` should return `OK`.

### 4. Start FastAPI Backend

In a new terminal:

```bash
cd recviz/backend
uvicorn app.main:app --reload --port 8000
```

On startup you should see:
```
Superset client ready
Registered database 'superset_db_TCOSPRD' in Superset (id=1)
Registered database 'superset_db_TFINPRD' in Superset (id=2)
Registered database 'superset_db_TWMPRD' in Superset (id=3)
Registered database 'superset_db_reconmgmt' in Superset (id=4)
DatabaseRegistrar synced
QueryEngine initialized — ready to serve
```

Verify: `curl http://localhost:8000/health` should return `{"status":"ok","superset":true}`.

### 5. Start Frontend

In a new terminal:

```bash
cd recviz/frontend
pnpm dev
```

Open `http://localhost:5173/dashboards/tlm-stats`.

### Quick Verification

```bash
# Filter options (should return real data from seed DB)
curl -s http://localhost:8000/api/data-sources/reconmgmt_recon_bank/distinct/recon_engine_env
# Expected: {"values":["TLMP_CONSUMER","TLMP_FINANCE","TLMP_WEALTH"]}

# Data query
curl -s http://localhost:8000/api/data-sources/tlm_breaks/query \
  -X POST -H "Content-Type: application/json" \
  -d '{"filters":{"tlm_instance":"TLMP_CONSUMER","date_range":1}}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{d[\"row_count\"]} rows')"
# Expected: ~240 rows
```

### Local Dev Limitation

SQLite through Superset has concurrency issues with multiple simultaneous queries. The KPI endpoint (which fires 4+ sequential queries) may timeout or error. Individual data source queries work fine. This does not happen with Oracle.

---

## Production Setup (Oracle)

### 1. Edit `databases.json`

Update `backend/app/config/databases.json`. Replace SQLite entries with Oracle connection strings:

```json
{
  "databases": [
    {
      "name": "superset_db_TCOSPRD",
      "display_name": "TLM Consumer (TCOSPRD)",
      "sqlalchemy_uri": "oracle+oracledb://username:password@hostname:1521/?service_name=TCOSPRD",
      "dialect": "oracle",
      "type": "tlm"
    },
    {
      "name": "superset_db_TFINPRD",
      "display_name": "TLM Finance (TFINPRD)",
      "sqlalchemy_uri": "oracle+oracledb://username:password@hostname:1521/?service_name=TFINPRD",
      "dialect": "oracle",
      "type": "tlm"
    },
    {
      "name": "superset_db_TWMPRD",
      "display_name": "TLM Wealth (TWMPRD)",
      "sqlalchemy_uri": "oracle+oracledb://username:password@hostname:1521/?service_name=TWMPRD",
      "dialect": "oracle",
      "type": "tlm"
    },
    {
      "name": "superset_db_reconmgmt",
      "display_name": "ReconMgmt",
      "sqlalchemy_uri": "oracle+oracledb://username:password@hostname:1521/?service_name=RECONMGMT",
      "dialect": "oracle",
      "schema": "reconmgmt",
      "type": "reconmgmt"
    }
  ]
}
```

Key fields:
- `sqlalchemy_uri` — Oracle connection string using `oracledb` driver (thin mode, no Instant Client needed)
- `dialect` — set to `"oracle"` (enables Oracle-specific date functions like `SYSDATE`, `TRUNC`)
- `schema` — set for databases where SQL uses schema-qualified table names (e.g., `reconmgmt.table_name`)

### 2. Update SQL Templates (if needed)

The SQL templates in `backend/app/config/data_sources/*.json` contain simplified queries. If the real Oracle schema has different table/column names, update the `query` field in each JSON file.

Rules for SQL templates:
- Use `{{filters}}` placeholder where WHERE clauses should be injected
- Use `{{date_range_clause}}` in filter mappings for date range filters
- Use `{{values}}` for multi-value IN clauses
- Use `{{value}}` for single-value filters
- Prefer ANSI SQL (`COALESCE` over `NVL`, standard `CAST` over `TO_CHAR`)

### 3. Install Oracle Driver

```bash
pip install oracledb
```

The `oracledb` package works in thin mode (pure Python) — no Oracle Instant Client required.

### 4. Configure Superset for Production

For production, use the Docker setup or configure Superset with PostgreSQL metadata + Redis cache:

```bash
# Use the production config (requires PostgreSQL + Redis)
SUPERSET_CONFIG_PATH=superset/superset_config.py superset run -p 8088
```

Or for a quick test with SQLite metadata (same as local dev):

```bash
SUPERSET_CONFIG_PATH=superset/superset_config_local.py superset run -p 8088
```

### 5. Start Services

```bash
# Terminal 1: Superset
SUPERSET_CONFIG_PATH=superset/superset_config_local.py .venv/bin/superset run -p 8088

# Terminal 2: FastAPI
cd backend && uvicorn app.main:app --port 8000

# Terminal 3: Frontend
cd frontend && pnpm dev
```

On FastAPI startup, `DatabaseRegistrar` will automatically register all Oracle databases in Superset.

---

## Embed Mode

To embed a dashboard in another application (e.g., autosys-job-explorer):

```
http://localhost:5173/embed/dashboards/tlm-stats?filter.tlm_instance=TLMP_CONSUMER&filter.lock=tlm_instance&theme=dark
```

URL parameters:
| Param | Description | Example |
|-------|-------------|---------|
| `filter.<id>` | Set a filter value | `filter.tlm_instance=TLMP_CONSUMER` |
| `filter.lock` | Lock filters (comma-separated) | `filter.lock=tlm_instance,recon` |
| `theme` | Force theme | `theme=dark` or `theme=light` |

---

## Adding a New Dashboard

No code changes needed. Just add config files:

1. Create `backend/app/config/dashboards/my-dashboard.json` — defines filters, KPIs, charts, grids
2. Create `backend/app/config/data_sources/my_source.json` — defines SQL template, DB routing, filter mappings
3. Add database entries to `databases.json` if new Oracle DBs are needed
4. Restart FastAPI

The new dashboard appears at `http://localhost:5173/dashboards/my-dashboard`.

---

## Running Tests

```bash
cd backend
python -m pytest tests/ -v
```

All 29 tests should pass. Tests use mock registrar — no Superset/database needed.

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `Superset unavailable at startup` | Superset not running on :8088 | Start Superset first |
| `Failed to register database` | Seed DB missing or bad URI | Run `python scripts/generate-seed-db.py` |
| `required filter 'tlm_instance'` | TLM Instance not selected | Select a value from the dropdown |
| KPI cards show skeleton forever | SQLite concurrency timeout | Local dev limitation — try clicking Apply again, or use Oracle |
| `SQLiteDialect cannot be used as a data source` | Superset blocks SQLite by default | Use `superset_config_local.py` which sets `PREVENT_UNSAFE_DB_CONNECTIONS = False` |
