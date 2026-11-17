# Spec Delta

## Purpose

Lets a user design a closed-loop race track on a 2D top-down canvas and validates it so that only well-formed tracks can proceed to 3D generation and racing.

## ADDED Requirements

### Requirement: Control point placement and editing
The system SHALL let a user place control points on a 2D top-down canvas by clicking, drag control points to reposition them, and delete control points, with the track rendered as a smooth closed curve through the current control points.

#### Scenario: Placing a new control point
- **WHEN** the user clicks on empty canvas space in track-drawing mode
- **THEN** a new control point is added at that position and the rendered curve updates to pass through it

#### Scenario: Dragging a control point
- **WHEN** the user drags an existing control point to a new position
- **THEN** the control point's position updates and the rendered curve updates live to reflect the new position

#### Scenario: Deleting a control point
- **WHEN** the user deletes a control point and at least 3 control points remain
- **THEN** the control point is removed and the curve re-renders through the remaining points

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
The system SHALL maintain an undo/redo history of editing actions (add/move/delete control point, width/elevation/banking changes, start line and checkpoint changes) so the user can step backward and forward through their edits.

#### Scenario: Undoing an edit
- **WHEN** the user triggers undo after making an edit
- **THEN** the track returns to its state immediately before that edit

#### Scenario: Redoing an undone edit
- **WHEN** the user triggers redo immediately after an undo
- **THEN** the track returns to the state the undo had reverted

#### Scenario: New edit after undo clears redo history
- **WHEN** the user makes a new edit after undoing one or more actions
- **THEN** the redo history for the undone actions is discarded

### Requirement: Snap-to-grid toggle
The system SHALL let the user toggle a snap-to-grid mode that, when enabled, constrains placed and dragged control points to the nearest grid intersection at a fixed grid spacing.

#### Scenario: Placing a point with snap-to-grid enabled
- **WHEN** snap-to-grid is enabled and the user clicks to place a control point
- **THEN** the control point is placed at the nearest grid intersection to the click location

#### Scenario: Placing a point with snap-to-grid disabled
- **WHEN** snap-to-grid is disabled and the user clicks to place a control point
- **THEN** the control point is placed at the exact click location

### Requirement: Canvas zoom and pan
The system SHALL let the user zoom and pan the 2D editing canvas without altering any track data.

#### Scenario: Zooming the canvas
- **WHEN** the user zooms in or out on the canvas
- **THEN** the visual scale of the canvas changes and no control point data is modified

#### Scenario: Panning the canvas
- **WHEN** the user pans the canvas
- **THEN** the visible region changes and no control point data is modified

### Requirement: Live 3D shape preview
The system SHALL show a live preview of the track's 3D shape that updates as the user edits control points, width, elevation, or banking in the 2D editor, without requiring an explicit "generate" action to see the preview update.

#### Scenario: Preview updates on edit
- **WHEN** the user changes any control point's position, width, elevation, or banking
- **THEN** the 3D preview updates to reflect the change without additional user action

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
The system SHALL validate that every point along the track's curve has a turning radius no smaller than a defined minimum, and SHALL report a clear error identifying the violation if it does not.

#### Scenario: Track meets minimum radius
- **WHEN** every point along the curve has a turning radius at or above the minimum
- **THEN** minimum corner radius validation passes

#### Scenario: Track violates minimum radius
- **WHEN** any point along the curve has a turning radius below the minimum
- **THEN** validation fails with an error indicating a corner is too tight

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
