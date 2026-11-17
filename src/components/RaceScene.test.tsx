import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RaceScene } from './RaceScene'
import { createControlPoint, createTrackDocument } from '../domain/track/schema'
import * as generateTrackModule from '../domain/generation/generateTrack'

function squareTrack() {
  return createTrackDocument({
    controlPoints: [
      createControlPoint({ x: 0, z: 0, width: 10 }),
      createControlPoint({ x: 100, z: 0, width: 10 }),
      createControlPoint({ x: 100, z: 100, width: 10 }),
      createControlPoint({ x: 0, z: 100, width: 10 }),
    ],
    startLine: { controlPointIndex: 0, headingDeg: 90 },
  })
}

describe('RaceScene', () => {
  it('starts the countdown at phase 3', () => {
    render(<RaceScene doc={squareTrack()} />)

    expect(screen.getByTestId('countdown-overlay')).toHaveTextContent('3')
  })

  it('restart button resets the live lap display and re-arms the countdown', () => {
    render(<RaceScene doc={squareTrack()} />)

    fireEvent.click(screen.getByTestId('restart-button'))

    expect(screen.getByTestId('countdown-overlay')).toHaveTextContent('3')
    expect(screen.getByText(/Current lap: 0:00\.00/)).toBeInTheDocument()
  })

  it('restart key (R) triggers the same restart behavior as the button', () => {
    render(<RaceScene doc={squareTrack()} />)

    fireEvent.keyDown(window, { key: 'r' })

    expect(screen.getByTestId('countdown-overlay')).toHaveTextContent('3')
    expect(screen.getByText(/Current lap: 0:00\.00/)).toBeInTheDocument()
  })

  it('does not regenerate the track, unmount the race canvas, or leave race mode on restart', () => {
    const generateTrackSpy = vi.spyOn(generateTrackModule, 'generateTrack')
    render(<RaceScene doc={squareTrack()} />)
    const callsBeforeRestart = generateTrackSpy.mock.calls.length

    fireEvent.click(screen.getByTestId('restart-button'))

    expect(generateTrackSpy.mock.calls.length).toBe(callsBeforeRestart)
    expect(screen.getByTestId('race-canvas')).toBeInTheDocument()
    expect(screen.getByTestId('race-hud')).toBeInTheDocument()
    generateTrackSpy.mockRestore()
  })
})
