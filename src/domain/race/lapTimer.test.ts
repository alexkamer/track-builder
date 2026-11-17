import { describe, expect, it } from 'vitest'
import {
  createLapProgressState,
  crossesGateForward,
  tickLapProgress,
  ticksToSeconds,
  type StartLineGate,
} from './lapTimer'

const FIXED_DT = 1 / 60

function gateAtOrigin(): StartLineGate {
  // heading 0 => forward is +z; gate spans the x axis at z=0.
  return { position: { x: 0, z: 0 }, headingRad: 0, width: 10 }
}

function gateAt(z: number): StartLineGate {
  return { position: { x: 0, z }, headingRad: 0, width: 10 }
}

describe('crossesGateForward', () => {
  it('detects a forward crossing within the gate width', () => {
    const gate = gateAtOrigin()
    expect(crossesGateForward(gate, { x: 1, z: -1 }, { x: 1, z: 1 })).toBe(true)
  })

  it('does not detect a crossing moving backward through the gate', () => {
    const gate = gateAtOrigin()
    expect(crossesGateForward(gate, { x: 1, z: 1 }, { x: 1, z: -1 })).toBe(false)
  })

  it('does not detect a crossing too far to the side of the gate', () => {
    const gate = gateAtOrigin()
    expect(crossesGateForward(gate, { x: 20, z: -1 }, { x: 20, z: 1 })).toBe(false)
  })
})

describe('tickLapProgress / lap time reproducibility (no checkpoints)', () => {
  it('records a lap time equal to the simulated ticks elapsed between two crossings', () => {
    const gate = gateAtOrigin()
    let state = createLapProgressState()

    const TICKS_BEFORE_CROSSING = 120
    const away = { x: 0, z: -5 }
    for (let i = 0; i < TICKS_BEFORE_CROSSING; i++) {
      state = tickLapProgress(state, gate, [], away, away)
    }
    expect(state.lastLapTicks).toBeNull()

    state = tickLapProgress(state, gate, [], { x: 0, z: -0.5 }, { x: 0, z: 0.5 })

    expect(state.lastLapTicks).toBe(TICKS_BEFORE_CROSSING)
    expect(ticksToSeconds(state.lastLapTicks ?? 0, FIXED_DT)).toBeCloseTo(
      ticksToSeconds(TICKS_BEFORE_CROSSING, FIXED_DT),
      5,
    )
  })

  it('ignores a crossing that happens immediately (within MIN_TICKS_BETWEEN_CROSSINGS)', () => {
    const gate = gateAtOrigin()
    let state = createLapProgressState()
    state = tickLapProgress(state, gate, [], { x: 0, z: -0.1 }, { x: 0, z: 0.1 })
    expect(state.lastLapTicks).toBeNull()
  })
})

describe('tickLapProgress checkpoint gating', () => {
  const start = gateAtOrigin()
  const checkpoints = [gateAt(50), gateAt(100)]

  function driveThroughInOrder(initialTicks = 40) {
    let state = createLapProgressState()
    // Clear the spawn-on-gate guard first.
    for (let i = 0; i < initialTicks; i++) {
      state = tickLapProgress(state, start, checkpoints, { x: 0, z: -5 }, { x: 0, z: -5 })
    }
    state = tickLapProgress(state, start, checkpoints, { x: 0, z: 49 }, { x: 0, z: 51 }) // checkpoint 1
    state = tickLapProgress(state, start, checkpoints, { x: 0, z: 99 }, { x: 0, z: 101 }) // checkpoint 2
    state = tickLapProgress(state, start, checkpoints, { x: 0, z: -0.5 }, { x: 0, z: 0.5 }) // start/finish
    return state
  }

  it('completes a lap when all checkpoints are crossed in order before the start line', () => {
    const state = driveThroughInOrder()
    expect(state.lastLapTicks).not.toBeNull()
  })

  it('does not complete a lap when a checkpoint is skipped', () => {
    let state = createLapProgressState()
    for (let i = 0; i < 40; i++) {
      state = tickLapProgress(state, start, checkpoints, { x: 0, z: -5 }, { x: 0, z: -5 })
    }
    // Skip checkpoint 1, only cross checkpoint 2, then the start line.
    state = tickLapProgress(state, start, checkpoints, { x: 0, z: 99 }, { x: 0, z: 101 })
    state = tickLapProgress(state, start, checkpoints, { x: 0, z: -0.5 }, { x: 0, z: 0.5 })

    expect(state.lastLapTicks).toBeNull()
  })

  it('does not advance past a checkpoint crossed out of order', () => {
    let state = createLapProgressState()
    for (let i = 0; i < 40; i++) {
      state = tickLapProgress(state, start, checkpoints, { x: 0, z: -5 }, { x: 0, z: -5 })
    }
    // Cross checkpoint 2's location first - since checkpoint 1 is still expected, this should not register.
    state = tickLapProgress(state, start, checkpoints, { x: 0, z: 99 }, { x: 0, z: 101 })
    expect(state.nextCheckpointIndex).toBe(0)
  })

  it('starts a new attempt at the next start-line crossing even if the previous one failed', () => {
    const failedAttempt = (() => {
      let state = createLapProgressState()
      for (let i = 0; i < 40; i++) {
        state = tickLapProgress(state, start, checkpoints, { x: 0, z: -5 }, { x: 0, z: -5 })
      }
      // Skip both checkpoints, cross the start line.
      return tickLapProgress(state, start, checkpoints, { x: 0, z: -0.5 }, { x: 0, z: 0.5 })
    })()

    expect(failedAttempt.lastLapTicks).toBeNull()
    expect(failedAttempt.nextCheckpointIndex).toBe(0) // fresh attempt, ready to hit checkpoint 1 again
  })
})
