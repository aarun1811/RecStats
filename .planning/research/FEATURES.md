# Feature Research

**Domain:** Internal BI/visualization platform replacing Tableau/Qlik for financial reconciliation
**Researched:** 2026-04-04
**Confidence:** HIGH (primary sources: Tableau/Qlik official docs, BI buyer guides, reconciliation domain analysis)

## Feature Landscape

### Table Stakes (Users Expect These)

Features Tableau/Qlik users assume exist. Missing any of these and the tool feels broken compared to what they already have.

#### A. Dashboard Builder Core

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Chart builder: dataset-to-chart pipeline** | Tableau/Qlik core workflow. Users pick a dataset, select columns for axes/metrics, choose chart type, see preview. Without this, there is no self-service. | HIGH | The central product feature. Needs: dataset picker, column list with types, drag/drop or select columns to X/Y/metric slots, aggregation function picker (SUM, COUNT, AVG, MIN, MAX), chart type selector with preview, and a "Run" button. Superset Explore view is the reference model, but with a cleaner UX. |
| **Chart type selector with visual thumbnails** | Tableau "Show Me" panel, Qlik "Add chart" menu. Users expect to see what chart types are available and pick visually. | LOW | Grid of chart type icons. Highlight which types are compatible with the selected data shape (e.g., pie needs 1 dimension + 1 measure). AG Charts + ECharts types already cataloged in CLAUDE.md. |
| **Dashboard layout editor (grid-based)** | Tableau tiled layout, Power BI grid snap. Users need to arrange multiple charts, KPIs, and grids on a canvas. | HIGH | 12-column CSS grid with drag-to-resize handles. Panels snap to grid. Existing `config-chart-grid.tsx` uses 12-col grid already. Add drag-and-drop reordering + resize handles. Libraries: `react-grid-layout` or custom with `react-dnd`. |
| **Global filter bar** | Both Tableau and Qlik have prominent filter bars. Date range, dropdowns, multi-select. Filters apply to all charts. | LOW (exists) | Already built in `config-filter-bar.tsx`. Supports single-select, multi-select, preset-range with cascading dependencies. Needs to be wired into the builder so users can configure which filters appear. |
| **Cross-filtering (click chart to filter others)** | Tableau "Use as Filter" is a one-click setup. Qlik does this automatically via the associative model. This is the single most expected interactive feature. | MEDIUM | Click a bar/slice/point in Chart A, all other charts on the dashboard filter to that selection. Already designed in legacy code (`cross-filter.ts`, `cross-filter-bar.tsx`). Needs porting to config-driven system. Must be client-side only (Zustand + useMemo on cached data). Zero network calls. |
| **Drill-down (hierarchy navigation)** | Tableau hierarchy sets + set actions. Qlik automatic drill-down dimensions. Users click an aggregated value to see breakdown, then detail rows. | MEDIUM | Breadcrumb navigation: Summary -> Category -> Sub-category -> Detail rows. Already designed in legacy code (`drill-store.ts`, `use-drill-down.ts`, `drill-breadcrumb.tsx`). Needs porting. Client-side for aggregated levels, backend call for detail level (AG Grid). |
| **KPI cards with trend indicators** | Every BI tool shows headline numbers. Trend arrows (up/down), percentage change, sparklines. | LOW (exists) | Already built: `config-kpi-row.tsx` + `count-animation.tsx`. Users need to configure which metrics become KPIs in the builder. |
| **Data grid with sort, filter, pagination** | AG Grid or equivalent. Analysts live in grids. Column sorting, text/number filtering, pagination for large datasets. | LOW (exists) | Already built: `config-data-grid.tsx` with AG Grid Enterprise. Quartz theme, 100 rows/page, quick-filter search. Needs: column show/hide toggle, column reorder. |
| **Save and load dashboards** | Fundamental. Users create a dashboard, save it, come back later. | MEDIUM | Currently JSON config files on disk. Needs: save to database (Oracle sidecar DB), version history, "Save As" for cloning. The dashboard config schema (`DashboardConfig` type) is the persistence format. |
| **Dark/light theme toggle** | Modern expectation. Many finance users work in dark mode. | LOW (exists) | Already built. CSS variable theming via Shadcn. AG Grid Quartz theme, AG Charts custom theme, Monaco `vs-dark`. |
| **Skeleton loading / progressive data loading** | Users coming from Tableau expect instant feedback. Blank screens feel like a crash. | LOW (exists) | Already built. KPIs load first (small payload), then charts, then grid. Skeleton components on every data element. |
| **Dashboard title, description, metadata** | Basic organization. Name the dashboard, add a description, see last modified date. | LOW | Trivial UI. Already in dashboard list page. Builder needs an edit form for title/description. |
| **Manual refresh button** | Tableau has "Refresh All". Users need to force-refresh data without reloading the page. | LOW | Simple button that invalidates TanStack Query cache for the dashboard. Partially exists (chart-panel toolbar had a refresh button in legacy). |
| **Fullscreen chart view** | Click a chart to expand it to a modal/overlay for detailed inspection. Standard in all BI tools. | LOW | Modal with the chart rendered at full viewport. Legacy `chart-panel.tsx` had this. Port to config-driven system. |

