import { EChartsOption } from 'echarts';
import { ChartContext, SAMPLE_DATA } from './types';
import { hexToRgba } from './utils';

export function getLineChartOptions(ctx: ChartContext): EChartsOption {
  const xField = ctx.config?.xAxis || 'category';
  const yField = ctx.config?.yAxis || 'value';
  const colors = ctx.colors;
  const showLabels = ctx.config?.showLabels === true;
  const primaryColor = colors[0];

  let categories: string[] = SAMPLE_DATA.timeCategories;
  let values: number[] = SAMPLE_DATA.timeValues;

  if (ctx.data && ctx.data.length > 0) {
    categories = ctx.data.map(row => String(row[xField] || ''));
    values = ctx.data.map(row => Number(row[yField]) || 0);
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
            { offset: 0, color: hexToRgba(primaryColor, 0.3) },
            { offset: 1, color: hexToRgba(primaryColor, 0) }
          ]
        }
      }
    }]
  };
}

export function getAreaChartOptions(ctx: ChartContext): EChartsOption {
  const xField = ctx.config?.xAxis || 'category';
  const yField = ctx.config?.yAxis || 'value';
  const colors = ctx.colors;
  const showLabels = ctx.config?.showLabels === true;
  const primaryColor = colors[0];

  let categories: string[] = SAMPLE_DATA.timeCategories;
  let values: number[] = SAMPLE_DATA.timeValues;

  if (ctx.data && ctx.data.length > 0) {
    categories = ctx.data.map(row => String(row[xField] || ''));
    values = ctx.data.map(row => Number(row[yField]) || 0);
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
            { offset: 0, color: hexToRgba(primaryColor, 0.5) },
            { offset: 1, color: hexToRgba(primaryColor, 0.1) }
          ]
        }
      }
    }]
  };
}
