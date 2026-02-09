import { useCallback, useMemo, useState } from 'react'

import { format } from 'date-fns'
import { Clock, Search, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'

const HISTORY_STORAGE_KEY = 'recviz-query-history'
const MAX_HISTORY_ITEMS = 100

export interface QueryHistoryItem {
  id: string
  sql: string
  executionTime: number
  rowCount: number
  timestamp: number
  databaseId?: string
  error?: string
}

function loadHistory(): QueryHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as QueryHistoryItem[]
  } catch {
    return []
  }
}

function saveHistory(items: QueryHistoryItem[]): void {
  try {
    localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS)),
    )
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function addToHistory(item: QueryHistoryItem): void {
  const items = loadHistory()
  items.unshift(item)
  saveHistory(items)
}

interface QueryHistoryProps {
  onSelectQuery: (sql: string) => void
}

export function QueryHistory({ onSelectQuery }: QueryHistoryProps) {
  const [items, setItems] = useState<QueryHistoryItem[]>(loadHistory)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items
    const q = searchQuery.toLowerCase()
    return items.filter((item) => item.sql.toLowerCase().includes(q))
  }, [items, searchQuery])

  const handleDelete = useCallback(
    (id: string) => {
      const updated = items.filter((item) => item.id !== id)
      setItems(updated)
      saveHistory(updated)
    },
    [items],
  )

  const handleClearAll = useCallback(() => {
    setItems([])
    saveHistory([])
  }, [])

  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <Clock className="h-6 w-6 opacity-30" />
        <p className="text-xs">No query history yet</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search history..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-7 text-xs"
          />
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={handleClearAll}
        >
          Clear all
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="divide-y divide-border">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectQuery(item.sql)}
              className={cn(
                'group flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors hover:bg-accent',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(item.timestamp), 'HH:mm:ss')}
                </span>
                <span
                  className={cn(
                    'text-[10px]',
                    item.error
                      ? 'text-destructive'
                      : 'text-muted-foreground',
                  )}
                >
                  {item.error
                    ? 'error'
                    : `${item.rowCount} rows · ${
                        item.executionTime < 1000
                          ? `${item.executionTime}ms`
                          : `${(item.executionTime / 1000).toFixed(1)}s`
                      }`}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto h-5 w-5 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(item.id)
                  }}
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
              <pre className="max-h-[2.5em] overflow-hidden truncate text-xs text-foreground/80">
                {item.sql.trim()}
              </pre>
            </button>
          ))}
        </div>
        {filteredItems.length === 0 && searchQuery && (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
            No matching queries
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
