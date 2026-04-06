# Phase 5: Dataset Management - Research

**Researched:** 2026-04-06
**Domain:** Full-stack CRUD (FastAPI + SQLAlchemy + Superset sync + React SPA)
**Confidence:** HIGH

## Summary

Phase 5 introduces RecViz-managed datasets -- SQL queries with rich column metadata stored in PostgreSQL and synced to Superset as virtual datasets for query execution. The architecture is a hybrid: RecViz DB is the source of truth (storing SQL, name, column metadata), and Superset holds the synced virtual dataset used for caching/query execution via its chart data API.

The backend work involves a new `recviz_datasets` table (Alembic migration 002), a `RecvizDataset` SQLAlchemy model, CRUD endpoints under `/api/datasets/managed/` (namespaced to avoid collision with the existing Superset proxy endpoints), a `DatasetSyncService` modeled after `DatabaseRegistrar`, and extension of `SupersetClient` with `create_dataset()`, `update_dataset()`, `delete_dataset()` methods. The frontend work involves a dataset list page (`/datasets`), a dedicated editor page (`/datasets/:id/edit` and `/datasets/new`), a column metadata AG Grid with inline editing, a "Save as Dataset" dialog in the Explorer, and sidebar navigation update.

**Primary recommendation:** Build backend CRUD + Superset sync first, then dataset list UI, then dataset editor with column metadata -- each vertically testable. Reuse existing patterns (DatabaseRegistrar for sync, DataSourcesTab for list UI, SqlEditor/QueryResults for editor).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Two creation entry points: (1) SQL Explorer "Save as Dataset" button for quick creation after running a query, and (2) dedicated dataset editor page in create mode (from Datasets list "+ New Dataset" button) for starting from scratch.
- **D-02:** Explorer quick-save captures name, description, and database only. Column metadata is auto-detected with smart defaults. Dev refines metadata later in the dedicated editor.
- **D-03:** Database selector inherits from Explorer context (auto-selects the database used for the query). In the dedicated editor, a dropdown shows all configured connections.
- **D-04:** Dedicated dataset editor is a full page (`/datasets/:id/edit` or `/datasets/new`). Provides room for Monaco editor, results preview, and column metadata table side by side.
- **D-05:** Editing SQL requires re-running the query before saving. Changing SQL invalidates the column list -- prevents broken datasets from silently propagating to charts.
- **D-06:** No draft/published state. Saved = immediately available to chart builders. Keep it simple -- devs are technical and won't save broken datasets.
- **D-07:** Datasets have name and description (no tags). Description shown in the dataset list and chart builder picker.
- **D-08:** Deleting a dataset that's referenced by existing charts is blocked. UI shows which charts reference it. Dev must remove chart references first.
- **D-09:** One dataset = one SQL query + one database. No multi-database datasets.
- **D-10:** Editable AG Grid table below query results in the dedicated editor. Columns: Name (read-only), Display Name, Type, Role, Aggregation, Format. All cells inline-editable via click. Role/Type/Agg use dropdown selectors. Format uses preset dropdown + custom text input.
- **D-11:** Smart auto-detection on first query run: auto-detect type from data (string/number/date), guess role based on naming patterns (columns named `*_date`/`*_time` -> time, numeric columns -> measure, string columns -> dimension). Display name = capitalize + replace underscores with spaces.
- **D-12:** Standard aggregation functions: SUM, AVG, COUNT, MIN, MAX, COUNT DISTINCT.
- **D-13:** Format string via preset dropdown + custom option. Presets: Number, Currency, Percentage, Decimal2, Date, DateTime. Custom option accepts Intl.NumberFormat or date-fns format strings.
- **D-14:** Column ordering follows SQL SELECT clause order. Dev controls order by changing the query.
- **D-15:** All query columns are exposed -- no visibility toggle.
- **D-16:** When SQL is re-run and columns change: merge with diff. New columns get auto-detected defaults. Removed columns are flagged as "missing" (red highlight).
- **D-17:** Results preview has a "Show formatted" toggle. Default shows raw query values.
- **D-18:** Default aggregation is optional -- defaults to "None". Chart builder can override.
- **D-19:** Hybrid with sync. RecViz PostgreSQL database is the source of truth. On save, dataset syncs to Superset as a virtual dataset.
- **D-20:** Sync happens on save -- immediately. If Superset sync fails, save still succeeds in RecViz DB but dataset is flagged as "unsynced". Background retry or manual re-sync available.
- **D-21:** Startup reconciliation -- on app start, compare RecViz datasets vs Superset datasets. Re-sync any that are missing or out of date.
- **D-22:** RecViz UUIDs as primary references everywhere. Superset dataset ID stored as `superset_id` (nullable).
- **D-23:** Dedicated columns in `recviz_datasets` table with JSONB for column metadata.
- **D-24:** Test-execute preview queries go through Superset SQL Lab (reuse existing `/api/sql/execute` endpoint).
- **D-25:** Top-level "Datasets" nav item in the sidebar, same level as Dashboards and Explorer.
- **D-26:** Dataset list page with grid + list toggle (reuse Phase 4 DataSourcesTab pattern).
- **D-27:** No SQL preview in list view.
- **D-28:** Search + database filter on the list page.
- **D-29:** Sync status shown only on error.
- **D-30:** "+ New Dataset" button on list page opens the dedicated editor in create mode.

