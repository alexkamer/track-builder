import type { TrackDocument } from '../track/schema'
import type { Vec3 } from '../track/spline'
import { sampleClosedCatmullRom, sampleClosedScalar } from '../track/spline'
import { validateTrack } from '../track/validation'

export const SAMPLES_PER_SEGMENT = 16
export const CURB_WIDTH = 1.5
export const BARRIER_HEIGHT = 1.2
/** How far the armco barrier's mid-height ridge folds away from the track - enough to catch light as a distinct band without stealing runoff width. */
export const BARRIER_RIDGE_DEPTH = 0.35

/**
 * Target real-world size, in world units, of one texture tile on each surface. UVs are
 * derived from actual distance (not ring index), so one tile covers this much ground
 * everywhere on the track - the same on a straight, through a corner, and across a width
 * change. Each surface gets its own size because what a tile depicts differs: a patch of
 * asphalt reads at a much larger scale than one rumble-strip block.
 */
export const ROAD_TILE_SIZE = 8
export const CURB_TILE_SIZE = 1.5
export const BARRIER_TILE_SIZE = 2
export const VERGE_TILE_SIZE = 6

/** How far the runoff verge extends outward from the barrier line before it meets the terrain. */
export const VERGE_WIDTH = 6

/** Painted edge line: its width, and how far its outer side sits inside the road's edge. */
export const EDGE_LINE_WIDTH = 0.16
export const EDGE_LINE_INSET = 0.1
/** One tile of the edge-line texture spans this far, so a dashed or solid line keeps a fixed real-world rhythm. */
export const EDGE_LINE_TILE_SIZE = 2
/** How far the terrain sits below the track's lowest point, so the road never dips into the ground. */
export const GROUND_CLEARANCE = 0.05

/** The terrain height for a track: just under its lowest point. The verge's outer edge lands exactly here, so scenery must use this same value or a step appears where they meet. */
export function groundHeightFor(centerline: Vec3[]): number {
  return centerline.reduce((min, p) => Math.min(min, p.y), 0) - GROUND_CLEARANCE
}

export interface RibbonMesh {
  /**
   * Ring `i`'s vertices are `positions[i * verticesPerRing]` through
   * `positions[i * verticesPerRing + verticesPerRing - 1]`, in cross-section order from the
   * ribbon's first profile point to its last. What those points mean depends on the ribbon:
   * the road's are its left/right edge, a curb's are its inner/outer edge, a barrier's run
   * from its inner base outward and upward over its profile.
   */
  positions: Vec3[]
  /** Triangle list, 2 triangles (6 indices) per ring per cross-section span, wrapping the last ring back to ring 0. */
  indices: number[]
  ringCount: number
  /** How many vertices each ring contributes - 2 for a flat two-edge ribbon, more for a profiled one. */
  verticesPerRing: number
  /** Texture coordinates, one per entry in `positions`. See `computeRibbonUvs`. */
  uvs: RibbonUv[]
}

export interface RibbonUv {
  u: number
  v: number
}

/**
 * The `k`-th cross-section vertex of ring `ring`. Use this rather than indexing `positions`
 * with a hardcoded stride: a ribbon's vertices-per-ring depends on its cross-section profile,
 * so `positions[ring * 2]` silently reads the wrong vertex on a profiled ribbon. `k = 0` is
 * the first profile point, which for curbs and barriers is their innermost edge.
 */
export function ringVertex(mesh: RibbonMesh, ring: number, k = 0): Vec3 {
  return mesh.positions[ring * mesh.verticesPerRing + k]
}

export interface SpawnTransform {
  position: Vec3
  headingDeg: number
}

export interface CheckpointTrigger {
  /** Index into the track's `checkpoints` array (or -1 for the start/finish line). */
  controlPointIndex: number
  /** The two points spanning the road surface at this control point, for a trigger volume/plane. */
  left: Vec3
  right: Vec3
  /** Unit direction along the track at this point. Lets a renderer extrude the trigger's line into a surface marking without recomputing the tangent, so the marking cannot drift from the trigger it represents. */
  forward: { x: number; z: number }
}

