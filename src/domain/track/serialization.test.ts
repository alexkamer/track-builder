import { describe, expect, it } from 'vitest'
import { createControlPoint, createTrackDocument } from './schema'
import { deserializeTrack, serializeTrack, UnsupportedSchemaVersionError } from './serialization'

function sampleTrack() {
  return createTrackDocument({
    id: 'track-123',
    name: 'My Track',
    controlPoints: [
      createControlPoint({ x: 1, z: 2, elevation: 3, width: 12, bankingDeg: 5 }),
      createControlPoint({ x: 10, z: 20, elevation: 0, width: 10, bankingDeg: -5 }),
      createControlPoint({ x: 30, z: 5, elevation: 8, width: 14, bankingDeg: 0 }),
    ],
    startLine: { controlPointIndex: 0, headingDeg: 45 },
    checkpoints: [{ controlPointIndex: 1 }, { controlPointIndex: 2 }],
    metadata: { author: 'Alex', description: 'A test track' },
  })
}

describe('track serialization round-trip', () => {
  it('round-trips every field with no loss', () => {
    const original = sampleTrack()
    const loaded = deserializeTrack(serializeTrack(original))
    expect(loaded).toEqual(original)
  })

  it('round-trips control point count, order, and all per-point fields', () => {
    const original = sampleTrack()
    const loaded = deserializeTrack(serializeTrack(original))
    expect(loaded.controlPoints).toHaveLength(original.controlPoints.length)
    original.controlPoints.forEach((point, i) => {
      expect(loaded.controlPoints[i]).toEqual(point)
    })
  })

  it('round-trips checkpoints, start line, and metadata', () => {
    const original = sampleTrack()
    const loaded = deserializeTrack(serializeTrack(original))
    expect(loaded.checkpoints).toEqual(original.checkpoints)
    expect(loaded.startLine).toEqual(original.startLine)
    expect(loaded.metadata).toEqual(original.metadata)
  })

  it('rejects a document with an unsupported schema version', () => {
    const original = sampleTrack()
    const json = JSON.stringify({ ...original, schemaVersion: 99 })
    expect(() => deserializeTrack(json)).toThrow(UnsupportedSchemaVersionError)
  })
})
