/**
 * Cross-Filter Service
 *
 * Manages cross-filtering state for dashboard interactions.
 * When a user clicks on a chart element, other charts filter
 * to show only related data.
 */

import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';

export interface CrossFilterValue {
  value: unknown;
  label: string;
}

export interface CrossFilterState {
  sourceWidgetId: string;
  sourceChartId: string;
  sourceChartName: string;
  column: string;
  values: CrossFilterValue[];
  operator: 'IN' | '=' | 'NOT IN';
}

export interface CrossFilterEvent {
  type: 'applied' | 'cleared' | 'updated';
  state: CrossFilterState | null;
  affectedWidgetIds: string[];
}

export interface ChartClickEvent {
  widgetId: string;
  chartId: string;
  chartName: string;
  dataPoint: {
    category?: string;
    series?: string;
    value?: unknown;
    name?: string;
    data?: Record<string, unknown>;
  };
  columnMapping?: {
    categoryColumn?: string;
    seriesColumn?: string;
    valueColumn?: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class CrossFilterService {
  // ============================================================================
  // State
  // ============================================================================

  private _activeFilter = signal<CrossFilterState | null>(null);
  private _widgetColumnMappings = signal<Map<string, string[]>>(new Map());

  // ============================================================================
  // Public Signals
  // ============================================================================

  readonly activeFilter = this._activeFilter.asReadonly();

  /**
   * Whether cross-filtering is currently active
   */
  readonly isActive = computed(() => this._activeFilter() !== null);

  /**
   * The source widget ID (the one being clicked)
   */
  readonly sourceWidgetId = computed(() => this._activeFilter()?.sourceWidgetId ?? null);

  /**
   * The selected values
   */
  readonly selectedValues = computed(() => this._activeFilter()?.values ?? []);

  /**
   * Get display text for the active filter
   */
  readonly filterDisplayText = computed(() => {
    const filter = this._activeFilter();
    if (!filter) return '';

    if (filter.values.length === 1) {
      return filter.values[0].label;
    }
    return `${filter.values.length} selected`;
  });

  // ============================================================================
  // Events
  // ============================================================================

  private _filterChanged = new Subject<CrossFilterEvent>();
  readonly filterChanged$ = this._filterChanged.asObservable();

  // ============================================================================
  // Widget Registration
  // ============================================================================

  /**
   * Register a widget's available columns for cross-filtering
   */
  registerWidget(widgetId: string, columns: string[]): void {
    const mappings = new Map(this._widgetColumnMappings());
    mappings.set(widgetId, columns);
    this._widgetColumnMappings.set(mappings);
  }

  /**
   * Unregister a widget
   */
  unregisterWidget(widgetId: string): void {
    const mappings = new Map(this._widgetColumnMappings());
    mappings.delete(widgetId);
    this._widgetColumnMappings.set(mappings);

    // Clear filter if this was the source
    if (this._activeFilter()?.sourceWidgetId === widgetId) {
      this.clearFilter();
    }
  }

  // ============================================================================
  // Cross-Filter Actions
  // ============================================================================

  /**
   * Apply a cross-filter from a chart click
   */
  applyFilter(event: ChartClickEvent): void {
    const column = this.determineColumn(event);
    if (!column) {
      console.warn('Could not determine column for cross-filter');
      return;
    }

    const value = this.extractValue(event, column);
    if (value === undefined || value === null) {
      console.warn('Could not extract value for cross-filter');
      return;
    }

    const label = this.formatLabel(value);

    const newState: CrossFilterState = {
      sourceWidgetId: event.widgetId,
      sourceChartId: event.chartId,
      sourceChartName: event.chartName,
      column,
      values: [{ value, label }],
      operator: '=',
    };

    this._activeFilter.set(newState);

    const affectedWidgetIds = this.getAffectedWidgets(column, event.widgetId);
    this._filterChanged.next({
      type: 'applied',
      state: newState,
      affectedWidgetIds,
    });
  }

  /**
   * Toggle a value in the cross-filter (for multi-select)
   */
  toggleValue(event: ChartClickEvent): void {
    const currentFilter = this._activeFilter();
    const column = this.determineColumn(event);
    if (!column) return;

    const value = this.extractValue(event, column);
    if (value === undefined || value === null) return;

    const label = this.formatLabel(value);

    // If no active filter or different source/column, start fresh
    if (!currentFilter ||
        currentFilter.sourceWidgetId !== event.widgetId ||
        currentFilter.column !== column) {
      this.applyFilter(event);
      return;
    }

    // Toggle the value in the existing filter
    const existingIndex = currentFilter.values.findIndex(v => v.value === value);
    let newValues: CrossFilterValue[];

    if (existingIndex >= 0) {
      // Remove the value
      newValues = currentFilter.values.filter((_, i) => i !== existingIndex);
    } else {
      // Add the value
      newValues = [...currentFilter.values, { value, label }];
    }

    // If no values left, clear the filter
    if (newValues.length === 0) {
      this.clearFilter();
      return;
    }

    const newState: CrossFilterState = {
      ...currentFilter,
      values: newValues,
      operator: newValues.length > 1 ? 'IN' : '=',
    };

    this._activeFilter.set(newState);

    const affectedWidgetIds = this.getAffectedWidgets(column, event.widgetId);
    this._filterChanged.next({
      type: 'updated',
      state: newState,
      affectedWidgetIds,
    });
  }

  /**
   * Clear the active cross-filter
   */
  clearFilter(): void {
    const currentFilter = this._activeFilter();
    if (!currentFilter) return;

    const affectedWidgetIds = this.getAffectedWidgets(
      currentFilter.column,
      currentFilter.sourceWidgetId
    );

    this._activeFilter.set(null);

    this._filterChanged.next({
      type: 'cleared',
      state: null,
      affectedWidgetIds,
    });
  }

  // ============================================================================
  // Query Methods
  // ============================================================================

  /**
   * Check if a widget is the cross-filter source
   */
  isSource(widgetId: string): boolean {
    return this._activeFilter()?.sourceWidgetId === widgetId;
  }

  /**
   * Check if a widget is affected by the cross-filter
   */
  isFiltered(widgetId: string): boolean {
    const filter = this._activeFilter();
    if (!filter) return false;
    if (filter.sourceWidgetId === widgetId) return false;

    const columns = this._widgetColumnMappings().get(widgetId);
    return columns?.includes(filter.column) ?? false;
  }

  /**
   * Check if a specific value is selected in the cross-filter
   */
  isValueSelected(value: unknown): boolean {
    const filter = this._activeFilter();
    if (!filter) return false;
    return filter.values.some(v => v.value === value);
  }

  /**
   * Get the filter condition for a widget (for query building)
   */
  getFilterCondition(widgetId: string): { column: string; operator: string; values: unknown[] } | null {
    const filter = this._activeFilter();
    if (!filter) return null;
    if (filter.sourceWidgetId === widgetId) return null;

    const columns = this._widgetColumnMappings().get(widgetId);
    if (!columns?.includes(filter.column)) return null;

    return {
      column: filter.column,
      operator: filter.operator,
      values: filter.values.map(v => v.value),
    };
  }

  /**
   * Get all widgets affected by the current filter
   */
  getAffectedWidgets(column: string, excludeWidgetId?: string): string[] {
    const affected: string[] = [];
    const mappings = this._widgetColumnMappings();

    mappings.forEach((columns, widgetId) => {
      if (widgetId !== excludeWidgetId && columns.includes(column)) {
        affected.push(widgetId);
      }
    });

    return affected;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private determineColumn(event: ChartClickEvent): string | null {
    // Use explicit column mapping if provided
    if (event.columnMapping?.categoryColumn) {
      return event.columnMapping.categoryColumn;
    }

    // Try to infer from data point
    if (event.dataPoint.data) {
      // Use the first non-numeric column as the filter column
      for (const [key, val] of Object.entries(event.dataPoint.data)) {
        if (typeof val === 'string') {
          return key;
        }
      }
    }

    // Fall back to category or name
    if (event.dataPoint.category) return 'category';
    if (event.dataPoint.name) return 'name';

    return null;
  }

  private extractValue(event: ChartClickEvent, column: string): unknown {
    // Check explicit data first
    if (event.dataPoint.data && column in event.dataPoint.data) {
      return event.dataPoint.data[column];
    }

    // Fall back to common properties
    if (column === 'category' && event.dataPoint.category) {
      return event.dataPoint.category;
    }
    if (column === 'name' && event.dataPoint.name) {
      return event.dataPoint.name;
    }

    // Try category or name as fallback
    return event.dataPoint.category ?? event.dataPoint.name;
  }

  private formatLabel(value: unknown): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return value.toLocaleString();
    if (value instanceof Date) return value.toLocaleDateString();
    return String(value);
  }

  // ============================================================================
  // Reset
  // ============================================================================

  /**
   * Reset all state (e.g., when leaving dashboard)
   */
  reset(): void {
    this._activeFilter.set(null);
    this._widgetColumnMappings.set(new Map());
  }
}
