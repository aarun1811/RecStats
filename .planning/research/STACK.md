# Stack Research

**Domain:** Internal BI/Dashboard Builder Platform (replacing Tableau/Qlik)
**Researched:** 2026-04-04
**Confidence:** HIGH (brownfield project with established core stack; new additions well-verified)

## Context: What Already Exists

RecViz has an established core stack that is NOT up for debate. This research focuses exclusively on **additions needed to build the dashboard builder experience** on top of the existing foundation. The existing stack is listed for completeness but marked accordingly.

## Existing Stack (Established -- No Changes)

### Frontend Core (already installed)

| Technology | Installed Version | Purpose | Status |
|------------|-------------------|---------|--------|
| React | ^19.2.0 | UI framework | Installed |
| Vite | ^7.3.1 | Build tool | Installed |
| TypeScript | ~5.9.3 | Type safety | Installed |
| Shadcn/ui + Radix | ^1.4.3 (radix-ui) | UI component system | Installed |
| Tailwind CSS | ^4.1.18 | Styling | Installed |
| AG Grid Enterprise | ^35.0.1 | Data grid | Installed |
| AG Charts Enterprise | ^13.0.1 | Primary charting | Installed |
| ECharts | ^6.0.0 | Exotic chart types only | Installed |
| TanStack Router | ^1.159.5 | File-based routing | Installed |
| TanStack Query | ^5.90.20 | Server state/caching | Installed |
| Zustand | ^5.0.11 | Client state | Installed |
| Motion | ^12.34.0 | Animations | Installed |
| Monaco Editor | ^4.7.0 | SQL editor | Installed |
| react-resizable-panels | ^4.6.2 | Split pane layouts | Installed |
| Lucide React | ^0.563.0 | Icons | Installed |
| date-fns | ^4.1.0 | Date utilities | Installed |
| cmdk | ^1.1.1 | Command palette | Installed |
| Sonner | ^2.0.7 | Toast notifications | Installed |

### Backend Core (already installed)

| Technology | Installed Version | Purpose | Status |
|------------|-------------------|---------|--------|
| FastAPI | 0.128.6 | API framework | Installed |
| Uvicorn | 0.40.0 | ASGI server | Installed |
| httpx | 0.28.1 | Async HTTP client | Installed |
| Pydantic | 2.12.5 | Validation/serialization | Installed |
| pydantic-settings | 2.12.0 | Config from env vars | Installed |
| Apache Superset | latest | Headless query engine | Installed |
| PostgreSQL | 16 (Docker) | Metadata DB | Installed |
| Redis | 7 (Docker) | Cache/broker | Installed |

---

## Recommended Additions for Dashboard Builder

### 1. Drag-and-Drop Grid Layout

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| react-grid-layout | 2.2.3 | Dashboard layout editor: drag, drop, resize panels on a grid | The industry standard for dashboard grid layouts. Used by Grafana, ilert, and most React dashboard builders. v2 (released Dec 2025) is a complete TypeScript rewrite with hooks API, composable config, and pluggable algorithms. 1.3M+ weekly npm downloads. 21.7k GitHub stars. Supports collision handling, min/max constraints, static items. |

**Confidence:** HIGH -- verified npm version 2.2.3, released 2026-03-24. Peer dependency `react >= 16.3.0` confirms React 19 compatibility. TypeScript types built-in (no @types needed in v2).

**Why react-grid-layout and not alternatives:**

| Alternative | Why Not |
|-------------|---------|
| Gridstack.js | No official React wrapper -- only community wrappers and demo code. Pure TypeScript core is solid, but React integration is immature and fragile. Would require maintaining custom wrapper code. |
| dnd-kit + custom grid | dnd-kit has stalled maintenance since 2024. Issues pile up unanswered. The @dnd-kit/react rewrite has unclear roadmap and no stable release. Building a grid system from a generic DnD library is significant engineering effort for a solved problem. |
| pragmatic-drag-and-drop | Atlassian's new library is headless and framework-agnostic, optimized for lists/trees not grid layouts. You would need to build the entire grid positioning, collision detection, and resize logic from scratch. |
| CSS Grid + custom DnD | Reinventing react-grid-layout. Months of work for an inferior result. |

