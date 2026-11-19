# Developer-only car models

TrackForge ships a car built from primitives in code (`src/components/CarModel.tsx`). This
document covers the *optional* higher-detail car you can run locally, extracted from a low-poly
car pack on your own machine.

> **Nothing here is shippable.** The source packs (`LowPoly_Cars/`, `Ferrari_Concept/`) are
> CGTrader royalty-free downloads. That licence permits using a model inside an end product but
> **not redistributing the asset file**. Serving `car.obj` from a web app is redistribution, so
> these models can never be committed, and never placed in `public/` (Vite copies that directory
> verbatim into `dist/`). The same reasoning excludes Quaternius; see
> `public/assets/CREDITS.md` for what the project does ship, which is CC0 only.
>
> The repository default is, and stays, the primitive car.

## Setup

Both steps are one-time. From the project root:

```sh
# 1. Unpack the pack's archives. bsdtar ships with macOS and reads .rar.
mkdir -p .scratch/rar-out
bsdtar -xf LowPoly_Cars/previews.rar -C .scratch/rar-out   # optional: reference renders
bsdtar -xf LowPoly_Cars/textures.rar -C .scratch/rar-out   # optional: the colour atlas

# 2. See what vehicles the pack contains.
python3 -I scripts/extract_car.py list LowPoly_Cars/LowPoly_Cars_01_obj.obj
```

`list` prints one line per vehicle cluster, largest first — part count, face count, and
dimensions. Clusters 14–23 are the sedans and muscle cars, which suit a racing game best;
0–3 and 10–11 are trucks and buses; 30–40 are loose wheel discs that are not whole vehicles.

Extract one car into the gitignored `dev-cars/` directory:

```sh
python3 -I scripts/extract_car.py extract LowPoly_Cars/LowPoly_Cars_01_obj.obj 20 dev-cars
```

That writes `dev-cars/car20.obj` and `dev-cars/car20.json`. Then run the app and ask for it:

```sh
npm run dev
# then open http://localhost:5173/?car=lowpoly
```

| URL | Car |
| --- | --- |
| no parameter, or `?car=primitive` | the primitive car (the default, and the only one in a build) |
| `?car=lowpoly` | `dev-cars/car20.obj`, the default extracted car |
| `?car=lowpoly:car04` | `dev-cars/car04.obj` — any id you have extracted |

Switching cars is a reload, not a rebuild. In a production build the parameter is ignored
entirely: the branch that reads it is statically eliminated, so neither the loader nor three.js's
`OBJLoader` appears in the bundle.

If the files are missing or fail to load, **the primitive car renders instead** and the reason is
logged as a warning. The race is never left without a car.

## What the extractor does, and why

The pack is one flat list of ~212 meshes with non-semantic names (`Object546_Mesh.168`), all
sharing a single material. Cars therefore have to be found and taken apart geometrically:

1. **Find a car** — cluster the `o` groups by bounding-box adjacency. One cluster per vehicle.
2. **Separate the wheels** — a car's wheels are merged into its body mesh, but share no vertices
   with it, so union-find over vertex indices recovers them exactly. Exactly four thin,
   ground-resting, mirrored disc components are required; anything else fails loudly with the
   component table printed, rather than emitting a malformed car.
3. **Group the body by colour** — the pack's texture is a 5×4 grid of shading ramps, and a face's
   colour is simply which tile its UVs land in (UVs run far outside 0–1, so the tile comes from
   the fractional part). Two cars that differ only in paint are the *same* geometry with shifted
   UVs. Grouping faces by tile separates bodywork from glass, trim, and lights.

The result is an OBJ with one named group per tile plus a `wheel` group, and a JSON manifest
holding the measurements the renderer needs: wheel radius, the four axle positions, body
dimensions, and a proposed role for each group.

Output is deterministic — the same inputs produce byte-identical files.

## Fixing the material roles

The app assigns real materials by role, which is what lets the car keep taking its colour from a
prop (player yellow, translucent blue ghost) instead of a baked texture. Roles are `paint`,
`glass`, `trim`, `light`, and `tyre`.

The extractor *proposes* the mapping from each group's shape and atlas tile:

- atlas row 0 is the grey/white ramp and rows 1–3 are colour ramps, so a substantial group on a
  colour row is the paint — cars that are genuinely grey or white fall back to their largest
  group;
- a thin slab at one end of the car is a light cluster (rear lights sit on the red row, which is
  why the tile alone cannot identify paint);
- glass is the highest-sitting substantial group.

This is a proposal, not a guarantee. If a car comes out wrong — grey bodywork, or a window
rendered as paint — edit `roles` in that car's `dev-cars/<id>.json` and reload. No code change
and no re-extraction is needed. Picking paint by face count alone does not work: on a typical car
the single largest group is the dark lower cladding that wraps the whole footprint.

Note that the pack often merges the roof panel into the same tile as the windows, which is why
the `glass` material is dark and glossy but **opaque** — a see-through material shows the road
through the car's roof from above.

## Tooling notes

- `bsdtar` reads the packs' `.rar` archives. `blender`, `obj2gltf` and `gltfpack` are *not*
  installed, which is why the pipeline is a Python script plus three.js's stock `OBJLoader`
  rather than a glTF conversion.
- `dev-cars/` is served in development by a small `apply: 'serve'` plugin in `vite.config.ts`,
  not from `public/`, so a build cannot carry these files even by accident.
- An absent car does not 404 — the dev server's SPA fallback answers with `index.html` — so the
  loader checks the response content type and reports "run scripts/extract_car.py" rather than a
  JSON parse error.
