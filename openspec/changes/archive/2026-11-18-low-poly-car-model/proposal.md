# Proposal

## Why

The `realistic-3d-visuals` change lit, textured, and re-profiled everything around the car but
deliberately left the car itself as two boxes and four 14-sided cylinders, and it flagged the
consequence: with the track now the best-looking thing in frame, the primitive car is the
weakest. The player stares at it for an entire lap from the chase camera.

The obstacle is not modelling, it is licensing. The local `LowPoly_Cars/` pack looks right and
rigs cleanly, but it is a CGTrader royalty-free download: usable inside an end product, not
redistributable as a file. Serving it from `public/` is redistribution, which the
`scene-rendering` requirement "Licensed, inventoried visual assets" forbids. So this change
takes the path that gets the better car on screen now without putting an unlicensed byte in the
repository: the real geometry is a **local developer-only** car source, generated on demand from
the pack by an in-repo script, and the committed default stays the primitive car.

## What Changes

- **Pluggable car geometry source.** `CarModel` gains two interchangeable sources behind one
  unchanged `CarModelHandle`: `primitive` (today's build, the committed default) and `lowpoly`
  (real geometry read from a gitignored local folder). Selected by a dev-only flag; when the
  flag is off, or the flag is on but the local files are absent or fail to load, the primitive
  car renders instead. The shipped build and every test keep the primitive path, so no
  asynchronous load enters the default render path.
- **An in-repo, offline extraction script** that turns the multi-car pack into one compact car
  per run. It supersedes the throwaway `.scratch/obj_clusters.py` by fixing three gaps: it
  preserves texture and normal indices instead of dropping them, it emits the four wheels'
  source disc alongside the chosen body, and it splits the body's faces by **palette-atlas
  tile** into semantically named groups (paint, glass, trim, light), which is what makes
  material assignment in code possible.
- **Materials assigned in code, not baked.** Because the pack encodes every surface colour as a
  position in a 5x4 ramp atlas rather than as distinct materials, the per-tile split lets the
  renderer keep driving the car's appearance from props: the existing `color` prop still paints
  the body (player yellow, ghost blue) and the existing `opacity` prop still produces a
  translucent ghost, while glass, tyres, trim, and lights get their own materials instead of
  inheriting the body colour.
- **Wheel radius becomes a property of the active car** rather than a module constant. The
  pack's wheel discs are ~0.44 radius against the primitive's 0.35, and `CarRig`/`GhostRig`
  divide speed by that radius to compute rolling spin, so a hardcoded value would make the
  wheels visibly spin at the wrong rate. `WHEEL_RADIUS` stays exported for the primitive path.
- **A dev-time car picker.** The flag accepts which car in the pack to load, so cars can be
  compared in the running app without re-running the extractor or editing code.
- **Developer documentation** covering how to produce the local files, and restating why they
  must never be committed.

## Capabilities

### New Capabilities

- `car-presentation`: how the player's and ghost cars are visually represented — the contract a
  rig needs to pose a car (root, steering pivots, spinnable wheels at a known radius), how a
  car's paint and glass respond to per-car colour and ghost transparency, and the requirement
  that the shipped car never depends on a non-redistributable asset and always renders even when
  an optional local car source is missing or broken.

### Modified Capabilities

None. The requirement that shipped assets be licensed and inventoried already exists in the
`scene-rendering` delta from `realistic-3d-visuals`; this change honours it rather than
amending it, by shipping no new asset at all.

## Impact

- **Code:** `src/components/CarModel.tsx` (source selection, material groups, per-source wheel
  radius), `src/components/CarRig.tsx` and `src/components/GhostRig.tsx` (read the radius from
  the model handle), plus a new dev-only loader module and a new extraction script.
- **Tests:** existing `CarModel`, `CarRig`, `GhostRig`, and `RaceScene` tests must pass
  unchanged; no `data-testid` is renamed. New tests cover source selection, the fallback, and
  the material-group mapping.
- **Not affected:** physics, handling, lap and checkpoint rules, validation, persistence, the
  API, and the track geometry. No change to `public/assets/` or `CREDITS.md`, since nothing new
  ships.
- **Repository hygiene:** the generated car files live in a gitignored local directory; the
  `.gitignore` entry is part of this change.
- **Sequencing:** `realistic-3d-visuals` is implemented but not yet archived, so the
  `scene-rendering` requirements this change relies on currently live in that change's delta
  rather than in `openspec/specs/`.
