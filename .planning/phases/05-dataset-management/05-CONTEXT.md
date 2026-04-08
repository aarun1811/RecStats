# Phase 5: Dataset Management - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Dev team can create named datasets from SQL queries with rich column metadata (display name, data type, dimension/measure/time role, default aggregation, format string), so business users have a curated catalog of data to build charts from. Datasets persist to the database, sync to Superset for query execution, and are manageable (create, edit, delete) through a dedicated UI.

**Requirements covered:** DSET-01, DSET-02, DSET-03, DSET-04, DSET-05

</domain>

<decisions>
## Implementation Decisions

### Dataset creation flow
- **D-01:** Two creation entry points: (1) SQL Explorer "Save as Dataset" button for quick creation after running a query, and (2) dedicated dataset editor page in create mode (from Datasets list "+ New Dataset" button) for starting from scratch.
- **D-02:** Explorer quick-save captures name, description, and database only. Column metadata is auto-detected with smart defaults. Dev refines metadata later in the dedicated editor.
- **D-03:** Database selector inherits from Explorer context (auto-selects the database used for the query). In the dedicated editor, a dropdown shows all configured connections.
- **D-04:** Dedicated dataset editor is a full page (`/datasets/:id/edit` or `/datasets/new`). Provides room for Monaco editor, results preview, and column metadata table side by side.
- **D-05:** Editing SQL requires re-running the query before saving. Changing SQL invalidates the column list — prevents broken datasets from silently propagating to charts.
- **D-06:** No draft/published state. Saved = immediately available to chart builders. Keep it simple — devs are technical and won't save broken datasets.
- **D-07:** Datasets have name and description (no tags). Description shown in the dataset list and chart builder picker.
- **D-08:** Deleting a dataset that's referenced by existing charts is blocked. UI shows which charts reference it. Dev must remove chart references first.
- **D-09:** One dataset = one SQL query + one database. No multi-database datasets.

