---
phase: 4
slug: charts-page
status: draft
shadcn_initialized: true
preset: mist+blue (new-york style, mist base, blue accent)
created: 2026-04-13
---

# Phase 4 -- UI Design Contract

> Visual and interaction contract for the Charts page. Covers list page (card + row views with chart-type accent colors, stagger animations, ECharts live thumbnails), builder wizard (motion-animated accordion steps, chart-type-specific appearance fields, inline tooltips, help sheet), detail panel (sheet entrance animation, chart-type accent, sticky footer), hard-coded hex migration (gauge, treemap CSS var replacement), and stored config audit. Continues the "Refined Command Center" aesthetic established in Phase 2 and refined in Phase 3.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (v4, Tailwind CSS 4) |
| Preset | Mist base + Blue accent (new-york style) |
| Component library | Radix primitives via shadcn/ui |
| Icon library | Lucide React |
| Font | Inter (system-ui, sans-serif fallback) |
| Animation library | `motion/react` (NOT `framer-motion`) |

**Source:** `frontend/components.json` -- inherited from Phase 1, unchanged through Phase 3.

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline padding, badge internal spacing |
| sm | 8px | Compact element spacing, icon-to-label gaps, card internal gaps |
| md | 16px | Default element spacing, card padding (`p-4`), form field gaps |
| lg | 24px | Page content `p-6`, section gaps, builder panel margins (`px-6`) |
| xl | 32px | Layout gaps between major sections |
| 2xl | 48px | Major section breaks (unused in Phase 4) |
| 3xl | 64px | Page-level spacing (unused in Phase 4) |

Exceptions:
- 12px (`p-3` / `px-3`): Section header bars in builder steps panel and preview panel (h-9 header pattern, same as Phase 2/3).
- 14px (`px-3.5`): Card metadata padding (`px-3.5 py-3`) for thumbnail cards -- inherited from existing `chart-library-card.tsx`.
- Touch targets: All interactive buttons maintain minimum 32px height (`h-8`). Card hover targets fill the full card area.
- Builder panel width: `w-[380px]` -- inherited from existing `chart-builder.tsx`, not changed.
- Detail panel width: `w-[500px]` -- inherited from existing `chart-detail-panel.tsx`, not changed.
- Card thumbnail height: 180px (`h-[180px]`) -- inherited, not changed.
- Chart preview in detail panel: 280px (`h-[280px]`) -- inherited, not changed.

**Source:** Phase 3 UI-SPEC spacing scale + existing chart component measurements.

---

## Typography

4 sizes, 2 weights:

| Role | Size | Weight | Line Height | Tailwind Class |
|------|------|--------|-------------|----------------|
| Page title | 24px | 600 (semibold) | 1.2 (~29px) | `text-2xl font-semibold tracking-tight` |
| Section heading | 14px | 600 (semibold) | 1.43 (~20px) | `text-sm font-semibold tracking-tight` |
| Body | 14px | 400 (regular) | 1.43 (~20px) | `text-sm` |
| Label / Caption | 12px | 400 (regular) | 1.33 (~16px) | `text-xs text-muted-foreground` |

Supplemental roles (use existing sizes with different weight/style):

| Role | Size | Weight | Line Height | Tailwind Class |
|------|------|--------|-------------|----------------|
| Card title | 14px | 600 (semibold) | snug | `text-sm font-semibold truncate leading-snug` |
| Card subtitle | 11px | 400 (regular) | snug | `text-[11px] text-muted-foreground truncate` |
| Inline editor heading | 24px | 600 (semibold) | 1.2 | `text-2xl font-semibold tracking-tight` (native `<input>`) |
| Chart type pill | 10px | 500 (medium) | normal | `text-[10px] font-medium` |
| Metadata label | 11px | 500 (medium) | normal | `text-[11px] font-medium text-muted-foreground uppercase tracking-wide` |
| Tooltip body | 13px | 400 (regular) | 1.5 | `text-[13px]` (inside Popover) |
| Help sheet heading | 14px | 600 (semibold) | 1.43 | `text-sm font-semibold` |
| Help sheet body | 13px | 400 (regular) | 1.5 | `text-[13px] text-muted-foreground` |

