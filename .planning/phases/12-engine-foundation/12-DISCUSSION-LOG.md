# Phase 12: Engine Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-09
**Phase:** 12-engine-foundation
**Areas discussed:** Connection migration, Dev experience, Oracle compatibility, JSONB migration

---

## Gray Areas Presented

| Area | Description |
|------|-------------|
| Connection migration | databases.json to DB table: auto-migrate on boot? Keep JSON as fallback? |
| Dev experience | How local dev setup changes: new env vars, encryption key for dev? |
| Oracle compatibility | Docker container locally vs only validate on RHEL deployment? |
| JSONB migration | Breaking change approach, single or per-table migration? |

**User's response:** "decide best thing everywhere bro" -- Full Claude discretion on all areas.

## Claude's Discretion

All four areas deferred to Claude's best judgment:

- **Connection migration:** Auto-migrate databases.json on first boot, drop prod.json, connections via UI after migration
- **Dev experience:** Minimal change -- only new `RECVIZ_ENCRYPTION_KEY` env var with dev default
- **Oracle compatibility:** PostgreSQL-only local dev, Oracle validated on RHEL deployment
- **JSONB migration:** Single migration, `sa.JSON().with_variant(JSONB(), "postgresql")` for backwards compat

## Deferred Ideas

None.
