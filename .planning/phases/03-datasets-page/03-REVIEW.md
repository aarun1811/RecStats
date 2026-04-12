---
phase: 03-datasets-page
reviewed: 2026-04-12T16:17:01Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - frontend/src/lib/style-constants.ts
  - frontend/src/components/datasets/column-header-with-tooltip.tsx
  - frontend/src/components/datasets/column-metadata-grid.tsx
  - frontend/src/components/datasets/column-metadata-help-sheet.tsx
  - frontend/src/components/datasets/dataset-card.tsx
  - frontend/src/components/datasets/dataset-editor.tsx
  - frontend/src/components/datasets/dataset-list.tsx
  - frontend/src/components/datasets/dataset-row.tsx
  - frontend/src/components/datasets/role-badge-renderer.tsx
  - frontend/src/components/datasets/type-badge-renderer.tsx
  - frontend/src/components/explorer/sql-editor.tsx
  - frontend/src/components/settings/data-source-card.tsx
  - frontend/src/routes/_app/datasets/$datasetId.edit.tsx
  - frontend/src/routes/_app/datasets/index.tsx
  - frontend/src/routes/_app/datasets/new.tsx
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-04-12T16:17:01Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

The datasets page implementation is well-structured, follows project conventions for component naming, file naming, state management (Zustand for UI, TanStack Query for server), and uses correct AG Grid theming. The code is clean with good separation of concerns -- the `DatasetEditor` is the most complex file and handles both create/edit modes sensibly.

Key concerns: (1) a SQL formatting function performs naive regex replacement that can corrupt SQL string literals and comments, (2) the `column_name` / `name` fallback pattern on `SqlColumnInfo` lacks defensive handling for when both are missing, and (3) the `handleFormatSql` callback is a client-side SQL beautifier that can break queries containing reserved words inside string constants.

## Critical Issues

### CR-01: SQL formatter corrupts string literals and comments

**File:** `frontend/src/components/datasets/dataset-editor.tsx:146-153`
**Issue:** `handleFormatSql` does a blind regex replace of SQL keywords (SELECT, FROM, WHERE, etc.) across the entire SQL string, including inside string literals, quoted identifiers, and comments. A query like `SELECT * FROM users WHERE name = 'FROM ADDRESS'` would be reformatted to break the string literal by inserting newlines inside it. This silently corrupts the user's SQL, and since the corrupted SQL is then stored and sent to the backend, it causes query execution failures that are hard to diagnose.
**Fix:** Either use a proper SQL parser/formatter library (e.g., `sql-formatter`), or at minimum skip keyword replacement inside quoted strings. A safe minimal approach:
```typescript
// Option A: use the sql-formatter package
import { format } from 'sql-formatter'

const handleFormatSql = useCallback(() => {
  try {
    const formatted = format(sql, { language: 'plsql' })
    setSql(formatted)
  } catch {
    // If formatting fails, leave SQL unchanged
    toast.error('Could not format SQL')
  }
}, [sql])
```

## Warnings

### WR-01: Unsafe type assertion on colDef.field during cell value change

**File:** `frontend/src/components/datasets/column-metadata-grid.tsx:198`
**Issue:** `event.colDef.field as string` is cast without checking that `field` is defined. If a column definition were to lack a `field` property (e.g., a custom column), this would set `undefined` as a key on the object, silently corrupting column metadata. While current column defs all have `field`, this is fragile.
**Fix:**
```typescript
const onCellValueChanged = useCallback(
  (event: CellValueChangedEvent<MergedColumn>) => {
    if (!event.data || !event.colDef.field) return
    const field = event.colDef.field
    const updated = columns.map((col) => {
      if (col.name === event.data!.name) {
        return { ...col, [field]: event.newValue }
      }
      return col
    })
    onChange(updated)
  },
  [columns, onChange],
)
```

### WR-02: No error handling on delete mutation failure

**File:** `frontend/src/components/datasets/dataset-editor.tsx:221-230`
**Issue:** `handleDelete` calls `deleteDataset.mutate()` with an `onSuccess` handler but no `onError` handler. If the delete API call fails (e.g., dataset has referencing charts, network error), the user gets no feedback -- the dialog stays open with no indication of what went wrong.
**Fix:**
```typescript
const handleDelete = useCallback(() => {
  if (!dataset) return
  deleteDataset.mutate(dataset.id, {
    onSuccess: () => {
      setDeleteDialogOpen(false)
      toast.success(`Dataset "${dataset.name}" deleted`)
      navigate({ to: '/datasets' })
    },
    onError: (err) => {
      toast.error(`Failed to delete dataset: ${err.message}`)
    },
  })
}, [dataset, deleteDataset, navigate])
```

