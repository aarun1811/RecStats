---
phase: 6
slug: dashboards-page
status: draft
shadcn_initialized: true
preset: new-york
created: 2026-04-13
---

# Phase 6 -- UI Design Contract

> Visual and interaction contract for the Dashboards Page. Covers list page polish (card/row motion, border accent, filtered empty state, AnimatePresence crossfade), dashboard detail/view header enrichment, renderer premium treatment (filter bar section header, KPI trend accent, chart entrance animations, toolbar spin, cross-filter chip polish, drill breadcrumb motion), builder picker dialog polish, embed route verification, backend pipeline fix (ConfigStore rewire from recviz_data_sources to recviz_datasets), legacy code audit, and store dead-path cleanup. Continues the "Refined Command Center" aesthetic established in Phases 2-5.

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

**Source:** `frontend/components.json` -- inherited from Phase 1, unchanged through Phase 5.

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline padding, badge internal spacing, stat icon-to-number gap |
| sm | 8px | Compact element spacing, card internal gaps, filter control gaps |
| md | 16px | Default element spacing, card padding (`p-4`), grid gaps (`gap-4`), card metadata padding (`px-4 py-3`) |
| lg | 24px | Page content `p-6`, section padding, renderer section gaps (`gap-6`) |
| xl | 32px | Layout gaps between major sections |
| 2xl | 48px | Not used this phase |
| 3xl | 64px | Not used this phase |

Exceptions:
- 12px (`gap-3`): KPI row grid gap and filter bar internal wrap gap (inherited from existing renderer).
- Card hero height: 180px (`h-[180px]`) -- inherited from `dashboard-list-card.tsx`, not changed.
- Filter control widths: 180px (`w-[180px]`) single-select, 200px (`w-[200px]`) multi-select -- inherited, not changed.
- Touch targets: All interactive buttons maintain minimum 28px height (`size-7` icon buttons in toolbar), cards fill their full area as click targets.

**Source:** Phase 4/5 UI-SPEC spacing scale + existing dashboard component measurements.

---

## Typography

3 sizes, 2 weights:

| Role | Size | Weight | Line Height | Tailwind Class |
|------|------|--------|-------------|----------------|
| Page title | 24px | 600 (semibold) | 1.2 (~29px) | `text-2xl font-semibold tracking-tight` |
| Body / Section heading | 14px | 400 (regular) / 600 (semibold) | 1.43 (~20px) | `text-sm` / `text-sm font-semibold` |
| Label / Caption | 12px | 400 (regular) / 600 (semibold) | 1.33 (~16px) | `text-xs text-muted-foreground` / `text-xs font-semibold` |

Supplemental roles (use only the 3 declared sizes and 2 declared weights):

| Role | Size | Weight | Line Height | Tailwind Class |
|------|------|--------|-------------|----------------|
| Card title | 14px | 600 (semibold) | snug | `text-sm font-semibold truncate leading-snug` |
| Card subtitle | 11px | 400 (regular) | snug | `text-[11px] text-muted-foreground truncate` |
| Filter label | 12px | 500 (medium) | normal | `text-xs font-medium uppercase text-muted-foreground` |
| KPI label (renderer) | 11px | 500 (medium) | normal | `text-[11px] font-medium uppercase tracking-wider text-muted-foreground` |
| KPI value (renderer) | 24px | 600 (semibold) | tight | `text-2xl font-semibold tabular-nums tracking-tight` |
| Stat counter (card) | 10px | 500 (medium) | normal | `text-[10px] font-medium tabular-nums` |
| Detail header metadata | 14px | 400 (regular) | 1.5 | `text-sm text-muted-foreground` |
| Picker dialog card title | 14px | 500 (medium) | normal | `text-sm font-medium truncate` |

Font: `"Inter", system-ui, sans-serif` -- declared in `@layer base` body rule in `index.css`.

**Source:** Phase 4/5 UI-SPEC typography + existing dashboard component measurements.

---

## Color

### Inherited Global Palette

