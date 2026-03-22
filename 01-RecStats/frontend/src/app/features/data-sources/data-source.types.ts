export type DataSourceType = 'sqlite' | 'oracle';
export type ConnectionStatus = 'connected' | 'failed' | 'not_tested';

export interface DataSource {
  id: string;
  name: string;
  type: DataSourceType;
  description?: string;
  connection_status: ConnectionStatus;
  connection_message?: string;
  last_tested_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DataSourceCreate {
  name: string;
  type: DataSourceType;
  description?: string;
  connection_config: SQLiteConfig | OracleConfig;
}

export interface DataSourceUpdate {
  name?: string;
  description?: string;
  connection_config?: SQLiteConfig | OracleConfig;
}

export interface SQLiteConfig {
  database_path: string;
}

export interface OracleConfig {
  host: string;
  port: number;
  service_name: string;
  user: string;
  password: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: Record<string, any>;
}