#### B. Data Pipeline & Configuration

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Dataset management (dev-team facing)** | Devs define SQL queries as named datasets with column metadata. This is the "data layer" that business users consume. | MEDIUM | Dataset = SQL template + column definitions (name, type, role: dimension/measure/time). Dev-facing UI: SQL editor, column metadata editor, test query. Superset already manages datasets, but RecViz needs its own metadata layer for column roles, friendly names, and aggregation defaults. |
| **Column metadata (friendly names, types, roles)** | Business users see "Total Items" not "total_items_cnt". Columns tagged as dimension vs. measure. | MEDIUM | Per-column config: display name, data type (string/number/date/currency), role (dimension/measure/time), default aggregation, format string. Stored alongside dataset definition. |
| **Database connection management** | Already exists in Superset; RecViz needs UI for the dev team. | LOW (exists) | Already built: `data-sources-tab.tsx`, `data-source-sheet.tsx` with full CRUD. URI builder supports Oracle, PostgreSQL, Hive, Elasticsearch. |
| **Auto-refresh at configurable intervals** | Recon data updates throughout the day. Default ~10 min, but configurable per dashboard. | LOW | Timer-based TanStack Query invalidation. Dashboard config stores interval. Manual override via refresh button. |

#### C. Export & Sharing

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Chart export: PNG, CSV, clipboard** | Tableau right-click > Export. Every chart should be exportable individually. | LOW | AG Charts has built-in export to PNG. CSV export = serialize chart data. Clipboard = copy data as tab-separated. Legacy `chart-panel.tsx` had this toolbar. |
| **Grid export: CSV, Excel** | AG Grid Enterprise has built-in export. Analysts need to pull data into Excel constantly. | LOW | AG Grid `exportDataAsCsv()` and `exportDataAsExcel()`. Already have `grid-toolbar.tsx` with export button. |
| **Embeddable dashboards (iframe)** | Internal portals need embedded charts. SharePoint, Confluence, internal tools. | LOW (exists) | Already built: `/embed/dashboards/$dashboardId` route with URL param filters, locked filters, theme override, chromeless topbar. |
| **Shareable URLs with filter state** | "Send this exact view to a colleague." URL encodes current filter selections. | LOW | URL params for filter values. Partially exists in embed route. Needs extension to main dashboard route: encode applied filters in URL, restore on load. |

### Differentiators (Competitive Advantage Over Tableau/Qlik)

