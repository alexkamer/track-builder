import { useTexture } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import {
  Component,
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import * as THREE from 'three'

export type SurfaceName = 'road' | 'curb' | 'barrier' | 'verge' | 'terrain'

export interface SurfaceTextureSet {
  map: THREE.Texture
  normalMap?: THREE.Texture
  roughnessMap?: THREE.Texture
}

/** Which files make up each surface's material. Empty entries are simply never loaded, so the scene runs on flat colours until real assets are committed. */
export interface SurfaceManifestEntry {
  map: string
  normalMap?: string
  roughnessMap?: string
}

export type SurfaceManifest = Partial<Record<SurfaceName, SurfaceManifestEntry>>

/**
 * The committed texture sets, by surface. Paths are served statically from `public/`, and every
 * file is CC0 - see `public/assets/CREDITS.md` for each one's source.
 *
 * Only albedo (`map`) is colour data; `normalMap` and `roughnessMap` are not, and must stay in
 * three's default `NoColorSpace` - tagging them sRGB is the classic cause of flat-looking
 * normals and wrong roughness.
 *
 * How far one tile spans in the world is not set here: the ribbon meshes' UVs already carry
 * tile counts derived from real distance (see `computeRibbonUvs` and the `*_TILE_SIZE`
 * constants in generation), so a texture lands at a consistent scale without per-material
 * repeat values. There is deliberately no `curb` entry - the rumble strip is a marking rather
 * than a material, and is generated in `createCurbTexture`.
 *
 * Ambient-occlusion maps are intentionally omitted: three samples `aoMap` from a second UV set
 * (`uv1`) which this geometry does not provide, so wiring one up would misplace the shading.
 */
export const SURFACE_MANIFEST: SurfaceManifest = {
  road: {
    map: '/assets/textures/road/color.webp',
    normalMap: '/assets/textures/road/normal.webp',
    roughnessMap: '/assets/textures/road/roughness.webp',
  },
  barrier: {
    map: '/assets/textures/barrier/color.webp',
    normalMap: '/assets/textures/barrier/normal.webp',
    roughnessMap: '/assets/textures/barrier/roughness.webp',
  },
  verge: {
    map: '/assets/textures/verge/color.webp',
    normalMap: '/assets/textures/verge/normal.webp',
    roughnessMap: '/assets/textures/verge/roughness.webp',
  },
  terrain: {
    map: '/assets/textures/terrain/color.webp',
    normalMap: '/assets/textures/terrain/normal.webp',
    roughnessMap: '/assets/textures/terrain/roughness.webp',
  },
}

const EMPTY_TEXTURES: Partial<Record<SurfaceName, SurfaceTextureSet>> = {}

const SceneTexturesContext = createContext(EMPTY_TEXTURES)

/** The loaded texture set for a surface, or null when assets are absent or failed to load. Consumers must handle null by falling back to a flat colour. */
export function useSurfaceTextures(name: SurfaceName): SurfaceTextureSet | null {
  return useContext(SceneTexturesContext)[name] ?? null
}

interface BoundaryProps {
  children: ReactNode
  /** Rendered in place of `children` once loading has failed. Defaults to nothing. */
  fallback?: ReactNode
  onError?: (error: Error) => void
}

/**
 * Swallows asset-loading failures. A missing or unreachable texture must leave a drivable
 * scene rather than taking down the whole canvas, so this renders nothing on error and lets
 * the surrounding provider keep serving flat colours.
 */
export class AssetErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    this.props.onError?.(error)
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children
  }
}

function SurfaceTextureLoader({
  manifest,
  onLoaded,
}: {
  manifest: SurfaceManifest
  onLoaded: (textures: Partial<Record<SurfaceName, SurfaceTextureSet>>) => void
}) {
  const entries = useMemo(() => Object.entries(manifest) as Array<[SurfaceName, SurfaceManifestEntry]>, [manifest])

  // One flat url list keeps the hook call order stable regardless of manifest shape.
  const urls = useMemo(
    () => entries.flatMap(([, e]) => [e.map, e.normalMap, e.roughnessMap].filter((u): u is string => !!u)),
    [entries],
  )

  const loaded = useTexture(urls)
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy())

  useEffect(() => {
    const byUrl = new Map<string, THREE.Texture>()
    urls.forEach((url, i) => byUrl.set(url, loaded[i]))

    const result: Partial<Record<SurfaceName, SurfaceTextureSet>> = {}
    for (const [name, entry] of entries) {
      const map = byUrl.get(entry.map)
      if (!map) continue

      // Albedo is colour data; the other maps are not. See SURFACE_MANIFEST.
      map.colorSpace = THREE.SRGBColorSpace

      for (const texture of [map, byUrl.get(entry.normalMap ?? ''), byUrl.get(entry.roughnessMap ?? '')]) {
        if (!texture) continue
        // Both axes repeat because UVs are in tile counts derived from world distance, not 0..1.
        texture.wrapS = THREE.RepeatWrapping
        texture.wrapT = THREE.RepeatWrapping
        // Track surfaces are seen at grazing angles from a chase camera, the worst case for mip
        // aliasing; without max anisotropy the road ahead shimmers instead of resolving.
        texture.anisotropy = maxAnisotropy
        // Required: wrap mode, colour space and anisotropy all affect how the texture is
        // uploaded, so without this the sampler keeps the pre-configuration state. Omitting it
        // left surfaces that read the texture directly (the terrain plane) sampling as white,
        // while those that happened to set needsUpdate themselves looked fine.
        texture.needsUpdate = true
      }

      result[name] = {
        map,
        normalMap: byUrl.get(entry.normalMap ?? ''),
        roughnessMap: byUrl.get(entry.roughnessMap ?? ''),
      }
    }
    onLoaded(result)
  }, [entries, urls, loaded, onLoaded, maxAnisotropy])

  return null
}

/**
 * Owns all scene texture loading and publishes either the loaded set or nothing.
 *
 * Two things make this safe to mount around a running race:
 *
 * - `children` are rendered once, as a *sibling* of the loader rather than inside its Suspense
 *   boundary. If they were inside it, the tree would swap when loading resolved and remount
 *   everything underneath - which for the race view means resetting the car's physics state
 *   mid-lap. As written, the scene appears immediately with flat colours and upgrades in place.
 * - Loading failures are caught, so an absent file, an offline dev server, or a test
 *   environment that never satisfies the fetch degrades to flat colours instead of suspending
 *   forever or throwing.
 */
export function SceneAssetsProvider({
  children,
  manifest = SURFACE_MANIFEST,
  onError,
}: {
  children: ReactNode
  manifest?: SurfaceManifest
  onError?: (error: Error) => void
}) {
  const [textures, setTextures] = useState(EMPTY_TEXTURES)
  const handleLoaded = useCallback((next: Partial<Record<SurfaceName, SurfaceTextureSet>>) => setTextures(next), [])
  const hasAssets = Object.keys(manifest).length > 0

  return (
    <SceneTexturesContext.Provider value={textures}>
      {hasAssets && (
        <AssetErrorBoundary onError={onError}>
          <Suspense fallback={null}>
            <SurfaceTextureLoader manifest={manifest} onLoaded={handleLoaded} />
          </Suspense>
        </AssetErrorBoundary>
      )}
      {children}
    </SceneTexturesContext.Provider>
  )
}
