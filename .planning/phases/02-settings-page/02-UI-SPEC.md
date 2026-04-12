---
phase: 2
slug: settings-page
status: draft
shadcn_initialized: true
preset: mist+blue (new-york style, mist base, blue accent)
created: 2026-04-12
---

# Phase 2 — UI Design Contract

> Visual and interaction contract for the Settings page. Covers three tabs (Appearance, Saved Views, Data Sources), the display-store Zustand integration, theme preview cards with live mockups, animated status badges, connection test state machine, and detail panel enhancements. "Refined Command Center" aesthetic — precision instrument feel, not playful.

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

**Source:** `frontend/components.json` — new-york style, mist baseColor, lucide icons, cssVariables enabled. Phase 1 UI-SPEC established these values.

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline padding, status badge internal padding |
| sm | 8px | Compact element spacing, icon-to-label gaps, toggle button gaps, badge horizontal padding |
| sm-lg | 12px | Tight component internals: theme preview card padding (`p-3`), test area container padding, info grid gap-x, cell-padding (comfortable density) |
| md | 16px | Default element spacing, card padding, form field gaps |
| lg | 24px | Section padding, page content `p-6`, card internal sections |
| xl | 32px | Layout gaps between major sections |
| 2xl | 48px | Major section breaks (unused in Phase 2) |
| 3xl | 64px | Page-level spacing (unused in Phase 2) |

Exceptions:
- Touch targets: All interactive buttons maintain minimum 32px height (`h-8`). The `size="sm"` variant already satisfies this.

**Source:** Phase 1 UI-SPEC spacing scale + CLAUDE.md Design & UX Principles (`p-6` for pages, `gap-6` for section gaps, `gap-4` for grid gaps).

---

## Typography

4 sizes, 2 weights:

| Role | Size | Weight | Line Height | Tailwind Class |
|------|------|--------|-------------|----------------|
| Page title | 24px | 600 (semibold) | 1.2 (~29px) | `text-2xl font-semibold tracking-tight` |
| Section heading | 18px | 500 (medium) | 1.33 (~24px) | `text-lg font-medium` |
| Body | 14px | 400 (regular) | 1.43 (~20px) | `text-sm` |
| Label / Caption | 12px | 400 (regular) | 1.33 (~16px) | `text-xs text-muted-foreground` |

Supplemental role (not a 5th size — uses Body size with different weight):

| Role | Size | Weight | Line Height | Tailwind Class |
|------|------|--------|-------------|----------------|
| Card title | 14px | 500 (medium) | 1.43 (~20px) | `text-sm font-medium` |
| Mono (columns, URIs) | 12px | 400 (regular) | 1.33 (~16px) | `text-xs font-mono` |

Font: `"Inter", system-ui, sans-serif` — declared in `@layer base` body rule in `index.css`.

**Source:** Phase 1 UI-SPEC typography table + CLAUDE.md conventions. The "Card title" role uses 14px (Body size) with `font-medium` to create hierarchy through weight, not through a 5th size.

---

## Color

### Inherited Global Palette

Phase 2 inherits the complete Mist+Blue palette from Phase 1. All colors are consumed via CSS variables — no hardcoded hex/rgb/hsl anywhere.

| Role | CSS Variable | Usage |
|------|-------------|-------|
| Dominant (60%) | `--background` | Page background, main content area |
| Secondary (30%) | `--card`, `--sidebar`, `--muted`, `--secondary` | Cards, sidebar, tab content areas, muted sections |
| Accent (10%) | `--primary` (Blue) | Primary CTA buttons, active tab indicator, selected theme card border, focus rings, toggle-on state |
| Destructive | `--destructive` | Delete button text/bg, error states |

Accent reserved for: "Add Source" button, "Save Connection"/"Update" primary CTA, active tab underline, selected theme preview card border, selected density/font-size toggle active state, focus rings on form inputs. Never used for backgrounds larger than a button or badge.

### Phase 2 Status Colors

Data source connection status uses semantic badge styling — NOT the tiny 2px dot. These are Tailwind utility combinations applied to Badge components:

