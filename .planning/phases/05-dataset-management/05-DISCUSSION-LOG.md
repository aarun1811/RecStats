# Phase 5: Dataset Management - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 05-dataset-management
**Areas discussed:** Dataset creation flow, Column metadata editor, Storage architecture, Dataset management UI

---

## Dataset Creation Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Promote from Explorer | Dev writes SQL in Explorer, runs it, clicks 'Save as Dataset' | |
| Dedicated dataset editor | Separate page with its own Monaco editor, database selector | |
| Both entry points | Explorer 'Save as Dataset' AND dedicated editor for full control | ✓ |

**User's choice:** Both entry points
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Name + database only | Quick save from Explorer captures just name, description, database | ✓ |
| Full metadata inline | Explorer dialog includes full column metadata table | |
| Name then redirect | Captures name, saves, redirects to dedicated editor | |

**User's choice:** Name + database only (quick save from Explorer)
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Full page | Dedicated route (/datasets/:id/edit) with room for editor + results + metadata | ✓ |
| Slide-over sheet | Reuse DataSourceSheet pattern from Phase 4 | |

**User's choice:** Full page
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Required re-run | Changing SQL invalidates column list, must re-run before save | ✓ |
| Optional re-run | Allow saving without re-run, show warning banner | |
| Auto-validate on save | Background LIMIT 1 query on save to verify structure | |

**User's choice:** Required re-run
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| No draft state | Saved = available. Keep it simple. | ✓ |
| Draft/Published toggle | New datasets start as draft, explicit publish | |
| Published with validation | Save always works, publish requires all metadata configured | |

**User's choice:** No draft state
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown of connections | List all databases, only connected ones selectable | |
| All connections available | Show all regardless of status | |
| Inherit from Explorer | Auto-select database used for query in Explorer | ✓ |

**User's choice:** Inherit from Explorer
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Name + description | Each dataset has name and optional description, no tags | ✓ |
| Name + description + tags | Tags for filtering at scale | |
| Name only | Minimal, search by name only | |

**User's choice:** Name + description
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Block with usage list | Show which charts reference dataset, require removing references first | ✓ |
| Soft delete/archive | Hidden from new creation but existing charts keep working | |
| Warn and allow | Warning but force-delete allowed | |

**User's choice:** Block with usage list
**Notes:** None

---

## Column Metadata Editor

| Option | Description | Selected |
|--------|-------------|----------|
| Editable table | AG Grid with inline editing for all metadata fields | ✓ |
| Per-column detail panel | Click column to open side panel with form | |
| Column header editing | Context menu on column headers in results grid | |

**User's choice:** Editable AG Grid table
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Smart defaults | Auto-detect type, guess role from naming patterns, capitalize display names | ✓ |
| Type only, roles blank | Auto-detect type, leave role/agg/format blank | |
| Full heuristics | Aggressive guessing including aggregation and format | |

**User's choice:** Smart defaults
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Standard set | SUM, AVG, COUNT, MIN, MAX, COUNT DISTINCT | ✓ |
| Extended set | Standard + MEDIAN, PERCENTILE, STDDEV, VARIANCE | |
| Standard + custom SQL | Standard plus free-form SQL expression option | |

**User's choice:** Standard set
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Preset + custom | Dropdown of presets plus custom Intl.NumberFormat/date-fns strings | ✓ |
| Free text only | Plain text input, no presets | |
| Presets only | Fixed list, no custom option | |

**User's choice:** Preset + custom
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| SQL order | Columns match SELECT clause order | ✓ |
| Drag to reorder | Drag columns in metadata table | |
| Sort by role | Auto-sort: dimensions, then measures, then time | |

**User's choice:** SQL order
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| All exposed | Every query column available in chart builder | ✓ |
| Toggle visibility | Hidden columns excluded from chart builder | |

**User's choice:** All exposed
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Merge with diff | New columns get defaults, removed flagged as missing | ✓ |
| Reset all metadata | Fresh auto-detection on re-run | |
| Keep all, warn on mismatch | Preserve metadata, show warning banner | |

**User's choice:** Merge with diff
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Both: toggle | Default raw, 'Show formatted' toggle for verification | ✓ |
| Always raw | Formatting only visible in chart builder | |
| Always formatted | Real-time format application | |

**User's choice:** Both: toggle
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Optional with None | Defaults to None, chart builder overrides per-chart | ✓ |
| Required for measures | Every measure must have a default aggregation | |
| Smart default | Auto-set to SUM, dev can change | |

