export interface DatasetColumn {
  name: string
  type: string
  isFilterable: boolean
  isGroupable: boolean
}

export interface Dataset {
  id: number
  name: string
  database: string
  schema: string
  tableName: string
  columns: DatasetColumn[]
}

export interface DatasetDataRequest {
  filters: Record<string, unknown>[]
  orderBy: { column: string; direction: 'asc' | 'desc' }[]
  offset: number
  limit: number
}

export interface DatasetDataResponse {
  data: Record<string, unknown>[]
  columns: string[]
  totalCount: number
  nextOffset: number | null
}
