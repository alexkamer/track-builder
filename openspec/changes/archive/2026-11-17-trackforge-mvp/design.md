# Design

## Context

Greenfield project (no existing code or specs). See proposal.md - Why/What Changes for motivation and scope. Three load-bearing technical decisions shape everything downstream: the track data schema, the physics approach, and how replay/leaderboard determinism is achieved. This document focuses on those plus the overall module boundaries.

## Goals / Non-Goals

**Goals:**
- Define a track JSON schema that is versioned, round-trips losslessly, and is independent of any rendering/physics library so it can be validated and migrated over time.
- Define a physics approach that is deterministic under a fixed timestep, so a recorded input sequence always reproduces the same lap time and path (ghost replay, leaderboard integrity).
- Define module boundaries (editor, generation, physics, session, sharing) that keep the track schema as the single contract between them.
- Define enough of the backend/storage shape to unblock track CRUD, sharing links, and leaderboard submission in the task breakdown.

**Non-Goals:**
- Full vehicle simulation fidelity (tire models, suspension) — arcade physics only, per proposal.
- Anti-cheat beyond basic sanity/replay-consistency checks — no cryptographic proof of play.
- Multi-car or multiplayer synchronization of any kind.
- Picking a specific hosting provider for the backend beyond "Supabase or small Node service" — left to implementation, not a spec-level concern.

## Decisions

### 1. Track data schema

Represent a track as a versioned JSON document, independent of Three.js types:

```ts
interface TrackDocument {
  schemaVersion: 1;
  id: string;            // stable id, assigned on first save
  name: string;
  createdAt: string;     // ISO 8601
  controlPoints: ControlPoint[]; // ordered, closed loop (last implicitly connects to first)
  startLine: { controlPointIndex: number; headingDeg: number };
  checkpoints: { controlPointIndex: number }[]; // ordered, subset of control point indices, excluding start
  metadata: { author?: string; description?: string };
}

interface ControlPoint {
  x: number; z: number;     // top-down plane position, world units
  elevation: number;        // y, world units
  width: number;             // track width at this point, world units
  bankingDeg: number;        // road roll at this point
}
```

Decision: control points carry per-point width/elevation/banking rather than separate parallel arrays, so edits (insert/delete/drag a point) can't desync point count across arrays. The spline itself (Catmull-Rom, closed) is derived at generation/render time from `controlPoints`, never stored — storing only control points (not the sampled curve) keeps the document small and is what "round-trips with no loss" means: re-deriving the curve from the same control points is itself deterministic, so nothing is lost.

Checkpoints and the start line reference control points by index rather than owning independent coordinates, so moving a control point moves its checkpoint with it and the document can't drift into an inconsistent state.

`schemaVersion` is a literal number, bumped on any breaking field change; load code switches on it to migrate old documents. Alternative considered: a semver string — rejected as unnecessary complexity for a document that will only ever need linear migrations.

### 2. Physics approach: custom arcade physics over a physics engine

Decision: hand-written arcade car physics (slip-angle-based lateral grip model, simple longitudinal accel/brake curve, off-track friction penalty), not Rapier or another full physics engine.

Rationale:
- The desired feel is explicitly "arcade" (per proposal), not rigid-body simulation — a general physics engine solves a harder problem than needed and makes the feel harder to tune.
- A custom integrator is easier to guarantee bit-for-bit determinism for, because its entire state transition function is owned code (position, velocity, yaw, slip) with no engine-internal solver iteration counts or broad-phase ordering to pin down.
- Collision needs are simple (stay-on-road test against the generated road mesh/corridor, and barrier collision as a basic bounce/slide) — this doesn't require general rigid-body collision resolution.

Alternative considered: Rapier (WASM, deterministic-leaning). Rejected for MVP because general physics engines are not guaranteed bit-reproducible across platforms/builds without pinning exact versions and solver settings, which adds risk to the replay/leaderboard determinism goal for no gameplay benefit at this scope. This can be revisited post-MVP if richer collision is needed.

### 3. Determinism for ghost replay and leaderboard times

Decision: a fixed timestep simulation loop (e.g., 60Hz) decoupled from render framerate. Each tick consumes a discrete input state (throttle, brake, steer, as sampled at tick boundaries) and advances car state via the arcade physics step function, which is a pure function of `(previousState, input, dt)` with no wall-clock or RNG dependence.

