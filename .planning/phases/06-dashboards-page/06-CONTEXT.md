# Phase 6: Dashboards Page - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Colorize all dashboard-related pages (list, detail/renderer, builder, embed), fix the broken data pipeline by eliminating the Superset-era `recviz_data_sources` table reads and rewiring to `recviz_datasets` + `recviz_connections`, delete legacy dead code and audit stores for dead paths, apply full premium polish to the renderer and list page matching Phase 2-4 quality, and verify the entire dashboard lifecycle end-to-end against Oracle via Playwright MCP.

</domain>

<decisions>
## Implementation Decisions

### Pipeline Fix (DASH-03 — Critical)
- **D-01:** Rewire `ConfigStore` (backend/app/services/config_store.py) to read from `recviz_datasets` + `recviz_connections` instead of `recviz_data_sources`. The dashboard renderer calls `/api/data-sources/{dataSourceId}/query` where `dataSourceId` is actually a `recviz_datasets.id` (the builder stores `item.chart.datasetId` as `sources[].dataSourceId`). The current `ConfigStore` reads from `recviz_data_sources` which is only populated by the seed script — any dataset created through the UI has no matching `recviz_data_sources` row, so dashboards built from user-created datasets 404 at render time.
- **D-02:** The fix: `ConfigStore.get_data_source()` reads `RecvizDataset` by ID, builds a `DataSourceConfig` from its fields (`sql` → `query`, `database_id` → resolve connection name from `recviz_connections`, `columns` → column defs). Filter mappings are built from the dataset's column metadata or stored in the dashboard config. `QueryExecutor._resolve_database()` continues to use `ConnectionResolver` to map connection names to UUIDs.
- **D-03:** `recviz_data_sources` table is NOT dropped this phase — that's Phase 8 Alembic audit scope. The seed script can continue writing to it for now; the backend just stops reading from it.
- **D-04:** The `/api/data-sources/*` API routes (`backend/app/api/data_sources.py`) are also rewired to use the new `ConfigStore` that reads `recviz_datasets`. The `ResolvedDataSourceDep` dependency continues to work the same way from the caller's perspective.

### List Page Polish (DASH-01)
- **D-05:** Dashboard cards get `motion.div` wrapper with `whileHover={{ y: -2 }}` and stagger entrance animation (`initial={{ opacity: 0, y: 8 }}` with `transition={{ delay: index * 0.05 }}`), matching Phase 2-4 card patterns.
- **D-06:** Cards get `border-l-2 border-l-primary` accent — all dashboards use the primary/blue color since dashboards are composite entities (no per-type categorization like charts).
- **D-07:** `AnimatePresence` crossfade (200ms opacity, `mode="wait"`) on grid/list view toggle, matching Phase 3/4 pattern.
- **D-08:** Filtered empty state ("No dashboards matching...") upgraded from bare `<p>` to `Empty` component with search icon, matching Phase 3/4 pattern.
- **D-09:** Dashboard list rows get matching `motion.div` wrapper with stagger entrance and `border-l-2 border-l-primary` accent.

### Dashboard Detail Header
- **D-10:** Dashboard detail/view page gets a proper header area: dashboard name as `h1`, description below, metadata row showing panel counts (e.g., "3 KPIs · 5 Charts · 1 Grid"), last updated time, and edit/share/delete action buttons. Matches entity-page header treatment from Phase 2-4.

### Renderer Premium Treatment (DASH-04, DASH-05, DASH-06)
- **D-11:** Filter bar gets a section header with icon (SlidersHorizontal or Filter from Lucide) and subtle primary-tinted accent. Filter dropdowns get stagger entrance animation when the dashboard loads.
- **D-12:** KPI row cards get `border-l-2` accent colored by trend direction: green for positive trend, red for negative trend, muted for neutral/no trend. Cards get entrance animation when data loads (fade + scale spring). Verify semantic colors use proper `text-green-600 dark:text-green-400` / `text-red-600 dark:text-red-400` pattern.
- **D-13:** Chart grid panels get subtle entrance animations as each chart loads (fade in from skeleton). Chart card toolbar (fullscreen, refresh, drill) fades in on hover.
- **D-14:** Dashboard toolbar: refresh button gets spin animation on click, auto-refresh countdown gets visual progress indicator, share button shows copy-confirmed toast.
- **D-15:** Cross-filter bar already has `motion/react` animations — verify and polish. Ensure cross-filter chip styling matches the Phase 2-4 badge patterns.
- **D-16:** Drill-down breadcrumb and drill detail grid get polish: breadcrumb entrance animation, detail grid skeleton loading, smooth transitions between drill levels.
- **D-17:** Cross-filter configuration UI and drill-down filter configuration UI both get polish treatment matching the Phase 2-4 premium quality level.

