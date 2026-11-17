# Backlog

Candidate stories not yet promoted to an OpenSpec change. Pick one and run
`/openspec-propose` (or `opsx propose`) when ready to start it.

## Visual design pass on Menu and Race UI

**Status:** proposed

**Story:** As a player, I want the editor toolbar/menu and the in-race HUD to
look like a designed product instead of unstyled HTML controls, so the app
feels polished and the controls I need during a race are easy to read at a
glance.

**Context:** The editor toolbar (`src/App.tsx`) is a flat row of default
`<button>`/`<select>` elements with no visual hierarchy, grouping, or state
styling (hover/active/disabled are browser defaults). The race screen
(`RaceScene.tsx` and friends) renders lap timer, best lap, and camera-mode
controls with the same unstyled approach. Functionality is solid (undo/redo,
tool modes, checkpoints, ghost replay, cameras) but nothing about the
presentation communicates what's a primary action vs. a secondary one, and
there's no consistent spacing, type, or color system.

**Scope:**
- Editor "menu": group related controls (file ops: save/load/share vs. tools:
  select/pan/start-line/checkpoint/snap-to-grid vs. mode switches:
  race/browse), give primary actions (Start Race) visual priority, add
  readable active/disabled states for tool toggles.
- Race HUD: make lap timer, best lap, and camera switcher legible as an
  overlay on top of the 3D scene (contrast, positioning, sizing) without
  blocking the view of the track.
- No behavior changes: same test ids, same dispatch/history wiring, same
  mode-switching logic — this is styling/layout only.

**Out of scope:** new features, new tool modes, changes to physics/race
rules, the in-progress right-turns track-generation work happening in a
parallel session.

**Why now:** the app is functionally complete for MVP + browse/race-session
extras; this is the first pass that makes it look like something a user
would want to use rather than a dev harness.
