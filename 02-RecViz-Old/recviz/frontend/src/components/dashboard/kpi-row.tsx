import { KpiCard } from '@/components/dashboard/kpi-card'
import { MOCK_KPI_DATA } from '@/lib/mock/dashboard-config'

interface KpiRowProps {
  loading?: boolean
}

export function KpiRow({ loading = false }: KpiRowProps) {
  const data = MOCK_KPI_DATA

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {data.map((kpi, index) => (
        <KpiCard
          key={kpi.title}
          title={kpi.title}
          value={kpi.value}
          previousValue={kpi.previousValue}
          format={kpi.format}
          invertTrend={kpi.invertTrend}
          loading={loading}
          index={index}
        />
      ))}
    </div>
  )
}