Phase 6 inherits the complete Mist+Blue palette from Phase 1. All colors consumed via CSS variables -- no hardcoded hex/rgb/hsl anywhere.

| Role | CSS Variable | Usage |
|------|-------------|-------|
| Dominant (60%) | `--background` | Page background, main content area, embed background |
| Secondary (30%) | `--card`, `--muted`, `--secondary` | Cards, filter bar (`bg-muted/50`), toolbar chrome (`bg-background/80`), builder panels |
| Accent (10%) | `--primary` (Blue) | "Create Dashboard" CTA, "Save Dashboard" CTA, card `border-l-2 border-l-primary`, row icon container accent (`bg-primary/5`), Apply button, focus rings |
| Destructive | `--destructive` | "Delete Dashboard" button, delete confirmation dialog |

Accent reserved for:
- "Create Dashboard" primary button (list page empty state and toolbar)
- "Save Dashboard" / "Save Changes" primary CTA in builder
- Dashboard card `border-l-2 border-l-primary` left accent
- Dashboard row icon container `bg-primary/5 border border-primary/10` tint
- "Apply" button in filter bar
- "Add to Dashboard" button in picker dialogs
- Focus rings on inputs and controls

### Dashboard Entity Color

Dashboards are composite entities (not per-type categorized like charts). All dashboard cards and rows use a single accent color:

| Element | Color Class |
|---------|------------|
| Card border-l | `border-l-2 border-l-primary` |
| Row border-l | `border-l-2 border-l-primary` |
| Row icon container | `bg-primary/5 border border-primary/10` |

**Source:** CONTEXT.md D-06, D-09.

### KPI Trend Accent Colors (Renderer)

| Trend Direction | Text | Background | Border |
|----------------|------|------------|--------|
| Positive (>= 0) | `text-green-600 dark:text-green-400` | `bg-green-500/10` | `border-l-green-500` |
| Negative (< 0) | `text-red-600 dark:text-red-400` | `bg-red-500/10` | `border-l-red-500` |
| Neutral / no trend | `text-foreground` | none | `border-l-muted` |

KPI cards in the renderer get `border-l-2` accent colored by trend direction. The trend badge pill already uses these colors (existing code in `config-kpi-row.tsx`); the enhancement adds the card-level border accent.

**Source:** CONTEXT.md D-12. Never use opacity modifiers for text in dark mode -- use explicit `dark:` variants.

---

## Component Inventory

### List Page Components

| Component | Current State | Phase 6 Enhancement |
|-----------|--------------|-------------------|
| `DashboardList` | Plain `div` containers, no AnimatePresence | Wrap grid/list toggle in `AnimatePresence mode="wait"`, upgrade filtered empty state to `Empty` component |
| `DashboardListCard` | CSS hover (`hover:-translate-y-0.5`), no border-l, no stagger | `motion.div` wrapper with `whileHover={{ y: -2 }}`, `border-l-2 border-l-primary`, stagger entrance, remove CSS translate |
| `DashboardListRow` | CSS hover, no border-l, no stagger | `motion.div` wrapper with stagger entrance, `border-l-2 border-l-primary` |
| `DashboardListToolbar` | Static | No changes needed (already clean) |
| Filtered empty state | Bare `<p>` tag | `Empty` component with Search icon, heading, description |

#### Card Enhancement Detail

| Property | Current | Target |
|----------|---------|--------|
| Wrapper | Plain `div` with CSS hover | `motion.div`, `whileHover={{ y: -2 }}`, `transition={{ duration: 0.15, ease: 'easeOut' }}` |
| Left border | None | `border-l-2 border-l-primary` |
| Stagger entrance | None | `initial={{ opacity: 0, y: 8 }}`, `animate={{ opacity: 1, y: 0 }}`, `transition={{ delay: index * 0.05, duration: 0.2 }}` |
| Shadow/hover | CSS `hover:-translate-y-0.5` | Remove CSS translate (motion.div handles it), keep `hover:shadow-lg hover:shadow-primary/5` |
| Metadata padding | `px-3.5 py-3` | `px-4 py-3` (align to 16px standard) |

