import { Component, Output, EventEmitter, OnInit, signal, computed, inject } from '@angular/core';
import { ApiService } from '../../core/services/api.service';

interface Chart {
  id: string;
  name: string;
  description?: string;
  chart_type: string;
  config: any;
}

interface SavedQuery {
  id: string;
  name: string;
  description?: string;
  sql_text: string;
}

export interface WidgetSelection {
  type: 'chart' | 'table';
  chartId?: string;
  queryId?: string;
  title: string;
  cols: number;
  rows: number;
  chartType?: string;
  config?: any;
}

@Component({
    selector: 'app-chart-picker-panel',
    template: `
    <div class="panel-overlay" *ngIf="isOpen()" (click)="close()">
      <div class="panel-container" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="panel-header">
          <h2 class="panel-title">Add Widget</h2>
          <button class="close-btn" (click)="close()">
            <app-icon name="x" [size]="20"></app-icon>
          </button>
        </div>

        <!-- Tabs -->
        <div class="panel-tabs">
          <button
            class="tab-btn"
            [class.active]="activeTab() === 'charts'"
            (click)="activeTab.set('charts')">
            <app-icon name="bar-chart-2" [size]="16"></app-icon>
            Charts
            <span class="tab-count">{{ charts().length }}</span>
          </button>
          <button
            class="tab-btn"
            [class.active]="activeTab() === 'tables'"
            (click)="activeTab.set('tables')">
            <app-icon name="table" [size]="16"></app-icon>
            Tables
            <span class="tab-count">{{ queries().length }}</span>
          </button>
        </div>

        <!-- Search -->
        <div class="search-box">
          <app-icon name="search" [size]="16"></app-icon>
          <input
            type="text"
            [placeholder]="activeTab() === 'charts' ? 'Search charts...' : 'Search queries...'"
            [ngModel]="searchTerm()"
            (ngModelChange)="searchTerm.set($event)">
          <button class="clear-btn" *ngIf="searchTerm()" (click)="searchTerm.set('')">
            <app-icon name="x" [size]="14"></app-icon>
          </button>
        </div>

        <!-- Content -->
        <div class="panel-content">
          <!-- Loading -->
          <div class="loading-state" *ngIf="loading()">
            <app-icon name="loader" [size]="24"></app-icon>
            <span>Loading...</span>
          </div>

          <!-- Charts Grid -->
          <div class="charts-grid" *ngIf="!loading() && activeTab() === 'charts'">
            <div
              *ngFor="let chart of filteredCharts()"
              class="chart-card"
              [class.selected]="selectedChart()?.id === chart.id"
              (click)="selectChart(chart)">
              <div class="chart-preview-container">
                <div class="chart-type-badge">{{ getChartTypeLabel(chart.chart_type) }}</div>
                <div class="chart-icon">
                  <app-icon [name]="getChartIcon(chart.chart_type)" [size]="32"></app-icon>
                </div>
              </div>
              <div class="chart-info">
                <h4 class="chart-name">{{ chart.name }}</h4>
                <p class="chart-desc" *ngIf="chart.description">{{ chart.description }}</p>
              </div>
              <div class="selected-check" *ngIf="selectedChart()?.id === chart.id">
                <app-icon name="check" [size]="16"></app-icon>
              </div>
            </div>

            <div class="empty-state" *ngIf="filteredCharts().length === 0">
              <app-icon name="bar-chart-2" [size]="40"></app-icon>
              <p *ngIf="charts().length === 0">No charts in library</p>
              <p *ngIf="charts().length > 0">No matching charts</p>
            </div>
          </div>

          <!-- Queries List -->
          <div class="queries-list" *ngIf="!loading() && activeTab() === 'tables'">
            <div
              *ngFor="let query of filteredQueries()"
              class="query-item"
              [class.selected]="selectedQuery()?.id === query.id"
              (click)="selectQuery(query)">
              <div class="query-icon">
                <app-icon name="database" [size]="20"></app-icon>
              </div>
              <div class="query-info">
                <h4 class="query-name">{{ query.name }}</h4>
                <p class="query-desc" *ngIf="query.description">{{ query.description }}</p>
                <code class="query-sql">{{ truncateSql(query.sql_text) }}</code>
              </div>
              <div class="selected-check" *ngIf="selectedQuery()?.id === query.id">
                <app-icon name="check" [size]="16"></app-icon>
              </div>
            </div>

            <div class="empty-state" *ngIf="filteredQueries().length === 0">
              <app-icon name="database" [size]="40"></app-icon>
              <p *ngIf="queries().length === 0">No saved queries</p>
              <p *ngIf="queries().length > 0">No matching queries</p>
            </div>
          </div>
        </div>

        <!-- Configuration Footer -->
        <div class="panel-footer" *ngIf="selectedChart() || selectedQuery()">
          <div class="config-section">
            <div class="config-row">
              <div class="form-group">
                <label class="form-label">Title</label>
                <input
                  type="text"
                  class="form-input"
                  [ngModel]="widgetTitle()"
                  (ngModelChange)="widgetTitle.set($event)"
                  placeholder="Widget title">
              </div>
            </div>
            <div class="config-row">
              <div class="form-group">
                <label class="form-label">Width</label>
                <select class="form-input" [ngModel]="widgetCols()" (ngModelChange)="widgetCols.set(+$event)">
                  <option [value]="3">3 cols</option>
                  <option [value]="4">4 cols</option>
                  <option [value]="6">6 cols</option>
                  <option [value]="8">8 cols</option>
                  <option [value]="12">Full width</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Height</label>
                <select class="form-input" [ngModel]="widgetRows()" (ngModelChange)="widgetRows.set(+$event)">
                  <option [value]="2">2 rows</option>
                  <option [value]="3">3 rows</option>
                  <option [value]="4">4 rows</option>
                  <option [value]="5">5 rows</option>
                  <option [value]="6">6 rows</option>
                </select>
              </div>
            </div>
          </div>
          <app-button
            variant="primary"
            [disabled]="!widgetTitle()"
            (click)="addWidget()">
            <app-icon name="plus" [size]="16"></app-icon>
            Add to Dashboard
          </app-button>
        </div>
      </div>
    </div>
  `,
    styles: [`
    .panel-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(2px);
      z-index: 1000;
      animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .panel-container {
      position: fixed;
      top: 0;
      right: 0;
      width: 420px;
      max-width: 90vw;
      height: 100vh;
      background: var(--bg-secondary);
      border-left: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      animation: slideIn 0.3s ease;
      box-shadow: -8px 0 32px rgba(0, 0, 0, 0.3);
    }

    @keyframes slideIn {
      from {
        transform: translateX(100%);
      }
      to {
        transform: translateX(0);
      }
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-4) var(--spacing-5);
      border-bottom: 1px solid var(--border-color);
      flex-shrink: 0;
    }

    .panel-title {
      font-size: var(--font-size-lg);
      font-weight: var(--font-weight-semibold);
      color: var(--text-primary);
      margin: 0;
    }

    .close-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: transparent;
      border: none;
      border-radius: var(--radius-md);
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: var(--bg-tertiary);
        color: var(--text-primary);
      }
    }

    .panel-tabs {
      display: flex;
      gap: var(--spacing-2);
      padding: var(--spacing-3) var(--spacing-5);
      border-bottom: 1px solid var(--border-color);
      flex-shrink: 0;
    }

    .tab-btn {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      padding: var(--spacing-2) var(--spacing-4);
      background: transparent;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-full);
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: var(--bg-tertiary);
        color: var(--text-primary);
      }

      &.active {
        background: var(--color-primary);
        border-color: var(--color-primary);
        color: white;
      }

      .tab-count {
        font-size: var(--font-size-xs);
        opacity: 0.8;
      }
    }

    .search-box {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      margin: var(--spacing-4) var(--spacing-5);
      padding: var(--spacing-2) var(--spacing-3);
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      flex-shrink: 0;

      app-icon:first-child {
        color: var(--text-muted);
      }

      input {
        flex: 1;
        background: transparent;
        border: none;
        color: var(--text-primary);
        font-size: var(--font-size-sm);

        &:focus {
          outline: none;
        }

        &::placeholder {
          color: var(--text-muted);
        }
      }

      .clear-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        background: var(--bg-hover);
        border: none;
        border-radius: 50%;
        color: var(--text-muted);
        cursor: pointer;

        &:hover {
          background: var(--color-primary);
          color: white;
        }
      }
    }

    .panel-content {
      flex: 1;
      overflow-y: auto;
      padding: 0 var(--spacing-5) var(--spacing-4);
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-3);
      padding: var(--spacing-8);
      color: var(--text-muted);

      app-icon {
        animation: spin 1s linear infinite;
      }
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .charts-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--spacing-3);
    }

    .chart-card {
      display: flex;
      gap: var(--spacing-3);
      padding: var(--spacing-3);
      background: var(--bg-tertiary);
      border: 2px solid transparent;
      border-radius: var(--radius-lg);
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;

      &:hover {
        border-color: var(--border-color);
        transform: translateX(-4px);
      }

      &.selected {
        border-color: var(--color-primary);
        background: rgba(var(--color-primary-rgb), 0.1);
      }
    }

    .chart-preview-container {
      width: 80px;
      height: 60px;
      background: var(--bg-primary);
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      position: relative;
      overflow: hidden;
    }

    .chart-type-badge {
      position: absolute;
      top: 4px;
      left: 4px;
      padding: 2px 6px;
      background: rgba(0, 0, 0, 0.6);
      border-radius: var(--radius-sm);
      font-size: 9px;
      font-weight: 600;
      color: white;
      text-transform: uppercase;
    }

    .chart-icon {
      color: var(--color-primary);
      opacity: 0.7;
    }

    .chart-info {
      flex: 1;
      min-width: 0;
    }

    .chart-name {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-semibold);
      color: var(--text-primary);
      margin: 0 0 var(--spacing-1) 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .chart-desc {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      margin: 0;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .queries-list {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-2);
    }

    .query-item {
      display: flex;
      gap: var(--spacing-3);
      padding: var(--spacing-3);
      background: var(--bg-tertiary);
      border: 2px solid transparent;
      border-radius: var(--radius-lg);
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;

      &:hover {
        border-color: var(--border-color);
      }

      &.selected {
        border-color: var(--color-primary);
        background: rgba(var(--color-primary-rgb), 0.1);
      }
    }

    .query-icon {
      width: 40px;
      height: 40px;
      background: var(--bg-primary);
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-primary);
      flex-shrink: 0;
    }

    .query-info {
      flex: 1;
      min-width: 0;
    }

    .query-name {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-semibold);
      color: var(--text-primary);
      margin: 0 0 var(--spacing-1) 0;
    }

    .query-desc {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      margin: 0 0 var(--spacing-1) 0;
    }

    .query-sql {
      font-size: 10px;
      color: var(--text-muted);
      background: var(--bg-primary);
      padding: 2px 6px;
      border-radius: var(--radius-sm);
      display: inline-block;
      max-width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .selected-check {
      position: absolute;
      top: var(--spacing-2);
      right: var(--spacing-2);
      width: 24px;
      height: 24px;
      background: var(--color-primary);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-8);
      color: var(--text-muted);
      text-align: center;

      app-icon {
        opacity: 0.5;
        margin-bottom: var(--spacing-2);
      }

      p {
        margin: 0;
        font-size: var(--font-size-sm);
      }
    }

    .panel-footer {
      padding: var(--spacing-4) var(--spacing-5);
      border-top: 1px solid var(--border-color);
      background: var(--bg-tertiary);
      flex-shrink: 0;
    }

    .config-section {
      margin-bottom: var(--spacing-3);
    }

    .config-row {
      display: flex;
      gap: var(--spacing-3);
      margin-bottom: var(--spacing-3);

      &:last-child {
        margin-bottom: 0;
      }
    }

    .form-group {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: var(--spacing-1);
    }

    .form-label {
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-medium);
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .form-input {
      height: 36px;
      padding: 0 var(--spacing-3);
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      color: var(--text-primary);
      font-size: var(--font-size-sm);

      &:focus {
        outline: none;
        border-color: var(--color-primary);
      }
    }
  `],
    standalone: false
})
export class ChartPickerPanelComponent implements OnInit {
  @Output() closePanel = new EventEmitter<void>();
  @Output() widgetSelected = new EventEmitter<WidgetSelection>();

