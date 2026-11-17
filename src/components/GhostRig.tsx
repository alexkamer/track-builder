import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { Group } from 'three'
import type { CarInput, CarState } from '../domain/physics/carPhysics'
import { createInitialCarState, interpolateCarState, NEUTRAL_INPUT } from '../domain/physics/carPhysics'
import { FixedTimestepAccumulator } from '../domain/physics/fixedTimestepLoop'
import { advanceCarTick } from '../domain/physics/advanceCarTick'
import { elevationAt } from '../domain/physics/trackSurface'
import type { GeneratedTrack } from '../domain/generation/generateTrack'
import type { SpawnTransform } from '../domain/generation/generateTrack'
import { CarModel } from './CarModel'

const FIXED_DT = 1 / 60
const MAX_FRAME_DELTA = 0.25
/** Small clearance above the road surface so the ghost's wheels don't z-fight with the road mesh. */
const GHOST_HEIGHT_OFFSET = 0.02

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}

interface GhostRigProps {
  spawn: SpawnTransform
  /** The recorded best-lap input sequence, one entry per fixed tick. Replays on a loop. */
  inputLog: CarInput[]
  track: GeneratedTrack
}

/** Replays a recorded input log through the same deterministic step used by the live car, looping. */
export function GhostRig({ spawn, inputLog, track }: GhostRigProps) {
  const groupRef = useRef<Group>(null)
  const stateRef = useRef<CarState>(
    createInitialCarState(spawn.position.x, spawn.position.z, degToRad(spawn.headingDeg)),
  )
  const accumulatorRef = useRef(new FixedTimestepAccumulator(FIXED_DT))
  const tickIndexRef = useRef(0)

  // Restart the loop cleanly whenever a new best lap is recorded (a different, usually shorter, log).
  useEffect(() => {
    stateRef.current = createInitialCarState(spawn.position.x, spawn.position.z, degToRad(spawn.headingDeg))
    tickIndexRef.current = 0
  }, [inputLog, spawn])

  useFrame((_, delta) => {
    if (inputLog.length === 0) return
    const prevState = stateRef.current
    const ticks = accumulatorRef.current.consume(Math.min(delta, MAX_FRAME_DELTA))
    for (let i = 0; i < ticks; i++) {
      const input = inputLog[tickIndexRef.current] ?? NEUTRAL_INPUT
      stateRef.current = advanceCarTick(stateRef.current, input, FIXED_DT, track)
      tickIndexRef.current += 1
      if (tickIndexRef.current >= inputLog.length) {
        tickIndexRef.current = 0
        stateRef.current = createInitialCarState(spawn.position.x, spawn.position.z, degToRad(spawn.headingDeg))
      }
    }
    if (groupRef.current) {
      const renderState = interpolateCarState(prevState, stateRef.current, accumulatorRef.current.alpha)
      const roadY = elevationAt(renderState, track)
      groupRef.current.position.set(renderState.x, roadY + GHOST_HEIGHT_OFFSET, renderState.z)
      groupRef.current.rotation.y = renderState.headingRad
    }
  })

  if (inputLog.length === 0) return null

  return (
    <group ref={groupRef} data-testid="ghost-mesh">
      <CarModel color="#4ea8de" opacity={0.45} />
    </group>
  )
}
