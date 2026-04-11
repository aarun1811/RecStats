# RecViz — UI Fixes, Status Persistence, Schema Browser, and Dead-Code Cleanup

**Date:** 2026-04-11
**Status:** Approved for implementation
**Branch:** `deploy/oracle-v2-20260409`
**Audience:** The engineer (future me, or a subagent) implementing this plan on the RecViz RHEL deployment
**Predecessors:**
- `2026-04-09-rhel-oracle-no-sudo-deployment-design.md` — the initial RHEL deploy
- `project_broken_dashboard_pipeline.md` (memory) — tracks the architectural gap this spec deliberately does NOT fix

---

## 1. Context

After deploying the sync-converted backend to the RHEL server and getting the first data source wired up, the user reported six issues while exercising the UI. This spec addresses all six, plus the dead-code cleanup surfaced during diagnosis, plus the broken pre-existing tests that are blocking `pnpm build` from running cleanly.

**What's not in this spec:** the broken dashboard rendering pipeline (charts still query `/api/data-sources/*` which reads from the empty `recviz_data_sources` table). That's a larger refactor tracked separately in memory and will be tackled in a follow-up session once the user is ready to build their first real dashboard.

## 2. Problems to solve

Six observed issues, diagnosed to these root causes:

| # | Symptom | Root cause |
|---|---|---|
| 1 | Data source card shows "0 tables" and "untested" after save | `_build_response()` hardcodes `dataset_count = 0`; `recviz_connections.status` is never written to; in-memory `ConnectionStatusTracker` resets on every restart |
| 2 | 404 toast appears when navigating Data Explorer → Reports | `schema-browser.tsx` calls `useDatasets()` → `GET /api/datasets` (dead endpoint); TanStack Query surfaces the error via toast on navigation |
| 3 | Data Explorer shows hardcoded "recon_data" label and a predefined Postgres-era SQL snippet; schema tree has nothing clickable | Three hardcoded legacies in `schema-browser.tsx` + `explorer/index.tsx`; calls dead `/api/datasets` endpoint |
| 4 | Datasets page shows `/api/datasets` 404 in the network tab | Same `useDatasets()` call from a prior Explorer visit surfacing the error again |
| 5 | KPIs / Charts / Dashboards pages work empty | **No fix needed** — these pages use `/managed` endpoints which are live |
| 6 | Create Dataset: Run Query button does nothing; Ctrl+Enter does nothing; Kbd label shows `⌘` on Windows | `handleRunQuery` does `Number(databaseId)` on a UUID string → NaN → early return. Same bug in `handleSave` and `dataset-list.tsx`'s database filter. The Kbd label is hardcoded to `⌘`. |

Additional scope added during brainstorming:
- Delete pre-existing broken frontend test files (~3) and backend test files (~3) so `pnpm build` and `pytest` run cleanly — otherwise any new error is indistinguishable from pre-existing rot.
- Delete unused legacy backend `api/export.py` and frontend hooks `use-datasets.ts` / `use-dataset.ts`.

## 3. Design decisions

Three decisions had real trade-offs. The rest followed directly from the user's answers during brainstorming.

### 3.1 Persistent connection status

**Problem:** `recviz_connections.status` column exists (migration 005) but nothing writes to it. In-memory `ConnectionStatusTracker` is the only source of truth and forgets everything on backend restart. This is why every card shows "untested" after a restart.

**Options considered:**
- **A.** Auto-test connection during `POST /api/databases` (on create), persist to `status` column
- **B.** Sweep all registered connections during backend startup, update `status` in bulk
- **C.** Only test on explicit user click

**Decision: A + B combined.** The user explicitly liked B ("backend trying to auto connect to all saved data sources while starting up"). We add A on top because without it, newly-saved connections stay "untested" until the next restart, which is the exact UX the user complained about. Both paths write to the same column, so the test-connection helper is reused.

The in-memory `ConnectionStatusTracker` stays for **runtime** health signals — `QueryExecutor` still marks connections unreachable on query failures during normal operation. The DB column is the durable source of truth; the tracker overlays short-term runtime observations.

### 3.2 Oracle schema browser approach

**Problem:** user wants the schema browser in Data Explorer to show real tables from the connected Oracle schema. The current implementation calls a dead endpoint and shows a hardcoded "recon_data" label. Real schemas can have 300+ tables × 50+ columns, which would melt the frontend if eager-loaded.

**Options considered:**
- **A.** Eager-load all tables + all columns in one API call (~15,000 rows worst case — freezes the browser)
- **B.** Lazy-load: list tables first, fetch columns only when the user expands a specific table
- **C.** Server-side search API — fastest at scale but adds debouncing complexity for a single-digit-user tool

**Decision: B.** One initial query returns the table list (`<1s` even for 500 tables). User filters client-side via a search input. When a table is clicked, columns fetch lazily in another `<1s` query. TanStack Query caches both with a 5-minute stale time. A user expanding 10 tables out of 500 fires 11 queries total vs 1 query × 25,000 rows in the naive approach.

