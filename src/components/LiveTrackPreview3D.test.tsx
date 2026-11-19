import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { boundingRadiusOf, centroidOf, LiveTrackPreview3D } from './LiveTrackPreview3D'
import { createControlPoint, createTrackDocument } from '../domain/track/schema'
import { generateScenePreview } from '../domain/generation/generateTrack'

function trackAt(offset: number) {
  return createTrackDocument({
    controlPoints: [
      createControlPoint({ x: offset, z: offset, width: 10 }),
      createControlPoint({ x: offset + 100, z: offset, width: 10 }),
      createControlPoint({ x: offset + 100, z: offset + 100, width: 10 }),
      createControlPoint({ x: offset, z: offset + 100, width: 10 }),
    ],
  })
}

describe('LiveTrackPreview3D camera framing', () => {
  it('computes a centroid and bounding radius that cover the full track when a far-off-origin track is loaded', () => {
    const farTrack = trackAt(5000)
    const surfaces = generateScenePreview(farTrack)
    expect(surfaces).not.toBeNull()
    const roadMesh = surfaces!.roadMesh

    const center = centroidOf(roadMesh)
    // The loaded track's points span roughly x,z in [5000, 5100]; the centroid used to frame
    // the camera (CameraFraming's useEffect runs on every roadMesh change, including a load)
    // must track the newly loaded track's bounds, not the previous track's or the origin.
    expect(center.x).toBeGreaterThan(4900)
    expect(center.x).toBeLessThan(5200)
    expect(center.z).toBeGreaterThan(4900)
    expect(center.z).toBeLessThan(5200)

    const radius = boundingRadiusOf(roadMesh, center)
    const maxDistance = Math.max(
      ...roadMesh.positions.map((p) => Math.hypot(p.x - center.x, p.z - center.z)),
    )
    expect(radius).toBeCloseTo(maxDistance, 5)
  })

  it('renders without error for a track with elevation changes (smoke test)', () => {
    const track = createTrackDocument({
      controlPoints: [
        createControlPoint({ x: 0, z: 0, width: 10, elevation: 0 }),
        createControlPoint({ x: 100, z: 0, width: 10, elevation: 20 }),
        createControlPoint({ x: 100, z: 100, width: 10, elevation: 0 }),
        createControlPoint({ x: 0, z: 100, width: 10, elevation: 10 }),
      ],
    })

    expect(() => render(<LiveTrackPreview3D doc={track} />)).not.toThrow()
  })

  it('renders without error when the doc is swapped wholesale (simulating a load)', () => {
    const { rerender } = render(<LiveTrackPreview3D doc={trackAt(0)} />)
    expect(() => rerender(<LiveTrackPreview3D doc={trackAt(5000)} />)).not.toThrow()
  })
})
