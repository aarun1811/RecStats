/**
 * Select Component
 *
 * A versatile dropdown component supporting single and multi-select modes,
 * searchable options, keyboard navigation, and async loading.
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  forwardRef,
  ElementRef,
  ViewChild,
  HostListener,
  OnDestroy,
  OnInit,
  ChangeDetectorRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject, Observable, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil, catchError, finalize } from 'rxjs/operators';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
  group?: string;
  count?: number;
}

@Component({
  selector: 'app-select',
  template: `
    <div [class]="wrapperClasses">
      <label *ngIf="label" [class]="labelClasses" [for]="selectId">
        {{ label }}
        <span *ngIf="required" class="required-mark">*</span>
      </label>

      <!-- Select Trigger -->
      <div
        #trigger
        [class]="triggerClasses"
        [attr.tabindex]="disabled ? -1 : 0"
        (click)="toggleDropdown()"
        (keydown)="onTriggerKeydown($event)"
        [attr.aria-expanded]="isOpen"
        [attr.aria-haspopup]="'listbox'"
        [id]="selectId"
        role="combobox"
      >
        <!-- Selected Value Display -->
        <div class="select-value">
          <ng-container *ngIf="multiple && selectedOptions.length > 0">
            <div class="selected-tags">
              <span
                *ngFor="let opt of selectedOptions.slice(0, maxTagCount)"
                class="selected-tag"
              >
                {{ opt.label }}
                <button
                  type="button"
                  class="tag-remove"
                  (click)="removeOption($event, opt)"
                  [attr.aria-label]="'Remove ' + opt.label"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </span>
              <span *ngIf="selectedOptions.length > maxTagCount" class="more-tag">
                +{{ selectedOptions.length - maxTagCount }} more
              </span>
            </div>
          </ng-container>

          <ng-container *ngIf="!multiple">
            <span *ngIf="selectedOption" class="single-value">{{ selectedOption.label }}</span>
          </ng-container>

          <span *ngIf="showPlaceholder" class="select-placeholder">{{ placeholder }}</span>
        </div>

        <!-- Icons -->
        <div class="select-icons">
          <span
            *ngIf="clearable && hasValue && !disabled"
            class="select-clear"
            (click)="clear($event)"
            role="button"
            [attr.aria-label]="'Clear selection'"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </span>
          <span *ngIf="isLoading" class="select-loading">
            <svg class="spinner" width="16" height="16" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31.4 31.4" />
            </svg>
          </span>
          <span class="select-arrow" [class.rotated]="isOpen">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </span>
        </div>
      </div>

      <!-- Dropdown -->
      <div
        *ngIf="isOpen"
        class="select-dropdown"
        [style.maxHeight.px]="maxDropdownHeight"
        role="listbox"
        [attr.aria-multiselectable]="multiple"
      >
        <!-- Search Input -->
        <div *ngIf="searchable" class="dropdown-search">
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            #searchInput
            type="text"
            class="search-input"
            [placeholder]="searchPlaceholder"
            [(ngModel)]="searchTerm"
            (input)="onSearchInput()"
            (keydown)="onSearchKeydown($event)"
            autocomplete="off"
          />
          <button
            *ngIf="searchTerm"
            type="button"
            class="search-clear"
            (click)="clearSearch()"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Options List -->
        <div class="options-container" #optionsContainer>
          <!-- Loading State -->
          <div *ngIf="isLoading" class="dropdown-loading">
            <svg class="spinner" width="20" height="20" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31.4 31.4" />
            </svg>
            <span>Loading options...</span>
          </div>

          <!-- Empty State -->
          <div *ngIf="!isLoading && filteredOptions.length === 0" class="dropdown-empty">
            <span>{{ emptyMessage }}</span>
          </div>

          <!-- Options -->
          <ng-container *ngIf="!isLoading">
            <!-- Grouped Options -->
            <ng-container *ngIf="hasGroups">
              <div *ngFor="let group of groupedOptions" class="option-group">
                <div class="group-header">{{ group.name }}</div>
                <div
                  *ngFor="let option of group.options; let i = index"
                  [class]="getOptionClasses(option)"
                  (click)="selectOption(option)"
                  (mouseenter)="highlightedIndex = getGlobalIndex(group.name, i)"
                  [attr.aria-selected]="isSelected(option)"
                  role="option"
                >
                  <span *ngIf="multiple" class="option-checkbox">
                    <svg *ngIf="isSelected(option)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </span>
                  <span class="option-label">{{ option.label }}</span>
                  <span *ngIf="option.count !== undefined" class="option-count">{{ option.count }}</span>
                </div>
              </div>
            </ng-container>

            <!-- Flat Options -->
            <ng-container *ngIf="!hasGroups">
              <div
                *ngFor="let option of filteredOptions; let i = index"
                [class]="getOptionClasses(option, i)"
                (click)="selectOption(option)"
                (mouseenter)="highlightedIndex = i"
                [attr.aria-selected]="isSelected(option)"
                role="option"
              >
                <span *ngIf="multiple" class="option-checkbox">
                  <svg *ngIf="isSelected(option)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </span>
                <span class="option-label">{{ option.label }}</span>
                <span *ngIf="option.count !== undefined" class="option-count">{{ option.count }}</span>
              </div>
            </ng-container>
          </ng-container>
        </div>

        <!-- Select All (for multi-select) -->
        <div *ngIf="multiple && showSelectAll && filteredOptions.length > 0 && !isLoading" class="dropdown-footer">
          <button type="button" class="select-all-btn" (click)="toggleSelectAll()">
            {{ allSelected ? 'Deselect All' : 'Select All' }}
          </button>
        </div>
      </div>

      <p *ngIf="hint && !error" class="select-hint">{{ hint }}</p>
      <p *ngIf="error" class="select-error">{{ error }}</p>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .select-wrapper {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: var(--spacing-2);
    }

    label {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: var(--text-secondary);
      transition: color var(--transition-fast);
    }

    .label-focused {
      color: var(--color-primary);
    }

    .required-mark {
      color: var(--color-danger);
      margin-left: 2px;
    }

    /* Trigger Button */
    .select-trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 42px;
      padding: var(--spacing-2) var(--spacing-3);
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all var(--transition-fast);
      user-select: none;

      &:hover:not(.disabled) {
        border-color: var(--text-muted);
      }

      &:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.15);
      }

      &.open {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.15);
      }

      &.disabled {
        opacity: 0.5;
        cursor: not-allowed;
        background: var(--bg-tertiary);
      }

      &.error {
        border-color: var(--color-danger);

        &:focus {
          box-shadow: 0 0 0 3px rgba(var(--color-danger-rgb), 0.15);
        }
      }
    }

    .select-sm .select-trigger {
      min-height: 34px;
      padding: var(--spacing-1) var(--spacing-2);
      font-size: var(--font-size-xs);
    }

    .select-lg .select-trigger {
      min-height: 50px;
      padding: var(--spacing-3) var(--spacing-4);
      font-size: var(--font-size-base);
    }

    /* Value Display */
    .select-value {
      flex: 1;
      display: flex;
      align-items: center;
      min-width: 0;
      overflow: hidden;
    }

    .select-placeholder {
      color: var(--input-placeholder);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .single-value {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--text-primary);
    }

    /* Multi-select Tags */
    .selected-tags {
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacing-1);
      max-width: 100%;
    }

    .selected-tag {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-1);
      padding: 2px 6px;
      background: rgba(var(--color-primary-rgb), 0.1);
      color: var(--color-primary);
      border-radius: var(--radius-sm);
      font-size: var(--font-size-xs);
      max-width: 150px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .tag-remove {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
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

    .more-tag {
      color: var(--text-muted);
      font-size: var(--font-size-xs);
      padding: 2px 6px;
    }

    /* Icons */
    .select-icons {
      display: flex;
      align-items: center;
      gap: var(--spacing-1);
      margin-left: var(--spacing-2);
      flex-shrink: 0;
    }

    .select-clear {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-1);
      color: var(--text-muted);
      cursor: pointer;
      border-radius: var(--radius-sm);
      transition: all var(--transition-fast);

      &:hover {
        color: var(--text-primary);
        background: var(--bg-hover);
      }
    }

    .select-arrow {
      display: flex;
      align-items: center;
      color: var(--text-muted);
      transition: transform var(--transition-fast);

      &.rotated {
        transform: rotate(180deg);
      }
    }

    .select-loading {
      display: flex;
      align-items: center;
    }

    /* Dropdown */
    .select-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      z-index: 1000;
      margin-top: var(--spacing-1);
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      overflow: hidden;
      animation: dropdownFadeIn 0.15s ease-out;
    }

    @keyframes dropdownFadeIn {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Search */
    .dropdown-search {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      padding: var(--spacing-2) var(--spacing-3);
      border-bottom: 1px solid var(--border-color);
    }

    .search-icon {
      color: var(--text-muted);
      flex-shrink: 0;
    }

    .search-input {
      flex: 1;
      background: none;
      border: none;
      outline: none;
      font-size: var(--font-size-sm);
      color: var(--text-primary);

      &::placeholder {
        color: var(--input-placeholder);
      }
    }

    .search-clear {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2px;
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      border-radius: var(--radius-sm);
      transition: all var(--transition-fast);

      &:hover {
        color: var(--text-primary);
        background: var(--bg-hover);
      }
    }

    /* Options Container */
    .options-container {
      max-height: 250px;
      overflow-y: auto;
      padding: var(--spacing-1);
    }

    /* Loading & Empty States */
    .dropdown-loading,
    .dropdown-empty {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-2);
      padding: var(--spacing-4);
      color: var(--text-muted);
      font-size: var(--font-size-sm);
    }

    /* Option Groups */
    .option-group {
      &:not(:first-child) {
        margin-top: var(--spacing-2);
        padding-top: var(--spacing-2);
        border-top: 1px solid var(--border-color);
      }
    }

    .group-header {
      padding: var(--spacing-1) var(--spacing-3);
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-semibold);
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* Option Item */
    .select-option {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      padding: var(--spacing-2) var(--spacing-3);
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all var(--transition-fast);
      font-size: var(--font-size-sm);
      color: var(--text-primary);

      &:hover,
      &.highlighted {
        background: var(--bg-hover);
      }

      &.selected {
        background: rgba(var(--color-primary-rgb), 0.1);
        color: var(--color-primary);
      }

      &.disabled {
        opacity: 0.5;
        cursor: not-allowed;
        pointer-events: none;
      }
    }

    .option-checkbox {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border: 1.5px solid var(--border-color);
      border-radius: var(--radius-xs);
      flex-shrink: 0;
      transition: all var(--transition-fast);
    }

    .select-option.selected .option-checkbox {
      background: var(--color-primary);
      border-color: var(--color-primary);
      color: white;
    }

    .option-label {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .option-count {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      background: var(--bg-tertiary);
      padding: 1px 6px;
      border-radius: var(--radius-full);
    }

    /* Footer */
    .dropdown-footer {
      padding: var(--spacing-2) var(--spacing-3);
      border-top: 1px solid var(--border-color);
    }

    .select-all-btn {
      width: 100%;
      padding: var(--spacing-2);
      background: none;
      border: 1px dashed var(--border-color);
      border-radius: var(--radius-sm);
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all var(--transition-fast);

      &:hover {
        background: var(--bg-hover);
        border-color: var(--color-primary);
        color: var(--color-primary);
      }
    }

    /* Hint & Error */
    .select-hint {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      margin: 0;
    }

    .select-error {
      font-size: var(--font-size-xs);
      color: var(--color-danger);
      margin: 0;
    }

    /* Spinner Animation */
    .spinner {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Glow effect */
    .select-glow .select-trigger:focus {
      box-shadow: var(--glow-primary), 0 0 0 3px rgba(var(--color-primary-rgb), 0.1);
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
      multi: true,
    },
  ],
  standalone: false,
})
export class SelectComponent implements ControlValueAccessor, OnInit, OnDestroy {
  // Configuration
  @Input() label?: string;
  @Input() placeholder = 'Select...';
  @Input() hint?: string;
  @Input() error?: string;
  @Input() disabled = false;
  @Input() required = false;
  @Input() clearable = true;
  @Input() searchable = false;
  @Input() multiple = false;
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() glow = false;

