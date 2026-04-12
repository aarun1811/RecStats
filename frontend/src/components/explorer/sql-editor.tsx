import { useRef, useCallback } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { motion, AnimatePresence } from 'motion/react'
import { useTheme } from '@/components/layout/theme-provider'

// Editor instance type inferred from OnMount callback param — avoids needing
// to install the optional `monaco-editor` peer dep just for a type.
type MonacoEditor = Parameters<OnMount>[0]
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Play, Loader2, Code2, WandSparkles, CheckCircle2, XCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const IS_MAC =
  typeof navigator !== 'undefined' &&
  /Mac/.test(navigator.userAgent)

interface SqlEditorProps {
  value: string
  onChange: (value: string) => void
  onRun: () => void
  isRunning: boolean
  /** Optional extra disable reason — e.g. no database selected.
   * When true, the Run button is disabled regardless of value/isRunning. */
  disabled?: boolean
  /** Optional helper text shown next to the Run button when disabled. */
  disabledReason?: string
  /** Optional callback to format the SQL text */
  onFormat?: () => void
  /** Current run state for animated feedback */
  runState?: 'idle' | 'running' | 'success' | 'error'
  /** Result text to display next to Run button */
  runResultText?: string
}

export function SqlEditor({
  value,
  onChange,
  onRun,
  isRunning,
  disabled = false,
  disabledReason,
  onFormat,
  runState,
  runResultText,
}: SqlEditorProps) {
  const editorRef = useRef<MonacoEditor | null>(null)
  const onRunRef = useRef(onRun)
  onRunRef.current = onRun
  const { resolvedTheme } = useTheme()

  const handleMount: OnMount = useCallback(
    (ed, monaco) => {
      editorRef.current = ed

      // Cmd+Enter → Run query (use ref to always call latest onRun)
      ed.addAction({
        id: 'run-query',
        label: 'Run Query',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
        run: () => onRunRef.current(),
      })

      // Focus editor on mount
      ed.focus()
    },
    [],
  )

  return (
    <div className="flex flex-col h-full border-b">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-l-2 border-l-primary bg-muted/30 shrink-0">
        <div className="flex items-center">
          <Code2 className="mr-1.5 size-3.5 text-muted-foreground" />
          <span className="text-sm font-semibold tracking-tight">SQL Editor</span>
        </div>
        <div className="flex items-center gap-3">
          {onFormat && (
            <Button
              variant="outline"
              size="sm"
              onClick={onFormat}
              disabled={!value.trim()}
              className="h-7"
            >
              <WandSparkles className="mr-1.5 size-3.5" />
              Format SQL
            </Button>
          )}
          {disabled && disabledReason && (
            <span className="text-xs text-muted-foreground italic">
              {disabledReason}
            </span>
          )}
          {runState === 'running' ? (
            <motion.div
              animate={{ opacity: [1, 0.7, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Button
                size="sm"
                disabled
                className="h-7"
              >
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                Executing...
              </Button>
            </motion.div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  onClick={onRun}
                  disabled={disabled || isRunning || !value.trim()}
                  className="h-7"
                >
                  {isRunning ? (
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  ) : (
                    <Play className="mr-1.5 size-3.5" />
                  )}
                  Run Query
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {IS_MAC ? '⌘' : 'Ctrl'}+Enter
              </TooltipContent>
            </Tooltip>
          )}
          <AnimatePresence>
            {runState === 'success' && (
              <motion.div
                className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.15, duration: 0.2 }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  <CheckCircle2 className="size-3.5" />
                </motion.div>
                <span className="font-semibold">{runResultText}</span>
              </motion.div>
            )}
            {runState === 'error' && (
              <motion.div
                className="flex items-center gap-1 text-xs text-destructive"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, x: [0, -4, 4, -4, 4, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                <XCircle className="size-3.5" />
                <span className="font-semibold truncate max-w-[200px]">{runResultText}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      {/* Editor */}
      <div className="flex-1 min-h-0">
        <Editor
          language="sql"
          theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
          value={value}
          onChange={(v) => onChange(v ?? '')}
          onMount={handleMount}
          loading={<Skeleton className="m-2 h-full w-[calc(100%-1rem)]" />}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            padding: { top: 12, bottom: 12 },
            automaticLayout: true,
            tabSize: 2,
            suggestOnTriggerCharacters: true,
            renderLineHighlight: 'all',
            lineHeight: 22,
          }}
        />
      </div>
    </div>
  )
}