Font: `"Inter", system-ui, sans-serif` -- declared in `@layer base` body rule in `index.css`.

**Source:** Phase 3 UI-SPEC typography table + existing chart component measurements.

---

## Color

### Inherited Global Palette

Phase 4 inherits the complete Mist+Blue palette from Phase 1. All colors consumed via CSS variables -- no hardcoded hex/rgb/hsl anywhere.

| Role | CSS Variable | Usage |
|------|-------------|-------|
| Dominant (60%) | `--background` | Page background, main content area |
| Secondary (30%) | `--card`, `--muted`, `--secondary` | Cards, builder steps panel chrome (`bg-muted/30`), detail panel |
| Accent (10%) | `--primary` (Blue) | "Create Chart" CTA, "Save Chart"/"Save Changes" CTA, active step border-l, step completion checkmark, focus rings |
| Destructive | `--destructive` | "Delete Chart" button text, delete confirmation dialog |

Accent reserved for: "Create Chart" primary button on empty state, "Save Chart"/"Save Changes" primary CTA in builder, active accordion step `border-l-primary`, step completion checkmark icon (`text-primary`), active view toggle button, focus rings on inputs. Never backgrounds larger than a button or badge.

### Phase 4 Semantic Colors -- Chart Type Accent Map

These use Tailwind utility colors for chart-type UI categorization (card borders, type pills). They are **separate** from `--series-1..8` CSS vars which are reserved for data series colors inside charts.

**Decision:** D-01, D-02 from CONTEXT.md.

| Chart Type | Border Color | Pill Background | Pill Text |
|------------|-------------|-----------------|-----------|
| bar | `border-l-blue-500` | `bg-blue-500/15` | `text-blue-600 dark:text-blue-400` |
| stacked-bar | `border-l-blue-500` | `bg-blue-500/15` | `text-blue-600 dark:text-blue-400` |
| line | `border-l-sky-500` | `bg-sky-500/15` | `text-sky-600 dark:text-sky-400` |
| area | `border-l-cyan-500` | `bg-cyan-500/15` | `text-cyan-600 dark:text-cyan-400` |
| pie | `border-l-violet-500` | `bg-violet-500/15` | `text-violet-600 dark:text-violet-400` |
| donut | `border-l-violet-500` | `bg-violet-500/15` | `text-violet-600 dark:text-violet-400` |
| scatter | `border-l-indigo-500` | `bg-indigo-500/15` | `text-indigo-600 dark:text-indigo-400` |
| heatmap | `border-l-orange-500` | `bg-orange-500/15` | `text-orange-600 dark:text-orange-400` |
| treemap | `border-l-emerald-500` | `bg-emerald-500/15` | `text-emerald-600 dark:text-emerald-400` |
| waterfall | `border-l-teal-500` | `bg-teal-500/15` | `text-teal-600 dark:text-teal-400` |
| bullet | `border-l-slate-500` | `bg-slate-500/15` | `text-slate-600 dark:text-slate-400` |
| box-plot | `border-l-zinc-500` | `bg-zinc-500/15` | `text-zinc-600 dark:text-zinc-400` |
| combo | `border-l-rose-500` | `bg-rose-500/15` | `text-rose-600 dark:text-rose-400` |
| sankey | `border-l-amber-500` | `bg-amber-500/15` | `text-amber-600 dark:text-amber-400` |
| sunburst | `border-l-yellow-500` | `bg-yellow-500/15` | `text-yellow-600 dark:text-yellow-400` |
| radar | `border-l-lime-500` | `bg-lime-500/15` | `text-lime-600 dark:text-lime-400` |
| gauge | `border-l-red-500` | `bg-red-500/15` | `text-red-600 dark:text-red-400` |
| funnel | `border-l-fuchsia-500` | `bg-fuchsia-500/15` | `text-fuchsia-600 dark:text-fuchsia-400` |
| graph | `border-l-pink-500` | `bg-pink-500/15` | `text-pink-600 dark:text-pink-400` |
| parallel | `border-l-purple-500` | `bg-purple-500/15` | `text-purple-600 dark:text-purple-400` |

