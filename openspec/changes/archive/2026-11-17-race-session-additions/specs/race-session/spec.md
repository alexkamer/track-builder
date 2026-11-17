# Spec Delta

## ADDED Requirements

### Requirement: Pre-race countdown
The system SHALL display a "3-2-1-GO" countdown when a race attempt begins (on initial race-mode load and after a restart) and SHALL withhold car control, so the simulated car does not move or respond to input, until the countdown completes.

#### Scenario: Car is uncontrollable during countdown
- **WHEN** the countdown is displaying 3, 2, or 1
- **THEN** keyboard/gamepad input is ignored and the car's simulated position and heading do not change

#### Scenario: Countdown completes and releases control
- **WHEN** the countdown reaches "GO" and that phase ends
- **THEN** the car becomes controllable and subsequent input drives the physics simulation normally

### Requirement: Mid-race attempt restart
The system SHALL let the user restart the current attempt while remaining in race mode: the car SHALL be reset to the spawn position and heading, the live lap timer and in-progress checkpoint sequence SHALL be reset to their pre-lap state, and the pre-race countdown SHALL run again before the car becomes controllable.

#### Scenario: Restart resets car and live lap state
- **WHEN** the user triggers a restart during a race attempt
- **THEN** the car's position and heading reset to the spawn point, the live lap timer resets to zero, and checkpoint progress for the in-progress lap resets to the start

#### Scenario: Restart re-arms the countdown
- **WHEN** a restart is triggered
- **THEN** the 3-2-1-GO countdown displays again and the car remains uncontrollable until it completes

#### Scenario: Restart preserves best lap and ghost
- **WHEN** the user triggers a restart after a best lap has already been recorded in the session
- **THEN** the tracked best lap time and the ghost's recorded input sequence are unchanged by the restart

#### Scenario: Restart does not leave race mode
- **WHEN** the user triggers a restart
- **THEN** the track is not regenerated and the user is not returned to the editor
