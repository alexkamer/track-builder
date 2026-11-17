# Proposal

## Why

A race attempt currently starts with the car immediately controllable the instant `RaceScene` mounts, giving no shared "go" moment and letting input slip in before the player is oriented. There is also no way to reset a botched attempt (wall hit, missed checkpoint, bad start) without leaving race mode and regenerating the track through the editor, which discards context and adds friction to practicing a single track.

## What Changes

- Add a 3-2-1-GO countdown overlay shown when race mode starts (and after a restart) that suppresses car input/physics ticks until it completes, so the car cannot move during the countdown.
- Add a mid-race restart action (button + key binding) that resets the live car to the spawn point, resets the live lap timer and in-progress checkpoint progress, and re-triggers the countdown — without unmounting `RaceScene`, regenerating the track, or touching the tracked best lap / ghost replay.
- Reset is scoped to the *current attempt* only: best lap time, ghost input log, and leaderboard submission state from prior attempts in the session persist across a restart.

## Capabilities

### Modified Capabilities
- `race-session`: add a pre-race countdown gate that withholds car control until it elapses, and a mid-race restart that resets the current attempt (car position/heading, live lap timer, checkpoint progress) while preserving best-lap/ghost state.

## Impact

- `src/components/RaceScene.tsx`: owns new countdown/restart UI state, passes a "controllable" gate down, wires a restart handler that resets `carStateRef` and re-arms the countdown.
- `src/components/CarRig.tsx`: must stop advancing physics ticks (or force zero input) while the countdown is active, and support having the car's position/heading and internal tick/accumulator state reset on restart.
- `src/hooks/useRaceSession.ts`: needs a `resetAttempt` entry point that clears live lap progress (`lapProgressRef`, `currentLapInputLogRef`, live tick display) without touching `bestLapTicksRef`/`bestLapInputLogRef`.
- `src/hooks/useKeyboardCarInput.ts` (and gamepad input): unaffected directly, but input must be ignored/zeroed while not controllable.
- New: countdown UI component/state and a restart control (button, and likely a key binding) in the race HUD.
