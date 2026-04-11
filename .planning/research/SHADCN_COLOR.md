# Shadcn Color System Research — RecViz Oracle-Only Milestone

**Researched:** 2026-04-11
**Consumer:** Phase 1 UI-SPEC gate of the "Oracle cutover + frontend colorization" milestone
**Overall confidence:** HIGH for official shadcn facts and palette values (verified against source), MEDIUM for AG Charts/AG Grid wiring (verified against current docs), HIGH for the recommendation rationale

---

## 1. Executive summary — what has shadcn actually shipped lately?

Short version: shadcn's "new color thing" is not a single release. Over the Dec 2025 → Apr 2026 window, @shadcn shipped a connected set of tools around a new **presets + registry:base** model. Picking a palette is now a registry operation, not a manual CSS edit. The relevant pieces for RecViz are:

| When | What | Why it matters to us |
|------|------|----------------------|
| Feb 2025 | **Tailwind v4 theming refresh** — official switch from HSL to OKLCH in the default theme, move of `:root` / `.dark` out of `@layer base`, and introduction of the `@theme inline` block. | RecViz is already on this format (verified in `frontend/src/index.css`). Means our CSS-variable surface is current. |
| Oct–Nov 2025 | **Four new base colors — mauve, olive, mist, taupe** — added to Tailwind + shadcn. | These are the "muted-but-not-dead" neutrals shadcn now recommends for apps that want a hint of warmth/coolness without looking like marketing sites. Ideal for banking. |
| Dec 2025 | **`npx shadcn create`** — interactive picker at `ui.shadcn.com/create`. Choose component library, visual style, base color, accent, radius, font, icon set → outputs a preset. | This is how @shadcn wants people to pick colors now. The final Phase 1 choice can literally be made by driving this page. |
| Mar 2026 | **`shadcn/cli v4`** — registries can now ship an entire design system as `registry:base` (CSS vars, fonts, components, config) in one payload. | `registry:base` is the same format we'll write into `index.css`. |
| Mar 2026 | **"Luma" style** — new rounded-geometry / soft-elevation visual style. | NOT a color change. It swaps geometry/spacing/radius baselines. Probably **not** what RecViz wants (we're data-dense desktop BI, not macOS Tahoe). Flag it so Phase 1 consciously rejects it. |
| Apr 2026 | **`npx shadcn apply`** — apply a preset (colors, CSS vars, fonts, icons) to an **existing** project. | Important: RecViz doesn't need to re-init. If Phase 1 picks a preset on ui.shadcn.com/create, `shadcn apply <preset-url>` will patch `index.css` in place. |

The usable artifact for Phase 1 is the **shadcn themes registry** (`apps/v4/registry/themes.ts` in `shadcn-ui/ui` on GitHub). That file is the source of truth for every official preset. Values below are copy-pasted verbatim from it.

**Non-decisions** (already locked by the environment):
- We're on Tailwind v4 with the `@theme inline` model — confirmed in `frontend/src/index.css`.
- Colors are OKLCH — confirmed in the same file.
- We already have every shadcn token the new themes use (`--chart-1..5`, `--sidebar-*`, etc.) — confirmed.
- We're keeping the `new-york` style (not Luma). `components.json` says `"style": "new-york"`; the milestone scope says "existing codebase, already uses Shadcn extensively", so Luma is a non-starter.

**What Phase 1 must decide:**
1. **One base color** — which of neutral / stone / zinc / mauve / olive / mist / taupe.
2. **One accent** — applied on top of the base. Primary candidates: none (stay achromatic), blue, indigo, teal.
3. **Whether to override the shadcn default chart-1..5 ramp** (which is monochrome) with a multi-hue sequential palette for multi-series charts. RecViz today has a hand-coded rainbow series in `frontend/src/lib/chart-themes.ts` — that will need a decision.

Everything else (radius, card bg, sidebar, borders) flows from the chosen base.

---

## 2. What CSS variables shadcn ships (and what's already in RecViz)

RecViz already declares the full shadcn v4 surface in `frontend/src/index.css`. No migration needed — just **overwriting the OKLCH values**. The full token list, verified against the shadcn registry:

```
# Surface pairs
--background / --foreground
--card / --card-foreground
--popover / --popover-foreground

# Action colors
--primary / --primary-foreground
--secondary / --secondary-foreground
--accent / --accent-foreground

# States
--muted / --muted-foreground
--destructive

# UI elements
--border
--input
--ring

# Charts (5-slot sequential ramp)
--chart-1, --chart-2, --chart-3, --chart-4, --chart-5

# Sidebar (independent surface + action set)
--sidebar / --sidebar-foreground
--sidebar-primary / --sidebar-primary-foreground
--sidebar-accent / --sidebar-accent-foreground
--sidebar-border
--sidebar-ring

# Geometry
--radius                  (shadcn default: 0.625rem, RecViz current: 0.625rem ✓)
--radius-sm/md/lg/xl/2xl  (derived in @theme inline)
```

Dark-mode rule: every token listed above is re-declared inside `.dark`. Border and input in dark mode now use `oklch(1 0 0 / 10%)` and `oklch(1 0 0 / 15%)` — i.e. translucent white — rather than solid dark greys. That's the shadcn Feb-2025 convention and RecViz already uses it.

**Gap in RecViz today:** The `primary` variable is pure greyscale (`oklch(0.205 0 0)` light / `oklch(0.922 0 0)` dark). So is the sidebar-primary. This is why the app feels black-and-white. The fix is literally a CSS-variable swap in `:root` and `.dark`.

**Gap in RecViz today (charts):** `frontend/src/lib/chart-themes.ts` hard-codes a 10-colour series palette (`#3b82f6`, `#10b981`, `#f59e0b`, `#ef4444`, `#8b5cf6`, ...) instead of reading `--chart-1..5`. Flag for Phase 1: decide whether to use shadcn's 5-slot ramp only, or layer our own longer ramp after slot 5. More below in §5.

---

## 3. How shadcn-the-human wants you to pick colors in 2026

Confirmed workflow from the changelog entries:

1. Go to **https://ui.shadcn.com/create**.
2. Pick component library (keep **Radix** — RecViz already uses `radix-ui` and `@radix-ui/react-slot`).
3. Pick style (**keep new-york**, reject Luma).
4. Pick base color (one of the 7 base themes).
5. Optionally pick an accent theme (one of the 17 accent themes — blue/indigo/teal/etc.).
6. Pick radius, font, icon library (RecViz already has: `0.625rem`, Inter, Lucide — leave alone).
7. The page produces a preset URL (looks like `b2D0vQ7G4`).
8. From inside RecViz, run:

   ```bash
   cd frontend
   pnpm dlx shadcn@latest apply --preset <id>
   ```

   This rewrites `src/index.css`'s `:root` and `.dark` blocks in place, leaving `@theme inline`, `@layer base`, and our custom micro-interaction CSS untouched. Base color, RTL, and any project-specific settings already in `components.json` are preserved.

**Why this matters for Phase 1 UI-SPEC:** the picked-palette step can be done visually on ui.shadcn.com/create rather than by writing OKLCH values by hand. The artifact to capture in the UI-SPEC gate is the **preset URL** (or the preset name, e.g. "neutral + blue"). The SHA-pinned OKLCH values are stable because they come from the registry file below.

---

## 4. The seven official base themes — concrete OKLCH values

All values below are verbatim from `apps/v4/registry/themes.ts` in `shadcn-ui/ui` as of April 2026. These are the values you get when you pick "Base color: X" in ui.shadcn.com/create with no accent layered on top. **RecViz's Phase 1 picks exactly one of these.**

### 4.1 Neutral (true greyscale — current RecViz default, too sterile for colorization milestone)

Chroma = 0 on every token. This is what RecViz ships today. Rejected: the whole point of the milestone is to move off this.

### 4.2 Stone (warm, subtle beige undertone)

Warm-grey (hue ~49–56 ≈ warm beige). Still ≤ 0.013 chroma — effectively monochrome to the eye, but feels less clinical. Banking-appropriate.

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.147 0.004 49.25);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.147 0.004 49.25);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.147 0.004 49.25);
  --primary: oklch(0.216 0.006 56.043);
  --primary-foreground: oklch(0.985 0.001 106.423);
  --secondary: oklch(0.97 0.001 106.424);
  --secondary-foreground: oklch(0.216 0.006 56.043);
  --muted: oklch(0.97 0.001 106.424);
  --muted-foreground: oklch(0.553 0.013 58.071);
  --accent: oklch(0.97 0.001 106.424);
  --accent-foreground: oklch(0.216 0.006 56.043);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.923 0.003 48.717);
  --input: oklch(0.923 0.003 48.717);
  --ring: oklch(0.709 0.01 56.259);
  /* chart-1..5 are a monochrome stone ramp — see §5 if you want to replace */
}
```

### 4.3 Zinc (cool neutral, slight blue undertone)

Cool-grey. Chroma ≤ 0.006. The most common "default-looking" shadcn app. Safe but very close to Neutral.

### 4.4 Mauve (NEW, Oct-Nov 2025) — warm-purple undertone

Hue 320–326 ≈ very muted purple/mauve. Chroma ≤ 0.034. **Too warm for a banking recon app** — feels slightly perfumed. Flag as "probably not".

```css
/* Mauve light — for reference only, not recommended */
--foreground: oklch(0.145 0.008 326);
--primary:    oklch(0.212 0.019 322.12);
--muted-foreground: oklch(0.542 0.034 322.5);
--border:     oklch(0.922 0.005 325.62);
--ring:       oklch(0.711 0.019 323.02);
```

### 4.5 Olive (NEW, Oct-Nov 2025) — warm-yellow/green undertone

Hue ~107 ≈ dry olive. Chroma ≤ 0.031. Natural and calm. Reads slightly "earthy" — could feel out of place against a corporate-finance backdrop. Not recommended as the sole neutral for Citi GRU, but noted here for completeness.

### 4.6 Mist (NEW, Oct-Nov 2025) — cool-blue undertone ★ CANDIDATE

Hue ~214–229 ≈ very faint sky blue. Chroma ≤ 0.021. Reads as "quietly cool greyscale" — effectively the same brightness as Zinc but with enough blue bias that gradients, focus rings, and subtle accents don't fight a chosen blue/indigo primary. This is the strongest "muted neutral that plays well with a blue accent" candidate for a banking app.

```css
/* Mist — RECOMMENDED BASE */
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.148 0.004 228.8);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.148 0.004 228.8);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.148 0.004 228.8);
  --primary: oklch(0.218 0.008 223.9);
  --primary-foreground: oklch(0.987 0.002 197.1);
  --secondary: oklch(0.963 0.002 197.1);
  --secondary-foreground: oklch(0.218 0.008 223.9);
  --muted: oklch(0.963 0.002 197.1);
  --muted-foreground: oklch(0.56 0.021 213.5);
  --accent: oklch(0.963 0.002 197.1);
  --accent-foreground: oklch(0.218 0.008 223.9);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.925 0.005 214.3);
  --input: oklch(0.925 0.005 214.3);
  --ring: oklch(0.723 0.014 214.4);
  --chart-1: oklch(0.872 0.007 219.6);
  --chart-2: oklch(0.56 0.021 213.5);
  --chart-3: oklch(0.45 0.017 213.2);
  --chart-4: oklch(0.378 0.015 216);
  --chart-5: oklch(0.275 0.011 216.9);
  --radius: 0.625rem;
  --sidebar: oklch(0.987 0.002 197.1);
  --sidebar-foreground: oklch(0.148 0.004 228.8);
  --sidebar-primary: oklch(0.218 0.008 223.9);
  --sidebar-primary-foreground: oklch(0.987 0.002 197.1);
  --sidebar-accent: oklch(0.963 0.002 197.1);
  --sidebar-accent-foreground: oklch(0.218 0.008 223.9);
  --sidebar-border: oklch(0.925 0.005 214.3);
  --sidebar-ring: oklch(0.723 0.014 214.4);
}

