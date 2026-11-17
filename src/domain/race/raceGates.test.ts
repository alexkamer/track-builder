import { describe, expect, it } from 'vitest'
import { createControlPoint, createTrackDocument } from '../track/schema'
import { generateTrack } from '../generation/generateTrack'
import { computeRaceGates } from './raceGates'

function squareTrackWithCheckpoints() {
  return createTrackDocument({
    controlPoints: [
      createControlPoint({ x: 60, z: 60, width: 10 }),
      createControlPoint({ x: 400, z: 60, width: 10 }),
      createControlPoint({ x: 400, z: 400, width: 10 }),
      createControlPoint({ x: 60, z: 400, width: 10 }),
    ],
    startLine: { controlPointIndex: 0, headingDeg: 90 },
    checkpoints: [{ controlPointIndex: 1 }, { controlPointIndex: 2 }],
  })
}

describe('computeRaceGates', () => {
  it('derives a start gate at the spawn position with the start line heading', () => {
    const doc = squareTrackWithCheckpoints()
    const generated = generateTrack(doc)
    const { startGate } = computeRaceGates(doc, generated)

    expect(startGate.position.x).toBeCloseTo(generated.spawn.position.x, 5)
    expect(startGate.position.z).toBeCloseTo(generated.spawn.position.z, 5)
    expect(startGate.width).toBeCloseTo(10, 5)
  })

  it('derives one checkpoint gate per checkpoint, in loop order', () => {
    const doc = squareTrackWithCheckpoints()
    const generated = generateTrack(doc)
    const { checkpointGates } = computeRaceGates(doc, generated)

    expect(checkpointGates).toHaveLength(2)
    // Checkpoint 1 (control point 1, at x=400,z=60) should come before checkpoint 2 (control point 2, x=400,z=400).
    expect(checkpointGates[0].position.x).toBeCloseTo(400, 0)
    expect(checkpointGates[0].position.z).toBeCloseTo(60, 0)
    expect(checkpointGates[1].position.x).toBeCloseTo(400, 0)
    expect(checkpointGates[1].position.z).toBeCloseTo(400, 0)
  })

  it('produces identical gates when run twice on the same input (deterministic)', () => {
    const doc = squareTrackWithCheckpoints()
    const generated = generateTrack(doc)
    expect(computeRaceGates(doc, generated)).toEqual(computeRaceGates(doc, generated))
  })
})
