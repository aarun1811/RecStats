import { type ComponentType } from 'react'

import { motion } from 'framer-motion'
import { type LucideProps, FileSearch, AlertCircle, Inbox } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type EmptyStateVariant = 'default' | 'search' | 'error'

interface EmptyStateAction {
  label: string
  onClick: () => void
}

interface EmptyStateProps {
  icon?: ComponentType<LucideProps>
  title: string
  description?: string
  action?: EmptyStateAction
  variant?: EmptyStateVariant
  className?: string
}

const variantDefaults: Record<
  EmptyStateVariant,
  { icon: ComponentType<LucideProps>; title: string }
> = {
  default: { icon: Inbox, title: 'No data yet' },
  search: { icon: FileSearch, title: 'No results found' },
  error: { icon: AlertCircle, title: 'Failed to load' },
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'default',
  className,
}: EmptyStateProps) {
  const defaults = variantDefaults[variant]
  const Icon = icon ?? defaults.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-16 text-center',
        className,
      )}
    >
      <div
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-full',
          variant === 'error' ? 'bg-destructive/10' : 'bg-muted',
        )}
      >
        <Icon
          className={cn(
            'h-7 w-7',
            variant === 'error'
              ? 'text-destructive'
              : 'text-muted-foreground',
          )}
        />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title ?? defaults.title}</p>
        {description && (
          <p className="max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && (
        <Button
          variant={variant === 'error' ? 'destructive' : 'outline'}
          size="sm"
          onClick={action.onClick}
          className="mt-2"
        >
          {action.label}
        </Button>
      )}
    </motion.div>
  )
}
