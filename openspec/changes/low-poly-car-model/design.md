# Design

## Context

See proposal.md — Why. What shapes this design is the shape of the source data, so the findings
below were established by inspecting the pack before committing to an approach. They correct two
assumptions that would otherwise have produced a broken rig.

The source is `LowPoly_Cars/LowPoly_Cars_01_obj.obj` — 129,576 verts, 212 `o` groups, one flat
list with non-semantic names (`Object546_Mesh.168`), gitignored and non-redistributable. The
`.rar` siblings open with `bsdtar`, which is how the texture atlas and preview renders were read;
no `blender`, `obj2gltf`, or `gltfpack` is installed, so every transform has to be something a
Python script and three.js can do between them.

Four properties of the data drive everything:

1. **Spatial clustering finds cars.** Union-find over `o`-group bounding boxes within 0.35 units
   yields 41 clusters: ~20 cars, some trucks/buses, and 11 standalone wheel discs. This is the
   only way in, since names carry no meaning.
2. **A car's wheels are merged into its body mesh, but remain separate connected components.**
   The earlier reading — that bodies ship wheel-less — is wrong: the merged mesh reaches `y=0`
   outboard at both axles. However, union-find over *shared vertex indices* within one car
   decomposes it into ~100-109 components, of which exactly four are identical
   `0.31 × 0.87 × 0.88` discs with `ybase = 0.00`, at mirrored x and two z values. Wheels are
   therefore recoverable per wheel, and the rig's steer/spin requirement is satisfiable from the
   car's own wheels — no need to graft on a disc from elsewhere in the pack.
3. **Colour is a UV address, not a material.** All 212 meshes share one material whose texture is
   a 5×4 grid of shading ramps plus a grey/white row. UVs range from −621 to 1408, so the tile is
   the fractional part. `Object546` and `Object547` are byte-identical geometry whose UVs sit in
   different tiles — the pack's colour variants *are* UV offsets. Grouping a car's faces by tile
   yields a handful of groups (e.g. 4504 paint / 3284 lower-body and glass / 666 / 104 / 28),
   which is the hook for assigning real materials.
4. **Normals are present** (`vn`), so flat low-poly shading survives the trip without recomputing.

Measurements of a representative car: body 1.95 × 1.41 × 4.89 with `ybase` 0.62; wheel radius
**0.44**; axle half-track **0.95**; wheelbase **3.34**. The primitive car is 1.8 × 3.6 with wheel
radius 0.35 and half-track 0.95 — so the track width matches exactly and only length and wheel
radius really change.

## Goals / Non-Goals

**Goals:**

- One `CarModelHandle` contract served by two sources, chosen at runtime, with the primitive one
  as the committed default and the only one in production or tests.
- An offline extractor that is deterministic and re-runnable, and whose output is small enough to
  load instantly in dev.
- Material roles assigned in code so `color` and `opacity` keep working (see
  specs/car-presentation/spec.md).
- Failure of the optional path is always a fallback, never a broken frame.

**Non-Goals:**

- Shipping any car asset, or adding an entry to `public/assets/CREDITS.md` — nothing new is
  distributed, which is the whole point of the dev-only gate.
- A general glTF asset pipeline, LODs, decimation, or baked lightmaps.
- Car selection as a player-facing feature (liveries, car choice). The picker is a dev tool.
- Touching handling, mass, or collision — the car's physical footprint in the simulation is
  unchanged even though its drawn length grows.

## Decisions

### D1. Split by connected component, then by atlas tile — not by `o` group

The extractor's pipeline is: cluster `o` groups spatially to isolate one car → union-find vertex
connectivity across that car's faces → classify components → group the remaining faces by
fractional-UV tile.

Classification uses geometry, not names: a component is a wheel when its base sits at the car's
minimum y, its three dimensions are within tolerance of a thin disc (two near-equal ~0.88, one
~0.31), and it has a mirror twin across the car's x centreline. Requiring exactly four matches
makes a mis-detection loud rather than silent — the extractor fails instead of emitting a
three-wheeled car.

- **Alternative — name or material based splitting:** impossible, names are non-semantic and all
  212 meshes share one material.
- **Alternative — pick a multi-part cluster (24–29) whose panels are already separate:** those
  clusters merge all four wheels into a single mesh, which is worse for the rig than the
  connectivity split, and their panel/glass separation is something the tile grouping gives us
  anyway.
