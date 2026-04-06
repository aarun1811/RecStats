# Roadmap: RecViz

## Overview

RecViz evolves from a working config-driven dashboard renderer into a self-service dashboard builder for Citi's Global Reconciliation Unit. The roadmap starts by hardening the existing foundation (removing mock data, fixing financial formatting, pinning Superset), then builds interactive features into the renderer (cross-filtering, drill-down, export), connects production data sources, adds a dataset management layer for devs, delivers chart and KPI libraries, culminates in the dashboard builder UI for business users, and finishes with sharing and embeddability features. Each phase delivers a coherent, verifiable capability that the next phase depends on.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation Hardening** - Remove mock fallbacks, clean legacy code, add financial formatting, pin Superset, persist configs to database
- [ ] **Phase 2: Cross-Filtering and Drill-Down** - Add client-side cross-filtering and drill-down navigation to the existing dashboard renderer
- [x] **Phase 02.1: Chart Rendering Foundation** - (INSERTED) Fix all major chart types to render correctly from query data, validate Phase 2 cross-filter/drill-down end-to-end (completed 2026-04-05)
- [ ] **Phase 3: Chart and Grid Interactions** - Add fullscreen view, chart/grid export, manual refresh, and configurable auto-refresh to dashboard panels
- [x] **Phase 4: Data Source Connectivity** - Integrate Oracle, Hive, and Elasticsearch via Superset with a connection management UI for the dev team (completed 2026-04-05)
- [x] **Phase 5: Dataset Management** - Dev team can create, edit, and manage datasets with SQL queries, column metadata, and roles
- [x] **Phase 6: Chart Library** - Users can create, save, and reuse charts from datasets with a visual chart type selector and library browser (completed 2026-04-06)
- [ ] **Phase 7: KPI Library** - Dev team defines reusable KPI templates; business users pick and configure KPIs for dashboards
- [ ] **Phase 8: Dashboard Builder** - Business users create dashboards with a grid-based layout editor, adding charts, KPIs, and filters from libraries
- [ ] **Phase 9: Sharing and Views** - Save filter/layout bookmarks, share via URL, embed dashboards in portals, and search everything with Cmd+K

## Phase Details

### Phase 1: Foundation Hardening
**Goal**: The existing codebase is production-ready -- no mock data masking real errors, no dead code that would crash at runtime, financial numbers formatted correctly, Superset integration hardened, and dashboard configs stored in a database with schema versioning
**Depends on**: Nothing (first phase)
**Requirements**: INFR-01, INFR-02, INFR-03, INFR-04, INFR-05, INFR-06
**Success Criteria** (what must be TRUE):
  1. When Superset returns an error, users see a meaningful error message -- never silently fabricated data
  2. All financial values (currency, percentages, large numbers) display with consistent, correct formatting across every component
  3. Dashboard configurations load from and save to a database, not static JSON files on disk
  4. Loading a saved dashboard config through a newer version of the app succeeds via schema migration -- no silent breakage
  5. The codebase compiles and runs with zero dead code paths that would crash at runtime
**Plans:** 3 plans

Plans:
- [x] 01-01-PLAN.md -- Database persistence layer (SQLAlchemy async + Alembic + DB-backed ConfigStore)
- [x] 01-02-PLAN.md -- Number formatting utilities, Superset pinning, legacy dead code cleanup
- [x] 01-03-PLAN.md -- Mock data removal and structured error handling (backend + frontend)

### Phase 2: Cross-Filtering and Drill-Down
**Goal**: Users can click chart elements to instantly filter all other charts on a dashboard, and drill from aggregated views down to raw detail rows
**Depends on**: Phase 1
**Requirements**: INTR-01, INTR-02, INTR-03, INTR-04
**Success Criteria** (what must be TRUE):
  1. Clicking a chart segment (bar, pie slice, data point) filters all other charts on the same dashboard instantly with no loading spinner
  2. Cross-filtered charts show selected items at full color and excluded items dimmed -- a selection bar displays active filters with one-click removal
  3. Clicking aggregated data opens a breakdown level, then a detail level with raw rows in AG Grid -- breadcrumb navigation shows the full drill path
  4. Drill-down detail level loads rows from the backend with full AG Grid sort, filter, and pagination working
**Plans:** 3 plans
**UI hint**: yes

Plans:
- [x] 02-01-PLAN.md -- Foundation data layer: types, stores, utilities, hooks, and tests for cross-filtering and drill-down
- [x] 02-02-PLAN.md -- Cross-filtering UI integration into dashboard renderer, chart grid, KPI row, data grid, and chart wrappers
- [x] 02-03-PLAN.md -- Drill-down UI: breadcrumb navigation, detail grid, chart grid drill insertion, and end-to-end verification

### Phase 02.1: Chart Rendering Foundation (INSERTED)