Store these maps in `lib/style-constants.ts` as `CHART_TYPE_BORDER_COLORS`, `CHART_TYPE_PILL_BG`, and `CHART_TYPE_PILL_TEXT` (all `Record<LibraryChartType, string>`).

### Phase 4 Semantic CSS Variables -- Chart Rendering

Add these to `index.css` in both `:root` and `.dark`:

| Variable | Light Value | Dark Value | Usage |
|----------|------------|------------|-------|
| `--chart-warning` | `oklch(0.769 0.188 70.08)` (amber) | `oklch(0.769 0.188 70.08)` (amber) | Gauge middle band (30-70% range) |

Note: `--chart-positive` and `--chart-negative` already exist. `--chart-warning` is the missing gauge amber band token.

Add `--chart-warning` to:
1. `index.css` `:root` and `.dark` blocks
2. `@theme inline` block as `--color-chart-warning: var(--chart-warning)`
3. `HEX_FALLBACKS` in `chart-themes.ts` as `'--chart-warning': '#d4a030'`

### Hard-Coded Hex Replacement

| File | Line | Current Hex | Replacement |
|------|------|-------------|-------------|
| `echart-wrapper.tsx` | 144 | `#ef4444` | `resolveColor('--chart-negative')` via `chart-themes.ts` |
| `echart-wrapper.tsx` | 145 | `#f59e0b` | `resolveColor('--chart-warning')` via `chart-themes.ts` |
| `echart-wrapper.tsx` | 146 | `#10b981` | `resolveColor('--chart-positive')` via `chart-themes.ts` |
| `ag-chart-wrapper.tsx` | 159 | `'#43A047', '#FF5722'` | `resolveColor('--chart-positive')`, `resolveColor('--chart-negative')` |

Import `resolveColor` from `chart-themes.ts` (or extract a shared `getCssVar` helper). The `resolveColor` function already exists in `chart-themes.ts` and handles oklch-to-hex conversion.

**Source:** CONTEXT.md D-09, D-10, D-11.

---

## Layout Contract

### List Page Container

```
<motion.div className="p-6">
  <h1> ... </h1>       <!-- stagger: first -->
  <Toolbar />           <!-- stagger: second -->
  <Content />           <!-- stagger: third (AnimatePresence crossfade) -->
</motion.div>
```

No `max-w` constraint -- list page uses full width within the app shell for card grid density.

### Grid/List View Grid

| View | Layout |
|------|--------|
| Grid | `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4` (unchanged) |
| List | `space-y-2` (stacked rows, unchanged) |

### Builder Page Container

```
<div className="flex flex-col h-[calc(100vh-3.5rem)]">
  <Header />          <!-- px-6 pt-4 pb-4, shrink-0 -->
  <SideBySide />      <!-- flex gap-4, flex-1, min-h-0, px-6 pb-4 -->
    |- Steps (w-[380px], shrink-0, rounded-lg border bg-card)
    |- Preview (flex-1, rounded-lg border bg-card)
</div>
```

Builder layout is inherited from existing `chart-builder.tsx` and is not changed structurally.

**Source:** Existing codebase patterns.

---

## Component Inventory

### 1. Chart Type Style Constants (NEW -- extend `lib/style-constants.ts`)

**Decision:** D-01, D-02.

