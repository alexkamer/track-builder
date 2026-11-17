import { describe, expect, it } from 'vitest'
import { createControlPoint, createTrackDocument } from '../track/schema'
import { generateTrack } from '../generation/generateTrack'
import { elevationAt, isOnRoadSurface } from './trackSurface'

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
})
