import type { TrackDocument } from '../domain/track/schema'
import type { EditorAction } from '../domain/track/editorReducer'

interface ControlPointInspectorProps {
  doc: TrackDocument
  selectedIndex: number | null
  dispatch: (action: EditorAction) => void
}

export function ControlPointInspector({ doc, selectedIndex, dispatch }: ControlPointInspectorProps) {
  if (selectedIndex === null || !doc.controlPoints[selectedIndex]) {
    return (
      <div className="inspector" data-testid="control-point-inspector">
        <p>Select a control point to edit its width, elevation, and banking.</p>
      </div>
    )
  }

  const point = doc.controlPoints[selectedIndex]

  return (
    <div className="inspector" data-testid="control-point-inspector">
      <h3>Control point {selectedIndex}</h3>
      <label>
        Width
        <input
          type="number"
          data-testid="point-width-input"
          value={point.width}
          min={2}
          step={0.5}
          onChange={(e) =>
            dispatch({ type: 'SET_POINT_WIDTH', index: selectedIndex, width: Number(e.target.value) })
          }
        />
      </label>
      <label>
        Elevation
        <input
          type="number"
          data-testid="point-elevation-input"
          value={point.elevation}
          step={0.5}
          onChange={(e) =>
            dispatch({
              type: 'SET_POINT_ELEVATION',
              index: selectedIndex,
              elevation: Number(e.target.value),
            })
          }
        />
      </label>
      <label>
        Banking (deg)
        <input
          type="number"
          data-testid="point-banking-input"
          value={point.bankingDeg}
          min={-45}
          max={45}
          step={1}
          onChange={(e) =>
            dispatch({
              type: 'SET_POINT_BANKING',
              index: selectedIndex,
              bankingDeg: Number(e.target.value),
            })
          }
        />
      </label>
    </div>
  )
}