| Status | Badge Background | Badge Text | Left Border | Pulse |
|--------|-----------------|------------|-------------|-------|
| Connected | `bg-emerald-100 dark:bg-emerald-900/30` | `text-emerald-700 dark:text-emerald-400` | `border-l-emerald-500` | Subtle pulse via `motion/react` (1.5s infinite, opacity 0.6-1.0) |
| Unreachable | `bg-red-100 dark:bg-red-900/30` | `text-red-700 dark:text-red-400` | `border-l-red-500` | No pulse (static) |
| Untested | `bg-amber-100 dark:bg-amber-900/30` | `text-amber-700 dark:text-amber-400` | `border-l-amber-500` | No pulse (static) |

**Source:** CONTEXT.md D-07 (animated status badge), D-16 (Shadcn CSS variable colors only). Status colors follow CLAUDE.md pattern of `text-green-600 dark:text-green-400` for semantic utility colors.

---

## Layout Contract

### Page Container

**Current:** `max-w-3xl` (768px) — wastes 40%+ of viewport on large screens.
**Target:** `max-w-5xl` (~1024px), centered via `mx-auto`. Provides breathing room for 3-column data source grid and wider theme preview cards.

```
<div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
```

**Source:** CONTEXT.md D-04.

### Tab Layout

Tabs component uses shadcn `Tabs` with `motion/react` content transitions. Each tab content area animates in with a horizontal slide + fade on switch.

| Property | Value |
|----------|-------|
| Tab bar | `TabsList` — full width of container, not shrink-wrapped |
| Tab icons | 14px (`size-3.5`) Lucide icons: `Palette`, `BookmarkCheck`, `Server` |
| Active indicator | shadcn default underline (primary color) |
| Content transition | `motion/react` `AnimatePresence` + `motion.div` — `x: 8 -> 0`, `opacity: 0 -> 1`, duration 200ms, ease `[0.25, 0.46, 0.45, 0.94]` |

### Focal Points Per Tab

| Tab | Focal Point | Why |
|-----|------------|-----|
| Appearance | Theme preview cards (Light/Dark/System) | Only interactive decision on this tab; user eyes go here first |
| Saved Views | The view list (or empty state) | This tab is a content list; the list IS the focal point |
| Data Sources | Data source card grid (or empty state CTA) | The cards are the entry point to all CRUD operations |

**Source:** CONTEXT.md D-05.

---

## Component Inventory

### 1. Theme Preview Cards (NEW — replaces plain icon+text buttons)

**Decision:** D-06 — Live preview cards showing mini-mockup of the RecViz UI in each theme.

| Property | Specification |
|----------|--------------|
| Card size | ~160px wide, ~120px tall, `rounded-lg` |
| Layout | Stacked: mini-mockup (top 80%), label (bottom 20%) |
| Mini-mockup | CSS-drawn (no SVG): sidebar strip (12px wide, left), header strip (top 8px), content area with 2 placeholder rectangles |
| Light card mockup | Sidebar: `bg-muted`, header: `bg-card`, content: `bg-background`, rectangles: `bg-muted` |
| Dark card mockup | Sidebar: `bg-zinc-800`, header: `bg-zinc-900`, content: `bg-zinc-950`, rectangles: `bg-zinc-800` |
| System card mockup | Split diagonal — left half light, right half dark (CSS `clip-path`) |
| Selected state | `border-2 border-primary`, `bg-primary/5` background tint |
| Unselected state | `border-2 border-muted`, `hover:border-muted-foreground/30` |
| Selection animation | `motion/react` `layoutId` on border highlight — border color morphs via spring transition, `duration: 0.3`, `type: "spring"`, `stiffness: 500`, `damping: 30` |
| Label | `text-sm font-medium` centered below mockup. Active: `text-primary`. Inactive: `text-muted-foreground` |
| Icon | Lucide `Sun`/`Moon`/`Monitor` at `size-4`, positioned top-right of mockup as a subtle badge overlay |

### 2. Display Controls (NEW — Density + Font Size, was dead stubs)

**Decision:** D-01, D-02, D-03 — Functional controls backed by `display-store.ts` Zustand store.

#### Zustand Store: `display-store.ts`

```typescript
interface DisplayStore {
  density: 'comfortable' | 'compact'
  fontSize: 'small' | 'medium' | 'large'
  setDensity: (d: 'comfortable' | 'compact') => void
  setFontSize: (s: 'small' | 'medium' | 'large') => void
}
```

