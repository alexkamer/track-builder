import type { TrackDocument } from './schema'
import { UNSET_START_LINE } from './schema'
import { sampleClosedCatmullRom } from './spline'
import { achievableTurnRadius } from '../physics/carPhysics'

export const MIN_CONTROL_POINTS = 3
/**
 * Margin above the car's bare achievable turn radius (see `achievableTurnRadius`):
 * real driving rarely holds the exact theoretical steering limit through a corner, so the
 * validated minimum needs headroom for an imperfect line, late braking, or drift correction.
 */
const CORNER_RADIUS_SAFETY_MARGIN = 1.4
export const MIN_CORNER_RADIUS = achievableTurnRadius() * CORNER_RADIUS_SAFETY_MARGIN
export const VALIDATION_SAMPLES_PER_SEGMENT = 16
/** Segments within this index distance (wrapping) of each other share an endpoint region and are never flagged as crossing. */
const ADJACENT_SEGMENT_WINDOW = 2

export type ValidationErrorCode =
  | 'CLOSED_LOOP_TOO_FEW_POINTS'
  | 'SELF_INTERSECTION'
  | 'CORNER_RADIUS_TOO_TIGHT'
  | 'START_LINE_MISSING'

export interface ValidationError {
  code: ValidationErrorCode
  message: string
}

export function validateClosedLoop(doc: TrackDocument): ValidationError | null {
  if (doc.controlPoints.length < MIN_CONTROL_POINTS) {
    return {
      code: 'CLOSED_LOOP_TOO_FEW_POINTS',
      message: `A track needs at least ${MIN_CONTROL_POINTS} control points to form a closed loop (currently ${doc.controlPoints.length}).`,
    }
  }
  return null
}

export function validateStartLine(doc: TrackDocument): ValidationError | null {
  const { controlPointIndex } = doc.startLine
  if (
    controlPointIndex === UNSET_START_LINE ||
    controlPointIndex < 0 ||
    controlPointIndex >= doc.controlPoints.length
  ) {
    return {
      code: 'START_LINE_MISSING',
      message: 'A start/finish line must be set on exactly one control point.',
    }
  }
  return null
}

interface Segment2D {
  x1: number
  z1: number
  x2: number
  z2: number
}

const INTERSECTION_EPSILON = 1e-9

function segmentsIntersect(a: Segment2D, b: Segment2D): boolean {
  const d1x = a.x2 - a.x1
  const d1z = a.z2 - a.z1
  const d2x = b.x2 - b.x1
  const d2z = b.z2 - b.z1

  const denom = d1x * d2z - d1z * d2x
  if (denom === 0) return false // parallel (or collinear) - treat as non-crossing for this purpose

  const t = ((b.x1 - a.x1) * d2z - (b.z1 - a.z1) * d2x) / denom
  const u = ((b.x1 - a.x1) * d1z - (b.z1 - a.z1) * d1x) / denom

  // Inclusive bounds (with tolerance) so a crossing that lands exactly on a sampled
  // point - e.g. the curve looping back through the same coordinate - still counts;
  // segments that merely share an adjacent endpoint are filtered out by the caller.
  return (
    t >= -INTERSECTION_EPSILON &&
    t <= 1 + INTERSECTION_EPSILON &&
    u >= -INTERSECTION_EPSILON &&
    u <= 1 + INTERSECTION_EPSILON
  )
}

function ringDistance(i: number, j: number, n: number): number {
  const diff = Math.abs(i - j)
  return Math.min(diff, n - diff)
}

export function validateSelfIntersection(doc: TrackDocument): ValidationError | null {
  if (doc.controlPoints.length < MIN_CONTROL_POINTS) return null // closed-loop check owns this case

  const curve = sampleClosedCatmullRom(
    doc.controlPoints.map((p) => ({ x: p.x, y: 0, z: p.z })),
    VALIDATION_SAMPLES_PER_SEGMENT,
  )
  const n = curve.length
  const segments: Segment2D[] = curve.map((p, i) => {
    const next = curve[(i + 1) % n]
    return { x1: p.x, z1: p.z, x2: next.x, z2: next.z }
  })

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (ringDistance(i, j, n) <= ADJACENT_SEGMENT_WINDOW) continue
      if (segmentsIntersect(segments[i], segments[j])) {
        return {
          code: 'SELF_INTERSECTION',
          message: 'The track crosses itself. Adjust the control points so the loop does not overlap.',
        }
      }
    }
  }
  return null
}

/** Circumradius of the circle through three points; Infinity for (near-)collinear points, i.e. a straight line. */
function circumradius(p0: { x: number; z: number }, p1: { x: number; z: number }, p2: { x: number; z: number }): number {
  const a = Math.hypot(p1.x - p0.x, p1.z - p0.z)
  const b = Math.hypot(p2.x - p1.x, p2.z - p1.z)
  const c = Math.hypot(p0.x - p2.x, p0.z - p2.z)

  const area = Math.abs((p1.x - p0.x) * (p2.z - p0.z) - (p2.x - p0.x) * (p1.z - p0.z)) / 2
  if (area < 1e-9) return Infinity

  return (a * b * c) / (4 * area)
}

export function validateCornerRadius(doc: TrackDocument): ValidationError | null {
  if (doc.controlPoints.length < MIN_CONTROL_POINTS) return null // closed-loop check owns this case

  const curve = sampleClosedCatmullRom(
    doc.controlPoints.map((p) => ({ x: p.x, y: 0, z: p.z })),
    VALIDATION_SAMPLES_PER_SEGMENT,
  )
  const n = curve.length

  for (let i = 0; i < n; i++) {
    const prev = curve[(i - 1 + n) % n]
    const curr = curve[i]
    const next = curve[(i + 1) % n]
    if (circumradius(prev, curr, next) < MIN_CORNER_RADIUS) {
      return {
        code: 'CORNER_RADIUS_TOO_TIGHT',
        message: `A corner is tighter than the minimum turning radius of ${MIN_CORNER_RADIUS} units. Widen that curve.`,
      }
    }
  }
  return null
}

/** Minimal validation for the vertical slice: closed loop + start line only. */
export function validateTrackMinimal(doc: TrackDocument): ValidationError[] {
  return [validateClosedLoop(doc), validateStartLine(doc)].filter(
    (e): e is ValidationError => e !== null,
  )
}

/** The full set of checks a track must pass to be raceable or generated. */
export function validateTrack(doc: TrackDocument): ValidationError[] {
  return [
    validateClosedLoop(doc),
    validateSelfIntersection(doc),
    validateCornerRadius(doc),
    validateStartLine(doc),
  ].filter((e): e is ValidationError => e !== null)
}
