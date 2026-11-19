import { ringVertex, type GeneratedTrack } from '../generation/generateTrack'
import type { CarState } from './carPhysics'
import { nearestCenterlineIndex } from './trackSurface'

/** Speed retained on a near-tangent (grazing) hit - most of it, since a graze is a glancing contact, not a hard stop. */
const RETENTION_GRAZE = 0.85
/** Speed retained on a near-perpendicular (head-on) hit - most of it is lost, consistent with a hard impact. */
const RETENTION_HEAD_ON = 0.3
/** Pushes the car slightly inside the boundary (not exactly on it) so it doesn't immediately re-collide next tick. */
const INWARD_MARGIN_FACTOR = 0.98
/** How far the redirect heading is biased off the wall tangent, toward the track interior, in radians. */
const INWARD_REDIRECT_BIAS_RAD = 0.15
/**
 * Floor on post-collision forward speed (when incoming speed exceeds `ESCAPE_SPEED_THRESHOLD`),
 * so a sequence of grazing hits - each retaining most of its speed individually - can't still
 * compound toward a near-stall crawl if something else keeps shaving speed down between hits.
 */
const MIN_ESCAPE_SPEED = 3
/** Below this incoming speed, the escape-speed floor does not apply - a car that was already
 * nearly stopped (or reversing) into the wall should not be force-accelerated by the floor. */
const ESCAPE_SPEED_THRESHOLD = 0.5

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** Wraps an angle (radians) into (-PI, PI]. */
function normalizeAngle(angleRad: number): number {
  let a = angleRad % (2 * Math.PI)
  if (a > Math.PI) a -= 2 * Math.PI
  if (a <= -Math.PI) a += 2 * Math.PI
  return a
}

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
  // Profile point 0 is each barrier's innermost face - the wall the car actually hits. The
  // armco profile's mid-height ridge folds outward from here, and must not widen the boundary.
  const leftBase = ringVertex(track.barrierLeft, index)
  const rightBase = ringVertex(track.barrierRight, index)

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

  // Tangent to the wall (i.e. along the road, perpendicular to the lateral `normal` above),
  // in the direction closest to the car's current heading, so sliding along the wall
  // continues in roughly the same direction rather than reversing. (`atan2(normalZ,
  // -normalX)` is the direction whose "left" vector, per this module's forward/right
  // convention, equals `normal` - the previous `atan2(normalX, -normalZ)` was off by 90°,
  // pointing along the lateral axis instead of along the road, which misdirected the
  // post-collision slide and contributed to the sticky-wall crawl.)
  const tangentHeading = Math.atan2(normalZ, -normalX)
  const currentForwardX = Math.sin(state.headingRad)
  const currentForwardZ = Math.cos(state.headingRad)
  const tangentForwardX = Math.sin(tangentHeading)
  const tangentForwardZ = Math.cos(tangentHeading)
  const alignment = currentForwardX * tangentForwardX + currentForwardZ * tangentForwardZ
  const tangentOnlyHeading = alignment >= 0 ? tangentHeading : tangentHeading + Math.PI

  // Bias the redirect heading off the bare tangent, toward the track interior, so the car's
  // heading carries a component pointing away from the wall instead of flush along it - this
  // is what lets a grazing hit actually leave the wall rather than sliding in repeated contact.
  const inwardSign = -Math.sign(lateralOffset)
  const inwardHeading = Math.atan2(inwardSign * normalX, inwardSign * normalZ)
  const angleToInward = normalizeAngle(inwardHeading - tangentOnlyHeading)
  const bias = clamp(angleToInward, -INWARD_REDIRECT_BIAS_RAD, INWARD_REDIRECT_BIAS_RAD)
  const newHeading = tangentOnlyHeading + bias

  // Retention depends on impact angle: a near-tangent (grazing) hit keeps most of its speed,
  // a near-perpendicular (head-on) hit loses most of it - `impactSharpness` is 0 for a pure
  // graze (|alignment| = 1) and 1 for a pure head-on hit (alignment = 0).
  const impactSharpness = 1 - Math.abs(alignment)
  const retention = RETENTION_GRAZE + (RETENTION_HEAD_ON - RETENTION_GRAZE) * impactSharpness

  let speed = state.speed * retention
  if (Math.abs(state.speed) > ESCAPE_SPEED_THRESHOLD) {
    const sign = Math.sign(state.speed)
    speed = sign * Math.max(Math.abs(speed), MIN_ESCAPE_SPEED)
  }

  return {
    ...state,
    x: center.x + clampedOffset * normalX + forwardOffset * -normalZ,
    z: center.z + clampedOffset * normalZ + forwardOffset * normalX,
    headingRad: newHeading,
    speed,
    lateralSlip: 0,
  }
}
