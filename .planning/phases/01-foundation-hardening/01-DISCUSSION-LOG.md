# Phase 1: Foundation Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-04
**Phase:** 01-Foundation Hardening
**Areas discussed:** Mock data removal, DB persistence, Error handling UX, Number formatting

---

## Mock Data Removal

| Option | Description | Selected |
|--------|-------------|----------|
| Remove all mocks | All 9 endpoints return proper HTTP errors (503, 500). No fake data ever. | ✓ |
| Dev mode toggle | Environment variable enables mocks for local dev. Production never sees fake data. | |
| You decide | Claude picks the best approach | |

**User's choice:** Remove all mocks
**Notes:** No tolerance for fake data in any environment.

### Seed Data

| Option | Description | Selected |
|--------|-------------|----------|
| Seed PostgreSQL | SQL seed scripts populate PostgreSQL with realistic recon data | ✓ |
| SQLite seed DB | Keep existing SQLite seed database | |
| Both | SQLite for quick start, PostgreSQL for realistic testing | |

**User's choice:** Seed PostgreSQL
**Notes:** PostgreSQL only, no SQLite anywhere.

---

## SQLite Removal

| Option | Description | Selected |
|--------|-------------|----------|
| PostgreSQL only | Remove SQLite entirely. Docker Compose required for local dev. | ✓ |
| SQLite for quick start | Keep SQLite as lightweight option for demos | |
| You decide | Pick what makes sense for this team | |

**User's choice:** PostgreSQL only
**Notes:** User asked if SQLite should be kept. Decided to remove entirely for cleaner architecture.

---

## DB Persistence

### Initial question — Superset vs own DB

**User's question:** "Doesn't Superset provide a way to store this? Or using it would have some limitations?"

**Claude's response:** Explained Superset stores dashboards/charts/datasets but has significant limitations for RecViz: layout format tied to Superset UI, no chart library concept, no KPI templates, fragile/underdocumented API, coupling to Superset schema changes. Recommended own DB with Superset as query engine only.

### DB location

| Option | Description | Selected |
|--------|-------------|----------|
| Separate PostgreSQL | Dedicated RecViz database. Clean separation. | |
| Same PostgreSQL | Add RecViz tables to existing Superset PostgreSQL. One less DB to manage. | ✓ |
| You decide | Claude picks based on best practices | |

**User's choice:** Same PostgreSQL
**Notes:** RecViz tables prefixed with `recviz_` to avoid collisions.

### ORM choice
Not explicitly asked after DB location was clarified — SQLAlchemy async + Alembic decided as the standard pattern matching Superset's own approach.

---

## Error Handling UX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline error panels | Each failed component shows error in-place with retry button | |
| Toast + inline | Toast notification + inline error state on affected component | ✓ |
| You decide | Claude designs based on existing patterns | |

**User's choice:** Toast + inline

### Error granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Per component | Each chart/KPI/grid fails independently | ✓ |
| Full dashboard error | Full-page error if any critical query fails | |

**User's choice:** Per component
**Notes:** Resilient approach — one failing query doesn't take down the whole dashboard.

---

## Number Formatting

### Large numbers

| Option | Description | Selected |
|--------|-------------|----------|
| Abbreviate (1.2M) | KPIs abbreviated, grids full numbers, hover for full | ✓ |
| Always full | Always show full numbers with commas | |
| You decide | Claude picks based on financial conventions | |

**User's choice:** Abbreviate (1.2M)

### Currency

**User's input:** "A dataset can have data across currencies. How would that get handled? Majorly it would be USD/EUR/Pound, but still there would be other currencies present."

**Claude's response:** Formatter reads currency code from a companion column per row using Intl.NumberFormat with ISO 4217 codes. Configurable companion column name.

**User's follow-up:** "Let's keep it configurable and not have any defaults."

**Decision:** Fully configurable formatting with NO hardcoded defaults. All format specs come from column metadata.

---

## Claude's Discretion

- SQLAlchemy model design (table structure, relationships)
- Alembic migration strategy
- Seed data content and schema
- Specific Superset version to pin
- Error toast styling and animation timing
- Dead code audit methodology

## Deferred Ideas

None — discussion stayed within phase scope.
