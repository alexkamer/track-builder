# Sharing And Leaderboards Specification

## Purpose

Persists user-created tracks, lets them be shared and reopened via a unique URL, and maintains a per-track public leaderboard of best lap times submitted by anonymous sessions.

## Requirements

### Requirement: Save and load tracks losslessly
The system SHALL save a track as a versioned JSON document matching the track data schema and SHALL load it back into an editable track that is identical to the one saved, with no loss of control points, width, elevation, banking, checkpoints, start line, or metadata. The system SHALL also record the anonymous session that saved a new track as its creator.

#### Scenario: Round-trip save and load
- **WHEN** a track is saved and then loaded back
- **THEN** every control point's position, width, elevation, and banking, every checkpoint, the start line, and the track metadata match the values before saving

#### Scenario: Saving a track assigns a name
- **WHEN** the user saves a track and provides a name
- **THEN** the saved track document stores that name

#### Scenario: Saving a new track records its creator
- **WHEN** a user's anonymous session saves a track for the first time
- **THEN** that session id is stored as the track's creator for later ownership checks

### Requirement: Shareable track URL
The system SHALL generate a unique URL for each saved track such that opening that URL loads the same track for racing, without requiring the opener to have created or previously accessed it, and SHALL provide a control that copies the generated URL to the clipboard with visible confirmation.

#### Scenario: Opening a shared track URL
- **WHEN** a user who did not create a track opens its shareable URL
- **THEN** the same track loads and is raceable without any additional setup by that user

#### Scenario: Each saved track has a distinct URL
- **WHEN** two different tracks are saved
- **THEN** their shareable URLs are distinct and each resolves only to its own track

#### Scenario: Copying the shareable URL
- **WHEN** a shareable URL has been generated and the user activates the copy control
- **THEN** the full URL is written to the clipboard and the user is shown a confirmation that it was copied

#### Scenario: Copy fails
- **WHEN** the user activates the copy control and the clipboard write is rejected or unavailable
- **THEN** the user is told the copy did not succeed and the URL remains visible and selectable so it can be copied manually

#### Scenario: Copy control only present with a URL
- **WHEN** no shareable URL has been generated for the current track
- **THEN** no copy control is offered

### Requirement: Anonymous session identity
The system SHALL identify users by an anonymous session, without requiring account creation, and SHALL let the user set an optional display name used when submitting lap times.

#### Scenario: Racing without an account
- **WHEN** a user with no account opens a track and completes a valid lap
- **THEN** the user is able to submit that lap time under their anonymous session

#### Scenario: Setting a display name
- **WHEN** the user sets an optional display name before submitting a lap time
- **THEN** the submitted lap time is associated with that display name on the leaderboard

#### Scenario: Submitting without a display name
- **WHEN** the user submits a lap time without having set a display name
- **THEN** the lap time is still recorded on the leaderboard, shown as anonymous

### Requirement: Per-track public leaderboard
The system SHALL maintain a public leaderboard of submitted best lap times for each track, ordered from fastest to slowest, visible to anyone who opens that track.

#### Scenario: Viewing a track's leaderboard
- **WHEN** a user opens a track that has submitted lap times
- **THEN** the leaderboard for that track displays the submitted times ordered from fastest to slowest

#### Scenario: Leaderboard updates after a new submission
- **WHEN** a new lap time is submitted for a track
- **THEN** the track's leaderboard reflects the new entry in its correctly ordered position

### Requirement: Server-side sanity validation of submitted lap times
The system SHALL validate a submitted lap time against the submitted input log and the track's definition before accepting it onto the leaderboard, rejecting submissions where re-simulating the input log does not produce a matching valid lap and lap time.

#### Scenario: Valid submission accepted
- **WHEN** a submitted lap time's accompanying input log, re-simulated against the track, produces a valid lap with a matching lap time
- **THEN** the submission is accepted and added to the leaderboard

#### Scenario: Tampered or inconsistent submission rejected
- **WHEN** a submitted lap time's accompanying input log, re-simulated against the track, does not produce a valid lap or produces a different lap time
- **THEN** the submission is rejected and not added to the leaderboard
