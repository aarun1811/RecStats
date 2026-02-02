import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { NotificationService } from '../../core/services/notification.service';
import { ApiService } from '../../core/services/api.service';
import { GridsterConfig, GridsterItem, DisplayGrid, GridType, CompactType } from 'angular-gridster2';
import { firstValueFrom } from 'rxjs';
import { WidgetSelection } from './chart-picker-panel.component';
import { DashboardFilter, ChartColumn } from './filters/models/filter.models';
import { FilterStateService } from './services/filter-state.service';
import { FilterConfigService } from './services/filter-config.service';

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

interface ChartInfo {
  id: string;
  name: string;
  columns: ChartColumn[];
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

      <!-- Filter Bar -->
      <div class="filter-bar-container" *ngIf="filters().length > 0 || editMode()">
        <app-filter-bar
          [filters]="filters()"
          [editMode]="editMode()"
          (configure)="openFilterConfig()"
          (filterChange)="onFilterChange($event)">
        </app-filter-bar>
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
          (layoutChange)="onLayoutChange($event)">
        </app-dashboard-grid>
      </div>

      <!-- Chart Picker Panel -->
      <app-chart-picker-panel
        *ngIf="showChartPicker()"
        (closePanel)="showChartPicker.set(false)"
        (widgetSelected)="addWidget($event)">
      </app-chart-picker-panel>

      <!-- Filter Config Modal -->
      <app-filter-config-modal
        [isOpen]="showFilterConfig()"
        [dashboardId]="dashboardId || ''"
        [filters]="filters()"
        [charts]="chartInfos()"
        [dataSources]="dataSources()"
        (closed)="showFilterConfig.set(false)"
        (saved)="onFiltersSaved($event)">
      </app-filter-config-modal>
    </div>
  `,
    styles: [`
    /* ═══════════════════════════════════════════════════════════
       ANIMATIONS
    ═══════════════════════════════════════════════════════════ */
    @keyframes contentFade {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes slideInDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes softBounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }

    @keyframes savePulse {
      0%, 100% {
        box-shadow: 0 0 0 0 rgba(var(--color-primary-rgb), 0);
      }
      50% {
        box-shadow: 0 0 0 4px rgba(var(--color-primary-rgb), 0.3);
      }
    }