/** Every drawable surface of a track. Split out from `GeneratedTrack` so the editor's live preview can render the same surfaces as the race view without needing a start line or full validation. */
export interface TrackSurfaces {
  roadMesh: RibbonMesh
  curbLeft: RibbonMesh
  curbRight: RibbonMesh
  barrierLeft: RibbonMesh
  barrierRight: RibbonMesh
  vergeLeft: RibbonMesh
  vergeRight: RibbonMesh
  edgeLineLeft: RibbonMesh
  edgeLineRight: RibbonMesh
  centerline: Vec3[]
  /** Terrain height under this track - see `groundHeightFor`. Scenery must use this so the verge meets the ground without a step. */
  groundY: number
}

export interface GeneratedTrack extends TrackSurfaces {
  spawn: SpawnTransform
  /** Road banking in radians, one entry per `centerline` ring - positive banks the left edge up. */
  bankingRad: number[]
  startLineTrigger: CheckpointTrigger
  checkpointTriggers: CheckpointTrigger[]
}

/**
 * Pure, deterministic conversion of a track definition into road geometry. Callers must
 * only pass tracks that have already passed validation (see domain/track/validation).
 */
export class TrackNotValidatedError extends Error {
  constructor() {
    super('Cannot generate a 3D track from a track definition that has not passed validation.')
  }
}

interface RingFrame {
  curr: Vec3
  normalX: number
  normalZ: number
  halfWidth: number
  bankingRad: number
}

function computeRingFrames(doc: TrackDocument, centerline: Vec3[]): RingFrame[] {
  const ringCount = centerline.length
  const widths = sampleClosedScalar(doc.controlPoints.map((p) => p.width), SAMPLES_PER_SEGMENT)
  const bankingsDeg = sampleClosedScalar(doc.controlPoints.map((p) => p.bankingDeg), SAMPLES_PER_SEGMENT)

  const frames: RingFrame[] = []
  for (let i = 0; i < ringCount; i++) {
    const curr = centerline[i]
    const next = centerline[(i + 1) % ringCount]
    const prev = centerline[(i - 1 + ringCount) % ringCount]

    const tangentX = next.x - prev.x
    const tangentZ = next.z - prev.z
    const len = Math.hypot(tangentX, tangentZ) || 1

    frames.push({
      curr,
      normalX: -tangentZ / len,
      normalZ: tangentX / len,
      halfWidth: widths[i] / 2,
      bankingRad: (bankingsDeg[i] * Math.PI) / 180,
    })
  }
  return frames
}

/** A point offset `distance` from the centerline along the banked cross-section, `side` = 1 (left) or -1 (right). */
function offsetAt(frame: RingFrame, side: 1 | -1, distance: number): Vec3 {
  const horizontalScale = Math.cos(frame.bankingRad) * distance
  const verticalOffset = Math.sin(frame.bankingRad) * distance
  return {
    x: frame.curr.x + frame.normalX * horizontalScale * side,
    y: frame.curr.y + verticalOffset * side,
    z: frame.curr.z + frame.normalZ * horizontalScale * side,
  }
}

/**
 * One vertex of a ribbon's cross-section, as a function of the ring it sits on.
 * `lateralDistance` is measured from the centerline along the banked cross-section (so it
 * rolls with the road), while `heightOffset` is added afterward along world up - which is
 * what lets a barrier stand vertically on a banked section instead of leaning with it.
 */
type CrossSectionPoint = (frame: RingFrame) => {
  lateralDistance: number
  heightOffset: number
  /** When set, pins the vertex to this world height instead of offsetting from the banked cross-section - used to land the verge's outer edge exactly on the terrain. */
  absoluteHeight?: number
}

function distance3(a: Vec3, b: Vec3): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
}

