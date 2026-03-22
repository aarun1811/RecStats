/**
 * Date Range Picker Component
 *
 * A comprehensive date range picker with calendar popup, presets,
 * and optional time selection.
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  forwardRef,
  ElementRef,
  HostListener,
  OnInit,
  ChangeDetectorRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

export interface DatePreset {
  label: string;
  getValue: () => DateRange;
}

@Component({
  selector: 'app-date-range-picker',
  template: `
    <div [class]="wrapperClasses">
      <label *ngIf="label" [class]="labelClasses">
        {{ label }}
        <span *ngIf="required" class="required-mark">*</span>
      </label>

      <!-- Trigger -->
      <div
        [class]="triggerClasses"
        (click)="toggleDropdown()"
        [attr.tabindex]="disabled ? -1 : 0"
        (keydown)="onTriggerKeydown($event)"
      >
        <svg class="calendar-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>

        <span class="date-display">
          <ng-container *ngIf="hasValue; else placeholderTpl">
            <span class="date-value">{{ formatDate(value.start) }}</span>
            <span class="date-separator">-</span>
            <span class="date-value">{{ formatDate(value.end) }}</span>
          </ng-container>
          <ng-template #placeholderTpl>
            <span class="date-placeholder">{{ placeholder }}</span>
          </ng-template>
        </span>

        <div class="trigger-actions">
          <button
            *ngIf="clearable && hasValue && !disabled"
            type="button"
            class="clear-btn"
            (click)="clear($event)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <span class="dropdown-arrow" [class.rotated]="isOpen">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </span>
        </div>
      </div>

      <!-- Dropdown -->
      <div *ngIf="isOpen" class="picker-dropdown">
        <!-- Presets -->
        <div *ngIf="showPresets" class="presets-panel">
          <div class="presets-header">Quick Select</div>
          <button
            *ngFor="let preset of presets"
            type="button"
            class="preset-btn"
            [class.active]="isPresetActive(preset)"
            (click)="applyPreset(preset)"
          >
            {{ preset.label }}
          </button>
        </div>

        <!-- Calendar Panel -->
        <div class="calendar-panel">
          <!-- Calendar Header -->
          <div class="calendar-header">
            <div class="month-selector">
              <button type="button" class="nav-btn" (click)="previousMonth()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>
              <span class="current-month">{{ getMonthName(viewDate) }} {{ viewDate.getFullYear() }}</span>
              <button type="button" class="nav-btn" (click)="nextMonth()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            </div>
          </div>

          <!-- Calendar Grid -->
          <div class="calendar-grid">
            <!-- Day Headers -->
            <div class="day-header" *ngFor="let day of weekDays">{{ day }}</div>

            <!-- Day Cells -->
            <div
              *ngFor="let day of calendarDays"
              [class]="getDayClasses(day)"
              (click)="selectDate(day)"
              (mouseenter)="onDayHover(day)"
            >
              <span class="day-number">{{ day.getDate() }}</span>
            </div>
          </div>

          <!-- Time Selection (optional) -->
          <div *ngIf="showTime" class="time-selection">
            <div class="time-group">
              <label>Start Time</label>
              <input
                type="time"
                [value]="startTimeStr"
                (change)="onStartTimeChange($event)"
                class="time-input"
              />
            </div>
            <div class="time-group">
              <label>End Time</label>
              <input
                type="time"
                [value]="endTimeStr"
                (change)="onEndTimeChange($event)"
                class="time-input"
              />
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="picker-footer">
          <button type="button" class="footer-btn cancel-btn" (click)="cancel()">
            Cancel
          </button>
          <button
            type="button"
            class="footer-btn apply-btn"
            [disabled]="!canApply"
            (click)="apply()"
          >
            Apply
          </button>
        </div>
      </div>

      <p *ngIf="hint && !error" class="picker-hint">{{ hint }}</p>
      <p *ngIf="error" class="picker-error">{{ error }}</p>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .picker-wrapper {
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

    /* Trigger */
    .picker-trigger {
      display: flex;
      align-items: center;
      gap: var(--spacing-3);
      min-height: 42px;
      padding: var(--spacing-2) var(--spacing-3);
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all var(--transition-fast);

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
      }
    }

    .picker-sm .picker-trigger {
      min-height: 34px;
      padding: var(--spacing-1) var(--spacing-2);
      font-size: var(--font-size-xs);
    }

    .picker-lg .picker-trigger {
      min-height: 50px;
      padding: var(--spacing-3) var(--spacing-4);
      font-size: var(--font-size-base);
    }

    .calendar-icon {
      color: var(--text-muted);
      flex-shrink: 0;
    }

    .date-display {
      flex: 1;
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
    }

    .date-value {
      color: var(--text-primary);
    }

    .date-separator {
      color: var(--text-muted);
    }

    .date-placeholder {
      color: var(--input-placeholder);
    }

    .trigger-actions {
      display: flex;
      align-items: center;
      gap: var(--spacing-1);
    }

    .clear-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-1);
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

    .dropdown-arrow {
      display: flex;
      color: var(--text-muted);
      transition: transform var(--transition-fast);

      &.rotated {
        transform: rotate(180deg);
      }
    }

    /* Dropdown */
    .picker-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      z-index: 1000;
      margin-top: var(--spacing-1);
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      overflow: hidden;
      display: flex;
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

    /* Presets Panel */
    .presets-panel {
      width: 140px;
      padding: var(--spacing-3);
      border-right: 1px solid var(--border-color);
      background: var(--bg-secondary);
    }

    .presets-header {
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-semibold);
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: var(--spacing-2);
    }

    .preset-btn {
      display: block;
      width: 100%;
      padding: var(--spacing-2);
      background: none;
      border: none;
      border-radius: var(--radius-sm);
      text-align: left;
      font-size: var(--font-size-sm);
      color: var(--text-primary);
      cursor: pointer;
      transition: all var(--transition-fast);

      &:hover {
        background: var(--bg-hover);
      }

      &.active {
        background: rgba(var(--color-primary-rgb), 0.1);
        color: var(--color-primary);
      }
    }

    /* Calendar Panel */
    .calendar-panel {
      padding: var(--spacing-3);
      min-width: 280px;
    }

    .calendar-header {
      margin-bottom: var(--spacing-3);
    }

    .month-selector {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .nav-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      background: none;
      border: none;
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all var(--transition-fast);

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
      }
    }

    .current-month {
      font-weight: var(--font-weight-semibold);
      color: var(--text-primary);
    }

    /* Calendar Grid */
    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 2px;
    }

    .day-header {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 32px;
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-medium);
      color: var(--text-muted);
    }

    .day-cell {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 32px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all var(--transition-fast);
      font-size: var(--font-size-sm);

      &:hover:not(.disabled):not(.outside) {
        background: var(--bg-hover);
      }

      &.outside {
        color: var(--text-muted);
        opacity: 0.4;
      }

      &.today {
        font-weight: var(--font-weight-semibold);
        color: var(--color-primary);
      }

      &.selected {
        background: var(--color-primary);
        color: white;
      }

      &.in-range {
        background: rgba(var(--color-primary-rgb), 0.1);
      }

      &.range-start {
        background: var(--color-primary);
        color: white;
        border-radius: var(--radius-sm) 0 0 var(--radius-sm);
      }

      &.range-end {
        background: var(--color-primary);
        color: white;
        border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
      }

      &.range-start.range-end {
        border-radius: var(--radius-sm);
      }

      &.disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }
    }

    /* Time Selection */
    .time-selection {
      display: flex;
      gap: var(--spacing-4);
      margin-top: var(--spacing-3);
      padding-top: var(--spacing-3);
      border-top: 1px solid var(--border-color);
    }

    .time-group {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-1);
      flex: 1;

      label {
        font-size: var(--font-size-xs);
      }
    }

    .time-input {
      padding: var(--spacing-2);
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      border-radius: var(--radius-sm);
      font-size: var(--font-size-sm);
      color: var(--text-primary);

      &:focus {
        outline: none;
        border-color: var(--color-primary);
      }
    }

    /* Footer */
    .picker-footer {
      display: flex;
      justify-content: flex-end;
      gap: var(--spacing-2);
      padding: var(--spacing-3);
      border-top: 1px solid var(--border-color);
      background: var(--bg-secondary);
    }

    .footer-btn {
      padding: var(--spacing-2) var(--spacing-4);
      border-radius: var(--radius-md);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .cancel-btn {
      background: none;
      border: 1px solid var(--border-color);
      color: var(--text-secondary);

      &:hover {
        background: var(--bg-hover);
        border-color: var(--text-muted);
      }
    }

    .apply-btn {
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

    /* Hints & Errors */
    .picker-hint {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      margin: 0;
    }

    .picker-error {
      font-size: var(--font-size-xs);
      color: var(--color-danger);
      margin: 0;
    }

    /* Glow effect */
    .picker-glow .picker-trigger:focus {
      box-shadow: var(--glow-primary), 0 0 0 3px rgba(var(--color-primary-rgb), 0.1);
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DateRangePickerComponent),
      multi: true,
    },
  ],
  standalone: false,
})
export class DateRangePickerComponent implements ControlValueAccessor, OnInit {
  @Input() label?: string;
  @Input() placeholder = 'Select date range';
  @Input() hint?: string;
  @Input() error?: string;
  @Input() disabled = false;
  @Input() required = false;
  @Input() clearable = true;
  @Input() showPresets = true;
  @Input() showTime = false;
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() glow = false;
  @Input() dateFormat = 'MMM dd, yyyy';
  @Input() minDate?: Date;
  @Input() maxDate?: Date;

