import { beforeEach, describe, expect, it } from 'vitest'
import { isMyTrack, recordCreatedTrack } from './myTracks'

describe('myTracks', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('reports a track as not mine before it is recorded', () => {
    expect(isMyTrack('track-1')).toBe(false)
  })

  it('reports a track as mine after it is recorded', () => {
    recordCreatedTrack('track-1')
    expect(isMyTrack('track-1')).toBe(true)
    expect(isMyTrack('track-2')).toBe(false)
  })

  it('does not duplicate an id recorded twice', () => {
    recordCreatedTrack('track-1')
    recordCreatedTrack('track-1')
    expect(isMyTrack('track-1')).toBe(true)
  })
})