These are where RecViz can beat the incumbents. Focus on speed, recon-specificity, and self-service.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Dashboard templates for reconciliation** | Pre-built layouts for common recon patterns: breaks summary, aging analysis, SLA monitoring, match rate tracking. Users start from a template instead of blank canvas. Tableau has no domain-specific templates. | MEDIUM | 5-8 templates: (1) Break Summary (KPIs + bar chart by type + aging chart + detail grid), (2) SLA Dashboard (RAG status KPIs + trend lines + breached items grid), (3) Match Rate Tracker (percentage KPIs + trend over time + breakdown by recon type), (4) Aging Analysis (bucket distribution + trend + detail), (5) Volume Dashboard (daily volumes + peaks + capacity), (6) Operational Summary (multi-recon overview for managers). Templates = pre-configured DashboardConfig JSON that users can customize. |
| **Recon-specific KPI library** | Pre-defined KPI calculations: break count, break value, match rate %, unmatched items, SLA adherence %, aging distribution, average resolution time. Users select from a menu instead of writing formulas. | MEDIUM | KPI templates with SQL fragments that map to common recon table columns. Devs configure once per data source; business users pick KPIs from a catalog. Much faster than Tableau calculated fields. |
| **Saved views (personal bookmarks)** | Power BI has personal bookmarks. RecViz saves filter state + layout tweaks as named views. Share via URL. Set a default view per user. | MEDIUM | Already has `use-saved-views.ts` + backend CRUD. Currently in-memory only. Needs: persist to database, URL encoding, "Set as default" per user, "Load" button that actually works (currently broken per codebase guide). |
| **Conditional formatting with threshold rules** | Color-code cells in grids based on business rules: red when break value > $1M, amber when SLA < 4 hours remaining. Power BI does this well; Tableau requires complex calculations. | MEDIUM | AG Grid Enterprise supports cell styling functions. Config-driven: per-column rules `[{condition: ">1000000", color: "destructive"}, ...]`. Recon users need this for aging, SLA, break amounts. Visual instant triage. |
| **Cross-filter visual state (Qlik-style selection highlighting)** | Qlik's green/white/gray selection states are beloved. When you click a bar, unrelated items dim (not disappear). Shows what's selected, what's related, what's excluded. | MEDIUM | AG Charts already has `makeItemStyler()` that dims non-selected items. Extend to show: selected items (full color), related items (slightly dimmed), excluded items (heavily dimmed). Add a "selection bar" showing active cross-filters with one-click removal. Legacy `cross-filter-bar.tsx` is a starting point. |
| **Command palette (Cmd+K) global search** | Fast navigation across dashboards, datasets, saved views. Not standard in Tableau/Qlik. Power users love this. | LOW (exists) | Already built: `command-palette.tsx` using Shadcn CommandDialog. Searches via `/api/search`. Needs: search within chart titles on current dashboard, jump to saved views, keyboard shortcut discoverability. |
| **Zero-latency cross-filtering** | Tableau cross-filters re-query the server. Qlik keeps data in memory. RecViz caches query results in TanStack Query and cross-filters client-side via `useMemo`. Instant response, zero network calls. | LOW (designed) | Architecture already supports this: `applyCrossFilters()` in `lib/cross-filter.ts` filters cached data. Competitive advantage over Tableau's server-round-trip model. Must NOT break this by adding server calls to cross-filter. |
| **Multi-dashboard overview page** | Managers overseeing 50+ recons need a "dashboard of dashboards" -- summary KPIs from multiple recons on one screen. Tableau requires publishing separate workbooks. | MEDIUM | A meta-dashboard that pulls headline KPIs from multiple dashboard configs. Shows: recon name, break count, match rate, SLA status across all recons. Click to open the full dashboard. Like a portfolio view. |
| **Inline chart type switching** | User viewing a bar chart can switch to line, pie, or table without going to edit mode. Quick "what does this look like as X?" exploration. Inspired by Tableau's "Show Me" but faster. | LOW | Dropdown or toggle on chart card header. Chart already receives data + vizType via `ChartWrapperProps`. Swap vizType, re-render. Compatible types only (bar<->line<->area, pie<->donut). |
| **Progressive dashboard loading with priority** | KPIs load first (50ms), then charts (200-500ms), then grids (500ms-2s). User sees value immediately. Tableau loads everything at once and shows a spinner. | LOW (exists) | Already architected. KPI queries are small. Charts use separate query hooks. Grids load last. Maintain this advantage. |

### Anti-Features (Deliberately NOT Building)

