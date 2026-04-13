# Phase 3: Dashboards + Verification - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Delete all 5 existing CURATED_DASHBOARDS and design 10 new story-driven dashboards from scratch in `scripts/seed-oracle.py`. Each dashboard composes seeded charts (45) and KPIs (18) into coherent analytical narratives with global filters, cross-filters, drill-down, and data grids. Verify everything renders end-to-end against Oracle.

</domain>

<decisions>
## Implementation Decisions

### Dashboard Themes & Composition
- **D-01:** Delete all 5 existing dashboards and design 10 new from scratch. Drop all "Phase 10 ·" naming. New IDs.
- **D-02:** The 10 dashboard themes: Executive Summary, SLA Health, Break Analysis, Match Performance, Volume Trends, Regional Breakdown, Counterparty Risk, Currency Exposure, Desk Performance, Operational Detail.
- **D-03:** Each dashboard has 4-6 chart panels with logical visual flow and no overlapping layouts.
- **D-04:** Each dashboard has 3-4 KPI cards (Executive Summary gets 4, others get 3) matching the dashboard theme.

### Layout & Data Grids
- **D-05:** Layout pattern: full-width hero chart (row 0, 12-col width) for the headline story, then 2-col pairs (6+6) below for supporting charts.
- **D-06:** 4 dashboards include data grids: Operational Detail, Break Analysis, Executive Summary, SLA Health. Grids show 6-8 key columns (ref, date, status, region, desk, amount, counterparty, currency).
- **D-07:** Dashboard descriptions are one-line story pitches — e.g. "Where are breaks concentrated and what's driving them?"

### Filters & Interactivity
- **D-08:** All 10 dashboards get the standard 4 global filters: Region, Status, Currency, Date Range.
- **D-09:** Cross-filter enabled on bar, pie, donut, heatmap, and treemap charts — clickable chart types that make sense as filter sources.
- **D-10:** 8-10 charts across dashboards get drill-down hierarchies: Region→Desk→Account, Status→Detail, Break Type→Root Cause, Time→Month→Day.
- **D-11:** Grid detail drill targets use `ds-recon-transaction-detail` dataset.

### Claude's Discretion
- Exact chart-to-dashboard assignments (which of the 45 charts go on which dashboard)
- Exact KPI-to-dashboard assignments (which of the 18 KPIs go on which dashboard)
- Exact grid column selections per dashboard
- Row/col positioning within the layout grid
- Which specific charts get cross-filter vs drill-down vs both

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — DASH-01 through DASH-10, VERIF-01 through VERIF-07

### Seed script (primary target)
- `scripts/seed-oracle.py` — Current file with 5 dashboards to replace, 45 charts, 18 KPIs, 22 datasets

### Dashboard helpers (in seed-oracle.py)
- `_dash_chart_ref()` — builds chart reference inside DashboardConfig.charts (camelCase keys)
- `_kpi_card()` — builds denormalized KPI card with format/trend/threshold from CURATED_KPIS
- `_layout(col, row, width, height=3)` — grid cell spec
- `_GLOBAL_FILTERS` — standard 4-filter array (Region, Status, Currency, Date Range)
- `seed_managed_dashboards(cur)` — INSERT function

### Frontend types (config validation)
- `frontend/src/types/dashboard-config.ts` — DashboardConfig, KpiConfig, ChartRef types
- `frontend/src/types/managed-chart.ts` — RecvizChart, ChartConfigSchema
- `frontend/src/types/managed-kpi.ts` — RecvizKpi

### Available chart IDs (45 charts from Phase 2)
- Time series: chart-daily-txn-volume, chart-daily-usd-volume, chart-daily-volume-combo, chart-monthly-txn-bar, chart-monthly-usd-area
- Region: chart-region-txn-bar, chart-region-usd-bar, chart-region-share-pie, chart-region-txn-donut
- Status: chart-status-distribution-bar, chart-status-donut, chart-status-category-pie, chart-status-region-stacked, chart-status-region-bar
- Breaks: chart-breaks-by-type-bar, chart-breaks-usd-by-type, chart-breaks-resolution-donut, chart-breaks-aging-by-type, chart-breaks-region-bar, chart-breaks-region-usd, chart-breaks-desk-bar, chart-breaks-desk-treemap
- Aging: chart-aging-waterfall, chart-aging-bar, chart-aging-usd-bar
- Match rate: chart-match-rate-trend, chart-match-rate-gauge, chart-match-rate-region-bar
- SLA: chart-sla-heatmap, chart-sla-breach-bar, chart-sla-breach-rate-bar, chart-sla-daily-trend, chart-sla-daily-combo
- Desk: chart-desk-volume-treemap, chart-desk-volume-bar, chart-desk-avg-usd
- Scatter/exotic: chart-amount-fee-scatter, chart-txn-parallel-coords
- Currency: chart-currency-pie, chart-currency-bar
- Match: chart-match-funnel, chart-match-confidence-bar
- Counterparty: chart-counterparty-top-bar
- Flow: chart-break-flow-sankey
- Scorecard: chart-kpi-radar