### Claude's Discretion
- Dataset card and row component design details (spacing, typography, hover states)
- DatasetSyncService implementation details (retry strategy, reconciliation algorithm)
- Column metadata JSONB schema structure
- Alembic migration specifics for recviz_datasets table
- Monaco editor configuration in the dedicated editor (reuse from Explorer or separate instance)
- How "Save as Dataset" dialog looks in the Explorer (likely a simple form dialog)
- Error handling for failed syncs (toast notification, inline banner, etc.)
- Dataset editor page layout proportions (editor height vs results vs metadata)

### Deferred Ideas (OUT OF SCOPE)
- Multi-database datasets
- Reusable query templates
- Dataset tags
- Column visibility toggle
- Extended aggregation functions (MEDIAN, PERCENTILE, STDDEV, VARIANCE)
- Custom SQL aggregation expressions
- Draft/published workflow
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DSET-01 | Dev team can create a dataset by writing SQL, naming it, and saving it with column metadata | Backend CRUD endpoints + SQLAlchemy model + Superset sync; Frontend dataset editor page with Monaco SQL editor |
| DSET-02 | Each dataset column has configurable metadata: friendly display name, data type, role, default aggregation, format string | JSONB column metadata schema in `recviz_datasets` table; AG Grid Enterprise inline editing with dropdown cell editors |
| DSET-03 | Dev team can test-execute a dataset query from the editor and preview results before publishing | Reuse existing `/api/sql/execute` endpoint and `useSqlExecute` hook; QueryResults component in dataset editor |
| DSET-04 | Dev team can edit and delete existing datasets | PUT/DELETE endpoints; edit page route; delete-check endpoint that queries chart references |
| DSET-05 | Datasets are persisted to database (not JSON files on disk) | Alembic migration 002 for `recviz_datasets` table in PostgreSQL; SQLAlchemy async model |
</phase_requirements>

## Standard Stack

### Core (Already in Project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLAlchemy | 2.0.49 | Async ORM for `recviz_datasets` model | Already in project, JSONB support, async sessions [VERIFIED: pip show] |
| Alembic | 1.18.4 | Database migration for new table | Already in project, uses `recviz_alembic_version` table [VERIFIED: pip show] |
| asyncpg | 0.31.0 | PostgreSQL async driver | Already in project [VERIFIED: pip show] |
| FastAPI | 0.115+ | REST API endpoints | Already in project [VERIFIED: codebase] |
| Pydantic | v2 | Request/response validation | Already in project, CamelModel base [VERIFIED: codebase] |
| AG Grid Enterprise | 35.0.1 | Column metadata inline editor + results preview | Already in project, inline editing built-in [VERIFIED: package.json] |
| @monaco-editor/react | ^4.7.0 | SQL editor in dataset editor page | Already in project, reuse SqlEditor component [VERIFIED: package.json] |
| TanStack Query | ^5.90.20 | Server state for dataset CRUD | Already in project [VERIFIED: package.json] |
| TanStack Router | ^1.159.5 | File-based routing for dataset pages | Already in project [VERIFIED: package.json] |
| date-fns | ^4.1.0 | Relative timestamps (formatDistanceToNow) on dataset cards | Already in project [VERIFIED: package.json] |
| motion | ^12.34.0 | Page transitions, banner animations | Already in project (`motion/react` import) [VERIFIED: package.json] |
| zustand | ^5.0.11 | NOT needed for this phase -- all state is server-side via TanStack Query | N/A |

### No New Dependencies

This phase requires **zero new npm or pip packages**. Everything is already in the project. The dataset editor composes existing components (Monaco, AG Grid, Shadcn) and the backend follows established SQLAlchemy + Alembic patterns.

## Architecture Patterns

### Backend: New Files

```
backend/app/
├── api/
│   └── managed_datasets.py          # NEW: CRUD endpoints for RecViz-managed datasets
├── db/models/
│   └── dataset.py                    # NEW: RecvizDataset SQLAlchemy model
├── models/
│   └── managed_dataset.py            # NEW: Pydantic request/response models
├── services/
│   └── dataset_sync.py               # NEW: DatasetSyncService (Superset sync)
├── migrations/versions/
│   └── 002_add_datasets.py           # NEW: Alembic migration
└── migrations/
    └── env.py                        # MODIFY: import RecvizDataset model
```

### Frontend: New Files

