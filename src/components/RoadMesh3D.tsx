import { useMemo } from 'react'
import * as THREE from 'three'
import type { RibbonMesh } from '../domain/generation/generateTrack'

interface RibbonMesh3DProps {
  mesh: RibbonMesh
  color: string
  roughness?: number
  testId?: string
}

/** Renders any generated ribbon mesh (road, curb, barrier). Vec3 uses (x, z) as the ground plane and y as elevation. */
export function RibbonMesh3D({ mesh, color, roughness = 0.9, testId }: RibbonMesh3DProps) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positionArray = new Float32Array(mesh.positions.length * 3)
    mesh.positions.forEach((p, i) => {
      positionArray[i * 3] = p.x
      positionArray[i * 3 + 1] = p.y
      positionArray[i * 3 + 2] = p.z
    })
    geo.setAttribute('position', new THREE.BufferAttribute(positionArray, 3))
    geo.setIndex(mesh.indices)
    geo.computeVertexNormals()
    return geo
  }, [mesh])

  return (
    <mesh geometry={geometry} data-testid={testId}>
      <meshStandardMaterial color={color} roughness={roughness} side={THREE.DoubleSide} />
    </mesh>
  )
}

/** Convenience wrapper for the road surface specifically, preserving the original name/prop shape. */
export function RoadMesh3D({ roadMesh }: { roadMesh: RibbonMesh }) {
  return <RibbonMesh3D mesh={roadMesh} color="#6b7280" testId="road-mesh" />
}
