# Phase 7: Explorer Page - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 07-explorer-page
**Areas discussed:** Schema browser fix, AG Grid theme migration, Dead code + Save as Dataset, SQL execution verification, E2E Playwright verification

---

## Schema Browser Fix

### Investigation
- Seeded `oracle-local` connection has `schema_name: None` (seed-oracle.py line 2312)
- `/api/databases/{id}/tables` endpoint returns 400 when `schema_name` is null
- Oracle convention: schema = uppercase username. User is `recviz`, so schema should be `RECVIZ`

| Option | Description | Selected |
|--------|-------------|----------|
| Fix seed + graceful fallback | Set RECVIZ in seed, auto-fallback to username when null | |
| Fix seed only | Set RECVIZ in seed, keep 400 for null schema | ✓ |
| API fallback only | Infer schema from username when null | |

**User's choice:** Fix seed only — keep the 400, force users to set schema explicitly.

---

## Dead Code + Save as Dataset

### Investigation
- `chart-builder-dialog.tsx` exists in `components/explorer/` but is imported NOWHERE — completely dead code
- Save as Dataset dialog uses `useCreateDataset` hook + `autoDetectColumns()` — needs verification

| Option | Description | Selected |
|--------|-------------|----------|
| Delete chart dialog, verify Save as Dataset | Delete dead code, verify dataset creation works | ✓ |
| Delete both | Remove chart dialog AND Save as Dataset feature | |
| Keep chart dialog | Wire it up as a working feature | |

**User's choice:** Delete chart dialog (dead code), verify Save as Dataset works end-to-end

---

## Explorer Polish Level

| Option | Description | Selected |
|--------|-------------|----------|
| Light polish | AG Grid migration, error state, empty state animation, section icons | ✓ |
| Full premium | All above + resizable panels, Monaco toolbar, query history animations | |
| Minimum viable | Just AG Grid migration and SQL verification | |

**User's choice:** Light polish — this is a tool page, minimal motion appropriate

---

## Claude's Discretion

- Empty state animation timing
- Section header icon positioning
- Schema browser error component layout
- Whether to add subtle panel entrance animations

## Deferred Ideas

- Resizable panels — future enhancement
- Monaco autocomplete from schema data — future feature
- Chart builder dialog resurrection — explicitly rejected