| Export | Type | Contents |
|--------|------|----------|
| `CHART_TYPE_BORDER_COLORS` | `Record<LibraryChartType, string>` | Chart-type-specific `border-l-{color}-500` classes |
| `CHART_TYPE_PILL_BG` | `Record<LibraryChartType, string>` | Chart-type-specific `bg-{color}-500/15` classes |
| `CHART_TYPE_PILL_TEXT` | `Record<LibraryChartType, string>` | Chart-type-specific `text-{color}-600 dark:text-{color}-400` classes |

### 2. Chart Library Card (ENHANCED)

**Decision:** D-01, D-02, D-03.

| Property | Current | Target |
|----------|---------|--------|
| Wrapper | Plain `div` with CSS hover | `motion.div` wrapping, `whileHover={{ y: -2 }}`, `transition={{ duration: 0.15, ease: 'easeOut' }}` |
| Left border | None | `border-l-2` + `CHART_TYPE_BORDER_COLORS[chart.chartType]` |
| Chart type pill | `bg-background/80 text-muted-foreground` | `CHART_TYPE_PILL_BG[chart.chartType]` + `CHART_TYPE_PILL_TEXT[chart.chartType]` + `backdrop-blur-sm border-0` |
| Stagger entrance | None | `initial={{ opacity: 0, y: 8 }}`, `animate={{ opacity: 1, y: 0 }}`, `transition={{ delay: index * 0.05, duration: 0.2 }}` |
| ECharts thumbnails | Not rendered (fallback icon only) | Wire `EChartWrapper` into card for ECharts types (sankey, radar, gauge, funnel, graph, parallel, sunburst) using same data-fetching pattern as AG Charts cards |
| Shadow/spacing | CSS `hover:shadow-lg hover:-translate-y-0.5` | Remove CSS translate (handled by motion.div), keep `hover:shadow-lg hover:shadow-primary/5` |

### 3. Chart Library Row (ENHANCED)

**Decision:** D-03 (mirrored for rows).

| Property | Current | Target |
|----------|---------|--------|
| Wrapper | Plain `div` with CSS hover | `motion.div` wrapping, `whileHover={{ y: -1 }}`, `transition={{ duration: 0.15, ease: 'easeOut' }}` |
| Left border | None | `border-l-2` + `CHART_TYPE_BORDER_COLORS[chart.chartType]` |
| Icon container | `bg-muted/50` | `CHART_TYPE_PILL_BG[chart.chartType]` (low-opacity tint matching type) |
| Stagger entrance | None | Same stagger pattern as cards: `delay: index * 0.05` |

### 4. View Toggle Crossfade (NEW animation)

**Decision:** D-04.

```
<AnimatePresence mode="wait">
  <motion.div
    key={viewMode}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.2 }}
  >
    {viewMode === 'grid' ? <GridView /> : <ListView />}
  </motion.div>
</AnimatePresence>
```

### 5. Page Entrance Stagger (NEW)

Matching Phase 3 pattern:

| Element | Delay | Animation |
|---------|-------|-----------|
| Page title (`h1`) | 0ms | `opacity: 0->1` |
| Toolbar | 50ms | `opacity: 0->1, y: 8->0` |
| Content area | 100ms | `opacity: 0->1, y: 8->0` |

### 6. Filtered Empty State (ENHANCED)

**Decision:** D-05.

Replace current bare `<p>`:
```tsx
<p className="py-8 text-center text-sm text-muted-foreground">
  No charts matching "{searchQuery}"
</p>
```

With:
```tsx
<Empty className="border rounded-lg">
  <EmptyHeader>
    <EmptyMedia variant="icon"><Search /></EmptyMedia>
    <EmptyTitle>No charts matching "{searchQuery}"</EmptyTitle>
    <EmptyDescription>Try a different search term or clear your filters.</EmptyDescription>
  </EmptyHeader>
</Empty>
```

### 7. Builder Accordion Animations (ENHANCED)

**Decision:** D-06.

