# Phase 1: Infrastructure Cutover - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Get the app running against Oracle (via Docker `gvenzl/oracle-free` locally, Citi Oracle 19c in prod) in thick mode with zero PG/async/Docker-compose/Superset/Redis residue, plus lay down the global shadcn Mist+Blue color palette and chart theme rewiring that every subsequent phase will consume. Code targets 19c capabilities only.

</domain>

<decisions>
## Implementation Decisions

### Oracle Local Dev Setup
- **D-01:** Use Docker `gvenzl/oracle-free:latest` (Oracle 23ai Free) for local dev database instead of Oracle Cloud Always Free. Run via manual `docker run` command, not docker-compose.
- **D-02:** Code targets Oracle 19c capabilities only — no 23ai-specific features (BOOLEAN column type, IF NOT EXISTS DDL, JSON-relational duality views, etc.). The version gap (23ai locally vs 19c in prod) is the only accepted drift.
- **D-03:** Connection string: `oracle+oracledb://recviz:recviz_dev@localhost:1521/FREEPDB1`. App user `recviz`, ADMIN user for DBA tasks only.
- **D-04:** Direct TCP connection on both local and prod (no wallet, no TNS_ADMIN, no oracle_config_dir, no wallet_password).

### Thick Mode Enforcement
- **D-05:** Thick mode enforced on all environments — no exceptions. No local/prod drift on driver mode.
- **D-06:** Oracle Instant Client 23.x for macOS ARM64 installed at `~/oracle/instantclient`. RHEL server uses `/opt/oraclient/19.3_64/lib/`.
- **D-07:** `ORACLE_CLIENT_LIB_DIR` env var required. Boot fails if unset or empty — no silent thin mode fallback.
- **D-08:** Startup assertion checks `v$session_connect_info.client_driver` — refuses boot if `python-oracledb thn` detected.

### Backend Configuration
- **D-09:** Single connection URL via `RECVIZ_DB_URL` env var (no individual user/password/dsn fields). No default value — app fails to start if missing.
- **D-10:** `ORACLE_CLIENT_LIB_DIR` as separate env var (not embedded in URL).
- **D-11:** `.env.example` documents four required vars: `RECVIZ_DB_URL`, `ORACLE_CLIENT_LIB_DIR`, `RECVIZ_ENCRYPTION_KEY`, `VITE_API_BASE_URL`.
- **D-12:** Drop `recon_db_url`, `superset_meta` default, and all asyncpg/PG references from config.py.

### Shadcn Palette
- **D-13:** Mist + Blue palette applied globally. Cool, professional BI feel with muted gray surfaces and blue accents.
- **D-14:** CSS variables updated in `frontend/src/index.css` for both light and dark mode.

### Chart Series Colors
- **D-15:** Start from shadcn's built-in `--chart-1` through `--chart-5`, extend to 8 categorical series vars (`--series-1` through `--series-8`) by deriving 3 more from the same hue family.
- **D-16:** Add semantic/ramp vars for specialized chart types: `--color-ramp-low`/`--color-ramp-high` for heatmap/treemap, `--chart-positive`/`--chart-negative` for waterfall/gauge.
- **D-17:** `chart-themes.ts` rewired to read CSS vars at render time via `getComputedStyle()` instead of hard-coded hex array.

### JSON Type
- **D-18:** `OracleJSON(TypeDecorator, SchemaType)` stores via `BLOB IS JSON` with `CheckConstraint`. Primary type name is `OracleJSON`.
- **D-19:** `PortableJSON = OracleJSON` alias retained for one-milestone grace. Phase 8 removes the alias and updates all imports.

### Migration
- **D-20:** Delete all 7 existing PG-targeted Alembic migrations.
- **D-21:** New `001_initial_oracle_schema.py` includes all 6 `recviz_*` tables including `recviz_data_sources` (seed script and existing code depend on it; Phase 6 handles the architectural fix).
- **D-22:** Hand-review against 9-point checklist: six tables, `BLOB IS JSON` on config/columns/extra_params, `VARCHAR2(128 CHAR)` PKs, `CLOB` for sql/encrypted_password, `TIMESTAMP(6) WITH TIME ZONE` defaults, expected indexes, `UniqueConstraint` on `recviz_connections.name`.

