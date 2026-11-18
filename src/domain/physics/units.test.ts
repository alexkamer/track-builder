import { describe, expect, it } from 'vitest'
import { unitsPerSecondToMph } from './units'

describe('unitsPerSecondToMph', () => {
  it('converts a positive speed', () => {
    expect(unitsPerSecondToMph(10)).toBeCloseTo(22.3694, 3)
  })

  it('is 0 at a standstill', () => {
    expect(unitsPerSecondToMph(0)).toBe(0)
  })

  it('reports a positive mph for reverse (negative) speed', () => {
    expect(unitsPerSecondToMph(-10)).toBeCloseTo(22.3694, 3)
  })
})
