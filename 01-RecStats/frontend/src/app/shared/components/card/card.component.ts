import { Component, Input } from '@angular/core';

@Component({
    selector: 'app-card',
    template: `
    <div [class]="cardClasses" [style.padding]="noPadding ? '0' : null">
      <div *ngIf="title || subtitle" class="card-header">
        <div class="card-title-section">
          <h3 *ngIf="title" class="card-title">{{ title }}</h3>
          <p *ngIf="subtitle" class="card-subtitle">{{ subtitle }}</p>
        </div>
        <div class="card-actions">
          <ng-content select="[card-actions]"></ng-content>
        </div>
      </div>
      <div class="card-content">
        <ng-content></ng-content>
      </div>
      <div *ngIf="hasFooter" class="card-footer">
        <ng-content select="[card-footer]"></ng-content>
      </div>
    </div>
  `,
    styles: [`
    :host {
      display: block;
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--card-shadow);
      padding: var(--spacing-6);
      transition: all var(--transition-normal);
    }

    .card-hoverable {
      cursor: pointer;

      &:hover {
        border-color: rgba(var(--color-primary-rgb), 0.3);
        box-shadow: var(--glow-primary), var(--shadow-lg);
        transform: translateY(-2px);
      }
    }

    .card-glow {
      &:hover {
        box-shadow: var(--glow-primary-intense), var(--shadow-xl);
      }
    }

    .card-compact {
      padding: var(--spacing-4);
    }

    .card-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--spacing-4);
      margin-bottom: var(--spacing-4);
    }

    .card-title-section {
      flex: 1;
      min-width: 0;
    }

    .card-title {
      font-size: var(--font-size-lg);
      font-weight: var(--font-weight-semibold);
      color: var(--text-primary);
      margin: 0;
      line-height: 1.3;
    }

    .card-subtitle {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      margin: var(--spacing-1) 0 0 0;
    }

    .card-actions {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      flex-shrink: 0;
    }

    .card-content {
      // Content styles handled by projected content
    }

    .card-footer {
      margin-top: var(--spacing-4);
      padding-top: var(--spacing-4);
      border-top: 1px solid var(--border-color);
    }

    // Bordered variant with gradient border
    .card-bordered {
      position: relative;
      background: var(--card-bg);
      border: none;

      &::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: var(--radius-lg);
        padding: 1px;
        background: linear-gradient(
          135deg,
          rgba(var(--color-primary-rgb), 0.5),
          rgba(var(--color-primary-rgb), 0.1),
          rgba(var(--color-primary-rgb), 0.3)
        );
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        pointer-events: none;
      }
    }

    // Elevated variant
    .card-elevated {
      box-shadow: var(--shadow-lg);

      &:hover {
        box-shadow: var(--shadow-xl), var(--glow-primary);
      }
    }
  `],
    standalone: false
})
export class CardComponent {
  @Input() title?: string;
  @Input() subtitle?: string;
  @Input() hoverable = false;
  @Input() glow = false;
  @Input() compact = false;
  @Input() noPadding = false;
  @Input() bordered = false;
  @Input() elevated = false;
  @Input() hasFooter = false;

  get cardClasses(): string {
    const classes = ['card'];

    if (this.hoverable) classes.push('card-hoverable');
    if (this.glow) classes.push('card-glow');
    if (this.compact) classes.push('card-compact');
    if (this.bordered) classes.push('card-bordered');
    if (this.elevated) classes.push('card-elevated');

    return classes.join(' ');
  }
}
