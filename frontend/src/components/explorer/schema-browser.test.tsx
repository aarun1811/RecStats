// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/hooks/use-databases', () => ({
  useDatabases: () => ({
    data: [
      { id: 'db-1', databaseName: 'Prod Oracle', backend: 'oracle', status: 'connected', lastTested: null, createdOn: null, exposeInSqllab: true },
      { id: 'db-2', databaseName: 'Dev Postgres', backend: 'postgresql', status: 'connected', lastTested: null, createdOn: null, exposeInSqllab: true },
    ],
    isLoading: false,
  }),
}))

vi.mock('@/hooks/use-tables', () => ({
  useTables: (dbId: string | null) => ({
    data: dbId ? [
      { name: 'ITEMS', type: 'TABLE' },
      { name: 'MESSAGE_FEED', type: 'TABLE' },
      { name: 'V_DAILY_STATS', type: 'VIEW' },
    ] : undefined,
    isLoading: false,
    error: null,
  }),
}))

vi.mock('@/hooks/use-table-columns', () => {
  const mockFn = vi.fn((_dbId: string | null, tableName: string | null) => ({
    data: tableName === 'ITEMS' ? [
      { name: 'ID', type: 'NUMBER', nullable: false },
      { name: 'NAME', type: 'VARCHAR2', nullable: true },
    ] : undefined,
    isLoading: false,
    error: null,
  }))
  return {
    useTableColumns: mockFn,
    __mockFn: mockFn,
  }
})

import { SchemaBrowser } from './schema-browser'
import * as useTableColumnsModule from '@/hooks/use-table-columns'

function renderWithQuery(ui: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('SchemaBrowser', () => {
  const useTableColumnsMock = (useTableColumnsModule as unknown as {
    __mockFn: ReturnType<typeof vi.fn>
  }).__mockFn

  beforeEach(() => {
    useTableColumnsMock.mockClear()
  })

  it('renders the first database as selected and lists its tables', () => {
    const onInsertTable = vi.fn()
    const onInsertColumn = vi.fn()
    renderWithQuery(
      <SchemaBrowser onInsertTable={onInsertTable} onInsertColumn={onInsertColumn} />,
    )
    expect(screen.getByText('ITEMS')).toBeDefined()
    expect(screen.getByText('MESSAGE_FEED')).toBeDefined()
    expect(screen.getByText('V_DAILY_STATS')).toBeDefined()
  })

  it('filters tables by the search input', async () => {
    renderWithQuery(
      <SchemaBrowser onInsertTable={vi.fn()} onInsertColumn={vi.fn()} />,
    )
    const filter = screen.getByPlaceholderText(/filter/i)
    fireEvent.change(filter, { target: { value: 'message' } })
    await waitFor(() => {
      expect(screen.getByText('MESSAGE_FEED')).toBeDefined()
      expect(screen.queryByText('ITEMS')).toBeNull()
    })
  })

  it('fires useTableColumns only when a table is expanded', () => {
    const onInsertColumn = vi.fn()
    renderWithQuery(
      <SchemaBrowser onInsertTable={vi.fn()} onInsertColumn={onInsertColumn} />,
    )
    const initialNonNullCalls = useTableColumnsMock.mock.calls.filter(
      ([, tableName]) => tableName !== null,
    ).length
    expect(initialNonNullCalls).toBe(0)

    // Click the Collapsible trigger button (parent of the table name span)
    // — clicking the inner span calls e.stopPropagation() which prevents
    // the Collapsible from toggling.
    const itemsLabel = screen.getByText('ITEMS')
    const trigger = itemsLabel.closest('button')
    expect(trigger).not.toBeNull()
    fireEvent.click(trigger!)

    const expandedCalls = useTableColumnsMock.mock.calls.filter(
      ([, tableName]) => tableName === 'ITEMS',
    )
    expect(expandedCalls.length).toBeGreaterThan(0)
  })
})