### 3.3 Introspection query: `all_tables` vs `user_tables`

**Problem:** Oracle has two sets of data dictionary views:
- `user_tables` / `user_tab_columns` — returns only objects *owned* by the logged-in Oracle user
- `all_tables` / `all_tab_columns` — returns objects the user has SELECT grants on, across all schemas

The recon connection typically uses a read-only account (e.g. `RECVIZ_RO`) that reads from tables owned by a different schema (e.g. `TLM_CONSUMER`). With `user_tables`, this would return zero rows — the user owns nothing. With `all_tables WHERE owner = 'TLM_CONSUMER'`, we get the real tables.

**Decision: use `all_tables WHERE owner = UPPER(:schema)`.** The `:schema` comes from `recviz_connections.schema_name`, which the user populates when creating each data source (confirmed during brainstorming). If the user forgot to populate `schema_name`, the query returns an empty list with a helpful error message, and the fix is to edit the data source and add the schema.

## 4. Architecture — the 9 units of work

The implementation is broken into 9 isolated units. Each ships as its own commit. Between every commit, a code-reviewer agent reviews the diff and we fix blockers/highs inline before starting the next unit.

```
Unit 0  Pre-existing broken-test audit + deletion     (baseline — must be first)
Unit 1  String ID fix (P0 — unblocks dataset flow)
Unit 6  Explorer default SQL cleanup                  (trivial, bundled for commit batching)
Unit 4  Cosmetic: hide "N tables", OS-aware Kbd       (trivial)
Unit 2  Persistent connection status                  (backend-only)
Unit 3a Schema introspection API                      (backend-only, precondition for 3b)
Unit 3b Schema browser rewrite                        (frontend, depends on 3a)
Unit 5  Dead-code cleanup                             (must run after 3b — removes last use-datasets caller)
Unit 7  Final full review + E2E verification + tarball
```

### Unit 0 — Pre-existing broken-test audit + deletion

**Goal:** clean baseline so any error after this point is caused by our changes, not pre-existing rot.

**Files to audit:**
- `backend/tests/test_query_engine.py` (known: 10 errors, `ConfigStore.__init__` signature mismatch)
- `backend/tests/test_config_store.py` (known: 6 errors, same root cause)
- `backend/tests/test_dataset_sync.py` (known: 16 failures — `dataset_sync.py` no longer exists)
- `frontend/src/components/dashboard/grid-toolbar.test.tsx` (known: unused React import, unused var)
- `frontend/src/routes/embed/dashboards/$dashboardId.test.tsx` (known: missing JSX namespace)
- `frontend/src/components/explorer/chart-builder-dialog.tsx` (not a test — has 6 type errors. Check usage; delete file if unused, else fix)

**Audit procedure:**
1. `cd backend && venv/bin/python -m pytest --collect-only tests/` — confirms which test files cannot collect
2. `cd frontend && pnpm exec tsc --noEmit` — confirms which files have type errors
3. For each broken file, cross-reference with current code — is it broken because the thing it tests no longer exists?
4. If yes, delete the file
5. If no (genuinely fixable test), fix inline in this unit

**Decision rule:** delete any test file that references a symbol that no longer exists in the current code AND that is not trivially fixable. The alternative is maintaining a broken test nobody runs.

**Exit criteria:**
- `pytest tests/` collects and runs with 0 errors (may have 0 tests if all broken ones were deleted)
- `tsc --noEmit` on the frontend reports 0 errors (or a tracked, fixable list)
- `pnpm build` (not `pnpm exec vite build`) succeeds

### Unit 1 — String ID fix

**Goal:** Run Query and Save buttons work in the Create/Edit Dataset flow.

**Files:**
- `frontend/src/components/datasets/dataset-editor.tsx` — `handleRunQuery` (line 82), `handleSave` (line 121), `isSaveDisabled` check (line 288). Replace `const dbId = Number(databaseId)` with direct use of `databaseId` string. Update guard condition from `!dbId` to `!databaseId`. Update `sqlExecute.mutate({ sql, databaseId: dbId, ... })` to pass the string.
- `frontend/src/components/datasets/dataset-list.tsx` — `databaseMap` key type from `Map<number, ...>` to `Map<string, ...>`. Remove `Number(databaseFilter)` on line 53. Filter comparison becomes `(ds) => ds.databaseId === databaseFilter`.
- `frontend/src/types/managed-dataset.ts` — confirm `RecvizDataset.databaseId` is typed `string`. Backend already returns string UUID from migration 007.
- Any other file referencing `databaseId` as a number (grep to catch stragglers).

**Not changing:** backend. Already returns string UUIDs.

