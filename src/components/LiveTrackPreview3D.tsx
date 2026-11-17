import { Canvas, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import type { TrackDocument } from '../domain/track/schema'
import type { RibbonMesh } from '../domain/generation/generateTrack'
import { generateRoadMeshPreview } from '../domain/generation/generateTrack'
import { RoadMesh3D } from './RoadMesh3D'

interface LiveTrackPreview3DProps {
  doc: TrackDocument
  width?: number
  height?: number
}

export function centroidOf(roadMesh: RibbonMesh) {
  const n = roadMesh.positions.length
  const sum = roadMesh.positions.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y, z: acc.z + p.z }),
    { x: 0, y: 0, z: 0 },
  )
  return { x: sum.x / n, y: sum.y / n, z: sum.z / n }
}

export function boundingRadiusOf(roadMesh: RibbonMesh, center: { x: number; z: number }) {
  return roadMesh.positions.reduce(
    (max, p) => Math.max(max, Math.hypot(p.x - center.x, p.z - center.z)),
    1,
  )
}

/** Frames the camera on the track's centroid whenever the mesh changes shape. */
function CameraFraming({ roadMesh }: { roadMesh: RibbonMesh }) {
  const camera = useThree((state) => state.camera)

  useEffect(() => {
    const center = centroidOf(roadMesh)
    const radius = boundingRadiusOf(roadMesh, center)
    camera.position.set(center.x, radius * 1.4, center.z + radius * 1.4)
    camera.lookAt(center.x, center.y, center.z)
    camera.updateProjectionMatrix()
  }, [roadMesh, camera])

  return null
}

/**
 * Shows the 3D shape of the track as it's being edited, without requiring a
 * "generate" action or full validation (start line, etc.) first.
 */
export function LiveTrackPreview3D({ doc, width = 420, height = 480 }: LiveTrackPreview3DProps) {
  const roadMesh = generateRoadMeshPreview(doc)

  return (
    <div style={{ width, height, background: '#06080a' }} data-testid="live-3d-preview">
      {roadMesh ? (
        <Canvas camera={{ fov: 50 }}>
          <ambientLight intensity={1.2} />
          <directionalLight position={[50, 100, 50]} intensity={2} />
          <RoadMesh3D roadMesh={roadMesh} />
          <CameraFraming roadMesh={roadMesh} />
        </Canvas>
      ) : (
        <p style={{ color: '#8a8f98', padding: 16 }}>
          Add at least 3 control points to see the 3D preview.
        </p>
      )}
    </div>
  )
}
