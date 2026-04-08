# Phase 8: Dashboard Builder - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-07
**Phase:** 08-dashboard-builder
**Areas discussed:** Grid layout and drag-drop, Builder canvas UX, Dashboard persistence, Filter configuration, Data grid panel, Unsaved changes, Dashboard preview

---

## Grid Layout and Drag-Drop

### Grid layout library

| Option | Description | Selected |
|--------|-------------|----------|
| react-grid-layout | Battle-tested, 12-col grid, used by Grafana/Kibana, maps to ChartLayout type | ✓ |
| @dnd-kit/core + CSS Grid | Modern DnD primitives, custom grid, more code | |
| gridstack.js | jQuery-origin, React wrapper, less React-native | |

**User's choice:** react-grid-layout
**Notes:** Maps 1:1 to existing ChartLayout type.

### Minimum size constraints

| Option | Description | Selected |
|--------|-------------|----------|
| Type-based minimums | Charts 3×3, KPIs 2×2, Grids 6×4, Filter bar 12×1 | ✓ |
| Uniform minimum | All items min 3×3 | |
| No minimums | Free resize | |

**User's choice:** Type-based minimums

### Drag handle behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Title bar drag + corner resize | Grip icon on header, edit/remove buttons, chart content interactive | ✓ |
| Full panel drag | Entire panel draggable, blocks chart interaction | |
| Explicit drag icon only | Small corner icon, tiny drag target | |

**User's choice:** Title bar drag + corner resize

### Vertical compaction

| Option | Description | Selected |
|--------|-------------|----------|
| Vertical compaction | Items float up to fill gaps | ✓ |
| No compaction | Items stay where placed | |
| Optional toggle | User can toggle on/off | |

**User's choice:** Vertical compaction

### Undo/redo

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, layout undo/redo | Ctrl+Z/Shift+Ctrl+Z, Zustand snapshots, ~50 cap | ✓ |
| No undo/redo | Simpler but frustrating | |
| You decide | Claude picks | |

**User's choice:** Yes, layout undo/redo

### Row height

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed 80px rows | Grid gap 16px (gap-4) | ✓ |
| Fixed 60px rows | Denser layout | |
| You decide | Claude picks | |

**User's choice:** Fixed 80px rows

### Overlap behavior

| Option | Description | Selected |
|--------|-------------|----------|
| No overlap, push others | react-grid-layout default collision detection | ✓ |
| Allow overlap with z-index | Panels can stack | |

**User's choice:** No overlap, push others

---

## Builder Canvas UX

### Editing experience

| Option | Description | Selected |
|--------|-------------|----------|
| In-place WYSIWYG editing | Same page, toggle edit mode, dashed grid + handles | ✓ |
| Separate builder page | Different URL for build vs view | |
| Split panel builder | Sidebar palette + canvas | |

**User's choice:** In-place WYSIWYG editing

### Adding content

| Option | Description | Selected |
|--------|-------------|----------|
| Single [+ Add] with type picker | One button, dropdown picks Chart/KPI/Grid/Filter | ✓ |
| Separate buttons per type | Individual [+Chart][+KPI][+Grid][+Filter] | |
| Sidebar palette | Persistent sidebar with all types | |

**User's choice:** Single [+ Add] button
**Notes:** User clarified that charts, KPIs, and grids should all be available as add options — not just charts.

### Create inline

| Option | Description | Selected |
|--------|-------------|----------|
| Browse only + link to create | Library dialog + [Create New] navigates to builder page | ✓ |
| Inline builder in modal | Full builder embedded in dashboard page | |
| Browse only, no create link | Must pre-create in library | |

**User's choice:** Browse only + link to create

### View vs edit mode distinction

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle edit chrome + dashed grid | Dashed grid lines, panel handles, blue outline on hover | ✓ |
| Strong edit mode | Colored background, thick borders | |
| Minimal difference | Just toolbar appears/disappears | |

**User's choice:** Subtle edit chrome + dashed grid

### Panel edit button behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Config popover on panel | Small popover with panel-specific settings + [Edit Chart →] link | ✓ |
| Navigate to editor | Direct navigation to chart/KPI builder | |
| Side panel with settings | Sheet/drawer from right | |

**User's choice:** Config popover

### Route pattern

| Option | Description | Selected |
|--------|-------------|----------|
| /dashboards/new + /:id/edit | Same pattern as charts (Phase 6 D-04) | ✓ |
| In-place toggle (no routes) | View and edit on same URL | |

**User's choice:** /dashboards/new + /:id/edit
**Notes:** User suggested following the same pattern as charts page — dedicated routes for new and edit.

### Edit page layout

| Option | Description | Selected |
|--------|-------------|----------|
| Full-page canvas with top toolbar | Dashboard IS the canvas, no side panel | ✓ |
| Split sidebar + canvas | Left sidebar with settings | |
| Full-page + collapsible drawer | Collapsible settings panel | |

