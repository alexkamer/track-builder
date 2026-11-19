import { useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import type { RibbonMesh } from '../domain/generation/generateTrack'
import { useSurfaceTextures, type SurfaceName } from './SceneAssets'

interface RibbonMesh3DProps {
  mesh: RibbonMesh
  color: string
  roughness?: number
  testId?: string
  /** Which committed texture set to use, when one has loaded. Without it (or until it loads) the ribbon renders as `color`. */
  surface?: SurfaceName
  /** A locally-generated texture to use when no asset is available - currently the procedural asphalt. */
  fallbackMap?: THREE.Texture
  /** Barriers cast; flat ground-level surfaces only receive, since a coplanar caster self-shadows. */
  castShadow?: boolean
  receiveShadow?: boolean
  /** Pulls the surface forward in depth without moving it. Used for markings painted on the road, which are exactly coplanar with it - lifting them along y instead would make them float wherever the road is banked. */
  depthOffset?: boolean
}

/**
 * Raises a texture's anisotropic filtering to the hardware maximum. Track surfaces are viewed
 * at grazing angles from a chase camera, which is the worst case for mip aliasing - without
 * this the road ahead shimmers into mush rather than resolving.
 */
function useAnisotropic(texture: THREE.Texture | undefined): THREE.Texture | undefined {
  const gl = useThree((state) => state.gl)
  return useMemo(() => {
    if (!texture) return undefined
    const max = gl.capabilities.getMaxAnisotropy()
    if (texture.anisotropy !== max) {
      texture.anisotropy = max
      texture.needsUpdate = true
    }
    return texture
  }, [texture, gl])
}

/** Renders any generated ribbon mesh (road, curb, barrier, verge). Vec3 uses (x, z) as the ground plane and y as elevation. */
export function RibbonMesh3D({
  mesh,
  color,
  roughness = 0.9,
  testId,
  surface,
  fallbackMap,
  castShadow = false,
  receiveShadow = true,
  depthOffset = false,
}: RibbonMesh3DProps) {
  const loaded = useSurfaceTextures(surface ?? 'road')
  // `surface` being absent means "never textured", distinct from "textured once assets load".
  const textures = surface ? loaded : null
  // Loaded textures are already configured by SceneAssets' loader; only the locally generated
  // fallbacks still need their filtering set up here.
  const fallback = useAnisotropic(fallbackMap)
  const map = textures?.map ?? fallback
  const normalMap = textures?.normalMap
  const roughnessMap = textures?.roughnessMap
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positionArray = new Float32Array(mesh.positions.length * 3)
    mesh.positions.forEach((p, i) => {
      positionArray[i * 3] = p.x
      positionArray[i * 3 + 1] = p.y
      positionArray[i * 3 + 2] = p.z
    })
    geo.setAttribute('position', new THREE.BufferAttribute(positionArray, 3))

    // UVs come from generation, where they're derived from real distance along and across the
    // ribbon (see computeRibbonUvs) so one texture tile covers a fixed amount of ground
    // everywhere - through corners and across width changes alike.
    const uvArray = new Float32Array(mesh.uvs.length * 2)
    mesh.uvs.forEach((uv, i) => {
      uvArray[i * 2] = uv.u
      uvArray[i * 2 + 1] = uv.v
    })
    geo.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2))

    geo.setIndex(mesh.indices)
    geo.computeVertexNormals()
    return geo
  }, [mesh])

  return (
    <mesh geometry={geometry} data-testid={testId} castShadow={castShadow} receiveShadow={receiveShadow}>
      <meshStandardMaterial
        // Keyed on whether a map is present so the material is rebuilt rather than mutated when
        // textures finish loading: three compiles a material's shader for the maps it had at
        // creation, and r3f assigning `map` afterwards does not trigger a recompile - the
        // surface then samples as flat white instead of showing the texture.
        key={map ? 'textured' : 'flat'}
        // A colour map carries its own albedo, so tinting it would double-darken the surface.
        color={map ? '#ffffff' : color}
        map={map}
        normalMap={normalMap}
        roughnessMap={roughnessMap}
        roughness={roughness}
        side={THREE.DoubleSide}
        polygonOffset={depthOffset}
        polygonOffsetFactor={depthOffset ? -2 : 0}
        polygonOffsetUnits={depthOffset ? -2 : 0}
      />
    </mesh>
  )
}

let cachedAsphaltTexture: THREE.CanvasTexture | null = null

/** A small tileable asphalt texture with a dashed yellow centerline, drawn once and reused for every track. */
function createAsphaltTexture(): THREE.CanvasTexture {
  if (cachedAsphaltTexture) return cachedAsphaltTexture

  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 256
  const ctx = canvas.getContext('2d')

  if (ctx) {
    ctx.fillStyle = '#5a5f66'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Subtle per-pixel noise speckle so the surface doesn't read as a flat color.
    for (let i = 0; i < 1400; i++) {
      const shade = 70 + Math.floor(Math.random() * 40)
      ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade + 4}, 0.5)`
      ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1.5, 1.5)
    }

    // Deliberately no centreline. A circuit has no dashed road-marking down its middle, and
    // the UVs now advance by real distance across the road's width, so a stripe baked at the
    // tile's midpoint would land at an arbitrary place on the tarmac rather than its centre.
  }

  const texture = new THREE.CanvasTexture(canvas)
  // Both axes repeat: UVs are now in tile counts derived from world distance, not 0..1 spans,
  // so clamping either axis would stretch the last tile across the rest of the surface.
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  cachedAsphaltTexture = texture
  return texture
}

let cachedCurbTexture: THREE.CanvasTexture | null = null

/**
 * The curb's red/white rumble strip. One texture tile is one red block plus one white block, and
 * because the curb ribbon's `v` advances by real arc length (CURB_TILE_SIZE world units per
 * tile), the blocks come out a fixed real length everywhere - the same on a straight as through
 * a tight corner. That is why this is generated rather than downloaded: it is a marking whose
 * rhythm is tied to the track's geometry, not a material.
 */
function createCurbTexture(): THREE.CanvasTexture {
  if (cachedCurbTexture) return cachedCurbTexture

  const canvas = document.createElement('canvas')
  canvas.width = 8
  canvas.height = 64
  const ctx = canvas.getContext('2d')

  if (ctx) {
    ctx.fillStyle = '#d62828'
    ctx.fillRect(0, 0, canvas.width, canvas.height / 2)
    ctx.fillStyle = '#f1faee'
    ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  cachedCurbTexture = texture
  return texture
}

/** The red/white rumble-strip texture for curb ribbons. */
export function useCurbTexture(): THREE.Texture {
  return useMemo(() => createCurbTexture(), [])
}

/** Convenience wrapper for the road surface specifically, preserving the original name/prop shape. */
export function RoadMesh3D({ roadMesh }: { roadMesh: RibbonMesh }) {
  const fallbackMap = useMemo(() => createAsphaltTexture(), [])
  return (
    <RibbonMesh3D
      mesh={roadMesh}
      color="#5a5f66"
      roughness={0.95}
      testId="road-mesh"
      surface="road"
      fallbackMap={fallbackMap}
    />
  )
}
