/**
 * Filter State Service
 *
 * Manages the runtime state of dashboard filters using Angular Signals.
 * Provides reactive updates to all subscribed components when filters change.
 */

import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';
import {
  DashboardFilter,
  FilterState,
  FilterChangeEvent,
  WhereCondition,
  FilterOperator,
  ActiveFilter,
} from '../filters/models/filter.models';

@Injectable({
  providedIn: 'root'
})
export class FilterStateService {
  // ============================================================================
  // Core State (Signals)
  // ============================================================================

  private _dashboardId = signal<string | null>(null);
  private _filters = signal<DashboardFilter[]>([]);
  private _filterStates = signal<Map<string, FilterState>>(new Map());
  private _isLoading = signal(false);

  // ============================================================================
  // Public Readonly Signals
  // ============================================================================

  readonly dashboardId = this._dashboardId.asReadonly();
  readonly filters = this._filters.asReadonly();
  readonly filterStates = this._filterStates.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();

  // ============================================================================
  // Computed Signals
  // ============================================================================

  /**
   * Get filters that have active values (non-null, non-empty)
   */
  readonly activeFilters = computed(() => {
    const states = this._filterStates();
    return this._filters().filter(f => {
      const state = states.get(f.id);
      return state && this.hasValue(state.value);
    });
  });

  /**
   * Check if any filters are currently active
   */
  readonly hasActiveFilters = computed(() => this.activeFilters().length > 0);

  /**
   * Get count of active filters
   */
  readonly activeFilterCount = computed(() => this.activeFilters().length);

  // ============================================================================
  // Event Emitter
  // ============================================================================

  private _filterChanged = new Subject<FilterChangeEvent>();
  readonly filterChanged$ = this._filterChanged.asObservable();

  // ============================================================================
  // Initialization Methods
  // ============================================================================

  /**
   * Initialize filters for a dashboard
   */
  setFilters(dashboardId: string, filters: DashboardFilter[]): void {
    this._dashboardId.set(dashboardId);
    this._filters.set(filters);

    // Initialize filter states with default values
    const states = new Map<string, FilterState>();
    filters.forEach(filter => {
      states.set(filter.id, {
        filterId: filter.id,
        value: filter.defaultValue ?? null,
        operator: this.getDefaultOperator(filter.filterType),
      });
    });
    this._filterStates.set(states);
  }

  /**
   * Add a single filter
   */
  addFilter(filter: DashboardFilter): void {
    this._filters.update(filters => [...filters, filter]);

    // Initialize state for the new filter
    const states = new Map(this._filterStates());
    states.set(filter.id, {
      filterId: filter.id,
      value: filter.defaultValue ?? null,
      operator: this.getDefaultOperator(filter.filterType),
    });
    this._filterStates.set(states);
  }

  /**
   * Update an existing filter's configuration
   */
  updateFilter(filter: DashboardFilter): void {
    this._filters.update(filters =>
      filters.map(f => f.id === filter.id ? filter : f)
    );
  }

  /**
   * Remove a filter
   */
  removeFilter(filterId: string): void {
    this._filters.update(filters => filters.filter(f => f.id !== filterId));

    const states = new Map(this._filterStates());
    states.delete(filterId);
    this._filterStates.set(states);
  }

  /**
   * Clear all state
   */
  reset(): void {
    this._dashboardId.set(null);
    this._filters.set([]);
    this._filterStates.set(new Map());
  }

  // ============================================================================
  // Filter Value Methods
  // ============================================================================

  /**
   * Set a filter's current value
   */
  setFilterValue(filterId: string, value: unknown, operator?: FilterOperator): void {
    const states = new Map(this._filterStates());
    const existingState = states.get(filterId);

    states.set(filterId, {
      filterId,
      value,
      operator: operator ?? existingState?.operator ?? '=',
    });
    this._filterStates.set(states);

    // Emit change event
    const filter = this._filters().find(f => f.id === filterId);
    if (filter) {
      const affectedChartIds = filter.chartMappings
        .filter(m => m.enabled)
        .map(m => m.chartId);

      this._filterChanged.next({
        filterId,
        value,
        affectedChartIds,
      });
    }
  }

  /**
   * Get current value for a filter
   */
  getFilterValue(filterId: string): unknown {
    return this._filterStates().get(filterId)?.value;
  }

  /**
   * Get full state for a filter
   */
  getFilterState(filterId: string): FilterState | undefined {
    return this._filterStates().get(filterId);
  }