/**
 * Texture coordinates derived from real distance along and across the ribbon, so a tiled
 * texture holds a constant real-world scale everywhere.
 *
 * `v` accumulates arc length along each cross-section point's own path through the rings,
 * measured independently per point rather than from the centerline. In a corner the inner and
 * outer edges genuinely differ in length, so sharing one centerline-derived `v` would shear
 * the texture; per-edge arc length instead keeps every tile square and bows the lateral lines
 * slightly, which is how real tarmac laid in longitudinal strips actually looks.
 *
 * `u` accumulates distance across the cross-section in world units (not normalized to 0..1),
 * which is what keeps tile size fixed when the track widens instead of stretching to fit.
 *
 * Each edge's tile length is then nudged to divide its total loop length a whole number of
 * times. Without that, `v` jumps from its final value back to 0 at the loop closure and the
 * texture visibly tears in the one strip that spans the seam.
 */
function computeRibbonUvs(
  positions: Vec3[],
  ringCount: number,
  verticesPerRing: number,
  tileSize: number,
): RibbonUv[] {
  const vertexAt = (ring: number, k: number) => positions[ring * verticesPerRing + k]

  const vByPoint: number[][] = []
  for (let k = 0; k < verticesPerRing; k++) {
    const cumulative: number[] = [0]
    for (let ring = 1; ring < ringCount; ring++) {
      cumulative.push(cumulative[ring - 1] + distance3(vertexAt(ring - 1, k), vertexAt(ring, k)))
    }
    const loopLength = cumulative[ringCount - 1] + distance3(vertexAt(ringCount - 1, k), vertexAt(0, k))
    const wholeTiles = Math.max(1, Math.round(loopLength / tileSize))
    const effectiveTile = loopLength / wholeTiles
    vByPoint.push(cumulative.map((length) => length / effectiveTile))
  }

  const uvs: RibbonUv[] = []
  for (let ring = 0; ring < ringCount; ring++) {
    let across = 0
    for (let k = 0; k < verticesPerRing; k++) {
      if (k > 0) across += distance3(vertexAt(ring, k - 1), vertexAt(ring, k))
      uvs.push({ u: across / tileSize, v: vByPoint[k][ring] })
    }
  }
  return uvs
}

/**
 * Builds a ribbon by sweeping an ordered cross-section profile along the ring frames. A
 * two-point profile yields the flat ribbons the road and curbs use; more points yield a
 * profiled surface (see `buildBarrierMesh`). Triangulation strips between consecutive
 * profile points and wraps the last ring back to ring 0, so the result is always a closed
 * loop with no seam.
 */
function buildRibbon(
  frames: RingFrame[],
  side: 1 | -1,
  profile: CrossSectionPoint[],
  tileSize: number,
): RibbonMesh {
  const ringCount = frames.length
  const verticesPerRing = profile.length

  const positions: Vec3[] = []
  for (const frame of frames) {
    for (const point of profile) {
      const { lateralDistance, heightOffset, absoluteHeight } = point(frame)
      const base = offsetAt(frame, side, lateralDistance)
      if (absoluteHeight !== undefined) {
        positions.push({ ...base, y: absoluteHeight })
      } else {
        positions.push(heightOffset === 0 ? base : { ...base, y: base.y + heightOffset })
      }
    }
  }

  const indices: number[] = []
  for (let i = 0; i < ringCount; i++) {
    const next = (i + 1) % ringCount
    for (let k = 0; k < verticesPerRing - 1; k++) {
      const a0 = i * verticesPerRing + k
      const b0 = a0 + 1
      const a1 = next * verticesPerRing + k
      const b1 = a1 + 1
      indices.push(a0, b0, a1)
      indices.push(b0, b1, a1)
    }
  }

  return {
    positions,
    indices,
    ringCount,
    verticesPerRing,
    uvs: computeRibbonUvs(positions, ringCount, verticesPerRing, tileSize),
  }
}

