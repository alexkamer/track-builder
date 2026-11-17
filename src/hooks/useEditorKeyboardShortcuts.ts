import { useEffect } from 'react'

interface UseEditorKeyboardShortcutsOptions {
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  deleteSelected: () => void
}

function isTextInput(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
}

/**
 * Wires Ctrl/Cmd+Z (undo), Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z (redo), and Delete/Backspace
 * (delete selected control point) to the editor's existing undo/redo/delete handlers.
 * Ignored while focus is in a text input so typing in the save-name/metadata fields
 * doesn't trigger these shortcuts.
 */
export function useEditorKeyboardShortcuts({
  undo,
  redo,
  canUndo,
  canRedo,
  deleteSelected,
}: UseEditorKeyboardShortcutsOptions) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextInput(event.target)) return

      const mod = event.metaKey || event.ctrlKey
      if (!mod) {
        if (event.key === 'Delete' || event.key === 'Backspace') {
          event.preventDefault()
          deleteSelected()
        }
        return
      }

      const isRedoCombo =
        event.key === 'y' || event.key === 'Y' || ((event.key === 'z' || event.key === 'Z') && event.shiftKey)
      if (isRedoCombo) {
        event.preventDefault()
        if (canRedo) redo()
        return
      }

      if (event.key === 'z' || event.key === 'Z') {
        event.preventDefault()
        if (canUndo) undo()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo, canUndo, canRedo, deleteSelected])
}
