import { Component, Input, OnInit, OnChanges, SimpleChanges, inject, Output, EventEmitter } from '@angular/core';
import { EChartsOption } from 'echarts';
import { ApiService } from '../../core/services/api.service';
import { DataLoaderService } from '../../core/services/data-loader.service';
import { firstValueFrom } from 'rxjs';
import { CrossFilter } from './widget-wrapper.component';

interface ChartDataResponse {
  chart: any;
  data: any[];
  columns: { name: string; data_type: string }[];
}

interface QueryResult {
  columns: { name: string; data_type: string }[];
  data: any[];
  row_count?: number;
  execution_time_ms?: number;
}

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
  private api = inject(ApiService);
  private dataLoader = inject(DataLoaderService);

  @Input() chartType = 'bar';
  @Input() config: any = {};
  @Input() data: any[] = [];
  @Input() sql?: string;  // Direct SQL to execute
  @Input() chartId?: string;  // Chart ID to fetch from API
  @Input() filters: CrossFilter[] = [];  // Cross-filters from other widgets
  @Output() filterApply = new EventEmitter<{ field: string; value: any }>();

  chartOptions: EChartsOption = {};
  loading = false;
  private chartInstance: any;

  ngOnInit() {
    this.loadData();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['chartType'] || changes['data'] || changes['config'] || changes['sql'] || changes['chartId'] || changes['filters']) {
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
    // Priority: chartId > sql > static data
    if (this.chartId) {
      this.loading = true;
      try {
        const response = await firstValueFrom(
          this.api.get<ChartDataResponse>(`/charts/${this.chartId}/data/direct`)
        );
        this.data = response.data;
        // Use chart config from API if available
        if (response.chart?.config) {
          this.config = { ...this.config, ...response.chart.config };
        }
        if (response.chart?.chart_type) {
          this.chartType = response.chart.chart_type;
        }
      } catch (error) {
        console.error('Chart data fetch error:', error);
      } finally {
        this.loading = false;
      }
    } else if (this.sql) {
      this.loading = true;
      try {
        // Apply cross-filters to SQL
        const filteredSql = this.applyFiltersToSql(this.sql);
        // Use DuckDB for in-browser query execution
        const result = await this.dataLoader.executeQuery(filteredSql);
        this.data = result.rows;
      } catch (error) {
        console.error('Chart query error (DuckDB):', error);
        // Fallback to backend API if DuckDB fails
        try {
          const filteredSql = this.applyFiltersToSql(this.sql);
          const response = await firstValueFrom(
            this.api.post<QueryResult>('/queries/direct', { sql: filteredSql })
          );
          this.data = response.data;
        } catch (fallbackError) {
          console.error('Chart query fallback error:', fallbackError);
        }
      } finally {
        this.loading = false;
      }
    }
    this.updateChart();
  }

  private applyFiltersToSql(sql: string): string {
    if (!this.filters || this.filters.length === 0) return sql;

    // Build WHERE clause additions
    const filterConditions = this.filters.map(f => {
      const value = typeof f.value === 'string' ? `'${f.value.replace(/'/g, "''")}'` : f.value;
      return `${f.field} = ${value}`;
    }).join(' AND ');

    // Inject filters into SQL
    const upperSql = sql.toUpperCase();
    if (upperSql.includes(' WHERE ')) {
      return sql.replace(/ WHERE /i, ` WHERE (${filterConditions}) AND `);
    } else if (upperSql.includes(' GROUP BY ')) {
      return sql.replace(/ GROUP BY /i, ` WHERE ${filterConditions} GROUP BY `);
    } else if (upperSql.includes(' ORDER BY ')) {
      return sql.replace(/ ORDER BY /i, ` WHERE ${filterConditions} ORDER BY `);
    } else if (upperSql.includes(' LIMIT ')) {
      return sql.replace(/ LIMIT /i, ` WHERE ${filterConditions} LIMIT `);
    } else {
      return `${sql} WHERE ${filterConditions}`;
    }
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
      case 'map':
      case 'worldMap':
        return this.getMapOptions();
      case 'pie':
        return this.getPieOptions();
      case 'area':
        return this.getAreaOptions();
      case 'heatmap':
        return this.getHeatmapOptions();
      default:
        return this.getBarOptions();
    }
  }

  private getBarOptions(): EChartsOption {
    // Extract data from API response
    const categoryField = this.config.categoryField || this.config.xAxis || 'category';
    const valueField = this.config.valueField || this.config.yAxis || 'value';

    // Use data from API if available
    const categories = this.data.length > 0
      ? this.data.map(d => {
          const label = d[categoryField] || d[Object.keys(d)[0]];
          // Truncate long labels
          return typeof label === 'string' && label.length > 12 ? label.substring(0, 10) + '..' : label;
        })
      : ['APAC', 'EMEA', 'NAM', 'LATAM'];
    const values = this.data.length > 0
      ? this.data.map(d => d[valueField] || d[Object.keys(d)[1]])
      : [42, 35, 58, 28];

    // Store full labels for tooltips
    const fullLabels = this.data.length > 0
      ? this.data.map(d => d[categoryField] || d[Object.keys(d)[0]])
      : categories;

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const idx = params[0]?.dataIndex ?? 0;
          const fullLabel = fullLabels[idx] || categories[idx];
          const value = params[0]?.value ?? 0;
          return `<b>${fullLabel}</b><br/>Value: ${Number(value).toLocaleString()}`;
        },
        backgroundColor: '#21262d',
        borderColor: '#30363d',
        textStyle: { color: '#f0f6fc' }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '8%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLine: { lineStyle: { color: '#30363d' } },
        axisLabel: {
          color: '#8b949e',
          fontSize: 10,
          rotate: categories.length > 6 ? 30 : 0,
          interval: 0
        }
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#30363d' } },
        axisLabel: { color: '#8b949e', fontSize: 10 },
        splitLine: { lineStyle: { color: '#21262d' } }
      },
      series: [{
        type: 'bar',
        data: values,
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
        },
        label: {
          show: values.length <= 8,
          position: 'top',
          fontSize: 10,
          color: '#8b949e',
          formatter: (params: any) => params.value >= 1000 ? (params.value / 1000).toFixed(1) + 'K' : params.value
        }
      }]
    };
  }

  private getLineOptions(): EChartsOption {
    const categoryField = this.config.categoryField || this.config.xAxis || 'category';
    const valueField = this.config.valueField || this.config.yAxis || 'value';

    const categories = this.data.length > 0
      ? this.data.map(d => d[categoryField] || d[Object.keys(d)[0]])
      : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const values = this.data.length > 0
      ? this.data.map(d => d[valueField] || d[Object.keys(d)[1]])
      : [820, 932, 901, 934, 1290, 1330];

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
    const nameField = this.config.nameField || this.config.categoryField || 'name';
    const valueField = this.config.valueField || 'value';
    const colors = ['#2ecc71', '#f1c40f', '#e74c3c', '#3498db', '#9b59b6', '#e67e22'];

    const pieData = this.data.length > 0
      ? this.data.map((d, i) => ({
          value: d[valueField] || d[Object.keys(d)[1]],
          name: d[nameField] || d[Object.keys(d)[0]],
          itemStyle: { color: colors[i % colors.length] }
        }))
      : [
          { value: 335, name: 'Matched', itemStyle: { color: '#2ecc71' } },
          { value: 234, name: 'Unmatched', itemStyle: { color: '#f1c40f' } },
          { value: 154, name: 'Breaks', itemStyle: { color: '#e74c3c' } }
        ];

    return {
      series: [{
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '50%'],
        data: pieData,
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
    const valueField = this.config.valueField || 'value';
    const gaugeValue = this.data.length > 0
      ? (this.data[0][valueField] || this.data[0][Object.keys(this.data[0])[0]])
      : 87;

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
        data: [{ value: gaugeValue }]
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

  private getMapOptions(): EChartsOption {
    const nameField = this.config.nameField || this.config.categoryField || 'country';
    const valueField = this.config.valueField || 'value';

    // Map data from API or use demo data
    const rawData = this.data.length > 0
      ? this.data.map(d => ({
          name: d[nameField] || d[Object.keys(d)[0]],
          value: d[valueField] || d[Object.keys(d)[1]] || 0
        }))
      : [
          { name: 'United States', value: 28500 },
          { name: 'United Kingdom', value: 18200 },
          { name: 'Germany', value: 12400 },
          { name: 'Japan', value: 15600 },
          { name: 'China', value: 22300 },
          { name: 'Singapore', value: 9800 },
          { name: 'Hong Kong', value: 11200 },
          { name: 'Australia', value: 7500 },
          { name: 'France', value: 8900 },
          { name: 'India', value: 6200 },
          { name: 'Brazil', value: 4100 },
          { name: 'Canada', value: 5800 },
          { name: 'Switzerland', value: 7200 },
          { name: 'Mexico', value: 3400 }
        ];

    // Group countries by region for treemap
    const regionGroups: { [key: string]: string[] } = {
      'APAC': ['Japan', 'China', 'India', 'Australia', 'Singapore', 'Hong Kong', 'South Korea'],
      'EMEA': ['United Kingdom', 'UK', 'Germany', 'France', 'Switzerland', 'Netherlands', 'Italy', 'Spain'],
      'NAM': ['United States', 'USA', 'Canada', 'Mexico'],
      'LATAM': ['Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru']
    };

    const regionColors: { [key: string]: string } = {
      'APAC': '#0066b2',
      'EMEA': '#3399cc',
      'NAM': '#2ecc71',
      'LATAM': '#f1c40f'
    };

    const getRegion = (country: string): string => {
      for (const [region, countries] of Object.entries(regionGroups)) {
        if (countries.includes(country)) return region;
      }
      return 'EMEA';
    };

    // Build treemap data structure
    const regionData: { [key: string]: { name: string; value: number }[] } = {
      'APAC': [], 'EMEA': [], 'NAM': [], 'LATAM': []
    };

    rawData.forEach(d => {
      const region = getRegion(d.name as string);
      regionData[region].push({ name: d.name as string, value: d.value as number });
    });

    const treemapData = Object.entries(regionData)
      .filter(([_, countries]) => countries.length > 0)
      .map(([region, countries]) => ({
        name: region,
        itemStyle: { borderColor: '#161b22', borderWidth: 2 },
        children: countries.map(c => ({
          name: c.name,
          value: c.value,
          itemStyle: {
            color: regionColors[region],
            borderColor: '#21262d',
            borderWidth: 1
          }
        }))
      }));

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          if (params.data.children) {
            const total = params.data.children.reduce((sum: number, c: any) => sum + c.value, 0);
            return `<b>${params.name}</b><br/>Total: ${total.toLocaleString()} transactions`;
          }
          return `<b>${params.name}</b><br/>Transactions: ${params.value?.toLocaleString() || 0}`;
        },
        backgroundColor: '#21262d',
        borderColor: '#30363d',
        textStyle: { color: '#f0f6fc' }
      },
      series: [{
        type: 'treemap',
        data: treemapData,
        width: '95%',
        height: '90%',
        top: '5%',
        left: '2.5%',
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        levels: [
          {
            itemStyle: {
              borderColor: '#30363d',
              borderWidth: 3,
              gapWidth: 3
            },
            upperLabel: {
              show: true,
              height: 24,
              color: '#f0f6fc',
              fontSize: 12,
              fontWeight: 'bold',
              backgroundColor: 'rgba(0,0,0,0.3)',
              padding: [4, 8]
            }
          },
          {
            itemStyle: {
              borderColor: '#21262d',
              borderWidth: 1,
              gapWidth: 1
            },
            label: {
              show: true,
              formatter: (params: any) => {
                const name = params.name.length > 10 ? params.name.substring(0, 8) + '..' : params.name;
                return `${name}\n${(params.value / 1000).toFixed(1)}K`;
              },
              fontSize: 10,
              color: '#f0f6fc',
              lineHeight: 14
            }
          }
        ],
        label: {
          show: true,
          formatter: '{b}',
          color: '#f0f6fc',
          fontSize: 10
        }
      }]
    };
  }

  private getPieOptions(): EChartsOption {
    const nameField = this.config.nameField || this.config.categoryField || 'name';
    const valueField = this.config.valueField || 'value';
    const colors = ['#0066b2', '#3399cc', '#66ccff', '#2ecc71', '#f1c40f', '#e74c3c'];

    const pieData = this.data.length > 0
      ? this.data.map((d, i) => ({
          value: d[valueField] || d[Object.keys(d)[1]],
          name: d[nameField] || d[Object.keys(d)[0]],
          itemStyle: { color: colors[i % colors.length] }
        }))
      : [
          { value: 335, name: 'Markets', itemStyle: { color: colors[0] } },
          { value: 234, name: 'Banking', itemStyle: { color: colors[1] } },
          { value: 154, name: 'Securities', itemStyle: { color: colors[2] } },
          { value: 135, name: 'Treasury', itemStyle: { color: colors[3] } }
        ];

    return {
      series: [{
        type: 'pie',
        radius: '70%',
        center: ['50%', '50%'],
        data: pieData,
        label: {
          show: true,
          color: '#8b949e',
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

  private getAreaOptions(): EChartsOption {
    const categoryField = this.config.categoryField || this.config.xAxis || 'category';
    const valueField = this.config.valueField || this.config.yAxis || 'value';

    const categories = this.data.length > 0
      ? this.data.map(d => d[categoryField] || d[Object.keys(d)[0]])
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const values = this.data.length > 0
      ? this.data.map(d => d[valueField] || d[Object.keys(d)[1]])
      : [150, 230, 224, 218, 135, 147, 260];

    return {
      xAxis: {
        type: 'category',
        boundaryGap: false,
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
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(0, 102, 178, 0.6)' },
              { offset: 1, color: 'rgba(0, 102, 178, 0.1)' }
            ]
          }
        },
        lineStyle: { color: '#0066b2', width: 2 },
        itemStyle: { color: '#3399cc' }
      }]
    };
  }

  private getHeatmapOptions(): EChartsOption {
    // Generate heatmap data: [x, y, value]
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const hours = ['9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm'];

    let heatmapData: number[][] = [];
    if (this.data.length > 0) {
      // Try to use provided data
      const xField = this.config.xField || 'x';
      const yField = this.config.yField || 'y';
      const valueField = this.config.valueField || 'value';
      heatmapData = this.data.map(d => [d[xField], d[yField], d[valueField]]);
    } else {
      // Generate demo heatmap data
      for (let i = 0; i < days.length; i++) {
        for (let j = 0; j < hours.length; j++) {
          heatmapData.push([i, j, Math.floor(Math.random() * 100)]);
        }
      }
    }

    return {
      tooltip: {
        position: 'top'
      },
      grid: {
        top: '10%',
        left: '15%',
        right: '10%',
        bottom: '15%'
      },
      xAxis: {
        type: 'category',
        data: days,
        splitArea: { show: true },
        axisLine: { lineStyle: { color: '#30363d' } }
      },
      yAxis: {
        type: 'category',
        data: hours,
        splitArea: { show: true },
        axisLine: { lineStyle: { color: '#30363d' } }
      },
      visualMap: {
        min: 0,
        max: 100,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '0%',
        inRange: {
          color: ['#21262d', '#1a3a52', '#0066b2', '#3399cc']
        },
        textStyle: { color: '#8b949e' }
      },
      series: [{
        type: 'heatmap',
        data: heatmapData,
        label: { show: false },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }]
    };
  }
}
