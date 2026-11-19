# Design

## Context

See proposal.md — Why. The constraints that actually shape the approach:

- **Installed versions are current and capable.** `three@0.187.0`, `@react-three/fiber@9.8.2`, `@react-three/drei@10.7.9`. Verified present in the installed drei build: `Environment`, `Sky`, `SoftShadows`, `ContactShadows`, `AccumulativeShadows`, `Lightformer`, `Instances`, `Merged`, `Detailed`, `Decal`, `Grid`, `useTexture`, `useEnvironment`, `useKTX2`, `useGLTF`, `AdaptiveDpr`, `PerformanceMonitor`, `Stats`. Three r187 exports `ACESFilmicToneMapping`, `AgXToneMapping`, `NeutralToneMapping`, `PCFSoftShadowMap`, `VSMShadowMap`, and ships `RGBELoader`, `EXRLoader`, `KTX2Loader`. Nothing we need requires a dependency bump.
- **All geometry is one shape.** `RibbonMesh` is `{ positions: Vec3[], indices: number[], ringCount }` with exactly **two vertices per ring** — left edge, right edge. Road, both curbs, and both barriers are all built by `buildRibbon` from a `pointA`/`pointB` pair of offset functions over `RingFrame[]`. A barrier is therefore currently a flat two-vertex-wide ribbon standing on edge. Any non-flat profile needs this shape generalized.
- **UVs are index-based today.** `RibbonMesh3D` sets `v = ringIndex * 0.12` regardless of how far apart rings actually are. Rings come from `SAMPLES_PER_SEGMENT = 16` samples per spline segment, so ring spacing varies with segment length and curvature — the texture compresses in corners and on short segments. This is the root cause of the "texture scale" requirement and must be fixed in generation, not in the renderer.
- **Banking already produces correct cross-sections.** `offsetAt` rolls each offset point around the centerline by `bankingRad`, so a banked road already has geometrically correct vertices; what it lacks is correct normals for image-based lighting to respond to (`computeVertexNormals` is called, so this mostly works — it needs verifying, not rebuilding).
- **Tests run in jsdom with no WebGL.** `src/test/setup.ts` only adds a `ResizeObserver` polyfill. `RaceScene.test.tsx` renders the whole component and asserts on HUD DOM, so whatever we add inside `<Canvas>` must not break a mount that has no GL context — and must not suspend forever on an asset fetch that jsdom will never satisfy.
- **drei's `Environment preset` is not shippable.** The installed `core/useEnvironment.js` hard-codes `CUBEMAP_ROOT = 'https://raw.githack.com/pmndrs/drei-assets/<sha>/hdri/'`. Using `preset` means a runtime dependency on a third-party CDN and a scene that cannot light itself offline. drei's own docs say the presets are not for production.

## Goals / Non-Goals

**Goals:**

- A race view that reads as a racing circuit at a glance, driven by lighting and materials rather than by more geometry.
- Fix texture coordinates at the source (`generateTrack`) so every surface gets a consistent real-world texture scale, instead of each renderer guessing a fudge factor.
- Generalize `RibbonMesh` once, so curbs, barriers, and the verge are all expressible without a second geometry path.
- Every shipped asset self-hosted, CC0, inventoried, and lazy-loaded; no runtime CDN dependency.
- Keep the scene renderable with zero assets, so tests and offline dev keep working.

**Non-Goals:**

- No `EffectComposer` / post-processing in this change (see Decisions).
- No KTX2/Basis texture compression pipeline.
- No replacement car asset, no new physics, no editor-UI redesign.
- No per-blade grass, reflections, SSAO, or dynamic time of day.

## Decisions

### D1: Self-host one 1k `.hdr` environment map; never use drei's `preset`

Use `<Environment files="/assets/env/<name>.hdr" background backgroundBlurriness={0.02} />` with the file committed under `public/assets/env/`, lazy-loaded so it does not block first paint.

