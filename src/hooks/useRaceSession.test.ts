import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useRaceSession } from './useRaceSession'
import { createControlPoint, createTrackDocument } from '../domain/track/schema'
import { generateTrack } from '../domain/generation/generateTrack'
import { computeRaceGates } from '../domain/race/raceGates'
import type { CarState } from '../domain/physics/carPhysics'
import type { StartLineGate } from '../domain/race/lapTimer'

function squareTrackWithCheckpoints() {
  return createTrackDocument({
    controlPoints: [
      createControlPoint({ x: 60, z: 60, width: 10 }),
      createControlPoint({ x: 400, z: 60, width: 10 }),
      createControlPoint({ x: 400, z: 400, width: 10 }),
      createControlPoint({ x: 60, z: 400, width: 10 }),
    ],
    startLine: { controlPointIndex: 0, headingDeg: 90 },
    checkpoints: [{ controlPointIndex: 1 }, { controlPointIndex: 2 }],
  })
}

function fakeState(x: number, z: number): CarState {
  return { x, z, headingRad: 0, speed: 0, lateralSlip: 0 }
}

const NEUTRAL = { throttle: 1, brake: 0, steer: 0 }

/**
 * Drives explicitly from just-behind to just-after `gate` across two ticks, so the crossing
 * is detected regardless of where the car was before (matching how an approach actually works -
 * see domain/race/lapTimer's crossesGateForward, which needs prevPos behind and currPos ahead).
 */
function crossGate(
  handleTick: (state: CarState, tickIndex: number, input: typeof NEUTRAL) => void,
  gate: StartLineGate,
  tickIndex: number,
) {
  const fwd = { x: Math.sin(gate.headingRad), z: Math.cos(gate.headingRad) }
  const before = { x: gate.position.x - fwd.x, z: gate.position.z - fwd.z }
  const after = { x: gate.position.x + fwd.x, z: gate.position.z + fwd.z }
  handleTick(fakeState(before.x, before.z), tickIndex, NEUTRAL)
  handleTick(fakeState(after.x, after.z), tickIndex + 1, NEUTRAL)
}

