import { describe, expect, it } from 'vitest'
import { getToolHint } from './toolHints'

describe('getToolHint', () => {
  it('returns distinct, non-empty hint text for every tool mode', () => {
    const modes = ['select', 'add-point', 'start-line', 'checkpoint', 'pan'] as const
    const hints = modes.map(getToolHint)

    for (const hint of hints) {
      expect(hint.length).toBeGreaterThan(0)
    }
    expect(new Set(hints).size).toBe(modes.length)
  })

  it('swaps to the new tool hint when the mode changes', () => {
    expect(getToolHint('add-point')).not.toBe(getToolHint('pan'))
  })
})
