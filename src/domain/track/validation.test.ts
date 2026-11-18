import { describe, expect, it } from 'vitest'
import { createControlPoint, createTrackDocument } from './schema'
import { achievableTurnRadius } from '../physics/carPhysics'
import {
  MIN_CORNER_RADIUS,
  validateClosedLoop,
  validateCornerRadius,
  validateSelfIntersection,
  validateStartLine,
  validateTrack,
  validateTrackMinimal,
} from './validation'

function threePointLoop() {
  return [
    createControlPoint({ x: 0, z: 0 }),
    createControlPoint({ x: 10, z: 0 }),
    createControlPoint({ x: 5, z: 10 }),
  ]
}

function largeSmoothSquare() {
  return [
    createControlPoint({ x: 0, z: 0 }),
    createControlPoint({ x: 200, z: 0 }),
    createControlPoint({ x: 200, z: 200 }),
    createControlPoint({ x: 0, z: 200 }),
  ]
}

function bowtieTrack() {
  // Connecting these corners in this order crosses the loop over itself, like an hourglass.
  return [
    createControlPoint({ x: 0, z: 0 }),
    createControlPoint({ x: 100, z: 0 }),
    createControlPoint({ x: 0, z: 100 }),
    createControlPoint({ x: 100, z: 100 }),
  ]
}

function sharpSpikeTrack() {
  // A ~100x1 sliver: the short ends force a near-U-turn with a tiny turning radius.
  return [
    createControlPoint({ x: 0, z: 0 }),
    createControlPoint({ x: 50, z: 0 }),
    createControlPoint({ x: 50, z: 1 }),
    createControlPoint({ x: 0, z: 1 }),
  ]
}

describe('validateClosedLoop', () => {
  it('passes with 3 or more control points', () => {
    const doc = createTrackDocument({ controlPoints: threePointLoop() })
    expect(validateClosedLoop(doc)).toBeNull()
  })

  it('fails with fewer than 3 control points', () => {
    const doc = createTrackDocument({
      controlPoints: [createControlPoint(), createControlPoint()],
    })
    expect(validateClosedLoop(doc)?.code).toBe('CLOSED_LOOP_TOO_FEW_POINTS')
  })
})

describe('validateStartLine', () => {
  it('fails when no start line is set', () => {
    const doc = createTrackDocument({ controlPoints: threePointLoop() })
    expect(validateStartLine(doc)?.code).toBe('START_LINE_MISSING')
  })

  it('passes when a valid control point is designated as start line', () => {
    const doc = createTrackDocument({
      controlPoints: threePointLoop(),
      startLine: { controlPointIndex: 0, headingDeg: 90 },
    })
    expect(validateStartLine(doc)).toBeNull()
  })
})

describe('validateSelfIntersection', () => {
  it('passes for a non-intersecting track', () => {
    const doc = createTrackDocument({ controlPoints: largeSmoothSquare() })
    expect(validateSelfIntersection(doc)).toBeNull()
  })

  it('fails for a self-intersecting (bowtie) track', () => {
    const doc = createTrackDocument({ controlPoints: bowtieTrack() })
    expect(validateSelfIntersection(doc)?.code).toBe('SELF_INTERSECTION')
  })
})

describe('MIN_CORNER_RADIUS', () => {
  it('is derived from the car\'s achievable turn radius with a safety margin', () => {
    expect(MIN_CORNER_RADIUS).toBeGreaterThan(achievableTurnRadius())
    expect(MIN_CORNER_RADIUS).toBeGreaterThanOrEqual(achievableTurnRadius() * 1.2)
  })
})

describe('validateCornerRadius', () => {
  it('passes for a track with gentle curves', () => {
    const doc = createTrackDocument({ controlPoints: largeSmoothSquare() })
    expect(validateCornerRadius(doc)).toBeNull()
  })

  it('fails for a track with a corner tighter than the minimum radius', () => {
    const doc = createTrackDocument({ controlPoints: sharpSpikeTrack() })
    expect(validateCornerRadius(doc)?.code).toBe('CORNER_RADIUS_TOO_TIGHT')
  })

  it('identifies the offending control point in the error message', () => {
    const doc = createTrackDocument({ controlPoints: sharpSpikeTrack() })
    const error = validateCornerRadius(doc)
    // sharpSpikeTrack's near-U-turns are at the two short ends, control points 1 and 2.
    expect(error?.message).toMatch(/control point [12]\b/)
  })
})

describe('validateTrackMinimal', () => {
  it('returns no errors for a valid minimal track', () => {
    const doc = createTrackDocument({
      controlPoints: threePointLoop(),
      startLine: { controlPointIndex: 0, headingDeg: 0 },
    })
    expect(validateTrackMinimal(doc)).toEqual([])
  })

  it('returns both errors for an empty track', () => {
    const doc = createTrackDocument()
    const errors = validateTrackMinimal(doc)
    expect(errors.map((e) => e.code).sort()).toEqual(
      ['CLOSED_LOOP_TOO_FEW_POINTS', 'START_LINE_MISSING'].sort(),
    )
  })
})

describe('validateTrack (full set)', () => {
  it('passes a track that is a large smooth square with a start line', () => {
    const doc = createTrackDocument({
      controlPoints: largeSmoothSquare(),
      startLine: { controlPointIndex: 0, headingDeg: 0 },
    })
    expect(validateTrack(doc)).toEqual([])
  })

  it('includes a self-intersection error for a bowtie track even with a start line set', () => {
    const doc = createTrackDocument({
      controlPoints: bowtieTrack(),
      startLine: { controlPointIndex: 0, headingDeg: 0 },
    })
    expect(validateTrack(doc).map((e) => e.code)).toContain('SELF_INTERSECTION')
  })

  it('includes a corner-radius error for a sharp-spike track even with a start line set', () => {
    const doc = createTrackDocument({
      controlPoints: sharpSpikeTrack(),
      startLine: { controlPointIndex: 0, headingDeg: 0 },
    })
    expect(validateTrack(doc).map((e) => e.code)).toContain('CORNER_RADIUS_TOO_TIGHT')
  })
})