### Builder Light Polish
- **D-18:** Builder filter bar chips get entrance/exit animations via `motion/react` when filters are added/removed. Reorder animation (currently native drag-and-drop) stays as-is.
- **D-19:** Picker dialogs (ChartPickerDialog, KpiPickerDialog, DatasetPickerDialog, FilterConfigDialog) get polish: dialog entrance animation, card grid with hover states, search filtering. Match Phase 2-4 dialog/sheet patterns.
- **D-20:** Builder canvas panel hover states get subtle elevation change on hover. Panel edit/delete actions animate in. Builder toolbar and empty state are already polished — no changes needed.

### Legacy Code Audit (DASH-07)
- **D-21:** The legacy dead dashboard files (`filter-bar.tsx`, `kpi-row.tsx`, `chart-grid.tsx`) are already deleted — confirmed via filesystem check. DASH-07 scope becomes: grep for any remaining imports or references to these files, and remove stale references.
- **D-22:** Full audit of Zustand stores: `filter-store.ts`, `drill-store.ts`, `builder-store.ts`, `layout-history-store.ts` — identify and remove dead state slices, unused actions, legacy shapes from the pre-config-driven era. Any Superset-era references cleaned up.
- **D-23:** Stale Superset reference in `dashboard-renderer.tsx` line 65 comment ("TQ scheduling + HTTP/2 multiplexing + Superset cache handle concurrency") — remove.

### Embed Route (DASH-08)
- **D-24:** Verify `/embed/dashboards/:id` with all URL parameters: `?filter.*=value`, `?filter.lock=field`, `?hide=sidebar,header,filter-bar,toolbar`, `?theme=dark`. Each param tested individually and in combination.
- **D-25:** `?theme=dark` applies dark mode to the embed view. If not currently supported, implement it by reading the URL param and applying the dark class to the embed root.
- **D-26:** `dashboard-url-state.ts` filter round-tripping must survive — verify URL search param sync works correctly when filters are applied, locked, and reset.

### E2E Verification (DASH-02, DASH-04, DASH-09)
- **D-27:** Full dashboard lifecycle verified via Playwright MCP against live Oracle: create new dashboard → add chart/KPI/grid panels → configure global filters → configure cross-filter → configure drill-down hierarchy → save → view rendered dashboard → verify data loads from Oracle → test global filter apply/reset → test cross-filter click interactions → test drill-down navigation → edit dashboard → delete dashboard. Both light and dark mode.
- **D-28:** All CRUD operations round-trip against Oracle 19c — create, read, update, delete. Verify the pipeline fix (D-01/D-02) works for both seeded dashboards and newly-created dashboards with user-created datasets.

### Claude's Discretion
- Exact animation timing and easing curves for renderer section entrances
- Section header icon choices for filter bar, KPI row, chart grid
- KPI card trend accent color exact mapping (which trend values map to green/red/neutral)
- Detail header metadata row layout and spacing
- Picker dialog internal layout and card grid arrangement
- How to build `DataSourceConfig.filter_mappings` from `RecvizDataset` when rewiring ConfigStore

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — DASH-01 through DASH-10
- `.planning/ROADMAP.md` — Phase 6 details, success criteria, known risks/gotchas

### Prior phase context
- `.planning/phases/01-infrastructure-cutover/01-CONTEXT.md` — Oracle setup, Mist+Blue palette, `--series-1..8` CSS vars, chart-themes.ts, AG Grid token bridge
- `.planning/phases/02-settings-page/02-CONTEXT.md` — Premium polish patterns (AnimatedStatusBadge, card hover lift, border-l accent, motion/react conventions, detail panel Sheet, connection test state machine)
- `.planning/phases/03-datasets-page/03-CONTEXT.md` — style-constants.ts shared constants, card stagger entrance, AnimatePresence crossfade, column metadata help sheet, filtered empty state, section header icons
- `.planning/phases/04-charts-page/04-CONTEXT.md` — Chart type color map, series color picker, detail panel mirror, builder wizard polish, ECharts thumbnails