.dark {
  --background: oklch(0.148 0.004 228.8);
  --foreground: oklch(0.987 0.002 197.1);
  --card: oklch(0.218 0.008 223.9);
  --card-foreground: oklch(0.987 0.002 197.1);
  --popover: oklch(0.218 0.008 223.9);
  --popover-foreground: oklch(0.987 0.002 197.1);
  --primary: oklch(0.925 0.005 214.3);
  --primary-foreground: oklch(0.218 0.008 223.9);
  --secondary: oklch(0.275 0.011 216.9);
  --secondary-foreground: oklch(0.987 0.002 197.1);
  --muted: oklch(0.275 0.011 216.9);
  --muted-foreground: oklch(0.723 0.014 214.4);
  --accent: oklch(0.275 0.011 216.9);
  --accent-foreground: oklch(0.987 0.002 197.1);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.56 0.021 213.5);
  --chart-1: oklch(0.872 0.007 219.6);
  --chart-2: oklch(0.56 0.021 213.5);
  --chart-3: oklch(0.45 0.017 213.2);
  --chart-4: oklch(0.378 0.015 216);
  --chart-5: oklch(0.275 0.011 216.9);
  --sidebar: oklch(0.218 0.008 223.9);
  --sidebar-foreground: oklch(0.987 0.002 197.1);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.987 0.002 197.1);
  --sidebar-accent: oklch(0.275 0.011 216.9);
  --sidebar-accent-foreground: oklch(0.987 0.002 197.1);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.56 0.021 213.5);
}
```

Note: dark-mode `--sidebar-primary` is `oklch(0.488 0.243 264.376)` — the blue used by the default Neutral-dark theme. That's a deliberate shadcn touch: the collapsible sidebar rail pops with a blue chevron/highlight even on an otherwise neutral theme. Phase 1 decides whether to keep that or replace it with the chosen accent.

### 4.7 Taupe (NEW, Oct-Nov 2025) — warm-orange/brown undertone

Hue 34–49 ≈ desaturated brown. Chroma ≤ 0.021. Feels editorial / magazine-y. Not recommended for banking.

---

## 5. Chart colors — this is where Phase 1 has real work to do

Shadcn's official `--chart-1..5` ramp inside every **base theme** is **monochrome**: lightness-stepped only, chroma matched to the base hue. For Mist the ramp is:

```
chart-1: oklch(0.872 0.007 219.6)   — very light mist grey
chart-2: oklch(0.56  0.021 213.5)   — mid mist grey
chart-3: oklch(0.45  0.017 213.2)   — darker mist grey
chart-4: oklch(0.378 0.015 216)     — much darker
chart-5: oklch(0.275 0.011 216.9)   — darkest
```

That ramp is perfect for **heatmap / treemap / single-metric sequential visualisations**. It's deliberately **bad** for **multi-series categorical charts** (line with 4 series, grouped bar, donut with 6 slices) because the user can't tell series apart.

RecViz absolutely has multi-series charts. So Phase 1 needs to pick one of two strategies:

### Strategy A: Shadcn palette only (minimum change)

Use the base theme's 5-slot monochrome ramp as-is. Multi-series charts show 5 steps of the same hue at decreasing lightness. This is what shadcn's own chart blocks do, and it's classy and conservative. Limit: no chart should have more than 5 categorical series (most BI dashboards stay under this).

**Pros:** zero hand-coded colour, inherits whatever preset shadcn apply pushes, theme-switch is instant, works in dark mode without extra wiring.
**Cons:** fails above 5 series. Colours of different charts on the same dashboard look identical, which can confuse cross-filter readability.

### Strategy B: Shadcn palette + RecViz-defined extension ramp ★ RECOMMENDED

Keep the base theme's `--chart-1..5` for sequential visualisations (heatmap, treemap, single-metric areas, single-metric bars) and **layer a second set of tokens** for the categorical multi-series case. Add to `index.css`:

```css
:root {
  /* Categorical series palette — only for multi-series line/bar/donut where each series is a distinct category, not a magnitude step */
  --series-1: oklch(0.546 0.245 262.881);  /* blue-600  */
  --series-2: oklch(0.508 0.118 165.612);  /* emerald-600 */
  --series-3: oklch(0.681 0.162 75.834);   /* amber-500  */
  --series-4: oklch(0.577 0.245 27.325);   /* red-600 / matches --destructive */
  --series-5: oklch(0.491 0.27 292.581);   /* violet-600 */
  --series-6: oklch(0.52 0.105 223.128);   /* cyan-600   */
  --series-7: oklch(0.681 0.162 45);       /* orange     */
  --series-8: oklch(0.511 0.096 186.391);  /* teal-600   */
}

