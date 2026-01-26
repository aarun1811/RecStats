import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { EChartsOption } from 'echarts';
import { getColorScheme, ChartConfig } from './chart-config';

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

  /** Get colors from current color scheme */
  private getColors(): string[] {
    return getColorScheme(this.config?.colorScheme || 'citi');
  }

  // Sample data for preview
  private sampleData = {
    categories: ['APAC', 'EMEA', 'NAM', 'LATAM'],
    values: [42, 35, 58, 28],
    series: [
      { name: 'Matched', data: [150, 230, 180, 120] },
      { name: 'Unmatched', data: [25, 40, 35, 20] },
      { name: 'Breaks', data: [10, 15, 12, 8] }
    ]
  };

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

  private getChartOptions(): EChartsOption {
    switch (this.chartType) {
      case 'bar':
        return this.getBarChartOptions();
      case 'column':
        return this.getColumnChartOptions();
      case 'line':
        return this.getLineChartOptions();
      case 'area':
        return this.getAreaChartOptions();
      case 'pie':
        return this.getPieChartOptions();
      case 'donut':
        return this.getDonutChartOptions();
      case 'gauge':
        return this.getGaugeChartOptions();
      case 'speedometer':
        return this.getSpeedometerChartOptions();
      case 'radialBar':
        return this.getRadialBarChartOptions();
      case 'heatmap':
        return this.getHeatmapChartOptions();
      case 'scatter':
        return this.getScatterChartOptions();
      case 'radar':
        return this.getRadarChartOptions();
      case 'funnel':
        return this.getFunnelChartOptions();
      case 'treemap':
        return this.getTreemapChartOptions();
      default:
        return {};
    }
  }

  private getBarChartOptions(): EChartsOption {
    const xField = this.config?.xAxis || 'category';
    const yField = this.config?.yAxis || 'value';
    const colors = this.getColors();
    const showLabels = this.config?.showLabels === true;

    let categories: string[] = this.sampleData.categories;
    let values: number[] = this.sampleData.values;

    if (this.data && this.data.length > 0) {
      categories = this.data.map(row => String(row[xField] || ''));
      values = this.data.map(row => Number(row[yField]) || 0);
    }

    return {
      xAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#30363d' } },
        splitLine: { lineStyle: { color: '#21262d' } }
      },
      yAxis: {
        type: 'category',
        data: categories,
        axisLine: { lineStyle: { color: '#30363d' } }
      },
      series: [{
        type: 'bar',
        data: values,
        label: {
          show: showLabels,
          position: 'right',
          color: '#f0f6fc',
          fontSize: 11
        },
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: colors[0] },
              { offset: 1, color: colors[1] }
            ]
          },
          borderRadius: [0, 4, 4, 0]
        }
      }]
    };
  }

  private getColumnChartOptions(): EChartsOption {
    const xField = this.config?.xAxis || 'category';
    const yField = this.config?.yAxis || 'value';
    const colors = this.getColors();
    const showLabels = this.config?.showLabels === true;

    let categories: string[] = this.sampleData.categories;
    let values: number[] = this.sampleData.values;

    if (this.data && this.data.length > 0) {
      categories = this.data.map(row => String(row[xField] || ''));
      values = this.data.map(row => Number(row[yField]) || 0);
    }

    return {
      xAxis: {
        type: 'category',
        data: categories,
        axisLine: { lineStyle: { color: '#30363d' } },
        axisLabel: { color: '#8b949e', rotate: categories.length > 5 ? 45 : 0 }
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#30363d' } },
        splitLine: { lineStyle: { color: '#21262d' } }
      },
      series: [{
        type: 'bar',
        data: values,
        label: {
          show: showLabels,
          position: 'top',
          color: '#f0f6fc',
          fontSize: 11
        },
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: colors[1] },
              { offset: 1, color: colors[0] }
            ]
          },
          borderRadius: [4, 4, 0, 0]
        }
      }]
    };
  }

  private getLineChartOptions(): EChartsOption {
    const xField = this.config?.xAxis || 'category';
    const yField = this.config?.yAxis || 'value';
    const colors = this.getColors();
    const showLabels = this.config?.showLabels === true;
    const primaryColor = colors[0];

    let categories: string[] = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    let values: number[] = [820, 932, 901, 934, 1290, 1330];

    if (this.data && this.data.length > 0) {
      categories = this.data.map(row => String(row[xField] || ''));
      values = this.data.map(row => Number(row[yField]) || 0);
    }

    return {
      xAxis: {
        type: 'category',
        data: categories,
        axisLine: { lineStyle: { color: '#30363d' } }
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#30363d' } },
        splitLine: { lineStyle: { color: '#21262d' } }
      },
      series: [{
        type: 'line',
        data: values,
        smooth: true,
        lineStyle: { color: primaryColor, width: 3 },
        itemStyle: { color: colors[1] },
        label: {
          show: showLabels,
          position: 'top',
          color: '#f0f6fc',
          fontSize: 11
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: this.hexToRgba(primaryColor, 0.3) },
              { offset: 1, color: this.hexToRgba(primaryColor, 0) }
            ]
          }
        }
      }]
    };
  }

  /** Convert hex color to rgba string */
  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private getAreaChartOptions(): EChartsOption {
    const xField = this.config?.xAxis || 'category';
    const yField = this.config?.yAxis || 'value';
    const colors = this.getColors();
    const showLabels = this.config?.showLabels === true;
    const primaryColor = colors[0];

    let categories: string[] = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    let values: number[] = [820, 932, 901, 934, 1290, 1330];

    if (this.data && this.data.length > 0) {
      categories = this.data.map(row => String(row[xField] || ''));
      values = this.data.map(row => Number(row[yField]) || 0);
    }

    return {
      xAxis: {
        type: 'category',
        data: categories,
        axisLine: { lineStyle: { color: '#30363d' } }
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#30363d' } },
        splitLine: { lineStyle: { color: '#21262d' } }
      },
      series: [{
        type: 'line',
        data: values,
        smooth: true,
        lineStyle: { color: primaryColor, width: 2 },
        itemStyle: { color: colors[1] },
        label: {
          show: showLabels,
          position: 'top',
          color: '#f0f6fc',
          fontSize: 11
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: this.hexToRgba(primaryColor, 0.5) },
              { offset: 1, color: this.hexToRgba(primaryColor, 0.1) }
            ]
          }
        }
      }]
    };
  }

  private getPieChartOptions(): EChartsOption {
    const xField = this.config?.xAxis || 'category';
    const yField = this.config?.yAxis || 'value';
    const colors = this.getColors();
    const showLabels = this.config?.showLabels !== false; // Show by default for pie

    let pieData: any[] = [
      { value: 335, name: 'Matched' },
      { value: 234, name: 'Unmatched' },
      { value: 154, name: 'Breaks' },
      { value: 135, name: 'Pending' }
    ];

    if (this.data && this.data.length > 0) {
      pieData = this.data.map((row, i) => ({
        value: Number(row[yField]) || 0,
        name: String(row[xField] || ''),
        itemStyle: { color: colors[i % colors.length] }
      }));
    } else {
      pieData = pieData.map((item, i) => ({
        ...item,
        itemStyle: { color: colors[i % colors.length] }
      }));
    }

    return {
      series: [{
        type: 'pie',
        radius: '65%',
        center: ['50%', '50%'],
        data: pieData,
        label: {
          show: showLabels,
          color: '#f0f6fc',
          formatter: '{b}: {d}%'
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }]
    };
  }

  private getDonutChartOptions(): EChartsOption {
    const xField = this.config?.xAxis || 'category';
    const yField = this.config?.yAxis || 'value';
    const colors = this.getColors();
    const showLabels = this.config?.showLabels !== false; // Show by default for donut

    let donutData: any[] = [
      { value: 335, name: 'Matched' },
      { value: 234, name: 'Unmatched' },
      { value: 154, name: 'Breaks' },
      { value: 135, name: 'Pending' }
    ];

    if (this.data && this.data.length > 0) {
      donutData = this.data.map((row, i) => ({
        value: Number(row[yField]) || 0,
        name: String(row[xField] || ''),
        itemStyle: { color: colors[i % colors.length] }
      }));
    } else {
      donutData = donutData.map((item, i) => ({
        ...item,
        itemStyle: { color: colors[i % colors.length] }
      }));
    }

    return {
      series: [{
        type: 'pie',
        radius: ['40%', '65%'],
        center: ['50%', '50%'],
        data: donutData,
        label: {
          show: showLabels,
          color: '#f0f6fc',
          formatter: '{b}: {d}%'
        }
      }]
    };
  }

  private getGaugeChartOptions(): EChartsOption {
    const colors = this.getColors();

    return {
      series: [{
        type: 'gauge',
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: 100,
        splitNumber: 10,
        radius: '90%',
        center: ['50%', '65%'],
        axisLine: {
          lineStyle: {
            width: 20,
            color: [
              [0.3, '#e74c3c'],
              [0.7, '#f1c40f'],
              [1, colors[0]]
            ]
          }
        },
        pointer: {
          length: '60%',
          width: 6,
          itemStyle: { color: colors[0] }
        },
        axisTick: {
          length: 12,
          lineStyle: { color: 'auto', width: 2 }
        },
        splitLine: {
          length: 20,
          lineStyle: { color: 'auto', width: 3 }
        },
        axisLabel: {
          color: '#8b949e',
          fontSize: 12,
          distance: -50
        },
        title: {
          offsetCenter: [0, '20%'],
          fontSize: 16,
          color: '#f0f6fc'
        },
        detail: {
          fontSize: 32,
          offsetCenter: [0, '-10%'],
          valueAnimation: true,
          formatter: '{value}%',
          color: '#f0f6fc'
        },
        data: [{ value: 73, name: 'Match Rate' }]
      }]
    };
  }

  private getSpeedometerChartOptions(): EChartsOption {
    const colors = this.getColors();

    return {
      series: [{
        type: 'gauge',
        min: 0,
        max: 100,
        splitNumber: 10,
        radius: '85%',
        axisLine: {
          lineStyle: {
            width: 30,
            color: [
              [0.2, '#e74c3c'],
              [0.4, '#e67e22'],
              [0.6, '#f1c40f'],
              [0.8, colors[1]],
              [1, colors[0]]
            ]
          }
        },
        pointer: {
          icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z',
          length: '12%',
          width: 20,
          offsetCenter: [0, '-60%'],
          itemStyle: { color: 'auto' }
        },
        axisTick: {
          length: 12,
          lineStyle: { color: 'auto', width: 2 }
        },
        splitLine: {
          length: 20,
          lineStyle: { color: 'auto', width: 5 }
        },
        axisLabel: {
          color: '#8b949e',
          fontSize: 14,
          distance: -60,
          formatter: (value: number) => {
            if (value === 0) return 'Critical';
            if (value === 50) return 'Warning';
            if (value === 100) return 'Excellent';
            return '';
          }
        },
        title: {
          offsetCenter: [0, '-15%'],
          fontSize: 18,
          color: '#f0f6fc'
        },
        detail: {
          fontSize: 40,
          fontWeight: 'bold',
          offsetCenter: [0, '30%'],
          valueAnimation: true,
          formatter: '{value}',
          color: '#f0f6fc'
        },
        data: [{ value: 85, name: 'Performance Score' }]
      }]
    };
  }

  private getRadialBarChartOptions(): EChartsOption {
    const colors = this.getColors();
    const showLabels = this.config?.showLabels === true;

    return {
      polar: { radius: ['30%', '80%'] },
      radiusAxis: { max: 100, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false } },
      angleAxis: { type: 'category', data: ['Match Rate', 'SLA %', 'Automation'], startAngle: 90, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#8b949e' } },
      series: [{
        type: 'bar',
        data: [92, 87, 78],
        coordinateSystem: 'polar',
        roundCap: true,
        label: {
          show: showLabels,
          position: 'middle',
          color: '#f0f6fc'
        },
        itemStyle: {
          color: (params: any) => colors[params.dataIndex % colors.length]
        }
      }]
    };
  }

  private getHeatmapChartOptions(): EChartsOption {
    const colors = this.getColors();
    const showLabels = this.config?.showLabels === true;
    const hours = ['12a', '2a', '4a', '6a', '8a', '10a', '12p', '2p', '4p', '6p', '8p', '10p'];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const data: number[][] = [];
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 12; j++) {
        data.push([j, i, Math.round(Math.random() * 10)]);
      }
    }
    return {
      xAxis: { type: 'category', data: hours, splitArea: { show: true } },
      yAxis: { type: 'category', data: days, splitArea: { show: true } },
      visualMap: { min: 0, max: 10, calculable: true, orient: 'horizontal', left: 'center', bottom: 10, inRange: { color: ['#0d1117', colors[0], colors[1]] } },
      series: [{ type: 'heatmap', data: data, label: { show: showLabels, color: '#f0f6fc' } }]
    };
  }

  private getScatterChartOptions(): EChartsOption {
    const colors = this.getColors();
    const showLabels = this.config?.showLabels === true;

    return {
      xAxis: { axisLine: { lineStyle: { color: '#30363d' } }, splitLine: { lineStyle: { color: '#21262d' } } },
      yAxis: { axisLine: { lineStyle: { color: '#30363d' } }, splitLine: { lineStyle: { color: '#21262d' } } },
      series: [{
        type: 'scatter',
        symbolSize: 15,
        data: [[10, 8.04], [8, 6.95], [13, 7.58], [9, 8.81], [11, 8.33], [14, 7.66], [6, 6.13], [4, 3.1], [12, 9.13], [7, 7.26]],
        label: {
          show: showLabels,
          position: 'top',
          color: '#f0f6fc',
          fontSize: 10,
          formatter: (params: any) => `${params.value[1]}`
        },
        itemStyle: { color: colors[0], shadowBlur: 10, shadowColor: this.hexToRgba(colors[0], 0.5) }
      }]
    };
  }

  private getRadarChartOptions(): EChartsOption {
    const colors = this.getColors();
    const showLabels = this.config?.showLabels === true;

    return {
      radar: {
        indicator: [
          { name: 'Match Rate', max: 100 },
          { name: 'SLA', max: 100 },
          { name: 'Volume', max: 100 },
          { name: 'Accuracy', max: 100 },
          { name: 'Timeliness', max: 100 }
        ],
        axisName: { color: '#8b949e' },
        splitArea: { areaStyle: { color: ['#161b22', '#1a1f26'] } },
        axisLine: { lineStyle: { color: '#30363d' } },
        splitLine: { lineStyle: { color: '#30363d' } }
      },
      series: [{
        type: 'radar',
        data: [{
          value: [92, 88, 75, 95, 82],
          name: 'Current',
          areaStyle: { color: this.hexToRgba(colors[0], 0.3) },
          lineStyle: { color: colors[0] },
          label: {
            show: showLabels,
            color: '#f0f6fc',
            fontSize: 10
          }
        }]
      }]
    };
  }

  private getFunnelChartOptions(): EChartsOption {
    const colors = this.getColors();
    const showLabels = this.config?.showLabels !== false; // Show by default for funnel

    return {
      series: [{
        type: 'funnel',
        left: '10%',
        width: '80%',
        label: {
          show: showLabels,
          position: 'inside',
          color: '#f0f6fc'
        },
        itemStyle: { borderWidth: 0 },
        data: [
          { value: 100, name: 'Total Transactions', itemStyle: { color: colors[0] } },
          { value: 80, name: 'Matched', itemStyle: { color: colors[1] } },
          { value: 60, name: 'Validated', itemStyle: { color: colors[2] } },
          { value: 40, name: 'Confirmed', itemStyle: { color: colors[3] } },
          { value: 20, name: 'Settled', itemStyle: { color: colors[4] || colors[0] } }
        ]
      }]
    };
  }

  private getTreemapChartOptions(): EChartsOption {
    const colors = this.getColors();
    const showLabels = this.config?.showLabels !== false; // Show by default for treemap

    return {
      series: [{
        type: 'treemap',
        data: [
          { name: 'APAC', value: 35, itemStyle: { color: colors[0] }, children: [{ name: 'Japan', value: 15 }, { name: 'Singapore', value: 12 }, { name: 'Hong Kong', value: 8 }] },
          { name: 'EMEA', value: 30, itemStyle: { color: colors[1] }, children: [{ name: 'UK', value: 12 }, { name: 'Germany', value: 10 }, { name: 'France', value: 8 }] },
          { name: 'NAM', value: 25, itemStyle: { color: colors[2] }, children: [{ name: 'USA', value: 20 }, { name: 'Canada', value: 5 }] },
          { name: 'LATAM', value: 10, itemStyle: { color: colors[3] }, children: [{ name: 'Brazil', value: 6 }, { name: 'Mexico', value: 4 }] }
        ],
        label: { show: showLabels, color: '#f0f6fc' },
        levels: [{
          itemStyle: { borderColor: '#161b22', borderWidth: 2, gapWidth: 2 }
        }]
      }]
    };
  }
}
