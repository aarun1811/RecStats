import { createPart, themeQuartz } from 'ag-grid-community'

/**
 * AG-Grid v35 Theming-API theme for RecViz dashboard grids.
 *
 * MIRROR FILE: `autosys-job-explorer/frontend-react/src/search/lib/gridTheme.ts`
 *
 * Sync rule (best-effort, no CI enforcement):
 *  - Visual params (colors, borders, hover/selected, header chrome) are kept
 *    in lockstep with rectrace's gridTheme.ts. Any change here SHOULD also
 *    be applied there, and vice-versa.
 *  - Density params (fontSize, headerFontSize, cellHorizontalPadding,
 *    spacing, iconSize) are deliberately SKIPPED here — RecViz uses Quartz
 *    defaults to preserve current row density.
 *  - CSS rules in the gridBodyPart are SCOPED to rules that apply to flat
 *    dashboard grids: rectrace-only rules for row-group panel, sidebar
 *    tabs, group rows, and auto-group cells are NOT mirrored.
 *
 * When rectrace's gridTheme.ts changes, audit this file. Drift is reviewed
 * during quarterly design audits if not caught earlier.
 *
 * Params reference shadcn oklch CSS variables directly so the grid follows
 * the .dark cascade automatically — no JS-level theme switching needed. The
 * grid container in each dashboard grid component carries
 * data-ag-theme-mode={resolvedTheme} so AG-Grid's own popups and
 * scrollbars pick the right scheme (see config-data-grid.tsx +
 * drill-detail-grid.tsx).
 */

const gridBodyPart = createPart({
  css: `.ag-cell { font-variant-numeric: tabular-nums; }
.ag-row { transition: background-color 120ms ease; }
.ag-row-selected { box-shadow: inset 2px 0 0 0 var(--color-primary); }
/* Gmail-inspired hover hairline (mirror of rectrace gridBodyPart). The
   single-state rule + the combined hover+selected rule together preserve
   the selected left-edge AND the hover hairlines on a hovered-selected
   row — CSS does not auto-compose two separate box-shadow declarations. */
.ag-row-hover {
  box-shadow:
    inset 0 1px 0 0 color-mix(in oklab, var(--color-foreground) 20%, transparent),
    inset 0 -1px 0 0 color-mix(in oklab, var(--color-foreground) 20%, transparent);
}
.ag-row-hover.ag-row-selected {
  box-shadow:
    inset 2px 0 0 0 var(--color-primary),
    inset 0 1px 0 0 color-mix(in oklab, var(--color-foreground) 20%, transparent),
    inset 0 -1px 0 0 color-mix(in oklab, var(--color-foreground) 20%, transparent);
}
.ag-header-cell-text { letter-spacing: 0.005em; }
.ag-header-cell-resize::after { opacity: 0; transition: opacity 120ms ease; }
.ag-header-cell:hover .ag-header-cell-resize::after { opacity: 1; }
/* filter popup polish — RecViz dashboards enable column filters via
   DEFAULT_COL_DEF.filter: true in config-data-grid.tsx + drill-detail-grid.tsx */
.ag-filter-apply-panel-button { border-radius: 7px; font-weight: 550; transition: filter 120ms ease, background-color 120ms ease; }
.ag-filter-apply-panel-button:last-child {
  background: var(--color-primary); color: var(--color-primary-foreground);
  border-color: transparent;
}
.ag-filter-apply-panel-button:last-child:hover { filter: brightness(1.06); }
.ag-filter-apply-panel-button:not(:last-child) {
  background: transparent; color: var(--color-foreground);
  border: 1px solid var(--color-border);
}
.ag-filter-apply-panel-button:not(:last-child):hover { background: color-mix(in oklab, var(--color-foreground) 7%, transparent); }
.ag-filter .ag-input-field-input:focus,
.ag-filter .ag-picker-field-wrapper:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-primary) 22%, transparent);
}`,
})

export const gridTheme = themeQuartz
  .withParams({
    accentColor: 'var(--color-primary)',
    backgroundColor: 'var(--color-background)',
    foregroundColor: 'var(--color-foreground)',
    chromeBackgroundColor: 'color-mix(in oklab, var(--color-muted) 55%, var(--color-background))',
    headerBackgroundColor: 'color-mix(in oklab, var(--color-muted) 55%, var(--color-background))',
    headerTextColor: 'color-mix(in oklab, var(--color-foreground) 70%, transparent)',
    borderColor: 'var(--color-border)',
    wrapperBorder: false,
    columnBorder: false,
    headerColumnBorder: { color: 'color-mix(in oklab, var(--color-border) 75%, transparent)' },
    headerColumnBorderHeight: '58%',
    rowBorder: { color: 'color-mix(in oklab, var(--color-foreground) 7%, transparent)' },
    rowHoverColor: 'color-mix(in oklab, var(--color-primary) 6%, transparent)',
    selectedRowBackgroundColor: 'color-mix(in oklab, var(--color-primary) 13%, transparent)',
    oddRowBackgroundColor: 'transparent',
    fontFamily: 'Geist Variable, system-ui, sans-serif',
    headerFontFamily: 'Geist Variable, system-ui, sans-serif',
    headerFontWeight: 550,
    wrapperBorderRadius: 0,
  })
  .withPart(gridBodyPart)
