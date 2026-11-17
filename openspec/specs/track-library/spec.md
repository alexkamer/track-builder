# Track Library Specification

## Purpose

Lets anyone discover tracks saved on the server without needing a share URL, and lets the anonymous session that created a track rename or delete it later.

## Requirements

### Requirement: Browse saved tracks
The system SHALL provide a way to list all tracks saved on the server, including each track's name and when it was saved, without requiring the requester to know any track's id in advance.

#### Scenario: Listing tracks with no prior knowledge
- **WHEN** a user opens the browse view without having any track's share URL
- **THEN** every track saved on the server appears in the list with its name

#### Scenario: Newly saved track appears in the list
- **WHEN** a track is saved
- **THEN** it subsequently appears in the browse list

### Requirement: Track creator attribution
The system SHALL record which anonymous session created a track at save time, so that later rename and delete requests can be checked against it.

#### Scenario: Creator recorded on save
- **WHEN** a user saves a new track from a browser with an anonymous session id
- **THEN** the server records that session id as the track's creator

### Requirement: Rename a track you created
The system SHALL let the anonymous session that created a track change that track's name, and SHALL reject a rename request from any other session.

#### Scenario: Creator renames their track
- **WHEN** the creating session submits a new name for a track it created
- **THEN** the track's name is updated and the browse list reflects the new name

#### Scenario: Non-creator rename rejected
- **WHEN** a session that did not create a track submits a rename request for it
- **THEN** the request is rejected and the track's name is unchanged

### Requirement: Delete a track you created
The system SHALL let the anonymous session that created a track delete it, and SHALL reject a delete request from any other session.

#### Scenario: Creator deletes their track
- **WHEN** the creating session requests deletion of a track it created
- **THEN** the track is removed and no longer appears in the browse list or resolves at its share URL

#### Scenario: Non-creator delete rejected
- **WHEN** a session that did not create a track requests its deletion
- **THEN** the request is rejected and the track remains available
