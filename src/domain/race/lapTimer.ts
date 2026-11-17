export interface StartLineGate {
  position: { x: number; z: number }
  headingRad: number
  width: number
}

export interface Position2D {
  x: number
  z: number
}

/** Distance along the gate's forward (heading) direction; crossing the gate means this sign flips from - to +. */
export function signedForwardDistance(gate: StartLineGate, pos: Position2D): number {
  const forwardX = Math.sin(gate.headingRad)
  const forwardZ = Math.cos(gate.headingRad)
  return (pos.x - gate.position.x) * forwardX + (pos.z - gate.position.z) * forwardZ
}

/** Distance perpendicular to the gate's heading, used to reject crossings too far to the side of the gate. */
export function lateralOffset(gate: StartLineGate, pos: Position2D): number {
  const rightX = Math.cos(gate.headingRad)
  const rightZ = -Math.sin(gate.headingRad)
  return (pos.x - gate.position.x) * rightX + (pos.z - gate.position.z) * rightZ
}

/** True when the car moved from behind the gate to in front of it (in the gate's forward direction), within the gate's width. */
export function crossesGateForward(gate: StartLineGate, prevPos: Position2D, currPos: Position2D): boolean {
  const prevDistance = signedForwardDistance(gate, prevPos)
  const currDistance = signedForwardDistance(gate, currPos)
  if (!(prevDistance < 0 && currDistance >= 0)) return false
  const lateral = lateralOffset(gate, currPos)
  return Math.abs(lateral) <= gate.width / 2
}

/** Minimum ticks between crossings before a new one can register, so spawning on the gate doesn't immediately "complete" a lap. */
export const MIN_TICKS_BETWEEN_CROSSINGS = 30

export interface LapProgressState {
  /** Index into the ordered checkpoint gates of the next one that must be crossed. */
  nextCheckpointIndex: number
  ticksSinceLastStartCrossing: number
  lastLapTicks: number | null
}

export function createLapProgressState(): LapProgressState {
  return { nextCheckpointIndex: 0, ticksSinceLastStartCrossing: 0, lastLapTicks: null }
}

/**
 * Advances lap progress by one fixed physics tick, using the simulation clock (tick count),
 * not wall-clock time, so lap times are reproducible from the same input sequence.
 *
 * A lap only completes when the start/finish line is crossed AND every checkpoint gate was
 * crossed, in order, since the previous start-line crossing - skipping or reordering
 * checkpoints means the lap is not recorded, though a new attempt still begins at that crossing.
 */
export function tickLapProgress(
  state: LapProgressState,
  startGate: StartLineGate,
  checkpointGates: StartLineGate[],
  prevPos: Position2D,
  currPos: Position2D,
): LapProgressState {
  let nextCheckpointIndex = state.nextCheckpointIndex

  if (nextCheckpointIndex < checkpointGates.length) {
    if (crossesGateForward(checkpointGates[nextCheckpointIndex], prevPos, currPos)) {
      nextCheckpointIndex += 1
    }
  }

  const crossedStart = crossesGateForward(startGate, prevPos, currPos)
  if (crossedStart && state.ticksSinceLastStartCrossing >= MIN_TICKS_BETWEEN_CROSSINGS) {
    const allCheckpointsHit = nextCheckpointIndex >= checkpointGates.length
    return {
      nextCheckpointIndex: 0,
      ticksSinceLastStartCrossing: 0,
      lastLapTicks: allCheckpointsHit ? state.ticksSinceLastStartCrossing : state.lastLapTicks,
    }
  }

  return {
    nextCheckpointIndex,
    ticksSinceLastStartCrossing: state.ticksSinceLastStartCrossing + 1,
    lastLapTicks: state.lastLapTicks,
  }
}

export function ticksToSeconds(ticks: number, fixedDt: number): number {
  return ticks * fixedDt
}
