import type { ColumnDataType, ColumnRole, DatasetColumnMeta } from '@/types/managed-dataset'

export const DATE_PATTERNS = /(_date|_time|_at|_on|_dt|_ts)$/i

const MAX_SAMPLE_SIZE = 10

export function detectColumnType(name: string, sampleValues: unknown[]): ColumnDataType {
  if (DATE_PATTERNS.test(name)) {
    return 'date'
  }

  const nonNull = sampleValues.filter((v) => v !== null && v !== undefined).slice(0, MAX_SAMPLE_SIZE)

  if (nonNull.length === 0) {
    return 'string'
  }

  const numericCount = nonNull.filter((v) => typeof v === 'number').length
  if (numericCount / nonNull.length > 0.5) {
    return 'number'
  }

  return 'string'
}

function deriveRole(dataType: ColumnDataType): ColumnRole {
  switch (dataType) {
    case 'date':
      return 'time'
    case 'number':
    case 'currency':
      return 'measure'
    case 'string':
      return 'dimension'
    default:
      return 'none'
  }
}

function toDisplayName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function autoDetectColumns(
  columnNames: string[],
  rows: Record<string, unknown>[],
): DatasetColumnMeta[] {
  return columnNames.map((name) => {
    const sampleValues = rows.map((row) => row[name])
    const dataType = detectColumnType(name, sampleValues)
    const role = deriveRole(dataType)

    return {
      name,
      displayName: toDisplayName(name),
      dataType,
      role,
      aggregation: 'NONE',
      formatPreset: 'none',
      formatString: '',
    }
  })
}
