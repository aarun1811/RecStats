import { useCallback, useEffect, useState } from 'react'

import type { GridApi } from 'ag-grid-community'

interface GridStatusBarProps {
  gridApi: GridApi | null
}

interface StatusBarData {
  totalRows: number
  displayedRows: number
  selectedRows: number
  aggregation: {
    sum: number
    avg: number
    min: number
    max: number
    count: number
  } | null
}

const defaultStatus: StatusBarData = {
  totalRows: 0,
  displayedRows: 0,
  selectedRows: 0,
  aggregation: null,
}

export function GridStatusBar({ gridApi }: GridStatusBarProps) {
  const [status, setStatus] = useState<StatusBarData>(defaultStatus)

  const updateStatus = useCallback(() => {
    if (!gridApi) return

    const totalRows = gridApi.getDisplayedRowCount()
    const selectedRows = gridApi.getSelectedRows().length

    let displayedRows = 0
    gridApi.forEachNodeAfterFilterAndSort(() => {
      displayedRows++
    })

    // Compute aggregation from range selection
    const cellRanges = gridApi.getCellRanges?.()
    let aggregation: StatusBarData['aggregation'] = null

    if (cellRanges && cellRanges.length > 0) {
      const numericValues: number[] = []

      for (const range of cellRanges) {
        const startRow = Math.min(
          range.startRow?.rowIndex ?? 0,
          range.endRow?.rowIndex ?? 0,
        )
        const endRow = Math.max(
          range.startRow?.rowIndex ?? 0,
          range.endRow?.rowIndex ?? 0,
        )

        for (let rowIdx = startRow; rowIdx <= endRow; rowIdx++) {
          const rowNode = gridApi.getDisplayedRowAtIndex(rowIdx)
          if (!rowNode) continue

          for (const col of range.columns) {
            const cellValue = gridApi.getCellValue({
              rowNode,
              colKey: col,
            })
            const num = Number(cellValue)
            if (!Number.isNaN(num) && cellValue !== null && cellValue !== '') {
              numericValues.push(num)
            }
          }
        }
      }

      if (numericValues.length > 0) {
        const sum = numericValues.reduce((a, b) => a + b, 0)
        aggregation = {
          sum,
          avg: sum / numericValues.length,
          min: Math.min(...numericValues),
          max: Math.max(...numericValues),
          count: numericValues.length,
        }
      }
    }

    setStatus({ totalRows, displayedRows, selectedRows, aggregation })
  }, [gridApi])

  useEffect(() => {
    if (!gridApi) return

    const events = [
      'modelUpdated',
      'selectionChanged',
      'filterChanged',
      'rangeSelectionChanged',
    ] as const

    for (const event of events) {
      gridApi.addEventListener(event, updateStatus)
    }

    updateStatus()

    return () => {
      for (const event of events) {
        gridApi.removeEventListener(event, updateStatus)
      }
    }
  }, [gridApi, updateStatus])

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US').format(n)

  const fmtDecimal = (n: number) =>
    new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n)

  return (
    <div className="flex items-center justify-between border-t bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
      <div className="flex items-center gap-4">
        <span>
          {status.displayedRows === status.totalRows
            ? `${fmt(status.totalRows)} rows`
            : `${fmt(status.displayedRows)} of ${fmt(status.totalRows)} rows`}
        </span>
        {status.selectedRows > 0 && (
          <span>{fmt(status.selectedRows)} selected</span>
        )}
      </div>

      {status.aggregation && (
        <div className="flex items-center gap-4">
          <span>Count: {fmt(status.aggregation.count)}</span>
          <span>Sum: {fmtDecimal(status.aggregation.sum)}</span>
          <span>Avg: {fmtDecimal(status.aggregation.avg)}</span>
          <span>Min: {fmtDecimal(status.aggregation.min)}</span>
          <span>Max: {fmtDecimal(status.aggregation.max)}</span>
        </div>
      )}
    </div>
  )
}
