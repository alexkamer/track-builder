export interface Vec3 {
  x: number
  y: number
  z: number
}

/**
 * Catmull-Rom interpolation through four control points, treated as a closed
 * loop by the caller wrapping indices with modulo. `t` is in [0, 1] between p1 and p2.
 */
export function catmullRom1D(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t
  const t3 = t2 * t
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  )
}

function clampBetween(value: number, a: number, b: number): number {
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  return Math.min(hi, Math.max(lo, value))
}

function catmullRomPoint(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  return {
    x: catmullRom1D(p0.x, p1.x, p2.x, p3.x, t),
    // Clamped to this segment's own endpoints (unlike x/z, which are meant to curve smoothly
    // past a straight line between points): a closed-loop spline's tangent continuity can
    // make elevation overshoot past both neighboring points' declared heights near a sharp
    // change (e.g. dip below 0 just before climbing into a hill from flat ground), which
    // reads as wrong rather than as a deliberate smooth path.
    y: clampBetween(catmullRom1D(p0.y, p1.y, p2.y, p3.y, t), p1.y, p2.y),
    z: catmullRom1D(p0.z, p1.z, p2.z, p3.z, t),
  }
}

/**
 * Samples a closed Catmull-Rom curve through `points` (at least 3), producing
 * `samplesPerSegment` points between each consecutive pair, wrapping at the end
 * back to the start so the result is a seamless closed loop.
 */
export function sampleClosedCatmullRom(points: Vec3[], samplesPerSegment: number): Vec3[] {
  const n = points.length
  if (n < 3) return [...points]

  const result: Vec3[] = []
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n]
    const p1 = points[i]
    const p2 = points[(i + 1) % n]
    const p3 = points[(i + 2) % n]

    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment
      result.push(catmullRomPoint(p0, p1, p2, p3, t))
    }
  }
  return result
}

/**
 * Same closed-loop sampling as {@link sampleClosedCatmullRom}, for a single scalar per
 * control point (e.g. width, banking). Clamped to each segment's own two endpoint values for
 * the same reason as the elevation clamp in {@link catmullRomPoint} - these are authored
 * bounds (a road segment declared 10-wide shouldn't locally narrow or widen past its
 * endpoints' widths from spline overshoot).
 */
export function sampleClosedScalar(values: number[], samplesPerSegment: number): number[] {
  const n = values.length
  if (n < 3) return [...values]

  const result: number[] = []
  for (let i = 0; i < n; i++) {
    const p0 = values[(i - 1 + n) % n]
    const p1 = values[i]
    const p2 = values[(i + 1) % n]
    const p3 = values[(i + 2) % n]

    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment
      result.push(clampBetween(catmullRom1D(p0, p1, p2, p3, t), p1, p2))
    }
  }
  return result
}
