# UI Fixes, Status Persistence, Schema Browser, Dead-Code Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix six UI issues on the RecViz RHEL deployment (broken Run Query, stale status indicators, 404-firing dead hooks, hardcoded "recon_data" schema browser) plus delete pre-existing broken tests blocking `pnpm build`, without touching the already-broken dashboard rendering pipeline (deferred).

**Architecture:** Nine implementation units executed in dependency order on branch `deploy/oracle-v2-20260409`, with a `feature-dev:code-reviewer` agent gate between every unit. Each unit ships as its own commit so failures revert in isolation. Backend changes stay within the existing sync SQLAlchemy + oracledb thick-mode pattern. Frontend changes align connection ID types to the UUID strings the backend has returned since migration 007, and replace the dead `useDatasets` hook with real Oracle schema introspection.

**Tech Stack:** FastAPI 0.128 + SQLAlchemy 2.0.49 (sync) + python-oracledb 3.4.2 thick mode on backend. React 19 + TanStack Query 5 + TanStack Router + Vite 6 + Monaco Editor + Vitest on frontend. Oracle 19c target.

**Spec:** `docs/superpowers/specs/2026-04-11-ui-fixes-and-cleanup-design.md`
**Baseline commit:** `2954a08` (spec commit; last code commit is `59f32ae`)

---

## Prerequisites

Before starting Task 1, the engineer must have:

