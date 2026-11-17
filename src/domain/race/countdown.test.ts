import { describe, expect, it } from 'vitest'
import { createCountdownState, isControllable, tickCountdown } from './countdown'

describe('countdown', () => {
  it('starts at phase 3 and is not controllable', () => {
    const state = createCountdownState()
    expect(state.phase).toBe(3)
    expect(isControllable(state.phase)).toBe(false)
  })

  it('advances through 3 -> 2 -> 1 -> GO -> null at one-second intervals', () => {
    let state = createCountdownState()

    state = tickCountdown(state, 1)
    expect(state.phase).toBe(2)

    state = tickCountdown(state, 1)
    expect(state.phase).toBe(1)

    state = tickCountdown(state, 1)
    expect(state.phase).toBe('go')

    state = tickCountdown(state, 1)
    expect(state.phase).toBeNull()
    expect(isControllable(state.phase)).toBe(true)
  })

  it('does not advance before a full second has elapsed in the current phase', () => {
    let state = createCountdownState()
    state = tickCountdown(state, 0.5)
    expect(state.phase).toBe(3)
    state = tickCountdown(state, 0.4)
    expect(state.phase).toBe(3)
    state = tickCountdown(state, 0.1)
    expect(state.phase).toBe(2)
  })

  it('carries over leftover time across a phase boundary instead of dropping it', () => {
    let state = createCountdownState()
    state = tickCountdown(state, 1.3)
    expect(state.phase).toBe(2)
    expect(state.elapsedInPhaseSeconds).toBeCloseTo(0.3)
  })

  it('can skip multiple phases in a single large delta (e.g. a stalled tab resuming)', () => {
    const state = tickCountdown(createCountdownState(), 10)
    expect(state.phase).toBeNull()
  })

  it('stays null once finished, regardless of further ticks', () => {
    let state = createCountdownState()
    state = tickCountdown(state, 10)
    expect(state.phase).toBeNull()
    state = tickCountdown(state, 5)
    expect(state.phase).toBeNull()
    expect(state.elapsedInPhaseSeconds).toBe(0)
  })
})
