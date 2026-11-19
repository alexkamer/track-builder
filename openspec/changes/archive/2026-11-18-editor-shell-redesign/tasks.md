# Tasks

## 1. Visual foundation

- [x] 1.1 Audit every `var(--…)` use across `src/**/*.css` and record the current call sites (editor rules plus `.race-hud`, `.stats-hud`, `.camera-toggle`, `.restart-button`, `.countdown-overlay`, `.leaderboard-panel`) so the rename in 1.2 has a complete list; verify by confirming the recorded list matches `grep -rn 'var(--' src` with no leftovers.
- [x] 1.2 Replace the 6-token `:root` block in `src/App.css` with the expanded surface/text/accent/state/spacing/radius/type scale and update every call site from 1.1; verify `npm run test` still passes and `grep -rn 'var(--' src` resolves every name against the new `:root` block.
- [x] 1.3 Add role-based control classes (`.btn`, `.btn--primary`, `.btn--ghost`, `.field`, `.panel`) alongside the existing `.toolbar button|select|input` descendant rules, keeping the old rules in place for now; verify the editor renders unchanged in a browser before any markup is reclassed.
- [x] 1.4 Open the editor and race screens in a browser at ~1280px and ~1920px and confirm the race HUD, stats HUD, camera/restart buttons, countdown, and leaderboard look identical to before the token rename; verify by comparing against the pre-change appearance.

## 2. Editor app shell

- [x] 2.1 Replace the centered `.app-shell` page flow with a header / work-area / side-rail / status-region layout in `App.css`, keeping the 2D SVG and 3D preview at their fixed intrinsic sizes and centering them in the work area per design.md; verify in a browser at ~1280px and ~1920px that no panel overlaps or is clipped and the page does not scroll vertically in the editor.
- [x] 2.2 Extract header and work-area shell markup out of `src/App.tsx` into components under `src/components/`, moving the `<h1>` into the header; verify `npm run test` passes unchanged and `App.tsx` is no longer than before.
- [x] 2.3 Give `TrackMetadataPanel` its own `.panel` class instead of reusing `.toolbar`, and reclass its inputs with `.field`; verify `src/components/TrackMetadataPanel.test.tsx` and `npm run test` pass, and the panel's inputs are still styled.
- [x] 2.4 Reclass `ControlPointInspector` to fit the side rail using `.panel`/`.field`/`.btn`; verify `src/components/ControlPointInspector.test.tsx` passes and the "Select a control point to edit its width, elevation, and banking." placeholder text is unchanged (`App.test.tsx` asserts on it).

## 3. Toolbar hierarchy and tool affordances

- [x] 3.1 Extract the toolbar markup from `App.tsx` into an `EditorToolbar` component taking handlers and state as props; verify `npm run test` passes with no test changes.
- [x] 3.2 Give the three control clusters visible labels or separators and apply `.btn--primary` to Start Race only; verify in a browser that the clusters read as distinct groups and that `screen.getByText('Start Race')` still resolves (`npm run test`).
- [x] 3.3 Stabilize tool-button labels — "Add point", "Set start/finish line", "Edit checkpoints", "Pan", "Select" — so the label no longer changes when the tool is active, keeping each `data-testid` and `aria-pressed`; verify a new test asserts `aria-pressed` flips on activation and that only one tool is pressed at a time (`track-editor` delta: "Active editing tool is identifiable").
- [x] 3.4 Add a hint region near the canvas that renders instructional text derived from `toolMode`, and update `App.test.tsx` / `TrackEditor2D.test.tsx` assertions that matched the old sentence-labels to use `data-testid` + `aria-pressed`; verify new tests cover the hint appearing for add-point/start-line/checkpoint/pan and swapping when the tool changes (`track-editor` delta: "Active tool explains what clicking will do").
- [x] 3.5 Add visible keyboard-shortcut hints to the Undo, Redo, and Delete point controls matching the bindings in `useEditorKeyboardShortcuts`; verify the displayed shortcuts match that hook's actual key handling and `npm run test` passes.
- [x] 3.6 Add a snap-to-grid active state consistent with the other toggles rather than the "Snap to grid: On/Off" label; verify a test asserts `aria-pressed` on `snap-to-grid-button` and that snap behavior is unchanged.

## 4. Validation surfaced at the blocked action

- [x] 4.1 Render a validation summary as a sibling of Start Race showing the outstanding error count, wired with `aria-describedby`, leaving the existing `validation-errors` list in place; verify `screen.getByText('Start Race')` still resolves and `npm run test` passes.
- [x] 4.2 Add tests for the blocked/unblocked states: an invalid track shows the count beside a disabled Start Race, and editing it to valid enables the button and removes both the summary and the error list; verify the new tests pass (`track-editor` delta: "Invalid tracks cannot be raced", both new scenarios).
- [x] 4.3 Move the error list into the status region so it sits near the toolbar rather than at the bottom of the page; verify in a browser that an invalid track's errors are visible without scrolling.

## 5. Share URL copy affordance

- [x] 5.1 Replace the bare read-only share-URL input with a labeled `.field` plus a copy button that writes to the clipboard and shows confirmation, keeping the `share-url-output` test id and leaving the URL selectable; verify the control appears only once a URL has been generated.
- [x] 5.2 Handle a rejected or absent `navigator.clipboard` by surfacing a copy-failure message while leaving the URL visible; verify tests stub `navigator.clipboard` for both the success and rejection paths (`sharing-and-leaderboards` delta: "Copying the shareable URL", "Copy fails", "Copy control only present with a URL").

## 6. Secondary screens

- [x] 6.1 Style the `.track-browser` screen (currently no CSS rule at all) using `.panel`/`.btn`/`.field`, including its rows, rename/delete controls, and error text; verify `src/components/TrackBrowser.test.tsx` passes and the screen renders as a styled list in a browser.
- [x] 6.2 Give the "Back to editor" controls in race and browse modes real button styling via `.btn--ghost` so they no longer render as default browser buttons; verify in a browser in both modes, and confirm the race canvas's `calc(100vh - 48px)` height still matches the control's actual height.

## 7. Cleanup and integration check

- [x] 7.1 Remove the `.toolbar button|select|input` descendant rules from 1.3 now that controls carry explicit classes; verify no control renders unstyled in editor, browse, and race modes in a browser.
- [x] 7.2 Run `npm run test`, `npm run lint`, and `npm run build` and confirm all three pass clean.
- [x] 7.3 Walk the full flow in a browser — load a preset, place and edit points with each tool, hit a validation error, fix it, share and copy the URL, race, and return to the editor — and confirm no layout breakage or unstyled control at ~1280px and ~1920px.
