import { useEffect, useState } from 'react'
import { deleteTrack, listTracks, renameTrack, type TrackSummary } from '../api/client'
import { isMyTrack } from '../domain/session/myTracks'

interface TrackBrowserProps {
  onOpenTrack: (id: string) => void
}

export function TrackBrowser({ onOpenTrack }: TrackBrowserProps) {
  const [tracks, setTracks] = useState<TrackSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const refresh = () => {
    listTracks()
      .then(setTracks)
      .catch(() => setError('Could not load tracks - is the server running?'))
  }

  useEffect(() => {
    refresh()
  }, [])

  return (
    <div className="track-browser" data-testid="track-browser">
      <h2>Browse Tracks</h2>
      {error && <span className="validation-errors">{error}</span>}
      <ul data-testid="track-browser-list">
        {tracks.map((t) => (
          <li key={t.id} data-testid="track-browser-row">
            {editingId === t.id ? (
              <>
                <input
                  type="text"
                  data-testid="rename-input"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                />
                <button
                  type="button"
                  data-testid="rename-save-button"
                  onClick={() => {
                    setError(null)
                    renameTrack(t.id, editingName.trim())
                      .then(() => {
                        setEditingId(null)
                        refresh()
                      })
                      .catch(() => setError('Could not rename this track.'))
                  }}
                >
                  Save
                </button>
                <button type="button" onClick={() => setEditingId(null)}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span>{t.name}</span>
                <button type="button" data-testid="open-track-button" onClick={() => onOpenTrack(t.id)}>
                  Open
                </button>
                {isMyTrack(t.id) && (
                  <>
                    <button
                      type="button"
                      data-testid="rename-track-button"
                      onClick={() => {
                        setEditingId(t.id)
                        setEditingName(t.name)
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      data-testid="delete-track-button"
                      onClick={() => {
                        if (!window.confirm(`Delete "${t.name}"?`)) return
                        setError(null)
                        deleteTrack(t.id)
                          .then(() => setTracks((prev) => prev.filter((x) => x.id !== t.id)))
                          .catch(() => setError('Could not delete this track.'))
                      }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