**Goal:** All major chart types (bar, line, area, pie, donut, scatter, heatmap, treemap) render correctly from query data using configured metric and category columns. Charts properly map data source response columns to AG Charts series options based on chart config. Pie/donut charts use correct angleKey and calloutLabelKey. Chart wrapper is production-grade, not demo-quality. Final step validates Phase 2 cross-filtering and drill-down work end-to-end with properly rendering charts.
**Requirements**: INTR-01, INTR-02
**Depends on:** Phase 2
**Success Criteria** (what must be TRUE):
  1. Bar/line/area charts correctly use sources[].metric as yKey and first non-metric string column as xKey
  2. Pie/donut charts correctly use metric column as angleKey and category column as calloutLabelKey
  3. All chart types render real data from query data sources -- no "No data to display" on valid data
  4. Cross-filtering works visually: clicking a chart segment dims other charts and shows the filter badge bar
  5. Drill-down works visually: double-clicking navigates through hierarchy with breadcrumb, detail grid slides in
**Plans:** 3/3 plans complete
**UI hint**: yes

Plans:
- [x] 02.1-01-PLAN.md -- Config-driven column mapping refactor for AG Charts + ECharts wrappers, error panels, theme overrides
- [x] 02.1-02-PLAN.md -- Showcase dashboard config, dedicated data sources, seed data, and unit tests for buildSeries
- [x] 02.1-03-PLAN.md -- Playwright E2E tests for all chart types, cross-filter/drill-down validation, tlm-stats regression, manual checkpoint

### Phase 3: Chart and Grid Interactions
**Goal**: Users can export, enlarge, and refresh individual charts and grids from toolbar controls on each panel
**Depends on**: Phase 1
**Requirements**: INTR-05, INTR-06, INTR-07, INTR-08, INTR-09
**Success Criteria** (what must be TRUE):
  1. User can expand any chart into a fullscreen modal overlay for detailed inspection, and dismiss it to return to the dashboard
  2. User can export any chart as PNG image, CSV data, or copy to clipboard from a chart toolbar menu
  3. User can export grid data as CSV or Excel using AG Grid's built-in export
  4. User can click a refresh button on a dashboard to invalidate cache and re-fetch all data, with a loading indicator during the refresh
  5. Dashboard auto-refreshes at a configurable interval (default ~10 min), and the user can change the interval per dashboard
**Plans:** 3 plans
**UI hint**: yes

Plans:
- [x] 03-01-PLAN.md -- Chart ref forwarding, export utilities, hover-reveal toolbar, fullscreen dialog
- [x] 03-02-PLAN.md -- Grid toolbar (CSV, Excel, columns, density, auto-size) and dead code cleanup
- [x] 03-03-PLAN.md -- Dashboard manual refresh, auto-refresh with configurable interval and countdown

### Phase 4: Data Source Connectivity
**Goal**: Dev team can connect to Oracle and Hive databases through Superset, with a connection management UI for adding and testing connections. Elasticsearch deferred (DATA-03) to a future phase.
**Depends on**: Phase 1
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04
**Success Criteria** (what must be TRUE):
  1. An Oracle database connection executes queries reliably with connection pooling and results are cached -- query against a million-row table returns within acceptable time
  2. A Hive database connection executes historical/batch queries with caching appropriate for slow-running queries
  3. Elasticsearch is queryable both via Superset SQL (elasticsearch-dbapi) for standard queries and via the FastAPI sidecar (elasticsearch-py) for complex aggregations and full-text search
  4. Dev team can add, edit, and test database connections from a management UI -- test button verifies connectivity before saving
**Plans:** 3 plans
**UI hint**: yes

Plans:
- [x] 04-01-PLAN.md -- Backend: driver installation, cx_Oracle aliasing, URI builder fix, connection status tracker, env-aware config
- [x] 04-02-PLAN.md -- Frontend: dynamic backend-specific form fields, test-before-save enforcement, status dots on cards/rows
- [x] 04-03-PLAN.md -- Verification: Docker build, full test suite, visual verification checkpoint

### Phase 5: Dataset Management
**Goal**: Dev team can create named datasets from SQL queries with rich column metadata, so business users have a curated catalog of data to build charts from
**Depends on**: Phase 4
**Requirements**: DSET-01, DSET-02, DSET-03, DSET-04, DSET-05
**Success Criteria** (what must be TRUE):
  1. Dev creates a dataset by writing SQL in an editor, naming it, and saving -- the dataset persists to the database (not a file on disk)
  2. Each dataset column has configurable metadata: display name, data type, dimension/measure/time role, default aggregation, and format string
  3. Dev can test-execute a dataset query from the editor and preview results in a table before publishing
  4. Dev can edit SQL, column metadata, or delete existing datasets -- changes propagate to any charts using that dataset
**Plans:** 3 plans
**UI hint**: yes

Plans:
- [x] 05-01-PLAN.md -- Backend CRUD + Superset sync: SQLAlchemy model, Alembic migration, Pydantic schemas, API endpoints, DatasetSyncService
- [x] 05-02-PLAN.md -- Frontend foundation: TypeScript types, CRUD hooks, column detection/merge utilities, dataset list page, sidebar nav, Explorer save-as-dataset dialog
- [x] 05-03-PLAN.md -- Dataset editor: Monaco SQL editor, AG Grid column metadata, format presets, SQL re-run enforcement, delete dialog, end-to-end verification

