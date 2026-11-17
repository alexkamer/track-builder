import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { Mesh } from 'three'
import type { CarInput, CarState } from '../domain/physics/carPhysics'
import { createInitialCarState, NEUTRAL_INPUT } from '../domain/physics/carPhysics'
import { FixedTimestepAccumulator } from '../domain/physics/fixedTimestepLoop'
import { advanceCarTick } from '../domain/physics/advanceCarTick'
import type { GeneratedTrack } from '../domain/generation/generateTrack'
import type { SpawnTransform } from '../domain/generation/generateTrack'

const FIXED_DT = 1 / 60
const MAX_FRAME_DELTA = 0.25

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
  const meshRef = useRef<Mesh>(null)
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
    if (meshRef.current) {
      meshRef.current.position.set(stateRef.current.x, spawn.position.y + 0.6, stateRef.current.z)
      meshRef.current.rotation.y = stateRef.current.headingRad
    }
  })

  if (inputLog.length === 0) return null

  return (
    <mesh ref={meshRef} data-testid="ghost-mesh">
      <boxGeometry args={[2, 1, 4]} />
      <meshStandardMaterial color="#4ea8de" transparent opacity={0.45} />
    </mesh>
  )
}
