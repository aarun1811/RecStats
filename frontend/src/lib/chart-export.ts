import { toast } from 'sonner'

/** Standard pixelRatio for all PNG exports -- 2x for retina-quality output. */
export const EXPORT_PIXEL_RATIO = 2

/** Escape a value for CSV: quote if contains comma, double-quote, or newline. */
function escapeCSV(value: unknown): string {
  const s = String(value ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/** Build a CSV string from columns and rows. */
export function buildCSV(columns: string[], rows: Record<string, unknown>[]): string {
  const header = columns.map(escapeCSV).join(',')
  const body = rows.map((row) => columns.map((col) => escapeCSV(row[col])).join(',')).join('\n')
  return `${header}\n${body}`
}

/** Build a TSV string (tab-separated) for clipboard. */
export function buildTSV(columns: string[], rows: Record<string, unknown>[]): string {
  const header = columns.join('\t')
  const body = rows.map((row) => columns.map((col) => String(row[col] ?? '')).join('\t')).join('\n')
  return `${header}\n${body}`
}

/** Sanitize a string for use as a filename. Lowercase, replace spaces with hyphens, strip special chars. */
export function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[<>\\/:"*?|]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Trigger a browser file download from a Blob. */
export function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

/** Trigger a browser file download from a data URL string. */
export function triggerDownloadFromDataURL(dataURL: string, fileName: string): void {
  const link = document.createElement('a')
  link.href = dataURL
  link.download = fileName
  link.click()
}

/** Download chart data as a CSV file. */
export function downloadCSV(columns: string[], rows: Record<string, unknown>[], fileName: string): void {
  const csv = buildCSV(columns, rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, fileName)
  toast.success('Data exported as CSV')
}

/** Copy chart data to clipboard as tab-separated text. */
export async function copyToClipboard(columns: string[], rows: Record<string, unknown>[]): Promise<void> {
  const tsv = buildTSV(columns, rows)
  try {
    await navigator.clipboard.writeText(tsv)
    toast.success('Data copied to clipboard')
  } catch {
    toast.error('Failed to copy to clipboard')
  }
}

/** Generate a timestamped export filename. */
export function exportFilename(chartTitle: string, extension: string): string {
  const date = new Date().toISOString().slice(0, 10)
  return `${sanitizeFilename(chartTitle)}-${date}.${extension}`
}
