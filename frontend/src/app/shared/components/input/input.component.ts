import { Component, Input, Output, EventEmitter, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
    selector: 'app-input',
    template: `
    <div [class]="inputWrapperClasses">
      <label *ngIf="label" [class]="labelClasses" [for]="inputId">
        {{ label }}
        <span *ngIf="required" class="required-mark">*</span>
      </label>
      <div class="input-container">
        <span *ngIf="prefixIcon" class="input-prefix">
          <ng-content select="[prefix]"></ng-content>
        </span>
        <input
          [type]="type"
          [id]="inputId"
          [placeholder]="placeholder"
          [disabled]="disabled"
          [readonly]="readonly"
          [value]="value"
          [class]="inputClasses"
          (input)="onInput($event)"
          (blur)="onBlur()"
          (focus)="onFocus()"
        />
        <span *ngIf="suffixIcon" class="input-suffix">
          <ng-content select="[suffix]"></ng-content>
        </span>
        <span *ngIf="clearable && value" class="input-clear" (click)="clear()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </span>
      </div>
      <p *ngIf="hint && !error" class="input-hint">{{ hint }}</p>
      <p *ngIf="error" class="input-error">{{ error }}</p>
    </div>
  `,
    styles: [`
    :host {
      display: block;
    }

    .input-wrapper {
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

    .input-container {
      position: relative;
      display: flex;
      align-items: center;
    }

    input {
      width: 100%;
      padding: var(--spacing-3) var(--spacing-4);
      font-family: var(--font-family-primary);
      font-size: var(--font-size-sm);
      color: var(--text-primary);
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      border-radius: var(--radius-md);
      transition: all var(--transition-fast);

      &::placeholder {
        color: var(--input-placeholder);
      }

      &:hover:not(:disabled):not(:focus) {
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

      &:read-only {
        background: var(--bg-tertiary);
      }
    }

    .input-sm input {
      padding: var(--spacing-2) var(--spacing-3);
      font-size: var(--font-size-xs);
    }

    .input-lg input {
      padding: var(--spacing-4) var(--spacing-5);
      font-size: var(--font-size-base);
    }

    .input-error-state input {
      border-color: var(--color-danger);

      &:focus {
        box-shadow: 0 0 0 3px rgba(var(--color-danger-rgb), 0.15);
      }
    }

    .input-success-state input {
      border-color: var(--color-success);

      &:focus {
        box-shadow: 0 0 0 3px rgba(var(--color-success-rgb), 0.15);
      }
    }

    .input-prefix,
    .input-suffix {
      position: absolute;
      display: flex;
      align-items: center;
      color: var(--text-muted);
      pointer-events: none;
    }

    .input-prefix {
      left: var(--spacing-3);
    }

    .input-suffix {
      right: var(--spacing-3);
    }

    .has-prefix input {
      padding-left: calc(var(--spacing-4) + 24px);
    }

    .has-suffix input {
      padding-right: calc(var(--spacing-4) + 24px);
    }

    .input-clear {
      position: absolute;
      right: var(--spacing-3);
      display: flex;
      align-items: center;
      color: var(--text-muted);
      cursor: pointer;
      padding: var(--spacing-1);
      border-radius: var(--radius-sm);
      transition: all var(--transition-fast);

      &:hover {
        color: var(--text-primary);
        background: var(--bg-hover);
      }
    }

    .input-hint {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      margin: 0;
    }

    .input-error {
      font-size: var(--font-size-xs);
      color: var(--color-danger);
      margin: 0;
    }

    // Glow effect on focus
    .input-glow input:focus {
      box-shadow: var(--glow-primary), 0 0 0 3px rgba(var(--color-primary-rgb), 0.1);
    }
  `],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => InputComponent),
            multi: true
        }
    ],
    standalone: false
})
export class InputComponent implements ControlValueAccessor {
  @Input() label?: string;
  @Input() placeholder = '';
  @Input() type = 'text';
  @Input() hint?: string;
  @Input() error?: string;
  @Input() disabled = false;
  @Input() readonly = false;
  @Input() required = false;
  @Input() clearable = false;
  @Input() prefixIcon = false;
  @Input() suffixIcon = false;
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() glow = false;

  @Output() cleared = new EventEmitter<void>();
  @Output() focused = new EventEmitter<void>();
  @Output() blurred = new EventEmitter<void>();

  value = '';
  isFocused = false;
  inputId = `input-${Math.random().toString(36).substring(2, 9)}`;

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  get inputWrapperClasses(): string {
    const classes = ['input-wrapper'];

    if (this.size !== 'md') classes.push(`input-${this.size}`);
    if (this.error) classes.push('input-error-state');
    if (this.prefixIcon) classes.push('has-prefix');
    if (this.suffixIcon || this.clearable) classes.push('has-suffix');
    if (this.glow) classes.push('input-glow');

    return classes.join(' ');
  }

  get labelClasses(): string {
    return this.isFocused ? 'label-focused' : '';
  }

  get inputClasses(): string {
    return '';
  }

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.value = input.value;
    this.onChange(this.value);
  }

  onFocus(): void {
    this.isFocused = true;
    this.focused.emit();
  }

  onBlur(): void {
    this.isFocused = false;
    this.onTouched();
    this.blurred.emit();
  }

  clear(): void {
    this.value = '';
    this.onChange('');
    this.cleared.emit();
  }

  // ControlValueAccessor implementation
  writeValue(value: string): void {
    this.value = value || '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