- **Why:** `preset` fetches from `raw.githack.com` at runtime (verified in the installed package), which breaks offline dev and makes our lighting depend on someone else's host. Self-hosting is one file and removes the whole class of problem.
- **Resolution and format:** 1k `.hdr` ≈ 1.2 MB. The same Poly Haven map as 2k is ≈ 4.6 MB and as 1k `.exr` is ≈ 5 MB — EXR is roughly 4x larger than HDR at equal resolution. Since the background is shown slightly blurred and the sharp detail in frame is the road, 1k HDR is the right point on the curve.
- **Alternatives considered:** (a) `@pmndrs/assets` npm package — CC0, ~150 KB, no CDN risk, but 512px, which is fine for light and too soft for a visible sky; a good fallback if the 1k file proves too heavy. (b) drei `<Sky>` procedural sky — cheap and asset-free, but it does not light the scene, so we would still need an IBL source and the sky and the lighting could disagree. We keep `<Sky>` only as the no-asset fallback. (c) Ground-projected environment (`Environment ground={...}`) — defer; our own terrain mesh already occupies the lower hemisphere.

### D2: Tone mapping on the renderer, and no post-processing in this change

Set `gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: ~1.0 }}` on `<Canvas>` and leave color management at three's r152+ defaults.

- **Why ACES:** it is the filmic curve the rest of the ecosystem is tuned against, and r187 defaults to `NeutralToneMapping`-style flatness that looks washed out next to it.
- **Why no `EffectComposer`:** since r155, renderer-level tone mapping only applies when rendering to screen, so introducing a composer forces tone mapping to move into the composer as well — a coupled change that risks the exact "washed out" regression we are trying to fix. Bloom/SSAO are also the most expensive items on the budget and buy the least in a bright outdoor scene. Adding `@react-three/postprocessing` (v3.2.2 is compatible with React 19 / three r187) stays available as a later, separate change.
- **Color-space rule we must follow:** set `colorSpace = THREE.SRGBColorSpace` on **albedo/color maps only**; leave normal, roughness, and AO maps at the default `NoColorSpace`. Getting this backwards is the classic washed-out-textures bug and is the single most likely way this change regresses visual quality.

### D3: Shadows from one directional light with a tight, car-following frustum

One `directionalLight` with `castShadow`, `shadow-mapSize={[2048, 2048]}`, and a small orthographic shadow camera box that is re-centered on the car each frame; renderer `shadowMap.type = PCFSoftShadowMap`.

- **Why:** a shadow frustum sized to cover a whole track is the usual cause of both blocky shadows and bad frame times. Tracks here can span hundreds of units, so a fixed frustum is not viable — following the car keeps texel density high at a fixed cost. This is also what makes the spec's "shadow does not detach when the car drives away from the origin" scenario pass.
- **Rejected:** `SoftShadows` (PCSS) — per-fragment multi-tap, scales badly, and we are shadowing a moving car every frame. `AccumulativeShadows` — converges over many frames assuming a static scene; a moving car invalidates it continuously, so it is structurally wrong here, not just expensive. `ContactShadows` under the car only — kept as a cheap optional addition if the directional shadow alone reads poorly at the car's contact patch.

### D4: Arc-length UVs computed in `generateTrack`, carried on `RibbonMesh`

Add a `uvs` attribute to `RibbonMesh` (two UVs per ring, matching `positions`). Compute `v` from **accumulated arc length along each edge independently**, divided by a per-surface tile length in world units; compute `u` from **lateral offset in world units** divided by a tile width, so `u` and `v` share one meters-per-tile scale.

- **Why in generation, not the renderer:** the renderer does not know ring spacing, track width, or the intended real-world tile size; generation already has all three. It also makes the behavior unit-testable without a GL context, which matters given the jsdom constraint.
- **Why per-edge arc length rather than centerline arc length:** in a corner the inner and outer edges have genuinely different lengths. Driving both edges' `v` from the centerline shears the texture; driving each edge from its own length keeps tiles square and instead bows the lateral lines slightly. Real tarmac is laid in longitudinal strips, so the bowed-lateral-lines artifact is the more convincing one.
- **Why `u` from world width, not 0..1:** `u = 0..1` across the ribbon is what stretches the texture when the track widens. Normalizing by world width keeps tile size constant and is what the spec's width-change scenario tests.
- **Consequence:** `TEXTURE_V_SCALE` in `RoadMesh3D` goes away; the renderer just consumes `mesh.uvs`. Textures need `wrapS = wrapT = RepeatWrapping` (the current asphalt tile uses `ClampToEdgeWrapping` on S, which only worked because `u` was 0..1), and `anisotropy = gl.capabilities.getMaxAnisotropy()` — grazing-angle asphalt under a chase camera is the worst case for mip aliasing, so this is not optional polish.

