import { HelpCircle, Target, Type, Calculator, Paintbrush, BarChart3, ArrowRight, Columns3 } from 'lucide-react'

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

// --- Main component ---

export function ColumnMetadataHelpSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-6 w-6 p-0 rounded-full" aria-label="Column metadata reference">
          <HelpCircle className="size-3.5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="sm:max-w-xl overflow-y-auto p-0">
        {/* --- Custom header --- */}
        <div className="sticky top-0 z-10 bg-card border-b px-6 py-5">
          <div className="flex items-center gap-3 mb-1.5">
            <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10">
              <Columns3 className="size-4 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">Column Metadata</h2>
              <p className="text-xs text-muted-foreground">How each field affects charts, KPIs, and data grids</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4">
          <Accordion type="multiple" defaultValue={['role', 'type']}>
            {/* --- Column Role --- */}
            <AccordionItem value="role" className="border rounded-lg mb-3 overflow-hidden">
              <AccordionTrigger className="hover:no-underline bg-muted/40 px-4 py-3 rounded-t-lg data-[state=closed]:rounded-b-lg">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center size-6 rounded-md bg-primary/10">
                    <Target className="size-3.5 text-primary" />
                  </div>
                  <span className="text-sm font-semibold">Column Role</span>
                  <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full font-semibold">most important</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pt-3">
                <div>
                  {ROLE_ITEMS.map((item) => (
                    <div key={item.role} className="py-3 space-y-1.5 border-b border-border/50 last:border-b-0">
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
            <AccordionItem value="type" className="border rounded-lg mb-3 overflow-hidden">
              <AccordionTrigger className="hover:no-underline bg-muted/40 px-4 py-3 rounded-t-lg data-[state=closed]:rounded-b-lg">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center size-6 rounded-md bg-primary/10">
                    <Type className="size-3.5 text-primary" />
                  </div>
                  <span className="text-sm font-semibold">Data Type</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pt-3">
                <div>
                  {TYPE_ITEMS.map((item) => (
                    <div key={item.type} className="py-3 space-y-1.5 border-b border-border/50 last:border-b-0">
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
            <AccordionItem value="aggregation" className="border rounded-lg mb-3 overflow-hidden">
              <AccordionTrigger className="hover:no-underline bg-muted/40 px-4 py-3 rounded-t-lg data-[state=closed]:rounded-b-lg">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center size-6 rounded-md bg-primary/10">
                    <Calculator className="size-3.5 text-primary" />
                  </div>
                  <span className="text-sm font-semibold">Aggregation</span>
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">for measures</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pt-1">
                <div>
                  {AGG_ITEMS.map((item) => (
                    <div key={item.func} className="py-2.5 border-b border-border/50 last:border-b-0 flex items-baseline gap-3">
                      <code className="font-mono text-xs font-semibold text-foreground shrink-0 w-[100px]">{item.func}</code>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-muted-foreground">{item.desc}</span>
                        <span className="text-xs text-muted-foreground ml-2 font-mono">({item.example})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* --- Format Presets --- */}
            <AccordionItem value="format" className="border rounded-lg mb-3 overflow-hidden">
              <AccordionTrigger className="hover:no-underline bg-muted/40 px-4 py-3 rounded-t-lg data-[state=closed]:rounded-b-lg">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center size-6 rounded-md bg-primary/10">
                    <Paintbrush className="size-3.5 text-primary" />
                  </div>
                  <span className="text-sm font-semibold">Format Presets</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pt-1">
                <div>
                  {FORMAT_ITEMS.map((item) => (
                    <div key={item.preset} className="py-2.5 border-b border-border/50 last:border-b-0 flex items-center gap-3">
                      <span className="text-xs font-semibold text-foreground shrink-0 w-[72px]">{item.preset}</span>
                      <code className="text-[11px] font-mono text-muted-foreground">{item.before}</code>
                      <ArrowRight className="size-3 text-muted-foreground shrink-0" />
                      <code className="text-[11px] font-mono font-semibold text-foreground">{item.after}</code>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Choose &ldquo;Custom&rdquo; in the grid to enter an Intl.NumberFormat or date-fns pattern.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </SheetContent>
    </Sheet>
  )
}
