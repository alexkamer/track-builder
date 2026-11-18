# Spec Delta

## ADDED Requirements

### Requirement: Active editing tool is identifiable
The system SHALL indicate which editing tool is currently active as a persistent visual state on that tool's control, distinct from the inactive state, and SHALL keep each tool control's label stable regardless of whether it is active.

#### Scenario: Activating a tool
- **WHEN** the user activates an editing tool (select, add point, set start/finish line, edit checkpoints, or pan)
- **THEN** that tool's control is shown in an active state, every other tool control is shown inactive, and the active control's label text is unchanged from its inactive label

#### Scenario: Only one tool is active at a time
- **WHEN** the user activates a tool while a different tool is already active
- **THEN** the newly activated tool becomes the sole active tool and the previously active tool returns to its inactive state

#### Scenario: Deactivating a tool returns to select
- **WHEN** the user deactivates the active tool
- **THEN** the select tool becomes active and is shown in the active state

### Requirement: Active tool explains what clicking will do
The system SHALL display instructional text for the active editing tool, describing what clicking the canvas will do, in a region of the editor separate from the tool controls themselves.

#### Scenario: Hint shown for a tool with a canvas action
- **WHEN** the add-point, start-line, checkpoint, or pan tool is active
- **THEN** the editor displays instructional text describing that tool's canvas action, outside of the tool control

#### Scenario: Hint updates when the tool changes
- **WHEN** the user switches from one active tool to another
- **THEN** the displayed instructional text is replaced with the newly active tool's instructional text

## MODIFIED Requirements

### Requirement: Invalid tracks cannot be raced
The system SHALL prevent entering race mode for any track that fails closed-loop, self-intersection, minimum corner radius, or start line validation, SHALL display all current validation errors to the user instead, and SHALL indicate on the race-entry control itself that validation is blocking race entry, including how many errors are outstanding.

#### Scenario: Attempting to race an invalid track
- **WHEN** the user attempts to start a race on a track that fails any validation check
- **THEN** the system blocks entry to race mode and displays the specific validation error(s) that must be fixed

#### Scenario: Race-entry control shows why it is blocked
- **WHEN** the current track fails one or more validation checks
- **THEN** the race-entry control is disabled and is accompanied by an indication that validation is failing and how many errors are outstanding, without the user having to locate the separate error list

#### Scenario: Blocked indication clears when the track becomes valid
- **WHEN** the user edits a failing track until it passes every validation check
- **THEN** the race-entry control becomes enabled, the blocked indication is removed, and no validation errors are displayed
