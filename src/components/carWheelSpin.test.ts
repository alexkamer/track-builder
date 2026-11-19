import { describe, expect, it } from 'vitest'
import { advanceWheelSpin } from './carWheelSpin'
import { WHEEL_RADIUS } from './CarModel'

describe('advanceWheelSpin', () => {
  it('advances by distance travelled divided by wheel radius', () => {
    // 10 m/s for 0.5 s over a 0.5 m radius wheel = 5 m of travel = 10 radians.
    expect(advanceWheelSpin(0, 10, 0.5, 0.5)).toBeCloseTo(10, 10)
  })

  it('accumulates onto the current angle rather than replacing it', () => {
    const first = advanceWheelSpin(0, 10, 0.5, 0.1)
    expect(advanceWheelSpin(first, 10, 0.5, 0.1)).toBeCloseTo(first * 2, 10)
  })

  it('spins a larger wheel proportionally less for the same speed and time', () => {
    const small = advanceWheelSpin(0, 20, WHEEL_RADIUS, 0.2)
    const large = advanceWheelSpin(0, 20, WHEEL_RADIUS * 2, 0.2)
    expect(large).toBeCloseTo(small / 2, 10)
    expect(large).toBeLessThan(small)
  })

  it('matches the extracted low-poly wheel radius against the primitive one', () => {
    // The primitive car's wheels are 0.35; the extracted pack car's are ~0.44. Using the
    // primitive constant for the bigger wheel would overstate spin by ~26%.
    const primitive = advanceWheelSpin(0, 30, 0.35, 1)
    const lowPoly = advanceWheelSpin(0, 30, 0.44, 1)
    expect(primitive / lowPoly).toBeCloseTo(0.44 / 0.35, 6)
  })

  it('reverses when the car rolls backwards', () => {
    expect(advanceWheelSpin(0, -10, 0.5, 0.5)).toBeCloseTo(-10, 10)
  })

  it('holds the angle rather than producing NaN for a non-positive radius', () => {
    expect(advanceWheelSpin(3, 10, 0, 0.1)).toBe(3)
    expect(advanceWheelSpin(3, 10, -1, 0.1)).toBe(3)
    expect(advanceWheelSpin(3, 10, Number.NaN, 0.1)).toBe(3)
  })
})
