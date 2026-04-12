# Requirements: RecViz — Oracle-Only Cutover + Frontend Colorization

**Defined:** 2026-04-11
**Core Value:** Business users can view, interact with, and customize reconciliation dashboards against Citi's production Oracle 19c environment, with zero local-vs-prod drift.

## v1 Requirements (this milestone)

Each requirement maps to exactly one phase. All verification is **manual** (no automated tests). Each page phase shares a common pattern: colorize using the Phase 1 global palette, discover and fix issues during the phase's discuss step, verify manually against Oracle, commit.

### Infrastructure (Phase 1)

- [x] **INFRA-01**: Oracle Cloud Always Free Autonomous Database 19c provisioned with `recvizdev` name, Transaction Processing workload, admin password recorded
- [x] **INFRA-02**: Instance wallet downloaded, unpacked to `~/.oracle/wallets/recvizdev/`, `sqlnet.ora` edited to absolute `DIRECTORY` path, permissions locked to 700/600
- [x] **INFRA-03**: Oracle Instant Client 23.x macOS ARM64 installed natively (not via Rosetta), `libclntsh.dylib` verified as arm64
- [x] **INFRA-04**: `TNS_ADMIN` exported in `~/.zshrc`, `sqlplus ADMIN@recvizdev_low` smoke test passes (`SELECT sysdate FROM dual;` returns a row)
- [x] **INFRA-05**: `backend/requirements.txt` pruned — `psycopg2-binary`, `asyncpg`, and `sqlalchemy[asyncio]` extra removed; plain `sqlalchemy==2.0.49` remains
- [x] **INFRA-06**: `backend/app/config.py` updated with Oracle fields (`oracle_client_lib_dir`, `oracle_config_dir`, `recviz_db_user`, `recviz_db_password: SecretStr`, `recviz_db_dsn`, `oracle_wallet_password: SecretStr`); `recon_db_url` dropped; `recviz_db_url` default = `oracle+oracledb://`
- [x] **INFRA-07**: `backend/app/db/engine.py` rewritten — uses `thick_mode={config_dir, driver_name, conditional lib_dir}` dict pattern, `connect_args` carries credentials/DSN, pool sized `pool_size=5, max_overflow=5, pool_pre_ping=True, pool_recycle=1800`; `build_oracle_engine()` helper exposed
- [x] **INFRA-08**: `backend/app/db/types.py` rewritten — `OracleJSON(TypeDecorator, SchemaType)` stores via `BLOB IS JSON` with `_set_table` `CheckConstraint`; `PortableJSON = OracleJSON` alias retained for one-milestone grace
- [x] **INFRA-09**: `backend/app/db/base.py` has explicit `MetaData(naming_convention=...)` applied to `Base.metadata`
- [x] **INFRA-10**: `backend/app/services/engine_manager.py` uses `build_oracle_engine()` helper so secondary engines share thick mode (once-per-process constraint)
- [x] **INFRA-11**: 3 remaining `async def` handlers in `backend/app/api/views.py` converted to plain `def`
- [x] **INFRA-12**: `backend/app/main.py` lifespan adds thick-mode startup assertion via `v$session_connect_info.client_driver`; boot refuses if `python-oracledb thn` detected
- [x] **INFRA-13**: `backend/app/migrations/alembic.ini` `sqlalchemy.url` cleared; `env.py` wires thick mode + `connect_args` in online mode with `compare_type`, `compare_server_default`, `transaction_per_migration=True`, `include_schemas=False`, `version_table="recviz_alembic_version"`
- [x] **INFRA-14**: All 7 existing Postgres-targeted Alembic migrations (`001_initial_schema.py` through `007_dataset_database_id_to_string.py`) deleted
- [x] **INFRA-15**: New `001_initial_oracle_schema.py` migration generated via `alembic revision --autogenerate`, hand-reviewed against 9-point checklist (six tables, `BLOB IS JSON` on `config`/`columns`/`extra_params`, `VARCHAR2(128 CHAR)` PKs, `CLOB` for `sql`/`encrypted_password`, `TIMESTAMP(6) WITH TIME ZONE` defaults, expected indexes, `UniqueConstraint` on `recviz_connections.name`), applied successfully via `alembic upgrade head`
- [x] **INFRA-16**: `backend/.env.example` created/updated with all new Oracle env vars
- [x] **INFRA-17**: Postgres/Docker/Superset/Redis residue deleted — `docker-compose.yml`, `docker/init-db.sql`, `deployment/` (empty dir), `superset/` directory (if present), any Postgres seed SQL; grep audit of `postgresql`, `JSONB`, `asyncpg`, `psycopg2`, `superset`, `redis`, `celery` shows zero hits outside `.git/`
- [x] **INFRA-18**: Global shadcn palette applied — Phase 1 UI-SPEC gate confirms Mist+Blue (or alternative), CSS variables updated in `frontend/src/index.css` for both light and dark mode
- [x] **INFRA-19**: `--series-1..8` CSS variable extension added to `index.css` for categorical multi-series chart colors (Strategy B)
- [x] **INFRA-20**: `.ag-theme-quartz { --ag-*: var(--...) }` override block added to `index.css` so AG Grid reads Shadcn tokens
- [x] **INFRA-21**: `frontend/src/lib/chart-themes.ts` rewired — hard-coded 10-color series array replaced with CSS-var reads via `getComputedStyle()`; heatmap/treemap/waterfall hex overrides replaced with CSS vars
- [x] **INFRA-22**: `.planning/USAGE-TRACKER.md` initialized as the running dead-code audit document for the milestone
- [x] **INFRA-23**: Backend boots successfully against Oracle, `GET /health` returns 200, startup log shows `Oracle client driver: python-oracledb` (no `thn` suffix), frontend loads in browser without crashing (no functional expectations beyond "it starts")
- [x] **INFRA-24**: `docs/` directory deleted entirely — all stale files (API.md, ARCHITECTURE.md, CODEBASE_GUIDE.md, CONFIGURATION.md, DEPLOYMENT.md, DEVELOPMENT.md, GETTING_STARTED.md, SETUP.md, TESTING.md, `plans/`, `research/`, `testing/`, `superpowers/` subdirs) removed. User will recreate documentation as needed post-milestone.
- [x] **INFRA-25**: `CLAUDE.md` verified fresh for the milestone — grep shows zero references to `postgresql`, `asyncpg`, `psycopg2`, `superset`, `docker`, `redis`, `celery`, or Tableau/Qlik framing; Oracle-only hard rules section present at top; Oracle 19c + thick mode + NCS 871 gap called out explicitly