```
frontend/src/
├── routes/_app/datasets/
│   ├── index.tsx                     # NEW: Dataset list page
│   ├── new.tsx                       # NEW: Dataset create page
│   └── $datasetId.edit.tsx           # NEW: Dataset edit page
├── components/datasets/
│   ├── dataset-list.tsx              # NEW: List with grid/list toggle
│   ├── dataset-list-toolbar.tsx      # NEW: Search + filter + view toggle
│   ├── dataset-card.tsx              # NEW: Grid view card
│   ├── dataset-row.tsx               # NEW: List view row
│   ├── dataset-editor.tsx            # NEW: Full editor (Monaco + results + metadata)
│   ├── column-metadata-grid.tsx      # NEW: AG Grid inline editing for column metadata
│   ├── format-preset-select.tsx      # NEW: Preset dropdown + custom input
│   ├── dataset-sql-rerun-banner.tsx  # NEW: Warning banner (D-05)
│   └── delete-dataset-dialog.tsx     # NEW: Delete confirmation/blocked dialog
├── components/explorer/
│   └── save-as-dataset-dialog.tsx    # NEW: Quick-save dialog from Explorer
├── hooks/
│   └── use-managed-datasets.ts       # NEW: CRUD hooks for RecViz-managed datasets
├── types/
│   └── managed-dataset.ts            # NEW: TypeScript types (extended from UI-SPEC)
└── components/layout/
    └── nav-main.tsx                  # MODIFY: Add "Datasets" nav item
```

### Modified Files

```
backend/app/
├── api/router.py                     # MODIFY: Add managed_datasets_router
├── main.py                           # MODIFY: Add DatasetSyncService startup reconciliation
├── services/superset_client.py       # MODIFY: Add create/update/delete dataset methods
├── core/dependencies.py              # MODIFY: Add DatasetSyncDep
└── migrations/env.py                 # MODIFY: Import RecvizDataset model

frontend/src/
├── components/layout/nav-main.tsx    # MODIFY: Add Datasets nav item
├── components/explorer/query-results.tsx  # MODIFY: Add "Save as Dataset" button
└── routes/_app/explorer/index.tsx    # MODIFY: Wire SaveAsDatasetDialog
```

### Pattern 1: RecvizDataset SQLAlchemy Model (D-23)

**What:** SQLAlchemy model for the `recviz_datasets` table with JSONB column metadata
**When to use:** All dataset CRUD operations

```python
# Source: Follows RecvizDataSource and RecvizDashboard patterns in codebase
from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base

class RecvizDataset(Base):
    __tablename__ = "recviz_datasets"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str] = mapped_column(String(1024), default="")
    database_id: Mapped[int] = mapped_column(Integer, nullable=False)
    superset_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sql: Mapped[str] = mapped_column(Text, nullable=False)
    columns: Mapped[dict] = mapped_column(JSONB, nullable=False, default=list)
    sync_status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="unsynced"
    )
    schema_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
```
[VERIFIED: follows RecvizDataSource pattern from `backend/app/db/models/data_source.py`]

### Pattern 2: Superset Virtual Dataset Sync (D-19, D-20)

**What:** Create/update virtual datasets in Superset via REST API on save
**When to use:** Every dataset create/update operation

The Superset REST API `POST /api/v1/dataset/` accepts a `sql` field to create virtual datasets directly. [VERIFIED: GitHub source `superset/datasets/schemas.py` DatasetPostSchema includes `sql` as optional string field]

```python
# SupersetClient extension
async def create_dataset(self, payload: dict[str, Any]) -> dict[str, Any]:
    """Create a virtual dataset in Superset.
    
    Payload: {
        "database": <superset_db_id>,  # Note: POST uses "database", not "database_id"
        "table_name": "<dataset_name>",
        "sql": "<sql_query>",
        "schema": "",
    }
    """
    return await self._post("/api/v1/dataset/", json=payload)

async def update_dataset(self, dataset_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    """Update a virtual dataset in Superset.
    
    Payload: {
        "database_id": <superset_db_id>,  # Note: PUT uses "database_id", not "database"
        "table_name": "<dataset_name>",
        "sql": "<sql_query>",
    }
    """
    return await self._request("PUT", f"/api/v1/dataset/{dataset_id}", json=payload)

async def delete_dataset(self, dataset_id: int) -> None:
    await self._request("DELETE", f"/api/v1/dataset/{dataset_id}")
```
[VERIFIED: Superset DatasetPostSchema uses `database` (int), DatasetPutSchema uses `database_id` (int) -- naming mismatch is real and must be handled]

### Pattern 3: DatasetSyncService (D-21, modeled on DatabaseRegistrar)

**What:** Service that syncs RecViz datasets to Superset, with startup reconciliation
**When to use:** App startup and on every dataset save

