import { EChartsOption } from 'echarts';
import { ChartConfig } from '../chart-config';

/**
 * Context passed to chart option builders
 */
export interface ChartContext {
  data: any[];
  config: ChartConfig;
  colors: string[];
}

/**
 * Sample data for chart previews
 */
export const SAMPLE_DATA = {
  categories: ['APAC', 'EMEA', 'NAM', 'LATAM'],
  values: [42, 35, 58, 28],
  timeCategories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
  timeValues: [820, 932, 901, 934, 1290, 1330],
  series: [
    { name: 'Matched', data: [150, 230, 180, 120] },
    { name: 'Unmatched', data: [25, 40, 35, 20] },
    { name: 'Breaks', data: [10, 15, 12, 8] }
  ]
};

/**
 * Chart option builder function type
 */
export type ChartOptionBuilder = (ctx: ChartContext) => EChartsOption;
