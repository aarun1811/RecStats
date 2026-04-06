# Phase 8: Dashboard Builder - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Business users can create, edit, and manage complete dashboards through a visual builder with drag-and-drop grid layout, chart/KPI/filter/grid placement, and save/publish workflow. The builder produces the same DashboardConfig JSON that the existing renderer already consumes — it's a visual editor for what devs currently hand-write in JSON. View mode and edit mode are visually distinct via dedicated routes.

**Requirements covered:** BLDR-01, BLDR-02, BLDR-03, BLDR-04, BLDR-05, BLDR-06, BLDR-07, BLDR-08

</domain>

<decisions>
## Implementation Decisions

### Grid Layout Engine
- **D-01:** Use **react-grid-layout** for the drag-and-drop grid canvas. 12-column grid with snap-to-grid, collision detection, and layout serialization. Maps 1:1 to the existing `ChartLayout` type (`col`, `row`, `width`, `height`).
- **D-02:** **Type-based minimum sizes:** Charts min 3×3, KPI cards min 2×2, Data grids min 6×4, Filter bar 12×1 (fixed, not a grid item).
- **D-03:** **Title bar drag + corner resize.** Grip icon (≡) on panel header initiates drag. Bottom-right corner handle for resize. Edit (✎) and remove (×) buttons on the header. Chart content stays interactive during edit mode.
- **D-04:** **Vertical compaction ON.** Items always float up to fill vertical gaps. Prevents empty rows in the middle of the dashboard.
- **D-05:** **No overlap, push others.** react-grid-layout default collision detection — dragging an item pushes others out of the way.
- **D-06:** **Fixed 80px row height.** Grid gap 16px (Tailwind `gap-4`). KPI card (2 rows) = 160px, standard chart (4 rows) = 320px, data grid (6 rows) = 480px.
- **D-07:** **Undo/redo for layout changes.** Ctrl+Z / Ctrl+Shift+Z. Zustand store with layout JSON snapshots, capped at ~50 entries, reset on Save. Client-only, no backend calls.

### Builder Canvas UX
- **D-08:** **In-place WYSIWYG editing.** The edit page IS the dashboard at full width. Edit toolbar appears at top, dashed grid lines on canvas background, panels get drag handles + edit/remove buttons, blue outline on hover. Real data renders inside charts while editing.
- **D-09:** **Route pattern mirrors charts (Phase 6 D-04):** `/dashboards` (list), `/dashboards/new` (create, auto edit mode), `/dashboards/:id` (view), `/dashboards/:id/edit` (edit). Same pattern as chart and KPI pages.
- **D-10:** **Full-page canvas with top toolbar.** No side panel. The toolbar contains: [+ Add], [Undo], [Redo], [Save], [Save As], [Cancel/Exit]. WYSIWYG: what you build is what users see.
- **D-11:** **Single [+ Add] button** with type picker dropdown: Chart, KPI, Data Grid, Filter. Each type opens its own library/picker dialog.
- **D-12:** **Library dialog picker for charts and KPIs.** Browse existing library items with search and filter. Cards showing name + type icon. [+ Create New] link navigates to the chart/KPI builder page (Phase 6/7). After saving, return to dashboard and add it. No inline builder.
- **D-13:** **Panel edit button (✎) opens config popover** attached to the panel with panel-specific settings: title override, cross-filter toggle, drill hierarchy config, per-chart refresh interval. [Edit Chart →] link navigates to the full chart/KPI builder.
- **D-14:** **Centered empty state** for new dashboards: "Start building your dashboard" message + large [+ Add Content] button + hint text. Dashed grid visible. Title editable inline. Empty state disappears on first item added.
- **D-15:** **WYSIWYG is sufficient** — no separate preview mode. Charts render live data in edit mode. Only differences from view mode: dashed grid, drag/resize handles, edit toolbar.

### Dashboard Persistence
- **D-16:** **Extend existing ConfigStore** with full CRUD operations (create, update, delete). Rename table to `recviz_dashboards` if needed for consistency. Same DashboardConfig JSON shape — builder produces what devs already write manually. Existing dev-built config dashboards keep working with minor field additions if needed (backward-compatible).
- **D-17:** **Save As = deep copy with new UUID.** Full DashboardConfig JSON copied. Chart/KPI references stay the same IDs (references, not copies). New name defaults to "Copy of [original]". Dialog with name + description fields.
- **D-18:** **Dashboard list page fully upgraded** to match chart/KPI library pattern: card/row toggle, search by name, metadata on cards (description, last modified), working [+ Create Dashboard] button.
- **D-19:** **Simple delete confirmation dialog.** Dashboards are top-level entities — nothing references them. "Are you sure?" confirmation. Charts and KPIs are NOT deleted from their libraries. Redirects to /dashboards list after delete.

