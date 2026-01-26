import { Component, Input, OnInit, OnChanges, SimpleChanges, inject, Output, EventEmitter } from '@angular/core';
import { EChartsOption } from 'echarts';
import { DataCacheService } from '../../core/services/data-cache.service';

@Component({
  selector: 'app-chart-widget',
  template: `
    <div class="chart-widget">
      <div class="loading-overlay" *ngIf="loading">
        <div class="spinner"></div>
      </div>
      <div
        echarts
        [options]="chartOptions"
        class="chart-container"
        (chartInit)="onChartInit($event)"
        (chartClick)="onChartClick($event)">
      </div>
    </div>
  `,
  styles: [`
    .chart-widget {
      height: 100%;
      width: 100%;
      position: relative;
    }

    .chart-container {
      height: 100%;
      width: 100%;
    }

    .loading-overlay {
      position: absolute;
      inset: 0;
      background: rgba(13, 17, 23, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
    }

    .spinner {
      width: 24px;
      height: 24px;
      border: 2px solid var(--border-color);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class ChartWidgetComponent implements OnInit, OnChanges {
  private dataCache = inject(DataCacheService);

  @Input() chartType = 'bar';
  @Input() config: any = {};
  @Input() data: any[] = [];
  @Input() query?: string;
  @Output() filterApply = new EventEmitter<{ field: string; value: any }>();

  chartOptions: EChartsOption = {};
  loading = false;
  private chartInstance: any;

  ngOnInit() {
    this.loadData();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['chartType'] || changes['data'] || changes['config'] || changes['query']) {
      this.loadData();
    }
  }

  onChartInit(chart: any) {
    this.chartInstance = chart;
  }

  onChartClick(event: any) {
    // Emit cross-filter event
    if (event.name) {
      this.filterApply.emit({
        field: this.config.categoryField || 'category',
        value: event.name
      });
    }
  }

  private async loadData() {
    if (this.query) {
      this.loading = true;
      try {
        const result = await this.dataCache.query(this.query);
        this.data = result.rows;
      } catch (error) {
        console.error('Chart query error:', error);
      } finally {
        this.loading = false;
      }
    }
    this.updateChart();
  }

  private updateChart() {
    const baseOptions = this.getBaseOptions();
    const chartSpecificOptions = this.getChartOptions();
    this.chartOptions = { ...baseOptions, ...chartSpecificOptions };
  }

  private getBaseOptions(): EChartsOption {
    return {
      backgroundColor: 'transparent',
      textStyle: {
        fontFamily: 'Inter, sans-serif',
        color: '#8b949e'
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: '#21262d',
        borderColor: '#30363d',
        textStyle: { color: '#f0f6fc' }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        top: '10%',
        containLabel: true
      }
    };
  }

  private getChartOptions(): EChartsOption {
    switch (this.chartType) {
      case 'bar':
        return this.getBarOptions();
      case 'line':
        return this.getLineOptions();
      case 'donut':
        return this.getDonutOptions();
      case 'gauge':
        return this.getGaugeOptions();
      case 'speedometer':
        return this.getSpeedometerOptions();
      default:
        return this.getBarOptions();
    }
  }

  private getBarOptions(): EChartsOption {
    return {
      xAxis: {
        type: 'category',
        data: ['APAC', 'EMEA', 'NAM', 'LATAM'],
        axisLine: { lineStyle: { color: '#30363d' } }
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#30363d' } },
        splitLine: { lineStyle: { color: '#21262d' } }
      },
      series: [{
        type: 'bar',
        data: [42, 35, 58, 28],
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#3399cc' },
              { offset: 1, color: '#0066b2' }
            ]
          },
          borderRadius: [4, 4, 0, 0]
        }
      }]
    };
  }

  private getLineOptions(): EChartsOption {
    return {
      xAxis: {
        type: 'category',
        data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        axisLine: { lineStyle: { color: '#30363d' } }
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#30363d' } },
        splitLine: { lineStyle: { color: '#21262d' } }
      },
      series: [{
        type: 'line',
        data: [820, 932, 901, 934, 1290, 1330],
        smooth: true,
        lineStyle: { color: '#0066b2', width: 3 },
        itemStyle: { color: '#3399cc' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(0, 102, 178, 0.4)' },
              { offset: 1, color: 'rgba(0, 102, 178, 0)' }
            ]
          }
        }
      }]
    };
  }

  private getDonutOptions(): EChartsOption {
    return {
      series: [{
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '50%'],
        data: [
          { value: 335, name: 'Matched', itemStyle: { color: '#2ecc71' } },
          { value: 234, name: 'Unmatched', itemStyle: { color: '#f1c40f' } },
          { value: 154, name: 'Breaks', itemStyle: { color: '#e74c3c' } }
        ],
        label: { show: false },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }],
      legend: {
        orient: 'horizontal',
        bottom: '5%',
        textStyle: { color: '#8b949e' }
      }
    };
  }

  private getGaugeOptions(): EChartsOption {
    return {
      series: [{
        type: 'gauge',
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: 100,
        radius: '100%',
        center: ['50%', '70%'],
        axisLine: {
          lineStyle: {
            width: 20,
            color: [
              [0.3, '#e74c3c'],
              [0.7, '#f1c40f'],
              [1, '#2ecc71']
            ]
          }
        },
        pointer: {
          length: '55%',
          width: 6,
          itemStyle: { color: '#0066b2' }
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        detail: {
          fontSize: 24,
          fontWeight: 'bold',
          offsetCenter: [0, '0%'],
          valueAnimation: true,
          formatter: '{value}%',
          color: '#f0f6fc'
        },
        data: [{ value: 87 }]
      }]
    };
  }

  private getSpeedometerOptions(): EChartsOption {
    return {
      series: [{
        type: 'gauge',
        min: 0,
        max: 100,
        radius: '90%',
        axisLine: {
          lineStyle: {
            width: 25,
            color: [
              [0.2, '#e74c3c'],
              [0.4, '#e67e22'],
              [0.6, '#f1c40f'],
              [0.8, '#27ae60'],
              [1, '#2ecc71']
            ]
          }
        },
        pointer: {
          icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z',
          length: '12%',
          width: 15,
          offsetCenter: [0, '-55%'],
          itemStyle: { color: 'auto' }
        },
        axisTick: {
          length: 10,
          lineStyle: { color: 'auto', width: 2 }
        },
        splitLine: {
          length: 15,
          lineStyle: { color: 'auto', width: 3 }
        },
        axisLabel: { show: false },
        detail: {
          fontSize: 28,
          fontWeight: 'bold',
          offsetCenter: [0, '20%'],
          valueAnimation: true,
          color: '#f0f6fc'
        },
        data: [{ value: 85 }]
      }]
    };
  }
}