Features that seem attractive but create excessive complexity, scope creep, or maintenance burden for the target audience.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Free-form SQL for business users** | "Let me write my own queries." | Business users writing SQL against Oracle production creates a support nightmare. Bad queries can hammer databases. Security risk. Two-tier model (devs write SQL, users consume datasets) is a deliberate design choice. | Devs create datasets. Business users build charts from datasets. SQL Explorer stays dev-team-only. |
| **Natural language / AI querying** | "Ask questions in English." Industry hype in 2026. | Massive implementation complexity. LLM hallucination risk on financial data. Not trustworthy enough for recon operations where accuracy is critical. Requires LLM infrastructure that may not be available on-prem. | Defer entirely. Build excellent self-service chart builder instead. Revisit in 12+ months when on-prem LLM options mature. |
| **Real-time WebSocket live updates** | "Show breaks as they happen." | Recon data arrives in batches (nightly, hourly). True real-time adds WebSocket infrastructure, message broker, connection management. ROI is minimal when auto-refresh at 10-min intervals covers the use case. | Configurable auto-refresh (already planned). Manual refresh button. Default 10 min, customizable per dashboard. |
| **Mobile/tablet responsive design** | "Access dashboards on my phone." | Recon analysts work on desktop workstations with large screens. Data density is the priority. Responsive design would compromise every layout decision. Desktop-first is a deliberate constraint. | Desktop-only. Embed mode for tablets in meeting rooms if needed. |
| **Full drag-and-drop freeform canvas** | "Like Figma for dashboards." | Freeform positioning creates alignment nightmares. Every user's dashboard looks different. Maintenance hell. Tableau's floating objects are the most complained-about feature. | Grid-based layout with snap-to-grid. Constrained but clean. Templates as starting points. Tiled layout (Tableau-style) not floating. |
| **Custom calculated fields / DAX-like formulas** | "Let me create my own metrics." | Opens a Pandora's box of complexity. Business users creating formulas on financial data without validation is dangerous. Debugging user-created calculations is a support burden. | Pre-defined KPI library managed by dev team. If a new metric is needed, devs add it to the dataset/KPI catalog. Business users select from the catalog. |
| **Dashboard versioning / undo history** | "I want to go back to yesterday's version." | Full version control is complex to implement and rarely used. Most users just want "undo last change." | "Save As" for cloning before major changes. Simple last-saved-state rollback (one level of undo). No full version history. |
| **Pixel-perfect report designer** | "Generate formatted PDF reports with headers, footers, page breaks." | Entirely different product category. BI dashboards and paginated reports are separate concerns. Building a report designer is 6+ months of work. | Phase 1: screenshot-to-PDF of current dashboard view. Phase 2: templated PDF export with WeasyPrint for simple layouts. No WYSIWYG report designer. |
| **Multi-tenant / workspace isolation** | "Separate dashboards by team/department." | Premature optimization. Start with a flat list. 100 dashboards is manageable with search, tags, and favorites. Multi-tenancy adds auth complexity. | Folder/tag organization. Cmd+K search. Favorites list. |
| **Alerting / threshold notifications** | "Notify me when breaks exceed $10M." | Requires notification infrastructure (email, Slack), scheduling service, alert state management. Significant backend work that is not core to the dashboard builder. | Phase 1: visual threshold indicators in the dashboard (conditional formatting). Phase 2: scheduled report delivery (deferred). Alerting as a separate future milestone. |

## Feature Dependencies

```
[Dataset Management (dev)]
    |
    +--requires--> [Column Metadata / Friendly Names]
    |                  |
    |                  +--enables--> [Chart Builder: column picker with types]
    |                                    |
    |                                    +--enables--> [Chart Type Selector]
    |                                    |                 |
    |                                    |                 +--enables--> [Dashboard Layout Editor]
    |                                    |                                    |
    |                                    |                                    +--enables--> [Save Dashboard]
    |                                    |                                    |
    |                                    |                                    +--enables--> [Dashboard Templates]
    |                                    |
    |                                    +--enables--> [KPI Card Builder]
    |
    +--enables--> [Recon KPI Library]

[Global Filter Bar] (exists)
    |
    +--enhances--> [Cross-Filtering]
    |                  |
    |                  +--enhances--> [Cross-Filter Visual State (Qlik-style)]
    |
    +--enhances--> [Drill-Down]
    |                  |
    |                  +--requires--> [Data Grid] (for detail level)
    |
    +--enables--> [Saved Views] (saves filter state)
    |                 |
    |                 +--enables--> [Shareable URLs with filter state]

[Chart Export (PNG/CSV)] --independent-- (no dependencies, can build anytime)

[Grid Export (CSV/Excel)] --independent-- (AG Grid built-in)

[Embed Mode] (exists) --enhances--> [Shareable URLs]

[Conditional Formatting]
    +--requires--> [Column Metadata] (needs to know column types/thresholds)

[Dashboard Templates]
    +--requires--> [Dashboard Layout Editor]
    +--requires--> [Chart Builder]
    +--requires--> [Save Dashboard]

[Multi-Dashboard Overview]
    +--requires--> [Save Dashboard] (needs multiple saved dashboards)
    +--requires--> [KPI Cards] (pulls headline metrics)
```

