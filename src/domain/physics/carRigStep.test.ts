import { describe, expect, it } from 'vitest'
import { advanceCarRigFrame } from './carRigStep'
import { FixedTimestepAccumulator } from './fixedTimestepLoop'
import { createInitialCarState, NEUTRAL_INPUT, type CarInput } from './carPhysics'
import { createControlPoint, createTrackDocument } from '../track/schema'
import { generateTrack } from '../generation/generateTrack'

const FIXED_DT = 1 / 60
const MAX_FRAME_DELTA = 0.25

function track() {
  return generateTrack(
    createTrackDocument({
      controlPoints: [
        createControlPoint({ x: 0, z: 0, width: 10 }),
        createControlPoint({ x: 100, z: 0, width: 10 }),
        createControlPoint({ x: 100, z: 100, width: 10 }),
        createControlPoint({ x: 0, z: 100, width: 10 }),
      ],
      startLine: { controlPointIndex: 0, headingDeg: 90 },
    }),
  )
}

const THROTTLE: CarInput = { throttle: 1, brake: 0, steer: 0 }

describe('advanceCarRigFrame', () => {
  it('runs physics ticks and advances the tick counter when controllable', () => {
    const t = track()
    const accumulator = new FixedTimestepAccumulator(FIXED_DT)
    const carState = createInitialCarState(0, 0, 0)

    const result = advanceCarRigFrame({
      accumulator,
      tickCounter: 0,
      carState,
      delta: FIXED_DT * 3,
      maxFrameDelta: MAX_FRAME_DELTA,
      fixedDt: FIXED_DT,
      controllable: true,
      track: t,
      getInput: () => THROTTLE,
    })

    expect(result.tickCounter).toBe(3)
    expect(result.carState).not.toEqual(carState)
  })

  it('freezes car state and tick counter while not controllable, even across repeated frames', () => {
    const t = track()
    const accumulator = new FixedTimestepAccumulator(FIXED_DT)
    const carState = createInitialCarState(0, 0, 0)
    let tickCounter = 0
    let state = carState

    for (let i = 0; i < 10; i++) {
      const result = advanceCarRigFrame({
        accumulator,
        tickCounter,
        carState: state,
        delta: FIXED_DT * 2,
        maxFrameDelta: MAX_FRAME_DELTA,
        fixedDt: FIXED_DT,
        controllable: false,
        track: t,
        getInput: () => THROTTLE,
      })
      state = result.carState
      tickCounter = result.tickCounter
    }

    expect(tickCounter).toBe(0)
    expect(state).toEqual(carState)
  })

  it('does not run a backlog of queued ticks in one frame after becoming controllable again', () => {
    const t = track()
    const accumulator = new FixedTimestepAccumulator(FIXED_DT)
    const carState = createInitialCarState(0, 0, 0)

    // Several frames' worth of real time elapses while uncontrollable; it should be dropped, not queued.
    for (let i = 0; i < 20; i++) {
      advanceCarRigFrame({
        accumulator,
        tickCounter: 0,
        carState,
        delta: FIXED_DT * 5,
        maxFrameDelta: MAX_FRAME_DELTA,
        fixedDt: FIXED_DT,
        controllable: false,
        track: t,
        getInput: () => NEUTRAL_INPUT,
      })
    }

    const result = advanceCarRigFrame({
      accumulator,
      tickCounter: 0,
      carState,
      delta: FIXED_DT, // exactly one tick worth once controllable
      maxFrameDelta: MAX_FRAME_DELTA,
      fixedDt: FIXED_DT,
      controllable: true,
      track: t,
      getInput: () => NEUTRAL_INPUT,
    })

    expect(result.tickCounter).toBe(1)
  })
})
