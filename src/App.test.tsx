import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

describe('App race-mode gating', () => {
  it('blocks race mode when the track is invalid (empty track on load)', () => {
    render(<App />)
    expect(screen.getByText('Start Race')).toBeDisabled()
  })

  it('allows race mode once the track has a closed loop and a start line', () => {
    render(<App />)
    const canvas = screen.getByTestId('track-editor-canvas')

    // Place 3 control points by clicking directly on the canvas background, spaced
    // widely enough to clear the minimum corner radius check.
    fireEvent.click(canvas, { clientX: 0, clientY: 0, target: canvas })
    fireEvent.click(canvas, { clientX: 300, clientY: 0, target: canvas })
    fireEvent.click(canvas, { clientX: 150, clientY: 300, target: canvas })

    expect(screen.getByText('Start Race')).toBeDisabled()

    fireEvent.click(screen.getByText('Set start/finish line'))
    fireEvent.mouseDown(screen.getByTestId('control-point-0'))

    expect(screen.getByText('Start Race')).toBeEnabled()
  })
})

describe('App browse mode', () => {
  it('navigating to browse mode and back preserves editor state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ tracks: [] }) }),
    )
    render(<App />)
    const canvas = screen.getByTestId('track-editor-canvas')
    fireEvent.click(canvas, { clientX: 0, clientY: 0, target: canvas })
    fireEvent.click(canvas, { clientX: 300, clientY: 0, target: canvas })

    fireEvent.click(screen.getByTestId('browse-tracks-button'))
    await waitFor(() => expect(screen.getByTestId('track-browser')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Back to editor'))
    expect(screen.getByTestId('track-editor-canvas')).toBeInTheDocument()
    expect(screen.getAllByTestId(/^control-point-\d+$/)).toHaveLength(2)

    vi.restoreAllMocks()
  })
})
