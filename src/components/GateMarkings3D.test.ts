import { describe, expect, it } from 'vitest'
import { createControlPoint, createTrackDocument } from '../domain/track/schema'
import { generateTrack } from '../domain/generation/generateTrack'
import { CHECKPOINT_DEPTH, gateQuadCorners, START_LINE_DEPTH } from './GateMarkings3D'

function squareTrack(checkpoints: number[] = []) {
  return createTrackDocument({
    controlPoints: [
      createControlPoint({ x: 0, z: 0, width: 10 }),
      createControlPoint({ x: 150, z: 0, width: 10 }),
      createControlPoint({ x: 150, z: 150, width: 10 }),
      createControlPoint({ x: 0, z: 150, width: 10 }),
    ],
    startLine: { controlPointIndex: 0, headingDeg: 90 },
    checkpoints: checkpoints.map((controlPointIndex) => ({ controlPointIndex })),
  })
}

describe('gate markings', () => {
  it('marks the start/finish line and every checkpoint', () => {
    const { startLineTrigger, checkpointTriggers } = generateTrack(squareTrack([1, 2]))

    // One marking per gate: the start line plus each checkpoint.
    const markings = [startLineTrigger, ...checkpointTriggers]
    expect(markings).toHaveLength(3)
    for (const trigger of markings) {
      expect(gateQuadCorners(trigger, START_LINE_DEPTH)).toHaveLength(12)
    }
  })

  it('draws only the start-line marking on a track with no checkpoints', () => {
    const { startLineTrigger, checkpointTriggers } = generateTrack(squareTrack())

    expect(checkpointTriggers).toHaveLength(0)
    expect(gateQuadCorners(startLineTrigger, START_LINE_DEPTH)).toHaveLength(12)
  })

  it('spans the road width exactly where the trigger does', () => {
    const { startLineTrigger } = generateTrack(squareTrack())
    const corners = gateQuadCorners(startLineTrigger, START_LINE_DEPTH)

    // The marking is derived from the trigger, so its cross-track span must equal the trigger's
    // own left-to-right span - not merely be near it.
    const leftBack = { x: corners[0], z: corners[2] }
    const rightBack = { x: corners[3], z: corners[5] }
    const markingWidth = Math.hypot(leftBack.x - rightBack.x, leftBack.z - rightBack.z)
    const triggerWidth = Math.hypot(
      startLineTrigger.left.x - startLineTrigger.right.x,
      startLineTrigger.left.z - startLineTrigger.right.z,
    )
    expect(markingWidth).toBeCloseTo(triggerWidth, 6)
  })

  it('centres the marking on the trigger line, extruded along the track', () => {
    const { startLineTrigger } = generateTrack(squareTrack())
    const corners = gateQuadCorners(startLineTrigger, START_LINE_DEPTH)

    // Back and front edges sit half a depth either side of the trigger, so the painted line and
    // the gate it represents cross the car at the same moment.
    const backMid = { x: (corners[0] + corners[3]) / 2, z: (corners[2] + corners[5]) / 2 }
    const frontMid = { x: (corners[6] + corners[9]) / 2, z: (corners[8] + corners[11]) / 2 }
    const triggerMid = {
      x: (startLineTrigger.left.x + startLineTrigger.right.x) / 2,
      z: (startLineTrigger.left.z + startLineTrigger.right.z) / 2,
    }

    expect((backMid.x + frontMid.x) / 2).toBeCloseTo(triggerMid.x, 6)
    expect((backMid.z + frontMid.z) / 2).toBeCloseTo(triggerMid.z, 6)
    expect(Math.hypot(frontMid.x - backMid.x, frontMid.z - backMid.z)).toBeCloseTo(START_LINE_DEPTH, 6)
  })

  it('lies on the road surface, following elevation and banking', () => {
    const banked = createTrackDocument({
      ...squareTrack(),
      controlPoints: squareTrack().controlPoints.map((p, i) =>
        i === 0 ? { ...p, elevation: 10, bankingDeg: 20 } : p,
      ),
    })
    const { startLineTrigger } = generateTrack(banked)
    const corners = gateQuadCorners(startLineTrigger, START_LINE_DEPTH)

    // The quad takes its heights from the trigger's own banked edge points, so one side is
    // higher than the other rather than the marking lying flat across a banked road.
    expect(corners[1]).toBeCloseTo(startLineTrigger.left.y, 6)
    expect(corners[4]).toBeCloseTo(startLineTrigger.right.y, 6)
    expect(Math.abs(corners[1] - corners[4])).toBeGreaterThan(1)
  })

  it('gives checkpoints a narrower band than the start/finish line', () => {
    expect(CHECKPOINT_DEPTH).toBeLessThan(START_LINE_DEPTH)
  })
})
