---
phase: 05-kpis-page
plan: 02
subsystem: frontend/kpis
tags: [motion, animation, detail-panel, builder, preview, threshold-accent]
dependency_graph:
  requires: []
  provides:
    - "THRESHOLD_BORDER_COLORS in style-constants.ts"
    - "Detail panel threshold-colored border accent"
    - "Builder accordion motion transitions"
    - "Builder checkmark spring animation"
    - "Preview crossfade and entrance animation"
  affects:
    - "frontend/src/lib/style-constants.ts"
    - "frontend/src/components/kpis/kpi-detail-panel.tsx"
    - "frontend/src/components/kpis/kpi-builder.tsx"
    - "frontend/src/components/kpis/kpi-builder-preview.tsx"
tech_stack:
  added: []
  patterns:
    - "motion/react AnimatePresence crossfade for config-change transitions"
    - "motion/react spring animation for checkmark scale-in"
    - "Threshold-colored border-l-2 accent on detail panel Sheet"
    - "Primary-tinted section header icons (text-primary/60)"
key_files:
  created: []
  modified:
    - "frontend/src/lib/style-constants.ts"
    - "frontend/src/components/kpis/kpi-detail-panel.tsx"
    - "frontend/src/components/kpis/kpi-builder.tsx"
    - "frontend/src/components/kpis/kpi-builder-preview.tsx"
decisions:
  - "Added THRESHOLD_BORDER_COLORS to style-constants.ts in this plan (Rule 3: Plan 01 runs in parallel wave)"
metrics:
  duration: "4min"
  completed: "2026-04-12T22:45:25Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
---

# Phase 5 Plan 02: Detail Panel + Builder Motion Polish Summary

Premium motion and accent polish for KPI detail panel (threshold-colored border, primary-tinted section icons, entrance animation) and KPI builder (accordion step fadeIn/fadeOut, checkmark spring, preview crossfade/entrance animation).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `69a900d` | Detail panel threshold accent + section icon polish + entrance animation |
| 2 | `d83adbe` | Builder accordion motion + checkmark spring + preview animations |

## What Changed

### Task 1: Detail Panel Polish
- **Threshold border accent (D-10):** `SheetContent` gets `border-l-2` dynamically colored by live threshold level via `THRESHOLD_BORDER_COLORS[thresholdLevel]`. Green, amber, red, or muted depending on the KPI's current computed value against its thresholds.
- **Section header icon tinting (D-09):** Database, Hash, Settings2, Calendar icons changed from `text-muted-foreground` to `text-primary/60` for the primary-tinted accent matching Phase 3/4 patterns.
- **Entrance animation:** Panel content wrapped in `motion.div` with `opacity: 0->1, x: 16->0` over 200ms ease-out.
- **Delete button accessibility:** Added `aria-label="Delete KPI"` and `title="Delete KPI"` to the ghost delete icon button.

### Task 2: Builder + Preview Animations
- **Accordion step motion (D-06):** Each `AccordionContent` inner content wrapped in `AnimatePresence mode="wait"` + `motion.div` with 150ms fadeIn/fadeOut, matching the Phase 4 chart builder pattern.
- **Checkmark spring (D-07):** Static `<Check>` icon replaced with `motion.div` wrapper: `scale: 0->1` with spring (stiffness 300, damping 20). Same config as chart builder.
- **Preview crossfade (D-08):** Live KPI value section wrapped in `AnimatePresence mode="wait"` keyed by `metricColumn-aggregation-format.type-thresholds.greenAbove` -- crossfades 200ms on config changes.
- **Preview entrance (D-08):** Inner value display gets `motion.div` with `scale: 0.95->1, opacity: 0->1` spring entrance (stiffness 300, damping 24) on first data load.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added THRESHOLD_BORDER_COLORS to style-constants.ts**
- **Found during:** Task 1
- **Issue:** Plan 01 (which adds KPI_AGG_COLORS and THRESHOLD_BORDER_COLORS to style-constants.ts) runs in wave 1 in parallel with this plan. The constant was not yet present.
- **Fix:** Added `THRESHOLD_BORDER_COLORS` directly to style-constants.ts in this plan.
- **Files modified:** `frontend/src/lib/style-constants.ts`
- **Commit:** `69a900d`

## Known Stubs

None -- all animations and accents are fully wired to live computed data.

## Verification

- TypeScript compiles cleanly (`tsc --noEmit` passes)
- `THRESHOLD_BORDER_COLORS` imported and used in detail panel
- `border-l-2` present, `border-l-0` removed from detail panel
- `text-primary/60` on all 4 section header icons
- `aria-label="Delete KPI"` on delete button
- `AnimatePresence` in builder (accordion motion)
- `stiffness: 300` in builder (checkmark spring)
- `motion.div` count >= 2 in builder
- `AnimatePresence` in preview (crossfade)
- `scale: 0.95` in preview (entrance spring)

## Self-Check: PASSED

All 4 modified files exist. Both commit hashes verified in git log. SUMMARY.md created.
