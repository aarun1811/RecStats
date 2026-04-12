---
phase: 3
slug: datasets-page
status: draft
shadcn_initialized: true
preset: mist+blue (new-york style, mist base, blue accent)
created: 2026-04-12
---

# Phase 3 — UI Design Contract

> Visual and interaction contract for the Datasets page. Covers list page (card + row views with stagger animations), create/edit editor (SQL editor toolbar, run button state machine, preview panel with execution stats, column metadata grid with role/type badges), shared style constants extraction, and empty state motion. Continues the "Refined Command Center" aesthetic established in Phase 2.

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

**Source:** `frontend/components.json` -- inherited from Phase 1, unchanged in Phase 2, unchanged here.

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline padding, badge internal spacing |
| sm | 8px | Compact element spacing, icon-to-label gaps, card internal gaps |
| sm-lg | 12px | Section header padding (`px-3`), card padding (`p-3`), cell-padding |
| md | 16px | Default element spacing, card padding (`p-4`), form field gaps |
| lg | 24px | Page content `p-6`, section gaps, editor panel margins (`mx-6`) |
| xl | 32px | Layout gaps between major sections |
| 2xl | 48px | Major section breaks (unused in Phase 3) |
| 3xl | 64px | Page-level spacing (unused in Phase 3) |

Exceptions:
- Touch targets: All interactive buttons maintain minimum 32px height (`h-8`). The editor toolbar Run button uses `h-7` for compact fit within the toolbar chrome.
- Column metadata grid: Row height 36px (`--ag-row-height: 36px`), header height 40px (`--ag-header-height: 40px`) -- inherited from AG Grid token bridge in `index.css`.
- Split panel gap: `gap-4` (16px) between Preview and Column Metadata panels, matching `gap-4` grid convention.

**Source:** Phase 2 UI-SPEC spacing scale + CLAUDE.md Design & UX Principles.

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
| Card title | 14px | 600 (semibold) | 1.43 (~20px) | `text-sm font-semibold truncate` |
| Inline editor heading | 24px | 600 (semibold) | 1.2 | `text-2xl font-semibold tracking-tight` (native `<input>`) |
| Mono (column names) | 12px | 400 (regular) | 1.33 (~16px) | `text-xs font-mono` |
| Stat chip | 12px | 500 (medium) | 1.33 (~16px) | `text-xs font-medium` |
| Mode badge | 12px | 500 (medium) | 1.33 (~16px) | `text-xs font-medium` |

Font: `"Inter", system-ui, sans-serif` -- declared in `@layer base` body rule in `index.css`.

**Source:** Phase 2 UI-SPEC typography table + CLAUDE.md conventions. Section heading in Phase 3 uses `text-sm font-semibold tracking-tight` (existing pattern from dataset-editor section headers), not `text-lg font-medium`, because section headers sit inside dense panels (SQL Editor, Preview, Column Metadata), not standalone page sections.

---

## Color

### Inherited Global Palette

Phase 3 inherits the complete Mist+Blue palette from Phase 1. All colors consumed via CSS variables -- no hardcoded hex/rgb/hsl anywhere.

| Role | CSS Variable | Usage |
|------|-------------|-------|
| Dominant (60%) | `--background` | Page background, main content area |
| Secondary (30%) | `--card`, `--muted`, `--secondary` | Cards, section header bars (`bg-muted/30`), editor chrome |
| Accent (10%) | `--primary` (Blue) | "New Dataset" CTA, "Save Dataset"/"Save Changes" CTA, mode badge ("New"), Run button, focus rings |
| Destructive | `--destructive` | "Delete Dataset" button text, error state backgrounds, missing column badges |

Accent reserved for: "New Dataset" button, "Save Dataset"/"Save Changes" primary CTA, "New" mode badge, Run button, active view toggle state, focus rings on inputs. Never backgrounds larger than a button or badge.

### Phase 3 Semantic Colors

These use Tailwind utility classes (NOT custom CSS variables) for status/role/type badges:

#### Column Role Badge Colors

