import { Component, OnInit, inject, signal, computed } from '@angular/core';
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
  data_source_id?: string;
  created_at: string;
  updated_at: string;
}

interface DataSourceResponse {
  id: string;
  name: string;
  type: 'sqlite' | 'oracle' | 'hive' | 'postgres' | 'csv' | 'excel' | 'mock';
  description?: string;
  created_at: string;
  updated_at: string;
}

interface DataSource extends DataSourceResponse {
  icon: string;
  status: 'connected' | 'disconnected' | 'loading';
}

@Component({
    selector: 'app-query-editor',
    template: `
    <div class="query-editor-page">
      <!-- Left Sidebar: Schema/Saved Tabs -->
      <aside class="schema-sidebar">
        <!-- Data Source Selector Row -->
        <div class="datasource-row">
          <div class="datasource-selector" (clickOutside)="showDataSourceDropdown.set(false)">
            <button class="datasource-trigger" (click)="showDataSourceDropdown.set(!showDataSourceDropdown())" [disabled]="isLoadingDataSources()">
              <div class="datasource-selected" *ngIf="selectedDataSource(); else loadingDs">
                <app-icon [name]="selectedDataSource()!.icon" [size]="16"></app-icon>
                <span class="datasource-name">{{ selectedDataSource()!.name }}</span>
                <span class="datasource-status" [class]="selectedDataSource()!.status">
                  {{ selectedDataSource()!.status === 'connected' ? '' : selectedDataSource()!.status }}
                </span>
              </div>
              <ng-template #loadingDs>
                <span class="datasource-name">{{ isLoadingDataSources() ? 'Loading...' : 'No data sources' }}</span>
              </ng-template>
              <app-icon name="chevron-down" [size]="14" [class.rotated]="showDataSourceDropdown()"></app-icon>
            </button>

            <div class="datasource-dropdown" *ngIf="showDataSourceDropdown() && dataSources().length > 0">
              <div
                *ngFor="let ds of dataSources()"
                class="datasource-option"
                [class.selected]="selectedDataSource() && ds.id === selectedDataSource()!.id"
                (click)="selectDataSource(ds)">
                <app-icon [name]="ds.icon" [size]="16"></app-icon>
                <span class="option-name">{{ ds.name }}</span>
                <span class="option-status" [class]="ds.status">
                  <span class="status-dot"></span>
                  {{ ds.status }}
                </span>
              </div>
              <div class="datasource-add" routerLink="/datasources">
                <app-icon name="plus" [size]="14"></app-icon>
                Add Data Source
              </div>
            </div>
          </div>
          <button class="refresh-btn" (click)="refreshSchema()" title="Refresh schema">
            <app-icon name="refresh" [size]="16"></app-icon>
          </button>
        </div>

        <!-- Sidebar Tabs -->
        <div class="sidebar-tabs">
          <button
            class="sidebar-tab"
            [class.active]="sidebarTab() === 'schema'"
            (click)="switchSidebarTab('schema')">
            <app-icon name="table" [size]="14"></app-icon>
            Schema
          </button>
          <button
            class="sidebar-tab"
            [class.active]="sidebarTab() === 'saved'"
            (click)="switchSidebarTab('saved')">
            <app-icon name="sql" [size]="14"></app-icon>
            Saved<span class="tab-count" *ngIf="savedQueries().length > 0">({{ savedQueries().length }})</span>
          </button>
        </div>

        <!-- Schema Tab Content -->
        <div *ngIf="sidebarTab() === 'schema'" class="sidebar-content">
          <app-schema-explorer
            [tables]="schemaTables()"
            (tableClick)="insertTableName($event)"
            (columnClick)="insertColumnName($event)">
          </app-schema-explorer>
        </div>

        <!-- Saved Queries Tab Content -->
        <div *ngIf="sidebarTab() === 'saved'" class="sidebar-content saved-content">
          <div class="saved-search">
            <app-icon name="search" [size]="14"></app-icon>
            <input
              type="text"
              placeholder="Search queries..."
              [(ngModel)]="savedQuerySearch"
              class="saved-search-input">
          </div>
          <div class="saved-list">
            <div
              *ngFor="let query of filteredSavedQueries()"
              class="sidebar-saved-item"
              [class.active]="activeQuery()?.id === query.id"
              (click)="loadSavedQuery(query)">
              <!-- Delete Confirmation State -->
              <div class="delete-confirm-inline" *ngIf="deleteConfirmId() === query.id">
                <app-icon name="alert-triangle" [size]="16"></app-icon>
                <span>Delete?</span>
                <div class="confirm-actions">
                  <button class="confirm-yes" (click)="confirmDeleteQuery(query.id); $event.stopPropagation()">Yes</button>
                  <button class="confirm-no" (click)="cancelDelete(); $event.stopPropagation()">No</button>
                </div>
              </div>
              <!-- Normal State -->
              <div class="sidebar-saved-content" *ngIf="deleteConfirmId() !== query.id">
                <div class="sidebar-saved-icon">
                  <app-icon name="sql" [size]="14"></app-icon>
                </div>
                <div class="sidebar-saved-name">{{ query.name }}</div>
                <button class="sidebar-delete-btn" (click)="requestDelete(query.id); $event.stopPropagation()" title="Delete query">
                  <app-icon name="trash" [size]="14"></app-icon>
                </button>
              </div>
            </div>
          </div>
          <div *ngIf="filteredSavedQueries().length === 0" class="sidebar-empty">
            <app-icon name="sql" [size]="32"></app-icon>
            <p>{{ savedQuerySearch ? 'No matching queries' : 'No saved queries' }}</p>
            <span class="hint">{{ savedQuerySearch ? 'Try a different search' : 'Click "Save" to save your query' }}</span>
          </div>
        </div>
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
            <!-- Active Query Indicator -->
            <div class="active-query-badge" *ngIf="activeQuery()">
              <app-icon name="sql" [size]="14"></app-icon>
              <span>{{ activeQuery()!.name }}</span>
              <button class="badge-close" (click)="clearActiveQuery()" title="Unload query">
                <app-icon name="x" [size]="12"></app-icon>
              </button>
            </div>
          </div>
          <div class="toolbar-right">
            <button class="toolbar-btn save-btn" (click)="openSaveModal()">
              <app-icon name="save" [size]="16"></app-icon>
              {{ activeQuery() ? 'Save As' : 'Save' }}
            </button>
            <button class="toolbar-btn update-btn" *ngIf="activeQuery()" (click)="updateActiveQuery()">
              <app-icon name="check" [size]="16"></app-icon>
              Update
            </button>
            <button class="toolbar-btn clear-btn" (click)="confirmClear()">
              <app-icon name="trash" [size]="16"></app-icon>
              Clear
            </button>
          </div>
        </div>

        <!-- Clear Confirmation Popup -->
        <div class="confirm-popup" *ngIf="showClearConfirm()">
          <div class="confirm-content">
            <app-icon name="alert-triangle" [size]="20"></app-icon>
            <span>Clear editor?</span>
            <div class="confirm-actions">
              <button class="confirm-yes" (click)="clearQuery()">Yes</button>
              <button class="confirm-no" (click)="showClearConfirm.set(false)">No</button>
            </div>
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
      animation: contentFade 250ms ease-out;
    }

    @keyframes contentFade {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    .schema-sidebar {
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur));
      -webkit-backdrop-filter: blur(var(--glass-blur));
      border-right: 1px solid var(--glass-border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    // Data Source Row (dropdown + refresh)
    .datasource-row {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      padding: var(--spacing-3);
      border-bottom: 1px solid var(--glass-border);
      background: var(--gradient-glow);
    }

    .datasource-row > .refresh-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      flex-shrink: 0;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.2s ease;

      app-icon {
        transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), filter 0.2s ease;
      }

      &:hover {
        background: var(--bg-hover);
        color: var(--color-primary-light);
        border-color: var(--color-primary);
        box-shadow: var(--shadow-glow-sm);

        app-icon {
          transform: rotate(180deg);
          filter: drop-shadow(0 0 4px rgba(var(--color-primary-rgb), 0.5));
        }
      }

      &:active {
        transform: scale(0.95);

        app-icon {
          transform: rotate(360deg);
          animation: refreshSpin 0.6s ease-out;
        }
      }
    }

    @keyframes refreshSpin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    // Data Source Selector - Glassmorphism
    .datasource-selector {
      position: relative;
      flex: 1;
    }

    .datasource-trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: var(--spacing-2) var(--spacing-3);
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      color: var(--text-primary);
      font-size: var(--font-size-sm);
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        border-color: var(--color-primary);
        background: var(--bg-hover);
        box-shadow: var(--shadow-glow-sm);
      }

      app-icon {
        transition: transform 0.2s ease;
      }

      app-icon.rotated {
        transform: rotate(180deg);
      }
    }

    .datasource-selected {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
    }

    .datasource-name {
      font-weight: var(--font-weight-medium);
    }

    .datasource-status {
      font-size: var(--font-size-xs);
      padding: 1px 6px;
      border-radius: var(--radius-full);

      &.connected {
        display: none;
      }

      &.disconnected {
        background: rgba(var(--color-danger-rgb), 0.15);
        color: var(--color-danger);
      }

      &.loading {
        background: rgba(var(--color-warning-rgb), 0.15);
        color: var(--color-warning);
      }
    }

    .datasource-dropdown {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur-lg));
      -webkit-backdrop-filter: blur(var(--glass-blur-lg));
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg), var(--shadow-glow-sm);
      z-index: 100;
      overflow: hidden;
      animation: dropdownOpen 0.2s ease-out;
    }

    @keyframes dropdownOpen {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .datasource-option {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      padding: var(--spacing-3);
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        background: rgba(var(--color-primary-rgb), 0.1);
      }

      &.selected {
        background: rgba(var(--color-primary-rgb), 0.15);
        color: var(--color-primary-light);
      }

      .option-name {
        flex: 1;
        font-size: var(--font-size-sm);
      }

      .option-status {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: var(--font-size-xs);
        color: var(--text-muted);

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--text-muted);
          transition: box-shadow 0.2s ease;
        }

        &.connected {
          color: var(--color-success);
          .status-dot {
            background: var(--color-success);
            box-shadow: 0 0 8px rgba(var(--color-success-rgb), 0.6);
          }
        }

        &.disconnected {
          color: var(--color-danger);
          .status-dot {
            background: var(--color-danger);
            box-shadow: 0 0 8px rgba(var(--color-danger-rgb), 0.4);
          }
        }

        &.loading {
          color: var(--color-warning);
          .status-dot {
            background: var(--color-warning);
            box-shadow: 0 0 8px rgba(var(--color-warning-rgb), 0.4);
            animation: pulse 1.5s ease-in-out infinite;
          }
        }
      }
    }

    .datasource-add {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      padding: var(--spacing-3);
      border-top: 1px solid var(--glass-border);
      color: var(--color-primary);
      font-size: var(--font-size-sm);
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        background: rgba(var(--color-primary-rgb), 0.1);
        box-shadow: inset 0 0 20px rgba(var(--color-primary-rgb), 0.05);
      }
    }

    .sidebar-tabs {
      display: flex;
      border-bottom: 1px solid var(--glass-border);
      position: relative;
    }

    .sidebar-tab {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-2);
      padding: var(--spacing-3);
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;

      app-icon {
        transition: transform 0.2s ease, filter 0.2s ease;
      }

      &:hover:not(.active) {
        color: var(--text-primary);
        background: rgba(var(--color-primary-rgb), 0.05);

        app-icon {
          transform: scale(1.15);
          filter: drop-shadow(0 0 3px rgba(var(--color-primary-rgb), 0.3));
        }
      }

      &:active app-icon {
        transform: scale(0.9);
      }

      &.active {
        color: var(--color-primary-light);
        background: linear-gradient(180deg, rgba(var(--color-primary-rgb), 0.1) 0%, transparent 100%);

        app-icon {
          filter: drop-shadow(0 0 4px rgba(var(--color-primary-rgb), 0.5));
          animation: activeTabIcon 0.3s ease-out;
        }

        &::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--color-primary);
          box-shadow: 0 0 10px rgba(var(--color-primary-rgb), 0.5);
        }
      }
    }

    @keyframes activeTabIcon {
      0% { transform: scale(1) translateY(0); }
      50% { transform: scale(1.2) translateY(-2px); }
      100% { transform: scale(1) translateY(0); }
    }

    .tab-count {
      margin-left: 2px;
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-normal);
      color: var(--text-muted);
      opacity: 0.8;
    }

    .sidebar-content {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }

    .saved-content {
      padding: var(--spacing-2);

      // Custom scrollbar for dark mode
      &::-webkit-scrollbar {
        width: 6px;
      }

      &::-webkit-scrollbar-track {
        background: transparent;
      }

      &::-webkit-scrollbar-thumb {
        background: var(--border-color);
        border-radius: 3px;

        &:hover {
          background: var(--text-muted);
        }
      }
    }

    .saved-search {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      padding: var(--spacing-2) var(--spacing-3);
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      margin-bottom: var(--spacing-2);
      transition: all 0.2s ease;

      &:focus-within {
        border-color: var(--color-primary);
        box-shadow: var(--shadow-glow-sm);
        background: var(--bg-secondary);
      }

      app-icon {
        color: var(--text-muted);
        flex-shrink: 0;
        transition: color 0.2s ease;
      }

      &:focus-within app-icon {
        color: var(--color-primary);
      }
    }

    .saved-search-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: var(--text-primary);
      font-size: var(--font-size-sm);
      min-width: 0;

      &::placeholder {
        color: var(--text-muted);
      }
    }

    .datasource-info {
      display: flex;
      align-items: center;
      justify-content: space-between;
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
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur));
      -webkit-backdrop-filter: blur(var(--glass-blur));
      border-bottom: 1px solid var(--glass-border);
      gap: var(--spacing-3);
      position: relative;

      &::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(var(--color-primary-rgb), 0.2), transparent);
      }
    }

    .toolbar-left, .toolbar-right {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
    }

    // Active Query Badge
    .active-query-badge {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      padding: var(--spacing-1) var(--spacing-2) var(--spacing-1) var(--spacing-3);
      background: rgba(var(--color-primary-rgb), 0.15);
      border: 1px solid rgba(var(--color-primary-rgb), 0.3);
      border-radius: var(--radius-full);
      font-size: var(--font-size-sm);
      color: var(--color-primary-light);
      animation: badgeSlideIn 0.25s ease-out;

      @keyframes badgeSlideIn {
        from {
          opacity: 0;
          transform: translateX(-10px) scale(0.9);
        }
        to {
          opacity: 1;
          transform: translateX(0) scale(1);
        }
      }

      app-icon {
        opacity: 0.8;
      }

      span {
        font-weight: var(--font-weight-medium);
        max-width: 150px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .badge-close {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        padding: 0;
        background: transparent;
        border: none;
        border-radius: 50%;
        color: var(--color-primary-light);
        cursor: pointer;
        opacity: 0.6;
        transition: all 0.15s ease;

        &:hover {
          opacity: 1;
          background: rgba(var(--color-primary-rgb), 0.2);
        }
      }
    }

    // Update button
    .update-btn {
      app-icon {
        transition: transform 0.2s ease, filter 0.2s ease;
      }

      &:hover {
        color: var(--color-success);
        background: rgba(var(--color-success-rgb), 0.1);
        border-color: rgba(var(--color-success-rgb), 0.2);
        box-shadow: 0 0 10px rgba(var(--color-success-rgb), 0.2);

        app-icon {
          transform: scale(1.15);
          filter: drop-shadow(0 0 4px rgba(var(--color-success-rgb), 0.5));
        }
      }

      &:active app-icon {
        transform: scale(0.9);
      }
    }

    // Enhanced Run button with pulsing glow and icon animation
    .toolbar-left ::ng-deep app-button[variant="primary"] button {
      position: relative;

      &:not(:disabled) {
        animation: runButtonPulse 2s ease-in-out infinite;
      }

      &:disabled {
        animation: none;

        app-icon {
          animation: spinIcon 1s linear infinite;
        }
      }

      app-icon {
        transition: transform 0.2s ease, filter 0.2s ease;
      }

      &:hover:not(:disabled) app-icon {
        transform: scale(1.2) translateX(2px);
        filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.5));
      }

      &:active:not(:disabled) app-icon {
        transform: scale(0.9);
      }
    }

    @keyframes spinIcon {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @keyframes runButtonPulse {
      0%, 100% {
        box-shadow: 0 0 5px rgba(var(--color-primary-rgb), 0.3);
      }
      50% {
        box-shadow: 0 0 15px rgba(var(--color-primary-rgb), 0.5),
                    0 0 25px rgba(var(--color-primary-rgb), 0.2);
      }
    }

    // Format button icon animation
    .toolbar-left ::ng-deep app-button[variant="secondary"] button {
      app-icon {
        transition: transform 0.3s ease, filter 0.2s ease;
      }

      &:hover app-icon {
        transform: rotate(90deg) scale(1.1);
        filter: drop-shadow(0 0 3px rgba(var(--color-primary-rgb), 0.4));
      }

      &:active app-icon {
        transform: rotate(180deg) scale(0.95);
      }
    }

    // Custom toolbar buttons
    .toolbar-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-2);
      padding: var(--spacing-2) var(--spacing-4);
      font-family: var(--font-family-primary);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      border-radius: var(--radius-md);
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.2s ease;
      background: transparent;
      color: var(--text-secondary);

      app-icon {
        transition: transform 0.2s ease, filter 0.2s ease;
      }

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
      }
    }

    .save-btn {
      app-icon {
        transition: transform 0.2s ease, filter 0.2s ease;
      }

      &:hover {
        color: var(--color-primary-light);
        background: rgba(var(--color-primary-rgb), 0.1);
        border-color: rgba(var(--color-primary-rgb), 0.2);
        box-shadow: var(--shadow-glow-sm);

        app-icon {
          transform: translateY(-2px) scale(1.1);
          filter: drop-shadow(0 0 4px rgba(var(--color-primary-rgb), 0.5));
        }
      }

      &:active app-icon {
        transform: translateY(1px) scale(0.95);
        animation: saveBounce 0.3s ease-out;
      }
    }

    @keyframes saveBounce {
      0% { transform: translateY(0) scale(1); }
      30% { transform: translateY(-4px) scale(1.15); }
      60% { transform: translateY(0) scale(1.05); }
      100% { transform: translateY(0) scale(1); }
    }

    .clear-btn {
      app-icon {
        transition: transform 0.2s ease, filter 0.2s ease;
      }

      &:hover {
        color: var(--color-danger);
        background: rgba(var(--color-danger-rgb), 0.1);
        border-color: rgba(var(--color-danger-rgb), 0.2);
        box-shadow: 0 0 10px rgba(var(--color-danger-rgb), 0.2);

        app-icon {
          transform: rotate(-10deg) scale(1.1);
          filter: drop-shadow(0 0 4px rgba(var(--color-danger-rgb), 0.5));
          animation: trashWiggle 0.4s ease-in-out;
        }
      }

      &:active app-icon {
        transform: scale(0.9);
      }
    }

    @keyframes trashWiggle {
      0%, 100% { transform: rotate(-10deg) scale(1.1); }
      25% { transform: rotate(10deg) scale(1.1); }
      50% { transform: rotate(-8deg) scale(1.1); }
      75% { transform: rotate(8deg) scale(1.1); }
    }

    // Confirm popup - Glassmorphism
    .confirm-popup {
      position: fixed;
      top: 100px;
      right: 24px;
      z-index: 1000;
      animation: slideIn 0.25s ease-out;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-10px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .confirm-content {
      display: flex;
      align-items: center;
      gap: var(--spacing-3);
      padding: var(--spacing-3) var(--spacing-4);
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur-lg));
      -webkit-backdrop-filter: blur(var(--glass-blur-lg));
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg), var(--shadow-glow-sm);

      app-icon {
        color: var(--color-warning);
        filter: drop-shadow(0 0 6px rgba(var(--color-warning-rgb), 0.5));
        animation: warningPulse 1s ease-in-out;
      }

      @keyframes warningPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }

      span {
        font-size: var(--font-size-sm);
        color: var(--text-primary);
      }
    }

    .confirm-actions {
      display: flex;
      gap: var(--spacing-2);

      button {
        padding: var(--spacing-1) var(--spacing-3);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-medium);
        border-radius: var(--radius-sm);
        border: none;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .confirm-yes {
        background: var(--color-danger);
        color: white;

        &:hover {
          background: #c0392b;
          box-shadow: 0 0 12px rgba(var(--color-danger-rgb), 0.5);
          transform: scale(1.02);
        }
      }

      .confirm-no {
        background: var(--bg-tertiary);
        color: var(--text-secondary);
        border: 1px solid var(--border-color);

        &:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          border-color: rgba(var(--color-primary-rgb), 0.3);
        }
      }
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
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur));
      -webkit-backdrop-filter: blur(var(--glass-blur));
      border-bottom: 1px solid var(--glass-border);
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
      position: relative;

      &:hover:not(.active) {
        color: var(--text-primary);
        background: rgba(var(--color-primary-rgb), 0.05);
      }

      &.active {
        color: var(--color-primary-light);
        border-bottom-color: var(--color-primary);
        background: linear-gradient(180deg, rgba(var(--color-primary-rgb), 0.08) 0%, transparent 100%);

        &::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--color-primary);
          box-shadow: 0 0 8px rgba(var(--color-primary-rgb), 0.5);
        }
      }

      .badge {
        padding: 2px 8px;
        background: rgba(var(--color-primary-rgb), 0.15);
        border-radius: var(--radius-full);
        font-size: var(--font-size-xs);
        color: var(--color-primary-light);
        transition: all 0.3s ease;
      }

      &.active .badge {
        animation: badgePulse 0.5s ease-out;
      }
    }

    @keyframes badgePulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.1); }
      100% { transform: scale(1); }
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
      padding: var(--spacing-1) var(--spacing-2);
      border-radius: var(--radius-sm);
      transition: all 0.2s ease;

      // Color-coded execution time
      &.fast {
        color: var(--color-success);
        background: rgba(var(--color-success-rgb), 0.1);
      }

      &.medium {
        color: var(--color-warning);
        background: rgba(var(--color-warning-rgb), 0.1);
      }

      &.slow {
        color: var(--color-danger);
        background: rgba(var(--color-danger-rgb), 0.1);
      }
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
      background: radial-gradient(ellipse at 50% 50%, rgba(var(--color-primary-rgb), 0.03) 0%, transparent 50%);

      app-icon {
        opacity: 0.5;
        animation: floatIcon 3s ease-in-out infinite;
        filter: drop-shadow(0 0 8px rgba(var(--color-primary-rgb), 0.2));
      }

      @keyframes floatIcon {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-6px); }
      }

      p {
        margin: 0;
      }
    }

    .loading-state {
      app-icon {
        animation: spin 1s linear infinite, glowPulse 2s ease-in-out infinite;
      }

      @keyframes glowPulse {
        0%, 100% {
          filter: drop-shadow(0 0 5px rgba(var(--color-primary-rgb), 0.3));
        }
        50% {
          filter: drop-shadow(0 0 15px rgba(var(--color-primary-rgb), 0.6));
        }
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

    .saved-list {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-1);
    }

    .sidebar-saved-item {
      position: relative;
      background: transparent;
      border: 1px solid transparent;
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all 0.2s ease;
      animation: fadeInStagger 200ms ease-out forwards;
      opacity: 0;

      @for $i from 1 through 20 {
        &:nth-child(#{$i}) {
          animation-delay: #{($i - 1) * 30}ms;
        }
      }

      @keyframes fadeInStagger {
        from {
          opacity: 0;
          transform: translateX(-8px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      &:hover {
        background: var(--bg-hover);
        border-color: rgba(var(--color-primary-rgb), 0.15);

        .sidebar-delete-btn {
          opacity: 1;
        }
      }

      &.active {
        background: rgba(var(--color-primary-rgb), 0.1);
        border-color: rgba(var(--color-primary-rgb), 0.3);
        box-shadow: var(--shadow-glow-sm);

        .sidebar-saved-icon {
          color: var(--color-primary-light);
          background: rgba(var(--color-primary-rgb), 0.15);
        }

        .sidebar-saved-name {
          color: var(--color-primary-light);
        }
      }
    }

    .sidebar-saved-content {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      padding: var(--spacing-2) var(--spacing-3);
    }

    .sidebar-saved-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      color: var(--text-muted);
      transition: all 0.2s ease;
    }

    .sidebar-saved-item:hover .sidebar-saved-icon {
      color: var(--color-primary-light);
    }

    .sidebar-saved-name {
      flex: 1;
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: var(--text-primary);
      transition: color 0.2s ease;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sidebar-saved-item:hover .sidebar-saved-name {
      color: var(--color-primary-light);
    }

    .sidebar-delete-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      cursor: pointer;
      opacity: 0;
      transition: all 0.2s ease;

      &:hover {
        color: var(--color-danger);
        background: rgba(var(--color-danger-rgb), 0.1);
      }
    }

    // Inline delete confirmation
    .delete-confirm-inline {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      padding: var(--spacing-2) var(--spacing-3);
      background: rgba(var(--color-danger-rgb), 0.08);
      border-radius: var(--radius-md);
      animation: confirmSlideIn 0.2s ease-out;

      @keyframes confirmSlideIn {
        from {
          opacity: 0;
          transform: scale(0.95);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      app-icon {
        color: var(--color-warning);
        flex-shrink: 0;
        animation: warningPulse 1s ease-in-out;
      }

      @keyframes warningPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }

      span {
        flex: 1;
        font-size: var(--font-size-sm);
        color: var(--text-primary);
        font-weight: var(--font-weight-medium);
      }

      .confirm-actions {
        display: flex;
        gap: var(--spacing-1);

        button {
          padding: var(--spacing-1) var(--spacing-2);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
          border-radius: var(--radius-sm);
          border: none;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .confirm-yes {
          background: var(--color-danger);
          color: white;

          &:hover {
            background: #c0392b;
            box-shadow: 0 0 8px rgba(var(--color-danger-rgb), 0.4);
          }
        }

        .confirm-no {
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          border: 1px solid var(--border-color);

          &:hover {
            background: var(--bg-hover);
            color: var(--text-primary);
          }
        }
      }
    }

    .sidebar-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-6);
      color: var(--text-muted);
      text-align: center;
      background: radial-gradient(ellipse at 50% 50%, rgba(var(--color-primary-rgb), 0.03) 0%, transparent 50%);

      app-icon {
        opacity: 0.4;
        animation: floatIcon 3s ease-in-out infinite;
      }

      @keyframes floatIcon {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-4px); }
      }

      p {
        margin: var(--spacing-2) 0 0;
        font-size: var(--font-size-sm);
      }
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: overlayFade 0.2s ease-out;
    }

    @keyframes overlayFade {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .modal {
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur-lg));
      -webkit-backdrop-filter: blur(var(--glass-blur-lg));
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      width: 100%;
      max-width: 500px;
      box-shadow: var(--shadow-xl), var(--shadow-glow-md);
      animation: modalSlide 0.25s ease-out;
    }

    @keyframes modalSlide {
      from {
        opacity: 0;
        transform: translateY(-20px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-4);
      border-bottom: 1px solid var(--glass-border);
      background: var(--gradient-glow);

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
      border-top: 1px solid var(--glass-border);
      background: var(--gradient-glow-bottom);
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
  `],
    standalone: false
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
  activeTab = signal<'results' | 'history'>('results');
  sidebarTab = signal<'schema' | 'saved'>('schema');
  queryHistory = signal<{ sql: string; timestamp: Date; rowCount: number }[]>([]);
  isLoadingSchema = signal(false);
  savedQueries = signal<SavedQuery[]>([]);
  savedQuerySearch = '';
  showSaveModal = signal(false);
  saveQueryName = '';
  saveQueryDescription = '';

  // Computed filtered queries based on search
  filteredSavedQueries = computed(() => {
    const search = this.savedQuerySearch.toLowerCase().trim();
    if (!search) return this.savedQueries();
    return this.savedQueries().filter(q =>
      q.name.toLowerCase().includes(search) ||
      q.sql_text.toLowerCase().includes(search) ||
      (q.description?.toLowerCase().includes(search))
    );
  });

  // Data Sources
  dataSources = signal<DataSource[]>([]);
  selectedDataSource = signal<DataSource | null>(null);
  showDataSourceDropdown = signal(false);
  isLoadingDataSources = signal(false);
  showClearConfirm = signal(false);

  // Active query tracking
  activeQuery = signal<SavedQuery | null>(null);
  deleteConfirmId = signal<string | null>(null);

  ngOnInit() {
    this.loadDataSources();
  }

  async loadDataSources() {
    this.isLoadingDataSources.set(true);
    try {
      const response = await firstValueFrom(
        this.api.get<DataSourceResponse[]>('/datasources')
      );
      // Transform API response to include icon and status
      const dataSources = (response || []).map(ds => this.transformDataSource(ds));
      this.dataSources.set(dataSources);

      // Select first data source by default
      if (dataSources.length > 0 && !this.selectedDataSource()) {
        this.selectedDataSource.set(dataSources[0]);
      }

      // Load schema and saved queries after data sources are loaded
      this.loadSchema();
      this.loadSavedQueries();
    } catch (error) {
      this.notifications.error('Failed to load data sources');
      // Fallback to empty state
      this.dataSources.set([]);
    } finally {
      this.isLoadingDataSources.set(false);
    }
  }

  private transformDataSource(ds: DataSourceResponse): DataSource {
    // Map type to icon
    const iconMap: Record<string, string> = {
      sqlite: 'database',
      oracle: 'database',
      hive: 'database',
      postgres: 'database',
      csv: 'file-text',
      excel: 'file-spreadsheet',
      mock: 'database',
    };

    return {
      ...ds,
      icon: iconMap[ds.type] || 'database',
      status: 'connected', // Default to connected for now
    };
  }

  async loadSchema() {
    this.isLoadingSchema.set(true);
    try {
      const ds = this.selectedDataSource();
      const url = ds ? `/queries/schema?data_source_id=${ds.id}` : '/queries/schema';
      const response = await firstValueFrom(
        this.api.get<{ tables: TableSchema[] }>(url)
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
    this.loadSavedQueries();
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

  confirmClear() {
    if (this.sqlText.trim()) {
      this.showClearConfirm.set(true);
    } else {
      this.clearQuery();
    }
  }

  clearQuery() {
    this.sqlText = '';
    this.queryResult.set(null);
    this.showClearConfirm.set(false);
    this.activeQuery.set(null);
  }

  clearActiveQuery() {
    this.activeQuery.set(null);
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

    const dsId = this.selectedDataSource()?.id;
    if (!dsId) {
      this.notifications.warning('Please select a data source');
      return;
    }

    try {
      const savedQuery = await firstValueFrom(
        this.api.post<SavedQuery>('/queries', {
          name: this.saveQueryName.trim(),
          description: this.saveQueryDescription.trim() || null,
          sql_text: this.sqlText,
          data_source_id: dsId
        })
      );
      this.notifications.success('Query saved successfully');
      this.closeSaveModal();
      // Set the newly saved query as active
      this.activeQuery.set(savedQuery);
      this.loadSavedQueries();
    } catch (error: any) {
      this.notifications.error(error.message || 'Failed to save query');
    }
  }

  async updateActiveQuery() {
    const active = this.activeQuery();
    if (!active) {
      this.notifications.warning('No query loaded to update');
      return;
    }

    try {
      const updatedQuery = await firstValueFrom(
        this.api.put<SavedQuery>(`/queries/${active.id}`, {
          name: active.name,
          description: active.description || null,
          sql_text: this.sqlText,
          data_source_id: active.data_source_id
        })
      );
      this.notifications.success(`Updated query: ${active.name}`);
      this.activeQuery.set(updatedQuery);
      this.loadSavedQueries();
    } catch (error: any) {
      this.notifications.error(error.message || 'Failed to update query');
    }
  }

  async loadSavedQueries() {
    const dsId = this.selectedDataSource()?.id;
    try {
      const endpoint = dsId ? `/queries?data_source_id=${dsId}` : '/queries';
      const queries = await firstValueFrom(
        this.api.get<SavedQuery[]>(endpoint)
      );
      this.savedQueries.set(queries || []);
    } catch (error) {
      console.error('Failed to load saved queries:', error);
    }
  }

  loadSavedQuery(query: SavedQuery) {
    this.sqlText = query.sql_text;
    this.activeQuery.set(query);
    this.activeTab.set('results');
    this.notifications.info(`Loaded query: ${query.name}`);
    // Cancel any pending delete confirmation
    this.deleteConfirmId.set(null);
  }

  requestDelete(id: string) {
    this.deleteConfirmId.set(id);
  }

  cancelDelete() {
    this.deleteConfirmId.set(null);
  }

  async confirmDeleteQuery(id: string) {
    try {
      await firstValueFrom(this.api.delete(`/queries/${id}`));
      this.notifications.success('Query deleted');
      // If we deleted the active query, clear it
      if (this.activeQuery()?.id === id) {
        this.activeQuery.set(null);
      }
      this.deleteConfirmId.set(null);
      this.loadSavedQueries();
    } catch (error: any) {
      this.notifications.error(error.message || 'Failed to delete query');
      this.deleteConfirmId.set(null);
    }
  }

  async deleteSavedQuery(id: string) {
    // Deprecated - use requestDelete/confirmDeleteQuery flow instead
    this.requestDelete(id);
  }

  loadHistoryItem(item: { sql: string; timestamp: Date; rowCount: number }) {
    this.sqlText = item.sql;
    this.activeTab.set('results');
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleString();
  }

  switchSidebarTab(tab: 'schema' | 'saved') {
    this.sidebarTab.set(tab);
    if (tab === 'saved') {
      this.loadSavedQueries();
    }
  }

  selectDataSource(ds: DataSource) {
    this.selectedDataSource.set(ds);
    this.showDataSourceDropdown.set(false);
    // Refresh data for the selected data source
    this.loadSchema();
    this.loadSavedQueries();
    this.notifications.info(`Switched to ${ds.name}`);
  }
}
