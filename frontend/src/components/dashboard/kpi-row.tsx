import { useMemo } from 'react'
import { AlertTriangle, CheckCircle, Clock, ShieldAlert } from 'lucide-react'
import { useKpiData } from '@/hooks/use-kpi-data'
import { useBreaksData } from '@/hooks/use-breaks-data'
import { useFilterStore } from '@/stores/filter-store'
import { rowPassesCrossFilters } from '@/lib/cross-filter'
import { KpiCard, KpiCardSkeleton } from './kpi-card'
import type { KpiData } from '@/types/api'

/** Compute KPI values from cross-filtered row data. */
function computeKpis(rows: Record<string, unknown>[]): KpiData {
  const total = rows.length
  const resolved = rows.filter((r) => r.status === 'Resolved').length
  const agingDays = rows.map((r) => Number(r.agingDays ?? r.aging_days ?? 0))
  const avgAge = total > 0 ? agingDays.reduce((a, b) => a + b, 0) / total : 0
  const sla = rows.filter((r) => r.slaBreach === true || r.slaBreach === 'true' || r.sla_breach === true).length

  return {
    totalBreaks: total,
    openBreaks: total - resolved,
    resolutionRate: total > 0 ? (resolved / total) * 100 : 0,
    avgAgeDays: avgAge,
    slaBreaches: sla,
    totalTransactions: 0,
    matchRate: 0,
    breakAmount: 0,
  }
}

export function KpiRow() {
  const { data: kpi, isLoading } = useKpiData()
  const { data: breaksData } = useBreaksData()
  const crossFilters = useFilterStore((s) => s.crossFilters)

  // When cross-filters are active, recompute KPIs client-side from filtered data
  const effectiveKpi = useMemo(() => {
    if (crossFilters.length === 0 || !breaksData?.data?.length) return kpi ?? null
    const filtered = breaksData.data.filter((row) =>
      rowPassesCrossFilters(row as Record<string, unknown>, crossFilters),
    )
    return computeKpis(filtered)
  }, [kpi, breaksData, crossFilters])

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (!effectiveKpi) return null

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KpiCard
        title="Total Breaks"
        value={effectiveKpi.totalBreaks}
        icon={AlertTriangle}
        format="number"
        trend={{ value: 3.2, isPositive: false }}
      />
      <KpiCard
        title="Resolution Rate"
        value={effectiveKpi.resolutionRate}
        icon={CheckCircle}
        format="percent"
        suffix="%"
        decimals={1}
        trend={{ value: 5.1, isPositive: true }}
      />
      <KpiCard
        title="Avg Aging (Days)"
        value={effectiveKpi.avgAgeDays}
        icon={Clock}
        format="decimal"
        decimals={1}
        trend={{ value: 1.8, isPositive: false }}
      />
      <KpiCard
        title="SLA Breaches"
        value={effectiveKpi.slaBreaches}
        icon={ShieldAlert}
        format="number"
        trend={{ value: 12.5, isPositive: false }}
      />
    </div>
  )
}