| Role | Background | Text |
|------|-----------|------|
| dimension | `bg-blue-100 dark:bg-blue-900/30` | `text-blue-700 dark:text-blue-400` |
| measure | `bg-emerald-100 dark:bg-emerald-900/30` | `text-emerald-700 dark:text-emerald-400` |
| time | `bg-amber-100 dark:bg-amber-900/30` | `text-amber-700 dark:text-amber-400` |
| none | `bg-gray-100 dark:bg-gray-800/30` | `text-gray-600 dark:text-gray-400` |

#### Column Type Badge Colors

| Type | Background | Text |
|------|-----------|------|
| string | `bg-slate-100 dark:bg-slate-800/30` | `text-slate-700 dark:text-slate-400` |
| number | `bg-violet-100 dark:bg-violet-900/30` | `text-violet-700 dark:text-violet-400` |
| date | `bg-amber-100 dark:bg-amber-900/30` | `text-amber-700 dark:text-amber-400` |
| currency | `bg-emerald-100 dark:bg-emerald-900/30` | `text-emerald-700 dark:text-emerald-400` |

#### Row Status Tints (Column Metadata Grid)

Replace the existing 4 hardcoded `rgba()`/`rgb()` values in `getRowStyle`:

| Status | Background | Border |
|--------|-----------|--------|
| new | `bg-green-50 dark:bg-green-950/20` | `border-l-2 border-l-green-500` |
| missing | `bg-red-50 dark:bg-red-950/20` | `border-l-2 border-l-red-500` |
| unchanged | (none) | (none) |

Implementation: Replace `getRowStyle` inline style objects with CSS classes applied via `cellClass`/`rowClass` or Tailwind utility row styling. The 4 current `rgba()` values (`rgba(127, 29, 29, 0.2)`, `rgb(254, 242, 242)`, `rgba(20, 83, 45, 0.2)`, `rgb(240, 253, 244)`) must be eliminated.

#### Database Backend Colors (inherited from Phase 2)

| Backend | Text Color |
|---------|-----------|
| oracle | `text-red-600 dark:text-red-400` |

#### SQL Rerun Banner (unchanged)

| Element | Style |
|---------|-------|
| Border | `border-amber-200 dark:border-amber-800` |
| Background | `bg-amber-50 dark:bg-amber-950/20` |
| Icon | `text-amber-600 dark:text-amber-400` |
| Text | `text-amber-700 dark:text-amber-400` |

**Source:** CONTEXT.md D-02, D-13, D-14, D-19, D-20.

---

## Layout Contract

### List Page Container

```
<motion.div className="p-6">
  <h1> ... </h1>   <!-- stagger: first -->
  <Toolbar />       <!-- stagger: second -->
  <Content />       <!-- stagger: third -->
</motion.div>
```

No `max-w` constraint -- list page uses full width within the app shell for card grid density.

### Editor Page Container

```
<div className="flex flex-col h-[calc(100vh-3.5rem)]">
  <Header />        <!-- px-6 pt-4 pb-4, shrink-0 -->
  <SqlEditor />     <!-- mx-6, rounded-lg border, shrink-0, h-[250px] -->
  <RerunBanner />   <!-- px-6, shrink-0 -->
  <SplitPanel />    <!-- flex gap-4, flex-1, min-h-0, px-6 pb-4 -->
</div>
```

The editor page uses full viewport height minus the top nav (3.5rem). Split panel: Preview (flex-1) | Column Metadata (w-[480px]).

### Grid/List View Grid

| View | Layout |
|------|--------|
| Grid | `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4` |
| List | `space-y-2` (stacked rows) |

**Source:** Existing codebase patterns, CONTEXT.md D-23.

---

## Component Inventory

### 1. Shared Style Constants (NEW -- `lib/style-constants.ts`)

**Decision:** D-18 -- Extract shared constants from `settings/data-source-card.tsx` into a shared module.

