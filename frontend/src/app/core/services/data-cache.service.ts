import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { DuckDbService, QueryResult } from './duckdb.service';

export interface DataFilter {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'BETWEEN';
  value: any;
}

export interface CachedDataset {
  name: string;
  source: 'api' | 'file' | 'mock';
  rowCount: number;
  columns: { name: string; type: string }[];
  loadedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class DataCacheService {
  private duckDb = inject(DuckDbService);

  private datasets = new BehaviorSubject<CachedDataset[]>([]);
  datasets$ = this.datasets.asObservable();

  private globalFilters = new BehaviorSubject<DataFilter[]>([]);
  globalFilters$ = this.globalFilters.asObservable();

  private isReady = new BehaviorSubject<boolean>(false);
  isReady$ = this.isReady.asObservable();

  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      await this.duckDb.ensureInitialized();
      await this.loadMockData();
      this.isReady.next(true);
    } catch (error) {
      console.error('DataCacheService initialization failed:', error);
    }
  }

  private async loadMockData() {
    // Load sample reconciliation data for demo
    const transactions = this.generateTransactions(10000);
    const breaks = this.generateBreaks(1500);
    const dailyMetrics = this.generateDailyMetrics(365);

    await this.duckDb.loadJSON('transactions', transactions);
    await this.duckDb.loadJSON('breaks', breaks);
    await this.duckDb.loadJSON('daily_metrics', dailyMetrics);

    // Update datasets list
    const datasets: CachedDataset[] = [
      {
        name: 'transactions',
        source: 'mock',
        rowCount: transactions.length,
        columns: await this.duckDb.getTableInfo('transactions'),
        loadedAt: new Date()
      },
      {
        name: 'breaks',
        source: 'mock',
        rowCount: breaks.length,
        columns: await this.duckDb.getTableInfo('breaks'),
        loadedAt: new Date()
      },
      {
        name: 'daily_metrics',
        source: 'mock',
        rowCount: dailyMetrics.length,
        columns: await this.duckDb.getTableInfo('daily_metrics'),
        loadedAt: new Date()
      }
    ];

    this.datasets.next(datasets);
    console.log('Mock data loaded into DuckDB');
  }

  private generateTransactions(count: number): any[] {
    const regions = ['APAC', 'EMEA', 'NAM', 'LATAM'];
    const countries: Record<string, string[]> = {
      'APAC': ['Japan', 'Singapore', 'Hong Kong', 'Australia', 'India'],
      'EMEA': ['UK', 'Germany', 'France', 'Switzerland', 'UAE'],
      'NAM': ['USA', 'Canada', 'Mexico'],
      'LATAM': ['Brazil', 'Argentina', 'Chile', 'Colombia']
    };
    const lobs = ['Markets', 'Banking', 'Securities Services', 'Treasury'];
    const statuses = ['matched', 'matched', 'matched', 'matched', 'unmatched', 'break'];
    const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'SGD', 'HKD'];
    const systems = ['System A', 'System B', 'System C', 'System D'];

    const transactions: any[] = [];
    const now = new Date();

    for (let i = 0; i < count; i++) {
      const region = regions[Math.floor(Math.random() * regions.length)];
      const country = countries[region][Math.floor(Math.random() * countries[region].length)];
      const date = new Date(now.getTime() - Math.random() * 90 * 24 * 60 * 60 * 1000);

      transactions.push({
        id: `TXN${String(i + 1).padStart(8, '0')}`,
        date: date.toISOString().split('T')[0],
        amount: Math.round(Math.random() * 10000000) / 100,
        currency: currencies[Math.floor(Math.random() * currencies.length)],
        region,
        country,
        lob: lobs[Math.floor(Math.random() * lobs.length)],
        source_system: systems[Math.floor(Math.random() * systems.length)],
        counterparty: `CPTY${String(Math.floor(Math.random() * 500) + 1).padStart(4, '0')}`,
        status: statuses[Math.floor(Math.random() * statuses.length)]
      });
    }

    return transactions;
  }

  private generateBreaks(count: number): any[] {
    const reasons = [
      'Amount Mismatch',
      'Date Mismatch',
      'Missing Trade',
      'Duplicate Trade',
      'Settlement Fail',
      'Currency Mismatch',
      'Counterparty Mismatch',
      'Reference Mismatch'
    ];
    const categories = ['Critical', 'High', 'Medium', 'Low'];
    const assignees = ['John Smith', 'Jane Doe', 'Mike Johnson', 'Sarah Williams', 'Unassigned'];
    const regions = ['APAC', 'EMEA', 'NAM', 'LATAM'];
    const lobs = ['Markets', 'Banking', 'Securities Services', 'Treasury'];

    const breaks: any[] = [];
    const now = new Date();

    for (let i = 0; i < count; i++) {
      const createdDate = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000);
      const ageDays = Math.floor((now.getTime() - createdDate.getTime()) / (24 * 60 * 60 * 1000));

      breaks.push({
        id: `BRK${String(i + 1).padStart(6, '0')}`,
        transaction_id: `TXN${String(Math.floor(Math.random() * 10000) + 1).padStart(8, '0')}`,
        reason: reasons[Math.floor(Math.random() * reasons.length)],
        category: categories[Math.floor(Math.random() * categories.length)],
        amount: Math.round(Math.random() * 1000000) / 100,
        age_days: ageDays,
        assigned_to: assignees[Math.floor(Math.random() * assignees.length)],
        region: regions[Math.floor(Math.random() * regions.length)],
        lob: lobs[Math.floor(Math.random() * lobs.length)],
        created_date: createdDate.toISOString().split('T')[0],
        priority: Math.floor(Math.random() * 4) + 1
      });
    }

    return breaks;
  }

  private generateDailyMetrics(days: number): any[] {
    const metrics: any[] = [];
    const now = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const totalTransactions = Math.floor(Math.random() * 50000) + 20000;
      const matchRate = 90 + Math.random() * 8;
      const matched = Math.floor(totalTransactions * matchRate / 100);
      const unmatched = totalTransactions - matched;
      const breaks = Math.floor(unmatched * 0.3);

      metrics.push({
        date: date.toISOString().split('T')[0],
        total_transactions: totalTransactions,
        matched,
        unmatched,
        breaks,
        match_rate: Math.round(matchRate * 100) / 100,
        avg_break_age: Math.round((Math.random() * 5 + 2) * 10) / 10
      });
    }

    return metrics;
  }

  async query(sql: string): Promise<QueryResult> {
    return this.duckDb.executeQuery(sql);
  }

  async queryWithFilters(
    baseQuery: string,
    filters?: DataFilter[]
  ): Promise<QueryResult> {
    const allFilters = [...(filters || []), ...this.globalFilters.value];

    if (allFilters.length === 0) {
      return this.duckDb.executeQuery(baseQuery);
    }

    // Build WHERE clause
    const whereConditions = allFilters.map(f => {
      switch (f.operator) {
        case 'IN':
          const values = Array.isArray(f.value) ? f.value : [f.value];
          return `${f.field} IN (${values.map(v => `'${v}'`).join(', ')})`;
        case 'BETWEEN':
          return `${f.field} BETWEEN '${f.value[0]}' AND '${f.value[1]}'`;
        case 'LIKE':
          return `${f.field} LIKE '%${f.value}%'`;
        default:
          const val = typeof f.value === 'string' ? `'${f.value}'` : f.value;
          return `${f.field} ${f.operator} ${val}`;
      }
    });

    // Wrap base query and add WHERE
    const filteredQuery = `
      WITH base AS (${baseQuery})
      SELECT * FROM base
      WHERE ${whereConditions.join(' AND ')}
    `;

    return this.duckDb.executeQuery(filteredQuery);
  }

  setGlobalFilters(filters: DataFilter[]) {
    this.globalFilters.next(filters);
  }

  addGlobalFilter(filter: DataFilter) {
    const current = this.globalFilters.value;
    // Replace if same field exists
    const filtered = current.filter(f => f.field !== filter.field);
    this.globalFilters.next([...filtered, filter]);
  }

  removeGlobalFilter(field: string) {
    const current = this.globalFilters.value;
    this.globalFilters.next(current.filter(f => f.field !== field));
  }

  clearGlobalFilters() {
    this.globalFilters.next([]);
  }

  // Convenience methods for common queries
  async getTransactionsSummary(): Promise<QueryResult> {
    return this.query(`
      SELECT
        status,
        region,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM transactions
      GROUP BY status, region
      ORDER BY region, status
    `);
  }

  async getBreaksByReason(): Promise<QueryResult> {
    return this.query(`
      SELECT
        reason,
        COUNT(*) as count,
        AVG(age_days) as avg_age,
        SUM(amount) as total_amount
      FROM breaks
      GROUP BY reason
      ORDER BY count DESC
    `);
  }

  async getBreaksByRegion(): Promise<QueryResult> {
    return this.query(`
      SELECT
        region,
        category,
        COUNT(*) as count
      FROM breaks
      GROUP BY region, category
      ORDER BY region, category
    `);
  }

  async getDailyTrend(days: number = 30): Promise<QueryResult> {
    return this.query(`
      SELECT *
      FROM daily_metrics
      ORDER BY date DESC
      LIMIT ${days}
    `);
  }

  async getKPIs(): Promise<{
    totalTransactions: number;
    matchRate: number;
    openBreaks: number;
    avgBreakAge: number;
  }> {
    const result = await this.query(`
      SELECT
        COUNT(*) as total_transactions,
        ROUND(AVG(CASE WHEN status = 'matched' THEN 100.0 ELSE 0.0 END), 2) as match_rate
      FROM transactions
    `);

    const breaksResult = await this.query(`
      SELECT
        COUNT(*) as open_breaks,
        ROUND(AVG(age_days), 1) as avg_age
      FROM breaks
    `);

    return {
      totalTransactions: result.rows[0]?.total_transactions || 0,
      matchRate: result.rows[0]?.match_rate || 0,
      openBreaks: breaksResult.rows[0]?.open_breaks || 0,
      avgBreakAge: breaksResult.rows[0]?.avg_age || 0
    };
  }
}
