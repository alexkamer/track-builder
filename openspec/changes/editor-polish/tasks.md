# Tasks

## 1. Auto-fit 2D canvas and 3D preview on track load

- [x] 1.1 Expose a load-identity signal from `useTrackEditorHistory` (reuse `doc.id` + `doc.createdAt`, or add a `loadVersion` counter if those don't change on every load path) and pass it through `App.tsx` to `TrackEditor2D`
- [x] 1.2 In `TrackEditor2D`, compute a bounding-box fit (`zoom`/`panX`/`panY` clamped to `[MIN_ZOOM, MAX_ZOOM]`, centered, with padding; fall back to the current default view for degenerate/near-empty bounds) and apply it in a `useEffect` keyed on the load-identity signal, not on every `doc` change; verify via a test that loading a preset with far-off-origin control points results in a view transform containing all points, and that dragging/adding a point afterward does not reset the view
- [x] 1.3 Add a test asserting `LiveTrackPreview3D`'s existing `CameraFraming` repositions the camera to frame the full track when `doc` changes via a load (not just an in-place edit), covering the proposal's explicit "on load" scenario
- [x] 1.4 Manually verify in the running app: load each of the preset tracks with large coordinate ranges and confirm the 2D canvas and 3D preview both show the full track without manual zoom/pan

## 2. Delete-control-point UI

- [x] 2.1 Add a "Delete point" button to `ControlPointInspector`, disabled when no point is selected or when `doc.controlPoints.length <= 3`, dispatching `{ type: 'DELETE_POINT', index: selectedIndex }` and clearing selection on click; verify with a component test that clicking it removes the point and a test that the button is disabled at the 3-point floor
- [x] 2.2 Ensure selection clears or re-targets sensibly after delete (no stale `selectedIndex` pointing past the new array length); verify with a test that selecting the last point and deleting it leaves no point selected

## 3. Keyboard shortcuts for undo/redo/delete

- [x] 3.1 Add a `keydown` listener (e.g. in `App.tsx`, or a small `useEditorKeyboardShortcuts` hook) that calls `undo()` on Ctrl/Cmd+Z, `redo()` on Ctrl+Y or Ctrl/Cmd+Shift+Z, and dispatches delete-selected-point on Delete/Backspace, each only when the event target is not a text input/textarea; verify with tests simulating each key combination against `canUndo`/`canRedo`/selection state
- [x] 3.2 Verify shortcuts are no-ops when history is empty (no undo/redo available) or when focus is in the save-name, author, or description input (typing "Backspace" in those fields must not delete a control point); add a regression test for each
- [x] 3.3 Manually verify in the running app on both a Ctrl-based and Cmd-based keyboard mapping (or simulate `metaKey`/`ctrlKey` in tests) that each shortcut matches its corresponding button's behavior

## 4. Track metadata (author/description) editing UI

- [x] 4.1 Add a `SET_METADATA` action to `EditorAction`/`editorReducer.ts` that merges a partial `TrackMetadata` into `doc.metadata`; verify with a reducer unit test covering partial updates and undo/redo participation
- [x] 4.2 Add author/description text inputs in `App.tsx` (or a small metadata panel component), bound to `doc.metadata.author`/`description`, dispatching `SET_METADATA` with `{ transient: true }` on change and `commit()` on blur; verify with a component test that typing updates the field and undo after blur reverts it
- [x] 4.3 Verify the inputs reflect the loaded track's existing metadata (including empty/unset values rendering as empty strings) when switching between presets/saved tracks; add a test for this load-reflects-metadata scenario

## Workflow follow-up

- Run the full test suite and linter before marking the change ready for review.
- Archive the change after review, syncing the `track-editor` spec delta into the main spec.
