# Phase 3: Chart and Grid Interactions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 03-chart-and-grid-interactions
**Areas discussed:** Chart toolbar design, Fullscreen view, Export behavior, Auto-refresh model, Loading states during refresh, Manual refresh behavior

---

## Chart Toolbar Design

| Option | Description | Selected |
|--------|-------------|----------|
| Hover-reveal icons | Small icon buttons appear top-right of chart card on hover. Clean, premium feel. | ✓ |
| Always-visible toolbar row | Persistent row of icon buttons in card header, always visible. More discoverable but adds visual noise. | |
| Kebab menu | Single three-dot menu button, click to reveal dropdown. Minimal footprint. | |

**User's choice:** Hover-reveal icons
**Notes:** User values clean dashboard appearance. Dashboards can have 6-10+ charts, so minimal clutter matters.

---

## Grid Toolbar (Config-Data-Grid)

| Option | Description | Selected |
|--------|-------------|----------|
| CSV + Excel exports | Only export buttons on dashboard grids. | |
| CSV + Excel + column controls | Full toolbar with export, column visibility, density, auto-size. | ✓ |
| Match chart pattern | Use same hover icon pattern as charts. | |

**User's choice:** Full toolbar (CSV + Excel + column visibility + density + auto-size)
**Notes:** User also requested deletion of dead code: `data-grid.tsx` and `grid-toolbar.tsx` are unused standalone components never imported by any page. User confirmed they are stale after reviewing the code.

---

## Fullscreen Chart View

| Option | Description | Selected |
|--------|-------------|----------|
| Modal overlay | Centered Dialog overlay, dashboard dimmed behind. Escape/backdrop to dismiss. | ✓ |
| Full viewport takeover | Chart takes over entire browser viewport. Maximum real estate. | |
| Slide-out panel | Chart slides into 70-80% width right-side Sheet panel. | |

**User's choice:** Modal overlay
**Notes:** None

### Fullscreen Interactivity

| Option | Description | Selected |
|--------|-------------|----------|
| Fully interactive | Cross-filter clicks and drill-down double-clicks work in fullscreen. Same live component. | ✓ |
| View-only | Static larger view, no click interactions. | |

**User's choice:** Fully interactive
**Notes:** None

---

## Export Behavior

### Chart Export Formats

| Option | Description | Selected |
|--------|-------------|----------|
| PNG image | Download via AG Charts .download() / ECharts .getDataURL(). | ✓ |
| SVG image | Vector format, scales cleanly for reports. AG Charts supports natively. | ✓ |
| CSV data | Export chart's underlying data as CSV file. | ✓ |
| Copy to clipboard | Tab-separated text to clipboard for pasting into Excel/Sheets. | ✓ |

**User's choice:** All four formats (PNG, SVG, CSV, clipboard)
**Notes:** User asked about image format comparison. Explanation: PNG best for everyday use (lossless, universal), SVG for vector/scalable. JPEG bad for charts (lossy artifacts on text/lines). WebP has limited corporate tool support. Recommended PNG primary + SVG secondary.

### Export Visual State

| Option | Description | Selected |
|--------|-------------|----------|
| Export current state (WYSIWYG) | Exported image includes cross-filter dimming if active. What user sees is what they get. | ✓ |
| Export clean state | Remove cross-filter dimming before export. Cleaner for reports but doesn't match visible state. | |

**User's choice:** Export current state (WYSIWYG)
**Notes:** None

### Data Export for Charts

| Option | Description | Selected |
|--------|-------------|----------|
| Image only | Charts export as PNG/SVG only. Data export from grids. | |
| Image + CSV + clipboard | Full export: PNG, SVG images + CSV download + clipboard copy. | ✓ |
| Image + CSV only | PNG, SVG + CSV. No clipboard. | |

**User's choice:** Image + CSV + clipboard (full suite)
**Notes:** None

---

## Auto-Refresh Model

### Refresh Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard-wide | One interval refreshes everything. Simpler, consistent data state. | |
| Per-chart | Each chart has its own interval. Flexible but complex. | |
| Both levels | Dashboard-wide default that individual charts can override. | ✓ |

**User's choice:** Both levels
**Notes:** None

### Refresh UI

**User's choice:** Claude's discretion — research should determine the best UX pattern.
**Notes:** User said "I will just let you research and be the best judge."

### Interval Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Persist in dashboard config | Default interval in dashboard JSON. Per-chart overrides in config. | ✓ |
| Persist in localStorage | Per-user browser preference. Resets on data clear. | |
| Session only | Resets to default every dashboard load. | |

**User's choice:** Persist in dashboard config
**Notes:** None

---

## Loading States During Refresh

| Option | Description | Selected |
|--------|-------------|----------|
| Keep old data + subtle indicator | Previous data stays visible. Small spinner/pulsing border indicates refresh. Uses TanStack Query keepPreviousData. | ✓ |
| Skeleton overlay | Skeleton placeholders replace chart during refresh. Visual flicker. | |
| Spinner overlay | Semi-transparent overlay with centered spinner. Previous data dimmed. | |

**User's choice:** Keep old data + subtle indicator
**Notes:** None

---

## Manual Refresh Error Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Keep old data + error toast | Previous data stays visible. Toast says "Refresh failed: [reason]. Showing cached data." | ✓ |
| Show error in each panel | Each failed chart shows inline error panel with retry. Previous data replaced. | |

**User's choice:** Keep old data + error toast
**Notes:** None

---

## Claude's Discretion

- Auto-refresh UI design and placement (user deferred to research)
- Chart toolbar icon selection and hover animation
- Export filename conventions
- PNG export resolution/DPI
- Grid toolbar layout
- Per-chart refresh override UI
- Fullscreen modal sizing and animation

## Deferred Ideas

- Chart style/appearance configuration — belongs in Phase 6 (Chart Library)
