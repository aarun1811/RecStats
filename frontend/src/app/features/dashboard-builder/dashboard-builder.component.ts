import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NotificationService } from '../../core/services/notification.service';
import { ApiService } from '../../core/services/api.service';
import { GridsterConfig, GridsterItem, DisplayGrid, GridType, CompactType } from 'angular-gridster2';
import { firstValueFrom } from 'rxjs';
import { CrossFilter } from './widget-wrapper.component';

export interface DashboardWidget extends GridsterItem {
  id: string;
  type: 'chart' | 'kpi' | 'table' | 'filter';
  chartType?: string;
  chartId?: string;  // Reference to backend chart
  sql?: string;      // Direct SQL for chart
  title: string;
  config: any;
}

interface DashboardResponse {
  id: string;
  name: string;
  description?: string;
  layout: any;
  filters?: any;
  charts: any[];
  created_at: string;
  updated_at: string;
}

@Component({
    selector: 'app-dashboard-builder',
    template: `
    <div class="dashboard-builder">
      <!-- Toolbar -->
      <div class="toolbar">
        <div class="toolbar-left">
          <input
            type="text"
            class="dashboard-title-input"
            [(ngModel)]="dashboardTitle"
            placeholder="Dashboard Title">
        </div>
        <div class="toolbar-center">
          <!-- Active Cross-Filters -->
          <div class="cross-filters" *ngIf="crossFilters().length > 0">
            <div class="filter-chip" *ngFor="let filter of crossFilters()">
              <span class="filter-label">{{ filter.field }}: {{ filter.value }}</span>
              <button class="filter-remove" (click)="removeFilter(filter)">
                <app-icon name="x" [size]="12"></app-icon>
              </button>
            </div>
            <button class="clear-all-btn" (click)="clearAllFilters()">
              Clear All
            </button>
          </div>
          <app-filter-bar
            [filters]="globalFilters()"
            (filterChange)="onFilterChange($event)"
            *ngIf="crossFilters().length === 0">
          </app-filter-bar>
        </div>
        <div class="toolbar-right">
          <app-button variant="ghost" (click)="toggleEditMode()">
            <app-icon [name]="editMode() ? 'eye' : 'edit'" [size]="16"></app-icon>
            {{ editMode() ? 'Preview' : 'Edit' }}
          </app-button>
          <app-button variant="secondary" (click)="showAddWidgetModal.set(true)" *ngIf="editMode()">
            <app-icon name="plus" [size]="16"></app-icon>
            Add Widget
          </app-button>
          <app-button variant="primary" (click)="saveDashboard()">
            <app-icon name="save" [size]="16"></app-icon>
            Save
          </app-button>
          <app-button variant="ghost" (click)="showMoreOptions = !showMoreOptions">
            <app-icon name="more-vertical" [size]="16"></app-icon>
          </app-button>
        </div>
      </div>

      <!-- Dashboard Grid -->
      <div class="dashboard-content">
        <app-dashboard-grid
          [widgets]="widgets()"
          [options]="gridOptions"
          [editMode]="editMode()"
          [filters]="crossFilters()"
          (widgetRemove)="removeWidget($event)"
          (widgetEdit)="editWidget($event)"
          (layoutChange)="onLayoutChange($event)"
          (filterApply)="onCrossFilterApply($event)">
        </app-dashboard-grid>
      </div>

      <!-- Add Widget Modal -->
      <app-add-widget-modal
        *ngIf="showAddWidgetModal()"
        (close)="showAddWidgetModal.set(false)"
        (addWidget)="addWidget($event)">
      </app-add-widget-modal>
    </div>
  `,
    styles: [`
    .dashboard-builder {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 64px);
      background: var(--bg-primary);
    }

    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-3) var(--spacing-4);
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      gap: var(--spacing-4);
    }

    .toolbar-left, .toolbar-center, .toolbar-right {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
    }

    .toolbar-center {
      flex: 1;
      justify-content: center;
    }

    .dashboard-title-input {
      background: transparent;
      border: none;
      font-size: var(--font-size-lg);
      font-weight: var(--font-weight-semibold);
      color: var(--text-primary);
      padding: var(--spacing-2);
      min-width: 200px;

      &:focus {
        outline: none;
        background: var(--bg-tertiary);
        border-radius: var(--radius-md);
      }

      &::placeholder {
        color: var(--text-muted);
      }
    }

    .dashboard-content {
      flex: 1;
      overflow: auto;
      padding: var(--spacing-4);
    }

    .cross-filters {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      flex-wrap: wrap;
    }

    .filter-chip {
      display: flex;
      align-items: center;
      gap: var(--spacing-1);
      padding: var(--spacing-1) var(--spacing-2);
      background: var(--color-primary);
      color: white;
      border-radius: var(--radius-full);
      font-size: var(--font-size-sm);
    }

    .filter-label {
      font-weight: var(--font-weight-medium);
    }

    .filter-remove {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      background: rgba(255, 255, 255, 0.2);
      border: none;
      border-radius: 50%;
      color: white;
      cursor: pointer;
      transition: background 0.2s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.4);
      }
    }

    .clear-all-btn {
      padding: var(--spacing-1) var(--spacing-3);
      background: transparent;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-full);
      color: var(--text-muted);
      font-size: var(--font-size-sm);
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: var(--bg-tertiary);
        color: var(--text-primary);
      }
    }
  `],
    standalone: false
})
export class DashboardBuilderComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private notifications = inject(NotificationService);
  private api = inject(ApiService);

  // State
  dashboardId: string | null = null;
  dashboardTitle = 'Untitled Dashboard';
  widgets = signal<DashboardWidget[]>([]);
  globalFilters = signal<any[]>([]);
  crossFilters = signal<CrossFilter[]>([]);
  editMode = signal(false);  // Start in view mode by default
  showAddWidgetModal = signal(false);
  showMoreOptions = false;

  // Gridster options
  gridOptions: GridsterConfig = {
    gridType: GridType.Fit,
    displayGrid: DisplayGrid.OnDragAndResize,
    compactType: CompactType.None,
    pushItems: true,
    draggable: {
      enabled: false,  // Start disabled, enabled when edit mode is toggled
      ignoreContent: true,
      dragHandleClass: 'drag-handle'
    },
    resizable: {
      enabled: false  // Start disabled, enabled when edit mode is toggled
    },
    minCols: 12,
    maxCols: 12,
    minRows: 8,
    maxRows: 100,
    defaultItemCols: 4,
    defaultItemRows: 3,
    margin: 16,
    outerMargin: true,
    outerMarginTop: 0,
    outerMarginRight: 0,
    outerMarginBottom: 0,
    outerMarginLeft: 0
  };

  ngOnInit() {
    // Load dashboard if ID provided
    this.dashboardId = this.route.snapshot.paramMap.get('id');
    if (this.dashboardId && this.dashboardId !== 'new') {
      this.loadDashboard(this.dashboardId);
    } else {
      // New dashboard - start empty
      this.dashboardId = null;
      this.dashboardTitle = 'Untitled Dashboard';
      this.widgets.set([]);
    }
  }

  loadDashboard(id: string) {
    // Always try API first - backend now seeds sample dashboards
    // If it's a preset ID like 'executive', try 'dashboard-executive' on backend
    const backendId = id.startsWith('dashboard-') ? id : `dashboard-${id}`;
    this.loadDashboardFromApi(backendId, id);
  }

  loadSampleWidgets() {
    // Load the executive dashboard by default
    this.loadPresetDashboard('executive');
  }

  toggleEditMode() {
    this.editMode.update(v => !v);
    this.gridOptions = {
      ...this.gridOptions,
      draggable: { ...this.gridOptions.draggable!, enabled: !this.editMode() ? false : true },
      resizable: { enabled: !this.editMode() ? false : true },
      displayGrid: this.editMode() ? DisplayGrid.OnDragAndResize : DisplayGrid.None
    };
  }

  addWidget(widgetConfig: any) {
    const newWidget: DashboardWidget = {
      id: `w${Date.now()}`,
      x: 0,
      y: 0,
      cols: widgetConfig.cols || 4,
      rows: widgetConfig.rows || 3,
      type: widgetConfig.type,
      chartType: widgetConfig.chartType,
      title: widgetConfig.title || 'New Widget',
      config: widgetConfig.config || {}
    };

    this.widgets.update(widgets => [...widgets, newWidget]);
    this.showAddWidgetModal.set(false);
    this.notifications.success('Widget added');
  }

  removeWidget(widgetId: string) {
    this.widgets.update(widgets => widgets.filter(w => w.id !== widgetId));
    this.notifications.info('Widget removed');
  }

  editWidget(widget: DashboardWidget) {
    // TODO: Open widget config modal
    this.notifications.info('Widget editing coming soon');
  }

  onLayoutChange(layout: DashboardWidget[]) {
    this.widgets.set(layout);
  }

  onFilterChange(filters: any) {
    this.globalFilters.set(filters);
  }

  onCrossFilterApply(filter: CrossFilter) {
    // Toggle filter: if same filter exists, remove it; otherwise add it
    const existingIndex = this.crossFilters().findIndex(
      f => f.field === filter.field && f.value === filter.value
    );

    if (existingIndex >= 0) {
      // Remove existing filter
      this.crossFilters.update(filters => filters.filter((_, i) => i !== existingIndex));
    } else {
      // Replace any filter on the same field, then add the new one
      this.crossFilters.update(filters => [
        ...filters.filter(f => f.field !== filter.field),
        filter
      ]);
    }

    this.notifications.info(`Filter: ${filter.field} = ${filter.value}`);
  }

  removeFilter(filter: CrossFilter) {
    this.crossFilters.update(filters =>
      filters.filter(f => !(f.field === filter.field && f.value === filter.value))
    );
  }

  clearAllFilters() {
    this.crossFilters.set([]);
    this.notifications.info('All filters cleared');
  }

  async saveDashboard() {
    const dashboardData = {
      name: this.dashboardTitle,
      description: '',
      layout: {
        widgets: this.widgets().map(w => ({
          id: w.id,
          x: w.x,
          y: w.y,
          cols: w.cols,
          rows: w.rows,
          type: w.type,
          chartType: w.chartType,
          chartId: w.chartId,
          sql: w.sql,
          title: w.title,
          config: w.config
        }))
      }
    };

    try {
      if (this.dashboardId && !this.isPresetDashboard(this.dashboardId)) {
        // Update existing dashboard
        await firstValueFrom(
          this.api.put<DashboardResponse>(`/dashboards/${this.dashboardId}`, dashboardData)
        );
        this.notifications.success('Dashboard updated');
      } else {
        // Create new dashboard
        const response = await firstValueFrom(
          this.api.post<DashboardResponse>('/dashboards', dashboardData)
        );
        this.dashboardId = response.id;
        this.router.navigate(['/dashboards', response.id], { replaceUrl: true });
        this.notifications.success('Dashboard saved');
      }
    } catch (error: any) {
      this.notifications.error(error.message || 'Failed to save dashboard');
    }
  }

  async loadDashboardFromApi(id: string, fallbackId?: string) {
    try {
      const response = await firstValueFrom(
        this.api.get<DashboardResponse>(`/dashboards/${id}`)
      );
      this.dashboardTitle = response.name;
      this.dashboardId = response.id;

      // Restore widgets from layout
      if (response.layout?.widgets) {
        this.widgets.set(response.layout.widgets);
      }
      this.notifications.success(`Loaded "${response.name}"`);
    } catch (error) {
      console.error('Failed to load dashboard from API:', error);
      // Fall back to local preset dashboards
      const presetId = fallbackId || id;
      if (this.isPresetDashboard(presetId)) {
        this.loadPresetDashboard(presetId);
      } else {
        this.notifications.error('Dashboard not found');
        this.loadSampleWidgets();
      }
    }
  }

  isPresetDashboard(id: string): boolean {
    // Match both old-style IDs (executive) and new backend IDs (dashboard-executive)
    const presetIds = ['executive', 'breaks', 'geo', 'recon', 'trends'];
    const normalizedId = id.replace('dashboard-', '');
    return presetIds.includes(normalizedId);
  }

  loadPresetDashboard(id: string) {
    // Normalize ID (backend uses dashboard-executive, frontend uses executive)
    const normalizedId = id.replace('dashboard-', '');
    const sampleDashboards = this.getSampleDashboards();
    const dashboard = sampleDashboards[normalizedId];
    if (dashboard) {
      this.dashboardTitle = dashboard.title;
      this.widgets.set(dashboard.widgets);
      this.notifications.success(`Loaded "${dashboard.title}"`);
    } else {
      this.loadSampleWidgets();
    }
  }

  getSampleDashboards(): Record<string, { title: string; widgets: DashboardWidget[] }> {
    return {
      'executive': {
        title: 'Executive Overview',
        widgets: [
          { id: 'w1', x: 0, y: 0, cols: 3, rows: 2, type: 'kpi', title: 'Total Transactions', config: { value: 0, trend: 'up', trendValue: '+0%' }, sql: 'SELECT COUNT(*) as value FROM transactions' },
          { id: 'w2', x: 3, y: 0, cols: 3, rows: 2, type: 'kpi', title: 'Match Rate', config: { value: 0, suffix: '%', variant: 'success', trend: 'up', trendValue: '+0%' }, sql: "SELECT ROUND(100.0 * SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) / COUNT(*), 1) as value FROM transactions" },
          { id: 'w3', x: 6, y: 0, cols: 3, rows: 2, type: 'kpi', title: 'Open Breaks', config: { value: 0, variant: 'warning', trend: 'down', trendValue: '-0%' }, sql: 'SELECT COUNT(*) as value FROM breaks' },
          { id: 'w4', x: 9, y: 0, cols: 3, rows: 2, type: 'kpi', title: 'Avg Break Age', config: { value: 0, suffix: ' days', trend: 'down', trendValue: '-0 days' }, sql: 'SELECT ROUND(AVG(age_days), 1) as value FROM breaks' },
          { id: 'w5', x: 0, y: 2, cols: 6, rows: 4, type: 'chart', chartType: 'line', title: 'Daily Transaction Volume', config: { categoryField: 'date', valueField: 'total_transactions' }, sql: 'SELECT date, total_transactions FROM daily_metrics ORDER BY date DESC LIMIT 30' },
          { id: 'w6', x: 6, y: 2, cols: 6, rows: 4, type: 'chart', chartType: 'bar', title: 'Transactions by Region', config: { categoryField: 'region', valueField: 'count' }, sql: 'SELECT region, COUNT(*) as count FROM transactions GROUP BY region ORDER BY count DESC' },
          { id: 'w7', x: 0, y: 6, cols: 4, rows: 3, type: 'chart', chartType: 'gauge', title: 'Match Rate', config: { valueField: 'value' }, sql: "SELECT ROUND(100.0 * SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) / COUNT(*), 1) as value FROM transactions" },
          { id: 'w8', x: 4, y: 6, cols: 4, rows: 3, type: 'chart', chartType: 'donut', title: 'Status Distribution', config: { nameField: 'status', valueField: 'count' }, sql: 'SELECT status, COUNT(*) as count FROM transactions GROUP BY status' },
          { id: 'w9', x: 8, y: 6, cols: 4, rows: 3, type: 'chart', chartType: 'bar', title: 'Breaks by Category', config: { categoryField: 'category', valueField: 'count' }, sql: 'SELECT category, COUNT(*) as count FROM breaks GROUP BY category ORDER BY count DESC' }
        ]
      },
      'breaks': {
        title: 'Break Analysis',
        widgets: [
          { id: 'w1', x: 0, y: 0, cols: 4, rows: 2, type: 'kpi', title: 'Total Breaks', config: { variant: 'danger' }, sql: 'SELECT COUNT(*) as value FROM breaks' },
          { id: 'w2', x: 4, y: 0, cols: 4, rows: 2, type: 'kpi', title: 'Critical Breaks', config: { variant: 'danger' }, sql: "SELECT COUNT(*) as value FROM breaks WHERE category = 'Critical'" },
          { id: 'w3', x: 8, y: 0, cols: 4, rows: 2, type: 'kpi', title: 'Avg Age (days)', config: {}, sql: 'SELECT ROUND(AVG(age_days), 1) as value FROM breaks' },
          { id: 'w4', x: 0, y: 2, cols: 6, rows: 4, type: 'chart', chartType: 'bar', title: 'Breaks by Reason', config: { categoryField: 'reason', valueField: 'count' }, sql: 'SELECT reason, COUNT(*) as count FROM breaks GROUP BY reason ORDER BY count DESC LIMIT 10' },
          { id: 'w5', x: 6, y: 2, cols: 6, rows: 4, type: 'chart', chartType: 'bar', title: 'Breaks by Region', config: { categoryField: 'region', valueField: 'count' }, sql: 'SELECT region, COUNT(*) as count FROM breaks GROUP BY region ORDER BY count DESC' },
          { id: 'w6', x: 0, y: 6, cols: 4, rows: 3, type: 'chart', chartType: 'donut', title: 'Break Categories', config: { nameField: 'category', valueField: 'count' }, sql: 'SELECT category, COUNT(*) as count FROM breaks GROUP BY category' },
          { id: 'w7', x: 4, y: 6, cols: 4, rows: 3, type: 'chart', chartType: 'bar', title: 'Breaks by LOB', config: { categoryField: 'lob', valueField: 'count' }, sql: 'SELECT lob, COUNT(*) as count FROM breaks GROUP BY lob ORDER BY count DESC' },
          { id: 'w8', x: 8, y: 6, cols: 4, rows: 3, type: 'chart', chartType: 'gauge', title: 'Avg Age Score', config: { valueField: 'value' }, sql: 'SELECT MAX(0, 100 - ROUND(AVG(age_days) * 5, 0)) as value FROM breaks' }
        ]
      },
      'geo': {
        title: 'Geographic View',
        widgets: [
          { id: 'w1', x: 0, y: 0, cols: 3, rows: 2, type: 'kpi', title: 'APAC Volume', config: {}, sql: "SELECT COUNT(*) as value FROM transactions WHERE region = 'APAC'" },
          { id: 'w2', x: 3, y: 0, cols: 3, rows: 2, type: 'kpi', title: 'EMEA Volume', config: {}, sql: "SELECT COUNT(*) as value FROM transactions WHERE region = 'EMEA'" },
          { id: 'w3', x: 6, y: 0, cols: 3, rows: 2, type: 'kpi', title: 'NAM Volume', config: {}, sql: "SELECT COUNT(*) as value FROM transactions WHERE region = 'NAM'" },
          { id: 'w4', x: 9, y: 0, cols: 3, rows: 2, type: 'kpi', title: 'LATAM Volume', config: {}, sql: "SELECT COUNT(*) as value FROM transactions WHERE region = 'LATAM'" },
          { id: 'w5', x: 0, y: 2, cols: 8, rows: 5, type: 'chart', chartType: 'bar', title: 'Volume by Region', config: { categoryField: 'region', valueField: 'count' }, sql: 'SELECT region, COUNT(*) as count FROM transactions GROUP BY region ORDER BY count DESC' },
          { id: 'w6', x: 8, y: 2, cols: 4, rows: 5, type: 'chart', chartType: 'donut', title: 'Regional Distribution', config: { nameField: 'region', valueField: 'count' }, sql: 'SELECT region, COUNT(*) as count FROM transactions GROUP BY region' }
        ]
      },
      'recon': {
        title: 'Reconciliation Status',
        widgets: [
          { id: 'w1', x: 0, y: 0, cols: 3, rows: 2, type: 'kpi', title: 'Total Records', config: {}, sql: 'SELECT COUNT(*) as value FROM transactions' },
          { id: 'w2', x: 3, y: 0, cols: 3, rows: 2, type: 'kpi', title: 'Match Rate', config: { suffix: '%', variant: 'success' }, sql: "SELECT ROUND(100.0 * SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) / COUNT(*), 1) as value FROM transactions" },
          { id: 'w3', x: 6, y: 0, cols: 3, rows: 2, type: 'kpi', title: 'Unmatched', config: { variant: 'warning' }, sql: "SELECT COUNT(*) as value FROM transactions WHERE status = 'unmatched'" },
          { id: 'w4', x: 9, y: 0, cols: 3, rows: 2, type: 'kpi', title: 'Breaks', config: { variant: 'danger' }, sql: "SELECT COUNT(*) as value FROM transactions WHERE status = 'break'" },
          { id: 'w5', x: 0, y: 2, cols: 6, rows: 4, type: 'chart', chartType: 'bar', title: 'Status by LOB', config: { categoryField: 'lob', valueField: 'count' }, sql: "SELECT lob, COUNT(*) as count FROM transactions WHERE status = 'matched' GROUP BY lob ORDER BY count DESC" },
          { id: 'w6', x: 6, y: 2, cols: 6, rows: 4, type: 'chart', chartType: 'line', title: 'Daily Match Rate', config: { categoryField: 'date', valueField: 'match_rate' }, sql: 'SELECT date, match_rate FROM daily_metrics ORDER BY date DESC LIMIT 30' },
          { id: 'w7', x: 0, y: 6, cols: 6, rows: 3, type: 'chart', chartType: 'gauge', title: 'Overall Match Rate', config: { valueField: 'value' }, sql: "SELECT ROUND(100.0 * SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) / COUNT(*), 1) as value FROM transactions" },
          { id: 'w8', x: 6, y: 6, cols: 6, rows: 3, type: 'chart', chartType: 'donut', title: 'Status Breakdown', config: { nameField: 'status', valueField: 'count' }, sql: 'SELECT status, COUNT(*) as count FROM transactions GROUP BY status' }
        ]
      },
      'trends': {
        title: 'Trend Analytics',
        widgets: [
          { id: 'w1', x: 0, y: 0, cols: 12, rows: 4, type: 'chart', chartType: 'line', title: 'Transaction Volume Trend', config: { categoryField: 'date', valueField: 'total_transactions' }, sql: 'SELECT date, total_transactions FROM daily_metrics ORDER BY date' },
          { id: 'w2', x: 0, y: 4, cols: 6, rows: 4, type: 'chart', chartType: 'bar', title: 'Monthly Volume by LOB', config: { categoryField: 'lob', valueField: 'count' }, sql: 'SELECT lob, COUNT(*) as count FROM transactions GROUP BY lob ORDER BY count DESC' },
          { id: 'w3', x: 6, y: 4, cols: 6, rows: 4, type: 'chart', chartType: 'line', title: 'Break Count Trend', config: { categoryField: 'date', valueField: 'breaks' }, sql: 'SELECT date, breaks FROM daily_metrics ORDER BY date' },
          { id: 'w4', x: 0, y: 8, cols: 4, rows: 3, type: 'chart', chartType: 'gauge', title: 'Current Match Rate', config: { valueField: 'value' }, sql: "SELECT ROUND(100.0 * SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) / COUNT(*), 1) as value FROM transactions" },
          { id: 'w5', x: 4, y: 8, cols: 4, rows: 3, type: 'chart', chartType: 'donut', title: 'Volume by Currency', config: { nameField: 'currency', valueField: 'count' }, sql: 'SELECT currency, COUNT(*) as count FROM transactions GROUP BY currency ORDER BY count DESC LIMIT 6' },
          { id: 'w6', x: 8, y: 8, cols: 4, rows: 3, type: 'chart', chartType: 'bar', title: 'Source Systems', config: { categoryField: 'source_system', valueField: 'count' }, sql: 'SELECT source_system, COUNT(*) as count FROM transactions GROUP BY source_system ORDER BY count DESC' }
        ]
      }
    };
  }
}