function buildRoadMesh(frames: RingFrame[]): RibbonMesh {
  // The road spans both sides of the centerline, so it sweeps with side = 1 and reaches the
  // right edge via a negative lateral distance (which `offsetAt` mirrors identically).
  return buildRibbon(
    frames,
    1,
    [
      (f) => ({ lateralDistance: f.halfWidth, heightOffset: 0 }),
      (f) => ({ lateralDistance: -f.halfWidth, heightOffset: 0 }),
    ],
    ROAD_TILE_SIZE,
  )
}

function buildCurbMesh(frames: RingFrame[], side: 1 | -1): RibbonMesh {
  return buildRibbon(
    frames,
    side,
    [
      (f) => ({ lateralDistance: f.halfWidth, heightOffset: 0 }),
      (f) => ({ lateralDistance: f.halfWidth + CURB_WIDTH, heightOffset: 0 }),
    ],
    CURB_TILE_SIZE,
  )
}

/**
 * An armco-style barrier cross-section: it rises from the curb's outer edge, folds outward
 * into a ridge partway up, then returns to the same lateral offset at the top. Every point
 * except the ridge sits at the barrier's inner lateral offset, and the ridge folds *away*
 * from the track, so the innermost face - the wall the car collides with - stays exactly
 * where the old flat barrier was (see `resolveBarrierCollision`).
 */
function buildBarrierMesh(frames: RingFrame[], side: 1 | -1): RibbonMesh {
  const innerDistance = (f: RingFrame) => f.halfWidth + CURB_WIDTH
  return buildRibbon(
    frames,
    side,
    [
      (f) => ({ lateralDistance: innerDistance(f), heightOffset: 0 }),
      (f) => ({ lateralDistance: innerDistance(f), heightOffset: BARRIER_HEIGHT * 0.4 }),
      (f) => ({ lateralDistance: innerDistance(f) + BARRIER_RIDGE_DEPTH, heightOffset: BARRIER_HEIGHT * 0.7 }),
      (f) => ({ lateralDistance: innerDistance(f), heightOffset: BARRIER_HEIGHT }),
    ],
    BARRIER_TILE_SIZE,
  )
}

/**
 * The painted line along a road edge. It sits just inside the road surface and shares the
 * road's banked cross-section, so it is coplanar with the tarmac - the renderer offsets it in
 * depth rather than lifting it, which would make it float on a banked section.
 */
function buildEdgeLineMesh(frames: RingFrame[], side: 1 | -1): RibbonMesh {
  return buildRibbon(
    frames,
    side,
    [
      (f) => ({ lateralDistance: f.halfWidth - EDGE_LINE_INSET - EDGE_LINE_WIDTH, heightOffset: 0 }),
      (f) => ({ lateralDistance: f.halfWidth - EDGE_LINE_INSET, heightOffset: 0 }),
    ],
    EDGE_LINE_TILE_SIZE,
  )
}

/**
 * The runoff strip bridging the barrier line to the surrounding terrain. Its inner edge sits
 * on the barrier's base so the two share an edge (no gap), and its outer edge is pinned to the
 * terrain height so there is no step where they meet - which on an elevated or banked section
 * makes it an embankment sloping down to ground rather than a flat skirt floating in the air.
 */
function buildVergeMesh(frames: RingFrame[], side: 1 | -1, groundY: number): RibbonMesh {
  return buildRibbon(
    frames,
    side,
    [
      (f) => ({ lateralDistance: f.halfWidth + CURB_WIDTH, heightOffset: 0 }),
      (f) => ({ lateralDistance: f.halfWidth + CURB_WIDTH + VERGE_WIDTH, heightOffset: 0, absoluteHeight: groundY }),
    ],
    VERGE_TILE_SIZE,
  )
}

