import { Component, Input, OnInit, OnChanges, SimpleChanges, signal, inject } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { ColDef, GridOptions } from 'ag-grid-enterprise';

interface ColumnMetadata {
  name: string;
  data_type: string;
}

interface QueryExecuteResponse {
  data: any[];
  columns: ColumnMetadata[];
  row_count: number;
  execution_time_ms: number;
}

@Component({
    selector: 'app-table-widget',
    template: `
    <div class="table-widget">
      <!-- Loading State -->
      <div class="loading-state" *ngIf="loading()">
        <app-icon name="loader" [size]="24"></app-icon>
        <span>Loading data...</span>
      </div>

      <!-- Error State -->
      <div class="error-state" *ngIf="error()">
        <app-icon name="alert-circle" [size]="24"></app-icon>
        <span>{{ error() }}</span>
      </div>

      <!-- AG Grid -->
      <ag-grid-angular
        *ngIf="!loading() && !error()"
        class="ag-theme-alpine-dark"
        [rowData]="rowData()"
        [columnDefs]="columnDefs()"
        [gridOptions]="gridOptions"
        [domLayout]="'autoHeight'"
        style="width: 100%; height: 100%;">
      </ag-grid-angular>

      <!-- Footer -->
      <div class="table-footer" *ngIf="!loading() && !error()">
        <span class="row-count">{{ rowData().length }} rows</span>
        <span class="exec-time" *ngIf="executionTime()">{{ executionTime() }}ms</span>
      </div>
    </div>
  `,
    styles: [`
    .table-widget {
      height: 100%;
      display: flex;
      flex-direction: column;
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
      overflow: hidden;
    }

    .loading-state, .error-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-2);
      color: var(--text-muted);
      font-size: var(--font-size-sm);

      app-icon {
        opacity: 0.6;
      }
    }

    .loading-state ::ng-deep app-icon {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .error-state {
      color: var(--color-danger);
    }

    ag-grid-angular {
      flex: 1;
      min-height: 0;
    }

    .table-footer {
      display: flex;
      justify-content: space-between;
      padding: var(--spacing-2) var(--spacing-3);
      background: var(--bg-tertiary);
      border-top: 1px solid var(--border-color);
      font-size: var(--font-size-xs);
      color: var(--text-muted);
    }

    .row-count {
      font-weight: var(--font-weight-medium);
    }

    .exec-time {
      opacity: 0.7;
    }

    // AG Grid Dark Theme Overrides
    :host ::ng-deep .ag-theme-alpine-dark {
      --ag-background-color: var(--bg-secondary);
      --ag-header-background-color: var(--bg-tertiary);
      --ag-odd-row-background-color: rgba(255, 255, 255, 0.02);
      --ag-row-hover-color: rgba(var(--color-primary-rgb), 0.1);
      --ag-border-color: var(--border-color);
      --ag-header-foreground-color: var(--text-secondary);
      --ag-foreground-color: var(--text-primary);
      --ag-row-border-color: var(--border-color);
      --ag-font-size: 12px;
      --ag-font-family: 'Inter', sans-serif;
    }

    :host ::ng-deep .ag-header-cell {
      font-weight: 600;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.5px;
    }

    :host ::ng-deep .ag-cell {
      display: flex;
      align-items: center;
    }
  `],
    standalone: false
})
export class TableWidgetComponent implements OnInit, OnChanges {
  @Input() queryId!: string;

  private api = inject(ApiService);

  loading = signal(true);
  error = signal<string | null>(null);
  rowData = signal<any[]>([]);
  columnDefs = signal<ColDef[]>([]);
  executionTime = signal<number | null>(null);

  gridOptions: GridOptions = {
    defaultColDef: {
      sortable: true,
      filter: true,
      resizable: true,
      minWidth: 80
    },
    animateRows: true,
    suppressCellFocus: true,
    headerHeight: 36,
    rowHeight: 32
  };

  ngOnInit() {
    if (this.queryId) {
      this.loadData();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['queryId'] && !changes['queryId'].firstChange) {
      this.loadData();
    }
  }

  loadData() {
    if (!this.queryId) {
      this.error.set('No query specified');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.api.post<QueryExecuteResponse>(`/queries/${this.queryId}/execute`, {}).subscribe({
      next: (response) => {
        this.rowData.set(response.data || []);
        this.columnDefs.set(this.buildColumnDefs(response.columns || []));
        this.executionTime.set(response.execution_time_ms);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.detail || 'Failed to execute query');
        this.loading.set(false);
      }
    });
  }

  private buildColumnDefs(columns: ColumnMetadata[]): ColDef[] {
    return columns.map(col => ({
      field: col.name,
      headerName: this.formatColumnName(col.name),
      flex: 1,
      minWidth: 100,
      cellRenderer: (params: any) => {
        const value = params.value;
        if (value === null || value === undefined) {
          return '<span style="color: var(--text-muted); font-style: italic;">null</span>';
        }
        if (typeof value === 'number') {
          return this.formatNumber(value);
        }
        if (this.isDateValue(value)) {
          return this.formatDate(value);
        }
        return value;
      }
    }));
  }

  private formatColumnName(name: string): string {
    return name
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private formatNumber(value: number): string {
    if (Number.isInteger(value)) {
      return value.toLocaleString();
    }
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private isDateValue(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    // Check for ISO date format (2024-01-15 or 2024-01-15T10:30:00)
    const isoPattern = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/;
    if (!isoPattern.test(value)) return false;
    const date = new Date(value);
    return !isNaN(date.getTime());
  }

  private formatDate(value: string): string {
    const date = new Date(value);
    // Check if it has time component
    if (value.includes('T')) {
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}