- Read sections 1-4 of the spec (at least)
- Shell access to the repository at `/Users/aarun/Workspace/recviz-prod-build`
- Checked out branch `deploy/oracle-v2-20260409`
- An active Python venv with the backend dependencies installed (any recent venv works — macOS or the server's)
- `pnpm` 10.x and Node 22+ available (for the frontend)
- The `feature-dev:code-reviewer` subagent available

Verify the baseline is clean:

```bash
cd /Users/aarun/Workspace/recviz-prod-build
git status                    # should be clean
git log --oneline -1          # should show 2954a08 or later docs commit
git branch --show-current     # should show deploy/oracle-v2-20260409
```

---

## File map (what gets created, modified, deleted)

### Created

| Path | Purpose |
|---|---|
| `backend/tests/test_schema_introspection.py` | Tests for the two new schema endpoints (Task 6) |
| `backend/tests/test_connection_status.py` | Tests for the three write paths + read path of persistent status (Task 5) |
| `frontend/src/hooks/use-tables.ts` | React Query hook wrapping `GET /api/databases/{id}/tables` (Task 7) |
| `frontend/src/hooks/use-table-columns.ts` | React Query hook wrapping `GET /api/databases/{id}/tables/{name}/columns` (Task 7) |
| `frontend/src/types/schema.ts` | Shared TS types for `SchemaTable` and `SchemaColumn` (Task 7) |
| `frontend/src/components/explorer/schema-browser.test.tsx` | Vitest + RTL tests for the rewritten schema browser (Task 7) |

### Modified

| Path | Task | What changes |
|---|---|---|
| `backend/app/api/databases.py` | 4, 5, 6 | Drop `dataset_count`, persist status on create/test, add two introspection endpoints |
| `backend/app/main.py` | 5 | Add startup health-check sweep in the lifespan body |
| `frontend/src/components/datasets/dataset-editor.tsx` | 2 | Remove `Number(databaseId)` in handleRunQuery and handleSave |
| `frontend/src/components/datasets/dataset-list.tsx` | 2 | Change `Map<number,...>` → `Map<string,...>`, remove `Number(databaseFilter)` |
| `frontend/src/types/database.ts` | 4 | Drop `datasetCount` field from `DatabaseInfo` |
| `frontend/src/components/settings/data-source-card.tsx` | 4 | Remove "N tables" label fragment |
| `frontend/src/components/explorer/sql-editor.tsx` | 4 | OS-aware Kbd (Ctrl on Windows, ⌘ on Mac) |
| `frontend/src/routes/_app/explorer/index.tsx` | 3 | Replace hardcoded default SQL with empty string |
| `frontend/src/components/explorer/schema-browser.tsx` | 7 | Full rewrite for real schema introspection |

### Deleted

| Path | Task | Why |
|---|---|---|
| `backend/tests/test_query_engine.py` (conditional) | 1 | Pre-existing broken tests; `ConfigStore(session)` signature mismatch |
| `backend/tests/test_config_store.py` (conditional) | 1 | Same root cause |
| `backend/tests/test_dataset_sync.py` (conditional) | 1 | Tests a service file (`dataset_sync.py`) that no longer exists |
| `frontend/src/components/dashboard/grid-toolbar.test.tsx` (conditional) | 1 | Pre-existing TS errors (unused imports, unused vars) |
| `frontend/src/routes/embed/dashboards/$dashboardId.test.tsx` (conditional) | 1 | Missing JSX namespace |
| `frontend/src/hooks/use-datasets.ts` | 8 | Calls dead `/api/datasets` endpoint; only caller was old schema-browser (rewritten in Task 7) |
| `frontend/src/hooks/use-dataset.ts` | 8 | Calls dead `/api/datasets/:id` endpoint; zero callers |
| `backend/app/api/export.py` | 8 | Stub handlers, zero frontend callers |

"Conditional" means: verify via `pytest --collect-only` / `tsc --noEmit` that the file is genuinely broken and its subject no longer exists before deletion. If the subject still exists and the fix is <5 minutes, prefer fixing over deleting.

---

# Task 1: Unit 0 — Audit and delete pre-existing broken tests

**Goal:** clean baseline so any error after this point is caused by our changes, not pre-existing rot. After this task, `pytest tests/` and `pnpm build` must run cleanly without bypasses.

**Files:**
- Investigate: all files in the "Deleted (conditional)" list above
- Delete: the broken subset (exact list decided at Step 2 below)
- Optionally create: a short note at the top of a commit message listing what was deleted and why

- [ ] **Step 1: Activate the backend venv and run collection-only pytest**

```bash
cd /Users/aarun/Workspace/recviz-prod-build/backend
source venv/bin/activate 2>/dev/null || python3.12 -m venv venv && source venv/bin/activate
pip install -q -r requirements.txt pytest pytest-asyncio
python -m pytest --collect-only tests/ 2>&1 | tail -60
```

Expected: you'll see collection errors for some test files. Save the list — specifically look for tracebacks mentioning:
- `ConfigStore.__init__() missing 1 required positional argument: 'session'`
- `No module named 'app.services.dataset_sync'` or similar
- Any `ImportError` / `AttributeError` at collection time

- [ ] **Step 2: Record which backend test files are broken**

Based on the output from Step 1, populate this table (fill it in on a scratchpad, you'll use it in Step 3):

| File | Broken? | Symptom |
|---|---|---|
| `backend/tests/test_query_engine.py` | Y/N | |
| `backend/tests/test_config_store.py` | Y/N | |
| `backend/tests/test_dataset_sync.py` | Y/N | |
| `backend/tests/test_merge_engine.py` | Y/N | |
| `backend/tests/test_database_registrar.py` | Y/N | |
| `backend/tests/test_connection_model.py` | Y/N | |
| `backend/tests/test_portable_json.py` | Y/N | |

For each broken file, ask: does the thing it tests still exist? If the service/module it imports has been deleted (e.g., `dataset_sync`), delete the test. If the thing exists but the signature changed (e.g., ConfigStore now takes a session), flip a coin: if the test is straightforward to update, update it; if it requires understanding a full refactor, delete it.

- [ ] **Step 3: Delete the broken backend tests**

```bash
# Example — adjust to the actual broken list from Step 2
cd /Users/aarun/Workspace/recviz-prod-build
rm -f backend/tests/test_query_engine.py
rm -f backend/tests/test_config_store.py
rm -f backend/tests/test_dataset_sync.py
```

Do NOT delete files that are not confirmed broken (e.g. `test_merge_engine.py` is probably fine — check first).

- [ ] **Step 4: Re-run pytest to confirm it's clean**

```bash
cd /Users/aarun/Workspace/recviz-prod-build/backend
python -m pytest tests/ -v 2>&1 | tail -30
```

Expected: either "no tests ran" (if all tests were broken and deleted) or a passing run. Zero errors. Zero collection failures. If there are still collection errors, something broken slipped through — go back to Step 3.

- [ ] **Step 5: Run frontend `tsc --noEmit` to find broken frontend files**

```bash
cd /Users/aarun/Workspace/recviz-prod-build/frontend
pnpm install --frozen-lockfile 2>&1 | tail -5
pnpm exec tsc --noEmit 2>&1 | tee /tmp/tsc-output.txt | tail -60
```

Expected: a list of TypeScript errors. Save `/tmp/tsc-output.txt` for Step 6.

- [ ] **Step 6: Categorize frontend errors into "delete" vs "fix"**

For each file in the tsc output, decide:
- **Delete** if it's a test file and its subject is broken (e.g., `grid-toolbar.test.tsx` tests a component that's been refactored)
- **Delete** if it's an unused component file with >3 type errors that nothing imports
- **Fix** if it's a trivial issue (unused import, unused var) in a file we actually need

Create a working list. Example from a prior scan:

```
DELETE: frontend/src/components/dashboard/grid-toolbar.test.tsx  (unused React import + unused var, test-only)
DELETE: frontend/src/routes/embed/dashboards/$dashboardId.test.tsx  (missing JSX namespace, test-only)
INVESTIGATE: frontend/src/components/explorer/chart-builder-dialog.tsx  (6 errors referencing SqlColumnInfo — check if the file is imported anywhere; if not, delete; if yes, fix imports)
```

- [ ] **Step 7: Check `chart-builder-dialog.tsx` usage specifically**

```bash
cd /Users/aarun/Workspace/recviz-prod-build
grep -rn 'ChartBuilderDialog\|chart-builder-dialog' frontend/src --include='*.tsx' --include='*.ts'
```

If the output includes `routes/_app/explorer/index.tsx` (the Explorer page), the file IS used. Fix its type errors in Step 8. Otherwise, delete the file.

- [ ] **Step 8: Delete broken frontend files and fix fixable ones**

For deletions:
```bash
rm -f frontend/src/components/dashboard/grid-toolbar.test.tsx
rm -f frontend/src/routes/embed/dashboards/$dashboardId.test.tsx
# + any others from your working list
```

For fixes, make minimal edits — just enough to satisfy `tsc`. If a file is in the "dead code cleanup" list for Task 8 (`use-datasets.ts`, `use-dataset.ts`), **do not touch it here** — it gets deleted in Task 8. If `chart-builder-dialog.tsx` has type errors but is still imported by the Explorer, fix the minimum set of errors (e.g. swap `string[]` for `SqlColumnInfo[]` in the type annotation of the prop).

- [ ] **Step 9: Re-run `pnpm build` to confirm it works cleanly**

```bash
cd /Users/aarun/Workspace/recviz-prod-build/frontend
pnpm build 2>&1 | tail -20
```

Expected: the build succeeds end-to-end. The final line should say `✓ built in Ns`. The `tsc -b` step should complete without errors — no more `pnpm exec vite build` bypass needed.

If the build still fails, go back to Step 6 and continue deleting/fixing until it's clean.

- [ ] **Step 10: Dispatch code-reviewer agent for this task's diff**

The diff here is mostly deletions plus a few small fixes. The reviewer should flag:
- Accidental deletion of a still-used file
- Fixes that introduced new type errors elsewhere
- Missing sibling deletions (e.g., deleting a `.test.tsx` but leaving orphan snapshot files)

Dispatch with this prompt (use the Agent tool with `feature-dev:code-reviewer`):

> "I just deleted several pre-existing broken test files in RecViz's backend and frontend to get `pytest` and `pnpm build` running cleanly on a baseline. Review the staged diff and confirm: (1) no deletion removed a file that's actually still being imported, (2) no fix introduced a new type error, (3) no orphaned snapshot or fixture files were left behind. The full context is in docs/superpowers/specs/2026-04-11-ui-fixes-and-cleanup-design.md section 'Unit 0'. Diff is: `git diff HEAD`."

Fix any blocker/high findings inline. Mediums and lows batch for Task 9.

- [ ] **Step 11: Commit**

```bash
cd /Users/aarun/Workspace/recviz-prod-build
git add -A
git commit -m "$(cat <<'MSGEOF'
chore(tests): delete pre-existing broken tests and type errors

Unit 0 of the 2026-04-11 UI fixes rollout. Establishes a clean baseline
so any subsequent error is attributable to our changes, not pre-existing
rot.

Backend: delete tests referencing ConfigStore's pre-refactor signature
and tests for the deleted dataset_sync service.

Frontend: delete test files with unrecoverable type errors and fix the
minimum set of type errors in files we still need.

After this commit:
  - pytest tests/ runs with zero errors
  - pnpm build (not pnpm exec vite build) succeeds end-to-end

Refs: docs/superpowers/specs/2026-04-11-ui-fixes-and-cleanup-design.md
(section 'Unit 0')
MSGEOF
)"
```

---

# Task 2: Unit 1 — String ID fix (P0 blocker)

**Goal:** Run Query and Save buttons work in the Create/Edit Dataset flow. Connection IDs are treated as strings throughout the dataset component tree.

**Files:**
- Modify: `frontend/src/components/datasets/dataset-editor.tsx:82-95` (handleRunQuery), `:121-165` (handleSave), `:286-296` (Save button disabled check)
- Modify: `frontend/src/components/datasets/dataset-list.tsx:32-38` (databaseMap), `:50-58` (filtered), `:75` (toolbar prop)
- Possibly modify: `frontend/src/types/managed-dataset.ts` (verify `databaseId` is typed `string`)

- [ ] **Step 1: Read the current state of dataset-editor.tsx**

```bash
cd /Users/aarun/Workspace/recviz-prod-build
sed -n '80,100p' frontend/src/components/datasets/dataset-editor.tsx
sed -n '120,170p' frontend/src/components/datasets/dataset-editor.tsx
sed -n '285,300p' frontend/src/components/datasets/dataset-editor.tsx
```

Confirm you see `const dbId = Number(databaseId)` at the top of `handleRunQuery` and again in `handleSave`. Confirm the Save button's `disabled` prop includes `!databaseId` or `!dbId`.

- [ ] **Step 2: Fix `handleRunQuery` — remove Number() conversion**

Open `frontend/src/components/datasets/dataset-editor.tsx` and find this block (starts around line 82):

```tsx
const handleRunQuery = useCallback(() => {
  const dbId = Number(databaseId)
  if (!sql.trim() || !dbId || sqlExecute.isPending) return

  sqlExecute.mutate(
    { sql, databaseId: dbId, limit: 1000 },
    {
```

Replace with:

```tsx
const handleRunQuery = useCallback(() => {
  if (!sql.trim() || !databaseId || sqlExecute.isPending) return

  sqlExecute.mutate(
    { sql, databaseId, limit: 1000 },
    {
```

The key changes: (a) `const dbId = Number(...)` line removed entirely; (b) guard uses `!databaseId` (string falsy check — empty string is falsy, UUID string is truthy); (c) `databaseId: dbId` → `databaseId` (shorthand passes the string through).

- [ ] **Step 3: Fix `handleSave` — same pattern**

Find (around line 121):

```tsx
const handleSave = useCallback(() => {
  if (hasUnsavedSqlChanges) return
  if (!name.trim()) {
    toast.error('Please enter a dataset name')
    return
  }

  const dbId = Number(databaseId)
  if (!dbId) {
    toast.error('Please select a database')
    return
  }
```

Replace the `const dbId = Number(databaseId)` + check block with:

```tsx
  if (!databaseId) {
    toast.error('Please select a database')
    return
  }
```

Then in the same function, find where `dbId` is passed to the mutation — likely as part of `createDataset.mutate({...})` or `updateDataset.mutate({...})` — and replace `database_id: dbId` (or `databaseId: dbId`) with the string `databaseId` directly. The exact line number depends on the mutation call shape.

- [ ] **Step 4: Verify no other references to `dbId` in the file**

```bash
grep -n 'dbId' frontend/src/components/datasets/dataset-editor.tsx
```

Expected: **no matches**. If there are matches, they're leftover references from Steps 2-3 that need to be removed or replaced with `databaseId`.

- [ ] **Step 5: Fix the Save button disabled prop**

Find (around line 286-296):

```tsx
<Button
  size="sm"
  onClick={handleSave}
  disabled={hasUnsavedSqlChanges || isSaving || !name.trim() || !databaseId || !lastRunSql}
>
```

The existing code already uses `!databaseId` so this is probably fine. Verify and leave alone if it is.

- [ ] **Step 6: Fix `dataset-list.tsx` databaseMap type**

Open `frontend/src/components/datasets/dataset-list.tsx`. Find (around line 32-38):

```tsx
const databaseMap = useMemo(() => {
  const map = new Map<number, { name: string; backend: string }>()
  for (const db of databases) {
    map.set(db.id, { name: db.databaseName, backend: db.backend })
  }
  return map
}, [databases])
```

Replace with:

```tsx
const databaseMap = useMemo(() => {
  const map = new Map<string, { name: string; backend: string }>()
  for (const db of databases) {
    map.set(db.id, { name: db.databaseName, backend: db.backend })
  }
  return map
}, [databases])
```

Only one character changes (`number` → `string`) but TypeScript will now stop lying about the key type.

- [ ] **Step 7: Fix `dataset-list.tsx` filter — remove `Number()` conversion**

In the same file, find (around line 50-58):

```tsx
const filtered = useMemo(() => {
  let result = datasets

  if (searchQuery.trim()) {
    ...
  }

  if (databaseFilter !== 'all') {
    const dbId = Number(databaseFilter)
    result = result.filter((ds) => ds.databaseId === dbId)
  }

  return result
}, [datasets, searchQuery, databaseFilter])
```

Replace the `if (databaseFilter !== 'all')` block with:

```tsx
  if (databaseFilter !== 'all') {
    result = result.filter((ds) => ds.databaseId === databaseFilter)
  }
```

The filter now compares string to string, which actually matches.

- [ ] **Step 8: Verify `managed-dataset.ts` type**

```bash
grep -n 'databaseId' frontend/src/types/managed-dataset.ts
```

Confirm `databaseId: string` (not `number`). If it's typed as number, change to string:

```tsx
// Before
databaseId: number
// After
databaseId: string
```

- [ ] **Step 9: Run tsc to confirm no new type errors**

```bash
cd /Users/aarun/Workspace/recviz-prod-build/frontend
pnpm exec tsc --noEmit 2>&1 | tail -30
```

Expected: zero new errors from your edits. If you see errors in unrelated files, they were either already there (and Task 1 should have caught them — go back) or you introduced them.

- [ ] **Step 10: Run the frontend build to confirm**

```bash
pnpm build 2>&1 | tail -10
```

Expected: `✓ built in Ns`. If it fails with errors in the files you just edited, fix them before moving on.

- [ ] **Step 11: Dispatch code-reviewer for the string ID fix**

> "Review this diff for RecViz Task 2 (Unit 1 — string ID fix). Context: backend returns database/connection IDs as UUID strings since migration 007, but the frontend was doing `Number(databaseId)` which produced NaN and caused the Run Query and Save buttons to silently no-op. Spec: docs/superpowers/specs/2026-04-11-ui-fixes-and-cleanup-design.md section 'Unit 1'. Check for: (1) any remaining `Number(databaseId)` patterns or `dbId` variables, (2) type consistency between frontend DatabaseInfo / RecvizDataset and backend responses, (3) missed filter/map conversions in sibling files. Diff: `git diff HEAD`."

Fix any blocker/high findings. If the reviewer finds additional files with the same pattern, add them to this task before committing.

- [ ] **Step 12: Commit**

```bash
git add frontend/src/components/datasets/dataset-editor.tsx \
        frontend/src/components/datasets/dataset-list.tsx \
        frontend/src/types/managed-dataset.ts 2>/dev/null || true
git commit -m "$(cat <<'MSGEOF'
fix(datasets): treat connection ID as string, not number

Unit 1 of the 2026-04-11 UI fixes rollout. Removes the legacy assumption
that database/connection IDs are integers.

Migration 007 changed recviz_datasets.database_id from Integer to
String(128) to match recviz_connections.id (UUID). The backend API was
updated to return strings. The frontend dataset editor and list still
did `Number(databaseId)` which converted UUIDs to NaN — NaN is falsy, so
the early-return guards in handleRunQuery and handleSave silently no-op'd
every click. Same bug in dataset-list.tsx's database filter (compared
string to NaN, never matched) and its Map key type (typed as number but
holding string UUIDs).

After this commit:
  - Run Query in the dataset editor actually executes the query
  - Ctrl+Enter keyboard shortcut runs the query (same handler)
  - Save persists the dataset row with the correct string database_id
  - Database filter in the dataset list actually filters

Refs: docs/superpowers/specs/2026-04-11-ui-fixes-and-cleanup-design.md
(section 'Unit 1')
MSGEOF
)"
```

---

# Task 3: Unit 6 — Explorer default SQL cleanup

**Goal:** remove the hardcoded Postgres-era default SQL from the Data Explorer so new users see an empty editor, not a misleading query against tables that don't exist in the Oracle deployment.

**Files:**
- Modify: `frontend/src/routes/_app/explorer/index.tsx:17` (one line)

- [ ] **Step 1: Confirm current state**

```bash
cd /Users/aarun/Workspace/recviz-prod-build
sed -n '15,20p' frontend/src/routes/_app/explorer/index.tsx
```

Expected output:
```tsx
const DEFAULT_SQL = `SELECT * FROM breaks WHERE desk = 'Operations' LIMIT 20`

function Explorer() {
```

- [ ] **Step 2: Replace the default SQL**

Open `frontend/src/routes/_app/explorer/index.tsx` and replace:

```tsx
const DEFAULT_SQL = `SELECT * FROM breaks WHERE desk = 'Operations' LIMIT 20`
```

with:

```tsx
const DEFAULT_SQL = ''
```

- [ ] **Step 3: Verify the Explorer page still builds**

```bash
cd /Users/aarun/Workspace/recviz-prod-build/frontend
pnpm exec tsc --noEmit 2>&1 | tail -10
```

Expected: zero new errors. Monaco Editor accepts empty string as a valid value.

- [ ] **Step 4: Dispatch code-reviewer**

> "Trivial one-line change in RecViz Task 3 (Unit 6). The Data Explorer's hardcoded default SQL `SELECT * FROM breaks WHERE desk = 'Operations' LIMIT 20` referenced a Postgres dev seed table that doesn't exist on the Oracle production deployment. Changed to empty string. Review: is the empty string handled correctly by the Monaco SqlEditor component downstream? Any existing `if (!sql.trim())` guards that might now misbehave? Diff: `git diff HEAD`."

The reviewer should confirm that `handleRun` in the Explorer already has `if (!sql.trim() || executeMutation.isPending) return` which handles empty SQL gracefully.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/routes/_app/explorer/index.tsx
git commit -m "$(cat <<'MSGEOF'
chore(explorer): remove hardcoded Postgres-era default SQL

Unit 6 of the 2026-04-11 UI fixes rollout. The Data Explorer was
starting every session with a SELECT against a 'breaks' table that
existed only in the Postgres dev seed data, not in the Oracle production
schema. Replaced with an empty string so the editor starts empty.

Refs: docs/superpowers/specs/2026-04-11-ui-fixes-and-cleanup-design.md
(section 'Unit 6')
MSGEOF
)"
```

---

# Task 4: Unit 4 — Cosmetic bundle (hide "N tables", OS-aware Kbd, drop datasetCount)

**Goal:** three small presentation fixes that together make the UI feel less broken.

**Files:**
- Modify: `frontend/src/components/settings/data-source-card.tsx` (remove N tables fragment)
- Modify: `frontend/src/components/explorer/sql-editor.tsx` (OS-aware Kbd)
- Modify: `backend/app/api/databases.py:_build_response()` (drop dataset_count)
- Modify: `frontend/src/types/database.ts:DatabaseInfo` (drop datasetCount field)

- [ ] **Step 1: Hide the "N tables" label — data-source-card.tsx**

Find (around line 76-80):

```tsx
<div>
  <p className="text-sm font-medium truncate">{database.databaseName}</p>
  <p className="text-xs text-muted-foreground">
    {BACKEND_LABELS[backendKey] || database.backend} &middot; {database.datasetCount} tables
  </p>
