/**
 * Filter Config Modal Component
 *
 * Modal for configuring dashboard filters including:
 * - Filter name, type, and values query
 * - Chart mapping (scoping) configuration
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import {
  DashboardFilter,
  FilterCreate,
  FilterUpdate,
  FilterType,
  FilterOperator,
  FilterOption,
  FilterChartMapping,
  FilterChartMappingCreate,
  ChartColumn,
} from '../models/filter.models';
import { FilterConfigService } from '../../services/filter-config.service';
import { SelectOption } from '../../../../shared/components/select/select.component';

interface ChartInfo {
  id: string;
  name: string;
  columns: ChartColumn[];
}

@Component({
  selector: 'app-filter-config-modal',
  template: `
    <app-modal
      [isOpen]="isOpen"
      [title]="'Configure Dashboard Filters'"
      [size]="'xl'"
      (closed)="onCancel()"
    >
      <div class="filter-config-content">
        <!-- Left Panel: Filter List -->
        <div class="filter-list-panel">
          <div class="panel-header">
            <span class="panel-title">Filters</span>
            <button type="button" class="add-btn" (click)="addNewFilter()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Add
            </button>
          </div>

          <div class="filter-list">
            <div
              *ngFor="let filter of localFilters(); let i = index"
              class="filter-item"
              [class.active]="selectedIndex() === i"
              [class.new]="filter.id.startsWith('new-')"
              (click)="selectFilter(i)"
            >
              <div class="filter-item-content">
                <span class="filter-name">{{ filter.name || 'Untitled Filter' }}</span>
                <span class="filter-type">{{ getFilterTypeLabel(filter.filterType) }}</span>
              </div>
              <button
                type="button"
                class="delete-btn"
                (click)="deleteFilter($event, i)"
                title="Delete Filter"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>

            <div *ngIf="localFilters().length === 0" class="empty-list">
              No filters configured
            </div>
          </div>
        </div>

        <!-- Right Panel: Configuration -->
        <div class="config-panel" *ngIf="selectedFilter()">
          <!-- Tabs -->
          <div class="config-tabs">
            <button
              type="button"
              class="tab-btn"
              [class.active]="activeTab() === 'settings'"
              (click)="activeTab.set('settings')"
            >
              Settings
            </button>
            <button
              type="button"
              class="tab-btn"
              [class.active]="activeTab() === 'scoping'"
              (click)="activeTab.set('scoping')"
            >
              Scoping
            </button>
          </div>

          <!-- Settings Tab -->
          <div class="tab-content" *ngIf="activeTab() === 'settings'">
            <div class="form-section">
              <div class="form-row">
                <app-input
                  label="Filter Name"
                  [placeholder]="'Enter filter name'"
                  [(ngModel)]="selectedFilter()!.name"
                  [required]="true"
                ></app-input>
              </div>

              <div class="form-row">
                <label class="form-label">Filter Type</label>
                <div class="type-options">
                  <label
                    *ngFor="let type of filterTypes"
                    class="type-option"
                    [class.selected]="selectedFilter()!.filterType === type.value"
                  >
                    <input
                      type="radio"
                      [value]="type.value"
                      [(ngModel)]="selectedFilter()!.filterType"
                      name="filterType"
                    />
                    <span class="option-label">{{ type.label }}</span>
                  </label>
                </div>
              </div>
            </div>

            <div class="form-section">
              <div class="section-header">
                <span class="section-title">Values Source</span>
              </div>

              <div class="form-row" *ngIf="dataSources.length > 0">
                <app-select
                  label="Data Source"
                  [options]="dataSourceOptions"
                  [placeholder]="'Select data source'"
                  [(ngModel)]="selectedFilter()!.dataSourceId"
                ></app-select>
              </div>

              <div class="form-row">
                <label class="form-label">Values Query</label>
                <textarea
                  class="query-input"
                  [placeholder]="'SELECT DISTINCT column_name FROM table_name ORDER BY column_name'"
                  [(ngModel)]="selectedFilter()!.valuesQuery"
                  rows="4"
                ></textarea>
                <span class="form-hint">
                  SQL query to fetch filter options. Must return 'value' and optional 'label', 'count' columns.
                </span>
              </div>

              <div class="query-actions">
                <button
                  type="button"
                  class="test-btn"
                  [disabled]="!selectedFilter()!.valuesQuery || isTestingQuery()"
                  (click)="testQuery()"
                >
                  <svg *ngIf="!isTestingQuery()" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                  <svg *ngIf="isTestingQuery()" class="spinner" width="14" height="14" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31.4 31.4" />
                  </svg>
                  {{ isTestingQuery() ? 'Testing...' : 'Test Query' }}
                </button>
              </div>

              <!-- Query Preview -->
              <div *ngIf="queryPreview().length > 0" class="query-preview">
                <div class="preview-header">
                  <span>Preview ({{ queryPreview().length }} options)</span>
                  <span *ngIf="queryTime() > 0" class="query-time">{{ queryTime() }}ms</span>
                </div>
                <div class="preview-options">
                  <span *ngFor="let opt of queryPreview().slice(0, 10)" class="preview-option">
                    {{ opt.label }}
                  </span>
                  <span *ngIf="queryPreview().length > 10" class="preview-more">
                    +{{ queryPreview().length - 10 }} more
                  </span>
                </div>
              </div>

              <div *ngIf="queryError()" class="query-error">
                {{ queryError() }}
              </div>
            </div>

            <div class="form-section">
              <div class="section-header">
                <span class="section-title">Options</span>
              </div>

              <div class="form-row">
                <app-input
                  label="Placeholder"
                  [placeholder]="'Select...'"
                  [(ngModel)]="selectedFilter()!.placeholder"
                ></app-input>
              </div>

              <div class="form-row inline">
                <label class="checkbox-label">
                  <input type="checkbox" [(ngModel)]="selectedFilter()!.required" />
                  <span>Required</span>
                </label>
              </div>

              <!-- Range constraints (for range/date-range types) -->
              <ng-container *ngIf="selectedFilter()!.filterType === 'range' || selectedFilter()!.filterType === 'date-range'">
                <div class="form-row two-col">
                  <app-input
                    label="Min Value"
                    [(ngModel)]="selectedFilter()!.minValue"
                    [type]="selectedFilter()!.filterType === 'range' ? 'number' : 'date'"
                  ></app-input>
                  <app-input
                    label="Max Value"
                    [(ngModel)]="selectedFilter()!.maxValue"
                    [type]="selectedFilter()!.filterType === 'range' ? 'number' : 'date'"
                  ></app-input>
                </div>
              </ng-container>
            </div>
          </div>

          <!-- Scoping Tab -->
          <div class="tab-content" *ngIf="activeTab() === 'scoping'">
            <div class="scoping-intro">
              <p>Map this filter to charts and specify which column to filter on.</p>
            </div>

            <div class="chart-mappings">
              <div
                *ngFor="let chart of charts"
                class="chart-mapping"
              >
                <label class="mapping-checkbox">
                  <input
                    type="checkbox"
                    [checked]="isChartMapped(chart.id)"
                    (change)="toggleChartMapping(chart, $event)"
                  />
                  <span class="chart-name">{{ chart.name }}</span>
                </label>

                <div class="mapping-config" *ngIf="isChartMapped(chart.id)">
                  <app-select
                    [options]="getColumnOptions(chart)"
                    [placeholder]="'Select column'"
                    [(ngModel)]="getMapping(chart.id)!.columnName"
                    [size]="'sm'"
                  ></app-select>

                  <app-select
                    [options]="operatorOptions"
                    [(ngModel)]="getMapping(chart.id)!.operator"
                    [size]="'sm'"
                  ></app-select>
                </div>

                <div class="mapping-warning" *ngIf="isChartMapped(chart.id) && chart.columns.length === 0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                  <span>No columns available</span>
                </div>
              </div>

              <div *ngIf="charts.length === 0" class="no-charts">
                No charts available in this dashboard
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div class="config-panel empty" *ngIf="!selectedFilter()">
          <div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
            <p>Select a filter to configure or add a new one</p>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="modal-footer" slot="footer">
        <button type="button" class="btn-cancel" (click)="onCancel()">Cancel</button>
        <button
          type="button"
          class="btn-save"
          [disabled]="isSaving()"
          (click)="onSave()"
        >
          {{ isSaving() ? 'Saving...' : 'Save Filters' }}
        </button>
      </div>
    </app-modal>
  `,
  styles: [`
    .filter-config-content {
      display: flex;
      height: 500px;
      margin: calc(var(--spacing-4) * -1);
    }

    /* Filter List Panel */
    .filter-list-panel {
      width: 240px;
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-3);
      border-bottom: 1px solid var(--border-color);
    }

    .panel-title {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-semibold);
      color: var(--text-primary);
    }

    .add-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-1);
      padding: var(--spacing-1) var(--spacing-2);
      background: var(--color-primary);
      border: none;
      border-radius: var(--radius-sm);
      font-size: var(--font-size-xs);
      color: white;
      cursor: pointer;
      transition: all var(--transition-fast);

      &:hover {
        background: var(--color-primary-hover);
      }
    }

    .filter-list {
      flex: 1;
      overflow-y: auto;
      padding: var(--spacing-2);
    }

    .filter-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-2) var(--spacing-3);
      margin-bottom: var(--spacing-1);
      background: var(--bg-primary);
      border: 1px solid transparent;
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all var(--transition-fast);

      &:hover {
        background: var(--bg-hover);
      }

      &.active {
        background: rgba(var(--color-primary-rgb), 0.1);
        border-color: var(--color-primary);
      }

      &.new {
        border-style: dashed;
        border-color: var(--border-color);
      }
    }

    .filter-item-content {
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow: hidden;
    }

    .filter-name {
      font-size: var(--font-size-sm);
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .filter-type {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
    }

    .delete-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-1);
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      border-radius: var(--radius-sm);
      opacity: 0;
      transition: all var(--transition-fast);

      &:hover {
        color: var(--color-danger);
        background: rgba(var(--color-danger-rgb), 0.1);
      }
    }

    .filter-item:hover .delete-btn {
      opacity: 1;
    }

    .empty-list {
      padding: var(--spacing-4);
      text-align: center;
      color: var(--text-muted);
      font-size: var(--font-size-sm);
    }

    /* Config Panel */
    .config-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .config-panel.empty {
      justify-content: center;
      align-items: center;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-3);
      color: var(--text-muted);

      svg {
        opacity: 0.5;
      }

      p {
        font-size: var(--font-size-sm);
      }
    }

    /* Tabs */
    .config-tabs {
      display: flex;
      border-bottom: 1px solid var(--border-color);
    }

    .tab-btn {
      padding: var(--spacing-3) var(--spacing-4);
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: var(--text-muted);
      cursor: pointer;
      transition: all var(--transition-fast);

      &:hover {
        color: var(--text-primary);
      }

      &.active {
        color: var(--color-primary);
        border-bottom-color: var(--color-primary);
      }
    }

    /* Tab Content */
    .tab-content {
      flex: 1;
      overflow-y: auto;
      padding: var(--spacing-4);
    }

    .form-section {
      margin-bottom: var(--spacing-6);
    }

    .section-header {
      margin-bottom: var(--spacing-3);
    }

    .section-title {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-semibold);
      color: var(--text-secondary);
    }

    .form-row {
      margin-bottom: var(--spacing-4);

      &.two-col {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--spacing-4);
      }

      &.inline {
        display: flex;
        align-items: center;
      }
    }

    .form-label {
      display: block;
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: var(--text-secondary);
      margin-bottom: var(--spacing-2);
    }

    .form-hint {
      display: block;
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      margin-top: var(--spacing-1);
    }

    /* Type Options */
    .type-options {
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacing-2);
    }

    .type-option {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      padding: var(--spacing-2) var(--spacing-3);
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all var(--transition-fast);

      input {
        display: none;
      }

      &:hover {
        background: var(--bg-hover);
      }

      &.selected {
        background: rgba(var(--color-primary-rgb), 0.1);
        border-color: var(--color-primary);
        color: var(--color-primary);
      }
    }

    .option-label {
      font-size: var(--font-size-sm);
    }

    /* Query Input */
    .query-input {
      width: 100%;
      padding: var(--spacing-3);
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      font-family: var(--font-family-mono);
      font-size: var(--font-size-sm);
      color: var(--text-primary);
      resize: vertical;

      &:focus {
        outline: none;
        border-color: var(--color-primary);
      }

      &::placeholder {
        color: var(--text-muted);
      }
    }

    .query-actions {
      display: flex;
      gap: var(--spacing-2);
      margin-top: var(--spacing-2);
    }

    .test-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-2);
      padding: var(--spacing-2) var(--spacing-3);
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all var(--transition-fast);

      &:hover:not(:disabled) {
        background: var(--bg-hover);
        border-color: var(--color-primary);
        color: var(--color-primary);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .spinner {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .query-preview {
      margin-top: var(--spacing-3);
      padding: var(--spacing-3);
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
    }

    .preview-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--spacing-2);
      font-size: var(--font-size-xs);
      color: var(--text-muted);
    }

    .query-time {
      color: var(--color-success);
    }

    .preview-options {
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacing-1);
    }

    .preview-option {
      padding: var(--spacing-1) var(--spacing-2);
      background: var(--bg-tertiary);
      border-radius: var(--radius-sm);
      font-size: var(--font-size-xs);
      color: var(--text-secondary);
    }

    .preview-more {
      padding: var(--spacing-1) var(--spacing-2);
      font-size: var(--font-size-xs);
      color: var(--text-muted);
    }

    .query-error {
      margin-top: var(--spacing-2);
      padding: var(--spacing-2) var(--spacing-3);
      background: rgba(var(--color-danger-rgb), 0.1);
      border-radius: var(--radius-md);
      font-size: var(--font-size-sm);
      color: var(--color-danger);
    }

    /* Checkbox */
    .checkbox-label {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-2);
      cursor: pointer;
      font-size: var(--font-size-sm);
      color: var(--text-primary);

      input {
        width: 16px;
        height: 16px;
        accent-color: var(--color-primary);
      }
    }

    /* Scoping */
    .scoping-intro {
      margin-bottom: var(--spacing-4);

      p {
        font-size: var(--font-size-sm);
        color: var(--text-muted);
        margin: 0;
      }
    }

    .chart-mappings {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-3);
    }

    .chart-mapping {
      display: flex;
      align-items: center;
      gap: var(--spacing-3);
      padding: var(--spacing-3);
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
    }

    .mapping-checkbox {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      cursor: pointer;
      min-width: 180px;

      input {
        width: 16px;
        height: 16px;
        accent-color: var(--color-primary);
      }
    }

    .chart-name {
      font-size: var(--font-size-sm);
      color: var(--text-primary);
    }

    .mapping-config {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      flex: 1;
    }

    .mapping-warning {
      display: flex;
      align-items: center;
      gap: var(--spacing-1);
      font-size: var(--font-size-xs);
      color: var(--color-warning);
    }

    .no-charts {
      padding: var(--spacing-4);
      text-align: center;
      color: var(--text-muted);
      font-size: var(--font-size-sm);
    }

    /* Footer */
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: var(--spacing-3);
      padding-top: var(--spacing-4);
      border-top: 1px solid var(--border-color);
    }

    .btn-cancel,
    .btn-save {
      padding: var(--spacing-2) var(--spacing-4);
      border-radius: var(--radius-md);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .btn-cancel {
      background: none;
      border: 1px solid var(--border-color);
      color: var(--text-secondary);

      &:hover {
        background: var(--bg-hover);
      }
    }

    .btn-save {
      background: var(--color-primary);
      border: none;
      color: white;

      &:hover:not(:disabled) {
        background: var(--color-primary-hover);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  `],
  standalone: false,
})
export class FilterConfigModalComponent implements OnInit {
  @Input() isOpen = false;
  @Input() dashboardId!: string;
  @Input() filters: DashboardFilter[] = [];
  @Input() charts: ChartInfo[] = [];
  @Input() dataSources: { id: string; name: string }[] = [];

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<DashboardFilter[]>();

  private filterConfig = inject(FilterConfigService);

  // State
  localFilters = signal<DashboardFilter[]>([]);
  selectedIndex = signal<number>(-1);
  activeTab = signal<'settings' | 'scoping'>('settings');
  isTestingQuery = signal(false);
  isSaving = signal(false);
  queryPreview = signal<FilterOption[]>([]);
  queryTime = signal(0);
  queryError = signal<string | null>(null);

  // Filter type options
  filterTypes: { value: FilterType; label: string }[] = [
    { value: 'select', label: 'Select' },
    { value: 'multi-select', label: 'Multi-Select' },
    { value: 'range', label: 'Range' },
    { value: 'date-range', label: 'Date Range' },
    { value: 'text', label: 'Text' },
  ];

  // Operator options
  operatorOptions: SelectOption[] = [
    { value: '=', label: 'Equals (=)' },
    { value: '!=', label: 'Not Equals (!=)' },
    { value: '>', label: 'Greater Than (>)' },
    { value: '<', label: 'Less Than (<)' },
    { value: '>=', label: 'Greater or Equal (>=)' },
    { value: '<=', label: 'Less or Equal (<=)' },
    { value: 'IN', label: 'In List (IN)' },
    { value: 'NOT IN', label: 'Not In List (NOT IN)' },
    { value: 'BETWEEN', label: 'Between (BETWEEN)' },
    { value: 'LIKE', label: 'Contains (LIKE)' },
  ];

  ngOnInit(): void {
    this.localFilters.set(this.deepCloneFilters(this.filters));
    if (this.localFilters().length > 0) {
      this.selectedIndex.set(0);
    }
  }

  // =========================================================================
  // Computed Properties
  // =========================================================================

  selectedFilter(): DashboardFilter | null {
    const index = this.selectedIndex();
    const filters = this.localFilters();
    return index >= 0 && index < filters.length ? filters[index] : null;
  }

  get dataSourceOptions(): SelectOption[] {
    return this.dataSources.map(ds => ({
      value: ds.id,
      label: ds.name,
    }));
  }

  // =========================================================================
  // Filter Management
  // =========================================================================

  selectFilter(index: number): void {
    this.selectedIndex.set(index);
    this.activeTab.set('settings');
    this.queryPreview.set([]);
    this.queryError.set(null);
  }

  addNewFilter(): void {
    const newFilter: DashboardFilter = {
      id: `new-${Date.now()}`,
      dashboardId: this.dashboardId,
      name: '',
      filterType: 'select',
      required: false,
      displayOrder: this.localFilters().length,
      chartMappings: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.localFilters.update(filters => [...filters, newFilter]);
    this.selectedIndex.set(this.localFilters().length - 1);
    this.activeTab.set('settings');
  }

  deleteFilter(event: Event, index: number): void {
    event.stopPropagation();

    this.localFilters.update(filters => filters.filter((_, i) => i !== index));

    // Adjust selection
    if (this.selectedIndex() >= this.localFilters().length) {
      this.selectedIndex.set(this.localFilters().length - 1);
    }
  }

  // =========================================================================
  // Query Testing
  // =========================================================================

  testQuery(): void {
    const filter = this.selectedFilter();
    if (!filter || !filter.valuesQuery) return;

    this.isTestingQuery.set(true);
    this.queryPreview.set([]);
    this.queryError.set(null);

    this.filterConfig.previewFilterValues(
      filter.valuesQuery,
      filter.dataSourceId,
      100
    ).subscribe({
      next: (response) => {
        this.queryPreview.set(response.options);
        this.queryTime.set(response.executionTimeMs);
        this.isTestingQuery.set(false);
      },
      error: (err) => {
        this.queryError.set(err.error?.detail || 'Failed to execute query');
        this.isTestingQuery.set(false);
      },
    });
  }

  // =========================================================================
  // Chart Mappings
  // =========================================================================

  isChartMapped(chartId: string): boolean {
    const filter = this.selectedFilter();
    if (!filter) return false;
    return filter.chartMappings.some(m => m.chartId === chartId);
  }

  getMapping(chartId: string): FilterChartMapping | undefined {
    const filter = this.selectedFilter();
    if (!filter) return undefined;
    return filter.chartMappings.find(m => m.chartId === chartId);
  }

  toggleChartMapping(chart: ChartInfo, event: Event): void {
    const filter = this.selectedFilter();
    if (!filter) return;

    const checked = (event.target as HTMLInputElement).checked;
    const index = this.selectedIndex();

    this.localFilters.update(filters => {
      const updated = [...filters];
      const f = { ...updated[index] };

      if (checked) {
        // Add mapping
        const newMapping: FilterChartMapping = {
          id: `new-${Date.now()}`,
          filterId: f.id,
          chartId: chart.id,
          chartName: chart.name,
          columnName: chart.columns.length > 0 ? chart.columns[0].name : '',
          operator: this.getDefaultOperator(f.filterType),
          enabled: true,
        };
        f.chartMappings = [...f.chartMappings, newMapping];
      } else {
        // Remove mapping
        f.chartMappings = f.chartMappings.filter(m => m.chartId !== chart.id);
      }

      updated[index] = f;
      return updated;
    });
  }

  getColumnOptions(chart: ChartInfo): SelectOption[] {
    return chart.columns.map(col => ({
      value: col.name,
      label: `${col.name} (${col.type})`,
    }));
  }

  private getDefaultOperator(filterType: FilterType): FilterOperator {
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

  // =========================================================================
  // Helpers
  // =========================================================================

  getFilterTypeLabel(type: FilterType): string {
    return this.filterTypes.find(t => t.value === type)?.label || type;
  }

  private deepCloneFilters(filters: DashboardFilter[]): DashboardFilter[] {
    return filters.map(f => ({
      ...f,
      chartMappings: f.chartMappings.map(m => ({ ...m })),
    }));
  }

  // =========================================================================
  // Actions
  // =========================================================================

  onCancel(): void {
    this.closed.emit();
  }

  onSave(): void {
    // Validate filters
    const filters = this.localFilters();
    for (const filter of filters) {
      if (!filter.name.trim()) {
        // Could show validation error here
        return;
      }
    }

    this.isSaving.set(true);
    this.saved.emit(filters);

    // Note: The parent component should handle the actual API calls
    // and close the modal when done
  }
}