| Export | Type | Contents |
|--------|------|----------|
| `BACKEND_LABELS` | `Record<DatabaseBackend, string>` | `{ oracle: 'Oracle' }` |
| `BACKEND_COLORS` | `Record<DatabaseBackend, string>` | `{ oracle: 'text-red-600 dark:text-red-400' }` |
| `STATUS_STYLES` | `Record<ConnectionStatus, string>` | emerald/red/amber bg+text combinations |
| `STATUS_LABELS` | `Record<ConnectionStatus, string>` | Connected/Unreachable/Untested |
| `STATUS_BORDER_COLORS` | `Record<ConnectionStatus, string>` | border-l color classes |
| `COLUMN_ROLE_STYLES` | `Record<ColumnRole, string>` | blue/emerald/amber/gray badge classes |
| `COLUMN_ROLE_LABELS` | `Record<ColumnRole, string>` | Dimension/Measure/Time/None |
| `COLUMN_TYPE_STYLES` | `Record<ColumnDataType, string>` | slate/violet/amber/emerald badge classes |
| `COLUMN_TYPE_LABELS` | `Record<ColumnDataType, string>` | String/Number/Date/Currency |

After extraction, `settings/data-source-card.tsx` imports from `lib/style-constants.ts` instead of defining locally.

### 2. Dataset Card (ENHANCED -- Phase 2 treatment)

**Decision:** D-01, D-02 -- Mirror `DataSourceCard` visual treatment, add column role summary.

| Property | Current | Target |
|----------|---------|--------|
| Wrapper | Plain `Card` | `motion.div` with `whileHover={{ y: -2 }}` + `transition={{ duration: 0.15, ease: 'easeOut' }}` wrapping `Card` |
| Left border | None | `border-l-2` accent colored by database backend (`BACKEND_COLORS` via `BACKEND_BORDER_COLORS` map -- oracle = `border-l-red-500`) |
| Database icon | `Database` at `size-8`, bare | `Database` at `size-8`, wrapped in `bg-muted rounded-lg p-1.5` container |
| Column role summary | `{N} columns` plain text | Compact role pills: e.g. "3 measures . 2 dims" using `COLUMN_ROLE_STYLES` colors. Show role counts > 0 only. Falls back to "{N} columns" if no roles assigned. |
| Shadow/spacing | `transition-all hover:shadow-md hover:-translate-y-0.5 p-4` | Remove CSS hover transform (handled by motion.div), keep `p-4` |
| Stagger entrance | None | `motion.div` with `initial={{ opacity: 0, y: 8 }}`, `animate={{ opacity: 1, y: 0 }}`, `transition={{ delay: index * 0.05, duration: 0.2 }}` |

### 3. Dataset Row (ENHANCED -- Phase 2 treatment)

**Decision:** D-03 -- Mirror card treatment adapted to row layout.

| Property | Current | Target |
|----------|---------|--------|
| Wrapper | Plain `div` | `motion.div` with `whileHover={{ y: -1 }}` + `transition={{ duration: 0.15, ease: 'easeOut' }}` |
| Left border | None | `border-l-2` accent colored by database backend |
| Database icon | `Database` at `size-5`, bare | `Database` at `size-5`, wrapped in `bg-muted rounded-md p-1` container |
| Column role summary | `{N} cols` plain text | Compact inline role summary like cards |
| Stagger entrance | None | Same stagger pattern as cards: `delay: index * 0.05` |

### 4. View Toggle Crossfade (NEW animation)

**Decision:** D-05 -- Grid/list view toggle animated with crossfade.

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

### 5. Page Entrance Stagger (ENHANCED)

**Decision:** D-23 -- Upgrade from simple opacity fade to staggered entrance.

| Element | Delay | Animation |
|---------|-------|-----------|
| Page title (`h1`) | 0ms | `opacity: 0->1` |
| Toolbar | 50ms | `opacity: 0->1, y: 8->0` |
| Content area | 100ms | `opacity: 0->1, y: 8->0` |

Total: 200ms stagger with 200ms per element duration.

### 6. Empty State: No Datasets (ENHANCED)

**Decision:** D-21 -- Animated entrance on empty state.