Persisted to `localStorage` key `recviz-display`. On init, reads localStorage and writes CSS variables to `:root`.

#### CSS Variables Written by Store

| Variable | Comfortable | Compact |
|----------|-------------|---------|
| `--spacing-scale` | `1` | `0.85` |
| `--row-height` | `36px` | `28px` |
| `--cell-padding` | `12px` | `8px` |

| Variable | Small | Medium | Large |
|----------|-------|--------|-------|
| `--font-scale` | `0.875` | `1` | `1.125` |
| `--base-font-size` | `12.25px` | `14px` | `15.75px` |

#### Toggle UI

| Property | Specification |
|----------|--------------|
| Container | `Card` with card title "Display" (`text-sm font-medium`) and `CardDescription` "Density and font size preferences" |
| Density row | `flex items-center justify-between` — Label left, toggle group right |
| Font size row | Same layout, separated by `Separator` |
| Toggle style | `ToggleGroup` with `variant="outline"` `size="sm"` — matches the grid/list toggle in DataSourcesToolbar |
| Active toggle | `variant="outline"` with `data-state="on"` styles (shadcn default: primary ring + subtle bg) |
| Transition | `motion/react` on CSS variable change — body applies `transition: font-size 200ms ease, line-height 200ms ease` |

### 3. Data Source Card (ENHANCED — was plain card with tiny status dot)

**Decision:** D-07 — Animated status badge with pulse + left border color.

| Property | Current | Target |
|----------|---------|--------|
| Status indicator | `size-2` dot + `text-[10px]` label | Full `Badge` component with status text + optional pulse |
| Left border | None | `border-l-2` with status color (emerald/red/amber) |
| Card padding | `p-4` | `p-4` (unchanged) |
| Hover | `hover:shadow-md hover:-translate-y-0.5` | Keep existing, enhance with `motion/react` `whileHover={{ y: -2, transition: { duration: 0.15 } }}` |
| Database icon | `Database` at `size-8` | Keep `size-8`, but wrap with subtle `bg-muted rounded-lg p-1.5` container |
| Backend label | Plain `text-xs text-muted-foreground` | Keep as-is |
| Name | `text-sm font-medium truncate` | Keep as-is |

#### Animated Status Badge Component

```
<AnimatedStatusBadge status={database.status} />
```

| Status | Render |
|--------|--------|
| Connected | `<Badge>` with emerald colors + `motion.span` pulse dot (1.5s loop, scale 1.0-1.4, opacity 0.6-1.0) next to "Connected" text |
| Unreachable | `<Badge>` with red colors, static red dot, "Unreachable" text |
| Untested | `<Badge>` with amber colors, static amber dot, "Untested" text |

Badge dimensions: height 20px (`h-5`), `text-[10px] font-medium`, `px-2`, `rounded-full`.

### 4. Data Source Row (ENHANCED — list view equivalent)

Same status badge treatment as the card. Replace `StatusDot` with `AnimatedStatusBadge`. Add `border-l-2` with status color.

### 5. Connection Test State Machine (ENHANCED — was plain spinner + text)

**Decision:** D-08 — Animated state machine: Idle -> Testing -> Success/Failure.

#### States and Transitions

| State | Visual | Animation |
|-------|--------|-----------|
| **Idle** | "Test Connection" button with `Plug` icon, neutral outline style | Static, no animation |
| **Testing** | Button disabled, text changes to "Connecting...", entire test area shows a pulsing connection indicator | `motion/react` — button icon replaced with animated bars (3 vertical bars scaling sequentially, `scaleY: [0.4, 1, 0.4]`, stagger 0.1s, loop). Test area background pulses `bg-muted/30` -> `bg-muted/60` over 1.5s |
| **Success** | Green check icon scales in (from 0 to 1, spring), "Connected in {N}s" fades in, test area border briefly flashes emerald | `motion/react` — `CheckCircle2` icon: `initial={{ scale: 0, rotate: -90 }}`, `animate={{ scale: 1, rotate: 0 }}`, `transition={{ type: "spring", stiffness: 300, damping: 20 }}`. Text: `initial={{ opacity: 0, x: -8 }}`, `animate={{ opacity: 1, x: 0 }}`, `delay: 0.15` |
| **Failure** | Red X icon with horizontal shake, error message fades in, test area border briefly flashes red | `motion/react` — `XCircle` icon: `animate={{ x: [0, -4, 4, -4, 4, 0] }}`, `transition={{ duration: 0.4 }}`. Text: `initial={{ opacity: 0, x: -8 }}`, `animate={{ opacity: 1, x: 0 }}`, `delay: 0.15` |

