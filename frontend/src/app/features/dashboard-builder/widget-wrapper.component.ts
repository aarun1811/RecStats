import { Component, Input, Output, EventEmitter, inject, computed, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DashboardWidget } from './dashboard-builder.component';
import { CrossFilterService, ChartClickEvent } from '../../core/services/cross-filter.service';
import { IndicatorType } from '../../shared/components/cross-filter-indicator/cross-filter-indicator.component';

@Component({
    selector: 'app-widget-wrapper',
    template: `
    <div class="widget-wrapper" [class.cross-filter-source]="isSource()" [class.cross-filter-filtered]="isFiltered()">
      <!-- Cross-Filter Indicator -->
      <app-cross-filter-indicator
        [type]="indicatorType()"
        [valueText]="crossFilterService.filterDisplayText()"
        [sourceName]="crossFilterService.activeFilter()?.sourceChartName || ''"
        [showClear]="isSource()"
        (clear)="clearCrossFilter()">
      </app-cross-filter-indicator>

      <!-- Widget Header -->
      <div class="widget-header" [class.drag-handle]="editMode">
        <h4 class="widget-title">{{ widget.title }}</h4>
        <div class="widget-actions" *ngIf="editMode">
          <button class="action-btn refresh-btn" [class.spinning]="isRefreshing" (click)="onRefresh()" title="Refresh">
            <app-icon name="refresh" [size]="14"></app-icon>
          </button>
          <button class="action-btn danger" (click)="onRemove()" title="Remove">
            <app-icon name="trash" [size]="14"></app-icon>
          </button>
        </div>
      </div>

      <!-- Widget Content -->
      <div class="widget-content">
        <!-- Chart Widget (uses ChartPreviewComponent) -->
        <app-chart-preview
          *ngIf="widget.type === 'chart' && widget.chartId"
          [chartId]="widget.chartId"
          [widgetId]="widget.id"
          [showTitle]="false"
          [enableCrossFilter]="enableCrossFilter"
          [crossFilterColumn]="getCrossFilterColumn()"
          [crossFilterValues]="getCrossFilterValues()"
          (chartClick)="onChartClick($event)">
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
    /* ═══════════════════════════════════════════════════════════
       ANIMATIONS
    ═══════════════════════════════════════════════════════════ */
    @keyframes widgetFadeIn {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    @keyframes softBounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-6px); }
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @keyframes trashWiggle {
      0%, 100% { transform: rotate(0deg); }
      25% { transform: rotate(-12deg); }
      75% { transform: rotate(12deg); }
    }

    .widget-wrapper {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--bg-secondary);
      border-radius: var(--radius-xl);
      overflow: hidden;
      animation: widgetFadeIn 300ms ease-out;
      position: relative;
      transition: box-shadow 0.3s ease, border-color 0.3s ease;
      border: 2px solid transparent;
    }

    /* Cross-filter visual states */
    .widget-wrapper.cross-filter-source {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.15),
                  var(--shadow-md);
    }

    .widget-wrapper.cross-filter-filtered {
      border-color: var(--color-warning);
      box-shadow: 0 0 0 2px rgba(var(--color-warning-rgb), 0.1);
    }

    .widget-wrapper.cross-filter-filtered .widget-content {
      opacity: 0.85;
      transition: opacity 0.3s ease;
    }

    .widget-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-3) var(--spacing-4);
      border-bottom: 1px solid var(--border-color);
      flex-shrink: 0;
      transition: background 0.2s ease, box-shadow 0.2s ease;

      &.drag-handle {
        cursor: grab;
        position: relative;

        &::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg,
            rgba(var(--color-primary-rgb), 0) 0%,
            rgba(var(--color-primary-rgb), 0.05) 50%,
            rgba(var(--color-primary-rgb), 0) 100%);
          opacity: 0;
          transition: opacity 0.25s ease;
        }

        &:hover::before {
          opacity: 1;
        }

        &:hover {
          box-shadow: inset 0 0 20px rgba(var(--color-primary-rgb), 0.1);
        }

        &:active {
          cursor: grabbing;
          background: rgba(var(--color-primary-rgb), 0.08);
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

      app-icon {
        transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
                    filter 0.2s ease;
      }

      &:hover {
        background: var(--bg-primary);
        color: var(--text-primary);

        app-icon {
          transform: scale(1.15);
          filter: drop-shadow(0 0 4px rgba(var(--color-primary-rgb), 0.4));
        }
      }

      &:active app-icon {
        transform: scale(0.95);
      }

      /* Refresh button spin on click */
      &.refresh-btn.spinning app-icon {
        animation: spin 0.5s ease-out;
      }

      &.danger:hover {
        background: rgba(231, 76, 60, 0.2);
        color: var(--color-danger);

        app-icon {
          animation: trashWiggle 0.3s ease-in-out;
          filter: drop-shadow(0 0 4px rgba(231, 76, 60, 0.4));
        }
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
        opacity: 0.6;
        color: var(--color-primary);
        animation: softBounce 3s ease-in-out infinite;
        filter: drop-shadow(0 0 8px rgba(var(--color-primary-rgb), 0.3));
      }
    }
  `],
    standalone: false
})
export class WidgetWrapperComponent implements OnInit, OnDestroy {
  crossFilterService = inject(CrossFilterService);

