import type { AgChartInstance } from 'ag-charts-community'
import type ReactECharts from 'echarts-for-react'

/**
 * Export an AG Charts instance as PNG and trigger download.
 */
export async function exportChartAsPng(
  chartRef: React.RefObject<AgChartInstance | null>,
  filename = 'chart.png',
): Promise<void> {
  const chart = chartRef.current
  if (!chart) return

  // Find the AG Charts canvas inside the chart container
  const canvas = document.querySelector(
    '.ag-charts-wrapper canvas',
  ) as HTMLCanvasElement | null

  if (!canvas) return

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  )

  if (!blob) return
  triggerDownload(blob, filename)
}

/**
 * Export an ECharts instance as PNG and trigger download.
 */
export function exportEChartAsPng(
  echartsRef: ReactECharts | null,
  filename = 'chart.png',
): void {
  if (!echartsRef) return

  const echartsCore = echartsRef.getEchartsInstance()
  if (!echartsCore) return

  const dataUrl = echartsCore.getDataURL({
    type: 'png',
    pixelRatio: 2,
    backgroundColor: '#fff',
  })

  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  link.click()
}

/**
 * Export chart data as CSV and trigger download.
 */
export function exportChartDataAsCsv(
  data: Record<string, unknown>[],
  columns: string[],
  filename = 'chart-data.csv',
): void {
  if (data.length === 0) return

  const header = columns.join(',')
  const rows = data.map((row) =>
    columns.map((col) => escapeCsvValue(String(row[col] ?? ''))).join(','),
  )
  const csv = [header, ...rows].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, filename)
}

/**
 * Copy AG Charts chart image to clipboard.
 */
export async function copyChartToClipboard(
  chartRef: React.RefObject<AgChartInstance | null>,
): Promise<boolean> {
  const chart = chartRef.current
  if (!chart) return false

  const canvas = document.querySelector(
    '.ag-charts-wrapper canvas',
  ) as HTMLCanvasElement | null

  if (!canvas) return false

  try {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    )
    if (!blob) return false

    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob }),
    ])
    return true
  } catch {
    return false
  }
}

/**
 * Copy ECharts chart image to clipboard.
 */
export async function copyEChartToClipboard(
  echartsRef: ReactECharts | null,
): Promise<boolean> {
  if (!echartsRef) return false

  const echartsCore = echartsRef.getEchartsInstance()
  if (!echartsCore) return false

  try {
    const dataUrl = echartsCore.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: '#fff',
    })

    const response = await fetch(dataUrl)
    const blob = await response.blob()

    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob }),
    ])
    return true
  } catch {
    return false
  }
}

function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
