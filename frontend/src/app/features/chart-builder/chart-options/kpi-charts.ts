import { EChartsOption } from 'echarts';
import { ChartContext } from './types';
import {
  formatNumber,
  formatValue,
  aggregate,
  calculateTrend,
  getAdaptiveFontSize,
  FormatOptions
} from './utils';

export function getKPICardOptions(ctx: ChartContext): EChartsOption {
  const yField = ctx.config?.yAxis || 'value';
  const colors = ctx.colors;
  const enableAnimation = ctx.config?.enableAnimation !== false;
  const kpiOpts = ctx.config?.kpiOptions;

  // Defaults for backward compatibility
  const aggregationType = kpiOpts?.aggregation || 'sum';
  const format = kpiOpts?.format || 'number';
  const showTrend = kpiOpts?.showTrend || false;
  const trendUpIsGood = kpiOpts?.trendUpIsGood !== false;

  // Calculate main value
  let value = 12345;
  let label = ctx.config?.title || 'Total Value';

  if (ctx.data && ctx.data.length > 0) {
    value = aggregate(ctx.data, yField, aggregationType);
  }

  // Format the value
  const formatOptions: FormatOptions = {
    format: format,
    decimals: kpiOpts?.decimals,
    currencyCode: kpiOpts?.currencyCode || 'USD',
    prefix: kpiOpts?.prefix,
    suffix: kpiOpts?.suffix,
    compact: true
  };
  const formattedValue = formatValue(value, formatOptions);

  // Calculate trend if enabled
  let trend: { direction: 'up' | 'down' | 'neutral'; percentage: number } | null = null;
  if (showTrend && kpiOpts?.trendCompareField && ctx.data && ctx.data.length >= 2) {
    trend = calculateTrend(
      ctx.data,
      yField,
      kpiOpts.trendCompareField,
      kpiOpts.trendMode || 'previous'
    );
  }

  // Adaptive font sizes
  const baseFontSize = 56;
  const valueFontSize = getAdaptiveFontSize(300, 200, formattedValue.length, baseFontSize);

  // Build graphic elements
  const graphicElements: any[] = [];

  // Aggregation type indicator badge (top-left)
  const aggregationLabels: Record<string, string> = {
    sum: 'SUM',
    average: 'AVG',
    min: 'MIN',
    max: 'MAX',
    count: 'COUNT',
    last: 'LATEST'
  };

  graphicElements.push({
    type: 'text',
    left: 16,
    top: 12,
    style: {
      text: aggregationLabels[aggregationType] || 'SUM',
      fontSize: 10,
      fontWeight: 600,
      fill: '#6e7681'
    },
    z: 100
  });

  // Main value
  graphicElements.push({
    type: 'text',
    left: 'center',
    top: showTrend ? '32%' : '38%',
    style: {
      text: formattedValue,
      fontSize: valueFontSize,
      fontWeight: 'bold' as const,
      fill: colors[0]
    },
    z: 100
  });

  // Label
  graphicElements.push({
    type: 'text',
    left: 'center',
    top: showTrend ? '58%' : '65%',
    style: {
      text: label,
      fontSize: 14,
      fill: '#8b949e',
      fontWeight: 500
    },
    z: 100
  });

  // Trend indicator (if enabled and data available)
  if (showTrend && trend) {
    const trendColor = trend.direction === 'neutral'
      ? '#8b949e'
      : (trend.direction === 'up'
          ? (trendUpIsGood ? '#2ecc71' : '#e74c3c')
          : (trendUpIsGood ? '#e74c3c' : '#2ecc71'));

    const trendArrow = trend.direction === 'up' ? '▲' :
                       trend.direction === 'down' ? '▼' : '●';

    const trendText = `${trendArrow} ${Math.abs(trend.percentage).toFixed(1)}%`;

    graphicElements.push({
      type: 'text',
      left: 'center',
      top: '78%',
      style: {
        text: trendText,
        fontSize: 16,
        fontWeight: 600,
        fill: trendColor
      },
      z: 100
    });

    // Trend comparison label
    graphicElements.push({
      type: 'text',
      left: 'center',
      top: '88%',
      style: {
        text: kpiOpts?.trendMode === 'first_last' ? 'first vs last' : 'vs previous',
        fontSize: 11,
        fill: '#6e7681'
      },
      z: 100
    });
  }

  return {
    legend: { show: false },
    grid: { show: false },
    xAxis: { show: false },
    yAxis: { show: false },
    graphic: graphicElements,
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
