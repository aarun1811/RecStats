import { Component, Output, EventEmitter } from '@angular/core';

interface WidgetType {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: 'kpi' | 'chart' | 'data';
  defaultConfig: {
    type: string;
    chartType?: string;
    cols: number;
    rows: number;
    config: any;
  };
}

const WIDGET_TYPES: WidgetType[] = [
  // KPI Widgets
  {
    id: 'kpi-number',
    name: 'KPI Number',
    icon: 'hash',
    description: 'Large number with trend indicator',
    category: 'kpi',
    defaultConfig: {
      type: 'kpi',
      cols: 3,
      rows: 2,
      config: { value: 0, trend: 'up', trendValue: '+0%' }
    }
  },
  {
    id: 'kpi-gauge',
    name: 'Gauge',
    icon: 'activity',
    description: 'Semi-circular gauge chart',
    category: 'kpi',
    defaultConfig: {
      type: 'chart',
      chartType: 'gauge',
      cols: 4,
      rows: 3,
      config: {}
    }
  },
  {
    id: 'kpi-speedometer',
    name: 'Speedometer',
    icon: 'gauge',
    description: 'Speedometer-style gauge',
    category: 'kpi',
    defaultConfig: {
      type: 'chart',
      chartType: 'speedometer',
      cols: 4,
      rows: 3,
      config: {}
    }
  },

  // Chart Widgets
  {
    id: 'chart-bar',
    name: 'Bar Chart',
    icon: 'bar-chart-2',
    description: 'Vertical bar chart',
    category: 'chart',
    defaultConfig: {
      type: 'chart',
      chartType: 'bar',
      cols: 6,
      rows: 4,
      config: {}
    }
  },
  {
    id: 'chart-line',
    name: 'Line Chart',
    icon: 'trending-up',
    description: 'Line chart with area fill',
    category: 'chart',
    defaultConfig: {
      type: 'chart',
      chartType: 'line',
      cols: 6,
      rows: 4,
      config: {}
    }
  },
  {
    id: 'chart-donut',
    name: 'Donut Chart',
    icon: 'pie-chart',
    description: 'Donut/pie chart for distributions',
    category: 'chart',
    defaultConfig: {
      type: 'chart',
      chartType: 'donut',
      cols: 4,
      rows: 3,
      config: {}
    }
  },
  {
    id: 'chart-area',
    name: 'Area Chart',
    icon: 'layers',
    description: 'Stacked area chart',
    category: 'chart',
    defaultConfig: {
      type: 'chart',
      chartType: 'area',
      cols: 6,
      rows: 4,
      config: {}
    }
  },
  {
    id: 'chart-scatter',
    name: 'Scatter Plot',
    icon: 'git-branch',
    description: 'Scatter/bubble chart',
    category: 'chart',
    defaultConfig: {
      type: 'chart',
      chartType: 'scatter',
      cols: 6,
      rows: 4,
      config: {}
    }
  },
  {
    id: 'chart-heatmap',
    name: 'Heatmap',
    icon: 'grid',
    description: 'Matrix heatmap visualization',
    category: 'chart',
    defaultConfig: {
      type: 'chart',
      chartType: 'heatmap',
      cols: 6,
      rows: 4,
      config: {}
    }
  },

  // Data Widgets
  {
    id: 'data-table',
    name: 'Data Table',
    icon: 'table',
    description: 'Interactive data grid',
    category: 'data',
    defaultConfig: {
      type: 'table',
      cols: 6,
      rows: 4,
      config: {}
    }
  },
  {
    id: 'data-list',
    name: 'List',
    icon: 'list',
    description: 'Simple data list view',
    category: 'data',
    defaultConfig: {
      type: 'list',
      cols: 4,
      rows: 3,
      config: {}
    }
  }
];

