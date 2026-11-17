import { useMemo, useRef, useState } from 'react'
import type { TrackDocument } from '../domain/track/schema'
import type { GeneratedTrack } from '../domain/generation/generateTrack'
import type { CarInput, CarState } from '../domain/physics/carPhysics'
import { createLapProgressState, tickLapProgress, ticksToSeconds } from '../domain/race/lapTimer'
import { computeRaceGates } from '../domain/race/raceGates'

const FIXED_DT = 1 / 60

interface UseRaceSessionResult {
  liveLapSeconds: number
  lastLapSeconds: number | null
  bestLapSeconds: number | null
  ghostInputLog: CarInput[]
  handleTick: (state: CarState, tickIndex: number, input: CarInput) => void
  /** Resets the live/in-progress attempt (checkpoint progress, live lap timer) to a fresh spawn. Does not touch the tracked best lap or ghost. */
  resetAttempt: () => void
}

/** Tracks checkpoint-gated lap progress, best-lap time, and records the input log for ghost replay. */
export function useRaceSession(doc: TrackDocument, generated: GeneratedTrack): UseRaceSessionResult {
  const { startGate, checkpointGates } = useMemo(() => computeRaceGates(doc, generated), [doc, generated])

  const prevPosRef = useRef({ x: generated.spawn.position.x, z: generated.spawn.position.z })
  const lapProgressRef = useRef(createLapProgressState())
  const bestLapTicksRef = useRef<number | null>(null)
  const currentLapInputLogRef = useRef<CarInput[]>([])
  const bestLapInputLogRef = useRef<CarInput[]>([])

  const [liveTickDisplay, setLiveTickDisplay] = useState(0)
  const [lastLapSeconds, setLastLapSeconds] = useState<number | null>(null)
  const [bestLapSeconds, setBestLapSeconds] = useState<number | null>(null)
  const [ghostInputLog, setGhostInputLog] = useState<CarInput[]>([])

  const handleTick = (state: CarState, tickIndex: number, input: CarInput) => {
    const prevPos = prevPosRef.current
    const currPos = { x: state.x, z: state.z }
    const prevProgress = lapProgressRef.current
    const newProgress = tickLapProgress(prevProgress, startGate, checkpointGates, prevPos, currPos)
    prevPosRef.current = currPos

    // Push this tick's input before snapshotting/clearing, so a completed lap's saved log
    // includes the crossing tick itself - required for the log to actually re-trigger that
    // same crossing (and thus verify) when replayed standalone from the spawn point.
    currentLapInputLogRef.current.push(input)

    const completedLapThisTick = newProgress.lastLapTicks !== null && newProgress.lastLapTicks !== prevProgress.lastLapTicks
    if (completedLapThisTick) {
      const completedTicks = newProgress.lastLapTicks as number
      setLastLapSeconds(ticksToSeconds(completedTicks, FIXED_DT))
      if (bestLapTicksRef.current === null || completedTicks < bestLapTicksRef.current) {
        bestLapTicksRef.current = completedTicks
        bestLapInputLogRef.current = currentLapInputLogRef.current.slice()
        setBestLapSeconds(ticksToSeconds(completedTicks, FIXED_DT))
        setGhostInputLog(bestLapInputLogRef.current)
      }
    }

    const crossedStartThisTick = newProgress.ticksSinceLastStartCrossing === 0
    if (crossedStartThisTick) {
      currentLapInputLogRef.current = [input]
    }

    lapProgressRef.current = newProgress

    if (tickIndex % 6 === 0) {
      setLiveTickDisplay(newProgress.ticksSinceLastStartCrossing)
    }
  }

  const resetAttempt = () => {
    prevPosRef.current = { x: generated.spawn.position.x, z: generated.spawn.position.z }
    lapProgressRef.current = createLapProgressState()
    currentLapInputLogRef.current = []
    setLiveTickDisplay(0)
  }

  return {
    liveLapSeconds: ticksToSeconds(liveTickDisplay, FIXED_DT),
    lastLapSeconds,
    bestLapSeconds,
    ghostInputLog,
    handleTick,
    resetAttempt,
  }
}
