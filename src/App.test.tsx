import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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

describe('App delete control point', () => {
  it('clears selection after deleting the selected (last) control point', () => {
    render(<App />)
    const canvas = screen.getByTestId('track-editor-canvas')

    fireEvent.click(canvas, { clientX: 0, clientY: 0, target: canvas })
    fireEvent.click(canvas, { clientX: 300, clientY: 0, target: canvas })
    fireEvent.click(canvas, { clientX: 150, clientY: 300, target: canvas })
    fireEvent.click(canvas, { clientX: 150, clientY: 100, target: canvas })

    fireEvent.mouseDown(screen.getByTestId('control-point-3'))
    expect(screen.getByText('Control point 3')).toBeInTheDocument()

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