@Component({
    selector: 'app-add-widget-modal',
    template: `
    <div class="modal-overlay" (click)="onClose()">
      <div class="modal-container" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2 class="modal-title">Add Widget</h2>
          <button class="close-btn" (click)="onClose()">
            <app-icon name="x" [size]="20"></app-icon>
          </button>
        </div>

        <div class="modal-body">
          <!-- Search -->
          <div class="search-box">
            <app-icon name="search" [size]="16"></app-icon>
            <input
              type="text"
              placeholder="Search widgets..."
              [(ngModel)]="searchTerm"
              class="search-input">
          </div>

          <!-- Category Tabs -->
          <div class="category-tabs">
            <button
              *ngFor="let cat of categories"
              class="category-tab"
              [class.active]="selectedCategory === cat.id"
              (click)="selectedCategory = cat.id">
              {{ cat.label }}
            </button>
          </div>

          <!-- Widget Grid -->
          <div class="widget-grid">
            <div
              *ngFor="let widget of filteredWidgets"
              class="widget-card"
              [class.selected]="selectedWidget?.id === widget.id"
              (click)="selectWidget(widget)">
              <div class="widget-icon">
                <app-icon [name]="widget.icon" [size]="24"></app-icon>
              </div>
              <div class="widget-info">
                <h4 class="widget-name">{{ widget.name }}</h4>
                <p class="widget-description">{{ widget.description }}</p>
              </div>
              <div class="widget-check" *ngIf="selectedWidget?.id === widget.id">
                <app-icon name="check" [size]="16"></app-icon>
              </div>
            </div>
          </div>

          <!-- Widget Configuration (when selected) -->
          <div class="widget-config" *ngIf="selectedWidget">
            <h3 class="config-title">Configure Widget</h3>
            <div class="config-form">
              <div class="form-group">
                <label class="form-label">Title</label>
                <input
                  type="text"
                  class="form-input"
                  [(ngModel)]="widgetTitle"
                  placeholder="Enter widget title">
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Width (columns)</label>
                  <select class="form-input" [(ngModel)]="widgetCols">
                    <option [value]="2">2 cols</option>
                    <option [value]="3">3 cols</option>
                    <option [value]="4">4 cols</option>
                    <option [value]="6">6 cols</option>
                    <option [value]="8">8 cols</option>
                    <option [value]="12">12 cols (full)</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Height (rows)</label>
                  <select class="form-input" [(ngModel)]="widgetRows">
                    <option [value]="2">2 rows</option>
                    <option [value]="3">3 rows</option>
                    <option [value]="4">4 rows</option>
                    <option [value]="5">5 rows</option>
                    <option [value]="6">6 rows</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <app-button variant="ghost" (click)="onClose()">Cancel</app-button>
          <app-button
            variant="primary"
            [disabled]="!selectedWidget || !widgetTitle"
            (click)="onAdd()">
            <app-icon name="plus" [size]="16"></app-icon>
            Add Widget
          </app-button>
        </div>
      </div>
    </div>
  `,
    styles: [`
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .modal-container {
      width: 90%;
      max-width: 700px;
      max-height: 85vh;
      background: var(--bg-secondary);
      border-radius: var(--radius-xl);
      border: 1px solid var(--border-color);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      animation: slideUp 0.3s ease;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-4) var(--spacing-5);
      border-bottom: 1px solid var(--border-color);
    }

    .modal-title {
      font-size: var(--font-size-xl);
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

    .modal-body {
      flex: 1;
      overflow-y: auto;
      padding: var(--spacing-5);
    }

    .search-box {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      padding: 0 var(--spacing-3);
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      margin-bottom: var(--spacing-4);

      app-icon {
        color: var(--text-muted);
      }
    }

    .search-input {
      flex: 1;
      height: 40px;
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

    .category-tabs {
      display: flex;
      gap: var(--spacing-2);
      margin-bottom: var(--spacing-4);
    }

    .category-tab {
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
    }

    .widget-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--spacing-3);
      margin-bottom: var(--spacing-4);
    }

    .widget-card {
      display: flex;
      align-items: flex-start;
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
        transform: translateY(-2px);
      }

      &.selected {
        border-color: var(--color-primary);
        background: rgba(var(--color-primary-rgb), 0.1);
      }
    }

    .widget-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      background: var(--bg-primary);
      border-radius: var(--radius-md);
      color: var(--color-primary);
      flex-shrink: 0;
    }

    .widget-info {
      flex: 1;
      min-width: 0;
    }

    .widget-name {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-semibold);
      color: var(--text-primary);
      margin: 0 0 var(--spacing-1) 0;
    }

    .widget-description {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      margin: 0;
      line-height: 1.4;
    }

    .widget-check {
      position: absolute;
      top: var(--spacing-2);
      right: var(--spacing-2);
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      background: var(--color-primary);
      border-radius: var(--radius-full);
      color: white;
    }

    .widget-config {
      background: var(--bg-tertiary);
      border-radius: var(--radius-lg);
      padding: var(--spacing-4);
      border: 1px solid var(--border-color);
    }

    .config-title {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-semibold);
      color: var(--text-primary);
      margin: 0 0 var(--spacing-3) 0;
    }

    .config-form {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-3);
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--spacing-3);
    }

    .form-group {
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

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: var(--spacing-2);
      padding: var(--spacing-4) var(--spacing-5);
      border-top: 1px solid var(--border-color);
    }
  `],
    standalone: false
})
export class AddWidgetModalComponent {
  @Output() close = new EventEmitter<void>();
  @Output() addWidget = new EventEmitter<any>();

  widgetTypes = WIDGET_TYPES;
  searchTerm = '';
  selectedCategory = 'all';
  selectedWidget: WidgetType | null = null;

  // Widget configuration
  widgetTitle = '';
  widgetCols = 4;
  widgetRows = 3;

  categories = [
    { id: 'all', label: 'All' },
    { id: 'kpi', label: 'KPI' },
    { id: 'chart', label: 'Charts' },
    { id: 'data', label: 'Data' }
  ];

  get filteredWidgets(): WidgetType[] {
    return this.widgetTypes.filter(w => {
      const matchesCategory = this.selectedCategory === 'all' || w.category === this.selectedCategory;
      const matchesSearch = !this.searchTerm ||
        w.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        w.description.toLowerCase().includes(this.searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }

  selectWidget(widget: WidgetType) {
    this.selectedWidget = widget;
    this.widgetTitle = widget.name;
    this.widgetCols = widget.defaultConfig.cols;
    this.widgetRows = widget.defaultConfig.rows;
  }

  onClose() {
    this.close.emit();
  }

  onAdd() {
    if (!this.selectedWidget) return;

    const config = {
      ...this.selectedWidget.defaultConfig,
      title: this.widgetTitle,
      cols: this.widgetCols,
      rows: this.widgetRows
    };

    this.addWidget.emit(config);
  }
}