### Settings Page (Phase 2)

- [x] **SETT-01**: Settings page colorized per global palette — Appearance, Saved Views, and Data Sources tabs all reflect new color tokens in both light and dark mode
- [x] **SETT-02**: Data Sources tab verified end-to-end against Oracle — list existing sources, create new source, test connection, edit, delete, all operations work against live Oracle 19c
- [x] **SETT-03**: Saved Views tab verified end-to-end — list, load, delete against Oracle
- [x] **SETT-04**: Appearance tab theme toggle works in both directions (light/dark) with the new palette applied
- [x] **SETT-05**: Dead UI stubs in Appearance tab (Density, Font Size buttons) resolved — either implemented or deleted (decided in phase discuss)
- [x] **SETT-06**: Any fixes/enhancements discovered in phase discuss are implemented and verified
- [x] **SETT-07**: `.planning/USAGE-TRACKER.md` updated with files touched/added/removed this phase

### Datasets Page (Phase 3)

- [x] **DATA-01**: Datasets list page colorized per global palette in both modes
- [x] **DATA-02**: Dataset create/edit pages colorized per global palette in both modes
- [x] **DATA-03**: Dataset CRUD verified end-to-end against Oracle — list, create (with parameterized SQL templates), edit, delete, execute sample query
- [x] **DATA-04**: Dataset parameterized SQL execution (`{{filters}}`, `{{values}}`, `{{date_range_clause}}` placeholders) resolves correctly against Oracle via sync `oracledb`
- [x] **DATA-05**: Any fixes/enhancements discovered in phase discuss are implemented and verified
- [x] **DATA-06**: `.planning/USAGE-TRACKER.md` updated

