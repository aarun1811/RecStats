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
        <!-- Chart Widget (uses ChartPreviewComponent) -->
        <app-chart-preview
          *ngIf="widget.type === 'chart' && widget.chartId"
          [chartId]="widget.chartId"
          [showTitle]="false">
        </app-chart-preview>

        <!-- Table Widget (uses TableWidgetComponent) -->
        <app-table-widget
          *ngIf="widget.type === 'table' && widget.queryId"
          [queryId]="widget.queryId">
        </app-table-widget>

        <!-- No Data State -->
        <div class="no-data-state" *ngIf="!hasValidData()">
          <app-icon [name]="widget.type === 'chart' ? 'bar-chart-2' : 'table'" [size]="32"></app-icon>
          <span>No {{ widget.type === 'chart' ? 'chart' : 'query' }} configured</span>
        </div>
      </div>
    </div>
  `,
    styles: [`
    .widget-wrapper {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--bg-secondary);
      border-radius: var(--radius-xl);
      overflow: hidden;
    }

    .widget-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-3) var(--spacing-4);
      border-bottom: 1px solid var(--border-color);
      flex-shrink: 0;

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
      display: flex;
      flex-direction: column;
    }

    app-chart-preview {
      flex: 1;
      min-height: 0;
    }

    app-table-widget {
      flex: 1;
      min-height: 0;
    }

    .no-data-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-2);
      color: var(--text-muted);
      font-size: var(--font-size-sm);
      padding: var(--spacing-4);
      text-align: center;

      app-icon {
        opacity: 0.5;
      }
    }
  `],
    standalone: false
})
export class WidgetWrapperComponent {
  @Input() widget!: DashboardWidget;
  @Input() editMode = true;
  @Output() remove = new EventEmitter<void>();
  @Output() edit = new EventEmitter<void>();

  // Track refresh state for chart preview
  private refreshKey = 0;

  hasValidData(): boolean {
    if (this.widget.type === 'chart') {
      return !!this.widget.chartId;
    }
    if (this.widget.type === 'table') {
      return !!this.widget.queryId;
    }
    return false;
  }

  onRemove() {
    this.remove.emit();
  }

  onEdit() {
    this.edit.emit();
  }

  onRefresh() {
    // Increment refresh key to trigger reload
    this.refreshKey++;
    // For now, the components will handle their own refresh
    // We could pass refreshKey as an input to force re-fetch
  }
}
