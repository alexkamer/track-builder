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

/** Approximate centerline length, used only for the preview panel's readout - walks the
 * midpoint of each ring's left/right edge around the loop. */
function centerlineLengthOf(roadMesh: RibbonMesh): number {
  const ringCount = roadMesh.ringCount
  const midpoint = (ring: number) => {
    const a = roadMesh.positions[ring * 2]
    const b = roadMesh.positions[ring * 2 + 1]
    return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }
  }
  let length = 0
  for (let i = 0; i < ringCount; i++) {
    const a = midpoint(i)
    const b = midpoint((i + 1) % ringCount)
    length += Math.hypot(b.x - a.x, b.z - a.z)
  }
  return length
}

function elevationRangeOf(roadMesh: RibbonMesh): number {
  let min = Infinity
  let max = -Infinity
  for (const p of roadMesh.positions) {
    if (p.y < min) min = p.y
    if (p.y > max) max = p.y
  }
  return max - min
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
    <div className="panel" data-testid="live-3d-preview">
      <div className="panel-head">
        <h3 className="panel-title">3D Preview</h3>
        <span className="live-tag">
          <span className="live-dot" />
          Live
        </span>
      </div>
      <div className="viewfinder">
        <div className="preview-surface" style={{ width, height }}>
          {roadMesh ? (
            <Canvas camera={{ fov: 50 }}>
              <ambientLight intensity={1.2} />
              <directionalLight position={[50, 100, 50]} intensity={2} />
              <RoadMesh3D roadMesh={roadMesh} />
              <CameraFraming roadMesh={roadMesh} />
            </Canvas>
          ) : (
            <p>Add at least 3 control points to see the 3D preview.</p>
          )}
        </div>
        <span className="bracket tl" />
        <span className="bracket tr" />
        <span className="bracket bl" />
        <span className="bracket br" />
      </div>
      {roadMesh && (
        <div className="preview-caption">
          <span>
            Length <strong>{centerlineLengthOf(roadMesh).toFixed(0)} m</strong>
          </span>
          <span>
            Elev. range <strong>{elevationRangeOf(roadMesh).toFixed(1)} m</strong>
          </span>
        </div>
      )}
    </div>
  )
}
