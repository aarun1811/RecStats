# Roadmap: RecViz

## Milestones

- **v1.0** -- RecViz core BI platform -- 11 phases, 42 plans (shipped 2026-04-08). See `.planning/milestones/v1.0-ROADMAP.md` for the full archived roadmap and `.planning/milestones/v1.0-REQUIREMENTS.md` for the matching requirements snapshot.
- **v2.0** -- Remove Superset -- Direct Database Engine -- 5 phases (Phases 12-16), in progress

## Current Milestone: v2.0 Remove Superset -- Direct Database Engine

**Milestone Goal:** Rip out Superset and Redis entirely. FastAPI queries databases directly via SQLAlchemy. Full v1.0 feature parity with zero Docker in production.

## Phases

**Phase Numbering:**
- Continues from v1.0 (Phases 1-10). Phase 11 was a candidate that never executed.
- v2.0 starts at Phase 12 to avoid confusion.
- Decimal phases (12.1, 12.2): Urgent insertions if needed (marked with INSERTED).

- [x] **Phase 12: Engine Foundation** - Connection storage table, credential encryption, cross-dialect types, async engine pool, and URI builder (completed 2026-04-09)
- [ ] **Phase 13: Query Execution** - QueryExecutor rewrite with direct SQL execution, filter injection, column detection, and Oracle normalization
- [ ] **Phase 14: API Migration** - Rewrite database/dataset/SQL endpoints to use direct engine, remove all Superset sync code
- [ ] **Phase 15: Superset Removal** - Delete all Superset code, remove Redis, simplify Docker Compose, clean dependencies
- [ ] **Phase 16: Parity Verification** - Full regression testing confirming every v1.0 feature works identically with the new engine

## Phase Details

### Phase 12: Engine Foundation
**Goal**: The infrastructure for direct database queries exists -- connections are stored securely in RecViz's own table, async engines are pooled per database, and all ORM models work on both PostgreSQL and Oracle
**Depends on**: Nothing (first phase of v2.0)
**Requirements**: CONN-01, CONN-03, CONN-04, CONN-05, DIAL-01, DIAL-03, QENG-01
**Success Criteria** (what must be TRUE):
  1. A `recviz_connections` table stores database connection details with Fernet-encrypted credentials, replacing both Superset storage and databases.json
  2. Creating a connection record and calling `SELECT 1` (PostgreSQL) or `SELECT 1 FROM DUAL` (Oracle) via the engine pool succeeds with a configurable timeout
  3. The engine pool lazily creates one AsyncEngine per registered database and disposes it cleanly on connection update or delete (no pool leaks)
  4. All existing ORM models (dashboards, charts, datasets, KPIs, connections) use portable `JSON` column types that work on both PostgreSQL and Oracle
  5. Alembic migrations run successfully on both PostgreSQL (dev) and Oracle (prod) after the JSONB-to-JSON migration
**Plans:** 3/3 plans complete

Plans:
- [x] 12-01-PLAN.md -- PortableJSON TypeDecorator + replace JSONB in all 5 ORM models
- [x] 12-02-PLAN.md -- RecvizConnection model + EncryptionService + async URI builder + config
- [x] 12-03-PLAN.md -- EngineManager service + Alembic migration 005 + FastAPI startup wiring

### Phase 13: Query Execution
**Goal**: Raw SQL and dataset queries execute directly against configured databases with proper pagination, column typing, timeout enforcement, and Oracle compatibility -- no Superset in the query path
**Depends on**: Phase 12
**Requirements**: QENG-02, QENG-03, QENG-04, QENG-05, QENG-06, DIAL-02, DIAL-04
**Success Criteria** (what must be TRUE):
  1. A dataset query with filters, sorting, and pagination executes via `text()` against the engine pool and returns results in the exact same response shape as the Superset-proxied version
  2. SQL Explorer queries execute directly with read-only enforcement -- INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, and TRUNCATE statements are rejected before execution
  3. Result columns are auto-typed (string, number, date, currency) from cursor description, and Oracle UPPERCASE column names are normalized to lowercase
  4. Pagination works on both PostgreSQL (LIMIT/OFFSET) and Oracle (OFFSET FETCH FIRST N ROWS ONLY)
  5. Date range filter clauses work correctly on both PostgreSQL and Oracle dialects
**Plans:** 1/3 plans executed

Plans:
- [x] 13-01-PLAN.md -- ConnectionResolver + query utilities (result adapter, column detection, read-only validator, pagination)
- [ ] 13-02-PLAN.md -- QueryExecutor rewrite with direct text() execution + FastAPI wiring
- [ ] 13-03-PLAN.md -- SQL Explorer direct execution + read-only enforcement

### Phase 14: API Migration
**Goal**: All API endpoints serve data from the direct engine -- no Superset HTTP calls remain in any code path, dataset management operates purely on RecViz tables
**Depends on**: Phase 13
**Requirements**: CONN-02, DATA-01, DATA-02, DATA-03
**Success Criteria** (what must be TRUE):
  1. Database connection CRUD endpoints (create, read, update, delete) operate on `recviz_connections` with no Superset proxy calls
  2. DatasetSyncService and all Superset dataset sync code are deleted -- dataset CRUD operates purely on `recviz_datasets`
  3. The `superset_id` and `sync_status` columns are removed from the datasets model and database via Alembic migration
  4. Every API response shape is byte-compatible with v1.0 -- frontend code requires zero changes
**Plans**: TBD

### Phase 15: Superset Removal
**Goal**: Superset, Redis, and all associated code are completely removed from the project -- the system runs with only FastAPI + PostgreSQL (dev) or FastAPI + Oracle (prod)
**Depends on**: Phase 14
**Requirements**: INFR-01, INFR-02, INFR-03, INFR-04, INFR-05
**Success Criteria** (what must be TRUE):
  1. `superset_client.py`, `database_registrar.py`, `dataset_sync.py`, and the entire `superset/` directory are deleted with zero import references remaining
  2. Redis is removed from Docker Compose, and no config file or code path references Redis
  3. The `httpx` dependency is removed from requirements (no more Superset HTTP proxy calls)
  4. Docker Compose contains only PostgreSQL for local dev -- `docker compose up` starts a single container
  5. The application starts and serves all endpoints with only FastAPI + database (no Superset process, no Redis process)
**Plans**: TBD

### Phase 16: Parity Verification
**Goal**: Every v1.0 feature works identically with the new direct engine -- proven by automated tests and manual walkthrough against seed data dashboards
**Depends on**: Phase 15
**Requirements**: PRTY-01, PRTY-02, PRTY-03, PRTY-04, PRTY-05, PRTY-06, PRTY-07
**Success Criteria** (what must be TRUE):
  1. All 5 seed data dashboards render correctly with charts, KPIs, grids, and filters populated from the direct engine
  2. Cross-filtering (click chart segment, all panels update) and drill-down (double-click to detail rows) work end-to-end on seed dashboards
  3. Dashboard builder create/edit/save/delete cycle works -- a new dashboard can be built from scratch and saved
  4. Sharing (URL filter sync), embed mode (with ?theme, ?filter.X, ?hide params), and Cmd+K command palette all function correctly
  5. SQL Explorer executes queries and displays results, and connection management UI creates, tests, and manages connections
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 12 -> 13 -> 14 -> 15 -> 16

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 12. Engine Foundation | 3/3 | Complete    | 2026-04-09 |
| 13. Query Execution | 1/3 | In Progress|  |
| 14. API Migration | 0/TBD | Not started | - |
| 15. Superset Removal | 0/TBD | Not started | - |
| 16. Parity Verification | 0/TBD | Not started | - |
