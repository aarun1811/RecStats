import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loading-spinner',
  template: `
    <div [class]="containerClasses">
      <div [class]="spinnerClasses">
        <div class="spinner-ring"></div>
        <div class="spinner-ring"></div>
        <div class="spinner-ring"></div>
        <div class="spinner-ring"></div>
      </div>
      <span *ngIf="text" class="spinner-text">{{ text }}</span>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .spinner-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-3);
    }

    .spinner-container-inline {
      display: inline-flex;
      flex-direction: row;
      gap: var(--spacing-2);
    }

    .spinner-container-fullscreen {
      position: fixed;
      inset: 0;
      background: rgba(var(--bg-primary), 0.9);
      backdrop-filter: blur(4px);
      z-index: var(--z-modal);
    }

    .spinner-container-overlay {
      position: absolute;
      inset: 0;
      background: rgba(var(--bg-primary), 0.8);
      backdrop-filter: blur(2px);
      z-index: 10;
    }

    .spinner {
      position: relative;
      display: inline-block;
    }

    .spinner-sm {
      width: 20px;
      height: 20px;
    }

    .spinner-md {
      width: 40px;
      height: 40px;
    }

    .spinner-lg {
      width: 60px;
      height: 60px;
    }

    .spinner-ring {
      position: absolute;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      border: 3px solid transparent;
      border-top-color: var(--color-primary);
      animation: spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
    }

    .spinner-sm .spinner-ring {
      border-width: 2px;
    }

    .spinner-ring:nth-child(1) {
      animation-delay: -0.45s;
    }

    .spinner-ring:nth-child(2) {
      animation-delay: -0.3s;
      opacity: 0.8;
    }

    .spinner-ring:nth-child(3) {
      animation-delay: -0.15s;
      opacity: 0.6;
    }

    .spinner-ring:nth-child(4) {
      opacity: 0.4;
    }

    // Glow variant
    .spinner-glow .spinner-ring {
      box-shadow: 0 0 10px rgba(var(--color-primary-rgb), 0.5);
    }

    // Dot variant
    .spinner-dots {
      display: flex;
      gap: 6px;

      .spinner-ring {
        position: static;
        width: 8px;
        height: 8px;
        border: none;
        border-radius: 50%;
        background: var(--color-primary);
        animation: dotPulse 1.4s ease-in-out infinite both;

        &:nth-child(1) {
          animation-delay: -0.32s;
        }

        &:nth-child(2) {
          animation-delay: -0.16s;
        }

        &:nth-child(3) {
          animation-delay: 0;
        }

        &:nth-child(4) {
          display: none;
        }
      }
    }

    .spinner-text {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
    }

    @keyframes spin {
      0% {
        transform: rotate(0deg);
      }
      100% {
        transform: rotate(360deg);
      }
    }

    @keyframes dotPulse {
      0%, 80%, 100% {
        transform: scale(0);
        opacity: 0.5;
      }
      40% {
        transform: scale(1);
        opacity: 1;
      }
    }
  `]
})
export class LoadingSpinnerComponent {
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() text?: string;
  @Input() variant: 'default' | 'glow' | 'dots' = 'default';
  @Input() mode: 'inline' | 'block' | 'overlay' | 'fullscreen' = 'block';

  get containerClasses(): string {
    const classes = ['spinner-container'];

    if (this.mode === 'inline') classes.push('spinner-container-inline');
    if (this.mode === 'fullscreen') classes.push('spinner-container-fullscreen');
    if (this.mode === 'overlay') classes.push('spinner-container-overlay');

    return classes.join(' ');
  }

  get spinnerClasses(): string {
    const classes = ['spinner', `spinner-${this.size}`];

    if (this.variant === 'glow') classes.push('spinner-glow');
    if (this.variant === 'dots') classes.push('spinner-dots');

    return classes.join(' ');
  }
}
