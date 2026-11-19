import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type RefObject } from 'react'
import { Object3D, type DirectionalLight } from 'three'
import { SUN_OFFSET } from './SceneEnvironment'

interface SceneLightingProps {
  /** Point the shadow frustum is centred on when there is no moving target (the editor preview). */
  center: { x: number; z: number }
  /**
   * Re-centres the shadow frustum on this target every frame. A frustum big enough to cover a
   * whole track would make shadow texels enormous - following the car keeps texel density high
   * at a fixed cost, and is what keeps its shadow from vanishing as it drives away from origin.
   */
  targetRef?: RefObject<{ x: number; z: number } | null>
  /** Half-extent of the shadow frustum. Must comfortably exceed the chase camera's visible range. */
  shadowExtent?: number
  shadowMapSize?: number
}

const SUN_INTENSITY = 1.7

/**
 * The scene's single shadow-casting sun, shared by the race view and the editor preview so the
 * two agree. Ambient fill is `SceneEnvironment`'s job, not this component's - see FallbackSky.
 *
 * Deliberately not soft shadows (PCSS) or accumulative shadows: the former scales badly
 * per-fragment, and the latter converges over many static frames, which a moving car
 * invalidates every frame.
 */
export function SceneLighting({
  center,
  targetRef,
  shadowExtent = 70,
  shadowMapSize = 2048,
}: SceneLightingProps) {
  const lightRef = useRef<DirectionalLight>(null)
  // The light aims at its `target`; three reads that object's world matrix when it updates the
  // shadow camera, so it needs to exist and be kept up to date even though it renders nothing.
  const target = useMemo(() => new Object3D(), [])

  const reposition = (x: number, z: number) => {
    const light = lightRef.current
    if (!light) return
    light.position.set(x + SUN_OFFSET.x, SUN_OFFSET.y, z + SUN_OFFSET.z)
    target.position.set(x, 0, z)
    target.updateMatrixWorld()
  }

  useFrame(() => {
    const moving = targetRef?.current
    reposition(moving ? moving.x : center.x, moving ? moving.z : center.z)
  })

  return (
    <>
      <directionalLight
        ref={lightRef}
        castShadow
        intensity={SUN_INTENSITY}
        color="#fff4e0"
        position={[center.x + SUN_OFFSET.x, SUN_OFFSET.y, center.z + SUN_OFFSET.z]}
        target={target}
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-camera-left={-shadowExtent}
        shadow-camera-right={shadowExtent}
        shadow-camera-top={shadowExtent}
        shadow-camera-bottom={-shadowExtent}
        shadow-camera-near={1}
        shadow-camera-far={400}
        // Acne is handled mostly by normalBias, which offsets along the surface normal and so
        // doesn't detach a shadow from its caster. A large negative depth bias does: at -0.0008
        // the car's shadow pulled away from its wheels and the car read as hovering above the
        // road ("peter-panning"). Keep this small and let normalBias do the work.
        shadow-bias={-0.00008}
        shadow-normalBias={0.03}
      />
    </>
  )
}
