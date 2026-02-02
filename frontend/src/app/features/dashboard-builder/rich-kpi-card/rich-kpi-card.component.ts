/**
 * Rich KPI Card Component
 *
 * Premium KPI widget with:
 * - Large animated value with gradient text
 * - Trend indicator with glow effect
 * - Mini sparkline chart (ECharts)
 * - Comparison period text
 * - Size-aware responsive layout
 */

import { Component, Input, computed, signal, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { EChartsOption } from 'echarts';

export interface TrendData {
  direction: 'up' | 'down' | 'neutral';
  value: string;
  label?: string;
}

export interface SparklineData {
  data: number[];
  color?: string;
}

export interface KpiWidgetConfig {
  value: number | string;
  label: string;
  format?: 'number' | 'currency' | 'percent';
  prefix?: string;
  suffix?: string;
  trend?: TrendData;
  sparkline?: SparklineData;
  comparison?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

@Component({
  selector: 'app-rich-kpi-card',
  template: `
    <div class="rich-kpi-card"
         [class.compact]="isCompact()"
         [class.expanded]="isExpanded()"
         [class.variant-success]="variant === 'success'"
         [class.variant-warning]="variant === 'warning'"
         [class.variant-danger]="variant === 'danger'">

      <!-- Value Section -->
      <div class="kpi-value-section">
        <span class="kpi-prefix" *ngIf="prefix">{{ prefix }}</span>
        <span class="kpi-value" [class.has-sparkline]="hasSparkline()">{{ formattedValue }}</span>
        <span class="kpi-suffix" *ngIf="suffix">{{ suffix }}</span>
      </div>

      <!-- Label -->
      <div class="kpi-label">{{ label }}</div>

      <!-- Trend & Comparison Row -->
      <div class="kpi-meta-row" *ngIf="trend || comparison">
        <div class="kpi-trend" *ngIf="trend" [class]="'trend-' + trend.direction">
          <app-icon [name]="getTrendIcon()" [size]="isCompact() ? 14 : 16"></app-icon>
          <span class="trend-value">{{ trend.value }}</span>
          <span class="trend-label" *ngIf="trend.label && !isCompact()">{{ trend.label }}</span>
        </div>
        <div class="kpi-comparison" *ngIf="comparison && !isCompact()">{{ comparison }}</div>
      </div>

      <!-- Sparkline -->
      <div class="kpi-sparkline" *ngIf="hasSparkline() && !isCompact()">
        <div echarts
             [options]="sparklineOptions"
             [autoResize]="true"
             class="sparkline-chart">
        </div>
      </div>

      <!-- Accent Glow (bottom) -->
      <div class="kpi-accent-glow"></div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      width: 100%;
    }

    .rich-kpi-card {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: var(--spacing-5);
      gap: var(--spacing-2);
      position: relative;
      overflow: hidden;
    }

    /* ============================
       SIZE VARIANTS
    ============================ */
    .rich-kpi-card.compact {
      padding: var(--spacing-3);
      gap: var(--spacing-1);

      .kpi-value {
        font-size: var(--font-size-2xl);
      }

      .kpi-label {
        font-size: var(--font-size-xs);
      }

      .kpi-meta-row {
        margin-top: var(--spacing-1);
      }

      .kpi-trend {
        padding: 2px var(--spacing-1);
        font-size: 11px;
      }
    }

    .rich-kpi-card.expanded {
      padding: var(--spacing-6);

      .kpi-value {
        font-size: var(--font-size-5xl);
      }

      .kpi-sparkline {
        height: 64px;
      }
    }

    /* ============================
       VALUE SECTION
    ============================ */
    .kpi-value-section {
      display: flex;
      align-items: baseline;
      gap: var(--spacing-1);
      animation: kpiValuePopIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .kpi-value {
      font-size: var(--font-size-4xl);
      font-weight: var(--font-weight-bold);
      line-height: 1;
      background: linear-gradient(135deg,
        var(--color-primary-light) 0%,
        var(--color-primary) 50%,
        var(--color-primary-light) 100%);
      background-size: 200% 200%;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: kpiGradientShift 4s ease-in-out infinite;
      filter: drop-shadow(0 2px 8px rgba(var(--color-primary-rgb), 0.25));

      &.has-sparkline {
        font-size: var(--font-size-3xl);
      }
    }

    .kpi-prefix,
    .kpi-suffix {
      font-size: var(--font-size-lg);
      font-weight: var(--font-weight-medium);
      color: var(--text-secondary);
    }

    /* ============================
       LABEL
    ============================ */
    .kpi-label {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* ============================
       META ROW (Trend + Comparison)
    ============================ */
    .kpi-meta-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--spacing-2);
      margin-top: auto;
    }

    .kpi-trend {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-1);
      padding: var(--spacing-1) var(--spacing-2);
      border-radius: var(--radius-md);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-semibold);
      transition: all 0.2s ease;

      app-icon {
        transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      &:hover app-icon {
        transform: scale(1.15);
      }
    }

    .trend-up {
      color: var(--color-success);
      background: rgba(var(--color-success-rgb), 0.12);
      border: 1px solid rgba(var(--color-success-rgb), 0.2);

      app-icon {
        filter: drop-shadow(0 0 4px rgba(var(--color-success-rgb), 0.5));
      }
    }

    .trend-down {
      color: var(--color-danger);
      background: rgba(var(--color-danger-rgb), 0.12);
      border: 1px solid rgba(var(--color-danger-rgb), 0.2);

      app-icon {
        filter: drop-shadow(0 0 4px rgba(var(--color-danger-rgb), 0.5));
      }
    }

    .trend-neutral {
      color: var(--text-muted);
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .trend-label {
      color: var(--text-muted);
      font-weight: var(--font-weight-normal);
      margin-left: var(--spacing-1);
    }

    .kpi-comparison {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
    }

    /* ============================
       SPARKLINE
    ============================ */
    .kpi-sparkline {
      height: 48px;
      margin-top: var(--spacing-2);
      opacity: 0.85;
      transition: opacity 0.2s ease;

      &:hover {
        opacity: 1;
      }
    }

    .sparkline-chart {
      height: 100%;
      width: 100%;
    }

    /* ============================
       ACCENT GLOW
    ============================ */
    .kpi-accent-glow {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg,
        transparent 0%,
        var(--color-primary) 50%,
        transparent 100%);
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .rich-kpi-card:hover .kpi-accent-glow {
      opacity: 1;
      box-shadow: 0 0 20px rgba(var(--color-primary-rgb), 0.5);
    }

    /* ============================
       COLOR VARIANTS
    ============================ */
    .variant-success {
      .kpi-value {
        background: linear-gradient(135deg,
          #4ade80 0%,
          var(--color-success) 50%,
          #22c55e 100%);
        background-size: 200% 200%;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        filter: drop-shadow(0 2px 8px rgba(var(--color-success-rgb), 0.25));
      }

      .kpi-accent-glow {
        background: linear-gradient(90deg,
          transparent 0%,
          var(--color-success) 50%,
          transparent 100%);
      }

      &:hover .kpi-accent-glow {
        box-shadow: 0 0 20px rgba(var(--color-success-rgb), 0.5);
      }
    }

    .variant-warning {
      .kpi-value {
        background: linear-gradient(135deg,
          #fcd34d 0%,
          var(--color-warning) 50%,
          #f59e0b 100%);
        background-size: 200% 200%;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        filter: drop-shadow(0 2px 8px rgba(var(--color-warning-rgb), 0.25));
      }

      .kpi-accent-glow {
        background: linear-gradient(90deg,
          transparent 0%,
          var(--color-warning) 50%,
          transparent 100%);
      }

      &:hover .kpi-accent-glow {
        box-shadow: 0 0 20px rgba(var(--color-warning-rgb), 0.5);
      }
    }

    .variant-danger {
      .kpi-value {
        background: linear-gradient(135deg,
          #f87171 0%,
          var(--color-danger) 50%,
          #dc2626 100%);
        background-size: 200% 200%;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        filter: drop-shadow(0 2px 8px rgba(var(--color-danger-rgb), 0.25));
      }

      .kpi-accent-glow {
        background: linear-gradient(90deg,
          transparent 0%,
          var(--color-danger) 50%,
          transparent 100%);
      }

      &:hover .kpi-accent-glow {
        box-shadow: 0 0 20px rgba(var(--color-danger-rgb), 0.5);
      }
    }

    /* ============================
       ANIMATIONS
    ============================ */
    @keyframes kpiValuePopIn {
      0% {
        opacity: 0;
        transform: scale(0.8) translateY(10px);
      }
      60% {
        transform: scale(1.03) translateY(-2px);
      }
      100% {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    @keyframes kpiGradientShift {
      0%, 100% {
        background-position: 0% 50%;
      }
      50% {
        background-position: 100% 50%;
      }
    }
  `],
  standalone: false
})
export class RichKpiCardComponent implements OnInit, OnChanges {
  @Input() value!: number | string;
  @Input() label!: string;
  @Input() format: 'number' | 'currency' | 'percent' = 'number';
  @Input() prefix?: string;
  @Input() suffix?: string;
  @Input() trend?: TrendData;
  @Input() sparkline?: SparklineData;
  @Input() comparison?: string;
  @Input() size = 4; // Widget column count
  @Input() variant: 'default' | 'success' | 'warning' | 'danger' = 'default';

  sparklineOptions: EChartsOption = {};

  // Size computations
  isCompact = computed(() => this.size < 4);
  isExpanded = computed(() => this.size >= 8);
  hasSparkline = () => this.sparkline && this.sparkline.data && this.sparkline.data.length > 0;

  ngOnInit() {
    if (this.sparkline) {
      this.updateSparklineOptions();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['sparkline'] && this.sparkline) {
      this.updateSparklineOptions();
    }
  }

  get formattedValue(): string {
    if (typeof this.value === 'string') return this.value;

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

  getTrendIcon(): string {
    if (!this.trend) return 'minus';
    const icons: Record<string, string> = {
      up: 'trending-up',
      down: 'trending-down',
      neutral: 'minus'
    };
    return icons[this.trend.direction] || 'minus';
  }

  private updateSparklineOptions() {
    if (!this.sparkline || !this.sparkline.data.length) {
      this.sparklineOptions = {};
      return;
    }

    const data = this.sparkline.data;
    const baseColor = this.getSparklineColor();

    this.sparklineOptions = {
      grid: {
        left: 0,
        right: 0,
        top: 2,
        bottom: 2,
        containLabel: false
      },
      xAxis: {
        type: 'category',
        show: false,
        boundaryGap: false,
        data: data.map((_, i) => i)
      },
      yAxis: {
        type: 'value',
        show: false,
        min: (value) => value.min - (value.max - value.min) * 0.1,
        max: (value) => value.max + (value.max - value.min) * 0.1
      },
      series: [{
        type: 'line',
        data: data,
        smooth: 0.4,
        showSymbol: false,
        lineStyle: {
          color: baseColor,
          width: 2,
          shadowColor: baseColor,
          shadowBlur: 4,
          shadowOffsetY: 2
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: this.hexToRgba(baseColor, 0.35) },
              { offset: 0.7, color: this.hexToRgba(baseColor, 0.1) },
              { offset: 1, color: this.hexToRgba(baseColor, 0.02) }
            ]
          }
        },
        animation: true,
        animationDuration: 1200,
        animationEasing: 'cubicOut'
      }]
    };
  }

  private getSparklineColor(): string {
    if (this.sparkline?.color) return this.sparkline.color;

    switch (this.variant) {
      case 'success': return '#2ecc71';
      case 'warning': return '#f1c40f';
      case 'danger': return '#e74c3c';
      default: return '#0066b2';
    }
  }

  private hexToRgba(hex: string, alpha: number): string {
    // Handle named colors
    const colors: Record<string, string> = {
      '#0066b2': `rgba(0, 102, 178, ${alpha})`,
      '#2ecc71': `rgba(46, 204, 113, ${alpha})`,
      '#f1c40f': `rgba(241, 196, 15, ${alpha})`,
      '#e74c3c': `rgba(231, 76, 60, ${alpha})`
    };
    return colors[hex] || `rgba(0, 102, 178, ${alpha})`;
  }

  private formatNumber(value: number): string {
    if (value >= 1_000_000_000) {
      return (value / 1_000_000_000).toFixed(1) + 'B';
    }
    if (value >= 1_000_000) {
      return (value / 1_000_000).toFixed(1) + 'M';
    }
    if (value >= 1_000) {
      return (value / 1_000).toFixed(1) + 'K';
    }
    return value.toLocaleString();
  }

  private formatCurrency(value: number): string {
    if (value >= 1_000_000_000) {
      return '$' + (value / 1_000_000_000).toFixed(1) + 'B';
    }
    if (value >= 1_000_000) {
      return '$' + (value / 1_000_000).toFixed(1) + 'M';
    }
    if (value >= 1_000) {
      return '$' + (value / 1_000).toFixed(1) + 'K';
    }
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
