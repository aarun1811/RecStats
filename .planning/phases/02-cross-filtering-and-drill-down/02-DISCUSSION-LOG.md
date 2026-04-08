# Phase 2: Cross-Filtering and Drill-Down - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 02-cross-filtering-and-drill-down
**Areas discussed:** Cross-filter click behavior, Cross-filter visual feedback, Drill-down level design, Cross-filter config model

---

## Cross-Filter Click Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle single value | Click to filter, click again to remove. One value per source chart. Matches Tableau/Power BI default. | ✓ |
| Accumulate multi-select | Click multiple segments to build a filter set. Ctrl/shift+click. More powerful but complex UX. | |
| You decide | Claude's discretion based on research. | |

**User's choice:** Toggle single value (Recommended)
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| All chart types + grid rows | Bar, pie, donut, line, scatter, heatmap, treemap, AG Grid rows. | ✓ |
| Categorical charts only | Bar, pie, donut, treemap. Exclude line, scatter, grid. | |
| You decide | Claude's discretion based on AG Charts/ECharts click APIs. | |

**User's choice:** All chart types + grid rows (Recommended)
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| No, KPIs are display-only | KPIs respond to cross-filters but don't initiate them. | ✓ |
| Yes, KPIs can cross-filter | Clicking a KPI applies a filter based on its data source context. | |
| You decide | Claude's discretion. | |

**User's choice:** No, KPIs are display-only (Recommended)
**Notes:** None

---

## Cross-Filter Visual Feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Opacity reduction | Selected full color, excluded ~20-30% opacity. Pie: selected slice pulls out. | ✓ |
| Grayscale excluded | Selected keeps color, excluded turns grayscale. Higher contrast but harsh in dark mode. | |
| You decide | Claude's discretion based on AG Charts/ECharts APIs. | |

**User's choice:** Opacity reduction (Recommended)
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Badge bar below filter bar | Horizontal row of badges with X buttons and Clear all. Between filter bar and KPIs. | |
| Inline on source chart only | Small indicator on the source chart. No separate bar. | |
| You decide | Claude's discretion on placement and design. | ✓ |

**User's choice:** You decide
**Notes:** User asked "what is the standard behaviour here?" — explained that Tableau, Power BI, and Looker all show active selections prominently. Recommended badge bar as the standard pattern.

---

## Drill-Down Level Design

### Drill Scope (required clarification round)

User asked fundamental questions: "Will drill-down be based on region alone? Can I configure it? Will it render new dashboards or change one chart?" — explained that drill hierarchies are fully configurable per dashboard/chart, not locked to any column. Described the two common models (chart-level vs dashboard-level drill) with examples from Tableau and Power BI.

| Option | Description | Selected |
|--------|-------------|----------|
| Chart-level drill | Each chart drills independently. Other charts unaffected. Per Tableau/Power BI default. | ✓ |
| Dashboard-level drill | Clicking any chart drills the entire dashboard. All charts re-aggregate together. | |
| You decide | Claude's discretion. | |

**User's choice:** Chart-level drill (Recommended)
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, backend-fetched AG Grid | Deepest level fetches raw rows from backend. Full sort/filter/pagination. | ✓ |
| Yes, client-side from cached data | Detail rows from already-fetched data. Faster but limited. | |
| You decide | Claude's discretion based on data volume. | |

**User's choice:** Yes, backend-fetched AG Grid (Recommended)
**Notes:** None

### Detail Grid Layout (required clarification round)

User raised concern: "If we move the grid to the last, won't the UX be bad when there are 10 charts + 2 grids? The new grid might appear below all this." — valid concern. Revised options from "full-width at bottom" to "slide-down below drilled chart's row."

| Option | Description | Selected |
|--------|-------------|----------|
| Slide-down below drilled chart's row | Full-width grid inserts below the ROW containing the drilled chart. Charts below shift down. | ✓ |
| Replace chart's panel inline | Grid appears in the chart's slot. Hides sibling charts. | |
| Modal/overlay | Grid in a modal on top of dashboard. | |
| You decide | Claude's discretion. | |

**User's choice:** Slide-down below drilled chart's row (Recommended)
**Notes:** Chosen specifically because dashboards can have many charts — appending to bottom would bury the detail view.

| Option | Description | Selected |
|--------|-------------|----------|
| Per-chart in dashboard config | Each chart has optional drillHierarchy array. Different charts can have different paths. | ✓ |
| Per-data-source | Drill hierarchy on data source, shared by all charts using it. | |
| You decide | Claude's discretion. | |

**User's choice:** Per-chart in dashboard config (Recommended)
**Notes:** None

---

## Cross-Filter Config Model

### Config Model (required clarification round)

User asked fundamental questions about how cross-filtering works across charts with different data: "What if a chart doesn't have anything to do with region? How will cross-filter across a region bar chart and an aging pie chart be configured?" — explained the column-name matching principle: cross-filters only apply when the target chart's data has the filtered column. No relationship configuration needed.

| Option | Description | Selected |
|--------|-------------|----------|
| All-to-all default, opt-out per chart | When features.crossFilter is true, all charts participate. Opt out with crossFilter: false. | ✓ |
| Explicit opt-in per chart | Charts must set crossFilter: true. Default off. | |
| You decide | Claude's discretion. | |

**User's choice:** All-to-all default, opt-out per chart (Recommended)
**Notes:** Selected after understanding the column-name matching model.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, KPIs re-aggregate | KPI cards re-query for filtered subset when cross-filters active. | ✓ |
| No, KPIs stay global | KPIs always show full-dataset numbers. | |
| You decide | Claude's discretion. | |

**User's choice:** Yes, KPIs re-aggregate (Recommended)
**Notes:** None

---

## Claude's Discretion

- Cross-filter indicator bar design and placement (user deferred, standard is badge bar)
- Animation timings for filter/drill transitions
- Intermediate drill level re-aggregation strategy (client vs backend)
- Detail grid sizing, pagination defaults, column behavior
- DuckDB-WASM viability (research decides)

## Deferred Ideas

None — discussion stayed within phase scope

## User's Overall Direction

User explicitly stated: existing cross-filter and drill-down code quality is uncertain. Open to full rewrite with proper research. Interested in DuckDB-WASM for client-side performance but not committed — wants research to determine the right approach.