| Element | Animation |
|---------|-----------|
| Icon (`Table2`) | `initial={{ scale: 0.8, opacity: 0 }}`, `animate={{ scale: 1, opacity: 0.4 }}`, duration 300ms, spring |
| Title + Description | `initial={{ opacity: 0, y: 4 }}`, `animate={{ opacity: 1, y: 0 }}`, delay 100ms, duration 200ms |
| CTA button | `initial={{ opacity: 0, y: 4 }}`, `animate={{ opacity: 1, y: 0 }}`, delay 200ms, duration 200ms. Single gentle scale pulse on entrance: `animate={{ scale: [1, 1.02, 1] }}`, delay 400ms, duration 600ms |

### 7. Empty State: Filtered No Results (ENHANCED)

**Decision:** D-07 -- Replace bare `<p>` with `Empty` component.

Replace:
```tsx
<p className="py-8 text-center text-sm text-muted-foreground">
  No datasets matching "{searchQuery}"
</p>
```

With:
```tsx
<Empty className="border rounded-lg">
  <EmptyHeader>
    <EmptyMedia variant="icon"><Search /></EmptyMedia>
    <EmptyTitle>No datasets matching "{searchQuery}"</EmptyTitle>
    <EmptyDescription>Try a different search term or clear your filters.</EmptyDescription>
  </EmptyHeader>
</Empty>
```

### 8. Editor Section Headers (ENHANCED)

**Decision:** D-08 -- Add icons and accent to section headers.

| Section | Icon | Accent |
|---------|------|--------|
| SQL Editor | `Code2` at `size-3.5` | `border-l-2 border-l-primary` on the header bar container |
| Preview | `Eye` at `size-3.5` | `border-l-2 border-l-primary` on the header bar container |
| Column Metadata | `Columns3` at `size-3.5` (already present) | `border-l-2 border-l-primary` on the header bar container |

Header bar pattern:
```
<div className="flex items-center px-3 h-9 border-b border-l-2 border-l-primary bg-muted/30 shrink-0">
  <Icon className="mr-1.5 size-3.5 text-muted-foreground" />
  <span className="text-sm font-semibold tracking-tight">Section Name</span>
</div>
```

### 9. Mode Badge (NEW)

**Decision:** D-09 -- Badge next to editor title area indicating create vs edit mode.

| Mode | Style | Text |
|------|-------|------|
| create | `bg-primary/10 text-primary border border-primary/20` | "New" |
| edit | `bg-muted text-muted-foreground border border-border` | "Editing" |

Placed inline next to the back button, using `Badge` with custom className overrides. Size: `h-5 px-2 text-xs font-medium`.

### 10. SQL Format Button (NEW)

**Decision:** D-10 -- Add Format button to SQL editor toolbar.

| Property | Specification |
|----------|--------------|
| Position | Left of Run button in SQL editor toolbar |
| Label | "Format" |
| Icon | `WandSparkles` at `size-3.5` |
| Variant | `outline` |
| Size | `h-7` (matches Run button) |
| Behavior | Formats current SQL text in-place. Implementation detail (library or regex) is at Claude's discretion. |

### 11. Run Button State Machine (ENHANCED)

**Decision:** D-11 -- Phase 2 connection-test-style animated state machine.

| State | Button | Result Area |
|-------|--------|-------------|
| **Idle** | `Play` icon + "Run Query", primary variant, `h-7` | Preview panel shows Play icon empty state |
| **Running** | `Loader2` spinning icon + "Executing...", disabled, pulse animation on button bg (`animate={{ opacity: [1, 0.7, 1] }}`, 1.5s loop) | Preview panel shows skeleton loading state |
| **Success** | Button reverts to Idle after 2s. During success: `CheckCircle2` green icon scales in (`initial={{ scale: 0 }}`, `animate={{ scale: 1 }}`, spring), "{N} rows in {X}s" text fades in | Preview panel slides in with `initial={{ opacity: 0, y: 8 }}`, `animate={{ opacity: 1, y: 0 }}` |
| **Error** | Button reverts to Idle. `XCircle` red icon with shake (`animate={{ x: [0, -4, 4, -4, 4, 0] }}`, 400ms), error summary text fades in | Error panel shows `pre` with `text-destructive bg-destructive/5 p-3 rounded-md` |

