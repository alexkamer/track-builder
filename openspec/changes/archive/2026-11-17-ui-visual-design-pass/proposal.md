# Proposal

## Why

The editor toolbar (`src/App.tsx`) and the in-race HUD (`src/components/RaceScene.tsx`) are functionally complete but visually unstyled: plain default `<button>`/`<select>` elements in a single flat flex row, and HUD overlays positioned with bare utility classes and no visual hierarchy. Nothing communicates which action is primary (Start Race), which controls are grouped together (file ops vs. editing tools vs. navigation), or what state a toggle is in beyond the browser's default focus/disabled styling. This is the first pass at making the app look like a designed product rather than a dev harness, now that the MVP, browse/track-library, and race-session feature sets are in place.

## What Changes

- Restyle the editor toolbar in `src/App.tsx` / `App.css`: visually group controls into clusters (preset/file operations: load preset, save, load saved, share vs. editing tools: undo, redo, start-line, checkpoint, snap-to-grid, pan vs. navigation: Start Race, Browse Tracks), give "Start Race" primary visual emphasis, and give toggle buttons (`start-line-tool-button`, `checkpoint-tool-button`, `snap-to-grid-button`, `pan-tool-button`) a clear pressed/active visual state distinct from their default state.
- Restyle the in-race HUD in `RaceScene.tsx` / `App.css`: lap timer and best-lap readout, the camera-mode toggle, and the restart button become a legible overlay (consistent panel styling, spacing, contrast) over the 3D canvas without obstructing the track view.
- Purely visual/layout changes: CSS and class-name/markup-structure updates only. No `data-testid` is renamed or removed, no component props, dispatch actions, state, or conditional logic change, and no new interactive behavior is introduced.

## Capabilities

### New Capabilities

None — this change does not introduce new system behavior.

### Modified Capabilities

None — presentation/styling is not a specified requirement in `track-editor` or `race-session`; no scenario-level behavior changes. This change sets `skip_specs: true`.

## Impact

- `src/App.tsx`, `src/App.css` — editor toolbar markup/structure and styling.
- `src/components/RaceScene.tsx`, `src/App.css` — race HUD markup/structure and styling.
- No changes to `src/domain/**`, hooks, or any test files beyond what's needed if a selector target shifts (test ids are preserved, so existing tests should continue to pass unmodified).
- Out of scope: new features or tools, physics/race rule changes, and the in-progress right-turns track-generation work happening in a parallel session/branch.
