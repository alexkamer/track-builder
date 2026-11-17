# Design

## Context

`RaceScene` renders a `Canvas` containing `CarRig`, which owns a `FixedTimestepAccumulator` and per-frame tick loop (`src/components/CarRig.tsx`): each `useFrame` call consumes real elapsed time into a whole number of fixed ticks, advances `carStateRef` via `advanceCarTick`, and calls `onTick(state, tickIndex, input)`. `useRaceSession` (`src/hooks/useRaceSession.ts`) consumes `onTick` to drive `tickLapProgress` (`src/domain/race/lapTimer.ts`), track the live lap tick count, detect lap completion, and update `bestLapTicksRef`/`bestLapInputLogRef` when a new best lap is set. See proposal.md for why a countdown and restart are needed now.

Everything the design touches lives in React refs/state already owned by `RaceScene`, `CarRig`, and `useRaceSession` — no new global state container is needed.

## Goals / Non-Goals

**Goals:**
- Gate car control (not just rendering) behind a countdown, so no input is lost and no physics ticks run while it's active.
- Reset the live/current-attempt state (car transform, lap timer, checkpoint progress, accumulated input log for the in-progress lap) on restart, while leaving best-lap tracking, ghost input log, and leaderboard submission untouched.
- Keep `RaceScene`/`Canvas` mounted across both the initial countdown and any restart, so track generation and R3F scene setup aren't repeated.

**Non-Goals:**
- Changing ghost playback, leaderboard submission, or camera-mode behavior.
- Multi-lap race structure or a results/finish screen (out of scope; attempts are still open-ended practice laps).
- Networked/multiplayer countdown synchronization.

## Decisions

### Gate ticks in `CarRig`, not just input
`CarRig` gains a `controllable: boolean` prop. While `controllable` is false, the `useFrame` callback still updates the accumulator (so no backlog of ticks fires all at once when control is granted) but skips calling `advanceCarTick`/`onTick` for that frame — equivalent to running zero ticks. This guarantees the physics state and lap-progress tick counters are frozen during the countdown, not just that input is zeroed, which matters because `useRaceSession.handleTick` only runs when `onTick` fires.

Alternative considered: zero out `inputRef` during the countdown and let ticks continue. Rejected because idle-input ticks would still advance `ticksSinceLastStartCrossing` from a false "crossing" at tick 0 and would run physics (gravity/friction settling) before the player sees "GO," which is observable and inconsistent with the spec's "does not move" requirement.

### Countdown state lives in `RaceScene`
`RaceScene` owns a small countdown state machine (e.g. `countdownPhase: 3 | 2 | 1 | 'go' | null`, driven by a `setTimeout`/`setInterval` chain or a `useEffect` with elapsed real time) and derives `controllable = countdownPhase === null`. It renders the countdown overlay and passes `controllable` into `CarRig`. This keeps the countdown as presentation/orchestration state separate from the fixed-timestep simulation, matching the existing split where `RaceScene` owns `carStateRef` and HUD, while `CarRig` owns tick execution.

### Restart resets refs in place, not by remounting
A `handleRestart` callback in `RaceScene`:
1. Resets `carStateRef.current` to a freshly created spawn state (same helper `createInitialCarState` used on mount).
2. Resets `CarRig`'s internal accumulator and tick counter. Since those are refs local to `CarRig`, `CarRig` exposes a `resetToken: number` prop (or an imperative reset callback) that, when changed, re-initializes `accumulatorRef`/`tickCounterRef` inside a `useEffect`. This avoids remounting `CarRig` (and therefore the `<mesh>`/Canvas subtree) just to clear two refs.
3. Calls `raceSession.resetAttempt()` (new method returned from `useRaceSession`) which resets `lapProgressRef`, `prevPosRef` (back to spawn position), `currentLapInputLogRef`, and the live tick display state — explicitly leaving `bestLapTicksRef`, `bestLapInputLogRef`, and their corresponding `bestLapSeconds`/`ghostInputLog` state untouched.
4. Re-arms the countdown (`countdownPhase = 3`), which makes the car uncontrollable again until it completes.

Alternative considered: remount `CarRig`/`GhostRig` via a `key` change on restart. Rejected — it would also remount the ghost rig and re-run its own setup unnecessarily, and loses the benefit of reusing the existing accumulator instance; an explicit reset path is more precise about what state clears.

### Restart trigger: HUD button plus a key binding
Add a "Restart" button in `race-hud` (consistent with the existing camera-toggle button) and bind a key (e.g. `R`) through the same keyboard-handling approach `useKeyboardCarInput` already uses, as a separate small hook/listener so it doesn't entangle with car input semantics (steering/throttle) that physics consumes.

## Risks / Trade-offs

- [Countdown timing drifts from wall clock if implemented with `setTimeout` while the tab is backgrounded] → Use real elapsed time (e.g. `performance.now()` deltas inside `useFrame`, same clock source as the accumulator) rather than chained `setTimeout`, so the countdown pauses/resumes consistently with the rest of the simulation when the tab is throttled.
- [Resetting `CarRig`'s internal refs via a prop/token is more implicit than remounting] → Keep the reset surface minimal (one `resetToken` prop) and covered by a test that asserts tick count and car position both return to spawn after a restart.
- [Forgetting to exclude `bestLapTicksRef`/`bestLapInputLogRef` from `resetAttempt` would silently wipe a player's best lap on restart] → Cover this explicitly with the "Restart preserves best lap and ghost" scenario as a test case in `useRaceSession`'s test suite.
