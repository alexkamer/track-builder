import type { TrackDocument } from '../track/schema'
import type { GeneratedTrack } from '../generation/generateTrack'
import type { CarInput } from '../physics/carPhysics'
import { createInitialCarState } from '../physics/carPhysics'
import { advanceCarTick } from '../physics/advanceCarTick'
import { createLapProgressState, tickLapProgress } from './lapTimer'
import { computeRaceGates } from './raceGates'

export const FIXED_DT = 1 / 60

export interface ReplayResult {
  /** True when the input log, replayed from the spawn point, completes at least one valid lap. */
  valid: boolean
  /** The most recently completed lap's duration in ticks, authoritative (server/replay-computed, not client-claimed). */
  lapTicks: number | null
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/**
 * Re-simulates `inputLog` from the track's spawn point using the same deterministic step
 * used live (see design.md's determinism decision), and reports whether it completes a
 * valid lap. Used both to sanity-check a ghost locally and to verify a submitted lap time
 * server-side without trusting the client's claimed time.
 */
export function replayInputLog(doc: TrackDocument, generated: GeneratedTrack, inputLog: CarInput[]): ReplayResult {
  const { startGate, checkpointGates } = computeRaceGates(doc, generated)

  let carState = createInitialCarState(
    generated.spawn.position.x,
    generated.spawn.position.z,
    degToRad(generated.spawn.headingDeg),
  )
  let lapProgress = createLapProgressState()
  let prevPos = { x: carState.x, z: carState.z }

  for (const input of inputLog) {
    carState = advanceCarTick(carState, input, FIXED_DT, generated)
    const currPos = { x: carState.x, z: carState.z }
    lapProgress = tickLapProgress(lapProgress, startGate, checkpointGates, prevPos, currPos)
    prevPos = currPos
  }

  return { valid: lapProgress.lastLapTicks !== null, lapTicks: lapProgress.lastLapTicks }
}