function buildCheckpointTrigger(frames: RingFrame[], ringIndex: number, controlPointIndex: number): CheckpointTrigger {
  const frame = frames[ringIndex]
  return {
    controlPointIndex,
    left: offsetAt(frame, 1, frame.halfWidth),
    right: offsetAt(frame, -1, frame.halfWidth),
    // computeRingFrames stores the left-hand normal, so the along-track tangent is its perpendicular.
    forward: { x: frame.normalZ, z: -frame.normalX },
  }
}

function sampleCenterline(doc: TrackDocument): Vec3[] {
  return sampleClosedCatmullRom(
    doc.controlPoints.map((p) => ({ x: p.x, y: p.elevation, z: p.z })),
    SAMPLES_PER_SEGMENT,
  )
}

/** Every drawable surface for a centerline, shared by full generation and the live preview so the two can never drift apart visually. */
function buildTrackSurfaces(frames: RingFrame[], centerline: Vec3[]): TrackSurfaces {
  const groundY = groundHeightFor(centerline)
  return {
    roadMesh: buildRoadMesh(frames),
    curbLeft: buildCurbMesh(frames, 1),
    curbRight: buildCurbMesh(frames, -1),
    barrierLeft: buildBarrierMesh(frames, 1),
    barrierRight: buildBarrierMesh(frames, -1),
    vergeLeft: buildVergeMesh(frames, 1, groundY),
    vergeRight: buildVergeMesh(frames, -1, groundY),
    edgeLineLeft: buildEdgeLineMesh(frames, 1),
    edgeLineRight: buildEdgeLineMesh(frames, -1),
    centerline,
    groundY,
  }
}

export function generateTrack(doc: TrackDocument): GeneratedTrack {
  if (validateTrack(doc).length > 0) {
    throw new TrackNotValidatedError()
  }

  const centerline = sampleCenterline(doc)
  const frames = computeRingFrames(doc, centerline)
  const surfaces = buildTrackSurfaces(frames, centerline)
  const spawn = computeSpawnTransform(doc)

  const startLineTrigger = buildCheckpointTrigger(
    frames,
    doc.startLine.controlPointIndex * SAMPLES_PER_SEGMENT,
    doc.startLine.controlPointIndex,
  )
  const checkpointTriggers = [...doc.checkpoints]
    .sort((a, b) => loopOrder(a.controlPointIndex, doc) - loopOrder(b.controlPointIndex, doc))
    .map((c) => buildCheckpointTrigger(frames, c.controlPointIndex * SAMPLES_PER_SEGMENT, c.controlPointIndex))

  return {
    ...surfaces,
    spawn,
    bankingRad: frames.map((f) => f.bankingRad),
    startLineTrigger,
    checkpointTriggers,
  }
}

function loopOrder(controlPointIndex: number, doc: TrackDocument): number {
  const n = doc.controlPoints.length
  const start = doc.startLine.controlPointIndex
  return (controlPointIndex - start + n) % n
}

/**
 * Builds every track surface for live-preview purposes while the track is still being edited,
 * requiring only the closed-loop minimum (3+ control points) rather than full validation
 * (which also needs a start line). Returns null until that minimum is met.
 *
 * Shares `buildTrackSurfaces` with full generation so the preview shows the same road, curbs,
 * barriers, and verge the player will drive, rather than a road-only approximation of it.
 */
export function generateScenePreview(doc: TrackDocument): TrackSurfaces | null {
  if (doc.controlPoints.length < 3) return null
  const centerline = sampleCenterline(doc)
  return buildTrackSurfaces(computeRingFrames(doc, centerline), centerline)
}

function computeSpawnTransform(doc: TrackDocument): SpawnTransform {
  const controlPoint = doc.controlPoints[doc.startLine.controlPointIndex]
  if (!controlPoint) {
    return { position: { x: 0, y: 0, z: 0 }, headingDeg: 0 }
  }
  return {
    position: { x: controlPoint.x, y: controlPoint.elevation, z: controlPoint.z },
    headingDeg: doc.startLine.headingDeg,
  }
}
