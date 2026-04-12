---
phase: 1
slug: infrastructure-cutover
status: draft
shadcn_initialized: true
preset: mist+blue (new-york style, neutral->mist base, blue accent)
created: 2026-04-12
---

# Phase 1 — UI Design Contract

> Visual and interaction contract for the global palette, chart theme rewiring, and AG Grid token bridge that every subsequent phase consumes. Phase 1 is primarily infrastructure — this contract defines the CSS variable values, series color tokens, and semantic ramp tokens that land in `index.css` and `chart-themes.ts`.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (v4, Tailwind CSS 4) |
| Preset | Mist base + Blue accent (new-york style) |
| Component library | Radix primitives via shadcn/ui |
| Icon library | Lucide React |
| Font | Inter (system-ui, sans-serif fallback) |

**Source:** `frontend/components.json` confirms new-york style, lucide icons, cssVariables enabled, baseColor currently neutral (to be changed to mist).

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline padding |
| sm | 8px | Compact element spacing, icon-to-label gaps |
| md | 16px | Default element spacing, card padding |
| lg | 24px | Section padding, page content `p-6` |
| xl | 32px | Layout gaps between major sections |
| 2xl | 48px | Major section breaks |
| 3xl | 64px | Page-level spacing (unused in Phase 1) |

Exceptions: none. Phase 1 does not introduce new UI components — spacing is inherited from existing codebase. CLAUDE.md establishes `p-6` for pages, `gap-6` for section gaps, `gap-4` for grid gaps.

**Source:** CLAUDE.md Design & UX Principles section.

---

## Typography

| Role | Size | Weight | Line Height | Tailwind Class |
|------|------|--------|-------------|----------------|
| Body | 14px | 400 (regular) | 1.43 (~20px) | `text-sm` |
| Label / Caption | 12px | 400 (regular) | 1.33 (~16px) | `text-xs text-muted-foreground` |
| Section heading | 18px | 500 (medium) | 1.33 (~24px) | `text-lg font-medium` |
| Page title | 24px | 600 (semibold) | 1.2 (~29px) | `text-2xl font-semibold tracking-tight` |

Font: `"Inter", system-ui, sans-serif` — declared in `@layer base` body rule in `index.css`.

**Source:** CLAUDE.md Typography section: "Page title `text-2xl font-semibold tracking-tight`, section `text-lg font-medium`, body `text-sm`, caption `text-xs text-muted-foreground`."

---

## Color

### Global Palette: Mist Base + Blue Accent

The current `index.css` uses the default **neutral** base color (zero chroma, achromatic). Phase 1 replaces it with the **Mist** base color (subtle cool-blue tint, hue ~214-229) and overrides the primary/accent with **Blue** (saturated blue, hue ~264).

#### Light Mode (`:root`)

