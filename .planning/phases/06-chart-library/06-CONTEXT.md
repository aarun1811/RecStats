# Phase 6: Chart Library - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can create charts by selecting a dataset, mapping columns to visual properties via a chart type-aware form, choosing a chart type, configuring basic appearance, and saving to a reusable chart library. Saved charts can be browsed, searched, previewed, edited, and added to multiple dashboards by reference. Editing a chart's config updates it everywhere it's used.

**Requirements covered:** CHRT-01, CHRT-02, CHRT-03, CHRT-04, CHRT-05, CHRT-06, CHRT-07

</domain>

<decisions>
## Implementation Decisions

### Chart builder layout
- **D-01:** Accordion stepper on the left with live chart preview always visible on the right. Each step expands inline when active, collapses with a summary line when completed. No separate sidebar column wasted — the accordion IS the left panel.
- **D-02:** Completed steps are clickable to re-expand for editing. Changes to earlier steps (e.g., switching dataset) reset downstream steps. Future steps are locked until their prerequisites are done.
- **D-03:** Step order: 1. Dataset → 2. Chart Type → 3. Column Mapping → 4. Appearance → 5. Save.

### Chart builder entry points
- **D-04:** Dedicated `/charts/new` page for creating charts and `/charts/:id/edit` for editing. "Charts" nav item in sidebar (same level as Dashboards, Datasets, Explorer). Chart library list page with "+ New Chart" button. Same pattern as datasets.

### Dataset selection (Step 1)
- **D-05:** Searchable combobox listing datasets by name with database type badge. Selecting a dataset shows its column metadata (name, type, role) in the right preview area.
- **D-06:** "Preview Data" button in the preview area fetches a sample of rows from the dataset on demand (via existing SQL Lab execute endpoint). Columns shown immediately from saved metadata; data fetch is optional.

### Chart type selection (Step 2)
- **D-07:** Icon grid showing all chart types with visual thumbnails/icons. Grouped into "Standard" (AG Charts: bar, stacked-bar, line, area, pie, donut, scatter, heatmap, treemap, waterfall, combo) and "Exotic" (ECharts: Sankey, sunburst, radar, graph/network, gauge, parallel coordinates, funnel).
- **D-08:** Incompatible types are dimmed with tooltip explaining why. Compatibility determined by dataset column roles: pie needs 1+ dimension + exactly 1 measure, scatter needs 2+ measures, heatmap needs 2 dimensions + 1 measure, etc.
- **D-09:** Chart type is selected BEFORE column mapping. The chart type determines which mapping fields appear in Step 3 (pie shows Category + Metric, bar shows X-Axis + Metrics, heatmap shows X + Y + Color).

### Column mapping (Step 3)
- **D-10:** Role-aware dropdowns. X-Axis/Category dropdown shows only dimension and time columns. Metrics dropdown shows only measure columns. Column roles come from dataset metadata (Phase 5). User can override if needed.
- **D-11:** Multiple metrics supported for chart types that allow it (bar, line, area, combo). Single metric for pie/donut. Add/remove metric tags with [+ Add metric] button.
- **D-12:** Default aggregation pre-filled from dataset column metadata. User can override per-chart via dropdown (SUM, AVG, COUNT, MIN, MAX, COUNT DISTINCT).

### Appearance (Step 4)
- **D-13:** Essentials only. Title (text input), legend show/hide toggle, legend position (top/bottom/left/right), X-axis label show/hide, Y-axis label show/hide. Colors come from Shadcn theme automatically — no manual color picking.

### Save (Step 5)
- **D-14:** Name (required) and description (optional). No tags. Same simplicity as datasets (Phase 5 D-07). Duplicate names allowed (UUID is the real identifier).

