import type { GeneratedTrack } from '../generation/generateTrack'

export interface Position2D {
  x: number
  z: number
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
