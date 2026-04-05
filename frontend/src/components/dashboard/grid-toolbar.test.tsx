// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

import { GridToolbar } from './grid-toolbar'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock chart-export sanitizeFilename
vi.mock('@/lib/chart-export', () => ({
  sanitizeFilename: (name: string) =>
    name.toLowerCase().replace(/\s+/g, '-').replace(/[<>\\/:"*?|]/g, ''),
}))

function mockGridApi() {
  return {
    exportDataAsCsv: vi.fn(),
    exportDataAsExcel: vi.fn(),
    getColumns: vi.fn(() => [
      {
        getColId: () => 'name',
        getColDef: () => ({ headerName: 'Name' }),
        isVisible: () => true,
      },
      {
        getColId: () => 'value',
        getColDef: () => ({ headerName: 'Value' }),
        isVisible: () => true,
      },
    ]),
    setColumnsVisible: vi.fn(),
    autoSizeAllColumns: vi.fn(),
    resetRowHeights: vi.fn(),
    forEachNode: vi.fn(),
    onRowHeightChanged: vi.fn(),
  }
}

const defaultProps = {
  gridApi: null,
  gridTitle: 'Test Grid',
  totalRows: 100,
  displayedRows: 42,
  quickFilter: '',
  onQuickFilterChange: vi.fn(),
}

describe('GridToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders search input with placeholder "Quick filter..."', () => {
    render(<GridToolbar {...defaultProps} />)
    expect(screen.getByPlaceholderText('Quick filter...')).toBeDefined()
  })

  it('renders CSV button', () => {
    render(<GridToolbar {...defaultProps} />)
    expect(screen.getByRole('button', { name: /csv/i })).toBeDefined()
  })

  it('renders Excel button', () => {
    render(<GridToolbar {...defaultProps} />)
    expect(screen.getByRole('button', { name: /excel/i })).toBeDefined()
  })

  it('renders Columns button', () => {
    render(<GridToolbar {...defaultProps} />)
    expect(screen.getByRole('button', { name: /columns/i })).toBeDefined()
  })

  it('renders Density button', () => {
    render(<GridToolbar {...defaultProps} />)
    expect(screen.getByRole('button', { name: /density/i })).toBeDefined()
  })

  it('renders Auto-size button', () => {
    render(<GridToolbar {...defaultProps} />)
    expect(screen.getByRole('button', { name: /auto-size/i })).toBeDefined()
  })

  it('displays row count as "{displayed} of {total} rows"', () => {
    render(<GridToolbar {...defaultProps} />)
    expect(screen.getByText('42 of 100 rows')).toBeDefined()
  })

  it('displays formatted row count for large numbers', () => {
    render(
      <GridToolbar {...defaultProps} totalRows={12345} displayedRows={9876} />,
    )
    expect(screen.getByText('9,876 of 12,345 rows')).toBeDefined()
  })

  it('calls gridApi.exportDataAsCsv on CSV button click', () => {
    const api = mockGridApi()
    render(<GridToolbar {...defaultProps} gridApi={api as never} />)
    fireEvent.click(screen.getByRole('button', { name: /csv/i }))
    expect(api.exportDataAsCsv).toHaveBeenCalledTimes(1)
    expect(api.exportDataAsCsv).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: expect.stringContaining('.csv') }),
    )
  })

  it('calls gridApi.exportDataAsExcel on Excel button click', async () => {
    const api = mockGridApi()
    render(<GridToolbar {...defaultProps} gridApi={api as never} />)
    fireEvent.click(screen.getByRole('button', { name: /excel/i }))
    // Excel export uses requestAnimationFrame, so wait for it
    await waitFor(() => {
      expect(api.exportDataAsExcel).toHaveBeenCalledTimes(1)
      expect(api.exportDataAsExcel).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: expect.stringContaining('.xlsx'),
          sheetName: 'Data',
        }),
      )
    })
  })

  it('Excel button shows loading state during export', async () => {
    const api = mockGridApi()
    // Make exportDataAsExcel take some time (but requestAnimationFrame-based)
    let resolveExport: () => void
    api.exportDataAsExcel.mockImplementation(() => {
      return new Promise<void>((resolve) => {
        resolveExport = resolve
      })
    })
    render(<GridToolbar {...defaultProps} gridApi={api as never} />)
    const excelButton = screen.getByRole('button', { name: /excel/i })
    fireEvent.click(excelButton)
    // After clicking, button should be disabled during export
    await waitFor(() => {
      expect(excelButton).toHaveProperty('disabled', true)
    })
  })

  it('calls gridApi.autoSizeAllColumns on Auto-size button click', () => {
    const api = mockGridApi()
    render(<GridToolbar {...defaultProps} gridApi={api as never} />)
    fireEvent.click(screen.getByRole('button', { name: /auto-size/i }))
    expect(api.autoSizeAllColumns).toHaveBeenCalledTimes(1)
  })

  it('calls onQuickFilterChange when typing in search input', () => {
    const onChange = vi.fn()
    render(
      <GridToolbar {...defaultProps} onQuickFilterChange={onChange} />,
    )
    const input = screen.getByPlaceholderText('Quick filter...')
    fireEvent.change(input, { target: { value: 'test' } })
    expect(onChange).toHaveBeenCalledWith('test')
  })
})
