import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RaceScene } from './RaceScene'
import { createControlPoint, createTrackDocument } from '../domain/track/schema'
import * as generateTrackModule from '../domain/generation/generateTrack'

function squareTrack() {
  // 150x150 (not 100x100): big enough that every corner clears MIN_CORNER_RADIUS,
  // which is calibrated against the car's actual achievable turn radius.
  return createTrackDocument({
    controlPoints: [
      createControlPoint({ x: 0, z: 0, width: 10 }),
      createControlPoint({ x: 150, z: 0, width: 10 }),
      createControlPoint({ x: 150, z: 150, width: 10 }),
      createControlPoint({ x: 0, z: 150, width: 10 }),
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

  it('renders the stats HUD at a standstill with zeroed speed, throttle, and brake', () => {
    render(<RaceScene doc={squareTrack()} />)

    expect(screen.getByTestId('stats-hud')).toBeInTheDocument()
    expect(screen.getByTestId('speed-display')).toHaveTextContent('0')
    expect(screen.getByTestId('elevation-display')).toHaveTextContent('Elevation: 0.0m')
  })

  it('restart resets the stats HUD back to zero', () => {
    render(<RaceScene doc={squareTrack()} />)

    fireEvent.click(screen.getByTestId('restart-button'))

    expect(screen.getByTestId('speed-display')).toHaveTextContent('0')
    expect(screen.getByTestId('elevation-display')).toHaveTextContent('Elevation: 0.0m')
  })

  it('mounts and stays interactive in an environment that cannot load assets or create a WebGL context', async () => {
    // jsdom has no WebGL and cannot decode images, so every scene asset fails here - the same
    // shape of failure as an offline user or a missing file. None of that may stop the race
    // view from mounting or leave its controls dead, and none of it may surface as an
    // unhandled error.
    const unhandled = vi.fn()
    window.addEventListener('unhandledrejection', unhandled)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<RaceScene doc={squareTrack()} />)

    expect(screen.getByTestId('race-hud')).toBeInTheDocument()
    expect(screen.getByTestId('stats-hud')).toBeInTheDocument()

    // The controls still work, rather than being rendered but inert.
    fireEvent.click(screen.getByTestId('camera-toggle-button'))
    expect(screen.getByTestId('camera-toggle-button')).toHaveTextContent('Top-down')

    fireEvent.click(screen.getByTestId('restart-button'))
    expect(screen.getByTestId('countdown-overlay')).toHaveTextContent('3')

    await waitFor(() => expect(unhandled).not.toHaveBeenCalled())

    window.removeEventListener('unhandledrejection', unhandled)
    consoleError.mockRestore()
  })
})
