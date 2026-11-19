import { describe, expect, it } from 'vitest'
import { createControlPoint, createTrackDocument } from './schema'
import { editorReducer } from './editorReducer'

describe('editorReducer', () => {
  it('adds a control point', () => {
    const doc = createTrackDocument()
    const next = editorReducer(doc, { type: 'ADD_POINT', point: createControlPoint({ x: 5, z: 5 }) })
    expect(next.controlPoints).toHaveLength(1)
    expect(next.controlPoints[0]).toMatchObject({ x: 5, z: 5 })
  })

  it('appends at the end when insertIndex is omitted', () => {
    const doc = createTrackDocument({
      controlPoints: [createControlPoint({ x: 0, z: 0 }), createControlPoint({ x: 1, z: 1 })],
    })
    const next = editorReducer(doc, { type: 'ADD_POINT', point: createControlPoint({ x: 9, z: 9 }) })
    expect(next.controlPoints.map((p) => p.x)).toEqual([0, 1, 9])
  })

  it('inserts at a specific index, shifting later points', () => {
    const doc = createTrackDocument({
      controlPoints: [createControlPoint({ x: 0, z: 0 }), createControlPoint({ x: 2, z: 2 })],
    })
    const next = editorReducer(doc, {
      type: 'ADD_POINT',
      point: createControlPoint({ x: 1, z: 1 }),
      insertIndex: 1,
    })
    expect(next.controlPoints.map((p) => p.x)).toEqual([0, 1, 2])
  })

  it('shifts the start line and checkpoint indices for points inserted before them', () => {
    const doc = createTrackDocument({
      controlPoints: [
        createControlPoint({ x: 0, z: 0 }),
        createControlPoint({ x: 1, z: 0 }),
        createControlPoint({ x: 2, z: 0 }),
      ],
      startLine: { controlPointIndex: 1, headingDeg: 0 },
      checkpoints: [{ controlPointIndex: 2 }],
    })
    const next = editorReducer(doc, {
      type: 'ADD_POINT',
      point: createControlPoint({ x: 0.5, z: 0 }),
      insertIndex: 1,
    })
    expect(next.startLine.controlPointIndex).toBe(2)
    expect(next.checkpoints).toEqual([{ controlPointIndex: 3 }])
  })

  it('does not shift the start line or checkpoint indices for points inserted after them', () => {
    const doc = createTrackDocument({
      controlPoints: [
        createControlPoint({ x: 0, z: 0 }),
        createControlPoint({ x: 1, z: 0 }),
        createControlPoint({ x: 2, z: 0 }),
      ],
      startLine: { controlPointIndex: 0, headingDeg: 0 },
      checkpoints: [{ controlPointIndex: 1 }],
    })
    const next = editorReducer(doc, {
      type: 'ADD_POINT',
      point: createControlPoint({ x: 2.5, z: 0 }),
      insertIndex: 3,
    })
    expect(next.startLine.controlPointIndex).toBe(0)
    expect(next.checkpoints).toEqual([{ controlPointIndex: 1 }])
  })

  it('moves a control point without affecting others', () => {
    const doc = createTrackDocument({
      controlPoints: [createControlPoint({ x: 0, z: 0 }), createControlPoint({ x: 1, z: 1 })],
    })
    const next = editorReducer(doc, { type: 'MOVE_POINT', index: 0, x: 9, z: 9 })
    expect(next.controlPoints[0]).toMatchObject({ x: 9, z: 9 })
    expect(next.controlPoints[1]).toMatchObject({ x: 1, z: 1 })
  })

  it('updates a control point width without affecting other fields or points', () => {
    const doc = createTrackDocument({
      controlPoints: [createControlPoint({ width: 10 }), createControlPoint({ width: 10 })],
    })
    const next = editorReducer(doc, { type: 'SET_POINT_WIDTH', index: 0, width: 25 })
    expect(next.controlPoints[0].width).toBe(25)
    expect(next.controlPoints[1].width).toBe(10)
  })

  it('updates a control point elevation', () => {
    const doc = createTrackDocument({ controlPoints: [createControlPoint({ elevation: 0 })] })
    const next = editorReducer(doc, { type: 'SET_POINT_ELEVATION', index: 0, elevation: 15 })
    expect(next.controlPoints[0].elevation).toBe(15)
  })

  it('updates a control point banking angle', () => {
    const doc = createTrackDocument({ controlPoints: [createControlPoint({ bankingDeg: 0 })] })
    const next = editorReducer(doc, { type: 'SET_POINT_BANKING', index: 0, bankingDeg: 20 })
    expect(next.controlPoints[0].bankingDeg).toBe(20)
  })

  it('deletes a control point when more than 3 remain, reindexing start line and checkpoints', () => {
    const doc = createTrackDocument({
      controlPoints: [
        createControlPoint({ x: 0, z: 0 }),
        createControlPoint({ x: 1, z: 0 }),
        createControlPoint({ x: 2, z: 0 }),
        createControlPoint({ x: 3, z: 0 }),
      ],
      startLine: { controlPointIndex: 3, headingDeg: 0 },
      checkpoints: [{ controlPointIndex: 2 }],
    })
    const next = editorReducer(doc, { type: 'DELETE_POINT', index: 1 })
    expect(next.controlPoints).toHaveLength(3)
    expect(next.startLine.controlPointIndex).toBe(2)
    expect(next.checkpoints).toEqual([{ controlPointIndex: 1 }])
  })

  it('refuses to delete a control point when only 3 remain', () => {
    const doc = createTrackDocument({
      controlPoints: [
        createControlPoint({ x: 0, z: 0 }),
        createControlPoint({ x: 1, z: 0 }),
        createControlPoint({ x: 2, z: 0 }),
      ],
    })
    const next = editorReducer(doc, { type: 'DELETE_POINT', index: 0 })
    expect(next.controlPoints).toHaveLength(3)
  })

  it('sets the start line and clears any checkpoint at that control point', () => {
    const doc = createTrackDocument({
      controlPoints: [
        createControlPoint({ x: 0, z: 0 }),
        createControlPoint({ x: 1, z: 0 }),
        createControlPoint({ x: 2, z: 0 }),
      ],
      checkpoints: [{ controlPointIndex: 1 }],
    })
    const next = editorReducer(doc, {
      type: 'SET_START_LINE',
      controlPointIndex: 1,
      headingDeg: 45,
    })
    expect(next.startLine).toEqual({ controlPointIndex: 1, headingDeg: 45 })
    expect(next.checkpoints).toEqual([])
  })

  it('defaults the start line heading to the curve tangent, not the previously stored heading, when none is given', () => {
    const doc = createTrackDocument({
      controlPoints: [
        createControlPoint({ x: 0, z: 0 }),
        createControlPoint({ x: 100, z: 0 }),
        createControlPoint({ x: 100, z: 100 }),
      ],
      // Deliberately a heading that has nothing to do with control point 1's actual
      // direction of travel, so this test fails if the fallback is "keep the old value"
      // instead of "compute the new point's tangent".
      startLine: { controlPointIndex: 0, headingDeg: 999 },
    })
    const next = editorReducer(doc, { type: 'SET_START_LINE', controlPointIndex: 1 })
    // Travel at control point 1 goes from (0,0) toward (100,100): tangent (100,100) -> 45deg.
    expect(next.startLine.controlPointIndex).toBe(1)
    expect(next.startLine.headingDeg).toBeCloseTo(45, 5)
  })

  it('adds checkpoints in loop order relative to the start line', () => {
    const doc = createTrackDocument({
      controlPoints: [
        createControlPoint({ x: 0, z: 0 }),
        createControlPoint({ x: 1, z: 0 }),
        createControlPoint({ x: 2, z: 0 }),
        createControlPoint({ x: 3, z: 0 }),
      ],
      startLine: { controlPointIndex: 0, headingDeg: 0 },
    })
    const afterFirst = editorReducer(doc, { type: 'ADD_CHECKPOINT', controlPointIndex: 3 })
    const afterSecond = editorReducer(afterFirst, {
      type: 'ADD_CHECKPOINT',
      controlPointIndex: 1,
    })
    expect(afterSecond.checkpoints).toEqual([
      { controlPointIndex: 1 },
      { controlPointIndex: 3 },
    ])
  })

  it('removes a checkpoint', () => {
    const doc = createTrackDocument({
      controlPoints: [
        createControlPoint({ x: 0, z: 0 }),
        createControlPoint({ x: 1, z: 0 }),
        createControlPoint({ x: 2, z: 0 }),
      ],
      checkpoints: [{ controlPointIndex: 1 }],
    })
    const next = editorReducer(doc, { type: 'REMOVE_CHECKPOINT', controlPointIndex: 1 })
    expect(next.checkpoints).toEqual([])
  })

  it('sets metadata fields, merging with existing metadata', () => {
    const doc = createTrackDocument({ metadata: { author: 'Alex' } })
    const next = editorReducer(doc, {
      type: 'SET_METADATA',
      metadata: { description: 'A twisty circuit' },
    })
    expect(next.metadata).toEqual({ author: 'Alex', description: 'A twisty circuit' })
  })

  it('overwrites an existing metadata field without affecting others', () => {
    const doc = createTrackDocument({ metadata: { author: 'Alex', description: 'Old description' } })
    const next = editorReducer(doc, {
      type: 'SET_METADATA',
      metadata: { description: 'New description' },
    })
    expect(next.metadata).toEqual({ author: 'Alex', description: 'New description' })
  })
})
