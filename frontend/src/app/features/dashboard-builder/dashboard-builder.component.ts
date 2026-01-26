import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NotificationService } from '../../core/services/notification.service';
import { GridsterConfig, GridsterItem, DisplayGrid, GridType, CompactType } from 'angular-gridster2';

export interface DashboardWidget extends GridsterItem {
  id: string;
  type: 'chart' | 'kpi' | 'table' | 'filter';
  chartType?: string;
  title: string;
  config: any;
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
          <app-filter-bar
            [filters]="globalFilters()"
            (filterChange)="onFilterChange($event)">
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
          (widgetRemove)="removeWidget($event)"
          (widgetEdit)="editWidget($event)"
          (layoutChange)="onLayoutChange($event)">
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
  `]
})
export class DashboardBuilderComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private notifications = inject(NotificationService);

  // State
  dashboardId: string | null = null;
  dashboardTitle = 'Untitled Dashboard';
  widgets = signal<DashboardWidget[]>([]);
  globalFilters = signal<any[]>([]);
  editMode = signal(true);
  showAddWidgetModal = signal(false);
  showMoreOptions = false;

  // Gridster options
  gridOptions: GridsterConfig = {
    gridType: GridType.Fit,
    displayGrid: DisplayGrid.OnDragAndResize,
    compactType: CompactType.None,
    pushItems: true,
    draggable: {
      enabled: true,
      ignoreContent: true,
      dragHandleClass: 'drag-handle'
    },
    resizable: {
      enabled: true
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
    if (this.dashboardId) {
      this.loadDashboard(this.dashboardId);
    } else {
      // Start with sample widgets for demo
      this.loadSampleWidgets();
    }
  }

  loadDashboard(id: string) {
    // Load predefined sample dashboards
    const sampleDashboards: Record<string, { title: string; widgets: DashboardWidget[] }> = {
      'executive': {
        title: 'Executive Overview',
        widgets: [
          { id: 'w1', x: 0, y: 0, cols: 3, rows: 2, type: 'kpi', title: 'Total Transactions', config: { value: 847523, trend: 'up', trendValue: '+12.5%' } },
          { id: 'w2', x: 3, y: 0, cols: 3, rows: 2, type: 'kpi', title: 'Match Rate', config: { value: 94.2, suffix: '%', variant: 'success', trend: 'up', trendValue: '+2.1%' } },
          { id: 'w3', x: 6, y: 0, cols: 3, rows: 2, type: 'kpi', title: 'Open Breaks', config: { value: 1247, variant: 'warning', trend: 'down', trendValue: '-8.3%' } },
          { id: 'w4', x: 9, y: 0, cols: 3, rows: 2, type: 'kpi', title: 'Avg Break Age', config: { value: 4.2, suffix: ' days', trend: 'down', trendValue: '-1.5 days' } },
          { id: 'w5', x: 0, y: 2, cols: 6, rows: 4, type: 'chart', chartType: 'line', title: 'Transaction Volume Trend', config: {} },
          { id: 'w6', x: 6, y: 2, cols: 6, rows: 4, type: 'chart', chartType: 'bar', title: 'Breaks by Region', config: {} },
          { id: 'w7', x: 0, y: 6, cols: 4, rows: 3, type: 'chart', chartType: 'gauge', title: 'SLA Compliance', config: {} },
          { id: 'w8', x: 4, y: 6, cols: 4, rows: 3, type: 'chart', chartType: 'speedometer', title: 'Performance Score', config: {} },
          { id: 'w9', x: 8, y: 6, cols: 4, rows: 3, type: 'chart', chartType: 'donut', title: 'Status Distribution', config: {} }
        ]
      },
      'breaks': {
        title: 'Break Analysis',
        widgets: [
          { id: 'w1', x: 0, y: 0, cols: 4, rows: 2, type: 'kpi', title: 'Total Breaks', config: { value: 1247, variant: 'danger', trend: 'down', trendValue: '-8.3%' } },
          { id: 'w2', x: 4, y: 0, cols: 4, rows: 2, type: 'kpi', title: 'Critical Breaks', config: { value: 89, variant: 'danger', trend: 'down', trendValue: '-15%' } },
          { id: 'w3', x: 8, y: 0, cols: 4, rows: 2, type: 'kpi', title: 'Avg Resolution', config: { value: 2.4, suffix: ' days', trend: 'down', trendValue: '-0.5 days' } },
          { id: 'w4', x: 0, y: 2, cols: 6, rows: 4, type: 'chart', chartType: 'bar', title: 'Breaks by Reason', config: {} },
          { id: 'w5', x: 6, y: 2, cols: 6, rows: 4, type: 'chart', chartType: 'line', title: 'Break Trend Over Time', config: {} },
          { id: 'w6', x: 0, y: 6, cols: 4, rows: 3, type: 'chart', chartType: 'donut', title: 'Break Status', config: {} },
          { id: 'w7', x: 4, y: 6, cols: 4, rows: 3, type: 'chart', chartType: 'bar', title: 'Breaks by LOB', config: {} },
          { id: 'w8', x: 8, y: 6, cols: 4, rows: 3, type: 'chart', chartType: 'gauge', title: 'Resolution Rate', config: {} }
        ]
      },
      'geo': {
        title: 'Geographic View',
        widgets: [
          { id: 'w1', x: 0, y: 0, cols: 3, rows: 2, type: 'kpi', title: 'APAC Volume', config: { value: 234521, trend: 'up', trendValue: '+8.2%' } },
          { id: 'w2', x: 3, y: 0, cols: 3, rows: 2, type: 'kpi', title: 'EMEA Volume', config: { value: 312450, trend: 'up', trendValue: '+5.1%' } },
          { id: 'w3', x: 6, y: 0, cols: 3, rows: 2, type: 'kpi', title: 'NAM Volume', config: { value: 198320, trend: 'up', trendValue: '+12.3%' } },
          { id: 'w4', x: 9, y: 0, cols: 3, rows: 2, type: 'kpi', title: 'LATAM Volume', config: { value: 102232, trend: 'down', trendValue: '-2.1%' } },
          { id: 'w5', x: 0, y: 2, cols: 8, rows: 5, type: 'chart', chartType: 'bar', title: 'Volume by Region', config: {} },
          { id: 'w6', x: 8, y: 2, cols: 4, rows: 5, type: 'chart', chartType: 'donut', title: 'Regional Distribution', config: {} }
        ]
      },
      'recon': {
        title: 'Reconciliation Status',
        widgets: [
          { id: 'w1', x: 0, y: 0, cols: 3, rows: 2, type: 'kpi', title: 'Active Recons', config: { value: 45, trend: 'up', trendValue: '+3' } },
          { id: 'w2', x: 3, y: 0, cols: 3, rows: 2, type: 'kpi', title: 'Overall Match Rate', config: { value: 96.8, suffix: '%', variant: 'success', trend: 'up', trendValue: '+1.2%' } },
          { id: 'w3', x: 6, y: 0, cols: 3, rows: 2, type: 'kpi', title: 'Failed Runs', config: { value: 2, variant: 'danger', trend: 'down', trendValue: '-3' } },
          { id: 'w4', x: 9, y: 0, cols: 3, rows: 2, type: 'kpi', title: 'Avg Run Time', config: { value: 4.5, suffix: ' min', trend: 'down', trendValue: '-1.2 min' } },
          { id: 'w5', x: 0, y: 2, cols: 6, rows: 4, type: 'chart', chartType: 'bar', title: 'Match Rate by Recon', config: {} },
          { id: 'w6', x: 6, y: 2, cols: 6, rows: 4, type: 'chart', chartType: 'line', title: 'Recon Health Trend', config: {} },
          { id: 'w7', x: 0, y: 6, cols: 6, rows: 3, type: 'chart', chartType: 'gauge', title: 'System Health', config: {} },
          { id: 'w8', x: 6, y: 6, cols: 6, rows: 3, type: 'chart', chartType: 'speedometer', title: 'Processing Speed', config: {} }
        ]
      },
      'trends': {
        title: 'Trend Analytics',
        widgets: [
          { id: 'w1', x: 0, y: 0, cols: 12, rows: 4, type: 'chart', chartType: 'line', title: 'Transaction Volume - 90 Day Trend', config: {} },
          { id: 'w2', x: 0, y: 4, cols: 6, rows: 4, type: 'chart', chartType: 'bar', title: 'Month-over-Month Comparison', config: {} },
          { id: 'w3', x: 6, y: 4, cols: 6, rows: 4, type: 'chart', chartType: 'line', title: 'Break Rate Trend', config: {} },
          { id: 'w4', x: 0, y: 8, cols: 4, rows: 3, type: 'chart', chartType: 'gauge', title: 'YTD Performance', config: {} },
          { id: 'w5', x: 4, y: 8, cols: 4, rows: 3, type: 'chart', chartType: 'speedometer', title: 'Current Month', config: {} },
          { id: 'w6', x: 8, y: 8, cols: 4, rows: 3, type: 'chart', chartType: 'donut', title: 'Trend Direction', config: {} }
        ]
      }
    };

    const dashboard = sampleDashboards[id];
    if (dashboard) {
      this.dashboardTitle = dashboard.title;
      this.widgets.set(dashboard.widgets);
      this.notifications.success(`Loaded "${dashboard.title}"`);
    } else {
      this.loadSampleWidgets();
    }
  }

  loadSampleWidgets() {
    this.dashboardTitle = 'Executive Overview';
    this.widgets.set([
      { id: 'w1', x: 0, y: 0, cols: 3, rows: 2, type: 'kpi', title: 'Total Transactions', config: { value: 847523, trend: 'up', trendValue: '+12.5%' } },
      { id: 'w2', x: 3, y: 0, cols: 3, rows: 2, type: 'kpi', title: 'Match Rate', config: { value: 94.2, suffix: '%', variant: 'success', trend: 'up', trendValue: '+2.1%' } },
      { id: 'w3', x: 6, y: 0, cols: 3, rows: 2, type: 'kpi', title: 'Open Breaks', config: { value: 1247, variant: 'warning', trend: 'down', trendValue: '-8.3%' } },
      { id: 'w4', x: 9, y: 0, cols: 3, rows: 2, type: 'kpi', title: 'Avg Break Age', config: { value: 4.2, suffix: ' days', trend: 'down', trendValue: '-1.5 days' } },
      { id: 'w5', x: 0, y: 2, cols: 6, rows: 4, type: 'chart', chartType: 'line', title: 'Transaction Volume Trend', config: {} },
      { id: 'w6', x: 6, y: 2, cols: 6, rows: 4, type: 'chart', chartType: 'bar', title: 'Breaks by Region', config: {} },
      { id: 'w7', x: 0, y: 6, cols: 4, rows: 3, type: 'chart', chartType: 'donut', title: 'Status Distribution', config: {} },
      { id: 'w8', x: 4, y: 6, cols: 4, rows: 3, type: 'chart', chartType: 'gauge', title: 'SLA Compliance', config: {} },
      { id: 'w9', x: 8, y: 6, cols: 4, rows: 3, type: 'chart', chartType: 'speedometer', title: 'Performance Score', config: {} }
    ]);
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
    // TODO: Apply filters to all widgets
  }

  saveDashboard() {
    // TODO: Save to API
    this.notifications.success('Dashboard saved');
  }
}
