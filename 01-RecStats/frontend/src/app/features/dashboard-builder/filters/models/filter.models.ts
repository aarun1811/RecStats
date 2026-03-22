/**
 * Dashboard Filter Models
 *
 * TypeScript interfaces and types for the dashboard filtering system.
 */

// ============================================================================
// Filter Type Enums
// ============================================================================

export type FilterType = 'select' | 'multi-select' | 'range' | 'date-range' | 'text';

export type FilterOperator =
  | '='
  | '!='
  | '>'
  | '<'
  | '>='
  | '<='
  | 'IN'
  | 'NOT IN'
  | 'BETWEEN'
  | 'LIKE'
  | 'CONTAINS';

// ============================================================================
// Filter Option
// ============================================================================

export interface FilterOption {
  value: string | number;
  label: string;
  count?: number;
}

// ============================================================================
// Filter Chart Mapping
// ============================================================================

export interface FilterChartMapping {
  id: string;
  filterId: string;
  chartId: string;
  chartName?: string;
  columnName: string;
  operator: FilterOperator;
  enabled: boolean;
}

export interface FilterChartMappingCreate {
  chartId: string;
  columnName: string;
  operator?: FilterOperator;
  enabled?: boolean;
}

export interface FilterChartMappingUpdate {
  columnName?: string;
  operator?: FilterOperator;
  enabled?: boolean;
}

// ============================================================================
// Dashboard Filter
// ============================================================================

export interface DashboardFilter {
  id: string;
  dashboardId: string;
  name: string;
  filterType: FilterType;

  // Values source - either a SQL query or static options
  valuesQuery?: string;
  staticOptions?: FilterOption[];
  dataSourceId?: string;

  // Configuration
  defaultValue?: unknown;
  placeholder?: string;
  required: boolean;
  displayOrder: number;

  // Range/Date specific constraints
  minValue?: string;
  maxValue?: string;

  // Chart mappings
  chartMappings: FilterChartMapping[];

  createdAt: string;
  updatedAt: string;
}

export interface FilterCreate {
  dashboardId: string;
  name: string;
  filterType: FilterType;
  valuesQuery?: string;
  staticOptions?: FilterOption[];
  dataSourceId?: string;
  defaultValue?: unknown;
  placeholder?: string;
  required?: boolean;
  displayOrder?: number;
  minValue?: string;
  maxValue?: string;
  chartMappings?: FilterChartMappingCreate[];
}

export interface FilterUpdate {
  name?: string;
  filterType?: FilterType;
  valuesQuery?: string;
  staticOptions?: FilterOption[];
  dataSourceId?: string;
  defaultValue?: unknown;
  placeholder?: string;
  required?: boolean;
  displayOrder?: number;
  minValue?: string;
  maxValue?: string;
}

// ============================================================================
// Filter State (Runtime)
// ============================================================================

export interface FilterState {
  filterId: string;
  value: unknown;
  operator?: FilterOperator;
}

export interface ActiveFilter {
  column: string;
  operator: FilterOperator;
  value: unknown;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface FilterValuesRequest {
  valuesQuery: string;
  dataSourceId?: string;
  limit?: number;
}

export interface FilterValuesResponse {
  filterId?: string;
  options: FilterOption[];
  executionTimeMs: number;
}

export interface FilteredChartDataRequest {
  filters: ActiveFilter[];
}

export interface FilteredChartDataResponse {
  chartId: string;
  data: Record<string, unknown>[];
  columns: { name: string; type: string }[];
  appliedFilters: ActiveFilter[];
  executionTimeMs: number;
}

export interface ReorderFiltersRequest {
  filterIds: string[];
}

// ============================================================================
// Chart Column (for mapping configuration)
// ============================================================================

export interface ChartColumn {
  name: string;
  type: string;
}

// ============================================================================
// Filter Context (for dashboard-level state)
// ============================================================================

export interface DashboardFilterContext {
  dashboardId: string;
  filters: DashboardFilter[];
  currentState: Map<string, FilterState>;
}

// ============================================================================
// Filter Change Event
// ============================================================================

export interface FilterChangeEvent {
  filterId: string;
  value: unknown;
  affectedChartIds: string[];
}

// ============================================================================
// Filter Widget Configuration (for UI rendering)
// ============================================================================

export interface FilterWidgetConfig {
  filter: DashboardFilter;
  options: FilterOption[];
  isLoading: boolean;
  error?: string;
}

// ============================================================================
// Utility type for WHERE condition building
// ============================================================================

export interface WhereCondition {
  column: string;
  operator: FilterOperator;
  value: unknown;
}