**Key v2 API features for RecViz:**

- `useGridLayout` hook -- direct grid state management, perfect for builder mode
- `useResponsiveLayout` hook -- breakpoint-aware layouts (useful for future responsive dashboard viewing)
- `onLayoutChange` callback -- returns serializable layout JSON, store directly in backend
- Composable config: `GridConfig`, `DragConfig`, `ResizeConfig` as separate interfaces
- 100% backward compatible with v1 via legacy import path (safe migration if needed)

### 2. Form Management (Chart Builder Configuration)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| react-hook-form | 7.72.1 | Chart builder config forms: chart type, columns, axes, appearance, filters | Best React form library for complex, dynamic, nested forms. Minimal re-renders via uncontrolled components. 8.6kB gzipped, zero dependencies. useFieldArray for dynamic metric/dimension lists. useFormContext for deeply nested chart config panels. |
| @hookform/resolvers | 5.2.2 | Bridge between react-hook-form and Zod | Standard connector, enables Zod schemas for form validation. |
| zod | 4.3.6 | Schema validation for dashboard configs, chart configs, dataset definitions | Type-safe validation at both form level (frontend) and API level (can share types). Zod 4 has better performance and tree-shaking. Already in node_modules as transitive dep (zod-validation-error). |

**Confidence:** HIGH -- all versions verified via npm. react-hook-form is the dominant form library in the React ecosystem. Zod 4 is the latest major release (2025).

**Why react-hook-form and not alternatives:**

| Alternative | Why Not |
|-------------|---------|
| TanStack Form | Newer, smaller ecosystem. react-hook-form has vastly more community patterns for complex builder UIs. TanStack Form is better for simple forms, not complex multi-panel chart configurators. |
| React 19 form actions | Server actions are for server-rendered forms. RecViz is a client SPA with complex interactive config panels (color pickers, column drag-drop, live preview). Form actions would be fighting the architecture. |
| Formik | Effectively abandoned. Last meaningful update years ago. Performance issues with large forms. |
| No form library (manual state) | Chart builder has 15+ configurable fields across multiple panels, with dynamic field arrays, conditional visibility, and validation. Manual state management would be a mess. |

### 3. Undo/Redo for Builder Operations

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| zundo | 2.3.0 | Undo/redo middleware for Zustand builder store | Under 700 bytes. Plugs directly into Zustand. Provides `temporal` middleware that tracks state history. Essential for builder UX -- users expect Ctrl+Z when moving/resizing panels or configuring charts. |
| immer | 11.1.4 | Immutable state updates for complex nested dashboard configs | Zustand's `immer` middleware enables draft-based mutations of deeply nested dashboard state (panels, charts, filters, layout). Makes complex state updates readable. Already battle-tested in the Zustand ecosystem. |

**Confidence:** HIGH -- zundo verified at 2.3.0 on npm. immer verified at 11.1.4. Both are standard Zustand companions.

### 4. Unique ID Generation

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| nanoid | 5.1.7 | Generate unique IDs for new panels, charts, filters, KPIs in the builder | Tiny (116 bytes), fast, URL-friendly IDs. Better than crypto.randomUUID() because IDs appear in URLs and JSON configs. Better than UUID because shorter (21 chars default). |

**Confidence:** HIGH -- verified at 5.1.7 on npm. Standard choice for client-side ID generation.

### 5. Color Picker for Chart Configuration

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| react-colorful | 5.6.1 | Color picker for chart series colors, KPI card accents | 2.8kB, zero-dependency, hooks-based. Works perfectly with Shadcn Popover for inline color picking. No bloated color picker UI -- just the essential HSL/Hex picker. |

**Confidence:** HIGH -- version 5.6.1 verified via npm. Widely used, small, stable.

**Why not:** @radix-ui/colors provides palette tokens but not a picker component. A full-featured color picker like react-color is bloated (28kB) with styles that clash with Shadcn.

---

## Supporting Libraries (Already Adequate)

