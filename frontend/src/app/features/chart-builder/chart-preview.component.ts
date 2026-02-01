import { Component, Input, OnChanges, OnInit, OnDestroy, SimpleChanges, inject, signal } from '@angular/core';
import { EChartsOption } from 'echarts';
import { getColorScheme, ChartConfig } from './chart-config';
import { ApiService } from '../../core/services/api.service';
import {
  ChartContext,
  getBarChartOptions,
  getColumnChartOptions,
  getLineChartOptions,
  getAreaChartOptions,
  getPieChartOptions,
  getDonutChartOptions,
  getGaugeChartOptions,
  getSpeedometerChartOptions,
  getRadialBarChartOptions,
  getHeatmapChartOptions,
  getScatterChartOptions,
  getRadarChartOptions,
  getFunnelChartOptions,
  getTreemapChartOptions,
  getKPICardOptions,
  getWorldMapChartOptions
} from './chart-options';

interface ChartDataResponse {
  chart: {
    id: string;
    name: string;
    chart_type: string;
    config: any;
  };
  data: any[];
  columns: string[];
}

@Component({
    selector: 'app-chart-preview',
    template: `
    <div class="chart-preview">
      <!-- Loading State -->
      <div class="chart-loading" *ngIf="loading()">
        <app-icon name="loader" [size]="24"></app-icon>
        <span>Loading chart...</span>
      </div>

      <!-- Error State -->
      <div class="chart-error" *ngIf="error()">
        <app-icon name="alert-circle" [size]="24"></app-icon>
        <span>{{ error() }}</span>
      </div>

      <!-- Chart Title (optional) -->
      <div class="chart-title" *ngIf="showTitle && chartTitle && !loading() && !error()">
        {{ chartTitle }}
      </div>

      <!-- Chart Instance -->
      <div
        *ngIf="!loading() && !error() && chartType"
        echarts
        [options]="chartOptions"
        [merge]="updateOptions"
        [autoResize]="true"
        class="chart-instance"
        (chartInit)="onChartInit($event)">
      </div>

      <!-- Empty State -->
      <div class="chart-empty" *ngIf="!loading() && !error() && !chartType">
        <app-icon name="chart-bar" [size]="48"></app-icon>
        <p>Select a chart type to preview</p>
      </div>
    </div>
  `,
    styles: [`
    :host {
      display: block;
      height: 100%;
      width: 100%;
    }

    .chart-preview {
      height: 100%;
      width: 100%;
      position: relative;
      display: flex;
      flex-direction: column;
    }

    .chart-instance {
      width: 100%;
      flex: 1;
      min-height: 100px;
    }

    .chart-title {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-semibold);
      color: var(--text-primary);
      padding: var(--spacing-3) var(--spacing-3) 0;
      flex-shrink: 0;
    }

    .chart-empty, .chart-loading, .chart-error {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-2);
      color: var(--text-muted);
      font-size: var(--font-size-sm);
    }

    .chart-loading app-icon {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .chart-error {
      color: var(--color-danger);
    }
  `],
    standalone: false
})
export class ChartPreviewComponent implements OnInit, OnChanges, OnDestroy {
  private api = inject(ApiService);

  // Direct data input mode (for chart builder)
  @Input() chartType: string = '';
  @Input() data: any[] = [];
  @Input() config: ChartConfig = {};

  // Chart ID input mode (for dashboard widgets)
  @Input() chartId?: string;
  @Input() showTitle: boolean = true;

  // State
  loading = signal(false);
  error = signal<string | null>(null);
  chartTitle: string = '';

  chartOptions: EChartsOption = {};
  updateOptions: EChartsOption = {};
  private chartInstance: any;

