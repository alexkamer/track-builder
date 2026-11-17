import { forwardRef } from 'react'
import type { Group } from 'three'

interface CarModelProps {
  color: string
  /** 0..1; < 1 renders a translucent ghost-style car. */
  opacity?: number
}

const WHEEL_RADIUS = 0.35
const WHEEL_POSITIONS: Array<[number, number, number]> = [
  [-0.95, WHEEL_RADIUS, 1.3],
  [0.95, WHEEL_RADIUS, 1.3],
  [-0.95, WHEEL_RADIUS, -1.3],
  [0.95, WHEEL_RADIUS, -1.3],
]

/**
 * A small low-poly car built from primitives (body, cabin, four wheels) instead of a bare
 * box, with its origin at road level so rigs can position it the same way they positioned
 * the old box mesh. Forward is +z, matching the physics model's heading convention.
 */
export const CarModel = forwardRef<Group, CarModelProps>(function CarModel({ color, opacity = 1 }, ref) {
  const transparent = opacity < 1
  const bodyMaterial = <meshStandardMaterial color={color} transparent={transparent} opacity={opacity} />

  return (
    <group ref={ref}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[1.8, 0.6, 3.6]} />
        {bodyMaterial}
      </mesh>
      <mesh position={[0, 1.05, -0.2]} castShadow>
        <boxGeometry args={[1.4, 0.5, 1.8]} />
        {bodyMaterial}
      </mesh>
      {WHEEL_POSITIONS.map((position, i) => (
        <mesh key={i} position={position} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[WHEEL_RADIUS, WHEEL_RADIUS, 0.3, 14]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.8} transparent={transparent} opacity={opacity} />
        </mesh>
      ))}
    </group>
  )
})
