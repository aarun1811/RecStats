import { useCallback, useEffect, useRef, useState } from 'react'

import Editor, { type OnMount } from '@monaco-editor/react'
import type { editor as MonacoEditor } from 'monaco-editor'
import {
  GripVertical,
  Play,
  Save,
  Wand2,
} from 'lucide-react'

import { useThemeStore } from '@/stores/theme-store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'

interface SqlEditorProps {
  onExecute: (sql: string) => void
  onSave?: (sql: string) => void
  defaultValue?: string
  databaseId?: string
  onDatabaseChange?: (databaseId: string) => void
  databases?: { id: string; name: string }[]
  onInsertText?: React.MutableRefObject<((text: string) => void) | null>
}

const EDITOR_MIN_HEIGHT = 150
const EDITOR_MAX_HEIGHT = 500
const EDITOR_DEFAULT_HEIGHT = 250

function defineMonacoThemes(monaco: Parameters<OnMount>[1]) {
  monaco.editor.defineTheme('recviz-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '7c3aed', fontStyle: 'bold' },
      { token: 'string', foreground: '16a34a' },
      { token: 'number', foreground: 'ea580c' },
      { token: 'comment', foreground: '9ca3af', fontStyle: 'italic' },
      { token: 'operator', foreground: '0284c7' },
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#0a0a0b',
      'editor.lineHighlightBackground': '#f4f4f5',
      'editor.selectionBackground': '#dbeafe',
      'editorLineNumber.foreground': '#a1a1aa',
      'editorLineNumber.activeForeground': '#3f3f46',
      'editor.inactiveSelectionBackground': '#e0e7ff',
      'editorWidget.background': '#fafafa',
      'editorWidget.border': '#e4e4e7',
      'editorSuggestWidget.background': '#ffffff',
      'editorSuggestWidget.border': '#e4e4e7',
      'editorSuggestWidget.selectedBackground': '#f4f4f5',
    },
  })

  monaco.editor.defineTheme('recviz-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'a78bfa', fontStyle: 'bold' },
      { token: 'string', foreground: '4ade80' },
      { token: 'number', foreground: 'fb923c' },
      { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
      { token: 'operator', foreground: '38bdf8' },
    ],
    colors: {
      'editor.background': '#0a0a0b',
      'editor.foreground': '#fafafa',
      'editor.lineHighlightBackground': '#18181b',
      'editor.selectionBackground': '#1e3a5f',
      'editorLineNumber.foreground': '#52525b',
      'editorLineNumber.activeForeground': '#a1a1aa',
      'editor.inactiveSelectionBackground': '#1e293b',
      'editorWidget.background': '#18181b',
      'editorWidget.border': '#27272a',
      'editorSuggestWidget.background': '#18181b',
      'editorSuggestWidget.border': '#27272a',
      'editorSuggestWidget.selectedBackground': '#27272a',
    },
  })
}

function resolveTheme(theme: 'light' | 'dark' | 'system'): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
  return theme
}

