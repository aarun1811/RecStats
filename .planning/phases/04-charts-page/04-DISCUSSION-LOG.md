# Phase 4: Charts Page - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 04-charts-page
**Areas discussed:** Card accent color, Builder wizard polish, Hard-coded hex migration, Detail panel, Chart-type config help, ECharts thumbnails, Appearance step expansion, Console errors

---

## Card Accent Color

| Option | Description | Selected |
|--------|-------------|----------|
| Chart-type color | Each chart type gets its own color via --series-1..8 CSS vars. Makes grid scannable by type. | ✓ |
| Dataset database color | Reuse BACKEND_COLORS from style-constants.ts (Oracle=red). Consistent cross-page. | |
| No accent border | Skip border-l-2. Live thumbnail provides differentiation. | |

**User's choice:** Chart-type color using --series-1..8 CSS variables
**Notes:** User explicitly reminded to use shadcn chart series colors, not Tailwind utility colors.

## Chart Type Pill

| Option | Description | Selected |
|--------|-------------|----------|
| Color-coded background | Pill background matches chart-type series color at low opacity. | ✓ |
| Keep current neutral | Current bg-background/80 backdrop-blur stays as-is. | |
| You decide | Claude picks. | |

**User's choice:** Color-coded pill backgrounds matching chart-type series colors.

## Builder Wizard Polish

| Option | Description | Selected |
|--------|-------------|----------|
| Full motion | Accordion fadeIn/out, preview crossfade, checkmark spring, progress indicator. | ✓ |
| Subtle motion only | Just accordion fade and checkmark. | |
| No extra motion | Keep current behavior. | |
| You decide | Claude picks. | |

**User's choice:** Full motion with all animations via motion/react.

## Chart-Type Config Help

| Option | Description | Selected |
|--------|-------------|----------|
| Inline tooltips + help sheet | Per-field info icons + separate help sheet with chart-type reference. | ✓ |
| Inline tooltips only | Just info icons on fields. | |
| Help sheet only | Single help button opening a reference sheet. | |

**User's choice:** Both inline tooltips and help sheet, mirroring Phase 3 column metadata pattern.

## Hard-Coded Hex Migration

| Option | Description | Selected |
|--------|-------------|----------|
| CSS var reads | Gauge reads --chart-negative/warning/positive, treemap reads --series-1/2 via getComputedStyle(). | ✓ |
| Tailwind semantic colors | Use Tailwind color tokens as hex constants. | |
| You decide | Claude picks. | |

**User's choice:** CSS variable reads with semantic chart tokens in index.css.

## Stored Config Audit

| Option | Description | Selected |
|--------|-------------|----------|
| Audit + migration script | Read all configs, find hex, replace/remove. One-time seed update. | ✓ |
| Audit only | Document findings, let re-save fix on edit. | |
| Skip | Configs pick up palette on render via chart-themes.ts. | |

**User's choice:** Full audit with migration script.

## Detail Panel

| Option | Description | Selected |
|--------|-------------|----------|
| Full mirror | Sheet animation, section icons, chart-type accent, sticky footer. Matches Phase 2 exactly. | ✓ |
| Partial mirror | Animation and icons but skip border-l accent. | |
| Minimal changes | Just sheet entrance animation. | |
| You decide | Claude picks. | |

**User's choice:** Full mirror of Phase 2 data-source detail panel.

## ECharts Thumbnail Gap

| Option | Description | Selected |
|--------|-------------|----------|
| Render live EChart thumbnails | Wire EChartWrapper into cards same as AG Charts. All types get live previews. | ✓ |
| Static type illustration | Styled chart-type icon instead of live render. | |
| You decide | Claude picks per type. | |

**User's choice:** Live EChart thumbnails for all exotic chart types.

## Appearance Step Expansion

| Option | Description | Selected |
|--------|-------------|----------|
| Chart-type-aware fields | Conditional fields: heatmap color range, gauge min/max, treemap color key, etc. | ✓ |
| Minimal additions | Just heatmap color range and gauge min/max. | |
| Keep current scope | Appearance stays as-is. Future enhancement. | |

**User's choice:** Full chart-type-aware appearance fields.

## Chart Config Audit

| Option | Description | Selected |
|--------|-------------|----------|
| Audit-first approach | Wave 1 produces reference file mapping each type to required fields, capture status, render status. Gaps drive later waves. | ✓ |
| Fix as we go | Skip audit file, fix gaps during implementation. | |

**User's choice:** Audit-first with reference file in Wave 1.
**Notes:** User suggested Wave 1 captures the audit, following waves implement fixes. Configuration capture and rendering must be aligned for every chart type.

## Console Errors

| Option | Description | Selected |
|--------|-------------|----------|
| Investigate + fix | Triage chart-related errors, fix in this phase. Log non-chart warnings in USAGE-TRACKER. | ✓ |
| Log only, fix if easy | Document errors, fix only trivial ones. | |
| Skip | Ignore console noise. | |

**User's choice:** Investigate and fix chart-related errors/warnings.

## Claude's Discretion

- Exact animation timing and easing curves
- Chart-type to --series-N assignments
- Help sheet content depth
- ECharts thumbnail sizing
- Handling chart types beyond 8 series vars
- Chart-type-specific appearance field UI components

## Deferred Ideas

None — discussion stayed within phase scope.