```python
# Modeled after DatabaseRegistrar.sync() pattern
class DatasetSyncService:
    def __init__(self, superset: SupersetClient, registrar: DatabaseRegistrar):
        self._superset = superset
        self._registrar = registrar

    async def sync_dataset(self, dataset: RecvizDataset) -> int | None:
        """Sync a single dataset to Superset. Returns superset_id or None on failure."""
        db_superset_id = await self._registrar.resolve(dataset.database_name)
        payload = {
            "database": db_superset_id,
            "table_name": dataset.name,
            "sql": dataset.sql,
            "schema": "",
        }
        if dataset.superset_id:
            # Update existing
            await self._superset.update_dataset(dataset.superset_id, {
                "database_id": db_superset_id,
                "table_name": dataset.name,
                "sql": dataset.sql,
            })
            return dataset.superset_id
        else:
            # Create new
            result = await self._superset.create_dataset(payload)
            return result.get("id") or result.get("result", {}).get("id")

    async def reconcile(self, session: AsyncSession) -> None:
        """Startup reconciliation: re-sync any unsynced or missing datasets."""
        # Query all RecViz datasets
        # For each: check if superset_id exists and matches
        # Re-sync any that are missing or out of date
```
[VERIFIED: follows DatabaseRegistrar pattern from `backend/app/services/database_registrar.py`]

### Pattern 4: API Endpoint Namespacing

**What:** Use `/api/datasets/managed/` prefix to avoid collision with existing `/api/datasets` (Superset proxy)
**Why:** The existing `datasets.py` router proxies Superset's dataset list/get/data endpoints at `/api/datasets`. The new managed dataset endpoints need a different prefix.

```python
# backend/app/api/managed_datasets.py
router = APIRouter(prefix="/api/datasets/managed", tags=["managed-datasets"])

@router.get("")            # List all RecViz-managed datasets
@router.post("")           # Create new dataset
@router.get("/{id}")       # Get single dataset
@router.put("/{id}")       # Update dataset
@router.delete("/{id}")    # Delete dataset (with reference check)
@router.get("/{id}/references")  # Check chart references (for delete guard)
```
[ASSUMED: namespacing approach -- alternative is to refactor existing `/api/datasets` endpoints]

### Pattern 5: Column Metadata JSONB Schema

**What:** Structure for the `columns` JSONB field in `recviz_datasets`
**When to use:** Stored in DB, sent to/from frontend

```json
[
  {
    "name": "brk_cnt",
    "display_name": "Brk Cnt",
    "data_type": "number",
    "role": "measure",
    "aggregation": "SUM",
    "format_preset": "number",
    "format_string": "#,###"
  },
  {
    "name": "desk",
    "display_name": "Desk",
    "data_type": "string",
    "role": "dimension",
    "aggregation": "NONE",
    "format_preset": "none",
    "format_string": ""
  }
]
```
[ASSUMED: follows D-23 spec, snake_case for DB storage, camelCase for frontend via CamelModel transform]

### Pattern 6: AG Grid Inline Editing for Column Metadata (D-10)

**What:** AG Grid Enterprise with cell editing for dropdown selectors and text inputs
**When to use:** Column metadata editor in dataset editor page

```typescript
// AG Grid 35.x inline editing pattern [VERIFIED: ag-grid-enterprise 35.0.1]
const columnDefs: ColDef[] = [
  {
    field: 'name',
    headerName: 'Name',
    editable: false,
    cellClass: 'font-mono text-xs',
    width: 120,
  },
  {
    field: 'displayName',
    headerName: 'Display Name',
    editable: true,
    width: 140,
  },
  {
    field: 'dataType',
    headerName: 'Type',
    editable: true,
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: {
      values: ['string', 'number', 'date', 'currency'],
    },
    width: 100,
  },
  {
    field: 'role',
    headerName: 'Role',
    editable: true,
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: {
      values: ['dimension', 'measure', 'time', 'none'],
    },
    width: 100,
  },
  {
    field: 'aggregation',
    headerName: 'Aggregation',
    editable: true,
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: {
      values: ['NONE', 'SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 'COUNT_DISTINCT'],
    },
    width: 120,
  },
]
```
[VERIFIED: AG Grid Enterprise 35.x `agSelectCellEditor` is a built-in provided editor]

### Pattern 7: TanStack Router File-Based Routing

**What:** Dataset pages use file-based routing following existing patterns
**When to use:** New route files for dataset list and editor

```
routes/_app/datasets/
  index.tsx          -> /datasets           (list page)
  new.tsx            -> /datasets/new       (create mode)
  $datasetId.edit.tsx -> /datasets/:id/edit (edit mode)
```

Route component pattern (follows `$dashboardId.tsx`):
```typescript
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/datasets/$datasetId/edit')({
  component: DatasetEditPage,
})

function DatasetEditPage() {
  const { datasetId } = Route.useParams()
  // ...
}
```
[VERIFIED: follows `routes/_app/dashboards/$dashboardId.tsx` pattern]

### Pattern 8: Database ID Resolution for Superset Sync

**What:** RecViz stores database_id as Superset numeric ID (from `DatabaseRegistrar` cache). The sync service needs to resolve this for API calls.
**Critical detail:** The `database_id` stored in RecViz datasets is the Superset numeric ID (from the databases list), since all data sources are registered through Superset. The `DatabaseRegistrar` resolves logical names to Superset IDs, but the dataset editor will use the Superset ID directly from the database selector.