.dark {
  /* Slightly brighter variants for dark backgrounds */
  --series-1: oklch(0.623 0.214 259.815);
  --series-2: oklch(0.696 0.17  162.48);
  --series-3: oklch(0.795 0.184 86.047);
  --series-4: oklch(0.704 0.191 22.216);
  --series-5: oklch(0.606 0.25  292.717);
  --series-6: oklch(0.715 0.143 215.221);
  --series-7: oklch(0.725 0.165 55);
  --series-8: oklch(0.704 0.14  182.503);
}
```

Expose them to Tailwind inside the existing `@theme inline` block:

```css
@theme inline {
  /* ... existing ... */
  --color-series-1: var(--series-1);
  --color-series-2: var(--series-2);
  /* ... through series-8 ... */
}
```

Then update `frontend/src/lib/chart-themes.ts` `getChartPalette()` to read `--series-1..8` instead of hard-coding `#3b82f6` etc. The existing `cssColorToHex()` helper already handles OKLCH → hex for AG Charts.

All eight colours are lifted straight from shadcn's own accent themes (blue, emerald, amber, red, violet, cyan, orange, teal). They use the `primary` slot chroma from each accent theme so they harmonise automatically with any base, and each is within the "600-ish" lightness band so no single series dominates.

**Pros:** honours shadcn's sequential ramp for heatmaps/treemaps, still supports 8-way multi-series categorical charts, uses shadcn-sanctioned OKLCH values (not random).
**Cons:** RecViz owns a small extension token set; shadcn apply won't touch them.

