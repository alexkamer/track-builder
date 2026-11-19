import { Instance, Instances } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import type { Vec3 } from '../domain/track/spline'
import { useSurfaceTextures } from './SceneAssets'

interface Tree {
  x: number
  z: number
  scale: number
  rotation: number
}

interface TrackSceneryProps {
  /** Used to place the ground plane and scatter trees around the track without overlapping it. */
  centerline: Vec3[]
  /** Terrain height, from `generateTrack` - the same value the verge's outer edge is pinned to, so the two meet without a step. */
  groundY: number
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

/** Raised well above the old 60 now that trees are instanced: the whole treeline is two draw calls regardless of count, so this buys a horizon that reads as woodland instead of scattered markers. */
const TREE_COUNT = 240
const TREE_MIN_CLEARANCE = 25
const TREE_SCATTER_RADIUS_FACTOR = 1.8
const GROUND_SIZE_FACTOR = 4
/** World-units covered by one tile of the grass texture. */
const TERRAIN_TILE_SIZE = 12

/**
 * The committed grass texture, tiled for a ground plane of `groundSize`, or undefined when no
 * asset is available. The plane carries plain 0..1 UVs - unlike the track ribbons, whose UVs
 * are already world-distance tile counts - so its repeat has to be derived from the plane's
 * actual size here to land at a believable grass scale.
 *
 * This is a hook rather than a `<TerrainMaterial>` component on purpose: r3f attaches a
 * material to its parent mesh by element position, and returning `<meshStandardMaterial>` from
 * a nested component left the plane with r3f's default white material instead.
 */
function useTerrainGeometry(groundSize: number): THREE.PlaneGeometry {
  return useMemo(() => {
    const geometry = new THREE.PlaneGeometry(groundSize, groundSize)
    // Tiling is baked into the UVs rather than set as `texture.repeat`, matching how the track
    // ribbons carry tile counts in their own UVs. It also keeps the grass texture object free of
    // per-mesh mutation, which is what the ribbons and this plane would otherwise fight over.
    const uv = geometry.attributes.uv
    const tiles = groundSize / TERRAIN_TILE_SIZE
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) * tiles, uv.getY(i) * tiles)
    }
    uv.needsUpdate = true
    return geometry
  }, [groundSize])
}

/** Deterministic ground and tree scenery sized and placed around the generated track. The sky and fog are `SceneEnvironment`'s, so each view can tune fog for its own camera distance. */
export function TrackScenery({ centerline, groundY }: TrackSceneryProps) {
  const { groundSize, center, trees } = useMemo(() => {
    const center = centerline.reduce(
      (acc, p) => ({ x: acc.x + p.x / centerline.length, z: acc.z + p.z / centerline.length }),
      { x: 0, z: 0 },
    )
    const radius = centerline.reduce(
      (max, p) => Math.max(max, Math.hypot(p.x - center.x, p.z - center.z)),
      1,
    )
    const groundSize = radius * GROUND_SIZE_FACTOR

    const random = mulberry32(Math.round(center.x * 73856093 + center.z * 19349663) || 1)
    const trees: Tree[] = []
    let attempts = 0
    while (trees.length < TREE_COUNT && attempts < TREE_COUNT * 20) {
      attempts++
      const angle = random() * Math.PI * 2
      const dist = radius + TREE_MIN_CLEARANCE + random() * radius * (TREE_SCATTER_RADIUS_FACTOR - 1)
      const x = center.x + Math.cos(angle) * dist
      const z = center.z + Math.sin(angle) * dist
      // Drawn unconditionally so a rejected candidate still consumes the same number of
      // random values as an accepted one, keeping placement independent of rejection order.
      const scale = 0.75 + random() * 0.9
      const rotation = random() * Math.PI * 2
      const nearestTrackDist = centerline.reduce(
        (min, p) => Math.min(min, Math.hypot(p.x - x, p.z - z)),
        Infinity,
      )
      if (nearestTrackDist >= TREE_MIN_CLEARANCE) {
        trees.push({ x, z, scale, rotation })
      }
    }

    return { groundSize, center, trees }
  }, [centerline])

  const terrainGeometry = useTerrainGeometry(groundSize)
  const terrainMap = useSurfaceTextures('terrain')?.map

  return (
    <>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[center.x, groundY, center.z]}
        data-testid="ground-plane"
        receiveShadow
      >
        <primitive object={terrainGeometry} attach="geometry" />
        {/* Keyed so the material is rebuilt when the texture arrives - see RibbonMesh3D. */}
        <meshStandardMaterial
          key={terrainMap ? 'textured' : 'flat'}
          color={terrainMap ? '#ffffff' : '#4a7c3a'}
          map={terrainMap}
          roughness={0.95}
        />
      </mesh>
      {/* Two instanced draw calls for the whole treeline (trunks, then foliage) instead of one
          draw call per mesh per tree. Each tree's scale and rotation come from the same seeded
          sequence as its position, so the scatter stays deterministic per track. */}
      <Instances limit={trees.length} range={trees.length} castShadow>
        <cylinderGeometry args={[0.3, 0.4, 2, 6]} />
        <meshStandardMaterial color="#6b4423" roughness={0.9} />
        {trees.map((t, i) => (
          <Instance
            key={i}
            position={[t.x, groundY + t.scale, t.z]}
            scale={t.scale}
            rotation={[0, t.rotation, 0]}
            data-testid={i === 0 ? 'tree-sample' : undefined}
          />
        ))}
      </Instances>
      <Instances limit={trees.length} range={trees.length} castShadow>
        <coneGeometry args={[1.4, 2.6, 7]} />
        <meshStandardMaterial color="#2d5a27" roughness={0.85} />
        {trees.map((t, i) => (
          <Instance
            key={i}
            position={[t.x, groundY + 2.8 * t.scale, t.z]}
            scale={t.scale}
            rotation={[0, t.rotation, 0]}
          />
        ))}
      </Instances>
    </>
  )
}