| Element | Animation |
|---------|-----------|
| Accordion content open | `initial={{ opacity: 0, height: 0 }}`, `animate={{ opacity: 1, height: 'auto' }}`, duration 150ms |
| Accordion content close | `exit={{ opacity: 0, height: 0 }}`, duration 100ms |
| Preview area crossfade | `AnimatePresence mode="wait"`, opacity 0->1, duration 200ms, keyed on `chartType + mappingHash` |
| Step completion checkmark | `initial={{ scale: 0 }}`, `animate={{ scale: 1 }}`, spring with `stiffness: 300, damping: 20` |

### 8. Mapping Step Tooltips (NEW)

**Decision:** D-07.

Each mapping field label gets an inline info icon (`HelpCircle` from Lucide, `size-3.5 text-muted-foreground`) wrapped in a Popover that explains what the field does for the current chart type.

| Field | Tooltip Content (example for bar chart) |
|-------|----------------------------------------|
| X-Axis | "The category axis. Each unique value becomes a bar group." |
| Metrics | "Numeric columns to plot. Each metric becomes a separate bar series." |
| Y-Axis (heatmap) | "The secondary dimension. Combined with X-Axis, each cell is one data point." |
| Source/Target (sankey) | "Start and end nodes for flow connections. Each row is one link." |

Tooltip content varies by `chartType`. Store tooltip text in a `MAPPING_FIELD_TOOLTIPS: Record<LibraryChartType, Record<string, string>>` map in `step-mapping.tsx` or a dedicated `chart-builder-tooltips.ts` file.

### 9. Chart Config Help Sheet (NEW)

**Decision:** D-07.

A `Sheet` (side="right", `w-[400px]`) accessible from a `BookOpen` icon button in the mapping step header area. Content organized per chart type:

| Section | Content |
|---------|---------|
| Required Fields | List of mandatory fields with descriptions |
| Optional Fields | List of optional fields with defaults |
| Aggregation Behavior | How aggregation applies for this chart type |
| Example Mapping | Concrete example with sample column names |

Sheet entrance animation: `motion.div` with `initial={{ x: 20, opacity: 0 }}`, `animate={{ x: 0, opacity: 1 }}`, duration 200ms. Mirrors Phase 3 column metadata help sheet pattern.

### 10. Appearance Step Expansion (ENHANCED)

**Decision:** D-08.

Current step-appearance only has: legend toggle, legend position, X-axis label toggle, Y-axis label toggle. Expand with chart-type-specific conditional fields:

| Chart Type | Additional Fields |
|------------|-------------------|
| heatmap | Color range: min color picker (default `--color-ramp-low`), max color picker (default `--color-ramp-high`) |
| gauge | Min value (number input, default 0), Max value (number input, default 100), Color band thresholds (two number inputs: danger cutoff default 30, warning cutoff default 70) |
| treemap | Color key column selector (from dataset measure columns), Color range min/max pickers |
| waterfall | Positive color picker (default `--chart-positive`), Negative color picker (default `--chart-negative`) |
| pie | Label position: Select with options "outside" / "inside" / "none" |
| donut | Inner radius: Slider 0.3-0.8 (default 0.6), Label position: Select |
| scatter | Size key column selector (from dataset measure columns), Point shape: Select with options "circle" / "square" / "diamond" |
| Default (line, bar, area, stacked-bar, combo, bullet, box-plot, radar, sankey, sunburst, funnel, graph, parallel) | Current behavior unchanged (legend + axis toggles) |

Color pickers: Use a small swatch button that opens a Popover with preset swatches (the 8 series colors + positive/negative/warning). Not a free-form color picker -- constrained to palette.

All additional fields stored in a new optional `typeSpecific` record within `ChartAppearance`. Example: `typeSpecific?: Record<string, unknown>`.

### 11. Detail Panel (ENHANCED)

**Decision:** D-16.

