/**
 * The direction of travel at `controlPoints[index]`, derived from the Catmull-Rom curve's
 * exact analytic tangent there - `0.5 * (next - prev)`, the derivative of `catmullRom1D` at
 * `t = 0` (see spline.ts) - rather than the straight line to either neighboring point, which
 * can point noticeably away from the curve's actual direction near a sharp bend.
 *
 * Returned in the heading convention used throughout the physics/rendering code: 0° points
 * toward +z, 90° toward +x (forward = `(sin(heading), cos(heading))` - see carPhysics.ts).
 */
export function tangentHeadingDeg(controlPoints: { x: number; z: number }[], index: number): number {
  const n = controlPoints.length
  const prev = controlPoints[(index - 1 + n) % n]
  const next = controlPoints[(index + 1) % n]
  const tangentX = next.x - prev.x
  const tangentZ = next.z - prev.z
  return ((Math.atan2(tangentX, tangentZ) * 180) / Math.PI + 360) % 360
}
