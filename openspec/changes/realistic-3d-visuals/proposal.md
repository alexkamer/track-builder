# Proposal

## Why

The 3D race view is still a programmer-art placeholder: a single `ambientLight` at 1.2 plus one `directionalLight`, a flat `#87ceeb` background color standing in for sky, a 64x256 procedurally-drawn canvas asphalt tile, flat-colored curbs and barriers (`#d62828` / `#f1faee` / `#495057`), a `#4a7c3a` ground plane, and 60 cone-on-cylinder trees. Nothing casts a shadow (`castShadow` is set on the car body but no light or renderer enables shadows), there is no tone mapping or fog, and the track's start/finish line and checkpoints have no surface markings at all. The physics, lap timing, and track generation are in good shape, so presentation is now the weakest part of the experience — and a racing game is judged on how the track looks the moment the player starts driving.

## What Changes

- **Lighting and renderer setup become physically plausible.** Replace the flat ambient-plus-directional pair with a sun light that casts shadows, an image-based environment/sky for ambient fill, filmic tone mapping, and correct color-space handling, so surfaces have direction, contrast, and a believable sky.
- **Real PBR surface materials replace flat colors.** The road, curbs, barriers, and ground get textured materials (albedo plus roughness/normal where it pays off) sourced from permissively-licensed assets rather than solid colors and a hand-drawn canvas tile.
- **Road surface markings become track markings.** The dashed yellow centerline baked into the asphalt tile is replaced with markings appropriate to a circuit: white edge lines, red/white rumble-strip curbs, and visible start/finish line and checkpoint markings on the road surface, which today are invisible even though the triggers exist.
- **Track-side geometry reads as a racing circuit.** Barriers gain a recognizable form (tyre wall / armco-style profile rather than a flat grey ribbon), and a runoff/verge strip separates asphalt from the surrounding terrain instead of asphalt meeting grass at a hard edge.
- **Scenery gains depth cues.** Distance fog/aerial perspective, a less uniform ground treatment, and instanced vegetation replace the 60 individually-drawn primitive trees.
- **Visual assets are sourced and vendored deliberately.** The change establishes where downloadable assets come from, what licenses are acceptable, where they live in the repo or are fetched from, and a size budget — so adding art does not quietly add megabytes or a runtime dependency on a third-party CDN.
- **A frame-rate budget is stated and respected.** Added realism must hold a smooth chase-camera frame rate on a mid-range laptop, with the expensive effects either tuned down or left out rather than shipped at a cost the simulator cannot pay.

Non-goals that keep this bounded: no changes to physics, lap/checkpoint rules, validation, the car's handling model, persistence, or the API. The car model itself stays a primitive build (a replacement car asset is a separate story). The 2D editor canvas and the editor's small 3D preview are not redesigned, though they inherit whatever the shared scene setup provides. No `data-testid` is renamed or removed, and the existing jsdom-based component tests must keep passing — asset loading must not make the scene un-renderable in a test environment.

## Capabilities

### New Capabilities

- `scene-rendering`: How the generated track is presented visually — the lighting and renderer configuration, the surface materials and textures applied to generated geometry, the sky/environment and atmospheric depth cues, where visual assets come from and under what license, graceful behavior when an asset is unavailable, and the performance budget the rendered scene must stay inside. This is a durable boundary distinct from `track-generation`, which owns what geometry exists; `scene-rendering` owns how that geometry looks.

### Modified Capabilities

- `track-generation`: Two requirement-level additions and one extension. (1) The existing "Curbs and barriers along the track edges" requirement extends to require curbs carry an alternating rumble-strip pattern and barriers have a non-flat profile. (2) A new requirement for a runoff/verge strip generated outside the barriers, so the asphalt-to-terrain transition is generated geometry rather than a hard mesh edge. (3) A new requirement that generated surface geometry carries texture coordinates that keep a tiled texture at a consistent real-world scale along the track, including through corners and width changes, so materials do not stretch or smear — today the road's UVs advance by a fixed per-ring constant regardless of how far apart the rings actually are.
- `race-session`: One requirement-level addition — the start/finish line and each checkpoint must be visibly marked on the road surface during a race, so the player can see where a lap begins and where the gates they must pass through are. The trigger geometry already exists in generation; nothing currently draws it.

## Impact

- **Code:** `src/components/RaceScene.tsx` (lighting, environment, fog, renderer config), `src/components/RoadMesh3D.tsx` (materials, textures, replaces `createAsphaltTexture`), `src/components/TrackScenery.tsx` (sky/environment, ground, instanced vegetation), `src/components/LiveTrackPreview3D.tsx` (inherits shared scene setup), `src/domain/generation/generateTrack.ts` (verge ribbon, arc-length UVs, curb/barrier profile data), and new components for surface markings and barrier geometry.
- **Assets:** a new committed or fetched asset directory under `public/` for textures and an environment map, with a stated size budget; licenses recorded in-repo.
- **Dependencies:** possibly `@react-three/postprocessing` if post-processing earns its cost; otherwise no new runtime dependencies — `three` r187 and `@react-three/drei` v10 already provide the environment, shadow, and tone-mapping pieces.
- **Tests:** existing `RaceScene`, `LiveTrackPreview3D`, and `generateTrack` tests must keep passing under jsdom; generation changes need new unit coverage for the verge mesh and UV scaling.
- **Not affected:** `server/`, the track schema and serialization format, physics and race-rule modules.
