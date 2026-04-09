---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Remove Superset -- Direct Database Engine
status: verifying
stopped_at: Completed 13-03-PLAN.md
last_updated: "2026-04-09T12:38:30.877Z"
last_activity: 2026-04-09
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 6
  completed_plans: 6
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-09)

**Core value:** Business users can view, interact with, and customize dashboards over reconciliation data without depending on another team.
**Current focus:** Phase 13 — Query Execution

## Current Position

Phase: 14
Plan: Not started
Status: Phase complete — ready for verification
Last activity: 2026-04-09

Progress: ░░░░░░░░░░ 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 34 (from v1.0)
- Average duration: ~6 min/plan
- Total execution time: ~3 hours

**By Phase (v1.0 reference):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3 | 30min | 10min |
| 02 | 3 | 20min | 7min |
| 02.1 | 3 | 15min | 5min |
| 03 | 3 | 16min | 5min |
| 04 | 3 | 9min | 3min |
| 05 | 3 | 18min | 6min |
| 06 | 3 | 15min | 5min |
| 07 | 3 | 16min | 5min |
| 08 | 10 | 29min | 3min |
| 09 | 3 | 44min | 15min |
| 10 | 3 | 65min | 22min |
| 12 | 3 | - | - |
| 13 | 3 | - | - |

**Recent Trend:**

- Last 5 plans (v1.0): 10-01a 35min, 10-01b 15min, 10-01c 15min, 09-03 15min, 09-02 14min
- Trend: Stable (later phases more complex due to integration scope)

*Updated after each plan completion*
| Phase 12 P01 | 2min | 2 tasks | 8 files |
| Phase 12 P02 | 3min | 3 tasks | 9 files |
| Phase 12 P03 | 5min | 3 tasks | 6 files |
| Phase 13 P01 | 4min | 2 tasks | 6 files |
| Phase 13 P02 | 5min | 2 tasks | 4 files |
| Phase 13 P03 | 3min | 1 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v2.0]: "Build alongside, then swap" strategy -- new engine built parallel to Superset, Superset deleted only after new path verified
- [v2.0]: JSONB-to-JSON migration must happen first -- Oracle crashes on PostgreSQL JSONB columns
- [v2.0]: One AsyncEngine per registered database, not a shared engine -- each targets a different physical DB
- [v2.0]: Fernet encryption for credentials (key from env var) -- build URI at runtime from decrypted fields
- [v2.0]: API response shapes must be byte-identical to Superset-proxied versions -- zero frontend changes
- [Phase 12]: TypeDecorator with load_dialect_impl for PortableJSON -- sa.JSON() does NOT compile on Oracle in SA 2.0.49
- [Phase 12]: Dev-only default Fernet key in Settings -- production MUST override via RECVIZ_ENCRYPTION_KEY env var
- [Phase 12]: build_async_uri is separate function from build_sqlalchemy_uri -- both coexist for backward compatibility
- [Phase 12]: Disposable engine for connection testing: pool_size=1, max_overflow=0 -- avoids cache pollution
- [Phase 12]: databases.json auto-migration is idempotent (checks by name) -- safe for repeated startups
- [Phase 12]: Migration 005 uses sa.Text() for extra_params -- portable across PostgreSQL and Oracle
- [Phase 13]: ConnectionInfo uses NamedTuple for lightweight immutable cache entries
- [Phase 13]: Query utilities centralized in query_utils.py -- both QueryExecutor and SQL Explorer import from here
- [Phase 13]: detect_column_type checks date patterns before number to handle TIMESTAMP WITH TIME ZONE correctly
- [Phase 13]: QueryExecutor overwrites old QueryEngine in app.state -- all endpoints use new direct path automatically
- [Phase 13]: Old Superset client, DatabaseRegistrar, DatasetSyncService kept in lifespan temporarily (removed in Phase 14/15)
- [Phase 13]: database_id changed from int to str in SQL Explorer -- frontend treats it as opaque, transparent migration
- [Phase 13]: Read-only validation runs before DB lookup to fail fast on forbidden SQL

### Pending Todos

None yet.

### Blockers/Concerns

- Research flag: Oracle connection string formats for RHEL production (TNS aliases vs Easy Connect) -- validate during Phase 12 planning
- Research flag: Capture exact Superset response shapes as test fixtures before removal -- needed for Phase 13/16
- Research flag: `_build_sql()` filter injection uses string interpolation -- parameterized queries may need design in Phase 13

## Session Continuity

Last session: 2026-04-09T12:29:09.252Z
Stopped at: Completed 13-03-PLAN.md
Resume file: None