### Strategy C (rejected): replace shadcn `--chart-1..5` with a rainbow

Don't do this. It breaks sequential visualisations (heatmap gradients look wrong with rainbow stops) and makes Phase 2+ preset swaps inconsistent.

---

## 6. Accent themes — what a "layered" palette looks like

Accent themes in shadcn are **partial overrides** on top of a base. They only touch `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--chart-1..5`, and `--sidebar-primary[-foreground]`. Everything else keeps the base's values. That's how "Neutral base + Blue accent" composes.

Three accent themes matter for RecViz (banking-appropriate, enough colour to feel alive, not so much that it screams consumer app):

### 6.1 Blue accent (best match for Citi reconciliation context)

From the registry, light mode:

```css
--primary: oklch(0.488 0.243 264.376);
--primary-foreground: oklch(0.97 0.014 254.604);
--secondary: oklch(0.967 0.001 286.375);
--secondary-foreground: oklch(0.21 0.006 285.885);
--chart-1: oklch(0.809 0.105 251.813);   /* blue-300 */
--chart-2: oklch(0.623 0.214 259.815);   /* blue-500 */
--chart-3: oklch(0.546 0.245 262.881);   /* blue-600 */
--chart-4: oklch(0.488 0.243 264.376);   /* blue-700 */
--chart-5: oklch(0.424 0.199 265.638);   /* blue-800 */
--sidebar-primary: oklch(0.546 0.245 262.881);
--sidebar-primary-foreground: oklch(0.97 0.014 254.604);
```