**Verification:** launch the dataset editor, pick a connection, write `SELECT 1 FROM DUAL`, click Run Query → preview grid shows one row. Click Save → row persists to `recviz_datasets` with the correct string `database_id`.

### Unit 6 — Explorer default SQL cleanup

**File:** `frontend/src/routes/_app/explorer/index.tsx:17`

**Change:** `const DEFAULT_SQL = 'SELECT * FROM breaks WHERE desk = ''Operations'' LIMIT 20'` → `const DEFAULT_SQL = ''`

**Why:** the default SQL references Postgres seed data that doesn't exist on the Oracle deployment. Empty is better than misleading.

### Unit 4 — Cosmetic bundle

Three tiny edits committed together:

1. **Hide "N tables" label.** `frontend/src/components/settings/data-source-card.tsx:78` — remove the `&middot; {database.datasetCount} tables` fragment. The card shows the database name, backend type, and status dot.
2. **Drop `dataset_count` from the backend response.** `backend/app/api/databases.py:_build_response()` — remove the hardcoded `"dataset_count": 0` line. Update `frontend/src/types/database.ts:DatabaseInfo` to remove the `datasetCount` field.
3. **OS-aware Kbd label.** `frontend/src/components/explorer/sql-editor.tsx` — compute `const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)` at the top of the component. Render `<Kbd>⌘</Kbd>` when `isMac`, `<Kbd>Ctrl</Kbd>` otherwise. Keep the `<Kbd>↵</Kbd>`. The underlying Monaco keybinding (`monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter`) is already OS-aware — only the display label was lying.

### Unit 2 — Persistent connection status

**Backend-only changes. Files:**
- `backend/app/api/databases.py`
- `backend/app/main.py` (lifespan)
- `backend/app/services/connection_status.py` (optional — add a helper for "mark in DB")

**Three behavior changes:**

**(2a) Create-time auto-test.** In `create_database`:

```python
# existing:
session.add(connection)
try:
    session.flush()
except IntegrityError: ...

# NEW: after flush succeeds, test the connection
uri = build_sync_uri(
    backend=body.backend,
    host=body.host or "",
    port=port,
    database=body.database,
    username=body.username,
    password=body.password or "",
)
success, message = EngineManager.test_connection(uri, body.backend, timeout=10)
connection.status = "connected" if success else "unreachable"
connection.last_tested_at = datetime.now(timezone.utc)
session.flush()

# Then the existing resolver.invalidate call...
```

Response includes the real status. Frontend sees it immediately.

**(2b) Startup sweep.** In `main.py` lifespan, after pre-warming engines:

```python
# NEW: startup health-check sweep
import concurrent.futures
from datetime import datetime, timezone

logger.info("Running startup health-check sweep...")
sweep_start = datetime.now(timezone.utc)
with session_factory() as session:
    rows = session.execute(select(RecvizConnection)).scalars().all()
    connections_to_check = list(rows)

def check_one(conn: RecvizConnection) -> tuple[str, bool, str]:
    try:
        password = encryption.decrypt(conn.encrypted_password)
        uri = build_sync_uri(
            backend=conn.backend, host=conn.host, port=conn.port,
            database=conn.database_name, username=conn.username, password=password,
        )
        success, msg = EngineManager.test_connection(uri, conn.backend, timeout=10)
        return (conn.id, success, msg)
    except Exception as exc:
        return (conn.id, False, str(exc))

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(check_one, connections_to_check))

with session_factory() as session:
    now = datetime.now(timezone.utc)
    for conn_id, success, msg in results:
        session.execute(
            update(RecvizConnection)
            .where(RecvizConnection.id == conn_id)
            .values(
                status="connected" if success else "unreachable",
                last_tested_at=now,
            )
        )
    session.commit()

duration = (datetime.now(timezone.utc) - sweep_start).total_seconds()
connected_count = sum(1 for _, ok, _ in results if ok)
logger.info(
    "Startup sweep done in %.1fs: %d connected, %d unreachable",
    duration, connected_count, len(results) - connected_count,
)
```

**(2c) Test-endpoint updates the DB.** In `test_connection` handler, when `body.database_id` is set, also update the row:

```python
if tracker and body.database_id is not None:
    if success:
        tracker.mark_connected(body.database_id)
    else:
        tracker.mark_unreachable(body.database_id)
    # NEW: also persist to DB
    # (Need a session here — add DbSessionDep parameter to test_connection)
    session.execute(
        update(RecvizConnection)
        .where(RecvizConnection.id == body.database_id)
        .values(
            status="connected" if success else "unreachable",
            last_tested_at=datetime.now(timezone.utc),
        )
    )
```

**(2d) Read path change.** `GET /api/databases:list_databases` and `GET /api/databases/{db_id}:get_database` currently read status from the in-memory tracker via `tracker.get_status(conn.id)`. Change to read from `conn.status` column directly:

