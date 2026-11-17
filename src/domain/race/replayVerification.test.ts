import { describe, expect, it } from 'vitest'
import { createControlPoint, createTrackDocument } from '../track/schema'
import { generateTrack } from '../generation/generateTrack'
import { replayInputLog } from './replayVerification'
import { driveFullLapAutopilot } from './testAutopilot'
import type { CarInput } from '../physics/carPhysics'

function bigLoopTrack() {
  return createTrackDocument({
    controlPoints: [
      createControlPoint({ x: 0, z: -140, width: 20 }),
      createControlPoint({ x: 130, z: -40, width: 20 }),
      createControlPoint({ x: 80, z: 120, width: 20 }),
      createControlPoint({ x: -80, z: 120, width: 20 }),
      createControlPoint({ x: -130, z: -40, width: 20 }),
    ],
    startLine: { controlPointIndex: 0, headingDeg: 90 },
  })
}

function circleTrack(radius: number, pointCount: number, width: number) {
  const controlPoints = Array.from({ length: pointCount }, (_, i) => {
    const angle = (i / pointCount) * Math.PI * 2
    return createControlPoint({ x: radius * Math.sin(angle), z: -radius * Math.cos(angle), width })
  })
  return createTrackDocument({ controlPoints, startLine: { controlPointIndex: 0, headingDeg: 90 } })
}

describe('replayInputLog', () => {
  it('rejects an empty or too-short input log (no lap completes)', () => {
    const doc = bigLoopTrack()
    const generated = generateTrack(doc)
    const result = replayInputLog(doc, generated, [])
    expect(result.valid).toBe(false)
  })

  it('rejects an input log that never returns to the start line', () => {
    const doc = bigLoopTrack()
    const generated = generateTrack(doc)
    const straightOnly: CarInput[] = Array.from({ length: 60 }, () => ({ throttle: 1, brake: 0, steer: 0 }))
    const result = replayInputLog(doc, generated, straightOnly)
    expect(result.valid).toBe(false)
  })

  it('rejects a tampered log claiming a lap time shorter than what actually happened', () => {
    const doc = bigLoopTrack()
    const generated = generateTrack(doc)
    // Any fixed short log of pure throttle cannot complete this track's lap distance.
    const tooShort: CarInput[] = Array.from({ length: 10 }, () => ({ throttle: 1, brake: 0, steer: 0.5 }))
    const result = replayInputLog(doc, generated, tooShort)
    expect(result.valid).toBe(false)
  })

  it('accepts a genuinely driven, physics-valid lap and reports its actual duration', () => {
    const doc = circleTrack(100, 16, 80)
    const generated = generateTrack(doc)
    const log = driveFullLapAutopilot(doc, generated)

    expect(log).not.toBeNull()
    const result = replayInputLog(doc, generated, log as CarInput[])
    expect(result.valid).toBe(true)
    // The log includes the crossing tick itself, so it's one tick longer than the completed lap's duration.
    expect(result.lapTicks).toBe((log as CarInput[]).length - 1)
  })
})