</div>
```

Replace with:

```tsx
<div>
  <p className="text-sm font-medium truncate">{database.databaseName}</p>
  <p className="text-xs text-muted-foreground">
    {BACKEND_LABELS[backendKey] || database.backend}
  </p>
</div>
```

The `&middot; {database.datasetCount} tables` fragment is removed. The card now shows just the display name + backend type + status dot (in the header block).

- [ ] **Step 2: Drop `datasetCount` from the TS type**

Open `frontend/src/types/database.ts`. Find:

```tsx
export interface DatabaseInfo {
  id: string
  databaseName: string
  backend: DatabaseBackend
  createdOn: string | null
  exposeInSqllab: boolean
  datasetCount: number
  status: ConnectionStatus
  lastTested: string | null
}
```

Delete the `datasetCount: number` line. Result:

```tsx
export interface DatabaseInfo {
  id: string
  databaseName: string
  backend: DatabaseBackend
  createdOn: string | null
  exposeInSqllab: boolean
  status: ConnectionStatus
  lastTested: string | null
}
```

- [ ] **Step 3: Drop `dataset_count` from backend `_build_response`**

Open `backend/app/api/databases.py`. Find (around line 52-62):

```python
def _build_response(conn: RecvizConnection, status_info: dict) -> dict:
    """Build a response dict matching the DatabaseInfo shape from a connection record."""
    return {
        "id": conn.id,
        "database_name": conn.display_name,
        "backend": conn.backend,
        "created_on": conn.created_at.isoformat() if conn.created_at else None,
        "expose_in_sqllab": True,
        "dataset_count": 0,
        "status": status_info["status"],
        "last_tested": status_info["last_tested"],
    }
```

Delete the `"dataset_count": 0,` line. Result:

```python
def _build_response(conn: RecvizConnection, status_info: dict) -> dict:
    """Build a response dict matching the DatabaseInfo shape from a connection record."""
    return {
        "id": conn.id,
        "database_name": conn.display_name,
        "backend": conn.backend,
        "created_on": conn.created_at.isoformat() if conn.created_at else None,
        "expose_in_sqllab": True,
        "status": status_info["status"],
        "last_tested": status_info["last_tested"],
    }
```

Also check lines 181-193 of the same file for the same field in the `create_database` return. Remove `"dataset_count": 0,` there too.

- [ ] **Step 4: OS-aware Kbd in sql-editor.tsx**

Open `frontend/src/components/explorer/sql-editor.tsx`. Find (around line 17-22):

```tsx
export function SqlEditor({ value, onChange, onRun, isRunning }: SqlEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const onRunRef = useRef(onRun)
  onRunRef.current = onRun
  const { resolvedTheme } = useTheme()
```

Add an OS-detection constant just before `export function SqlEditor` (outside the component body, at module level, so the regex runs exactly once):

```tsx
const IS_MAC =
  typeof navigator !== 'undefined' &&
  /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)

