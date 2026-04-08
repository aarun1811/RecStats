# Phase 6: Chart Library - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 06-chart-library
**Areas discussed:** Chart builder UX, Chart persistence & reuse, Chart type selector, Library browsing, Save step details, Dataset picker UX, Deletion & references

---

## Chart builder UX

### Builder layout structure

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar config + live preview | Left panel has config, right shows live chart | |
| Stepper wizard | Step-by-step guided flow, horizontal stepper | |
| Full-page workspace | Three-panel Tableau-style layout | |

**User's choice:** User requested a vertical accordion stepper instead of horizontal stepper or sidebar. Accordion steps expand inline on the left, live chart preview always visible on the right.
**Notes:** User specifically wanted to avoid wasting space on a separate sidebar column. Accordion-style keeps everything compact.

### Column mapping approach

| Option | Description | Selected |
|--------|-------------|----------|
| Role-aware dropdowns | Dropdowns filtered by column role from dataset metadata | ✓ |
| Drag-and-drop shelves | Tableau-style drag columns onto shelves | |
| Auto-map with review | System auto-maps, user reviews | |

**User's choice:** Role-aware dropdowns
**Notes:** X-Axis shows dimension/time columns only, Metrics shows measure columns only. Default aggregation from dataset metadata.

### Appearance customization level

| Option | Description | Selected |
|--------|-------------|----------|
| Essentials only | Title, legend, axis labels. Colors from theme. | ✓ |
| Moderate customization | Essentials + palette selector, bar mode, sort, format | |
| Full control | Everything + custom hex colors, fonts, grid lines | |

**User's choice:** Essentials only
**Notes:** Premium defaults do the heavy lifting. No manual color picking.

### Builder entry point

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated /charts/new page | Top-level route, "Charts" in sidebar, same as datasets | ✓ |
| Dialog/modal from dashboard builder | Chart builder as modal, no standalone page | |
| Both standalone + inline | Two entry points to same builder | |

**User's choice:** Dedicated /charts/new page
**Notes:** Same pattern as datasets. Charts nav item in sidebar.

### Step navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Click to re-expand any step | Completed steps clickable, downstream steps reset on change | ✓ |
| Strictly linear | Only forward/back, no jumping | |

**User's choice:** Click to re-expand any step
**Notes:** Changes to earlier steps reset downstream steps.

---

## Chart persistence & reuse

### Chart-dataset-dashboard relationship

| Option | Description | Selected |
|--------|-------------|----------|
| Chart references dataset | One definition, many dashboard placements. Edit updates everywhere. | ✓ |
| Chart copies config on add | Dashboard gets independent copy. Changes don't propagate. | |
| Hybrid linked/unlink | Linked by default, option to unlink for customization. | |

**User's choice:** Chart references dataset
**Notes:** Reference model throughout: dataset → chart → dashboard.

### Storage location

| Option | Description | Selected |
|--------|-------------|----------|
| RecViz PostgreSQL only | New recviz_charts table. No Superset sync. | ✓ |
| Hybrid with Superset | Store + sync to Superset chart API. | |

**User's choice:** RecViz PostgreSQL only
**Notes:** Charts are a UI concept, not a query concept. Simpler than Phase 5 hybrid.

### Edit propagation

| Option | Description | Selected |
|--------|-------------|----------|
| Immediate update | Save = live everywhere. No draft/published. | ✓ |
| Publish step | Draft until explicitly published. | |

**User's choice:** Immediate update
**Notes:** Same pattern as datasets (Phase 5 D-06).

### One-off charts

| Option | Description | Selected |
|--------|-------------|----------|
| Always save to library | Every chart goes through builder. Consistent model. | ✓ |
| Allow inline charts in Phase 8 | Dashboard builder can create inline-only charts. | |

**User's choice:** Always save to library
**Notes:** No inline-only charts. Single consistent model.

---

## Chart type selector

### Type presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Icon grid with compatibility | Grid of thumbnails, incompatible types dimmed with tooltip | ✓ |
| Dropdown with icons | Compact dropdown with icon + label | |
| Categorized list | Vertical list grouped by category | |

**User's choice:** Icon grid with compatibility
**Notes:** Grouped into Standard (AG Charts) and Exotic (ECharts). Compatibility based on dataset column roles.

### Step ordering

| Option | Description | Selected |
|--------|-------------|----------|
| Chart type before mapping | Type determines mapping fields (pie vs bar vs heatmap) | ✓ |
| Mapping before chart type | Map first, then see compatible types | |

**User's choice:** Chart type before mapping
**Notes:** User asked if compatibility can work before mapping — yes, because dataset column roles (from Phase 5 metadata) provide enough info after Step 1.

---

## Dataset picker UX

### Preview area during dataset selection

| Option | Description | Selected |
|--------|-------------|----------|
| Columns + fetch data button | Column metadata shown immediately, "Preview Data" fetches sample rows on demand | ✓ |
| Columns only, no data fetch | Just column metadata, no query execution | |

**User's choice:** Columns + fetch data button
**Notes:** User specifically asked for column preview in the chart preview area during dataset selection, and whether data fetching should be allowed. Both confirmed.

---

## Save step details

| Option | Description | Selected |
|--------|-------------|----------|
| Name + description only | Same simplicity as datasets. No tags. | ✓ |
| Name + description + tags | Optional tags for filtering in library. | |

**User's choice:** Name + description only
**Notes:** Consistent with Phase 5 D-07.

---

## Deletion & references

| Option | Description | Selected |
|--------|-------------|----------|
| Block deletion, show references | Shows which dashboards reference the chart. Must remove first. | ✓ |
| Warn but allow force-delete | Warning listing dashboards, user can confirm. | |
| Cascade remove from dashboards | Auto-removes chart from all dashboards. | |

**User's choice:** Block deletion, show references
**Notes:** Same pattern as datasets (Phase 5 D-08). Prevents broken dashboards.

---

## Claude's Discretion

- Accordion animation details, chart type thumbnail/icon design
- Preview area empty states and transitions
- "Preview Data" row limit, chart config JSONB schema
- Alembic migration, delete dialog design, card/row layouts
- Edit mode vs create mode differences

## Deferred Ideas

- Custom color palettes — add when users need more visual control
- Chart templates — Phase 8 dashboard templates may subsume this
- Chart versioning — v2 feature (ADVN-03)
- Chart tags — revisit at scale
- Inline chart type switching — TMPL-03, v2 feature
- Advanced appearance controls — add incrementally if essentials insufficient