### Chart persistence model
- **D-15:** Charts stored in RecViz PostgreSQL only. New `recviz_charts` table. No Superset sync needed — charts are a UI/config concept, not a query concept. Superset only knows about datasets.
- **D-16:** Chart references dataset by ID. Stores: dataset_id (FK), chart_type, config (JSONB with column mapping + appearance). Does NOT copy data.
- **D-17:** Adding a chart to a dashboard creates a reference (not a copy). One chart definition, many dashboard placements. Edit chart config → updates everywhere.
- **D-18:** Immediate propagation on save. No draft/published workflow. Save = live everywhere. Same pattern as datasets (Phase 5 D-06).
- **D-19:** All charts are library charts. No "inline-only" dashboard charts. Every chart goes through the builder and gets saved to the library. Consistent single model.

### Chart deletion
- **D-20:** Block deletion if chart is referenced by dashboards. UI shows which dashboards reference it. User must remove chart from those dashboards first. Same pattern as datasets (Phase 5 D-08).

### Chart library browsing
- **D-21:** Card grid with chart type icon, chart name, dataset name, and a small static thumbnail. Card/row (list view) toggle — same pattern as datasets (Phase 5 D-26).
- **D-22:** Search by name, filter by chart type, filter by dataset. Toolbar above the grid.
- **D-23:** Click a chart card to open a detail view/side panel with a full live render of the chart, plus metadata (dataset, type, columns, "Used in" dashboards list). Edit button navigates to `/charts/:id/edit`.

### Live preview behavior
- **D-24:** Right-side preview area is context-sensitive per step. Step 1: column metadata + optional data fetch. Step 2: chart type description/example. Steps 3-5: live chart render updating as user configures.

### Claude's Discretion
- Accordion animation and transition details
- Chart type thumbnail/icon design (Lucide icons or custom SVGs)
- Preview area empty state before dataset is selected
- Column metadata table styling in preview area
- "Preview Data" row limit (e.g., 50 rows)
- Chart config JSONB schema structure
- Alembic migration for recviz_charts table
- Delete confirmation dialog design
- Card vs row component layout details
- How "Used in dashboards" list is fetched (query dashboards for chart references)
- Edit mode vs create mode differences in the accordion (pre-populated steps vs empty)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend — dataset infrastructure (pattern to clone for charts)
- `backend/app/api/managed_datasets.py` — CRUD endpoints for RecViz-managed datasets. Clone pattern for chart endpoints.
- `backend/app/db/models/dataset.py` — SQLAlchemy model for RecvizDataset. Clone for RecvizChart model.
- `backend/app/models/managed_dataset.py` — Pydantic schemas for dataset CRUD. Clone for chart schemas.
- `backend/app/services/dataset_sync.py` — DatasetSyncService (NOT needed for charts, but reference for service pattern).
- `backend/app/migrations/versions/` — Alembic migration patterns (JSONB, timestamps, string PKs).

### Backend — query execution (for data preview)
- `backend/app/api/sql.py` — SQL Lab execute endpoint. Reuse for "Preview Data" in dataset selection step.
- `backend/app/api/data_sources.py` — Query endpoint for chart data rendering in preview.

### Frontend — chart rendering (reuse in builder preview)
- `frontend/src/components/charts/ag-chart-wrapper.tsx` — AG Charts wrapper with `buildSeries()`. Reuse for live preview.
- `frontend/src/components/charts/echart-wrapper.tsx` — ECharts wrapper. Reuse for exotic type preview.
- `frontend/src/components/charts/chart-factory.tsx` — Routes to correct wrapper based on vizType.
- `frontend/src/types/chart.ts` — ChartConfig, ChartType, ChartWrapperProps types.

### Frontend — dataset management (pattern to follow)
- `frontend/src/components/datasets/dataset-list.tsx` — List page with card/row toggle, search, toolbar. Clone for chart library list.
- `frontend/src/components/datasets/dataset-card.tsx` — Card component pattern.
- `frontend/src/components/datasets/dataset-row.tsx` — Row component pattern.
- `frontend/src/components/datasets/delete-dataset-dialog.tsx` — Delete dialog with reference blocking.
- `frontend/src/hooks/use-managed-datasets.ts` — CRUD hooks (query + mutations + invalidation). Clone for charts.
- `frontend/src/types/managed-dataset.ts` — TypeScript types for RecvizDataset. Reference for RecvizChart type.