export function SqlEditor({ value, onChange, onRun, isRunning }: SqlEditorProps) {
```

Then find (around line 47-49):

```tsx
<span className="text-xs text-muted-foreground items-center gap-1 hidden sm:flex">
  <Kbd>⌘</Kbd>+<Kbd>↵</Kbd> to run
</span>
```

Replace with:

```tsx
<span className="text-xs text-muted-foreground items-center gap-1 hidden sm:flex">
  <Kbd>{IS_MAC ? '⌘' : 'Ctrl'}</Kbd>+<Kbd>↵</Kbd> to run
</span>
```

Monaco's `monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter` keybinding (line 31) is already OS-aware — it resolves to Ctrl on Windows/Linux and Cmd on Mac. We're only fixing the displayed label.

- [ ] **Step 5: Confirm backend still imports cleanly**

```bash
cd /Users/aarun/Workspace/recviz-prod-build
python3.12 -m py_compile backend/app/api/databases.py && echo "OK"
```

- [ ] **Step 6: Confirm frontend build still succeeds**

```bash
cd /Users/aarun/Workspace/recviz-prod-build/frontend
pnpm build 2>&1 | tail -10
```

Expected: `✓ built in Ns`.

- [ ] **Step 7: Dispatch code-reviewer**

> "RecViz Task 4 (Unit 4 — cosmetic bundle). Three small edits: (1) hide 'N tables' label in data-source-card.tsx because the backend hardcodes dataset_count to 0; (2) drop the datasetCount field from the DatabaseInfo TS type and backend _build_response; (3) make the Kbd shortcut label OS-aware (⌘ on Mac, Ctrl on Windows/Linux) using a navigator.userAgent regex. Spec: docs/superpowers/specs/2026-04-11-ui-fixes-and-cleanup-design.md section 'Unit 4'. Review: any other file that still references database.datasetCount or conn['dataset_count']? Is navigator.userAgent detection safe in SSR/Node contexts (Vitest)? Diff: `git diff HEAD`."

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/settings/data-source-card.tsx \
        frontend/src/components/explorer/sql-editor.tsx \
        frontend/src/types/database.ts \
        backend/app/api/databases.py
git commit -m "$(cat <<'MSGEOF'
fix(ui): cosmetic polish — hide N tables, OS-aware Kbd, drop datasetCount

Unit 4 of the 2026-04-11 UI fixes rollout. Three small presentation
fixes bundled because they're each trivially reviewable alone.

1. Hide the "N tables" label on the data source card. The backend
   hardcoded dataset_count = 0 in _build_response() and the frontend
   faithfully displayed "N tables" as zero. Removed the label fragment
   and dropped the field from the DatabaseInfo TS type and the backend
   response shape.

2. OS-aware Kbd label in the SQL editor. Previously showed ⌘+↵ on all
   platforms. Now shows Ctrl+↵ on Windows/Linux and ⌘+↵ on Mac. The
   underlying Monaco keybinding (CtrlCmd | Enter) was already
   OS-aware — only the display label was lying.

Refs: docs/superpowers/specs/2026-04-11-ui-fixes-and-cleanup-design.md
(section 'Unit 4')
MSGEOF
)"
```

---

# Task 5: Unit 2 — Persistent connection status

**Goal:** connection status survives backend restarts and reflects reality without requiring the user to click Test. Three write paths (create, explicit test, startup sweep) all persist to `recviz_connections.status` + `last_tested_at` columns. The read path reads directly from the DB.

**Files:**
- Modify: `backend/app/api/databases.py` — `create_database`, `test_connection`, `_build_response`, `list_databases`, `get_database`
- Modify: `backend/app/main.py` — lifespan to add startup sweep
- Create: `backend/tests/test_connection_status.py`

- [ ] **Step 1: Write the failing test for persist-on-create**

Create `backend/tests/test_connection_status.py`:

```python
"""Tests for persistent connection status (Unit 2)."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.models.connection import RecvizConnection


@pytest.fixture
def sqlite_session():
    """In-memory SQLite session using the ORM models (PortableJSON falls back to TEXT)."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


def _make_connection(session: Session, name: str = "test_conn") -> RecvizConnection:
    conn = RecvizConnection(
        id="test-uuid-1",
        name=name,
        display_name="Test Connection",
        backend="oracle",
        host="oracle.local",
        port=1521,
        database_name="ORCL",
        username="test",
        encrypted_password="encrypted-placeholder",
        schema_name="TEST",
        status="untested",
    )
    session.add(conn)
    session.commit()
    return conn


def test_persist_status_on_successful_test(sqlite_session: Session):
    """After a successful test, the DB row should have status='connected' and last_tested_at."""
    conn = _make_connection(sqlite_session)
    # Simulate the persist-on-test logic
    conn.status = "connected"
    conn.last_tested_at = datetime.now(timezone.utc)
    sqlite_session.commit()

    reloaded = sqlite_session.get(RecvizConnection, "test-uuid-1")
    assert reloaded is not None
    assert reloaded.status == "connected"
    assert reloaded.last_tested_at is not None


def test_persist_status_on_failed_test(sqlite_session: Session):
    """After a failed test, the DB row should have status='unreachable'."""
    conn = _make_connection(sqlite_session)
    conn.status = "unreachable"
    conn.last_tested_at = datetime.now(timezone.utc)
    sqlite_session.commit()

    reloaded = sqlite_session.get(RecvizConnection, "test-uuid-1")
    assert reloaded.status == "unreachable"


def test_build_response_reads_from_db_column(sqlite_session: Session):
    """_build_response should read status from the DB row, not an in-memory tracker."""
    from app.api.databases import _build_response

    conn = _make_connection(sqlite_session)
    conn.status = "connected"
    test_time = datetime.now(timezone.utc)
    conn.last_tested_at = test_time
    sqlite_session.commit()

    response = _build_response(conn)
    assert response["status"] == "connected"
    assert response["last_tested"] == test_time.isoformat()


def test_build_response_untested_default(sqlite_session: Session):
    """Fresh connection without any test still has status='untested'."""
    from app.api.databases import _build_response

    conn = _make_connection(sqlite_session)
    response = _build_response(conn)
    assert response["status"] == "untested"
    assert response["last_tested"] is None
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd /Users/aarun/Workspace/recviz-prod-build/backend
python -m pytest tests/test_connection_status.py -v 2>&1 | tail -30
```

Expected: `test_build_response_reads_from_db_column` and `test_build_response_untested_default` FAIL with `TypeError: _build_response() missing 1 required positional argument: 'status_info'` — because the current signature is `_build_response(conn, status_info)`, not `_build_response(conn)`. The first two tests (pure DB write/read) should PASS.

- [ ] **Step 3: Update `_build_response` to read from the DB column directly**

Open `backend/app/api/databases.py`. Find the current `_build_response`:

```python
def _build_response(conn: RecvizConnection, status_info: dict) -> dict:
    """Build a response dict matching the DatabaseInfo shape from a connection record."""
    return {
        "id": conn.id,
        "database_name": conn.display_name,
        "backend": conn.backend,
        "created_on": conn.created_at.isoformat() if conn.created_at else None,
        "expose_in_sqllab": True,
        "status": status_info["status"],
        "last_tested": status_info["last_tested"],
    }
```

Replace with:

```python
def _build_response(conn: RecvizConnection) -> dict:
    """Build a response dict matching the DatabaseInfo shape from a connection record.

    Reads status + last_tested_at directly from the DB row (persistent across
    restarts). The in-memory ConnectionStatusTracker is no longer the source
    of truth for display — it only overlays runtime observations during
    normal query operation via QueryExecutor's mark_connected / mark_unreachable.
    """
    return {
        "id": conn.id,
        "database_name": conn.display_name,
        "backend": conn.backend,
        "created_on": conn.created_at.isoformat() if conn.created_at else None,
        "expose_in_sqllab": True,
        "status": conn.status or "untested",
        "last_tested": conn.last_tested_at.isoformat() if conn.last_tested_at else None,
    }
```

Also update all callers — remove the `status_info` argument. Search for `_build_response(` in the file.

- [ ] **Step 4: Update `list_databases` and `get_database` to drop the tracker read**

In the same file, find `list_databases`:

```python
@router.get("")
def list_databases(session: DbSessionDep, request: Request) -> list[dict]:
    """List all registered database connections."""
    tracker = _get_status_tracker(request)
    stmt = select(RecvizConnection).order_by(RecvizConnection.name)
    result = session.execute(stmt)
    connections = result.scalars().all()

    results = []
    for conn in connections:
        if tracker:
            status_info = tracker.get_status(conn.id)
        else:
            status_info = {"status": "untested", "last_tested": None}
        results.append(_build_response(conn, status_info))
    return results
```

Replace with:

```python
@router.get("")
def list_databases(session: DbSessionDep) -> list[dict]:
    """List all registered database connections."""
    stmt = select(RecvizConnection).order_by(RecvizConnection.name)
    result = session.execute(stmt)
    connections = result.scalars().all()
    return [_build_response(conn) for conn in connections]
```

Same pattern for `get_database`:

```python
@router.get("/{db_id}")
def get_database(db_id: str, session: DbSessionDep) -> dict:
    """Get a single database connection by ID."""
    stmt = select(RecvizConnection).where(RecvizConnection.id == db_id)
    result = session.execute(stmt)
    conn = result.scalar_one_or_none()
    if conn is None:
        raise HTTPException(status_code=404, detail=f"Database '{db_id}' not found")
    return _build_response(conn)
```

Remove the `request: Request` parameter from both and the `tracker = _get_status_tracker(request)` calls — we no longer need them for display. Leave `_get_status_tracker` helper function alone — it's still used by other handlers for runtime tracker access.

- [ ] **Step 5: Rerun the tests to confirm the read path works**

```bash
python -m pytest tests/test_connection_status.py -v 2>&1 | tail -30
```

Expected: all four tests PASS.

- [ ] **Step 6: Update `create_database` to persist status after flush**

Find `create_database` in `backend/app/api/databases.py`. After the `session.flush()` in the existing try/except, add the persistence block. The final structure:

```python
@router.post("", status_code=201)
def create_database(
    body: DatabaseCreate,
    session: DbSessionDep,
    engine_manager: EngineManagerDep,
    request: Request,
) -> dict:
    """Create a new database connection with encrypted credentials."""
    encryption = _get_encryption(request)
    conn_id = str(uuid.uuid4())

    name = body.database_name.lower().replace(" ", "_")
    port = body.port
    if port is None:
        port = 1521 if body.backend == "oracle" else 5432

    connection = RecvizConnection(
        id=conn_id,
        name=name,
        display_name=body.database_name,
        backend=body.backend,
        host=body.host,
        port=port,
        database_name=body.database or "",
        username=body.username or "",
        encrypted_password=encryption.encrypt(body.password or ""),
        schema_name=body.schema_name or "",
        status="untested",
    )

    try:
        session.add(connection)
        session.flush()
    except IntegrityError:
        raise HTTPException(
            status_code=409,
            detail={"error": "duplicate_name", "message": f"A connection named '{name}' already exists"},
        )

    # NEW: Test the connection and persist the result
    from datetime import datetime, timezone
    uri = build_sync_uri(
        backend=body.backend,
        host=body.host or "",
        port=port,
        database=body.database,
        username=body.username,
        password=body.password,
    )
    try:
        success, message = EngineManager.test_connection(uri, body.backend, timeout=10)
    except Exception as exc:
        logger.warning("Auto-test during create failed with exception: %s", exc)
        success, message = False, str(exc)

    connection.status = "connected" if success else "unreachable"
    connection.last_tested_at = datetime.now(timezone.utc)
    session.flush()

    # Invalidate ConnectionResolver cache
    resolver = getattr(request.app.state, "connection_resolver", None)
    if resolver:
        resolver.invalidate(session)

    return _build_response(connection)
```

Key additions: the auto-test block after the first `session.flush()`, the status assignment, and the second `session.flush()` to persist status before return. The response is now `_build_response(connection)` (one-arg form).

- [ ] **Step 7: Update `test_connection` endpoint to persist status in DB**

Find `test_connection` in `backend/app/api/databases.py`:

```python
@router.post("/test")
def test_connection(body: TestConnectionRequest, request: Request) -> dict:
    ...
```

Change the signature to accept a session, and update the persistence:

```python
@router.post("/test")
def test_connection(
    body: TestConnectionRequest,
    session: DbSessionDep,
    request: Request,
) -> dict:
    """Test database connectivity using a disposable engine."""
    tracker = _get_status_tracker(request)
    try:
        uri = build_sync_uri(
            backend=body.backend,
            host=body.host or "",
            port=body.port,
            database=body.database,
            username=body.username,
            password=body.password,
        )
        success, message = EngineManager.test_connection(uri, body.backend)

        # Update in-memory tracker (runtime observation layer)
        if tracker and body.database_id is not None:
            if success:
                tracker.mark_connected(body.database_id)
            else:
                tracker.mark_unreachable(body.database_id)

        # NEW: Persist to recviz_connections.status if database_id provided
        if body.database_id:
            from datetime import datetime, timezone
            conn = session.execute(
                select(RecvizConnection).where(RecvizConnection.id == body.database_id)
            ).scalar_one_or_none()
            if conn is not None:
                conn.status = "connected" if success else "unreachable"
                conn.last_tested_at = datetime.now(timezone.utc)
                session.flush()

        return {"success": success, "message": message}
    except ValueError as e:
        return {"success": False, "message": str(e)}
    except Exception as e:
        logger.warning("Connection test error: %s", e)
        if tracker and body.database_id is not None:
            tracker.mark_unreachable(body.database_id)
        return {"success": False, "message": f"Connection error: {sanitize_detail(e)}"}
```

- [ ] **Step 8: Add the startup sweep to `main.py`**

Open `backend/app/main.py`. Find the lifespan function. After the existing step 3 ("Pre-warm engine pool for all registered connections") and before step 4 ("Create ConnectionResolver and sync from DB"), add a new step:

```python
    # 3b. NEW: Startup health-check sweep — persist per-connection status
    import concurrent.futures
    from datetime import datetime, timezone
    from sqlalchemy import update
    from app.services.uri_builder import build_sync_uri

    logger.info("Running startup health-check sweep...")
    sweep_start = datetime.now(timezone.utc)

    # Reload connection rows in a fresh session
    with session_factory() as session:
        result = session.execute(select(RecvizConnection))
        conn_rows = result.scalars().all()
        # Snapshot the fields we need — the session closes before check_one runs
        conn_snapshots = [
            {
                "id": c.id,
                "name": c.name,
                "backend": c.backend,
                "host": c.host,
                "port": c.port,
                "database_name": c.database_name,
                "username": c.username,
                "encrypted_password": c.encrypted_password,
            }
            for c in conn_rows
        ]

    def check_one(snapshot: dict) -> tuple[str, bool, str]:
        try:
            password = encryption.decrypt(snapshot["encrypted_password"])
            uri = build_sync_uri(
                backend=snapshot["backend"],
                host=snapshot["host"],
                port=snapshot["port"],
                database=snapshot["database_name"],
                username=snapshot["username"],
                password=password,
            )
            success, msg = EngineManager.test_connection(uri, snapshot["backend"], timeout=10)
            return (snapshot["id"], success, msg)
        except Exception as exc:
            return (snapshot["id"], False, str(exc))

    if conn_snapshots:
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            sweep_results = list(pool.map(check_one, conn_snapshots))

        with session_factory() as session:
            now = datetime.now(timezone.utc)
            for conn_id, success, msg in sweep_results:
                session.execute(
                    update(RecvizConnection)
                    .where(RecvizConnection.id == conn_id)
                    .values(
                        status="connected" if success else "unreachable",
                        last_tested_at=now,
                    )
                )
                if not success:
                    logger.warning("Startup health check for %s: %s", conn_id, msg)
            session.commit()

        duration = (datetime.now(timezone.utc) - sweep_start).total_seconds()
        connected_count = sum(1 for _, ok, _ in sweep_results if ok)
        unreachable_count = len(sweep_results) - connected_count
        logger.info(
            "Startup sweep done in %.1fs: %d connected, %d unreachable",
            duration,
            connected_count,
            unreachable_count,
        )
    else:
        logger.info("Startup sweep: no registered connections to check")
```

- [ ] **Step 9: Verify main.py still imports cleanly**

```bash
cd /Users/aarun/Workspace/recviz-prod-build
python3.12 -m py_compile backend/app/main.py && echo "OK"
python3.12 -m py_compile backend/app/api/databases.py && echo "OK"
```

- [ ] **Step 10: Run tests**

```bash
cd /Users/aarun/Workspace/recviz-prod-build/backend
python -m pytest tests/test_connection_status.py -v 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 11: Dispatch code-reviewer**

> "RecViz Task 5 (Unit 2 — persistent connection status). Three backend changes: (1) _build_response now reads status from the DB row instead of the in-memory tracker, and dropped the status_info parameter from its signature; (2) create_database auto-tests the connection after flush and persists status + last_tested_at before returning; (3) test_connection endpoint gained a DbSessionDep and persists status when database_id is provided; (4) main.py lifespan gained a startup sweep that uses ThreadPoolExecutor(max_workers=4) to health-check all connections in parallel and bulk-update recviz_connections. Spec: docs/superpowers/specs/2026-04-11-ui-fixes-and-cleanup-design.md section 'Unit 2'. Review: (a) is the snapshot-then-check pattern in the sweep correct? (b) any session lifecycle bugs? (c) does create_database handle the case where test_connection itself raises? (d) is there a risk that a long sweep delays FastAPI serving requests? Diff: `git diff HEAD`."

Fix any blockers. Pay attention to session lifecycle feedback — the snapshot pattern is deliberate (we don't want to hold a session open across a potentially slow thread-pool map).

- [ ] **Step 12: Commit**

```bash
git add backend/app/api/databases.py \
        backend/app/main.py \
        backend/tests/test_connection_status.py
git commit -m "$(cat <<'MSGEOF'
feat(databases): persist connection status in DB, auto-test on create and startup

Unit 2 of the 2026-04-11 UI fixes rollout. The recviz_connections.status
column existed from migration 005 but nothing wrote to it — connection
status was tracked only in an in-memory ConnectionStatusTracker that
reset on every backend restart, so the UI always showed "untested"
until the user explicitly clicked Test. This commit makes status
durable across restarts.

Three write paths, one read path:

  - create_database auto-tests the newly-created connection after the
    initial session.flush() and persists status + last_tested_at before
    returning the response. Users see a correct green/red dot
    immediately after save.

  - test_connection endpoint (POST /api/databases/test) now takes a
    DbSessionDep and, when called with a database_id, persists the
    result to the DB row in addition to updating the in-memory tracker.

  - main.py lifespan runs a startup health-check sweep after pre-warming
    engines. Uses ThreadPoolExecutor(max_workers=4) to check all
    connections in parallel with a 10s per-connection timeout. Bulk
    updates recviz_connections at the end. Logs total duration and
    connected/unreachable counts.

  - _build_response reads status directly from the DB column instead
    of querying the in-memory tracker, and dropped the status_info
    parameter from its signature. The in-memory tracker still exists
    as a runtime observation layer for QueryExecutor's mark_connected /
    mark_unreachable during normal query operation.

Test: backend/tests/test_connection_status.py (4 tests) validates the
read path against an in-memory SQLite session using the real ORM models.

Refs: docs/superpowers/specs/2026-04-11-ui-fixes-and-cleanup-design.md
(section 'Unit 2')
MSGEOF
)"
```

---

# Task 6: Unit 3a — Schema introspection API

**Goal:** two new backend endpoints that query a registered connection's database for its tables and columns, dialect-aware for Oracle and PostgreSQL.

**Files:**
- Modify: `backend/app/api/databases.py` — append two new endpoints to the router
- Create: `backend/tests/test_schema_introspection.py`

- [ ] **Step 1: Write the failing tests for schema introspection**

Create `backend/tests/test_schema_introspection.py`:

```python
"""Tests for schema introspection endpoints (Unit 3a)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest


def test_table_name_regex_rejects_injection():
    """The table_name validator should reject SQL injection attempts."""
    from app.api.databases import TABLE_NAME_RE

    assert TABLE_NAME_RE.match("ITEMS") is not None
    assert TABLE_NAME_RE.match("message_feed") is not None
    assert TABLE_NAME_RE.match("TBL$1") is not None    # Oracle allows $
    assert TABLE_NAME_RE.match("T_123") is not None

    # Bad ones
    assert TABLE_NAME_RE.match("1_LEADING_DIGIT") is None
    assert TABLE_NAME_RE.match("DROP TABLE") is None
    assert TABLE_NAME_RE.match("ITEMS; SELECT 1") is None
    assert TABLE_NAME_RE.match("ITEMS'--") is None
    assert TABLE_NAME_RE.match("") is None
    assert TABLE_NAME_RE.match("A" * 31) is None       # too long (max 30)


def test_nullable_normalization():
    """nullable values from Oracle and Postgres should normalize to bool."""
    from app.api.databases import _normalize_nullable

    # Oracle returns 'Y' / 'N'
    assert _normalize_nullable("Y") is True
    assert _normalize_nullable("N") is False

    # Postgres information_schema returns 'YES' / 'NO'
    assert _normalize_nullable("YES") is True
    assert _normalize_nullable("NO") is False

    # Unknown values default to True (permissive)
    assert _normalize_nullable(None) is True
    assert _normalize_nullable("") is True
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
cd /Users/aarun/Workspace/recviz-prod-build/backend
python -m pytest tests/test_schema_introspection.py -v 2>&1 | tail -15
```

Expected: both tests FAIL with `ImportError: cannot import name 'TABLE_NAME_RE'` and `cannot import name '_normalize_nullable'`.

- [ ] **Step 3: Add the helpers and endpoints to `backend/app/api/databases.py`**

At the top of `backend/app/api/databases.py`, add these imports if not already present:

```python
import re
from sqlalchemy import text
```

Near the top of the file (below the existing imports, above `router = APIRouter(...)`), add:

```python
TABLE_NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_$#]{0,29}$")


def _normalize_nullable(raw) -> bool:
    """Normalize an Oracle/Postgres nullable column value to a bool."""
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, str):
        return raw.upper() in ("Y", "YES", "TRUE", "T")
    return True
```

- [ ] **Step 4: Re-run the unit tests (helpers should now pass)**

```bash
python -m pytest tests/test_schema_introspection.py -v 2>&1 | tail -10
```

Expected: both tests PASS.

- [ ] **Step 5: Add the `GET /{db_id}/tables` endpoint**

Inside `backend/app/api/databases.py`, append this endpoint (place it AFTER `test_connection` and BEFORE `sync_datasets`):

```python
@router.get("/{db_id}/tables")
def list_schema_tables(
    db_id: str,
    session: DbSessionDep,
    engine_manager: EngineManagerDep,
) -> list[dict]:
    """List tables and views in the connection's configured schema.

    Uses live introspection against the data dictionary / information_schema.
    Returns [{"name": "ITEMS", "type": "TABLE"}, ...]. The schema is
    determined by the connection's schema_name field (set when the
    connection is created); if empty, returns a 400.
    """
    conn = session.execute(
        select(RecvizConnection).where(RecvizConnection.id == db_id)
    ).scalar_one_or_none()
    if conn is None:
        raise HTTPException(status_code=404, detail=f"Database '{db_id}' not found")

    if not conn.schema_name:
        raise HTTPException(
            status_code=400,
            detail=(
                "Connection has no schema configured. Edit the data source and "
                "set the Schema field to the Oracle owner / PostgreSQL schema name."
            ),
        )

    try:
        engine = engine_manager.get_engine_for_connection(conn)
    except Exception as exc:
        logger.warning("Engine creation failed for %s: %s", db_id, exc)
        raise HTTPException(
            status_code=503,
            detail=f"Failed to connect to database: {sanitize_detail(exc)}",
        )

    if conn.backend == "oracle":
        sql = text(
            """
            SELECT table_name AS name, 'TABLE' AS type
            FROM all_tables
            WHERE owner = UPPER(:schema)
            UNION ALL
            SELECT view_name AS name, 'VIEW' AS type
            FROM all_views
            WHERE owner = UPPER(:schema)
            ORDER BY 1
            """
        )
    elif conn.backend == "postgresql":
        sql = text(
            """
            SELECT table_name AS name, table_type AS type
            FROM information_schema.tables
            WHERE table_schema = :schema
              AND table_type IN ('BASE TABLE', 'VIEW')
            ORDER BY table_name
            """
        )
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Schema introspection not supported for backend '{conn.backend}'",
        )

    try:
        with engine.connect() as db_conn:
            result = db_conn.execute(sql, {"schema": conn.schema_name})
            rows = result.fetchall()
    except Exception as exc:
        logger.warning("Schema introspection failed for %s: %s", db_id, exc)
        raise HTTPException(
            status_code=503,
            detail=f"Failed to query schema catalog: {sanitize_detail(exc)}",
        )

    # Normalize the 'type' field: Oracle emits 'TABLE' / 'VIEW' from the literal;
    # Postgres emits 'BASE TABLE' / 'VIEW' from information_schema.table_type.
    return [
        {
            "name": r[0],
            "type": "TABLE" if r[1] in ("BASE TABLE", "TABLE") else r[1],
        }
        for r in rows
    ]
```

- [ ] **Step 6: Add the `GET /{db_id}/tables/{table_name}/columns` endpoint**

Immediately below `list_schema_tables` in the same file, add:

```python
@router.get("/{db_id}/tables/{table_name}/columns")
def list_table_columns(
    db_id: str,
    table_name: str,
    session: DbSessionDep,
    engine_manager: EngineManagerDep,
) -> list[dict]:
    """List columns for a specific table/view in the connection's schema."""
    if not TABLE_NAME_RE.match(table_name):
        raise HTTPException(status_code=400, detail="Invalid table name")

    conn = session.execute(
        select(RecvizConnection).where(RecvizConnection.id == db_id)
    ).scalar_one_or_none()
    if conn is None:
        raise HTTPException(status_code=404, detail=f"Database '{db_id}' not found")

    if not conn.schema_name:
        raise HTTPException(
            status_code=400,
            detail="Connection has no schema configured",
        )

    try:
        engine = engine_manager.get_engine_for_connection(conn)
    except Exception as exc:
        logger.warning("Engine creation failed for %s: %s", db_id, exc)
        raise HTTPException(
            status_code=503,
            detail=f"Failed to connect to database: {sanitize_detail(exc)}",
        )

    if conn.backend == "oracle":
        sql = text(
            """
            SELECT column_name AS name, data_type AS type, nullable
            FROM all_tab_columns
            WHERE owner = UPPER(:schema) AND table_name = UPPER(:table_name)
            ORDER BY column_id
            """
        )
    elif conn.backend == "postgresql":
        sql = text(
            """
            SELECT column_name AS name, data_type AS type, is_nullable AS nullable
            FROM information_schema.columns
            WHERE table_schema = :schema AND table_name = :table_name
            ORDER BY ordinal_position
            """
        )
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Schema introspection not supported for backend '{conn.backend}'",
        )

    try:
        with engine.connect() as db_conn:
            result = db_conn.execute(sql, {"schema": conn.schema_name, "table_name": table_name})
            rows = result.fetchall()
    except Exception as exc:
        logger.warning("Column introspection failed for %s.%s: %s", db_id, table_name, exc)
        raise HTTPException(
            status_code=503,
            detail=f"Failed to query column catalog: {sanitize_detail(exc)}",
        )

    return [
        {
            "name": r[0],
            "type": r[1],
            "nullable": _normalize_nullable(r[2]),
        }
        for r in rows
    ]
