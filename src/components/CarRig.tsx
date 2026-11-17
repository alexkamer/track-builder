import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { Group } from 'three'
import type { RefObject } from 'react'
import { interpolateCarState, type CarInput, type CarState } from '../domain/physics/carPhysics'
import { FixedTimestepAccumulator } from '../domain/physics/fixedTimestepLoop'
import { advanceCarRigFrame } from '../domain/physics/carRigStep'
import { mergeCarInputs, readGamepadInput } from '../domain/physics/gamepadInput'
import { elevationAt } from '../domain/physics/trackSurface'
import type { GeneratedTrack } from '../domain/generation/generateTrack'
import { CarModel } from './CarModel'

export const FIXED_DT = 1 / 60
/** Caps the ticks run in a single frame so a stalled tab doesn't fast-forward the simulation. */
const MAX_FRAME_DELTA = 0.25

interface CarRigProps {
  /**
   * Mutated in place every render frame to a render-time interpolated blend of the two
   * physics ticks straddling that frame, so camera rigs and the mesh move smoothly between
   * ticks instead of holding still until the next tick lands. Physics itself still advances in
   * exact fixed steps internally - this ref is a smoothed read-only view of that for rendering.
   */
  carStateRef: RefObject<CarState>
  inputRef: RefObject<CarInput>
  track: GeneratedTrack
  /** While false, physics ticks are withheld entirely (e.g. during the pre-race countdown). */
  controllable?: boolean
  /** Bump to re-initialize the fixed-timestep accumulator and tick counter (e.g. on a mid-race restart). */
  resetToken?: number
  /** Called once per fixed physics tick with the resulting state and the input used - used by lap timing, ghosts, etc. */
  onTick?: (state: CarState, tickIndex: number, input: CarInput) => void
}

/** Small clearance above the road surface so the car's wheels don't z-fight with the road mesh. */
const CAR_HEIGHT_OFFSET = 0.02

export function CarRig({
  carStateRef,
  inputRef,
  track,
  controllable = true,
  resetToken,
  onTick,
}: CarRigProps) {
  const groupRef = useRef<Group>(null)
  const accumulatorRef = useRef(new FixedTimestepAccumulator(FIXED_DT))
  const tickCounterRef = useRef(0)
  /** The exact last-tick physics state; advances only in fixed steps, independent of render rate. */
  const physicsStateRef = useRef<CarState>(carStateRef.current)

  useEffect(() => {
    accumulatorRef.current = new FixedTimestepAccumulator(FIXED_DT)
    tickCounterRef.current = 0
    physicsStateRef.current = carStateRef.current
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken])

  useFrame((_, delta) => {
    const prevPhysicsState = physicsStateRef.current
    const result = advanceCarRigFrame({
      accumulator: accumulatorRef.current,
      tickCounter: tickCounterRef.current,
      carState: prevPhysicsState,
      delta,
      maxFrameDelta: MAX_FRAME_DELTA,
      fixedDt: FIXED_DT,
      controllable,
      track,
      getInput: () => mergeCarInputs(inputRef.current, readGamepadInput()),
      onTick,
    })
    physicsStateRef.current = result.carState
    tickCounterRef.current = result.tickCounter
    carStateRef.current = interpolateCarState(prevPhysicsState, result.carState, accumulatorRef.current.alpha)
    if (groupRef.current) {
      const roadY = elevationAt(carStateRef.current, track)
      groupRef.current.position.set(carStateRef.current.x, roadY + CAR_HEIGHT_OFFSET, carStateRef.current.z)
      groupRef.current.rotation.y = carStateRef.current.headingRad
    }
  })

  return (
    <group ref={groupRef} data-testid="car-mesh">
      <CarModel color="#ffd166" />
    </group>
  )
}