```python
def _build_response(conn: RecvizConnection) -> dict:
    return {
        "id": conn.id,
        "database_name": conn.display_name,
        "backend": conn.backend,
        "created_on": conn.created_at.isoformat() if conn.created_at else None,
        "expose_in_sqllab": True,
        "status": conn.status,
        "last_tested": conn.last_tested_at.isoformat() if conn.last_tested_at else None,
    }
```

Note: this also drops `dataset_count` as specified in Unit 4.

**New tests:** `backend/tests/test_connection_status.py` — unit tests for the three write paths + the read path.

### Unit 3a — Schema introspection API

**Goal:** backend endpoints that return table and column lists for a given connection by querying the live database's data dictionary.

**File:** `backend/app/api/databases.py` (new endpoints added to existing router)

**Endpoint 1:** `GET /api/databases/{db_id}/tables`

```python
@router.get("/{db_id}/tables")
def list_tables(
    db_id: str,
    session: DbSessionDep,
    engine_manager: EngineManagerDep,
) -> list[dict]:
    """List tables and views in the connection's configured schema."""
    # Look up the connection
    conn = session.execute(
        select(RecvizConnection).where(RecvizConnection.id == db_id)
    ).scalar_one_or_none()
    if conn is None:
        raise HTTPException(404, f"Database '{db_id}' not found")

    if not conn.schema_name:
        raise HTTPException(
            400,
            "Connection has no schema configured. Edit the data source and set "
            "the Schema field to the Oracle owner / PostgreSQL schema name.",
        )

    engine = engine_manager.get_engine_for_connection(conn)

    # Dialect-specific introspection
    if conn.backend == "oracle":
        sql = text("""
            SELECT table_name AS name, 'TABLE' AS type
            FROM all_tables WHERE owner = UPPER(:schema)
            UNION ALL
            SELECT view_name AS name, 'VIEW' AS type
            FROM all_views WHERE owner = UPPER(:schema)
            ORDER BY 1
        """)
    elif conn.backend == "postgresql":
        sql = text("""
            SELECT table_name AS name, table_type AS type
            FROM information_schema.tables
            WHERE table_schema = :schema
              AND table_type IN ('BASE TABLE', 'VIEW')
            ORDER BY table_name
        """)
    else:
        raise HTTPException(400, f"Schema introspection not supported for backend '{conn.backend}'")

    try:
        with engine.connect() as db_conn:
            result = db_conn.execute(sql, {"schema": conn.schema_name})
            rows = result.fetchall()
    except Exception as exc:
        logger.warning("Schema introspection failed for %s: %s", db_id, exc)
        raise HTTPException(
            503,
            f"Failed to query schema catalog: {sanitize_detail(exc)}",
        )

    return [{"name": r[0], "type": r[1]} for r in rows]
```

**Endpoint 2:** `GET /api/databases/{db_id}/tables/{table_name}/columns`

```python
TABLE_NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_$#]{0,29}$")

@router.get("/{db_id}/tables/{table_name}/columns")
def list_table_columns(
    db_id: str,
    table_name: str,
    session: DbSessionDep,
    engine_manager: EngineManagerDep,
) -> list[dict]:
    """List columns for a specific table/view in the connection's schema."""
    if not TABLE_NAME_RE.match(table_name):
        raise HTTPException(400, "Invalid table name")

    conn = session.execute(
        select(RecvizConnection).where(RecvizConnection.id == db_id)
    ).scalar_one_or_none()
    if conn is None:
        raise HTTPException(404, f"Database '{db_id}' not found")

    if not conn.schema_name:
        raise HTTPException(400, "Connection has no schema configured")

    engine = engine_manager.get_engine_for_connection(conn)

    if conn.backend == "oracle":
        sql = text("""
            SELECT column_name AS name, data_type AS type, nullable
            FROM all_tab_columns
            WHERE owner = UPPER(:schema) AND table_name = UPPER(:table)
            ORDER BY column_id
        """)
    elif conn.backend == "postgresql":
        sql = text("""
            SELECT column_name AS name, data_type AS type, is_nullable AS nullable
            FROM information_schema.columns
            WHERE table_schema = :schema AND table_name = :table
            ORDER BY ordinal_position
        """)
    else:
        raise HTTPException(400, f"Schema introspection not supported for backend '{conn.backend}'")

    try:
        with engine.connect() as db_conn:
            result = db_conn.execute(sql, {"schema": conn.schema_name, "table": table_name})
            rows = result.fetchall()
    except Exception as exc:
        logger.warning("Column introspection failed for %s.%s: %s", db_id, table_name, exc)
        raise HTTPException(503, f"Failed to query column catalog: {sanitize_detail(exc)}")

    def normalize_nullable(raw) -> bool:
        if isinstance(raw, bool):
            return raw
        if isinstance(raw, str):
            return raw.upper() in ("Y", "YES", "TRUE", "T")
        return True

    return [
        {"name": r[0], "type": r[1], "nullable": normalize_nullable(r[2])}
        for r in rows
    ]
```

