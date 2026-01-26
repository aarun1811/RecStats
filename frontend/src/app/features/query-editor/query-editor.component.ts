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

interface TableSchema {
  name: string;
  columns: { name: string; type: string; nullable: boolean; primary_key: boolean }[];
  row_count?: number;
}

interface SavedQuery {
  id: string;
  name: string;
  description?: string;
  sql_text: string;
  created_at: string;
  updated_at: string;
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
        <div class="datasource-info">
          <div class="datasource-badge" [class.loading]="isLoadingSchema()">
            <app-icon name="database" [size]="14"></app-icon>
            <span *ngIf="isLoadingSchema()">Loading schema...</span>
            <span *ngIf="!isLoadingSchema()">SQLite Database</span>
          </div>
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
            <app-button variant="ghost" (click)="showLoadDropdown()">
              <app-icon name="folder" [size]="16"></app-icon>
              Load
            </app-button>
            <app-button variant="ghost" (click)="openSaveModal()">
              <app-icon name="save" [size]="16"></app-icon>
              Save
            </app-button>
          </div>
        </div>

        <!-- SQL Editor -->
        <div class="editor-container">
          <app-sql-editor
            [(sql)]="sqlText"
            [readOnly]="isExecuting()"
            [schema]="schemaTables()">
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
              <button
                class="tab"
                [class.active]="activeTab() === 'saved'"
                (click)="activeTab.set('saved'); loadSavedQueries()">
                Saved
                <span class="badge" *ngIf="savedQueries().length > 0">
                  {{ savedQueries().length }}
                </span>
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

            <!-- Saved Queries -->
            <div *ngIf="activeTab() === 'saved'" class="saved-container">
              <div
                *ngFor="let query of savedQueries()"
                class="saved-item">
                <div class="saved-header">
                  <div class="saved-name">{{ query.name }}</div>
                  <div class="saved-actions">
                    <app-button variant="ghost" size="sm" (click)="loadSavedQuery(query)">
                      <app-icon name="play" [size]="14"></app-icon>
                    </app-button>
                    <app-button variant="ghost" size="sm" (click)="deleteSavedQuery(query.id)">
                      <app-icon name="trash" [size]="14"></app-icon>
                    </app-button>
                  </div>
                </div>
                <div class="saved-sql">{{ query.sql_text.substring(0, 80) }}...</div>
                <div class="saved-meta">
                  <span *ngIf="query.description">{{ query.description }}</span>
                  <span>Created {{ formatDate(query.created_at) }}</span>
                </div>
              </div>
              <div *ngIf="savedQueries().length === 0" class="empty-state">
                <app-icon name="folder" [size]="48"></app-icon>
                <p>No saved queries yet</p>
                <p class="hint">Click "Save" to save your current query</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <!-- Save Query Modal -->
      <div class="modal-overlay" *ngIf="showSaveModal()" (click)="closeSaveModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Save Query</h3>
            <app-button variant="ghost" size="sm" (click)="closeSaveModal()">
              <app-icon name="x" [size]="18"></app-icon>
            </app-button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Query Name *</label>
              <input
                type="text"
                class="form-input"
                [(ngModel)]="saveQueryName"
                placeholder="Enter query name">
            </div>
            <div class="form-group">
              <label>Description (optional)</label>
              <textarea
                class="form-input"
                [(ngModel)]="saveQueryDescription"
                rows="2"
                placeholder="Brief description of what this query does">
              </textarea>
            </div>
            <div class="form-group">
              <label>SQL Preview</label>
              <pre class="sql-preview">{{ sqlText.substring(0, 200) }}{{ sqlText.length > 200 ? '...' : '' }}</pre>
            </div>
          </div>
          <div class="modal-footer">
            <app-button variant="ghost" (click)="closeSaveModal()">Cancel</app-button>
            <app-button variant="primary" (click)="saveQuery()" [disabled]="!saveQueryName.trim()">
              <app-icon name="save" [size]="16"></app-icon>
              Save Query
            </app-button>
          </div>
        </div>
      </div>
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

    .datasource-info {
      padding: var(--spacing-3);
      border-bottom: 1px solid var(--border-color);
    }

    .datasource-badge {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      padding: var(--spacing-2) var(--spacing-3);
      background: rgba(var(--color-primary-rgb), 0.15);
      border: 1px solid var(--color-primary);
      border-radius: var(--radius-md);
      color: var(--color-primary-light);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);

      &.loading {
        border-color: var(--color-warning);
        color: var(--color-warning);
        animation: pulse 1.5s ease-in-out infinite;
      }
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
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

    .saved-container {
      padding: var(--spacing-3);
      overflow-y: auto;
      height: 100%;
    }

    .saved-item {
      padding: var(--spacing-3);
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
      margin-bottom: var(--spacing-2);
      transition: all 0.2s ease;

      &:hover {
        background: var(--bg-tertiary);
      }
    }