These capabilities are already covered by the existing stack. Do NOT add new libraries for these:

| Capability | Covered By | Notes |
|------------|------------|-------|
| Drag-drop within panels (column mapping) | react-grid-layout's built-in drag | For simpler "drag column to axis" interactions, use native HTML5 drag or lightweight custom hooks. Do NOT add dnd-kit or react-dnd just for this. |
| Resizable split panels | react-resizable-panels (installed) | Explorer layout, side-by-side config panels |
| Animations | motion (installed) | Panel entrance, chart transitions, builder mode toggling |
| State management | Zustand (installed) | Add new `builder-store.ts` alongside existing stores |
| Data fetching | TanStack Query (installed) | Fetch dashboard configs, save mutations via `useMutation` |
| Toast/notifications | Sonner (installed) | "Dashboard saved", "Layout updated", etc. |
| Command palette | cmdk (installed) | Search dashboards, datasets, charts |
| Icons | Lucide React (installed) | Chart type icons, toolbar actions |

---

## Backend Additions

### Database: Dashboard & Layout Persistence

| Technology | Purpose | Why |
|------------|---------|-----|
| SQLAlchemy 2.0 (async) | ORM for dashboard configs, layouts, saved views | Superset already uses SQLAlchemy. Aligns with Pydantic v2 via `model_validate`. Async support via `create_async_engine`. Needed because dashboard configs move from JSON files to a database. |
| alembic | Database migrations | Standard companion to SQLAlchemy. Needed for schema evolution as builder features expand. |

**Confidence:** HIGH -- SQLAlchemy 2.0 and alembic are the standard Python ORM/migration stack.

**Why not a new database:**
- Dashboard configs persist to the existing PostgreSQL instance (dev) or Oracle (prod)
- Same DB that Superset metadata lives in (different schema)
- No new infrastructure needed

### Layout Persistence Schema (Recommended Pattern)

Dashboard layouts should be stored as JSON columns, following the pattern established by Grafana and Superset themselves:

```
dashboards table:
  id: UUID (PK)
  name: str
  description: str
  config: JSONB  -- the full DashboardConfig (filters, KPIs, charts, grids)
  layout: JSONB  -- react-grid-layout serialized layout array
  status: enum (draft/published)
  created_by: str
  created_at: datetime
  updated_at: datetime

dashboard_versions table:
  id: UUID (PK)
  dashboard_id: UUID (FK)
  version: int
  config: JSONB
  layout: JSONB
  created_at: datetime
  created_by: str
```

This mirrors how Grafana stores dashboards: the layout is a serialized grid position array, the config holds semantic content (which charts, what data sources, what filters). The `dashboard_versions` table enables version history and rollback -- critical for a builder where users make incremental changes.

**react-grid-layout layout JSON format** (what gets stored in `layout` column):

```json
[
  {"i": "chart-abc123", "x": 0, "y": 0, "w": 6, "h": 4},
  {"i": "chart-def456", "x": 6, "y": 0, "w": 6, "h": 4},
  {"i": "kpi-row",      "x": 0, "y": 4, "w": 12, "h": 2}
]
```

