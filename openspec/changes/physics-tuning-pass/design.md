# Design

## Context

See proposal.md - Why for motivation. Relevant current implementation:

- `src/domain/physics/barrierCollision.ts`: `resolveBarrierCollision` detects the car crossing a barrier's inner edge, clamps its lateral offset back inside, redirects heading to the wall tangent (in whichever direction is closest to current heading), and scales speed by a flat `BARRIER_BOUNCE_SPEED_RETENTION = 0.4`, resetting `lateralSlip` to 0. This runs every physics tick the car is beyond the barrier.
- `src/domain/physics/carPhysics.ts`: `DEFAULT_CAR_PARAMS` has `maxSpeed = 40`, `baseTurnRate = 2.2`. Turn rate at a given tick is `steer * baseTurnRate * speedFactor * direction`, where `speedFactor = |speed| / maxSpeed`. Turn radius is `speed / turnRate = maxSpeed / (steer * baseTurnRate)` at full lock (`steer = ±1`) — independent of current speed, so there is a single well-defined "tightest achievable radius" for the whole speed range: `maxSpeed / baseTurnRate ≈ 18.18` units with current defaults.
- `src/domain/track/validation.ts`: `MIN_CORNER_RADIUS = 5`, used by `validateCornerRadius`, which samples the closed Catmull-Rom curve and checks circumradius at every sampled point.
- The physics step function and collision resolver are pure, deterministic, and called from the fixed-timestep loop; this change does not touch that loop or the function signatures' shape (`(state, input, dt, params, isOffTrack) -> state` for the car step, `(state, track) -> state` for barrier collision).

## Goals / Non-Goals

**Goals:**
- Make a shallow-angle barrier graze resolve within a small, bounded number of ticks instead of decaying into a prolonged low-speed crawl, verified by actually driving a track in the browser.
- Make `MIN_CORNER_RADIUS` a value derived from car physics constants (not an independent magic number), with enough margin that a track passing validation is drivable through its tightest corner without constant barrier clipping, also verified by driving.
- Keep both changes as constant/formula tuning within existing functions — no new modules, no change to function signatures, no change to the fixed-timestep architecture.

**Non-Goals:**
- Full restitution physics (no momentum/impulse model beyond scalar speed retention) — still arcade-level, consistent with design.md's original decision to avoid a general physics engine.
- Changing how barriers are generated or represented (`track.barrierLeft`/`barrierRight` positions stay as-is).
- Changing the self-intersection or start-line validations.
- Re-tuning unrelated car physics constants (acceleration, drag, grip) beyond what's needed to compute the corner radius margin.

## Decisions

### 1. Angle-dependent bounce retention and away-from-wall redirect

Replace the flat `BARRIER_BOUNCE_SPEED_RETENTION = 0.4` with retention computed from the impact angle between the car's heading and the wall tangent: `retention = lerp(RETENTION_GRAZE, RETENTION_HEAD_ON, impactSharpness)`, where `impactSharpness` is derived from `1 - |alignment|` (alignment is already computed in the existing tangent-selection logic as the dot product between forward heading and tangent direction — reuse it rather than recomputing). A near-tangent hit (`alignment` close to ±1, i.e. nearly parallel to the wall) keeps most speed; a near-perpendicular hit (`alignment` close to 0) loses most of it.

For the redirect heading, instead of snapping exactly to the wall tangent, bias the new heading a small fixed angle off the tangent, toward the track interior (the side of the wall the centerline is on). This gives the car a heading component pointing away from the barrier, so the next tick's lateral motion carries it off the wall instead of along it, breaking the repeated-contact cycle that causes the crawl.

Add `MIN_ESCAPE_SPEED`: after computing the angle-dependent retained speed, clamp it to at least this floor (same sign as the pre-collision forward direction) so a sequence of grazing hits — each individually small — cannot compound toward zero. This is a floor, not an addition of energy on every hit: a car that was already stopped or reversing into a wall is not force-accelerated forward, only a car with meaningful incoming speed is given a bottom.

