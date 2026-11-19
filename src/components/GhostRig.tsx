import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { CarInput, CarState } from '../domain/physics/carPhysics'
import { createInitialCarState, interpolateCarState, NEUTRAL_INPUT } from '../domain/physics/carPhysics'
import { FixedTimestepAccumulator } from '../domain/physics/fixedTimestepLoop'
import { advanceCarTick } from '../domain/physics/advanceCarTick'
import { bankingAt, elevationAt } from '../domain/physics/trackSurface'
import type { GeneratedTrack } from '../domain/generation/generateTrack'
import type { SpawnTransform } from '../domain/generation/generateTrack'
import { CarModel, orientCarRoot, type CarModelHandle } from './CarModel'
import { advanceWheelSpin } from './carWheelSpin'

const FIXED_DT = 1 / 60
const MAX_FRAME_DELTA = 0.25
/** Small clearance above the road surface so the ghost's wheels don't z-fight with the road mesh. */
const GHOST_HEIGHT_OFFSET = 0.02
/** Visual-only front-wheel steering lock, radians - matches CarRig's. */
const MAX_STEER_VISUAL_RAD = 0.5

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
  const carModelRef = useRef<CarModelHandle>(null)
  const stateRef = useRef<CarState>(
    createInitialCarState(spawn.position.x, spawn.position.z, degToRad(spawn.headingDeg)),
  )
  const accumulatorRef = useRef(new FixedTimestepAccumulator(FIXED_DT))
  const tickIndexRef = useRef(0)
  const lastInputRef = useRef<CarInput>(NEUTRAL_INPUT)
  const wheelSpinRadRef = useRef(0)

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
      lastInputRef.current = input
      stateRef.current = advanceCarTick(stateRef.current, input, FIXED_DT, track)
      tickIndexRef.current += 1
      if (tickIndexRef.current >= inputLog.length) {
        tickIndexRef.current = 0
        stateRef.current = createInitialCarState(spawn.position.x, spawn.position.z, degToRad(spawn.headingDeg))
      }
    }
    const car = carModelRef.current
    if (car) {
      const renderState = interpolateCarState(prevState, stateRef.current, accumulatorRef.current.alpha)
      const roadY = elevationAt(renderState, track)
      car.root.position.set(renderState.x, roadY + GHOST_HEIGHT_OFFSET, renderState.z)
      const rollRad = -bankingAt(renderState, track)
      orientCarRoot(car.root, renderState.headingRad, rollRad)

      const steerAngle = lastInputRef.current.steer * MAX_STEER_VISUAL_RAD
      for (const pivot of car.frontSteerPivots) pivot.rotation.y = steerAngle

      wheelSpinRadRef.current = advanceWheelSpin(
        wheelSpinRadRef.current,
        renderState.speed,
        car.wheelRadius,
        delta,
      )
      for (const wheel of car.wheelMeshes) wheel.rotation.y = wheelSpinRadRef.current
    }
  })

  if (inputLog.length === 0) return null

  return <CarModel ref={carModelRef} color="#4ea8de" opacity={0.45} testId="ghost-mesh" />
}
