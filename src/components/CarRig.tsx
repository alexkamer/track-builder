import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { interpolateCarState, type CarInput, type CarState } from '../domain/physics/carPhysics'
import { FixedTimestepAccumulator } from '../domain/physics/fixedTimestepLoop'
import { advanceCarRigFrame } from '../domain/physics/carRigStep'
import { mergeCarInputs, readGamepadInput } from '../domain/physics/gamepadInput'
import { bankingAt, elevationAt } from '../domain/physics/trackSurface'
import type { GeneratedTrack } from '../domain/generation/generateTrack'
import { CarModel, orientCarRoot, WHEEL_RADIUS, type CarModelHandle } from './CarModel'

export const FIXED_DT = 1 / 60
/** Caps the ticks run in a single frame so a stalled tab doesn't fast-forward the simulation. */
const MAX_FRAME_DELTA = 0.25
/** Visual-only front-wheel steering lock, radians - purely cosmetic, not tied to the physics turn model. */
const MAX_STEER_VISUAL_RAD = 0.5

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
  const carModelRef = useRef<CarModelHandle>(null)
  const accumulatorRef = useRef(new FixedTimestepAccumulator(FIXED_DT))
  const tickCounterRef = useRef(0)
  const wheelSpinRadRef = useRef(0)
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
    const renderState = interpolateCarState(prevPhysicsState, result.carState, accumulatorRef.current.alpha)
    carStateRef.current = renderState

    const car = carModelRef.current
    if (car) {
      const roadY = elevationAt(renderState, track)
      car.root.position.set(renderState.x, roadY + CAR_HEIGHT_OFFSET, renderState.z)
      const rollRad = -bankingAt(renderState, track)
      orientCarRoot(car.root, renderState.headingRad, rollRad)

      const steerInput = mergeCarInputs(inputRef.current, readGamepadInput()).steer
      const steerAngle = steerInput * MAX_STEER_VISUAL_RAD
      for (const pivot of car.frontSteerPivots) pivot.rotation.y = steerAngle

      wheelSpinRadRef.current += (renderState.speed / WHEEL_RADIUS) * delta
      for (const wheel of car.wheelMeshes) wheel.rotation.y = wheelSpinRadRef.current
    }
  })

  return <CarModel ref={carModelRef} color="#ffd166" testId="car-mesh" />
}