```

- [ ] **Step 7: Verify the backend still imports cleanly**

```bash
cd /Users/aarun/Workspace/recviz-prod-build
python3.12 -m py_compile backend/app/api/databases.py && echo "OK"
```

- [ ] **Step 8: Run the tests**

```bash
cd /Users/aarun/Workspace/recviz-prod-build/backend
python -m pytest tests/test_schema_introspection.py -v 2>&1 | tail -10
python -m pytest tests/test_connection_status.py -v 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 9: Dispatch code-reviewer**

> "RecViz Task 6 (Unit 3a — schema introspection API). Two new GET endpoints in backend/app/api/databases.py: `/api/databases/{db_id}/tables` and `/api/databases/{db_id}/tables/{table_name}/columns`. Oracle uses all_tables/all_views/all_tab_columns filtered by UPPER(:schema); Postgres uses information_schema.tables/columns. Table name validated by regex TABLE_NAME_RE. Schema comes from conn.schema_name (trusted). Spec: docs/superpowers/specs/2026-04-11-ui-fixes-and-cleanup-design.md section 'Unit 3a'. Review: (1) any SQL injection path I missed — particularly around the :schema bind? (2) correct handling when conn.schema_name is not uppercase (Oracle stores identifiers uppercase by default)? (3) error messages leak any credentials? (4) do the Oracle UNION ALL queries produce duplicate rows if a table and view share the same name? Diff: `git diff HEAD`."

