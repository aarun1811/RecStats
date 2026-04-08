import { useEffect } from 'react'

interface UseBuilderKeyboardShortcutsOptions {
  onUndo: () => void
  onRedo: () => void
  onSave: () => void
  enabled: boolean
}

export function useBuilderKeyboardShortcuts({
  onUndo,
  onRedo,
  onSave,
  enabled,
}: UseBuilderKeyboardShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return

    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return

      if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        onSave()
        return
      }

      if ((e.key === 'z' || e.key === 'Z') && e.shiftKey) {
        e.preventDefault()
        onRedo()
        return
      }

      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault()
        onUndo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onUndo, onRedo, onSave, enabled])
}
