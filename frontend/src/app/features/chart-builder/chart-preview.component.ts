import { Component, Input, Output, EventEmitter, OnChanges, OnInit, OnDestroy, SimpleChanges, inject, signal, ElementRef, AfterViewInit } from '@angular/core';
import { EChartsOption } from 'echarts';
import { getColorScheme, ChartConfig } from './chart-config';
import { ApiService } from '../../core/services/api.service';
import { CrossFilterService, ChartClickEvent } from '../../core/services/cross-filter.service';
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
export class ChartPreviewComponent implements OnInit, OnChanges, OnDestroy, AfterViewInit {
  private api = inject(ApiService);
  private elementRef = inject(ElementRef);
  private crossFilterService = inject(CrossFilterService);

  // Direct data input mode (for chart builder)
  @Input() chartType: string = '';
  @Input() data: any[] = [];
  @Input() config: ChartConfig = {};

  // Chart ID input mode (for dashboard widgets)
  @Input() chartId?: string;
  @Input() widgetId?: string;  // For cross-filtering identification
  @Input() showTitle: boolean = true;
  @Input() enableCrossFilter: boolean = true;  // Enable/disable cross-filter clicks

  // Cross-filter highlighting
  @Input() crossFilterColumn?: string;  // Column being filtered
  @Input() crossFilterValues?: unknown[];  // Values to highlight

  // Events
  @Output() chartClick = new EventEmitter<ChartClickEvent>();

  // State
  loading = signal(false);
  error = signal<string | null>(null);
  chartTitle: string = '';

  chartOptions: EChartsOption = {};
  updateOptions: EChartsOption = {};
  private chartInstance: any;
  private intersectionObserver?: IntersectionObserver;
  private hasBeenVisible = false;
  private dataLoaded = false;

  ngOnInit() {
    // For direct data mode (chart builder), load immediately
    if (!this.chartId && this.chartType) {
      this.updateChart();
    }
  }

  ngAfterViewInit() {
    // For chartId mode, use intersection observer to load when visible
    if (this.chartId) {
      this.setupIntersectionObserver();
    }
  }

