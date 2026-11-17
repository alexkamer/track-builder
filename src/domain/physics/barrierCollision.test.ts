import { describe, expect, it } from 'vitest'
import { createControlPoint, createTrackDocument } from '../track/schema'
import { generateTrack } from '../generation/generateTrack'
import { createInitialCarState } from './carPhysics'
import { resolveBarrierCollision } from './barrierCollision'
import { nearestCenterlineIndex } from './trackSurface'
import { advanceCarTick } from './advanceCarTick'

function wideSquareTrack() {
  return createTrackDocument({
    controlPoints: [
      createControlPoint({ x: 0, z: 0, width: 20 }),
      createControlPoint({ x: 200, z: 0, width: 20 }),
      createControlPoint({ x: 200, z: 200, width: 20 }),
      createControlPoint({ x: 0, z: 200, width: 20 }),
    ],
    startLine: { controlPointIndex: 0, headingDeg: 90 },
  })
}

/** Distance (and direction, as a unit vector) from the centerline at the nearest ring to `pos`. */
function lateralOffsetFromCenterline(pos: { x: number; z: number }, track: ReturnType<typeof generateTrack>) {
  const index = nearestCenterlineIndex(pos, track)
  const center = track.centerline[index]
  return Math.hypot(pos.x - center.x, pos.z - center.z)
}

describe('resolveBarrierCollision', () => {
  it('leaves the car untouched when well within the barriers', () => {
    const track = generateTrack(wideSquareTrack())
    const state = { ...createInitialCarState(0, 0, 0), speed: 20 }
    const result = resolveBarrierCollision(state, track)
    expect(result).toEqual(state)
  })

  it('pushes the car back inside the barrier and reduces speed on impact', () => {
    const track = generateTrack(wideSquareTrack())
    // Push the car far outward from the nearest centerline point in both axes, so
    // regardless of which direction is "lateral" there, it ends up well beyond the barrier.
    const state = { ...createInitialCarState(100, -100, 0), speed: 20 }
    const beforeOffset = lateralOffsetFromCenterline(state, track)

    const result = resolveBarrierCollision(state, track)
    const afterOffset = lateralOffsetFromCenterline(result, track)

    expect(afterOffset).toBeLessThan(beforeOffset)
    expect(result.speed).toBeLessThan(state.speed)
    expect(result.lateralSlip).toBe(0)
  })

  it('does not change a car that starts exactly on the centerline', () => {
    const track = generateTrack(wideSquareTrack())
    const state = { ...createInitialCarState(0, 0, 0), speed: 15 }
    expect(resolveBarrierCollision(state, track)).toEqual(state)
  })

  it('regression: does not permanently freeze the car at near-zero speed after repeated contact', () => {
    // A car that clips a barrier while turning into it used to get crushed to near-zero
    // speed every tick forever (heading kept pointing back into the wall, so every tick
    // re-collided and multiplied speed by the bounce-retention factor again). The fix
    // redirects heading to slide along the wall tangent on collision, so speed should
    // recover under sustained throttle rather than monotonically decaying to ~0.
    const track = generateTrack(wideSquareTrack())
    let state = createInitialCarState(track.spawn.position.x, track.spawn.position.z, Math.PI / 2)
    const input = { throttle: 1, brake: 0, steer: 1 } // hard turn straight into the inside wall

    for (let i = 0; i < 300; i++) {
      state = advanceCarTick(state, input, 1 / 60, track)
    }

    // The old bug drove speed down toward ~0.2 and kept it pinned there for the rest of the run.
    expect(state.speed).toBeGreaterThan(1)
  })
})
