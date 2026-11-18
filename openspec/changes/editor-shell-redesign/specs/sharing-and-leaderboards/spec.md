# Spec Delta

## MODIFIED Requirements

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