**Source:** CONTEXT.md D-05, D-06.

#### Row Enhancement Detail

| Property | Current | Target |
|----------|---------|--------|
| Wrapper | Plain `div` with CSS hover | `motion.div`, stagger entrance matching cards |
| Left border | None | `border-l-2 border-l-primary` |
| Icon container | `bg-primary/5 border border-primary/10` | Unchanged (already correct) |

**Source:** CONTEXT.md D-09.

#### View Toggle Crossfade

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

**Source:** CONTEXT.md D-07, matching Phase 3/4 pattern.

#### Filtered Empty State

Replace current `<p>` with:

```tsx
<Empty className="border rounded-lg">
  <EmptyHeader>
    <EmptyMedia variant="icon"><Search /></EmptyMedia>
    <EmptyTitle>No dashboards matching "{searchQuery}"</EmptyTitle>
    <EmptyDescription>Try a different search term or clear your filters.</EmptyDescription>
  </EmptyHeader>
</Empty>
```

**Source:** CONTEXT.md D-08, matching Phase 3/4 pattern.

---

### Dashboard Detail/View Header

The existing detail page (`$dashboardId.tsx`) already has a header with name, description, and edit/share buttons. Enhancement per D-10:

| Element | Current | Target |
|---------|---------|--------|
| Name | `h1 text-2xl font-semibold` | Unchanged |
| Description | `text-sm text-muted-foreground` | Unchanged |
| Metadata row | Not present | Add panel count summary: "3 KPIs \xb7 5 Charts \xb7 1 Grid", last updated timestamp |
| Action buttons | Edit + ShareLink | Unchanged (already correct pattern) |

Metadata row layout:
```
<div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
  <span className="flex items-center gap-1">
    <Gauge size={14} /> {counts.kpis} KPIs
  </span>
  <span className="flex items-center gap-1">
    <BarChart3 size={14} /> {counts.charts} Charts
  </span>
  <span className="flex items-center gap-1">
    <Table2 size={14} /> {counts.grids} Grids
  </span>
  <span>\xb7</span>
  <span>Updated {timeAgo}</span>
</div>
```

---

### Renderer Components (Premium Polish)

#### Filter Bar (D-11)

| Property | Current | Target |
|----------|---------|--------|
| Section header | None | Add `SlidersHorizontal` icon + "Filters" label row above the Card, subtle `text-primary/60` icon tint |
| Filter controls entrance | Immediate render | Stagger entrance: each `FilterControl` wraps in `motion.div` with `initial={{ opacity: 0, y: 4 }}`, `animate={{ opacity: 1, y: 0 }}`, `transition={{ delay: i * 0.03 }}` |

#### KPI Row (D-12)

| Property | Current | Target |
|----------|---------|--------|
| Card border | None | `border-l-2` colored by trend: green if percentage >= 0, red if < 0, `border-l-muted` if no trend |
| Card entrance | Immediate render | `motion.div` wrapper: `initial={{ opacity: 0, scale: 0.95 }}`, `animate={{ opacity: 1, scale: 1 }}`, spring `stiffness: 300, damping: 24`, stagger `delay: i * 0.05` |
| Trend colors | Already correct (`text-green-600 dark:text-green-400` / `text-red-600 dark:text-red-400`) | Verify no opacity modifiers, use explicit `dark:` variants |

#### Chart Grid (D-13)

| Property | Current | Target |
|----------|---------|--------|
| Chart card entrance | Immediate render | `motion.div` wrapper on each card: `initial={{ opacity: 0 }}`, `animate={{ opacity: 1 }}`, `transition={{ duration: 0.3, delay: 0.1 }}` (fade in from skeleton) |
| Chart toolbar | Already has `AnimatePresence` opacity fade on hover | Verify polish: ensure `bg-background/80 backdrop-blur-sm` survives both modes |

#### Dashboard Toolbar (D-14)