Dark mode uses the darker chroma for primary (`oklch(0.424 0.199 265.638)`) and a lighter chart-2 for the sidebar-primary highlight.

Rationale: Citi's brand colour is blue. A blue `--primary` means buttons, links, focus rings, selected rows, KPI trend indicators, and the sidebar rail all read "Citi-adjacent" without the liability of copying the exact brand hex.

### 6.2 Indigo accent (safer, slightly more generic)

```css
--primary: oklch(0.457 0.24 277.023);
--primary-foreground: oklch(0.962 0.018 272.314);
--chart-1..5: light-to-dark indigo ramp
```

Indigo reads as "enterprise software" — Stripe/Linear/GitHub territory. Slightly more distinctive than blue if blue feels too on-the-nose Citi.

### 6.3 Teal accent (third option, if a blue feels too predictable)

```css
--primary: oklch(0.511 0.096 186.391);
--primary-foreground: oklch(0.984 0.014 180.72);
```

Teal is the safest "financial but not blue" choice. Flag: low chroma (0.096) means it can read as a desaturated cyan on low-DPI monitors. Test before committing.

**Not recommended:** rose, fuchsia, pink, violet, amber, yellow, lime, green, orange. Too saturated/festive for a banking recon tool. Red is reserved for `--destructive`.

---

## 7. Four concrete palette options for Phase 1

Each option below is a full `base + accent` combination. Phase 1 picks exactly one.

### Option A — Stone base + Blue accent ("warm neutral, Citi blue actions")

- Base: Stone (§4.2). Warm beige-grey neutral.
- Accent: Blue (§6.1). Primary/sidebar/focus/charts use the blue ramp.
- Feel: Conservative, warm, slightly editorial. Buttons and CTAs pop blue against a warm-grey page.
- Tradeoff: Stone's warmth fights Blue's coolness slightly. Acceptable but not optimal.

### Option B — Mist base + Blue accent ("cool neutral, Citi blue actions") ★ RECOMMENDED

- Base: Mist (§4.6). Cool-grey neutral with a faint blue undertone.
- Accent: Blue (§6.1). Primary/sidebar/focus/charts use the blue ramp.
- Feel: Coherent top-to-bottom blue-leaning palette. Neutral surfaces look "quietly blue" rather than plain grey; accented interactions read as "more blue still". Most banking-appropriate of all options.
- Tradeoff: Very close to Zinc + Blue visually. The difference is real under dark mode — Mist's slight warmth prevents the dark surface from looking flat-black.

### Option C — Zinc base + Indigo accent ("generic enterprise SaaS")

- Base: Zinc. Cool neutral grey.
- Accent: Indigo (§6.2).
- Feel: Linear / Vercel aesthetic. Slightly less "banking", slightly more "modern product".
- Tradeoff: Risk of looking like every other admin dashboard. Safest fallback if Option B feels too bespoke.

### Option D — Stone base + Teal accent ("not-blue banking")

- Base: Stone.
- Accent: Teal (§6.3).
- Feel: A deliberate step away from blue. Reads as "fintech that isn't a bank trying to look like a bank".
- Tradeoff: Teal at low chroma can appear desaturated. Test on a real monitor before committing.

---

## 8. AG Grid + AG Charts integration — what works, what needs wiring

### 8.1 AG Grid (verified, already wired correctly)

RecViz uses the **new Theming API** (not the legacy CSS-class approach). Verified in:

- `frontend/src/components/datasets/column-metadata-grid.tsx`
- `frontend/src/components/datasets/dataset-editor.tsx`
- `frontend/src/components/dashboard/config-data-grid.tsx`
- `frontend/src/components/dashboard/drill-detail-grid.tsx`

All four use:

```ts
import { themeQuartz, colorSchemeDark } from 'ag-grid-community'
const gridTheme = resolvedTheme === 'dark'
  ? themeQuartz.withPart(colorSchemeDark)
  : themeQuartz
```

**Does AG Grid auto-read `--color-foreground` / `--color-background`?** No. The Theming API requires you to pass CSS-variable values in explicitly via `themeQuartz.withParams({ backgroundColor: 'var(--background)', foregroundColor: 'var(--foreground)', ... })`. Alternatively you set per-theme CSS overrides:

```css
.ag-theme-quartz {
  --ag-background-color: var(--background);
  --ag-foreground-color: var(--foreground);
  --ag-border-color: var(--border);
  --ag-header-background-color: var(--muted);
  --ag-odd-row-background-color: var(--muted);
  --ag-selected-row-background-color: oklch(from var(--primary) l c h / 0.1);
  --ag-row-hover-color: var(--accent);
  --ag-font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
}
```

The Quartz theme accepts `--ag-*` CSS variables directly, and the Theming API's `withPart(colorSchemeDark)` toggles the dark variant correctly when `.dark` is applied on `<html>`. So the wiring is: **one-time `.ag-theme-quartz` override block in `index.css` that forwards Shadcn tokens into `--ag-*` tokens**. Phase 1 should add this block alongside the palette change.

**Gap found:** `frontend/src/components/explorer/query-results.tsx` still uses the **legacy CSS-class approach** (`ag-theme-quartz-dark`). This is a Phase 7 (Explorer) cleanup item — migrate it to `themeQuartz.withPart(colorSchemeDark)` so theme switching works consistently.

### 8.2 AG Charts (needs rewiring for Phase 1)

AG Charts **does not** auto-read CSS variables. It takes a JS theme object. RecViz already has the bridge: `frontend/src/lib/chart-themes.ts` → `getAgChartsTheme()` / `getEChartsTheme()`, which:

1. Calls `getComputedStyle(document.documentElement).getPropertyValue('--primary')` etc.
2. Resolves any OKLCH string to a hex via a temporary DOM element and `getComputedStyle().color` (verified — works with OKLCH).
3. Builds a palette object and returns it.

**What's broken:** the `series` array at line 84 is hand-coded hex, not derived from CSS variables:

```ts
const series = [
  primary,
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#ec4899', '#14b8a6',
]
```

**Fix for Phase 1:**