### Dashboard frontend (key files to read)
- `frontend/src/components/dashboard/dashboard-list.tsx` — List with grid/list toggle, search, empty states
- `frontend/src/components/dashboard/dashboard-list-card.tsx` — Card with minimap, panel counts, delete
- `frontend/src/components/dashboard/dashboard-list-row.tsx` — Row with icon, stats, chevron
- `frontend/src/components/dashboard/dashboard-list-toolbar.tsx` — Search, view toggle, create button
- `frontend/src/components/dashboard/dashboard-renderer.tsx` — Config-driven renderer (filter bar + KPIs + charts + grids)
- `frontend/src/components/dashboard/config-filter-bar.tsx` — Global filter dropdowns
- `frontend/src/components/dashboard/config-kpi-row.tsx` — KPI animated counter cards
- `frontend/src/components/dashboard/config-chart-grid.tsx` — Chart panels with data fetching
- `frontend/src/components/dashboard/config-data-grid.tsx` — Data grid panels
- `frontend/src/components/dashboard/cross-filter-bar.tsx` — Cross-filter chip bar (has motion)
- `frontend/src/components/dashboard/drill-breadcrumb.tsx` — Drill-down breadcrumb navigation
- `frontend/src/components/dashboard/drill-detail-grid.tsx` — Drill detail data grid
- `frontend/src/components/dashboard/dashboard-toolbar.tsx` — Refresh, auto-refresh, share controls
- `frontend/src/components/dashboard/chart-toolbar.tsx` — Per-chart fullscreen, refresh, drill actions
- `frontend/src/components/dashboard/dashboard-mini-map.tsx` — Card minimap thumbnails

### Builder frontend
- `frontend/src/components/builder/builder-page.tsx` — Builder entrypoint with serializeConfig
- `frontend/src/components/builder/builder-canvas.tsx` — RGL drag-and-drop grid
- `frontend/src/components/builder/builder-toolbar.tsx` — Mode badge, undo/redo, save actions
- `frontend/src/components/builder/builder-filter-bar.tsx` — Filter chip drag-reorder bar
- `frontend/src/components/builder/builder-empty-state.tsx` — SVG blueprint empty state (has motion)
- `frontend/src/components/builder/chart-picker-dialog.tsx` — Chart selection for builder
- `frontend/src/components/builder/kpi-picker-dialog.tsx` — KPI selection for builder
- `frontend/src/components/builder/dataset-picker-dialog.tsx` — Dataset selection for builder
- `frontend/src/components/builder/filter-config-dialog.tsx` — Filter configuration dialog
- `frontend/src/components/builder/save-dashboard-dialog.tsx` — Save/save-as dialog
- `frontend/src/components/builder/panel-config-popover.tsx` — Per-panel config popover
- `frontend/src/components/builder/drill-hierarchy-editor.tsx` — Drill-down config editor

### Embed route
- `frontend/src/routes/embed/dashboards/$dashboardId.tsx` — Embed route (no sidebar/header)
- `frontend/src/lib/dashboard-url-state.ts` — URL filter param sync

### Stores (audit targets)
- `frontend/src/stores/filter-store.ts` — Global filters, cross-filters, applied snapshot
- `frontend/src/stores/drill-store.ts` — Per-chart drill stacks
- `frontend/src/stores/builder-store.ts` — In-progress dashboard edits
- `frontend/src/stores/layout-history-store.ts` — Undo/redo for RGL layouts

### Backend (pipeline fix targets)
- `backend/app/services/config_store.py` — ConfigStore reads recviz_data_sources (REWIRE TARGET)
- `backend/app/services/config_migrator.py` — Legacy config shape migration (may become unnecessary)
- `backend/app/models/data_source_config.py` — DataSourceConfig Pydantic model (may need restructuring)
- `backend/app/api/data_sources.py` — Data source query/merge/distinct endpoints
- `backend/app/services/query_engine.py` — QueryExecutor with _resolve_database, _build_sql
- `backend/app/services/connection_resolver.py` — ConnectionResolver name→UUID cache
- `backend/app/core/dependencies.py` — ResolvedDataSourceDep, ConfigStoreDep
- `backend/app/db/models/data_source.py` — RecvizDataSource ORM model (being phased out)
- `backend/app/db/models/dataset.py` — RecvizDataset ORM model (new source of truth)
- `backend/app/db/models/connection.py` — RecvizConnection ORM model
- `backend/app/api/managed_dashboards.py` — Dashboard CRUD endpoints

