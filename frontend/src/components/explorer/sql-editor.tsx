import { useRef, useCallback } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { useTheme } from '@/components/layout/theme-provider'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Play, Loader2 } from 'lucide-react'
import { Kbd } from '@/components/ui/kbd'

interface SqlEditorProps {
  value: string
  onChange: (value: string) => void
  onRun: () => void
  isRunning: boolean
}

export function SqlEditor({ value, onChange, onRun, isRunning }: SqlEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
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
          <span className="text-xs text-muted-foreground items-center gap-1 hidden sm:flex">
            <Kbd>⌘</Kbd>+<Kbd>↵</Kbd> to run
          </span>
          <Button size="sm" onClick={onRun} disabled={isRunning || !value.trim()} className="h-7">
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
