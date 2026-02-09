import { EChartsOption } from 'echarts';
import { ChartContext } from './types';
import { hexToRgba } from './utils';

export function getScatterChartOptions(ctx: ChartContext): EChartsOption {
  const xField = ctx.config?.xAxis || 'x';
  const yField = ctx.config?.yAxis || 'y';
  const colors = ctx.colors;
  const showLabels = ctx.config?.showLabels === true;

  let scatterData: number[][] = [[10, 8.04], [8, 6.95], [13, 7.58], [9, 8.81], [11, 8.33], [14, 7.66], [6, 6.13], [4, 3.1], [12, 9.13], [7, 7.26]];

  if (ctx.data && ctx.data.length > 0) {
    scatterData = ctx.data.map(row => [
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
      itemStyle: { color: colors[0], shadowBlur: 10, shadowColor: hexToRgba(colors[0], 0.5) }
    }]
  };
}

export function getRadarChartOptions(ctx: ChartContext): EChartsOption {
  const xField = ctx.config?.xAxis || 'name';
  const yField = ctx.config?.yAxis || 'value';
  const colors = ctx.colors;
  const showLabels = ctx.config?.showLabels === true;

  let indicators: any[] = [
    { name: 'Match Rate', max: 100 },
    { name: 'SLA', max: 100 },
    { name: 'Volume', max: 100 },
    { name: 'Accuracy', max: 100 },
    { name: 'Timeliness', max: 100 }
  ];
  let radarData: any[] = [{ value: [92, 88, 75, 95, 82], name: 'Current' }];

  if (ctx.data && ctx.data.length > 0) {
    const categories = ctx.data.map(row => String(row[xField] || ''));
    const values = ctx.data.map(row => Number(row[yField]) || 0);
    const maxValue = Math.max(...values, 100);

    indicators = categories.map(name => ({ name, max: Math.ceil(maxValue * 1.1) }));
    radarData = [{ value: values, name: ctx.config?.title || 'Data' }];
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
        areaStyle: { color: hexToRgba(colors[i % colors.length], 0.3) },
        lineStyle: { color: colors[i % colors.length] },
        label: { show: showLabels, color: '#f0f6fc', fontSize: 10 }
      }))
    }]
  };
}

export function getHeatmapChartOptions(ctx: ChartContext): EChartsOption {
  const xField = ctx.config?.xAxis || 'x';
  const yField = ctx.config?.yAxis || 'y';
  const groupField = ctx.config?.groupBy;
  const colors = ctx.colors;
  const showLabels = ctx.config?.showLabels === true;

  let xCategories = ['12a', '2a', '4a', '6a', '8a', '10a', '12p', '2p', '4p', '6p', '8p', '10p'];
  let yCategories = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  let heatData: number[][] = [];
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 12; j++) {
      heatData.push([j, i, Math.round(Math.random() * 10)]);
    }
  }
  let maxValue = 10;

  if (ctx.data && ctx.data.length > 0) {
    const xSet = new Set<string>();
    const ySet = new Set<string>();
    ctx.data.forEach(row => {
      xSet.add(String(row[xField] || ''));
      ySet.add(String(row[yField] || ''));
    });
    xCategories = Array.from(xSet);
    yCategories = Array.from(ySet);

    const valueField = groupField || 'value';
    heatData = ctx.data.map(row => {
      const xIndex = xCategories.indexOf(String(row[xField] || ''));
      const yIndex = yCategories.indexOf(String(row[yField] || ''));
      const value = Number(row[valueField]) || 0;
      return [xIndex, yIndex, value];
    }).filter(d => d[0] >= 0 && d[1] >= 0);

    maxValue = Math.max(...heatData.map(d => d[2]), 1);
  }

  return {
    xAxis: { type: 'category', data: xCategories, splitArea: { show: true }, axisLabel: { color: '#8b949e' } },
    yAxis: { type: 'category', data: yCategories, splitArea: { show: true }, axisLabel: { color: '#8b949e' } },
    visualMap: { min: 0, max: maxValue, calculable: true, orient: 'horizontal', left: 'center', bottom: 10, inRange: { color: ['#0d1117', colors[0], colors[1]] }, textStyle: { color: '#8b949e' } },
    series: [{ type: 'heatmap', data: heatData, label: { show: showLabels, color: '#f0f6fc' } }]
  };
}

export function getFunnelChartOptions(ctx: ChartContext): EChartsOption {
  const xField = ctx.config?.xAxis || 'name';
  const yField = ctx.config?.yAxis || 'value';
  const colors = ctx.colors;
  const showLabels = ctx.config?.showLabels !== false;

  let funnelData: any[] = [
    { value: 100, name: 'Total Transactions' },
    { value: 80, name: 'Matched' },
    { value: 60, name: 'Validated' },
    { value: 40, name: 'Confirmed' },
    { value: 20, name: 'Settled' }
  ];

  if (ctx.data && ctx.data.length > 0) {
    funnelData = ctx.data.map(row => ({
      value: Number(row[yField]) || 0,
      name: String(row[xField] || '')
    }));
    funnelData.sort((a, b) => b.value - a.value);
  }

  funnelData = funnelData.map((item, i) => ({
    ...item,
    itemStyle: { color: colors[i % colors.length] }
  }));

  return {
    series: [{
      type: 'funnel',
      left: '10%',
      width: '80%',
      label: { show: showLabels, position: 'inside', color: '#f0f6fc' },
      itemStyle: { borderWidth: 0 },
      data: funnelData
    }]
  };
}

export function getTreemapChartOptions(ctx: ChartContext): EChartsOption {
  const xField = ctx.config?.xAxis || 'name';
  const yField = ctx.config?.yAxis || 'value';
  const groupField = ctx.config?.groupBy;
  const colors = ctx.colors;
  const showLabels = ctx.config?.showLabels !== false;

  let treemapData: any[] = [
    { name: 'APAC', value: 35, children: [{ name: 'Japan', value: 15 }, { name: 'Singapore', value: 12 }, { name: 'Hong Kong', value: 8 }] },
    { name: 'EMEA', value: 30, children: [{ name: 'UK', value: 12 }, { name: 'Germany', value: 10 }, { name: 'France', value: 8 }] },
    { name: 'NAM', value: 25, children: [{ name: 'USA', value: 20 }, { name: 'Canada', value: 5 }] },
    { name: 'LATAM', value: 10, children: [{ name: 'Brazil', value: 6 }, { name: 'Mexico', value: 4 }] }
  ];

  if (ctx.data && ctx.data.length > 0) {
    if (groupField) {
      const groups = new Map<string, any[]>();
      ctx.data.forEach(row => {
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
      treemapData = ctx.data.map(row => ({
        name: String(row[xField] || ''),
        value: Number(row[yField]) || 0
      }));
    }
  }

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
      levels: [{ itemStyle: { borderColor: '#161b22', borderWidth: 2, gapWidth: 2 } }]
    }]
  };
}