### Dependency Notes

- **Chart Builder requires Dataset Management:** Cannot build charts without knowing what datasets exist and what columns they contain. This is the foundation.
- **Column Metadata enables the entire self-service pipeline:** Friendly names, data types, and dimension/measure roles drive the chart builder UI. Without this, users see raw SQL column names.
- **Dashboard Layout Editor requires Chart Builder:** You need charts to place on the layout. Builder flow: pick dataset -> build chart -> place on dashboard.
- **Cross-Filtering requires cached data:** The zero-latency cross-filter model depends on TanStack Query caching chart data client-side. If data is not cached, cross-filters would need server calls (breaking the UX advantage).
- **Saved Views require Global Filters:** A view is a snapshot of filter state + layout. Filters must work first.
- **Dashboard Templates require all builder primitives:** Templates are pre-configured DashboardConfig objects. The builder must exist to create/edit them.
- **Conditional Formatting requires Column Metadata:** Rules reference column names and types. Must know if a column is a number to apply "> threshold" rules.
- **Multi-Dashboard Overview requires multiple saved dashboards:** Only valuable when there are 10+ dashboards to summarize.

## MVP Definition

### Launch With (v1) -- The Dashboard Builder

Minimum viable: business users can create dashboards from dev-curated datasets. Replaces the need for Tableau for basic use cases.

- [ ] **Dataset management UI (dev-facing)** -- devs create, edit, test datasets with SQL + column metadata
- [ ] **Chart builder** -- pick dataset, select columns for axes/metrics, choose chart type, preview, save
- [ ] **Dashboard layout editor** -- grid-based, add/remove/resize chart panels and KPI cards
- [ ] **Save/load dashboards** -- persist to Oracle sidecar DB, dashboard list with search
- [ ] **Global filter bar (configurable)** -- users add/remove filters from available dataset columns
- [ ] **Cross-filtering** -- click chart element to filter all other charts (client-side, zero latency)
- [ ] **Drill-down** -- click aggregated -> breakdown -> detail rows with breadcrumb navigation
- [ ] **Chart export (PNG, CSV)** -- individual chart export from toolbar
- [ ] **Grid export (CSV, Excel)** -- AG Grid built-in export
- [ ] **Fullscreen chart view** -- expand any chart to modal
- [ ] **Manual refresh + auto-refresh** -- configurable interval per dashboard

### Add After Validation (v1.x)

Features to add once the builder is in use and feedback is collected.

- [ ] **Dashboard templates** -- pre-built recon layouts (breaks summary, SLA, aging, match rate). Trigger: users complain about building from scratch
- [ ] **Saved views / personal bookmarks** -- save filter state, share URL. Trigger: users ask "how do I get back to that view?"
- [ ] **Conditional formatting** -- threshold-based cell coloring in grids and KPI status colors. Trigger: users manually scanning for outliers
- [ ] **Recon KPI library** -- pre-defined recon metrics catalog. Trigger: multiple dashboards redefining the same KPIs
- [ ] **Inline chart type switching** -- swap viz type without editing. Trigger: users wanting quick exploration
- [ ] **Cross-filter visual state** -- Qlik-style dimming of excluded items. Trigger: users confused about what cross-filter is doing
- [ ] **Shareable URLs with filter state** -- encode filter state in URL for sharing. Trigger: users copy-pasting screenshots instead of links

### Future Consideration (v2+)

Features to defer until the builder is mature and user patterns are established.

