export interface ColumnInfo {
  name: string
  type: string
  isDimension: boolean
  isMetric: boolean
  filterable: boolean
}

export interface DatasetInfo {
  id: number
  name: string
  tableName: string
  databaseId: number
  columns?: ColumnInfo[]
  rowCount?: number | null
}

export interface SchemaNode {
  name: string
  tables: string[]
}

export interface SchemaTree {
  databaseName: string
  schemas: SchemaNode[]
}
