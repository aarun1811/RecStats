import { Component, Input, Output, EventEmitter } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-button',
  template: `
    <button
      [type]="type"
      [class]="buttonClasses"
      [disabled]="disabled || loading"
      (click)="handleClick($event)"
    >
      <span *ngIf="loading" class="spinner"></span>
      <ng-content *ngIf="!loading"></ng-content>
      <span *ngIf="loading && loadingText">{{ loadingText }}</span>
    </button>
  `,
  styles: [`
    :host {
      display: inline-block;
    }

    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-2);
      font-family: var(--font-family-primary);
      font-weight: var(--font-weight-medium);
      border-radius: var(--radius-md);
      border: none;
      cursor: pointer;
      transition: all var(--transition-normal);
      white-space: nowrap;
      position: relative;
      overflow: hidden;

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      &:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }
    }

    // Size variants
    .btn-sm {
      padding: var(--spacing-1) var(--spacing-3);
      font-size: var(--font-size-xs);
      height: 32px;
    }

    .btn-md {
      padding: var(--spacing-2) var(--spacing-4);
      font-size: var(--font-size-sm);
      height: 40px;
    }

    .btn-lg {
      padding: var(--spacing-3) var(--spacing-6);
      font-size: var(--font-size-base);
      height: 48px;
    }

    // Primary variant
    .btn-primary {
      background: var(--color-primary);
      color: white;

      &:hover:not(:disabled) {
        background: var(--color-primary-light);
        box-shadow: var(--glow-primary);
      }

      &:active:not(:disabled) {
        background: var(--color-primary-dark);
        transform: scale(0.98);
      }
    }

    // Secondary variant
    .btn-secondary {
      background: var(--bg-tertiary);
      color: var(--text-primary);
      border: 1px solid var(--border-color);

      &:hover:not(:disabled) {
        background: var(--bg-hover);
        border-color: var(--color-primary);
        box-shadow: var(--glow-primary);
      }

      &:active:not(:disabled) {
        background: var(--bg-active);
        transform: scale(0.98);
      }
    }

    // Ghost variant
    .btn-ghost {
      background: transparent;
      color: var(--text-secondary);

      &:hover:not(:disabled) {
        background: var(--bg-hover);
        color: var(--text-primary);
      }

      &:active:not(:disabled) {
        background: var(--bg-active);
        transform: scale(0.98);
      }
    }

    // Danger variant
    .btn-danger {
      background: var(--color-danger);
      color: white;

      &:hover:not(:disabled) {
        background: #c0392b;
        box-shadow: var(--glow-danger);
      }

      &:active:not(:disabled) {
        background: #a93226;
        transform: scale(0.98);
      }
    }

    // Success variant
    .btn-success {
      background: var(--color-success);
      color: white;

      &:hover:not(:disabled) {
        background: #27ae60;
        box-shadow: var(--glow-success);
      }

      &:active:not(:disabled) {
        background: #1e8449;
        transform: scale(0.98);
      }
    }

    // Full width
    .btn-block {
      width: 100%;
    }

    // Icon only
    .btn-icon-only {
      padding: var(--spacing-2);
      aspect-ratio: 1;
    }

    // Loading spinner
    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid transparent;
      border-top-color: currentColor;
      border-radius: 50%;
      animation: spin 0.75s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `]
})
export class ButtonComponent {
  @Input() variant: ButtonVariant = 'primary';
  @Input() size: ButtonSize = 'md';
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() disabled = false;
  @Input() loading = false;
  @Input() loadingText?: string;
  @Input() fullWidth = false;
  @Input() iconOnly = false;

  @Output() clicked = new EventEmitter<MouseEvent>();

  get buttonClasses(): string {
    const classes = [
      `btn-${this.variant}`,
      `btn-${this.size}`,
    ];

    if (this.fullWidth) {
      classes.push('btn-block');
    }

    if (this.iconOnly) {
      classes.push('btn-icon-only');
    }

    return classes.join(' ');
  }

  handleClick(event: MouseEvent): void {
    if (!this.disabled && !this.loading) {
      this.clicked.emit(event);
    }
  }
}
