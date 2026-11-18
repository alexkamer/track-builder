import { describe, expect, it } from 'vitest'
import { PRESET_TRACKS } from './presets'
import { validateTrack } from './validation'
import { tangentHeadingDeg } from './heading'

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

  it.each(PRESET_TRACKS.map((t) => [t.name, t] as const))(
    '%s spawns facing the track, not some other direction',
    (_name, track) => {
      // A car spawned facing noticeably away from the track's actual direction of travel at
      // the start line looks "angled wrong" even though the track itself is still drivable.
      const expected = tangentHeadingDeg(track.controlPoints, track.startLine.controlPointIndex)
      const diff = Math.abs(
        (((track.startLine.headingDeg - expected + 540) % 360) - 180),
      )
      expect(diff).toBeLessThan(20)
    },
  )
})
