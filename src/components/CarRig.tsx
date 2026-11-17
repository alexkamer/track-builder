import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Mesh } from 'three'
import type { RefObject } from 'react'
import type { CarInput, CarState } from '../domain/physics/carPhysics'
import { FixedTimestepAccumulator } from '../domain/physics/fixedTimestepLoop'
import { advanceCarTick } from '../domain/physics/advanceCarTick'
import { mergeCarInputs, readGamepadInput } from '../domain/physics/gamepadInput'
import type { GeneratedTrack } from '../domain/generation/generateTrack'

export const FIXED_DT = 1 / 60
/** Caps the ticks run in a single frame so a stalled tab doesn't fast-forward the simulation. */
const MAX_FRAME_DELTA = 0.25

interface CarRigProps {
  /** Mutated in place each tick so camera rigs and HUDs can read the same state without re-rendering React. */
  carStateRef: RefObject<CarState>
  spawnY: number
  inputRef: RefObject<CarInput>
  track: GeneratedTrack
  /** Called once per fixed physics tick with the resulting state and the input used - used by lap timing, ghosts, etc. */
  onTick?: (state: CarState, tickIndex: number, input: CarInput) => void
}

export function CarRig({ carStateRef, spawnY, inputRef, track, onTick }: CarRigProps) {
  const meshRef = useRef<Mesh>(null)
  const accumulatorRef = useRef(new FixedTimestepAccumulator(FIXED_DT))
  const tickCounterRef = useRef(0)

  useFrame((_, delta) => {
    const ticks = accumulatorRef.current.consume(Math.min(delta, MAX_FRAME_DELTA))
    for (let i = 0; i < ticks; i++) {
      const combinedInput = mergeCarInputs(inputRef.current, readGamepadInput())
      carStateRef.current = advanceCarTick(carStateRef.current, combinedInput, FIXED_DT, track)
      tickCounterRef.current += 1
      onTick?.(carStateRef.current, tickCounterRef.current, combinedInput)
    }
    if (meshRef.current) {
      meshRef.current.position.set(carStateRef.current.x, spawnY + 0.6, carStateRef.current.z)
      meshRef.current.rotation.y = carStateRef.current.headingRad
    }
  })

  return (
    <mesh ref={meshRef} data-testid="car-mesh">
      <boxGeometry args={[2, 1, 4]} />
      <meshStandardMaterial color="#ffd166" />
    </mesh>
  )
}
