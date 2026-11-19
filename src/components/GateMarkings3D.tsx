import { useMemo } from 'react'
import * as THREE from 'three'
import type { CheckpointTrigger } from '../domain/generation/generateTrack'

/** How far along the track each marking extends. The start/finish band is wider, as on a real circuit. */
export const START_LINE_DEPTH = 1.6
export const CHECKPOINT_DEPTH = 0.7

/**
 * The four corners of a gate's road marking, extruded from the trigger's own left/right span
 * along its own forward direction.
 *
 * Deriving the marking from the trigger - rather than recomputing the position from the control
 * point - is what guarantees the painted line sits exactly where the gate is actually detected.
 * Returned in triangle-strip corner order: left-back, right-back, left-front, right-front.
 */
export function gateQuadCorners(trigger: CheckpointTrigger, depth: number): number[] {
  const half = depth / 2
  const fx = trigger.forward.x * half
  const fz = trigger.forward.z * half
  const { left, right } = trigger

  return [
    left.x - fx, left.y, left.z - fz,
    right.x - fx, right.y, right.z - fz,
    left.x + fx, left.y, left.z + fz,
    right.x + fx, right.y, right.z + fz,
  ]
}

function useGateGeometry(trigger: CheckpointTrigger, depth: number): THREE.BufferGeometry {
  return useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(gateQuadCorners(trigger, depth)), 3),
    )
    // uv.x across the track, uv.y along it, so a checker reads as columns across the road.
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), 2))
    geometry.setIndex([0, 1, 2, 1, 3, 2])
    geometry.computeVertexNormals()
    return geometry
  }, [trigger, depth])
}

let cachedStartLineTexture: THREE.CanvasTexture | null = null

/** The start/finish line's black-and-white chequer, drawn across the road's width. */
function createStartLineTexture(): THREE.CanvasTexture {
  if (cachedStartLineTexture) return cachedStartLineTexture

  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 4
  const ctx = canvas.getContext('2d')

  if (ctx) {
    ctx.fillStyle = '#f5f7fa'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#16181d'
    const squares = 8
    const size = canvas.width / squares
    for (let i = 0; i < squares; i++) {
      // Offset every other row so the two halves of the band alternate, as on a real grid line.
      if (i % 2 === 0) ctx.fillRect(i * size, 0, size, canvas.height / 2)
      else ctx.fillRect(i * size, canvas.height / 2, size, canvas.height / 2)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  cachedStartLineTexture = texture
  return texture
}

function GateMarking({
  trigger,
  depth,
  color,
  map,
  testId,
}: {
  trigger: CheckpointTrigger
  depth: number
  color: string
  map?: THREE.Texture
  testId: string
}) {
  const geometry = useGateGeometry(trigger, depth)

  return (
    <mesh geometry={geometry} data-testid={testId} receiveShadow>
      <meshStandardMaterial
        key={map ? 'textured' : 'flat'}
        color={map ? '#ffffff' : color}
        map={map}
        roughness={0.7}
        side={THREE.DoubleSide}
        // The marking is exactly coplanar with the road, so it is pulled forward in depth
        // rather than lifted along y - which would make it float wherever the road is banked.
        polygonOffset
        polygonOffsetFactor={-3}
        polygonOffsetUnits={-3}
      />
    </mesh>
  )
}

/**
 * The visible start/finish line and checkpoint markings on the road surface.
 *
 * The triggers already exist in generation and drive lap validation; until now nothing drew
 * them, so the driver had no way to see where a lap began or which gates they had to pass.
 */
export function GateMarkings3D({
  startLineTrigger,
  checkpointTriggers,
}: {
  startLineTrigger: CheckpointTrigger
  checkpointTriggers: CheckpointTrigger[]
}) {
  const startLineMap = useMemo(() => createStartLineTexture(), [])

  return (
    <>
      <GateMarking
        trigger={startLineTrigger}
        depth={START_LINE_DEPTH}
        color="#f5f7fa"
        map={startLineMap}
        testId="start-line-marking"
      />
      {checkpointTriggers.map((trigger) => (
        <GateMarking
          key={trigger.controlPointIndex}
          trigger={trigger}
          depth={CHECKPOINT_DEPTH}
          color="#36d1c4"
          testId={`checkpoint-marking-${trigger.controlPointIndex}`}
        />
      ))}
    </>
  )
}
