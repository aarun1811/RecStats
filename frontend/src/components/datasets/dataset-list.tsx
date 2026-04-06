import { useState, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Table2 } from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { useManagedDatasets } from '@/hooks/use-managed-datasets'
import { useDatabases } from '@/hooks/use-databases'
import { DatasetListToolbar } from './dataset-list-toolbar'
import { DatasetCard } from './dataset-card'
import { DatasetRow } from './dataset-row'

type ViewMode = 'grid' | 'list'

export function DatasetList() {
  const { data: datasets = [], isLoading } = useManagedDatasets()
  const { data: databases = [] } = useDatabases()
  const navigate = useNavigate()

  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [databaseFilter, setDatabaseFilter] = useState<string>('all')

  const databaseMap = useMemo(() => {
    const map = new Map<number, { name: string; backend: string }>()
    for (const db of databases) {
      map.set(db.id, { name: db.databaseName, backend: db.backend })
    }
    return map
  }, [databases])

  const filtered = useMemo(() => {
    let result = datasets

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (ds) =>
          ds.name.toLowerCase().includes(q) ||
          ds.description.toLowerCase().includes(q),
      )
    }

    if (databaseFilter !== 'all') {
      const dbId = Number(databaseFilter)
      result = result.filter((ds) => ds.databaseId === dbId)
    }

    return result
  }, [datasets, searchQuery, databaseFilter])

  const handleNavigate = (datasetId: string) => {
    navigate({ to: '/datasets/$datasetId/edit', params: { datasetId } })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Configured Datasets</CardTitle>
        <CardDescription>
          Manage SQL datasets for dashboard charts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <DatasetListToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          databaseFilter={databaseFilter}
          onDatabaseFilterChange={setDatabaseFilter}
          databases={databases}
        />

        {isLoading ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[140px] rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[56px] rounded-lg" />
              ))}
            </div>
          )
        ) : filtered.length === 0 && !searchQuery && databaseFilter === 'all' ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Table2 />
              </EmptyMedia>
              <EmptyTitle>No datasets yet</EmptyTitle>
              <EmptyDescription>
                Create your first dataset to start building charts. Write SQL,
                configure column metadata, and publish.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                size="sm"
                onClick={() => navigate({ to: '/datasets/new' })}
              >
                Create Dataset
              </Button>
            </EmptyContent>
          </Empty>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No datasets matching &ldquo;{searchQuery}&rdquo;
          </p>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-3 gap-4">
            {filtered.map((ds) => {
              const db = databaseMap.get(ds.databaseId)
              return (
                <DatasetCard
                  key={ds.id}
                  dataset={ds}
                  databaseName={db?.name}
                  backendType={db?.backend}
                  onClick={() => handleNavigate(ds.id)}
                />
              )
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((ds) => {
              const db = databaseMap.get(ds.databaseId)
              return (
                <DatasetRow
                  key={ds.id}
                  dataset={ds}
                  databaseName={db?.name}
                  backendType={db?.backend}
                  onClick={() => handleNavigate(ds.id)}
                />
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
