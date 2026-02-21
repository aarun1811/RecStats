export type DatabaseBackend = 'oracle' | 'postgresql' | 'hive' | 'elasticsearch'

export type ConnectionStatus = 'connected' | 'unreachable' | 'untested'

export interface DatabaseInfo {
  id: number
  databaseName: string
  backend: DatabaseBackend
  createdOn: string | null
  exposeInSqllab: boolean
  datasetCount: number
  status: ConnectionStatus
}

export interface DatabaseCreate {
  databaseName: string
  backend: DatabaseBackend
  sqlalchemyUri?: string
  host?: string
  port?: number
  database?: string
  schemaName?: string
  username?: string
  password?: string
}

export interface DatabaseUpdate {
  databaseName?: string
  backend?: DatabaseBackend
  sqlalchemyUri?: string
  host?: string
  port?: number
  database?: string
  schemaName?: string
  username?: string
  password?: string
}

export interface TestConnectionRequest {
  backend: DatabaseBackend
  sqlalchemyUri?: string
  host?: string
  port?: number
  database?: string
  username?: string
  password?: string
}

export interface TestConnectionResponse {
  success: boolean
  message: string
}

export interface DatasetSummary {
  id: number
  tableName: string
  columnCount: number
}

export interface DatasetPage {
  datasets: DatasetSummary[]
  total: number
  page: number
  pageSize: number
}
