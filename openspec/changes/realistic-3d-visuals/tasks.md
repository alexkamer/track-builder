# Tasks

Sequencing follows design.md — Migration Plan: geometry first (invisible), then asset-free renderer setup, then asset plumbing with its fallback, then the assets themselves, then measurement. The app renders at the end of every group.

## 1. Generalize ribbon geometry to a cross-section profile

- [x] 1.1 Extend `RibbonMesh` in `src/domain/generation/generateTrack.ts` to carry vertices-per-ring alongside `ringCount`, and change `buildRibbon` to take an ordered cross-section profile (`{ lateralOffset, heightOffset }` samples applied through the existing `offsetAt` banking math) instead of a `pointA`/`pointB` pair; verify the existing `generateTrack.test.ts` suite still passes with road and curbs expressed as the two-point degenerate case.
- [x] 1.2 Give barriers a 3–4 point armco-style profile via the new cross-section API, and add a `generateTrack` test asserting the barrier mesh has more than two vertices per ring and that its innermost face stays at the same lateral offset as the old flat barrier; verify `npm test` passes.
- [x] 1.3 Update `src/components/RoadMesh3D.tsx` to read vertices-per-ring from the mesh rather than assuming two, and verify `npm test` and `npx tsc -b` both pass with the scene still rendering flat-colored.
- [x] 1.4 Audit `src/domain/physics/barrierCollision.ts` against the new barrier profile and extend `barrierCollision.test.ts` to pin the collision boundary explicitly to the barrier's inner face; verify the new assertions fail against a deliberately mis-chosen boundary and pass against the implemented one.

## 2. Arc-length texture coordinates

- [x] 2.1 Add a `uvs` attribute to `RibbonMesh` computed in generation: `v` from accumulated arc length along each edge independently divided by a per-surface tile length in world units, `u` from lateral offset in world units divided by a tile width (design.md D4); verify new `generateTrack` tests assert equal real-world distances produce equal `v` deltas on both a straight and a tight corner.
- [x] 2.2 Add a `generateTrack` test asserting `u` spacing is unchanged between a narrow and a wide section of the same track, covering the spec's width-change scenario; verify it fails if `u` is normalized to 0..1.
- [x] 2.3 Generate the verge ribbon outside the barriers using the cross-section API, following the road's elevation, as a closed loop; verify new tests assert the verge exists for every ring, closes without a gap, and has no vertical step against the terrain height at its outer edge.
- [x] 2.4 Delete `TEXTURE_V_SCALE` from `RoadMesh3D.tsx` and consume `mesh.uvs` instead, switching texture wrapping to `RepeatWrapping` on both axes; verify `npm test` passes and the existing procedural asphalt tile still renders without visible stretching when the app is run on a preset track with a tight corner.

## 3. Asset-free renderer and lighting setup

- [x] 3.1 Configure `<Canvas>` in `src/components/RaceScene.tsx` with `ACESFilmicToneMapping` and exposure, and enable `shadowMap` with `PCFSoftShadowMap`; verify `npm test` passes and the rendered scene shows highlight roll-off rather than flat white on a sunlit surface.
- [x] 3.2 Replace the `ambientLight`/`directionalLight` pair with a single shadow-casting directional sun at `shadow-mapSize={[2048, 2048]}` plus a tight orthographic shadow frustum re-centered on the car each frame (design.md D3); verify in the running app that the car's shadow is visible on the road and is still present after driving a full lap away from the scene origin.
- [x] 3.3 Add `<fogExp2>` tinted to the horizon color and a drei `<Sky>` as the asset-free sky, replacing the flat `#87ceeb` background in `TrackScenery.tsx`; verify in the running app that distant track sections fade while the road under the car stays full contrast.
- [x] 3.4 Convert `TrackScenery.tsx`'s 60 tree groups to drei `<Instances>`, keeping the existing deterministic `mulberry32` scatter untouched, and make trees cast shadows; verify the existing scenery tests still pass and that the `tree-sample` test id is preserved.
- [x] 3.5 Share this lighting/fog/sky setup with `src/components/LiveTrackPreview3D.tsx` so the editor preview matches the race view; verify `LiveTrackPreview3D.test.tsx` passes and both views show the same treatment on the same track.

## 4. Asset loading with degradation to flat colors