### Filter Configuration
- **D-20:** **Dataset column picker** to add filters. Click [+ Add] → Filter → dialog shows all datasets used by charts on this dashboard → expand dataset to see columns → pick columns to become filters. Filter type auto-detected from column metadata (string → single/multi-select, date → date range, number → range slider). User can override.
- **D-21:** **Auto-match + manual override per chart for filter column mapping.** When adding a filter on 'region', auto-match any chart whose dataset has a 'region' column. For charts without an exact match, show their columns so the user can manually pick the equivalent (e.g., map 'region' filter to 'country' column in another chart). Unmatched charts excluded.
- **D-22:** **Cascading filters supported.** Existing `dependsOn` field in FilterConfig. Builder UI: optional "Depends on" dropdown listing other filters on the dashboard.
- **D-23:** **Drag to reorder filters** in edit mode. Grip handles on each filter in the bar. Order matters for cascading (parent before child).
- **D-24:** **Filter bar fixed at top, outside grid.** Not a draggable grid item. Always above the react-grid-layout canvas. Matches existing dashboard-renderer pattern.

### Data Grid Panel
- **D-25:** **Pick dataset → auto-populate columns.** Dataset picker dialog (same as chart library dialog but for datasets). Grid appears on canvas with all columns from the selected dataset. Panel config popover (✎) to customize: column visibility toggles, default sort column/direction, row limit (50/100/500/1000).

### Cross-Filter and Drill-Down Config
- **D-26:** **Research required** — how to configure cross-filter participation and column mapping per chart in the builder. The existing toggle (Phase 2 D-06) and column-name matching (Phase 2 D-07) work for auto config, but manual override for mismatched column names needs investigation.
- **D-27:** **Research required** — how to visually configure drill hierarchies per chart in the builder. The existing `drillHierarchy` array and `drillDetailDataSourceId` fields need a builder UI.
- **D-28:** **Research required** — filter value population strategy when a filter maps to columns across multiple datasets with different names. Which dataset(s) to query for DISTINCT values?

### Unsaved Changes
- **D-29:** Claude's discretion — pick the right unsaved changes handling (browser warning, confirm dialog, or auto-save drafts) based on complexity vs. safety tradeoff.

### Clean Build Approach
- **D-30:** **Clean rewrite.** No obligation to reuse existing dashboard builder code. The existing `dashboard-renderer.tsx` and its components will be evaluated for patterns but the builder is built fresh and clean.

### Planning Directive
- **D-31:** **Many small plans across waves** instead of few large plans. This is the most complex phase — smaller plans enable faster verification cycles, catch UI issues early, and produce testable results at each step. Each plan should deliver a visible, verifiable piece of the builder.

### Claude's Discretion
- Dashboard metadata editing UX (inline title + popover, settings dialog, etc.)
- Unsaved changes handling approach
- Edit toolbar layout and icon choices
- Panel config popover design details
- Library picker dialog card layout
- Empty state illustration/icon
- react-grid-layout configuration details (margin, container padding)
- Animation timings for drag/resize/mode transitions

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing dashboard system (evaluate patterns, clean rewrite)
- `frontend/src/components/dashboard/dashboard-renderer.tsx` — Main renderer that consumes DashboardConfig. The builder produces config for this renderer.
- `frontend/src/components/dashboard/config-chart-grid.tsx` — Chart grid rendering. Study the card structure for builder panel design.
- `frontend/src/components/dashboard/config-filter-bar.tsx` — Filter bar rendering. Builder configures what this renders.
- `frontend/src/components/dashboard/config-kpi-row.tsx` — KPI row rendering with cross-filter support.
- `frontend/src/components/dashboard/config-data-grid.tsx` — Data grid rendering with toolbar.
- `frontend/src/types/dashboard-config.ts` — DashboardConfig type — the JSON shape the builder produces.

### Backend — dashboard endpoints (extend with CRUD)
- `backend/app/api/dashboards.py` — Existing list/get/kpis endpoints. Add create/update/delete.
- `backend/app/services/config_store.py` — ConfigStore service. Extend with CRUD operations.

### Chart library (pattern for add-to-dashboard dialog)
- `frontend/src/components/charts/chart-library-list.tsx` — Library list page with card/row toggle. Clone for dashboard list upgrade.
- `frontend/src/components/charts/chart-library-card.tsx` — Card component pattern.
- `frontend/src/components/charts/chart-detail-panel.tsx` — Detail side panel.
- `frontend/src/hooks/use-managed-charts.ts` — CRUD hooks. Reference for dashboard CRUD hooks.
- `frontend/src/types/managed-chart.ts` — RecvizChart type with ChartDeleteCheck.