    .saved-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--spacing-2);
    }

    .saved-name {
      font-weight: var(--font-weight-semibold);
      color: var(--text-primary);
    }

    .saved-actions {
      display: flex;
      gap: var(--spacing-1);
    }

    .saved-sql {
      font-family: var(--font-mono);
      font-size: var(--font-size-xs);
      color: var(--text-secondary);
      margin-bottom: var(--spacing-2);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .saved-meta {
      display: flex;
      gap: var(--spacing-3);
      font-size: var(--font-size-xs);
      color: var(--text-muted);
    }

    .hint {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      width: 100%;
      max-width: 500px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-4);
      border-bottom: 1px solid var(--border-color);

      h3 {
        margin: 0;
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--text-primary);
      }
    }

    .modal-body {
      padding: var(--spacing-4);
    }

    .modal-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--spacing-2);
      padding: var(--spacing-4);
      border-top: 1px solid var(--border-color);
    }

    .form-group {
      margin-bottom: var(--spacing-4);

      &:last-child {
        margin-bottom: 0;
      }

      label {
        display: block;
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        color: var(--text-secondary);
        margin-bottom: var(--spacing-2);
      }
    }

    .form-input {
      width: 100%;
      padding: var(--spacing-3);
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      color: var(--text-primary);
      font-size: var(--font-size-sm);
      font-family: inherit;
      resize: vertical;
      transition: border-color 0.2s ease;

      &:focus {
        outline: none;
        border-color: var(--color-primary);
      }

      &::placeholder {
        color: var(--text-muted);
      }
    }

    .sql-preview {
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: var(--spacing-3);
      font-family: var(--font-mono);
      font-size: var(--font-size-xs);
      color: var(--text-secondary);
      overflow-x: auto;
      margin: 0;
      white-space: pre-wrap;
      word-break: break-all;
    }
  `]
})
export class QueryEditorComponent implements OnInit {
  private api = inject(ApiService);
  private notifications = inject(NotificationService);

  // State
  schemaTables = signal<TableSchema[]>([]);
  sqlText = 'SELECT * FROM transactions LIMIT 100';
  queryResult = signal<QueryResult | null>(null);
  isExecuting = signal(false);
  executionTime = signal<number | null>(null);
  activeTab = signal<'results' | 'history' | 'saved'>('results');
  queryHistory = signal<{ sql: string; timestamp: Date; rowCount: number }[]>([]);
  isLoadingSchema = signal(false);
  savedQueries = signal<SavedQuery[]>([]);
  showSaveModal = signal(false);
  saveQueryName = '';
  saveQueryDescription = '';

  ngOnInit() {
    this.loadSchema();
  }

  async loadSchema() {
    this.isLoadingSchema.set(true);
    try {
      const response = await firstValueFrom(
        this.api.get<{ tables: TableSchema[] }>('/queries/schema')
      );
      this.schemaTables.set(response.tables || []);
    } catch (error) {
      this.notifications.error('Failed to load schema');
      this.schemaTables.set([]);
    } finally {
      this.isLoadingSchema.set(false);
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
    if (!this.sqlText.trim()) {
      this.notifications.warning('Please enter a SQL query');
      return;
    }

    this.isExecuting.set(true);
    this.queryResult.set(null);

    try {
      // Execute query via backend API
      const result = await firstValueFrom(
        this.api.post<QueryResult>('/queries/direct', { sql: this.sqlText })
      );

      this.executionTime.set(result.execution_time_ms || 0);
      this.queryResult.set(result);

      // Add to history
      this.queryHistory.update(history => [{
        sql: this.sqlText,
        timestamp: new Date(),
        rowCount: result.row_count || 0
      }, ...history.slice(0, 19)]);

      this.notifications.success(`Query executed: ${result.row_count} rows in ${result.execution_time_ms}ms`);
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

  openSaveModal() {
    if (!this.sqlText.trim()) {
      this.notifications.warning('Please enter a SQL query to save');
      return;
    }
    this.saveQueryName = '';
    this.saveQueryDescription = '';
    this.showSaveModal.set(true);
  }

  closeSaveModal() {
    this.showSaveModal.set(false);
  }

  async saveQuery() {
    if (!this.saveQueryName.trim()) {
      this.notifications.warning('Please enter a query name');
      return;
    }

    try {
      await firstValueFrom(
        this.api.post<SavedQuery>('/queries', {
          name: this.saveQueryName.trim(),
          description: this.saveQueryDescription.trim() || null,
          sql_text: this.sqlText
        })
      );
      this.notifications.success('Query saved successfully');
      this.closeSaveModal();
      this.loadSavedQueries();
    } catch (error: any) {
      this.notifications.error(error.message || 'Failed to save query');
    }
  }

  async loadSavedQueries() {
    try {
      const queries = await firstValueFrom(
        this.api.get<SavedQuery[]>('/queries')
      );
      this.savedQueries.set(queries || []);
    } catch (error) {
      console.error('Failed to load saved queries:', error);
    }
  }

  loadSavedQuery(query: SavedQuery) {
    this.sqlText = query.sql_text;
    this.activeTab.set('results');
    this.notifications.info(`Loaded query: ${query.name}`);
  }

  async deleteSavedQuery(id: string) {
    try {
      await firstValueFrom(this.api.delete(`/queries/${id}`));
      this.notifications.success('Query deleted');
      this.loadSavedQueries();
    } catch (error: any) {
      this.notifications.error(error.message || 'Failed to delete query');
    }
  }

  loadHistoryItem(item: { sql: string; timestamp: Date; rowCount: number }) {
    this.sqlText = item.sql;
    this.activeTab.set('results');
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleString();
  }

  showLoadDropdown() {
    // Switch to Saved tab and load queries
    this.activeTab.set('saved');
    this.loadSavedQueries();
  }
}
