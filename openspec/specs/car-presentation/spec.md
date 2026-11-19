# Car Presentation Specification

## Purpose

Defines how the player's car and the ghost car appear in the 3D views: what a rig needs in
order to pose a car, how a car's colour and transparency are driven per car, and how the system
keeps rendering a car when an optional higher-detail car source is unavailable or not licensed
to ship.

## Requirements

### Requirement: Poseable car presentation contract
The system SHALL present each car as a unit that exposes everything a rig needs to pose it: a
single root to place and orient, independent steering pivots for the front wheels, the wheels
themselves as separately spinnable parts, and the wheel radius in world units. Any car source
SHALL satisfy this same contract.

#### Scenario: Rig poses a car's position and orientation
- **WHEN** a rig sets a car's position, heading, and banking roll for a frame
- **THEN** the whole car moves and rotates together, resting on the road surface rather than
  sinking into it or floating above it

#### Scenario: Steering and wheel spin are independent
- **WHEN** the car is steering while moving
- **THEN** the front wheels turn to the steering angle and all four wheels spin about their own
  axles, with neither rotation cancelling or distorting the other

#### Scenario: Spin rate matches the car's own wheels
- **WHEN** a car whose wheels differ in size from another source's is driven at a given speed
- **THEN** its wheels spin at the rate implied by their own radius, so the wheels appear to roll
  on the road rather than visibly spinning too fast or too slow

### Requirement: Per-car paint colour and ghost transparency
The system SHALL render each car in a colour supplied per car, and SHALL render the ghost car
translucent, regardless of which car source is in use. Parts that are not bodywork — glass,
tyres, trim, and lights — SHALL NOT take the body colour.

#### Scenario: Player and ghost are distinguishable
- **WHEN** the player's car and a replaying ghost car are on track together
- **THEN** they render in their distinct colours and the ghost is translucent enough to see the
  track through it, while the live car is opaque

#### Scenario: Non-bodywork parts keep their own appearance
- **WHEN** a car renders in any body colour
- **THEN** its glass, tyres, trim, and lights remain visually distinct from the bodywork instead
  of being flooded with the body colour

### Requirement: Shipped car depends on no non-redistributable asset
The car the system renders by default SHALL be constructed from geometry contained in the
repository, and SHALL NOT require any asset whose licence forbids redistribution. Higher-detail
car sources that cannot be redistributed SHALL be available only as an opt-in local development
option, and their files SHALL NOT be committed to the repository.

#### Scenario: Default build renders a car with no added asset
- **WHEN** the application is built and run from a clean checkout, with no optional car files
  present
- **THEN** a car renders in both the race view and the editor's 3D preview

#### Scenario: Non-redistributable car files stay out of the repository
- **WHEN** the optional local car source has been generated on a developer's machine
- **THEN** the repository ignores those files, and the shipped asset inventory gains no entry,
  because nothing new is distributed

### Requirement: Car renders when an optional car source is unavailable
The system SHALL fall back to the in-repository car whenever an opt-in car source is not
selected, its files are missing, or loading them fails, and SHALL NOT leave the scene carless,
block the race indefinitely, or surface an unhandled error.

#### Scenario: Opt-in source selected but files absent
- **WHEN** the optional car source is enabled and its files cannot be found
- **THEN** the in-repository car renders instead and the race remains drivable, with the reason
  reported to the developer rather than as an unhandled error

#### Scenario: Optional source fails midway through loading
- **WHEN** the optional car's files are found but cannot be parsed or are missing an expected
  part
- **THEN** the in-repository car renders instead, rather than a partially-built or invisible car

#### Scenario: Non-rendering environment
- **WHEN** a view containing a car is mounted in an environment that cannot render 3D content
- **THEN** the view still mounts and its controls remain usable, with no car load left hanging

### Requirement: Developer can choose between car sources without rebuilding
The system SHALL let a developer select which car source and which car within that source is
rendered, without editing source code, and the selection SHALL be inert in a production build.

#### Scenario: Switching cars during development
- **WHEN** a developer selects a different car from the optional source
- **THEN** that car renders on the next load of the view, without code changes or regenerating
  the car files

#### Scenario: Production build ignores the selection
- **WHEN** the application is built for production
- **THEN** the in-repository car renders regardless of any such selection