### KPI library (pattern for add-to-dashboard dialog)
- `frontend/src/components/kpis/kpi-library-list.tsx` — KPI library list page.
- `frontend/src/hooks/use-managed-kpis.ts` — KPI CRUD hooks.
- `frontend/src/types/managed-kpi.ts` — RecvizKpi type.

### Dataset management (referenced by grid panel picker)
- `frontend/src/hooks/use-managed-datasets.ts` — Dataset list/CRUD hooks.
- `frontend/src/types/managed-dataset.ts` — RecvizDataset type with column metadata.

### Cross-filter and drill-down (builder configures these)
- `frontend/src/stores/filter-store.ts` — Cross-filter state management.
- `frontend/src/stores/drill-store.ts` — Per-chart drill state.
- `frontend/src/hooks/use-cross-filter.ts` — Cross-filter hook.
- `frontend/src/hooks/use-drill-down.ts` — Drill-down hook.

### Routing (add new routes)
- `frontend/src/routes/_app/dashboards/` — Existing dashboard routes (index, $dashboardId). Add new, $dashboardId.edit.

### Project context
- `.planning/PROJECT.md` — Project vision, builder is core product
- `.planning/REQUIREMENTS.md` — BLDR-01 through BLDR-08
- `CLAUDE.md` — Coding conventions, tech stack, charting rules

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DashboardConfig` type: Already defines the full dashboard JSON shape (filters, KPIs, charts, grids, layout, features). Builder produces this exact shape.
- `ChartLayout` type: `{col, row, width, height}` — maps directly to react-grid-layout's layout format.
- `ConfigFilterBar`, `ConfigKpiRow`, `ConfigChartGrid`, `ConfigDataGrid`: Renderer components. The builder produces config, these render it.
- Chart/KPI library list pages: Card/row toggle, search, toolbar pattern — clone for dashboard list upgrade and picker dialogs.
- Delete dialog pattern: Confirmation dialog from chart/KPI libraries — adapt for dashboard delete.
- `use-managed-charts.ts` / `use-managed-kpis.ts`: CRUD hooks with TanStack Query — reference for dashboard CRUD hooks.
- `Empty` component: Composable empty state — use for empty canvas.
- Cross-filter bar, drill breadcrumb: Already implemented — work in view mode automatically.

### Established Patterns
- File-based routing with TanStack Router (/new, /:id, /:id/edit)
- TanStack Query for server state, Zustand for client state
- Shadcn components for UI primitives
- ConfigStore service for dashboard persistence
- AG Grid Enterprise for data tables
- AG Charts / ECharts for chart rendering
- Panel config popover pattern (not yet established — new for builder)

### Integration Points
- `backend/app/api/router.py` — Extend dashboard routes with CRUD
- `frontend/src/routes/_app/dashboards/` — Add /new and /$dashboardId.edit routes
- Sidebar navigation — "Dashboards" already exists as nav item
- `DashboardConfig` type — builder writes this, renderer reads it
- Chart/KPI library hooks — reuse for picker dialogs
- Dataset hooks — reuse for grid panel and filter column pickers

</code_context>

<specifics>
## Specific Ideas

- The builder is the **core product** of RecViz. 12,000 reconciliations, 100+ dashboards needed. It must be polished, intuitive, and reliable.
- **Many small plans** — break into fine-grained waves for fast verification. Each plan should produce a visible, testable result.
- **Clean rewrite** — no reuse obligation for existing dashboard code. Build the builder fresh with clean architecture.
- The existing `DashboardConfig` JSON shape stays — the builder is just a visual editor that produces it. Dev-built config dashboards continue working.
- Filter column mapping is critical for real-world usage — datasets from different teams will use different column names for the same concept (e.g., `region` vs `country` vs `geo_code`).
- The WYSIWYG approach means users see real data while building — no "preview" step needed. This is a significant UX advantage.
- Undo/redo is essential — users will accidentally drag panels and need to revert.
- The [+ Add] → type picker → library dialog flow keeps the toolbar clean while providing access to all content types.

</specifics>

<deferred>
## Deferred Ideas

- **Dashboard templates** (TMPL-01) — Pre-built layouts as starting points. Could be added later as a "start from template" option in the empty state.
- **Dashboard versioning** (ADVN-03) — Rollback to previous saved states. v2 feature.
- **User-configurable KPI thresholds** — When adding KPI to dashboard, allow overriding threshold values. Mentioned in Phase 7 deferred.
- **Custom color palettes** — Per-dashboard color theme override. Mentioned in Phase 6 deferred.
- **Inline chart type switching** (TMPL-03) — Swap chart type without entering edit mode. v2 feature.

</deferred>

---

*Phase: 08-dashboard-builder*
*Context gathered: 2026-04-07*