  @Output() opened = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
  @Output() rangeChange = new EventEmitter<DateRange>();

  isOpen = false;
  isFocused = false;
  viewDate = new Date();
  calendarDays: Date[] = [];
  weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  // Selection state
  selectionStart: Date | null = null;
  selectionEnd: Date | null = null;
  hoverDate: Date | null = null;

  // Time strings
  startTimeStr = '00:00';
  endTimeStr = '23:59';

  // Value
  value: DateRange = { start: null, end: null };

  // Presets
  presets: DatePreset[] = [
    {
      label: 'Today',
      getValue: () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const end = new Date(today);
        end.setHours(23, 59, 59, 999);
        return { start: today, end };
      },
    },
    {
      label: 'Yesterday',
      getValue: () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        const end = new Date(yesterday);
        end.setHours(23, 59, 59, 999);
        return { start: yesterday, end };
      },
    },
    {
      label: 'Last 7 Days',
      getValue: () => {
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        const start = new Date();
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        return { start, end };
      },
    },
    {
      label: 'Last 30 Days',
      getValue: () => {
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        const start = new Date();
        start.setDate(start.getDate() - 29);
        start.setHours(0, 0, 0, 0);
        return { start, end };
      },
    },
    {
      label: 'This Month',
      getValue: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        return { start, end };
      },
    },
    {
      label: 'Last Month',
      getValue: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        end.setHours(23, 59, 59, 999);
        return { start, end };
      },
    },
    {
      label: 'This Year',
      getValue: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 1);
        const end = new Date(now.getFullYear(), 11, 31);
        end.setHours(23, 59, 59, 999);
        return { start, end };
      },
    },
  ];

  private onChange: (value: DateRange) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(
    private elementRef: ElementRef,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.buildCalendar();
  }

  // =========================================================================
  // Computed Properties
  // =========================================================================

  get wrapperClasses(): string {
    const classes = ['picker-wrapper'];
    if (this.size !== 'md') classes.push(`picker-${this.size}`);
    if (this.glow) classes.push('picker-glow');
    return classes.join(' ');
  }

  get labelClasses(): string {
    return this.isFocused || this.isOpen ? 'label-focused' : '';
  }

  get triggerClasses(): string {
    const classes = ['picker-trigger'];
    if (this.isOpen) classes.push('open');
    if (this.disabled) classes.push('disabled');
    if (this.error) classes.push('error');
    return classes.join(' ');
  }

  get hasValue(): boolean {
    return this.value.start !== null && this.value.end !== null;
  }

  get canApply(): boolean {
    return this.selectionStart !== null && this.selectionEnd !== null;
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

    // Initialize selection from current value
    this.selectionStart = this.value.start;
    this.selectionEnd = this.value.end;

    // Set view date
    if (this.value.start) {
      this.viewDate = new Date(this.value.start);
    } else {
      this.viewDate = new Date();
    }
    this.buildCalendar();

    this.opened.emit();
  }

  closeDropdown(): void {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.isFocused = false;
    this.hoverDate = null;
    this.onTouched();
    this.closed.emit();
  }

  // =========================================================================
  // Calendar Navigation
  // =========================================================================

  previousMonth(): void {
    this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() - 1, 1);
    this.buildCalendar();
  }

  nextMonth(): void {
    this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() + 1, 1);
    this.buildCalendar();
  }

  buildCalendar(): void {
    const year = this.viewDate.getFullYear();
    const month = this.viewDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startOffset = firstDay.getDay();
    const totalDays = lastDay.getDate();

    this.calendarDays = [];

    // Previous month days
    for (let i = startOffset - 1; i >= 0; i--) {
      const day = new Date(year, month, -i);
      this.calendarDays.push(day);
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      this.calendarDays.push(new Date(year, month, i));
    }

    // Next month days (to fill grid)
    const remaining = 42 - this.calendarDays.length;
    for (let i = 1; i <= remaining; i++) {
      this.calendarDays.push(new Date(year, month + 1, i));
    }
  }

  getMonthName(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'long' });
  }

  // =========================================================================
  // Date Selection
  // =========================================================================

  selectDate(date: Date): void {
    if (this.isDateDisabled(date)) return;

    if (!this.selectionStart || (this.selectionStart && this.selectionEnd)) {
      // Start new selection
      this.selectionStart = date;
      this.selectionEnd = null;
    } else {
      // Complete selection
      if (date < this.selectionStart) {
        this.selectionEnd = this.selectionStart;
        this.selectionStart = date;
      } else {
        this.selectionEnd = date;
      }
    }
    this.cdr.markForCheck();
  }

  onDayHover(date: Date): void {
    if (this.selectionStart && !this.selectionEnd) {
      this.hoverDate = date;
    }
  }

  getDayClasses(date: Date): string {
    const classes = ['day-cell'];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isOutside = date.getMonth() !== this.viewDate.getMonth();
    const isToday = this.isSameDay(date, today);
    const isDisabled = this.isDateDisabled(date);
    const isStart = this.selectionStart && this.isSameDay(date, this.selectionStart);
    const isEnd = this.selectionEnd && this.isSameDay(date, this.selectionEnd);
    const inRange = this.isInRange(date);

    if (isOutside) classes.push('outside');
    if (isToday) classes.push('today');
    if (isDisabled) classes.push('disabled');
    if (isStart) classes.push('range-start', 'selected');
    if (isEnd) classes.push('range-end', 'selected');
    if (inRange && !isStart && !isEnd) classes.push('in-range');

    return classes.join(' ');
  }

  isInRange(date: Date): boolean {
    if (!this.selectionStart) return false;

    const end = this.selectionEnd || this.hoverDate;
    if (!end) return false;

    const startTime = this.selectionStart.getTime();
    const endTime = end.getTime();
    const dateTime = date.getTime();

    return dateTime > Math.min(startTime, endTime) && dateTime < Math.max(startTime, endTime);
  }

  isDateDisabled(date: Date): boolean {
    if (this.minDate && date < this.minDate) return true;
    if (this.maxDate && date > this.maxDate) return true;
    return false;
  }

  isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  }

  // =========================================================================
  // Presets
  // =========================================================================

  applyPreset(preset: DatePreset): void {
    const range = preset.getValue();
    this.selectionStart = range.start;
    this.selectionEnd = range.end;

    if (range.start) {
      this.viewDate = new Date(range.start);
      this.buildCalendar();
    }
    this.cdr.markForCheck();
  }

  isPresetActive(preset: DatePreset): boolean {
    if (!this.selectionStart || !this.selectionEnd) return false;

    const range = preset.getValue();
    return (
      range.start !== null &&
      range.end !== null &&
      this.isSameDay(this.selectionStart, range.start) &&
      this.isSameDay(this.selectionEnd, range.end)
    );
  }

  // =========================================================================
  // Time Handling
  // =========================================================================

  onStartTimeChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.startTimeStr = input.value;
  }

  onEndTimeChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.endTimeStr = input.value;
  }

  // =========================================================================
  // Actions
  // =========================================================================

  apply(): void {
    if (!this.selectionStart || !this.selectionEnd) return;

    const start = new Date(this.selectionStart);
    const end = new Date(this.selectionEnd);

    if (this.showTime) {
      const [startHour, startMin] = this.startTimeStr.split(':').map(Number);
      const [endHour, endMin] = this.endTimeStr.split(':').map(Number);
      start.setHours(startHour, startMin, 0, 0);
      end.setHours(endHour, endMin, 59, 999);
    } else {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    this.value = { start, end };
    this.onChange(this.value);
    this.rangeChange.emit(this.value);
    this.closeDropdown();
  }

  cancel(): void {
    this.closeDropdown();
  }

  clear(event?: Event): void {
    event?.stopPropagation();
    if (this.disabled) return;

    this.value = { start: null, end: null };
    this.selectionStart = null;
    this.selectionEnd = null;
    this.onChange(this.value);
    this.rangeChange.emit(this.value);
    this.cdr.markForCheck();
  }

  // =========================================================================
  // Formatting
  // =========================================================================

  formatDate(date: Date | null): string {
    if (!date) return '';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  // =========================================================================
  // Keyboard
  // =========================================================================

  onTriggerKeydown(event: KeyboardEvent): void {
    if (this.disabled) return;

    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.toggleDropdown();
        break;
      case 'Escape':
        this.closeDropdown();
        break;
    }
  }

  // =========================================================================
  // Click Outside
  // =========================================================================

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.closeDropdown();
    }
  }

  // =========================================================================
  // ControlValueAccessor
  // =========================================================================

  writeValue(value: DateRange | null): void {
    if (value && value.start && value.end) {
      this.value = {
        start: new Date(value.start),
        end: new Date(value.end),
      };
    } else {
      this.value = { start: null, end: null };
    }
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: DateRange) => void): void {
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
