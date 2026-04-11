// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/hooks/use-databases', () => {
  const testMutate = vi.fn()
  return {
    useDatabase: () => ({
      data: {
        id: 'db-oracle-1',
        databaseName: 'Prod Oracle',
        backend: 'oracle' as const,
        status: 'connected',
        lastTested: null,
        createdOn: null,
        exposeInSqllab: true,
      },
      isLoading: false,
    }),
    useDatabaseDatasets: () => ({
      data: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
    }),
    useCreateDatabase: () => ({ mutate: vi.fn(), isPending: false }),
    useUpdateDatabase: () => ({ mutate: vi.fn(), isPending: false }),
    useDeleteDatabase: () => ({ mutate: vi.fn(), isPending: false }),
    useTestConnection: () => ({ mutate: testMutate, isPending: false }),
    useSyncDatasets: () => ({ mutate: vi.fn(), isPending: false }),
    __testMutate: testMutate,
  }
})

import { DataSourceSheet } from './data-source-sheet'
import * as useDatabasesModule from '@/hooks/use-databases'

function renderWithQuery(ui: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('DataSourceSheet test connection payload shape', () => {
  const testMutate = (useDatabasesModule as unknown as {
    __testMutate: ReturnType<typeof vi.fn>
  }).__testMutate

  it('detail panel sends only { backend, databaseId }', () => {
    testMutate.mockClear()
    renderWithQuery(
      <DataSourceSheet
        open={true}
        onOpenChange={vi.fn()}
        mode="detail"
        databaseId="db-oracle-1"
        onModeChange={vi.fn()}
      />,
    )

    const testButton = screen.getByRole('button', { name: /test connection/i })
    fireEvent.click(testButton)

    expect(testMutate).toHaveBeenCalledTimes(1)
    const payload = testMutate.mock.calls[0][0]

    expect(payload.backend).toBe('oracle')
    expect(payload.databaseId).toBe('db-oracle-1')
    expect(payload.host).toBeUndefined()
    expect(payload.port).toBeUndefined()
    expect(payload.database).toBeUndefined()
    expect(payload.username).toBeUndefined()
    expect(payload.password).toBeUndefined()
  })

  it('create form sends the full connection body', () => {
    testMutate.mockClear()
    renderWithQuery(
      <DataSourceSheet
        open={true}
        onOpenChange={vi.fn()}
        mode="create"
        databaseId={null}
        onModeChange={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /oracle/i }))
    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: 'test_oracle' },
    })
    fireEvent.change(screen.getByLabelText(/host/i), {
      target: { value: 'ora.example.com' },
    })
    fireEvent.change(screen.getByLabelText(/service name/i), {
      target: { value: 'ORCL' },
    })
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'recon_user' },
    })
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: 'supersecret' },
    })

    fireEvent.click(screen.getByRole('button', { name: /test connection/i }))

    expect(testMutate).toHaveBeenCalledTimes(1)
    const payload = testMutate.mock.calls[0][0]

    expect(payload.backend).toBe('oracle')
    expect(payload.host).toBe('ora.example.com')
    expect(payload.database).toBe('ORCL')
    expect(payload.username).toBe('recon_user')
    expect(payload.password).toBe('supersecret')
    expect(payload.databaseId).toBeUndefined()
  })
})