The success/error indicator appears as an inline element next to the Run button in the toolbar, auto-dismissing after 3 seconds.

### 12. Execution Stats Bar (NEW)

**Decision:** D-12 -- Stat chips in Preview section header.

| Chip | Format | Style |
|------|--------|-------|
| Row count | "{N} rows" | `text-xs font-medium bg-muted px-2 py-0.5 rounded-md` |
| Column count | "{N} columns" | Same |
| Execution time | "{X}s" | Same |

Chips placed right-aligned in the Preview header bar, separated by a middle dot or inline with `gap-2`. Replace the current plain `{rowCount} rows` text.

### 13. Column Metadata Grid Badges (ENHANCED)

**Decision:** D-13 -- Color-coded role and type badges in AG Grid cells.

#### Role Cell Renderer

Replace plain text with colored pill badges using `COLUMN_ROLE_STYLES`:

```
<span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium min-w-[60px] justify-center', COLUMN_ROLE_STYLES[role])}>
  {COLUMN_ROLE_LABELS[role]}
</span>
```

#### Type Cell Renderer

Same pattern using `COLUMN_TYPE_STYLES`:

```
<span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium min-w-[60px] justify-center', COLUMN_TYPE_STYLES[type])}>
  {COLUMN_TYPE_LABELS[type]}
</span>
```

### 14. Column Row Status Enhancement (ENHANCED)

**Decision:** D-14 -- Colored left-border + bg tint + strikethrough.

| Status | Left Border | Background | Name Style |
|--------|------------|------------|------------|
| new | `border-l-2 border-l-green-500` | `bg-green-50 dark:bg-green-950/20` | Normal |
| missing | `border-l-2 border-l-red-500` | `bg-red-50 dark:bg-red-950/20` | `line-through text-muted-foreground` |
| unchanged | None | None | Normal |

Implementation via AG Grid `getRowClass` callback returning Tailwind classes, replacing the current `getRowStyle` with inline `rgba()` values.

### 15. Discard All Missing Button (NEW)

**Decision:** D-15 -- Conditional destructive button in Column Metadata header.

| Property | Specification |
|----------|--------------|
| Position | Right side of Column Metadata section header bar |
| Visibility | Only appears when `columns.some(c => c.status === 'missing')` |
| Label | "Discard Missing" |
| Icon | `Trash2` at `size-3` |
| Variant | `destructive`, `size="sm"`, `h-6 text-[11px]` |
| Animation | `AnimatePresence` -- fades in/out when missing columns appear/disappear |
| Behavior | Removes all columns with `status === 'missing'` from the columns array |

### 16. Column Header Tooltips (NEW)

**Decision:** D-16 -- Info icon with tooltip on AG Grid column headers.

Each metadata column header (Type, Role, Aggregation, Format) gets a custom header component with an info icon (`Info` at `size-3`) that shows a tooltip on hover.

| Column | Tooltip Text |
|--------|-------------|
| Type | "Data type determines how values are parsed and formatted. Affects chart axis behavior." |
| Role | "Column role controls how the field is used in charts: dimensions group data, measures are aggregated." |
| Aggregation | "Default aggregation function applied when this column is used as a measure in charts." |
| Format | "Display format applied to cell values in grids and chart tooltips." |

Implementation via AG Grid `headerComponent` custom renderer with shadcn `Tooltip` wrapping the info icon.

### 17. Column Metadata Help Sheet (NEW)

**Decision:** D-17 -- Full help side panel.

| Property | Specification |
|----------|--------------|
| Trigger | `HelpCircle` icon button in Column Metadata header bar, `size="sm"`, `variant="ghost"`, `h-7` |
| Sheet side | `right` |
| Sheet width | `sm:max-w-lg` (512px) |
| Title | "Column Metadata Reference" |
| Description | "How each field affects charts, grids, and data behavior" |

#### Help Sheet Content Sections

Each section uses an icon + heading + content pattern:

