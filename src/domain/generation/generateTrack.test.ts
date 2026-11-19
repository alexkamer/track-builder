import { describe, expect, it } from 'vitest'
import { createControlPoint, createTrackDocument } from '../track/schema'
import { generateTrack, SAMPLES_PER_SEGMENT, TrackNotValidatedError, type RibbonMesh } from './generateTrack'

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
      // Elevated enough that banking doesn't tilt an edge below ground (see
      // validateGroundClearance): halfWidth 5 * sin(30deg) = 2.5 units of tilt.
      controlPoints: flat.controlPoints.map((p, i) => (i === 0 ? { ...p, elevation: 10, bankingDeg: 30 } : p)),
    })

    const flatMesh = generateTrack(flat).roadMesh
    const bankedMesh = generateTrack(banked).roadMesh

    // At ring 0, banking should raise one edge and lower the other, unlike the flat case.
    expect(flatMesh.positions[0].y).toBeCloseTo(flatMesh.positions[1].y, 5)
    expect(bankedMesh.positions[0].y).not.toBeCloseTo(bankedMesh.positions[1].y, 1)
  })

  describe('curbs and barriers', () => {
    /** Works for any cross-section width: a ribbon contributes `verticesPerRing` vertices and
     *  `(verticesPerRing - 1)` triangle strips per ring, and its final strip must wrap back to ring 0. */
    function assertNoGapClosedLoop(mesh: RibbonMesh) {
      const v = mesh.verticesPerRing
      expect(mesh.positions).toHaveLength(mesh.ringCount * v)
      expect(mesh.indices).toHaveLength(mesh.ringCount * (v - 1) * 6)

      const lastA = (mesh.ringCount - 1) * v + (v - 2)
      const lastB = lastA + 1
      const closingTriangle = mesh.indices.slice(-6)
      expect(closingTriangle).toEqual([lastA, lastB, v - 2, lastB, v - 1, v - 2])
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
      const top = barrierLeft.positions[barrierLeft.verticesPerRing - 1]
      expect(top.y).toBeGreaterThan(base.y)
    })

    it('gives barriers a profiled cross-section rather than a single flat face', () => {
      const { barrierLeft, barrierRight } = generateTrack(validSquareTrack())

      expect(barrierLeft.verticesPerRing).toBeGreaterThan(2)
      expect(barrierRight.verticesPerRing).toBe(barrierLeft.verticesPerRing)

      // The profile must actually leave the inner face at some height, or it is still flat.
      const { centerline } = generateTrack(validSquareTrack())
      const lateralSpread = new Set(
        Array.from({ length: barrierLeft.verticesPerRing }, (_, k) => {
          const p = barrierLeft.positions[k]
          return Math.hypot(p.x - centerline[0].x, p.z - centerline[0].z).toFixed(4)
        }),
      )
      expect(lateralSpread.size).toBeGreaterThan(1)
    })

    it('keeps the barrier inner face at the curb outer edge, with no profile point inside it', () => {
      const { curbLeft, curbRight, barrierLeft, barrierRight, centerline } = generateTrack(validSquareTrack())

      for (const [curb, barrier] of [
        [curbLeft, barrierLeft],
        [curbRight, barrierRight],
      ] as const) {
        const v = barrier.verticesPerRing

        for (let ring = 0; ring < barrier.ringCount; ring++) {
          // The collision boundary: the barrier's first profile point is the curb's outer edge.
          expect(barrier.positions[ring * v]).toEqual(curb.positions[ring * 2 + 1])

          // No profile point may fold toward the track - that would move the wall the car hits.
          const center = centerline[ring]
          const innerDistance = Math.hypot(
            barrier.positions[ring * v].x - center.x,
            barrier.positions[ring * v].z - center.z,
          )
          for (let k = 1; k < v; k++) {
            const p = barrier.positions[ring * v + k]
            const distance = Math.hypot(p.x - center.x, p.z - center.z)
            expect(distance).toBeGreaterThanOrEqual(innerDistance - 1e-9)
          }
        }
      }
    })
  })

  describe('runoff verge', () => {
    function assertClosedLoop(mesh: RibbonMesh) {
      const v = mesh.verticesPerRing
      expect(mesh.positions).toHaveLength(mesh.ringCount * v)
      expect(mesh.indices).toHaveLength(mesh.ringCount * (v - 1) * 6)
      const lastA = (mesh.ringCount - 1) * v + (v - 2)
      expect(mesh.indices.slice(-6)).toEqual([lastA, lastA + 1, v - 2, lastA + 1, v - 1, v - 2])
    }

    it('generates verge geometry outside the barriers for the full closed loop', () => {
      const { vergeLeft, vergeRight } = generateTrack(validSquareTrack())
      assertClosedLoop(vergeLeft)
      assertClosedLoop(vergeRight)
      expect(vergeLeft.ringCount).toBeGreaterThan(0)
    })

    it('shares its inner edge with the barrier base, leaving no gap between them', () => {
      const { barrierLeft, barrierRight, vergeLeft, vergeRight } = generateTrack(validSquareTrack())

      for (const [barrier, verge] of [
        [barrierLeft, vergeLeft],
        [barrierRight, vergeRight],
      ] as const) {
        for (let ring = 0; ring < verge.ringCount; ring++) {
          expect(verge.positions[ring * verge.verticesPerRing]).toEqual(
            barrier.positions[ring * barrier.verticesPerRing],
          )
        }
      }
    })

    it('lands its outer edge exactly on the terrain height, with no vertical step', () => {
      const doc = createTrackDocument({
        ...validSquareTrack(),
        controlPoints: validSquareTrack().controlPoints.map((p, i) =>
          i === 1 ? { ...p, elevation: 12 } : p,
        ),
      })
      const { vergeLeft, vergeRight, groundY } = generateTrack(doc)

      for (const verge of [vergeLeft, vergeRight]) {
        for (let ring = 0; ring < verge.ringCount; ring++) {
          const outer = verge.positions[ring * verge.verticesPerRing + verge.verticesPerRing - 1]
          expect(outer.y).toBeCloseTo(groundY, 10)
        }
      }
    })

    it('follows the road up an elevation change rather than staying at one flat height', () => {
      const doc = createTrackDocument({
        ...validSquareTrack(),
        controlPoints: validSquareTrack().controlPoints.map((p, i) =>
          i === 1 ? { ...p, elevation: 12 } : p,
        ),
      })
      const { vergeLeft } = generateTrack(doc)

      const innerHeights = Array.from(
        { length: vergeLeft.ringCount },
        (_, ring) => vergeLeft.positions[ring * vergeLeft.verticesPerRing].y,
      )
      expect(Math.max(...innerHeights) - Math.min(...innerHeights)).toBeGreaterThan(5)
    })
  })

  describe('arc-length texture coordinates', () => {
    /** Distance between consecutive rings along one cross-section point's own path. */
    function edgeStepLength(mesh: RibbonMesh, ring: number, k: number): number {
      const a = mesh.positions[ring * mesh.verticesPerRing + k]
      const b = mesh.positions[((ring + 1) % mesh.ringCount) * mesh.verticesPerRing + k]
      return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
    }

    function vAt(mesh: RibbonMesh, ring: number, k: number): number {
      return mesh.uvs[ring * mesh.verticesPerRing + k].v
    }

    function uAt(mesh: RibbonMesh, ring: number, k: number): number {
      return mesh.uvs[ring * mesh.verticesPerRing + k].u
    }

    it('assigns one uv per position', () => {
      const { roadMesh, curbLeft, barrierLeft } = generateTrack(validSquareTrack())
      for (const mesh of [roadMesh, curbLeft, barrierLeft]) {
        expect(mesh.uvs).toHaveLength(mesh.positions.length)
      }
    })

    it('advances v in proportion to real distance travelled, not ring index', () => {
      // A square track's rings are unevenly spaced: the Catmull-Rom sampler bunches them up
      // through the corners and spreads them along the straights. Index-based v (the old
      // `ring * TEXTURE_V_SCALE`) gives every ring the same v step regardless, which is
      // exactly the compression this test rules out.
      const { roadMesh } = generateTrack(validSquareTrack())

      const ratios: number[] = []
      for (let ring = 0; ring < roadMesh.ringCount - 1; ring++) {
        const step = edgeStepLength(roadMesh, ring, 0)
        const deltaV = vAt(roadMesh, ring + 1, 0) - vAt(roadMesh, ring, 0)
        ratios.push(deltaV / step)
      }

      // Ring spacing really does vary (otherwise this test would prove nothing).
      const steps = Array.from({ length: roadMesh.ringCount - 1 }, (_, r) => edgeStepLength(roadMesh, r, 0))
      expect(Math.max(...steps) / Math.min(...steps)).toBeGreaterThan(1.1)

      // ...yet v per unit distance is constant, on the straights and through the corners alike.
      for (const ratio of ratios) {
        expect(ratio).toBeCloseTo(ratios[0], 6)
      }
    })

    it('gives equal real-world distances equal v deltas on both a straight and a tight corner', () => {
      const { roadMesh } = generateTrack(validSquareTrack())

      const straightest = { ring: 0, step: 0, ratio: 0 }
      const tightest = { ring: 0, step: Infinity, ratio: 0 }
      for (let ring = 0; ring < roadMesh.ringCount - 1; ring++) {
        const step = edgeStepLength(roadMesh, ring, 0)
        const ratio = (vAt(roadMesh, ring + 1, 0) - vAt(roadMesh, ring, 0)) / step
        if (step > straightest.step) Object.assign(straightest, { ring, step, ratio })
        if (step < tightest.step) Object.assign(tightest, { ring, step, ratio })
      }

      expect(tightest.ratio).toBeCloseTo(straightest.ratio, 6)
    })

    it('closes the uv loop on a whole number of tiles so the seam does not tear', () => {
      const { roadMesh } = generateTrack(validSquareTrack())
      const lastRing = roadMesh.ringCount - 1
      const perUnit =
        (vAt(roadMesh, 1, 0) - vAt(roadMesh, 0, 0)) / edgeStepLength(roadMesh, 0, 0)
      const vAtClosure = vAt(roadMesh, lastRing, 0) + edgeStepLength(roadMesh, lastRing, 0) * perUnit

      expect(vAtClosure).toBeCloseTo(Math.round(vAtClosure), 6)
      expect(vAtClosure).toBeGreaterThan(1)
    })

    it('keeps u spacing constant in world units between a narrow and a wide section', () => {
      const narrowDoc = validSquareTrack()
      const wideDoc = createTrackDocument({
        ...narrowDoc,
        controlPoints: narrowDoc.controlPoints.map((p, i) => (i === 0 ? { ...p, width: 40 } : p)),
      })

      const narrow = generateTrack(narrowDoc).roadMesh
      const wide = generateTrack(wideDoc).roadMesh

      const uSpanPerMetre = (mesh: RibbonMesh) => {
        const left = mesh.positions[0]
        const right = mesh.positions[1]
        const width = Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z)
        return (uAt(mesh, 0, 1) - uAt(mesh, 0, 0)) / width
      }

      // Ring 0 is genuinely wider in the second track...
      const widthOf = (mesh: RibbonMesh) =>
        Math.hypot(mesh.positions[0].x - mesh.positions[1].x, mesh.positions[0].z - mesh.positions[1].z)
      expect(widthOf(wide)).toBeGreaterThan(widthOf(narrow) * 1.5)

      // ...but a texture tile still covers the same amount of ground across it. Normalizing u
      // to 0..1 across the ribbon would make these differ by the width ratio.
      expect(uSpanPerMetre(wide)).toBeCloseTo(uSpanPerMetre(narrow), 6)
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