```ts
const series = [
  resolveColor('--chart-1'),
  resolveColor('--chart-2'),
  resolveColor('--chart-3'),
  resolveColor('--chart-4'),
  resolveColor('--chart-5'),
  // + optional extension slots if Strategy B was chosen
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

**Theme switching on dark-mode toggle:** `getAgChartsTheme()` is already called per-render in `ag-chart-wrapper.tsx` (verified at the top of the file). The `useTheme()` hook triggers a re-render on toggle, which re-reads CSS variables. So dark-mode swap is already solved — the only missing piece is that the series array doesn't update because it's static.

**Also broken today (cosmetic):** `chart-themes.ts` overrides for heatmap, treemap, and waterfall use hard-coded hex (`'#43A047'`, `'#FF5722'`). These should reference `resolveColor('--chart-1')` / `resolveColor('--chart-5')` or `--destructive` / `--primary` as appropriate. Flag for Phase 4 (Charts page).

### 8.3 ECharts (exotic charts only — Sankey, sunburst, radar, gauge, funnel, parallel coords, network)

Same bridge, same fix. `getEChartsTheme()` in `chart-themes.ts` already reads the CSS-variable palette via `getChartPalette()`; the only tweak needed is to stop hard-coding `series[1..9]` and let them come from `--chart-1..5` + optional `--series-1..8`.

---

## 9. Dark mode — confirmed working, no extra wiring needed

- Every token in every shadcn base theme has a matching `.dark` value. Verified in `themes.ts`.
- RecViz already uses Shadcn's `.dark` class-strategy pattern via `next-themes` / a custom `ThemeProvider`. Verified in `frontend/src/components/layout/theme-provider.tsx` (referenced by the existing codebase map).
- The `@custom-variant dark (&:is(.dark *));` line in `index.css` is still correct for Tailwind v4.
- AG Grid Quartz dark-mode works via `themeQuartz.withPart(colorSchemeDark)` — confirmed in multiple files.
- AG Charts dark-mode works via `useTheme()` → re-read of CSS variables — confirmed in `ag-chart-wrapper.tsx`.

**What Phase 1 must verify:** that `oklch(1 0 0 / 10%)` border and `oklch(1 0 0 / 15%)` input render correctly against the chosen dark background. They do in Mist/Stone/Zinc because the base dark background is a near-black OKLCH value — but if Phase 1 picks a very dark background (say `oklch(0.12 ...)`) the 10% white borders may look fuzzier than expected.

---

## 10. What tweakcn and other community tools give us that shadcn doesn't

**tweakcn** (https://tweakcn.com, maintainer jnsahaj) is the most referenced community tool. It's a web UI that lets you scrub every CSS variable, see live previews of shadcn components, and export the resulting `:root`/`.dark` block as Tailwind v3 or v4 CSS. OKLCH and HSL output, pre-built themes, and an API-free UX.

**Useful for Phase 1** if:
- You want to visually tune a preset (e.g. pick Mist + Blue, then lighten `--muted` slightly for data density).
- You want to compare more than one preset side-by-side without running `shadcn apply` twice.

**Not necessary** for Phase 1. The official `ui.shadcn.com/create` → `shadcn apply` loop covers the "pick a preset and commit" path. tweakcn is only a gain if Phase 1 decides to **deviate** from a registered preset.

Two other tools to **ignore** (not shadcn-official, confidence: LOW, may or may not match the current shadcn token schema):

- shadcnthemer.com
- shadcnstudio.com/theme-generator

Their output has been observed to use older HSL-based formats. If Phase 1 uses them, manually verify every variable name matches `themes.ts`.

---

## 11. Risks and pitfalls

### 11.1 `shadcn apply` rewrites `index.css` in place — back up first

`npx shadcn apply --preset <id>` will touch `:root`, `.dark`, and possibly `@theme inline` in `frontend/src/index.css`. RecViz's **custom `@layer components` micro-interaction rules** (card hover, focus transitions) at the bottom of the file are owned code. Phase 1 must:

1. Git-commit before running `shadcn apply`.
2. Diff the result.
3. Restore any hand-edited content the CLI clobbered.

### 11.2 Chart palette drift between base theme and extension ramp

If Phase 1 picks Strategy B (§5) and also picks an accent like Blue, `--chart-1..5` will become blue shades (from the accent override) while `--series-1..8` stays multi-hue. That's fine for multi-series categorical charts (use `--series-*`) and fine for sequential visualisations (use `--chart-*`), but chart-wrapper code must consistently choose one or the other based on chart type. Phase 4 (Charts page) is where this rule gets codified.

### 11.3 `dashboard_config.ts` currently hard-codes colors in chart appearance

Grep for `colorRange` in `frontend/src/types/chart.ts` and `frontend/src/components/charts/builder/step-appearance.tsx`. Any hard-coded hex in dashboard config JSON (stored in Oracle `recviz_charts.config` column) will survive the palette change and must be audited or migrated during Phase 4. Flag for cross-phase dead-code sweep.

### 11.4 OKLCH browser support

All browsers RecViz cares about (Chrome 111+, Firefox 113+, Safari 15.4+) support `oklch()` natively. Corporate-IE/legacy-Edge is not a concern since this is a modern React 19 app. No fallback needed.

### 11.5 Color-coded status in chart data (Banking-specific)

Reconciliation data often has a `status` column (MATCHED / UNMATCHED / PENDING / DISPUTED). Those statuses typically map to green/red/amber/blue. Phase 1 must decide whether to:

- Use semantic status colors (`text-green-600 dark:text-green-400`, `text-red-600 dark:text-red-400`) — already the convention in CLAUDE.md.
- Or extend the palette with `--status-matched`, `--status-unmatched`, `--status-pending` tokens that data-driven cell renderers can consume.

Recommendation: keep status semantics outside the shadcn palette. Status colors are **data semantics**, not theme. The existing `text-green-600 dark:text-green-400` pattern is correct. Flag only if Phase 1 wants them tokenised for consistency.

---

## 12. Concrete recommendation for the Phase 1 UI-SPEC gate

**Pick: Option B — Mist base + Blue accent.**

Exact set of files to touch in Phase 1:

1. **`frontend/src/index.css`** — replace `:root` and `.dark` OKLCH values with the Mist + Blue combination. (Can be done via `pnpm dlx shadcn@latest apply --preset <mist-blue-id>` if Phase 1 generates a preset URL on ui.shadcn.com/create; otherwise paste the values from §4.6 + §6.1 by hand.)
2. **`frontend/src/index.css`** — add an `.ag-theme-quartz` override block (§8.1) to forward Shadcn tokens into AG Grid's `--ag-*` variables.
3. **`frontend/src/index.css`** — add `--series-1..8` tokens (§5, Strategy B) in both `:root` and `.dark`, and expose them in `@theme inline`.
4. **`frontend/src/lib/chart-themes.ts`** — replace the hard-coded `series` array in `getChartPalette()` with `resolveColor('--chart-1..5')` + `resolveColor('--series-1..8')` reads. Replace the heatmap/treemap hard-coded hex overrides with token reads.
5. **Grep audit** — `frontend/src/` for any remaining `#` hex literals or `rgb(` / `hsl(` literals, flag for cleanup inside the page that owns them during Phases 2–7.

