/**
 * Range Slider Component
 *
 * A dual-handle range slider for selecting numeric ranges,
 * with optional min/max inputs and formatting.
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  forwardRef,
  ElementRef,
  ViewChild,
  AfterViewInit,
  ChangeDetectorRef,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface RangeValue {
  min: number;
  max: number;
}

@Component({
  selector: 'app-range-slider',
  template: `
    <div [class]="wrapperClasses">
      <label *ngIf="label" class="slider-label">
        {{ label }}
        <span *ngIf="required" class="required-mark">*</span>
      </label>

      <!-- Value Display -->
      <div class="value-display" *ngIf="showValues">
        <div class="value-input-group">
          <label class="value-label">Min</label>
          <input
            type="number"
            class="value-input"
            [value]="value.min"
            [min]="min"
            [max]="value.max"
            [step]="step"
            [disabled]="disabled"
            (change)="onMinInputChange($event)"
          />
        </div>
        <span class="value-separator">-</span>
        <div class="value-input-group">
          <label class="value-label">Max</label>
          <input
            type="number"
            class="value-input"
            [value]="value.max"
            [min]="value.min"
            [max]="max"
            [step]="step"
            [disabled]="disabled"
            (change)="onMaxInputChange($event)"
          />
        </div>
      </div>

      <!-- Slider Track -->
      <div
        #track
        class="slider-track"
        [class.disabled]="disabled"
        (mousedown)="onTrackClick($event)"
      >
        <!-- Fill -->
        <div
          class="slider-fill"
          [style.left.%]="fillLeft"
          [style.width.%]="fillWidth"
        ></div>

        <!-- Min Handle -->
        <div
          #minHandle
          class="slider-handle min-handle"
          [class.active]="activeHandle === 'min'"
          [style.left.%]="minHandlePosition"
          (mousedown)="onHandleMouseDown($event, 'min')"
          (touchstart)="onHandleTouchStart($event, 'min')"
          [attr.tabindex]="disabled ? -1 : 0"
          (keydown)="onHandleKeydown($event, 'min')"
          role="slider"
          [attr.aria-valuemin]="min"
          [attr.aria-valuemax]="value.max"
          [attr.aria-valuenow]="value.min"
          [attr.aria-label]="'Minimum value'"
        >
          <span class="handle-tooltip" *ngIf="showTooltip">{{ formatValue(value.min) }}</span>
        </div>

        <!-- Max Handle -->
        <div
          #maxHandle
          class="slider-handle max-handle"
          [class.active]="activeHandle === 'max'"
          [style.left.%]="maxHandlePosition"
          (mousedown)="onHandleMouseDown($event, 'max')"
          (touchstart)="onHandleTouchStart($event, 'max')"
          [attr.tabindex]="disabled ? -1 : 0"
          (keydown)="onHandleKeydown($event, 'max')"
          role="slider"
          [attr.aria-valuemin]="value.min"
          [attr.aria-valuemax]="max"
          [attr.aria-valuenow]="value.max"
          [attr.aria-label]="'Maximum value'"
        >
          <span class="handle-tooltip" *ngIf="showTooltip">{{ formatValue(value.max) }}</span>
        </div>

        <!-- Tick Marks -->
        <div class="tick-marks" *ngIf="showTicks">
          <span
            *ngFor="let tick of ticks"
            class="tick"
            [style.left.%]="getTickPosition(tick)"
          ></span>
        </div>
      </div>

      <!-- Scale Labels -->
      <div class="scale-labels" *ngIf="showScale">
        <span class="scale-label">{{ formatValue(min) }}</span>
        <span class="scale-label">{{ formatValue(max) }}</span>
      </div>

      <p *ngIf="hint && !error" class="slider-hint">{{ hint }}</p>
      <p *ngIf="error" class="slider-error">{{ error }}</p>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .slider-wrapper {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-3);
    }

    .slider-label {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: var(--text-secondary);
    }

    .required-mark {
      color: var(--color-danger);
      margin-left: 2px;
    }

    /* Value Display */
    .value-display {
      display: flex;
      align-items: center;
      gap: var(--spacing-3);
    }

    .value-input-group {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-1);
      flex: 1;
    }

    .value-label {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
    }

    .value-input {
      width: 100%;
      padding: var(--spacing-2) var(--spacing-3);
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      border-radius: var(--radius-md);
      font-size: var(--font-size-sm);
      color: var(--text-primary);
      text-align: center;
      transition: all var(--transition-fast);

      &:hover:not(:disabled) {
        border-color: var(--text-muted);
      }

      &:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.15);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        background: var(--bg-tertiary);
      }

      // Hide spinner buttons
      &::-webkit-outer-spin-button,
      &::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      -moz-appearance: textfield;
    }

    .value-separator {
      color: var(--text-muted);
      padding-top: 18px;
    }

    /* Slider Track */
    .slider-track {
      position: relative;
      height: 6px;
      background: var(--bg-tertiary);
      border-radius: var(--radius-full);
      cursor: pointer;
      margin: var(--spacing-4) var(--spacing-2);
      touch-action: none;

      &.disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }
    }

    /* Fill */
    .slider-fill {
      position: absolute;
      height: 100%;
      background: var(--color-primary);
      border-radius: var(--radius-full);
      pointer-events: none;
    }

    /* Handle */
    .slider-handle {
      position: absolute;
      top: 50%;
      width: 20px;
      height: 20px;
      background: var(--bg-primary);
      border: 2px solid var(--color-primary);
      border-radius: var(--radius-full);
      transform: translate(-50%, -50%);
      cursor: grab;
      transition: transform var(--transition-fast), box-shadow var(--transition-fast);
      z-index: 1;

      &:hover,
      &.active {
        transform: translate(-50%, -50%) scale(1.1);
        box-shadow: 0 0 0 4px rgba(var(--color-primary-rgb), 0.2);
      }

      &.active {
        cursor: grabbing;
        z-index: 2;
      }

      &:focus {
        outline: none;
        box-shadow: 0 0 0 4px rgba(var(--color-primary-rgb), 0.3);
      }
    }

    .slider-wrapper.slider-sm .slider-handle {
      width: 16px;
      height: 16px;
    }

    .slider-wrapper.slider-lg .slider-handle {
      width: 24px;
      height: 24px;
    }

    /* Tooltip */
    .handle-tooltip {
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      padding: var(--spacing-1) var(--spacing-2);
      background: var(--bg-tertiary);
      border-radius: var(--radius-sm);
      font-size: var(--font-size-xs);
      color: var(--text-primary);
      white-space: nowrap;
      margin-bottom: var(--spacing-2);
      opacity: 0;
      visibility: hidden;
      transition: all var(--transition-fast);

      &::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 4px solid transparent;
        border-top-color: var(--bg-tertiary);
      }
    }

    .slider-handle:hover .handle-tooltip,
    .slider-handle.active .handle-tooltip {
      opacity: 1;
      visibility: visible;
    }

    /* Tick Marks */
    .tick-marks {
      position: absolute;
      top: 50%;
      left: 0;
      right: 0;
      pointer-events: none;
    }

    .tick {
      position: absolute;
      width: 2px;
      height: 8px;
      background: var(--border-color);
      transform: translate(-50%, -50%);
      border-radius: 1px;
    }

    /* Scale Labels */
    .scale-labels {
      display: flex;
      justify-content: space-between;
      margin-top: var(--spacing-1);
      padding: 0 var(--spacing-2);
    }

    .scale-label {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
    }

    /* Hints & Errors */
    .slider-hint {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      margin: 0;
    }

    .slider-error {
      font-size: var(--font-size-xs);
      color: var(--color-danger);
      margin: 0;
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RangeSliderComponent),
      multi: true,
    },
  ],
  standalone: false,
})
export class RangeSliderComponent implements ControlValueAccessor, AfterViewInit, OnChanges {
  @Input() label?: string;
  @Input() hint?: string;
  @Input() error?: string;
  @Input() disabled = false;
  @Input() required = false;
  @Input() min = 0;
  @Input() max = 100;
  @Input() step = 1;
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() showValues = true;
  @Input() showTooltip = true;
  @Input() showTicks = false;
  @Input() showScale = false;
  @Input() tickCount = 5;
  @Input() formatFn?: (value: number) => string;
  @Input() prefix = '';
  @Input() suffix = '';

