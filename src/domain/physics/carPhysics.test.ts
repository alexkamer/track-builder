import { describe, expect, it } from 'vitest'
import { createInitialCarState, NEUTRAL_INPUT, stepCarPhysics, type CarInput } from './carPhysics'
import { runFixedTimestepSimulation } from './fixedTimestepLoop'

const FIXED_DT = 1 / 60

describe('stepCarPhysics determinism', () => {
  it('produces identical state sequences for identical input sequences', () => {
    const inputs: CarInput[] = [
      { throttle: 1, brake: 0, steer: 0 },
      { throttle: 1, brake: 0, steer: 0.5 },
      { throttle: 0.5, brake: 0, steer: 0.5 },
      { throttle: 0, brake: 1, steer: -0.3 },
      { throttle: 0, brake: 0, steer: 0 },
    ]

    const first = runFixedTimestepSimulation(createInitialCarState(), inputs, stepCarPhysics, FIXED_DT)
    const second = runFixedTimestepSimulation(createInitialCarState(), inputs, stepCarPhysics, FIXED_DT)

    expect(second).toEqual(first)
  })
})

describe('stepCarPhysics behavior', () => {
  it('accelerates forward under throttle', () => {
    const state = stepCarPhysics(createInitialCarState(), { throttle: 1, brake: 0, steer: 0 }, FIXED_DT)
    expect(state.speed).toBeGreaterThan(0)
  })

  it('decelerates under brake while moving', () => {
    let state = createInitialCarState()
    for (let i = 0; i < 30; i++) {
      state = stepCarPhysics(state, { throttle: 1, brake: 0, steer: 0 }, FIXED_DT)
    }
    const movingSpeed = state.speed
    expect(movingSpeed).toBeGreaterThan(0)

    state = stepCarPhysics(state, { throttle: 0, brake: 1, steer: 0 }, FIXED_DT)
    expect(state.speed).toBeLessThan(movingSpeed)
  })

  it('turns heading under steering input while moving, and not at a standstill', () => {
    let moving = createInitialCarState()
    for (let i = 0; i < 30; i++) {
      moving = stepCarPhysics(moving, { throttle: 1, brake: 0, steer: 0 }, FIXED_DT)
    }
    const steered = stepCarPhysics(moving, { throttle: 0, brake: 0, steer: 1 }, FIXED_DT)
    expect(steered.headingRad).not.toBeCloseTo(moving.headingRad, 5)

    const standstill = createInitialCarState()
    const stillSteered = stepCarPhysics(standstill, { throttle: 0, brake: 0, steer: 1 }, FIXED_DT)
    expect(stillSteered.headingRad).toBeCloseTo(standstill.headingRad, 5)
  })

  it('does not move under neutral input from a standstill', () => {
    const state = stepCarPhysics(createInitialCarState(), NEUTRAL_INPUT, FIXED_DT)
    expect(state.x).toBeCloseTo(0, 5)
    expect(state.z).toBeCloseTo(0, 5)
    expect(state.speed).toBeCloseTo(0, 5)
  })
})

function driveUpToSpeed(ticks: number): ReturnType<typeof createInitialCarState> {
  let state = createInitialCarState()
  for (let i = 0; i < ticks; i++) {
    state = stepCarPhysics(state, { throttle: 1, brake: 0, steer: 0 }, FIXED_DT)
  }
  return state
}

describe('stepCarPhysics grip/drift', () => {
  it('builds up lateral slip under sharp steering at speed', () => {
    let state = driveUpToSpeed(90) // get up to a decent speed first
    for (let i = 0; i < 10; i++) {
      state = stepCarPhysics(state, { throttle: 0, brake: 0, steer: 1 }, FIXED_DT)
    }
    expect(Math.abs(state.lateralSlip)).toBeGreaterThan(0.5)
  })

  it('keeps lateral slip minimal under gentle steering at speed', () => {
    let state = driveUpToSpeed(90)
    for (let i = 0; i < 10; i++) {
      state = stepCarPhysics(state, { throttle: 0, brake: 0, steer: 0.1 }, FIXED_DT)
    }
    expect(Math.abs(state.lateralSlip)).toBeLessThan(0.5)
  })

  it('keeps lateral slip at zero when steering sharply from a standstill', () => {
    let state = createInitialCarState()
    for (let i = 0; i < 10; i++) {
      state = stepCarPhysics(state, { throttle: 0, brake: 0, steer: 1 }, FIXED_DT)
    }
    expect(state.lateralSlip).toBeCloseTo(0, 5)
  })

  it('makes the actual path diverge from a slip-free turn under hard steering at speed', () => {
    // With drift: lateral slip translates the car sideways in addition to the heading-based motion.
    let withDrift = driveUpToSpeed(90)
    for (let i = 0; i < 20; i++) {
      withDrift = stepCarPhysics(withDrift, { throttle: 0.3, brake: 0, steer: 1 }, FIXED_DT)
    }
    // A pure "no-drift" path would only move along the heading direction (sin/cos of heading) at `speed`.
    // Reconstruct that slip-free trajectory from the same input sequence for comparison.
    let noDrift = driveUpToSpeed(90)
    const noDriftParams = {
      acceleration: 20,
      brakeDeceleration: 30,
      drag: 0.6,
      maxSpeed: 40,
      maxReverseSpeed: -12,
      baseTurnRate: 2.2,
      maxLateralSlip: 0, // disable drift entirely
      gripResponseRate: 6,
      offTrackDecay: 2.5,
    }
    for (let i = 0; i < 20; i++) {
      noDrift = stepCarPhysics(noDrift, { throttle: 0.3, brake: 0, steer: 1 }, FIXED_DT, noDriftParams)
    }

    const dist = Math.hypot(withDrift.x - noDrift.x, withDrift.z - noDrift.z)
    expect(dist).toBeGreaterThan(0.1)
  })
})

describe('stepCarPhysics off-track penalty', () => {
  it('decays speed faster while off-track than on-track', () => {
    const onTrack = stepCarPhysics(driveUpToSpeed(90), NEUTRAL_INPUT, FIXED_DT, undefined, false)
    const offTrack = stepCarPhysics(driveUpToSpeed(90), NEUTRAL_INPUT, FIXED_DT, undefined, true)
    expect(offTrack.speed).toBeLessThan(onTrack.speed)
  })

  it('applies no extra penalty when on-track (isOffTrack defaults to false)', () => {
    const withDefault = stepCarPhysics(driveUpToSpeed(90), NEUTRAL_INPUT, FIXED_DT)
    const explicitOnTrack = stepCarPhysics(driveUpToSpeed(90), NEUTRAL_INPUT, FIXED_DT, undefined, false)
    expect(withDefault).toEqual(explicitOnTrack)
  })
})
