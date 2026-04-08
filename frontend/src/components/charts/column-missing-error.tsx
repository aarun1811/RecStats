import { AlertTriangle } from 'lucide-react'

interface ColumnMissingErrorProps {
  missing: string[]
  available: string[]
}

export function ColumnMissingError({ missing, available }: ColumnMissingErrorProps) {
  return (
    <div className="flex h-[300px] flex-col items-center justify-center gap-2 text-center">
      <AlertTriangle className="size-6 text-amber-500 dark:text-amber-400" />
      <p className="text-sm font-medium text-foreground">Column mapping error</p>
      <p className="max-w-[300px] text-xs text-muted-foreground">
        {missing.length === 1
          ? `Column '${missing[0]}' not found in data source response.`
          : `Columns ${missing.map((c) => `'${c}'`).join(', ')} not found in data source response.`}
      </p>
      <p className="text-xs text-muted-foreground/70">
        Available: {available.join(', ')}
      </p>
    </div>
  )
}
