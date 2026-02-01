import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NotificationService } from '../../core/services/notification.service';
import { ApiService } from '../../core/services/api.service';
import { GridsterConfig, GridsterItem, DisplayGrid, GridType, CompactType } from 'angular-gridster2';
import { firstValueFrom } from 'rxjs';
import { WidgetSelection } from './chart-picker-panel.component';

export interface DashboardWidget extends GridsterItem {
  id: string;
  type: 'chart' | 'table';
  chartId?: string;   // Reference to chart in library
  queryId?: string;   // Reference to saved query
  title: string;
  chartType?: string;
  config?: any;
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
          <button class="back-btn" (click)="goBack()">
            <app-icon name="arrow-left" [size]="18"></app-icon>
          </button>
          <input
            type="text"
            class="dashboard-title-input"
            [(ngModel)]="dashboardTitle"
            placeholder="Dashboard Title">
        </div>
        <div class="toolbar-right">
          <app-button variant="ghost" (click)="toggleEditMode()">
            <app-icon [name]="editMode() ? 'eye' : 'edit'" [size]="16"></app-icon>
            {{ editMode() ? 'Preview' : 'Edit' }}
          </app-button>
          <app-button variant="secondary" (click)="showChartPicker.set(true)" *ngIf="editMode()">
            <app-icon name="plus" [size]="16"></app-icon>
            Add Widget
          </app-button>
          <app-button variant="primary" (click)="saveDashboard()">
            <app-icon name="save" [size]="16"></app-icon>
            Save
          </app-button>
        </div>
      </div>

      <!-- Dashboard Grid -->
      <div class="dashboard-content">
        <div class="empty-state" *ngIf="widgets().length === 0">
          <div class="empty-icon">
            <app-icon name="layout" [size]="48"></app-icon>
          </div>
          <h3>No widgets yet</h3>
          <p>Click "Add Widget" to add charts and tables from your library</p>
          <app-button variant="primary" (click)="showChartPicker.set(true)">
            <app-icon name="plus" [size]="16"></app-icon>
            Add Widget
          </app-button>
        </div>

        <app-dashboard-grid
          *ngIf="widgets().length > 0"
          [widgets]="widgets()"
          [options]="gridOptions"
          [editMode]="editMode()"
          (widgetRemove)="removeWidget($event)"
          (widgetEdit)="editWidget($event)"
          (layoutChange)="onLayoutChange($event)">
        </app-dashboard-grid>
      </div>

      <!-- Chart Picker Panel -->
      <app-chart-picker-panel
        *ngIf="showChartPicker()"
        (closePanel)="showChartPicker.set(false)"
        (widgetSelected)="addWidget($event)">
      </app-chart-picker-panel>
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

    .toolbar-left, .toolbar-right {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
    }

    .back-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
        border-color: var(--border-hover);
      }
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

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      text-align: center;
      color: var(--text-muted);

      .empty-icon {
        width: 80px;
        height: 80px;
        background: var(--bg-secondary);
        border-radius: var(--radius-xl);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: var(--spacing-4);
        color: var(--color-primary);
        opacity: 0.6;
      }

      h3 {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--text-primary);
        margin: 0 0 var(--spacing-2) 0;
      }

      p {
        font-size: var(--font-size-sm);
        margin: 0 0 var(--spacing-4) 0;
        max-width: 300px;
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
  editMode = signal(true);  // Start in edit mode for new dashboards
  showChartPicker = signal(false);

  // Gridster options
  gridOptions: GridsterConfig = {
    gridType: GridType.ScrollVertical,  // Allow vertical scrolling
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
    maxRows: 1000,  // Effectively unlimited
    fixedRowHeight: 80,  // Fixed row height for scroll mode
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
      this.editMode.set(false);  // Start in view mode for existing dashboards
    } else {
      // New dashboard - start empty in edit mode
      this.dashboardId = null;
      this.dashboardTitle = 'Untitled Dashboard';
      this.widgets.set([]);
    }
  }

  goBack() {
    this.router.navigate(['/dashboards']);
  }

  async loadDashboard(id: string) {
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
      console.error('Failed to load dashboard:', error);
      this.notifications.error('Dashboard not found');
      this.router.navigate(['/dashboards']);
    }
  }

  toggleEditMode() {
    this.editMode.update(v => !v);
    this.gridOptions = {
      ...this.gridOptions,
      draggable: { ...this.gridOptions.draggable!, enabled: this.editMode() },
      resizable: { enabled: this.editMode() },
      displayGrid: this.editMode() ? DisplayGrid.OnDragAndResize : DisplayGrid.None
    };
  }

  addWidget(selection: WidgetSelection) {
    const newWidget: DashboardWidget = {
      id: `w${Date.now()}`,
      x: 0,
      y: 0,
      cols: selection.cols,
      rows: selection.rows,
      type: selection.type,
      chartId: selection.chartId,
      queryId: selection.queryId,
      chartType: selection.chartType,
      title: selection.title,
      config: selection.config
    };

    this.widgets.update(widgets => [...widgets, newWidget]);
    this.showChartPicker.set(false);
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
          chartId: w.chartId,
          queryId: w.queryId,
          chartType: w.chartType,
          title: w.title,
          config: w.config
        }))
      }
    };

    try {
      if (this.dashboardId) {
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
}
