import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { Mesh } from 'three'
import type { RefObject } from 'react'
import type { CarInput, CarState } from '../domain/physics/carPhysics'
import { FixedTimestepAccumulator } from '../domain/physics/fixedTimestepLoop'
import { advanceCarRigFrame } from '../domain/physics/carRigStep'
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
  /** While false, physics ticks are withheld entirely (e.g. during the pre-race countdown). */
  controllable?: boolean
  /** Bump to re-initialize the fixed-timestep accumulator and tick counter (e.g. on a mid-race restart). */
  resetToken?: number
  /** Called once per fixed physics tick with the resulting state and the input used - used by lap timing, ghosts, etc. */
  onTick?: (state: CarState, tickIndex: number, input: CarInput) => void
}

export function CarRig({
  carStateRef,
  spawnY,
  inputRef,
  track,
  controllable = true,
  resetToken,
  onTick,
}: CarRigProps) {
  const meshRef = useRef<Mesh>(null)
  const accumulatorRef = useRef(new FixedTimestepAccumulator(FIXED_DT))
  const tickCounterRef = useRef(0)

  useEffect(() => {
    accumulatorRef.current = new FixedTimestepAccumulator(FIXED_DT)
    tickCounterRef.current = 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken])

  useFrame((_, delta) => {
    const result = advanceCarRigFrame({
      accumulator: accumulatorRef.current,
      tickCounter: tickCounterRef.current,
      carState: carStateRef.current,
      delta,
      maxFrameDelta: MAX_FRAME_DELTA,
      fixedDt: FIXED_DT,
      controllable,
      track,
      getInput: () => mergeCarInputs(inputRef.current, readGamepadInput()),
      onTick,
    })
    carStateRef.current = result.carState
    tickCounterRef.current = result.tickCounter
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