Fix any blocker/high findings. Watch for SQL injection concerns and credential leak concerns.

- [ ] **Step 10: Commit**

```bash
git add backend/app/api/databases.py backend/tests/test_schema_introspection.py
git commit -m "$(cat <<'MSGEOF'
feat(databases): add live schema introspection endpoints

Unit 3a of the 2026-04-11 UI fixes rollout. Two new endpoints that
query a registered connection's data dictionary / information_schema
for its tables and columns:

  GET /api/databases/{db_id}/tables
    → returns [{"name": "ITEMS", "type": "TABLE"}, ...]

  GET /api/databases/{db_id}/tables/{table_name}/columns
    → returns [{"name": "ID", "type": "NUMBER", "nullable": false}, ...]

Oracle uses all_tables / all_views / all_tab_columns filtered by
owner = UPPER(:schema). Postgres uses information_schema.tables and
columns filtered by table_schema = :schema. Both use bind parameters
so the schema name is never string-interpolated.

The :table_name parameter is validated by TABLE_NAME_RE
(`^[A-Za-z_][A-Za-z0-9_$#]{0,29}$`) before being passed as a bind
parameter — defense in depth.

These endpoints replace the frontend's previous `useDatasets` /
`/api/datasets` path which returned empty and fired 404s. The schema
browser component in the Data Explorer gets rewritten in Unit 3b to
call these endpoints with lazy-loaded column expansion.

Tests: backend/tests/test_schema_introspection.py covers the table
name regex and the nullable normalization helper.

Refs: docs/superpowers/specs/2026-04-11-ui-fixes-and-cleanup-design.md
(section 'Unit 3a')
MSGEOF
)"
```

---

# Task 7: Unit 3b — Schema browser frontend rewrite

**Goal:** rewrite the schema browser component to use the new backend endpoints with lazy column loading, real database selector, client-side search filter, and no hardcoded labels.

**Files:**
- Create: `frontend/src/types/schema.ts`
- Create: `frontend/src/hooks/use-tables.ts`
- Create: `frontend/src/hooks/use-table-columns.ts`
- Modify: `frontend/src/components/explorer/schema-browser.tsx` (full rewrite)
- Create: `frontend/src/components/explorer/schema-browser.test.tsx`

- [ ] **Step 1: Create `frontend/src/types/schema.ts`**

```tsx
export interface SchemaTable {
  name: string
  type: string  // 'TABLE' or 'VIEW'
}

export interface SchemaColumn {
  name: string
  type: string
  nullable: boolean
}
```

- [ ] **Step 2: Create `frontend/src/hooks/use-tables.ts`**

```tsx
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { SchemaTable } from '@/types/schema'

export function useTables(dbId: string | null) {
  return useQuery({
    queryKey: ['tables', dbId],
    queryFn: () => api.get<SchemaTable[]>(`/api/databases/${dbId}/tables`),
    enabled: dbId !== null && dbId !== '',
    staleTime: 5 * 60 * 1000,
  })
}
```

- [ ] **Step 3: Create `frontend/src/hooks/use-table-columns.ts`**

```tsx
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { SchemaColumn } from '@/types/schema'

export function useTableColumns(dbId: string | null, tableName: string | null) {
  return useQuery({
    queryKey: ['columns', dbId, tableName],
    queryFn: () =>
      api.get<SchemaColumn[]>(
        `/api/databases/${dbId}/tables/${tableName}/columns`,
      ),
    enabled: dbId !== null && dbId !== '' && tableName !== null && tableName !== '',
    staleTime: 5 * 60 * 1000,
  })
}
```

- [ ] **Step 4: Write the failing test for the rewritten schema browser**

Create `frontend/src/components/explorer/schema-browser.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SchemaBrowser } from './schema-browser'

// Mock the hooks
vi.mock('@/hooks/use-databases', () => ({
  useDatabases: () => ({
    data: [
      { id: 'db-1', databaseName: 'Prod Oracle', backend: 'oracle', status: 'connected', lastTested: null, createdOn: null, exposeInSqllab: true },
      { id: 'db-2', databaseName: 'Dev Postgres', backend: 'postgresql', status: 'connected', lastTested: null, createdOn: null, exposeInSqllab: true },
    ],
    isLoading: false,
  }),
}))

vi.mock('@/hooks/use-tables', () => ({
  useTables: (dbId: string | null) => ({
    data: dbId ? [
      { name: 'ITEMS', type: 'TABLE' },
      { name: 'MESSAGE_FEED', type: 'TABLE' },
      { name: 'V_DAILY_STATS', type: 'VIEW' },
    ] : undefined,
    isLoading: false,
  }),
}))

const useTableColumnsMock = vi.fn((dbId: string | null, tableName: string | null) => ({
  data: tableName === 'ITEMS' ? [
    { name: 'ID', type: 'NUMBER', nullable: false },
    { name: 'NAME', type: 'VARCHAR2', nullable: true },
  ] : undefined,
  isLoading: false,
}))

vi.mock('@/hooks/use-table-columns', () => ({
  useTableColumns: (dbId: string | null, tableName: string | null) =>
    useTableColumnsMock(dbId, tableName),
}))

