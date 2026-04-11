import { useRef, useCallback } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { useTheme } from '@/components/layout/theme-provider'

// Editor instance type inferred from OnMount callback param — avoids needing
// to install the optional `monaco-editor` peer dep just for a type.
type MonacoEditor = Parameters<OnMount>[0]
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Play, Loader2 } from 'lucide-react'
import { Kbd } from '@/components/ui/kbd'

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
}

export function SqlEditor({
  value,
  onChange,
  onRun,
  isRunning,
  disabled = false,
  disabledReason,
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
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/40 shrink-0">
        <span className="text-sm font-medium tracking-tight">SQL Editor</span>
        <div className="flex items-center gap-3">
          {disabled && disabledReason ? (
            <span className="text-xs text-muted-foreground italic">
              {disabledReason}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground items-center gap-1 hidden sm:flex">
              <Kbd>{IS_MAC ? '⌘' : 'Ctrl'}</Kbd>+<Kbd>↵</Kbd> to run
            </span>
          )}
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
