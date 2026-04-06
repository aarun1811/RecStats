import { useState, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { PieChart, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { useManagedCharts } from '@/hooks/use-managed-charts'
import { useManagedDatasets } from '@/hooks/use-managed-datasets'
import { ChartLibraryToolbar } from './chart-library-toolbar'
import { ChartLibraryCard } from './chart-library-card'
import { ChartLibraryRow } from './chart-library-row'
import { ChartDetailPanel } from './chart-detail-panel'

type ViewMode = 'grid' | 'list'

export function ChartLibraryList() {
  const { data: charts = [], isLoading: chartsLoading } = useManagedCharts()
  const { data: datasets = [] } = useManagedDatasets()
  const navigate = useNavigate()

  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [datasetFilter, setDatasetFilter] = useState<string>('all')
  const [selectedChartId, setSelectedChartId] = useState<string | null>(null)

  const datasetMap = useMemo(() => {
    const map = new Map<string, { name: string; dataset: typeof datasets[number] }>()
    for (const ds of datasets) {
      map.set(ds.id, { name: ds.name, dataset: ds })
    }
    return map
  }, [datasets])

  const filtered = useMemo(() => {
    let result = charts
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q),
      )
    }
    if (typeFilter !== 'all') {
      result = result.filter((c) => c.chartType === typeFilter)
    }
    if (datasetFilter !== 'all') {
      result = result.filter((c) => c.datasetId === datasetFilter)
    }
    return result
  }, [charts, searchQuery, typeFilter, datasetFilter])

  const isEmpty =
    !chartsLoading && charts.length === 0 && !searchQuery && typeFilter === 'all' && datasetFilter === 'all'

  return (
    <div className="space-y-4">
      {!isEmpty && (
        <ChartLibraryToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          datasetFilter={datasetFilter}
          onDatasetFilterChange={setDatasetFilter}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          datasets={datasets}
        />
      )}

      {chartsLoading ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[220px] rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[56px] rounded-lg" />
            ))}
          </div>
        )
      ) : isEmpty ? (
        <Empty className="border rounded-lg">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PieChart />
            </EmptyMedia>
            <EmptyTitle>No charts yet</EmptyTitle>
            <EmptyDescription>
              Create your first chart to start building dashboards. Pick a
              dataset, choose a chart type, and map your columns.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              size="sm"
              onClick={() => navigate({ to: '/charts/new' })}
            >
              <Plus className="mr-1.5 size-3.5" />
              Create Chart
            </Button>
          </EmptyContent>
        </Empty>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No charts matching &ldquo;{searchQuery}&rdquo;
        </p>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((chart) => {
            const ds = datasetMap.get(chart.datasetId)
            return (
              <ChartLibraryCard
                key={chart.id}
                chart={chart}
                dataset={ds?.dataset}
                datasetName={ds?.name ?? 'Unknown'}
                onClick={() => setSelectedChartId(chart.id)}
              />
            )
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((chart) => (
            <ChartLibraryRow
              key={chart.id}
              chart={chart}
              datasetName={datasetMap.get(chart.datasetId)?.name ?? 'Unknown'}
              onClick={() => setSelectedChartId(chart.id)}
            />
          ))}
        </div>
      )}

      <ChartDetailPanel
        chartId={selectedChartId}
        datasetName={
          selectedChartId
            ? datasetMap.get(
                charts.find((c) => c.id === selectedChartId)?.datasetId ?? '',
              )?.name ?? 'Unknown'
            : ''
        }
        onClose={() => setSelectedChartId(null)}
      />
    </div>
  )
}
