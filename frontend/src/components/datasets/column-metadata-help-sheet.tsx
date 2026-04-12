import { HelpCircle, Target, Type, Calculator, Paintbrush, BarChart3, ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  COLUMN_ROLE_STYLES,
  COLUMN_ROLE_LABELS,
  COLUMN_TYPE_STYLES,
  COLUMN_TYPE_LABELS,
} from '@/lib/style-constants'
import type { ColumnRole, ColumnDataType } from '@/types/managed-dataset'

// --- Section: Column Role ---

const ROLE_ITEMS: {
  role: ColumnRole
  examples: string[]
  chartEffect: string
}[] = [
  {
    role: 'dimension',
    examples: ['region', 'desk', 'currency', 'status'],
    chartEffect: 'Groups data on chart axes. Becomes labels, categories, or series.',
  },
  {
    role: 'measure',
    examples: ['amount_usd', 'trade_count', 'pnl_total'],
    chartEffect: 'Values that get aggregated (SUM, AVG). Powers bar heights, line values, KPI numbers.',
  },
  {
    role: 'time',
    examples: ['trade_date', 'settlement_date', 'created_at'],
    chartEffect: 'Time-series X-axis. Enables date range filters and trend lines.',
  },
  {
    role: 'none',
    examples: ['internal_id', 'hash_key', 'audit_flag'],
    chartEffect: 'Stored in the dataset but excluded from charts and KPIs.',
  },
]

// --- Section: Data Type ---

const TYPE_ITEMS: {
  type: ColumnDataType
  examples: string[]
  formatEffect: string
}[] = [
  {
    type: 'string',
    examples: ['region', 'counterparty', 'status'],
    formatEffect: 'Displayed as-is. No numeric formatting applied.',
  },
  {
    type: 'number',
    examples: ['trade_count', 'quantity', 'score'],
    formatEffect: 'Enables numeric formats (thousands separator, decimals).',
  },
  {
    type: 'date',
    examples: ['trade_date', 'created_at', 'expiry'],
    formatEffect: 'Parsed as date/time. Enables date formats (Apr 06, Apr 06 14:30).',
  },
  {
    type: 'currency',
    examples: ['amount_usd', 'pnl_total', 'notional'],
    formatEffect: 'Formatted with currency symbol and decimals ($1,234.56).',
  },
]

// --- Section: Aggregation ---

const AGG_ITEMS: {
  func: string
  desc: string
  example: string
}[] = [
  { func: 'NONE', desc: 'No aggregation — raw row values', example: '42, 17, 89 → 42, 17, 89' },
  { func: 'SUM', desc: 'Total of all values in group', example: '42 + 17 + 89 → 148' },
  { func: 'AVG', desc: 'Average of all values in group', example: '42, 17, 89 → 49.3' },
  { func: 'COUNT', desc: 'Number of rows in group', example: '3 rows → 3' },
  { func: 'MIN', desc: 'Smallest value in group', example: '42, 17, 89 → 17' },
  { func: 'MAX', desc: 'Largest value in group', example: '42, 17, 89 → 89' },
  { func: 'COUNT_DISTINCT', desc: 'Number of unique values', example: 'A, B, A, C → 3' },
]

// --- Section: Format Presets ---

const FORMAT_ITEMS: {
  preset: string
  before: string
  after: string
}[] = [
  { preset: 'None', before: '1234567.89', after: '1234567.89' },
  { preset: 'Number', before: '1234567.89', after: '1,234,567.89' },
  { preset: 'Currency', before: '1234567.89', after: '$1,234,567.89' },
  { preset: 'Percentage', before: '0.853', after: '85.3%' },
  { preset: 'Decimal (2)', before: '1234567.891', after: '1,234,567.89' },
  { preset: 'Date', before: '2026-04-06', after: 'Apr 06' },
  { preset: 'DateTime', before: '2026-04-06T14:30', after: 'Apr 06 14:30' },
]

// --- Helpers ---

function InlineBadge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold',
      className,
    )}>
      {children}
    </span>
  )
}

function ExampleColumns({ names }: { names: string[] }) {
  return (
    <span className="text-xs text-muted-foreground">
      e.g.{' '}
      {names.map((n, i) => (
        <span key={n}>
          <code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded">{n}</code>
          {i < names.length - 1 && ', '}
        </span>
      ))}
    </span>
  )
}

