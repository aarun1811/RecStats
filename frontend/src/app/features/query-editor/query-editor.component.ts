import { Component, OnInit, inject, signal } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { NotificationService } from '../../core/services/notification.service';
import { firstValueFrom } from 'rxjs';

interface Column {
  name: string;
  data_type: string;
}

interface QueryResult {
  columns: Column[];
  data: any[];
  row_count?: number;
  execution_time_ms?: number;
}

interface DataSource {
  id: string;
  name: string;
  type: string;
}

interface TableSchema {
  name: string;
  columns: { name: string; data_type: string }[];
}

@Component({
  selector: 'app-query-editor',
  template: `
    <div class="query-editor-page">
      <!-- Left Sidebar: Schema Explorer -->
      <aside class="schema-sidebar">
        <div class="sidebar-header">
          <h3>Schema Explorer</h3>
          <app-button variant="ghost" size="sm" (click)="refreshSchema()">
            <app-icon name="refresh" [size]="16"></app-icon>
          </app-button>
        </div>
        <div class="datasource-select">
          <select [(ngModel)]="selectedDataSourceId" (ngModelChange)="onDataSourceChange()">
            <option value="">Select Data Source</option>
            <option *ngFor="let ds of dataSources()" [value]="ds.id">
              {{ ds.name }} ({{ ds.type }})
            </option>
          </select>
        </div>
        <app-schema-explorer
          [tables]="schemaTables()"
          (tableClick)="insertTableName($event)"
          (columnClick)="insertColumnName($event)">
        </app-schema-explorer>
      </aside>

      <!-- Main Content -->
      <main class="editor-main">
        <!-- Toolbar -->
        <div class="editor-toolbar">
          <div class="toolbar-left">
            <app-button variant="primary" (click)="executeQuery()" [disabled]="isExecuting()">
              <app-icon name="play" [size]="16"></app-icon>
              {{ isExecuting() ? 'Executing...' : 'Run Query' }}
            </app-button>
            <app-button variant="secondary" (click)="formatQuery()">
              <app-icon name="code" [size]="16"></app-icon>
              Format
            </app-button>
            <app-button variant="ghost" (click)="clearQuery()">
              <app-icon name="trash" [size]="16"></app-icon>
              Clear
            </app-button>
          </div>
          <div class="toolbar-right">
            <app-button variant="ghost" (click)="saveQuery()">
              <app-icon name="save" [size]="16"></app-icon>
              Save Query
            </app-button>
          </div>
        </div>

        <!-- SQL Editor -->
        <div class="editor-container">
          <app-sql-editor
            [(sql)]="sqlText"
            [readOnly]="isExecuting()">
          </app-sql-editor>
        </div>

        <!-- Results Panel -->
        <div class="results-panel">
          <div class="results-header">
            <div class="results-tabs">
              <button
                class="tab"
                [class.active]="activeTab() === 'results'"
                (click)="activeTab.set('results')">
                Results
                <span class="badge" *ngIf="queryResult()">
                  {{ queryResult()?.data?.length || 0 }} rows
                </span>
              </button>
              <button
                class="tab"
                [class.active]="activeTab() === 'history'"
                (click)="activeTab.set('history')">
                History
              </button>
            </div>
            <div class="results-info" *ngIf="queryResult() && executionTime()">
              <span class="execution-time">
                <app-icon name="clock" [size]="14"></app-icon>
                {{ executionTime() }}ms
              </span>
            </div>
          </div>

          <div class="results-content">
            <!-- Results Table -->
            <div *ngIf="activeTab() === 'results'" class="table-container">
              <app-results-table
                *ngIf="queryResult()"
                [columns]="queryResult()?.columns || []"
                [data]="queryResult()?.data || []">
              </app-results-table>

              <div *ngIf="!queryResult() && !isExecuting()" class="empty-state">
                <app-icon name="database" [size]="48"></app-icon>
                <p>Run a query to see results</p>
              </div>

              <div *ngIf="isExecuting()" class="loading-state">
                <app-loading-spinner size="lg"></app-loading-spinner>
                <p>Executing query...</p>
              </div>
            </div>

            <!-- Query History -->
            <div *ngIf="activeTab() === 'history'" class="history-container">
              <div
                *ngFor="let item of queryHistory()"
                class="history-item"
                (click)="loadHistoryItem(item)">
                <div class="history-sql">{{ item.sql.substring(0, 100) }}...</div>
                <div class="history-meta">
                  <span>{{ formatDate(item.timestamp) }}</span>
                  <span>{{ item.rowCount }} rows</span>
                </div>
              </div>
              <div *ngIf="queryHistory().length === 0" class="empty-state">
                <p>No query history yet</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .query-editor-page {
      display: grid;
      grid-template-columns: 280px 1fr;
      height: calc(100vh - 64px);
      gap: 0;
    }

    .schema-sidebar {
      background: var(--bg-secondary);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-4);
      border-bottom: 1px solid var(--border-color);

      h3 {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin: 0;
      }
    }

    .datasource-select {
      padding: var(--spacing-3);
      border-bottom: 1px solid var(--border-color);

      select {
        width: 100%;
        padding: var(--spacing-2) var(--spacing-3);
        background: var(--bg-tertiary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        color: var(--text-primary);
        font-size: var(--font-size-sm);
        cursor: pointer;

        &:focus {
          outline: none;
          border-color: var(--color-primary);
        }

        option {
          background: var(--bg-secondary);
          color: var(--text-primary);
        }
      }
    }

    .editor-main {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .editor-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-3) var(--spacing-4);
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      gap: var(--spacing-3);
    }

    .toolbar-left, .toolbar-right {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
    }

    .editor-container {
      flex: 1;
      min-height: 200px;
      border-bottom: 1px solid var(--border-color);
    }

    .results-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 200px;
      background: var(--bg-primary);
    }

    .results-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 var(--spacing-4);
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
    }

    .results-tabs {
      display: flex;
      gap: 0;
    }

    .tab {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      padding: var(--spacing-3) var(--spacing-4);
      background: transparent;
      border: none;
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.2s ease;

      &:hover {
        color: var(--text-primary);
      }

      &.active {
        color: var(--color-primary-light);
        border-bottom-color: var(--color-primary);
      }

      .badge {
        padding: 2px 6px;
        background: var(--bg-tertiary);
        border-radius: var(--radius-full);
        font-size: var(--font-size-xs);
        color: var(--text-muted);
      }
    }

    .results-info {
      display: flex;
      align-items: center;
      gap: var(--spacing-3);
    }

    .execution-time {
      display: flex;
      align-items: center;
      gap: var(--spacing-1);
      font-size: var(--font-size-sm);
      color: var(--text-muted);
    }

    .results-content {
      flex: 1;
      overflow: hidden;
    }

    .table-container {
      height: 100%;
      overflow: auto;
    }

    .empty-state, .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: var(--spacing-3);
      color: var(--text-muted);

      p {
        margin: 0;
      }
    }

    .history-container {
      padding: var(--spacing-3);
      overflow-y: auto;
      height: 100%;
    }

    .history-item {
      padding: var(--spacing-3);
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
      margin-bottom: var(--spacing-2);
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: var(--bg-tertiary);
      }
    }

    .history-sql {
      font-family: var(--font-mono);
      font-size: var(--font-size-sm);
      color: var(--text-primary);
      margin-bottom: var(--spacing-2);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .history-meta {
      display: flex;
      gap: var(--spacing-3);
      font-size: var(--font-size-xs);
      color: var(--text-muted);
    }
  `]
})
export class QueryEditorComponent implements OnInit {
  private api = inject(ApiService);
  private notifications = inject(NotificationService);

