import { useMemo } from 'react'
import * as THREE from 'three'
import type { RibbonMesh } from '../domain/generation/generateTrack'

interface RibbonMesh3DProps {
  mesh: RibbonMesh
  color: string
  roughness?: number
  testId?: string
  map?: THREE.Texture
}

/** How many texture tiles span one ring-to-ring step; tuned so the asphalt/dash pattern reads at a believable scale rather than stretching across the whole track or repeating every few centimeters. */
const TEXTURE_V_SCALE = 0.12

/** Renders any generated ribbon mesh (road, curb, barrier). Vec3 uses (x, z) as the ground plane and y as elevation. */
export function RibbonMesh3D({ mesh, color, roughness = 0.9, testId, map }: RibbonMesh3DProps) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positionArray = new Float32Array(mesh.positions.length * 3)
    mesh.positions.forEach((p, i) => {
      positionArray[i * 3] = p.x
      positionArray[i * 3 + 1] = p.y
      positionArray[i * 3 + 2] = p.z
    })
    geo.setAttribute('position', new THREE.BufferAttribute(positionArray, 3))

    // uv.x: 0 at the left edge of the ribbon, 1 at the right. uv.y: scaled ring index, so a
    // tiled texture repeats along the ribbon's length rather than stretching end to end.
    const uvArray = new Float32Array(mesh.positions.length * 2)
    for (let ring = 0; ring < mesh.ringCount; ring++) {
      const v = ring * TEXTURE_V_SCALE
      uvArray[ring * 4] = 0
      uvArray[ring * 4 + 1] = v
      uvArray[ring * 4 + 2] = 1
      uvArray[ring * 4 + 3] = v
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2))

    geo.setIndex(mesh.indices)
    geo.computeVertexNormals()
    return geo
  }, [mesh])

  return (
    <mesh geometry={geometry} data-testid={testId}>
      <meshStandardMaterial color={map ? '#ffffff' : color} map={map} roughness={roughness} side={THREE.DoubleSide} />
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

    // Dashed centerline: short yellow segments running along the tile's length (v axis).
    const dashWidth = 5
    const dashHeight = 48
    const gapHeight = 48
    ctx.fillStyle = '#f2d94e'
    for (let y = 0; y < canvas.height; y += dashHeight + gapHeight) {
      ctx.fillRect(canvas.width / 2 - dashWidth / 2, y, dashWidth, dashHeight)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  cachedAsphaltTexture = texture
  return texture
}

/** Convenience wrapper for the road surface specifically, preserving the original name/prop shape. */
export function RoadMesh3D({ roadMesh }: { roadMesh: RibbonMesh }) {
  const map = useMemo(() => createAsphaltTexture(), [])
  return <RibbonMesh3D mesh={roadMesh} color="#ffffff" roughness={0.95} testId="road-mesh" map={map} />
}
