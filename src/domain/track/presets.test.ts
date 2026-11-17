import { describe, expect, it } from 'vitest'
import { PRESET_TRACKS } from './presets'
import { validateTrack } from './validation'

describe('preset tracks', () => {
  it('ships at least 3 presets', () => {
    expect(PRESET_TRACKS.length).toBeGreaterThanOrEqual(3)
  })

  it.each(PRESET_TRACKS.map((t) => [t.name, t] as const))('%s passes full validation', (_name, track) => {
    expect(validateTrack(track)).toEqual([])
  })

  it('gives each preset a unique id', () => {
    const ids = PRESET_TRACKS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
