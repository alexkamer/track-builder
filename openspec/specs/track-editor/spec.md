# Track Editor Specification

## Purpose

Lets a user design a closed-loop race track on a 2D top-down canvas and validates it so that only well-formed tracks can proceed to 3D generation and racing.

## Requirements

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

### Requirement: Per-point track width, elevation, and banking
The system SHALL let a user set track width, elevation, and banking angle at each control point, with intermediate values along the curve interpolated between control points.

#### Scenario: Adjusting width at a control point
- **WHEN** the user selects a control point and changes its width value
- **THEN** the track width at that point updates and the live preview shows the width tapering smoothly to neighboring control points' widths

#### Scenario: Adjusting elevation at a control point
- **WHEN** the user selects a control point and changes its elevation value
- **THEN** the control point's stored elevation updates, and the live 3D preview reflects the height change at that point

#### Scenario: Adjusting banking at a control point
- **WHEN** the user selects a control point and sets a banking angle
- **THEN** the control point's stored banking angle updates and the live 3D preview shows the road surface rolled by that angle at that point

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

### Requirement: Start/finish line and checkpoint placement
The system SHALL let a user designate exactly one control point as the start/finish line with a heading, and designate any number of other control points as checkpoints, in a defined order around the loop.

#### Scenario: Setting the start/finish line
- **WHEN** the user designates a control point as the start/finish line
- **THEN** any previously designated start/finish line is unset, and the chosen control point becomes the sole start/finish line with a default heading the user can adjust

#### Scenario: Adding a checkpoint
- **WHEN** the user designates a non-start control point as a checkpoint
- **THEN** the checkpoint is added to the ordered checkpoint list at the position corresponding to its location along the loop

#### Scenario: Removing a checkpoint
- **WHEN** the user removes a previously designated checkpoint
- **THEN** the control point is no longer marked as a checkpoint and is removed from the ordered checkpoint list

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

### Requirement: Snap-to-grid toggle
The system SHALL let the user toggle a snap-to-grid mode that, when enabled, constrains placed and dragged control points to the nearest grid intersection at a fixed grid spacing.

#### Scenario: Placing a point with snap-to-grid enabled
- **WHEN** snap-to-grid is enabled and the user clicks to place a control point
- **THEN** the control point is placed at the nearest grid intersection to the click location

#### Scenario: Placing a point with snap-to-grid disabled
- **WHEN** snap-to-grid is disabled and the user clicks to place a control point
- **THEN** the control point is placed at the exact click location

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

### Requirement: Closed-loop validation
The system SHALL validate that a track forms a single closed loop with at least 3 control points before allowing the track to be raced, and SHALL report a clear error if it does not.

#### Scenario: Valid closed loop
- **WHEN** the track has 3 or more control points forming a single continuous loop
- **THEN** the closed-loop validation passes

#### Scenario: Insufficient control points
- **WHEN** the track has fewer than 3 control points
- **THEN** validation fails with an error explaining that at least 3 control points are required

### Requirement: Self-intersection validation
The system SHALL validate that the track's curve does not cross itself, and SHALL report a clear error identifying that the track self-intersects if it does.

#### Scenario: Non-intersecting track
- **WHEN** the generated closed curve does not cross itself at any point
- **THEN** self-intersection validation passes

#### Scenario: Self-intersecting track
- **WHEN** the generated closed curve crosses itself anywhere
- **THEN** validation fails with an error stating the track self-intersects

### Requirement: Minimum corner radius validation
The system SHALL validate that every point along the track's curve has a turning radius no smaller than a minimum derived from the car's actual achievable turn radius at full steering lock plus a safety margin, and SHALL report a clear error identifying the violation, including the location of the offending corner, if it does not.

#### Scenario: Track meets minimum radius
- **WHEN** every point along the curve has a turning radius at or above the minimum
- **THEN** minimum corner radius validation passes

#### Scenario: Track violates minimum radius
- **WHEN** any point along the curve has a turning radius below the minimum
- **THEN** validation fails with an error indicating a corner is too tight and identifying which control point the violation is nearest to

#### Scenario: Minimum radius reflects car physics
- **WHEN** the car's physics parameters (maximum speed and turn rate) determine its tightest achievable turn radius at full steering lock
- **THEN** the minimum corner radius validation threshold is at or above that achievable radius, by a margin large enough that a track validated at the threshold is drivable through its tightest corner without constant barrier contact

#### Scenario: Multiple corners violate the minimum radius
- **WHEN** more than one point along the curve has a turning radius below the minimum
- **THEN** validation fails identifying the first violating corner encountered, without requiring the user to inspect the entire curve to find it

### Requirement: Start line validation
The system SHALL validate that exactly one control point is designated as the start/finish line with a defined heading before a track can be raced, and SHALL report a clear error if none or more than one is set.

#### Scenario: Valid start line
- **WHEN** exactly one control point is designated as the start/finish line with a heading
- **THEN** start line validation passes

#### Scenario: Missing start line
- **WHEN** no control point is designated as the start/finish line
- **THEN** validation fails with an error stating a start/finish line must be set

### Requirement: Invalid tracks cannot be raced
The system SHALL prevent entering race mode for any track that fails closed-loop, self-intersection, minimum corner radius, or start line validation, and SHALL display all current validation errors to the user instead.

#### Scenario: Attempting to race an invalid track
- **WHEN** the user attempts to start a race on a track that fails any validation check
- **THEN** the system blocks entry to race mode and displays the specific validation error(s) that must be fixed