### Frontend — existing chart/dashboard types
- `frontend/src/types/dashboard-config.ts` — DashboardChartConfig, ChartSource, ChartLayout. Chart library config is the reusable version of this.

### Frontend — routing
- `frontend/src/routes/_app/datasets/` — Dataset routes (index, new, $id.edit). Clone for chart routes.

### Project context
- `.planning/PROJECT.md` — Project vision, key decision: "Reusable chart library"
- `.planning/REQUIREMENTS.md` — CHRT-01 through CHRT-07 requirements
- `CLAUDE.md` — Coding conventions, charting rules (AG Charts primary, ECharts exotic only), tech stack

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `buildSeries()` in ag-chart-wrapper.tsx: Config-driven series builder already handles all AG Charts types with metricColumns/categoryColumn mapping. Direct reuse in chart builder preview.
- `ChartFactory`: Routes vizType to correct wrapper (AG or ECharts). Reuse as-is in builder preview.
- Dataset list page (card/row toggle, search, toolbar): Adapt for chart library list page.
- Delete dialog with reference checking: Adapt for chart deletion.
- `use-managed-datasets.ts` hooks: Clone for chart CRUD hooks.
- `api-client.ts`: API client with JSON transforms, 204 handling. Reuse for chart endpoints.
- `RecvizDataset` SQLAlchemy model: Clone pattern for RecvizChart model (simpler — no Superset sync).
- SQL Lab execute endpoint: Reuse for "Preview Data" in dataset selection.

### Established Patterns
- FastAPI `Depends()` for service injection
- Pydantic v2 models for request/response
- SQLAlchemy async models with JSONB columns and string UUID PKs
- Alembic migrations with `recviz_alembic_version` table
- TanStack Query with query key invalidation on mutations
- Shadcn components for UI primitives
- File-based routing with TanStack Router
- AG Grid Enterprise for data tables

### Integration Points
- `backend/app/api/router.py` — Add chart CRUD routes
- `frontend/src/routes/_app/` — Add `/charts/` routes (index, new, $chartId.edit)
- Sidebar navigation — Add "Charts" nav item between Datasets and Explorer
- `DashboardChartConfig` type — Phase 8 will reference chart library IDs here

</code_context>

<specifics>
## Specific Ideas

- The accordion stepper should feel snappy — each step collapses to a single summary line showing what was chosen (e.g., "Sales Data • 12 cols", "Bar chart", "Region × Amount, Count"). No wasted vertical space.
- Chart type icons should be recognizable at a glance — distinct silhouettes for each type. Dimmed incompatible types should still be identifiable, just clearly unavailable.
- The live preview area transitions smoothly between contexts: column table → chart type info → live chart render. No jarring layout shifts.
- "Preview Data" is a power-user feature — most users will pick a dataset they already know. Don't make it mandatory, just available.
- The chart library list should feel like a gallery when in card view — the thumbnails make it visual and scannable. Row view is for when you have 50+ charts and need density.
- RecvizChart being PostgreSQL-only (no Superset sync) is a deliberate simplification over the dataset model. Charts are purely a RecViz UI concept — Superset doesn't need to know about them. This avoids the sync complexity from Phase 5.

</specifics>

<deferred>
## Deferred Ideas

- **Custom color palettes** — User-selectable color palettes beyond the default theme. Add when users request more visual control.
- **Chart templates** — Pre-built chart configurations for common recon patterns (break trend, match rate, aging). Phase 8 dashboard templates may subsume this.
- **Chart versioning** — Rollback to previous chart configurations. v2 feature (ADVN-03 covers dashboard versioning).
- **Chart tags** — Tagging for organization. Same deferral as dataset tags (Phase 5). Revisit at scale.
- **Inline chart type switching** — Swap chart type without entering edit mode (TMPL-03, v2 feature).
- **Advanced appearance controls** — Custom hex colors per series, font sizes, grid lines, tooltip format. Add incrementally if essentials prove insufficient.

</deferred>

---

*Phase: 06-chart-library*
*Context gathered: 2026-04-06*
