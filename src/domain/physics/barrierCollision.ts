import type { GeneratedTrack } from '../generation/generateTrack'
import type { CarState } from './carPhysics'
import { nearestCenterlineIndex } from './trackSurface'

/** Speed retained (the rest lost to the impact) when the car hits a barrier. */
const BARRIER_BOUNCE_SPEED_RETENTION = 0.4
/** Pushes the car slightly inside the boundary (not exactly on it) so it doesn't immediately re-collide next tick. */
const INWARD_MARGIN_FACTOR = 0.98

/**
 * Keeps the car from passing through barrier geometry: if the car's position would be
 * beyond a barrier, it's pushed back just inside the barrier's inner edge, redirected to
 * slide along the wall (in whichever tangent direction is closest to its current heading,
 * so it keeps roughly its prior direction of travel instead of bouncing back into the wall
 * on the very next tick), and speed is reduced to simulate the impact.
 */
export function resolveBarrierCollision(state: CarState, track: GeneratedTrack): CarState {
  const index = nearestCenterlineIndex(state, track)
  const center = track.centerline[index]
  const leftBase = track.barrierLeft.positions[index * 2]
  const rightBase = track.barrierRight.positions[index * 2]

  const spanX = leftBase.x - rightBase.x
  const spanZ = leftBase.z - rightBase.z
  const span = Math.hypot(spanX, spanZ) || 1
  const normalX = spanX / span
  const normalZ = spanZ / span
  const halfWidth = span / 2

  const dx = state.x - center.x
  const dz = state.z - center.z
  const lateralOffset = dx * normalX + dz * normalZ

  if (Math.abs(lateralOffset) <= halfWidth) {
    return state
  }

  const clampedOffset = Math.sign(lateralOffset) * halfWidth * INWARD_MARGIN_FACTOR
  const forwardOffset = dx * -normalZ + dz * normalX // the along-track component, kept as-is

  // Tangent to the wall, in the direction closest to the car's current heading, so sliding
  // along the wall continues in roughly the same direction rather than reversing.
  const tangentHeading = Math.atan2(normalX, -normalZ)
  const currentForwardX = Math.sin(state.headingRad)
  const currentForwardZ = Math.cos(state.headingRad)
  const tangentForwardX = Math.sin(tangentHeading)
  const tangentForwardZ = Math.cos(tangentHeading)
  const alignment = currentForwardX * tangentForwardX + currentForwardZ * tangentForwardZ
  const newHeading = alignment >= 0 ? tangentHeading : tangentHeading + Math.PI

  return {
    ...state,
    x: center.x + clampedOffset * normalX + forwardOffset * -normalZ,
    z: center.z + clampedOffset * normalZ + forwardOffset * normalX,
    headingRad: newHeading,
    speed: state.speed * BARRIER_BOUNCE_SPEED_RETENTION,
    lateralSlip: 0,
  }
}