### Charts Page (Phase 4)

- [ ] **CHRT-01**: Charts list page colorized per global palette in both modes
- [ ] **CHRT-02**: Chart create/edit pages (builder wizard) colorized per global palette in both modes
- [x] **CHRT-03**: Chart rendering verified end-to-end — AG Charts (line, bar, area, pie, donut, scatter, heatmap, treemap, waterfall, bullet, box plot, combo) and ECharts (Sankey, sunburst, radar, gauge, parallel coords, funnel) all render correctly with new palette colors
- [x] **CHRT-04**: Chart factory (`chart-factory.tsx`) correctly routes to AG Charts vs ECharts based on `vizType`
- [x] **CHRT-05**: Hard-coded hex in `types/chart.ts` and `components/charts/builder/step-appearance.tsx` audited and removed (replaced with CSS variable references)
- [ ] **CHRT-06**: Dashboard config JSON stored in `recviz_charts.config` audited for hex leakage; stale color overrides migrated or purged
- [ ] **CHRT-07**: Any fixes/enhancements discovered in phase discuss are implemented and verified
- [ ] **CHRT-08**: `.planning/USAGE-TRACKER.md` updated

### KPIs Page (Phase 5)

- [ ] **KPI-01**: KPIs list page colorized per global palette in both modes
- [ ] **KPI-02**: KPI create/edit pages colorized per global palette in both modes
- [ ] **KPI-03**: KPI CRUD + animated counter rendering verified end-to-end against Oracle
- [ ] **KPI-04**: Any fixes/enhancements discovered in phase discuss are implemented and verified
- [ ] **KPI-05**: `.planning/USAGE-TRACKER.md` updated

### Dashboards Page (Phase 6)

- [ ] **DASH-01**: Dashboards list, detail, create, edit pages all colorized per global palette in both modes
- [ ] **DASH-02**: Dashboard CRUD verified end-to-end against Oracle
- [ ] **DASH-03**: Dashboard renderer `recviz_data_sources` gap fixed — post-Superset broken pipeline no longer blocks chart rendering
- [ ] **DASH-04**: Dashboards render end-to-end with charts, KPIs, filters, and drill-down all functioning against Oracle
- [ ] **DASH-05**: Filter bar (global filters, locked filters, URL-synced state) verified
- [ ] **DASH-06**: Cross-filter + drill-down interactions verified
- [ ] **DASH-07**: Legacy dead dashboard code (`filter-bar.tsx`, `kpi-row.tsx`, `chart-grid.tsx`, old store shapes) deleted
- [ ] **DASH-08**: Embed dashboard route (`/embed/dashboards/:id`) verified — renders without sidebar/header, supports `?filter.*`, `?filter.lock`, `?hide=`, `?theme=` URL params
- [ ] **DASH-09**: Any fixes/enhancements discovered in phase discuss are implemented and verified
- [ ] **DASH-10**: `.planning/USAGE-TRACKER.md` updated

### Explorer Page (Phase 7)

- [ ] **EXPL-01**: Explorer page colorized per global palette in both modes
- [ ] **EXPL-02**: SQL execution via sync `oracledb` verified — Monaco editor runs arbitrary SQL against registered Oracle data sources and returns results in AG Grid
- [ ] **EXPL-03**: Explorer AG Grid migrated from legacy `ag-theme-quartz-dark` CSS class to `themeQuartz.withPart(colorSchemeDark)` Theming API
- [ ] **EXPL-04**: Schema browser (if present) lists Oracle tables/columns correctly
- [ ] **EXPL-05**: Query results grid handles large result sets without crashing
- [ ] **EXPL-06**: Any fixes/enhancements discovered in phase discuss are implemented and verified
- [ ] **EXPL-07**: `.planning/USAGE-TRACKER.md` updated