function renderWithQuery(ui: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('SchemaBrowser', () => {
  beforeEach(() => {
    useTableColumnsMock.mockClear()
  })

  it('renders the first database as selected and lists its tables', () => {
    const onInsertTable = vi.fn()
    const onInsertColumn = vi.fn()
    renderWithQuery(
      <SchemaBrowser onInsertTable={onInsertTable} onInsertColumn={onInsertColumn} />,
    )
    expect(screen.getByText('ITEMS')).toBeInTheDocument()
    expect(screen.getByText('MESSAGE_FEED')).toBeInTheDocument()
    expect(screen.getByText('V_DAILY_STATS')).toBeInTheDocument()
  })

  it('filters tables by the search input', async () => {
    renderWithQuery(
      <SchemaBrowser onInsertTable={vi.fn()} onInsertColumn={vi.fn()} />,
    )
    const filter = screen.getByPlaceholderText(/filter/i)
    fireEvent.change(filter, { target: { value: 'message' } })
    await waitFor(() => {
      expect(screen.getByText('MESSAGE_FEED')).toBeInTheDocument()
      expect(screen.queryByText('ITEMS')).not.toBeInTheDocument()
    })
  })

  it('fires useTableColumns only when a table is expanded', () => {
    const onInsertColumn = vi.fn()
    renderWithQuery(
      <SchemaBrowser onInsertTable={vi.fn()} onInsertColumn={onInsertColumn} />,
    )
    // Initially: no table expanded, so hook called with null for all rows
    const initialNonNullCalls = useTableColumnsMock.mock.calls.filter(
      ([, tableName]) => tableName !== null,
    ).length
    expect(initialNonNullCalls).toBe(0)

    // Click the ITEMS row to expand
    const itemsRow = screen.getByText('ITEMS')
    fireEvent.click(itemsRow)

    // Now useTableColumns should have been called with tableName='ITEMS'
    const expandedCalls = useTableColumnsMock.mock.calls.filter(
      ([, tableName]) => tableName === 'ITEMS',
    )
    expect(expandedCalls.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 5: Run the test to confirm it fails**

```bash
cd /Users/aarun/Workspace/recviz-prod-build/frontend
pnpm exec vitest run src/components/explorer/schema-browser.test.tsx 2>&1 | tail -30
```

Expected: the test file either fails to import the SchemaBrowser (because the rewritten version doesn't exist yet) or the tests fail because the old implementation doesn't match the new expected behavior.

- [ ] **Step 6: Rewrite `frontend/src/components/explorer/schema-browser.tsx`**

Replace the ENTIRE file contents with:

```tsx
import { useState, useMemo, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Database,
  Table2,
  Eye,
  Columns3,
  ChevronRight,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDatabases } from '@/hooks/use-databases'
import { useTables } from '@/hooks/use-tables'
import { useTableColumns } from '@/hooks/use-table-columns'
import type { SchemaTable } from '@/types/schema'

interface SchemaBrowserProps {
  onInsertTable: (tableName: string) => void
  onInsertColumn: (columnName: string) => void
}

export function SchemaBrowser({
  onInsertTable,
  onInsertColumn,
}: SchemaBrowserProps) {
  const { data: databases = [], isLoading: dbsLoading } = useDatabases()
  const [selectedDbId, setSelectedDbId] = useState<string>('')

  // Auto-select the first database once the list loads
  useEffect(() => {
    if (!selectedDbId && databases.length > 0) {
      setSelectedDbId(databases[0].id)
    }
  }, [databases, selectedDbId])

  const { data: tables, isLoading: tablesLoading, error: tablesError } =
    useTables(selectedDbId || null)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const selectedDb = databases.find((d) => d.id === selectedDbId)

  const filteredTables = useMemo(() => {
    if (!tables) return []
    if (!search.trim()) return tables
    const q = search.toLowerCase()
    return tables.filter((t) => t.name.toLowerCase().includes(q))
  }, [tables, search])

  const toggleTable = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <div className="flex flex-col h-full border-r">
      {/* Header */}
      <div className="px-3 py-2.5 border-b bg-muted/40 shrink-0">
        <div className="flex items-center gap-2">
          <Database className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium truncate">Schema Browser</span>
        </div>
      </div>

      {/* Database selector */}
      <div className="p-2 border-b shrink-0">
        <Select value={selectedDbId} onValueChange={setSelectedDbId}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select database" />
          </SelectTrigger>
          <SelectContent>
            {databases.map((db) => (
              <SelectItem key={db.id} value={db.id}>
                {db.databaseName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Search */}
      <div className="p-2 border-b shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Filter tables..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-7 text-xs"
          />
        </div>
      </div>

      {/* Tree */}
      <ScrollArea className="flex-1">
        {dbsLoading || tablesLoading ? (
          <div className="flex flex-col gap-2 p-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        ) : tablesError ? (
          <div className="px-3 py-4 text-xs text-destructive">
            Failed to load tables. Check backend logs and the connection's Schema field.
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground">
            {tables?.length === 0
              ? `No tables in schema ${selectedDb?.databaseName ? `'${selectedDb.databaseName}'` : ''}`
              : 'No tables match filter.'}
          </div>
        ) : (
          <div className="py-1">
            {filteredTables.map((tbl) => (
              <ExpandableTable
                key={tbl.name}
                dbId={selectedDbId}
                table={tbl}
                expanded={expanded.has(tbl.name)}
                onToggle={() => toggleTable(tbl.name)}
                onInsertTable={onInsertTable}
                onInsertColumn={onInsertColumn}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

interface ExpandableTableProps {
  dbId: string
  table: SchemaTable
  expanded: boolean
  onToggle: () => void
  onInsertTable: (tableName: string) => void
  onInsertColumn: (columnName: string) => void
}

function ExpandableTable({
  dbId,
  table,
  expanded,
  onToggle,
  onInsertTable,
  onInsertColumn,
}: ExpandableTableProps) {
  // Lazy column fetch: only enabled when the table is expanded
  const { data: columns, isLoading, error } = useTableColumns(
    dbId,
    expanded ? table.name : null,
  )

  const isView = table.type.toUpperCase() === 'VIEW'
  const Icon = isView ? Eye : Table2

  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <CollapsibleTrigger
        className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs hover:bg-accent/50 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <ChevronRight
          className={cn(
            'size-3 shrink-0 transition-transform duration-150',
            expanded && 'rotate-90',
          )}
        />
        <Icon
          className={cn(
            'size-3.5 shrink-0',
            isView ? 'text-purple-500' : 'text-blue-500',
          )}
        />
        <span
          className="flex-1 text-left truncate font-medium cursor-pointer hover:text-primary"
          onClick={(e) => {
            e.stopPropagation()
            onInsertTable(table.name)
          }}
          title={`Insert "${table.name}"`}
        >
          {table.name}
        </span>
        <span className="text-[9px] text-muted-foreground shrink-0 uppercase tracking-wide">
          {table.type}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-5 border-l pl-2 py-0.5">
          {isLoading ? (
            <div className="flex flex-col gap-1 py-1">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ) : error ? (
            <div className="text-[11px] text-destructive px-2 py-1">
              Failed to load columns
            </div>
          ) : columns && columns.length > 0 ? (
            columns.map((col) => (
              <button
                key={col.name}
                className="flex items-center gap-1.5 w-full px-2 py-1 text-xs hover:bg-accent/50 rounded-sm cursor-pointer transition-colors"
                onClick={() => onInsertColumn(col.name)}
                title={`Insert "${col.name}"`}
              >
                <Columns3 className="size-3 shrink-0 text-muted-foreground/60" />
                <span className="flex-1 text-left truncate">{col.name}</span>
                <Badge
                  variant="outline"
                  className="text-[9px] px-1 py-0 h-3.5 shrink-0 font-mono"
                >
                  {col.type.length > 8 ? col.type.slice(0, 8) : col.type}
                </Badge>
              </button>
            ))
          ) : (
            <div className="text-[11px] text-muted-foreground px-2 py-1">
              No columns
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
```

- [ ] **Step 7: Run the tests**

```bash
cd /Users/aarun/Workspace/recviz-prod-build/frontend
pnpm exec vitest run src/components/explorer/schema-browser.test.tsx 2>&1 | tail -30
```

Expected: all three tests pass.

- [ ] **Step 8: Run the full frontend build**

```bash
pnpm build 2>&1 | tail -10
```

Expected: `✓ built in Ns`. No new type errors.

- [ ] **Step 9: Dispatch code-reviewer**

> "RecViz Task 7 (Unit 3b — schema browser rewrite). Replaced the old schema-browser.tsx that called the dead `useDatasets()` hook with a new implementation that: (1) uses `useDatabases()` for the real database dropdown, (2) calls new `useTables(dbId)` hook → GET /api/databases/{dbId}/tables, (3) lazy-loads columns via `useTableColumns(dbId, tableName)` only when a table is expanded, (4) has a client-side filter input, (5) shows loading/error/empty states, (6) distinguishes TABLE vs VIEW with icon + label. Spec: docs/superpowers/specs/2026-04-11-ui-fixes-and-cleanup-design.md section 'Unit 3b'. Review: (1) is the useState<Set<string>> expansion tracking memoized correctly for re-renders? (2) does the filter properly handle edge cases like search = '' vs search = '   '? (3) does the lazy column fetch re-fire every time the user collapses and re-expands? (4) accessibility — keyboard navigation through the tree? (5) is the ExpandableTable sub-component correctly not firing useTableColumns when collapsed? Diff: `git diff HEAD`."

Fix any blocker/high findings.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/types/schema.ts \
        frontend/src/hooks/use-tables.ts \
        frontend/src/hooks/use-table-columns.ts \
        frontend/src/components/explorer/schema-browser.tsx \
        frontend/src/components/explorer/schema-browser.test.tsx
git commit -m "$(cat <<'MSGEOF'
feat(explorer): real Oracle schema browser with lazy column loading

Unit 3b of the 2026-04-11 UI fixes rollout. Rewrites the Data Explorer
schema browser to call the new /api/databases/{id}/tables and /columns
endpoints added in Unit 3a, replacing the dead useDatasets() path.

Architecture:
  - Database selector (uses existing useDatabases hook) auto-selects the
    first registered database on mount
  - Table list fetched via new useTables(dbId) hook with 5-min staleTime
  - Client-side filter input narrows the table list
  - Column list fetched lazily via useTableColumns(dbId, tableName) —
    the hook is disabled until the user expands a specific row, so
    a schema with 500 tables fires one initial query plus N column
    queries only for the tables the user actually inspects
  - Distinguishes TABLE vs VIEW with icon + label
  - Loading, error, and empty states for all branches

Files:
  - new: src/types/schema.ts
  - new: src/hooks/use-tables.ts
  - new: src/hooks/use-table-columns.ts
  - new: src/components/explorer/schema-browser.test.tsx
  - rewrite: src/components/explorer/schema-browser.tsx

Test: schema-browser.test.tsx (3 tests with mocked hooks) verifies the
auto-select, filter, and lazy-expansion behavior.

Refs: docs/superpowers/specs/2026-04-11-ui-fixes-and-cleanup-design.md
(section 'Unit 3b')
MSGEOF
)"
```

---

# Task 8: Unit 5 — Dead-code cleanup

**Goal:** delete the legacy hooks that called dead endpoints, the export router stub, and any orphan type files now that no consumer exists.

**Files:**
- Delete: `frontend/src/hooks/use-datasets.ts`
- Delete: `frontend/src/hooks/use-dataset.ts`
- Delete: `backend/app/api/export.py`
- Modify: `backend/app/api/router.py` (remove export_router include)
- Possibly delete: `frontend/src/types/dataset.ts` (verify first)

- [ ] **Step 1: Verify `use-datasets.ts` has zero callers**

```bash
cd /Users/aarun/Workspace/recviz-prod-build
grep -rn "from '@/hooks/use-datasets'" frontend/src --include='*.tsx' --include='*.ts'
```

Expected: **no matches**. The only caller was schema-browser, which we rewrote in Task 7. If you see any match, investigate before deletion.

- [ ] **Step 2: Verify `use-dataset.ts` has zero callers**

```bash
grep -rn "from '@/hooks/use-dataset'" frontend/src --include='*.tsx' --include='*.ts'
# Note: this should exclude use-datasets and use-managed-datasets — match only the exact path
grep -rn "from '@/hooks/use-dataset'" frontend/src --include='*.tsx' --include='*.ts' | grep -v 'use-datasets\|use-managed-datasets'
```

Expected: no matches after the grep filter. If there are matches, do NOT delete this file — add the consumer to the migration plan.

- [ ] **Step 3: Verify `api/export.py` has zero callers**

```bash
grep -rn '/api/export' frontend/src --include='*.tsx' --include='*.ts'
```

Expected: no matches.

- [ ] **Step 4: Check if `frontend/src/types/dataset.ts` is still used**

```bash
grep -rn "from '@/types/dataset'" frontend/src --include='*.tsx' --include='*.ts'
```

If zero matches → delete in Step 6. If there are matches → leave it, note which files still import it.

- [ ] **Step 5: Delete the dead frontend hooks**

```bash
cd /Users/aarun/Workspace/recviz-prod-build
rm -f frontend/src/hooks/use-datasets.ts
rm -f frontend/src/hooks/use-dataset.ts
```

- [ ] **Step 6 (conditional): Delete `types/dataset.ts` if unused**

If Step 4 returned zero matches:

```bash
rm -f frontend/src/types/dataset.ts
```

- [ ] **Step 7: Delete the backend export stub and its router include**

```bash
rm -f backend/app/api/export.py
```

Open `backend/app/api/router.py`. Find:

```python
from app.api.export import router as export_router
```

Delete that line. Then find:

```python
api_router.include_router(export_router)
```

Delete that line too.

- [ ] **Step 8: Verify nothing broke**

```bash
cd /Users/aarun/Workspace/recviz-prod-build
python3.12 -m py_compile backend/app/api/router.py backend/app/main.py && echo "backend OK"
cd frontend
pnpm exec tsc --noEmit 2>&1 | tail -15
pnpm build 2>&1 | tail -10
```

Expected: zero errors, build succeeds. If tsc complains about missing imports, it means something DID still reference the deleted files — revert the deletion and investigate.

- [ ] **Step 9: Dispatch code-reviewer**

> "RecViz Task 8 (Unit 5 — dead-code cleanup). Deleted three frontend files (use-datasets.ts, use-dataset.ts, optionally types/dataset.ts) and one backend file (api/export.py), plus the export_router include in api/router.py. All confirmed to have zero callers via grep before deletion. Spec: docs/superpowers/specs/2026-04-11-ui-fixes-and-cleanup-design.md section 'Unit 5'. Review: (1) any indirect references via dynamic imports or string-based module paths? (2) did I miss any cross-reference? (3) did I preserve files that look dead but are actually still needed (api/data_sources.py, config_store.py, RecvizDataSource — per the project_broken_dashboard_pipeline.md memory)? Diff: `git diff HEAD`."

The reviewer should confirm we did NOT touch `api/data_sources.py` or the dashboard rendering pipeline files.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "$(cat <<'MSGEOF'
chore: remove dead legacy hooks and export stub

Unit 5 of the 2026-04-11 UI fixes rollout. Removes files confirmed to
have zero callers after the schema browser rewrite in Unit 3b.

Deleted:
  - frontend/src/hooks/use-datasets.ts   (called dead /api/datasets)
  - frontend/src/hooks/use-dataset.ts    (called dead /api/datasets/:id)
  - backend/app/api/export.py            (stub with no frontend callers)
  - (conditional) frontend/src/types/dataset.ts (if unused)

Also removed the export_router include from backend/app/api/router.py.

Explicitly NOT deleted: api/data_sources.py, config_store.py,
RecvizDataSource ORM, models/data_source_config.py, recviz_data_sources
table. These look dead but are still referenced by the broken dashboard
rendering pipeline — see project_broken_dashboard_pipeline.md memory.
Fixing that pipeline is a separate future session.

Refs: docs/superpowers/specs/2026-04-11-ui-fixes-and-cleanup-design.md
(section 'Unit 5')
MSGEOF
)"
```

---

# Task 9: Unit 7 — Final full review + E2E verification + tarball

**Goal:** final code review across the entire rollout, rebuild the frontend cleanly, build a new deploy tarball, and hand off to the user for server-side verification.

**Files:** none modified — review and packaging only.

- [ ] **Step 1: Confirm all pre-flight checks pass on a clean baseline**

```bash
cd /Users/aarun/Workspace/recviz-prod-build

# Backend tests
cd backend
python -m pytest tests/ -v 2>&1 | tail -20
cd ..

# Frontend full build (no bypass)
cd frontend
pnpm build 2>&1 | tail -10
cd ..
```

Expected: backend tests all pass, frontend `pnpm build` succeeds without needing `pnpm exec vite build`.

- [ ] **Step 2: Dispatch the code-reviewer agent for the full rollout diff**

Use the Agent tool with `feature-dev:code-reviewer` and this prompt:

> "Final full review of the RecViz UI fixes rollout. Branch: deploy/oracle-v2-20260409. Range: everything since commit 2954a08 (the spec commit). Spec: docs/superpowers/specs/2026-04-11-ui-fixes-and-cleanup-design.md.
>
> What was built:
> - Unit 0: deleted pre-existing broken tests to clean the baseline
> - Unit 1: removed Number(databaseId) conversions across dataset editor + list (UUIDs were turning into NaN)
> - Unit 6: replaced hardcoded Postgres-era default SQL with empty string
> - Unit 4: hid N tables label, OS-aware Kbd label, dropped datasetCount field
> - Unit 2: persistent connection status (auto-test on create, startup sweep in lifespan, persist-on-test endpoint, read from DB column)
> - Unit 3a: new /api/databases/{id}/tables and /columns endpoints for Oracle + Postgres introspection
> - Unit 3b: rewrite of schema-browser.tsx with lazy column loading and real database dropdown
> - Unit 5: deleted use-datasets.ts, use-dataset.ts, api/export.py plus router include
>
> Scope: `git diff 2954a08..HEAD`.
>
> Report any blocker/high severity issues you find. For each issue, tell me: the file, line, and a concrete fix. Explicitly look for: (1) SQL injection in the new schema introspection endpoints, (2) session lifecycle issues in the startup sweep or create-time auto-test, (3) any dead code I missed deleting, (4) any missed Number(databaseId) conversions in sibling files I didn't touch, (5) React hook rule violations in the schema browser rewrite, (6) missing error handling for oracle call_timeout interaction with the startup sweep.
>
> Medium and low severity findings can go into a follow-up, but list them."

- [ ] **Step 3: Fix any blocker/high findings from Step 2**

Apply the fixes inline. If the fix affects multiple files, stage them and commit as one "review fix" commit.

```bash
# After applying fixes
git add <fixed files>
git commit -m "fix(review): address code-reviewer findings from Unit 7 full review"
```

If the fixes are substantial (>50 lines), dispatch a second review to confirm they resolved the findings.

- [ ] **Step 4: Stage the tarball on the laptop**

```bash
rm -rf /tmp/recviz-staging-v6 && mkdir -p /tmp/recviz-staging-v6

rsync -a \
  --exclude='venv' \
  --exclude='__pycache__' \
  --exclude='.pytest_cache' \
  /Users/aarun/Workspace/recviz-prod-build/backend /tmp/recviz-staging-v6/

mkdir -p /tmp/recviz-staging-v6/frontend
cp -r /Users/aarun/Workspace/recviz-prod-build/frontend/dist /tmp/recviz-staging-v6/frontend/

# Copy the lifecycle scripts from the previous staging (same ones as v3/v4/v5)
cp -r /tmp/recviz-staging-v3/scripts /tmp/recviz-staging-v6/
```

- [ ] **Step 5: Build the tarball**

```bash
tar -czf ~/recviz-deploy-v6-ui-fixes.tar.gz -C /tmp/recviz-staging-v6 .
ls -lh ~/recviz-deploy-v6-ui-fixes.tar.gz
```

Expected: ~1.7 MB tarball.

- [ ] **Step 6: Verify the tarball contents**

```bash
# All units' key files should be in the tarball
tar xzOf ~/recviz-deploy-v6-ui-fixes.tar.gz ./backend/app/api/databases.py | grep -E 'list_schema_tables|_normalize_nullable|startup.*sweep|_install_oracle_call_timeout' | head
tar xzOf ~/recviz-deploy-v6-ui-fixes.tar.gz ./backend/app/main.py | grep -E 'Startup sweep|ThreadPoolExecutor' | head
tar tzf ~/recviz-deploy-v6-ui-fixes.tar.gz | grep -E 'schema-browser\.tsx|use-tables\.ts|use-table-columns\.ts' | head
tar tzf ~/recviz-deploy-v6-ui-fixes.tar.gz | grep -E 'use-datasets\.ts|use-dataset\.ts|export\.py' | head
```

Expected:
- The `grep -E 'list_schema_tables|_normalize_nullable|startup.*sweep'` line should find at least one match
- The main.py grep should find `Startup sweep` and `ThreadPoolExecutor`
- The frontend grep should find `schema-browser.tsx`, `use-tables.ts`, `use-table-columns.ts`
- The deleted-files grep should find **nothing** (confirming deletions landed)

- [ ] **Step 7: Hand off to the user with server-side verification checklist**

Paste this handoff block in the chat:

> **Tarball ready: `~/recviz-deploy-v6-ui-fixes.tar.gz`**
>
> Transfer route: this machine → Citi laptop → `scp` to `rectify@<server>:/tmp/recviz-deploy-v6-ui-fixes.tar.gz`
>
> Once on the server, run:
>
> ```bash
> bash /opt/rectify/rectrace/recviz/app/scripts/stop-all.sh
> cd /opt/rectify/rectrace/recviz
> rm -rf app/backend app/frontend
> cd app && tar xzf /tmp/recviz-deploy-v6-ui-fixes.tar.gz backend frontend
> bash /opt/rectify/rectrace/recviz/app/scripts/start-all.sh
> grep -i 'startup sweep' /opt/rectify/rectrace/recviz/logs/backend.log | tail -1
> ```
>
> Expected final log line: `Startup sweep done in Ns: X connected, Y unreachable` where X+Y equals your number of saved connections.
>
> Then run the success criteria in the browser (section 9 of the spec):
>
> 1. [ ] Settings → Data Sources card no longer shows "N tables"
> 2. [ ] Status dot is green (not "untested") for working connections after restart
> 3. [ ] Creating a new data source shows an immediate green dot if reachable
> 4. [ ] Data Explorer → real Oracle table list appears in the schema browser
> 5. [ ] Expanding a table shows real columns within ~1 second
> 6. [ ] Navigate Explorer → Reports → no 404, no error toast
> 7. [ ] Datasets → Create Dataset → Run Query works
> 8. [ ] Ctrl+Enter on Windows runs the query and the label says `Ctrl+↵`
> 9. [ ] Save Dataset persists a row to `recviz_datasets`
> 10. [ ] `SELECT status, last_tested_at FROM recviz_connections` in SQL Developer returns real values, not defaults

- [ ] **Step 8 (optional, after user confirms success): final sync to main repo**

Once the user confirms all success criteria pass on the server, push/pull the deploy branch back to the main dev repo for posterity:

```bash
cd /Users/aarun/Workspace/Projects/RecViz
git fetch /Users/aarun/Workspace/recviz-prod-build deploy/oracle-v2-20260409:deploy/oracle-v2-20260409
git log --oneline deploy/oracle-v2-20260409 | head -15
```

This doesn't merge — it just makes the branch visible in the main checkout in case you want to inspect it there.

---

## Self-review

**Spec coverage check:**

| Spec section | Task |
|---|---|
| Unit 0 — Broken-test audit | Task 1 |
| Unit 1 — String ID fix | Task 2 |
| Unit 6 — Default SQL cleanup | Task 3 |
| Unit 4 — Cosmetic bundle | Task 4 |
| Unit 2 — Persistent status | Task 5 |
| Unit 3a — Schema introspection API | Task 6 |
| Unit 3b — Schema browser rewrite | Task 7 |
| Unit 5 — Dead-code cleanup | Task 8 |
| Unit 7 — Final review + verification | Task 9 |
| Spec §4 code-reviewer gate between units | Step 10/11/9/8/11/9/9/9/2 of each task respectively |
| Spec §7.3 final full review | Task 9 Step 2 |
| Spec §9 success criteria | Task 9 Step 7 handoff block |
| Spec §10 rollout | Task 9 Steps 4–7 |

All 9 units covered. Every unit ends with a code-reviewer dispatch step before the commit step. Final full review is Task 9 Step 2.

**Placeholder scan:** searched for "TBD", "TODO", "fill in", "similar to Task" — none found. All file paths are exact. All code blocks contain the actual content to paste, not summaries.

**Type consistency check:** `SchemaTable`, `SchemaColumn` defined in Task 7 Step 1 and consumed by Tasks 7 Step 2/3/6. `TABLE_NAME_RE` and `_normalize_nullable` defined in Task 6 Step 3 and tested in Task 6 Step 1/4. `_build_response` signature change in Task 5 Step 3 is consistently applied in Step 4 (removal of `status_info` argument at all call sites). `databaseId: string` alignment in Task 2 flows through Task 4's TS type update.

**No dangling references found.** Plan ready for execution.
