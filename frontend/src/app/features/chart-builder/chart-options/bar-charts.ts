import { EChartsOption } from 'echarts';
import { ChartContext, SAMPLE_DATA } from './types';

export function getBarChartOptions(ctx: ChartContext): EChartsOption {
  const xField = ctx.config?.xAxis || 'category';
  const yField = ctx.config?.yAxis || 'value';
  const colors = ctx.colors;
  const showLabels = ctx.config?.showLabels === true;

  let categories: string[] = SAMPLE_DATA.categories;
  let values: number[] = SAMPLE_DATA.values;

  if (ctx.data && ctx.data.length > 0) {
    categories = ctx.data.map(row => String(row[xField] || ''));
    values = ctx.data.map(row => Number(row[yField]) || 0);
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

export function getColumnChartOptions(ctx: ChartContext): EChartsOption {
  const xField = ctx.config?.xAxis || 'category';
  const yField = ctx.config?.yAxis || 'value';
  const colors = ctx.colors;
  const showLabels = ctx.config?.showLabels === true;

  let categories: string[] = SAMPLE_DATA.categories;
  let values: number[] = SAMPLE_DATA.values;

  if (ctx.data && ctx.data.length > 0) {
    categories = ctx.data.map(row => String(row[xField] || ''));
    values = ctx.data.map(row => Number(row[yField]) || 0);
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