Alternative considered: keep flat retention but increase it (e.g., 0.4 → 0.7). Rejected — this would also make head-on hits bounce more than feels right (over-bouncy direct impacts), since a single scalar can't simultaneously fix grazing crawl and keep head-on collisions feeling like a hard stop. Angle-dependence addresses both cases independently.

Alternative considered: detect "stuck" state via a tick counter / position-delta history and force an escape after N ticks. Rejected as more complex and harder to tune/verify than fixing the underlying per-hit response; also not a pure function of the current tick's `(state, track)` alone (would need history), which cuts against keeping the resolver simple and stateless-per-call like the rest of the physics code.

### 2. Derive `MIN_CORNER_RADIUS` from car physics constants

Compute the car's tightest achievable turn radius as `DEFAULT_CAR_PARAMS.maxSpeed / DEFAULT_CAR_PARAMS.baseTurnRate` (≈18.18 with current defaults) and export this (or the formula) from `carPhysics.ts` so `validation.ts` imports it rather than duplicating the arithmetic. Apply a safety margin multiplier (e.g., `1.3`–`1.5`, final value to be settled during implementation by driving test tracks at exactly the threshold) on top of the achievable radius to get `MIN_CORNER_RADIUS`, because:
- A human player rarely drives at the exact theoretical steering limit through every corner (some margin is lost to imperfect lines, braking late, correcting drift).
- The barrier-collision fix in Decision 1 reduces the *severity* of clipping but doesn't eliminate the geometric fact that a corner right at the theoretical limit requires a perfect line with zero margin for error.

Alternative considered: set `MIN_CORNER_RADIUS` to exactly the achievable radius with no margin. Rejected — leaves zero room for driving imprecision, which the user's acceptance bar ("drivable without constantly clipping barriers") rules out; this was confirmed by the arithmetic showing the current value (5) is roughly 3.6x *tighter* than even the zero-margin achievable radius, so some margin above the achievable radius is clearly necessary, not just theoretically nice-to-have.

Alternative considered: make the margin itself a tuned constant independent of car params (e.g., always `achievable + 10`). Rejected in favor of a multiplier — a multiplier scales proportionally if `maxSpeed`/`baseTurnRate` are retuned later, whereas a flat additive buffer would become a smaller or larger fraction of the achievable radius as the base value changes, silently drifting out of calibration.

## Risks / Trade-offs

- [Risk] Tuning constants (retention curve endpoints, redirect bias angle, minimum escape speed, corner radius margin multiplier) can't be derived purely analytically — they need playtesting to feel right. → Mitigation: per the user's instruction, verify by actually driving a track in the browser (using the `run` skill) covering shallow-angle grazes, near-head-on hits, and a track with a corner right at the new minimum radius, not just unit tests. Unit tests still cover the deterministic math (angle-to-retention mapping, escape-speed floor, radius formula) but feel is judged by driving.
- [Risk] A larger `MIN_CORNER_RADIUS` could make some previously-valid tracks (built with the old limit of 5) fail validation on reload. → Mitigation: this is an intentional, expected consequence of calibrating the validation to the actual car physics — no migration is needed since `TrackDocument`s are not re-validated retroactively except when the user attempts to race or re-save; existing documents remain loadable and editable regardless of validation status, consistent with validation being a race-mode gate, not a storage-time gate (see track-editor spec: "Invalid tracks cannot be raced" only blocks race-mode entry).
- [Risk] Biasing the redirect heading off the exact tangent could, in rare geometries (very tight barrier curvature relative to the bias angle), redirect the car into the *opposite* barrier on a narrow track. → Mitigation: keep the bias angle small (a few degrees) relative to typical track width/barrier spacing, and verify on at least one narrow test track during manual driving.

## Open Questions

None — the two tuning behaviors (angle-dependent bounce response, radius-margin multiplier) are deliberately left as "exact numeric value settled during implementation by driving," per Decisions 1 and 2, but the approach and spec-level behavior are fully decided here.