**User's choice:** Full-page canvas

### Empty canvas

| Option | Description | Selected |
|--------|-------------|----------|
| Centered empty state with prompts | "Start building" message + [+ Add] button | ✓ |
| Blank grid only | Just dashed grid | |
| Template starters | Pre-built layout options | |

**User's choice:** Centered empty state

### Dashboard metadata editing

| Option | Description | Selected |
|--------|-------------|----------|
| Inline + popover | Click title to edit, popover for description | |
| Settings dialog | Gear icon opens dialog | |
| You decide | Claude picks | ✓ |

**User's choice:** You decide

---

## Dashboard Persistence

### Storage approach

**User's choice:** Extend existing ConfigStore with full CRUD
**Notes:** User clarified: same DashboardConfig JSON shape stays. Builder is a visual editor for the same config devs hand-write. Rename table if needed for consistency. Existing dev-built config dashboards keep working with minor field additions if needed.

### Save As (clone)

| Option | Description | Selected |
|--------|-------------|----------|
| Deep copy with new ID | Full config copied, chart/KPI refs stay same IDs | ✓ |
| Shallow copy (layout only) | Layout positions only, empty panels | |

**User's choice:** Deep copy with new ID

### Dashboard list page

| Option | Description | Selected |
|--------|-------------|----------|
| Full upgrade | Card/row toggle, search, metadata, [+ Create] button | ✓ |
| Minimal (just add Create button) | Keep current list, working Create button only | |

**User's choice:** Full upgrade

### Delete behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Confirmation dialog only | Simple confirm, no reference checks | ✓ |
| Soft delete (archive) | Mark as archived, recoverable | |

**User's choice:** Confirmation dialog only

---

## Filter Configuration

### Adding filters

| Option | Description | Selected |
|--------|-------------|----------|
| Dataset column picker | Show datasets on dashboard, expand to pick columns, auto-detect type | ✓ |
| Manual filter form | User manually configures everything | |
| You decide | Claude picks | |

**User's choice:** Dataset column picker

### Filter-to-chart column mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-match + manual override per chart | Auto-match exact names, manual dropdown for mismatches | ✓ |
| Fully manual mapping | User maps every chart explicitly | |
| Column-name only | Strict name matching only | |

**User's choice:** Auto-match + manual override
**Notes:** User raised critical point: datasets from different teams use different column names for the same concept (region vs country). Manual override per chart is essential.

### Cascading filters

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, optional cascading | Use existing dependsOn field, "Depends on" dropdown in builder | ✓ |
| No cascading in v1 | Independent filters only | |
| Research it | Add to research list | |

**User's choice:** Yes, optional cascading

### Filter order

| Option | Description | Selected |
|--------|-------------|----------|
| Drag to reorder | Grip handles, important for cascading order | ✓ |
| Fixed order (add order) | Filters appear in order added | |
| You decide | Claude picks | |

**User's choice:** Drag to reorder

### Filter bar placement

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed top, outside grid | Always above canvas, not draggable | ✓ |
| Draggable grid item | Full-width grid item, repositionable | |
| Collapsible sidebar | Left sidebar for filters | |

**User's choice:** Fixed top, outside grid

### Filter value population

**User's choice:** Research it
**Notes:** User raised question: if a filter maps to different columns across different datasets, which dataset do you query for distinct values? Needs investigation.

### Cross-filter builder config

**User's choice:** Research it
**Notes:** User asked about configuring cross-filter and drill-down in the builder. Sent to research.

### Drill-down builder config

**User's choice:** Research it

---

## Data Grid Panel

| Option | Description | Selected |
|--------|-------------|----------|
| Pick dataset + auto-columns | Dataset picker, auto-populate, configure in popover | ✓ |
| Pick dataset + column picker | Intermediate column selection step | |
| You decide | Claude picks | |

**User's choice:** Pick dataset + auto-columns

## Unsaved Changes

**User's choice:** You decide (Claude's discretion)

## Dashboard Preview

| Option | Description | Selected |
|--------|-------------|----------|
| WYSIWYG is enough | Charts render live data in edit mode, no separate preview | ✓ |
| Add a Preview button | Toggle to hide edit chrome temporarily | |

**User's choice:** WYSIWYG is enough

---

## Claude's Discretion

- Dashboard metadata editing UX
- Unsaved changes handling approach

## Deferred Ideas

- Dashboard templates (TMPL-01)
- Dashboard versioning (ADVN-03)
- User-configurable KPI thresholds per dashboard
- Custom color palettes per dashboard
- Inline chart type switching (TMPL-03)

## Planning Directive

User requested many small plans across waves instead of few large plans. This is the most complex phase — smaller plans enable faster verification cycles and catch UI issues early. Each plan should produce a visible, verifiable piece of the builder.

## Clean Build Directive

User explicitly stated: no obligation to reuse existing dashboard builder code. Build the builder fresh and clean.
