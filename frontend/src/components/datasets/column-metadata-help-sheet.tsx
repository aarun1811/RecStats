import { HelpCircle, Target, Type, Calculator, Paintbrush } from 'lucide-react'
import { motion } from 'motion/react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

const SECTIONS = [
  {
    icon: Target,
    heading: 'Column Role',
    content: [
      { term: 'Dimension', desc: 'Groups or categorizes data on chart axes. Used for labels, categories, and series groupings.' },
      { term: 'Measure', desc: 'Numeric values that get aggregated (summed, averaged, etc.). Used for chart values, KPI calculations.' },
      { term: 'Time', desc: 'Date/time columns used for time-series axes. Enables date range filtering.' },
      { term: 'None', desc: 'Column is stored but not used in charts or KPIs.' },
    ],
  },
  {
    icon: Type,
    heading: 'Data Type',
    content: [
      { term: 'String', desc: 'Text values. Displayed as-is.' },
      { term: 'Number', desc: 'Numeric values. Can be formatted with separators, decimals.' },
      { term: 'Date', desc: 'Date/datetime values. Parsed for time-series.' },
      { term: 'Currency', desc: 'Monetary values. Formatted with currency symbol.' },
    ],
  },
  {
    icon: Calculator,
    heading: 'Aggregation',
    content: [
      { term: 'NONE', desc: 'No aggregation applied.' },
      { term: 'SUM', desc: 'Sum of all values in the group.' },
      { term: 'AVG', desc: 'Average of all values in the group.' },
      { term: 'COUNT', desc: 'Number of rows in the group.' },
      { term: 'MIN / MAX', desc: 'Minimum or maximum value in the group.' },
      { term: 'COUNT_DISTINCT', desc: 'Number of unique values in the group.' },
    ],
  },
  {
    icon: Paintbrush,
    heading: 'Format Presets',
    content: [
      { term: 'None', desc: 'No formatting (raw value)' },
      { term: 'Number', desc: 'Thousands separator -- 1,234' },
      { term: 'Currency', desc: 'Dollar sign + decimals -- $1,234.56' },
      { term: 'Percentage', desc: 'Percent suffix -- 85.3%' },
      { term: 'Decimal (2)', desc: 'Two decimal places -- 1,234.56' },
      { term: 'Date', desc: 'Short date -- Apr 06' },
      { term: 'DateTime', desc: 'Date + time -- Apr 06 14:30' },
      { term: 'Custom', desc: 'User-defined Intl.NumberFormat or date-fns pattern' },
    ],
  },
]

export function ColumnMetadataHelpSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Column metadata reference">
          <HelpCircle className="size-3.5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Column Metadata Reference</SheetTitle>
          <SheetDescription>How each field affects charts, grids, and data behavior</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          {SECTIONS.map((section, i) => (
            <motion.div
              key={section.heading}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.25, ease: 'easeOut' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <section.icon className="size-4 text-primary" />
                <h3 className="text-sm font-semibold">{section.heading}</h3>
              </div>
              <dl className="space-y-2">
                {section.content.map((item) => (
                  <div key={item.term} className="pl-6">
                    <dt className="text-sm font-medium">{item.term}</dt>
                    <dd className="text-xs text-muted-foreground mt-0.5">{item.desc}</dd>
                  </div>
                ))}
              </dl>
            </motion.div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
