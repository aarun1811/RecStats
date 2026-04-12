# Phase 2: Settings Page - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 02-settings-page
**Areas discussed:** Density/Font Size stubs, Settings page layout + polish, Data Source panel UX, Data Source CRUD against Oracle

---

## Density/Font Size Stubs

| Option | Description | Selected |
|--------|-------------|----------|
| Delete them | Remove entire Display card, simpler UI | |
| Implement them | Wire to Zustand + CSS variables, persisted | ✓ |
| Keep Density, delete Font Size | Partial implementation | |

**User's choice:** Implement both
**Follow-up:** Zustand store + CSS variables (global, localStorage)

---

## Settings Page Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Full-width max-w-5xl | Expand to ~1024px, more breathing room | ✓ |
| Two-column layout | Sidebar nav + content | |
| Keep max-w-3xl | Current narrow layout | |

**User's choice:** Full-width max-w-5xl

---

## Theme Selector

| Option | Description | Selected |
|--------|-------------|----------|
| Live preview cards | Mini-mockup of UI in each theme, animated border | ✓ |
| Enhanced icon buttons | Current layout + motion polish | |
| Keep current | Functional as-is | |

**User's choice:** Live preview cards

---

## Data Source Status Indicator

| Option | Description | Selected |
|--------|-------------|----------|
| Animated status badge | Pulsing badge, card left-border color | ✓ |
| Status bar across card top | Thin colored bar, no animation | |
| Keep current dot + text | Slightly larger dot | |

**User's choice:** Animated status badge

---

## Connection Test UX

| Option | Description | Selected |
|--------|-------------|----------|
| Animated state machine | Idle → Testing → Success/Failure with motion | ✓ |
| Progress steps | Mini-progress with checkmarks | |
| Keep current | Spinner + text result | |

**User's choice:** Animated state machine

---

## Data Source Detail Panel

| Option | Description | Selected |
|--------|-------------|----------|
| Connection health header + info grid | Status badge + last tested + host/port/service grid | ✓ |
| Minimal polish only | Better spacing and hierarchy | |

**User's choice:** Connection health header + info grid
**Notes:** User raised concern about row counts — correctly identified that COUNT(*) on large Oracle tables would block and slow page load. Decision: use stored metadata only (column count, name), no live row counts.

---

## Data Source CRUD Against Oracle

| Option | Description | Selected |
|--------|-------------|----------|
| Verify + fix end-to-end | Full CRUD cycle, thick mode, encryption | ✓ |
| Claude decides scope | Claude investigates and fixes | |

**User's choice:** Verify + fix end-to-end
**Notes:** User suggested spinning up a second Oracle Docker container on a different port for testing "create new data source" flow.

---

## Saved Views Tab

**User's choice:** Keep as-is. No backend changes this phase. Colorization from Phase 1 palette is sufficient.

---

## Frontend Design Quality

**User's explicit request:** Frontend-design skill must be used during execution to ensure premium micro-interactions (tab transitions, hover states, focus animations, status pulse effects). Not just functional code — visually polished with wow factor.

---

## Claude's Discretion

- CSS variable names/values for density/font-size
- Theme preview card mini-mockup design
- Animation timing curves
- Detail panel info grid layout
- Second Oracle container decision

## Deferred Ideas

None — discussion stayed within phase scope.
