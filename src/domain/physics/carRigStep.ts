import type { CarInput, CarState } from './carPhysics'
import { advanceCarTick } from './advanceCarTick'
import type { FixedTimestepAccumulator } from './fixedTimestepLoop'
import type { GeneratedTrack } from '../generation/generateTrack'

export interface CarRigFrameParams {
  accumulator: FixedTimestepAccumulator
  tickCounter: number
  carState: CarState
  /** Real seconds elapsed this render frame. */
  delta: number
  maxFrameDelta: number
  fixedDt: number
  /** Whether physics ticks are allowed to run this frame; while false, accumulated time is consumed and dropped rather than queued. */
  controllable: boolean
  track: GeneratedTrack
  /** Called once per fixed tick to get the input for that tick (e.g. merged keyboard/gamepad input read fresh). */
  getInput: () => CarInput
  onTick?: (state: CarState, tickIndex: number, input: CarInput) => void
}

export interface CarRigFrameResult {
  carState: CarState
  tickCounter: number
}

/**
 * Advances one render frame's worth of fixed-timestep car physics. When not controllable,
 * the accumulator still consumes the elapsed time (so it doesn't desync from the clock), but
 * the resulting ticks are discarded instead of being queued up and run once control resumes.
 */
export function advanceCarRigFrame(params: CarRigFrameParams): CarRigFrameResult {
  const { accumulator, delta, maxFrameDelta, controllable, carState, fixedDt, track, getInput, onTick } = params
  const ticks = accumulator.consume(Math.min(delta, maxFrameDelta))

  if (!controllable) {
    return { carState, tickCounter: params.tickCounter }
  }

  let state = carState
  let tickCounter = params.tickCounter
  for (let i = 0; i < ticks; i++) {
    const input = getInput()
    state = advanceCarTick(state, input, fixedDt, track)
    tickCounter += 1
    onTick?.(state, tickCounter, input)
  }
  return { carState: state, tickCounter }
}