| Section | Icon | Heading | Content |
|---------|------|---------|---------|
| Role | `Target` | "Column Role" | **Dimension**: Groups or categorizes data on chart axes. Used for labels, categories, and series groupings. **Measure**: Numeric values that get aggregated (summed, averaged, etc.). Used for chart values, KPI calculations. **Time**: Date/time columns used for time-series axes. Enables date range filtering. **None**: Column is stored but not used in charts or KPIs. |
| Type | `Type` | "Data Type" | **String**: Text values. Displayed as-is. **Number**: Numeric values. Can be formatted with separators, decimals. **Date**: Date/datetime values. Parsed for time-series. **Currency**: Monetary values. Formatted with currency symbol. |
| Aggregation | `Calculator` | "Aggregation" | **NONE**: No aggregation. **SUM/AVG/COUNT/MIN/MAX**: Standard SQL aggregates. **COUNT_DISTINCT**: Unique value count. Applied when the column role is "measure" and the chart groups by a dimension. |
| Format | `Paintbrush` | "Format Presets" | Table of presets with live examples: None (--), Number (1,234), Currency ($1,234.56), Percentage (85.3%), Decimal 2 (1,234.56), Date (Apr 06), DateTime (Apr 06 14:30), Custom (user-defined pattern). |

Sheet content sections animate in with 50ms stagger (same pattern as Phase 2 sheet stagger).

### 18. Editor Empty States (ENHANCED)

**Decision:** D-22 -- Subtle idle animations on editor empty states.

| Empty State | Icon | Animation |
|-------------|------|-----------|
| Preview: "Run a query to see results" | `Play` at `size-10` | Gentle pulse: `animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.4, 0.3] }}`, duration 3s, infinite, ease-in-out |
| Column Metadata: "Run a query to detect columns" | `Columns3` at `size-10` | Gentle shimmer: same pulse pattern, 3s infinite |

Text below icons: `text-sm text-muted-foreground`.

---

## Copywriting Contract

| Element | Copy | Notes |
|---------|------|-------|
| **List Page** | | |
| Page title | "Datasets" | `text-2xl font-semibold tracking-tight`, already exists |
| Primary CTA | "New Dataset" | Toolbar button with `Plus` icon, primary variant |
| Search placeholder | "Search datasets..." | Already exists, unchanged |
| Database filter default | "All databases" | Already exists, unchanged |
| Empty state heading | "No datasets yet" | Already exists, unchanged |
| Empty state body | "Create your first dataset to start building charts. Write SQL, configure column metadata, and publish." | Already exists, unchanged |
| Empty state CTA | "Create Dataset" | Primary button, already exists |
| Filtered empty heading | "No datasets matching \"{query}\"" | Upgraded to `Empty` component |
| Filtered empty body | "Try a different search term or clear your filters." | NEW -- added as `EmptyDescription` |
| **Editor Page** | | |
| Mode badge (create) | "New" | Primary accent badge |
| Mode badge (edit) | "Editing" | Muted badge |
| Back button | "Back" | Ghost button with `ArrowLeft` icon |
| Name placeholder | "Untitled Dataset" | Inline editable heading |
| Description placeholder | "Add a description..." | Input field |
| Database selector placeholder | "Select database" | Select component |
| SQL Editor header | "SQL Editor" | Section header with `Code2` icon |
| Format button | "Format" | Outline button with `WandSparkles` icon |
| Run button (idle) | "Run Query" | Primary button with `Play` icon |
| Run button (running) | "Executing..." | Disabled, `Loader2` spinning |
| Run success | "{N} rows in {X}s" | Green `CheckCircle2` icon + text, auto-dismiss 3s |
| Run error | "{error summary}" | Red `XCircle` icon + truncated error, auto-dismiss 5s |
| Keyboard hint | "{Cmd/Ctrl} + Enter to run" | `Kbd` components, `text-xs text-muted-foreground` |
| Preview header | "Preview" | Section header with `Eye` icon |
| Preview empty | "Run a query to see results" | Animated Play icon |
| Preview toggle | "Show Formatted" / "Show Raw" | Outline button toggling format display |
| Stats chip: rows | "{N} rows" | `text-xs font-medium` chip |
| Stats chip: columns | "{N} columns" | `text-xs font-medium` chip |
| Stats chip: time | "{X}s" | `text-xs font-medium` chip |
| Column Metadata header | "Column Metadata" | Section header with `Columns3` icon |
| Column Metadata empty | "Run a query to detect columns" | Animated Columns3 icon |
| Discard missing button | "Discard Missing" | Destructive sm button, conditional |
| Help button | (icon only) `HelpCircle` | `aria-label="Column metadata reference"` |
| Help sheet title | "Column Metadata Reference" | Sheet title |
| Help sheet description | "How each field affects charts, grids, and data behavior" | Sheet description |
| Save button (create) | "Save Dataset" | Primary with `Save` icon |
| Save button (edit) | "Save Changes" | Primary with `Save` icon |
| SQL rerun banner | "SQL has changed. Run the query to update columns and preview." | Amber banner with `AlertTriangle` icon, already exists |
| **Destructive: Delete Dataset** | | |
| Trigger | "Delete Dataset" | Ghost destructive button with `Trash2` icon, editor header |
| Dialog title (can delete) | "Delete \"{name}\"?" | Dialog header |
| Dialog body (can delete) | "This will permanently remove the dataset and its column metadata. This cannot be undone." | Already exists |
| Confirm button | "Delete Dataset" | Destructive variant |
| Cancel button | "Keep Dataset" | Outline variant |
| Dialog title (blocked) | "Cannot delete \"{name}\"" | When charts reference the dataset |
| Dialog body (blocked) | "This dataset is referenced by the following charts. Remove chart references first:" | Already exists |
| Delete success toast | "Dataset \"{name}\" deleted" | Sonner success |
| **Toast Messages** | | |
| Create success | "Dataset \"{name}\" created" | Sonner success |
| Update success | "Dataset \"{name}\" updated" | Sonner success |
| Name required | "Please enter a dataset name" | Sonner error |
| Database required | "Please select a database" | Sonner error |

