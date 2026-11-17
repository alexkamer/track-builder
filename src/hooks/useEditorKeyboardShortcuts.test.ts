import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useEditorKeyboardShortcuts } from './useEditorKeyboardShortcuts'

function pressKey(key: string, opts: Partial<KeyboardEventInit> = {}, target: EventTarget = window) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts })
  target.dispatchEvent(event)
}

function setup(overrides: Partial<Parameters<typeof useEditorKeyboardShortcuts>[0]> = {}) {
  const handlers = {
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: true,
    canRedo: true,
    deleteSelected: vi.fn(),
    ...overrides,
  }
  renderHook(() => useEditorKeyboardShortcuts(handlers))
  return handlers
}

describe('useEditorKeyboardShortcuts', () => {
  it('calls undo on Ctrl+Z', () => {
    const handlers = setup()
    pressKey('z', { ctrlKey: true })
    expect(handlers.undo).toHaveBeenCalledTimes(1)
  })

  it('calls undo on Cmd+Z (metaKey)', () => {
    const handlers = setup()
    pressKey('z', { metaKey: true })
    expect(handlers.undo).toHaveBeenCalledTimes(1)
  })

  it('calls redo on Ctrl+Y', () => {
    const handlers = setup()
    pressKey('y', { ctrlKey: true })
    expect(handlers.redo).toHaveBeenCalledTimes(1)
  })

  it('calls redo on Ctrl+Shift+Z', () => {
    const handlers = setup()
    pressKey('z', { ctrlKey: true, shiftKey: true })
    expect(handlers.redo).toHaveBeenCalledTimes(1)
    expect(handlers.undo).not.toHaveBeenCalled()
  })

  it('calls redo on Cmd+Shift+Z', () => {
    const handlers = setup()
    pressKey('z', { metaKey: true, shiftKey: true })
    expect(handlers.redo).toHaveBeenCalledTimes(1)
  })

  it('calls deleteSelected on Delete with no modifier', () => {
    const handlers = setup()
    pressKey('Delete')
    expect(handlers.deleteSelected).toHaveBeenCalledTimes(1)
  })

  it('calls deleteSelected on Backspace with no modifier', () => {
    const handlers = setup()
    pressKey('Backspace')
    expect(handlers.deleteSelected).toHaveBeenCalledTimes(1)
  })

  it('does not call undo when canUndo is false', () => {
    const handlers = setup({ canUndo: false })
    pressKey('z', { ctrlKey: true })
    expect(handlers.undo).not.toHaveBeenCalled()
  })

  it('does not call redo when canRedo is false', () => {
    const handlers = setup({ canRedo: false })
    pressKey('y', { ctrlKey: true })
    expect(handlers.redo).not.toHaveBeenCalled()
  })

  it('ignores all shortcuts when focus is in a text input', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    const handlers = setup()

    pressKey('z', { ctrlKey: true }, input)
    pressKey('Backspace', {}, input)

    expect(handlers.undo).not.toHaveBeenCalled()
    expect(handlers.deleteSelected).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  it('ignores all shortcuts when focus is in a textarea', () => {
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    const handlers = setup()

    pressKey('Delete', {}, textarea)

    expect(handlers.deleteSelected).not.toHaveBeenCalled()
    document.body.removeChild(textarea)
  })
})
