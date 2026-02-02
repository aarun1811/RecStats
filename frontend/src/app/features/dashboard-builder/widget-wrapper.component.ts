import { Component, Input, Output, EventEmitter, inject, computed, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { DashboardWidget } from './dashboard-builder.component';
import { CrossFilterService, ChartClickEvent } from '../../core/services/cross-filter.service';
import { IndicatorType } from '../../shared/components/cross-filter-indicator/cross-filter-indicator.component';

@Component({
  selector: 'app-widget-wrapper',
  template: `
    <div class="widget-wrapper"
         [class.glass-style]="useGlassStyle"
         [class.cross-filter-source]="isSource()"
         [class.cross-filter-filtered]="isFiltered()">

      <!-- Cross-Filter Indicator -->
      <app-cross-filter-indicator
        [type]="indicatorType()"
        [valueText]="crossFilterService.filterDisplayText()"
        [sourceName]="crossFilterService.activeFilter()?.sourceChartName || ''"
        [showClear]="isSource()"
        (clear)="clearCrossFilter()">
      </app-cross-filter-indicator>

      <!-- Integrated Header (title inside content area) -->
      <div class="widget-integrated-header" [class.drag-handle]="editMode">
        <h4 class="widget-title">{{ widget.title }}</h4>

        <!-- Floating Action Buttons (appear on hover) -->
        <div class="widget-floating-actions" *ngIf="editMode">
          <button class="floating-action-btn refresh-btn"
                  [class.spinning]="isRefreshing"
                  (click)="onRefresh($event)"
                  title="Refresh">
            <app-icon name="refresh-cw" [size]="14"></app-icon>
          </button>
          <button class="floating-action-btn delete-btn"
                  (click)="onRemove($event)"
                  title="Remove">
            <app-icon name="trash-2" [size]="14"></app-icon>
          </button>
        </div>

        <!-- Drag Handle Indicator -->
        <div class="drag-indicator" *ngIf="editMode">
          <span class="drag-dots">⋮⋮</span>
        </div>
      </div>

      <!-- Widget Content -->
      <div class="widget-content">
        <!-- Chart Widget -->
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

        <!-- Table Widget -->
        <app-table-widget
          *ngIf="widget.type === 'table' && widget.queryId"
          [queryId]="widget.queryId">
        </app-table-widget>

        <!-- No Data State -->
        <div class="no-data-state" *ngIf="!hasValidData()">
          <div class="empty-icon-container">
            <app-icon [name]="getEmptyIcon()" [size]="32"></app-icon>
          </div>
          <span>No {{ getWidgetTypeLabel() }} configured</span>
        </div>
      </div>

      <!-- Gradient Border Overlay (for glass effect) -->
      <div class="gradient-border-overlay" *ngIf="useGlassStyle"></div>
    </div>
  `,
  styles: [`
    /* ═══════════════════════════════════════════════════════════
       ANIMATIONS
    ═══════════════════════════════════════════════════════════ */
    @keyframes widgetFadeIn {
      from {
        opacity: 0;
        transform: scale(0.96) translateY(8px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
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

    @keyframes gradientShimmer {
      0% { background-position: 200% 50%; }
      100% { background-position: -200% 50%; }
    }

    @keyframes pulseGlow {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 1; }
    }

    /* ═══════════════════════════════════════════════════════════
       WIDGET WRAPPER - LIQUID GLASS STYLE
    ═══════════════════════════════════════════════════════════ */
    :host {
      display: block;
      height: 100%;
    }

    .widget-wrapper {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--bg-secondary);
      border-radius: var(--radius-xl);
      overflow: hidden;
      animation: widgetFadeIn 400ms cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      border: 1px solid var(--border-color);
    }

    /* Liquid Glass Effect */
    .widget-wrapper.glass-style {
      background: var(--glass-widget-bg);
      backdrop-filter: blur(var(--glass-blur));
      -webkit-backdrop-filter: blur(var(--glass-blur));
      border: 1px solid var(--glass-widget-border);
      box-shadow: var(--glass-widget-shadow);

      /* Fallback for browsers without backdrop-filter */
      @supports not (backdrop-filter: blur(1px)) {
        background: var(--glass-widget-bg-solid);
      }

      &:hover {
        border-color: var(--glass-widget-border-hover);
        box-shadow: var(--glass-widget-shadow-hover);
        transform: translateY(-2px);
      }
    }

    /* Gradient Border Overlay */
    .gradient-border-overlay {
      position: absolute;
      inset: 0;
      border-radius: inherit;
      padding: 1px;
      background: linear-gradient(135deg,
        rgba(var(--color-primary-rgb), 0.3) 0%,
        rgba(255, 255, 255, 0.08) 25%,
        rgba(var(--color-primary-rgb), 0.12) 50%,
        rgba(255, 255, 255, 0.05) 75%,
        rgba(var(--color-primary-rgb), 0.2) 100%);
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
      opacity: 0.6;
      transition: opacity 0.3s ease;
    }

    .widget-wrapper:hover .gradient-border-overlay {
      opacity: 1;
    }

    /* Cross-filter visual states */
    .widget-wrapper.cross-filter-source {
      border-color: var(--color-primary) !important;
      box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.2),
                  0 8px 32px rgba(0, 0, 0, 0.3) !important;
    }

    .widget-wrapper.cross-filter-source .gradient-border-overlay {
      background: linear-gradient(135deg,
        rgba(var(--color-primary-rgb), 0.6) 0%,
        rgba(var(--color-primary-rgb), 0.2) 50%,
        rgba(var(--color-primary-rgb), 0.5) 100%);
      opacity: 1;
      animation: pulseGlow 2s ease-in-out infinite;
    }

    .widget-wrapper.cross-filter-filtered {
      border-color: var(--color-warning) !important;
      box-shadow: 0 0 0 2px rgba(var(--color-warning-rgb), 0.15);
    }

    .widget-wrapper.cross-filter-filtered .widget-content {
      opacity: 0.9;
      transition: opacity 0.3s ease;
    }

    /* ═══════════════════════════════════════════════════════════
       INTEGRATED HEADER
    ═══════════════════════════════════════════════════════════ */
    .widget-integrated-header {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      z-index: 10;
      padding: var(--spacing-3) var(--spacing-4);
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--glass-drag-handle-bg);
      pointer-events: none;
      transition: background 0.2s ease;
    }

    .widget-title {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-semibold);
      color: var(--text-primary);
      margin: 0;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
      pointer-events: auto;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: calc(100% - 80px);
    }

    /* Drag Handle Behavior */
    .widget-integrated-header.drag-handle {
      cursor: grab;
      pointer-events: auto;

      &:active {
        cursor: grabbing;
        background: linear-gradient(180deg,
          rgba(var(--color-primary-rgb), 0.15) 0%,
          rgba(var(--color-primary-rgb), 0.05) 60%,
          transparent 100%);
      }
    }

    /* Drag Indicator (grip dots) */
    .drag-indicator {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
    }

    .drag-dots {
      font-size: 14px;
      color: transparent;
      letter-spacing: -3px;
      transition: color 0.25s ease;
    }

    .widget-wrapper:hover .drag-dots {
      color: rgba(var(--color-primary-rgb), 0.4);
    }

    .widget-integrated-header.drag-handle:active .drag-dots {
      color: rgba(var(--color-primary-rgb), 0.7);
    }

    /* ═══════════════════════════════════════════════════════════
       FLOATING ACTION BUTTONS
    ═══════════════════════════════════════════════════════════ */
    .widget-floating-actions {
      display: flex;
      gap: var(--spacing-1);
      opacity: 0;
      transform: translateY(-4px) scale(0.95);
      transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      pointer-events: auto;
    }

    .widget-wrapper:hover .widget-floating-actions {
      opacity: 1;
      transform: translateY(0) scale(1);
    }

    .floating-action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      background: rgba(22, 27, 34, 0.9);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: var(--radius-md);
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);

      app-icon {
        transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
                    filter 0.2s ease;
      }

      &:hover {
        background: rgba(var(--color-primary-rgb), 0.2);
        border-color: rgba(var(--color-primary-rgb), 0.4);
        color: var(--color-primary-light);
        transform: scale(1.1);
        box-shadow: 0 4px 12px rgba(var(--color-primary-rgb), 0.25);

        app-icon {
          transform: scale(1.1);
          filter: drop-shadow(0 0 4px rgba(var(--color-primary-rgb), 0.5));
        }
      }

      &:active {
        transform: scale(0.95);
      }
    }

    .refresh-btn.spinning app-icon {
      animation: spin 0.6s ease-out;
    }

    .delete-btn:hover {
      background: rgba(var(--color-danger-rgb), 0.2) !important;
      border-color: var(--color-danger) !important;
      color: var(--color-danger) !important;
      box-shadow: 0 4px 12px rgba(var(--color-danger-rgb), 0.25) !important;

      app-icon {
        animation: trashWiggle 0.35s ease-in-out;
        filter: drop-shadow(0 0 4px rgba(var(--color-danger-rgb), 0.5)) !important;
      }
    }

    /* ═══════════════════════════════════════════════════════════
       WIDGET CONTENT
    ═══════════════════════════════════════════════════════════ */
    .widget-content {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      padding-top: var(--spacing-10); /* Space for integrated header */
      min-height: 0;
    }

    app-chart-preview,
    app-table-widget {
      flex: 1;
      min-height: 0;
    }

    /* ═══════════════════════════════════════════════════════════
       EMPTY STATE
    ═══════════════════════════════════════════════════════════ */
    .no-data-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-3);
      color: var(--text-muted);
      font-size: var(--font-size-sm);
      padding: var(--spacing-4);
      text-align: center;
    }

    .empty-icon-container {
      width: 56px;
      height: 56px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg,
        rgba(var(--color-primary-rgb), 0.15) 0%,
        rgba(var(--color-primary-rgb), 0.05) 100%);
      border-radius: var(--radius-lg);
      animation: softBounce 3s ease-in-out infinite;

      app-icon {
        color: var(--color-primary);
        filter: drop-shadow(0 0 8px rgba(var(--color-primary-rgb), 0.4));
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
  @Input() widgetColumns: string[] = [];
  @Input() useGlassStyle = true; // Enable liquid glass by default
  @Output() remove = new EventEmitter<void>();

  private destroy$ = new Subject<void>();

  private refreshKey = 0;
  isRefreshing = false;

  indicatorType = computed((): IndicatorType => {
    if (this.isSource()) return 'source';
    if (this.isFiltered()) return 'filtered';
    return 'none';
  });

  ngOnInit() {
    if (this.widget && this.widgetColumns.length > 0) {
      this.crossFilterService.registerWidget(this.widget.id, this.widgetColumns);
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();

    if (this.widget) {
      this.crossFilterService.unregisterWidget(this.widget.id);
    }
  }

  hasValidData(): boolean {
    if (this.widget.type === 'chart') return !!this.widget.chartId;
    if (this.widget.type === 'table') return !!this.widget.queryId;
    return false;
  }

  getEmptyIcon(): string {
    const icons: Record<string, string> = {
      chart: 'bar-chart-2',
      table: 'table'
    };
    return icons[this.widget.type] || 'layout';
  }

  getWidgetTypeLabel(): string {
    const labels: Record<string, string> = {
      chart: 'chart',
      table: 'query'
    };
    return labels[this.widget.type] || 'data';
  }

  onRemove(event: Event) {
    event.stopPropagation();
    this.remove.emit();
  }

  onRefresh(event: Event) {
    event.stopPropagation();
    this.isRefreshing = true;
    setTimeout(() => this.isRefreshing = false, 600);
    this.refreshKey++;
  }

  // Cross-Filter Methods
  isSource(): boolean {
    return this.crossFilterService.isSource(this.widget?.id);
  }

  isFiltered(): boolean {
    return this.crossFilterService.isFiltered(this.widget?.id);
  }

  onChartClick(event: ChartClickEvent) {
    if (!this.enableCrossFilter) return;
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
    if (filter.sourceWidgetId === this.widget?.id) {
      return filter.values.map(v => v.value);
    }
    return undefined;
  }
}
