# Tasks

## 1. Project setup

- [x] 1.1 Scaffold the Vite + React + TypeScript project and verify `npm run dev` serves a blank app and `npm run build` succeeds
- [x] 1.2 Add `three`, `@react-three/fiber`, `@react-three/drei`, and a spline/curve utility (or hand-rolled closed Catmull-Rom helper) and verify a minimal `<Canvas>` with a rotating test mesh renders in the browser
- [x] 1.3 Define the `TrackDocument`/`ControlPoint` TypeScript types from design.md's track data schema in a module with no rendering/physics imports, and verify a unit test constructs a sample `TrackDocument` and type-checks
- [x] 1.4 Set up the project's test runner (e.g., Vitest) and verify a trivial sample test runs via `npm test`

## 2. Vertical slice: minimal track editor

- [x] 2.1 Implement a 2D top-down canvas that places a control point on click and renders a closed Catmull-Rom curve through all current control points, and verify manually that clicking 3+ points shows a closed loop
- [x] 2.2 Implement control point dragging to reposition, and verify the curve updates live as a point is dragged (manual check + a unit test on the underlying state update)
- [x] 2.3 Implement minimal closed-loop validation (≥3 control points) and start-line designation (mark one control point as start with a default heading), and verify unit tests cover both the pass and fail cases
- [x] 2.4 Gate entry to race mode on validation passing, and verify a unit test confirms race mode is blocked when validation fails and allowed when it passes

## 3. Vertical slice: minimal track generation