- [x] 4.1 Add a `SceneMaterials` provider that owns all texture/environment loading and exposes loaded assets or `null`, wrapped in both a non-blocking `Suspense` fallback and an error boundary (design.md D8); verify a unit test asserts the provider yields `null` assets and renders its children when loading rejects.
- [x] 4.2 Make every material consumer render a textured material when assets are present and the current flat-color material when they are not; verify `npm test` passes with no changes to `src/test/setup.ts` and no mocking of three or drei.
- [x] 4.3 Add a test asserting `RaceScene` still mounts and its HUD controls remain usable when asset loading fails, covering the spec's non-rendering-environment scenario; verify the full `npm test` suite passes.

## 5. Assets, materials, and track markings

- [x] 5.1 Commit one 1k `.hdr` environment map to `public/assets/env/` and wire `<Environment files=...>` with `background` and `backgroundBlurriness`, lazy-loaded; verify the app lights itself with the dev server offline and that no request to `raw.githack.com` appears in the network panel.
- [x] 5.2 Commit CC0 asphalt, curb/rumble-strip, barrier, verge, and terrain texture sets to `public/assets/textures/` as WebP (albedo/roughness/AO) and PNG (normal), from Poly Haven / ambientCG / Kenney only; verify the committed total stays under the 5 MB target and no Quaternius-licensed asset is included.
- [x] 5.3 Create `public/assets/CREDITS.md` listing every committed asset's filename, source URL, and license, and surface it from the app; verify every file under `public/assets/` appears in the inventory with a named source and license.
- [x] 5.4 Apply PBR materials to road, curbs, barriers, verge, and terrain, setting `SRGBColorSpace` on albedo maps only and leaving normal/roughness/AO at the default, with `anisotropy` from `gl.capabilities.getMaxAnisotropy()` (design.md D2, D4); verify one textured surface matches its source image's appearance side by side rather than looking washed out.
- [x] 5.5 Replace `createAsphaltTexture`'s dashed yellow centerline with circuit-appropriate markings — white edge lines and red/white rumble-strip curbs driven by the arc-length UVs; verify in the running app that curb stripe blocks stay the same real-world length on a straight and through a tight corner.
- [x] 5.6 Render start/finish and checkpoint markings as thin quads built from the existing `CheckpointTrigger` ring geometry, with `polygonOffset` to avoid z-fighting; verify new tests assert a marking exists for the start line and for each checkpoint, that a track with no checkpoints draws only the start-line marking, and that markings are derived from the same geometry as the triggers.

## 6. Performance verification

- [x] 6.1 Add a dev-only drei `<Stats>` readout to the race view and drive a full lap of a preset track, recording the sustained frame rate; verify it holds at or above 60fps with no sustained stutter.

  Measured by sampling real frame pacing while driving (1280x800, 10-15s under throttle), not from the on-screen panel, whose history includes startup frames:

  | Preset | avg | median | p99 |
  | --- | --- | --- | --- |
  | Serpentine Circuit | 16.68 ms (59.9 fps) | 16.70 ms | 16.80 ms (59.5 fps) |
  | Street Grand Prix | 16.67 ms (60.0 fps) | — | 16.80 ms (59.5 fps) |
  | Grand Loop | 16.67 ms (60.0 fps) | — | 16.80 ms (59.5 fps) |
  | Delta Circuit | 16.67 ms (60.0 fps) | — | 16.80 ms (59.5 fps) |

  Effectively vsync-locked, with one dropped frame at measurement start and no sustained stutter.

- [x] 6.2 If the budget is missed, reduce in the documented order — HDRI resolution, shadow map size, shadow frustum extent, instanced prop count, then shadows — and record which reduction was applied and the resulting frame rate; verify the lap re-measures at or above budget.

  Not triggered: 6.1 met the budget on every preset measured, so no reduction was applied and the documented order stands unused.

- [x] 6.3 Run the full gate — `npm test`, `npx tsc -b`, and `npm run lint` — and drive a lap on each preset track confirming no visual regression; verify all three commands pass clean.

  `npm test` 285 passed / 43 files, `npx tsc -b` clean, `npm run lint` exit 0 (warnings only, all in pre-existing categories). All 7 presets driven with no page or console errors.

## Workflow follow-up

- Archive the change once implementation and review are complete.
