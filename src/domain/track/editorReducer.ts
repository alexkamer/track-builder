import type { Checkpoint, ControlPoint, StartLine, TrackDocument, TrackMetadata } from './schema'
import { createTrackDocument } from './schema'

export type EditorAction =
  | { type: 'ADD_POINT'; point: ControlPoint; insertIndex?: number }
  | { type: 'MOVE_POINT'; index: number; x: number; z: number }
  | { type: 'DELETE_POINT'; index: number }
  | { type: 'SET_POINT_WIDTH'; index: number; width: number }
  | { type: 'SET_POINT_ELEVATION'; index: number; elevation: number }
  | { type: 'SET_POINT_BANKING'; index: number; bankingDeg: number }
  | { type: 'SET_START_LINE'; controlPointIndex: number; headingDeg?: number }
  | { type: 'SET_START_LINE_HEADING'; headingDeg: number }
  | { type: 'ADD_CHECKPOINT'; controlPointIndex: number }
  | { type: 'REMOVE_CHECKPOINT'; controlPointIndex: number }
  | { type: 'SET_METADATA'; metadata: Partial<TrackMetadata> }

export function editorReducer(doc: TrackDocument, action: EditorAction): TrackDocument {
  switch (action.type) {
    case 'ADD_POINT': {
      // Defaults to appending (the array-end "insert index"), so the loop's start-line/
      // checkpoint indices - which only need shifting for points inserted before them -
      // never need reindexing in that default case.
      const insertIndex = action.insertIndex ?? doc.controlPoints.length
      const controlPoints = [
        ...doc.controlPoints.slice(0, insertIndex),
        action.point,
        ...doc.controlPoints.slice(insertIndex),
      ]
      return {
        ...doc,
        controlPoints,
        startLine: reindexAfterInsert(doc.startLine, insertIndex),
        checkpoints: doc.checkpoints.map((c) => ({
          controlPointIndex: shiftIndexAfterInsert(c.controlPointIndex, insertIndex),
        })),
      }
    }

    case 'MOVE_POINT': {
      const controlPoints = doc.controlPoints.map((p, i) =>
        i === action.index ? { ...p, x: action.x, z: action.z } : p,
      )
      return { ...doc, controlPoints }
    }

    case 'DELETE_POINT': {
      if (doc.controlPoints.length <= 3) return doc
      const controlPoints = doc.controlPoints.filter((_, i) => i !== action.index)
      return {
        ...doc,
        controlPoints,
        startLine: reindexAfterDelete(doc.startLine, action.index),
        checkpoints: doc.checkpoints
          .filter((c) => c.controlPointIndex !== action.index)
          .map((c) => ({
            controlPointIndex: shiftIndexAfterDelete(c.controlPointIndex, action.index),
          })),
      }
    }

    case 'SET_POINT_WIDTH': {
      const controlPoints = doc.controlPoints.map((p, i) =>
        i === action.index ? { ...p, width: action.width } : p,
      )
      return { ...doc, controlPoints }
    }

    case 'SET_POINT_ELEVATION': {
      const controlPoints = doc.controlPoints.map((p, i) =>
        i === action.index ? { ...p, elevation: action.elevation } : p,
      )
      return { ...doc, controlPoints }
    }

    case 'SET_POINT_BANKING': {
      const controlPoints = doc.controlPoints.map((p, i) =>
        i === action.index ? { ...p, bankingDeg: action.bankingDeg } : p,
      )
      return { ...doc, controlPoints }
    }

    case 'SET_START_LINE':
      return {
        ...doc,
        startLine: {
          controlPointIndex: action.controlPointIndex,
          headingDeg: action.headingDeg ?? doc.startLine.headingDeg,
        },
        // a control point can't be both the start line and a checkpoint
        checkpoints: doc.checkpoints.filter(
          (c) => c.controlPointIndex !== action.controlPointIndex,
        ),
      }

    case 'SET_START_LINE_HEADING':
      return { ...doc, startLine: { ...doc.startLine, headingDeg: action.headingDeg } }

    case 'ADD_CHECKPOINT': {
      if (action.controlPointIndex === doc.startLine.controlPointIndex) return doc
      if (doc.checkpoints.some((c) => c.controlPointIndex === action.controlPointIndex)) {
        return doc
      }
      const checkpoints = [...doc.checkpoints, { controlPointIndex: action.controlPointIndex }]
      checkpoints.sort((a, b) => loopOrderIndex(a, doc) - loopOrderIndex(b, doc))
      return { ...doc, checkpoints }
    }

    case 'REMOVE_CHECKPOINT':
      return {
        ...doc,
        checkpoints: doc.checkpoints.filter(
          (c) => c.controlPointIndex !== action.controlPointIndex,
        ),
      }

    case 'SET_METADATA':
      return { ...doc, metadata: { ...doc.metadata, ...action.metadata } }

    default:
      return doc
  }
}

function loopOrderIndex(checkpoint: Checkpoint, doc: TrackDocument): number {
  const n = doc.controlPoints.length
  const start = doc.startLine.controlPointIndex
  return (checkpoint.controlPointIndex - start + n) % n
}

function shiftIndexAfterDelete(index: number, deletedIndex: number): number {
  return index > deletedIndex ? index - 1 : index
}

function reindexAfterDelete(startLine: StartLine, deletedIndex: number): StartLine {
  return {
    ...startLine,
    controlPointIndex: shiftIndexAfterDelete(startLine.controlPointIndex, deletedIndex),
  }
}

function shiftIndexAfterInsert(index: number, insertIndex: number): number {
  return index >= insertIndex ? index + 1 : index
}

function reindexAfterInsert(startLine: StartLine, insertIndex: number): StartLine {
  return {
    ...startLine,
    controlPointIndex: shiftIndexAfterInsert(startLine.controlPointIndex, insertIndex),
  }
}

export function createEmptyTrackDocument(): TrackDocument {
  return createTrackDocument()
}
