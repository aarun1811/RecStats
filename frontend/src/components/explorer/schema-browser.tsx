import { useState, useMemo, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Database,
  Table2,
  Eye,
  Columns3,
  ChevronRight,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDatabases } from '@/hooks/use-databases'
import { useTables } from '@/hooks/use-tables'
import { useTableColumns } from '@/hooks/use-table-columns'
import type { SchemaTable } from '@/types/schema'

interface SchemaBrowserProps {
  onInsertTable: (tableName: string) => void
  onInsertColumn: (columnName: string) => void
}

export function SchemaBrowser({
  onInsertTable,
  onInsertColumn,
}: SchemaBrowserProps) {
  const { data: databases = [], isLoading: dbsLoading } = useDatabases()
  const [selectedDbId, setSelectedDbId] = useState<string>('')

  useEffect(() => {
    if (!selectedDbId && databases.length > 0) {
      setSelectedDbId(databases[0].id)
    }
  }, [databases, selectedDbId])

  const { data: tables, isLoading: tablesLoading, error: tablesError } =
    useTables(selectedDbId || null)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const selectedDb = databases.find((d) => d.id === selectedDbId)

  const filteredTables = useMemo(() => {
    if (!tables) return []
    if (!search.trim()) return tables
    const q = search.toLowerCase()
    return tables.filter((t) => t.name.toLowerCase().includes(q))
  }, [tables, search])

  const toggleTable = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <div className="flex flex-col h-full border-r">
      <div className="px-3 py-2.5 border-b bg-muted/40 shrink-0">
        <div className="flex items-center gap-2">
          <Database className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium truncate">Schema Browser</span>
        </div>
      </div>

      <div className="p-2 border-b shrink-0">
        <Select value={selectedDbId} onValueChange={setSelectedDbId}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select database" />
          </SelectTrigger>
          <SelectContent>
            {databases.map((db) => (
              <SelectItem key={db.id} value={db.id}>
                {db.databaseName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="p-2 border-b shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Filter tables..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-7 text-xs"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {dbsLoading || tablesLoading ? (
          <div className="flex flex-col gap-2 p-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        ) : tablesError ? (
          <div className="px-3 py-4 text-xs text-destructive">
            Failed to load tables. Check backend logs and the connection's Schema field.
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground">
            {tables?.length === 0
              ? `No tables in schema ${selectedDb?.databaseName ? `'${selectedDb.databaseName}'` : ''}`
              : 'No tables match filter.'}
          </div>
        ) : (
          <div className="py-1">
            {filteredTables.map((tbl) => (
              <ExpandableTable
                key={tbl.name}
                dbId={selectedDbId}
                table={tbl}
                expanded={expanded.has(tbl.name)}
                onToggle={() => toggleTable(tbl.name)}
                onInsertTable={onInsertTable}
                onInsertColumn={onInsertColumn}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

interface ExpandableTableProps {
  dbId: string
  table: SchemaTable
  expanded: boolean
  onToggle: () => void
  onInsertTable: (tableName: string) => void
  onInsertColumn: (columnName: string) => void
}

function ExpandableTable({
  dbId,
  table,
  expanded,
  onToggle,
  onInsertTable,
  onInsertColumn,
}: ExpandableTableProps) {
  const { data: columns, isLoading, error } = useTableColumns(
    dbId,
    expanded ? table.name : null,
  )

  const isView = table.type.toUpperCase() === 'VIEW'
  const Icon = isView ? Eye : Table2

  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <CollapsibleTrigger
        className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs hover:bg-accent/50 cursor-pointer transition-colors"
      >
        <ChevronRight
          className={cn(
            'size-3 shrink-0 transition-transform duration-150',
            expanded && 'rotate-90',
          )}
        />
        <Icon
          className={cn(
            'size-3.5 shrink-0',
            isView ? 'text-purple-500' : 'text-blue-500',
          )}
        />
        <span
          className="flex-1 text-left truncate font-medium cursor-pointer hover:text-primary"
          onClick={(e) => {
            e.stopPropagation()
            onInsertTable(table.name)
          }}
          title={`Insert "${table.name}"`}
        >
          {table.name}
        </span>
        <span className="text-[9px] text-muted-foreground shrink-0 uppercase tracking-wide">
          {table.type}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-5 border-l pl-2 py-0.5">
          {isLoading ? (
            <div className="flex flex-col gap-1 py-1">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ) : error ? (
            <div className="text-[11px] text-destructive px-2 py-1">
              Failed to load columns
            </div>
          ) : columns && columns.length > 0 ? (
            columns.map((col) => (
              <button
                key={col.name}
                className="flex items-center gap-1.5 w-full px-2 py-1 text-xs hover:bg-accent/50 rounded-sm cursor-pointer transition-colors"
                onClick={() => onInsertColumn(col.name)}
                title={`Insert "${col.name}"`}
              >
                <Columns3 className="size-3 shrink-0 text-muted-foreground/60" />
                <span className="flex-1 text-left truncate">{col.name}</span>
                <Badge
                  variant="outline"
                  className="text-[9px] px-1 py-0 h-3.5 shrink-0 font-mono"
                >
                  {col.type.length > 8 ? col.type.slice(0, 8) : col.type}
                </Badge>
              </button>
            ))
          ) : (
            <div className="text-[11px] text-muted-foreground px-2 py-1">
              No columns
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
