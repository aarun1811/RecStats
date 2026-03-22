import { useCallback, useRef, useState } from 'react'

import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'

import { SqlEditor } from '@/components/explorer/sql-editor'
import { SchemaBrowser } from '@/components/explorer/schema-browser'
import {
  QueryResults,
} from '@/components/explorer/query-results'
import {
  QueryHistory,
  addToHistory,
} from '@/components/explorer/query-history'

import type { SqlExecuteResponse } from '@/types/api'
import type { QueryHistoryItem } from '@/components/explorer/query-history'

interface QueryResultTab {
  id: string
  label: string
  data: SqlExecuteResponse | null
  error: string | null
  isLoading: boolean
}

const SCHEMA_MIN_WIDTH = 180
const SCHEMA_MAX_WIDTH = 400
const SCHEMA_DEFAULT_WIDTH = 240

const HISTORY_MIN_HEIGHT = 60
const HISTORY_MAX_HEIGHT = 300
const HISTORY_DEFAULT_HEIGHT = 140

// Stub databases for schema browser — Agent 02/08 will wire this to real API
const STUB_DATABASES = [
  {
    id: '1',
    name: 'Oracle Production',
    schemas: [
      {
        name: 'RECON',
        tables: [
          {
            name: 'BREAKS',
            columns: [
              { name: 'break_id', type: 'NUMBER' },
              { name: 'trade_date', type: 'DATE' },
              { name: 'desk', type: 'VARCHAR2' },
              { name: 'amount', type: 'NUMBER' },
              { name: 'status', type: 'VARCHAR2' },
              { name: 'created_at', type: 'TIMESTAMP' },
            ],
          },
          {
            name: 'TRANSACTIONS',
            columns: [
              { name: 'txn_id', type: 'NUMBER' },
              { name: 'trade_date', type: 'DATE' },
              { name: 'counterparty', type: 'VARCHAR2' },
              { name: 'notional', type: 'NUMBER' },
              { name: 'currency', type: 'VARCHAR2' },
            ],
          },
          {
            name: 'POSITIONS',
            columns: [
              { name: 'position_id', type: 'NUMBER' },
              { name: 'instrument', type: 'VARCHAR2' },
              { name: 'quantity', type: 'NUMBER' },
              { name: 'market_value', type: 'NUMBER' },
            ],
          },
        ],
      },
    ],
  },
]

const STUB_DB_LIST = [{ id: '1', name: 'Oracle Production' }]

