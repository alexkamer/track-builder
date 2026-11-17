# Spec Delta

## MODIFIED Requirements

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
