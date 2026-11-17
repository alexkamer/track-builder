import type { GeneratedTrack } from '../generation/generateTrack'
import type { Vec3 } from '../track/spline'

export interface Position2D {
  x: number
  z: number
}

/** Fraction `t` along segment `a`→`b` closest to `pos` (clamped to the segment), and the squared distance to that point. */
function projectOntoSegment(pos: Position2D, a: Vec3, b: Vec3): { t: number; distSq: number } {
  const abx = b.x - a.x
  const abz = b.z - a.z
  const lenSq = abx * abx + abz * abz
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((pos.x - a.x) * abx + (pos.z - a.z) * abz) / lenSq))
  const dx = pos.x - (a.x + abx * t)
  const dz = pos.z - (a.z + abz * t)
  return { t, distSq: dx * dx + dz * dz }
}

export function nearestCenterlineIndex(pos: Position2D, track: GeneratedTrack): number {
  const { centerline } = track
  let bestDistSq = Infinity
  let bestIndex = 0

  for (let i = 0; i < centerline.length; i++) {
    const dx = pos.x - centerline[i].x
    const dz = pos.z - centerline[i].z
    const distSq = dx * dx + dz * dz
    if (distSq < bestDistSq) {
      bestDistSq = distSq
      bestIndex = i
    }
  }

  return bestIndex
}

/**
 * Linearly interpolates a per-ring scalar (`valueAt`) between the two centerline rings
 * straddling `pos`, rather than snapping to whichever ring is nearest - used so values that
 * vary along the track (elevation, banking) change smoothly as the car crosses ring
 * boundaries instead of stepping.
 */
function interpolateAlongCenterline(pos: Position2D, track: GeneratedTrack, valueAt: (index: number) => number): number {
  const { centerline } = track
  const n = centerline.length
  const index = nearestCenterlineIndex(pos, track)
  const nextIndex = (index + 1) % n
  const prevIndex = (index - 1 + n) % n

  const forward = projectOntoSegment(pos, centerline[index], centerline[nextIndex])
  const backward = projectOntoSegment(pos, centerline[prevIndex], centerline[index])

  return forward.distSq <= backward.distSq
    ? valueAt(index) + (valueAt(nextIndex) - valueAt(index)) * forward.t
    : valueAt(prevIndex) + (valueAt(index) - valueAt(prevIndex)) * backward.t
}

/**
 * The road surface's height at the point on the centerline nearest `pos`, smoothly
 * interpolated between centerline rings so the car/ghost mesh rises and falls continuously
 * instead of stepping between ring heights as it crosses ring boundaries.
 */
export function elevationAt(pos: Position2D, track: GeneratedTrack): number {
  return interpolateAlongCenterline(pos, track, (i) => track.centerline[i].y)
}

/**
 * The road's banking (roll) in radians at the point on the centerline nearest `pos`, smoothly
 * interpolated the same way as {@link elevationAt}. Positive banks the left edge up - see
 * `generateTrack`'s `offsetAt`. Used to roll the car to match the road surface it's on.
 */
export function bankingAt(pos: Position2D, track: GeneratedTrack): number {
  return interpolateAlongCenterline(pos, track, (i) => track.bankingRad[i])
}

/**
 * True when `pos` lies within the road's width at the nearest point along the centerline.
 * Used each physics tick to decide whether the off-track speed penalty applies.
 */
export function isOnRoadSurface(pos: Position2D, track: GeneratedTrack): boolean {
  const index = nearestCenterlineIndex(pos, track)
  const left = track.roadMesh.positions[index * 2]
  const right = track.roadMesh.positions[index * 2 + 1]
  const halfWidth = Math.hypot(left.x - right.x, left.z - right.z) / 2
  const dx = pos.x - track.centerline[index].x
  const dz = pos.z - track.centerline[index].z

  return Math.hypot(dx, dz) <= halfWidth
}