This makes a lap fully reproducible from: `(trackDocument, schemaVersion-matched physics step function, ordered list of per-tick inputs)`. Ghost replay stores that input list (not positions) and re-runs the same step function to reproduce the path exactly — far smaller than storing a pose per frame, and self-verifying (replay only "looks right" if determinism actually holds).

For leaderboard submission, the server re-simulates the submitted input log against the stored track document and checks the resulting lap time and checkpoint sequence match what the client reported (replay verification), rejecting mismatches — this is the "basic sanity check" from the proposal, not a full anti-cheat system.

Render-time interpolation between fixed ticks is allowed for visual smoothness but must never feed back into simulation state, or determinism breaks.

Alternative considered: record full pose-per-frame for ghosts and trust client-reported lap times for leaderboards. Rejected — pose recording doesn't verify anything server-side (trivial to fabricate a lap time), and is less compact than an input log.

### 4. Module boundaries

- `track-editor`: owns authoring/validation of `TrackDocument`. Emits a validated `TrackDocument` or a list of validation errors; never reaches into rendering or physics code.
- `track-generation`: pure function `TrackDocument -> GeneratedTrack` (road mesh, curb/barrier geometry, spawn transform, checkpoint trigger volumes, scenery placement). Deterministic and has no dependency on physics or session state.
- `driving-physics`: the fixed-timestep car simulation, taking `GeneratedTrack` (for the road corridor it drives on) and per-tick input, producing car state. No knowledge of UI, cameras, or lap/session concerns.
- `race-session`: orchestrates the fixed-timestep loop, checkpoint/lap-completion logic against `GeneratedTrack`'s checkpoint volumes, best-lap tracking, ghost input-log storage/playback, and camera modes. Depends on `driving-physics` and `track-generation` outputs but not vice versa.
- `sharing-and-leaderboards`: persistence of `TrackDocument`s, URL-based retrieval, anonymous session identity, lap time + input-log submission and server-side replay verification, per-track leaderboard reads.

This keeps `TrackDocument` as the one contract crossing the editor/backend boundary, and `GeneratedTrack` as the one contract crossing the generation/physics/session boundary — each capability's spec can be validated independently against these contracts.

## Risks / Trade-offs

- [Risk] Custom arcade physics takes more tuning time to "feel right" than reusing an engine → Mitigation: keep the step function isolated and parameterized (grip coefficients, drag, etc.) so tuning is a matter of adjusting constants, not restructuring code; build the vertical slice early (per proposal success criteria) to get feel feedback fast.
- [Risk] Floating-point non-determinism across browsers/CPUs (JS floating point is generally consistent per IEEE 754, but transcendental function implementations (sin/cos/sqrt) can vary across JS engines) → Mitigation: keep the step function's math minimal and well-understood; if cross-browser ghost/leaderboard mismatches appear, consider fixed-point or a vetted deterministic math subset for the hot path. Documented as a known risk, not solved upfront, since same-browser determinism (the MVP's actual requirement for a user's own ghost) is unaffected. **Observed during implementation**: a browser-driven (Playwright/Chromium) lap, replayed server-side (Node) against the identical track and input log, was occasionally rejected even though the client reported it as completed - consistent with this exact risk (Chromium's V8 and Node's V8 can differ slightly in `sin`/`cos` across versions, and a boundary-crossing check is sensitive to that after enough ticks). Same-engine automated tests (`server/index.test.ts`, which generate and replay the input log entirely within Node) pass reliably and are the correct way to test the verification *logic*; the cross-engine gap itself remains unresolved and would need the fixed-point/deterministic-math mitigation above before this is production-ready for real users on arbitrary browsers.
- [Risk] Server-side replay verification requires running the same physics step function on the server (Node) as the client (browser) → Mitigation: write the physics step function as plain TypeScript with no DOM/Three.js dependency so it runs unmodified in both environments; this is already required by the module boundary decision above.
- [Risk] Schema evolution after MVP ships could break saved tracks → Mitigation: `schemaVersion` field plus a migration function per version bump, decided now so it's not retrofitted later.

## Migration Plan

Not applicable — greenfield project, no existing data or deployed system to migrate.