  // State
  dataSources = signal<DataSource[]>([]);
  selectedDataSourceId = '';
  schemaTables = signal<TableSchema[]>([]);
  sqlText = 'SELECT * FROM transactions LIMIT 100';
  queryResult = signal<QueryResult | null>(null);
  isExecuting = signal(false);
  executionTime = signal<number | null>(null);
  activeTab = signal<'results' | 'history'>('results');
  queryHistory = signal<{ sql: string; timestamp: Date; rowCount: number }[]>([]);

  ngOnInit() {
    this.loadDataSources();
  }

  async loadDataSources() {
    try {
      const response = await firstValueFrom(this.api.get<DataSource[]>('/datasources'));
      this.dataSources.set(response);

      // Auto-select first data source
      if (response.length > 0) {
        this.selectedDataSourceId = response[0].id;
        this.loadSchema();
      }
    } catch (error) {
      this.notifications.error('Failed to load data sources');
    }
  }

  async onDataSourceChange() {
    if (this.selectedDataSourceId) {
      await this.loadSchema();
    }
  }

  async loadSchema() {
    if (!this.selectedDataSourceId) return;

    try {
      const response = await firstValueFrom(
        this.api.get<{ tables: TableSchema[] }>(`/datasources/${this.selectedDataSourceId}/schema`)
      );
      this.schemaTables.set(response.tables || []);
    } catch (error) {
      // Schema might not be available for all data sources
      this.schemaTables.set([]);
    }
  }

