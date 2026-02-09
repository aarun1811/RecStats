/**
 * Filter Widget Component
 *
 * Renders the appropriate filter control based on filter type.
 * Integrates with FilterStateService for value management.
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  inject,
  ChangeDetectorRef,
} from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  DashboardFilter,
  FilterOption,
  FilterType,
} from '../models/filter.models';
import { FilterStateService } from '../../services/filter-state.service';
import { FilterConfigService } from '../../services/filter-config.service';
import { SelectOption } from '../../../../shared/components/select/select.component';
import { DateRange } from '../../../../shared/components/date-range-picker/date-range-picker.component';
import { RangeValue } from '../../../../shared/components/range-slider/range-slider.component';

@Component({
  selector: 'app-filter-widget',
  template: `
    <div class="filter-widget" [class.loading]="isLoading" [class.compact]="compact">
      <label *ngIf="showLabel" class="filter-label">
        {{ filter.name }}
        <span *ngIf="filter.required" class="required-mark">*</span>
      </label>

      <!-- Select (Single) -->
      <ng-container *ngIf="filter.filterType === 'select'">
        <app-select
          [options]="selectOptions"
          [placeholder]="filter.placeholder || 'Select...'"
          [clearable]="!filter.required"
          [searchable]="options.length > 10"
          [disabled]="isLoading"
          [size]="size"
          [(ngModel)]="currentValue"
          (selectionChange)="onSelectChange($event)"
        ></app-select>
      </ng-container>

      <!-- Multi-Select -->
      <ng-container *ngIf="filter.filterType === 'multi-select'">
        <app-select
          [options]="selectOptions"
          [placeholder]="filter.placeholder || 'Select...'"
          [clearable]="!filter.required"
          [searchable]="options.length > 10"
          [multiple]="true"
          [showSelectAll]="options.length > 5"
          [disabled]="isLoading"
          [size]="size"
          [(ngModel)]="currentValue"
          (selectionChange)="onMultiSelectChange($event)"
        ></app-select>
      </ng-container>

      <!-- Date Range -->
      <ng-container *ngIf="filter.filterType === 'date-range'">
        <app-date-range-picker
          [placeholder]="filter.placeholder || 'Select date range'"
          [clearable]="!filter.required"
          [disabled]="isLoading"
          [size]="size"
          [minDate]="minDate"
          [maxDate]="maxDate"
          [(ngModel)]="currentValue"
          (rangeChange)="onDateRangeChange($event)"
        ></app-date-range-picker>
      </ng-container>

      <!-- Numeric Range -->
      <ng-container *ngIf="filter.filterType === 'range'">
        <app-range-slider
          [min]="rangeMin"
          [max]="rangeMax"
          [step]="rangeStep"
          [showValues]="true"
          [showTooltip]="true"
          [disabled]="isLoading"
          [size]="size"
          [(ngModel)]="currentValue"
          (rangeChange)="onRangeChange($event)"
        ></app-range-slider>
      </ng-container>

      <!-- Text -->
      <ng-container *ngIf="filter.filterType === 'text'">
        <app-input
          [placeholder]="filter.placeholder || 'Enter text...'"
          [clearable]="!filter.required"
          [disabled]="isLoading"
          [size]="size"
          [(ngModel)]="currentValue"
          (blurred)="onTextChange()"
        ></app-input>
      </ng-container>

      <!-- Loading Overlay -->
      <div *ngIf="isLoading" class="loading-overlay">
        <svg class="spinner" width="16" height="16" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31.4 31.4" />
        </svg>
      </div>
    </div>
  `,
  styles: [`
    .filter-widget {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: var(--spacing-1);
      min-width: 180px;
    }

    .filter-widget.compact {
      min-width: 140px;
    }

    .filter-label {
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-medium);
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .required-mark {
      color: var(--color-danger);
      margin-left: 2px;
    }

    .loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(var(--bg-primary-rgb), 0.6);
      border-radius: var(--radius-md);
      pointer-events: none;
    }

    .spinner {
      animation: spin 1s linear infinite;
      color: var(--color-primary);
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .filter-widget.loading {
      pointer-events: none;
    }
  `],
  standalone: false,
})
export class FilterWidgetComponent implements OnInit, OnDestroy {
  @Input() filter!: DashboardFilter;
  @Input() showLabel = true;
  @Input() compact = false;
  @Input() size: 'sm' | 'md' | 'lg' = 'sm';

  @Output() valueChange = new EventEmitter<unknown>();

  private filterState = inject(FilterStateService);
  private filterConfig = inject(FilterConfigService);
  private cdr = inject(ChangeDetectorRef);

  options: FilterOption[] = [];
  isLoading = false;
  currentValue: unknown = null;

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.loadInitialValue();
    this.loadOptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // =========================================================================
  // Computed Properties
  // =========================================================================

  get selectOptions(): SelectOption[] {
    return this.options.map(opt => ({
      value: opt.value,
      label: opt.label,
      count: opt.count,
    }));
  }

  get minDate(): Date | undefined {
    return this.filter.minValue ? new Date(this.filter.minValue) : undefined;
  }

  get maxDate(): Date | undefined {
    return this.filter.maxValue ? new Date(this.filter.maxValue) : undefined;
  }

  get rangeMin(): number {
    return this.filter.minValue ? Number(this.filter.minValue) : 0;
  }

  get rangeMax(): number {
    return this.filter.maxValue ? Number(this.filter.maxValue) : 100;
  }

  get rangeStep(): number {
    // Default step based on range
    const range = this.rangeMax - this.rangeMin;
    if (range <= 10) return 0.1;
    if (range <= 100) return 1;
    if (range <= 1000) return 10;
    return 100;
  }

  // =========================================================================
  // Initialization
  // =========================================================================

  private loadInitialValue(): void {
    const state = this.filterState.getFilterState(this.filter.id);
    if (state) {
      this.currentValue = state.value;
    } else if (this.filter.defaultValue !== undefined) {
      this.currentValue = this.filter.defaultValue;
    }
  }

  private loadOptions(): void {
    // Use static options if available
    if (this.filter.staticOptions && this.filter.staticOptions.length > 0) {
      this.options = this.filter.staticOptions;
      return;
    }

    // Load dynamic options via query
    if (this.filter.valuesQuery) {
      this.isLoading = true;
      this.filterConfig.getFilterValues(this.filter.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            this.options = response.options;
            this.isLoading = false;
            this.cdr.markForCheck();
          },
          error: () => {
            this.options = [];
            this.isLoading = false;
            this.cdr.markForCheck();
          },
        });
    }
  }

  // =========================================================================
  // Event Handlers
  // =========================================================================

  onSelectChange(option: SelectOption | SelectOption[] | null): void {
    const value = option && !Array.isArray(option) ? option.value : null;
    this.updateValue(value);
  }

  onMultiSelectChange(options: SelectOption | SelectOption[] | null): void {
    const value = Array.isArray(options) ? options.map(o => o.value) : [];
    this.updateValue(value);
  }

  onDateRangeChange(range: DateRange): void {
    if (range.start && range.end) {
      this.updateValue([range.start.toISOString(), range.end.toISOString()]);
    } else {
      this.updateValue(null);
    }
  }

  onRangeChange(range: RangeValue): void {
    this.updateValue([range.min, range.max]);
  }

  onTextChange(): void {
    this.updateValue(this.currentValue);
  }

  private updateValue(value: unknown): void {
    this.filterState.setFilterValue(this.filter.id, value);
    this.valueChange.emit(value);
  }
}
