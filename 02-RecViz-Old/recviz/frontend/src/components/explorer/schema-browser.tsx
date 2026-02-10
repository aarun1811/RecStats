import { useMemo, useState } from 'react'

import {
  ChevronRight,
  Columns3,
  Database,
  Search,
  Table2,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'

interface SchemaColumn {
  name: string
  type: string
}

interface SchemaTable {
  name: string
  columns: SchemaColumn[]
}

interface SchemaDatabase {
  id: string
  name: string
  schemas: {
    name: string
    tables: SchemaTable[]
  }[]
}

interface SchemaBrowserProps {
  databases: SchemaDatabase[]
  isLoading?: boolean
  onInsertText?: (text: string) => void
}

function columnTypeBadgeVariant(
  type: string,
): 'default' | 'secondary' | 'outline' {
  const upper = type.toUpperCase()
  if (
    upper.includes('INT') ||
    upper.includes('NUMBER') ||
    upper.includes('DECIMAL') ||
    upper.includes('FLOAT') ||
    upper.includes('DOUBLE')
  ) {
    return 'default'
  }
  if (upper.includes('DATE') || upper.includes('TIME')) {
    return 'secondary'
  }
  return 'outline'
}

function SchemaTreeNode({
  label,
  icon,
  depth,
  children,
  defaultOpen = false,
  onClick,
  trailing,
}: {
  label: string
  icon: React.ReactNode
  depth: number
  children?: React.ReactNode
  defaultOpen?: boolean
  onClick?: () => void
  trailing?: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const hasChildren = !!children

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (hasChildren) setIsOpen(!isOpen)
          onClick?.()
        }}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-sm px-1.5 py-1 text-left text-xs transition-colors hover:bg-accent',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        )}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
      >
        {hasChildren && (
          <ChevronRight
            className={cn(
              'h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-200',
              isOpen && 'rotate-90',
            )}
          />
        )}
        {!hasChildren && <span className="w-3 shrink-0" />}
        <span className="shrink-0 text-muted-foreground">{icon}</span>
        <span className="min-w-0 truncate">{label}</span>
        {trailing && <span className="ml-auto shrink-0">{trailing}</span>}
      </button>
      {isOpen && children && <div>{children}</div>}
    </div>
  )
}

function SchemaBrowserSkeleton() {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-5 w-32" />
          <div className="ml-4 space-y-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SchemaBrowser({
  databases,
  isLoading = false,
  onInsertText,
}: SchemaBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredDatabases = useMemo(() => {
    if (!searchQuery.trim()) return databases
    const query = searchQuery.toLowerCase()
    return databases
      .map((db) => ({
        ...db,
        schemas: db.schemas
          .map((schema) => ({
            ...schema,
            tables: schema.tables
              .map((table) => ({
                ...table,
                columns: table.columns.filter((col) =>
                  col.name.toLowerCase().includes(query),
                ),
              }))
              .filter(
                (table) =>
                  table.name.toLowerCase().includes(query) ||
                  table.columns.length > 0,
              ),
          }))
          .filter(
            (schema) =>
              schema.name.toLowerCase().includes(query) ||
              schema.tables.length > 0,
          ),
      }))
      .filter(
        (db) =>
          db.name.toLowerCase().includes(query) || db.schemas.length > 0,
      )
  }, [databases, searchQuery])

  return (
    <div className="flex h-full flex-col overflow-hidden border-r border-border bg-background">
      <div className="border-b border-border px-3 py-2">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Schema Browser
        </p>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter tables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <SchemaBrowserSkeleton />
        ) : filteredDatabases.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            {searchQuery ? 'No matching tables or columns' : 'No databases available'}
          </div>
        ) : (
          <div className="py-1">
            {filteredDatabases.map((db) => (
              <SchemaTreeNode
                key={db.id}
                label={db.name}
                icon={<Database className="h-3.5 w-3.5" />}
                depth={0}
                defaultOpen={filteredDatabases.length === 1}
              >
                {db.schemas.map((schema) => (
                  <SchemaTreeNode
                    key={`${db.id}-${schema.name}`}
                    label={schema.name}
                    icon={<Columns3 className="h-3.5 w-3.5" />}
                    depth={1}
                    defaultOpen={db.schemas.length === 1}
                  >
                    {schema.tables.map((table) => (
                      <SchemaTreeNode
                        key={`${db.id}-${schema.name}-${table.name}`}
                        label={table.name}
                        icon={<Table2 className="h-3.5 w-3.5" />}
                        depth={2}
                        onClick={() =>
                          onInsertText?.(`${schema.name}.${table.name}`)
                        }
                      >
                        {table.columns.map((col) => (
                          <button
                            key={`${db.id}-${schema.name}-${table.name}-${col.name}`}
                            type="button"
                            onClick={() => onInsertText?.(col.name)}
                            className={cn(
                              'flex w-full items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-left text-xs transition-colors hover:bg-accent',
                              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                            )}
                            style={{ paddingLeft: `${3 * 12 + 6 + 12 + 6}px` }}
                          >
                            <span className="min-w-0 truncate text-foreground/80">
                              {col.name}
                            </span>
                            <Badge
                              variant={columnTypeBadgeVariant(col.type)}
                              className="ml-auto h-4 px-1 py-0 text-[10px] font-normal"
                            >
                              {col.type}
                            </Badge>
                          </button>
                        ))}
                      </SchemaTreeNode>
                    ))}
                  </SchemaTreeNode>
                ))}
              </SchemaTreeNode>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
