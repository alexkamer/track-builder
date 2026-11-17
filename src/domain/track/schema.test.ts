import { describe, expect, it } from 'vitest'
import {
  createControlPoint,
  createTrackDocument,
  TRACK_SCHEMA_VERSION,
  type TrackDocument,
} from './schema'

describe('TrackDocument schema', () => {
  it('constructs a sample TrackDocument that type-checks', () => {
    const doc: TrackDocument = createTrackDocument({
      id: 'sample-track',
      name: 'Sample Oval',
      controlPoints: [
        createControlPoint({ x: 0, z: 0 }),
        createControlPoint({ x: 50, z: 0 }),
        createControlPoint({ x: 50, z: 50 }),
        createControlPoint({ x: 0, z: 50 }),
      ],
      startLine: { controlPointIndex: 0, headingDeg: 90 },
      checkpoints: [{ controlPointIndex: 1 }, { controlPointIndex: 2 }],
    })

    expect(doc.schemaVersion).toBe(TRACK_SCHEMA_VERSION)
    expect(doc.controlPoints).toHaveLength(4)
    expect(doc.startLine.controlPointIndex).toBe(0)
    expect(doc.checkpoints.map((c) => c.controlPointIndex)).toEqual([1, 2])
  })

  it('applies sensible defaults for a fresh control point', () => {
    const point = createControlPoint()
    expect(point).toEqual({
      x: 0,
      z: 0,
      elevation: 0,
      width: 10,
      bankingDeg: 0,
    })
  })
})