  @Output() rangeChange = new EventEmitter<RangeValue>();

  @ViewChild('track') trackRef!: ElementRef<HTMLDivElement>;
  @ViewChild('minHandle') minHandleRef!: ElementRef<HTMLDivElement>;
  @ViewChild('maxHandle') maxHandleRef!: ElementRef<HTMLDivElement>;

  value: RangeValue = { min: 0, max: 100 };
  activeHandle: 'min' | 'max' | null = null;
  ticks: number[] = [];

  private onChange: (value: RangeValue) => void = () => {};
  private onTouched: () => void = () => {};

  private boundMouseMove = this.onMouseMove.bind(this);
  private boundMouseUp = this.onMouseUp.bind(this);
  private boundTouchMove = this.onTouchMove.bind(this);
  private boundTouchEnd = this.onTouchEnd.bind(this);

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.calculateTicks();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['min'] || changes['max'] || changes['tickCount']) {
      this.calculateTicks();
    }
  }

  // =========================================================================
  // Computed Properties
  // =========================================================================

  get wrapperClasses(): string {
    const classes = ['slider-wrapper'];
    if (this.size !== 'md') classes.push(`slider-${this.size}`);
    return classes.join(' ');
  }

  get minHandlePosition(): number {
    return this.valueToPercent(this.value.min);
  }

  get maxHandlePosition(): number {
    return this.valueToPercent(this.value.max);
  }

  get fillLeft(): number {
    return this.minHandlePosition;
  }

  get fillWidth(): number {
    return this.maxHandlePosition - this.minHandlePosition;
  }

  // =========================================================================
  // Value Helpers
  // =========================================================================

  private valueToPercent(value: number): number {
    return ((value - this.min) / (this.max - this.min)) * 100;
  }

  private percentToValue(percent: number): number {
    const raw = (percent / 100) * (this.max - this.min) + this.min;
    return this.roundToStep(raw);
  }

  private roundToStep(value: number): number {
    const steps = Math.round((value - this.min) / this.step);
    return Math.max(this.min, Math.min(this.max, this.min + steps * this.step));
  }

  private clampValue(value: number, handle: 'min' | 'max'): number {
    if (handle === 'min') {
      return Math.max(this.min, Math.min(this.value.max - this.step, value));
    } else {
      return Math.min(this.max, Math.max(this.value.min + this.step, value));
    }
  }

  formatValue(value: number): string {
    if (this.formatFn) {
      return this.formatFn(value);
    }
    return `${this.prefix}${value}${this.suffix}`;
  }

  // =========================================================================
  // Ticks
  // =========================================================================

  private calculateTicks(): void {
    if (!this.showTicks || this.tickCount < 2) {
      this.ticks = [];
      return;
    }

    this.ticks = [];
    const interval = (this.max - this.min) / (this.tickCount - 1);
    for (let i = 0; i < this.tickCount; i++) {
      this.ticks.push(this.min + interval * i);
    }
  }

  getTickPosition(tick: number): number {
    return this.valueToPercent(tick);
  }

  // =========================================================================
  // Input Changes
  // =========================================================================

  onMinInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = this.clampValue(Number(input.value), 'min');
    this.updateValue({ min: value, max: this.value.max });
  }

  onMaxInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = this.clampValue(Number(input.value), 'max');
    this.updateValue({ min: this.value.min, max: value });
  }

  // =========================================================================
  // Mouse Events
  // =========================================================================

  onTrackClick(event: MouseEvent): void {
    if (this.disabled) return;

    const percent = this.getPercentFromEvent(event);
    const value = this.percentToValue(percent);

    // Determine which handle to move based on proximity
    const minDist = Math.abs(value - this.value.min);
    const maxDist = Math.abs(value - this.value.max);

    if (minDist < maxDist) {
      this.updateValue({ min: this.clampValue(value, 'min'), max: this.value.max });
    } else {
      this.updateValue({ min: this.value.min, max: this.clampValue(value, 'max') });
    }
  }

  onHandleMouseDown(event: MouseEvent, handle: 'min' | 'max'): void {
    if (this.disabled) return;

    event.preventDefault();
    event.stopPropagation();
    this.activeHandle = handle;

    document.addEventListener('mousemove', this.boundMouseMove);
    document.addEventListener('mouseup', this.boundMouseUp);
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.activeHandle) return;

    const percent = this.getPercentFromEvent(event);
    const value = this.percentToValue(percent);
    const clampedValue = this.clampValue(value, this.activeHandle);

    if (this.activeHandle === 'min') {
      this.updateValue({ min: clampedValue, max: this.value.max });
    } else {
      this.updateValue({ min: this.value.min, max: clampedValue });
    }
  }

  private onMouseUp(): void {
    this.activeHandle = null;
    this.onTouched();
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mouseup', this.boundMouseUp);
  }

  // =========================================================================
  // Touch Events
  // =========================================================================

  onHandleTouchStart(event: TouchEvent, handle: 'min' | 'max'): void {
    if (this.disabled) return;

    event.preventDefault();
    this.activeHandle = handle;

    document.addEventListener('touchmove', this.boundTouchMove, { passive: false });
    document.addEventListener('touchend', this.boundTouchEnd);
  }

  private onTouchMove(event: TouchEvent): void {
    if (!this.activeHandle) return;

    event.preventDefault();
    const touch = event.touches[0];
    const percent = this.getPercentFromTouch(touch);
    const value = this.percentToValue(percent);
    const clampedValue = this.clampValue(value, this.activeHandle);

    if (this.activeHandle === 'min') {
      this.updateValue({ min: clampedValue, max: this.value.max });
    } else {
      this.updateValue({ min: this.value.min, max: clampedValue });
    }
  }

  private onTouchEnd(): void {
    this.activeHandle = null;
    this.onTouched();
    document.removeEventListener('touchmove', this.boundTouchMove);
    document.removeEventListener('touchend', this.boundTouchEnd);
  }

  // =========================================================================
  // Keyboard Events
  // =========================================================================

  onHandleKeydown(event: KeyboardEvent, handle: 'min' | 'max'): void {
    if (this.disabled) return;

    let delta = 0;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        delta = -this.step;
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        delta = this.step;
        break;
      case 'PageDown':
        delta = -this.step * 10;
        break;
      case 'PageUp':
        delta = this.step * 10;
        break;
      case 'Home':
        if (handle === 'min') {
          this.updateValue({ min: this.min, max: this.value.max });
        }
        return;
      case 'End':
        if (handle === 'max') {
          this.updateValue({ min: this.value.min, max: this.max });
        }
        return;
      default:
        return;
    }

    event.preventDefault();

    const currentValue = handle === 'min' ? this.value.min : this.value.max;
    const newValue = this.clampValue(currentValue + delta, handle);

    if (handle === 'min') {
      this.updateValue({ min: newValue, max: this.value.max });
    } else {
      this.updateValue({ min: this.value.min, max: newValue });
    }
  }

  // =========================================================================
  // Position Helpers
  // =========================================================================

  private getPercentFromEvent(event: MouseEvent): number {
    const track = this.trackRef.nativeElement;
    const rect = track.getBoundingClientRect();
    const percent = ((event.clientX - rect.left) / rect.width) * 100;
    return Math.max(0, Math.min(100, percent));
  }

  private getPercentFromTouch(touch: Touch): number {
    const track = this.trackRef.nativeElement;
    const rect = track.getBoundingClientRect();
    const percent = ((touch.clientX - rect.left) / rect.width) * 100;
    return Math.max(0, Math.min(100, percent));
  }

  // =========================================================================
  // Value Update
  // =========================================================================

  private updateValue(newValue: RangeValue): void {
    this.value = newValue;
    this.onChange(this.value);
    this.rangeChange.emit(this.value);
    this.cdr.markForCheck();
  }

  // =========================================================================
  // ControlValueAccessor
  // =========================================================================

  writeValue(value: RangeValue | null): void {
    if (value) {
      this.value = {
        min: Math.max(this.min, Math.min(this.max, value.min)),
        max: Math.max(this.min, Math.min(this.max, value.max)),
      };
    } else {
      this.value = { min: this.min, max: this.max };
    }
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: RangeValue) => void): void {
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