### Hooks
- `frontend/src/hooks/use-managed-dashboards.ts` — Dashboard CRUD hooks
- `frontend/src/hooks/use-data-source-query.ts` — Data source query hook (calls /api/data-sources/)
- `frontend/src/hooks/use-dashboard-kpis.ts` — KPI data fetching for dashboards
- `frontend/src/hooks/use-cross-filter-data.ts` — Cross-filter client-side processing
- `frontend/src/hooks/use-cross-filter.ts` — Cross-filter click handlers
- `frontend/src/hooks/use-drill-down.ts` — Drill-down navigation logic
- `frontend/src/hooks/use-auto-refresh.ts` — Auto-refresh countdown hook

### Shared infrastructure
- `frontend/src/lib/style-constants.ts` — Shared style maps (add dashboard accent if needed)
- `frontend/src/lib/chart-themes.ts` — CSS variable reads for chart colors
- `frontend/src/index.css` — Global palette CSS variables
- `scripts/seed-oracle.py` — Seed script (creates paired recviz_datasets + recviz_data_sources rows)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `motion/react`: Already used in builder-empty-state, cross-filter-bar, page transitions — extend to cards, renderer sections
- `Empty` component: Used in dashboard-list for "No dashboards yet" — reuse for filtered empty state
- `AnimatedStatusBadge` (Phase 2): Reference for KPI trend accent animation
- `style-constants.ts` (Phase 3): Shared style map home — already has BACKEND_COLORS, STATUS_STYLES, CHART_TYPE_COLORS
- `chart-factory.tsx`: Clean AG Charts / ECharts routing — no changes needed
- `CountAnimation` (shared): Used by config-kpi-row for animated counters — already working

### Established Patterns
- Card hover lift: `motion.div` with `whileHover={{ y: -2 }}` + `transition={{ duration: 0.15, ease: 'easeOut' }}` (Phase 2/3/4)
- Border-l accent: `border-l-2 border-l-{color}` on cards/rows (Phase 2/3/4)
- AnimatePresence crossfade: `mode="wait"` with opacity for view toggles (Phase 3/4)
- Stagger entrance: `initial={{ opacity: 0, y: 8 }}` with `transition={{ delay: i * 0.05 }}` (Phase 3/4)
- Section header icons: Lucide icon + primary-tinted accent (Phase 3)
- Detail panel: Sheet with sticky footer, section headers, metadata grid (Phase 2/4)

### Integration Points
- `config_store.py`: Rewire to read `RecvizDataset` + `RecvizConnection` instead of `RecvizDataSource`
- `data_source_config.py`: May need restructuring to build from dataset fields instead of raw JSON config
- `dashboard-renderer.tsx`: Remove Superset comment, add section headers
- `dashboard-list.tsx`: Wrap card/row renders in motion.div, add AnimatePresence
- `dashboard-list-card.tsx`: Add motion wrapper, border-l-2 accent
- `dashboard-list-row.tsx`: Add motion wrapper, border-l-2 accent
- `config-kpi-row.tsx`: Add trend-colored border-l-2, entrance animation
- `config-chart-grid.tsx`: Add chart entrance animation, toolbar fade-in

</code_context>

<specifics>
## Specific Ideas

- The pipeline fix is the highest priority — it's the only thing that makes non-seeded dashboards work. Everything else is polish.
- Dashboard cards use primary/blue accent (not per-type) because dashboards are composite entities
- Full E2E verification via Playwright MCP must cover the complete lifecycle including global filter, cross-filter, and drill-down configuration — not just CRUD
- KPI trend accent colors (green/red) must use explicit `dark:` variants, never opacity modifiers
- Cross-filter bar already has motion — verify and polish, don't rewrite
- Builder toolbar and empty state are already polished — don't touch them
- The `recviz_data_sources` table is NOT dropped this phase — just stop reading from it. Table drop is Phase 8 scope.

</specifics>

<deferred>
## Deferred Ideas

- Drop `recviz_data_sources` table and remove from Alembic migration — Phase 8 Alembic audit scope
- Seed script update to stop writing `recviz_data_sources` rows — Phase 8 cleanup scope
- `config_migrator.py` removal — Phase 8, after `recviz_data_sources` is fully removed
- RGL drag-and-drop motion feedback in builder — potential future polish, not this phase

</deferred>

---

*Phase: 06-dashboards-page*
*Context gathered: 2026-04-13*
