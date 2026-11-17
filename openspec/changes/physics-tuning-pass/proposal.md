# Proposal

## Why

Driving a track exposes two related tuning gaps left over from the MVP: a car that clips a barrier at a shallow angle can get stuck crawling at very low speed for an extended time instead of cleanly deflecting or escaping, and the minimum corner radius validation (5 units) is tighter than the car can actually turn at any speed (~18 units at full steering lock), so tracks that pass validation are not reliably drivable without constant barrier contact. Both stem from constants that were never tuned/calibrated against each other or against actual driving feel.

## What Changes

- Retune `resolveBarrierCollision` (`src/domain/physics/barrierCollision.ts`) so a shallow-angle barrier graze deflects the car away from the wall and resolves quickly, instead of decaying to a prolonged low-speed crawl:
  - Replace the flat `BARRIER_BOUNCE_SPEED_RETENTION = 0.4` with retention that depends on impact angle (grazing hits lose little speed and deflect along/away from the wall; near-head-on hits lose much more), so repeated shallow re-contacts don't geometrically crush speed toward zero each tick.
  - Redirect heading away from the wall (biased off the tangent toward the track interior) rather than exactly along the tangent, so the car visibly exits the wall instead of sliding flush against it.
  - Add a minimum escape speed/impulse floor applied on collision so a decaying sequence of grazing hits cannot stall the car against the wall indefinitely.
- Derive `MIN_CORNER_RADIUS` (`src/domain/track/validation.ts`) from the car's actual achievable turn radius (`maxSpeed / baseTurnRate` from `DEFAULT_CAR_PARAMS` in `src/domain/physics/carPhysics.ts`) plus a safety margin, instead of the current hardcoded `5`, so the two stay in sync and a track that passes validation is realistically drivable through its tightest corner without constant barrier clipping.
- No changes to the fixed-timestep simulation loop, the physics step function's signature, or the track document schema — this is a tuning/calibration pass within the existing architecture.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `driving-physics`: the "Barrier collision response" requirement's bounce/slide behavior changes (angle-dependent restitution, away-from-wall redirect, minimum escape speed) — same requirement intent (don't pass through the barrier, reduce speed) but the resolved scenario changes from "grazing hits can crawl indefinitely" to "the car escapes a grazing collision promptly."
- `track-editor`: the "Minimum corner radius validation" requirement's threshold derivation changes from a fixed magic number to a value computed from car physics constants with a safety margin — the pass/fail contract (validate against *a* minimum radius) is unchanged, but what that minimum is, and why, changes.

## Impact

- `src/domain/physics/barrierCollision.ts` — collision response tuning (retention curve, redirect angle, escape speed floor).
- `src/domain/physics/barrierCollision.test.ts` — updated/added unit tests for new collision behavior.
- `src/domain/track/validation.ts` — `MIN_CORNER_RADIUS` becomes a derived constant (imports from `carPhysics.ts`).
- `src/domain/track/validation.test.ts` (or equivalent) — updated tests for the new threshold.
- No changes to `TrackDocument` schema, the fixed-timestep loop, or module boundaries.
- Verification requires manually driving a track in the browser (per user instruction), not just unit tests, to confirm the "feel" fix and that validated tracks are drivable.