export function ExplorerLayout() {
  // Panel state
  const [schemaPanelOpen, setSchemaPanelOpen] = useState(true)
  const [schemaWidth, setSchemaWidth] = useState(SCHEMA_DEFAULT_WIDTH)
  const [historyOpen, setHistoryOpen] = useState(true)
  const [historyHeight, setHistoryHeight] = useState(HISTORY_DEFAULT_HEIGHT)
  const [isResizingSchema, setIsResizingSchema] = useState(false)
  const [isResizingHistory, setIsResizingHistory] = useState(false)

  // Editor
  const insertTextRef = useRef<((text: string) => void) | null>(null)
  const [databaseId, setDatabaseId] = useState('1')

  // Query results
  const [results, setResults] = useState<QueryResultTab[]>([])
  const [activeTabId, setActiveTabId] = useState('')
  const queryCountRef = useRef(0)

  const handleExecute = useCallback(
    async (sql: string) => {
      queryCountRef.current += 1
      const tabId = `query-${queryCountRef.current}`
      const label = `Query ${queryCountRef.current}`

      const newTab: QueryResultTab = {
        id: tabId,
        label,
        data: null,
        error: null,
        isLoading: true,
      }

      setResults((prev) => [...prev, newTab])
      setActiveTabId(tabId)

      const startTime = Date.now()

      try {
        const response = await api.post<SqlExecuteResponse>('/sql/execute', {
          databaseId: Number(databaseId),
          sql,
          limit: 1000,
        })

        setResults((prev) =>
          prev.map((r) =>
            r.id === tabId ? { ...r, data: response, isLoading: false } : r,
          ),
        )

        const historyItem: QueryHistoryItem = {
          id: tabId,
          sql,
          executionTime: response.query.executionTime,
          rowCount: response.query.rowCount,
          timestamp: Date.now(),
          databaseId,
        }
        addToHistory(historyItem)
      } catch (err) {
        const elapsed = Date.now() - startTime
        const message =
          err instanceof Error ? err.message : 'Unknown error occurred'

        setResults((prev) =>
          prev.map((r) =>
            r.id === tabId ? { ...r, error: message, isLoading: false } : r,
          ),
        )

        const historyItem: QueryHistoryItem = {
          id: tabId,
          sql,
          executionTime: elapsed,
          rowCount: 0,
          timestamp: Date.now(),
          databaseId,
          error: message,
        }
        addToHistory(historyItem)
      }
    },
    [databaseId],
  )

  const handleTabClose = useCallback(
    (tabId: string) => {
      setResults((prev) => {
        const updated = prev.filter((r) => r.id !== tabId)
        if (activeTabId === tabId && updated.length > 0) {
          setActiveTabId(updated[updated.length - 1]?.id ?? '')
        } else if (updated.length === 0) {
          setActiveTabId('')
        }
        return updated
      })
    },
    [activeTabId],
  )

  const handleInsertFromSchema = useCallback((text: string) => {
    insertTextRef.current?.(text)
  }, [])

  const handleSelectFromHistory = useCallback((sql: string) => {
    insertTextRef.current?.(sql)
  }, [])

  // Schema panel resize
  const handleSchemaResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      setIsResizingSchema(true)
      const startX = e.clientX
      const startWidth = schemaWidth

      const handleMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientX - startX
        setSchemaWidth(
          Math.max(SCHEMA_MIN_WIDTH, Math.min(SCHEMA_MAX_WIDTH, startWidth + delta)),
        )
      }

      const handleUp = () => {
        setIsResizingSchema(false)
        document.removeEventListener('pointermove', handleMove)
        document.removeEventListener('pointerup', handleUp)
      }

      document.addEventListener('pointermove', handleMove)
      document.addEventListener('pointerup', handleUp)
    },
    [schemaWidth],
  )

  // History panel resize
  const handleHistoryResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      setIsResizingHistory(true)
      const startY = e.clientY
      const startHeight = historyHeight

      const handleMove = (moveEvent: PointerEvent) => {
        const delta = startY - moveEvent.clientY
        setHistoryHeight(
          Math.max(
            HISTORY_MIN_HEIGHT,
            Math.min(HISTORY_MAX_HEIGHT, startHeight + delta),
          ),
        )
      }

      const handleUp = () => {
        setIsResizingHistory(false)
        document.removeEventListener('pointermove', handleMove)
        document.removeEventListener('pointerup', handleUp)
      }

      document.addEventListener('pointermove', handleMove)
      document.addEventListener('pointerup', handleUp)
    },
    [historyHeight],
  )

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Top section: schema + editor + results */}
      <div className="flex flex-1 overflow-hidden">
        {/* Schema browser */}
        {schemaPanelOpen && (
          <>
            <div
              style={{ width: schemaWidth }}
              className="shrink-0 overflow-hidden"
            >
              <SchemaBrowser
                databases={STUB_DATABASES}
                onInsertText={handleInsertFromSchema}
              />
            </div>
            {/* Schema resize handle */}
            <div
              onPointerDown={handleSchemaResizeStart}
              className={cn(
                'flex w-1.5 cursor-col-resize items-center justify-center bg-transparent transition-colors hover:bg-muted',
                isResizingSchema && 'bg-muted',
              )}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground/50" />
            </div>
          </>
        )}

        {/* Main content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Toggle schema + SQL editor */}
          <div className="shrink-0 border-b border-border">
            <div className="flex items-center gap-1 border-b border-border bg-muted/30 px-2 py-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={() => setSchemaPanelOpen(!schemaPanelOpen)}
              >
                {schemaPanelOpen ? (
                  <PanelLeftClose className="h-3.5 w-3.5" />
                ) : (
                  <PanelLeftOpen className="h-3.5 w-3.5" />
                )}
              </Button>
              <span className="text-xs font-medium text-muted-foreground">
                SQL Editor
              </span>
            </div>
            <SqlEditor
              onExecute={handleExecute}
              defaultValue="SELECT * FROM RECON.BREAKS\nWHERE status = 'OPEN'\nORDER BY trade_date DESC\nLIMIT 100;"
              databaseId={databaseId}
              onDatabaseChange={setDatabaseId}
              databases={STUB_DB_LIST}
              onInsertText={insertTextRef}
            />
          </div>

          {/* Results */}
          <div className="flex-1 overflow-hidden">
            <QueryResults
              results={results}
              activeTabId={activeTabId}
              onTabChange={setActiveTabId}
              onTabClose={handleTabClose}
            />
          </div>
        </div>
      </div>

      {/* History panel */}
      <div className="shrink-0 border-t border-border">
        {/* History resize handle */}
        {historyOpen && (
          <div
            onPointerDown={handleHistoryResizeStart}
            className={cn(
              'flex h-1.5 cursor-row-resize items-center justify-center bg-transparent transition-colors hover:bg-muted',
              isResizingHistory && 'bg-muted',
            )}
          >
            <GripVertical className="h-3 w-3 rotate-90 text-muted-foreground/50" />
          </div>
        )}

        {/* History header */}
        <button
          type="button"
          onClick={() => setHistoryOpen(!historyOpen)}
          className="flex w-full items-center gap-1.5 border-b border-border bg-muted/30 px-3 py-1 text-left hover:bg-muted/50"
        >
          {historyOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="text-xs font-medium text-muted-foreground">
            Query History
          </span>
        </button>

        {/* History content */}
        {historyOpen && (
          <div style={{ height: historyHeight }}>
            <QueryHistory onSelectQuery={handleSelectFromHistory} />
          </div>
        )}
      </div>
    </div>
  )
}