  private api = inject(ApiService);

  isOpen = signal(true);
  loading = signal(true);
  activeTab = signal<'charts' | 'tables'>('charts');
  searchTerm = signal('');

  charts = signal<Chart[]>([]);
  queries = signal<SavedQuery[]>([]);

  selectedChart = signal<Chart | null>(null);
  selectedQuery = signal<SavedQuery | null>(null);

  widgetTitle = signal('');
  widgetCols = signal(6);
  widgetRows = signal(4);

  filteredCharts = computed(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.charts();
    return this.charts().filter(c =>
      c.name.toLowerCase().includes(term) ||
      c.description?.toLowerCase().includes(term) ||
      c.chart_type.toLowerCase().includes(term)
    );
  });

  filteredQueries = computed(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.queries();
    return this.queries().filter(q =>
      q.name.toLowerCase().includes(term) ||
      q.description?.toLowerCase().includes(term)
    );
  });

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading.set(true);

    // Load charts
    this.api.get<Chart[]>('/charts').subscribe({
      next: (charts) => {
        this.charts.set(charts);
        this.checkLoading();
      },
      error: () => this.checkLoading()
    });

    // Load queries
    this.api.get<SavedQuery[]>('/queries').subscribe({
      next: (queries) => {
        this.queries.set(queries);
        this.checkLoading();
      },
      error: () => this.checkLoading()
    });
  }

  private loadingCount = 0;
  private checkLoading() {
    this.loadingCount++;
    if (this.loadingCount >= 2) {
      this.loading.set(false);
    }
  }

  selectChart(chart: Chart) {
    this.selectedChart.set(chart);
    this.selectedQuery.set(null);
    this.widgetTitle.set(chart.name);

    // Set default size based on chart type
    if (['gauge', 'radialBar', 'kpiCard', 'donut', 'pie'].includes(chart.chart_type)) {
      this.widgetCols.set(4);
      this.widgetRows.set(3);
    } else {
      this.widgetCols.set(6);
      this.widgetRows.set(4);
    }
  }

  selectQuery(query: SavedQuery) {
    this.selectedQuery.set(query);
    this.selectedChart.set(null);
    this.widgetTitle.set(query.name);
    this.widgetCols.set(6);
    this.widgetRows.set(4);
  }

  close() {
    this.isOpen.set(false);
    setTimeout(() => this.closePanel.emit(), 200);
  }

  addWidget() {
    const chart = this.selectedChart();
    const query = this.selectedQuery();

    if (chart) {
      this.widgetSelected.emit({
        type: 'chart',
        chartId: chart.id,
        title: this.widgetTitle(),
        cols: this.widgetCols(),
        rows: this.widgetRows(),
        chartType: chart.chart_type,
        config: chart.config
      });
    } else if (query) {
      this.widgetSelected.emit({
        type: 'table',
        queryId: query.id,
        title: this.widgetTitle(),
        cols: this.widgetCols(),
        rows: this.widgetRows()
      });
    }

    this.close();
  }

  truncateSql(sql: string): string {
    const clean = sql.replace(/\s+/g, ' ').trim();
    return clean.length > 50 ? clean.substring(0, 50) + '...' : clean;
  }

  getChartTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'bar': 'Bar',
      'column': 'Column',
      'line': 'Line',
      'area': 'Area',
      'pie': 'Pie',
      'donut': 'Donut',
      'scatter': 'Scatter',
      'gauge': 'Gauge',
      'radar': 'Radar',
      'heatmap': 'Heatmap',
      'funnel': 'Funnel',
      'treemap': 'Treemap',
      'kpiCard': 'KPI',
      'radialBar': 'Radial'
    };
    return labels[type] || type;
  }

  getChartIcon(type: string): string {
    const icons: Record<string, string> = {
      'bar': 'chart-bar-h',
      'column': 'chart-bar',
      'line': 'chart-line',
      'area': 'chart-area',
      'pie': 'pie-chart',
      'donut': 'chart-donut',
      'scatter': 'chart-scatter',
      'gauge': 'chart-gauge',
      'radar': 'chart-radar',
      'heatmap': 'chart-heatmap',
      'funnel': 'chart-funnel',
      'treemap': 'chart-treemap',
      'kpiCard': 'chart-kpi',
      'radialBar': 'chart-radial'
    };
    return icons[type] || 'chart-bar';
  }
}
