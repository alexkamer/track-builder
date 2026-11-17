import { describe, expect, it } from 'vitest'
import { createControlPoint, createTrackDocument } from '../track/schema'
import { generateTrack, SAMPLES_PER_SEGMENT, TrackNotValidatedError } from './generateTrack'

function validSquareTrack() {
  // 150x150 (not 50x50): big enough that every corner clears MIN_CORNER_RADIUS,
  // which is now calibrated against the car's actual achievable turn radius.
  return createTrackDocument({
    controlPoints: [
      createControlPoint({ x: 0, z: 0, width: 10 }),
      createControlPoint({ x: 150, z: 0, width: 10 }),
      createControlPoint({ x: 150, z: 150, width: 10 }),
      createControlPoint({ x: 0, z: 150, width: 10 }),
    ],
    startLine: { controlPointIndex: 0, headingDeg: 90 },
  })
}

describe('generateTrack', () => {
  it('rejects a track that has not passed validation', () => {
    const doc = createTrackDocument() // no control points, no start line
    expect(() => generateTrack(doc)).toThrow(TrackNotValidatedError)
  })

  it('produces a road mesh with no seam at the loop closure', () => {
    const { roadMesh } = generateTrack(validSquareTrack())

    // Two vertices (left/right edge) per sampled ring, two triangles per ring-to-next-ring segment.
    expect(roadMesh.positions).toHaveLength(roadMesh.ringCount * 2)
    expect(roadMesh.indices).toHaveLength(roadMesh.ringCount * 6)

    // The closing segment connects the last ring back to ring 0 - no gap, no dangling edge.
    const lastRingLeft = (roadMesh.ringCount - 1) * 2
    const lastRingRight = lastRingLeft + 1
    const closingTriangle = roadMesh.indices.slice(-6)
    expect(closingTriangle).toEqual([lastRingLeft, lastRingRight, 0, lastRingRight, 1, 0])
  })

  it('produces identical output when run twice on the same input (deterministic)', () => {
    const doc = validSquareTrack()
    const first = generateTrack(doc)
    const second = generateTrack(doc)
    expect(second.roadMesh.positions).toEqual(first.roadMesh.positions)
    expect(second.roadMesh.indices).toEqual(first.roadMesh.indices)
    expect(second.spawn).toEqual(first.spawn)
  })

  it('derives a spawn transform lying on the road surface at the start line', () => {
    const doc = validSquareTrack()
    const { spawn, roadMesh } = generateTrack(doc)

    expect(spawn.headingDeg).toBe(90)

    // The spawn point should be the midpoint of the left/right edge vertices
    // at ring 0 (the start control point's ring), i.e. on the road surface.
    const left = roadMesh.positions[0]
    const right = roadMesh.positions[1]
    const midpoint = {
      x: (left.x + right.x) / 2,
      y: (left.y + right.y) / 2,
      z: (left.z + right.z) / 2,
    }
    expect(spawn.position.x).toBeCloseTo(midpoint.x, 5)
    expect(spawn.position.y).toBeCloseTo(midpoint.y, 5)
    expect(spawn.position.z).toBeCloseTo(midpoint.z, 5)
  })

  it('tapers road width to match a wider control point', () => {
    const narrow = validSquareTrack()
    const wide = createTrackDocument({
      ...narrow,
      controlPoints: narrow.controlPoints.map((p, i) => (i === 0 ? { ...p, width: 40 } : p)),
    })

    const narrowMesh = generateTrack(narrow).roadMesh
    const wideMesh = generateTrack(wide).roadMesh

    const widthAtRing0 = (mesh: typeof narrowMesh) => {
      const left = mesh.positions[0]
      const right = mesh.positions[1]
      return Math.hypot(left.x - right.x, left.z - right.z)
    }

    expect(widthAtRing0(wideMesh)).toBeGreaterThan(widthAtRing0(narrowMesh))
  })

  it('rolls the road cross-section to match a banked control point', () => {
    const flat = validSquareTrack()
    const banked = createTrackDocument({
      ...flat,
      controlPoints: flat.controlPoints.map((p, i) => (i === 0 ? { ...p, bankingDeg: 30 } : p)),
    })

    const flatMesh = generateTrack(flat).roadMesh
    const bankedMesh = generateTrack(banked).roadMesh

    // At ring 0, banking should raise one edge and lower the other, unlike the flat case.
    expect(flatMesh.positions[0].y).toBeCloseTo(flatMesh.positions[1].y, 5)
    expect(bankedMesh.positions[0].y).not.toBeCloseTo(bankedMesh.positions[1].y, 1)
  })

  describe('curbs and barriers', () => {
    function assertNoGapClosedLoop(mesh: { positions: { x: number; z: number }[]; indices: number[]; ringCount: number }) {
      expect(mesh.positions).toHaveLength(mesh.ringCount * 2)
      expect(mesh.indices).toHaveLength(mesh.ringCount * 6)
      const lastA = (mesh.ringCount - 1) * 2
      const lastB = lastA + 1
      const closingTriangle = mesh.indices.slice(-6)
      expect(closingTriangle).toEqual([lastA, lastB, 0, lastB, 1, 0])
    }

    it('generates curb geometry along both edges spanning the full closed loop', () => {
      const { curbLeft, curbRight } = generateTrack(validSquareTrack())
      assertNoGapClosedLoop(curbLeft)
      assertNoGapClosedLoop(curbRight)
    })

    it('positions curbs just outside the road edges', () => {
      const { roadMesh, curbLeft, curbRight } = generateTrack(validSquareTrack())
      // curbLeft's inner edge (index 0) should coincide with the road's left edge (index 0).
      expect(curbLeft.positions[0]).toEqual(roadMesh.positions[0])
      expect(curbRight.positions[0]).toEqual(roadMesh.positions[1])
      // curbLeft's outer edge (index 1) should be farther from centerline than the road edge.
      const roadLeft = roadMesh.positions[0]
      const curbOuter = curbLeft.positions[1]
      expect(Math.hypot(curbOuter.x - roadLeft.x, curbOuter.z - roadLeft.z)).toBeGreaterThan(0)
    })

    it('generates barrier geometry outside the curbs spanning the full closed loop', () => {
      const { barrierLeft, barrierRight } = generateTrack(validSquareTrack())
      assertNoGapClosedLoop(barrierLeft)
      assertNoGapClosedLoop(barrierRight)
    })

    it('raises barrier geometry above its base (a vertical wall, not a flat ribbon)', () => {
      const { barrierLeft } = generateTrack(validSquareTrack())
      const base = barrierLeft.positions[0]
      const top = barrierLeft.positions[1]
      expect(top.y).toBeGreaterThan(base.y)
    })
  })

  describe('checkpoint and start-line trigger geometry', () => {
    function trackWithCheckpoints() {
      return createTrackDocument({
        controlPoints: validSquareTrack().controlPoints,
        startLine: { controlPointIndex: 0, headingDeg: 90 },
        checkpoints: [{ controlPointIndex: 2 }, { controlPointIndex: 1 }],
      })
    }

    it('orders checkpoint triggers by loop position relative to the start line, not array order', () => {
      const { checkpointTriggers } = generateTrack(trackWithCheckpoints())
      expect(checkpointTriggers.map((c) => c.controlPointIndex)).toEqual([1, 2])
    })

    it('positions each trigger spanning the road surface at its control point', () => {
      const doc = trackWithCheckpoints()
      const { roadMesh, checkpointTriggers, startLineTrigger } = generateTrack(doc)

      expect(startLineTrigger.left).toEqual(roadMesh.positions[0])
      expect(startLineTrigger.right).toEqual(roadMesh.positions[1])

      const checkpointAt1 = checkpointTriggers.find((c) => c.controlPointIndex === 1)!
      expect(checkpointAt1.left).toEqual(roadMesh.positions[1 * SAMPLES_PER_SEGMENT * 2])
      expect(checkpointAt1.right).toEqual(roadMesh.positions[1 * SAMPLES_PER_SEGMENT * 2 + 1])
    })
  })
})