- [ ] **Multi-dashboard overview** -- portfolio view across all recons. Defer: needs 20+ dashboards to be valuable
- [ ] **PDF export of dashboards** -- screenshot-to-PDF or WeasyPrint. Defer: complex layout rendering, Celery infrastructure
- [ ] **Excel export of dashboards** -- multi-sheet workbook with charts + data. Defer: complex formatting, openpyxl
- [ ] **Scheduled report delivery** -- email dashboards on a schedule. Defer: requires Celery, email infrastructure, notification preferences
- [ ] **Row-level security / RBAC** -- restrict data by user role. Defer: no auth system yet
- [ ] **Alerting / threshold notifications** -- notify when metrics cross thresholds. Defer: requires notification infrastructure

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Chart builder (dataset-to-chart pipeline) | HIGH | HIGH | P1 |
| Dashboard layout editor | HIGH | HIGH | P1 |
| Dataset management UI (dev-facing) | HIGH | MEDIUM | P1 |
| Column metadata / friendly names | HIGH | MEDIUM | P1 |
| Cross-filtering | HIGH | MEDIUM | P1 |
| Drill-down | HIGH | MEDIUM | P1 |
| Save/load dashboards | HIGH | MEDIUM | P1 |
| Global filter bar (configurable) | HIGH | LOW | P1 |
| Chart export (PNG/CSV) | MEDIUM | LOW | P1 |
| Grid export (CSV/Excel) | MEDIUM | LOW | P1 |
| Fullscreen chart view | MEDIUM | LOW | P1 |
| Auto-refresh (configurable) | MEDIUM | LOW | P1 |
| Dashboard templates (recon-specific) | HIGH | MEDIUM | P2 |
| Saved views / bookmarks | MEDIUM | MEDIUM | P2 |
| Conditional formatting | HIGH | MEDIUM | P2 |
| Recon KPI library | MEDIUM | MEDIUM | P2 |
| Inline chart type switching | MEDIUM | LOW | P2 |
| Cross-filter visual state (Qlik-style) | MEDIUM | MEDIUM | P2 |
| Shareable URLs with filter state | MEDIUM | LOW | P2 |
| Multi-dashboard overview | MEDIUM | MEDIUM | P3 |
| PDF dashboard export | LOW | HIGH | P3 |
| Scheduled reports | LOW | HIGH | P3 |
| RBAC / row-level security | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch -- the dashboard builder is not usable without these
- P2: Should have -- adds significant value, build in the phase after core launch
- P3: Nice to have -- defer until builder is established and user needs are validated

## Competitor Feature Analysis

