import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { EChartsOption } from 'echarts';
import { getColorScheme, ChartConfig } from './chart-config';
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

@Component({
  selector: 'app-chart-preview',
  template: `
    <div class="chart-preview">
      <div class="preview-header">
        <span class="preview-title">{{ title || 'Chart Preview' }}</span>
        <div class="preview-actions">
          <app-button variant="ghost" size="sm" (click)="toggleFullscreen()">
            <app-icon name="maximize" [size]="16"></app-icon>
          </app-button>
        </div>
      </div>
      <div class="preview-container">
        <div
          echarts
          [options]="chartOptions"
          [merge]="updateOptions"
          class="chart-instance"
          (chartInit)="onChartInit($event)">
        </div>
        <div class="chart-empty" *ngIf="!chartType">
          <app-icon name="chart-bar" [size]="48"></app-icon>
          <p>Select a chart type to preview</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .chart-preview {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--bg-secondary);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }

    .preview-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-3) var(--spacing-4);
      background: var(--bg-tertiary);
      border-bottom: 1px solid var(--border-color);
    }

    .preview-title {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-semibold);
      color: var(--text-secondary);
    }

    .preview-container {
      flex: 1;
      position: relative;
      min-height: 300px;
    }

    .chart-instance {
      width: 100%;
      height: 100%;
    }

    .chart-empty {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-3);
      color: var(--text-muted);

      p {
        margin: 0;
        font-size: var(--font-size-sm);
      }
    }
  `]
})
export class ChartPreviewComponent implements OnChanges {
  @Input() chartType: string = '';
  @Input() data: any[] = [];
  @Input() config: ChartConfig = {};
  @Input() title: string = '';

  chartOptions: EChartsOption = {};
  updateOptions: EChartsOption = {};
  private chartInstance: any;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['chartType'] || changes['data'] || changes['config']) {
      this.updateChart();
    }
  }

  onChartInit(chart: any) {
    this.chartInstance = chart;
  }

  toggleFullscreen() {
    // TODO: Implement fullscreen
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