| Property | Current | Target |
|----------|---------|--------|
| Sheet width | `w-[500px]` | `w-[500px]` (unchanged) |
| Border accent | None (`border-l-0`) | `border-l-2` + `CHART_TYPE_BORDER_COLORS[chart.chartType]` |
| Sheet entrance | Default Sheet slide | `motion.div` inside SheetContent: `initial={{ x: 20, opacity: 0 }}`, `animate={{ x: 0, opacity: 1 }}`, duration 200ms |
| Section header icons | Some icons (`Database`, `Layers`, `Calendar`) | Add icon accent: wrap each icon in `text-primary/60` for subtle tint |
| Footer | Existing `Edit Chart` + trash icon | Keep existing pattern, unchanged. Matches Phase 2 sticky footer. |

### 12. ECharts Live Thumbnails (NEW)

**Decision:** D-15.

Wire ECharts rendering into `chart-library-card.tsx` for ECharts-type charts. Currently, ECharts cards show a fallback icon. Change:

| Chart Type | Current Card Thumbnail | Target |
|------------|----------------------|--------|
| sankey, sunburst, radar, gauge, funnel, graph, parallel | Static `ChartTypeIcon` at `size-40` | Live `EChartWrapper` render using the same `useQuery` data fetch |

Implementation: In `chart-library-card.tsx`, detect if `chart.chartType` is an ECharts type (use `isEChartsType()` from `chart-factory.tsx` or create a local set). If so, render the thumbnail via `ChartFactory` (which already routes to `EChartWrapper`). Add an interaction blocker overlay (already exists as `<div className="absolute inset-0 z-50" />`).

ECharts thumbnail sizing: Fill the 180px-tall container. Disable all interactivity via ECharts `opts: { renderer: 'canvas' }` and `series[].silent: true`.

### 13. Chart Config Audit (PROCESS)

**Decision:** D-13, D-14.

Wave 1 produces a chart-type config reference file documenting:
- Each chart type
- Required config fields
- What the builder currently captures
- What the renderer currently applies
- Gaps

This audit file (placed in `.planning/phases/04-charts-page/chart-config-audit.md`) drives subsequent implementation waves.

### 14. Stored Config JSON Audit (PROCESS)

**Decision:** D-12.

Audit all chart config JSON in `recviz_charts` seed data for stale hex color overrides (hardcoded `#xxxxxx` in appearance or colorRange fields). Replace with CSS variable references or remove so charts pick up palette colors automatically.

### 15. Console Error Investigation (PROCESS)

**Decision:** D-17.

Triage the 7 errors and 72 warnings. Fix chart-related errors. Log non-chart warnings (React, TanStack) in USAGE-TRACKER but do not fix.

---

## Animation Contract

All animations use `motion/react`. Timing values are prescriptive:

| Animation | Duration | Easing | Trigger |
|-----------|----------|--------|---------|
| Card hover lift | 150ms | `easeOut` | `whileHover` |
| Row hover lift | 150ms | `easeOut` | `whileHover` |
| Card stagger entrance | 200ms per card | `easeOut` | Mount, 50ms stagger |
| View toggle crossfade | 200ms | `easeOut` | `AnimatePresence mode="wait"` |
| Page entrance stagger | 200ms per element | `easeOut` | Mount, 50ms stagger |
| Builder content fadeIn | 150ms | `easeOut` | Accordion open |
| Builder content fadeOut | 100ms | `easeOut` | Accordion close |
| Preview crossfade | 200ms | `easeOut` | Chart type or mapping change |
| Step checkmark | spring (stiffness 300, damping 20) | spring | Step completion |
| Detail panel content entrance | 200ms | `easeOut` | Sheet open |

