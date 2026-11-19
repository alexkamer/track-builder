import { describe, expect, it } from 'vitest'
import { createControlPoint, createTrackDocument } from '../track/schema'
import { BARRIER_RIDGE_DEPTH, generateTrack, ringVertex } from '../generation/generateTrack'
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

  it('retains more speed on a shallow-angle (grazing) hit than a near-head-on hit', () => {
    const track = generateTrack(wideSquareTrack())
    // Same outward offset, same incoming speed; only the heading (impact angle) differs.
    const basePos = { x: 100, z: -100 }
    const grazing = { ...createInitialCarState(basePos.x, basePos.z, Math.PI / 2), speed: 20 }
    const headOn = { ...createInitialCarState(basePos.x, basePos.z, 0), speed: 20 }

    const grazingResult = resolveBarrierCollision(grazing, track)
    const headOnResult = resolveBarrierCollision(headOn, track)

    expect(grazingResult.speed).toBeGreaterThan(headOnResult.speed)
  })

  it('biases the redirect heading toward the track interior rather than exactly along the tangent', () => {
    const track = generateTrack(wideSquareTrack())
    const state = { ...createInitialCarState(100, -100, Math.PI / 2), speed: 20 }
    const result = resolveBarrierCollision(state, track)

    const index = nearestCenterlineIndex(state, track)
    const center = track.centerline[index]
    const leftBase = ringVertex(track.barrierLeft, index)
    const rightBase = ringVertex(track.barrierRight, index)
    const normalX = (leftBase.x - rightBase.x) / Math.hypot(leftBase.x - rightBase.x, leftBase.z - rightBase.z)
    const normalZ = (leftBase.z - rightBase.z) / Math.hypot(leftBase.x - rightBase.x, leftBase.z - rightBase.z)

    const dx = state.x - center.x
    const dz = state.z - center.z
    const lateralOffset = dx * normalX + dz * normalZ
    const inwardSign = -Math.sign(lateralOffset)

    const forwardX = Math.sin(result.headingRad)
    const forwardZ = Math.cos(result.headingRad)
    const inwardComponent = forwardX * (inwardSign * normalX) + forwardZ * (inwardSign * normalZ)

    expect(inwardComponent).toBeGreaterThan(0)
  })

  it('uses the barrier inner face as the boundary, not the outward ridge of its profile', () => {
    // The armco profile folds a ridge BARRIER_RIDGE_DEPTH outward at mid height. The wall the
    // car hits is the inner face, so a car sitting between the inner face and the ridge must
    // still collide. Reading any later profile vertex as the boundary would let it through -
    // which is exactly what a hardcoded `positions[index * 2]` stride does on a 4-point profile.
    const track = generateTrack(wideSquareTrack())

    // Ring 8 is mid-way along the first (straight) edge, so the lateral direction there is
    // well-defined and the car's nearest ring stays the one we measured against.
    const ring = 8
    const center = track.centerline[ring]
    const innerFace = ringVertex(track.barrierLeft, ring)
    const innerDistance = Math.hypot(innerFace.x - center.x, innerFace.z - center.z)
    const unitX = (innerFace.x - center.x) / innerDistance
    const unitZ = (innerFace.z - center.z) / innerDistance

    const beyondInnerFace = innerDistance + BARRIER_RIDGE_DEPTH / 2
    const state = {
      ...createInitialCarState(center.x + unitX * beyondInnerFace, center.z + unitZ * beyondInnerFace, Math.PI / 2),
      speed: 20,
    }
    expect(nearestCenterlineIndex(state, track)).toBe(ring)

    const result = resolveBarrierCollision(state, track)

    expect(lateralOffsetFromCenterline(result, track)).toBeLessThan(innerDistance)
    expect(result.speed).toBeLessThan(state.speed)
  })

  it('floors post-collision speed above a minimum escape speed across repeated grazing hits', () => {
    const track = generateTrack(wideSquareTrack())
    let state = { ...createInitialCarState(100, -100, Math.PI / 2 - 0.05), speed: 10 }

    for (let i = 0; i < 5; i++) {
      state = resolveBarrierCollision(state, track)
      // Re-push the car just outside the barrier to force another collision next call,
      // simulating sustained throttle/steer back into the wall.
      state = { ...state, x: 100, z: -100 }
      expect(state.speed).toBeGreaterThanOrEqual(3)
    }
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
