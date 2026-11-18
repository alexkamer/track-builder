import { describe, expect, it } from 'vitest'
import {
  achievableTurnRadius,
  createInitialCarState,
  DEFAULT_CAR_PARAMS,
  interpolateCarState,
  NEUTRAL_INPUT,
  stepCarPhysics,
  type CarInput,
  type CarState,
} from './carPhysics'
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

describe('achievableTurnRadius', () => {
  it('matches maxSpeed / baseTurnRate for the given params', () => {
    expect(achievableTurnRadius(DEFAULT_CAR_PARAMS)).toBeCloseTo(
      DEFAULT_CAR_PARAMS.maxSpeed / DEFAULT_CAR_PARAMS.baseTurnRate,
      10,
    )
  })

  it('defaults to DEFAULT_CAR_PARAMS when no params are given', () => {
    expect(achievableTurnRadius()).toBeCloseTo(achievableTurnRadius(DEFAULT_CAR_PARAMS), 10)
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

  it('still lets the car accelerate to a meaningful speed while continuously off-track', () => {
    // Regression guard: offTrackDecay must stay low enough that full throttle off-track still
    // climbs well above a crawl. A too-harsh value combined with turn rate scaling with speed
    // creates a self-reinforcing trap (slower -> less turn authority -> can't steer back onto
    // a curving road -> stays off-track) that reads as "the car never goes fast".
    let state = createInitialCarState(0, 0, 0)
    for (let i = 0; i < 300; i++) {
      state = stepCarPhysics(state, { throttle: 1, brake: 0, steer: 0 }, FIXED_DT, undefined, true)
    }
    expect(state.speed).toBeGreaterThan(DEFAULT_CAR_PARAMS.maxSpeed * 0.3)
  })
})

describe('interpolateCarState', () => {
  const prev: CarState = { x: 0, z: 0, headingRad: 0, speed: 10, lateralSlip: 0 }
  const next: CarState = { x: 10, z: 20, headingRad: Math.PI / 2, speed: 12, lateralSlip: 1 }

  it('returns prev at alpha 0 and next at alpha 1', () => {
    expect(interpolateCarState(prev, next, 0)).toEqual({ ...prev, speed: next.speed, lateralSlip: next.lateralSlip })
    expect(interpolateCarState(prev, next, 1)).toEqual(next)
  })

  it('linearly blends position at a midpoint alpha', () => {
    const mid = interpolateCarState(prev, next, 0.5)
    expect(mid.x).toBeCloseTo(5, 10)
    expect(mid.z).toBeCloseTo(10, 10)
    expect(mid.headingRad).toBeCloseTo(Math.PI / 4, 10)
  })

  it('takes the shorter way around when heading wraps past +-pi', () => {
    const wrapPrev: CarState = { ...prev, headingRad: Math.PI - 0.1 }
    const wrapNext: CarState = { ...next, headingRad: -Math.PI + 0.1 }
    const mid = interpolateCarState(wrapPrev, wrapNext, 0.5)
    // Going the short way (through +-pi), the midpoint heading is exactly +-pi.
    expect(Math.abs(mid.headingRad)).toBeCloseTo(Math.PI, 5)
  })
})