**Source:** CONTEXT.md D-03, D-04, D-06 + Phase 2/3 established patterns.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA (empty state) | "Create Chart" |
| Primary CTA (builder) | "Save Chart" (create mode) / "Save Changes" (edit mode) |
| Empty state heading | "No charts yet" |
| Empty state body | "Create your first chart to start building dashboards. Pick a dataset, choose a chart type, and map your columns." |
| Filtered empty state heading | 'No charts matching "{searchQuery}"' |
| Filtered empty state body | "Try a different search term or clear your filters." |
| Error state (data load) | "Failed to load charts. Check your connection and try again." |
| Error state (save) | "Failed to save chart" (via toast) |
| Error state (preview unavailable) | "Preview unavailable" |
| Destructive: Delete Chart | Dialog title: 'Delete "{chartName}"?' / Body: "This will permanently remove the chart from the library. Any dashboards using this chart will lose it. This cannot be undone." / Confirm: "Delete Chart" / Cancel: "Keep Chart" |
| Destructive: Cannot delete | Dialog title: 'Cannot delete "{chartName}"' / Body: "This chart is used in the following dashboards. Remove it from those dashboards first:" / Dismiss: "Close" |
| Builder step labels | "1. Dataset", "2. Chart Type", "3. Column Mapping", "4. Appearance" |
| Builder step "Continue" | "Continue" (steps 1, 3) |
| Builder step "Done" | "Done" (step 4) |
| Help sheet button tooltip | "Configuration reference" |
| Chart name placeholder | "Untitled Chart" |
| Description placeholder | "Add a description..." |

**Source:** Existing codebase copy (preserved where good), CONTEXT.md decisions.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | accordion, avatar, badge, breadcrumb, button, calendar, card, checkbox, collapsible, command, dialog, dropdown-menu, empty, input, kbd, label, popover, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, sonner, spinner, switch, tabs, textarea, timeline | not required |
| Third-party | none | not applicable |

No new shadcn components are required for Phase 4. All UI is built from existing primitives plus `motion/react` wrappers.

---

## Interaction States

| Component | Default | Hover | Active/Selected | Disabled | Loading |
|-----------|---------|-------|-----------------|----------|---------|
| Chart card | `bg-card border` + type accent border-l | `y: -2`, `shadow-lg shadow-primary/5`, `border-primary/20` | N/A (click opens detail panel) | N/A | `Skeleton h-[220px]` |
| Chart row | `border` + type accent border-l | `y: -1`, `bg-muted/30`, `border-primary/20` | N/A (click opens detail panel) | N/A | `Skeleton h-[56px]` |
| View toggle button | `variant="ghost"` | Standard ghost hover | `variant="default"` (active view) | N/A | N/A |
| Builder accordion step | `border-b` | Chevron rotate on trigger hover | `border-l-2 border-l-primary` (active) | `opacity-50 cursor-not-allowed` (locked) | N/A |
| Save button | `variant="default"` | Standard primary hover | N/A | `disabled` (chart incomplete or saving) | `Loader2 animate-spin` |
| Delete button | `variant="ghost" text-destructive` | Destructive hover | N/A | `disabled` (deleting) | `Loader2 animate-spin` |
| Chart thumbnail (card) | Live chart render | Interaction blocker prevents chart hover | N/A | N/A | `Skeleton h-3/4 w-3/4` |
| Tooltip info icon | `text-muted-foreground` | `text-foreground` | Popover open | N/A | N/A |
| Color swatch button | Circular swatch with palette color | Ring highlight | Selected ring | N/A | N/A |

---

## Dark Mode Contract

Every component and color token must work in both light and dark modes. Specific dark mode rules:

1. All chart-type accent colors use explicit `dark:` variants: `text-blue-600 dark:text-blue-400` (never opacity modifiers for text).
2. Chart-type pill backgrounds use `/15` opacity which works in both modes.
3. CSS variables `--chart-positive`, `--chart-negative`, `--chart-warning` have separate light/dark values in `index.css`.
4. Card hover shadow: `hover:shadow-lg hover:shadow-primary/5` works in both modes (opacity-based).
5. Detail panel, builder panels use `bg-card` and `bg-muted/30` which auto-adapt via CSS variables.
6. No hardcoded hex colors anywhere in UI components. Chart rendering hex is resolved at runtime via `resolveColor()` from `chart-themes.ts`.

**Source:** CLAUDE.md dark mode rules, Phase 3 UI-SPEC dark mode contract.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
