import { describe, expect, it } from 'vitest'
import { createControlPoint, createTrackDocument } from '../track/schema'
import { generateTrack } from '../generation/generateTrack'
import { bankingAt, elevationAt, isOnRoadSurface, nearestCenterlineIndex } from './trackSurface'

function wideSquareTrack() {
  return createTrackDocument({
    controlPoints: [
      createControlPoint({ x: 0, z: 0, width: 20 }),
      createControlPoint({ x: 200, z: 0, width: 20 }),
      createControlPoint({ x: 200, z: 200, width: 20 }),
      createControlPoint({ x: 0, z: 200, width: 20 }),
    ],
    startLine: { controlPointIndex: 0, headingDeg: 90 },
  })
}

function hillyTrack() {
  return createTrackDocument({
    controlPoints: [
      createControlPoint({ x: 0, z: 0, width: 20, elevation: 0 }),
      createControlPoint({ x: 200, z: 0, width: 20, elevation: 20 }),
      createControlPoint({ x: 200, z: 200, width: 20, elevation: 0 }),
      createControlPoint({ x: 0, z: 200, width: 20, elevation: 0 }),
    ],
    startLine: { controlPointIndex: 0, headingDeg: 90 },
  })
}

function bankedTrack() {
  return createTrackDocument({
    controlPoints: [
      createControlPoint({ x: 0, z: 0, width: 20, bankingDeg: 0 }),
      createControlPoint({ x: 200, z: 0, width: 20, bankingDeg: 30 }),
      createControlPoint({ x: 200, z: 200, width: 20, bankingDeg: 0 }),
      createControlPoint({ x: 0, z: 200, width: 20, bankingDeg: 0 }),
    ],
    startLine: { controlPointIndex: 0, headingDeg: 90 },
  })
}

describe('isOnRoadSurface', () => {
  // Control points are exact points on the Catmull-Rom curve (t=0 of their segment),
  // unlike arbitrary points along it, so they're a reliable "definitely on centerline" fixture.
  it('is true for a position exactly on a control point', () => {
    const track = generateTrack(wideSquareTrack())
    expect(isOnRoadSurface({ x: 0, z: 0 }, track)).toBe(true)
  })

  it('is true for a position within the road half-width of a control point', () => {
    const track = generateTrack(wideSquareTrack())
    expect(isOnRoadSurface({ x: 8, z: 0 }, track)).toBe(true)
  })

  it('is false for a position well outside the road width', () => {
    const track = generateTrack(wideSquareTrack())
    expect(isOnRoadSurface({ x: 0, z: 60 }, track)).toBe(false)
  })
})

describe('elevationAt', () => {
  it('is 0 on a flat track', () => {
    const track = generateTrack(wideSquareTrack())
    expect(elevationAt({ x: 200, z: 0 }, track)).toBe(0)
  })

  it('matches a control point exact elevation', () => {
    const track = generateTrack(hillyTrack())
    expect(elevationAt({ x: 200, z: 0 }, track)).toBe(20)
  })

  it('is higher near a raised control point than near a flat one', () => {
    const track = generateTrack(hillyTrack())
    expect(elevationAt({ x: 200, z: 0 }, track)).toBeGreaterThan(elevationAt({ x: 0, z: 0 }, track))
  })

  it('changes smoothly rather than stepping between ring heights', () => {
    const track = generateTrack(hillyTrack())
    // Two points a couple of world units apart on the climbing segment: a nearest-ring
    // lookup could return the same ring for both (no change) or jump a whole ring's worth
    // of elevation; interpolation should produce a small, position-proportional difference.
    const a = elevationAt({ x: 150, z: 0 }, track)
    const b = elevationAt({ x: 152, z: 0 }, track)
    expect(Math.abs(b - a)).toBeGreaterThan(0)
    expect(Math.abs(b - a)).toBeLessThan(1)
  })

  it('rises toward the banked-up edge and falls toward the banked-down edge, not the flat centerline height', () => {
    // generateTrack's offsetAt tilts each edge up/down by sin(bankingRad) * halfWidth, so the
    // two edges of a banked ring sit at different heights - elevationAt must track whichever
    // height is actually under a laterally-offset position, not just the centerline's, or the
    // car renders sunk into (or floating over) the road surface anywhere it isn't exactly
    // centered.
    const track = generateTrack(bankedTrack())
    const centerElevation = elevationAt({ x: 200, z: 0 }, track)

    const ringIndex = nearestCenterlineIndex({ x: 200, z: 0 }, track)
    const leftEdge = track.roadMesh.positions[ringIndex * 2]
    const rightEdge = track.roadMesh.positions[ringIndex * 2 + 1]
    // Sanity check on the fixture itself: "positive banking tilts the left edge up" (see offsetAt).
    expect(leftEdge.y).toBeGreaterThan(rightEdge.y)

    const leftElevation = elevationAt({ x: leftEdge.x, z: leftEdge.z }, track)
    const rightElevation = elevationAt({ x: rightEdge.x, z: rightEdge.z }, track)

    expect(leftElevation).toBeGreaterThan(centerElevation)
    expect(rightElevation).toBeLessThan(centerElevation)
    // Tracks a substantial fraction of the mesh's own tilt, rather than staying flat at the
    // centerline height on both sides (the pre-fix behavior).
    expect(leftElevation - rightElevation).toBeGreaterThan((leftEdge.y - rightEdge.y) * 0.5)
  })
})

describe('bankingAt', () => {
  it('is 0 on a flat, unbanked track', () => {
    const track = generateTrack(wideSquareTrack())
    expect(bankingAt({ x: 200, z: 0 }, track)).toBe(0)
  })

  it('matches a control point exact banking', () => {
    const track = generateTrack(bankedTrack())
    expect(bankingAt({ x: 200, z: 0 }, track)).toBeCloseTo((30 * Math.PI) / 180, 10)
  })

  it('is steeper near a banked control point than near a flat one', () => {
    const track = generateTrack(bankedTrack())
    expect(bankingAt({ x: 200, z: 0 }, track)).toBeGreaterThan(bankingAt({ x: 0, z: 0 }, track))
  })
})