### Phase 6: Chart Library
**Goal**: Users can create charts by mapping dataset columns to visual properties, save them to a reusable library, and browse/search saved charts
**Depends on**: Phase 5
**Requirements**: CHRT-01, CHRT-02, CHRT-03, CHRT-04, CHRT-05, CHRT-06, CHRT-07
**Success Criteria** (what must be TRUE):
  1. User can create a chart by selecting a dataset, mapping columns to axes/metrics, choosing a chart type, and seeing a live preview
  2. Chart type selector shows visual thumbnails and highlights which types are compatible with the selected data shape (e.g., pie needs exactly one measure)
  3. Charts can be saved to a library with a name and description, and the same chart can be added to multiple dashboards
  4. AG Charts renders all standard types (line, bar, area, pie, donut, scatter, heatmap, treemap, waterfall, bullet, box plot, combo) and ECharts renders exotic types only (Sankey, sunburst, radar, network, gauge, parallel coordinates, funnel)
  5. User can browse the chart library, search by name, and preview any saved chart
**Plans:** 3 plans
**UI hint**: yes

Plans:
- [x] 06-01-PLAN.md -- Backend CRUD + types + hooks + chart compatibility utility + icons + nav + route stubs + dataset reference wiring
- [x] 06-02-PLAN.md -- Chart builder accordion stepper with 5 steps, live preview panel, create and edit page wiring
- [x] 06-03-PLAN.md -- Chart library list page with card/row toggle, search/filters, detail side panel, delete dialog

### Phase 7: KPI Library
**Goal**: Dev team defines reusable KPI templates with SQL and formatting rules; business users pick KPIs from the library with animated, color-coded cards
**Depends on**: Phase 5
**Requirements**: KPI-01, KPI-02, KPI-03
**Success Criteria** (what must be TRUE):
  1. Dev team can define a KPI template with a SQL fragment, format rules (currency/percentage/number), and trend indicator logic (direction + threshold)
  2. Business users can browse KPI templates and add them to dashboards -- selecting a metric, configuring threshold colors, and setting trend direction
  3. KPI cards display animated counters (rolling number animation), trend arrows with percentage change, and configurable status colors (green/amber/red)
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD

### Phase 8: Dashboard Builder
**Goal**: Business users can create, edit, and manage complete dashboards through a visual builder with drag-and-drop layout, chart/KPI/filter placement, and save/publish workflow
**Depends on**: Phase 2, Phase 3, Phase 6, Phase 7
**Requirements**: BLDR-01, BLDR-02, BLDR-03, BLDR-04, BLDR-05, BLDR-06, BLDR-07, BLDR-08
**Success Criteria** (what must be TRUE):
  1. User can create a new dashboard with a title and description, entering a visual editor with an empty 12-column grid canvas
  2. User can drag, drop, and resize chart panels, KPI cards, and filter bars on the grid layout -- elements snap to grid and avoid overlap
  3. User can add charts by building a new one inline or picking from the chart library, and add KPIs from the KPI library
  4. User can add, remove, and configure dashboard filters from available dataset columns
  5. View mode (consumer experience) and edit mode (builder experience) are visually distinct and toggle cleanly
  6. Dashboards persist to database with Save, Save As (clone), and Delete -- the dashboard list page shows all dashboards with search, title, description, last modified, and creator
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 08-01: TBD
- [ ] 08-02: TBD
- [ ] 08-03: TBD

### Phase 9: Sharing and Views
**Goal**: Users can save personalized views, share exact dashboard states via URL, embed dashboards in internal portals, and find anything through a command palette
**Depends on**: Phase 8
**Requirements**: SHAR-01, SHAR-02, SHAR-03, SHAR-04
**Success Criteria** (what must be TRUE):
  1. User can save current filter state and layout tweaks as a named bookmark, and restore it later
  2. Sharing a dashboard URL preserves all filter selections -- the recipient opens the exact same view
  3. Dashboards can be embedded in iframes with URL-param filters, locked filters, theme override, and chromeless mode
  4. Cmd+K command palette searches across dashboards, datasets, charts, and saved views -- results navigate directly to the selected item
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 09-01: TBD
- [ ] 09-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 02.1 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation Hardening | 0/3 | Planning complete | - |
| 2. Cross-Filtering and Drill-Down | 0/3 | Planning complete | - |
| 02.1. Chart Rendering Foundation | 3/3 | Complete   | 2026-04-05 |
| 3. Chart and Grid Interactions | 0/3 | Planning complete | - |
| 4. Data Source Connectivity | 3/3 | Complete | 2026-04-05 |
| 5. Dataset Management | 3/3 | Complete | 2026-04-06 |
| 6. Chart Library | 3/3 | Complete | 2026-04-06 |
| 7. KPI Library | 0/0 | Not started | - |
| 8. Dashboard Builder | 0/0 | Not started | - |
| 9. Sharing and Views | 0/0 | Not started | - |
