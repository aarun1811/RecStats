# Chart Config Audit

Audit of required vs captured vs applied configuration per chart type. Documents what each renderer needs, what the builder currently captures, and where gaps exist.

## Summary

- **Total chart types:** 20
- **Types with no config gaps:** 8 (bar, stacked-bar, line, area, combo, sankey, graph, parallel)
- **Types with config gaps:** 12

### Gap Chart Types

| Chart Type | Gap Severity | Gap Description |
|-----------|-------------|-----------------|
| pie | Low | No label position config in appearance step |
| donut | Low | No inner radius ratio config in appearance step |
| scatter | Medium | No bubble size key config in builder (3rd metric) |
| heatmap | Medium | No colorRange field in appearance step; builder uses secondary dim encoding |
| treemap | Medium | No colorKey config; no colorRange field in appearance step |
| waterfall | Medium | No positive/negative color config; no subtotal/total row marking |
| bullet | High | Rendered as plain bar; no target/range config fields |
| box-plot | High | Rendered as plain bar; no min/q1/median/q3/max field mapping |
| gauge | High | No min/max/threshold config; hardcoded 0-100 range |
| sunburst | Medium | No hierarchical level mapping; relies on pre-shaped data |
| radar | Low | No max-value override per indicator |
| funnel | Low | No sort direction or gap config |

### Priority Gaps for Plan 03 (ranked by user impact)

1. **gauge** -- min/max/threshold are essential for meaningful gauges; currently hardcoded 0-100
2. **box-plot** -- renders as bar chart, not a real box plot; needs 5-number summary field mapping
3. **bullet** -- renders as bar chart, not a real bullet chart; needs target/range fields
4. **treemap** -- no colorKey selection means color dimension is implicit; no colorRange picker
5. **heatmap** -- no colorRange picker; secondary dim encoding works but is non-obvious
6. **waterfall** -- no positive/negative color or subtotal config
7. **scatter** -- bubble size (3rd metric) not exposed in builder
8. **sunburst** -- hierarchical data needs level mapping (or documented pre-shape requirement)
9. **donut** -- inner radius ratio not configurable (hardcoded 0.6)
10. **pie/funnel/radar** -- minor appearance gaps (label position, sort, max values)

---

## Detailed Audit

### AG Charts Types

| Chart Type | Engine | Required Config Fields | Builder Captures | Renderer Applies | Gaps |
|-----------|--------|----------------------|------------------|------------------|------|
| bar | AG Charts | categoryColumn, metricColumns[] | categoryColumn via X-Axis select, metricColumns via multi-select with aggregation | xKey=categoryColumn, yKey per metric, stacked=false, cornerRadius=4 | None |
| stacked-bar | AG Charts | categoryColumn, metricColumns[] | categoryColumn via X-Axis select, metricColumns via multi-select with aggregation | xKey=categoryColumn, yKey per metric, stacked=true, cornerRadius=4 | None |
| line | AG Charts | categoryColumn, metricColumns[] | categoryColumn via X-Axis select, metricColumns via multi-select | xKey=categoryColumn, yKey per metric, strokeWidth=2, marker size=4 | None |
| area | AG Charts | categoryColumn, metricColumns[] | categoryColumn via X-Axis select, metricColumns via multi-select | xKey=categoryColumn, yKey per metric, fillOpacity=0.15 | None |
| pie | AG Charts | categoryColumn, metricColumns[0] | categoryColumn via Category select, single metric | angleKey=metric, calloutLabelKey=category, sectorLabelKey=metric | No label position config (callout vs sector vs inside); theme provides defaults |
| donut | AG Charts | categoryColumn, metricColumns[0] | categoryColumn via Category select, single metric | angleKey=metric, calloutLabelKey=category, innerRadiusRatio=0.6 | No inner radius ratio config; hardcoded 0.6 in both buildSeries and theme |
| scatter | AG Charts | metricColumns[0] (X), metricColumns[1] (Y), optional metricColumns[2] (size) | X-Metric select, Y-Metric single select (both from measures) | xKey=metrics[0], yKey=metrics[1], sizeKey=metrics[2] if present | Builder only captures 2 metrics; 3rd metric (bubble size) not exposed in UI |
| heatmap | AG Charts | categoryColumn (X), secondary dim (Y), metricColumns[0] (color) | categoryColumn via X-Axis, secondary dim via Y-Axis select, Color Metric as single metric | xKey=categoryColumn, yKey=secondary dim, colorKey=metric; colorRange from appearance or theme | No colorRange picker in appearance step; falls back to theme --color-ramp-low/high |
| treemap | AG Charts | categoryColumn (label), metricColumns[0] (size), optional metricColumns[1] (color) | categoryColumn via Category select, single metric | labelKey=category, sizeKey=metrics[0], colorKey=metrics[1] if present, colorRange from appearance or resolveColor fallback | No colorKey selection (only 1 metric captured); no colorRange picker; color dimension requires manually adding 2nd metric |
| waterfall | AG Charts | categoryColumn, metricColumns[0] | categoryColumn via Category select, single metric | xKey=categoryColumn, yKey=metric, item positive/negative names hardcoded | No positive/negative color config; no subtotal/total row marking; names hardcoded as "Increase"/"Decrease" |
| bullet | AG Charts | categoryColumn, metricColumns[0] (actual), target value, range bands | categoryColumn via Category select, single metric | Rendered as plain bar chart (type='bar'); no bullet-specific series config | Completely missing target/range config; renders as bar, not a real bullet chart |
| box-plot | AG Charts | categoryColumn, min/q1/median/q3/max columns | categoryColumn via Category select, single Value metric | Rendered as plain bar chart (type='bar'); no box-plot series config | Completely missing 5-number summary field mapping; renders as bar, not a real box plot |
| combo | AG Charts | categoryColumn, metricColumns[0] (bar), metricColumns[1] (line) | categoryColumn via X-Axis, multi-select metrics (min 2 required) | First metric as bar series, second metric as line series | None -- builder enforces min 2 metrics, renderer splits correctly |
| histogram | AG Charts | categoryColumn, metricColumns[0] | Not in MAPPING_FIELD_LABELS (not offered in builder type step) | Rendered as bar (type='bar') | Not offered as a builder type; only reachable via direct config. Low priority -- histogram is a presentation variant of bar |