### Alembic Audit + Dead Code Sweep + Memory Cleanup (Phase 8, final)

- [ ] **FINAL-01**: Alembic migrations audited fresh against live Oracle 19c — only intended `recviz_*` tables are created, no extraneous schema objects, migration history is clean
- [ ] **FINAL-02**: `v$parameter` for `COMPATIBLE` checked and documented (ensures identifier length limit is 128 bytes, not 30)
- [ ] **FINAL-03**: Dead code sweep executed using `.planning/USAGE-TRACKER.md` — candidates listed, user approves deletions, code removed
- [ ] **FINAL-04**: `backend/requirements.txt` final prune — no unused dependencies remain
- [ ] **FINAL-05**: `PortableJSON` alias removed, all imports updated to `OracleJSON` directly (one-milestone grace expires)
- [ ] **FINAL-06**: CLAUDE.md updated if any post-milestone drift has emerged (e.g., new conventions discovered during phases)
- [ ] **FINAL-07**: Stale memory entries pruned/updated: `project_superset_alembic`, `project_superset_ditched`, `project_broken_dashboard_pipeline`, `project_local_dev_setup` — removed or rewritten to reflect Oracle-only reality
- [ ] **FINAL-08**: Backend test coverage gap memory note (`project_backend_test_coverage_gap`) remains intact since automated tests are still deferred
- [ ] **FINAL-09**: Milestone completion smoke test — full app boots, all pages render in both light/dark modes, data sources connect to Oracle, dashboards render with real data

## v2 Requirements (deferred)

### Automated Testing

- **TEST-01**: Frontend unit tests (Vitest) for components
- **TEST-02**: Frontend E2E tests (Playwright) for critical user paths
- **TEST-03**: Backend unit tests for services + API routes
- **TEST-04**: Backend integration tests against real Oracle
- **TEST-05**: CI pipeline that runs all test suites

### Authentication

- **AUTH-01**: SSO/SAML/OIDC integration (TBD which)
- **AUTH-02**: Session management
- **AUTH-03**: Role-based access control (admin vs business user)
- **AUTH-04**: Audit logging

### Reports Page

- **RPT-01**: Reports page built against real data (currently all mock) — only if deemed valuable post-milestone

### Other

