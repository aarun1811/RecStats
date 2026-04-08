# Phase 4: Data Source Connectivity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 04-data-source-connectivity
**Areas discussed:** Connection form UX, Connection health & status, Local dev testing strategy

---

## Connection form UX

| Option | Description | Selected |
|--------|-------------|----------|
| Dynamic form fields | User selects backend type first, form shows only relevant fields | ✓ |
| Single URI field with templates | Single SQLAlchemy URI text input with placeholder templates | |
| Both modes with toggle | Dynamic fields + Advanced toggle for raw URI | |

**User's choice:** Dynamic form fields
**Notes:** Reduces confusion, prevents invalid configs

---

| Option | Description | Selected |
|--------|-------------|----------|
| Service name only | Modern Oracle standard, matches existing uri_builder | ✓ |
| Both with toggle | Radio toggle between Service Name and SID | |
| Service name + TNS alias | Three-way radio: Service Name / SID / TNS | |

**User's choice:** Service name only
**Notes:** SID is deprecated

---

| Option | Description | Selected |
|--------|-------------|----------|
| Required before first save | Must test before creating, edit allows skip if only name changed | ✓ |
| Always optional | Test button available but never required | |
| Required always | Every save requires successful test | |

**User's choice:** Required before first save
**Notes:** Prevents orphaned broken connections

---

| Option | Description | Selected |
|--------|-------------|----------|
| Config-only | Pool settings in Superset config, not in UI | ✓ |
| Basic pool fields in form | pool_size and timeout under Advanced section | |

**User's choice:** Config-only
**Notes:** Keeps form simple for v1

---

| Option | Description | Selected |
|--------|-------------|----------|
| Masked input, stored as-is | Standard password input, stored in Superset | |
| Never stored in frontend | Password for testing only, never returned to frontend | ✓ |

**User's choice:** Never stored in frontend
**Notes:** Security best practice — Superset stores credentials but API never sends them back

---

## Connection health & status

| Option | Description | Selected |
|--------|-------------|----------|
| On-demand test only | No background checks, status updates on test or query failure | ✓ |
| Periodic background checks | Backend pings each database every N minutes | |
| Lazy on first query | Status updates as side effect of actual usage | |

**User's choice:** On-demand test only
**Notes:** Simple, no background overhead

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, update status on failure | Connection errors mark database as unreachable | ✓ |
| No, keep status independent | Status only changes via explicit Test Connection | |

**User's choice:** Yes, update status on failure
**Notes:** Passive health monitoring without explicit infrastructure

---

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal metadata | Backend type, created date, last tested, status, dataset count | ✓ |
| Basic query stats | Also total queries, last query time, avg response time | |

**User's choice:** Minimal metadata
**Notes:** Monitoring/analytics is a different concern

---

| Option | Description | Selected |
|--------|-------------|----------|
| Colored dot | Green/red/gray dot on cards — subtle, space-efficient | ✓ |
| Text badge | Shadcn Badge with status text | |
| Dot + tooltip | Colored dot with hover tooltip for detail | |

**User's choice:** Colored dot
**Notes:** Standard pattern like Slack online indicators

---

## Local dev testing strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Install all drivers | python-oracledb, pyhive, thrift in Superset Dockerfile | ✓ |
| PostgreSQL-only in dev | Keep Dockerfile minimal, prod adds drivers separately | |
| Separate dev vs prod Dockerfiles | Dockerfile.dev and Dockerfile.prod | |

**User's choice:** Install all drivers
**Notes:** Production-ready image, catches import errors early

---

| Option | Description | Selected |
|--------|-------------|----------|
| python-oracledb thin mode | Modern replacement, pure Python, no Oracle Client libs | ✓ |
| cx_Oracle (legacy) | Requires Oracle Instant Client in Docker | |
| You decide | Claude picks based on compatibility | |

**User's choice:** python-oracledb thin mode
**Notes:** Simpler Docker image, Oracle is phasing out cx_Oracle

---

| Option | Description | Selected |
|--------|-------------|----------|
| Separate config files per env | databases.json (dev) + databases.prod.json (prod) | ✓ |
| Environment variables in URIs | Env var placeholders in sqlalchemy_uri | |
| Keep current approach | Hardcoded dev, swap file for prod | |

**User's choice:** Separate config files per env
**Notes:** Explicit separation, DATABASES_CONFIG_PATH env var selects file

---

| Option | Description | Selected |
|--------|-------------|----------|
| Settings tab only | Keep under Settings > Data Sources (current location) | ✓ |
| Dedicated nav item | Top-level sidebar item under Dev Tools | |
| Both — nav link to Settings tab | Sidebar link navigates to Settings with Data Sources pre-selected | |

**User's choice:** Settings tab only
**Notes:** Database management is a dev-team admin task, not daily workflow

---

| Option | Description | Selected |
|--------|-------------|----------|
| PostgreSQL-only for dev | PostgreSQL stands in for all databases locally | ✓ |
| Add HiveServer2 container | Full Hive + Metastore in docker-compose | |
| Optional Hive profile | docker-compose.hive.yml as opt-in override | |

**User's choice:** PostgreSQL-only for dev
**Notes:** Keeps docker-compose simple, real Hive testing on staging/prod

---

## Claude's Discretion

- Dynamic form field layout and validation messaging
- DataSourceSheet refactoring for backend-specific sections
- Connection status state tracking mechanism
- QueryEngine → status propagation implementation
- Hive auth mechanism fields
- Last tested timestamp storage

## Deferred Ideas

- Elasticsearch integration (DATA-03) — deferred to future phase per user request
- Connection pool settings in UI
- Query analytics per database