  @Input() widget!: DashboardWidget;
  @Input() editMode = true;
  @Input() enableCrossFilter = true;
  @Input() widgetColumns: string[] = [];  // Columns available in this widget
  @Output() remove = new EventEmitter<void>();

  private destroy$ = new Subject<void>();

  // Track refresh state for chart preview
  private refreshKey = 0;
  isRefreshing = false;

  // Computed signals for cross-filter state
  indicatorType = computed((): IndicatorType => {
    if (this.isSource()) return 'source';
    if (this.isFiltered()) return 'filtered';
    return 'none';
  });

  ngOnInit() {
    // Register widget columns for cross-filtering
    if (this.widget && this.widgetColumns.length > 0) {
      this.crossFilterService.registerWidget(this.widget.id, this.widgetColumns);
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();

    // Unregister widget
    if (this.widget) {
      this.crossFilterService.unregisterWidget(this.widget.id);
    }
  }

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

  onRefresh() {
    // Trigger spin animation
    this.isRefreshing = true;
    setTimeout(() => this.isRefreshing = false, 500);

    // Increment refresh key to trigger reload
    this.refreshKey++;
    // For now, the components will handle their own refresh
    // We could pass refreshKey as an input to force re-fetch
  }

  // =========================================================================
  // Cross-Filter Methods
  // =========================================================================

  isSource(): boolean {
    return this.crossFilterService.isSource(this.widget?.id);
  }

  isFiltered(): boolean {
    return this.crossFilterService.isFiltered(this.widget?.id);
  }

  onChartClick(event: ChartClickEvent) {
    if (!this.enableCrossFilter) return;

    // Toggle value for multi-select behavior (Ctrl/Cmd + click)
    // For now, single click replaces the filter
    this.crossFilterService.applyFilter(event);
  }

  clearCrossFilter() {
    this.crossFilterService.clearFilter();
  }

  getCrossFilterColumn(): string | undefined {
    const filter = this.crossFilterService.activeFilter();
    if (!filter) return undefined;
    if (filter.sourceWidgetId === this.widget?.id) return filter.column;
    if (this.isFiltered()) return filter.column;
    return undefined;
  }

  getCrossFilterValues(): unknown[] | undefined {
    const filter = this.crossFilterService.activeFilter();
    if (!filter) return undefined;

    // For source widget, show selected values for highlighting
    if (filter.sourceWidgetId === this.widget?.id) {
      return filter.values.map(v => v.value);
    }

    return undefined;
  }
}