**Security notes:**
- `:table_name` is validated by regex before being passed as a bind parameter
- `:schema` is not user-supplied per request — it comes from `conn.schema_name`, set once at connection-creation time by a trusted admin
- Both queries use SQLAlchemy bind parameters (`text(...).execute(..., {...})`), not string interpolation
- Errors are wrapped in `sanitize_detail` before being returned to the client

**New tests:** `backend/tests/test_schema_introspection.py` — unit tests for both endpoints using a mock engine.

### Unit 3b — Schema browser rewrite

**Goal:** replace the dead `useDatasets`-based schema browser with a real Oracle introspection UI, lazy-loaded.

**Files:**
- `frontend/src/hooks/use-tables.ts` — **new** hook wrapping `GET /api/databases/{id}/tables`
- `frontend/src/hooks/use-table-columns.ts` — **new** hook wrapping `GET /api/databases/{id}/tables/{name}/columns`, enabled only when table is expanded
- `frontend/src/components/explorer/schema-browser.tsx` — **full rewrite**

**New component shape:**

```tsx
export function SchemaBrowser({ onInsertTable, onInsertColumn }: SchemaBrowserProps) {
  const { data: databases = [] } = useDatabases()
  const [selectedDbId, setSelectedDbId] = useState<string>('')
  // auto-select first database if none selected
  useEffect(() => {
    if (!selectedDbId && databases.length > 0) setSelectedDbId(databases[0].id)
  }, [databases, selectedDbId])

  const { data: tables, isLoading } = useTables(selectedDbId || null)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const filteredTables = useMemo(() => {
    if (!tables) return []
    if (!search.trim()) return tables
    const q = search.toLowerCase()
    return tables.filter((t) => t.name.toLowerCase().includes(q))
  }, [tables, search])

  return (
    <div className="flex flex-col h-full border-r">
      {/* Header */}
      <div className="px-3 py-2.5 border-b bg-muted/40 shrink-0">...</div>

      {/* Database selector */}
      <Select value={selectedDbId} onValueChange={setSelectedDbId}>
        <SelectTrigger>...</SelectTrigger>
        <SelectContent>
          {databases.map((db) => (
            <SelectItem key={db.id} value={db.id}>{db.databaseName}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Search */}
      <Input placeholder="Filter tables..." value={search} onChange={...} />

      {/* Tree */}
      <ScrollArea className="flex-1">
        {filteredTables.map((tbl) => (
          <ExpandableTable
            key={tbl.name}
            dbId={selectedDbId}
            table={tbl}
            expanded={expanded.has(tbl.name)}
            onToggle={() => toggle(tbl.name)}
            onInsertTable={onInsertTable}
            onInsertColumn={onInsertColumn}
          />
        ))}
      </ScrollArea>
    </div>
  )
}

function ExpandableTable({ dbId, table, expanded, onToggle, ... }) {
  // Only fetches columns when `expanded === true`
  const { data: columns } = useTableColumns(dbId, expanded ? table.name : null)
  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <CollapsibleTrigger>{table.name}</CollapsibleTrigger>
      <CollapsibleContent>
        {columns?.map((col) => (
          <button onClick={() => onInsertColumn(col.name)}>{col.name} ({col.type})</button>
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}
```

**Hook shape:**

```typescript
// use-tables.ts
export function useTables(dbId: string | null) {
  return useQuery({
    queryKey: ['tables', dbId],
    queryFn: () => api.get<SchemaTable[]>(`/api/databases/${dbId}/tables`),
    enabled: dbId !== null,
    staleTime: 5 * 60 * 1000,
  })
}

// use-table-columns.ts
export function useTableColumns(dbId: string | null, tableName: string | null) {
  return useQuery({
    queryKey: ['columns', dbId, tableName],
    queryFn: () => api.get<SchemaColumn[]>(
      `/api/databases/${dbId}/tables/${tableName}/columns`
    ),
    enabled: dbId !== null && tableName !== null,
    staleTime: 5 * 60 * 1000,
  })
}
```

**New test:** `frontend/src/components/explorer/schema-browser.test.tsx` — renders with mocked hooks, simulates expand, asserts column hook fires.

### Unit 5 — Dead-code cleanup

Four deletions (safe only after Unit 3b lands):

1. **Delete `frontend/src/hooks/use-datasets.ts`** — only caller was old schema-browser, replaced in Unit 3b
2. **Delete `frontend/src/hooks/use-dataset.ts`** — zero callers confirmed via grep
3. **Delete `backend/app/api/export.py`** — zero callers confirmed
4. **Remove `export_router` from `backend/app/api/router.py`** (the include line)

Optional: delete `frontend/src/types/dataset.ts` if it's only used by the two deleted hooks. Verify before delete.

