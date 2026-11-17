import { describe, expect, it } from 'vitest'
import { createHistoryReducer, createHistoryState } from './history'

type Counter = { value: number }
type CounterAction = { type: 'increment'; by: number }

function baseReducer(state: Counter, action: CounterAction): Counter {
  switch (action.type) {
    case 'increment':
      return { value: state.value + action.by }
    default:
      return state
  }
}

const historyReducer = createHistoryReducer(baseReducer)

describe('history reducer', () => {
  it('undoes the most recent action', () => {
    let state = createHistoryState<Counter>({ value: 0 })
    state = historyReducer(state, { type: 'APPLY', action: { type: 'increment', by: 1 } })
    state = historyReducer(state, { type: 'APPLY', action: { type: 'increment', by: 1 } })
    expect(state.present.value).toBe(2)

    state = historyReducer(state, { type: 'UNDO' })
    expect(state.present.value).toBe(1)
  })

  it('redoes an undone action', () => {
    let state = createHistoryState<Counter>({ value: 0 })
    state = historyReducer(state, { type: 'APPLY', action: { type: 'increment', by: 5 } })
    state = historyReducer(state, { type: 'UNDO' })
    expect(state.present.value).toBe(0)

    state = historyReducer(state, { type: 'REDO' })
    expect(state.present.value).toBe(5)
  })

  it('clears redo history when a new action is applied after an undo', () => {
    let state = createHistoryState<Counter>({ value: 0 })
    state = historyReducer(state, { type: 'APPLY', action: { type: 'increment', by: 1 } })
    state = historyReducer(state, { type: 'APPLY', action: { type: 'increment', by: 1 } })
    state = historyReducer(state, { type: 'UNDO' })
    expect(state.future).toHaveLength(1)

    state = historyReducer(state, { type: 'APPLY', action: { type: 'increment', by: 100 } })
    expect(state.future).toHaveLength(0)
    expect(state.present.value).toBe(101)

    // The redo that would have replayed the discarded action is now a no-op.
    const beforeRedo = state
    state = historyReducer(state, { type: 'REDO' })
    expect(state).toEqual(beforeRedo)
  })

  it('coalesces a streak of transient actions into a single undo step', () => {
    let state = createHistoryState<Counter>({ value: 0 })
    state = historyReducer(state, { type: 'APPLY', action: { type: 'increment', by: 1 }, transient: true })
    state = historyReducer(state, { type: 'APPLY', action: { type: 'increment', by: 1 }, transient: true })
    state = historyReducer(state, { type: 'APPLY', action: { type: 'increment', by: 1 }, transient: true })
    expect(state.present.value).toBe(3)
    expect(state.past).toHaveLength(1) // one checkpoint for the whole streak, not three

    state = historyReducer(state, { type: 'UNDO' })
    expect(state.present.value).toBe(0) // the whole drag undoes in one step
  })

  it('starts a new undo step after a COMMIT ends the transient streak', () => {
    let state = createHistoryState<Counter>({ value: 0 })
    state = historyReducer(state, { type: 'APPLY', action: { type: 'increment', by: 1 }, transient: true })
    state = historyReducer(state, { type: 'COMMIT' })
    state = historyReducer(state, { type: 'APPLY', action: { type: 'increment', by: 1 }, transient: true })
    expect(state.past).toHaveLength(2)
  })

  it('LOAD replaces present and starts a fresh history', () => {
    let state = createHistoryState<Counter>({ value: 0 })
    state = historyReducer(state, { type: 'APPLY', action: { type: 'increment', by: 1 } })
    state = historyReducer(state, { type: 'LOAD', state: { value: 42 } })

    expect(state.present.value).toBe(42)
    expect(state.past).toHaveLength(0)
    expect(state.future).toHaveLength(0)
  })

  it('UNDO and REDO are no-ops at the ends of history', () => {
    const initial = createHistoryState<Counter>({ value: 0 })
    expect(historyReducer(initial, { type: 'UNDO' })).toEqual(initial)
    expect(historyReducer(initial, { type: 'REDO' })).toEqual(initial)
  })
})
