/**
 * Filter Bar Component
 *
 * Horizontal bar containing filter widgets with active filter pills
 * and clear functionality.
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  computed,
  effect,
} from '@angular/core';
import { DashboardFilter } from '../models/filter.models';
import { FilterStateService } from '../../services/filter-state.service';

@Component({
  selector: 'app-filter-bar',
  template: `
    <div class="filter-bar" [class.collapsed]="collapsed" [class.edit-mode]="editMode">
      <!-- Header -->
      <div class="filter-bar-header">
        <div class="header-left">
          <svg class="filter-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
          </svg>
          <span class="filter-title">Filters</span>
          <span *ngIf="activeCount() > 0" class="active-badge">{{ activeCount() }}</span>
        </div>

        <div class="header-actions">
          <button
            *ngIf="editMode"
            type="button"
            class="action-btn configure-btn"
            (click)="configure.emit()"
            title="Configure Filters"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>

          <button
            *ngIf="activeCount() > 0"
            type="button"
            class="action-btn clear-btn"
            (click)="clearAllFilters()"
            title="Clear All Filters"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            <span>Clear</span>
          </button>

          <button
            type="button"
            class="action-btn collapse-btn"
            (click)="toggleCollapse()"
            [title]="collapsed ? 'Expand Filters' : 'Collapse Filters'"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 [style.transform]="collapsed ? 'rotate(180deg)' : ''">
              <polyline points="18 15 12 9 6 15"></polyline>
            </svg>
          </button>
        </div>
      </div>

      <!-- Filter Widgets -->
      <div class="filter-widgets" *ngIf="!collapsed">
        <ng-container *ngIf="filters.length > 0; else noFilters">
          <app-filter-widget
            *ngFor="let filter of sortedFilters"
            [filter]="filter"
            [showLabel]="true"
            [size]="'sm'"
            (valueChange)="onFilterValueChange(filter.id, $event)"
          ></app-filter-widget>
        </ng-container>

        <ng-template #noFilters>
          <div class="no-filters">
            <span *ngIf="!editMode">No filters configured</span>
            <button
              *ngIf="editMode"
              type="button"
              class="add-filter-btn"
              (click)="configure.emit()"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Add Filters
            </button>
          </div>
        </ng-template>
      </div>

      <!-- Active Filter Pills -->
      <div class="active-pills" *ngIf="!collapsed && activeFilters().length > 0">
        <span class="pills-label">Active:</span>
        <div class="pills-container">
          <span
            *ngFor="let filter of activeFilters()"
            class="filter-pill"
          >
            <span class="pill-label">{{ filter.name }}: {{ getFilterDisplayValue(filter) }}</span>
            <button
              type="button"
              class="pill-remove"
              (click)="clearFilter(filter.id)"
              [attr.aria-label]="'Remove ' + filter.name + ' filter'"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .filter-bar {
      display: flex;
      flex-direction: column;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      overflow: hidden;
      transition: all var(--transition-normal);
    }

    .filter-bar.edit-mode {
      border-style: dashed;
    }

    /* Header */
    .filter-bar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-2) var(--spacing-3);
      background: var(--bg-tertiary);
      border-bottom: 1px solid var(--border-color);
    }

    .filter-bar.collapsed .filter-bar-header {
      border-bottom: none;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
    }

    .filter-icon {
      color: var(--text-muted);
    }

    .filter-title {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: var(--text-secondary);
    }

    .active-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      padding: 0 var(--spacing-1);
      background: var(--color-primary);
      color: white;
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-semibold);
      border-radius: var(--radius-full);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: var(--spacing-1);
    }

    .action-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-1);
      padding: var(--spacing-1) var(--spacing-2);
      background: none;
      border: none;
      border-radius: var(--radius-sm);
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      cursor: pointer;
      transition: all var(--transition-fast);

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
      }
    }

    .configure-btn:hover {
      color: var(--color-primary);
    }

    .clear-btn:hover {
      color: var(--color-danger);
    }

    .collapse-btn svg {
      transition: transform var(--transition-fast);
    }

    /* Filter Widgets */
    .filter-widgets {
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacing-3);
      padding: var(--spacing-3);
    }

    .no-filters {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: var(--spacing-4);
      color: var(--text-muted);
      font-size: var(--font-size-sm);
    }

    .add-filter-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-2);
      padding: var(--spacing-2) var(--spacing-4);
      background: none;
      border: 1px dashed var(--border-color);
      border-radius: var(--radius-md);
      font-size: var(--font-size-sm);
      color: var(--text-muted);
      cursor: pointer;
      transition: all var(--transition-fast);

      &:hover {
        background: var(--bg-hover);
        border-color: var(--color-primary);
        color: var(--color-primary);
      }
    }

    /* Active Pills */
    .active-pills {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      padding: var(--spacing-2) var(--spacing-3);
      border-top: 1px solid var(--border-color);
      background: rgba(var(--color-primary-rgb), 0.03);
    }

    .pills-label {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      flex-shrink: 0;
    }

    .pills-container {
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacing-2);
    }

    .filter-pill {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-1);
      padding: var(--spacing-1) var(--spacing-2);
      background: rgba(var(--color-primary-rgb), 0.1);
      color: var(--color-primary);
      border-radius: var(--radius-full);
      font-size: var(--font-size-xs);
      max-width: 200px;
    }

    .pill-label {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .pill-remove {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 2px;
      background: none;
      border: none;
      color: currentColor;
      cursor: pointer;
      opacity: 0.6;
      transition: opacity var(--transition-fast);
      flex-shrink: 0;

      &:hover {
        opacity: 1;
      }
    }
  `],
  standalone: false,
})
export class FilterBarComponent {
  @Input() filters: DashboardFilter[] = [];
  @Input() editMode = false;

  @Output() configure = new EventEmitter<void>();
  @Output() filterChange = new EventEmitter<{ filterId: string; value: unknown }>();

  private filterState = inject(FilterStateService);

  collapsed = false;

  // Computed signals
  activeFilters = computed(() => this.filterState.activeFilters());
  activeCount = computed(() => this.filterState.activeFilterCount());

  get sortedFilters(): DashboardFilter[] {
    return [...this.filters].sort((a, b) => a.displayOrder - b.displayOrder);
  }

  toggleCollapse(): void {
    this.collapsed = !this.collapsed;
  }

  clearAllFilters(): void {
    this.filterState.clearFilters();
  }

  clearFilter(filterId: string): void {
    this.filterState.setFilterValue(filterId, null);
  }

  onFilterValueChange(filterId: string, value: unknown): void {
    this.filterChange.emit({ filterId, value });
  }

  getFilterDisplayValue(filter: DashboardFilter): string {
    const state = this.filterState.getFilterState(filter.id);
    if (!state || state.value === null || state.value === undefined) {
      return '';
    }

    const value = state.value;

    // Format based on type
    switch (filter.filterType) {
      case 'multi-select':
        if (Array.isArray(value)) {
          if (value.length === 1) return String(value[0]);
          return `${value.length} selected`;
        }
        return String(value);

      case 'date-range':
        if (Array.isArray(value) && value.length === 2) {
          const start = new Date(value[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const end = new Date(value[1]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          return `${start} - ${end}`;
        }
        return String(value);

      case 'range':
        if (Array.isArray(value) && value.length === 2) {
          return `${value[0]} - ${value[1]}`;
        }
        return String(value);

      default:
        return String(value);
    }
  }
}