  refreshSchema() {
    this.loadSchema();
  }

  insertTableName(tableName: string) {
    this.sqlText += ` ${tableName}`;
  }

  insertColumnName(columnName: string) {
    this.sqlText += ` ${columnName}`;
  }

  async executeQuery() {
    if (!this.selectedDataSourceId || !this.sqlText.trim()) {
      this.notifications.warning('Please select a data source and enter a query');
      return;
    }

    this.isExecuting.set(true);
    this.queryResult.set(null);
    const startTime = Date.now();

    try {
      const response = await firstValueFrom(
        this.api.post<QueryResult>('/queries/execute', {
          data_source_id: this.selectedDataSourceId,
          sql: this.sqlText
        })
      );

      const execTime = Date.now() - startTime;
      this.executionTime.set(execTime);
      this.queryResult.set(response);

      // Add to history
      this.queryHistory.update(history => [{
        sql: this.sqlText,
        timestamp: new Date(),
        rowCount: response.data?.length || 0
      }, ...history.slice(0, 19)]);

      this.notifications.success(`Query executed in ${execTime}ms`);
    } catch (error: any) {
      this.notifications.error(error.message || 'Query execution failed');
    } finally {
      this.isExecuting.set(false);
    }
  }

  formatQuery() {
    // Basic SQL formatting
    this.sqlText = this.sqlText
      .replace(/\s+/g, ' ')
      .replace(/,\s*/g, ',\n  ')
      .replace(/\bSELECT\b/gi, 'SELECT\n  ')
      .replace(/\bFROM\b/gi, '\nFROM ')
      .replace(/\bWHERE\b/gi, '\nWHERE ')
      .replace(/\bGROUP BY\b/gi, '\nGROUP BY ')
      .replace(/\bORDER BY\b/gi, '\nORDER BY ')
      .replace(/\bLIMIT\b/gi, '\nLIMIT ')
      .replace(/\bJOIN\b/gi, '\nJOIN ')
      .replace(/\bLEFT\b/gi, '\nLEFT')
      .replace(/\bRIGHT\b/gi, '\nRIGHT')
      .replace(/\bINNER\b/gi, '\nINNER')
      .replace(/\bOUTER\b/gi, '\nOUTER')
      .trim();
  }

  clearQuery() {
    this.sqlText = '';
    this.queryResult.set(null);
  }

  saveQuery() {
    // TODO: Implement save query modal
    this.notifications.info('Save query feature coming soon');
  }

  loadHistoryItem(item: { sql: string; timestamp: Date; rowCount: number }) {
    this.sqlText = item.sql;
    this.activeTab.set('results');
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleString();
  }
}