| Property | Current | Target |
|----------|---------|--------|
| Refresh spin | `animate-spin` class on `RefreshCw` when `isRefreshing` | Already implemented -- verify it works correctly |
| Auto-refresh | `AutoRefreshControl` component | Already implemented -- no changes |
| Share button | `ShareLinkButton` component | Already implemented -- verify toast on copy |

#### Cross-Filter Bar (D-15)

| Property | Current | Target |
|----------|---------|--------|
| Container animation | `motion.div` with height/opacity | Already correct -- verify polish |
| Chip animation | `motion.div` with scale/opacity + `layout` prop | Already correct |
| Chip styling | `Badge variant="secondary"` | Match Phase 2-4 badge pattern -- already uses `Badge variant="secondary"`, verify consistency |

**Cross-filter bar is already well-animated. Verify and polish, do not rewrite.** (CONTEXT.md specifics)

#### Drill Breadcrumb (D-16)

| Property | Current | Target |
|----------|---------|--------|
| Breadcrumb entrance | Immediate render | Wrap in `motion.div`: `initial={{ opacity: 0, x: -8 }}`, `animate={{ opacity: 1, x: 0 }}`, `transition={{ duration: 0.2 }}` |
| Detail grid skeleton | `Skeleton className="h-[300px]"` via `DrillDetailGrid` loading state | Verify skeleton renders during data fetch |
| Level transitions | No animation | Breadcrumb list items get subtle layout animation via `motion.div` with `layout` prop |

#### Drill Detail Grid

The detail grid already uses `AnimatePresence` with height/opacity animation for entrance/exit. Auto-scrolls to grid on animation complete. No changes needed.

---

### Builder Components (Light Polish)

#### Builder Filter Bar (D-18)

| Property | Current | Target |
|----------|---------|--------|
| Filter chip wrapper | Plain `div` with drag handlers | Wrap each chip in `motion.div` with `initial={{ opacity: 0, scale: 0.9 }}`, `animate={{ opacity: 1, scale: 1 }}`, `exit={{ opacity: 0, scale: 0.9 }}` |
| Container | Static `div` | Wrap chips area in `AnimatePresence mode="popLayout"` for smooth add/remove |
| Drag-and-drop | Native drag-and-drop | Stays as-is (D-18 decision) |

#### Picker Dialogs (D-19)

| Dialog | Enhancement |
|--------|-------------|
| `ChartPickerDialog` | Dialog entrance via default Dialog animation (already handled by Radix). Card grid items get hover `hover:border-primary/30 hover:bg-accent/50` (already present). Add subtle stagger entrance on card grid items: `motion.div` with `initial={{ opacity: 0, y: 4 }}`, `animate={{ opacity: 1, y: 0 }}`, `transition={{ delay: i * 0.03 }}` |
| `KpiPickerDialog` | Same stagger entrance pattern as ChartPickerDialog |
| `DatasetPickerDialog` | Same stagger entrance pattern as ChartPickerDialog |
| `FilterConfigDialog` | Dialog entrance only -- no card grid to stagger |

Picker dialog empty state copy:
- ChartPickerDialog: "No charts found" (already present)
- KpiPickerDialog: "No KPIs found"
- DatasetPickerDialog: "No datasets found"

#### Builder Canvas (D-20)

| Property | Current | Target |
|----------|---------|--------|
| Panel hover | Default card hover | Subtle `hover:shadow-md` elevation change |
| Panel edit/delete actions | Already present | Fade in on hover via parent `group` + `opacity-0 group-hover:opacity-100 transition-opacity` (already the established pattern) |
| Builder toolbar | Already polished | No changes (CONTEXT.md: "Builder toolbar and empty state are already polished") |
| Builder empty state | Already has `motion/react` SVG animation | No changes (CONTEXT.md confirms) |

---

### Legacy Code Audit (D-21, D-22, D-23)

