import { describe, expect, it } from 'vitest'
import { sampleClosedCatmullRom } from './spline'

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
})
