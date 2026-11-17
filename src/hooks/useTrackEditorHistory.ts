import { useCallback, useReducer } from 'react'
import type { EditorAction } from '../domain/track/editorReducer'
import { editorReducer, createEmptyTrackDocument } from '../domain/track/editorReducer'
import { createHistoryReducer, createHistoryState } from '../domain/track/history'
import type { TrackDocument } from '../domain/track/schema'

const historyReducer = createHistoryReducer(editorReducer)

export function useTrackEditorHistory() {
  const [state, dispatchHistory] = useReducer(historyReducer, createHistoryState(createEmptyTrackDocument()))

  const dispatch = useCallback(
    (action: EditorAction, opts?: { transient?: boolean }) => {
      dispatchHistory({ type: 'APPLY', action, transient: opts?.transient })
    },
    [],
  )
  const commit = useCallback(() => dispatchHistory({ type: 'COMMIT' }), [])
  const undo = useCallback(() => dispatchHistory({ type: 'UNDO' }), [])
  const redo = useCallback(() => dispatchHistory({ type: 'REDO' }), [])
  const loadTrack = useCallback(
    (doc: TrackDocument) => dispatchHistory({ type: 'LOAD', state: doc }),
    [],
  )

  return {
    doc: state.present,
    dispatch,
    commit,
    undo,
    redo,
    loadTrack,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  }
}
