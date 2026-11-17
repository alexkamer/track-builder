# Spec Delta

## Purpose

Simulates an arcade-style car on the generated track using a deterministic fixed-timestep model, so the same sequence of inputs always produces the same resulting motion.

## ADDED Requirements

### Requirement: Fixed-timestep deterministic simulation
The system SHALL advance car physics state using a fixed simulation timestep, decoupled from rendering frame rate, such that the resulting sequence of car states depends only on the initial state, the track, and the ordered sequence of per-tick inputs — never on wall-clock time, frame rate, or randomness.

#### Scenario: Identical input sequence produces identical motion
- **WHEN** the same ordered sequence of per-tick inputs is simulated twice against the same track from the same initial state
- **THEN** the resulting sequence of car states (position, heading, velocity) is identical both times

#### Scenario: Simulation rate independent of render rate
- **WHEN** the rendering frame rate varies during a race
- **THEN** the number of physics ticks executed per unit of simulated time remains constant and unaffected by the render rate

### Requirement: Keyboard-controlled acceleration, braking, and steering
The system SHALL let the user control the car's throttle, brake, and steering via keyboard input, updating the car's acceleration and steering angle each physics tick based on the current input state.

#### Scenario: Accelerating
- **WHEN** the user holds the throttle control
- **THEN** the car's forward speed increases each tick up to its maximum, following its acceleration curve

#### Scenario: Braking
- **WHEN** the user holds the brake control while moving
- **THEN** the car's forward speed decreases each tick

#### Scenario: Steering
- **WHEN** the user holds a steering control while moving
- **THEN** the car's heading changes each tick in the corresponding direction, at a rate dependent on current speed

### Requirement: Gamepad input support
The system SHALL accept gamepad input as an alternative to keyboard input for throttle, brake, and steering, producing equivalent per-tick input state.

#### Scenario: Driving with a connected gamepad
- **WHEN** a gamepad is connected and the user operates its throttle, brake, and steering controls
- **THEN** the car responds equivalently to the same actions performed via keyboard

### Requirement: Grip and drift model
The system SHALL model lateral grip such that the car's rear end can lose traction ("drift") under hard steering or throttle/brake inputs at speed, with the car's lateral slip affecting its turning behavior.

#### Scenario: Losing grip under hard steering at speed
- **WHEN** the user steers sharply while at high speed
- **THEN** the car's lateral slip increases and its actual turning path diverges from the steering angle alone, producing a drift

#### Scenario: Maintaining grip at low speed or gentle input
- **WHEN** the user steers gently or at low speed
- **THEN** the car's lateral slip remains minimal and the car turns closely following the steering input

### Requirement: Off-track slowdown
The system SHALL detect when the car's position leaves the generated road surface and apply a speed penalty while the car remains off-track.

#### Scenario: Car leaves the road surface
- **WHEN** the car's position moves outside the generated road surface boundary
- **THEN** a speed-reducing penalty is applied each tick until the car returns to the road surface

#### Scenario: Car remains on the road surface
- **WHEN** the car's position stays within the generated road surface boundary
- **THEN** no off-track speed penalty is applied

### Requirement: Barrier collision response
The system SHALL detect collisions between the car and generated barrier geometry and apply a bounce/slide response that keeps the car from passing through the barrier.

#### Scenario: Car collides with a barrier
- **WHEN** the car's position would cross barrier geometry
- **THEN** the car's velocity and position are adjusted so it does not pass through the barrier, and its speed is reduced according to the collision response