#### Test Area Container

Wrap the test button + result in a container div with a subtle border and rounded corners:

```
<div className="rounded-lg border p-3 space-y-2">
  <div className="flex items-center gap-3">
    {/* Test button + result */}
  </div>
</div>
```

The container border color briefly animates on result:
- Success: border flashes `border-emerald-500/50` for 600ms, then fades back to `border`
- Failure: border flashes `border-red-500/50` for 600ms, then fades back to `border`

### 6. Detail Panel Connection Health Header (NEW)

**Decision:** D-09 — Top of panel shows connection health summary.

| Property | Specification |
|----------|--------------|
| Position | Below `SheetHeader`, above Datasets section |
| Layout | `rounded-lg border p-4 space-y-3` |
| Row 1 | `AnimatedStatusBadge` (large variant, `h-6 text-xs`) + "Last tested: {relative time}" caption |
| Row 2 | 2-column info grid using `dl` pattern |

#### Info Grid Fields

| Field | Label | Value Source | Display |
|-------|-------|-------------|---------|
| Host | "Host" | `databaseDetail` (not directly exposed — derive from stored connection, or show "Configured" if unavailable) | `text-sm font-mono` |
| Port | "Port" | Same | `text-sm font-mono` |
| Service | "Service Name" | Same | `text-sm font-mono` |
| Schema | "Schema" | Same | `text-sm font-mono` |

Info grid styling:
```
<div className="grid grid-cols-2 gap-x-3 gap-y-2">
  <div>
    <dt className="text-xs text-muted-foreground">Host</dt>
    <dd className="text-sm font-mono truncate">{value}</dd>
  </div>
  ...
</div>
```

**Note (D-10):** Dataset list uses stored metadata only (name, column count). NO live row-count queries. No expensive queries on panel open.

### 7. Sheet Open/Close Animation (ENHANCED)

**Decision:** D-17 — Premium micro-interactions on sheet.

The shadcn Sheet already animates via CSS. Enhance with `motion/react` for the content inside:

| Element | Animation |
|---------|-----------|
| Sheet content children | `motion.div` stagger: each section (`header`, `health`, `datasets`, `test`, `footer`) fades + slides up with 50ms stagger. `initial={{ opacity: 0, y: 12 }}`, `animate={{ opacity: 1, y: 0 }}`, duration 250ms |
| Mode switch (detail -> edit) | Cross-fade: outgoing fades out 150ms, incoming fades in 200ms with 50ms delay |

### 8. Form Focus Animation (ENHANCED)

**Decision:** D-17 — Premium micro-interactions on forms.

| Element | Animation |
|---------|-----------|
| Input focus | Already handled by `index.css` `@layer components` transition rule. Add `ring-2 ring-ring/20` on focus for subtle glow beyond the default border change |
| Form validation | Required fields that are empty on blur: brief red flash on border (`border-destructive/50` for 300ms, then back to `border-input`) — visual nudge, not persistent error state |

---

## Copywriting Contract

