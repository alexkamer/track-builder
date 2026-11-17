# Spec Delta

## MODIFIED Requirements

### Requirement: Control point placement and editing
The system SHALL let a user place control points on a 2D top-down canvas by clicking, drag control points to reposition them, and delete control points via a visible UI control or keyboard shortcut, with the track rendered as a smooth closed curve through the current control points.

#### Scenario: Placing a new control point
- **WHEN** the user clicks on empty canvas space in track-drawing mode
- **THEN** a new control point is added at that position and the rendered curve updates to pass through it

#### Scenario: Dragging a control point
- **WHEN** the user drags an existing control point to a new position
- **THEN** the control point's position updates and the rendered curve updates live to reflect the new position

#### Scenario: Deleting a control point
- **WHEN** the user deletes a control point and at least 3 control points remain
- **THEN** the control point is removed and the curve re-renders through the remaining points

#### Scenario: Deleting the selected point via UI control
- **WHEN** a control point is selected and the user activates the delete-point control
- **THEN** the selected control point is removed, provided at least 3 control points remain, and no other control point remains selected

#### Scenario: Deleting the selected point via keyboard shortcut
- **WHEN** a control point is selected and the user presses Delete or Backspace while not focused in a text input
- **THEN** the selected control point is removed, provided at least 3 control points remain

#### Scenario: Delete control disabled below minimum
- **WHEN** exactly 3 control points exist, regardless of selection
- **THEN** the delete-point control is disabled and the Delete/Backspace shortcut has no effect

### Requirement: Undo and redo
The system SHALL maintain an undo/redo history of editing actions (add/move/delete control point, width/elevation/banking changes, start line and checkpoint changes, metadata changes) so the user can step backward and forward through their edits, and SHALL let the user trigger undo and redo via keyboard shortcuts in addition to any UI controls.

#### Scenario: Undoing an edit
- **WHEN** the user triggers undo after making an edit
- **THEN** the track returns to its state immediately before that edit

#### Scenario: Redoing an undone edit
- **WHEN** the user triggers redo immediately after an undo
- **THEN** the track returns to the state the undo had reverted

#### Scenario: New edit after undo clears redo history
- **WHEN** the user makes a new edit after undoing one or more actions
- **THEN** the redo history for the undone actions is discarded

#### Scenario: Undo via keyboard shortcut
- **WHEN** the user presses Ctrl+Z (or Cmd+Z on macOS) while not focused in a text input and an undo step is available
- **THEN** the track returns to its state immediately before the most recent edit, identical to activating the Undo button

#### Scenario: Redo via keyboard shortcut
- **WHEN** the user presses Ctrl+Y, or Ctrl+Shift+Z (or Cmd+Shift+Z on macOS), while not focused in a text input and a redo step is available
- **THEN** the track returns to the state the most recent undo had reverted, identical to activating the Redo button

#### Scenario: Shortcuts disabled with no history
- **WHEN** no undo or redo steps are available
- **THEN** the corresponding keyboard shortcut has no effect

### Requirement: Canvas zoom and pan
The system SHALL let the user zoom and pan the 2D editing canvas without altering any track data, and SHALL automatically fit and center the canvas view on the track's control-point bounds whenever a track is loaded.

#### Scenario: Zooming the canvas
- **WHEN** the user zooms in or out on the canvas
- **THEN** the visual scale of the canvas changes and no control point data is modified

#### Scenario: Panning the canvas
- **WHEN** the user pans the canvas
- **THEN** the visible region changes and no control point data is modified

#### Scenario: Auto-fit on track load
- **WHEN** a track is loaded into the editor (from a preset, a saved track, or a shared track fetched by URL), including one whose control points lie outside the previously visible region
- **THEN** the 2D canvas view is reset to a zoom and pan that fits all of the loaded track's control points within the visible canvas area, centered on their bounds

#### Scenario: Auto-fit does not alter track data
- **WHEN** the canvas view auto-fits on load
- **THEN** no control point position, width, elevation, banking, start line, checkpoint, or metadata value is modified

### Requirement: Live 3D shape preview
The system SHALL show a live preview of the track's 3D shape that updates as the user edits control points, width, elevation, or banking in the 2D editor, without requiring an explicit "generate" action to see the preview update, and SHALL frame the preview's camera on the track's bounds whenever a track is loaded.

#### Scenario: Preview updates on edit
- **WHEN** the user changes any control point's position, width, elevation, or banking
- **THEN** the 3D preview updates to reflect the change without additional user action

#### Scenario: Camera frames the track on load
- **WHEN** a track is loaded into the editor (from a preset, a saved track, or a shared track fetched by URL)
- **THEN** the 3D preview's camera is positioned so the entire loaded track is visible, centered on its bounds

## ADDED Requirements

### Requirement: Track metadata editing
The system SHALL let a user view and edit a track's author and description metadata fields from the editor UI, with changes participating in the same undo/redo history as other track edits.

#### Scenario: Editing the author field
- **WHEN** the user types a new value into the author field
- **THEN** the track's `metadata.author` is updated to that value

#### Scenario: Editing the description field
- **WHEN** the user types a new value into the description field
- **THEN** the track's `metadata.description` is updated to that value

#### Scenario: Metadata edits are undoable
- **WHEN** the user edits the author or description field and then triggers undo
- **THEN** the field returns to its value before the edit

#### Scenario: Metadata fields reflect the loaded track
- **WHEN** a track is loaded into the editor
- **THEN** the author and description fields display that track's current `metadata.author` and `metadata.description` values (empty if unset)
