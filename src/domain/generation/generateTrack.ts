import type { TrackDocument } from '../track/schema'
import type { Vec3 } from '../track/spline'
import { sampleClosedCatmullRom, sampleClosedScalar } from '../track/spline'
import { validateTrack } from '../track/validation'

export const SAMPLES_PER_SEGMENT = 16
export const CURB_WIDTH = 1.5
export const BARRIER_HEIGHT = 1.2

export interface RibbonMesh {
  /** For each ring `i`, `positions[i * 2]` and `positions[i * 2 + 1]` are its two vertices (meaning depends on the ribbon - road left/right edge, curb inner/outer edge, barrier base/top). */
  positions: Vec3[]
  /** Triangle list, 2 triangles (6 indices) per ring connecting it to the next, wrapping the last ring back to ring 0. */
  indices: number[]
  ringCount: number
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
}

export interface GeneratedTrack {
  roadMesh: RibbonMesh
  curbLeft: RibbonMesh
  curbRight: RibbonMesh
  barrierLeft: RibbonMesh
  barrierRight: RibbonMesh
  spawn: SpawnTransform
  centerline: Vec3[]
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

function buildRibbon(
  frames: RingFrame[],
  pointA: (frame: RingFrame) => Vec3,
  pointB: (frame: RingFrame) => Vec3,
): RibbonMesh {
  const ringCount = frames.length
  const positions: Vec3[] = []
  for (const frame of frames) {
    positions.push(pointA(frame), pointB(frame))
  }

  const indices: number[] = []
  for (let i = 0; i < ringCount; i++) {
    const next = (i + 1) % ringCount
    const a0 = i * 2
    const b0 = i * 2 + 1
    const a1 = next * 2
    const b1 = next * 2 + 1
    indices.push(a0, b0, a1)
    indices.push(b0, b1, a1)
  }

  return { positions, indices, ringCount }
}

function buildRoadMesh(frames: RingFrame[]): RibbonMesh {
  return buildRibbon(
    frames,
    (f) => offsetAt(f, 1, f.halfWidth),
    (f) => offsetAt(f, -1, f.halfWidth),
  )
}

function buildCurbMesh(frames: RingFrame[], side: 1 | -1): RibbonMesh {
  return buildRibbon(
    frames,
    (f) => offsetAt(f, side, f.halfWidth),
    (f) => offsetAt(f, side, f.halfWidth + CURB_WIDTH),
  )
}

function buildBarrierMesh(frames: RingFrame[], side: 1 | -1): RibbonMesh {
  return buildRibbon(
    frames,
    (f) => offsetAt(f, side, f.halfWidth + CURB_WIDTH),
    (f) => {
      const base = offsetAt(f, side, f.halfWidth + CURB_WIDTH)
      return { ...base, y: base.y + BARRIER_HEIGHT }
    },
  )
}

function buildCheckpointTrigger(frames: RingFrame[], ringIndex: number, controlPointIndex: number): CheckpointTrigger {
  const frame = frames[ringIndex]
  return {
    controlPointIndex,
    left: offsetAt(frame, 1, frame.halfWidth),
    right: offsetAt(frame, -1, frame.halfWidth),
  }
}

export function generateTrack(doc: TrackDocument): GeneratedTrack {
  if (validateTrack(doc).length > 0) {
    throw new TrackNotValidatedError()
  }

  const centerline = sampleClosedCatmullRom(
    doc.controlPoints.map((p) => ({ x: p.x, y: p.elevation, z: p.z })),
    SAMPLES_PER_SEGMENT,
  )
  const frames = computeRingFrames(doc, centerline)

  const roadMesh = buildRoadMesh(frames)
  const curbLeft = buildCurbMesh(frames, 1)
  const curbRight = buildCurbMesh(frames, -1)
  const barrierLeft = buildBarrierMesh(frames, 1)
  const barrierRight = buildBarrierMesh(frames, -1)
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
    roadMesh,
    curbLeft,
    curbRight,
    barrierLeft,
    barrierRight,
    spawn,
    centerline,
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
 * Builds just the road mesh for live-preview purposes while the track is still being
 * edited, requiring only the closed-loop minimum (3+ control points) rather than full
 * validation (which also needs a start line). Returns null until that minimum is met.
 */
export function generateRoadMeshPreview(doc: TrackDocument): RibbonMesh | null {
  if (doc.controlPoints.length < 3) return null
  const centerline = sampleClosedCatmullRom(
    doc.controlPoints.map((p) => ({ x: p.x, y: p.elevation, z: p.z })),
    SAMPLES_PER_SEGMENT,
  )
  return buildRoadMesh(computeRingFrames(doc, centerline))
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
