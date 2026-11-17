# Race Session Specification

## Purpose

Runs a single-player race on a generated track: lap timing, checkpoint-gated lap validation, best-lap tracking, ghost replay of the user's own best lap, and camera modes.

## Requirements

### Requirement: Checkpoint-gated lap validation
The system SHALL require the car to pass through all checkpoints in their defined order, followed by the start/finish line, for a lap to count; a lap completed out of order or skipping a checkpoint SHALL NOT be recorded as valid.

#### Scenario: Valid lap completion
- **WHEN** the car passes through every checkpoint in order and then crosses the start/finish line
- **THEN** a valid lap is recorded with its completion time

#### Scenario: Skipping a checkpoint
- **WHEN** the car crosses the start/finish line without having passed through all checkpoints in order
- **THEN** no lap is recorded as complete

### Requirement: Lap timing
The system SHALL measure elapsed time from the moment the car crosses the start/finish line beginning a lap to the moment it crosses the start/finish line completing that lap, using the fixed-timestep simulation clock.

#### Scenario: Timing a completed lap
- **WHEN** the car crosses the start/finish line to begin a lap and later crosses it again having validly completed the lap
- **THEN** the recorded lap time equals the simulated time elapsed between those two crossings

### Requirement: Best-lap tracking
The system SHALL track the user's best (lowest) valid lap time for the current track within the session and display it to the user.

#### Scenario: New best lap
- **WHEN** a newly completed valid lap is faster than the previously tracked best lap (or no best lap exists yet)
- **THEN** the new lap time becomes the tracked best lap and is displayed as such

#### Scenario: Slower lap does not replace best
- **WHEN** a newly completed valid lap is slower than the tracked best lap
- **THEN** the tracked best lap remains unchanged

### Requirement: Ghost replay of best lap
The system SHALL record the per-tick input sequence of the user's best lap and allow replaying it as a ghost car simulated alongside the user's live car on subsequent attempts.

#### Scenario: Ghost appears after a best lap exists
- **WHEN** the user starts a new lap attempt after a best lap has been recorded
- **THEN** a ghost car replays the recorded best-lap input sequence through the fixed-timestep simulation alongside the user's live car

#### Scenario: Ghost updates when a new best lap is set
- **WHEN** the user completes a lap that becomes the new best lap
- **THEN** the ghost's recorded input sequence is replaced with the new best lap's input sequence for subsequent attempts

### Requirement: Chase and top-down camera modes
The system SHALL provide a chase camera that follows behind the user's car and a top-down camera showing the car from above, with the user able to switch between them during a race.

#### Scenario: Switching to chase camera
- **WHEN** the user selects chase camera mode
- **THEN** the view follows behind and tracks the orientation of the user's car

#### Scenario: Switching to top-down camera
- **WHEN** the user selects top-down camera mode
- **THEN** the view shows the car and surrounding track from directly above
