import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, inject } from '@angular/core';
import { DashboardWidget } from './dashboard-builder.component';
import { ApiService } from '../../core/services/api.service';
import { firstValueFrom } from 'rxjs';

export interface CrossFilter {
  field: string;
  value: any;
  sourceWidgetId: string;
}

@Component({
  selector: 'app-widget-wrapper',
  template: `
    <div class="widget-wrapper">
      <!-- Widget Header -->
      <div class="widget-header" [class.drag-handle]="editMode">
        <h4 class="widget-title">{{ widget.title }}</h4>
        <div class="widget-actions" *ngIf="editMode">
          <button class="action-btn" (click)="onEdit()" title="Edit">
            <app-icon name="edit" [size]="14"></app-icon>
          </button>
          <button class="action-btn" (click)="onRefresh()" title="Refresh">
            <app-icon name="refresh" [size]="14"></app-icon>
          </button>
          <button class="action-btn danger" (click)="onRemove()" title="Remove">
            <app-icon name="x" [size]="14"></app-icon>
          </button>
        </div>
      </div>

      <!-- Widget Content -->
      <div class="widget-content">
        <!-- KPI Widget -->
        <div *ngIf="widget.type === 'kpi'" class="kpi-widget" [class]="widget.config.variant">
          <div class="kpi-loading" *ngIf="kpiLoading">
            <div class="spinner-small"></div>
          </div>
          <div class="kpi-value" *ngIf="!kpiLoading">
            {{ formatValue(kpiValue) }}{{ widget.config.suffix || '' }}
          </div>
          <div class="kpi-trend" *ngIf="widget.config.trend && !kpiLoading" [class]="widget.config.trend">
            <app-icon
              [name]="widget.config.trend === 'up' ? 'trending-up' : 'trending-down'"
              [size]="16">
            </app-icon>
            {{ widget.config.trendValue }}
          </div>
        </div>

        <!-- Chart Widget -->
        <app-chart-widget
          *ngIf="widget.type === 'chart'"
          [chartType]="widget.chartType || 'bar'"
          [config]="widget.config"
          [sql]="widget.sql"
          [chartId]="widget.chartId"
          [filters]="filters"
          (filterApply)="onChartFilter($event)">
        </app-chart-widget>
      </div>
    </div>
  `,
  styles: [`
    .widget-wrapper {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--bg-secondary);
    }

    .widget-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-3) var(--spacing-4);
      border-bottom: 1px solid var(--border-color);
      cursor: move;

      &.drag-handle {
        cursor: grab;

        &:active {
          cursor: grabbing;
        }
      }
    }

    .widget-title {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-semibold);
      color: var(--text-primary);
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .widget-actions {
      display: flex;
      gap: var(--spacing-1);
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .widget-wrapper:hover .widget-actions {
      opacity: 1;
    }

    .action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      background: var(--bg-tertiary);
      border: none;
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: var(--bg-primary);
        color: var(--text-primary);
      }

      &.danger:hover {
        background: rgba(231, 76, 60, 0.2);
        color: var(--color-danger);
      }
    }

    .widget-content {
      flex: 1;
      overflow: hidden;
      padding: var(--spacing-3);
    }

    .kpi-widget {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      text-align: center;
    }

    .kpi-value {
      font-size: 2.5rem;
      font-weight: var(--font-weight-bold);
      color: var(--text-primary);
      line-height: 1;
    }

    .kpi-trend {
      display: flex;
      align-items: center;
      gap: var(--spacing-1);
      margin-top: var(--spacing-2);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);

      &.up {
        color: var(--color-success);
      }

      &.down {
        color: var(--color-danger);
      }
    }

    .kpi-widget.success .kpi-value {
      color: var(--color-success);
    }

    .kpi-widget.warning .kpi-value {
      color: var(--color-warning);
    }

    .kpi-widget.danger .kpi-value {
      color: var(--color-danger);
    }

    .kpi-loading {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .spinner-small {
      width: 24px;
      height: 24px;
      border: 2px solid var(--border-color);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class WidgetWrapperComponent implements OnInit, OnChanges {
  private api = inject(ApiService);

  @Input() widget!: DashboardWidget;
  @Input() editMode = true;
  @Input() filters: CrossFilter[] = [];
  @Output() remove = new EventEmitter<void>();
  @Output() edit = new EventEmitter<void>();
  @Output() filterApply = new EventEmitter<CrossFilter>();

  kpiValue = 0;
  kpiLoading = false;

  ngOnInit() {
    if (this.widget.type === 'kpi') {
      this.loadKpiData();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    // Reload data when filters change
    if (changes['filters'] && !changes['filters'].firstChange) {
      if (this.widget.type === 'kpi') {
        this.loadKpiData();
      }
    }
  }

  async loadKpiData() {
    if (this.widget.sql) {
      this.kpiLoading = true;
      try {
        // Apply cross-filters to SQL
        const filteredSql = this.applyFiltersToSql(this.widget.sql);
        const response = await firstValueFrom(
          this.api.post<{ data: any[] }>('/queries/direct', { sql: filteredSql })
        );
        if (response.data && response.data.length > 0) {
          const firstRow = response.data[0];
          const valueKey = Object.keys(firstRow).find(k => k.toLowerCase() === 'value') || Object.keys(firstRow)[0];
          this.kpiValue = firstRow[valueKey] || 0;
        }
      } catch (error) {
        console.error('Failed to load KPI data:', error);
        this.kpiValue = this.widget.config.value || 0;
      } finally {
        this.kpiLoading = false;
      }
    } else {
      this.kpiValue = this.widget.config.value || 0;
    }
  }

  onChartFilter(event: { field: string; value: any }) {
    // Emit filter event to parent, excluding self from filtering
    this.filterApply.emit({
      field: event.field,
      value: event.value,
      sourceWidgetId: this.widget.id
    });
  }

  private applyFiltersToSql(sql: string): string {
    if (!this.filters || this.filters.length === 0) return sql;

    // Don't apply filters from this widget to itself
    const applicableFilters = this.filters.filter(f => f.sourceWidgetId !== this.widget.id);
    if (applicableFilters.length === 0) return sql;

    // Build WHERE clause additions
    const filterConditions = applicableFilters.map(f => {
      const value = typeof f.value === 'string' ? `'${f.value.replace(/'/g, "''")}'` : f.value;
      return `${f.field} = ${value}`;
    }).join(' AND ');

    // Inject filters into SQL
    // Check if SQL already has WHERE clause
    const upperSql = sql.toUpperCase();
    if (upperSql.includes(' WHERE ')) {
      // Add to existing WHERE
      return sql.replace(/ WHERE /i, ` WHERE (${filterConditions}) AND `);
    } else if (upperSql.includes(' GROUP BY ')) {
      // Insert before GROUP BY
      return sql.replace(/ GROUP BY /i, ` WHERE ${filterConditions} GROUP BY `);
    } else if (upperSql.includes(' ORDER BY ')) {
      // Insert before ORDER BY
      return sql.replace(/ ORDER BY /i, ` WHERE ${filterConditions} ORDER BY `);
    } else if (upperSql.includes(' LIMIT ')) {
      // Insert before LIMIT
      return sql.replace(/ LIMIT /i, ` WHERE ${filterConditions} LIMIT `);
    } else {
      // Append WHERE at end
      return `${sql} WHERE ${filterConditions}`;
    }
  }

  onRemove() {
    this.remove.emit();
  }

  onEdit() {
    this.edit.emit();
  }

  onRefresh() {
    if (this.widget.type === 'kpi') {
      this.loadKpiData();
    }
  }

  formatValue(value: number): string {
    if (value === null || value === undefined) return '0';
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
    return value.toLocaleString();
  }
}
