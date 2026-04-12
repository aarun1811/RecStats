import { useState, useEffect } from 'react'

import { CheckCircle2, Plug, XCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ConnectionTestAreaProps {
  onTest: () => void
  isPending: boolean
  result: { success: boolean; message: string } | null
}

// ── Animated connecting bars ────────────────────────────────

function ConnectingBars() {
  return (
    <span className="flex items-end gap-0.5 h-3.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-0.5 bg-current rounded-full"
          style={{ height: '100%', originY: 1 }}
          animate={{ scaleY: [0.4, 1, 0.4] }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.1,
          }}
        />
      ))}
    </span>
  )
}

// ── Result display ──────────────────────────────────────────

interface ResultDisplayProps {
  result: { success: boolean; message: string }
}

function ResultDisplay({ result }: ResultDisplayProps) {
  if (result.success) {
    return (
      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
        <motion.div
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <CheckCircle2 className="size-4" />
        </motion.div>
        <motion.span
          className="text-xs font-medium"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15, duration: 0.2, ease: 'easeOut' }}
        >
          {result.message}
        </motion.span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
      <motion.div
        animate={{ x: [0, -4, 4, -4, 4, 0] }}
        transition={{ duration: 0.4 }}
      >
        <XCircle className="size-4" />
      </motion.div>
      <motion.span
        className="text-xs font-medium"
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.15, duration: 0.2, ease: 'easeOut' }}
      >
        {result.message}
      </motion.span>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────

export function ConnectionTestArea({ onTest, isPending, result }: ConnectionTestAreaProps) {
  const [flashColor, setFlashColor] = useState<'success' | 'failure' | null>(null)

  useEffect(() => {
    if (!result) return
    setFlashColor(result.success ? 'success' : 'failure')
    const timer = setTimeout(() => setFlashColor(null), 600)
    return () => clearTimeout(timer)
  }, [result])

  const borderClass = flashColor === 'success'
    ? 'border-emerald-500/50'
    : flashColor === 'failure'
      ? 'border-red-500/50'
      : 'border'

  return (
    <div
      className={cn(
        'rounded-lg border p-3 space-y-2 transition-colors duration-300',
        borderClass,
      )}
    >
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onTest}
          disabled={isPending}
        >
          {isPending ? (
            <>
              <ConnectingBars />
              <span className="ml-1.5">Connecting...</span>
            </>
          ) : (
            <>
              <Plug className="size-3.5" />
              <span className="ml-1.5">Test Connection</span>
            </>
          )}
        </Button>

        <AnimatePresence mode="wait">
          {isPending && (
            <motion.div
              key="pending-overlay"
              className="absolute inset-0 rounded-lg bg-muted/30 pointer-events-none"
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{ position: 'absolute' }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {result && !isPending && (
            <motion.div
              key={result.success ? 'success' : 'failure'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <ResultDisplay result={result} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
