import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createControlPoint, createTrackDocument } from '../domain/track/schema'
import { getOrCreateSessionId } from '../domain/session/anonymousSession'
import { deleteTrack, listTracks, renameTrack, shareTrack } from './client'

function sampleDoc() {
  return createTrackDocument({
    controlPoints: [createControlPoint({ x: 0, z: 0, width: 80 })],
  })
}

describe('api client', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('shareTrack sends the local anonymous session id as creatorSessionId', async () => {
    const sessionId = getOrCreateSessionId()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'abc', shareUrl: '/track/abc', document: sampleDoc() }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await shareTrack(sampleDoc())

    const [, options] = fetchMock.mock.calls[0]
    const body = JSON.parse(options.body as string)
    expect(body.creatorSessionId).toBe(sessionId)
  })

  it('listTracks returns the tracks from the server', async () => {
    const tracks = [{ id: 'a', name: 'Track A', createdAt: '2026-01-01' }]
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ tracks }) }),
    )

    await expect(listTracks()).resolves.toEqual(tracks)
  })

  it('renameTrack sends the session id and resolves on success', async () => {
    const sessionId = getOrCreateSessionId()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    await renameTrack('abc', 'New Name')

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toContain('/api/tracks/abc')
    expect(options.method).toBe('PATCH')
    expect(JSON.parse(options.body as string)).toEqual({ name: 'New Name', sessionId })
  })

  it('renameTrack rejects when the server returns 403', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }))
    await expect(renameTrack('abc', 'New Name')).rejects.toThrow('403')
  })

  it('deleteTrack sends the session id and resolves on success', async () => {
    const sessionId = getOrCreateSessionId()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    await deleteTrack('abc')

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toContain('/api/tracks/abc')
    expect(options.method).toBe('DELETE')
    expect(JSON.parse(options.body as string)).toEqual({ sessionId })
  })

  it('deleteTrack rejects when the server returns 403', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }))
    await expect(deleteTrack('abc')).rejects.toThrow('403')
  })
})