export function SqlEditor({
  onExecute,
  onSave,
  defaultValue = '',
  databaseId,
  onDatabaseChange,
  databases = [],
  onInsertText,
}: SqlEditorProps) {
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [editorHeight, setEditorHeight] = useState(EDITOR_DEFAULT_HEIGHT)
  const [isResizing, setIsResizing] = useState(false)
  const theme = useThemeStore((s) => s.theme)
  const resolvedTheme = resolveTheme(theme)

  const handleEditorMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor
      defineMonacoThemes(monaco)
      monaco.editor.setTheme(
        resolvedTheme === 'dark' ? 'recviz-dark' : 'recviz-light',
      )

      editor.addAction({
        id: 'execute-query',
        label: 'Execute Query',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
        run: () => {
          const selection = editor.getSelection()
          const model = editor.getModel()
          if (!model) return
          const selectedText =
            selection && !selection.isEmpty()
              ? model.getValueInRange(selection)
              : model.getValue()
          if (selectedText.trim()) {
            onExecute(selectedText.trim())
          }
        },
      })

      editor.focus()
    },
    [onExecute, resolvedTheme],
  )

  // Update Monaco theme when app theme changes
  useEffect(() => {
    if (!editorRef.current) return
    const monacoInstance = (
      window as unknown as { monaco?: typeof import('monaco-editor') }
    ).monaco
    if (monacoInstance) {
      monacoInstance.editor.setTheme(
        resolvedTheme === 'dark' ? 'recviz-dark' : 'recviz-light',
      )
    }
  }, [resolvedTheme])

  // Expose insertText function for schema browser
  useEffect(() => {
    if (!onInsertText) return
    onInsertText.current = (text: string) => {
      const editor = editorRef.current
      if (!editor) return
      const selection = editor.getSelection()
      if (!selection) return
      editor.executeEdits('schema-browser', [
        {
          range: selection,
          text,
          forceMoveMarkers: true,
        },
      ])
      editor.focus()
    }
  }, [onInsertText])

  const handleRun = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    const model = editor.getModel()
    if (!model) return
    const selection = editor.getSelection()
    const text =
      selection && !selection.isEmpty()
        ? model.getValueInRange(selection)
        : model.getValue()
    if (text.trim()) {
      onExecute(text.trim())
    }
  }, [onExecute])

  const handleSave = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    const model = editor.getModel()
    if (!model) return
    onSave?.(model.getValue())
  }, [onSave])

  const handleFormat = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    editor.getAction('editor.action.formatDocument')?.run()
  }, [])

  // Resize via drag
  const handleResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      setIsResizing(true)
      const startY = e.clientY
      const startHeight = editorHeight

      const handleMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientY - startY
        const newHeight = Math.max(
          EDITOR_MIN_HEIGHT,
          Math.min(EDITOR_MAX_HEIGHT, startHeight + delta),
        )
        setEditorHeight(newHeight)
      }

      const handleUp = () => {
        setIsResizing(false)
        document.removeEventListener('pointermove', handleMove)
        document.removeEventListener('pointerup', handleUp)
      }

      document.addEventListener('pointermove', handleMove)
      document.addEventListener('pointerup', handleUp)
    },
    [editorHeight],
  )

  return (
    <div ref={containerRef} className="flex flex-col overflow-hidden rounded-md border border-border bg-background">
      <div
        style={{ height: editorHeight }}
        className="relative overflow-hidden"
      >
        <Editor
          defaultLanguage="sql"
          defaultValue={defaultValue}
          theme={resolvedTheme === 'dark' ? 'recviz-dark' : 'recviz-light'}
          onMount={handleEditorMount}
          loading={<Skeleton className="h-full w-full" />}
          options={{
            minimap: { enabled: false },
            lineNumbers: 'on',
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            tabSize: 2,
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            padding: { top: 8, bottom: 8 },
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            renderLineHighlight: 'line',
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
          }}
        />
      </div>

      {/* Resize handle */}
      <div
        onPointerDown={handleResizeStart}
        className={cn(
          'flex h-2 cursor-row-resize items-center justify-center border-y border-border bg-muted/50 transition-colors hover:bg-muted',
          isResizing && 'bg-muted',
        )}
      >
        <GripVertical className="h-3 w-3 rotate-90 text-muted-foreground" />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 border-t border-border bg-muted/30 px-3 py-1.5">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" onClick={handleRun} className="gap-1.5">
                <Play className="h-3.5 w-3.5" />
                Run
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Execute query (Cmd+Enter)</p>
            </TooltipContent>
          </Tooltip>

          {onSave && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSave}
                  className="gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Save query</p>
              </TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={handleFormat}
                className="gap-1.5"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Format
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Format SQL</p>
            </TooltipContent>
          </Tooltip>

          {databases.length > 0 && (
            <div className="ml-auto">
              <Select
                value={databaseId}
                onValueChange={(v) => onDatabaseChange?.(v)}
              >
                <SelectTrigger className="h-8 w-[180px] text-xs">
                  <SelectValue placeholder="Select database" />
                </SelectTrigger>
                <SelectContent>
                  {databases.map((db) => (
                    <SelectItem key={db.id} value={db.id}>
                      {db.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </TooltipProvider>
      </div>
    </div>
  )
}
