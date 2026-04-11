export interface SchemaTable {
  name: string
  type: string  // 'TABLE' or 'VIEW'
}

export interface SchemaColumn {
  name: string
  type: string
  nullable: boolean
}
