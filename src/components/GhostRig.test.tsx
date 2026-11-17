import { render } from '@testing-library/react'
import { Canvas } from '@react-three/fiber'
import { describe, expect, it } from 'vitest'
import { GhostRig } from './GhostRig'
import { createControlPoint, createTrackDocument } from '../domain/track/schema'
import { generateTrack } from '../domain/generation/generateTrack'

function squareTrack() {
  // 150x150 (not 100x100): big enough that every corner clears MIN_CORNER_RADIUS,
  // which is now calibrated against the car's actual achievable turn radius.
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

describe('GhostRig', () => {
  // Note: <mesh> renders into the WebGL canvas, not the DOM, so these are smoke tests
  // (no throw) rather than DOM assertions - ghost rendering is verified visually elsewhere.
  it('renders without error when given a non-empty input log', () => {
    const track = generateTrack(squareTrack())
    const inputLog = Array.from({ length: 30 }, () => ({ throttle: 1, brake: 0, steer: 0 }))

    expect(() =>
      render(
        <Canvas>
          <GhostRig spawn={track.spawn} inputLog={inputLog} track={track} />
        </Canvas>,
      ),
    ).not.toThrow()
  })

  it('renders without error when the input log is empty (no best lap yet)', () => {
    const track = generateTrack(squareTrack())

    expect(() =>
      render(
        <Canvas>
          <GhostRig spawn={track.spawn} inputLog={[]} track={track} />
        </Canvas>,
      ),
    ).not.toThrow()
  })
})
