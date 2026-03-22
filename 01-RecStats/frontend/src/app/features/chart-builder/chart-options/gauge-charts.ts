import { EChartsOption } from 'echarts';
import { ChartContext } from './types';

export function getGaugeChartOptions(ctx: ChartContext): EChartsOption {
  const xField = ctx.config?.xAxis || 'name';
  const yField = ctx.config?.yAxis || 'value';
  const colors = ctx.colors;

  let value = 73;
  let name = 'Value';

  if (ctx.data && ctx.data.length > 0) {
    const firstRow = ctx.data[0];
    value = Number(firstRow[yField]) || 0;
    name = String(firstRow[xField] || yField);
  }

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

export function getSpeedometerChartOptions(ctx: ChartContext): EChartsOption {
  const colors = ctx.colors;

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

export function getRadialBarChartOptions(ctx: ChartContext): EChartsOption {
  const xField = ctx.config?.xAxis || 'name';
  const yField = ctx.config?.yAxis || 'value';
  const colors = ctx.colors;
  const showLabels = ctx.config?.showLabels === true;

  let categories: string[] = ['Match Rate', 'SLA %', 'Automation'];
  let values: number[] = [92, 87, 78];

  if (ctx.data && ctx.data.length > 0) {
    categories = ctx.data.map(row => String(row[xField] || ''));
    values = ctx.data.map(row => Number(row[yField]) || 0);
  }

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
