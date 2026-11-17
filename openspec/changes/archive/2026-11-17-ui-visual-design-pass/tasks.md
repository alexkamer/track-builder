# Tasks

## 1. Design tokens

- [x] 1.1 Add CSS custom properties (`--panel-bg`, `--panel-border`, `--accent`, `--text-primary`, `--text-muted`, `--radius-md`, `--space-sm`, `--space-md`) to `App.css` and verify `npm run build` / `npm test` still pass with no visual-regression test failures.

## 2. Editor toolbar restyle

- [x] 2.1 Wrap the first `.toolbar` row's controls in `src/App.tsx` into three grouped `<div>`s (`toolbar-group--files`, `toolbar-group--tools`, `toolbar-group--nav`) per design.md's grouping, keeping every existing `data-testid` on its current element, and verify `npm test -- App.test` passes unchanged.
- [x] 2.2 Add `.toolbar-group` and `.toolbar-group--*` styles in `App.css` (flex layout, gap, visual separation between groups) and verify the groups render as visually distinct clusters in the dev server (`npm run dev`).
- [x] 2.3 Add `[aria-pressed="true"]` styling scoped to `.toolbar-group--tools button` for the four toggle buttons (`start-line-tool-button`, `checkpoint-tool-button`, `snap-to-grid-button`, `pan-tool-button`) and verify by toggling each in the running app and confirming a visibly distinct pressed state.
- [x] 2.4 Add a primary-action style for `start-race-button` (using `--accent`) with a `:disabled` override that keeps it visually muted when `canRace` is false, and verify both states by toggling track validity in the dev server.
- [x] 2.5 Run the full test suite (`npm test`) and confirm no existing `App.test.tsx` assertions needed changes.

## 3. Race HUD restyle

- [x] 3.1 Wrap `.race-hud`'s lap-timer spans in a panel container reusing the token set from Task 1, matching `.leaderboard-panel`'s existing background/padding/radius treatment, and verify `npm test -- RaceScene.test` passes unchanged.
- [x] 3.2 Apply the same panel treatment to `.camera-toggle` and `.restart-button` in `App.css`, and verify in the dev server that both remain legible and clickable over the 3D canvas at the existing `top/right` positions.
- [x] 3.3 Visually verify (manual run, `npm run dev`, enter race mode) that the restyled HUD, camera toggle, and restart button don't overlap each other or the `.leaderboard-panel`, and don't obstruct the track/car view.

## 4. Verification

- [x] 4.1 Run `npm test` and `npm run lint` (or project equivalents) and confirm both pass with zero changes to test files.
- [x] 4.2 Manually walk through the editor (grouped toolbar, toggle states, Start Race enabled/disabled) and a full race attempt (HUD, camera toggle, restart, countdown) in the dev server to confirm no behavior regressed.

## Workflow follow-up

- Archive this change once the restyle has been reviewed and merged.