### Available KPI IDs (18 KPIs from Phase 2)
- kpi-total-transactions, kpi-total-usd-volume, kpi-match-rate, kpi-total-breaks, kpi-open-breaks
- kpi-break-exposure, kpi-avg-aging, kpi-sla-breach-rate, kpi-auto-match-pct, kpi-avg-confidence
- kpi-largest-txn, kpi-min-daily-volume, kpi-unique-counterparties, kpi-sla-breach-count
- kpi-avg-txn-size, kpi-currency-count, kpi-region-break-avg, kpi-monthly-volume-growth

### Available dataset IDs (22 datasets from Phase 1)
- ds-recon-transactions-daily, ds-recon-transactions-by-region, ds-recon-transactions-by-status
- ds-recon-breaks-summary, ds-recon-breaks-aging, ds-recon-match-rate-daily
- ds-sla-breach-summary, ds-recon-volume-by-desk, ds-recon-status-by-region
- ds-recon-transactions-scatter, ds-recon-currency-distribution, ds-recon-match-events-by-type
- ds-recon-counterparty-top, ds-recon-break-flow-sankey, ds-recon-kpi-scorecard
- ds-recon-account-detail, ds-recon-transaction-detail, ds-recon-breaks-by-region
- ds-recon-breaks-by-desk, ds-recon-match-rate-by-region, ds-recon-monthly-volume
- ds-recon-sla-daily

</canonical_refs>

<code_context>
## Existing Code Insights

### Current Dashboard Infrastructure
- `CURATED_DASHBOARDS` array at line 2736 in seed-oracle.py — 5 entries to DELETE and replace
- `seed_managed_dashboards(cur)` at line 3140 — INSERT function (reusable as-is)
- Assertion at line 3062 must be updated from `== 5` to `== 10`
- `write_dashboard_names_snapshot()` at line 3196 writes `frontend/e2e/_dashboard-names.json`

### Helper Functions (reuse as-is)
- `_dash_chart_ref()` — builds camelCase chart references with optional cross_filter, drill_hierarchy, drill_detail_data_source_id
- `_kpi_card()` — denormalizes KPI metadata from CURATED_KPIS for inline dashboard rendering
- `_layout(col, row, width, height=3)` — grid positioning
- `_GLOBAL_FILTERS` — standard filter array with Region, Status, Currency, Date Range

### Dashboard Config Shape
Each dashboard entry has: `id`, `name`, `description`, `config` (with nested `id`, `name`, `description`, `features`, `filters`, `kpis`, `charts`, `grids`, `layout`, `autoRefreshInterval`)

### Integration Points
- Dashboard list page reads from `recviz_dashboards` table
- Dashboard view page renders config via chart factory + KPI row + filter bar
- Builder edit mode uses the same config for drag-and-drop layout
- Cross-filter + drill-down driven by config flags on each chart reference

</code_context>

<specifics>
## Specific Ideas

- The script only modifies `CURATED_DASHBOARDS` array and the assertion count — no frontend or backend code changes
- Every chart ID and KPI ID referenced must match actual seeded records from Phase 2
- Every dataset ID referenced must match actual seeded records from Phase 1
- Dashboard names should NOT have "Phase 10 ·" or any prefix — clean descriptive names
- The 10 themes match the success criteria list exactly
- **Color diversity:** Current charts all look blue — update `appearance.colors` or `typeSpecific` color configs on existing charts to use diverse palettes per dashboard theme. Different dashboards should have visually distinct color schemes so they don't all blend together. Use the CSS variable chart colors (`--color-chart-1..5`) and per-chart overrides where needed.

</specifics>

<deferred>
## Deferred Ideas

- Visual verification via Playwright — done manually per VERIF-01 through VERIF-07
- Performance benchmarking at 10M rows — stretch goal in Phase 3 verification
- Saved views per dashboard — future milestone

</deferred>

---

*Phase: 03-dashboards-verification*
*Context gathered: 2026-04-13*
