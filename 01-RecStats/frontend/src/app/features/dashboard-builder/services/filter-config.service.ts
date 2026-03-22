/**
 * Filter Config Service
 *
 * Handles API communication for dashboard filter CRUD operations.
 */

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import {
  DashboardFilter,
  FilterCreate,
  FilterUpdate,
  FilterChartMapping,
  FilterChartMappingCreate,
  FilterChartMappingUpdate,
  FilterValuesRequest,
  FilterValuesResponse,
  FilterOption,
  ChartColumn,
  ActiveFilter,
  FilteredChartDataResponse,
  ReorderFiltersRequest,
} from '../filters/models/filter.models';

// API response interfaces (snake_case from backend)
interface FilterResponseApi {
  id: string;
  dashboard_id: string;
  name: string;
  filter_type: string;
  values_query?: string;
  static_options?: FilterOption[];
  data_source_id?: string;
  default_value?: unknown;
  placeholder?: string;
  required: boolean;
  display_order: number;
  min_value?: string;
  max_value?: string;
  chart_mappings: FilterChartMappingApi[];
  created_at: string;
  updated_at: string;
}

interface FilterChartMappingApi {
  id: string;
  filter_id: string;
  chart_id: string;
  chart_name?: string;
  column_name: string;
  operator: string;
  enabled: boolean;
}

interface FilterValuesResponseApi {
  filter_id?: string;
  options: FilterOption[];
  execution_time_ms: number;
}

interface FilteredChartDataResponseApi {
  chart_id: string;
  data: Record<string, unknown>[];
  columns: { name: string; type: string }[];
  applied_filters: ActiveFilter[];
  execution_time_ms: number;
}

@Injectable({
  providedIn: 'root'
})
export class FilterConfigService {
  private api = inject(ApiService);

  // ============================================================================
  // Transform Functions (snake_case -> camelCase)
  // ============================================================================

  private transformFilter(api: FilterResponseApi): DashboardFilter {
    return {
      id: api.id,
      dashboardId: api.dashboard_id,
      name: api.name,
      filterType: api.filter_type as DashboardFilter['filterType'],
      valuesQuery: api.values_query,
      staticOptions: api.static_options,
      dataSourceId: api.data_source_id,
      defaultValue: api.default_value,
      placeholder: api.placeholder,
      required: api.required,
      displayOrder: api.display_order,
      minValue: api.min_value,
      maxValue: api.max_value,
      chartMappings: (api.chart_mappings || []).map(m => this.transformMapping(m)),
      createdAt: api.created_at,
      updatedAt: api.updated_at,
    };
  }

  private transformMapping(api: FilterChartMappingApi): FilterChartMapping {
    return {
      id: api.id,
      filterId: api.filter_id,
      chartId: api.chart_id,
      chartName: api.chart_name,
      columnName: api.column_name,
      operator: api.operator as FilterChartMapping['operator'],
      enabled: api.enabled,
    };
  }

  private transformFilterCreate(data: FilterCreate): Record<string, unknown> {
    return {
      dashboard_id: data.dashboardId,
      name: data.name,
      filter_type: data.filterType,
      values_query: data.valuesQuery,
      static_options: data.staticOptions,
      data_source_id: data.dataSourceId,
      default_value: data.defaultValue,
      placeholder: data.placeholder,
      required: data.required ?? false,
      display_order: data.displayOrder ?? 0,
      min_value: data.minValue,
      max_value: data.maxValue,
      chart_mappings: data.chartMappings?.map(m => ({
        chart_id: m.chartId,
        column_name: m.columnName,
        operator: m.operator ?? '=',
        enabled: m.enabled ?? true,
      })),
    };
  }

  private transformFilterUpdate(data: FilterUpdate): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if (data.name !== undefined) result['name'] = data.name;
    if (data.filterType !== undefined) result['filter_type'] = data.filterType;
    if (data.valuesQuery !== undefined) result['values_query'] = data.valuesQuery;
    if (data.staticOptions !== undefined) result['static_options'] = data.staticOptions;
    if (data.dataSourceId !== undefined) result['data_source_id'] = data.dataSourceId;
    if (data.defaultValue !== undefined) result['default_value'] = data.defaultValue;
    if (data.placeholder !== undefined) result['placeholder'] = data.placeholder;
    if (data.required !== undefined) result['required'] = data.required;
    if (data.displayOrder !== undefined) result['display_order'] = data.displayOrder;
    if (data.minValue !== undefined) result['min_value'] = data.minValue;
    if (data.maxValue !== undefined) result['max_value'] = data.maxValue;

