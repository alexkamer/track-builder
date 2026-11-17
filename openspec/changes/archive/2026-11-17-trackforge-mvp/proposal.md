# Proposal

## Why

There is no way for someone to design a race track and drive it in 3D without leaving the browser — existing tools either focus on track editing (CAD-style) or racing (fixed tracks), not both. Trackforge closes that loop: draw a track, validate it, generate a 3D world from it, and race it immediately, then share it with a link. Building this now establishes the core data model (track schema) and determinism guarantees (fixed-timestep physics) that every later feature (multiplayer, more car types, marketplace) will depend on, so getting the foundation right early avoids costly rework.

## What Changes

- New 2D spline-based track editor: place/drag control points, adjust width per-segment, add elevation and banking, place start/finish line and checkpoints, undo/redo, snap-to-grid, zoom/pan.
- New track validation: closed-loop check, self-intersection check, minimum corner radius check, valid start-line check, with user-facing error messages. Invalid tracks cannot be raced.
- New procedural 3D track generation: converts the validated 2D spline + width/elevation/banking data into a road mesh with curbs, barriers, and basic scenery (ground, sky, trees).
- New arcade driving physics: keyboard-controlled car (acceleration, steering, drift/grip, off-track slowdown) running on a deterministic fixed timestep so the same input sequence always produces the same outcome.
- New race session flow: lap timing, checkpoint-gated lap validation, best-lap tracking, and ghost replay of the user's own best lap, with chase-cam and top-down camera modes.
- New save/load: tracks persist as versioned JSON matching the track data schema, round-tripping without loss.
- New sharing and leaderboards: each saved track gets a unique shareable URL; anyone with the link can load and race it; each track has a public leaderboard of best lap times, with basic server-side sanity validation of submitted times to deter cheating.
- New anonymous session model: no accounts; a local anonymous session ID with an optional display name is used for leaderboard attribution.
- Ships with 3-4 preset tracks as built-in examples.

## Capabilities

### New Capabilities
- `track-editor`: 2D spline-based track design (control points, width, elevation, banking, start/finish, checkpoints, undo/redo, snap-to-grid, zoom/pan) and validation (closed loop, no self-intersection, minimum corner radius, valid start line) before a track can be raced.
- `track-generation`: Deterministic conversion of a validated track definition into a 3D scene (road mesh, curbs, barriers, scenery) ready for rendering and physics.
- `driving-physics`: Deterministic, fixed-timestep arcade car simulation (acceleration, steering, grip/drift, off-track slowdown) driven by keyboard (and gamepad) input.
- `race-session`: Lap timing, checkpoint validation, best-lap tracking, ghost replay, and camera modes (chase, top-down) for a single-player race on a generated track.
- `sharing-and-leaderboards`: Persisting tracks as versioned JSON, generating shareable URLs, anonymous-session lap time submission with server-side sanity validation, and per-track public leaderboards.

### Modified Capabilities
(none — this is a new project with no existing specs)

## Impact

- **New codebase**: TypeScript/React/Vite frontend; react-three-fiber/Three.js for 3D rendering; a minimal backend (Supabase or small Node service) for track storage, lap time submission, and leaderboards.
- **New data model**: versioned track JSON schema (control points, width, elevation, banking, checkpoints, metadata), decoupled from rendering/physics code — see design.md.
- **New dependencies**: react-three-fiber, three, a spline/curve library, a physics library decision (custom arcade vs. Rapier) — see design.md for the tradeoff.
- **Performance target**: 60fps on a mid-range laptop; bundle size kept small enough for quick load.
- **No breaking changes**: greenfield project, nothing existing to break.