**User's choice:** Optional with None
**Notes:** None

---

## Storage Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| RecViz DB only | Full control, single source of truth, query via SQL Lab | |
| Superset primary | Superset stores dataset, RecViz stores enrichment metadata | |
| Hybrid with sync | RecViz DB is source of truth, sync to Superset for query execution | ✓ |

**User's choice:** Hybrid with sync
**Notes:** User asked for detailed pros/cons of Superset storage before deciding. After explanation of how hybrid preserves all Superset capabilities (caching, column detection, chart/data API) while giving RecViz full control, chose hybrid.

---

| Option | Description | Selected |
|--------|-------------|----------|
| On save | Sync immediately when dev saves | ✓ |
| On startup (batch) | Like DatabaseRegistrar, sync all on startup | |
| Lazy on first query | Sync on first chart query | |

**User's choice:** On save
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, reconcile on startup | Compare RecViz vs Superset, re-sync drift | ✓ |
| No, on-save only | Trust on-save sync | |

**User's choice:** Yes, reconcile on startup
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Superset IDs (simpler) | Use Superset dataset IDs directly everywhere | |
| RecViz UUIDs (resilient) | RecViz UUIDs as primary, Superset ID internal | ✓ |

**User's choice:** RecViz UUIDs
**Notes:** After clarification that Superset capabilities are preserved either way, chose resilience.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated columns | Explicit columns for queryable fields, JSONB for metadata | ✓ |
| JSONB config blob | Follow existing RecvizDataSource pattern | |

**User's choice:** Dedicated columns
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Through Superset SQL Lab | Reuse existing /api/sql/execute endpoint | ✓ |
| Through Superset chart/data | Sync first, then query via chart/data API | |
| Direct database query | FastAPI queries DB directly via SQLAlchemy | |

**User's choice:** Through Superset SQL Lab
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| One-to-one | One dataset = one SQL + one database | ✓ |
| Multi-database | Dataset can run against multiple databases | |

**User's choice:** One-to-one
**Notes:** User initially asked about multi-DB. After explanation that multi-DB is a reusable template feature (v2), chose simple one-to-one.

---

## Dataset Management UI

| Option | Description | Selected |
|--------|-------------|----------|
| Top-level nav item | Dedicated 'Datasets' in sidebar | ✓ |
| Settings tab | Tab alongside Data Sources | |
| Sub-page under Explorer | Explorer tabbed layout | |

**User's choice:** Top-level nav item
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Table list | AG Grid table, sortable, searchable | |
| Card grid | Card layout like Data Sources | |
| Grid + list toggle | Both views with toggle | ✓ |

**User's choice:** Grid + list toggle
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Search + database filter | Text search + database dropdown | ✓ |
| Search only | Just text search | |
| Full filter bar | Search + DB + status + date | |

**User's choice:** Search + database filter
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| No SQL in list | SQL only visible in dataset editor | ✓ |
| Truncated SQL on hover | Tooltip with first 3-4 lines | |
| Always visible snippet | 1-2 lines below name | |

**User's choice:** No SQL in list
**Notes:** None

---

**New Dataset button flow:**

**User's choice:** Both creation paths exist. "+ New Dataset" on list page opens dedicated editor in create mode. Explorer "Save as Dataset" is the convenience shortcut.
**Notes:** User initially suggested routing "+ New Dataset" to Explorer. After discussion, decided both paths should support creation independently.

---

**Sync status display:**

**User's choice:** Only show on error. No indicator when synced (happy path). Warning badge for sync failures.
**Notes:** User asked "what is this sync about?" — Claude explained and decided on behalf: only-on-error is cleanest since sync failures are rare.

---

## Claude's Discretion

- Dataset card and row component design details
- DatasetSyncService implementation details (retry, reconciliation)
- Column metadata JSONB schema structure
- Alembic migration specifics
- Monaco editor configuration in dedicated editor
- "Save as Dataset" dialog design in Explorer
- Error handling UX for failed syncs
- Dataset editor page layout proportions

## Deferred Ideas

- Multi-database datasets / reusable query templates — future consideration
- Dataset tags — may be needed at scale (100+ datasets)
- Column visibility toggle — devs control via SQL SELECT
- Extended aggregation functions (MEDIAN, PERCENTILE, etc.)
- Custom SQL aggregation expressions
- Draft/published workflow