### D5: Generalize `buildRibbon` to an N-point cross-section profile

Replace the `pointA`/`pointB` pair with an ordered list of cross-section samples — each `{ lateralOffset, heightOffset }` relative to the ring frame — and strip-triangulate between consecutive rings across all profile points.

- **Why:** it is the one change that unlocks barrier profiles (3–4 points for an armco-style fold), the verge (a wide low strip), and keeps the road and curbs as the degenerate two-point case. The existing `offsetAt` banking math is reused per profile point, so banking keeps working for free.
- **Rejected:** a separate barrier geometry builder — duplicates the loop-closing and triangulation logic that is already correct and tested. Instanced tyre-stack or armco-post meshes along the spline — better-looking and a reasonable later change, but it needs a model asset and placement logic, and it would still leave the verge unsolved.
- **Migration:** `RibbonMesh` keeps `ringCount` and gains a profile width (vertices per ring). `RibbonMesh3D` reads vertices-per-ring from the mesh instead of assuming 2. `barrierCollision.ts` reads barrier offsets from generation, so it must be checked against the new profile — the collision boundary should stay the barrier's innermost face, not its outermost vertex.

### D6: Rumble strips and road markings via textures on arc-length UVs, not geometry

The curb's red/white alternation, the road's edge lines, and the start/finish grid are texture work on top of D4, not extra geometry.

- **Why:** once `v` is true arc length, a stripe tile repeats at a fixed real-world block length automatically — which is exactly what the spec requires ("block length stays the same on straights and through corners"). Modelling alternating blocks as geometry would double the ring count and still need the same arc-length math.
- **Gate markings** (start/finish and checkpoints) are thin quads built from the existing `CheckpointTrigger` ring geometry, rendered with `polygonOffset` (or a small surface-normal lift) to avoid z-fighting with the road. Building them from the trigger geometry — rather than from independently recomputed positions — is what guarantees the spec's "markings match where the triggers are" scenario rather than merely usually matching.
- **Edge lines** get baked into the asphalt albedo near the `u` extremes where possible, which costs no extra draw call; separate ribbons only if baking proves too inflexible.

### D7: Assets self-hosted in `public/assets/`, CC0 only, with an in-repo inventory

Textures as **WebP for albedo/roughness/AO** and **PNG for normal maps** (WebP chroma handling can band normals), 1k–2k, at `public/assets/textures/<surface>/`. Sources restricted to **Poly Haven**, **ambientCG**, and **Kenney** — all CC0, no attribution required. An `public/assets/CREDITS.md` (or equivalent) records every file's name, source URL, and license.

- **Why CC0-only:** it makes the "licensed, inventoried assets" requirement trivially satisfiable and avoids per-asset attribution plumbing. Specifically **excluded: Quaternius (QAL v1.0)** — despite being free and good, QAL forbids redistributing the raw assets even modified, so committing them to this repo is plausibly a license violation.
- **Why not KTX2/Basis:** r187 supports it via `KTX2Loader`, but it needs `setTranscoderPath()` plus `basis_transcoder.js`/`.wasm` copied into `public/`, `detectSupport(gl)`, and a `toktx`/`basisu` build step. Its real win is GPU memory, not download size, and at a handful of textures that is not a problem we have. Revisit if the texture count grows.
- **Budget:** one 1k HDR plus two or three WebP texture sets lands around 3–5 MB total, which is reasonable to commit for a game. Files live in `public/` so Vite serves them as static URLs rather than hashing them into the JS bundle. Hard ceiling: nothing over ~10 MB committed; past that, fetch at runtime.

### D8: Asset loading degrades to flat colors instead of suspending or throwing

A single `SceneMaterials` provider owns asset loading and exposes either loaded textures or `null`. Consumers render a textured material when textures are present and the current flat-color material when they are not. The provider wraps loading in both a `Suspense` boundary with a non-blocking fallback and an error boundary, so a failed or absent fetch resolves to "no textures" rather than an unhandled rejection or an indefinite suspend.