| Audit Target | Action |
|-------------|--------|
| `filter-bar.tsx`, `kpi-row.tsx`, `chart-grid.tsx` | Already deleted (D-21 confirmed). Grep for any stale import references and remove. |
| `filter-store.ts` | Audit for dead state slices, unused actions, Superset-era shapes. Remove dead code. |
| `drill-store.ts` | Audit for dead state slices, unused actions. Remove dead code. |
| `builder-store.ts` | Audit for dead state slices, unused actions. Remove dead code. |
| `layout-history-store.ts` | Audit for dead state slices, unused actions. Remove dead code. |
| `dashboard-renderer.tsx` line 65 comment | Remove Superset reference: "TQ scheduling + HTTP/2 multiplexing + Superset cache handle concurrency" |

---

### Embed Route (D-24, D-25, D-26)

| Feature | Current State | Verification |
|---------|--------------|--------------|
| `?filter.*=value` | `parseFilterParams` reads `filter.*` keys | Verify filters are applied to renderer |
| `?filter.lock=field` | `parseLockedFilters` reads `filter.lock` | Verify locked filter shows Lock icon, cannot be changed |
| `?hide=sidebar,header,filter-bar,toolbar` | `parseHideTokens` reads `hide` param | Verify each token individually hides the correct section |
| `?theme=dark` | `useEffect` + `applyTheme` | Already implemented (lines 53-58 of embed route). Verify dark class applies. |
| URL filter round-trip | `serializeFilterParams` / `stripFilterParams` in view route | Verify applied filters sync back to URL in view route; embed does not write back |

---

## Animation Contract

All animations use `motion/react`. Timing values are prescriptive:

| Animation | Duration | Easing | Trigger |
|-----------|----------|--------|---------|
| Card hover lift | 150ms | `easeOut` | `whileHover={{ y: -2 }}` |
| Card stagger entrance | 200ms per card | `easeOut` | Mount, `delay: i * 0.05` |
| Row stagger entrance | 200ms per row | `easeOut` | Mount, `delay: i * 0.05` |
| View toggle crossfade | 200ms | `easeOut` | `AnimatePresence mode="wait"` on viewMode change |
| KPI card entrance | spring (300, 24) | spring | Mount, `delay: i * 0.05` |
| KPI card scale | 300ms | spring | `initial={{ scale: 0.95 }}`, `animate={{ scale: 1 }}` |
| Chart card fade-in | 300ms | `easeOut` | Mount, `delay: 0.1` |
| Chart toolbar fade | 150ms | `easeOut` | `AnimatePresence` on hover (already exists) |
| Filter control stagger | 200ms per control | `easeOut` | Mount, `delay: i * 0.03` |
| Cross-filter bar expand | 200ms | `easeOut` | height 0->auto + opacity (already exists) |
| Cross-filter chip | 150ms | `easeOut` | scale + opacity (already exists) |
| Drill breadcrumb entrance | 200ms | `easeOut` | opacity + x offset |
| Drill detail grid | 200ms | `easeOut` | height + opacity (already exists) |
| Builder filter chip add/remove | 150ms | `easeOut` | `AnimatePresence mode="popLayout"` |
| Picker dialog card stagger | 200ms per card | `easeOut` | Mount, `delay: i * 0.03` |
| Refresh icon spin | continuous | linear | `isRefreshing` state (already exists via `animate-spin`) |

**Source:** CONTEXT.md D-05 through D-20 + Phase 2-5 established patterns.

---

## Interaction Contract

### List Page: Card Click -> Dashboard View
1. User clicks dashboard card or row
2. TanStack Router navigates to `/dashboards/:id`
3. View page loads with skeleton loading state
4. Dashboard header renders with name, description, metadata row
5. Renderer sections load in sequence: toolbar, filter bar, KPIs, charts, grids

### List Page: Grid/List View Toggle
1. User clicks toggle group item
2. Current view fades out (opacity 1->0, 100ms)
3. `AnimatePresence mode="wait"` waits for exit
4. New view fades in with stagger (opacity 0->1, y 8->0, per-item 50ms delay)

