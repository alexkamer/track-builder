import type { TrackDocument } from '../track/schema'
import type { GeneratedTrack } from '../generation/generateTrack'
import type { CarInput } from '../physics/carPhysics'
import { createInitialCarState } from '../physics/carPhysics'
import { advanceCarTick } from '../physics/advanceCarTick'
import { createLapProgressState, tickLapProgress } from './lapTimer'
import { computeRaceGates } from './raceGates'

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/**
 * A simple cross-track-error + heading feedback autopilot used only in tests, to produce a
 * genuinely physics-valid "drives a full lap" input log without hand-crafting one. Not part
 * of the game itself - a real player steers interactively, which this stands in for here.
 */
export function driveFullLapAutopilot(
  doc: TrackDocument,
  generated: GeneratedTrack,
  maxTicks = 3000,
): CarInput[] | null {
  const { startGate, checkpointGates } = computeRaceGates(doc, generated)
  const centerline = generated.centerline
  const n = centerline.length

  function nearestIndex(x: number, z: number): number {
    let best = 0
    let bestDist = Infinity
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(centerline[i].x - x, centerline[i].z - z)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    }
    return best
  }

  let state = createInitialCarState(
    generated.spawn.position.x,
    generated.spawn.position.z,
    degToRad(generated.spawn.headingDeg),
  )
  let lapProgress = createLapProgressState()
  let prevPos = { x: state.x, z: state.z }
  const inputLog: CarInput[] = []

  const K_XTE = 0.04
  const K_HEADING = 0.6

  for (let tick = 0; tick < maxTicks; tick++) {
    const idx = nearestIndex(state.x, state.z)
    const curr = centerline[idx]
    const next = centerline[(idx + 1) % n]
    const prev = centerline[(idx - 1 + n) % n]
    const tangentX = next.x - prev.x
    const tangentZ = next.z - prev.z
    const tanLen = Math.hypot(tangentX, tangentZ) || 1
    const tangentHeading = Math.atan2(tangentX / tanLen, tangentZ / tanLen)

    const normalX = tangentZ / tanLen
    const normalZ = -tangentX / tanLen
    const crossTrackError = (state.x - curr.x) * normalX + (state.z - curr.z) * normalZ

    let headingError = tangentHeading - state.headingRad
    while (headingError > Math.PI) headingError -= Math.PI * 2
    while (headingError < -Math.PI) headingError += Math.PI * 2

    const steer = Math.max(-1, Math.min(1, K_HEADING * headingError - K_XTE * crossTrackError))
    const input: CarInput = { throttle: 0.7, brake: 0, steer }
    inputLog.push(input)

    state = advanceCarTick(state, input, 1 / 60, generated)
    const currPos = { x: state.x, z: state.z }
    lapProgress = tickLapProgress(lapProgress, startGate, checkpointGates, prevPos, currPos)
    prevPos = currPos

    if (lapProgress.lastLapTicks !== null) {
      return inputLog // spans exactly the completed lap, including the crossing tick
    }
  }

  return null
}
