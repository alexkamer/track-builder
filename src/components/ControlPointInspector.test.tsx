import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ControlPointInspector } from './ControlPointInspector'
import { createControlPoint, createTrackDocument } from '../domain/track/schema'

function docWithPoints(count: number) {
  return createTrackDocument({
    controlPoints: Array.from({ length: count }, (_, i) => createControlPoint({ x: i, z: i })),
  })
}

describe('ControlPointInspector delete point', () => {
  it('dispatches DELETE_POINT for the selected index when the delete button is clicked', () => {
    const dispatch = vi.fn()
    const onDeletePoint = vi.fn()
    render(
      <ControlPointInspector
        doc={docWithPoints(4)}
        selectedIndex={2}
        dispatch={dispatch}
        onDeletePoint={onDeletePoint}
      />,
    )

    fireEvent.click(screen.getByTestId('delete-point-button'))

    expect(onDeletePoint).toHaveBeenCalledWith(2)
  })

  it('disables the delete button when exactly 3 control points remain', () => {
    const dispatch = vi.fn()
    render(<ControlPointInspector doc={docWithPoints(3)} selectedIndex={0} dispatch={dispatch} />)

    expect(screen.getByTestId('delete-point-button')).toBeDisabled()
  })

  it('enables the delete button when more than 3 control points remain', () => {
    const dispatch = vi.fn()
    render(<ControlPointInspector doc={docWithPoints(4)} selectedIndex={0} dispatch={dispatch} />)

    expect(screen.getByTestId('delete-point-button')).toBeEnabled()
  })
})
