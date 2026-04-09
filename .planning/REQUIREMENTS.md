# Requirements: RecViz v2.0 — Remove Superset

**Defined:** 2026-04-09
**Core Value:** Business users can view, interact with, and customize dashboards over reconciliation data without depending on another team for every change.

## v2.0 Requirements

Requirements for Superset removal and direct database engine. Each maps to roadmap phases.

### Database Connections

- [x] **CONN-01**: Connections stored in `recviz_databases` table (replacing Superset storage + databases.json)
- [x] **CONN-02**: CRUD API endpoints for database connections (create, read, update, delete) — no Superset proxy
- [x] **CONN-03**: Connection testing via direct `SELECT 1` / `SELECT 1 FROM DUAL` with timeout
- [x] **CONN-04**: Credential encryption at rest using Fernet symmetric encryption (key from env var)
- [x] **CONN-05**: URI builder generates async dialect URIs (`postgresql+asyncpg://`, `oracle+oracledb://`)

### Query Engine

- [x] **QENG-01**: Dynamic engine pool — one AsyncEngine per registered database, created lazily, disposed on connection update/delete
- [x] **QENG-02**: Raw SQL execution via SQLAlchemy `text()` + `AsyncConnection.execute()` with configurable timeout
- [x] **QENG-03**: Dataset SQL execution with filter injection, pagination (LIMIT/OFFSET or OFFSET FETCH), and sorting
- [x] **QENG-04**: SQL Explorer direct execution with read-only enforcement (reject INSERT/UPDATE/DELETE/DROP/ALTER/CREATE/TRUNCATE)
- [x] **QENG-05**: Column type detection from cursor description mapped to RecViz column types (string, number, date, currency)
- [x] **QENG-06**: Oracle UPPERCASE column name normalization to lowercase (match frontend config expectations)

### Dataset Management

- [x] **DATA-01**: Remove DatasetSyncService and all Superset dataset sync code
- [x] **DATA-02**: Remove `superset_id` and `sync_status` columns from recviz_datasets model and DB
- [x] **DATA-03**: Dataset CRUD operates purely on recviz_datasets table — no external API calls

### Cross-Dialect Compatibility

- [x] **DIAL-01**: Replace all JSONB column types with portable `sa.JSON()` using `with_variant` for PostgreSQL/Oracle
- [x] **DIAL-02**: SQL pagination works on both PostgreSQL (LIMIT/OFFSET) and Oracle (OFFSET FETCH FIRST N ROWS ONLY)
- [x] **DIAL-03**: Alembic migrations execute successfully on both PostgreSQL and Oracle
- [x] **DIAL-04**: Date range clauses work on both dialects (existing `_build_date_range_clause` already handles this)

### Infrastructure Cleanup

- [x] **INFR-01**: Delete all Superset code — superset_client.py, database_registrar.py, dataset_sync.py, superset/ directory
- [x] **INFR-02**: Remove Redis from Docker Compose and all config references
- [x] **INFR-03**: Remove httpx dependency (no more Superset HTTP proxy calls)
- [x] **INFR-04**: Docker Compose simplified to PostgreSQL-only for local dev
- [x] **INFR-05**: Production deployment requires only FastAPI + Oracle — no Docker, no Redis, no Superset

### Parity Verification

- [x] **PRTY-01**: All API response shapes preserved — zero breaking frontend changes
- [x] **PRTY-02**: Seed data dashboards render correctly with charts, KPIs, grids, and filters
- [x] **PRTY-03**: Cross-filtering and drill-down work end-to-end on seed dashboards
- [x] **PRTY-04**: Dashboard builder create/edit/save/delete cycle works
- [x] **PRTY-05**: Sharing (URL sync), embed mode, and Cmd+K command palette work
- [x] **PRTY-06**: SQL Explorer executes queries and displays results
- [x] **PRTY-07**: Connection management UI creates, tests, and manages connections

## Future Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Data Sources

- **DSRC-01**: Hive database connectivity via PyHive driver
- **DSRC-02**: Elasticsearch connectivity for real-time search queries

### Caching

- **CACH-01**: Server-side query result caching (in-memory TTLCache or Redis if needed)

### Features

- **FEAT-01**: Saved views — save current filter state as named bookmark
- **FEAT-02**: Schema browser — table/column introspection in SQL Explorer
- **FEAT-03**: Streaming large result sets for CSV/Excel export
- **FEAT-04**: Query cost estimation via EXPLAIN before execution

## Out of Scope

| Feature | Reason |
|---------|--------|
| Superset virtual dataset abstraction | RecViz has its own dataset model — Superset's was redundant |
| Superset chart data API (JSON-to-SQL compiler) | RecViz's template-based SQL builder is simpler and sufficient |
| Redis caching layer | TanStack Query client-side caching sufficient for ~12 users |
| Superset authentication/RBAC | Auth deferred to future milestone (SSO/SAML/OIDC at FastAPI level) |
| Celery async query execution | Synchronous queries with timeout sufficient; streaming for large exports |
| Mobile/tablet responsive design | Desktop-only application |
| Hive/ES data sources | Deferred — Oracle-only for this milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONN-01 | Phase 12 | Complete |
| CONN-02 | Phase 14 | Complete |
| CONN-03 | Phase 12 | Complete |
| CONN-04 | Phase 12 | Complete |
| CONN-05 | Phase 12 | Complete |
| QENG-01 | Phase 12 | Complete |
| QENG-02 | Phase 13 | Complete |
| QENG-03 | Phase 13 | Complete |
| QENG-04 | Phase 13 | Complete |
| QENG-05 | Phase 13 | Complete |
| QENG-06 | Phase 13 | Complete |
| DATA-01 | Phase 14 | Complete |
| DATA-02 | Phase 14 | Complete |
| DATA-03 | Phase 14 | Complete |
| DIAL-01 | Phase 12 | Complete |
| DIAL-02 | Phase 13 | Complete |
| DIAL-03 | Phase 12 | Complete |
| DIAL-04 | Phase 13 | Complete |
| INFR-01 | Phase 15 | Complete |
| INFR-02 | Phase 15 | Complete |
| INFR-03 | Phase 15 | Complete |
| INFR-04 | Phase 15 | Complete |
| INFR-05 | Phase 15 | Complete |
| PRTY-01 | Phase 16 | Complete |
| PRTY-02 | Phase 16 | Complete |
| PRTY-03 | Phase 16 | Complete |
| PRTY-04 | Phase 16 | Complete |
| PRTY-05 | Phase 16 | Complete |
| PRTY-06 | Phase 16 | Complete |
| PRTY-07 | Phase 16 | Complete |

**Coverage:**
- v2.0 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0

---
*Requirements defined: 2026-04-09*
*Last updated: 2026-04-09 after roadmap creation*