    return result;
  }

  // ============================================================================
  // Filter CRUD Operations
  // ============================================================================

  /**
   * Get all filters for a dashboard
   */
  getFilters(dashboardId: string): Observable<DashboardFilter[]> {
    return this.api.get<FilterResponseApi[]>(`/dashboards/${dashboardId}/filters`).pipe(
      map(filters => filters.map(f => this.transformFilter(f)))
    );
  }

  /**
   * Get a single filter by ID
   */
  getFilter(filterId: string): Observable<DashboardFilter> {
    return this.api.get<FilterResponseApi>(`/filters/${filterId}`).pipe(
      map(f => this.transformFilter(f))
    );
  }

  /**
   * Create a new filter
   */
  createFilter(data: FilterCreate): Observable<DashboardFilter> {
    return this.api.post<FilterResponseApi>('/filters', this.transformFilterCreate(data)).pipe(
      map(f => this.transformFilter(f))
    );
  }

  /**
   * Update an existing filter
   */
  updateFilter(filterId: string, data: FilterUpdate): Observable<DashboardFilter> {
    return this.api.put<FilterResponseApi>(`/filters/${filterId}`, this.transformFilterUpdate(data)).pipe(
      map(f => this.transformFilter(f))
    );
  }

  /**
   * Delete a filter
   */
  deleteFilter(filterId: string): Observable<void> {
    return this.api.delete<void>(`/filters/${filterId}`);
  }

  /**
   * Reorder filters for a dashboard
   */
  reorderFilters(dashboardId: string, filterIds: string[]): Observable<void> {
    return this.api.put<void>(`/dashboards/${dashboardId}/filters/reorder`, {
      filter_ids: filterIds,
    });
  }

  // ============================================================================
  // Filter Values
  // ============================================================================

  /**
   * Get filter values (execute values query or return static options)
   */
  getFilterValues(filterId: string): Observable<FilterValuesResponse> {
    return this.api.get<FilterValuesResponseApi>(`/filters/${filterId}/values`).pipe(
      map(r => ({
        filterId: r.filter_id,
        options: r.options,
        executionTimeMs: r.execution_time_ms,
      }))
    );
  }

  /**
   * Preview filter values with an ad-hoc query
   */
  previewFilterValues(query: string, dataSourceId?: string, limit?: number): Observable<FilterValuesResponse> {
    return this.api.post<FilterValuesResponseApi>('/filters/values/preview', {
      values_query: query,
      data_source_id: dataSourceId,
      limit: limit ?? 1000,
    }).pipe(
      map(r => ({
        filterId: r.filter_id,
        options: r.options,
        executionTimeMs: r.execution_time_ms,
      }))
    );
  }

  // ============================================================================
  // Chart Mappings
  // ============================================================================

  /**
   * Get all chart mappings for a filter
   */
  getFilterMappings(filterId: string): Observable<FilterChartMapping[]> {
    return this.api.get<FilterChartMappingApi[]>(`/filters/${filterId}/mappings`).pipe(
      map(mappings => mappings.map(m => this.transformMapping(m)))
    );
  }

  /**
   * Add a chart mapping to a filter
   */
  addChartMapping(filterId: string, data: FilterChartMappingCreate): Observable<FilterChartMapping> {
    return this.api.post<FilterChartMappingApi>(`/filters/${filterId}/mappings`, {
      chart_id: data.chartId,
      column_name: data.columnName,
      operator: data.operator ?? '=',
      enabled: data.enabled ?? true,
    }).pipe(
      map(m => this.transformMapping(m))
    );
  }

  /**
   * Update a chart mapping
   */
  updateChartMapping(filterId: string, mappingId: string, data: FilterChartMappingUpdate): Observable<FilterChartMapping> {
    const body: Record<string, unknown> = {};
    if (data.columnName !== undefined) body['column_name'] = data.columnName;
    if (data.operator !== undefined) body['operator'] = data.operator;
    if (data.enabled !== undefined) body['enabled'] = data.enabled;

    return this.api.put<FilterChartMappingApi>(`/filters/${filterId}/mappings/${mappingId}`, body).pipe(
      map(m => this.transformMapping(m))
    );
  }

  /**
   * Remove a chart mapping
   */
  removeChartMapping(filterId: string, mappingId: string): Observable<void> {
    return this.api.delete<void>(`/filters/${filterId}/mappings/${mappingId}`);
  }

  // ============================================================================
  // Chart Columns (for mapping configuration)
  // ============================================================================

  /**
   * Get available columns from a chart's query
   */
  getChartColumns(chartId: string): Observable<ChartColumn[]> {
    return this.api.get<{ name: string; type: string }[]>(`/charts/${chartId}/columns`);
  }

  // ============================================================================
  // Filtered Chart Data
  // ============================================================================

  /**
   * Get chart data with filters applied
   */
  getFilteredChartData(chartId: string, filters: ActiveFilter[]): Observable<FilteredChartDataResponse> {
    return this.api.post<FilteredChartDataResponseApi>(`/charts/${chartId}/data/filtered`, filters).pipe(
      map(r => ({
        chartId: r.chart_id,
        data: r.data,
        columns: r.columns,
        appliedFilters: r.applied_filters,
        executionTimeMs: r.execution_time_ms,
      }))
    );
  }
}
