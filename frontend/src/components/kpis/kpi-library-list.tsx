import { useState, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Gauge, Plus } from 'lucide-react'

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
import { useManagedKpis } from '@/hooks/use-managed-kpis'
import { useManagedDatasets } from '@/hooks/use-managed-datasets'
import { KpiLibraryToolbar } from './kpi-library-toolbar'
import { KpiLibraryCard } from './kpi-library-card'
import { KpiLibraryRow } from './kpi-library-row'
import { KpiDetailPanel } from './kpi-detail-panel'
import type { RecvizDataset } from '@/types/managed-dataset'

type ViewMode = 'grid' | 'list'

export function KpiLibraryList() {
  const { data: kpis = [], isLoading: kpisLoading } = useManagedKpis()
  const { data: datasets = [] } = useManagedDatasets()
  const navigate = useNavigate()

  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [datasetFilter, setDatasetFilter] = useState<string>('all')
  const [selectedKpiId, setSelectedKpiId] = useState<string | null>(null)

  const datasetMap = useMemo(() => {
    const map = new Map<string, { name: string; dataset: RecvizDataset }>()
    for (const ds of datasets) {
      map.set(ds.id, { name: ds.name, dataset: ds })
    }
    return map
  }, [datasets])

  const filtered = useMemo(() => {
    let result = kpis
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (k) =>
          k.name.toLowerCase().includes(q) ||
          k.description.toLowerCase().includes(q),
      )
    }
    if (datasetFilter !== 'all') {
      result = result.filter((k) => k.datasetId === datasetFilter)
    }
    return result
  }, [kpis, searchQuery, datasetFilter])

  const isEmpty =
    !kpisLoading && kpis.length === 0 && !searchQuery && datasetFilter === 'all'

  return (
    <div className="space-y-4">
      {!isEmpty && (
        <KpiLibraryToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          datasetFilter={datasetFilter}
          onDatasetFilterChange={setDatasetFilter}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          datasets={datasets}
        />
      )}

      {kpisLoading ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[148px] rounded-lg" />
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
              <Gauge />
            </EmptyMedia>
            <EmptyTitle>No KPIs yet</EmptyTitle>
            <EmptyDescription>
              Create your first KPI template to get started.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              size="sm"
              onClick={() => navigate({ to: '/kpis/new' })}
            >
              <Plus className="mr-1.5 size-3.5" />
              Create KPI
            </Button>
          </EmptyContent>
        </Empty>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No KPIs matching &ldquo;{searchQuery}&rdquo;
        </p>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((kpi) => {
            const ds = datasetMap.get(kpi.datasetId)
            return (
              <KpiLibraryCard
                key={kpi.id}
                kpi={kpi}
                datasetName={ds?.name ?? 'Unknown'}
                datasetDatabaseId={ds?.dataset.databaseId}
                datasetSql={ds?.dataset.sql}
                onClick={() => setSelectedKpiId(kpi.id)}
              />
            )
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((kpi) => (
            <KpiLibraryRow
              key={kpi.id}
              kpi={kpi}
              datasetName={datasetMap.get(kpi.datasetId)?.name ?? 'Unknown'}
              onClick={() => setSelectedKpiId(kpi.id)}
            />
          ))}
        </div>
      )}

      <KpiDetailPanel
        kpiId={selectedKpiId}
        open={selectedKpiId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedKpiId(null)
        }}
        datasetMap={datasetMap}
      />
    </div>
  )
}