---

## Animation Timing Reference

All animations use `motion/react`. Timings follow the "Refined Command Center" aesthetic -- fast and precise.

| Animation | Duration | Easing | Notes |
|-----------|----------|--------|-------|
| Page entrance stagger | 200ms total | `ease-out`, stagger 50ms | Title -> Toolbar -> Content |
| Card stagger entrance | 200ms per card | `ease-out`, stagger 50ms | `opacity: 0->1, y: 8->0` |
| Card hover lift | 150ms | `ease-out` | `y: 0 -> -2` |
| Row hover lift | 150ms | `ease-out` | `y: 0 -> -1` |
| View crossfade | 200ms | `ease-out` | `AnimatePresence mode="wait"` |
| Empty state icon entrance | 300ms | spring: stiffness 300, damping 20 | `scale: 0.8->1, opacity: 0->0.4` |
| Empty state text entrance | 200ms | `ease-out`, delay 100ms | `opacity: 0->1, y: 4->0` |
| Empty state CTA pulse | 600ms | `ease-in-out`, delay 400ms | `scale: [1, 1.02, 1]`, once |
| Editor empty state pulse | 3000ms | `ease-in-out`, infinite | `scale: [1, 1.05, 1], opacity: [0.3, 0.4, 0.3]` |
| Run button pulse (running) | 1500ms | `ease-in-out`, infinite | `opacity: [1, 0.7, 1]` |
| Run success icon | 400ms | spring: stiffness 300, damping 20 | `scale: 0->1` |
| Run error shake | 400ms | `linear` | `x: [0, -4, 4, -4, 4, 0]` |
| Run result text fade-in | 200ms | `ease-out`, delay 150ms | `opacity: 0->1, x: -8->0` |
| Result area entrance | 250ms | `ease-out` | `opacity: 0->1, y: 8->0` |
| SQL rerun banner | 200ms | `ease-out` | `opacity: 0->1, height: 0->auto` (existing) |
| Discard Missing btn appear | 200ms | `ease-out` | `opacity: 0->1, scale: 0.95->1` |
| Help sheet content stagger | 250ms total | `ease-out`, stagger 50ms | Each section fades + slides up |
| Run result auto-dismiss | 3000ms (success), 5000ms (error) | -- | Fade out over 200ms |