  private setupIntersectionObserver() {
    // Create observer to detect when chart becomes visible
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !this.hasBeenVisible) {
            this.hasBeenVisible = true;
            this.loadChartData();
            // Disconnect after first visibility - we only need to trigger once
            this.intersectionObserver?.disconnect();
          }
        });
      },
      {
        root: null, // viewport
        rootMargin: '100px', // Load slightly before visible
        threshold: 0.1 // Trigger when 10% visible
      }
    );

    this.intersectionObserver.observe(this.elementRef.nativeElement);
  }

  ngOnChanges(changes: SimpleChanges) {
    // If chartId changes, reset visibility tracking and reload
    if (changes['chartId'] && this.chartId) {
      this.hasBeenVisible = false;
      this.dataLoaded = false;
      // If already visible or no observer yet, load immediately
      if (this.hasBeenVisible || !this.intersectionObserver) {
        this.loadChartData();
      }
      return;
    }

    // If direct data/config changes, update chart
    if (changes['chartType'] || changes['data'] || changes['config']) {
      this.updateChart();
    }

    // If cross-filter highlighting changes, update visual emphasis
    if (changes['crossFilterValues'] || changes['crossFilterColumn']) {
      this.updateCrossFilterHighlight();
    }
  }

  private updateCrossFilterHighlight() {
    if (!this.chartInstance) return;

    if (this.crossFilterValues && this.crossFilterValues.length > 0) {
      // Apply highlight to selected values, dim others
      this.chartInstance.dispatchAction({
        type: 'highlight',
        name: this.crossFilterValues.map(v => String(v)),
      });
    } else {
      // Clear all highlights
      this.chartInstance.dispatchAction({
        type: 'downplay',
      });
    }
  }

  private loadChartData() {
    if (!this.chartId || this.dataLoaded) return;

    this.loading.set(true);
    this.error.set(null);

    this.api.get<ChartDataResponse>(`/charts/${this.chartId}/data/direct`).subscribe({
      next: (response) => {
        this.chartType = response.chart.chart_type;
        this.chartTitle = response.chart.name;
        this.data = response.data || [];
        // Map backend config structure to frontend ChartConfig
        const backendConfig = response.chart.config || {};
        this.config = this.mapBackendConfig(backendConfig);
        this.dataLoaded = true;
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

  /** Map backend config structure to frontend ChartConfig */
  private mapBackendConfig(backendConfig: any): ChartConfig {
    const customOptions = backendConfig.custom_options || {};
    const kpiOptions = customOptions.kpi_options || {};

    return {
      title: backendConfig.title || '',
      subtitle: backendConfig.subtitle || '',
      xAxis: backendConfig.x_axis?.field || '',
      yAxis: backendConfig.y_axis?.field || '',
      groupBy: backendConfig.category_field || '',
      colorScheme: customOptions.color_scheme || 'citi',
      showLegend: backendConfig.show_legend !== false,
      showLabels: backendConfig.show_labels === true,
      enableAnimation: customOptions.enable_animation !== false,
      enableTooltip: backendConfig.show_tooltip !== false,
      kpiOptions: kpiOptions.aggregation ? {
        aggregation: kpiOptions.aggregation || 'sum',
        format: kpiOptions.format || 'number',
        currencyCode: kpiOptions.currencyCode || 'USD',
        decimals: kpiOptions.decimals ?? 0,
        prefix: kpiOptions.prefix || '',
        suffix: kpiOptions.suffix || '',
        showTrend: kpiOptions.showTrend || false,
        trendCompareField: kpiOptions.trendCompareField || '',
        trendMode: kpiOptions.trendMode || 'previous',
        trendUpIsGood: kpiOptions.trendUpIsGood !== false
      } : undefined
    };
  }

  ngOnDestroy() {
    // Clean up intersection observer
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = undefined;
    }

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
    this.setupClickHandlers();
  }

  private setupClickHandlers() {
    if (!this.chartInstance || !this.enableCrossFilter) return;

    // Register click handler for cross-filtering
    this.chartInstance.on('click', (params: any) => {
      this.handleChartClick(params);
    });

    // Also handle clicks on specific series types
    this.chartInstance.on('click', 'series', (params: any) => {
      this.handleChartClick(params);
    });
  }

  private handleChartClick(params: any) {
    if (!this.widgetId || !this.chartId) return;

    // Extract data point information based on chart type
    const clickEvent: ChartClickEvent = {
      widgetId: this.widgetId,
      chartId: this.chartId,
      chartName: this.chartTitle || 'Chart',
      dataPoint: {
        category: params.name,
        series: params.seriesName,
        value: params.value,
        name: params.name,
        data: this.extractDataPoint(params),
      },
      columnMapping: this.getColumnMapping(),
    };

    this.chartClick.emit(clickEvent);
  }

  private extractDataPoint(params: any): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    // Try to get the original data row
    if (params.data && typeof params.data === 'object') {
      Object.assign(data, params.data);
    }

    // Add common fields
    if (params.name) data['name'] = params.name;
    if (params.seriesName) data['series'] = params.seriesName;

    // For array values (like in scatter plots)
    if (Array.isArray(params.value)) {
      const xCol = this.config?.xAxis || 'x';
      const yCol = this.config?.yAxis || 'y';
      data[xCol] = params.value[0];
      data[yCol] = params.value[1];
    } else if (params.value !== undefined) {
      const valueCol = this.config?.yAxis || 'value';
      data[valueCol] = params.value;
    }

    // Add category column
    if (params.name) {
      const categoryCol = this.config?.xAxis || 'category';
      data[categoryCol] = params.name;
    }

    return data;
  }

  private getColumnMapping(): ChartClickEvent['columnMapping'] {
    return {
      categoryColumn: this.config?.xAxis,
      seriesColumn: this.config?.groupBy,
      valueColumn: this.config?.yAxis,
    };
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
