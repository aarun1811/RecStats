export type ColumnDataType = 'string' | 'number' | 'date' | 'currency'
export type ColumnRole = 'dimension' | 'measure' | 'time' | 'none'
export type AggregationFunction = 'NONE' | 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' | 'COUNT_DISTINCT'
export type FormatPreset = 'none' | 'number' | 'currency' | 'percentage' | 'decimal2' | 'date' | 'datetime' | 'custom'

export interface DatasetColumnMeta {
  name: string
  displayName: string
  dataType: ColumnDataType
  role: ColumnRole
  aggregation: AggregationFunction
  formatPreset: FormatPreset
  formatString: string
}

export interface RecvizDataset {
  id: string
  name: string
  description: string
  databaseId: string
  sql: string
  columns: DatasetColumnMeta[]
  schemaVersion: number
  createdAt: string
  updatedAt: string
}

export interface DatasetCreate {
  name: string
  description: string
  databaseId: string
  sql: string
  columns: DatasetColumnMeta[]
}

export interface DatasetUpdate {
  name?: string
  description?: string
  sql?: string
  columns?: DatasetColumnMeta[]
}

export interface DatasetDeleteCheck {
  canDelete: boolean
  referencingCharts: { id: string; name: string }[]
}