  ngOnInit() {
    // If chartId is provided, load chart data from API
    if (this.chartId) {
      this.loadChartData();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    // If chartId changes, reload data
    if (changes['chartId'] && this.chartId) {
      this.loadChartData();
      return;
    }

    // If direct data/config changes, update chart
    if (changes['chartType'] || changes['data'] || changes['config']) {
      this.updateChart();
    }
  }

  private loadChartData() {
    if (!this.chartId) return;

    this.loading.set(true);
    this.error.set(null);

    this.api.get<ChartDataResponse>(`/charts/${this.chartId}/data/direct`).subscribe({
      next: (response) => {
        this.chartType = response.chart.chart_type;
        this.chartTitle = response.chart.name;
        this.data = response.data || [];
        this.config = response.chart.config || {};
        this.loading.set(false);
        this.updateChart();
      },
      error: (err) => {
        console.error('Failed to load chart data:', err);
        this.error.set(err?.error?.detail || 'Failed to load chart');
        this.loading.set(false);
      }
    });
  }

  ngOnDestroy() {
    // Dispose ECharts instance to prevent memory leaks
    if (this.chartInstance) {
      try {
        this.chartInstance.dispose();
      } catch (e) {
        // Ignore disposal errors
      }
      this.chartInstance = null;
    }
  }

  onChartInit(chart: any) {
    this.chartInstance = chart;
  }

  private updateChart() {
    if (!this.chartType) return;

    const baseOptions = this.getBaseOptions();
    const chartSpecificOptions = this.getChartOptions();

    this.chartOptions = {
      ...baseOptions,
      ...chartSpecificOptions
    };
  }

  private getBaseOptions(): EChartsOption {
    const showTooltip = this.config?.enableTooltip !== false;
    const showLegend = this.config?.showLegend !== false;
    const enableAnimation = this.config?.enableAnimation !== false;

    return {
      backgroundColor: 'transparent',
      animation: enableAnimation,
      animationDuration: enableAnimation ? 1000 : 0,
      animationEasing: 'cubicOut',
      textStyle: {
        fontFamily: 'Inter, sans-serif',
        color: '#8b949e'
      },
      tooltip: showTooltip ? {
        trigger: 'item',
        backgroundColor: '#21262d',
        borderColor: '#30363d',
        textStyle: { color: '#f0f6fc' }
      } : { show: false },
      legend: showLegend ? {
        textStyle: { color: '#8b949e' },
        bottom: 10
      } : { show: false },
      color: this.getColors(),
      grid: {
        left: '3%',
        right: '4%',
        bottom: showLegend ? '15%' : '10%',
        top: '10%',
        containLabel: true
      }
    };
  }

  /** Get colors from current color scheme */
  private getColors(): string[] {
    return getColorScheme(this.config?.colorScheme || 'citi');
  }

  /** Build context for chart option builders */
  private getContext(): ChartContext {
    return {
      data: this.data,
      config: this.config,
      colors: this.getColors()
    };
  }

  private getChartOptions(): EChartsOption {
    const ctx = this.getContext();

    switch (this.chartType) {
      case 'bar':
        return getBarChartOptions(ctx);
      case 'column':
        return getColumnChartOptions(ctx);
      case 'line':
        return getLineChartOptions(ctx);
      case 'area':
        return getAreaChartOptions(ctx);
      case 'pie':
        return getPieChartOptions(ctx);
      case 'donut':
        return getDonutChartOptions(ctx);
      case 'gauge':
        return getGaugeChartOptions(ctx);
      case 'speedometer':
        return getSpeedometerChartOptions(ctx);
      case 'radialBar':
        return getRadialBarChartOptions(ctx);
      case 'heatmap':
        return getHeatmapChartOptions(ctx);
      case 'scatter':
        return getScatterChartOptions(ctx);
      case 'radar':
        return getRadarChartOptions(ctx);
      case 'funnel':
        return getFunnelChartOptions(ctx);
      case 'treemap':
        return getTreemapChartOptions(ctx);
      case 'kpiCard':
        return getKPICardOptions(ctx);
      case 'worldMap':
        return getWorldMapChartOptions(ctx);
      default:
        return {};
    }
  }
}
