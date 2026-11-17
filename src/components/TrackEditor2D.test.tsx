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

function farOffOriginDoc() {
  return createTrackDocument({
    id: 'preset-far',
    controlPoints: [
      createControlPoint({ x: 4000, z: -4000 }),
      createControlPoint({ x: 4300, z: -4000 }),
      createControlPoint({ x: 4300, z: -3700 }),
    ],
  })
}

function getViewTransform() {
  const group = screen.getByTestId('view-transform-group')
  const match = group.getAttribute('transform')!.match(/translate\(([-\d.]+),([-\d.]+)\) scale\(([-\d.]+)\)/)
  const [, panX, panY, zoom] = match!
  return { panX: Number(panX), panY: Number(panY), zoom: Number(zoom) }
}

describe('TrackEditor2D auto-fit on load', () => {
  it('fits the view to a far off-origin track when loadKey changes', () => {
    const dispatch = vi.fn()
    render(
      <TrackEditor2D
        doc={farOffOriginDoc()}
        dispatch={dispatch}
        width={640}
        height={480}
        loadKey="preset-far:t1"
      />,
    )

    const { panX, panY, zoom } = getViewTransform()
    // The control points sit around x=[4000,4300], z=[-4000,-3700]; a default zoom=1/pan=0
    // view would place them far off-screen. A fitted view must map their center near the
    // canvas center.
    const screenX = 4150 * zoom + panX
    const screenY = -3850 * zoom + panY
    expect(screenX).toBeGreaterThan(0)
    expect(screenX).toBeLessThan(640)
    expect(screenY).toBeGreaterThan(0)
    expect(screenY).toBeLessThan(480)
  })

  it('does not reset the view when the doc changes but loadKey stays the same', () => {
    const dispatch = vi.fn()
    const { rerender } = render(
      <TrackEditor2D
        doc={farOffOriginDoc()}
        dispatch={dispatch}
        width={640}
        height={480}
        loadKey="preset-far:t1"
      />,
    )
    const fitted = getViewTransform()

    const canvas = screen.getByTestId('track-editor-canvas')
    fireEvent.wheel(canvas, { deltaY: -100 })
    const afterZoom = getViewTransform()
    expect(afterZoom.zoom).not.toBe(fitted.zoom)

    const editedDoc = { ...farOffOriginDoc(), controlPoints: [...farOffOriginDoc().controlPoints] }
    rerender(
      <TrackEditor2D
        doc={editedDoc}
        dispatch={dispatch}
        width={640}
        height={480}
        loadKey="preset-far:t1"
      />,
    )

    expect(getViewTransform()).toEqual(afterZoom)
  })
})
