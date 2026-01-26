import { EChartsOption } from 'echarts';
import { ChartContext } from './types';
import { formatNumber } from './utils';

export function getKPICardOptions(ctx: ChartContext): EChartsOption {
  const yField = ctx.config?.yAxis || 'value';
  const colors = ctx.colors;
  const enableAnimation = ctx.config?.enableAnimation !== false;

  let value = 12345;
  let label = ctx.config?.title || 'Total Value';

  if (ctx.data && ctx.data.length > 0) {
    value = ctx.data.reduce((sum, row) => sum + (Number(row[yField]) || 0), 0);
  }

  return {
    legend: { show: false },
    grid: { show: false },
    xAxis: { show: false },
    yAxis: { show: false },
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '35%',
        style: {
          text: formatNumber(value),
          fontSize: 64,
          fontWeight: 'bold' as const,
          fill: colors[0]
        },
        z: 100
      },
      {
        type: 'text',
        left: 'center',
        top: '60%',
        style: {
          text: label,
          fontSize: 16,
          fill: '#8b949e'
        },
        z: 100
      }
    ],
    animation: enableAnimation
  };
}

export function getWorldMapChartOptions(ctx: ChartContext): EChartsOption {
  const xField = ctx.config?.xAxis || 'country';
  const yField = ctx.config?.yAxis || 'value';
  const colors = ctx.colors;
  const showLabels = ctx.config?.showLabels === true;
  const enableAnimation = ctx.config?.enableAnimation !== false;

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

  if (ctx.data && ctx.data.length > 0) {
    mapData = ctx.data.map(row => ({
      name: String(row[xField] || ''),
      value: Number(row[yField]) || 0
    }));
  }

  const maxValue = Math.max(...mapData.map(d => d.value), 1);

  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: '#21262d',
      borderColor: '#30363d',
      textStyle: { color: '#f0f6fc' },
      formatter: (params: any) => `${params.name}: ${params.value?.toLocaleString() || 0}`
    },
    visualMap: {
      min: 0,
      max: maxValue,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 20,
      inRange: { color: ['#0d1117', colors[0], colors[1]] },
      textStyle: { color: '#8b949e' }
    },
    geo: {
      map: 'world',
      roam: true,
      zoom: 1.2,
      label: { show: showLabels, color: '#f0f6fc', fontSize: 10 },
      itemStyle: { areaColor: '#161b22', borderColor: '#30363d' },
      emphasis: {
        itemStyle: { areaColor: colors[0] },
        label: { show: true, color: '#f0f6fc' }
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