- **Alternative — delete the wheel faces and instance a standalone disc from clusters 30–40:**
  needs the same wheel detection to know what to delete, then adds a matching problem (the
  pack's loose discs are not the ones this car wears). Strictly more work for a worse result.

### D2. Emit OBJ with one `usemtl` per tile group, plus a JSON manifest

The extractor writes two files per car: an OBJ carrying `v`/`vt`/`vn` re-indexed from 1, the body
as groups each preceded by `usemtl tile_<row>_<col>`, and the wheel as a single group recentred on
its own axle; and a JSON manifest with the wheel radius, the four axle positions, the body
dimensions, the source cluster index, and the tile→role mapping.

Keeping OBJ as the runtime format means three.js's stock `OBJLoader` parses it — it already
splits by `usemtl` into one mesh per material and preserves the material name, which is exactly
the lookup key the component needs. The manifest exists because axle positions and wheel radius
are *measurements*, and measuring them again in the browser would duplicate the extractor's
tolerance logic in a second language.

- **Alternative — write a `.glb` by hand:** glTF with an embedded buffer is writable from Python,
  but it buys only file size we do not need in a dev-only path, and costs a hand-rolled binary
  writer that can go subtly wrong.
- **Alternative — a custom JSON geometry format with our own parser:** more code than reusing
  `OBJLoader`, for no gain.

### D3. Tile→role mapping lives in the manifest, with a documented heuristic default

Roles are `paint`, `glass`, `trim`, `light`, and `tyre`. The extractor proposes a mapping from
the tile histogram — largest group → `paint`, grey-row tiles → `trim`/`glass`, the white tile →
`light`, and the four wheel components → `tyre` regardless of their tile — and records it in the
manifest, where it can be corrected by hand per car.

This is deliberately a data file rather than inferred logic: which tile is glass versus trim is a
judgement about a particular car, it differs between cars, and it is settled in seconds by eye
with the dev picker. Hard-coding a global rule would be wrong for some car in the pack and
invisible until someone noticed grey windows.

`paint` takes the `color` prop. `glass` is dark and transparent, `tyre` near-black and rough,
`trim` a grey metal, `light` pale with slight emissive. The `opacity` prop multiplies through
every role so the ghost stays a coherent translucent car.

### D4. Selection by query parameter, gated on `import.meta.env.DEV`

The car source is read once from `?car=` — `?car=lowpoly` for the default extracted car,
`?car=lowpoly:<id>` to pick one — and ignored entirely unless `import.meta.env.DEV`.

Files live in a gitignored `dev-cars/` at the project root, served at `/dev-cars/` by a
`apply: 'serve'` Vite middleware. **Not** `public/dev-cars/`, which was the original plan and is
wrong: Vite copies `public/` verbatim into `dist/`, so a build carried the non-redistributable
geometry into its own output — exactly what the "shipped car depends on no non-redistributable
asset" requirement forbids. Serving from outside the published tree makes that structurally
impossible rather than relying on anyone remembering. (Discovered by auditing a real build; the
JS side was already being eliminated correctly.)

One consequence worth knowing: an absent car does not 404, because the dev server's SPA fallback
answers `/dev-cars/missing.json` with `index.html`. The loader therefore checks the response
content type, so the most likely mistake — forgetting to run the extractor — reports as "no car
manifest, run scripts/extract_car.py" rather than a JSON parse error.

A query parameter beats an env var here because the spec requires switching cars without a
rebuild, and `VITE_` vars are inlined at build time; it beats a UI control because the picker must
not exist in the shipped interface. Gating on `import.meta.env.DEV` means the branch is
statically false in production and the dynamic `import()` of `OBJLoader` plus the loader module
drop out of the bundle entirely.

### D5. The loader is dynamically imported and the default path stays synchronous

`CarModel` renders the primitive car synchronously, exactly as today. The low-poly path is a
separate module, dynamically imported, that loads the OBJ, builds the group, and hands back a
handle; until it resolves — and forever, if it rejects — the primitive car is what renders. No
Suspense boundary and no async work is introduced into the default path, so the jsdom tests see
unchanged synchronous behaviour and `RaceScene` cannot be made to hang by a missing file.

Failure is swallowed into a `console.warn` and the primitive fallback: a dev-only convenience
must never be able to break the race.

### D6. `wheelRadius` moves onto the handle; `WHEEL_RADIUS` stays as the primitive's value

`CarRig` and `GhostRig` compute rolling spin as `speed / WHEEL_RADIUS`. Reading a module constant
while drawing 0.44-radius wheels would spin them ~26% too fast — the classic wheels-skating
artefact. The handle therefore carries `wheelRadius`, the rigs read it from the handle, and the
exported `WHEEL_RADIUS` constant remains as the primitive source's own radius.

### D7. Native scale, no rescaling to the old footprint

The extracted car keeps its native ~4.89 m length rather than being scaled to the primitive's
3.6 m. Preset tracks are 12–14 m wide, where a 1.95 m × 4.89 m car is correctly proportioned and
the 3.6 m box was undersized. The simulation does not model a body footprint, so nothing in
physics or collision depends on the drawn length; what does need checking by eye is chase-camera
framing and clearance on a banked corner.

## Risks / Trade-offs

- **Wheel detection misfires on an unusual car (hub-cap component, merged wheel pair)** → the
  extractor requires exactly four mirrored disc components and fails loudly with the component
  table printed, so the failure is a message rather than a malformed car. Other cars in the pack
  remain available via the picker.
- **A longer, wider car clips the road on a banked corner, or crowds the chase camera** → both are
  verified by eye on a banked preset and a tight preset as explicit tasks. Note that the rig's
  `-bankingAt(...)` roll sign is already correct and must not be "fixed" while investigating a
  clipping symptom.
- **Tile→role mapping is wrong for a given car, producing grey paint or opaque windows** → it is
  per-car data in the manifest, correctable without code changes, and checked visually as part of
  adding a car.
- **The optional path rots, because CI and tests only ever exercise the primitive one** → the
  source-selection and fallback logic is unit-tested with a stub loader, so the branch that
  chooses and the branch that recovers are covered even though the real asset is never present in
  CI. The geometry itself can only be verified by eye, and that is accepted.
- **Dev-only work produces no shippable improvement** → accepted deliberately and with eyes open:
  the licence forbids shipping, and the alternative (a CC0 or procedural car) is a separate
  decision the user declined for now. The committed car is unchanged, so the repository is no
  worse off, and the extractor retains its value if a redistributable pack is adopted later.
- **~5.3k-triangle body plus a 1.2k wheel instanced four times** is well inside the frame budget
  that the primitive car's 60 fps measurements leave, so the performance requirement is not
  expected to bind; it is still re-checked once on a preset lap.

## Migration Plan

No migration: nothing persisted, served, or user-visible changes. The default build renders the
same primitive car before and after. Rollback is removing the `?car=` parameter.

A developer opts in by extracting the archives with `bsdtar`, running the extractor to populate
`dev-cars/`, and loading the app with `?car=lowpoly`. The `.gitignore` entry lands in the same
change as the extractor so the generated files can never be staged by accident.
