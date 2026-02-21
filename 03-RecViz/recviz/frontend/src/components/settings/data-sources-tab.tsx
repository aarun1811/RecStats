import { useState, useMemo } from 'react'
import { Database } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty'
import { useDatabases } from '@/hooks/use-databases'
import { DataSourcesToolbar } from './data-sources-toolbar'
import { DataSourceCard } from './data-source-card'
import { DataSourceRow } from './data-source-row'
import { DataSourceSheet } from './data-source-sheet'

type ViewMode = 'grid' | 'list'
type SheetMode = 'create' | 'edit' | 'detail'

export function DataSourcesTab() {
  const { data: databases = [], isLoading } = useDatabases()
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetMode, setSheetMode] = useState<SheetMode>('create')
  const [selectedDbId, setSelectedDbId] = useState<number | null>(null)

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return databases
    const q = searchQuery.toLowerCase()
    return databases.filter(
      (db) =>
        db.databaseName.toLowerCase().includes(q) ||
        db.backend.toLowerCase().includes(q),
    )
  }, [databases, searchQuery])

  const handleOpenCreate = () => {
    setSelectedDbId(null)
    setSheetMode('create')
    setSheetOpen(true)
  }

  const handleOpenDetail = (dbId: number) => {
    setSelectedDbId(dbId)
    setSheetMode('detail')
    setSheetOpen(true)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configured Data Sources</CardTitle>
          <CardDescription>
            Manage database connections used by Superset
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DataSourcesToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onAddClick={handleOpenCreate}
          />

          {isLoading ? (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-[120px] rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-[56px] rounded-lg" />
                ))}
              </div>
            )
          ) : filtered.length === 0 && !searchQuery ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Database />
                </EmptyMedia>
                <EmptyTitle>No data sources configured</EmptyTitle>
                <EmptyDescription>
                  Add your first database connection to start querying data.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" onClick={handleOpenCreate}>
                  Add Data Source
                </Button>
              </EmptyContent>
            </Empty>
          ) : filtered.length === 0 && searchQuery ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No databases matching &ldquo;{searchQuery}&rdquo;
            </p>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-3 gap-4">
              {filtered.map((db) => (
                <DataSourceCard
                  key={db.id}
                  database={db}
                  onClick={() => handleOpenDetail(db.id)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((db) => (
                <DataSourceRow
                  key={db.id}
                  database={db}
                  onClick={() => handleOpenDetail(db.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <DataSourceSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode={sheetMode}
        databaseId={selectedDbId}
        onModeChange={setSheetMode}
      />
    </>
  )
}