**Explicitly NOT deleted** (referenced by `project_broken_dashboard_pipeline.md`):
- `api/data_sources.py`, `services/config_store.py`, `services/query_engine.py` (shared with dashboard pipeline), `models/data_source_config.py`, `db/models/data_source.py` (RecvizDataSource ORM)
- `api/views.py` (still used by Settings saved-views tab)
- `recviz_data_sources` table in Oracle (empty but referenced by dashboard pipeline code)

### Unit 7 — Final review + verification + tarball

1. Dispatch `feature-dev:code-reviewer` across the entire deploy branch diff since commit `59f32ae` (the call_timeout fix — last commit before this spec's work begins).
2. Fix any blocker/high findings inline.
3. `pytest tests/` → zero errors
4. `pnpm build` → succeeds (not `pnpm exec vite build` — the full `tsc -b && vite build` must pass)
5. Stage the tarball at `~/recviz-deploy-v6-ui-fixes.tar.gz` with backend + frontend/dist + scripts
6. Hand off to the user for server-side verification against the success criteria

## 5. Data flows

### 5.1 Flow A — create data source with instant status

```
User clicks "Add" in Settings → Data Sources
  ↓
POST /api/databases { backend, host, port, database, username, password, schemaName }
  ↓
encrypt(password)
  ↓
session.add(RecvizConnection(..., status='untested', last_tested_at=None))
  ↓
session.flush()   ← row has UUID, unique constraint enforced
  ↓
test_connection(uri, backend, timeout=10)
  ↓
  success → conn.status = 'connected', conn.last_tested_at = now()
  failure → conn.status = 'unreachable', conn.last_tested_at = now()
  ↓
session.flush()   ← write status back
  ↓
resolver.invalidate(session)
  ↓
return DatabaseInfo with real status
  ↓
Frontend: TanStack Query invalidates ['databases']
  ↓
DataSourceCard renders with green (or red) dot immediately
```

### 5.2 Flow B — backend startup sweep

```
FastAPI lifespan starts
  ↓
(existing) ConnectionStatusTracker, EncryptionService, EngineManager
  ↓
(existing) Pre-warm engines
  ↓
NEW: Startup health sweep
  ↓
SELECT * FROM recviz_connections   (sync session)
  ↓
ThreadPoolExecutor(max_workers=4) maps check_one() over all connections
  ↓
each check_one: decrypt password → build_sync_uri → test_connection(timeout=10)
  ↓
UPDATE recviz_connections SET status=..., last_tested_at=... (bulk)
  ↓
commit
  ↓
log "Startup sweep done in 3.2s: 2 connected, 1 unreachable"
  ↓
(existing) ConnectionResolver.sync, QueryExecutor init
  ↓
yield to FastAPI
```

### 5.3 Flow C — schema browser lazy expand

```
User opens Data Explorer
  ↓
useDatabases() → GET /api/databases → dropdown populated
  ↓
User selects a database (or first one auto-selected)
  ↓
useTables(dbId) → GET /api/databases/{dbId}/tables
  ↓
Backend: EngineManager.get_engine_for_connection(conn)   [cached after first call]
  ↓
SELECT ... FROM all_tables WHERE owner = UPPER(:schema) UNION ALL ... all_views ...
  ↓
Returns [{name, type}, ...] — <1s typical
  ↓
Schema browser renders scrollable list with filter input
  ↓
User clicks a table row → expanded.add(tableName)
  ↓
useTableColumns(dbId, tableName) fires (enabled = table is expanded)
  ↓
GET /api/databases/{dbId}/tables/{tableName}/columns
  ↓
Backend: same engine, SELECT ... FROM all_tab_columns WHERE ... ORDER BY column_id
  ↓
Returns [{name, type, nullable}, ...] — <1s typical
  ↓
Collapsible expands, shows column list with types
```

### 5.4 Flow D — Run Query with string IDs

```
Before (broken):
  user clicks Run Query
    ↓
  handleRunQuery() { const dbId = Number(databaseId); if (!dbId) return }
    ↓
  databaseId = "a1b2c3d4-..." → Number() = NaN → !NaN = true → return
    ↓
  nothing happens

After (fixed):
  user clicks Run Query
    ↓
  handleRunQuery() { if (!databaseId || !sql.trim() || isPending) return }
    ↓
  sqlExecute.mutate({ sql, databaseId, limit: 1000 })   ← string passed through
    ↓
  POST /api/sql/execute { sql, database_id: "a1b2c3d4-...", limit: 1000 }
    ↓
  backend SELECT ... FROM recviz_connections WHERE id = 'a1b2c3d4-...'
    ↓
  engine.execute(text(sql))
    ↓
  Returns {columns, rows, rowCount}
    ↓
  Frontend renders preview grid
```

## 6. Error handling

### Backend

| Error | Source | Handling |
|---|---|---|
| `ORA-00942: table or view does not exist` on data dictionary | Schema introspection | Wrap in HTTPException(503, "Schema catalog not accessible — check grants") |
| `test_connection` failure during create | `create_database` | Row stays with status='unreachable', response 201, message includes failure detail |
| Any exception per-connection in startup sweep | `lifespan` | Caught, logged as warning, continue. Never blocks startup. |
| Invalid table name in `/columns` endpoint | Regex validation | HTTPException(400, "Invalid table name") |
| Connection `schema_name` empty | Schema introspection | HTTPException(400, "Connection has no schema configured") |
| Engine acquisition failure | `EngineManager.get_engine_for_connection` | Existing `OperationalError`/`DBAPIError` path |

### Frontend

| Error | Component | Handling |
|---|---|---|
| `useTables` fails (4xx/5xx) | Schema browser | Global TanStack Query error handler fires toast via `ApiError.userMessage`; browser shows "Failed to load tables" empty state |
| `useTableColumns` fails | Expanded table row | Inline error badge next to the table name, rest of browser unaffected |
| `useTables` returns empty array | Schema browser | "No tables in schema '<name>'" message |
| `test_connection` returns unreachable during create | Settings sheet | Save succeeds (201), card shows red dot, toast shows reason |

All errors are sanitized at the backend via `sanitize_detail()` — no stack traces or credential leaks to the client. Full tracebacks go to `backend.err`.

## 7. Testing strategy

### 7.1 Tests to delete (broken pre-existing)

Verified via `pytest --collect-only` and `tsc --noEmit` before deletion in Unit 0:

| File | Reason | Recoverable? |
|---|---|---|
| `backend/tests/test_query_engine.py` | `ConfigStore.__init__(session)` signature changed; tests use old signature | Rewriting would require understanding the new ConfigStore contract — defer |
| `backend/tests/test_config_store.py` | Same | Defer |
| `backend/tests/test_dataset_sync.py` | `dataset_sync.py` service file was deleted with Superset; tests reference a module that no longer exists | Delete, no value in keeping |
| `frontend/src/components/dashboard/grid-toolbar.test.tsx` | Unused React import + unused vars — pre-existing tsc errors | Could fix in a trivial cleanup, but easier to delete if the tests aren't covering anything critical |
| `frontend/src/routes/embed/dashboards/$dashboardId.test.tsx` | Missing JSX namespace — pre-existing tsc error | Delete |
| `frontend/src/components/explorer/chart-builder-dialog.tsx` | NOT a test — has 6 type errors. Check if actually used; delete file or fix | Check usage first, then decide |

**Deletion rule:** if the thing being tested no longer exists (e.g. `dataset_sync.py`), delete. If the test is fixable in <5 minutes, fix. Otherwise delete.

### 7.2 Tests to add (new code coverage)

**Backend:**
- `backend/tests/test_schema_introspection.py` (~5 tests)
  - GET /api/databases/{id}/tables with Oracle mock → returns expected shape
  - GET with missing `schema_name` → 400
  - GET with invalid table_name regex → 400
  - GET /columns with Oracle mock → returns expected shape with normalized nullable
  - GET with introspection SQL error → 503 with sanitized detail
- `backend/tests/test_connection_status.py` (~4 tests)
  - `create_database` with successful test → row has `status='connected'`, `last_tested_at` set
  - `create_database` with failed test → row has `status='unreachable'` but still saved
  - `test_connection` endpoint with `database_id` → row updated in DB
  - Startup sweep (simulated) → all connections get a status write

**Frontend:**
- `frontend/src/components/explorer/schema-browser.test.tsx` (~3 tests)
  - Renders database dropdown, auto-selects first
  - Clicking a table row fires `useTableColumns` with correct args
  - Filter input narrows visible table list

### 7.3 Code review gates

After **every** unit commit:
1. Stage the diff
2. Dispatch `feature-dev:code-reviewer` agent with:
   - The unit's section from this spec as context
   - `git diff <previous-commit>..HEAD` as the scope
   - Instruction: "review for bugs, missed spots, security issues, and test coverage gaps"
3. Fix all **blocker** and **high** findings inline before starting the next unit
4. **Medium** and **low** findings get batched for Unit 7's final cleanup pass

After **Unit 7**:
1. Full review across the entire deploy branch diff since commit `59f32ae` (the last commit before this spec's work)
2. Fix all blockers
3. Document any remaining medium/low findings in the final commit message

## 8. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Startup sweep slows boot | Low | Medium | 10s per-connection timeout, bounded 4-worker pool, log duration for visibility |
| Oracle grants insufficient for `all_tables` | Medium | High (blocks schema browser) | Return helpful error message suggesting the user check SELECT grants on `all_tables` |
| `test_connection` hangs during create, user sees long spinner | Low | Low | 10s `pool_timeout` bounds the wait; after timeout, row saves with 'unreachable' |
| Broken-test deletion removes something load-bearing | Low | Medium | Verify via `pytest --collect-only` and `tsc --noEmit` BEFORE deletion; cross-reference with current code; delete only after confirmation |
| Code review finds cascading issues mid-rollout | Medium | Medium | Fix blockers between units rather than at the end — prevents compound rework |
| `navigator.userAgent` regex misidentifies an edge browser | Very low | Cosmetic only | Default to Windows/Linux display is fine; worst case Mac users see "Ctrl" briefly |
| Schema browser triggers thundering herd on Oracle if user rapidly clicks 30 tables | Low | Low | TanStack Query deduplicates concurrent same-key requests; browser limits ~6 concurrent per origin |

## 9. Success criteria

All of the following must be true for the rollout to be considered done:

**Build health:**
- [ ] `cd backend && pytest tests/` → 0 errors, 0 failures
- [ ] `cd frontend && pnpm build` (full `tsc -b && vite build`, not the `vite build` bypass) → succeeds
- [ ] Backend starts cleanly and logs a line matching "Startup sweep done in Ns: X connected, Y unreachable"

**Functional (browser verification):**
- [ ] Settings → Data Sources card no longer displays "N tables"
- [ ] Status dot reflects real DB reachability after a cold restart, not stuck on "untested"
- [ ] Creating a new data source shows immediate green dot if the connection is reachable
- [ ] Data Explorer → schema browser shows a dropdown of real databases, not a hardcoded "recon_data" label
- [ ] Selecting a database loads real Oracle tables from the connected schema
- [ ] Clicking a table expands to show its real columns within ~1 second
- [ ] Navigate Data Explorer → Reports → no 404 in network tab, no error toast
- [ ] Datasets → Create Dataset → select connection → write SQL → Run Query produces a preview
- [ ] Ctrl+Enter on Windows runs the query
- [ ] SQL editor Kbd label shows `Ctrl+↵` on Windows, `⌘+↵` on Mac
- [ ] Save Dataset persists a row to `recviz_datasets`

**Database state (verified via SQL Developer):**
- [ ] `SELECT status, last_tested_at FROM recviz_connections` returns real values, not defaults

**Code health:**
- [ ] Final code review finds zero blocker severity findings
- [ ] `grep -r 'Number(databaseId)' frontend/src/` → no matches
- [ ] `grep -r '/api/datasets\b' frontend/src/` → no matches (only `/api/datasets/managed`)
- [ ] `ls backend/app/api/export.py` → file not found

## 10. Rollout

Same transport cycle as previous tarballs:

1. Build + verify `~/recviz-deploy-v6-ui-fixes.tar.gz` on the laptop
2. Transfer: laptop → Citi laptop → scp to server
3. On server:
   ```bash
   bash /opt/rectify/rectrace/recviz/app/scripts/stop-all.sh
   cd /opt/rectify/rectrace/recviz
   rm -rf app/backend app/frontend
   cd app && tar xzf /tmp/recviz-deploy-v6-ui-fixes.tar.gz backend frontend
   # (venv rebuild NOT needed — no requirements changes in this spec)
   bash /opt/rectify/rectrace/recviz/app/scripts/start-all.sh
   ```
4. Run the success criteria checklist in the browser

**No `.env` changes. No new Alembic migrations. No new Python dependencies.** Just code.

## 11. Out of scope (carried forward)

- **Broken dashboard rendering pipeline** — tracked in `project_broken_dashboard_pipeline.md` memory. The `recviz_data_sources` table is never written to, but the dashboard renderer still reads from it. Any dashboard the user builds will 404 at render time. This is a separate architectural refactor — two options (rewrite dashboard pipeline to use `recviz_datasets`, or add a shim that populates both tables) will be evaluated in a future session.
- **`api/views.py` saved-views** — still in-memory stub. Leave alone.
- **`recviz_data_sources` table** — empty but still code-referenced. Do not drop.
- **Authentication** — still deferred per the original deployment spec.

## 12. References

- `docs/superpowers/specs/2026-04-09-rhel-oracle-no-sudo-deployment-design.md` — initial deployment
- `backend/app/api/databases.py` — target of Unit 2 changes + Unit 3a new endpoints
- `backend/app/main.py` — target of Unit 2 lifespan changes
- `backend/app/db/models/connection.py` — `RecvizConnection` ORM with `status`, `last_tested_at` columns
- `backend/app/migrations/versions/005_add_connections_portable_json.py` — where the status columns were added (already applied on server)
- `frontend/src/components/datasets/dataset-editor.tsx` — target of Unit 1 string-ID fixes
- `frontend/src/components/explorer/schema-browser.tsx` — target of Unit 3b rewrite
- `project_broken_dashboard_pipeline.md` (memory) — why we're not touching the data-sources pipeline

---

**End of spec. Next: invoke the `writing-plans` skill to produce the task-by-task implementation plan.**