    @keyframes inputFocusGlow {
      0%, 100% {
        box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.2);
      }
      50% {
        box-shadow: 0 0 0 4px rgba(var(--color-primary-rgb), 0.15);
      }
    }

    .dashboard-builder {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 64px);
      background: var(--bg-primary);
      animation: contentFade 350ms ease-out;
    }

    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-3) var(--spacing-4);
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      gap: var(--spacing-4);
      animation: slideInDown 250ms ease-out;
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

      app-icon {
        transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
        border-color: var(--border-hover);

        app-icon {
          transform: translateX(-3px);
        }
      }
    }

    .dashboard-title-input {
      background: transparent;
      border: 2px solid transparent;
      font-size: var(--font-size-lg);
      font-weight: var(--font-weight-semibold);
      color: var(--text-primary);
      padding: var(--spacing-2) var(--spacing-3);
      min-width: 200px;
      border-radius: var(--radius-md);
      transition: all 0.25s ease;

      &:hover {
        background: rgba(var(--color-primary-rgb), 0.05);
      }

      &:focus {
        outline: none;
        background: var(--bg-tertiary);
        border-color: rgba(var(--color-primary-rgb), 0.3);
        animation: inputFocusGlow 2s ease-in-out infinite;
      }

      &::placeholder {
        color: var(--text-muted);
      }
    }

    /* Button micro-interactions */
    :host ::ng-deep .toolbar-right {

      /* Add Widget button - plus icon rotation */
      app-button[variant="secondary"]:hover app-icon {
        transform: rotate(90deg);
        transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      /* Save button - icon tilt */
      app-button[variant="primary"] app-icon {
        transition: transform 0.2s ease;
      }

      app-button[variant="primary"]:hover app-icon {
        transform: rotate(-15deg);
      }
    }

    .filter-bar-container {
      padding: var(--spacing-3) var(--spacing-4) 0;
      animation: slideInDown 250ms ease-out 50ms backwards;
    }

    .dashboard-content {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: var(--spacing-4);
      padding-right: var(--spacing-5);
      min-height: 0;
      animation: contentFade 350ms ease-out 100ms backwards;

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

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      text-align: center;
      color: var(--text-muted);
      animation: contentFade 400ms ease-out 200ms backwards;

      .empty-icon {
        width: 80px;
        height: 80px;
        background: linear-gradient(135deg, rgba(var(--color-primary-rgb), 0.2), rgba(var(--color-primary-rgb), 0.05));
        border-radius: var(--radius-xl);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: var(--spacing-4);
        color: var(--color-primary);
        animation: softBounce 3s ease-in-out infinite;

        app-icon {
          filter: drop-shadow(0 0 8px rgba(var(--color-primary-rgb), 0.4));
        }
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

      /* Empty state Add Widget button hover */
      app-button:hover app-icon {
        transform: rotate(90deg);
        transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
    }
  `],
    standalone: false
})
export class DashboardBuilderComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private notifications = inject(NotificationService);
  private api = inject(ApiService);
  private filterState = inject(FilterStateService);
  private filterConfig = inject(FilterConfigService);

  private destroy$ = new Subject<void>();

  // State
  dashboardId: string | null = null;
  dashboardTitle = 'Untitled Dashboard';
  widgets = signal<DashboardWidget[]>([]);
  editMode = signal(true);  // Start in edit mode for new dashboards
  showChartPicker = signal(false);

  // Filter state
  filters = signal<DashboardFilter[]>([]);
  showFilterConfig = signal(false);
  chartInfos = signal<ChartInfo[]>([]);
  dataSources = signal<{ id: string; name: string }[]>([]);

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
    outerMarginRight: 12,
    outerMarginBottom: 0,
    outerMarginLeft: 0
  };

  ngOnInit() {
    // Load dashboard if ID provided
    this.dashboardId = this.route.snapshot.paramMap.get('id');
    if (this.dashboardId && this.dashboardId !== 'new') {
      this.loadDashboard(this.dashboardId);
      this.editMode.set(false);  // Start in view mode for existing dashboards
      this.updateGridOptions();  // Sync grid options with view mode
    } else {
      // New dashboard - start empty in edit mode
      this.dashboardId = null;
      this.dashboardTitle = 'Untitled Dashboard';
      this.widgets.set([]);
    }

    // Subscribe to filter changes
    this.filterState.filterChanged$
      .pipe(takeUntil(this.destroy$))
      .subscribe(event => {
        this.onFilterApplied(event);
      });

    // Load data sources for filter config
    this.loadDataSources();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.filterState.reset();
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

      // Load filters for this dashboard
      this.loadFilters(id);

      // Load chart info for filter scoping
      this.loadChartInfos();

      this.notifications.success(`Loaded "${response.name}"`);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      this.notifications.error('Dashboard not found');
      this.router.navigate(['/dashboards']);
    }
  }

  private loadFilters(dashboardId: string) {
    this.filterConfig.getFilters(dashboardId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (filters) => {
          this.filters.set(filters);
          this.filterState.setFilters(dashboardId, filters);
        },
        error: (err) => {
          console.error('Failed to load filters:', err);
        }
      });
  }

  private loadChartInfos() {
    // Build chart info from widgets
    const chartWidgets = this.widgets().filter(w => w.type === 'chart' && w.chartId);
    const chartInfos: ChartInfo[] = [];

    chartWidgets.forEach(widget => {
      if (widget.chartId) {
        // For now, use widget title as chart name
        // Chart columns would be loaded via API when filter config modal opens
        chartInfos.push({
          id: widget.chartId,
          name: widget.title,
          columns: []
        });
      }
    });

    this.chartInfos.set(chartInfos);
  }

  private loadDataSources() {
    this.api.get<any[]>('/datasources')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sources) => {
          this.dataSources.set(sources.map(s => ({
            id: s.id,
            name: s.name
          })));
        },
        error: () => {
          // Silent fail - data sources are optional
        }
      });
  }

  toggleEditMode() {
    this.editMode.update(v => !v);
    this.updateGridOptions();
  }

  private updateGridOptions() {
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

  onLayoutChange(layout: DashboardWidget[]) {
    this.widgets.set(layout);
  }

  // =========================================================================
  // Filter Methods
  // =========================================================================

  openFilterConfig() {
    // Load chart columns before opening modal
    this.loadChartColumns().then(() => {
      this.showFilterConfig.set(true);
    });
  }

  private async loadChartColumns() {
    const chartInfos = this.chartInfos();
    const updatedInfos = await Promise.all(
      chartInfos.map(async (info) => {
        try {
          const columns = await firstValueFrom(
            this.filterConfig.getChartColumns(info.id)
          );
          return { ...info, columns };
        } catch {
          return info;
        }
      })
    );
    this.chartInfos.set(updatedInfos);
  }

  onFilterChange(event: { filterId: string; value: unknown }) {
    // Filter state is already updated by FilterWidgetComponent
    // This is just for logging/tracking purposes
    console.log('Filter changed:', event);
  }

  onFilterApplied(event: { filterId: string; value: unknown; affectedChartIds: string[] }) {
    // Notify affected widgets to refresh
    // This will be handled by individual chart components subscribing to filter changes
    console.log('Filter applied, affected charts:', event.affectedChartIds);
  }

  async onFiltersSaved(filters: DashboardFilter[]) {
    if (!this.dashboardId) {
      this.notifications.warning('Please save the dashboard first');
      this.showFilterConfig.set(false);
      return;
    }

    try {
      // Process each filter - create new, update existing, delete removed
      const existingFilters = this.filters();
      const existingIds = new Set(existingFilters.map(f => f.id));

      for (const filter of filters) {
        if (filter.id.startsWith('new-')) {
          // Create new filter
          const created = await firstValueFrom(
            this.filterConfig.createFilter({
              dashboardId: this.dashboardId,
              name: filter.name,
              filterType: filter.filterType,
              valuesQuery: filter.valuesQuery,
              staticOptions: filter.staticOptions,
              dataSourceId: filter.dataSourceId,
              defaultValue: filter.defaultValue,
              placeholder: filter.placeholder,
              required: filter.required,
              displayOrder: filter.displayOrder,
              minValue: filter.minValue,
              maxValue: filter.maxValue,
              chartMappings: filter.chartMappings.map(m => ({
                chartId: m.chartId,
                columnName: m.columnName,
                operator: m.operator,
                enabled: m.enabled
              }))
            })
          );
          // Update filter ID after creation
          filter.id = created.id;
        } else if (existingIds.has(filter.id)) {
          // Update existing filter
          await firstValueFrom(
            this.filterConfig.updateFilter(filter.id, {
              name: filter.name,
              filterType: filter.filterType,
              valuesQuery: filter.valuesQuery,
              staticOptions: filter.staticOptions,
              dataSourceId: filter.dataSourceId,
              defaultValue: filter.defaultValue,
              placeholder: filter.placeholder,
              required: filter.required,
              displayOrder: filter.displayOrder,
              minValue: filter.minValue,
              maxValue: filter.maxValue
            })
          );

          // Update chart mappings
          // For simplicity, we'll handle this by comparing existing vs new mappings
          // A more robust implementation would track individual mapping changes
        }
      }

      // Delete removed filters
      const newIds = new Set(filters.map(f => f.id));
      for (const existing of existingFilters) {
        if (!newIds.has(existing.id) && !existing.id.startsWith('new-')) {
          await firstValueFrom(
            this.filterConfig.deleteFilter(existing.id)
          );
        }
      }

      // Update local state
      this.filters.set(filters);
      this.filterState.setFilters(this.dashboardId, filters);

      this.showFilterConfig.set(false);
      this.notifications.success('Filters saved');
    } catch (error: any) {
      console.error('Failed to save filters:', error);
      this.notifications.error(error.message || 'Failed to save filters');
    }
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
