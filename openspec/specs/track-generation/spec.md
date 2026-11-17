# Track Generation Specification

## Purpose

Converts a validated 2D track layout into a complete 3D scene — road surface, curbs, barriers, and scenery — ready for rendering and for the driving physics to run against.

## Requirements

### Requirement: Deterministic generation from a validated track
The system SHALL generate the same 3D scene (road mesh, curbs, barriers, scenery placement) every time it is given the same validated track definition, with no randomness that varies between runs.

#### Scenario: Repeated generation from identical input
- **WHEN** the same validated track definition is generated twice
- **THEN** the resulting road mesh, curb/barrier geometry, and scenery placements are identical both times

#### Scenario: Generation only accepts validated tracks
- **WHEN** generation is requested for a track that has not passed all track validation checks
- **THEN** the system rejects the generation request and does not produce a 3D scene

### Requirement: Road surface mesh from the spline
The system SHALL generate a continuous road surface mesh that follows the track's control-point curve, matching the per-point width, elevation, and banking values, forming a closed loop with no gaps.

#### Scenario: Road surface follows width changes
- **WHEN** the track has differing width values at different control points
- **THEN** the generated road mesh's width tapers smoothly between those control points to match

#### Scenario: Road surface follows elevation changes
- **WHEN** the track has differing elevation values at different control points
- **THEN** the generated road mesh's height changes smoothly between those control points to match

#### Scenario: Road surface follows banking changes
- **WHEN** the track has a banking angle set at a control point
- **THEN** the generated road mesh is rolled by that banking angle at the corresponding location

#### Scenario: Road forms a closed loop
- **WHEN** the road mesh is generated from a validated (closed-loop) track
- **THEN** the mesh has no gap or seam where the loop closes

### Requirement: Curbs and barriers along the track edges
The system SHALL generate curb geometry along both edges of the road surface and barrier geometry outside the curbs along the full length of the track.

#### Scenario: Curbs present along both edges
- **WHEN** a track's 3D scene is generated
- **THEN** curb geometry is present along the inner and outer edges of the road for the full length of the track

#### Scenario: Barriers present outside curbs
- **WHEN** a track's 3D scene is generated
- **THEN** barrier geometry is present outside the curbs for the full length of the track

### Requirement: Basic scenery generation
The system SHALL generate ground, sky, and tree scenery surrounding the generated track so the 3D environment is not limited to the road itself.

#### Scenario: Scenery present in generated scene
- **WHEN** a track's 3D scene is generated
- **THEN** the scene includes a ground plane, a sky, and tree scenery placed around the track

### Requirement: Spawn, checkpoint, and start-line geometry
The system SHALL derive a car spawn transform (position and heading) from the track's start line, and derive trigger geometry for the start/finish line and each checkpoint, positioned on the generated road surface.

#### Scenario: Spawn transform derived from start line
- **WHEN** a track's 3D scene is generated
- **THEN** a spawn position and heading are produced that place a car on the road surface at the start/finish line, facing the start line's designated heading

#### Scenario: Checkpoint trigger geometry generated
- **WHEN** a track's 3D scene is generated
- **THEN** trigger geometry is produced for the start/finish line and for each checkpoint, spanning the road surface at that control point in the order defined by the track

### Requirement: Preset tracks available
The system SHALL provide at least three built-in preset track definitions that pass all validation and can be generated and raced without the user creating a track first.

#### Scenario: Loading a preset track
- **WHEN** the user selects a preset track
- **THEN** a valid track definition is loaded and can be generated into a 3D scene without further editing
