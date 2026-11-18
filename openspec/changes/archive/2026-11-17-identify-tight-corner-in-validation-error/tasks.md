# Tasks

## 1. Surface the offending corner in validation

- [x] 1.1 In `validateCornerRadius` (`src/domain/track/validation.ts`), when `circumradius` falls below `MIN_CORNER_RADIUS` at sample index `i`, derive the nearest control-point index from `i` (sample `i` belongs to the segment starting at control point `Math.floor(i / VALIDATION_SAMPLES_PER_SEGMENT) % n`) and include it and the curve point's `x`/`z` coordinates in the returned `ValidationError.message`. Verify by running the existing `validateCornerRadius` test (`src/domain/track/validation.test.ts`) and confirming the new message includes a control-point index.
- [x] 1.2 Update `src/domain/track/validation.test.ts`'s `'fails for a track with a corner tighter than the minimum radius'` test to assert the message identifies a specific control-point index (not just the error `code`), and add a case with `sharpSpikeTrack()` confirming the identified index is the actual offending one. Verify by running `npm test -- validation.test.ts` (or the project's equivalent vitest command) and confirming both tests pass.
- [x] 1.3 Manually load a track with a too-tight corner in the track editor (e.g. a preset or hand-built track that fails `validateCornerRadius`) and confirm the validation error panel displays the updated message legibly, without truncation or overflow. Verify by visual inspection in the running dev app.