### Column metadata editor
- **D-10:** Editable AG Grid table below query results in the dedicated editor. Columns: Name (read-only), Display Name, Type, Role, Aggregation, Format. All cells inline-editable via click. Role/Type/Agg use dropdown selectors. Format uses preset dropdown + custom text input.
- **D-11:** Smart auto-detection on first query run: auto-detect type from data (string/number/date), guess role based on naming patterns (columns named `*_date`/`*_time` → time, numeric columns → measure, string columns → dimension). Display name = capitalize + replace underscores with spaces (e.g., `brk_cnt` → "Brk Cnt").
- **D-12:** Standard aggregation functions: SUM, AVG, COUNT, MIN, MAX, COUNT DISTINCT. Sufficient for recon use cases.
- **D-13:** Format string via preset dropdown + custom option. Presets: Number (#,###), Currency ($#,###.##), Percentage (##.#%), Decimal2 (#,###.##), Date (MMM dd), DateTime (MMM dd HH:mm). Custom option accepts Intl.NumberFormat or date-fns format strings. Leverages Phase 1 formatting utilities.
- **D-14:** Column ordering follows SQL SELECT clause order. Dev controls order by changing the query.
- **D-15:** All query columns are exposed — no visibility toggle. Dev controls which columns exist via the SQL SELECT clause.
- **D-16:** When SQL is re-run and columns change: merge with diff. New columns get auto-detected defaults. Removed columns are flagged as "missing" (red highlight). Dev resolves by remapping or accepting changes.
- **D-17:** Results preview has a "Show formatted" toggle. Default shows raw query values. Toggle applies configured format strings so dev can verify formatting before saving.
- **D-18:** Default aggregation is optional — defaults to "None". Chart builder can override aggregation per-chart. A measure column doesn't always aggregate — useful for detail-level data.

### Storage architecture
- **D-19:** Hybrid with sync. RecViz PostgreSQL database is the source of truth for dataset definitions (SQL, name, column metadata). On save, dataset syncs to Superset as a virtual dataset. Superset handles query execution, caching, and column detection. RecViz handles enrichment metadata (display names, roles, formats).
- **D-20:** Sync happens on save — immediately when dev saves the dataset. If Superset sync fails, save still succeeds in RecViz DB but dataset is flagged as "unsynced". Background retry or manual re-sync available.
- **D-21:** Startup reconciliation — on app start, compare RecViz datasets vs Superset datasets. Re-sync any that are missing or out of date. Safety net for drift (same pattern as DatabaseRegistrar).
- **D-22:** RecViz UUIDs as primary references everywhere. Superset dataset ID is stored as an internal detail (`superset_id` column, nullable). Charts reference RecViz UUIDs. RecViz resolves to Superset ID at query time. Survives Superset resets without breaking chart configs.
- **D-23:** Dedicated columns in `recviz_datasets` table: `id` (VARCHAR PK), `name`, `description`, `database_id`, `superset_id` (nullable), `sql`, `columns` (JSONB), `sync_status`, `schema_version`, `created_at`, `updated_at`. Column metadata in JSONB, everything else as explicit columns.
- **D-24:** Test-execute preview queries go through Superset SQL Lab (reuse existing `/api/sql/execute` endpoint). Same path as SQL Explorer. Respects connection pooling and timeouts.

### Dataset management UI
- **D-25:** Top-level "Datasets" nav item in the sidebar, same level as Dashboards and Explorer. Datasets are a core concept — not a settings concern.
- **D-26:** Dataset list page with grid + list toggle (reuse Phase 4 DataSourcesTab pattern). Card view and table view. Shows name, description, database (with backend type badge), column count, last updated.
- **D-27:** No SQL preview in list view. SQL only visible in the dataset editor. Cleanest list.
- **D-28:** Search + database filter on the list page. Text search on name/description, dropdown to filter by database.
- **D-29:** Sync status shown only on error — no indicator when synced (happy path). Warning badge surfaces sync failures.
- **D-30:** "+ New Dataset" button on list page opens the dedicated editor in create mode. Explorer "Save as Dataset" is the convenience shortcut for quick creation.

### Claude's Discretion
- Dataset card and row component design details (spacing, typography, hover states)
- DatasetSyncService implementation details (retry strategy, reconciliation algorithm)
- Column metadata JSONB schema structure
- Alembic migration specifics for recviz_datasets table
- Monaco editor configuration in the dedicated editor (reuse from Explorer or separate instance)
- How "Save as Dataset" dialog looks in the Explorer (likely a simple form dialog)
- Error handling for failed syncs (toast notification, inline banner, etc.)
- Dataset editor page layout proportions (editor height vs results vs metadata)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend — existing dataset infrastructure
- `backend/app/api/datasets.py` — Current dataset endpoints proxying Superset. Needs extension for RecViz-managed datasets.
- `backend/app/api/sql.py` — SQL Lab execute endpoint. Reuse for test-execute preview in dataset editor.
- `backend/app/services/superset_client.py` — `list_datasets()`, `get_dataset()` methods. Needs `create_dataset()`, `update_dataset()`, `delete_dataset()` for virtual dataset sync.
- `backend/app/services/database_registrar.py` — Pattern for startup sync (databases.json → Superset). Model for DatasetSyncService.
- `backend/app/services/connection_status.py` — Pattern for tracking sync status state.
- `backend/app/db/models/data_source.py` — Existing SQLAlchemy model pattern (RecvizDataSource). Reference for recviz_datasets model.
- `backend/app/models/dataset.py` — Existing Pydantic models: ColumnInfo, DatasetInfo, SchemaNode. Extend for DSET-02 column metadata.
- `backend/app/core/dependencies.py` — FastAPI dependency injection pattern (SupersetDep, etc.)

### Backend — database/migration infrastructure
- `backend/app/db/models/dashboard.py` — SQLAlchemy model pattern for RecViz-managed entities
- `backend/app/migrations/versions/001_initial_schema.py` — Alembic migration pattern (JSONB, timestamps, string PKs)

### Frontend — SQL Explorer (reuse for dataset creation)
- `frontend/src/components/explorer/sql-editor.tsx` — Monaco editor with SQL language, Cmd+Enter keybinding
- `frontend/src/components/explorer/query-results.tsx` — AG Grid results with pagination, toolbar
- `frontend/src/components/explorer/schema-browser.tsx` — Schema tree fetching from Superset datasets
- `frontend/src/routes/_app/explorer/index.tsx` — Explorer page layout. Add "Save as Dataset" button to toolbar.

### Frontend — data sources UI (pattern to follow)
- `frontend/src/components/settings/data-sources-tab.tsx` — Grid/list toggle, search, card/row rendering pattern
- `frontend/src/components/settings/data-source-card.tsx` — Card component pattern with status indicators
- `frontend/src/components/settings/data-source-row.tsx` — Row component pattern
- `frontend/src/hooks/use-databases.ts` — CRUD hook pattern (mutations + query invalidation)

### Frontend — types and routing
- `frontend/src/types/database.ts` — TypeScript type pattern for backend entities
- `frontend/src/hooks/use-datasets.ts` — Existing dataset hook (fetches from Superset). Needs extension for RecViz-managed datasets.

### Project context
- `.planning/PROJECT.md` — Project vision, constraints, key decisions
- `.planning/REQUIREMENTS.md` — DSET-01 through DSET-05 requirements
- `CLAUDE.md` — Coding conventions, tech stack, project structure

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `sql-editor.tsx` (Monaco editor): Reuse in dedicated dataset editor. Same configuration, add dataset-specific keybindings.
- `query-results.tsx` (AG Grid results): Reuse for preview results in dataset editor.
- `schema-browser.tsx`: Already fetches Superset datasets. Will need to also show RecViz-managed datasets.
- `use-sql-execute.ts` hook: Reuse for test-execute in dataset editor.
- `data-sources-tab.tsx` pattern: Grid/list toggle, search, card/row rendering — adapt for dataset list page.
- `data-source-card.tsx` / `data-source-row.tsx`: Adapt for dataset cards/rows.
- `DatabaseRegistrar`: Startup sync pattern — model for DatasetSyncService.
- `connection_status.py`: Status tracking pattern — model for sync status.
- Phase 1 formatting utilities: Leverage for format string presets and preview formatting.

### Established Patterns
- FastAPI `Depends()` for service injection
- Pydantic v2 models for request/response shapes
- SQLAlchemy async models with JSONB columns
- Alembic migrations with `recviz_alembic_version` table
- TanStack Query with query key invalidation on mutations
- Shadcn components for UI primitives
- AG Grid Enterprise for data-dense tables (inline editing supported)

### Integration Points
- `backend/app/api/router.py` — Add new dataset management routes
- `backend/app/main.py` lifespan — Add DatasetSyncService startup reconciliation
- `frontend/src/routes/_app/` — Add `/datasets/` route with list page
- `frontend/src/routes/_app/datasets/` — Add `$datasetId.edit.tsx` for dedicated editor
- Sidebar navigation — Add "Datasets" nav item
- Explorer toolbar — Add "Save as Dataset" button (appears after successful query)

</code_context>

<specifics>
## Specific Ideas

- The dataset editor should feel like a purpose-built IDE for dataset creation — Monaco editor for SQL, AG Grid for column metadata editing, AG Grid for results preview. All three are already in the codebase.
- "Save as Dataset" in Explorer should be a quick, frictionless action — minimal dialog, auto-detect everything, dev refines later. Don't interrupt the Explorer workflow.
- Column metadata merge-with-diff on SQL re-run is important — devs iterate on queries. Don't destroy their metadata work when they tweak a WHERE clause.
- Format preset dropdown should show example formatted values (e.g., "Currency — $1,234.56") so devs can pick without memorizing format strings.
- The DatasetSyncService pattern should be nearly identical to DatabaseRegistrar — proven pattern in the codebase.

</specifics>

<deferred>
## Deferred Ideas

- **Multi-database datasets** — A dataset template that can run against multiple databases. Useful for teams with identical schemas across environments. Captured for future consideration.
- **Reusable query templates** — Write SQL once, parameterize database. Related to multi-DB datasets.
- **Dataset tags** — Tagging for organization/filtering. May be needed at scale (100+ datasets) but not for v1.
- **Column visibility toggle** — Hide columns from chart builder without removing from query. Deferred — devs control columns via SQL SELECT.
- **Extended aggregation functions** — MEDIAN, PERCENTILE, STDDEV, VARIANCE. Add if statistical analysis needs emerge.
- **Custom SQL aggregation expressions** — Free-form SQL aggregation in the aggregation field. Maximum flexibility but complexity. Deferred.
- **Draft/published workflow** — Publishing gate before datasets are visible to business users. Deferred — keep it simple for now.

</deferred>

---

*Phase: 05-dataset-management*
*Context gathered: 2026-04-06*
