export interface HistoryState<T> {
  past: T[]
  present: T
  future: T[]
  /** True while a streak of transient actions (e.g. an in-progress drag) is coalescing into one undo step. */
  transientActive: boolean
}

export type HistoryAction<T, A> =
  | { type: 'UNDO' }
  | { type: 'REDO' }
  /** Ends the current transient streak (e.g. on drag end) without changing state. */
  | { type: 'COMMIT' }
  | { type: 'APPLY'; action: A; transient?: boolean }
  /** Replaces the present state wholesale (e.g. loading a preset or a saved track) and starts a fresh history. */
  | { type: 'LOAD'; state: T }

export function createHistoryState<T>(present: T): HistoryState<T> {
  return { past: [], present, future: [], transientActive: false }
}

/**
 * Wraps a plain reducer with undo/redo history. Actions dispatched with `transient: true`
 * (e.g. each mousemove of a drag) amend the current undo step instead of creating a new
 * one, until a non-transient action or an explicit COMMIT ends the streak - so dragging a
 * control point across the canvas is one undo step, not one per pixel of movement.
 */
export function createHistoryReducer<T, A>(baseReducer: (state: T, action: A) => T) {
  return function historyReducer(state: HistoryState<T>, action: HistoryAction<T, A>): HistoryState<T> {
    switch (action.type) {
      case 'UNDO': {
        if (state.past.length === 0) return state
        const previous = state.past[state.past.length - 1]
        return {
          past: state.past.slice(0, -1),
          present: previous,
          future: [state.present, ...state.future],
          transientActive: false,
        }
      }

      case 'REDO': {
        if (state.future.length === 0) return state
        const next = state.future[0]
        return {
          past: [...state.past, state.present],
          present: next,
          future: state.future.slice(1),
          transientActive: false,
        }
      }

      case 'COMMIT':
        return state.transientActive ? { ...state, transientActive: false } : state

      case 'LOAD':
        return createHistoryState(action.state)

      case 'APPLY': {
        const newPresent = baseReducer(state.present, action.action)
        if (action.transient) {
          if (state.transientActive) {
            return { ...state, present: newPresent }
          }
          return { past: [...state.past, state.present], present: newPresent, future: [], transientActive: true }
        }
        return { past: [...state.past, state.present], present: newPresent, future: [], transientActive: false }
      }

      default:
        return state
    }
  }
}