  // Options
  @Input() options: SelectOption[] = [];
  @Input() optionsFn?: (search?: string) => Observable<SelectOption[]>;
  @Input() emptyMessage = 'No options available';
  @Input() searchPlaceholder = 'Search...';
  @Input() maxDropdownHeight = 300;
  @Input() maxTagCount = 3;
  @Input() showSelectAll = false;

  // Events
  @Output() opened = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
  @Output() selectionChange = new EventEmitter<SelectOption | SelectOption[] | null>();
  @Output() searchChange = new EventEmitter<string>();

  // View Children
  @ViewChild('trigger') triggerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('optionsContainer') optionsContainerRef?: ElementRef<HTMLDivElement>;

  // State
  isOpen = false;
  isFocused = false;
  isLoading = false;
  searchTerm = '';
  highlightedIndex = -1;
  filteredOptions: SelectOption[] = [];

  // Internal value
  private _value: unknown = null;
  private selectedValues: Set<string | number> = new Set();

  // Cleanup
  private destroy$ = new Subject<void>();
  private search$ = new Subject<string>();

  selectId = `select-${Math.random().toString(36).substring(2, 9)}`;

  private onChange: (value: unknown) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(
    private elementRef: ElementRef,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.filteredOptions = [...this.options];
    this.setupSearch();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // =========================================================================
  // Computed Properties
  // =========================================================================

  get wrapperClasses(): string {
    const classes = ['select-wrapper'];
    if (this.size !== 'md') classes.push(`select-${this.size}`);
    if (this.glow) classes.push('select-glow');
    return classes.join(' ');
  }

  get labelClasses(): string {
    return this.isFocused || this.isOpen ? 'label-focused' : '';
  }

  get triggerClasses(): string {
    const classes = ['select-trigger'];
    if (this.isOpen) classes.push('open');
    if (this.disabled) classes.push('disabled');
    if (this.error) classes.push('error');
    return classes.join(' ');
  }

  get hasValue(): boolean {
    if (this.multiple) {
      return this.selectedValues.size > 0;
    }
    return this._value !== null && this._value !== undefined && this._value !== '';
  }

  get showPlaceholder(): boolean {
    if (this.multiple) {
      return this.selectedValues.size === 0;
    }
    return !this.hasValue;
  }

  get selectedOption(): SelectOption | undefined {
    if (this.multiple) return undefined;
    return this.options.find(o => o.value === this._value);
  }

  get selectedOptions(): SelectOption[] {
    if (!this.multiple) return [];
    return this.options.filter(o => this.selectedValues.has(o.value));
  }

  get hasGroups(): boolean {
    return this.filteredOptions.some(o => o.group);
  }

  get groupedOptions(): { name: string; options: SelectOption[] }[] {
    const groups = new Map<string, SelectOption[]>();
    this.filteredOptions.forEach(option => {
      const groupName = option.group || 'Other';
      if (!groups.has(groupName)) {
        groups.set(groupName, []);
      }
      groups.get(groupName)!.push(option);
    });
    return Array.from(groups.entries()).map(([name, options]) => ({ name, options }));
  }

  get allSelected(): boolean {
    return this.multiple && this.filteredOptions.length > 0 &&
      this.filteredOptions.every(o => this.selectedValues.has(o.value));
  }

  // =========================================================================
  // Dropdown Control
  // =========================================================================

  toggleDropdown(): void {
    if (this.disabled) return;
    this.isOpen ? this.closeDropdown() : this.openDropdown();
  }

  openDropdown(): void {
    if (this.disabled || this.isOpen) return;

    this.isOpen = true;
    this.isFocused = true;
    this.highlightedIndex = -1;
    this.opened.emit();

    // Focus search input if searchable
    setTimeout(() => {
      if (this.searchable && this.searchInputRef) {
        this.searchInputRef.nativeElement.focus();
      }
    });

    // Load async options if provided
    if (this.optionsFn && this.options.length === 0) {
      this.loadAsyncOptions();
    }
  }

  closeDropdown(): void {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.isFocused = false;
    this.searchTerm = '';
    this.filteredOptions = [...this.options];
    this.highlightedIndex = -1;
    this.onTouched();
    this.closed.emit();
  }

  // =========================================================================
  // Option Selection
  // =========================================================================

  selectOption(option: SelectOption): void {
    if (option.disabled) return;

    if (this.multiple) {
      if (this.selectedValues.has(option.value)) {
        this.selectedValues.delete(option.value);
      } else {
        this.selectedValues.add(option.value);
      }
      const newValue = Array.from(this.selectedValues);
      this._value = newValue;
      this.onChange(newValue);
      this.selectionChange.emit(this.selectedOptions);
    } else {
      this._value = option.value;
      this.onChange(option.value);
      this.selectionChange.emit(option);
      this.closeDropdown();
    }
    this.cdr.markForCheck();
  }

  removeOption(event: Event, option: SelectOption): void {
    event.stopPropagation();
    if (this.disabled) return;

    this.selectedValues.delete(option.value);
    const newValue = Array.from(this.selectedValues);
    this._value = newValue;
    this.onChange(newValue);
    this.selectionChange.emit(this.selectedOptions);
    this.cdr.markForCheck();
  }

  toggleSelectAll(): void {
    if (this.allSelected) {
      this.selectedValues.clear();
    } else {
      this.filteredOptions.forEach(o => {
        if (!o.disabled) {
          this.selectedValues.add(o.value);
        }
      });
    }
    const newValue = Array.from(this.selectedValues);
    this._value = newValue;
    this.onChange(newValue);
    this.selectionChange.emit(this.selectedOptions);
    this.cdr.markForCheck();
  }

  clear(event?: Event): void {
    event?.stopPropagation();
    if (this.disabled) return;

    if (this.multiple) {
      this.selectedValues.clear();
      this._value = [];
      this.onChange([]);
      this.selectionChange.emit([]);
    } else {
      this._value = null;
      this.onChange(null);
      this.selectionChange.emit(null);
    }
    this.cdr.markForCheck();
  }

  isSelected(option: SelectOption): boolean {
    if (this.multiple) {
      return this.selectedValues.has(option.value);
    }
    return this._value === option.value;
  }

  // =========================================================================
  // Search
  // =========================================================================

  private setupSearch(): void {
    this.search$.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(term => {
      if (this.optionsFn) {
        this.loadAsyncOptions(term);
      } else {
        this.filterLocalOptions(term);
      }
      this.searchChange.emit(term);
    });
  }

  onSearchInput(): void {
    this.search$.next(this.searchTerm);
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.search$.next('');
    if (this.searchInputRef) {
      this.searchInputRef.nativeElement.focus();
    }
  }

  private filterLocalOptions(term: string): void {
    if (!term) {
      this.filteredOptions = [...this.options];
    } else {
      const lowerTerm = term.toLowerCase();
      this.filteredOptions = this.options.filter(o =>
        o.label.toLowerCase().includes(lowerTerm)
      );
    }
    this.highlightedIndex = this.filteredOptions.length > 0 ? 0 : -1;
    this.cdr.markForCheck();
  }

  private loadAsyncOptions(search?: string): void {
    if (!this.optionsFn) return;

    this.isLoading = true;
    this.cdr.markForCheck();

    this.optionsFn(search).pipe(
      takeUntil(this.destroy$),
      catchError(() => of([])),
      finalize(() => {
        this.isLoading = false;
        this.cdr.markForCheck();
      })
    ).subscribe(options => {
      this.options = options;
      this.filteredOptions = options;
      this.highlightedIndex = options.length > 0 ? 0 : -1;
    });
  }

  // =========================================================================
  // Keyboard Navigation
  // =========================================================================

  onTriggerKeydown(event: KeyboardEvent): void {
    if (this.disabled) return;

    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!this.isOpen) {
          this.openDropdown();
        } else if (this.highlightedIndex >= 0) {
          this.selectOption(this.filteredOptions[this.highlightedIndex]);
        }
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (!this.isOpen) {
          this.openDropdown();
        } else {
          this.highlightNext();
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (this.isOpen) {
          this.highlightPrevious();
        }
        break;
      case 'Escape':
        this.closeDropdown();
        this.triggerRef.nativeElement.focus();
        break;
      case 'Tab':
        this.closeDropdown();
        break;
    }
  }

  onSearchKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.highlightNext();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.highlightPrevious();
        break;
      case 'Enter':
        event.preventDefault();
        if (this.highlightedIndex >= 0) {
          this.selectOption(this.filteredOptions[this.highlightedIndex]);
        }
        break;
      case 'Escape':
        this.closeDropdown();
        this.triggerRef.nativeElement.focus();
        break;
    }
  }

  private highlightNext(): void {
    if (this.filteredOptions.length === 0) return;
    this.highlightedIndex = (this.highlightedIndex + 1) % this.filteredOptions.length;
    this.scrollToHighlighted();
  }

  private highlightPrevious(): void {
    if (this.filteredOptions.length === 0) return;
    this.highlightedIndex = this.highlightedIndex <= 0
      ? this.filteredOptions.length - 1
      : this.highlightedIndex - 1;
    this.scrollToHighlighted();
  }

  private scrollToHighlighted(): void {
    setTimeout(() => {
      if (!this.optionsContainerRef) return;
      const container = this.optionsContainerRef.nativeElement;
      const highlighted = container.querySelector('.highlighted') as HTMLElement;
      if (highlighted) {
        highlighted.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  // =========================================================================
  // Click Outside Handler
  // =========================================================================

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.closeDropdown();
    }
  }

  // =========================================================================
  // Option Classes Helper
  // =========================================================================

  getOptionClasses(option: SelectOption, index?: number): string {
    const classes = ['select-option'];
    if (this.isSelected(option)) classes.push('selected');
    if (option.disabled) classes.push('disabled');
    if (index !== undefined && index === this.highlightedIndex) classes.push('highlighted');
    return classes.join(' ');
  }

  getGlobalIndex(groupName: string, localIndex: number): number {
    let globalIndex = 0;
    for (const group of this.groupedOptions) {
      if (group.name === groupName) {
        return globalIndex + localIndex;
      }
      globalIndex += group.options.length;
    }
    return localIndex;
  }

  // =========================================================================
  // ControlValueAccessor Implementation
  // =========================================================================

  writeValue(value: unknown): void {
    this._value = value;
    this.selectedValues.clear();

    if (this.multiple && Array.isArray(value)) {
      value.forEach(v => this.selectedValues.add(v));
    } else if (!this.multiple && value !== null && value !== undefined) {
      // Single value - no need to add to selectedValues set
    }
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: unknown) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.cdr.markForCheck();
  }
}