### Residue Removal
- **D-23:** Delete `docker-compose.yml` (PG container definition).
- **D-24:** Delete `scripts/setup-superset-local.sh` and all other PG/Superset setup scripts.
- **D-25:** Rewrite `scripts/seed-postgres.py` as `scripts/seed-oracle.py` for Oracle. Seed data gives something to work with in Phase 2+. Delete the seed script entirely in Phase 8.
- **D-26:** Delete dead dialect paths from `uri_builder.py` (elasticsearch, hive, postgresql) — Oracle only.
- **D-27:** `engine_manager.py` supports Oracle only — remove PostgreSQL dialect handling entirely.
- **D-28:** Delete entire `docs/` directory (all stale Superset-era files).
- **D-29:** Repo-wide grep audit for `postgresql`, `JSONB`, `asyncpg`, `psycopg2`, `superset`, `redis`, `celery` — zero hits outside `.git/`.

### USAGE-TRACKER
- **D-30:** Initialize `.planning/USAGE-TRACKER.md`. Claude designs the format during planning to serve Phase 8 dead code sweep.

### Claude's Discretion
- USAGE-TRACKER.md format design
- Exact series color hex values (derived from Mist+Blue + shadcn chart vars)
- AG Grid `.ag-theme-quartz` override block specifics in index.css
- Startup assertion implementation details
- Pool sizing and connection args for Oracle engine
- Alembic env.py online mode configuration details

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and scope
- `.planning/REQUIREMENTS.md` — INFRA-01 through INFRA-25 (full requirement specs for this phase)
- `.planning/ROADMAP.md` — Phase 1 details, success criteria, known risks/gotchas (especially: hard user gate replaced by Docker, NCS 871 gap, once-per-process thick-mode constraint, chart-themes.ts blocker, Oracle DDL auto-commits, Alembic autogenerate caveats)
- `.planning/PROJECT.md` — Constraints, key decisions, out-of-scope items, environment context

### Codebase state
- `.planning/codebase/ARCHITECTURE.md` — Current 3-tier architecture, data flow, key abstractions (EngineManager, QueryExecutor, ConfigStore, DashboardConfig)
- `.planning/codebase/CONCERNS.md` — Broken dashboard pipeline (recviz_data_sources gap), stale Superset references, alembic.ini asyncpg URL, vestigial table
- `.planning/codebase/STACK.md` — Current dependencies with exact versions, configuration files, platform requirements
- `.planning/codebase/CONVENTIONS.md` — Coding conventions, file naming, import patterns

### Oracle local dev
- `.planning/research/ORACLE_LOCAL_VM.md` — Research on Oracle local dev options (if present)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/db/types.py` — `PortableJSON` type decorator; needs rewrite to `OracleJSON` with `BLOB IS JSON`
- `backend/app/db/engine.py` — Sync engine setup; needs rewrite for Oracle connect_args and thick mode init
- `backend/app/services/engine_manager.py` — Engine-per-connection registry; needs Oracle-only rewrite
- `backend/app/config.py` — Pydantic Settings; needs Oracle fields replacing PG defaults
- `backend/app/services/uri_builder.py` — URI builder; needs dead dialect removal
- `frontend/src/lib/chart-themes.ts` — Hard-coded hex series array; needs CSS var rewiring
- `frontend/src/index.css` — CSS variable definitions; needs Mist+Blue palette + series vars + AG Grid overrides
- `frontend/src/components/layout/theme-provider.tsx` — next-themes provider; no changes needed

### Established Patterns
- Pydantic `BaseSettings` for all backend config (reads from `.env`)
- `oracledb.init_oracle_client()` called once at import time in `main.py` before any module imports `oracledb`
- `create_engine()` with pool_pre_ping, pool_size, max_overflow — sync SQLAlchemy pattern throughout
- CSS variables in `:root` / `.dark` selectors consumed by components and chart wrappers
- `getComputedStyle(document.documentElement).getPropertyValue()` for reading CSS vars in JS

### Integration Points
- `backend/app/main.py` lifespan — thick mode init, EngineManager creation, health check
- `backend/app/migrations/env.py` — Alembic online mode needs Oracle connect_args
- `frontend/src/index.css` — Global CSS vars consumed by every component, chart wrapper, and AG Grid
- `frontend/src/components/charts/ag-chart-wrapper.tsx` + `echart-wrapper.tsx` — Read palette from chart-themes.ts

</code_context>

<specifics>
## Specific Ideas

- Docker run command for Oracle dev DB: `docker run -d --name oracle-26ai -p 1521:1521 -e ORACLE_PASSWORD=RecViz2026 -e APP_USER=recviz -e APP_USER_PASSWORD=recviz_dev gvenzl/oracle-free:latest`
- User prefers no local/prod drift except the Oracle version (23ai vs 19c) — everything else identical
- Seed script rewritten for Oracle (not deleted) so there's data to work with in Phase 2+ page phases
- Instant Client install is a manual user step before code work begins

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-infrastructure-cutover*
*Context gathered: 2026-04-12*
