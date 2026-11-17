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
    // widely enough to clear the minimum corner radius check (now calibrated against
    // the car's actual achievable turn radius, so this needs to be bigger than before).
    fireEvent.click(canvas, { clientX: 0, clientY: 0, target: canvas })
    fireEvent.click(canvas, { clientX: 450, clientY: 0, target: canvas })
    fireEvent.click(canvas, { clientX: 225, clientY: 450, target: canvas })

    expect(screen.getByText('Start Race')).toBeDisabled()

    fireEvent.click(screen.getByText('Set start/finish line'))
    fireEvent.mouseDown(screen.getByTestId('control-point-0'))

    expect(screen.getByText('Start Race')).toBeEnabled()
  })
})
