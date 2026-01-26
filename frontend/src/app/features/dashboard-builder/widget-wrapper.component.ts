import { Component, Input, Output, EventEmitter } from '@angular/core';
import { DashboardWidget } from './dashboard-builder.component';

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
        <div *ngIf="widget.type === 'kpi'" class="kpi-widget">
          <div class="kpi-value">
            {{ formatValue(widget.config.value) }}{{ widget.config.suffix || '' }}
          </div>
          <div class="kpi-trend" *ngIf="widget.config.trend" [class]="widget.config.trend">
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
          [config]="widget.config">
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
  `]
})
export class WidgetWrapperComponent {
  @Input() widget!: DashboardWidget;
  @Input() editMode = true;
  @Output() remove = new EventEmitter<void>();
  @Output() edit = new EventEmitter<void>();

  onRemove() {
    this.remove.emit();
  }

  onEdit() {
    this.edit.emit();
  }

  onRefresh() {
    // TODO: Refresh widget data
  }

  formatValue(value: number): string {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
    return value.toLocaleString();
  }
}
