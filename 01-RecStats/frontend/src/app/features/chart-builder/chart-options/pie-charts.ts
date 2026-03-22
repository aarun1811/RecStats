import { EChartsOption } from 'echarts';
import { ChartContext } from './types';

export function getPieChartOptions(ctx: ChartContext): EChartsOption {
  const xField = ctx.config?.xAxis || 'category';
  const yField = ctx.config?.yAxis || 'value';
  const colors = ctx.colors;
  const showLabels = ctx.config?.showLabels !== false;

  let pieData: any[] = [
    { value: 335, name: 'Matched' },
    { value: 234, name: 'Unmatched' },
    { value: 154, name: 'Breaks' },
    { value: 135, name: 'Pending' }
  ];

  if (ctx.data && ctx.data.length > 0) {
    pieData = ctx.data.map((row, i) => ({
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

export function getDonutChartOptions(ctx: ChartContext): EChartsOption {
  const xField = ctx.config?.xAxis || 'category';
  const yField = ctx.config?.yAxis || 'value';
  const colors = ctx.colors;
  const showLabels = ctx.config?.showLabels !== false;

  let donutData: any[] = [
    { value: 335, name: 'Matched' },
    { value: 234, name: 'Unmatched' },
    { value: 154, name: 'Breaks' },
    { value: 135, name: 'Pending' }
  ];

  if (ctx.data && ctx.data.length > 0) {
    donutData = ctx.data.map((row, i) => ({
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