- **Why:** this is what makes the spec's two degradation scenarios achievable — and it is the mechanism that keeps the existing jsdom tests green without mocking three. drei's `useTexture` throws into Suspense on failure, which in a test environment that never satisfies the fetch would otherwise hang the mount.
- **Alternative rejected:** mocking the loaders in `src/test/setup.ts`. That makes tests pass while leaving real users with a scene that breaks on a failed fetch — it hides the bug instead of fixing it.

### D9: Instanced scenery and fog for depth; no vegetation modelling

Replace the 60 individually-rendered tree groups with drei `<Instances>` (one draw call per tree part), and add `<fogExp2>` tinted to the HDRI's horizon color.

- **Why:** fog is nearly free and is the single effect that most sells distance, which is the spec's atmospheric-depth requirement. Instancing is a perf change that buys the headroom to raise prop counts later. The ground stays a single plane for now; breaking it up is a larger terrain change and the spec only requires the asphalt-to-terrain transition be real geometry, which the verge (D5) provides.
- **Deferred:** drei `Detailed` (LOD) — only worth it once prop counts are large; `Sampler` for scatter placement — the existing deterministic `mulberry32` scatter already satisfies the determinism requirement and should not be replaced.

### D10: Frame budget verified by measurement, with a documented escape hatch

Verify 60fps by driving a preset lap with drei `<Stats>` (dev-only) rather than by reasoning about cost. If the budget is missed, the documented order of reduction is: HDRI resolution → shadow map size → shadow frustum extent → instanced prop count → drop shadows. `<AdaptiveDpr>` is available as a last-resort automatic fallback but is deliberately not enabled by default, since silently dropping resolution hides a cost problem rather than fixing it.

## Risks / Trade-offs

- **Washed-out or over-dark textures from color-space mistakes** → The r152+ rule in D2 is explicit: sRGB on albedo only. Check one textured surface against its source image before applying materials everywhere.
- **Existing jsdom tests break when assets enter the scene** → D8's provider must land before any material consumes a texture, and the full `vitest run` is a gate on that task, not a step at the end.
- **Barrier collision changes meaning when barriers gain a profile** → `barrierCollision.ts` has tests; extend them to pin the collision boundary to the barrier's inner face explicitly, so a profile change cannot silently move the wall the car bounces off.
- **Arc-length UV change is visible everywhere at once** → It alters every surface's appearance simultaneously, so a bug looks like "the whole track is wrong." Land D4 with unit tests on UV values (equal real-world distances get equal `v` deltas) before any texture work, so the geometry is trusted before the art lands.
- **Bowed lateral lines in tight corners** (accepted consequence of per-edge arc length, D4) → Accepted deliberately as the less objectionable artifact; if it reads badly on the tightest legal corner radius, the fallback is centerline-driven `v` with its own shear trade-off.
- **3–5 MB of committed binary assets inflates the repo permanently** → Git history keeps them forever, so pick the final file set before committing rather than iterating on large binaries in-tree; the ~10 MB ceiling in D7 is the stop line.
- **Shadow frustum following the car can pop** as geometry enters and leaves the shadow box → Size the box generously relative to the chase camera's visible range and snap its center to texel increments if flicker appears.
- **Scope creep toward the car model** → The research flagged that the primitive car may now be the weakest-looking thing in frame once the track improves. That is plausibly true and is explicitly deferred to its own change; this design must not quietly absorb it.

## Migration Plan

No data migration — nothing here touches the track schema, serialization format, or persisted data, so there is no forward or backward compatibility concern and no rollback beyond reverting the commits.

Sequencing that keeps the app working at every step:

1. **Geometry first, invisible to the user:** generalize `RibbonMesh` (D5) and add arc-length UVs (D4) while renderers still use flat colors. Verified by unit tests, not by looking at it.
2. **Renderer setup, still asset-free:** tone mapping, directional shadows, fog, `<Sky>` fallback, instanced scenery (D2, D3, D9). The scene improves with zero new bytes, and this is the state the no-asset fallback path must keep working in forever.
3. **Asset plumbing:** the `SceneMaterials` provider and its degradation behavior (D8), with the full test suite as the gate — before any real asset exists.
4. **Assets and materials:** commit the HDRI and textures with their inventory (D1, D7), then apply materials and markings (D6).
5. **Measure and tune** against the budget (D10).

Each stage is independently revertable, and a revert at any point leaves a scene that renders.