| Element | Copy | Notes |
|---------|------|-------|
| Page title | "Settings" | Already exists, unchanged |
| Page subtitle | "Manage preferences, saved views, and data sources" | Already exists, unchanged |
| **Appearance Tab** | | **Focal point: Theme preview cards** |
| Theme card title | "Theme" | `text-sm font-medium` (card title role) |
| Theme card description | "Choose between light, dark, or system theme" | Card description |
| Theme option labels | "Light", "Dark", "System" | Below each preview card |
| Display card title | "Display" | `text-sm font-medium` (card title role) |
| Display card description | "Density and font size preferences" | Card description |
| Density label | "Density" | Left side |
| Density options | "Comfortable", "Compact" | Toggle buttons |
| Font size label | "Font Size" | Left side |
| Font size options | "Small", "Medium", "Large" | Toggle buttons |
| **Saved Views Tab** | | **Focal point: View list or empty state** |
| Card title | "Saved Views" | `text-sm font-medium` (card title role) |
| Card description | "Filter + layout combinations you've saved from dashboards" | Already exists |
| Empty state icon | `BookmarkCheck` at `size-10`, `opacity-40` | Already exists |
| Empty state heading | "No saved views yet" | Already exists, unchanged |
| Empty state body | "Use the \"Save View\" button on any dashboard to save your current filters." | Already exists, unchanged |
| Load button | "Load View" | Small outline button with `ExternalLink` icon |
| Delete button | (icon only) `Trash2` | Ghost button, muted -> destructive on hover. `aria-label="Delete {view name}"` required for accessibility |
| **Data Sources Tab** | | **Focal point: Card grid or empty state CTA** |
| Card title | "Configured Data Sources" | `text-sm font-medium` (card title role) |
| Card description | "Manage database connections" | Already exists |
| Primary CTA | "Add Source" | Toolbar button with `Plus` icon. Blue primary. |
| Search placeholder | "Search databases..." | Already exists |
| Empty state heading | "No data sources configured" | Already exists |
| Empty state body | "Add your first database connection to start querying data." | Already exists |
| Empty state CTA | "Add Data Source" | Primary button inside empty state |
| Search no results | "No databases matching \"{query}\"" | Already exists |
| **Data Source Sheet — Create** | | |
| Sheet title | "Add Data Source" | Already exists |
| Sheet description | "Configure a new database connection" | Already exists |
| Test button — Idle | "Test Connection" | Outline button |
| Test button — Testing | "Connecting..." | Button disabled, animated bars icon |
| Test — Success | "Connected in {N}s" | Green check icon + text |
| Test — Failure | "{error message}" | Red X icon + error text from backend |
| Save button | "Save Connection" | Primary, disabled until test passes |
| Cancel button | "Discard" | Outline. Alternative: omit entirely and rely on Sheet's X close button |
| **Data Source Sheet — Edit** | | |
| Sheet title | "Edit Data Source" | Already exists |
| Sheet description | "Update connection details" | Already exists |
| Password placeholder | "Leave blank to keep current" | Already exists for edit mode |
| Update button | "Update" | Primary |
| **Data Source Sheet — Detail** | | |
| Datasets section title | "Datasets ({loaded} of {total})" | Already exists |
| Sync button | "Sync Datasets" | Outline with `RefreshCw` icon |
| Datasets empty | "No datasets found. Click Sync to refresh." | Already exists |
| Load more | "Load more..." | Ghost button |
| Column load error | "Failed to load columns" | Destructive text |
| No columns | "No columns" | Italic muted text |
| Edit button | "Edit Source" | Outline with `Pencil` icon |
| **Destructive: Delete Data Source** | | |
| Trigger | "Delete" button in detail panel footer | Ghost with destructive text styling |
| Confirmation | `window.confirm('Delete "{name}"? This cannot be undone.')` | Browser native confirm dialog (existing pattern — no custom modal needed this phase) |
| Success toast | `Deleted "{name}"` | Sonner success toast |
| Failure toast | "Failed to delete data source" | Sonner error toast |
| **Destructive: Delete Saved View** | | |
| Trigger | Trash icon button on saved view row | Ghost, muted -> destructive hover. `aria-label="Delete {view name}"` |
| Confirmation | None (instant delete, existing pattern) | Success toast: `Deleted "{name}"` |
| **Toast Messages** | | |
| Create success | `Created "{name}"` | Sonner success |
| Create failure | "Failed to create data source" | Sonner error |
| Update success | `Updated "{name}"` | Sonner success |
| Update failure | "Failed to update data source" | Sonner error |
| Sync success | "Datasets refreshed" | Sonner success |
| Sync failure | "Failed to sync datasets" | Sonner error |

---

## Animation Timing Reference

All animations use `motion/react`. Timings follow the "Refined Command Center" aesthetic — fast and precise, never bouncy or playful.

