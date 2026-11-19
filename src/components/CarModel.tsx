import { forwardRef, useImperativeHandle, useRef } from 'react'
import { Quaternion, Vector3 } from 'three'
import type { Group, Mesh } from 'three'
import { readCarSource, type CarSource } from './carSource'
import { useLowPolyCar } from './useLowPolyCar'
// Type-only: erased at compile time, so the shipped bundle keeps no reference to the dev-only
// loader module.
import type { BuiltLowPolyCar } from './lowPolyCar'

interface CarModelProps {
  color: string
  /** 0..1; < 1 renders a translucent ghost-style car. */
  opacity?: number
  testId?: string
}

/** What a rig needs to pose the car each frame: the root (position/heading/banking roll), the front wheels' steering pivots, and every wheel mesh for rolling spin. */
export interface CarModelHandle {
  root: Group
  frontSteerPivots: [Group, Group]
  wheelMeshes: Mesh[]
  /**
   * The radius of this car's wheels, in world units. Belongs to the handle rather than being a
   * module constant because car sources differ: a rig divides speed by it to get rolling spin,
   * so reading the wrong one makes the wheels visibly skate instead of roll.
   */
  wheelRadius: number
}

export const WHEEL_RADIUS = 0.35

const WHEEL_POSITIONS: Array<[number, number, number]> = [
  [-0.95, WHEEL_RADIUS, 1.3],
  [0.95, WHEEL_RADIUS, 1.3],
  [-0.95, WHEEL_RADIUS, -1.3],
  [0.95, WHEEL_RADIUS, -1.3],
]
const FRONT_WHEEL_INDICES = [0, 1]

const UP_AXIS = new Vector3(0, 1, 0)
const FORWARD_AXIS = new Vector3(0, 0, 1)
const yawQuaternion = new Quaternion()
const rollQuaternion = new Quaternion()

/**
 * Orients a car's root group to `headingRad` (yaw, around world up) combined with
 * `rollRad` (roll, around the car's own forward axis - used to bank into the road's
 * banked cross-section). Composed as yaw-after-roll via quaternions rather than setting
 * both on one Euler, which would make the result depend on Euler rotation order instead of
 * always rolling relative to the car's own forward direction and then turning that to face
 * the current heading.
 */
export function orientCarRoot(root: Group, headingRad: number, rollRad: number): void {
  yawQuaternion.setFromAxisAngle(UP_AXIS, headingRad)
  rollQuaternion.setFromAxisAngle(FORWARD_AXIS, rollRad)
  root.quaternion.copy(yawQuaternion).multiply(rollQuaternion)
}

/**
 * A small low-poly car built from primitives (body, cabin, four wheels) instead of a bare
 * box, with its origin at road level so rigs can position it the same way they positioned
 * the old box mesh. Forward is +z, matching the physics model's heading convention.
 *
 * Each wheel is two or three nested objects so "steer" and "roll" are independent rotations
 * instead of fighting over one Euler angle on a single object: an outer steering pivot
 * (front wheels only) rotated by the rig to the current steer angle, a middle group with a
 * fixed 90-degree tilt so the cylinder's axis points sideways, and an inner mesh whose own
 * local-Y rotation is the rolling spin - unambiguous because it's set before the tilt is
 * applied, in the cylinder's own frame where its symmetry axis is Y.
 */
const PrimitiveCarModel = forwardRef<CarModelHandle, CarModelProps>(function PrimitiveCarModel({ color, opacity = 1, testId }, ref) {
  const rootRef = useRef<Group>(null)
  const steerPivotRefs = useRef<Group[]>([])
  const wheelMeshRefs = useRef<Mesh[]>([])

  useImperativeHandle(
    ref,
    () => ({
      get root() {
        return rootRef.current!
      },
      get frontSteerPivots() {
        return [steerPivotRefs.current[0], steerPivotRefs.current[1]] as [Group, Group]
      },
      get wheelMeshes() {
        return wheelMeshRefs.current
      },
      wheelRadius: WHEEL_RADIUS,
    }),
    [],
  )

  const transparent = opacity < 1
  const bodyMaterial = <meshStandardMaterial color={color} transparent={transparent} opacity={opacity} />
  const wheelMaterial = (
    <meshStandardMaterial color="#1a1a1a" roughness={0.8} transparent={transparent} opacity={opacity} />
  )

  return (
    <group ref={rootRef} data-testid={testId}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[1.8, 0.6, 3.6]} />
        {bodyMaterial}
      </mesh>
      <mesh position={[0, 1.05, -0.2]} castShadow>
        <boxGeometry args={[1.4, 0.5, 1.8]} />
        {bodyMaterial}
      </mesh>
      {WHEEL_POSITIONS.map((position, i) => {
        const wheel = (
          <group rotation={[0, 0, Math.PI / 2]}>
            <mesh ref={(m) => void (wheelMeshRefs.current[i] = m!)} castShadow>
              <cylinderGeometry args={[WHEEL_RADIUS, WHEEL_RADIUS, 0.3, 14]} />
              {wheelMaterial}
            </mesh>
          </group>
        )
        return FRONT_WHEEL_INDICES.includes(i) ? (
          <group key={i} position={position} ref={(g) => void (steerPivotRefs.current[i] = g!)}>
            {wheel}
          </group>
        ) : (
          <group key={i} position={position}>
            {wheel}
          </group>
        )
      })}
    </group>
  )
})

/**
 * Read once per page load, not per render: switching cars is a reload, which also guarantees the
 * new geometry starts in a clean scene. Always `primitive` outside a dev server.
 */
const CAR_SOURCE: CarSource = readCarSource()

const LowPolyCarModel = forwardRef<CarModelHandle, { built: BuiltLowPolyCar; testId?: string }>(
  function LowPolyCarModel({ built, testId }, ref) {
    useImperativeHandle(ref, () => built.handle, [built])
    return (
      <group data-testid={testId}>
        <primitive object={built.handle.root} />
      </group>
    )
  },
)

/**
 * The car, from whichever source is selected.
 *
 * The primitive car is the default, the only source in a production build, and the fallback
 * whenever the optional one is unavailable - so this renders synchronously on first paint and
 * introduces no Suspense boundary or async work into the default path.
 */
export const CarModel = forwardRef<CarModelHandle, CarModelProps>(function CarModel(props, ref) {
  const lowPoly = useLowPolyCar(CAR_SOURCE, props.color, props.opacity ?? 1)

  if (lowPoly) {
    return <LowPolyCarModel built={lowPoly} testId={props.testId} ref={ref} />
  }
  return <PrimitiveCarModel {...props} ref={ref} />
})