### Renderer: Filter Apply Flow
1. User selects filter values in dropdowns
2. User clicks "Apply" button
3. Filter store updates `applied` snapshot
4. All query-sourced charts refetch with new filters
5. KPI row refetches and re-animates values
6. Cross-filters and drill state clear (stale value prevention)
7. URL updates via `replaceState` (no history pollution)

### Renderer: Cross-Filter Click
1. User clicks a data point on a chart
2. Cross-filter bar expands (height 0->auto, 200ms)
3. Chip appears with scale/opacity animation
4. Other charts filter client-side via `useCrossFilter`
5. KPIs re-aggregate client-side
6. Clicking same chart clears that chart's cross-filter

### Renderer: Drill-Down Double-Click
1. User double-clicks a data point on a chart
2. Breadcrumb appears in chart header (opacity + x offset, 200ms)
3. Chart re-aggregates to next hierarchy level
4. At detail level: full-width detail grid slides in below chart (height 0->auto, 200ms)
5. Auto-scrolls to detail grid on animation complete

### Builder: Add Panel Flow
1. User clicks "Add Chart" / "Add KPI" / "Add Data Grid" in builder
2. Picker dialog opens (Radix Dialog default animation)
3. Card grid staggers in (per-card 30ms delay)
4. User searches, selects, clicks "Add to Dashboard"
5. Panel appears on canvas

### Delete Flow
1. User clicks delete button (card hover or builder)
2. `DeleteDashboardDialog` opens
3. Confirmation: "This will permanently delete '{name}'. This cannot be undone."
4. On confirm: DELETE API call, success toast, navigate to list

### Embed Route Interaction
1. Portal loads `/embed/dashboards/:id?filter.region=EMEA&filter.lock=region&hide=sidebar,header&theme=dark`
2. `?theme=dark` applies dark mode to embed root
3. `?hide=sidebar,header` hides sidebar and embed topbar title
4. `?filter.region=EMEA` pre-fills region filter
5. `?filter.lock=region` shows Lock icon, disables region dropdown
6. Renderer renders normally minus hidden sections

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA (list toolbar) | "Create Dashboard" |
| Primary CTA (builder) | "Save Dashboard" (create) / "Save Changes" (edit) |
| Empty state heading | "No dashboards yet" |
| Empty state body | "Create your first dashboard to start visualizing reconciliation data. Add charts, KPIs, and filters from your libraries." |
| Filtered empty state heading | 'No dashboards matching "{searchQuery}"' |
| Filtered empty state body | "Try a different search term or clear your filters." |
| Error state (data load) | "Failed to load chart data" (per chart card, via ErrorPanel) |
| Error state (KPI load) | "Failed to load KPI data" (KPI row, via ErrorPanel) |
| Error state (dashboard not found) | "Dashboard not found" |
| Destructive: Delete Dashboard | Dialog title: 'Delete "{dashboardName}"?' / Body: "This will permanently delete '{dashboardName}'. This cannot be undone." / Confirm: "Delete" / Cancel: "Cancel" |
| Refresh toast (success) | "Dashboard refreshed" |
| Refresh toast (failure) | "Refresh failed: {error}. Showing cached data." |
| Picker: no charts | "No charts found" |
| Picker: no KPIs | "No KPIs found" |
| Picker: no datasets | "No datasets found" |
| Picker: add CTA | "Add to Dashboard" |
| Filter bar: Apply | "Apply" |
| Filter bar: Reset | "Reset" |
| Cross-filter bar: label | "Filtered by:" |
| Cross-filter bar: clear | "Clear all" |
| Drill breadcrumb root | "Overview" |
| Builder empty state | SVG blueprint illustration (already exists, no changes) |

---

## Interaction States

