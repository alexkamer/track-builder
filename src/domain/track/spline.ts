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

function catmullRomPoint(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  return {
    x: catmullRom1D(p0.x, p1.x, p2.x, p3.x, t),
    y: catmullRom1D(p0.y, p1.y, p2.y, p3.y, t),
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

/** Same closed-loop sampling as {@link sampleClosedCatmullRom}, for a single scalar per control point (e.g. width, banking). */
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
      result.push(catmullRom1D(p0, p1, p2, p3, t))
    }
  }
  return result
}
