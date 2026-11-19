import { describe, expect, it } from 'vitest'
import { tangentHeadingDeg } from './heading'

describe('tangentHeadingDeg', () => {
  it('points toward +z (0deg) when travel is along +z', () => {
    const points = [{ x: 0, z: -10 }, { x: 0, z: 0 }, { x: 0, z: 10 }]
    expect(tangentHeadingDeg(points, 1)).toBeCloseTo(0, 5)
  })

  it('points toward +x (90deg) when travel is along +x', () => {
    const points = [{ x: -10, z: 0 }, { x: 0, z: 0 }, { x: 10, z: 0 }]
    expect(tangentHeadingDeg(points, 1)).toBeCloseTo(90, 5)
  })

  it('points toward -z (180deg) when travel is along -z', () => {
    const points = [{ x: 0, z: 10 }, { x: 0, z: 0 }, { x: 0, z: -10 }]
    expect(tangentHeadingDeg(points, 1)).toBeCloseTo(180, 5)
  })

  it('points toward -x (270deg) when travel is along -x', () => {
    const points = [{ x: 10, z: 0 }, { x: 0, z: 0 }, { x: -10, z: 0 }]
    expect(tangentHeadingDeg(points, 1)).toBeCloseTo(270, 5)
  })

  it('wraps around the loop for the first and last control points', () => {
    // A closed loop: index 0's "prev" is the last point, its "next" is index 1.
    const points = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 0, z: -10 }]
    // prev = (0,-10), next = (10,0): tangent = (10,10) -> 45deg.
    expect(tangentHeadingDeg(points, 0)).toBeCloseTo(45, 5)
  })
})
