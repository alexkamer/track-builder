import { describe, expect, it } from 'vitest'
import { createControlPoint, createTrackDocument } from '../track/schema'
import { generateTrack } from '../generation/generateTrack'
import { isOnRoadSurface } from './trackSurface'

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
