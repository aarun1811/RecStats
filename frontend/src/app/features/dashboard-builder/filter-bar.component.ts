import { Component, Input, Output, EventEmitter } from '@angular/core';

export interface DashboardFilter {
  id: string;
  field: string;
  label: string;
  type: 'select' | 'dateRange' | 'search';
  options?: { value: string; label: string }[];
  value?: any;
}

@Component({
  selector: 'app-filter-bar',
  template: `
    <div class="filter-bar">
      <div class="filter-items">
        <!-- Date Range Filter -->
        <div class="filter-item date-range">
          <label class="filter-label">Date Range</label>
          <div class="date-inputs">
            <input
              type="date"
              class="filter-input date-input"
              [value]="dateFrom"
              (change)="onDateFromChange($event)">
            <span class="date-separator">to</span>
            <input
              type="date"
              class="filter-input date-input"
              [value]="dateTo"
              (change)="onDateToChange($event)">
          </div>
        </div>

        <!-- Region Filter -->
        <div class="filter-item">
          <label class="filter-label">Region</label>
          <select
            class="filter-input filter-select"
            [value]="selectedRegion"
            (change)="onRegionChange($event)">
            <option value="">All Regions</option>
            <option value="APAC">APAC</option>
            <option value="EMEA">EMEA</option>
            <option value="NAM">NAM</option>
            <option value="LATAM">LATAM</option>
          </select>
        </div>

        <!-- LOB Filter -->
        <div class="filter-item">
          <label class="filter-label">LOB</label>
          <select
            class="filter-input filter-select"
            [value]="selectedLob"
            (change)="onLobChange($event)">
            <option value="">All LOBs</option>
            <option value="Markets">Markets</option>
            <option value="Banking">Banking</option>
            <option value="Securities">Securities Services</option>
            <option value="Treasury">Treasury</option>
          </select>
        </div>

        <!-- Status Filter -->
        <div class="filter-item">
          <label class="filter-label">Status</label>
          <select
            class="filter-input filter-select"
            [value]="selectedStatus"
            (change)="onStatusChange($event)">
            <option value="">All Status</option>
            <option value="matched">Matched</option>
            <option value="unmatched">Unmatched</option>
            <option value="break">Break</option>
          </select>
        </div>

        <!-- Dynamic Filters -->
        <div class="filter-item" *ngFor="let filter of filters">
          <label class="filter-label">{{ filter.label }}</label>
          <select
            *ngIf="filter.type === 'select'"
            class="filter-input filter-select"
            [value]="filter.value || ''"
            (change)="onFilterChange(filter, $event)">
            <option value="">All</option>
            <option *ngFor="let opt of filter.options" [value]="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <input
            *ngIf="filter.type === 'search'"
            type="text"
            class="filter-input"
            [placeholder]="'Search ' + filter.label"
            [value]="filter.value || ''"
            (input)="onFilterChange(filter, $event)">
        </div>
      </div>

      <div class="filter-actions">
        <button class="filter-btn apply" (click)="applyFilters()">
          <app-icon name="filter" [size]="14"></app-icon>
          Apply
        </button>
        <button class="filter-btn reset" (click)="resetFilters()">
          <app-icon name="x" [size]="14"></app-icon>
          Reset
        </button>
      </div>
    </div>
  `,
  styles: [`
    .filter-bar {
      display: flex;
      align-items: flex-end;
      gap: var(--spacing-4);
      padding: var(--spacing-2) 0;
    }

    .filter-items {
      display: flex;
      align-items: flex-end;
      gap: var(--spacing-3);
      flex-wrap: wrap;
    }

    .filter-item {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-1);
    }

    .filter-label {
      font-size: 10px;
      font-weight: var(--font-weight-medium);
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .filter-input {
      height: 32px;
      padding: 0 var(--spacing-3);
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      color: var(--text-primary);
      font-size: var(--font-size-sm);
      transition: all 0.2s ease;

      &:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.2);
      }

      &::placeholder {
        color: var(--text-muted);
      }
    }

    .filter-select {
      min-width: 120px;
      cursor: pointer;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b949e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 8px center;
      padding-right: var(--spacing-6);
    }

    .date-range {
      .date-inputs {
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
      }

      .date-input {
        width: 130px;
      }

      .date-separator {
        color: var(--text-muted);
        font-size: var(--font-size-sm);
      }
    }

    .filter-actions {
      display: flex;
      gap: var(--spacing-2);
    }

    .filter-btn {
      display: flex;
      align-items: center;
      gap: var(--spacing-1);
      height: 32px;
      padding: 0 var(--spacing-3);
      border: none;
      border-radius: var(--radius-md);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      cursor: pointer;
      transition: all 0.2s ease;

      &.apply {
        background: var(--color-primary);
        color: white;

        &:hover {
          background: var(--color-primary-dark);
        }
      }

      &.reset {
        background: var(--bg-tertiary);
        color: var(--text-secondary);
        border: 1px solid var(--border-color);

        &:hover {
          background: var(--bg-primary);
          color: var(--text-primary);
        }
      }
    }
  `]
})
export class FilterBarComponent {
  @Input() filters: DashboardFilter[] = [];
  @Output() filterChange = new EventEmitter<any>();

  // Built-in filters
  dateFrom = '';
  dateTo = '';
  selectedRegion = '';
  selectedLob = '';
  selectedStatus = '';

  private filterState: Record<string, any> = {};

  onDateFromChange(event: Event) {
    this.dateFrom = (event.target as HTMLInputElement).value;
  }

  onDateToChange(event: Event) {
    this.dateTo = (event.target as HTMLInputElement).value;
  }

  onRegionChange(event: Event) {
    this.selectedRegion = (event.target as HTMLSelectElement).value;
  }

  onLobChange(event: Event) {
    this.selectedLob = (event.target as HTMLSelectElement).value;
  }

  onStatusChange(event: Event) {
    this.selectedStatus = (event.target as HTMLSelectElement).value;
  }

  onFilterChange(filter: DashboardFilter, event: Event) {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    filter.value = value;
    this.filterState[filter.field] = value;
  }

  applyFilters() {
    const filters = {
      dateFrom: this.dateFrom,
      dateTo: this.dateTo,
      region: this.selectedRegion,
      lob: this.selectedLob,
      status: this.selectedStatus,
      ...this.filterState
    };

    // Remove empty values
    const activeFilters = Object.fromEntries(
      Object.entries(filters).filter(([_, v]) => v !== '')
    );

    this.filterChange.emit(activeFilters);
  }

  resetFilters() {
    this.dateFrom = '';
    this.dateTo = '';
    this.selectedRegion = '';
    this.selectedLob = '';
    this.selectedStatus = '';
    this.filterState = {};

    // Reset dynamic filters
    this.filters.forEach(f => f.value = undefined);

    this.filterChange.emit({});
  }
}
