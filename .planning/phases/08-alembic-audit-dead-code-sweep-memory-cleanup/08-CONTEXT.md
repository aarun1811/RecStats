# Phase 8: Alembic Audit + Dead Code Sweep + Memory Cleanup - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — all decisions at Claude's discretion)

<domain>
## Phase Boundary

Final milestone consolidation — audit Alembic fresh against live Oracle, execute the dead code sweep using the accumulated `.planning/USAGE-TRACKER.md`, prune `requirements.txt`, remove the `PortableJSON` alias, clean stale memory entries, and run the milestone-end smoke test.

</domain>

<decisions>
## Implementation Decisions

### Alembic Audit (FINAL-01, FINAL-02)
- **D-01:** Run `alembic upgrade head` against a fresh Oracle schema — verify only the intended 6 `recviz_*` tables are created, no extraneous objects
- **D-02:** Query `v$parameter` for `COMPATIBLE` — document the value (expected 19.0.0 on Oracle Cloud, 128-byte identifier limit)

### Dead Code Sweep (FINAL-03)
- **D-03:** Read `.planning/USAGE-TRACKER.md` accumulated across all phases. Cross-reference with grep to identify dead code candidates — files that were flagged `[audit]` or marked as removed but still have lingering references
- **D-04:** Present dead code candidates for deletion. Remove confirmed dead code, verify no broken imports remain via `tsc --noEmit`

### Requirements Prune (FINAL-04)
- **D-05:** Audit `backend/requirements.txt` — every dependency must be actually imported somewhere in `backend/app/`. Remove unused ones.

### PortableJSON Removal (FINAL-05)
- **D-06:** Remove `PortableJSON` alias from `backend/app/db/types.py`. Update all imports to use `OracleJSON` directly. One-milestone grace period expires.

### CLAUDE.md Update (FINAL-06)
- **D-07:** Review CLAUDE.md for any post-milestone drift. Update if conventions changed during phases 2-7.

### Memory Cleanup (FINAL-07, FINAL-08)
- **D-08:** Prune stale memory entries: `project_broken_dashboard_pipeline` (fixed in Phase 6), `project_local_dev_setup` (update to reflect Oracle Docker setup). Keep `project_backend_test_coverage_gap` (tests still deferred).
- **D-09:** Review all `project_*` memory entries for accuracy against current codebase state.

### Smoke Test (FINAL-09)
- **D-10:** Full app boot test: backend starts, frontend loads, every page (Settings, Datasets, Charts, KPIs, Dashboards, Explorer) renders in both light and dark mode, data sources connect to Oracle, dashboards render with real data.

### Claude's Discretion
- Order of operations within the sweep
- Which dead code candidates to flag vs auto-delete
- CLAUDE.md specific wording updates
- Smoke test verification depth per page

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — FINAL-01 through FINAL-09
- `.planning/ROADMAP.md` — Phase 8 details, success criteria

### Dead code tracker
- `.planning/USAGE-TRACKER.md` — Accumulated file audit across all phases

### Backend targets
- `backend/app/db/types.py` — PortableJSON alias to remove
- `backend/requirements.txt` — Dependencies to audit
- `backend/app/migrations/` — Alembic migration to audit

### Memory
- `/Users/aarun/.claude/projects/-Users-aarun-Workspace-Projects-RecViz/memory/MEMORY.md` — Memory index

</canonical_refs>

<code_context>
## Existing Code Insights

### Key Files
- `backend/app/db/types.py`: Contains `PortableJSON = OracleJSON` alias
- `backend/requirements.txt`: Backend dependencies
- `backend/app/migrations/versions/001_initial_oracle_schema.py`: Single migration to audit
- `.planning/USAGE-TRACKER.md`: Phases 1-7 file changes tracked

### Integration Points
- `PortableJSON` imported in multiple ORM model files — need to grep and update all
- `recviz_data_sources` table still exists but no longer read (Phase 6 rewired ConfigStore) — candidate for noting in USAGE-TRACKER

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — final phase of milestone.

</deferred>

---

*Phase: 08-alembic-audit-dead-code-sweep-memory-cleanup*
*Context gathered: 2026-04-13*
