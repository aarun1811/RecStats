# Phase 07: KPI Library - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 07-kpi-library
**Areas discussed:** KPI template model, KPI card design, Builder vs picker UX, Dev template editor

---

## KPI Template Model

### Data Source

| Option | Description | Selected |
|--------|-------------|----------|
| Reference a dataset | KPI links to existing managed dataset + specifies column to aggregate | ✓ |
| Standalone SQL fragment | KPI has its own SQL snippet | |
| Both options | Can reference dataset OR have inline SQL | |

**User's choice:** Reference a dataset
**Notes:** User initially considered a "saved queries" concept but agreed datasets serve that role — one dataset can power multiple KPIs.

### Trend Indicators

| Option | Description | Selected |
|--------|-------------|----------|
| Compare to previous period | Auto-compare current to previous day/week/month | |
| Compare to target value | Dev sets static target, KPI shows distance | |
| Both — dev chooses per KPI | Template supports both modes | ✓ |

**User's choice:** Both — dev chooses per KPI

### Threshold Coloring

| Option | Description | Selected |
|--------|-------------|----------|
| Dev-defined ranges | Green > X, amber > Y, red below Y. Users see colors only. | ✓ |
| User-configurable thresholds | Business user adjusts thresholds per dashboard | |
| Automatic (percentile-based) | System auto-calculates based on data distribution | |

**User's choice:** Dev-defined ranges

---

## KPI Card Design

### Card Content (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Trend arrow + % change | Up/down arrow with percentage change, color-coded | ✓ |
| Sparkline mini-chart | Tiny line chart showing last N data points | |
| Subtitle/context label | Small text like "vs last week" or "target: 95%" | ✓ |
| Threshold color bar | Colored accent strip on card edge | |

**User's choice:** Trend arrow + % change, Subtitle/context label

### Counter Animation

| Option | Description | Selected |
|--------|-------------|----------|
| Fast roll-up ~0.8s | Quick number animation, snappy feel | ✓ |
| Slow dramatic ~2s | Slower animation for executive dashboards | |
| You decide | Claude picks appropriate speed | |

**User's choice:** Fast roll-up ~0.8s

---

## Builder vs Picker UX

### User Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Browse-only library | Library page for browsing/preview/search. Dashboard placement in Phase 8. | ✓ |
| Library + inline dashboard config | Library AND dashboard config in Phase 7 | |
| No user-facing library | Dev-only in Phase 7, users wait for Phase 8 | |

**User's choice:** Browse-only library

### Layout Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, same pattern as chart library | Card grid + list toggle, search/filter, detail panel | ✓ |
| Simpler list only | Just a list with inline preview | |
| You decide | Claude picks based on complexity | |

**User's choice:** Same pattern as chart library

---

## Dev Template Editor

### Editor UX

| Option | Description | Selected |
|--------|-------------|----------|
| Form-based editor | Step-by-step: dataset → column → aggregation → format → trend → thresholds → save | ✓ |
| Single-page form | All fields on one page, no steps | |
| You decide | Claude picks best layout | |

**User's choice:** Form-based editor

### Preview

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, live preview | Right panel shows real KPI card with actual data | ✓ |
| Static preview | Mock preview, no real data | |
| No preview | Just the form | |

**User's choice:** Yes, live preview

---

## Claude's Discretion

- Editor layout (accordion vs single page) — Claude decides based on field count
- Card grid responsive breakpoints
- Animation easing curve

## Deferred Ideas

- Sparkline mini-charts inside KPI cards
- Threshold color bar on card edge
- User-configurable thresholds (Phase 8)
- KPI placement/sizing on dashboard grid (Phase 8)
