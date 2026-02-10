import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from '@/lib/query-client'
import { useKpiData } from '@/hooks/use-kpi-data'
import { useDatasets } from '@/hooks/use-datasets'
import { usePrefetch } from '@/hooks/use-prefetch'

function Dashboard() {
  const { data: kpi, isLoading: kpiLoading } = useKpiData()
  const { data: datasets, isLoading: dsLoading } = useDatasets()

  usePrefetch()

  if (kpiLoading || dsLoading) {
    return <div className="p-8 text-muted-foreground">Loading...</div>
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">RecViz — Phase 7 Verified</h1>

      {kpi && (
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-lg border p-4 text-center">
            <div className="text-sm text-muted-foreground">Total Breaks</div>
            <div className="text-2xl font-bold">{kpi.totalBreaks.toLocaleString()}</div>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <div className="text-sm text-muted-foreground">Resolution Rate</div>
            <div className="text-2xl font-bold">{kpi.resolutionRate}%</div>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <div className="text-sm text-muted-foreground">Match Rate</div>
            <div className="text-2xl font-bold">{kpi.matchRate}%</div>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <div className="text-sm text-muted-foreground">SLA Breaches</div>
            <div className="text-2xl font-bold">{kpi.slaBreaches.toLocaleString()}</div>
          </div>
        </div>
      )}

      {datasets && (
        <div className="text-sm text-muted-foreground">
          {datasets.length} datasets loaded: {datasets.map((d) => d.name).join(', ')}
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
