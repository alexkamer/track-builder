import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TrackEditor2D } from './TrackEditor2D'
import { createControlPoint, createTrackDocument } from '../domain/track/schema'

function sampleDoc() {
  return createTrackDocument({
    controlPoints: [
      createControlPoint({ x: 10, z: 10 }),
      createControlPoint({ x: 100, z: 10 }),
      createControlPoint({ x: 100, z: 100 }),
    ],
  })
}

describe('TrackEditor2D zoom/pan', () => {
  it('does not dispatch any track mutation when zooming with the wheel', () => {
    const dispatch = vi.fn()
    render(<TrackEditor2D doc={sampleDoc()} dispatch={dispatch} pointClickMode="pan" />)
    const canvas = screen.getByTestId('track-editor-canvas')

    fireEvent.wheel(canvas, { deltaY: -100 })
    fireEvent.wheel(canvas, { deltaY: 100 })

    expect(dispatch).not.toHaveBeenCalled()
  })

  it('does not dispatch any track mutation when panning in pan mode', () => {
    const dispatch = vi.fn()
    render(<TrackEditor2D doc={sampleDoc()} dispatch={dispatch} pointClickMode="pan" />)
    const canvas = screen.getByTestId('track-editor-canvas')

    fireEvent.mouseDown(canvas, { clientX: 50, clientY: 50, target: canvas })
    fireEvent.mouseMove(canvas, { clientX: 90, clientY: 120 })
    fireEvent.mouseUp(canvas)
    fireEvent.click(canvas, { clientX: 90, clientY: 120, target: canvas })

    expect(dispatch).not.toHaveBeenCalled()
  })

  it('does mutate track data (ADD_POINT) for a plain click when not in pan mode', () => {
    const dispatch = vi.fn()
    render(<TrackEditor2D doc={sampleDoc()} dispatch={dispatch} pointClickMode="select" />)
    const canvas = screen.getByTestId('track-editor-canvas')

    fireEvent.click(canvas, { clientX: 50, clientY: 50, target: canvas })

    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'ADD_POINT' }))
  })
})
