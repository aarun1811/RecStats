import { useState, useMemo } from 'react'
import { useDatasets } from '@/hooks/use-datasets'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Database, Table2, Columns3, ChevronRight, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SchemaBrowserProps {
  onInsertTable: (tableName: string) => void
  onInsertColumn: (columnName: string) => void
}

export function SchemaBrowser({ onInsertTable, onInsertColumn }: SchemaBrowserProps) {
  const { data: datasets, isLoading } = useDatasets()
  const [search, setSearch] = useState('')
  const [openTables, setOpenTables] = useState<Set<number>>(new Set())

  const filtered = useMemo(() => {
    if (!datasets) return []
    if (!search.trim()) return datasets
    const q = search.toLowerCase()
    return datasets.filter(
      (ds) =>
        ds.name.toLowerCase().includes(q) ||
        ds.tableName.toLowerCase().includes(q) ||
        ds.columns?.some((c) => c.name.toLowerCase().includes(q)),
    )
  }, [datasets, search])

  const toggleTable = (id: number) => {
    setOpenTables((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full border-r">
      {/* Header */}
      <div className="px-3 py-2.5 border-b bg-muted/40 shrink-0">
        <div className="flex items-center gap-2">
          <Database className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium truncate">Schema Browser</span>
        </div>
      </div>

      {/* Search */}
      <div className="p-2 border-b shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Filter..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-7 text-xs"
          />
        </div>
      </div>

      {/* Tree */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          {/* Database node */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <Database className="size-3" />
            recon_data
          </div>

          {filtered?.map((ds) => (
            <Collapsible
              key={ds.id}
              open={openTables.has(ds.id)}
              onOpenChange={() => toggleTable(ds.id)}
            >
              <CollapsibleTrigger className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs hover:bg-accent/50 cursor-pointer transition-colors">
                <ChevronRight
                  className={cn(
                    'size-3 shrink-0 transition-transform duration-150',
                    openTables.has(ds.id) && 'rotate-90',
                  )}
                />
                <Table2 className="size-3.5 shrink-0 text-blue-500" />
                <span
                  className="flex-1 text-left truncate font-medium cursor-pointer hover:text-primary"
                  onClick={(e) => {
                    e.stopPropagation()
                    onInsertTable(ds.tableName)
                  }}
                  title={`Insert "${ds.tableName}"`}
                >
                  {ds.tableName}
                </span>
                {ds.rowCount != null && (
                  <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                    {ds.rowCount >= 1000 ? `${Math.round(ds.rowCount / 1000)}k` : ds.rowCount}
                  </span>
                )}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-5 border-l pl-2 py-0.5">
                  {ds.columns?.map((col) => (
                    <button
                      key={col.name}
                      className="flex items-center gap-1.5 w-full px-2 py-1 text-xs hover:bg-accent/50 rounded-sm cursor-pointer transition-colors"
                      onClick={() => onInsertColumn(col.name)}
                      title={`Insert "${col.name}"`}
                    >
                      <Columns3 className="size-3 shrink-0 text-muted-foreground/60" />
                      <span className="flex-1 text-left truncate">{col.name}</span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 shrink-0 font-mono">
                        {col.type.length > 7 ? col.type.slice(0, 4) : col.type}
                      </Badge>
                    </button>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}

          {filtered?.length === 0 && (
            <p className="text-xs text-muted-foreground px-4 py-3">No tables match filter.</p>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
