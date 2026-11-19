# Spec Delta

## MODIFIED Requirements

### Requirement: Curbs and barriers along the track edges
The system SHALL generate curb geometry along both edges of the road surface and barrier geometry outside the curbs along the full length of the track. Curbs SHALL carry an alternating two-tone rumble-strip pattern along their length, and barriers SHALL have a repeating three-dimensional profile rather than a flat vertical ribbon.

#### Scenario: Curbs present along both edges
- **WHEN** a track's 3D scene is generated
- **THEN** curb geometry is present along the inner and outer edges of the road for the full length of the track

#### Scenario: Barriers present outside curbs
- **WHEN** a track's 3D scene is generated
- **THEN** barrier geometry is present outside the curbs for the full length of the track

#### Scenario: Curbs read as rumble strips
- **WHEN** a generated track's curbs are viewed from the car
- **THEN** the curb alternates between two colors in regular blocks along its length, at a block length that stays the same in real-world terms on straights and through corners

#### Scenario: Barriers have a repeating profile
- **WHEN** a generated track's barriers are viewed from the car
- **THEN** the barrier shows repeating three-dimensional form along its length rather than reading as a single flat surface

## ADDED Requirements

### Requirement: Runoff verge outside the barriers
The system SHALL generate a verge strip of a fixed width running the full length of the track outside the barriers, bridging the barrier line to the surrounding terrain, so asphalt and track-side geometry do not meet the terrain at a bare mesh edge.

#### Scenario: Verge present along the full track
- **WHEN** a track's 3D scene is generated
- **THEN** verge geometry is present outside the barriers for the full length of the track, forming a closed loop with no gap

#### Scenario: Verge meets the terrain without a visible step
- **WHEN** the verge is viewed where it meets the surrounding terrain
- **THEN** there is no visible gap or vertical step between the verge's outer edge and the terrain beneath it

#### Scenario: Verge follows elevation and banking
- **WHEN** the track has elevation or banking changes
- **THEN** the verge follows those changes alongside the road rather than staying at a single flat height

### Requirement: Arc-length texture coordinates on generated surfaces
The system SHALL assign texture coordinates to every generated surface so that a tiled texture repeats at a constant real-world scale along and across the surface, based on actual distance traveled rather than on a per-step constant.

#### Scenario: Equal-length sections get equal texture repeats
- **WHEN** two sections of the same generated surface span the same real-world distance
- **THEN** a tiled texture repeats the same number of times across each of them

#### Scenario: Corners do not compress the texture
- **WHEN** the track includes tight corners where successive cross-sections are closer together than on a straight
- **THEN** the texture scale through those corners matches the texture scale on the straights

#### Scenario: Width changes do not stretch the texture
- **WHEN** the track's width differs between control points
- **THEN** the texture scale across the road's width is the same on the narrow and wide sections, rather than stretching to fit whatever width is present
