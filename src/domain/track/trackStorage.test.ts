import { beforeEach, describe, expect, it } from 'vitest'
import { createControlPoint, createTrackDocument } from './schema'
import { listSavedTracks, loadTrack, saveTrack } from './trackStorage'

function sampleTrack() {
  return createTrackDocument({
    controlPoints: [
      createControlPoint({ x: 0, z: 0 }),
      createControlPoint({ x: 10, z: 0 }),
      createControlPoint({ x: 5, z: 10 }),
    ],
    startLine: { controlPointIndex: 0, headingDeg: 0 },
  })
}

describe('trackStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saves a track under the given name and loads it back with no loss', () => {
    const saved = saveTrack(sampleTrack(), 'My Named Track')
    expect(saved.name).toBe('My Named Track')
    expect(saved.id).toBeTruthy()

    const loaded = loadTrack(saved.id)
    expect(loaded).toEqual(saved)
  })

  it('returns null for a track id that was never saved', () => {
    expect(loadTrack('does-not-exist')).toBeNull()
  })

  it('lists saved tracks by id and name', () => {
    const first = saveTrack(sampleTrack(), 'First Track')
    const second = saveTrack(sampleTrack(), 'Second Track')

    const list = listSavedTracks()
    expect(list).toHaveLength(2)
    expect(list.map((t) => t.name).sort()).toEqual(['First Track', 'Second Track'])
    expect(list.map((t) => t.id).sort()).toEqual([first.id, second.id].sort())
  })

  it('re-saving under a new name persists the name through a subsequent load', () => {
    const saved = saveTrack(sampleTrack(), 'Original Name')
    const resaved = saveTrack({ ...saved }, 'Renamed')
    expect(resaved.id).toBe(saved.id)

    const loaded = loadTrack(saved.id)
    expect(loaded?.name).toBe('Renamed')
  })
})
