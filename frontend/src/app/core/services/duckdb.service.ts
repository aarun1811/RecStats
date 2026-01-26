import { Injectable } from '@angular/core';
import * as duckdb from '@duckdb/duckdb-wasm';

export interface QueryResult {
  columns: string[];
  rows: any[];
  rowCount: number;
  executionTime: number;
}

@Injectable({
  providedIn: 'root'
})
export class DuckDbService {
  private db: duckdb.AsyncDuckDB | null = null;
  private conn: duckdb.AsyncDuckDBConnection | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Start initialization
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Use CDN bundles for simplicity
      const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

      // Select a bundle based on browser capabilities
      const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

      const worker_url = URL.createObjectURL(
        new Blob([`importScripts("${bundle.mainWorker!}");`], { type: 'text/javascript' })
      );

      const worker = new Worker(worker_url);
      const logger = new duckdb.ConsoleLogger();

      this.db = new duckdb.AsyncDuckDB(logger, worker);
      await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);

      URL.revokeObjectURL(worker_url);

      this.conn = await this.db.connect();
      this.initialized = true;

      console.log('DuckDB-WASM initialized successfully');
    } catch (error) {
      console.error('Failed to initialize DuckDB-WASM:', error);
      throw error;
    }
  }

  async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  async executeQuery(sql: string): Promise<QueryResult> {
    await this.ensureInitialized();

    if (!this.conn) {
      throw new Error('DuckDB connection not available');
    }

    const startTime = performance.now();

    try {
      const result = await this.conn.query(sql);
      const endTime = performance.now();

      const columns = result.schema.fields.map(f => f.name);
      const rows = result.toArray().map((row: any) => {
        const obj: any = {};
        columns.forEach((col, idx) => {
          obj[col] = row[col] ?? row[idx];
        });
        return obj;
      });

      return {
        columns,
        rows,
        rowCount: rows.length,
        executionTime: Math.round(endTime - startTime)
      };
    } catch (error: any) {
      console.error('DuckDB query error:', error);
      throw new Error(`Query execution failed: ${error.message}`);
    }
  }

  async loadCSV(tableName: string, csvData: string): Promise<void> {
    await this.ensureInitialized();

    if (!this.db || !this.conn) {
      throw new Error('DuckDB not available');
    }

    // Register CSV file
    await this.db.registerFileText(`${tableName}.csv`, csvData);

    // Create table from CSV
    await this.conn.query(`
      CREATE OR REPLACE TABLE ${tableName} AS
      SELECT * FROM read_csv_auto('${tableName}.csv')
    `);

    console.log(`Loaded CSV into table: ${tableName}`);
  }

  async loadJSON(tableName: string, data: any[]): Promise<void> {
    await this.ensureInitialized();

    if (!this.db || !this.conn) {
      throw new Error('DuckDB not available');
    }

    // Convert to JSON string
    const jsonData = JSON.stringify(data);

    // Register JSON file
    await this.db.registerFileText(`${tableName}.json`, jsonData);

    // Create table from JSON
    await this.conn.query(`
      CREATE OR REPLACE TABLE ${tableName} AS
      SELECT * FROM read_json_auto('${tableName}.json')
    `);

    console.log(`Loaded JSON into table: ${tableName}`);
  }

  async loadParquet(tableName: string, parquetData: Uint8Array): Promise<void> {
    await this.ensureInitialized();

    if (!this.db || !this.conn) {
      throw new Error('DuckDB not available');
    }

    // Register Parquet file
    await this.db.registerFileBuffer(`${tableName}.parquet`, parquetData);

    // Create table from Parquet
    await this.conn.query(`
      CREATE OR REPLACE TABLE ${tableName} AS
      SELECT * FROM read_parquet('${tableName}.parquet')
    `);

    console.log(`Loaded Parquet into table: ${tableName}`);
  }

  async getTableInfo(tableName: string): Promise<{ name: string; type: string }[]> {
    await this.ensureInitialized();

    const result = await this.executeQuery(`DESCRIBE ${tableName}`);

    return result.rows.map(row => ({
      name: row.column_name || row.name,
      type: row.column_type || row.type
    }));
  }

  async getTables(): Promise<string[]> {
    await this.ensureInitialized();

    const result = await this.executeQuery(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'main'
    `);

    return result.rows.map(row => row.table_name);
  }

  async dropTable(tableName: string): Promise<void> {
    await this.ensureInitialized();

    if (!this.conn) {
      throw new Error('DuckDB connection not available');
    }

    await this.conn.query(`DROP TABLE IF EXISTS ${tableName}`);
    console.log(`Dropped table: ${tableName}`);
  }

  async close(): Promise<void> {
    if (this.conn) {
      await this.conn.close();
      this.conn = null;
    }
    if (this.db) {
      await this.db.terminate();
      this.db = null;
    }
    this.initialized = false;
  }
}
