import { describe, expect, it } from 'vitest'
import { sampleClosedCatmullRom, sampleClosedScalar } from './spline'

describe('sampleClosedCatmullRom', () => {
  it('closes the loop: the curve returns to its starting region', () => {
    const points = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
      { x: 10, y: 0, z: 10 },
      { x: 0, y: 0, z: 10 },
    ]
    const samples = sampleClosedCatmullRom(points, 8)
    // Exactly samplesPerSegment * numControlPoints samples, no seam gap: the
    // sample after the last wraps conceptually back to sample 0.
    expect(samples).toHaveLength(8 * points.length)

    const first = samples[0]
    const last = samples[samples.length - 1]
    // last sample should be close to control point 0 (since segment 3 ends approaching point 0)
    const dist = Math.hypot(last.x - first.x, last.z - first.z)
    expect(dist).toBeLessThan(15)
  })

  it('returns the points unchanged when fewer than 3 are given', () => {
    const points = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
    ]
    expect(sampleClosedCatmullRom(points, 8)).toEqual(points)
  })

  it('never lets elevation (y) overshoot past its two neighboring control points, even right next to a sharp climb', () => {
    // A closed loop that's flat (y=0) everywhere except one point that climbs sharply - the
    // kind of layout that previously made the curve dip below 0 approaching the climb, purely
    // from spline tangent continuity, even though no control point is below 0.
    const points = [
      { x: 0, y: 0, z: 0 },
      { x: 100, y: 20, z: 0 },
      { x: 200, y: 0, z: 0 },
      { x: 100, y: 0, z: 100 },
    ]
    const samples = sampleClosedCatmullRom(points, 16)
    for (const s of samples) {
      expect(s.y).toBeGreaterThanOrEqual(0)
      expect(s.y).toBeLessThanOrEqual(20)
    }
  })

  it('does not clamp x/z, which are allowed to curve smoothly past a straight line between points', () => {
    const points = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
      { x: 10, y: 0, z: 10 },
      { x: 0, y: 0, z: 10 },
    ]
    const samples = sampleClosedCatmullRom(points, 16)
    // Somewhere along the curve, x or z must stray outside [0,10] - confirms x/z sampling
    // isn't being clamped the way y now is (a smooth closed loop through these corners
    // necessarily bows slightly outside the square they form).
    const strays = samples.some((s) => s.x < -0.01 || s.x > 10.01 || s.z < -0.01 || s.z > 10.01)
    expect(strays).toBe(true)
  })
})

describe('sampleClosedScalar', () => {
  it('never overshoots past its two neighboring values', () => {
    const values = [10, 10, 30, 10]
    const samples = sampleClosedScalar(values, 16)
    for (const v of samples) {
      expect(v).toBeGreaterThanOrEqual(10)
      expect(v).toBeLessThanOrEqual(30)
    }
  })
})