**Phase 1 also rejects (explicitly, in the UI-SPEC gate):**

- Luma style (not appropriate for data-dense desktop BI).
- Mauve / Olive / Taupe base themes (tone mismatch for banking recon).
- Chart-1..5 rainbow replacement (Strategy C in §5).
- Any non-shadcn community theme generator output (risk of outdated token names).

**Phase 1 allows (but does not require):**

- Using ui.shadcn.com/create to generate the preset URL interactively, then `shadcn apply`.
- Using tweakcn to fine-tune after the preset is applied.
- Swapping the accent from Blue to Indigo or Teal if user feedback rejects blue in the UI-SPEC gate.

---

## 13. Confidence assessment

| Area | Level | Rationale |
|------|-------|-----------|
| Shadcn base-theme OKLCH values | HIGH | Read verbatim from `apps/v4/registry/themes.ts` in `shadcn-ui/ui` on GitHub, retrieved via `gh api` |
| Shadcn release dates + tool set (create, cli v4, apply, Luma) | HIGH | Verified against ui.shadcn.com/docs/changelog |
| CSS-variable surface (Tailwind v4 names) | HIGH | Verified against both shadcn docs and RecViz's current `index.css` |
| New base colors (mauve/olive/mist/taupe) existence | HIGH | Confirmed via shadcn themes registry + Tailwind PR #19627 |
| AG Grid Theming API dark-mode pattern | HIGH | Verified directly against RecViz source code |
| AG Charts CSS-variable reading (non-auto) | HIGH | Verified against AG Charts docs + RecViz `chart-themes.ts` |
| Phase-1 recommendation (Option B: Mist + Blue) | MEDIUM | Opinionated. Tone match is subjective — Phase 1 human-in-the-loop should sanity-check visually before committing. |
| `shadcn apply` preserving custom `@layer components` CSS | MEDIUM | Not directly tested on this codebase. Docs say it rewrites the preset block; custom CSS outside that block should survive, but **git-commit before running** is mandatory. |
| Status-colour pattern (keep green/red semantic utilities vs. tokenise) | MEDIUM | Recommendation is based on CLAUDE.md convention, not a general-industry citation. |

---

## 14. Sources

- [Theming — shadcn/ui](https://ui.shadcn.com/docs/theming)
- [Tailwind v4 — shadcn/ui](https://ui.shadcn.com/docs/tailwind-v4)
- [Colors — shadcn/ui](https://ui.shadcn.com/colors)
- [Changelog — shadcn/ui](https://ui.shadcn.com/docs/changelog)
- [Pick a Color. Make it yours. — shadcn/ui](https://ui.shadcn.com/create)
- [December 2025 — npx shadcn create](https://ui.shadcn.com/docs/changelog/2025-12-shadcn-create)
- [February 2025 — Tailwind v4 (shadcn changelog)](https://ui.shadcn.com/docs/changelog/2025-02-tailwind-v4)
- [March 2026 — Introducing Luma](https://ui.shadcn.com/docs/changelog/2026-03-luma)
- [March 2026 — shadcn/cli v4](https://ui.shadcn.com/docs/changelog/2026-03-cli-v4)
- [April 2026 — shadcn apply](https://ui.shadcn.com/docs/changelog/2026-04-shadcn-apply)
- [shadcn-ui/ui — apps/v4/registry/themes.ts (source of every preset used above)](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/themes.ts)
- [Tailwind CSS PR #19627 — Add mauve, olive, mist, taupe color palettes](https://github.com/tailwindlabs/tailwindcss/pull/19627)
- [tweakcn — Theme Editor & Generator](https://tweakcn.com/)
- [tweakcn GitHub (jnsahaj/tweakcn)](https://github.com/jnsahaj/tweakcn)
- [AG Charts — Themes](https://www.ag-grid.com/charts/javascript/themes/)
- [AG Grid — Built-in themes](https://www.ag-grid.com/javascript-data-grid/themes/)
- [AG Grid — Dynamic theme styling by updating CSS variables](https://ag-grid.zendesk.com/hc/en-us/articles/4405917557137-Dynamic-Theme-Styling-By-Updating-CSS-Variables)
