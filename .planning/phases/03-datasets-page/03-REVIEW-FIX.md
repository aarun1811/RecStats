---
phase: 03-datasets-page
fixed_at: 2026-04-12T16:30:00Z
review_path: .planning/phases/03-datasets-page/03-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 5
skipped: 1
status: partial
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-04-12T16:30:00Z
**Source review:** .planning/phases/03-datasets-page/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6
- Fixed: 5
- Skipped: 1

## Fixed Issues

### CR-01: SQL formatter corrupts string literals and comments

**Files modified:** `frontend/src/components/datasets/dataset-editor.tsx`, `frontend/package.json`, `frontend/pnpm-lock.yaml`
**Commit:** a0b89b2
**Applied fix:** Replaced naive regex-based SQL keyword replacement (which blindly inserted newlines inside string literals and comments) with the `sql-formatter` library using PL/SQL dialect. Added try/catch to gracefully handle formatting failures with a toast error. Installed `sql-formatter@15.7.3` as a dependency.

### WR-01: Unsafe type assertion on colDef.field during cell value change

**Files modified:** `frontend/src/components/datasets/column-metadata-grid.tsx`
**Commit:** dbcd943
**Applied fix:** Added null guard `!event.colDef.field` to the early return check in `onCellValueChanged`. Extracted `field` into a typed local variable, eliminating the `as string` cast. This prevents silent metadata corruption if a column definition ever lacks a `field` property.

### WR-02: No error handling on delete mutation failure

**Files modified:** `frontend/src/components/datasets/dataset-editor.tsx`
**Commit:** d2ad6f4
**Applied fix:** Added `onError` handler to `deleteDataset.mutate()` call that displays a toast error with the failure message. Users now get explicit feedback when a delete operation fails.

### WR-03: No error handling on create/update mutation failures

**Files modified:** `frontend/src/components/datasets/dataset-editor.tsx`
**Commit:** 38974a1
**Applied fix:** Added `onError` handlers to both `createDataset.mutate()` and `updateDataset.mutate()` calls. Each displays a contextual toast error ("Failed to create dataset" / "Failed to update dataset") with the error message. Users now get explicit feedback when save operations fail.

### WR-04: Pluralization logic produces incorrect labels for truncated role names

**Files modified:** `frontend/src/lib/style-constants.ts`, `frontend/src/components/datasets/dataset-card.tsx`, `frontend/src/components/datasets/dataset-row.tsx`
**Commit:** f260bd3
**Applied fix:** Added `COLUMN_ROLE_SHORT_LABELS` map to `style-constants.ts` with explicit singular/plural pairs (e.g., dim/dims, meas/meas, time/time). Replaced the broken `.slice(0, 4) + 's'` pattern in both `dataset-card.tsx` and `dataset-row.tsx` with lookups into the new map. This eliminates "meass" and other malformed labels.

## Skipped Issues

### WR-05: `useManagedDataset` called with string type but hook accepts `string | null`

**File:** `frontend/src/routes/_app/datasets/$datasetId.edit.tsx:13`
**Reason:** Reviewer explicitly states "No immediate change needed" -- TanStack Router guarantees the param exists in a matched route, so the type mismatch is theoretical only. No code change required.
**Original issue:** `Route.useParams()` returns `{ datasetId: string }` which is always a string. The hook `useManagedDataset` accepts `string | null` with `enabled: id !== null`. The types do not enforce the guard but behavior is correct.

---

_Fixed: 2026-04-12T16:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
