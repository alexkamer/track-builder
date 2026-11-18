import type { SavedTrackSummary } from '../domain/track/trackStorage'
import { PRESET_TRACKS } from '../domain/track/presets'
import type { PointClickMode } from './TrackEditor2D'
import { ShareUrlField } from './ShareUrlField'

interface EditorToolbarProps {
  saveName: string
  onSaveNameChange: (value: string) => void
  onLoadPresetById: (id: string) => void
  savedTracks: SavedTrackSummary[]
  onLoadSavedById: (id: string) => void
  onSaveTrack: () => void
  canShare: boolean
  onShareTrack: () => void
  shareUrl: string | null
  shareError: string | null

  toolMode: PointClickMode
  onSetToolMode: (mode: PointClickMode) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  snapToGridEnabled: boolean
  onToggleSnapToGrid: () => void

  canRace: boolean
  errorCount: number
  onStartRace: () => void
  onBrowseTracks: () => void
}

/**
 * The editor's grouped toolbar: file/track operations, editing tools, and navigation.
 * Tool buttons keep a stable label regardless of active state (see `data-testid`/`aria-pressed`
 * for that state) - the sentence describing what the active tool's canvas click will do lives
 * in the hint region (`getToolHint`), not in the button.
 */
export function EditorToolbar({
  saveName,
  onSaveNameChange,
  onLoadPresetById,
  savedTracks,
  onLoadSavedById,
  onSaveTrack,
  canShare,
  onShareTrack,
  shareUrl,
  shareError,
  toolMode,
  onSetToolMode,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  snapToGridEnabled,
  onToggleSnapToGrid,
  canRace,
  errorCount,
  onStartRace,
  onBrowseTracks,
}: EditorToolbarProps) {
  /** Clicking an already-active tool deactivates it back to 'select'; clicking a different one activates it. */
  const toggleTool = (mode: PointClickMode) => {
    onSetToolMode(toolMode === mode ? 'select' : mode)
  }

  return (
    <div className="editor-toolbar-region">
      <div className="toolbar">
        <div className="toolbar-group toolbar-group--files">
          <span className="toolbar-group-label">Track</span>
          <select
            className="field"
            data-testid="preset-select"
            defaultValue=""
            onChange={(e) => onLoadPresetById(e.target.value)}
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
          <input
            type="text"
            className="field"
            data-testid="save-name-input"
            value={saveName}
            placeholder="Track name"
            onChange={(e) => onSaveNameChange(e.target.value)}
          />
          <button
            type="button"
            className="btn btn--flat"
            data-testid="save-track-button"
            disabled={!saveName.trim()}
            onClick={onSaveTrack}
          >
            Save track
          </button>
          <select
            className="field"
            data-testid="load-saved-select"
            defaultValue=""
            onChange={(e) => onLoadSavedById(e.target.value)}
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
            className="btn btn--flat"
            data-testid="share-track-button"
            disabled={!canShare}
            onClick={onShareTrack}
          >
            Share track
          </button>
        </div>
        <div className="toolbar-group toolbar-group--tools">
          <span className="toolbar-group-label">Tools</span>
          <div className="switches">
            <button
              type="button"
              data-testid="select-tool-button"
              aria-pressed={toolMode === 'select'}
              onClick={() => onSetToolMode('select')}
            >
              Select
            </button>
            <button
              type="button"
              data-testid="add-point-tool-button"
              aria-pressed={toolMode === 'add-point'}
              onClick={() => toggleTool('add-point')}
            >
              Add point
            </button>
            <button
              type="button"
              data-testid="start-line-tool-button"
              aria-pressed={toolMode === 'start-line'}
              onClick={() => toggleTool('start-line')}
            >
              Set start/finish line
            </button>
            <button
              type="button"
              data-testid="checkpoint-tool-button"
              aria-pressed={toolMode === 'checkpoint'}
              onClick={() => toggleTool('checkpoint')}
            >
              Edit checkpoints
            </button>
            <button
              type="button"
              data-testid="pan-tool-button"
              aria-pressed={toolMode === 'pan'}
              onClick={() => toggleTool('pan')}
            >
              Pan
            </button>
          </div>
          <button
            type="button"
            className="btn btn--switch"
            data-testid="snap-to-grid-button"
            aria-pressed={snapToGridEnabled}
            onClick={onToggleSnapToGrid}
          >
            Snap to grid
          </button>
          <button
            type="button"
            className="btn btn--momentary"
            data-testid="undo-button"
            disabled={!canUndo}
            onClick={onUndo}
          >
            Undo <span className="btn-shortcut">Ctrl+Z</span>
          </button>
          <button
            type="button"
            className="btn btn--momentary"
            data-testid="redo-button"
            disabled={!canRedo}
            onClick={onRedo}
          >
            Redo <span className="btn-shortcut">Ctrl+Y</span>
          </button>
        </div>
        <div className="toolbar-group toolbar-group--nav">
          <span className="toolbar-group-label">Race</span>
          <div className="race-gate">
            <button
              type="button"
              className="btn btn--go"
              data-testid="start-race-button"
              disabled={!canRace}
              aria-describedby={!canRace ? 'race-validation-summary' : undefined}
              onClick={onStartRace}
            >
              Start Race
            </button>
            {!canRace && (
              <span className="validation-summary" id="race-validation-summary" data-testid="race-validation-summary">
                <span className="validation-summary-badge">{errorCount}</span>
                {errorCount === 1 ? 'issue to fix' : 'issues to fix'}
              </span>
            )}
          </div>
          <button type="button" className="btn btn--flat" data-testid="browse-tracks-button" onClick={onBrowseTracks}>
            Browse Tracks
          </button>
        </div>
      </div>
      {(shareUrl || shareError) && (
        <div className="toolbar">
          {shareUrl && <ShareUrlField key={shareUrl} url={shareUrl} />}
          {shareError && <span className="validation-errors">{shareError}</span>}
        </div>
      )}
    </div>
  )
}