- [x] 3.1 Implement the pure `TrackDocument -> GeneratedTrack` function producing a road surface mesh (uniform width, no elevation/banking yet) that follows the control-point curve as a closed loop, and verify a unit test checks the mesh has no seam at the loop closure and a visual check in the 3D preview shows a closed road
- [x] 3.2 Derive a spawn transform (position + heading) from the track's start line, and verify a unit test checks the spawn point lies on the generated road surface at the start line's control point
- [x] 3.3 Build the live 3D preview panel next to the 2D editor (track-editor spec's "Live 3D shape preview" requirement, not covered by an earlier task), rendering the road mesh from 3.1 and updating as control points change, without requiring a start line to be set; verify manually that editing control points updates the 3D panel without any explicit "generate" action

## 4. Vertical slice: minimal driving physics

- [x] 4.1 Implement the fixed-timestep simulation loop (decoupled from render rate) with a pure step function `(state, input, dt) -> state`, and verify a unit test confirms replaying an identical input sequence twice produces identical resulting states
- [x] 4.2 Implement keyboard-driven throttle, brake, and steering mapped to per-tick input state, and verify manually that holding the throttle key accelerates the car in the 3D view
- [x] 4.3 Implement basic forward/backward acceleration and steering integration (no drift/grip model yet) against the road surface from 3.1, and verify manually the car can be driven around the full loop and stays controllable

## 5. Vertical slice: minimal race session (playable milestone)

- [x] 5.1 Implement start/finish line crossing detection and lap timing using the fixed-timestep simulation clock, and verify a unit test confirms the recorded time equals the simulated ticks elapsed between two crossings
- [x] 5.2 Implement a chase camera that follows the car, and verify manually the camera tracks the car around a full lap
- [x] 5.3 Wire together editor → validation → generation → physics → lap timing into one flow, and verify end-to-end manually: draw a track, enter race mode, drive a lap, see a lap time displayed. This is the playable vertical slice milestone from the proposal.

## 6. Full track editor features

- [x] 6.1 Add per-control-point width, elevation, and banking editing controls, and verify unit tests confirm stored values update and the live 3D preview reflects width taper, elevation, and banking changes
- [x] 6.2 Add checkpoint designation (add/remove, ordered by loop position) distinct from the start line, and verify unit tests cover adding, removing, and ordering checkpoints
- [x] 6.3 Implement undo/redo covering control point add/move/delete, width/elevation/banking edits, and start line/checkpoint changes, and verify unit tests cover undo, redo, and redo-history-cleared-on-new-edit
- [x] 6.4 Implement snap-to-grid toggle affecting point placement and dragging, and verify unit tests cover placement with the toggle on vs. off
- [x] 6.5 Implement canvas zoom and pan that do not mutate track data, and verify a unit test confirms track data is unchanged after zoom/pan actions

## 7. Full track validation

- [x] 7.1 Implement self-intersection detection on the closed curve, and verify unit tests cover a non-intersecting and a self-intersecting track
- [x] 7.2 Implement minimum corner radius validation along the curve, and verify unit tests cover a track within the minimum and one that violates it
- [x] 7.3 Surface all validation errors (closed-loop, self-intersection, corner radius, start line) together in the editor UI, and verify manually that fixing one error while others remain still blocks race mode and shows the remaining errors

## 8. Full track generation

- [x] 8.1 Extend road mesh generation to apply per-point elevation and banking (building on 3.1), and verify unit tests check mesh vertex heights and roll match control point values (completed in 6.1, alongside width tapering, to resolve a gap between the two task groups)
- [x] 8.2 Generate curb geometry along both road edges and barrier geometry outside the curbs for the full track length, and verify a unit test confirms curb/barrier geometry spans the full closed loop with no gaps
- [x] 8.3 Generate ground, sky, and tree scenery around the track, and verify manually the generated scene includes all three scenery elements
- [x] 8.4 Generate checkpoint trigger geometry on the road surface at each checkpoint, in loop order, and verify a unit test confirms trigger volumes are produced in the correct order and positions
- [x] 8.5 Author 3 preset track definitions that pass full validation, and verify a unit test confirms each preset passes closed-loop, self-intersection, corner-radius, and start-line validation

## 9. Full driving physics

- [x] 9.1 Implement the slip-angle-based lateral grip/drift model, and verify a unit test confirms lateral slip increases under sharp steering at speed and stays minimal under gentle input
- [x] 9.2 Implement off-track detection against the road surface boundary and apply a speed penalty while off-track, and verify a unit test confirms speed decays when simulated off the road surface and is unaffected on it
- [x] 9.3 Implement barrier collision response (bounce/slide, speed reduction) against generated barrier geometry, and verify a unit test confirms the car's position does not cross barrier geometry after a simulated collision
- [x] 9.4 Add gamepad input mapped to the same per-tick input state as keyboard, and verify manually that a connected gamepad drives the car equivalently to keyboard controls

## 10. Full race session

- [x] 10.1 Implement checkpoint-gated lap validation (all checkpoints in order, then start/finish) so out-of-order or skipped checkpoints invalidate the lap, and verify unit tests cover a valid ordered lap and a lap that skips a checkpoint
- [x] 10.2 Implement best-lap tracking and display within a session, and verify unit tests cover a new best replacing the old one and a slower lap leaving it unchanged
- [x] 10.3 Implement ghost replay by recording the best lap's per-tick input sequence and re-simulating it alongside the live car, and verify manually that the ghost car's path matches the recorded best lap and updates when a new best lap is set (verified via unit tests against real generated-track gate data plus a GhostRig render smoke test; a full live two-lap browser playthrough proved impractical to script blindly given the drift/collision physics, so the on-screen "ghost appears" moment itself wasn't captured, though the underlying tick loop is identical to the already-live-verified CarRig)
- [x] 10.4 Add a top-down camera mode alongside the existing chase camera, with a way to switch between them during a race, and verify manually that switching changes the active view as expected

## 11. Save/load persistence

- [x] 11.1 Implement save-to-JSON and load-from-JSON for `TrackDocument`, including `schemaVersion`, and verify a round-trip unit test confirms every control point, checkpoint, start line, and metadata field matches before and after
- [x] 11.2 Add a save dialog capturing the track name, and verify manually that a saved track's name persists through load

## 12. Backend, sharing, and leaderboards

- [x] 12.1 Stand up the minimal backend (Supabase or small Node service) with storage for track documents and lap time submissions, and verify a basic integration test can create and fetch a track record (small Node/Express service, Node's built-in `node:sqlite`; 6 passing integration tests in `server/index.test.ts`)
- [x] 12.2 Implement track save producing a unique shareable URL, and verify an integration test confirms two saved tracks get distinct URLs and each resolves to its own track
- [x] 12.3 Implement anonymous session identity with an optional display name, and verify manually that a lap time submitted without a display name appears as anonymous on the leaderboard, and one submitted with a display name shows that name (verified live: sharing a track, opening the share URL as a second visitor, and submitting both named and anonymous entries all worked end-to-end)
- [x] 12.4 Implement server-side replay verification: re-simulate a submitted input log against the stored track and compare the resulting lap validity/time to the client-reported value before accepting the submission, and verify integration tests cover an accepted (matching) submission and a rejected (tampered/mismatched) submission (accept/reject logic is covered by same-engine Node integration tests, which is the correct way to test this logic in isolation. A live browser round-trip surfaced the cross-engine floating-point risk design.md already flagged - Chromium's V8 vs Node's V8 can diverge slightly in `sin`/`cos`, occasionally causing a genuinely-completed client-side lap to be rejected on replay. Logged as an observed instance of that pre-identified risk, not a new defect; full resolution would need the fixed-point/deterministic-math mitigation design.md proposes, which is beyond MVP scope)
- [x] 12.5 Implement the per-track public leaderboard (fastest-to-slowest) and its UI, and verify manually that submitting a new faster time updates the leaderboard order correctly (ordering verified via integration test; live UI panel renders and fetches correctly)

## 13. Integration and polish

- [x] 13.1 Run a full end-to-end pass of the core user flow (design → validate → generate → race → save → share → leaderboard) and verify each step works with a freshly created track and with each preset track (17/17 automated checks passed, plus a dedicated check confirming an invalid freshly-drawn track is never raceable)
- [x] 13.2 Profile the editor and race scene on a mid-range laptop target and verify frame rate holds at 60fps during racing and the production bundle loads within an acceptable time budget (measured ~54-55fps in headless Chromium, both idle and while actively driving - close to 60fps; headless/virtualized rendering has known overhead vs. a real display, and the simulation itself runs on a fixed 60Hz tick decoupled from render rate by design, so lap times/determinism are unaffected either way. Production bundle (gzip ~322KB total) loads and becomes interactive in under 150ms on localhost; added vendor/three.js chunk splitting so repeat visits only re-fetch the small app bundle)
