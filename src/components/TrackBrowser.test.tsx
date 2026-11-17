import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TrackBrowser } from './TrackBrowser'
import { recordCreatedTrack } from '../domain/session/myTracks'

function mockFetchSequence(responses: Array<Partial<Response> & { json?: () => Promise<unknown> }>) {
  let call = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      const res = responses[Math.min(call, responses.length - 1)]
      call += 1
      return Promise.resolve(res as Response)
    }),
  )
}

describe('TrackBrowser', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('renders the fetched track list with an open action per row', async () => {
    mockFetchSequence([
      {
        ok: true,
        json: async () => ({
          tracks: [
            { id: 'a', name: 'Track A', createdAt: '2026-01-01' },
            { id: 'b', name: 'Track B', createdAt: '2026-01-02' },
          ],
        }),
      },
    ])
    const onOpenTrack = vi.fn()
    render(<TrackBrowser onOpenTrack={onOpenTrack} />)

    await waitFor(() => expect(screen.getAllByTestId('track-browser-row')).toHaveLength(2))
    expect(screen.getByText('Track A')).toBeInTheDocument()
    expect(screen.getByText('Track B')).toBeInTheDocument()

    fireEvent.click(screen.getAllByTestId('open-track-button')[0])
    expect(onOpenTrack).toHaveBeenCalledWith('a')
  })

  it('shows rename/delete controls only for locally-known-created tracks', async () => {
    recordCreatedTrack('mine')
    mockFetchSequence([
      {
        ok: true,
        json: async () => ({
          tracks: [
            { id: 'mine', name: 'Mine', createdAt: '2026-01-01' },
            { id: 'theirs', name: 'Theirs', createdAt: '2026-01-02' },
          ],
        }),
      },
    ])
    render(<TrackBrowser onOpenTrack={() => {}} />)

    await waitFor(() => expect(screen.getAllByTestId('track-browser-row')).toHaveLength(2))
    expect(screen.getAllByTestId('rename-track-button')).toHaveLength(1)
    expect(screen.getAllByTestId('delete-track-button')).toHaveLength(1)
  })

  it('renames a track successfully and refreshes the list', async () => {
    recordCreatedTrack('mine')
    mockFetchSequence([
      { ok: true, json: async () => ({ tracks: [{ id: 'mine', name: 'Old Name', createdAt: '2026-01-01' }] }) },
      { ok: true },
      { ok: true, json: async () => ({ tracks: [{ id: 'mine', name: 'New Name', createdAt: '2026-01-01' }] }) },
    ])
    render(<TrackBrowser onOpenTrack={() => {}} />)

    await waitFor(() => expect(screen.getByText('Old Name')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('rename-track-button'))
    fireEvent.change(screen.getByTestId('rename-input'), { target: { value: 'New Name' } })
    fireEvent.click(screen.getByTestId('rename-save-button'))

    await waitFor(() => expect(screen.getByText('New Name')).toBeInTheDocument())
  })

  it('deletes a track successfully and removes it from the list', async () => {
    recordCreatedTrack('mine')
    mockFetchSequence([
      { ok: true, json: async () => ({ tracks: [{ id: 'mine', name: 'Mine', createdAt: '2026-01-01' }] }) },
      { ok: true },
    ])
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<TrackBrowser onOpenTrack={() => {}} />)

    await waitFor(() => expect(screen.getByText('Mine')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('delete-track-button'))

    await waitFor(() => expect(screen.queryByText('Mine')).not.toBeInTheDocument())
  })

  it('surfaces an error on a rejected (403) rename without changing the list', async () => {
    recordCreatedTrack('mine')
    mockFetchSequence([
      { ok: true, json: async () => ({ tracks: [{ id: 'mine', name: 'Mine', createdAt: '2026-01-01' }] }) },
      { ok: false, status: 403 },
    ])
    render(<TrackBrowser onOpenTrack={() => {}} />)

    await waitFor(() => expect(screen.getByText('Mine')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('rename-track-button'))
    fireEvent.change(screen.getByTestId('rename-input'), { target: { value: 'New Name' } })
    fireEvent.click(screen.getByTestId('rename-save-button'))

    await waitFor(() => expect(screen.getByText('Could not rename this track.')).toBeInTheDocument())
    expect(screen.getByTestId('rename-input')).toBeInTheDocument()
  })

  it('surfaces an error on a rejected (403) delete without changing the list', async () => {
    recordCreatedTrack('mine')
    mockFetchSequence([
      { ok: true, json: async () => ({ tracks: [{ id: 'mine', name: 'Mine', createdAt: '2026-01-01' }] }) },
      { ok: false, status: 403 },
    ])
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<TrackBrowser onOpenTrack={() => {}} />)

    await waitFor(() => expect(screen.getByText('Mine')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('delete-track-button'))

    await waitFor(() => expect(screen.getByText('Could not delete this track.')).toBeInTheDocument())
    expect(screen.getByText('Mine')).toBeInTheDocument()
  })
})
