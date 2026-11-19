import type { GeneratedTrack } from '../generation/generateTrack'
import type { Vec3 } from '../track/spline'

export interface Position2D {
  x: number
  z: number
}

/**
 * Fraction `t` along segment `a`→`b` closest to `pos` (clamped to the segment), the squared
 * distance to that point, and the signed perpendicular offset (positive to the left of
 * `a`→`b`, matching `generateTrack`'s left/right convention).
 */
function projectOntoSegment(pos: Position2D, a: Vec3, b: Vec3): { t: number; distSq: number; signedOffset: number } {
  const abx = b.x - a.x
  const abz = b.z - a.z
  const lenSq = abx * abx + abz * abz
  const len = Math.sqrt(lenSq) || 1
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((pos.x - a.x) * abx + (pos.z - a.z) * abz) / lenSq))
  const dx = pos.x - (a.x + abx * t)
  const dz = pos.z - (a.z + abz * t)
  // Left-hand normal of the a→b tangent, matching computeRingFrames' (normalX, normalZ).
  const normalX = -abz / len
  const normalZ = abx / len
  return { t, distSq: dx * dx + dz * dz, signedOffset: dx * normalX + dz * normalZ }
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

interface NearestCenterlinePoint {
  /** Squared perpendicular distance from `pos` to the nearest point on the centerline polyline (not just the nearest sample). */
  distSq: number
  /** Ring index at the start of the segment `pos` projects onto. */
  a: number
  /** Ring index at the end of that segment. */
  b: number
  /** Fraction (0..1) along the `a`→`b` segment of the closest point. */
  t: number
  /**
   * Signed perpendicular distance from `pos` to the centerline, positive to the left of
   * the direction of travel (matching `generateTrack`'s `offsetAt` side convention: side
   * `1` = left). Used to reconstruct the banked road surface's actual height under `pos`,
   * not just its height at the centerline.
   */
  signedOffset: number
}

/**
 * Finds the closest point to `pos` on the centerline treated as a connected polyline (the
 * two segments adjacent to whichever ring sample is nearest), not just the nearest sample
 * point. Sample points can be sparse relative to how sharply the path curves - most notably
 * right after the start/finish ring, where the closed-loop Catmull-Rom tangent can point the
 * first couple of samples off at an angle - so measuring distance to the nearest *sample*
 * instead of the nearest point *on the path* both under- and over-estimates how far off the
 * road a position actually is.
 */
function nearestPointOnCenterline(pos: Position2D, track: GeneratedTrack): NearestCenterlinePoint {
  const { centerline } = track
  const n = centerline.length
  const index = nearestCenterlineIndex(pos, track)
  const nextIndex = (index + 1) % n
  const prevIndex = (index - 1 + n) % n

  const forward = projectOntoSegment(pos, centerline[index], centerline[nextIndex])
  const backward = projectOntoSegment(pos, centerline[prevIndex], centerline[index])

  return forward.distSq <= backward.distSq
    ? { distSq: forward.distSq, a: index, b: nextIndex, t: forward.t, signedOffset: forward.signedOffset }
    : { distSq: backward.distSq, a: prevIndex, b: index, t: backward.t, signedOffset: backward.signedOffset }
}

/**
 * Linearly interpolates a per-ring scalar (`valueAt`) between the two centerline rings
 * straddling `pos`, rather than snapping to whichever ring is nearest - used so values that
 * vary along the track (elevation, banking) change smoothly as the car crosses ring
 * boundaries instead of stepping.
 */
function interpolateAlongCenterline(pos: Position2D, track: GeneratedTrack, valueAt: (index: number) => number): number {
  const { a, b, t } = nearestPointOnCenterline(pos, track)
  return valueAt(a) + (valueAt(b) - valueAt(a)) * t
}

function ringHalfWidth(track: GeneratedTrack, index: number): number {
  const left = track.roadMesh.positions[index * 2]
  const right = track.roadMesh.positions[index * 2 + 1]
  return Math.hypot(left.x - right.x, left.z - right.z) / 2
}

/**
 * The road surface's height directly under `pos`, smoothly interpolated between centerline
 * rings so the car/ghost mesh rises and falls continuously instead of stepping between ring
 * heights as it crosses ring boundaries.
 *
 * On a banked section the surface is *not* flat across the road's width - `generateTrack`'s
 * `offsetAt` tilts each edge up/down by `sin(bankingRad) * halfWidth` - so using the
 * centerline's own height regardless of how far `pos` actually sits from it would place the
 * car at the wrong height anywhere it isn't exactly centered (which is most of the time,
 * especially mid-corner): too low on the banked-up side, clipping into the mesh, or too high
 * over the banked-down side.
 */
export function elevationAt(pos: Position2D, track: GeneratedTrack): number {
  const { a, b, t, signedOffset } = nearestPointOnCenterline(pos, track)
  const centerlineElevation = track.centerline[a].y + (track.centerline[b].y - track.centerline[a].y) * t
  const bankingRad = track.bankingRad[a] + (track.bankingRad[b] - track.bankingRad[a]) * t
  return centerlineElevation + Math.sin(bankingRad) * signedOffset
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
 * True when `pos` lies within the road's width of the nearest point *on* the centerline
 * (not just the nearest sample - see {@link nearestPointOnCenterline}). Used each physics
 * tick to decide whether the off-track speed penalty applies.
 */
export function isOnRoadSurface(pos: Position2D, track: GeneratedTrack): boolean {
  const { distSq, a, b, t } = nearestPointOnCenterline(pos, track)
  const halfWidthA = ringHalfWidth(track, a)
  const halfWidthB = ringHalfWidth(track, b)
  const halfWidth = halfWidthA + (halfWidthB - halfWidthA) * t

  return distSq <= halfWidth * halfWidth
}
