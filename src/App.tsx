import { useEffect, useState } from 'react'
import { TrackEditor2D, type PointClickMode } from './components/TrackEditor2D'
import { LiveTrackPreview3D } from './components/LiveTrackPreview3D'
import { ControlPointInspector } from './components/ControlPointInspector'
import { RaceScene } from './components/RaceScene'
import { useTrackEditorHistory } from './hooks/useTrackEditorHistory'
import { useEditorKeyboardShortcuts } from './hooks/useEditorKeyboardShortcuts'
import { validateTrack } from './domain/track/validation'
import { PRESET_TRACKS } from './domain/track/presets'
import { listSavedTracks, loadTrack as loadSavedTrack, saveTrack } from './domain/track/trackStorage'
import { fetchSharedTrack, shareTrack } from './api/client'
import './App.css'

type Mode = 'edit' | 'race'

function App() {
  const { doc, dispatch, commit, undo, redo, loadTrack, canUndo, canRedo, loadKey } = useTrackEditorHistory()
  const [mode, setMode] = useState<Mode>('edit')
  const [toolMode, setToolMode] = useState<PointClickMode>('select')
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [snapToGridEnabled, setSnapToGridEnabled] = useState(false)
  const [savedTracks, setSavedTracks] = useState(() => listSavedTracks())
  const [saveName, setSaveName] = useState(doc.name)
  const [sharedTrackId, setSharedTrackId] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)

  // On first load, if the URL names a shared track, fetch it and jump straight into racing.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('track')
    if (!id) return
    fetchSharedTrack(id)
      .then((fetchedDoc) => {
        loadTrack(fetchedDoc)
        setSharedTrackId(id)
        setMode('race')
      })
      .catch(() => setShareError('Could not load the shared track.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const errors = validateTrack(doc)
  const canRace = errors.length === 0

  const deleteSelectedPoint = () => {
    if (selectedIndex === null || doc.controlPoints.length <= 3) return
    dispatch({ type: 'DELETE_POINT', index: selectedIndex })
    setSelectedIndex(null)
  }

  useEditorKeyboardShortcuts({ undo, redo, canUndo, canRedo, deleteSelected: deleteSelectedPoint })

  if (mode === 'race') {
    return (
      <div className="app-shell race-shell">
        <button type="button" onClick={() => setMode('edit')}>
          Back to editor
        </button>
        <RaceScene doc={doc} trackId={sharedTrackId} />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <h1>Trackforge Editor</h1>
      <div className="toolbar">
        <select
          data-testid="preset-select"
          defaultValue=""
          onChange={(e) => {
            const preset = PRESET_TRACKS.find((t) => t.id === e.target.value)
            if (preset) loadTrack(preset)
          }}
        >
          <option value="" disabled>
            Load preset…
          </option>
          {PRESET_TRACKS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button type="button" data-testid="undo-button" disabled={!canUndo} onClick={undo}>
          Undo
        </button>
        <button type="button" data-testid="redo-button" disabled={!canRedo} onClick={redo}>
          Redo
        </button>
        <button
          type="button"
          data-testid="start-line-tool-button"
          aria-pressed={toolMode === 'start-line'}
          onClick={() => setToolMode((m) => (m === 'start-line' ? 'select' : 'start-line'))}
        >
          {toolMode === 'start-line' ? 'Click a point to set as start…' : 'Set start/finish line'}
        </button>
        <button
          type="button"
          data-testid="checkpoint-tool-button"
          aria-pressed={toolMode === 'checkpoint'}
          onClick={() => setToolMode((m) => (m === 'checkpoint' ? 'select' : 'checkpoint'))}
        >
          {toolMode === 'checkpoint' ? 'Click points to toggle checkpoints…' : 'Edit checkpoints'}
        </button>
        <button
          type="button"
          data-testid="snap-to-grid-button"
          aria-pressed={snapToGridEnabled}
          onClick={() => setSnapToGridEnabled((v) => !v)}
        >
          Snap to grid: {snapToGridEnabled ? 'On' : 'Off'}
        </button>
        <button
          type="button"
          data-testid="pan-tool-button"
          aria-pressed={toolMode === 'pan'}
          onClick={() => setToolMode((m) => (m === 'pan' ? 'select' : 'pan'))}
        >
          {toolMode === 'pan' ? 'Drag to pan…' : 'Pan'}
        </button>
        <button type="button" data-testid="start-race-button" disabled={!canRace} onClick={() => setMode('race')}>
          Start Race
        </button>
      </div>
      <div className="toolbar">
        <input
          type="text"
          data-testid="save-name-input"
          value={saveName}
          placeholder="Track name"
          onChange={(e) => setSaveName(e.target.value)}
        />
        <button
          type="button"
          data-testid="save-track-button"
          disabled={!saveName.trim()}
          onClick={() => {
            const saved = saveTrack(doc, saveName.trim())
            loadTrack(saved)
            setSavedTracks(listSavedTracks())
          }}
        >
          Save track
        </button>
        <select
          data-testid="load-saved-select"
          defaultValue=""
          onChange={(e) => {
            const found = loadSavedTrack(e.target.value)
            if (found) {
              loadTrack(found)
              setSaveName(found.name)
            }
          }}
        >
          <option value="" disabled>
            Load saved track…
          </option>
          {savedTracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          data-testid="share-track-button"
          disabled={!canRace}
          onClick={() => {
            setShareError(null)
            shareTrack({ ...doc, name: saveName.trim() || doc.name })
              .then((res) => {
                setSharedTrackId(res.id)
                setShareUrl(`${window.location.origin}${window.location.pathname}?track=${res.id}`)
              })
              .catch(() => setShareError('Could not share the track - is the server running?'))
          }}
        >
          Share track
        </button>
        {shareUrl && <input type="text" data-testid="share-url-output" readOnly value={shareUrl} />}
        {shareError && <span className="validation-errors">{shareError}</span>}
      </div>
      <div className="editor-panels">
        <TrackEditor2D
          doc={doc}
          dispatch={dispatch}
          onCommit={commit}
          pointClickMode={toolMode}
          selectedIndex={selectedIndex}
          onSelectPoint={setSelectedIndex}
          snapToGridEnabled={snapToGridEnabled}
          loadKey={loadKey}
        />
        <LiveTrackPreview3D doc={doc} />
        <ControlPointInspector
          doc={doc}
          selectedIndex={selectedIndex}
          dispatch={dispatch}
          onDeletePoint={deleteSelectedPoint}
        />
      </div>
      {errors.length > 0 && (
        <ul className="validation-errors" data-testid="validation-errors">
          {errors.map((e) => (
            <li key={e.code}>{e.message}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default App