| Component | Default | Hover | Active/Selected | Disabled | Loading |
|-----------|---------|-------|-----------------|----------|---------|
| Dashboard card | `bg-card border` + `border-l-2 border-l-primary` | `y: -2`, `shadow-lg shadow-primary/5`, `border-primary/20` | N/A (click navigates) | N/A | `Skeleton h-[140px]` |
| Dashboard row | `border bg-card` + `border-l-2 border-l-primary` | `border-primary/30`, `shadow-sm shadow-primary/5` | N/A (click navigates) | N/A | `Skeleton h-[56px]` |
| View toggle button | `variant="outline"` | Standard outline hover | Active view filled | N/A | N/A |
| Apply button | `variant="default"` (primary) | Standard primary hover | N/A | N/A | N/A |
| Reset button | `variant="outline"` | Standard outline hover | N/A | N/A | N/A |
| Refresh button | `variant="outline"` | Standard outline hover | N/A | `disabled` (refreshing) | `animate-spin` on RefreshCw icon |
| Chart toolbar button | `variant="ghost" size="icon"` | Standard ghost hover | N/A | N/A | N/A |
| Picker dialog card | `border rounded-lg p-3` | `border-primary/30 bg-accent/50` | `border-primary bg-primary/5` | N/A | `Skeleton h-[72px]` |
| Filter chip (builder) | `border bg-background px-2.5 py-1.5` | N/A (draggable) | `opacity-50` while dragging | N/A | N/A |
| Cross-filter chip | `Badge variant="secondary"` | X button: `bg-muted-foreground/20` | N/A | N/A | N/A |
| Delete button (card) | `opacity-0` (hidden) | `opacity-100`, `text-destructive bg-destructive/10` | N/A | `disabled` (deleting) | N/A |

---

## Dark Mode Contract

Every component and color token must work in both light and dark modes. Specific dark mode rules for Phase 6:

1. Dashboard card/row `border-l-primary` automatically adapts via CSS variable (oklch(0.488...) light / oklch(0.424...) dark).
2. KPI trend colors use explicit `dark:` variants: `text-green-600 dark:text-green-400` / `text-red-600 dark:text-red-400`. Never opacity modifiers for text.
3. KPI trend background uses `/10` opacity which works in both modes: `bg-green-500/10`, `bg-red-500/10`.
4. Card hover shadow: `hover:shadow-lg hover:shadow-primary/5` works in both modes (opacity-based).
5. Filter bar `bg-muted/50`, cross-filter bar `bg-muted/50`, chart toolbar `bg-background/80 backdrop-blur-sm` all auto-adapt via CSS variables.
6. Embed route `?theme=dark` applies `.dark` class to root, all components respond automatically.
7. No hardcoded hex colors anywhere in UI components. Chart rendering hex is resolved at runtime via `resolveColor()` from `chart-themes.ts`.

**Source:** CLAUDE.md dark mode rules, prior phase UI-SPEC dark mode contracts, memory note `feedback_dark_mode_contrast.md`.

---

## Style Constants Addition

No new style constant maps are needed for Phase 6. Dashboards use `border-l-primary` directly (not per-type categorized). Existing constants from `style-constants.ts` are consumed by charts and KPIs rendered within dashboards.

---

## Backend Pipeline Fix Contract

This section defines the visual impact of the backend pipeline fix (D-01 through D-04). The fix is architectural but has direct visual consequences:

| Before Fix | After Fix |
|-----------|-----------|
| Dashboards with user-created datasets show empty charts (404 from `/api/data-sources/{id}/query`) | Charts render with real data from Oracle via `recviz_datasets` + `recviz_connections` |
| Only seeded dashboards render correctly | Both seeded and user-created dashboards render correctly |
| Filter bar may fail to populate options (depends on data source resolution) | Filter options resolve through dataset columns |

The pipeline fix is the highest priority deliverable. All other polish is secondary.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | Badge, Breadcrumb, Button, Card, Checkbox, Command, Dialog, DropdownMenu, Empty, Input, Popover, ScrollArea, Select, Skeleton, Tabs, ToggleGroup, Tooltip | not required |
| Third-party | none | not applicable |

No new shadcn components are required for Phase 6. All UI is built from existing primitives plus `motion/react` wrappers.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