describe('useRaceSession', () => {
  it('completes a lap and records a best lap when all gates are crossed in order', () => {
    const doc = squareTrackWithCheckpoints()
    const generated = generateTrack(doc)
    const { result } = renderHook(() => useRaceSession(doc, generated))
    const { startGate, checkpointGates } = computeRaceGates(doc, generated)

    act(() => {
      for (let i = 0; i < 40; i++) {
        result.current.handleTick(fakeState(startGate.position.x, startGate.position.z), i, NEUTRAL)
      }
      crossGate(result.current.handleTick, checkpointGates[0], 41)
      crossGate(result.current.handleTick, checkpointGates[1], 43)
      crossGate(result.current.handleTick, startGate, 45)
    })

    expect(result.current.lastLapSeconds).not.toBeNull()
    expect(result.current.bestLapSeconds).not.toBeNull()
    expect(result.current.ghostInputLog.length).toBeGreaterThan(0)
  })

  it('does not complete a lap when a checkpoint is skipped', () => {
    const doc = squareTrackWithCheckpoints()
    const generated = generateTrack(doc)
    const { result } = renderHook(() => useRaceSession(doc, generated))
    const { startGate, checkpointGates } = computeRaceGates(doc, generated)

    act(() => {
      for (let i = 0; i < 40; i++) {
        result.current.handleTick(fakeState(startGate.position.x, startGate.position.z), i, NEUTRAL)
      }
      // Only cross checkpoint 1, skip checkpoint 0, then cross the start line.
      crossGate(result.current.handleTick, checkpointGates[1], 41)
      crossGate(result.current.handleTick, startGate, 43)
    })

    expect(result.current.lastLapSeconds).toBeNull()
    expect(result.current.bestLapSeconds).toBeNull()
  })

  it('does not replace the best lap with a slower one', () => {
    const doc = squareTrackWithCheckpoints()
    const generated = generateTrack(doc)
    const { result } = renderHook(() => useRaceSession(doc, generated))
    const { startGate, checkpointGates } = computeRaceGates(doc, generated)

    act(() => {
      for (let i = 0; i < 40; i++) {
        result.current.handleTick(fakeState(startGate.position.x, startGate.position.z), i, NEUTRAL)
      }
      // Fast lap: gates crossed soon after the warmup.
      crossGate(result.current.handleTick, checkpointGates[0], 41)
      crossGate(result.current.handleTick, checkpointGates[1], 43)
      crossGate(result.current.handleTick, startGate, 45)
    })
    const firstBest = result.current.bestLapSeconds
    expect(firstBest).not.toBeNull()

    act(() => {
      // Slow lap: many idle ticks before reaching the same gates again.
      let tick = 200
      for (let i = 0; i < 300; i++, tick++) {
        result.current.handleTick(fakeState(startGate.position.x, startGate.position.z - 1), tick, {
          throttle: 0,
          brake: 0,
          steer: 0,
        })
      }
      crossGate(result.current.handleTick, checkpointGates[0], tick)
      tick += 2
      crossGate(result.current.handleTick, checkpointGates[1], tick)
      tick += 2
      crossGate(result.current.handleTick, startGate, tick)
    })

    expect(result.current.lastLapSeconds).not.toBeNull()
    expect(result.current.bestLapSeconds).toBe(firstBest) // unchanged - the slower lap didn't overwrite it
  })

  it('resetAttempt clears live lap progress but preserves best lap and ghost', () => {
    const doc = squareTrackWithCheckpoints()
    const generated = generateTrack(doc)
    const { result } = renderHook(() => useRaceSession(doc, generated))
    const { startGate, checkpointGates } = computeRaceGates(doc, generated)

    act(() => {
      for (let i = 0; i < 40; i++) {
        result.current.handleTick(fakeState(startGate.position.x, startGate.position.z), i, NEUTRAL)
      }
      crossGate(result.current.handleTick, checkpointGates[0], 41)
      crossGate(result.current.handleTick, checkpointGates[1], 43)
      crossGate(result.current.handleTick, startGate, 45)
    })
    const bestBefore = result.current.bestLapSeconds
    const ghostBefore = result.current.ghostInputLog
    expect(bestBefore).not.toBeNull()

    act(() => {
      result.current.resetAttempt()
    })

    expect(result.current.liveLapSeconds).toBe(0)
    expect(result.current.bestLapSeconds).toBe(bestBefore)
    expect(result.current.ghostInputLog).toBe(ghostBefore)
  })

  it('resetAttempt drops in-progress checkpoint sequence so a stale crossing cannot complete a lap', () => {
    const doc = squareTrackWithCheckpoints()
    const generated = generateTrack(doc)
    const { result } = renderHook(() => useRaceSession(doc, generated))
    const { startGate, checkpointGates } = computeRaceGates(doc, generated)

    act(() => {
      for (let i = 0; i < 40; i++) {
        result.current.handleTick(fakeState(startGate.position.x, startGate.position.z), i, NEUTRAL)
      }
      // Cross both checkpoints, then reset before crossing the start line.
      crossGate(result.current.handleTick, checkpointGates[0], 41)
      crossGate(result.current.handleTick, checkpointGates[1], 43)
      result.current.resetAttempt()
      // Crossing the start line now should not complete a lap, since checkpoint progress was reset.
      crossGate(result.current.handleTick, startGate, 45)
    })

    expect(result.current.lastLapSeconds).toBeNull()

    act(() => {
      // Warm up past MIN_TICKS_BETWEEN_CROSSINGS again before attempting the next valid lap.
      for (let i = 0; i < 40; i++) {
        result.current.handleTick(fakeState(startGate.position.x, startGate.position.z), 50 + i, NEUTRAL)
      }
      // A full, valid lap after the reset should still complete normally.
      crossGate(result.current.handleTick, checkpointGates[0], 100)
      crossGate(result.current.handleTick, checkpointGates[1], 102)
      crossGate(result.current.handleTick, startGate, 104)
    })

    expect(result.current.lastLapSeconds).not.toBeNull()
  })
})
