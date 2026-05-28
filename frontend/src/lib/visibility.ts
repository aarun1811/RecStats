import type { KpiResult, VisibleWhen } from '@/types/dashboard-config'

/**
 * KPI-value-based visibility check. Used to gate KPI cards, chart panels,
 * and data grids on aggregated values. Returns `true` (visible) when:
 *  - `visibleWhen` is undefined (no rule = always show), OR
 *  - `kpiResults` is undefined (results not loaded yet = optimistic show), OR
 *  - the referenced KPI id is missing from `kpiResults` (config drift =
 *    fail-open rather than hide a panel due to a typo).
 *
 * Extracted from the original local helper in
 * `components/dashboard/config-data-grid.tsx` (no semantic change). Now
 * also consumed by ConfigKpiRow and ConfigChartGrid for KPI/chart-level
 * gating (Plan 4 §12.1).
 */
export function isVisible(
  visibleWhen: VisibleWhen | undefined,
  kpiResults: KpiResult[] | null | undefined,
): boolean {
  if (!visibleWhen || !kpiResults) return true
  const kpi = kpiResults.find((k) => k.id === visibleWhen.kpi)
  if (!kpi) return true
  switch (visibleWhen.condition) {
    case 'gt':
      return kpi.value > visibleWhen.value
    case 'lt':
      return kpi.value < visibleWhen.value
    case 'eq':
      return kpi.value === visibleWhen.value
    default:
      return true
  }
}