| Feature | Tableau | Qlik Sense/View | Power BI | RecViz Approach |
|---------|---------|-----------------|----------|-----------------|
| **Chart creation** | Drag fields to shelves (rows/columns). "Show Me" suggests types. Powerful but steep learning curve. | Drag fields to properties panel. Auto-chart suggestions. | Drag fields to visual well. AI copilot suggests. | Select dataset > pick columns from list > choose chart type > preview. Simpler than Tableau, similar to Qlik. No drag-to-shelves complexity. |
| **Dashboard layout** | Tiled + floating objects. Grid snap optional. Layout containers for grouping. Flexible but alignment-heavy. | Sheet-based. Add objects to sheet. Grid layout. Simpler than Tableau. | Floating objects with grid snap. Auto-layout option. | Grid-based only (no floating). 12-column grid with snap. Templates as starting points. Simpler and more consistent than Tableau. |
| **Cross-filtering** | "Use as Filter" toggle per sheet. Re-queries server. Configurable filter actions. | Automatic via associative model. All objects cross-filter by default. Green/white/gray states. | Bidirectional cross-filter. Configurable per visual. | Automatic like Qlik -- all charts cross-filter by default. Client-side only (zero latency). Dim excluded items. Toggle off per-chart if needed. |
| **Drill-down** | Hierarchy sets + set actions. Powerful but complex to configure. Asymmetric drill possible. | Drill-down dimensions defined in data model. Click to drill. Simple and automatic. | Drill-through pages. Hierarchies in data model. | Configured per chart: define drill hierarchy (e.g., region > desk > recon > detail). Click to drill. Breadcrumb navigation. Backend call only for detail rows. |
| **Filter bar** | Quick filters panel. Parameter controls. Date range pickers. | Filter panes with search. Date pickers. Selection bar showing active filters. | Slicers on canvas. Filter pane (hidden side panel). | Configurable filter bar at top. Cascading dependencies. Same position on every dashboard. Simpler than Tableau parameter setup. |
| **Export** | PDF, PowerPoint, PNG, CSV, crosstab. Server-side rendering. | PDF, Excel, PNG, data export. Qlik NPrinting for scheduled. | PDF, PowerPoint, Excel. Paginated reports for pixel-perfect. | Phase 1: PNG + CSV per chart, Excel per grid. Phase 2: dashboard PDF. No paginated reports. |
| **Saved views** | No direct equivalent. Users create separate workbooks. | Bookmarks in Qlik Sense. | Personal bookmarks + report bookmarks. Shareable via URL. | Named saved views: filter state + layout. Personal to user. Share via URL. Set as default. |
| **Templates** | "Accelerators" (pre-built workbooks for specific industries). | App marketplace with templates. | Template apps. | Recon-specific templates: breaks, SLA, aging, match rate, volume. Domain advantage over generic tools. |
| **Conditional formatting** | Complex: requires calculated fields or color shelf manipulation. | Expression-based coloring. Set analysis for thresholds. | Excellent: rule-based + field-based formatting. Easy to configure. | Rule-based per column in grid. Threshold config in chart/KPI builder. Simpler than Tableau, comparable to Power BI. |
| **Performance (large data)** | Extract engine (Hyper) for fast queries. Live connections slower. | In-memory associative engine. Very fast for < 500M rows. | Import mode fast. DirectQuery slower. | Superset query engine with Redis caching. TanStack Query client-side caching. Aggregation-first queries. Target: < 2s for chart renders on million-row datasets. |
| **Learning curve** | High. 2-4 weeks for proficiency. "Shelf" metaphor confusing for non-analysts. | Medium. 1-2 weeks. Associative model intuitive once understood. | Medium. 1-2 weeks. Familiar Office-like interface. | Target: < 1 day for basic dashboard creation. Template-first workflow. No shelves/calculated fields. Pick dataset > pick columns > pick chart type > done. |
| **Recon-specific features** | None. Generic tool. | None. Generic tool. | None. Generic tool. | Break analysis, aging buckets, SLA monitoring, match rate tracking, multi-recon overview -- all built-in. Massive domain advantage. |

## Domain-Specific Feature Details (Reconciliation)

### Reconciliation KPI Types

Based on industry analysis, these are the standard recon KPIs that RecViz should support out of the box:

| KPI | Calculation | Visualization | Notes |
|-----|-------------|---------------|-------|
| Break Count | COUNT of unmatched items | KPI card + trend sparkline | Primary operational metric |
| Break Value | SUM of unmatched amounts | KPI card + trend sparkline | Monetary impact. Format as currency. |
| Match Rate % | (matched / total) * 100 | KPI card + gauge | Target is typically 95-99%. Green/amber/red thresholds. |
| SLA Adherence % | (on-time / total) * 100 | KPI card + RAG indicator | Red < 80%, Amber 80-95%, Green > 95% |
| Aging Distribution | COUNT per aging bucket (0-1d, 1-3d, 3-7d, 7-14d, 14-30d, 30d+) | Stacked bar or heatmap | Critical for identifying stale breaks |
| Average Resolution Time | AVG time from break creation to resolution | KPI card + trend | Hours or days. Lower is better. |
| Volume (items processed) | COUNT of total items | KPI card + area chart | Capacity planning |
| Escalation Count | COUNT of escalated breaks | KPI card | Indicates systemic issues |

### Reconciliation-Specific Visualizations