### ECharts Types

| Chart Type | Engine | Required Config Fields | Builder Captures | Renderer Applies | Gaps |
|-----------|--------|----------------------|------------------|------------------|------|
| sankey | ECharts | Positional: columns[0]=source, columns[1]=target, columns[2]=value | categoryColumn=Source, secondary dim=Target via Y-Axis select, metric=Value | Positional columns (source, target, value); ignores config-driven fields | None functionally -- builder captures source/target/value via secondary dim encoding; renderer uses positional columns which align with dataset column order |
| radar | ECharts | categoryColumn (indicators), metricColumns[] (axes) | categoryColumn via Category select, multi-select metrics (min 2 required) | Config-driven: categoryKey for indicator names, metricColumns for radar axes; auto-calculates max per indicator at 1.2x | No max-value override per indicator; auto-calculated from data (acceptable default) |
| sunburst | ECharts | Hierarchical data structure (pre-shaped) | categoryColumn=Levels, single metric=Value | Passes raw data directly to series[].data; radius 15%-90% | No hierarchical level mapping; relies entirely on pre-shaped data array. Builder captures fields but renderer ignores them |
| gauge | ECharts | metricColumns[0] (value), categoryColumn (label), min, max, thresholds | categoryColumn empty (no label), single metric | Config-driven: metricKey for value, categoryKey for label; hardcoded 0-100 range, 3-band color stops at 0.3/0.7/1.0 | No min/max config (hardcoded 0-100); no threshold config (hardcoded 30/70/100 stops); no band count config; builder hides category label |
| funnel | ECharts | categoryColumn, metricColumns[0] | categoryColumn via Category select, single metric | Config-driven: categoryKey for name, metricKey for value; descending sort, 2px gap | No sort direction config (hardcoded descending); no gap config; no label position config |
| graph | ECharts | Positional: columns[0]=source, columns[1]=target, columns[2]=weight | categoryColumn=Source, secondary dim=Target, metric=Weight | Positional columns (source, target, value); force layout with repulsion=200 | None functionally -- same encoding pattern as sankey |
| parallel | ECharts | All columns as parallel dimensions, metricColumns for highlighting | categoryColumn=Category, multi-select metrics (min 2 required) | All columns as dimensions; lineStyle width=1, opacity=0.3 | None -- all columns used as dimensions by design; metric selection drives highlighting |

---

## Cross-Cutting Observations

### Appearance Step Coverage

The `StepAppearance` component captures exactly 4 fields for ALL chart types uniformly:

1. `showLegend` (boolean toggle)
2. `legendPosition` (top/bottom/left/right select, shown when legend enabled)
3. `showXLabel` (boolean toggle)
4. `showYLabel` (boolean toggle)

**Missing per-type appearance fields:**
- **All types:** No title input (field exists in `ChartAppearance` interface but not in builder UI)
- **heatmap/treemap:** No `colorRange` picker (2-color gradient selection)
- **donut:** No `innerRadiusRatio` slider
- **pie/donut:** No label position (callout vs inside vs none)
- **gauge:** No min/max/threshold inputs
- **waterfall:** No positive/negative color pickers
- **funnel:** No sort direction toggle
- **scatter:** No point size range

### ChartColumnMapping Limitations

The `ChartColumnMapping` interface has 3 fields: `categoryColumn`, `metricColumns[]`, `aggregations{}`. Chart types that need additional dimension fields (heatmap Y-axis, sankey target, graph target) encode the secondary dimension as `metricColumns[0]`, shifting actual metrics to `metricColumns[1+]`. This works but is a convention, not a typed field.

Types that need specialized field mapping (box-plot's 5-number summary, bullet's target/ranges, gauge's min/max/thresholds) cannot express their requirements within the current `ChartColumnMapping` interface. These render as simplified fallbacks (bar charts) today.

### Renderer vs Theme Overlap

Both `ag-chart-wrapper.tsx` (via `buildSeries`) and `chart-themes.ts` (via `getAgChartsTheme`) define appearance properties for the same chart types. The theme sets base styling (colors, fonts, spacing) while the wrapper sets data-binding (keys, stacked mode). For `treemap.colorRange`, both locations define it:
- Theme: `[resolveColor('--chart-positive'), resolveColor('--chart-negative')]`
- Wrapper: `appearance?.colorRange ?? [resolveColor('--chart-positive'), resolveColor('--chart-negative')]`

The wrapper's `appearance?.colorRange` takes precedence when provided, falling through to the same CSS variable defaults. This is correct but the duplication should be noted.
