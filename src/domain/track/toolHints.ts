import type { PointClickMode } from '../../components/TrackEditor2D'

/** Instructional text for the active tool, shown in a hint region near the canvas rather than inside the tool button's own label. */
const TOOL_HINTS: Record<PointClickMode, string> = {
  select: 'Click a control point to select it, or drag it to move it.',
  'add-point': 'Click empty canvas to add a point there.',
  'start-line': 'Click a point to set it as the start/finish line.',
  checkpoint: 'Click points to toggle them as checkpoints.',
  pan: 'Drag empty canvas to pan the view.',
}

export function getToolHint(mode: PointClickMode): string {
  return TOOL_HINTS[mode]
}
