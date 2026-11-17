import type { TrackDocument } from '../domain/track/schema'
import type { EditorAction } from '../domain/track/editorReducer'

interface TrackMetadataPanelProps {
  doc: TrackDocument
  dispatch: (action: EditorAction, opts?: { transient?: boolean }) => void
  onCommit?: () => void
}

export function TrackMetadataPanel({ doc, dispatch, onCommit }: TrackMetadataPanelProps) {
  return (
    <div className="toolbar" data-testid="track-metadata-panel">
      <label>
        Author
        <input
          type="text"
          data-testid="metadata-author-input"
          value={doc.metadata.author ?? ''}
          placeholder="Author"
          onChange={(e) =>
            dispatch({ type: 'SET_METADATA', metadata: { author: e.target.value } }, { transient: true })
          }
          onBlur={() => onCommit?.()}
        />
      </label>
      <label>
        Description
        <input
          type="text"
          data-testid="metadata-description-input"
          value={doc.metadata.description ?? ''}
          placeholder="Description"
          onChange={(e) =>
            dispatch({ type: 'SET_METADATA', metadata: { description: e.target.value } }, { transient: true })
          }
          onBlur={() => onCommit?.()}
        />
      </label>
    </div>
  )
}