- **OTH-01**: NCS 871 character set parity — requires paid Oracle Base Database Service or Citi staging environment access; not achievable on Always Free
- **OTH-02**: Production deployment automation (currently manual per memory state)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Reports page | Currently all mock data, no production pathway, not colorized this milestone |
| Automated tests of any kind | Deferred to a future milestone — all verification this milestone is manual |
| PostgreSQL support | Removed entirely; dev + prod both Oracle 19c |
| Docker / containerization | Removed entirely; dev + prod both native |
| Superset | Already ditched; residue removed this milestone |
| Redis / Celery / background tasks | Not used; removed from deps if present |
| Authentication / SSO / SAML / OIDC | Deferred to v2; still TBD |
| Mobile / tablet responsive design | Desktop-only BI tool for large-screen data density |
| New user-facing features | Only discovered fixes and small enhancements per page — no greenfield feature work |
| Async DB calls anywhere | Oracle 19c driver doesn't support async; sync SQLAlchemy + Starlette threadpool is the model |
| NCS 871 character set parity in local dev | Oracle Cloud Always Free cannot set character sets; procedural mitigation only |
| Thin-mode `oracledb` | Character set NCS 871 unsupported in thin mode; thick mode required everywhere |
| `run_in_threadpool` wrappers | Cleaner to flip handlers to `def` and let Starlette handle threadpool natively |
| Changing `recviz_alembic_version` table name | Historical workaround, no functional reason to rename |
| New branches per phase | Milestone stays on `feature/add-color-remove-postgres` |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 1 | Complete |
| INFRA-04 | Phase 1 | Complete |
| INFRA-05 | Phase 1 | Complete |
| INFRA-06 | Phase 1 | Complete |
| INFRA-07 | Phase 1 | Complete |
| INFRA-08 | Phase 1 | Complete |
| INFRA-09 | Phase 1 | Complete |
| INFRA-10 | Phase 1 | Complete |
| INFRA-11 | Phase 1 | Complete |
| INFRA-12 | Phase 1 | Complete |
| INFRA-13 | Phase 1 | Complete |
| INFRA-14 | Phase 1 | Complete |
| INFRA-15 | Phase 1 | Complete |
| INFRA-16 | Phase 1 | Complete |
| INFRA-17 | Phase 1 | Complete |
| INFRA-18 | Phase 1 | Complete |
| INFRA-19 | Phase 1 | Complete |
| INFRA-20 | Phase 1 | Complete |
| INFRA-21 | Phase 1 | Complete |
| INFRA-22 | Phase 1 | Complete |
| INFRA-23 | Phase 1 | Complete |
| INFRA-24 | Phase 1 | Complete |
| INFRA-25 | Phase 1 | Complete |
| SETT-01 | Phase 2 | Complete |
| SETT-02 | Phase 2 | Complete |
| SETT-03 | Phase 2 | Complete |
| SETT-04 | Phase 2 | Complete |
| SETT-05 | Phase 2 | Complete |
| SETT-06 | Phase 2 | Complete |
| SETT-07 | Phase 2 | Complete |
| DATA-01 | Phase 3 | Complete |
| DATA-02 | Phase 3 | Complete |
| DATA-03 | Phase 3 | Complete |
| DATA-04 | Phase 3 | Complete |
| DATA-05 | Phase 3 | Complete |
| DATA-06 | Phase 3 | Complete |
| CHRT-01 | Phase 4 | Pending |
| CHRT-02 | Phase 4 | Pending |
| CHRT-03 | Phase 4 | Complete |
| CHRT-04 | Phase 4 | Complete |
| CHRT-05 | Phase 4 | Complete |
| CHRT-06 | Phase 4 | Pending |
| CHRT-07 | Phase 4 | Pending |
| CHRT-08 | Phase 4 | Pending |
| KPI-01 | Phase 5 | Pending |
| KPI-02 | Phase 5 | Pending |
| KPI-03 | Phase 5 | Pending |
| KPI-04 | Phase 5 | Pending |
| KPI-05 | Phase 5 | Pending |
| DASH-01 | Phase 6 | Pending |
| DASH-02 | Phase 6 | Pending |
| DASH-03 | Phase 6 | Pending |
| DASH-04 | Phase 6 | Pending |
| DASH-05 | Phase 6 | Pending |
| DASH-06 | Phase 6 | Pending |
| DASH-07 | Phase 6 | Pending |
| DASH-08 | Phase 6 | Pending |
| DASH-09 | Phase 6 | Pending |
| DASH-10 | Phase 6 | Pending |
| EXPL-01 | Phase 7 | Pending |
| EXPL-02 | Phase 7 | Pending |
| EXPL-03 | Phase 7 | Pending |
| EXPL-04 | Phase 7 | Pending |
| EXPL-05 | Phase 7 | Pending |
| EXPL-06 | Phase 7 | Pending |
| EXPL-07 | Phase 7 | Pending |
| FINAL-01 | Phase 8 | Pending |
| FINAL-02 | Phase 8 | Pending |
| FINAL-03 | Phase 8 | Pending |
| FINAL-04 | Phase 8 | Pending |
| FINAL-05 | Phase 8 | Pending |
| FINAL-06 | Phase 8 | Pending |
| FINAL-07 | Phase 8 | Pending |
| FINAL-08 | Phase 8 | Pending |
| FINAL-09 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 68 total
- Mapped to phases: 68
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-11*
*Last updated: 2026-04-11 after roadmap creation (traceability expanded to per-REQ-ID granularity)*