---

## File Impact Summary

### New Files

| File | Purpose |
|------|---------|
| `frontend/src/lib/style-constants.ts` | Shared style maps: backend colors/labels, status styles, column role/type styles |
| `frontend/src/components/datasets/column-header-with-tooltip.tsx` | AG Grid custom header component with info icon tooltip |
| `frontend/src/components/datasets/column-metadata-help-sheet.tsx` | Right-side Sheet with comprehensive field reference |
| `frontend/src/components/datasets/role-badge-renderer.tsx` | AG Grid cell renderer for color-coded role badges |
| `frontend/src/components/datasets/type-badge-renderer.tsx` | AG Grid cell renderer for color-coded type badges |

### Modified Files

| File | Changes |
|------|---------|
| `frontend/src/components/datasets/dataset-card.tsx` | Wrap in `motion.div` hover lift, add `border-l-2` backend accent, wrap icon in `bg-muted` container, add column role summary pills, accept `index` prop for stagger |
| `frontend/src/components/datasets/dataset-row.tsx` | Wrap in `motion.div` hover lift, add `border-l-2` backend accent, wrap icon in `bg-muted` container, add role summary, accept `index` prop for stagger |
| `frontend/src/components/datasets/dataset-list.tsx` | Add `AnimatePresence mode="wait"` crossfade for view toggle, pass `index` to cards/rows for stagger, replace filtered-empty `<p>` with `Empty` component, add `Search` icon import |
| `frontend/src/components/datasets/dataset-list-toolbar.tsx` | Apply palette tokens matching Phase 2 toolbar style (already mostly correct, minor class tuning) |
| `frontend/src/components/datasets/dataset-editor.tsx` | Add mode badge, enhance section headers with icons + `border-l-primary`, add execution stats bar to Preview header, add Format button to toolbar area, implement run button state machine, add Discard Missing button, add Help Sheet trigger, replace `getRowStyle` rgba values |
| `frontend/src/components/datasets/column-metadata-grid.tsx` | Replace `getRowStyle` inline rgba with CSS class approach, add custom cell renderers for role/type badges, add custom header components with tooltips, add left-border + strikethrough for missing rows |
| `frontend/src/components/datasets/dataset-sql-rerun-banner.tsx` | No changes (already correctly styled with amber dark: variants) |
| `frontend/src/components/datasets/delete-dataset-dialog.tsx` | No changes (already uses shadcn Dialog correctly) |
| `frontend/src/components/explorer/sql-editor.tsx` | Add Format button to toolbar (between keyboard hint and Run button), accept optional `onFormat` callback prop |
| `frontend/src/routes/_app/datasets/index.tsx` | Replace simple opacity fade with staggered page entrance |
| `frontend/src/routes/_app/datasets/new.tsx` | Same staggered entrance pattern |
| `frontend/src/routes/_app/datasets/$datasetId.edit.tsx` | Same staggered entrance pattern |
| `frontend/src/components/settings/data-source-card.tsx` | Remove local `BACKEND_COLORS`, `BACKEND_LABELS`, `STATUS_STYLES`, `STATUS_LABELS`, `STATUS_BORDER_COLORS` definitions; re-export from `lib/style-constants.ts` |

### Unchanged Files

| File | Reason |
|------|--------|
| `frontend/src/components/datasets/format-preset-select.tsx` | Already well-composed, unchanged |
| `frontend/src/index.css` | No new CSS variables needed for Phase 3 |
| All `frontend/src/components/ui/*` files | Extend via composition, never modify ui/ files |
| `frontend/src/types/managed-dataset.ts` | Types unchanged |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | No new components added in Phase 3 | not required |

All required shadcn components already exist in `frontend/src/components/ui/`: `Card`, `Badge`, `Button`, `Input`, `Select`, `Skeleton`, `Empty`, `Sheet`, `ToggleGroup`, `Tooltip`, `Dialog`. The `Tooltip` component is needed for column header tooltips -- verify it exists in `ui/` before implementation; if missing, install via `npx shadcn add tooltip`.

No third-party registries declared.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
