import { AlertTriangle, CheckCircle, Clock, ShieldAlert } from 'lucide-react'
import { useKpiData } from '@/hooks/use-kpi-data'
import { KpiCard, KpiCardSkeleton } from './kpi-card'

export function KpiRow() {
  const { data: kpi, isLoading } = useKpiData()

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (!kpi) return null

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KpiCard
        title="Total Breaks"
        value={kpi.totalBreaks}
        icon={AlertTriangle}
        format="number"
        trend={{ value: 3.2, isPositive: false }}
      />
      <KpiCard
        title="Resolution Rate"
        value={kpi.resolutionRate}
        icon={CheckCircle}
        format="percent"
        suffix="%"
        decimals={1}
        trend={{ value: 5.1, isPositive: true }}
      />
      <KpiCard
        title="Avg Aging (Days)"
        value={kpi.avgAgeDays}
        icon={Clock}
        format="decimal"
        decimals={1}
        trend={{ value: 1.8, isPositive: false }}
      />
      <KpiCard
        title="SLA Breaches"
        value={kpi.slaBreaches}
        icon={ShieldAlert}
        format="number"
        trend={{ value: 12.5, isPositive: false }}
      />
    </div>
  )
}
