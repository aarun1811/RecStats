export interface ColumnInfo {
  name: string
  type: string
  isDimension: boolean
  isMetric: boolean
  filterable: boolean
}

export interface DatasetInfo {
  id: string
  name: string
  tableName: string
  databaseId: string
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