| Animation | Duration | Easing | Notes |
|-----------|----------|--------|-------|
| Tab content switch | 200ms | `[0.25, 0.46, 0.45, 0.94]` | Horizontal slide + fade |
| Theme card selection border | 300ms | `spring: stiffness 500, damping 30` | `layoutId` shared border |
| Status badge pulse | 1500ms | `ease-in-out`, infinite | Scale 1.0-1.4, opacity 0.6-1.0 on pulse dot |
| Connection test bars | 800ms per loop | `ease-in-out`, stagger 100ms, infinite | 3 bars scaling vertically |
| Connection success icon | 400ms | `spring: stiffness 300, damping 20` | Scale 0->1, rotate -90->0 |
| Connection failure shake | 400ms | `linear` | x: [0, -4, 4, -4, 4, 0] |
| Result text fade-in | 200ms | `ease-out`, delay 150ms | Opacity 0->1, x: -8->0 |
| Border flash (success/fail) | 600ms | `ease-out` | Color flash then fade to default |
| Sheet content stagger | 250ms total | `ease-out`, stagger 50ms | Each section fades + slides up |
| Card hover lift | 150ms | `ease-out` | y: 0 -> -2 |
| Density/font-size CSS var transition | 200ms | `ease` | Applied to body via CSS `transition` |
| Detail -> edit cross-fade | 350ms total | Out: 150ms, In: 200ms+50ms delay | Opacity cross-fade |

---

## New CSS Variables for Phase 2

Added to `index.css` `:root` and `.dark` blocks:

### Density Variables (written by display-store, not in CSS file)

These are written dynamically to `:root` by the `display-store.ts` Zustand store on init and on change. They are NOT declared in `index.css` static CSS — the store owns them.

| Variable | Default (comfortable, medium) |
|----------|-------------------------------|
| `--spacing-scale` | `1` |
| `--row-height` | `36px` |
| `--cell-padding` | `12px` |
| `--font-scale` | `1` |
| `--base-font-size` | `14px` |

### Transition Rule Addition

Add to `@layer base` in `index.css`:

```css
body {
  transition: font-size 200ms ease, line-height 200ms ease;
}
```

This enables smooth visual transition when font-size or density changes.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | No new components added in Phase 2 | not required |

All required shadcn components already exist in `frontend/src/components/ui/`: `Card`, `Badge`, `Button`, `Input`, `Label`, `Separator`, `ScrollArea`, `Skeleton`, `Tabs`, `Sheet`, `ToggleGroup`, `Textarea`, `Empty`. No new shadcn component installs needed.

No third-party registries declared.

---

## File Impact Summary

### New Files

| File | Purpose |
|------|---------|
| `frontend/src/stores/display-store.ts` | Zustand store for density + fontSize, persists to localStorage, writes CSS vars to `:root` |
| `frontend/src/components/settings/animated-status-badge.tsx` | Animated status badge with pulse effect for connected status |
| `frontend/src/components/settings/theme-preview-card.tsx` | Live preview card for theme selection with mini-mockup |
| `frontend/src/components/settings/connection-test-area.tsx` | Animated state machine for connection test flow |
| `frontend/src/components/settings/connection-health-header.tsx` | Health summary + info grid for detail panel |

### Modified Files

| File | Changes |
|------|---------|
| `frontend/src/routes/_app/settings/index.tsx` | `max-w-3xl` -> `max-w-5xl mx-auto`, replace theme buttons with `ThemePreviewCard`, wire `display-store` to density/fontSize toggles, add `motion/react` tab transitions |
| `frontend/src/components/settings/data-source-card.tsx` | Replace `StatusDot` with `AnimatedStatusBadge`, add `border-l-2` status color, add `motion/react` hover |
| `frontend/src/components/settings/data-source-row.tsx` | Replace `StatusDot` with `AnimatedStatusBadge`, add `border-l-2` status color |
| `frontend/src/components/settings/data-source-sheet.tsx` | Integrate `ConnectionTestArea`, `ConnectionHealthHeader`, add sheet content stagger animation, add mode cross-fade, update button labels ("Save Connection", "Discard", "Sync Datasets", "Edit Source") |
| `frontend/src/components/settings/data-sources-tab.tsx` | Grid changes from `grid-cols-3` to responsive within wider container; no breaking changes |
| `frontend/src/index.css` | Add body `transition` rule for font-size/line-height |

### Unchanged Files

| File | Reason |
|------|--------|
| `frontend/src/components/settings/data-sources-toolbar.tsx` | Already well-composed, no changes needed |
| `frontend/src/components/settings/data-source-sheet.test.tsx` | Tests deferred to future milestone |
| All `frontend/src/components/ui/*` files | Extend via composition, never modify ui/ files |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
