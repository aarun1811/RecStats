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
      case 'kpiCard':
        return this.getKPICardOptions();
      case 'worldMap':
        return this.getWorldMapChartOptions();
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
    const xField = this.config?.xAxis || 'name';
    const yField = this.config?.yAxis || 'value';
    const colors = this.getColors();

    // Default values
    let value = 73;
    let name = 'Value';

    // Use real data if available (first row)
    if (this.data && this.data.length > 0) {
      const firstRow = this.data[0];
      value = Number(firstRow[yField]) || 0;
      name = String(firstRow[xField] || yField);
    }

    // Auto-detect max based on value magnitude
    const max = value > 100 ? Math.ceil(value * 1.2 / 100) * 100 : 100;
    const isPercentage = max <= 100;

    return {
      series: [{
        type: 'gauge',
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: max,
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
          formatter: isPercentage ? '{value}%' : '{value}',
          color: '#f0f6fc'
        },
        data: [{ value, name }]
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
    const xField = this.config?.xAxis || 'name';
    const yField = this.config?.yAxis || 'value';
    const colors = this.getColors();
    const showLabels = this.config?.showLabels === true;

    // Default sample data
    let categories: string[] = ['Match Rate', 'SLA %', 'Automation'];
    let values: number[] = [92, 87, 78];

    // Use real data if available
    if (this.data && this.data.length > 0) {
      categories = this.data.map(row => String(row[xField] || ''));
      values = this.data.map(row => Number(row[yField]) || 0);
    }

    // Calculate max for axis
    const maxValue = Math.max(...values, 100);

    return {
      polar: { radius: ['30%', '80%'] },
      radiusAxis: { max: maxValue, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false } },
      angleAxis: { type: 'category', data: categories, startAngle: 90, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#8b949e' } },
      series: [{
        type: 'bar',
        data: values,
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
    const xField = this.config?.xAxis || 'x';
    const yField = this.config?.yAxis || 'y';
    const groupField = this.config?.groupBy; // Value field
    const colors = this.getColors();
    const showLabels = this.config?.showLabels === true;

    // Default sample data
    let xCategories = ['12a', '2a', '4a', '6a', '8a', '10a', '12p', '2p', '4p', '6p', '8p', '10p'];
    let yCategories = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let heatData: number[][] = [];
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 12; j++) {
        heatData.push([j, i, Math.round(Math.random() * 10)]);
      }
    }
    let maxValue = 10;

    // Use real data if available
    if (this.data && this.data.length > 0) {
      // Get unique x and y values
      const xSet = new Set<string>();
      const ySet = new Set<string>();
      this.data.forEach(row => {
        xSet.add(String(row[xField] || ''));
        ySet.add(String(row[yField] || ''));
      });
      xCategories = Array.from(xSet);
      yCategories = Array.from(ySet);

      // Build heatmap data: [xIndex, yIndex, value]
      const valueField = groupField || 'value';
      heatData = this.data.map(row => {
        const xIndex = xCategories.indexOf(String(row[xField] || ''));
        const yIndex = yCategories.indexOf(String(row[yField] || ''));
        const value = Number(row[valueField]) || 0;
        return [xIndex, yIndex, value];
      }).filter(d => d[0] >= 0 && d[1] >= 0); // Filter out invalid indices

      maxValue = Math.max(...heatData.map(d => d[2]), 1);
    }

    return {
      xAxis: { type: 'category', data: xCategories, splitArea: { show: true }, axisLabel: { color: '#8b949e' } },
      yAxis: { type: 'category', data: yCategories, splitArea: { show: true }, axisLabel: { color: '#8b949e' } },
      visualMap: { min: 0, max: maxValue, calculable: true, orient: 'horizontal', left: 'center', bottom: 10, inRange: { color: ['#0d1117', colors[0], colors[1]] }, textStyle: { color: '#8b949e' } },
      series: [{ type: 'heatmap', data: heatData, label: { show: showLabels, color: '#f0f6fc' } }]
    };
  }

  private getScatterChartOptions(): EChartsOption {
    const xField = this.config?.xAxis || 'x';
    const yField = this.config?.yAxis || 'y';
    const colors = this.getColors();
    const showLabels = this.config?.showLabels === true;

    // Default sample data
    let scatterData: number[][] = [[10, 8.04], [8, 6.95], [13, 7.58], [9, 8.81], [11, 8.33], [14, 7.66], [6, 6.13], [4, 3.1], [12, 9.13], [7, 7.26]];

    // Use real data if available
    if (this.data && this.data.length > 0) {
      scatterData = this.data.map(row => [
        Number(row[xField]) || 0,
        Number(row[yField]) || 0
      ]);
    }

    return {
      xAxis: {
        type: 'value',
        name: xField,
        nameTextStyle: { color: '#8b949e' },
        axisLine: { lineStyle: { color: '#30363d' } },
        splitLine: { lineStyle: { color: '#21262d' } }
      },
      yAxis: {
        type: 'value',
        name: yField,
        nameTextStyle: { color: '#8b949e' },
        axisLine: { lineStyle: { color: '#30363d' } },
        splitLine: { lineStyle: { color: '#21262d' } }
      },
      series: [{
        type: 'scatter',
        symbolSize: 15,
        data: scatterData,
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
    const xField = this.config?.xAxis || 'name';
    const yField = this.config?.yAxis || 'value';
    const colors = this.getColors();
    const showLabels = this.config?.showLabels === true;

    // Default indicators and data
    let indicators: any[] = [
      { name: 'Match Rate', max: 100 },
      { name: 'SLA', max: 100 },
      { name: 'Volume', max: 100 },
      { name: 'Accuracy', max: 100 },
      { name: 'Timeliness', max: 100 }
    ];
    let radarData: any[] = [{
      value: [92, 88, 75, 95, 82],
      name: 'Current'
    }];

    // Use real data if available
    if (this.data && this.data.length > 0) {
      // Use xAxis as category (indicator name), yAxis as value
      // Each row becomes an indicator point
      const categories = this.data.map(row => String(row[xField] || ''));
      const values = this.data.map(row => Number(row[yField]) || 0);
      const maxValue = Math.max(...values, 100);

      indicators = categories.map(name => ({
        name,
        max: Math.ceil(maxValue * 1.1) // 10% headroom
      }));

      radarData = [{
        value: values,
        name: this.config?.title || 'Data'
      }];
    }

    return {
      radar: {
        indicator: indicators,
        axisName: { color: '#8b949e' },
        splitArea: { areaStyle: { color: ['#161b22', '#1a1f26'] } },
        axisLine: { lineStyle: { color: '#30363d' } },
        splitLine: { lineStyle: { color: '#30363d' } }
      },
      series: [{
        type: 'radar',
        data: radarData.map((item, i) => ({
          ...item,
          areaStyle: { color: this.hexToRgba(colors[i % colors.length], 0.3) },
          lineStyle: { color: colors[i % colors.length] },
          label: {
            show: showLabels,
            color: '#f0f6fc',
            fontSize: 10
          }
        }))
      }]
    };
  }

  private getFunnelChartOptions(): EChartsOption {
    const xField = this.config?.xAxis || 'name';
    const yField = this.config?.yAxis || 'value';
    const colors = this.getColors();
    const showLabels = this.config?.showLabels !== false; // Show by default for funnel

    // Default sample data
    let funnelData: any[] = [
      { value: 100, name: 'Total Transactions' },
      { value: 80, name: 'Matched' },
      { value: 60, name: 'Validated' },
      { value: 40, name: 'Confirmed' },
      { value: 20, name: 'Settled' }
    ];

    // Use real data if available
    if (this.data && this.data.length > 0) {
      funnelData = this.data.map(row => ({
        value: Number(row[yField]) || 0,
        name: String(row[xField] || '')
      }));
      // Sort by value descending (largest at top)
      funnelData.sort((a, b) => b.value - a.value);
    }

    // Apply colors
    funnelData = funnelData.map((item, i) => ({
      ...item,
      itemStyle: { color: colors[i % colors.length] }
    }));

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
        data: funnelData
      }]
    };
  }

  private getTreemapChartOptions(): EChartsOption {
    const xField = this.config?.xAxis || 'name';
    const yField = this.config?.yAxis || 'value';
    const groupField = this.config?.groupBy;
    const colors = this.getColors();
    const showLabels = this.config?.showLabels !== false; // Show by default for treemap

    // Default sample data
    let treemapData: any[] = [
      { name: 'APAC', value: 35, children: [{ name: 'Japan', value: 15 }, { name: 'Singapore', value: 12 }, { name: 'Hong Kong', value: 8 }] },
      { name: 'EMEA', value: 30, children: [{ name: 'UK', value: 12 }, { name: 'Germany', value: 10 }, { name: 'France', value: 8 }] },
      { name: 'NAM', value: 25, children: [{ name: 'USA', value: 20 }, { name: 'Canada', value: 5 }] },
      { name: 'LATAM', value: 10, children: [{ name: 'Brazil', value: 6 }, { name: 'Mexico', value: 4 }] }
    ];

    // Use real data if available
    if (this.data && this.data.length > 0) {
      if (groupField) {
        // Group data by groupField for hierarchical structure
        const groups = new Map<string, any[]>();
        this.data.forEach(row => {
          const group = String(row[groupField] || 'Other');
          if (!groups.has(group)) groups.set(group, []);
          groups.get(group)!.push({
            name: String(row[xField] || ''),
            value: Number(row[yField]) || 0
          });
        });

        treemapData = Array.from(groups.entries()).map(([groupName, children]) => ({
          name: groupName,
          value: children.reduce((sum, c) => sum + c.value, 0),
          children
        }));
      } else {
        // Flat structure - each row is a block
        treemapData = this.data.map(row => ({
          name: String(row[xField] || ''),
          value: Number(row[yField]) || 0
        }));
      }
    }

    // Apply colors
    treemapData = treemapData.map((item, i) => ({
      ...item,
      itemStyle: { color: colors[i % colors.length] }
    }));

    return {
      legend: { show: false },
      grid: { bottom: '3%' },
      series: [{
        type: 'treemap',
        data: treemapData,
        top: 10,
        left: 10,
        right: 10,
        bottom: 10,
        breadcrumb: { show: false },
        label: { show: showLabels, color: '#f0f6fc' },
        levels: [{
          itemStyle: { borderColor: '#161b22', borderWidth: 2, gapWidth: 2 }
        }]
      }]
    };
  }

  private getKPICardOptions(): EChartsOption {
    const xField = this.config?.xAxis || 'name';
    const yField = this.config?.yAxis || 'value';
    const colors = this.getColors();
    const enableAnimation = this.config?.enableAnimation !== false;

    // Default values
    let value = 12345;
    let label = 'Total Value';

    // Use real data if available (first row)
    if (this.data && this.data.length > 0) {
      const firstRow = this.data[0];
      value = Number(firstRow[yField]) || 0;
      label = String(firstRow[xField] || this.config?.title || yField);
    }

    // Format large numbers
    const formatNumber = (n: number): string => {
      if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
      if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
      return n.toLocaleString();
    };

    // Use ECharts graphic for KPI display
    return {
      graphic: [
        {
          type: 'group',
          left: 'center',
          top: 'center',
          children: [
            {
              type: 'text',
              style: {
                text: formatNumber(value),
                fontSize: 72,
                fontWeight: 'bold' as const,
                fill: colors[0]
              },
              z: 100
            },
            {
              type: 'text',
              style: {
                text: label,
                fontSize: 18,
                fill: '#8b949e'
              },
              top: 50,
              z: 100
            }
          ]
        }
      ],
      animation: enableAnimation
    };
  }

  private getWorldMapChartOptions(): EChartsOption {
    const xField = this.config?.xAxis || 'country';
    const yField = this.config?.yAxis || 'value';
    const colors = this.getColors();
    const showLabels = this.config?.showLabels === true;
    const enableAnimation = this.config?.enableAnimation !== false;

    // Default sample data (country codes to values)
    let mapData: any[] = [
      { name: 'United States', value: 1000 },
      { name: 'China', value: 800 },
      { name: 'Japan', value: 600 },
      { name: 'Germany', value: 400 },
      { name: 'United Kingdom', value: 350 },
      { name: 'France', value: 300 },
      { name: 'India', value: 250 },
      { name: 'Brazil', value: 200 },
      { name: 'Canada', value: 180 },
      { name: 'Australia', value: 150 }
    ];

    // Use real data if available
    if (this.data && this.data.length > 0) {
      mapData = this.data.map(row => ({
        name: String(row[xField] || ''),
        value: Number(row[yField]) || 0
      }));
    }

    const maxValue = Math.max(...mapData.map(d => d.value), 1);

    // Note: For world map to work, you need to register the map
    // This creates a simplified scatter-geo visualization
    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: '#21262d',
        borderColor: '#30363d',
        textStyle: { color: '#f0f6fc' },
        formatter: (params: any) => {
          return `${params.name}: ${params.value?.toLocaleString() || 0}`;
        }
      },
      visualMap: {
        min: 0,
        max: maxValue,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 20,
        inRange: {
          color: ['#0d1117', colors[0], colors[1]]
        },
        textStyle: { color: '#8b949e' }
      },
      geo: {
        map: 'world',
        roam: true,
        zoom: 1.2,
        label: {
          show: showLabels,
          color: '#f0f6fc',
          fontSize: 10
        },
        itemStyle: {
          areaColor: '#161b22',
          borderColor: '#30363d'
        },
        emphasis: {
          itemStyle: {
            areaColor: colors[0]
          },
          label: {
            show: true,
            color: '#f0f6fc'
          }
        }
      },
      series: [{
        type: 'map',
        map: 'world',
        geoIndex: 0,
        data: mapData,
        animation: enableAnimation
      }]
    };
  }
}
