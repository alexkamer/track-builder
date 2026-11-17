import { useMemo } from 'react'
import type { Vec3 } from '../domain/track/spline'

interface TrackSceneryProps {
  /** Used to place the ground plane and scatter trees around the track without overlapping it. */
  centerline: Vec3[]
}

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const TREE_COUNT = 60
const TREE_MIN_CLEARANCE = 25
const TREE_SCATTER_RADIUS_FACTOR = 1.8
const GROUND_SIZE_FACTOR = 4
const GROUND_CLEARANCE = 0.05

/** Deterministic ground, sky, and tree scenery sized and placed around the generated track. */
export function TrackScenery({ centerline }: TrackSceneryProps) {
  const { groundSize, groundY, center, trees } = useMemo(() => {
    const center = centerline.reduce(
      (acc, p) => ({ x: acc.x + p.x / centerline.length, z: acc.z + p.z / centerline.length }),
      { x: 0, z: 0 },
    )
    const radius = centerline.reduce(
      (max, p) => Math.max(max, Math.hypot(p.x - center.x, p.z - center.z)),
      1,
    )
    const groundSize = radius * GROUND_SIZE_FACTOR
    const lowestY = centerline.reduce((min, p) => Math.min(min, p.y), 0)
    const groundY = lowestY - GROUND_CLEARANCE

    const random = mulberry32(Math.round(center.x * 73856093 + center.z * 19349663) || 1)
    const trees: Vec3[] = []
    let attempts = 0
    while (trees.length < TREE_COUNT && attempts < TREE_COUNT * 20) {
      attempts++
      const angle = random() * Math.PI * 2
      const dist = radius + TREE_MIN_CLEARANCE + random() * radius * (TREE_SCATTER_RADIUS_FACTOR - 1)
      const x = center.x + Math.cos(angle) * dist
      const z = center.z + Math.sin(angle) * dist
      const nearestTrackDist = centerline.reduce(
        (min, p) => Math.min(min, Math.hypot(p.x - x, p.z - z)),
        Infinity,
      )
      if (nearestTrackDist >= TREE_MIN_CLEARANCE) {
        trees.push({ x, y: 0, z })
      }
    }

    return { groundSize, groundY, center, trees }
  }, [centerline])

  return (
    <>
      <color attach="background" args={['#87ceeb']} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center.x, groundY, center.z]} data-testid="ground-plane">
        <planeGeometry args={[groundSize, groundSize]} />
        <meshStandardMaterial color="#4a7c3a" />
      </mesh>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, groundY, t.z]} data-testid={i === 0 ? 'tree-sample' : undefined}>
          <mesh position={[0, 1, 0]}>
            <cylinderGeometry args={[0.3, 0.4, 2, 6]} />
            <meshStandardMaterial color="#6b4423" />
          </mesh>
          <mesh position={[0, 2.8, 0]}>
            <coneGeometry args={[1.4, 2.6, 7]} />
            <meshStandardMaterial color="#2d5a27" />
          </mesh>
        </group>
      ))}
    </>
  )
}
