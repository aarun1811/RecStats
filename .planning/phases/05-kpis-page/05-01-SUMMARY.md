---
phase: 05-kpis-page
plan: 01
subsystem: frontend/kpis
tags: [motion, colorization, style-constants, kpi-library]
dependency_graph:
  requires: []
  provides:
    - KPI_AGG_BORDER_COLORS style map
    - KPI_AGG_PILL_BG style map
    - KPI_AGG_PILL_TEXT style map
    - THRESHOLD_BORDER_COLORS style map
    - Motion-wrapped KPI library cards with aggregation accent
    - Motion-wrapped KPI library rows with aggregation accent
    - AnimatePresence view toggle crossfade
    - Filtered empty state with Search icon
  affects:
    - frontend/src/lib/style-constants.ts
    - frontend/src/components/kpis/kpi-library-card.tsx
    - frontend/src/components/kpis/kpi-library-row.tsx
    - frontend/src/components/kpis/kpi-library-list.tsx
tech_stack:
  added: []
  patterns:
    - motion.div with stagger entrance and whileHover (matches Phase 2-4 card pattern)
    - AnimatePresence mode=wait crossfade on view toggle (matches Phase 3-4)
    - Aggregation-typed color maps in style-constants.ts (matches chart type color pattern)
    - Colored pills for aggregation type (matches chart type pills)
key_files:
  created: []
  modified:
    - frontend/src/lib/style-constants.ts
    - frontend/src/components/kpis/kpi-library-card.tsx
    - frontend/src/components/kpis/kpi-library-row.tsx
    - frontend/src/components/kpis/kpi-library-list.tsx
decisions:
  - Aggregation color map follows exact pattern of CHART_TYPE_BORDER_COLORS (Record<Type, string>)
  - Removed Badge component from kpi-library-row in favor of consistent colored pill span
metrics:
  duration: 168s
  completed: 2026-04-12
---

# Phase 5 Plan 1: KPI List Page Colorization and Motion Summary

KPI aggregation type color constants (border, pill-bg, pill-text) plus threshold border colors added to style-constants.ts, then applied as border-l-2 accent and colored pills to KPI library cards and rows with motion stagger entrance, hover lift, AnimatePresence view crossfade, and proper filtered empty state.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 99457c9 | Add KPI aggregation color constants to style-constants.ts |
| 2 | 7fd52c8 | Motion + accent colorization for KPI list page cards, rows, and empty state |

## Changes

### Task 1: KPI aggregation color constants

Added four new exported maps to `frontend/src/lib/style-constants.ts`:
- `KPI_AGG_BORDER_COLORS` - border-l accent by aggregation type (SUM=emerald, AVG=blue, COUNT=violet, MIN/MAX=amber, COUNT_DISTINCT=teal)
- `KPI_AGG_PILL_BG` - background tint for aggregation pills (15% opacity)
- `KPI_AGG_PILL_TEXT` - text color with explicit `dark:` variants for aggregation pills
- `THRESHOLD_BORDER_COLORS` - border-l accent for threshold levels (green/amber/red/muted)

All four maps follow the existing `Record<Type, string>` pattern established by `CHART_TYPE_BORDER_COLORS`.

### Task 2: Motion + accent for cards, rows, list

**kpi-library-card.tsx:**
- Outer `<div>` replaced with `<motion.div>` with stagger entrance (`opacity: 0->1, y: 8->0, delay: index * 0.05`)
- `whileHover={{ y: -2 }}` replaces CSS `hover:-translate-y-0.5`
- `border-l-2` with `KPI_AGG_BORDER_COLORS[kpi.aggregation]` for aggregation accent
- Plain text aggregation label replaced with colored pill using `KPI_AGG_PILL_BG` + `KPI_AGG_PILL_TEXT`
- New `index` prop for stagger delay

**kpi-library-row.tsx:**
- Outer `<div>` replaced with `<motion.div>` with stagger entrance
- `border-l-2` with `KPI_AGG_BORDER_COLORS[kpi.aggregation]` for aggregation accent
- Icon container upgraded from `bg-muted/50` to `bg-primary/5 border border-primary/10`
- `Badge variant="outline"` replaced with colored pill matching card pattern
- New `index` prop for stagger delay

**kpi-library-list.tsx:**
- Added `AnimatePresence mode="wait"` wrapping grid/list view content with `motion.div` crossfade (200ms)
- Filtered empty state upgraded from bare `<p>` to `Empty` component with `Search` icon, "No KPIs found" heading, and proper description copy
- Passes `index={i}` to both `KpiLibraryCard` and `KpiLibraryRow` for stagger animations

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

1. **Removed Badge import from kpi-library-row.tsx** - The `Badge variant="outline"` was replaced with a plain `<span>` colored pill, matching the card's aggregation pill pattern. The Badge component is no longer needed in this file.

## Verification

All acceptance criteria confirmed:
- `grep "motion.div" kpi-library-card.tsx` - 2 matches (open + close tag)
- `grep "whileHover" kpi-library-card.tsx` - 1 match
- `grep "KPI_AGG_BORDER_COLORS" kpi-library-card.tsx` - 2 matches (import + usage)
- `grep "motion.div" kpi-library-row.tsx` - 2 matches
- `grep "bg-primary/5" kpi-library-row.tsx` - 1 match
- `grep "AnimatePresence" kpi-library-list.tsx` - 3 matches (import + open + close)
- `grep "No KPIs found" kpi-library-list.tsx` - 1 match
- `grep "hover:-translate-y-0.5" kpi-library-card.tsx` - 0 matches (removed)
- TypeScript compiles cleanly with no errors

## Self-Check: PASSED

All files verified to exist:
- frontend/src/lib/style-constants.ts: FOUND
- frontend/src/components/kpis/kpi-library-card.tsx: FOUND
- frontend/src/components/kpis/kpi-library-row.tsx: FOUND
- frontend/src/components/kpis/kpi-library-list.tsx: FOUND

All commits verified:
- 99457c9: FOUND
- 7fd52c8: FOUND
