# Spec Delta

## Purpose

Defines how a generated track is presented visually: the lighting and renderer configuration, the surface materials applied to generated geometry, the sky and atmospheric depth cues, where visual assets come from and under what license, and the performance budget the rendered scene must hold.

## ADDED Requirements

### Requirement: Directional sunlight with cast shadows
The system SHALL light the scene with a directional light representing the sun, and that light SHALL cast shadows from the car and from track-side geometry onto the road and terrain.

#### Scenario: Car casts a shadow on the road
- **WHEN** the race view is rendered with the car on the road surface
- **THEN** a shadow of the car is visible on the road surface, offset from the car in the direction away from the sun

#### Scenario: Track-side geometry casts shadows
- **WHEN** the race view is rendered
- **THEN** barriers and vegetation cast shadows onto the terrain and road rather than appearing to float without contact

#### Scenario: Shadows remain present as the car drives
- **WHEN** the car moves to any point along the track
- **THEN** its shadow is still rendered, without the shadow disappearing or detaching when the car travels away from the scene origin

### Requirement: Image-based sky and ambient environment
The system SHALL render a sky that fills the background behind the track and SHALL derive the scene's ambient and reflected light from that same environment, replacing a single flat background color and a uniform ambient light.

#### Scenario: Sky visible behind the track
- **WHEN** the chase camera looks toward the horizon
- **THEN** a sky with visible gradient or detail is rendered behind the terrain rather than a single uniform fill color

#### Scenario: Surfaces pick up environment light
- **WHEN** the scene is rendered
- **THEN** surfaces facing the sky are lit more brightly than surfaces facing away from it, so shaded sides are distinguishable from lit sides

### Requirement: Tone-mapped, correctly color-managed output
The system SHALL apply filmic tone mapping and correct color-space handling to the rendered output, so bright areas roll off instead of clipping to flat white and texture colors are not displayed washed out or over-saturated.

#### Scenario: Highlights do not clip
- **WHEN** a surface receives direct sunlight
- **THEN** that surface retains visible shading detail instead of rendering as a uniform white region

#### Scenario: Texture colors render as authored
- **WHEN** a color texture is applied to a surface
- **THEN** the rendered color matches the authored texture's appearance rather than appearing noticeably lighter or darker than the source image

### Requirement: Physically-based surface materials on generated geometry
The system SHALL render the road surface, curbs, barriers, verge, and terrain with physically-based materials whose color and roughness vary across the surface, rather than a single flat color per surface.

#### Scenario: Road surface has visible surface detail
- **WHEN** the car is driving and the chase camera views the road ahead
- **THEN** the road shows asphalt surface variation rather than a uniform flat fill

#### Scenario: Materials differ by surface type
- **WHEN** the scene is rendered
- **THEN** asphalt, curb, barrier, verge, and terrain surfaces are visually distinguishable from each other by material appearance, not only by color

#### Scenario: Texture scale is consistent along the track
- **WHEN** the road's texture is viewed at different points along the track, including through corners and where the track width changes
- **THEN** the texture's apparent real-world scale is the same at each point, with no visible stretching, compression, or smearing

### Requirement: Atmospheric depth cues
The system SHALL fade distant scenery toward the sky color with increasing distance from the camera, so the far end of the track and distant scenery recede rather than reading at the same contrast as nearby geometry.

#### Scenario: Distant scenery recedes
- **WHEN** the camera views a long straight or distant section of the track
- **THEN** geometry far from the camera is lower in contrast and closer to the sky color than nearby geometry

#### Scenario: Near geometry is unaffected
- **WHEN** the car and the road immediately around it are rendered
- **THEN** they are rendered at full contrast, without the atmospheric fade washing out the surface the player is driving on

### Requirement: Licensed, inventoried visual assets
Every downloaded visual asset the system ships SHALL be covered by a license permitting redistribution in this project, and the repository SHALL record each asset's source and license.

#### Scenario: Asset inventory present
- **WHEN** a visual asset (texture, environment map, or model) is added to the project
- **THEN** an in-repo record names that asset, the site it came from, and its license

#### Scenario: Attribution-required assets are attributed
- **WHEN** a shipped asset's license requires attribution
- **THEN** the required attribution is present in the repository and reachable from the application

#### Scenario: No asset of unknown provenance
- **WHEN** the asset inventory is reviewed
- **THEN** no shipped visual asset is listed without a named source and license

### Requirement: Scene renders without its assets
The system SHALL render a usable, drivable scene when visual assets cannot be loaded — including in environments with no WebGL or no network — falling back to solid-color materials and a plain sky rather than failing to render, blocking indefinitely, or throwing.

#### Scenario: Asset fetch fails at runtime
- **WHEN** a texture or environment map cannot be fetched
- **THEN** the track still renders with fallback materials and the race remains drivable, and the failure does not surface as an unhandled error

#### Scenario: Scene mounts in a non-rendering environment
- **WHEN** the race view is mounted in an environment that cannot create a WebGL context
- **THEN** the surrounding interface still mounts and its controls remain usable, without an asset load hanging or failing the mount

### Requirement: Rendered scene holds its frame-rate budget
The system SHALL sustain at least 60 frames per second while driving with the chase camera on a generated track on mid-range integrated-graphics hardware at a typical window size, and SHALL NOT ship a visual effect that breaks that budget.

#### Scenario: Driving a preset track
- **WHEN** the user drives a full lap of a preset track with the chase camera active
- **THEN** the frame rate stays at or above the budget for the lap, without sustained stutter

#### Scenario: An effect cannot meet the budget
- **WHEN** a candidate visual effect cannot be configured to stay inside the budget
- **THEN** that effect is reduced in quality or omitted rather than shipped at a frame rate below the budget

### Requirement: Shared look across 3D views
The system SHALL present the editor's live 3D preview with the same lighting, material, and sky treatment as the race view, so the preview previews what the player will drive.

#### Scenario: Preview matches the race view
- **WHEN** the same track is viewed in the editor's 3D preview and in the race view
- **THEN** the road, curbs, barriers, and terrain use the same materials and the same sky and lighting treatment in both

#### Scenario: Preview stays responsive
- **WHEN** the editor's 3D preview is rendered alongside the 2D editing canvas
- **THEN** editing the track remains responsive, with the preview's visual treatment reduced in cost if needed rather than slowing editing
