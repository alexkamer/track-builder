# Proposal

## Why

The track editor has several UX gaps that make it harder to use than its underlying functionality supports: large preset/imported tracks render off-screen until the user manually zooms and pans, there is no way to delete a control point except by dispatching the reducer action directly (no button or shortcut exists), common undo/redo and delete actions have no keyboard shortcuts, and the track's author/description metadata fields exist in the schema but have no editing UI. These are independent, low-risk polish items that each materially improve day-to-day editing.

## What Changes

- Auto-fit/center the 2D canvas view (zoom/pan) and the 3D live preview's camera on the track's current control-point bounds whenever a track is loaded (preset load, saved-track load, or shared-track fetch). The 3D preview's `CameraFraming` already reframes on every mesh change, including loads, so this item is primarily a 2D-canvas gap; the 3D preview is included to confirm/cover the "load" case explicitly rather than relying on its continuous-update behavior as a coincidence.
- Add a "Delete point" button in the editor toolbar/inspector, enabled when a control point is selected and more than 3 control points exist, dispatching the existing `DELETE_POINT` action.
- Add keyboard shortcuts: Ctrl+Z / Cmd+Z for undo, Ctrl+Y or Ctrl+Shift+Z / Cmd+Shift+Z for redo, and Delete/Backspace to delete the currently selected control point. These trigger the existing undo/redo/delete actions and do not add new history entries beyond what those actions already produce.
- Add editable text inputs for `metadata.author` and `metadata.description` in the editor UI, wired through the existing dispatch/history mechanism so edits participate in undo/redo like other track edits.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `track-editor`: Adds auto-fit behavior to the canvas zoom/pan requirement on track load, adds a delete-control-point UI affordance to the control point placement/editing requirement, adds keyboard shortcuts to the undo/redo requirement, and adds a new requirement for editing track metadata (author/description).

## Impact

- `src/components/TrackEditor2D.tsx`: view-transform auto-fit on doc load, delete-point UI/shortcut wiring.
- `src/components/LiveTrackPreview3D.tsx`: confirm/extend camera framing on load.
- `src/App.tsx`: wire keyboard shortcuts (undo/redo/delete), add metadata inputs, add delete-point button.
- `src/domain/track/editorReducer.ts`: adds a `SET_METADATA` (or similar) action for author/description; `DELETE_POINT` already exists and is reused as-is.
- `src/domain/track/schema.ts`: no change (fields already exist).
- No breaking changes; no API or storage format changes.