  /**
   * Reset all filters to their default values
   */
  resetFilters(): void {
    const states = new Map<string, FilterState>();
    this._filters().forEach(filter => {
      states.set(filter.id, {
        filterId: filter.id,
        value: filter.defaultValue ?? null,
        operator: this.getDefaultOperator(filter.filterType),
      });
    });
    this._filterStates.set(states);

    // Emit change for all filters
    this._filters().forEach(filter => {
      const affectedChartIds = filter.chartMappings
        .filter(m => m.enabled)
        .map(m => m.chartId);

      this._filterChanged.next({
        filterId: filter.id,
        value: filter.defaultValue ?? null,
        affectedChartIds,
      });
    });
  }

  /**
   * Clear all filter values (set to null)
   */
  clearFilters(): void {
    const states = new Map<string, FilterState>();
    this._filters().forEach(filter => {
      states.set(filter.id, {
        filterId: filter.id,
        value: null,
        operator: this.getDefaultOperator(filter.filterType),
      });
    });
    this._filterStates.set(states);

    // Emit change for all filters
    this._filters().forEach(filter => {
      const affectedChartIds = filter.chartMappings
        .filter(m => m.enabled)
        .map(m => m.chartId);

      this._filterChanged.next({
        filterId: filter.id,
        value: null,
        affectedChartIds,
      });
    });
  }

  // ============================================================================
  // Query Building Methods
  // ============================================================================

  /**
   * Get filters applicable to a specific chart
   */
  getFiltersForChart(chartId: string): DashboardFilter[] {
    return this._filters().filter(f =>
      f.chartMappings.some(m => m.chartId === chartId && m.enabled)
    );
  }

  /**
   * Build WHERE conditions for a specific chart
   */
  buildWhereConditions(chartId: string): WhereCondition[] {
    const conditions: WhereCondition[] = [];
    const states = this._filterStates();

    this._filters().forEach(filter => {
      const mapping = filter.chartMappings.find(
        m => m.chartId === chartId && m.enabled
      );
      if (!mapping) return;

      const state = states.get(filter.id);
      if (!state || !this.hasValue(state.value)) return;

      conditions.push({
        column: mapping.columnName,
        operator: mapping.operator,
        value: state.value,
      });
    });

    return conditions;
  }

  /**
   * Build ActiveFilter array for a chart (for API requests)
   */
  buildActiveFilters(chartId: string): ActiveFilter[] {
    return this.buildWhereConditions(chartId).map(c => ({
      column: c.column,
      operator: c.operator,
      value: c.value,
    }));
  }

  /**
   * Build SQL WHERE clause string for a chart (for debugging/display)
   */
  buildWhereClause(chartId: string): string {
    const conditions = this.buildWhereConditions(chartId);
    if (conditions.length === 0) return '';

    const clauses = conditions.map(c => {
      const value = this.formatSqlValue(c.value, c.operator);
      return `${c.column} ${c.operator} ${value}`;
    });

    return `WHERE ${clauses.join(' AND ')}`;
  }

  /**
   * Check if a chart is affected by any active filters
   */
  isChartFiltered(chartId: string): boolean {
    return this.buildWhereConditions(chartId).length > 0;
  }

  /**
   * Get all chart IDs affected by current filter state
   */
  getAffectedChartIds(): string[] {
    const chartIds = new Set<string>();
    const states = this._filterStates();

    this._filters().forEach(filter => {
      const state = states.get(filter.id);
      if (state && this.hasValue(state.value)) {
        filter.chartMappings
          .filter(m => m.enabled)
          .forEach(m => chartIds.add(m.chartId));
      }
    });

    return Array.from(chartIds);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getDefaultOperator(filterType: string): FilterOperator {
    switch (filterType) {
      case 'multi-select':
        return 'IN';
      case 'range':
      case 'date-range':
        return 'BETWEEN';
      case 'text':
        return 'LIKE';
      default:
        return '=';
    }
  }

  private hasValue(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (value === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  }

  private formatSqlValue(value: unknown, operator: FilterOperator): string {
    if (operator === 'IN' || operator === 'NOT IN') {
      const values = Array.isArray(value) ? value : [value];
      return `(${values.map(v => typeof v === 'string' ? `'${v}'` : v).join(', ')})`;
    }

    if (operator === 'BETWEEN' && Array.isArray(value) && value.length === 2) {
      const [min, max] = value;
      const minStr = typeof min === 'string' ? `'${min}'` : min;
      const maxStr = typeof max === 'string' ? `'${max}'` : max;
      return `${minStr} AND ${maxStr}`;
    }

    if (operator === 'LIKE' || operator === 'CONTAINS') {
      return `'%${value}%'`;
    }

    return typeof value === 'string' ? `'${value}'` : String(value);
  }

  // ============================================================================
  // Loading State
  // ============================================================================

  setLoading(loading: boolean): void {
    this._isLoading.set(loading);
  }
}
