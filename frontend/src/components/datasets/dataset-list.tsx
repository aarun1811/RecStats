import { useState, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Search, Table2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

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
    const map = new Map<string, { name: string; backend: string }>()
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
      result = result.filter((ds) => ds.databaseId === databaseFilter)
    }

    return result
  }, [datasets, searchQuery, databaseFilter])

  const handleNavigate = (datasetId: string) => {
    navigate({ to: '/datasets/$datasetId/edit', params: { datasetId } })
  }

  const isEmpty = !isLoading && datasets.length === 0 && !searchQuery && databaseFilter === 'all'

  return (
    <div className="space-y-4">
      {!isEmpty && (
        <DatasetListToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          databaseFilter={databaseFilter}
          onDatabaseFilterChange={setDatabaseFilter}
          databases={databases}
        />
      )}

      {isLoading ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
      ) : isEmpty ? (
        <Empty className="border rounded-lg">
          <EmptyHeader>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.4 }}
              transition={{ duration: 0.3, type: 'spring', stiffness: 300, damping: 20 }}
            >
              <EmptyMedia variant="icon">
                <Table2 />
              </EmptyMedia>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.2 }}
            >
              <EmptyTitle>No datasets yet</EmptyTitle>
              <EmptyDescription>
                Create your first dataset to start building charts. Write SQL,
                configure column metadata, and publish.
              </EmptyDescription>
            </motion.div>
          </EmptyHeader>
          <EmptyContent>
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.2 }}
            >
              <motion.div
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ delay: 0.4, duration: 0.6, ease: 'easeInOut' }}
              >
                <Button
                  size="sm"
                  onClick={() => navigate({ to: '/datasets/new' })}
                >
                  Create Dataset
                </Button>
              </motion.div>
            </motion.div>
          </EmptyContent>
        </Empty>
      ) : filtered.length === 0 ? (
        <Empty className="border rounded-lg">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Search /></EmptyMedia>
            <EmptyTitle>No datasets matching &ldquo;{searchQuery}&rdquo;</EmptyTitle>
            <EmptyDescription>Try a different search term or clear your filters.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={viewMode}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((ds, i) => {
                  const db = databaseMap.get(ds.databaseId)
                  return (
                    <DatasetCard
                      key={ds.id}
                      dataset={ds}
                      databaseName={db?.name}
                      backendType={db?.backend}
                      onClick={() => handleNavigate(ds.id)}
                      index={i}
                    />
                  )
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((ds, i) => {
                  const db = databaseMap.get(ds.databaseId)
                  return (
                    <DatasetRow
                      key={ds.id}
                      dataset={ds}
                      databaseName={db?.name}
                      backendType={db?.backend}
                      onClick={() => handleNavigate(ds.id)}
                      index={i}
                    />
                  )
                })}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}