| Visualization | Purpose | Chart Type | Priority |
|---------------|---------|------------|----------|
| Break trend over time | Daily/weekly break count trend | Line chart | P1 |
| Break distribution by type | Which recon types have most breaks | Bar chart (horizontal) | P1 |
| Aging bucket distribution | How old are current breaks | Stacked bar | P1 |
| SLA status overview | RAG status across recons | Heatmap or status grid | P1 |
| Match rate trend | Match rate % over time | Area chart with target line | P2 |
| Break value waterfall | Where is the money stuck | Waterfall chart | P2 |
| Recon completion funnel | Total > matched > partial > unmatched | Funnel (ECharts) | P2 |
| Cross-recon comparison | Compare metrics across recon types | Grouped bar | P2 |
| Resolution time distribution | How long breaks take to resolve | Box plot or histogram | P3 |
| Break flow (source to category) | Where breaks originate and how they categorize | Sankey (ECharts) | P3 |

### Reconciliation Filter Patterns

| Filter | Type | Typical Values | Notes |
|--------|------|---------------|-------|
| Date Range | Preset range | Today, Yesterday, Last 7/30/90 days, Custom | Most critical filter. Default: Yesterday. |
| TLM Instance / Recon System | Single-select | TLMP_CONSUMER, TLMP_EQUITIES, etc. | Maps to different databases via dynamic routing (already built). |
| Recon Type | Multi-select | Cash, Securities, Positions, Margin, etc. | Domain-specific grouping. |
| Status | Multi-select | Matched, Unmatched, Partial, Investigating, Resolved | Break lifecycle states. |
| Business Unit / Desk | Multi-select | Hierarchical: Region > BU > Desk | Cascading filter (already built). |
| Counterparty | Searchable single-select | Hundreds of values | Needs typeahead search, not dropdown. |
| Materiality / Amount Range | Range slider or presets | < $1K, $1K-$10K, $10K-$100K, $100K-$1M, > $1M | Bucket-based filtering. |
| Aging | Multi-select or range | 0-1d, 1-3d, 3-7d, 7-14d, 14-30d, 30d+ | Standard aging buckets. |

## Sources

- [Tableau Dashboard Creation Guide](https://help.tableau.com/current/pro/desktop/en-us/dashboards_create.htm) -- official Tableau docs on dashboard layout, objects, actions
- [Tableau Filter Actions](https://help.tableau.com/current/pro/desktop/en-us/actions_filter.htm) -- cross-filtering interaction model
- [Tableau Mark Types](https://help.tableau.com/current/pro/desktop/en-us/viewparts_marks_marktypes.htm) -- chart type switching, "Show Me" feature
- [Tableau Dashboard Layout](https://help.tableau.com/current/pro/desktop/en-us/dashboards_organize_floatingandtiled.htm) -- tiled vs floating, grid snap, layout containers
- [Qlik Associative Selection Model](https://help.qlik.com/en-US/sense/November2025/Subsystems/Hub/Content/Sense_Hub/Selections/associative-selection-model.htm) -- green/white/gray selection states
- [Qlik Visualizations & Dashboards](https://www.qlik.com/us/products/qlik-visualizations-dashboards) -- cross-filter, drill-down, associative engine
- [Power BI Bookmarks](https://learn.microsoft.com/en-us/power-bi/consumer/end-user-bookmarks) -- saved views, filter state persistence
- [Power BI Conditional Formatting](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-conditional-table-formatting) -- rule-based and field-based formatting
- [Dashboard Software Buyer's Guide 2026](https://www.basedash.com/blog/dashboard-software-the-complete-guide-for-modern-teams-in-2026) -- table stakes, AI, security, performance
- [Complete Guide to Reconciliation Dashboards 2026](https://www.osfin.ai/blog/reconciliation-dashboard) -- recon-specific features, KPIs, exception handling
- [NeoXam Reconciliation Dashboards](https://www.neoxam.com/aro/reconciliation-dashboards-reporting-audit-trails/) -- breaks, aging, SLA monitoring, audit trails
- [SmartStream TLM Reconciliations Premium](https://www.smartstream-stp.com/resources/tlm-reconciliations-premium/) -- TLM View dashboard features
- [Superset Explore View](https://superset.apache.org/user-docs/using-superset/exploring-data/) -- dataset-to-chart pipeline, query building
- [Databricks Dashboard Visualizations](https://docs.databricks.com/aws/en/dashboards/visualizations/) -- modern dataset-to-viz pipeline patterns

---
*Feature research for: Internal BI/visualization platform for financial reconciliation*
*Researched: 2026-04-04*