```python
# Frontend sends database_id (Superset numeric ID from useDatabases() hook)
# Backend stores it directly -- no name resolution needed for the database field
# For Superset sync: POST uses "database" key, PUT uses "database_id" key
```
[VERIFIED: `useDatabases()` fetches from `/api/databases` which returns Superset IDs]

### Anti-Patterns to Avoid

- **Storing SQL in JSONB config blob:** Use a dedicated `sql` TEXT column -- SQL can be very long and needs to be queryable/indexable. [VERIFIED: D-23 specifies explicit columns]
- **Proxying dataset reads through Superset:** RecViz DB is the source of truth for metadata. Only use Superset for query execution, not for dataset metadata retrieval.
- **Using the existing `/api/datasets` endpoint for managed datasets:** The existing endpoints are Superset proxies. New managed dataset endpoints need a separate namespace.
- **Deleting Superset dataset without checking RecViz first:** Always delete in RecViz first, then Superset. If Superset delete fails, the orphan can be cleaned up by reconciliation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQL editing | Custom textarea | Monaco Editor (`@monaco-editor/react`) | Syntax highlighting, autocomplete, keybindings already configured in `sql-editor.tsx` |
| Results grid | Custom table | AG Grid Enterprise (reuse `QueryResults`) | Pagination, sorting, filtering, CSV export built-in |
| Inline cell editing | Custom input overlays | AG Grid `agSelectCellEditor` / `agTextCellEditor` | Built-in cell editors with keyboard nav, focus management, undo |
| UUID generation | Custom random strings | `crypto.randomUUID()` (Python: `uuid.uuid4()`) | Guaranteed uniqueness, standard format |
| Relative timestamps | Manual date math | `date-fns.formatDistanceToNow()` | Already in project, handles edge cases |
| Form dialogs | Custom modal | Shadcn Dialog | Accessible, focus trap, keyboard dismiss, animation |
| Number formatting | Custom format functions | `formatValue()` from `lib/formatters.ts` | Phase 1 utility handles number/currency/percentage/decimal |
| Date formatting | Custom date parsing | `date-fns.format()` | Already in project, MMM dd / MMM dd HH:mm patterns |
| Column auto-detection | -- | Build this (simple heuristics) | D-11 rules are straightforward: scan first 10 rows for types, match naming patterns |

**Key insight:** The dataset editor is essentially a composition of existing components (SqlEditor, QueryResults, AG Grid) with new orchestration logic. The only truly new code is the column metadata grid, auto-detection heuristics, column diff/merge logic, and the sync service.

## Common Pitfalls

### Pitfall 1: Superset POST vs PUT Field Naming Mismatch
**What goes wrong:** Superset's POST `/api/v1/dataset/` uses `"database"` (int) for the database ID, but PUT `/api/v1/dataset/{pk}` uses `"database_id"` (int). Using the wrong key silently fails or returns 400.
**Why it happens:** Inconsistent API schema design in Superset (DatasetPostSchema vs DatasetPutSchema).
**How to avoid:** SupersetClient methods must use the correct key for each HTTP method. Write unit tests that mock the Superset response and verify the payload shape.
**Warning signs:** 400/422 errors from Superset on dataset create/update.
[VERIFIED: DatasetPostSchema has `database = fields.Integer(required=True)`, DatasetPutSchema has `database_id = fields.Integer()`]

### Pitfall 2: Column Metadata Lost on SQL Re-Run
**What goes wrong:** Dev edits column metadata (display names, types, aggregations), then re-runs the query. If the code replaces the entire column list from query results, all metadata work is lost.
**Why it happens:** Naive implementation that overwrites columns array instead of merging.
**How to avoid:** Implement merge-with-diff (D-16): match by column name, preserve metadata for unchanged columns, add new columns with auto-detected defaults, flag removed columns as "missing". This is the most critical UX logic in the phase.
**Warning signs:** Dev complains about losing metadata after tweaking WHERE clause.

### Pitfall 3: Route Naming Collision with TanStack Router
**What goes wrong:** TanStack Router file-based routing with `$datasetId.edit.tsx` may not parse correctly if the file naming convention is wrong.
**Why it happens:** TanStack Router uses `$paramName` for dynamic segments in filenames. The `.edit` suffix creates a nested path segment.
**How to avoid:** Use the file structure `routes/_app/datasets/$datasetId.edit.tsx` which creates route `/_app/datasets/$datasetId/edit`. The existing `$dashboardId.tsx` pattern confirms dynamic params work. Verify the route resolves correctly in dev before building the component.
**Warning signs:** 404 on `/datasets/abc-123/edit` route.

### Pitfall 4: Alembic Migration Conflicts with Superset
**What goes wrong:** Running `alembic upgrade head` applies both RecViz and Superset migrations, causing errors.
**Why it happens:** RecViz and Superset share the same PostgreSQL database but have separate Alembic version tables.
**How to avoid:** RecViz uses `version_table="recviz_alembic_version"` in `env.py` (already configured). New migration 002 must use the same pattern.
**Warning signs:** Alembic errors about unknown revisions.
[VERIFIED: `backend/app/migrations/env.py` line 30 and 37 both set `version_table="recviz_alembic_version"`]

