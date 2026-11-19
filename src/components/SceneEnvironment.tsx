import { Environment, Sky } from '@react-three/drei'
import { Suspense } from 'react'
import { AssetErrorBoundary } from './SceneAssets'

/** Where the sun sits, as an offset from whatever the scene is centred on. Shared so the sky's sun and the shadow-casting light never disagree about the time of day. */
export const SUN_OFFSET = { x: -60, y: 110, z: 45 }

/** Fog colour, matched to the sky near the horizon so distant geometry dissolves into it rather than fading to a mismatched grey. */
export const HORIZON_COLOR = '#b4cfe4'

/** Fog density for the race view, tuned so the far end of a track recedes while nothing inside the chase camera's working range is washed out. */
export const RACE_FOG_DENSITY = 0.0022

/**
 * Self-hosted so the scene can light itself offline. drei's `Environment preset` is not usable
 * here: it fetches HDRIs from a third-party CDN at runtime (`raw.githack.com`, hard-coded in
 * the installed package), which drei's own docs warn against in production.
 *
 * 1k Radiance HDR, ~1.2 MB. 2k is ~4.6 MB and the same image as EXR is ~5 MB for no visible
 * gain here, because the background is shown slightly blurred and the sharp detail in frame is
 * the road, not the sky.
 */
export const ENVIRONMENT_HDRI_URL = '/assets/env/kloofendal_43d_clear_puresky_1k.hdr'

/**
 * Ambient fill for the no-HDRI path only. It is deliberately rendered alongside the fallback
 * sky rather than next to the sun, so the scene has exactly one ambient source: when the HDRI
 * loads, image-based lighting supplies the fill, and adding this on top would double-count it.
 */
function FallbackSky() {
  return (
    <>
      <Sky
        distance={450000}
        sunPosition={[SUN_OFFSET.x, SUN_OFFSET.y, SUN_OFFSET.z]}
        turbidity={2.6}
        rayleigh={1.8}
        mieCoefficient={0.004}
      />
      <hemisphereLight intensity={0.7} color="#cfe3ff" groundColor="#54603f" />
    </>
  )
}

interface SceneEnvironmentProps {
  fogDensity?: number
  hdriUrl?: string
}

/**
 * The sky, the scene's image-based ambient light, and the atmospheric depth cue - shared by the
 * race view and the editor preview.
 *
 * The HDRI is wrapped in both a Suspense boundary and an error boundary whose fallback is a
 * procedural sky, so a missing file, an offline dev server, or a test environment that never
 * satisfies the fetch still yields a lit, drivable scene with a real sky gradient. Swapping the
 * sky on load is safe to do inside Suspense (unlike the track surfaces) because neither branch
 * holds simulation state.
 */
export function SceneEnvironment({
  fogDensity = RACE_FOG_DENSITY,
  hdriUrl = ENVIRONMENT_HDRI_URL,
}: SceneEnvironmentProps) {
  return (
    <>
      <AssetErrorBoundary fallback={<FallbackSky />}>
        <Suspense fallback={<FallbackSky />}>
          <Environment files={hdriUrl} background backgroundBlurriness={0.03} environmentIntensity={0.85} />
        </Suspense>
      </AssetErrorBoundary>
      <fogExp2 attach="fog" args={[HORIZON_COLOR, fogDensity]} />
    </>
  )
}

/**
 * Fog density for an overview camera framing a whole track. The race view's density assumes a
 * camera a few car lengths from its subject; reused as-is at overview distance it buries the
 * track in haze, and the haze would get worse the larger the track. Deriving it from the
 * framing radius instead keeps the amount of haze constant whatever the track's size.
 */
export function overviewFogDensity(radius: number): number {
  return 0.18 / Math.max(radius, 1)
}
