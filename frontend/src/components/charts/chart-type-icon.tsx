import {
  BarChart3,
  LineChart,
  AreaChart,
  PieChart,
  CircleDot,
  ScatterChart,
  Grid3x3,
  SquareStack,
  BarChartBig,
  Layers,
  GitBranch,
  Sun,
  Radar,
  Share2,
  Gauge,
  Filter,
  AlignHorizontalJustifyStart,
  Target,
  BoxSelect,
  type LucideIcon,
} from 'lucide-react'

const CHART_ICON_MAP: Record<string, LucideIcon> = {
  'bar': BarChart3,
  'stacked-bar': BarChart3,
  'line': LineChart,
  'area': AreaChart,
  'pie': PieChart,
  'donut': CircleDot,
  'scatter': ScatterChart,
  'heatmap': Grid3x3,
  'treemap': SquareStack,
  'waterfall': BarChartBig,
  'bullet': Target,
  'box-plot': BoxSelect,
  'combo': Layers,
  'sankey': GitBranch,
  'sunburst': Sun,
  'radar': Radar,
  'graph': Share2,
  'gauge': Gauge,
  'parallel': AlignHorizontalJustifyStart,
  'funnel': Filter,
}

export const CHART_DISPLAY_NAMES: Record<string, string> = {
  'bar': 'Bar Chart',
  'stacked-bar': 'Stacked Bar',
  'line': 'Line Chart',
  'area': 'Area Chart',
  'pie': 'Pie Chart',
  'donut': 'Donut Chart',
  'scatter': 'Scatter Plot',
  'heatmap': 'Heatmap',
  'treemap': 'Treemap',
  'waterfall': 'Waterfall',
  'bullet': 'Bullet Chart',
  'box-plot': 'Box Plot',
  'combo': 'Combo Chart',
  'sankey': 'Sankey Diagram',
  'sunburst': 'Sunburst',
  'radar': 'Radar Chart',
  'graph': 'Network Graph',
  'gauge': 'Gauge',
  'parallel': 'Parallel Coordinates',
  'funnel': 'Funnel',
}

interface ChartTypeIconProps {
  chartType: string
  size?: number
  className?: string
}

export function ChartTypeIcon({ chartType, size = 20, className }: ChartTypeIconProps) {
  const Icon = CHART_ICON_MAP[chartType] ?? BarChart3
  return <Icon size={size} className={className} />
}