### WR-03: No error handling on create/update mutation failures

**File:** `frontend/src/components/datasets/dataset-editor.tsx:173-206`
**Issue:** Both `createDataset.mutate()` and `updateDataset.mutate()` have `onSuccess` but no `onError` handlers. If the save fails (duplicate name, validation error, network timeout), the user sees no error feedback. The global TanStack Query error handler may not fire for mutations depending on configuration.
**Fix:** Add `onError` handlers to both mutation calls:
```typescript
onError: (err) => {
  toast.error(`Failed to save dataset: ${err.message}`)
},
```

### WR-04: Pluralization logic produces incorrect labels for truncated role names

**File:** `frontend/src/components/datasets/dataset-card.tsx:90`
**Issue:** The expression `COLUMN_ROLE_LABELS[role].toLowerCase().slice(0, 4) + (count > 1 ? 's' : '')` truncates role labels to 4 characters then appends 's'. This produces: "dime" -> "dimes", "meas" -> "meass", "time" -> "times". "meass" is incorrect -- the truncation-then-pluralize approach does not work universally. The same pattern appears in `dataset-row.tsx:36`.
**Fix:** Use a dedicated short-label map instead of string truncation:
```typescript
const ROLE_SHORT_LABELS: Record<ColumnRole, { singular: string; plural: string }> = {
  dimension: { singular: 'dim', plural: 'dims' },
  measure: { singular: 'meas', plural: 'meas' },
  time: { singular: 'time', plural: 'time' },
  none: { singular: 'none', plural: 'none' },
}
```

### WR-05: `useManagedDataset` called with string type but hook accepts `string | null`

**File:** `frontend/src/routes/_app/datasets/$datasetId.edit.tsx:13`
**Issue:** `Route.useParams()` returns `{ datasetId: string }`, which is always a string. The hook `useManagedDataset` accepts `string | null` and has `enabled: id !== null`. This is not a bug currently, but if TanStack Router ever provided `undefined` for an unresolved param, the query would fire with `undefined` as the ID, leading to a 404 API call. The types do not enforce the guard.
**Fix:** This is low severity since TanStack Router guarantees the param exists in a matched route. No immediate change needed, but worth noting for defensive coding.

## Info

### IN-01: `runStartTime` state is set but never read

**File:** `frontend/src/components/datasets/dataset-editor.tsx:74,99`
**Issue:** `runStartTime` is set in `handleRunQuery` via `setRunStartTime(startTime)` but the `runStartTime` state variable is never read anywhere in the component. The local `startTime` variable in the closure is used instead.
**Fix:** Remove the unused state:
```typescript
// Remove this line:
const [runStartTime, setRunStartTime] = useState(0)
// And remove: setRunStartTime(startTime) on line 99
```

### IN-02: `useSqlExecute` sends hardcoded `schema: 'public'` default

**File:** `frontend/src/hooks/use-sql-execute.ts:19`
**Issue:** The hook defaults `schema` to `'public'`, which is a PostgreSQL concept. Oracle uses schema names that map to usernames (e.g., `RECVIZ`). Per CLAUDE.md, this project is Oracle-only. The hardcoded `'public'` default is misleading, though it may be ignored by the backend.
**Fix:** Change the default to an empty string or remove it, and let the backend determine the appropriate schema:
```typescript
schema: params.schema ?? '',
```

### IN-03: Duplicate import paths in dataset-card.tsx and dataset-row.tsx

**File:** `frontend/src/components/datasets/dataset-card.tsx:15-16`, `frontend/src/components/datasets/dataset-row.tsx:12-13`
**Issue:** Both files import `ColumnRole` and `RecvizDataset` from `@/types/managed-dataset` using two separate import statements. These could be consolidated into a single import for cleanliness.
**Fix:**
```typescript
import type { RecvizDataset, ColumnRole } from '@/types/managed-dataset'
```

---

_Reviewed: 2026-04-12T16:17:01Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