function ChartEffect({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-1.5 mt-1.5">
      <BarChart3 className="size-3 text-primary shrink-0 mt-0.5" />
      <span className="text-xs text-muted-foreground">{text}</span>
    </div>
  )
}

interface SectionHeaderProps {
  icon: React.ElementType
  title: string
  tag?: string
}

function SectionHeader({ icon: Icon, title, tag }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 text-primary" />
      <span className="text-sm font-semibold">{title}</span>
      {tag && (
        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{tag}</span>
      )}
    </div>
  )
}

// --- Main component ---

export function ColumnMetadataHelpSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-6 w-6 p-0 rounded-full" aria-label="Column metadata reference">
          <HelpCircle className="size-3.5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="sm:max-w-xl overflow-y-auto px-6">
        <SheetHeader>
          <SheetTitle>Column Metadata Reference</SheetTitle>
          <SheetDescription>
            Configure how each column behaves in charts, KPIs, and data grids
          </SheetDescription>
        </SheetHeader>

        <Accordion type="multiple" defaultValue={['role', 'type']} className="mt-6">
          {/* --- Column Role --- */}
          <AccordionItem value="role">
            <AccordionTrigger className="hover:no-underline">
              <SectionHeader icon={Target} title="Column Role" tag="most important" />
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                {ROLE_ITEMS.map((item) => (
                  <div key={item.role} className="rounded-lg border bg-card p-3 space-y-1.5">
                    <InlineBadge className={COLUMN_ROLE_STYLES[item.role]}>
                      {COLUMN_ROLE_LABELS[item.role]}
                    </InlineBadge>
                    <ExampleColumns names={item.examples} />
                    <ChartEffect text={item.chartEffect} />
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* --- Data Type --- */}
          <AccordionItem value="type">
            <AccordionTrigger className="hover:no-underline">
              <SectionHeader icon={Type} title="Data Type" />
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                {TYPE_ITEMS.map((item) => (
                  <div key={item.type} className="rounded-lg border bg-card p-3 space-y-1.5">
                    <InlineBadge className={COLUMN_TYPE_STYLES[item.type]}>
                      {COLUMN_TYPE_LABELS[item.type]}
                    </InlineBadge>
                    <ExampleColumns names={item.examples} />
                    <ChartEffect text={item.formatEffect} />
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* --- Aggregation --- */}
          <AccordionItem value="aggregation">
            <AccordionTrigger className="hover:no-underline">
              <SectionHeader icon={Calculator} title="Aggregation" tag="for measures" />
            </AccordionTrigger>
            <AccordionContent>
              <div className="rounded-lg border bg-card overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left font-semibold px-3 py-2 w-[120px]">Function</th>
                      <th className="text-left font-semibold px-3 py-2">Description</th>
                      <th className="text-left font-semibold px-3 py-2 w-[160px]">Example</th>
                    </tr>
                  </thead>
                  <tbody>
                    {AGG_ITEMS.map((item, i) => (
                      <tr key={item.func} className={cn('border-b last:border-b-0', i % 2 === 0 ? '' : 'bg-muted/10')}>
                        <td className="px-3 py-2 font-mono font-semibold text-foreground">{item.func}</td>
                        <td className="px-3 py-2 text-muted-foreground">{item.desc}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{item.example}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* --- Format Presets --- */}
          <AccordionItem value="format">
            <AccordionTrigger className="hover:no-underline">
              <SectionHeader icon={Paintbrush} title="Format Presets" />
            </AccordionTrigger>
            <AccordionContent>
              <div className="rounded-lg border bg-card overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left font-semibold px-3 py-2 w-[100px]">Preset</th>
                      <th className="text-left font-semibold px-3 py-2">Raw Value</th>
                      <th className="text-center px-3 py-2 w-[30px]" />
                      <th className="text-left font-semibold px-3 py-2">Formatted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FORMAT_ITEMS.map((item, i) => (
                      <tr key={item.preset} className={cn('border-b last:border-b-0', i % 2 === 0 ? '' : 'bg-muted/10')}>
                        <td className="px-3 py-2 font-semibold text-foreground">{item.preset}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{item.before}</td>
                        <td className="px-3 py-2 text-center text-muted-foreground">
                          <ArrowRight className="size-3 inline" />
                        </td>
                        <td className="px-3 py-2 font-mono font-semibold text-foreground">{item.after}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2 pl-1">
                Choose &ldquo;Custom&rdquo; in the grid to enter an Intl.NumberFormat or date-fns pattern.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </SheetContent>
    </Sheet>
  )
}
