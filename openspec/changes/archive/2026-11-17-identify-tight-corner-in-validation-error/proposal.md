# Proposal

## Why

A user reported the minimum-corner-radius error ("A corner is tighter than the minimum turning radius of 25.45454545454545 units. Widen that curve.") on right-hand turns and suspected the validator was computing right turns as if they were mirrored/inverted left turns. Investigation of `validateCornerRadius`/`circumradius` in `src/domain/track/validation.ts` and the car's turn-rate model in `src/domain/physics/carPhysics.ts` found no left/right or clockwise/counterclockwise logic anywhere in that path — `circumradius` uses `Math.abs()` and `Math.hypot()`, so it is invariant under mirroring, and `MIN_CORNER_RADIUS` is derived from symmetric scalar physics constants. The error is almost certainly correct: that specific corner's measured radius is genuinely below the threshold (likely newly surfaced by the `887c57b` threshold increase from a hardcoded `5` to `achievableTurnRadius() * 1.4`), not a direction bug.

The error message gives no way to tell which corner is at fault beyond re-reading the whole curve by eye, which is exactly what led to the mistaken direction-bug theory here. Identifying the offending control point in the message would let a user confirm for themselves that it's a real, local geometry issue rather than suspecting a systemic left/right bug.

## What Changes

- `validateCornerRadius` reports which control point segment is too tight (the nearest control-point index and its coordinates) instead of a generic "a corner" message, so a user can locate and fix the offending corner directly.
- The `CORNER_RADIUS_TOO_TIGHT` error surfaced in the editor UI includes this location detail.

## Capabilities

### Modified Capabilities
- `track-editor`: "Minimum corner radius validation" requirement's error-reporting behavior changes from a generic violation message to one that identifies the specific offending control point/location.

## Impact

- `src/domain/track/validation.ts`: `validateCornerRadius` and the `ValidationError` shape/message for `CORNER_RADIUS_TOO_TIGHT`.
- Any UI that renders `ValidationError` messages verbatim (track editor's validation error display) picks up the more specific message automatically; no separate UI change expected beyond verifying the longer message still displays well.
- `src/domain/track/validation.test.ts`: tests asserting on the exact error message/shape for this code need updating.
