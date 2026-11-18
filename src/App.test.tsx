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

    // Place 3 control points with the Add Point tool, spaced widely enough to clear the
    // minimum corner radius check (calibrated against the car's actual achievable turn radius).
    fireEvent.click(screen.getByTestId('add-point-tool-button'))
    fireEvent.click(canvas, { clientX: 0, clientY: 0, target: canvas })
    fireEvent.click(canvas, { clientX: 450, clientY: 0, target: canvas })
    fireEvent.click(canvas, { clientX: 225, clientY: 450, target: canvas })

    expect(screen.getByText('Start Race')).toBeDisabled()

    fireEvent.click(screen.getByText('Set start/finish line'))
    fireEvent.mouseDown(screen.getByTestId('control-point-0'))

    expect(screen.getByText('Start Race')).toBeEnabled()
  })
})

describe('App race-entry validation summary', () => {
  it('shows an error count beside the disabled Start Race button for an invalid track, and clears it once valid', () => {
    render(<App />)
    const canvas = screen.getByTestId('track-editor-canvas')

    expect(screen.getByText('Start Race')).toBeDisabled()
    expect(screen.getByTestId('race-validation-summary')).toBeInTheDocument()
    expect(screen.getByTestId('validation-errors')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('add-point-tool-button'))
    fireEvent.click(canvas, { clientX: 0, clientY: 0, target: canvas })
    fireEvent.click(canvas, { clientX: 450, clientY: 0, target: canvas })
    fireEvent.click(canvas, { clientX: 225, clientY: 450, target: canvas })
    fireEvent.click(screen.getByText('Set start/finish line'))
    fireEvent.mouseDown(screen.getByTestId('control-point-0'))

    expect(screen.getByText('Start Race')).toBeEnabled()
    expect(screen.queryByTestId('race-validation-summary')).not.toBeInTheDocument()
    expect(screen.queryByTestId('validation-errors')).not.toBeInTheDocument()
  })
})

describe('App delete control point', () => {
  it('clears selection after deleting the selected point', () => {
    render(<App />)
    const canvas = screen.getByTestId('track-editor-canvas')

    fireEvent.click(screen.getByTestId('add-point-tool-button'))
    fireEvent.click(canvas, { clientX: 0, clientY: 0, target: canvas })
    fireEvent.click(canvas, { clientX: 300, clientY: 0, target: canvas })
    fireEvent.click(canvas, { clientX: 150, clientY: 300, target: canvas })
    fireEvent.click(canvas, { clientX: 150, clientY: 100, target: canvas })

    fireEvent.click(screen.getByTestId('select-tool-button'))
    // The Add Point tool inserts each new point at its nearest position along the loop
    // rather than always at the end, so select whichever point testid is actually present
    // instead of assuming click order matches array order.
    const [firstPoint] = screen.getAllByTestId(/^control-point-\d+$/)
    fireEvent.mouseDown(firstPoint)
    expect(screen.getByText(/Control point \d/)).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('delete-point-button'))

    expect(screen.queryByText(/Control point \d/)).not.toBeInTheDocument()
    expect(screen.getByText('Select a control point to edit its width, elevation, and banking.')).toBeInTheDocument()
  })
})

describe('App track metadata editing', () => {
  it('reverts an author edit via undo after the field is committed on blur', () => {
    render(<App />)
    const authorInput = screen.getByTestId('metadata-author-input')

    fireEvent.change(authorInput, { target: { value: 'Alex' } })
    fireEvent.blur(authorInput)
    expect(screen.getByTestId('metadata-author-input')).toHaveValue('Alex')

    fireEvent.click(screen.getByTestId('undo-button'))

    expect(screen.getByTestId('metadata-author-input')).toHaveValue('')
  })

  it('reflects a loaded preset track\'s existing metadata', () => {
    render(<App />)

    fireEvent.change(screen.getByTestId('preset-select'), { target: { value: 'preset-oval-speedway' } })

    expect(screen.getByTestId('metadata-description-input')).toHaveValue(
      'A fast, wide oval - good for learning the controls.',
    )
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
    fireEvent.click(screen.getByTestId('add-point-tool-button'))
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
