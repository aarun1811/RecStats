import { Component, Input, Output, EventEmitter } from '@angular/core';

export interface ChartTypeOption {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: string;
}

export const CHART_TYPES: ChartTypeOption[] = [
  // Basic Charts
  { id: 'bar', name: 'Bar Chart', icon: 'chart-bar', description: 'Compare values across categories', category: 'Basic' },
  { id: 'column', name: 'Column Chart', icon: 'chart-bar', description: 'Vertical bar comparison', category: 'Basic' },
  { id: 'line', name: 'Line Chart', icon: 'trending-up', description: 'Show trends over time', category: 'Basic' },
  { id: 'area', name: 'Area Chart', icon: 'activity', description: 'Line chart with filled area', category: 'Basic' },
  { id: 'pie', name: 'Pie Chart', icon: 'pie-chart', description: 'Show parts of a whole', category: 'Basic' },
  { id: 'donut', name: 'Donut Chart', icon: 'pie-chart', description: 'Pie chart with center cutout', category: 'Basic' },

  // Advanced Charts
  { id: 'scatter', name: 'Scatter Plot', icon: 'activity', description: 'Show correlation between variables', category: 'Advanced' },
  { id: 'heatmap', name: 'Heatmap', icon: 'layers', description: 'Show data density with colors', category: 'Advanced' },
  { id: 'treemap', name: 'Treemap', icon: 'layers', description: 'Hierarchical data visualization', category: 'Advanced' },
  { id: 'funnel', name: 'Funnel Chart', icon: 'filter', description: 'Show stages in a process', category: 'Advanced' },
  { id: 'radar', name: 'Radar Chart', icon: 'activity', description: 'Compare multiple metrics', category: 'Advanced' },
  { id: 'sankey', name: 'Sankey Diagram', icon: 'activity', description: 'Show flow between nodes', category: 'Advanced' },

  // KPI & Gauges
  { id: 'gauge', name: 'Gauge', icon: 'activity', description: 'Speedometer-style KPI display', category: 'KPI' },
  { id: 'speedometer', name: 'Speedometer', icon: 'activity', description: 'Speed-style gauge with needle', category: 'KPI' },
  { id: 'radialBar', name: 'Radial Bar', icon: 'activity', description: 'Circular progress indicator', category: 'KPI' },
  { id: 'kpiCard', name: 'KPI Card', icon: 'hash', description: 'Big number with trend', category: 'KPI' },

  // Geographic
  { id: 'worldMap', name: 'World Map', icon: 'globe', description: 'Geographic data visualization', category: 'Geographic' },
];

@Component({
  selector: 'app-chart-type-picker',
  template: `
    <div class="chart-type-picker">
      <div class="picker-header">
        <h3>Select Chart Type</h3>
        <div class="category-tabs">
          <button
            *ngFor="let category of categories"
            class="category-tab"
            [class.active]="activeCategory === category"
            (click)="activeCategory = category">
            {{ category }}
          </button>
        </div>
      </div>

      <div class="chart-grid">
        <div
          *ngFor="let chartType of filteredChartTypes"
          class="chart-type-card"
          [class.selected]="selectedType === chartType.id"
          (click)="selectType(chartType)">
          <div class="chart-icon">
            <app-icon [name]="chartType.icon" [size]="32"></app-icon>
          </div>
          <div class="chart-info">
            <h4>{{ chartType.name }}</h4>
            <p>{{ chartType.description }}</p>
          </div>
          <div class="selected-indicator" *ngIf="selectedType === chartType.id">
            <app-icon name="check" [size]="16"></app-icon>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .chart-type-picker {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .picker-header {
      padding: var(--spacing-4);
      border-bottom: 1px solid var(--border-color);

      h3 {
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--text-primary);
        margin: 0 0 var(--spacing-3) 0;
      }
    }

    .category-tabs {
      display: flex;
      gap: var(--spacing-2);
      flex-wrap: wrap;
    }

    .category-tab {
      padding: var(--spacing-2) var(--spacing-3);
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-full);
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: var(--bg-secondary);
        color: var(--text-primary);
      }

      &.active {
        background: var(--color-primary);
        border-color: var(--color-primary);
        color: white;
      }
    }

    .chart-grid {
      flex: 1;
      overflow-y: auto;
      padding: var(--spacing-4);
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: var(--spacing-3);
    }

    .chart-type-card {
      position: relative;
      padding: var(--spacing-4);
      background: var(--bg-secondary);
      border: 2px solid var(--border-color);
      border-radius: var(--radius-lg);
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        border-color: var(--color-primary-light);
        background: var(--bg-tertiary);
        transform: translateY(-2px);
        box-shadow: var(--glow-primary);
      }

      &.selected {
        border-color: var(--color-primary);
        background: rgba(var(--color-primary-rgb), 0.1);
      }
    }

    .chart-icon {
      width: 56px;
      height: 56px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(var(--color-primary-rgb), 0.15);
      border-radius: var(--radius-md);
      color: var(--color-primary-light);
      margin-bottom: var(--spacing-3);
    }

    .chart-info {
      h4 {
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-semibold);
        color: var(--text-primary);
        margin: 0 0 var(--spacing-1) 0;
      }

      p {
        font-size: var(--font-size-sm);
        color: var(--text-muted);
        margin: 0;
        line-height: 1.4;
      }
    }

    .selected-indicator {
      position: absolute;
      top: var(--spacing-2);
      right: var(--spacing-2);
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-primary);
      border-radius: var(--radius-full);
      color: white;
    }
  `]
})
export class ChartTypePickerComponent {
  @Input() selectedType: string = '';
  @Output() typeSelect = new EventEmitter<ChartTypeOption>();

  chartTypes = CHART_TYPES;
  categories = ['All', 'Basic', 'Advanced', 'KPI', 'Geographic'];
  activeCategory = 'All';

  get filteredChartTypes(): ChartTypeOption[] {
    if (this.activeCategory === 'All') {
      return this.chartTypes;
    }
    return this.chartTypes.filter(t => t.category === this.activeCategory);
  }

  selectType(chartType: ChartTypeOption) {
    this.selectedType = chartType.id;
    this.typeSelect.emit(chartType);
  }
}