### Pitfall 5: Frontend camelCase vs Backend snake_case for Column Metadata
**What goes wrong:** The `columns` JSONB field stores data in snake_case (Python convention) but the frontend expects camelCase (TypeScript convention).
**Why it happens:** The `api-client.ts` `transformKeys` function converts top-level keys but may not recursively transform nested JSONB arrays correctly, especially when column names inside the data should NOT be transformed (they're SQL column names like `brk_cnt`).
**How to avoid:** The `transformKeys` function already has a `skipKeys` set for `rows` and `columns`. The column metadata array values (like `data_type`, `display_name`) SHOULD be transformed. But the `name` field inside each column object (which is the SQL column name) should be preserved. Test this carefully with real data.
**Warning signs:** Column metadata fields show up as `dataType` vs `data_type` inconsistently.

### Pitfall 6: Superset Dataset Name Uniqueness
**What goes wrong:** Superset may enforce unique `table_name` per database. Creating two RecViz datasets with the same name on the same database fails at the Superset sync step.
**Why it happens:** Superset treats `table_name` as a unique identifier within a database context.
**How to avoid:** Use RecViz UUID as part of the Superset `table_name` (e.g., `recviz__{uuid}`) to guarantee uniqueness. Store the human-readable name only in RecViz. Alternatively, use `table_name = dataset.name` and handle uniqueness errors from Superset.
**Warning signs:** 409 Conflict or integrity error from Superset on dataset creation.
[ASSUMED: Superset likely enforces uniqueness but exact constraint not verified]

### Pitfall 7: Delete Guard Requires Chart Reference Tracking
**What goes wrong:** D-08 says deleting a dataset referenced by charts should be blocked. But charts haven't been built yet (Phase 6). The delete guard needs a way to check references that works now (returning empty) and scales to Phase 6+.
**Why it happens:** Phase ordering -- datasets exist before charts.
**How to avoid:** Build the `/api/datasets/managed/{id}/references` endpoint now, returning empty results. When Phase 6 adds charts with dataset references, the query will start returning actual references. The frontend delete dialog already handles both cases (allowed + blocked per UI-SPEC).
**Warning signs:** Delete endpoint crashes because charts table doesn't exist yet.

## Code Examples

### Column Auto-Detection (D-11)

```typescript
// Source: CONTEXT.md D-11 rules
interface DetectedColumn {
  name: string
  displayName: string
  dataType: 'string' | 'number' | 'date' | 'currency'
  role: 'dimension' | 'measure' | 'time' | 'none'
  aggregation: 'NONE'
  formatPreset: 'none'
  formatString: ''
}

const DATE_PATTERNS = /(_date|_time|_at|_on|_dt|_ts)$/i

function detectColumnType(
  name: string,
  sampleValues: unknown[],
): 'string' | 'number' | 'date' {
  // Date detection by name pattern
  if (DATE_PATTERNS.test(name)) return 'date'
  // Numeric detection by sampling up to 10 non-null values
  const nonNull = sampleValues.filter((v) => v !== null && v !== undefined)
  const numericCount = nonNull.filter((v) => typeof v === 'number').length
  if (nonNull.length > 0 && numericCount / nonNull.length > 0.5) return 'number'
  return 'string'
}

function autoDetectColumns(
  columnNames: string[],
  rows: Record<string, unknown>[],
): DetectedColumn[] {
  return columnNames.map((name) => {
    const samples = rows.slice(0, 10).map((row) => row[name])
    const dataType = detectColumnType(name, samples)
    const role = dataType === 'date' ? 'time' : dataType === 'number' ? 'measure' : 'dimension'
    const displayName = name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
    return {
      name,
      displayName,
      dataType,
      role,
      aggregation: 'NONE',
      formatPreset: 'none',
      formatString: '',
    }
  })
}
```
[VERIFIED: matches D-11 rules from CONTEXT.md]

### Column Merge-with-Diff (D-16)

```typescript
// Source: CONTEXT.md D-16
interface MergedColumn extends DetectedColumn {
  status: 'unchanged' | 'new' | 'missing'
}

function mergeColumns(
  existing: DatasetColumnMeta[],
  detected: DetectedColumn[],
): MergedColumn[] {
  const existingByName = new Map(existing.map((c) => [c.name, c]))
  const detectedNames = new Set(detected.map((c) => c.name))
  const merged: MergedColumn[] = []

  // Detected columns: preserve existing metadata or use new defaults
  for (const col of detected) {
    const prev = existingByName.get(col.name)
    if (prev) {
      merged.push({ ...prev, status: 'unchanged' })
    } else {
      merged.push({ ...col, status: 'new' })
    }
  }

  // Missing columns: existing columns not in new results
  for (const col of existing) {
    if (!detectedNames.has(col.name)) {
      merged.push({ ...col, status: 'missing' })
    }
  }

  return merged
}
```

### Superset Sync on Save

```python
# Source: follows DatabaseRegistrar.sync() pattern
async def save_dataset(
    dataset_data: DatasetCreate,
    session: AsyncSession,
    sync_service: DatasetSyncService,
) -> RecvizDataset:
    dataset_id = str(uuid.uuid4())
    dataset = RecvizDataset(
        id=dataset_id,
        name=dataset_data.name,
        description=dataset_data.description,
        database_id=dataset_data.database_id,
        sql=dataset_data.sql,
        columns=dataset_data.columns,  # JSONB
        sync_status="unsynced",
    )
    session.add(dataset)
    await session.flush()  # Get ID before sync

    # Attempt Superset sync (non-blocking on failure per D-20)
    try:
        superset_id = await sync_service.sync_dataset(dataset)
        dataset.superset_id = superset_id
        dataset.sync_status = "synced"
    except Exception as e:
        logger.warning("Superset sync failed for dataset %s: %s", dataset_id, e)
        dataset.sync_status = "error"

    return dataset
```

### Format Preset Mapping (D-13)

```typescript
// Source: CONTEXT.md D-13 + Phase 1 formatters.ts
export const FORMAT_PRESETS = [
  { id: 'none', label: 'None', formatString: '', example: '--' },
  { id: 'number', label: 'Number', formatString: '#,###', example: '1,234' },
  { id: 'currency', label: 'Currency', formatString: '$#,###.##', example: '$1,234.56' },
  { id: 'percentage', label: 'Percentage', formatString: '##.#%', example: '85.3%' },
  { id: 'decimal2', label: 'Decimal (2)', formatString: '#,###.##', example: '1,234.56' },
  { id: 'date', label: 'Date', formatString: 'MMM dd', example: 'Apr 06' },
  { id: 'datetime', label: 'DateTime', formatString: 'MMM dd HH:mm', example: 'Apr 06 14:30' },
  { id: 'custom', label: 'Custom...', formatString: '', example: '' },
] as const
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Superset POST dataset: no sql field | POST /api/v1/dataset/ now accepts `sql` field | Superset 3.x+ | Can create virtual datasets in one API call instead of POST+PUT workaround |
| AG Grid cell editing with custom React components | AG Grid 35.x built-in `agSelectCellEditor` | AG Grid 32+ | No need for custom cell editor components for dropdowns |
| Superset dataset sync: table_name only | POST supports sql + table_name | Superset 3.x+ | Virtual datasets can be synced directly |

**Deprecated/outdated:**
- The Superset POST-then-PUT workaround for virtual datasets is no longer needed. [VERIFIED: DatasetPostSchema includes `sql` field in current Superset master]

## Assumptions Log

> List all claims tagged `[ASSUMED]` in this research.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Using `/api/datasets/managed/` prefix to avoid collision with existing Superset proxy endpoints | Architecture Pattern 4 | LOW -- alternative is refactoring existing endpoints, but managed prefix is cleaner |
| A2 | Column metadata JSONB structure with snake_case keys | Architecture Pattern 5 | LOW -- structure matches D-23 spec, case convention follows Python standard |
| A3 | Superset enforces unique table_name per database | Pitfall 6 | MEDIUM -- if not enforced, simpler approach works; if enforced, need UUID-based naming |

## Open Questions

1. **Superset table_name uniqueness constraint**
   - What we know: Superset likely enforces unique table_name per database for datasets
   - What's unclear: Whether this is a DB constraint or application-level check
   - Recommendation: Use `recviz__{uuid}` pattern for Superset table_name to guarantee uniqueness. Store human-readable name only in RecViz DB. This is safe regardless of constraint behavior.

2. **Chart reference checking for delete guard (D-08)**
   - What we know: Charts are built in Phase 6, but delete guard needs to work now
   - What's unclear: How charts will reference datasets (by RecViz UUID or dataset name)
   - Recommendation: Build references endpoint returning empty list now. Use RecViz UUID for references. Phase 6 will query against this.

3. **Column auto-detection for date types**
   - What we know: D-11 says detect by column name pattern (`*_date`, `*_time`, `*_at`, `*_on`)
   - What's unclear: Whether Superset SQL Lab returns type metadata with query results that could improve detection
   - Recommendation: Use name patterns + value type checking. The existing `/api/sql/execute` endpoint returns column names as strings without type metadata, so name patterns are the primary detection mechanism.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | recviz_datasets table | Yes (Docker) | 16+ | -- |
| Redis | Superset query cache | Yes (Docker) | 7+ | -- |
| Superset | SQL execution + dataset sync | Yes (native install) | 3.x+ | -- |
| Node.js | Frontend build | Yes | 18+ | -- |
| Python | Backend | Yes | 3.12+ | -- |

No missing dependencies.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (frontend) | Vitest (config: `frontend/vitest.config.ts`) |
| Framework (backend) | pytest 9.0.2 with pytest-asyncio |
| Quick run (frontend) | `cd frontend && npx vitest run --reporter=verbose` |
| Quick run (backend) | `cd backend && python -m pytest tests/ -x -q` |
| Full suite (frontend) | `cd frontend && npx vitest run` |
| Full suite (backend) | `cd backend && python -m pytest tests/ -v` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DSET-01 | Create dataset with SQL + name + column metadata | unit (backend) | `pytest tests/test_managed_datasets.py::test_create_dataset -x` | Wave 0 |
| DSET-02 | Column metadata CRUD (display name, type, role, agg, format) | unit (backend + frontend) | `pytest tests/test_managed_datasets.py::test_column_metadata -x` | Wave 0 |
| DSET-03 | Test-execute query from editor | integration | Reuses existing `test_query_engine.py` patterns | Existing (partial) |
| DSET-04 | Edit and delete datasets, reference check | unit (backend) | `pytest tests/test_managed_datasets.py::test_edit_delete -x` | Wave 0 |
| DSET-05 | Dataset persisted to PostgreSQL | unit (backend) | `pytest tests/test_managed_datasets.py::test_persistence -x` | Wave 0 |
| D-11 | Column auto-detection heuristics | unit (frontend) | `npx vitest run src/lib/column-detection.test.ts` | Wave 0 |
| D-16 | Column merge-with-diff logic | unit (frontend) | `npx vitest run src/lib/column-merge.test.ts` | Wave 0 |
| D-19/20 | Superset sync on save | unit (backend) | `pytest tests/test_dataset_sync.py -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** Quick run for affected test files
- **Per wave merge:** Full suite for both frontend and backend
- **Phase gate:** All tests green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_managed_datasets.py` -- CRUD endpoint tests with mocked DB session
- [ ] `backend/tests/test_dataset_sync.py` -- Superset sync service tests with mocked SupersetClient
- [ ] `frontend/src/lib/column-detection.test.ts` -- auto-detection heuristic tests
- [ ] `frontend/src/lib/column-merge.test.ts` -- merge-with-diff logic tests

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Auth deferred to future phase (SECU-01) |
| V3 Session Management | No | No user sessions in v1 |
| V4 Access Control | No | No RBAC in v1 |
| V5 Input Validation | Yes | Pydantic v2 models for all request bodies; SQL passed through to Superset which handles parameterization |
| V6 Cryptography | No | No encryption needed for dataset metadata |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via dataset SQL | Tampering | SQL is executed by Superset's SQL Lab engine which has its own query validation and sandboxing. RecViz does not execute SQL directly. |
| JSONB injection via column metadata | Tampering | Pydantic v2 validates column metadata structure before storage. JSONB stored as typed data, not raw string interpolation. |
| Denial of service via large SQL queries | Denial of Service | Superset enforces query timeouts (configurable). RecViz proxies with httpx timeout (120s). |

## Sources

### Primary (HIGH confidence)
- Codebase files: `backend/app/services/database_registrar.py`, `backend/app/db/models/data_source.py`, `backend/app/services/superset_client.py`, `backend/app/api/datasets.py`, `backend/app/api/sql.py`, `backend/app/core/dependencies.py`, `backend/app/main.py`, `backend/app/migrations/env.py`, `backend/app/migrations/versions/001_initial_schema.py`
- Codebase files: `frontend/src/components/explorer/sql-editor.tsx`, `frontend/src/components/explorer/query-results.tsx`, `frontend/src/components/settings/data-sources-tab.tsx`, `frontend/src/hooks/use-databases.ts`, `frontend/src/hooks/use-sql-execute.ts`, `frontend/src/lib/api-client.ts`, `frontend/src/lib/formatters.ts`
- [Superset GitHub source: datasets/schemas.py](https://github.com/apache/superset/blob/master/superset/datasets/schemas.py) - DatasetPostSchema includes `sql` field
- [Superset GitHub source: datasets/api.py](https://github.com/apache/superset/blob/master/superset/datasets/api.py) - POST creates dataset via CreateDatasetCommand
- [Superset REST API Reference](https://superset.apache.org/developer-docs/api/) - 18 dataset endpoints documented

### Secondary (MEDIUM confidence)
- [Superset virtual datasets blog (Preset)](https://preset.io/blog/unlocking-the-power-of-virtual-datasets-in-apache-superset/) - Virtual dataset concept
- [GitHub Issue #10311](https://github.com/apache/incubator-superset/issues/10311) - Historical limitation of POST not supporting sql (now resolved)
- Phase 5 CONTEXT.md (D-01 through D-30) - All user decisions

### Tertiary (LOW confidence)
- Superset table_name uniqueness behavior (not verified against Superset source constraints)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All packages verified in project, zero new dependencies
- Architecture: HIGH - All patterns follow established codebase conventions (DatabaseRegistrar, ConfigStore, RecvizDataSource model)
- Superset sync API: HIGH - Verified DatasetPostSchema includes `sql` field from GitHub source
- Pitfalls: HIGH - Identified from real codebase analysis (field naming mismatch, JSONB key transform, Alembic table isolation)
- Column detection heuristics: MEDIUM - Rules from D-11 are clear but untested against real Oracle schema column names

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable stack, no fast-moving dependencies)
