import { useEffect, useState } from 'react'
import { TrackEditor2D, type PointClickMode } from './components/TrackEditor2D'
import { LiveTrackPreview3D } from './components/LiveTrackPreview3D'
import { ControlPointInspector } from './components/ControlPointInspector'
import { TrackMetadataPanel } from './components/TrackMetadataPanel'
import { RaceScene } from './components/RaceScene'
import { EditorHeader } from './components/EditorHeader'
import { EditorToolbar } from './components/EditorToolbar'
import { EditorWorkArea } from './components/EditorWorkArea'
import { getToolHint } from './domain/track/toolHints'
import { useTrackEditorHistory } from './hooks/useTrackEditorHistory'
import { useEditorKeyboardShortcuts } from './hooks/useEditorKeyboardShortcuts'
import { validateTrack } from './domain/track/validation'
import { PRESET_TRACKS } from './domain/track/presets'
import { listSavedTracks, loadTrack as loadSavedTrack, saveTrack } from './domain/track/trackStorage'
import { fetchSharedTrack, shareTrack } from './api/client'
import { recordCreatedTrack } from './domain/session/myTracks'
import { TrackBrowser } from './components/TrackBrowser'
import './App.css'

type Mode = 'edit' | 'race' | 'browse'

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
        <div className="race-top-bar">
          <button type="button" className="btn btn--ghost" onClick={() => setMode('edit')}>
            Back to editor
          </button>
        </div>
        <RaceScene doc={doc} trackId={sharedTrackId} />
      </div>
    )
  }

  if (mode === 'browse') {
    return (
      <div className="app-shell">
        <button type="button" className="btn btn--ghost" onClick={() => setMode('edit')}>
          Back to editor
        </button>
        <TrackBrowser
          onOpenTrack={(id) => {
            fetchSharedTrack(id)
              .then((fetchedDoc) => {
                loadTrack(fetchedDoc)
                setSaveName(fetchedDoc.name)
                setSharedTrackId(id)
                setMode('edit')
              })
              .catch(() => setShareError('Could not load the selected track.'))
          }}
        />
      </div>
    )
  }

  const handleLoadPresetById = (id: string) => {
    const preset = PRESET_TRACKS.find((t) => t.id === id)
    if (preset) loadTrack(preset)
  }

  const handleLoadSavedById = (id: string) => {
    const found = loadSavedTrack(id)
    if (found) {
      loadTrack(found)
      setSaveName(found.name)
    }
  }

  const handleSaveTrack = () => {
    const saved = saveTrack(doc, saveName.trim())
    loadTrack(saved)
    setSavedTracks(listSavedTracks())
  }

  const handleShareTrack = () => {
    setShareError(null)
    shareTrack({ ...doc, name: saveName.trim() || doc.name })
      .then((res) => {
        recordCreatedTrack(res.id)
        setSharedTrackId(res.id)
        setShareUrl(`${window.location.origin}${window.location.pathname}?track=${res.id}`)
      })
      .catch(() => setShareError('Could not share the track - is the server running?'))
  }

  return (
    <div className="editor-shell">
      <EditorHeader title="Trackforge Editor" />
      <EditorToolbar
        saveName={saveName}
        onSaveNameChange={setSaveName}
        onLoadPresetById={handleLoadPresetById}
        savedTracks={savedTracks}
        onLoadSavedById={handleLoadSavedById}
        onSaveTrack={handleSaveTrack}
        canShare={canRace}
        onShareTrack={handleShareTrack}
        shareUrl={shareUrl}
        shareError={shareError}
        toolMode={toolMode}
        onSetToolMode={setToolMode}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        snapToGridEnabled={snapToGridEnabled}
        onToggleSnapToGrid={() => setSnapToGridEnabled((v) => !v)}
        canRace={canRace}
        errorCount={errors.length}
        onStartRace={() => setMode('race')}
        onBrowseTracks={() => setMode('browse')}
      />
      <EditorWorkArea
        hint={getToolHint(toolMode)}
        canvas={
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
        }
        sideRail={
          <>
            <LiveTrackPreview3D doc={doc} />
            <ControlPointInspector
              doc={doc}
              selectedIndex={selectedIndex}
              dispatch={dispatch}
              onDeletePoint={deleteSelectedPoint}
            />
          </>
        }
      />
      <div className="editor-status-region">
        <TrackMetadataPanel doc={doc} dispatch={dispatch} onCommit={commit} />
        {errors.length > 0 && (
          <ul className="validation-errors" data-testid="validation-errors">
            {errors.map((e) => (
              <li key={e.code}>{e.message}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default App
