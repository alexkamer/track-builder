# Spec Delta

## ADDED Requirements

### Requirement: Start/finish line and checkpoints visibly marked on the road
The system SHALL draw a marking on the road surface at the start/finish line and at each checkpoint, spanning the road's width at that location, so the driver can see where a lap begins and ends and where each gate they must pass through is.

#### Scenario: Start/finish line visible from the car
- **WHEN** the car approaches the start/finish line during a race
- **THEN** a marking spanning the road's width is visible on the road surface at that line

#### Scenario: Checkpoints visible from the car
- **WHEN** the car approaches a checkpoint during a race
- **THEN** a marking spanning the road's width is visible on the road surface at that checkpoint, visually distinct from the start/finish line's marking

#### Scenario: Markings match where the triggers are
- **WHEN** the car crosses a visible marking
- **THEN** the corresponding gate is registered, so the marking is at the same place as the trigger it represents rather than offset from it

#### Scenario: Track with no checkpoints
- **WHEN** a track defines no checkpoints
- **THEN** the start/finish line is still marked and no stray checkpoint markings are drawn

#### Scenario: Markings follow the road surface
- **WHEN** a marking falls on a section of track with elevation or banking
- **THEN** it lies flush on the road surface at that section rather than floating above it or sinking into it
