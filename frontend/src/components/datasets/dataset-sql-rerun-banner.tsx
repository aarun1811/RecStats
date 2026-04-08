import { motion } from 'motion/react'
import { AlertTriangle } from 'lucide-react'

export function DatasetSqlRerunBanner() {
  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-4 py-2 mb-4"
    >
      <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
      <span className="text-sm text-amber-700 dark:text-amber-400">
        SQL has changed. Run the query to update columns and preview.
      </span>
    </motion.div>
  )
}
