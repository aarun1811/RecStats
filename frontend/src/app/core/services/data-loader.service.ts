import { Injectable, inject, signal } from '@angular/core';
import { DuckDbService, QueryResult } from './duckdb.service';
import { ApiService } from './api.service';
import { firstValueFrom } from 'rxjs';

export interface DataLoadStatus {
  initialized: boolean;
  loading: boolean;
  tablesLoaded: string[];
  totalRows: number;
  error?: string;
}

interface BulkDataResponse {
  transactions: any[];
  breaks: any[];
  daily_metrics: any[];
}

@Injectable({
  providedIn: 'root'
})
export class DataLoaderService {
  private duckdb = inject(DuckDbService);
  private api = inject(ApiService);

  // Reactive status
  status = signal<DataLoadStatus>({
    initialized: false,
    loading: false,
    tablesLoaded: [],
    totalRows: 0
  });

  private initPromise: Promise<void> | null = null;

  /**
   * Initialize DuckDB and load data from backend
   */
  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._initialize();
    return this.initPromise;
  }

  private async _initialize(): Promise<void> {
    if (this.status().initialized) return;

    this.status.update(s => ({ ...s, loading: true }));

    try {
      // Ensure DuckDB is ready
      await this.duckdb.ensureInitialized();

      // Fetch bulk data from backend
      const data = await firstValueFrom(
        this.api.get<BulkDataResponse>('/data/bulk')
      );

      // Load transactions
      if (data.transactions?.length > 0) {
        await this.loadTableData('transactions', data.transactions);
      }

      // Load breaks
      if (data.breaks?.length > 0) {
        await this.loadTableData('breaks', data.breaks);
      }

      // Load daily metrics
      if (data.daily_metrics?.length > 0) {
        await this.loadTableData('daily_metrics', data.daily_metrics);
      }

      const totalRows = (data.transactions?.length || 0) +
                       (data.breaks?.length || 0) +
                       (data.daily_metrics?.length || 0);

      this.status.set({
        initialized: true,
        loading: false,
        tablesLoaded: ['transactions', 'breaks', 'daily_metrics'],
        totalRows
      });
    } catch (error: any) {
      console.error('Failed to initialize DuckDB data:', error);
      this.status.update(s => ({
        ...s,
        loading: false,
        error: error.message || 'Failed to load data'
      }));
      throw error;
    }
  }

  /**
   * Load array data into a DuckDB table
   */
  private async loadTableData(tableName: string, data: any[]): Promise<void> {
    if (!data || data.length === 0) return;

    // Get column names and types from first row
    const columns = Object.keys(data[0]);

    // Build CREATE TABLE statement with inferred types
    const columnDefs = columns.map(col => {
      const sampleValue = data[0][col];
      let type = 'VARCHAR';
      if (typeof sampleValue === 'number') {
        type = Number.isInteger(sampleValue) ? 'INTEGER' : 'DOUBLE';
      } else if (typeof sampleValue === 'boolean') {
        type = 'BOOLEAN';
      } else if (sampleValue instanceof Date) {
        type = 'DATE';
      }
      return `"${col}" ${type}`;
    }).join(', ');

    // Create table
    await this.duckdb.executeQuery(`DROP TABLE IF EXISTS ${tableName}`);
    await this.duckdb.executeQuery(`CREATE TABLE ${tableName} (${columnDefs})`);

    // Insert data in batches for performance
    const batchSize = 1000;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const values = batch.map(row => {
        const vals = columns.map(col => {
          const v = row[col];
          if (v === null || v === undefined) return 'NULL';
          if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
          if (typeof v === 'number') return v;
          if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
          return `'${String(v).replace(/'/g, "''")}'`;
        });
        return `(${vals.join(', ')})`;
      }).join(',\n');

      await this.duckdb.executeQuery(`
        INSERT INTO ${tableName} (${columns.map(c => `"${c}"`).join(', ')})
        VALUES ${values}
      `);
    }

    this.status.update(s => ({
      ...s,
      tablesLoaded: [...new Set([...s.tablesLoaded, tableName])]
    }));
  }

  /**
   * Execute a query against DuckDB
   */
  async executeQuery(sql: string): Promise<QueryResult> {
    await this.initialize();
    return this.duckdb.executeQuery(sql);
  }

  /**
   * Get schema information for all tables
   */
  async getSchema(): Promise<{ name: string; columns: { name: string; type: string }[] }[]> {
    await this.initialize();

    const tables = await this.duckdb.getTables();
    const schema = [];

    for (const table of tables) {
      const columns = await this.duckdb.getTableInfo(table);
      schema.push({ name: table, columns });
    }

    return schema;
  }

  /**
   * Check if DuckDB is ready
   */
  isReady(): boolean {
    return this.status().initialized && !this.status().loading;
  }
}