| Variable | Current (Neutral) | New (Mist+Blue) | Purpose |
|----------|--------------------|-------------------|---------|
| `--background` | `oklch(1 0 0)` | `oklch(1 0 0)` | Page background (60%) |
| `--foreground` | `oklch(0.145 0 0)` | `oklch(0.148 0.004 228.8)` | Primary text |
| `--card` | `oklch(1 0 0)` | `oklch(1 0 0)` | Card surfaces (30%) |
| `--card-foreground` | `oklch(0.145 0 0)` | `oklch(0.148 0.004 228.8)` | Card text |
| `--popover` | `oklch(1 0 0)` | `oklch(1 0 0)` | Popover/dropdown bg |
| `--popover-foreground` | `oklch(0.145 0 0)` | `oklch(0.148 0.004 228.8)` | Popover text |
| `--primary` | `oklch(0.205 0 0)` | `oklch(0.488 0.243 264.376)` | Blue accent buttons, links (10%) |
| `--primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.97 0.014 254.604)` | Text on primary bg |
| `--secondary` | `oklch(0.97 0 0)` | `oklch(0.967 0.001 286.375)` | Secondary surfaces |
| `--secondary-foreground` | `oklch(0.205 0 0)` | `oklch(0.21 0.006 285.885)` | Text on secondary |
| `--muted` | `oklch(0.97 0 0)` | `oklch(0.963 0.002 197.1)` | Muted backgrounds |
| `--muted-foreground` | `oklch(0.556 0 0)` | `oklch(0.56 0.021 213.5)` | Muted text, captions |
| `--accent` | `oklch(0.97 0 0)` | `oklch(0.963 0.002 197.1)` | Hover/active states |
| `--accent-foreground` | `oklch(0.205 0 0)` | `oklch(0.218 0.008 223.9)` | Text on accent |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.577 0.245 27.325)` | Delete/destructive (unchanged) |
| `--border` | `oklch(0.922 0 0)` | `oklch(0.925 0.005 214.3)` | Borders, dividers |
| `--input` | `oklch(0.922 0 0)` | `oklch(0.925 0.005 214.3)` | Input borders |
| `--ring` | `oklch(0.708 0 0)` | `oklch(0.723 0.014 214.4)` | Focus rings |
| `--sidebar` | `oklch(0.985 0 0)` | `oklch(0.987 0.002 197.1)` | Sidebar bg |
| `--sidebar-foreground` | `oklch(0.145 0 0)` | `oklch(0.148 0.004 228.8)` | Sidebar text |
| `--sidebar-primary` | `oklch(0.205 0 0)` | `oklch(0.546 0.245 262.881)` | Sidebar active item |
| `--sidebar-primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.97 0.014 254.604)` | Text on sidebar active |
| `--sidebar-accent` | `oklch(0.97 0 0)` | `oklch(0.963 0.002 197.1)` | Sidebar hover bg |
| `--sidebar-accent-foreground` | `oklch(0.205 0 0)` | `oklch(0.218 0.008 223.9)` | Sidebar hover text |
| `--sidebar-border` | `oklch(0.922 0 0)` | `oklch(0.925 0.005 214.3)` | Sidebar border |
| `--sidebar-ring` | `oklch(0.708 0 0)` | `oklch(0.723 0.014 214.4)` | Sidebar focus ring |

#### Dark Mode (`.dark`)

| Variable | Current (Neutral) | New (Mist+Blue) | Purpose |
|----------|--------------------|-------------------|---------|
| `--background` | `oklch(0.145 0 0)` | `oklch(0.148 0.004 228.8)` | Page background |
| `--foreground` | `oklch(0.985 0 0)` | `oklch(0.987 0.002 197.1)` | Primary text |
| `--card` | `oklch(0.205 0 0)` | `oklch(0.218 0.008 223.9)` | Card surfaces |
| `--card-foreground` | `oklch(0.985 0 0)` | `oklch(0.987 0.002 197.1)` | Card text |
| `--popover` | `oklch(0.205 0 0)` | `oklch(0.218 0.008 223.9)` | Popover bg |
| `--popover-foreground` | `oklch(0.985 0 0)` | `oklch(0.987 0.002 197.1)` | Popover text |
| `--primary` | `oklch(0.922 0 0)` | `oklch(0.424 0.199 265.638)` | Blue accent |
| `--primary-foreground` | `oklch(0.205 0 0)` | `oklch(0.97 0.014 254.604)` | Text on primary |
| `--secondary` | `oklch(0.269 0 0)` | `oklch(0.274 0.006 286.033)` | Secondary surfaces |
| `--secondary-foreground` | `oklch(0.985 0 0)` | `oklch(0.985 0 0)` | Text on secondary |
| `--muted` | `oklch(0.269 0 0)` | `oklch(0.275 0.011 216.9)` | Muted backgrounds |
| `--muted-foreground` | `oklch(0.708 0 0)` | `oklch(0.723 0.014 214.4)` | Muted text |
| `--accent` | `oklch(0.269 0 0)` | `oklch(0.275 0.011 216.9)` | Hover/active states |
| `--accent-foreground` | `oklch(0.985 0 0)` | `oklch(0.987 0.002 197.1)` | Text on accent |
| `--destructive` | `oklch(0.704 0.191 22.216)` | `oklch(0.704 0.191 22.216)` | Destructive (unchanged) |
| `--border` | `oklch(1 0 0 / 10%)` | `oklch(1 0 0 / 10%)` | Borders (unchanged) |
| `--input` | `oklch(1 0 0 / 15%)` | `oklch(1 0 0 / 15%)` | Input borders (unchanged) |
| `--ring` | `oklch(0.556 0 0)` | `oklch(0.56 0.021 213.5)` | Focus rings |
| `--sidebar` | `oklch(0.205 0 0)` | `oklch(0.218 0.008 223.9)` | Sidebar bg |
| `--sidebar-foreground` | `oklch(0.985 0 0)` | `oklch(0.987 0.002 197.1)` | Sidebar text |
| `--sidebar-primary` | `oklch(0.488 0.243 264.376)` | `oklch(0.623 0.214 259.815)` | Sidebar active |
| `--sidebar-primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.97 0.014 254.604)` | Sidebar active text |
| `--sidebar-accent` | `oklch(0.269 0 0)` | `oklch(0.275 0.011 216.9)` | Sidebar hover |
| `--sidebar-accent-foreground` | `oklch(0.985 0 0)` | `oklch(0.987 0.002 197.1)` | Sidebar hover text |
| `--sidebar-border` | `oklch(1 0 0 / 10%)` | `oklch(1 0 0 / 10%)` | Sidebar border (unchanged) |
| `--sidebar-ring` | `oklch(0.556 0 0)` | `oklch(0.56 0.021 213.5)` | Sidebar focus ring |

#### 60/30/10 Distribution

| Role | Percentage | Elements |
|------|------------|----------|
| Dominant (60%) | `--background` | Page background, main content area |
| Secondary (30%) | `--card`, `--sidebar`, `--muted`, `--secondary` | Cards, sidebar, nav, muted sections, popover/dropdown |
| Accent (10%) | `--primary` (Blue) | Primary CTA buttons, active sidebar items, focus rings, link text, selected tab indicator, toggle-on state |

Accent reserved for: primary action buttons, sidebar active nav item, focus rings on inputs, link text underlines, selected/active tab indicators, toggle switch on-state, chart legend active highlight. Never used for backgrounds larger than a button or badge.

#### Semantic Status Colors (unchanged from CLAUDE.md)

| Semantic | Light | Dark | Usage |
|----------|-------|------|-------|
| Positive | `text-green-600` | `dark:text-green-400` | KPI positive trend, waterfall increase |
| Negative | `text-red-600` | `dark:text-red-400` | KPI negative trend, waterfall decrease |

These are Tailwind utility colors, not CSS variables. They remain unchanged — the CLAUDE.md convention is intentional.

---

## Chart Color Tokens

### Built-in Chart Variables (`--chart-1` through `--chart-5`)

These are the shadcn-standard chart variables, updated from neutral grays to the Blue-family palette.

#### Light Mode

| Variable | Current (Neutral) | New (Blue-family) |
|----------|--------------------|--------------------|
| `--chart-1` | `oklch(0.646 0.222 41.116)` | `oklch(0.809 0.105 251.813)` |
| `--chart-2` | `oklch(0.6 0.118 184.704)` | `oklch(0.623 0.214 259.815)` |
| `--chart-3` | `oklch(0.398 0.07 227.392)` | `oklch(0.546 0.245 262.881)` |
| `--chart-4` | `oklch(0.828 0.189 84.429)` | `oklch(0.488 0.243 264.376)` |
| `--chart-5` | `oklch(0.769 0.188 70.08)` | `oklch(0.424 0.199 265.638)` |

#### Dark Mode

| Variable | Current (Neutral) | New (Blue-family) |
|----------|--------------------|--------------------|
| `--chart-1` | `oklch(0.488 0.243 264.376)` | `oklch(0.809 0.105 251.813)` |
| `--chart-2` | `oklch(0.696 0.17 162.48)` | `oklch(0.623 0.214 259.815)` |
| `--chart-3` | `oklch(0.769 0.188 70.08)` | `oklch(0.546 0.245 262.881)` |
| `--chart-4` | `oklch(0.627 0.265 303.9)` | `oklch(0.488 0.243 264.376)` |
| `--chart-5` | `oklch(0.645 0.246 16.439)` | `oklch(0.424 0.199 265.638)` |

### Extended Series Variables (`--series-1` through `--series-8`)

Per decision D-15, start from `--chart-1..5` and derive 3 more from complementary hues to ensure 8 distinct categorical series are always distinguishable. These are **new** CSS variables added to `index.css`.

#### Light Mode

| Variable | Value | Hue Family |
|----------|-------|------------|
| `--series-1` | `oklch(0.809 0.105 251.813)` | Blue (light) — same as `--chart-1` |
| `--series-2` | `oklch(0.623 0.214 259.815)` | Blue (mid) — same as `--chart-2` |
| `--series-3` | `oklch(0.546 0.245 262.881)` | Blue (deep) — same as `--chart-3` |
| `--series-4` | `oklch(0.488 0.243 264.376)` | Blue (dark) — same as `--chart-4` |
| `--series-5` | `oklch(0.424 0.199 265.638)` | Blue (darkest) — same as `--chart-5` |
| `--series-6` | `oklch(0.696 0.17 162.48)` | Teal — complementary hue |
| `--series-7` | `oklch(0.769 0.188 70.08)` | Amber — warm contrast |
| `--series-8` | `oklch(0.627 0.265 303.9)` | Violet — split-complementary |

#### Dark Mode

| Variable | Value | Hue Family |
|----------|-------|------------|
| `--series-1` | `oklch(0.809 0.105 251.813)` | Blue (light) |
| `--series-2` | `oklch(0.623 0.214 259.815)` | Blue (mid) |
| `--series-3` | `oklch(0.546 0.245 262.881)` | Blue (deep) |
| `--series-4` | `oklch(0.488 0.243 264.376)` | Blue (dark) |
| `--series-5` | `oklch(0.424 0.199 265.638)` | Blue (darkest) |
| `--series-6` | `oklch(0.696 0.17 162.48)` | Teal |
| `--series-7` | `oklch(0.769 0.188 70.08)` | Amber |
| `--series-8` | `oklch(0.627 0.265 303.9)` | Violet |

### Semantic Ramp Variables (NEW)

Per decision D-16, add purpose-specific color variables for specialized chart types.

#### Light Mode

| Variable | Value | Usage |
|----------|-------|-------|
| `--color-ramp-low` | `oklch(0.809 0.105 251.813)` | Heatmap/treemap low end (light blue) |
| `--color-ramp-high` | `oklch(0.424 0.199 265.638)` | Heatmap/treemap high end (dark blue) |
| `--chart-positive` | `oklch(0.648 0.15 160)` | Waterfall increase, gauge good zone (green) |
| `--chart-negative` | `oklch(0.577 0.245 27.325)` | Waterfall decrease, gauge bad zone (red) |

#### Dark Mode

| Variable | Value | Usage |
|----------|-------|-------|
| `--color-ramp-low` | `oklch(0.809 0.105 251.813)` | Heatmap/treemap low end |
| `--color-ramp-high` | `oklch(0.424 0.199 265.638)` | Heatmap/treemap high end |
| `--chart-positive` | `oklch(0.696 0.17 162.48)` | Waterfall increase |
| `--chart-negative` | `oklch(0.704 0.191 22.216)` | Waterfall decrease |

### Tailwind `@theme inline` Additions

The following must be added to the existing `@theme inline` block so Tailwind utility classes can reference the new tokens:

```css
--color-series-1: var(--series-1);
--color-series-2: var(--series-2);
--color-series-3: var(--series-3);
--color-series-4: var(--series-4);
--color-series-5: var(--series-5);
--color-series-6: var(--series-6);
--color-series-7: var(--series-7);
--color-series-8: var(--series-8);
--color-ramp-low: var(--color-ramp-low);
--color-ramp-high: var(--color-ramp-high);
--color-chart-positive: var(--chart-positive);
--color-chart-negative: var(--chart-negative);
```

---

## AG Grid Token Bridge

Per INFRA-20, add a `.ag-theme-quartz` CSS override block to `index.css` so AG Grid reads shadcn tokens. This replaces the current legacy `ag-theme-quartz-dark` CSS class approach (seen in `query-results.tsx`).

```css
.ag-theme-quartz {
  --ag-background-color: var(--background);
  --ag-foreground-color: var(--foreground);
  --ag-header-background-color: var(--muted);
  --ag-header-foreground-color: var(--foreground);
  --ag-border-color: var(--border);
  --ag-row-hover-color: var(--accent);
  --ag-selected-row-background-color: var(--accent);
  --ag-odd-row-background-color: transparent;
  --ag-font-family: "Inter", system-ui, sans-serif;
  --ag-font-size: 13px;
  --ag-header-font-size: 12px;
  --ag-header-font-weight: 500;
  --ag-cell-horizontal-padding: 12px;
  --ag-row-height: 36px;
  --ag-header-height: 40px;
}
```

Note: The actual AG Grid Theming API migration (`themeQuartz.withPart(colorSchemeDark)`) is scoped to Phase 7 (Explorer). Phase 1 only lays down the CSS variable bridge.

---

## chart-themes.ts Rewiring

Per D-17, the `getChartPalette().series` array in `chart-themes.ts` must be rewired from the current hard-coded hex values to CSS variable reads. The existing `resolveColor()` utility already handles oklch-to-hex conversion.

### Current (broken — hard-coded hex)

```typescript
const series = [
  primary,
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#ec4899', '#14b8a6',
]
```

### Target (CSS variable reads)

```typescript
const series = [
  resolveColor('--series-1'),
  resolveColor('--series-2'),
  resolveColor('--series-3'),
  resolveColor('--series-4'),
  resolveColor('--series-5'),
  resolveColor('--series-6'),
  resolveColor('--series-7'),
  resolveColor('--series-8'),
]
```

### Heatmap/Treemap/Waterfall Overrides

Replace hard-coded hex in chart type overrides:

| Chart Type | Current | Target |
|------------|---------|--------|
| Heatmap `colorRange` | `[p.series[1], p.series[3], p.series[4]]` | `[resolveColor('--color-ramp-low'), resolveColor('--color-ramp-high')]` |
| Treemap `colorRange` | `['#43A047', '#FF5722']` | `[resolveColor('--chart-positive'), resolveColor('--chart-negative')]` |
| Pie `sectorLabel.color` | `'#ffffff'` | `resolveColor('--primary-foreground')` |

---

## Copywriting Contract

Phase 1 is infrastructure — it does not introduce new user-facing pages or components. However, the following copy elements exist in the current UI and must remain functional after the palette swap.

| Element | Copy | Notes |
|---------|------|-------|
| Primary CTA | N/A | No new CTAs introduced in Phase 1 |
| Empty state heading | N/A | No new empty states; existing ones unchanged |
| Empty state body | N/A | Existing `Empty` component pattern preserved |
| Error state | "Something went wrong. Please try again or contact support." | Existing Sonner toast pattern; no changes in Phase 1 |
| Health check response | `{"status": "healthy", "driver": "python-oracledb", "mode": "thick"}` | Backend `/health` endpoint JSON response (for dev verification, not user-facing) |
| Boot refusal message | "FATAL: Oracle thick mode not detected. Refusing to start. Ensure ORACLE_CLIENT_LIB_DIR is set and Oracle Instant Client is installed." | Startup assertion stderr when thick mode fails |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | No new components added in Phase 1 | not required |

No third-party registries declared. The existing 33 shadcn/ui components in `frontend/src/components/ui/` are owned code and require no registry safety vetting.

---

## Implementation Notes

### What Changes in Phase 1

1. **`frontend/src/index.css`** — Replace all `:root` and `.dark` CSS variable values with Mist+Blue palette. Add `--series-1..8`, `--color-ramp-low/high`, `--chart-positive/negative` variables. Add `@theme inline` entries for new tokens. Add `.ag-theme-quartz` override block. Preserve existing `@layer components` micro-interaction rules.

2. **`frontend/src/lib/chart-themes.ts`** — Rewire `getChartPalette().series` from hard-coded hex to CSS var reads. Replace hard-coded hex in heatmap/treemap/waterfall/pie overrides. Keep the existing `resolveColor()`, `cssColorToHex()`, `hslToHex()` utilities unchanged.

3. **`frontend/components.json`** — Update `tailwind.baseColor` from `"neutral"` to `"mist"` to reflect the new base.

### What Does NOT Change in Phase 1

- No new shadcn/ui components added
- No component files in `src/components/ui/` modified
- No layout components modified
- No page components modified (colorization happens in Phases 2-7)
- AG Grid Theming API migration deferred to Phase 7
- Status colors (`text-green-600`, `text-red-600`) remain as Tailwind utilities per CLAUDE.md

### Verification Criteria (from INFRA-18, INFRA-19, INFRA-20, INFRA-21)

- Frontend loads with new palette in light mode — sidebar shows cool-tinted mist gray, not pure neutral
- Frontend loads with new palette in dark mode — same mist tint visible
- Primary buttons render in blue (`--primary`), not black/dark gray
- `chart-themes.ts` series array contains no hard-coded hex values
- `.ag-theme-quartz` CSS block present in `index.css`
- `--series-1` through `--series-8` defined in both `:root` and `.dark`

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
