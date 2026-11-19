# Proposal

## Why

The editor is the screen every session starts on, and it is still laid out as a centered document rather than an application: `src/App.tsx` stacks an `<h1>`, two wrapping `.toolbar` strips, a metadata row, and a three-wide panel row down the middle of the page. The earlier `ui-visual-design-pass` gave the toolbar dark panel styling and an accent color, but it did not change the structure, so the remaining problems are structural rather than cosmetic: fifteen controls sit in one unlabeled wrapping strip, the active tool is communicated by rewriting a button's label into a sentence ("Click to add a point…"), validation errors render at the very bottom of the page far from the disabled **Start Race** button they explain, and the browse screen plus its "Back to editor" button have no styling at all (`.track-browser` has no CSS rule, and that button sits outside `.toolbar` so it inherits nothing).

Doing the editor before the race overlay also establishes the layout shell, control styles, and type scale that a later race-HUD pass can reuse, instead of each screen inventing its own.

## What Changes

- **Editor layout becomes an app shell.** Replace the centered page flow with a fixed header plus a main work area: the 2D canvas as the primary surface, the 3D preview and control-point inspector as a side rail, and a footer/status region. The work area fills the viewport instead of growing the page, and the three panels stop being a non-responsive flex row.
- **Toolbar gains hierarchy.** Group controls into labeled clusters (file/track operations, editing tools, navigation), give the clusters visible labels or separators rather than relying on background tint alone, keep **Start Race** as the single primary action, and show keyboard shortcuts for Undo/Redo/Delete on the controls that have them.
- **Tool state moves out of button labels.** Tool buttons keep stable labels ("Add point", "Set start/finish line", "Edit checkpoints", "Pan") with a clear active state; the instructional text for the active tool ("Click empty canvas to add a point") moves to a dedicated hint region near the canvas. The active tool is identifiable without reading sentence-length button text.
- **Validation is surfaced where it blocks you.** When the track fails validation, the reason is reachable from the disabled **Start Race** control (count badge/inline summary adjacent to it) in addition to the error list, so a user who clicks a dead primary button learns why without scrolling.
- **Share URL gets a copy affordance.** The bare read-only input becomes a labeled field with a copy-to-clipboard button and confirmation, replacing manual select-and-copy.
- **Browse and secondary screens get the same chrome.** Style `.track-browser` and give the mode-exit ("Back to editor") control real button styling, so no screen falls back to default browser widgets.
- **Reusable visual foundation.** Extend the existing `:root` tokens in `App.css` (currently 3 colors, 1 radius, 2 spacing steps) into a usable scale for spacing, type, surface, and state, and define shared control classes so buttons/inputs/selects are styled by role instead of by descendant selector (`.toolbar button`).

Non-goals that keep this bounded: no changes to physics, race rules, track generation, validation logic, persistence, or the API. No `data-testid` is renamed or removed. Editor behavior — dispatch actions, undo/redo wiring, tool semantics, mode switching — is unchanged apart from the explicitly listed affordances.

## Capabilities

### New Capabilities

None — this change introduces no new system capability. The layout and visual foundation are implementation concerns, and the three new affordances extend requirements that existing capabilities already own.

### Modified Capabilities

- `track-editor`: two requirement-level additions. (1) The editor must indicate which tool is currently active and what clicking will do, as state on the tool control plus a hint region, rather than by replacing the control's label. (2) The "Invalid tracks cannot be raced" requirement gains a scenario: when race entry is blocked, the blocked control itself communicates that validation is failing and how many errors there are, not only the separate error list.
- `sharing-and-leaderboards`: the "Shareable track URL" requirement gains a scenario for copying the generated URL to the clipboard via a UI control with visible confirmation.

## Impact

- `src/App.tsx` — layout restructure, toolbar grouping, tool-hint region, validation summary beside Start Race, share-URL copy control, styled mode-exit button. The largest diff in the change.
- `src/App.css`, `src/index.css` — token scale, shared control classes, app-shell/header/work-area/side-rail layout, `.track-browser` styling. The existing `.race-hud` / `.stats-hud` / `.camera-toggle` / `.leaderboard-panel` rules stay functional; they are only touched where they consume renamed tokens.
- `src/components/TrackMetadataPanel.tsx` — stops reusing the `.toolbar` class for a form panel; gets its own class.
- `src/components/ControlPointInspector.tsx`, `src/components/TrackBrowser.tsx` — markup/class updates to fit the shell; no logic changes.
- `src/App.test.tsx`, `src/components/TrackBrowser.test.tsx`, `src/components/TrackMetadataPanel.test.tsx` — existing assertions that match on tool-button *text* ("Click to add a point…") will need updating to assert on active state instead; test ids are preserved so selector-based assertions keep working. New tests cover the tool hint, the validation summary, and clipboard copy.
- Out of scope: `src/domain/**`, `src/hooks/**`, `server/**`, the in-race HUD beyond token compatibility, and the race-UI pass deferred to a follow-up change.
