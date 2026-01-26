import { Component, Input } from '@angular/core';

export type TrendDirection = 'up' | 'down' | 'neutral';

@Component({
  selector: 'app-kpi-card',
  template: `
    <div [class]="cardClasses">
      <div class="kpi-header">
        <span class="kpi-label">{{ label }}</span>
        <div *ngIf="icon" class="kpi-icon">
          <ng-content select="[kpi-icon]"></ng-content>
        </div>
      </div>
      <div class="kpi-value-section">
        <span class="kpi-value">
          <span *ngIf="prefix" class="kpi-prefix">{{ prefix }}</span>
          {{ formattedValue }}
          <span *ngIf="suffix" class="kpi-suffix">{{ suffix }}</span>
        </span>
      </div>
      <div *ngIf="showTrend" class="kpi-trend" [class]="trendClasses">
        <svg *ngIf="trend === 'up'" class="trend-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
          <polyline points="17 6 23 6 23 12"></polyline>
        </svg>
        <svg *ngIf="trend === 'down'" class="trend-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline>
          <polyline points="17 18 23 18 23 12"></polyline>
        </svg>
        <span *ngIf="trend === 'neutral'" class="trend-icon-neutral">—</span>
        <span class="trend-value">{{ trendValue }}</span>
        <span *ngIf="trendLabel" class="trend-label">{{ trendLabel }}</span>
      </div>
      <div *ngIf="subtitle" class="kpi-subtitle">{{ subtitle }}</div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .kpi-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-lg);
      padding: var(--spacing-5);
      transition: all var(--transition-normal);
      position: relative;
      overflow: hidden;

      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: var(--color-primary);
        opacity: 0;
        transition: opacity var(--transition-normal);
      }

      &:hover {
        border-color: rgba(var(--color-primary-rgb), 0.3);
        box-shadow: var(--glow-primary);

        &::before {
          opacity: 1;
        }
      }
    }

    .kpi-card-compact {
      padding: var(--spacing-4);
    }

    .kpi-card-large {
      padding: var(--spacing-6);
    }

    // Color variants
    .kpi-card-success {
      &::before {
        background: var(--color-success);
      }
      &:hover {
        box-shadow: var(--glow-success);
      }
      .kpi-value {
        color: var(--color-success);
      }
    }

    .kpi-card-warning {
      &::before {
        background: var(--color-warning);
      }
      &:hover {
        box-shadow: var(--glow-warning);
      }
      .kpi-value {
        color: var(--color-warning);
      }
    }

    .kpi-card-danger {
      &::before {
        background: var(--color-danger);
      }
      &:hover {
        box-shadow: var(--glow-danger);
      }
      .kpi-value {
        color: var(--color-danger);
      }
    }

    .kpi-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--spacing-2);
    }

    .kpi-label {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .kpi-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      background: var(--bg-tertiary);
      border-radius: var(--radius-md);
      color: var(--text-muted);
    }

    .kpi-value-section {
      margin-bottom: var(--spacing-2);
    }

    .kpi-value {
      font-size: var(--font-size-3xl);
      font-weight: var(--font-weight-bold);
      color: var(--text-primary);
      line-height: 1.2;
      display: flex;
      align-items: baseline;
      gap: var(--spacing-1);
    }

    .kpi-card-large .kpi-value {
      font-size: var(--font-size-4xl);
    }

    .kpi-card-compact .kpi-value {
      font-size: var(--font-size-2xl);
    }

    .kpi-prefix,
    .kpi-suffix {
      font-size: 0.6em;
      font-weight: var(--font-weight-medium);
      color: var(--text-secondary);
    }

    .kpi-trend {
      display: flex;
      align-items: center;
      gap: var(--spacing-1);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
    }

    .trend-icon {
      width: 16px;
      height: 16px;
    }

    .trend-icon-neutral {
      font-size: 18px;
      line-height: 1;
    }

    .trend-up {
      color: var(--color-success);
    }

    .trend-down {
      color: var(--color-danger);
    }

    .trend-neutral {
      color: var(--text-muted);
    }

    .trend-value {
      font-weight: var(--font-weight-semibold);
    }

    .trend-label {
      color: var(--text-muted);
      font-weight: var(--font-weight-normal);
    }

    .kpi-subtitle {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      margin-top: var(--spacing-2);
    }

    // Animated value effect
    .kpi-card-animated {
      .kpi-value {
        animation: valuePopIn 0.5s ease-out;
      }
    }

    @keyframes valuePopIn {
      0% {
        opacity: 0;
        transform: scale(0.8);
      }
      50% {
        transform: scale(1.05);
      }
      100% {
        opacity: 1;
        transform: scale(1);
      }
    }
  `]
})
export class KpiCardComponent {
  @Input() label!: string;
  @Input() value!: number | string;
  @Input() prefix?: string;
  @Input() suffix?: string;
  @Input() subtitle?: string;
  @Input() trend: TrendDirection = 'neutral';
  @Input() trendValue?: string;
  @Input() trendLabel?: string;
  @Input() showTrend = false;
  @Input() icon = false;
  @Input() size: 'compact' | 'default' | 'large' = 'default';
  @Input() variant: 'default' | 'success' | 'warning' | 'danger' = 'default';
  @Input() animated = true;
  @Input() format: 'number' | 'currency' | 'percent' | 'none' = 'none';

  get formattedValue(): string {
    if (typeof this.value === 'string') {
      return this.value;
    }

    switch (this.format) {
      case 'number':
        return this.formatNumber(this.value);
      case 'currency':
        return this.formatCurrency(this.value);
      case 'percent':
        return this.formatPercent(this.value);
      default:
        return this.value.toString();
    }
  }

  get cardClasses(): string {
    const classes = ['kpi-card'];

    if (this.size !== 'default') {
      classes.push(`kpi-card-${this.size}`);
    }
    if (this.variant !== 'default') {
      classes.push(`kpi-card-${this.variant}`);
    }
    if (this.animated) {
      classes.push('kpi-card-animated');
    }

    return classes.join(' ');
  }

  get trendClasses(): string {
    return `trend-${this.trend}`;
  }

  private formatNumber(value: number): string {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
    return value.toLocaleString();
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  private formatPercent(value: number): string {
    return value.toFixed(1) + '%';
  }
}
