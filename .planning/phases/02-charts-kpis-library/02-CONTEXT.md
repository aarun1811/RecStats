# Phase 2: Charts + KPIs Library - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning
**Mode:** Auto-generated (seed data design — decisions derived from dataset inventory)

<domain>
## Phase Boundary

Expand the curated charts from 22 to 40-50 and KPIs from 12 to 15-20 in `scripts/seed-oracle.py`. Every chart config must validate against the builder schema (valid `columnMapping`, `typeSpecific`). Every KPI must have proper threshold, trend, format, and aggregation configs.

</domain>

<decisions>
## Implementation Decisions

### Chart Design Strategy
- **D-01:** Design charts per dataset — each of the 17 datasets should have 2-4 charts showing different visualizations of the same data. This ensures every dataset is used and charts are diverse.
- **D-02:** Chart type distribution target: ~15 bar/line/area (AG Charts basics), ~8 pie/donut, ~5 heatmap/treemap/waterfall (AG Charts advanced), ~5 scatter/combo, ~7 ECharts exotic (sankey, radar, gauge, funnel, parallel-coords). Total: ~40-50.
- **D-03:** Every chart must have a meaningful `name` and `description` — no "Chart 1" or generic names. Names should tell the user what insight the chart provides.
- **D-04:** `columnMapping.categoryColumn` must reference an actual column from the dataset's `columns` array. `metricColumns` must reference actual measure columns.
- **D-05:** Charts that support `typeSpecific` config (heatmap, gauge, treemap, waterfall, pie/donut) must have it set correctly — not left empty.

### Chart Config Schema Compliance
- **D-06:** The `_chart()` helper function must produce configs that match `ChartConfigSchema` in the frontend: `{ columnMapping: { categoryColumn, metricColumns, colorKey?, sizeKey? }, appearance: { showLegend, legendPosition, showXLabel, showYLabel, interactive }, typeSpecific: {...} }`
- **D-07:** Chart IDs use the `chart-{slug}` pattern (no UUIDs) — must match exactly what dashboards reference in Phase 3.

### KPI Design Strategy
- **D-08:** 15-20 KPIs covering: transaction volume (SUM), break count (SUM), match rate (AVG %), SLA breach rate (AVG %), aging days (AVG), high-value exposure (SUM $), auto-match % (COUNT), counterparty concentration (COUNT_DISTINCT), open breaks (SUM), confidence score (AVG), daily volume (SUM), resolved rate (AVG %), and a few per-region/per-desk variants.
- **D-09:** Every KPI `threshold` config must have meaningful green/amber/red levels. Example: match rate green > 90%, amber > 75%, red < 75%.
- **D-10:** Every KPI `trend` config uses either `previous_period` (vs last week/month/day) or `static_target` (target: 95% for SLA).
- **D-11:** KPI `format` must match the metric type: `percentage` for rates, `currency` for USD amounts, `number` for counts, `decimal` for scores.

### Additional Datasets (if needed)
- **D-12:** If 17 datasets aren't enough for 40-50 diverse charts, add up to 5 more datasets with new SQL queries. Candidates: desk-level breaks, currency-level match rates, monthly aggregations, counterparty breaks, SLA by desk.

### Claude's Discretion
- Exact chart names and descriptions
- Which chart types to use for each dataset
- typeSpecific config values (heatmap ranges, gauge min/max, etc.)
- Additional dataset SQL queries
- KPI threshold exact values
- KPI trend period choices

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — CHRT-01 through CHRT-05, KPI-01 through KPI-05

### Seed script
- `scripts/seed-oracle.py` — Current file with 17 datasets, 22 charts, 12 KPIs (to expand)

### Frontend types (chart config validation)
- `frontend/src/types/managed-chart.ts` — RecvizChart, ChartConfigSchema
- `frontend/src/types/managed-kpi.ts` — RecvizKpi, KpiFormatConfig, TrendConfig, ThresholdConfig
- `frontend/src/components/charts/chart-factory.tsx` — SUPPORTED_AG_TYPES, ECHART_TYPES

</canonical_refs>

<code_context>
## Existing Code Insights

### Current Chart Inventory (22 charts)
The `_chart()` helper produces chart entries. Current types: heatmap(1), stacked-bar(1), line(1), area(1), bar(4), pie(2), donut(1), scatter(1), waterfall(1), treemap(1), combo(1), histogram(1), sankey(1), radar(1), gauge(1), funnel(1), graph(1), parallel-coords(1)

### Current KPI Inventory (12 KPIs)
Uses `_kpi()` helper with: aggregation, metric_column, format, trend, threshold configs.

### Available Datasets (17)
Each has SQL, columns with roles (dimension/measure/time), and filter mappings.

</code_context>

<specifics>
## Specific Ideas

- The script only modifies `CURATED_CHARTS`, `CURATED_KPIS` arrays and adds new datasets if needed to `CURATED_DATASETS`
- No frontend or backend code changes
- Charts should be designed to look good on dashboards — Phase 3 will compose them

</specifics>

<deferred>
## Deferred Ideas

- Dashboard composition — Phase 3
- Visual verification — Phase 3

</deferred>

---

*Phase: 02-charts-kpis-library*
*Context gathered: 2026-04-13*