Each item has `i` (unique key matching a panel in config), `x`/`y` (grid position), `w`/`h` (grid size). A 12-column grid is standard (matches Grafana's 24-col halved, and CSS grid convention).

---

## Installation Plan

### Frontend (pnpm)

```bash
# Dashboard builder core
pnpm add react-grid-layout

# Form management for chart/dashboard configuration
pnpm add react-hook-form @hookform/resolvers zod

# Undo/redo and immutable state
pnpm add zundo immer

# Utilities
pnpm add nanoid react-colorful
```

### Backend (pip)

```bash
# Database ORM (for dashboard persistence)
pip install sqlalchemy[asyncio]==2.0.40 alembic==1.15.2
```

### NOT needed (explicitly)

```bash
# DO NOT install these
# @dnd-kit/core          -- stalled maintenance, unnecessary with react-grid-layout
# react-dnd              -- old API, unnecessary with react-grid-layout
# react-beautiful-dnd    -- deprecated by Atlassian
# formik                 -- abandoned
# uuid                   -- nanoid is smaller and URL-safe
# react-color            -- bloated, use react-colorful
# axios                  -- project uses native fetch (per CLAUDE.md)
# @types/react-grid-layout -- v2 includes its own types
```

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| dnd-kit (@dnd-kit/core) | Maintenance effectively stalled since 2024. 200+ open issues. @dnd-kit/react rewrite has unclear timeline. Using it for a new project is risky. | react-grid-layout v2 (for grid), native HTML5 drag (for simple column-to-axis) |
| react-beautiful-dnd | Officially deprecated by Atlassian in 2022. No updates. | react-grid-layout v2 |
| @hello-pangea/dnd | Community fork of react-beautiful-dnd. Maintained but list-only -- no grid support. | react-grid-layout v2 |
| Gridstack.js | No production-quality React wrapper. Official React support is "work in progress" demo code. Integrating with React 19 + TypeScript strict would require maintaining a custom wrapper. | react-grid-layout v2 (native React, native TypeScript) |
| Formik | Last meaningful release years ago. Performance issues with large forms. react-hook-form has won the ecosystem. | react-hook-form |
| TanStack Form | Too new, too simple for complex multi-panel builder config UIs. Limited ecosystem patterns for advanced use cases. | react-hook-form |
| react-color | 28kB, old styles that clash with Shadcn/Tailwind, dated API | react-colorful (2.8kB, hooks-based, headless-friendly) |
| Yup | Zod has won the TypeScript-first validation space. Yup's TypeScript support is bolted on. | Zod 4 |
| Any CSS-in-JS library | Project uses Tailwind CSS 4. Adding styled-components, emotion, etc. creates style system conflicts. | Tailwind CSS (already installed) |
| Redux / Redux Toolkit | Zustand is already the state manager. Adding Redux creates confusion and parallel state systems. | Zustand + immer middleware |
| next-themes | Already installed but consider replacing with a lighter custom hook. It pulls in Next.js assumptions (usePathname, etc.) that require workarounds in Vite/React. | Custom theme hook using Zustand (already have theme-store pattern) |

---

## Stack Patterns for Dashboard Builder

### Pattern 1: Builder Mode Toggle

The dashboard has two modes: **view mode** (current behavior) and **edit mode** (builder). This is a state-level concern, not a routing concern.

```
Zustand builder-store:
  isEditing: boolean
  selectedPanelId: string | null
  clipboard: PanelConfig | null
  
  // undo/redo via zundo temporal middleware
```

When `isEditing === true`:
- react-grid-layout enables `isDraggable` and `isResizable`
- Panel hover shows resize handles and toolbar (edit, delete, duplicate)
- Right sidebar opens with chart/panel configuration form
- Top toolbar shows Save, Discard, Undo, Redo

When `isEditing === false`:
- react-grid-layout renders with `isDraggable: false, isResizable: false`
- Standard dashboard viewing experience (current behavior)

### Pattern 2: Chart Configuration Form

The chart builder uses react-hook-form with nested field arrays:

```
Dataset picker   -> Select from available datasets (TanStack Query fetch)
Chart type       -> Visual picker grid (AG Charts types + ECharts exotics)
Column mapping   -> Drag columns from dataset schema to axis slots
  - X axis       -> dimension column
  - Y axis       -> metric column(s) with aggregation
  - Group by     -> optional dimension for series split
  - Color        -> optional column or static color
Appearance       -> Title, legend position, color palette, axis labels
Filters          -> Per-chart filters (additional WHERE clauses)
```

react-hook-form manages this entire form. Zod schema validates the config before save. The form emits a `ChartConfig` object that merges into the dashboard config JSON.

### Pattern 3: Layout Persistence Flow

```
User edits layout -> onLayoutChange fires -> update Zustand store (debounced)
User clicks Save  -> serialize store to JSON -> POST to FastAPI -> save to PostgreSQL
Page load         -> GET from FastAPI -> deserialize JSON -> hydrate Zustand -> render grid
```

The layout array from react-grid-layout is stored alongside the semantic dashboard config. Both travel together as a single "dashboard definition" but are logically separate: layout = where things are, config = what things are.

---

## Version Compatibility Matrix

| Package | Version | Compatible With | Verified |
|---------|---------|-----------------|----------|
| react-grid-layout 2.2.3 | 2.2.3 | React >= 16.3.0 (React 19 confirmed) | npm peerDependencies |
| react-hook-form 7.72.1 | 7.72.1 | React >= 16.8.0 | npm peerDependencies |
| zod 4.3.6 | 4.3.6 | No React dependency (pure TS) | npm |
| @hookform/resolvers 5.2.2 | 5.2.2 | react-hook-form >= 7.0.0, zod >= 3.0 | npm peerDependencies |
| zundo 2.3.0 | 2.3.0 | zustand >= 4.5.0 (Zustand 5 compatible) | npm peerDependencies |
| immer 11.1.4 | 11.1.4 | No framework dependency | npm |
| nanoid 5.1.7 | 5.1.7 | ESM only (Vite handles this) | npm |
| react-colorful 5.6.1 | 5.6.1 | React >= 16.8.0 | npm |

---

## Critical Gap Analysis

### Gaps in Existing Stack That New Libraries Fill

| Gap | Current State | Solution |
|-----|---------------|----------|
| No drag-and-drop layout editor | Dashboard layout is static JSON config files | react-grid-layout v2 |
| No form management | Chart config is hand-written JSON | react-hook-form + Zod |
| No undo/redo | Builder operations are irreversible | zundo + immer |
| No database persistence for dashboards | Config files on disk | SQLAlchemy + alembic |
| No dashboard versioning | No history | dashboard_versions table |
| No color picker UI | Colors are hardcoded in config | react-colorful |
| No unique ID generation for new panels | IDs are manually assigned in JSON | nanoid |

### Gaps That Remain (Address in Roadmap)

| Gap | Why Not Now | When |
|-----|-------------|------|
| Real-time collaboration (multiplayer editing) | Massive complexity. Not needed for internal tool with small team. | Never (or far future) |
| Template marketplace | Need the builder working first before templates make sense | After builder MVP |
| Chart animation editor | AG Charts handles animations. Custom animation config is premature. | Future if requested |
| Mobile/responsive builder preview | Desktop-only application per constraints | Out of scope |

---

## Sources

- [react-grid-layout GitHub](https://github.com/react-grid-layout/react-grid-layout) -- v2 TypeScript rewrite RFC, releases, API docs
- [react-grid-layout npm](https://www.npmjs.com/package/react-grid-layout) -- version 2.2.3, peer dependencies verified
- [react-grid-layout v2 RFC](https://github.com/react-grid-layout/react-grid-layout/blob/master/rfcs/0001-v2-typescript-rewrite.md) -- hooks API design, composable config
- [Grafana Dashboard JSON Model](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/view-dashboard-json-model/) -- layout persistence schema reference
- [Grafana Dashboard JSON Schema v2](https://grafana.com/docs/grafana/latest/observability-as-code/schema-v2/) -- modern dashboard schema patterns
- [dnd-kit maintenance issues](https://github.com/clauderic/dnd-kit/issues/1194) -- stalled maintenance discussion
- [dnd-kit active maintenance status](https://github.com/clauderic/dnd-kit/issues/1830) -- Jan 2026 concern thread
- [zundo GitHub](https://github.com/charkour/zundo) -- undo/redo middleware for Zustand
- [react-hook-form](https://react-hook-form.com/) -- performance characteristics, nested form support
- [Superset REST API Reference](https://superset.apache.org/docs/api/) -- dataset/chart/dashboard CRUD endpoints
- [ilert: Why React-Grid-Layout Was Our Best Choice](https://www.ilert.com/blog/building-interactive-dashboards-why-react-grid-layout-was-our-best-choice) -- real-world production case study
- [Top 5 Drag-and-Drop Libraries for React 2026](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react) -- ecosystem comparison

---
*Stack research for: RecViz Dashboard Builder*
*Researched: 2026-04-04*
