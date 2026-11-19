# Design

## Context

See proposal.md — Why. The design-relevant facts about the current code:

- `src/App.tsx` (274 lines) holds the entire editor screen inline: three mode branches (`edit` / `race` / `browse`), all toolbar markup, all handler closures. There is no layout component and no per-control component.
- Styling is one 265-line `src/App.css` with 6 tokens in `:root` and descendant selectors (`.toolbar button`, `.toolbar select`, `.toolbar input`). `TrackMetadataPanel` reuses the `.toolbar` class to inherit that input styling, which is why a form panel is currently classed as a toolbar.
- `TrackEditor2D` renders an **SVG** with literal `width`/`height` attributes defaulting to 640×480, and `computeFitView` does its auto-fit math against those same two numbers. `LiveTrackPreview3D` likewise takes `width=420, height=480` and applies them as inline styles on a wrapper div.
- Tests assert on visible text in several places: `screen.getByText('Start Race')`, `screen.getByText('Set start/finish line')`, and the inspector's placeholder sentence. Tool buttons also carry `data-testid` and `aria-pressed`.
- Stack is React 19 + Vite + plain CSS. There is no CSS framework, no CSS modules, no component library, and no styling dependency of any kind.

## Goals / Non-Goals

**Goals:**

- A layout that reads as an application shell (header / work area / side rail / status) and holds together between roughly 1024px and ultrawide.
- A token and control-class layer that the deferred race-UI pass can adopt without redefining colors, spacing, or button styling.
- Keep `App.tsx` from growing: extract layout and toolbar markup so the file ends up no longer than it is now.
- Preserve every existing test assertion that is not specifically about tool-button label text.

**Non-Goals:**

- Mobile or narrow-viewport layouts. The editor needs a canvas plus a 3D preview plus an inspector side by side; a phone layout is a separate problem.
- Making the 2D editor SVG or the 3D preview responsive to container size (see Decisions).
- Light theme or theme switching. The app is dark-only (`color-scheme: dark`) and stays that way.
- Any change to the in-race HUD beyond keeping it working against renamed tokens.

## Decisions

### Keep the editor SVG and 3D preview at fixed intrinsic sizes

The shell becomes flexible; the two canvases do not. They keep their `width`/`height` props and get centered within the work area.

**Why:** `computeFitView` derives zoom and pan from the same `width`/`height` numbers used as SVG attributes, and pointer handling converts client coordinates into that space. Making the SVG fill its container means measuring with a `ResizeObserver`, re-running auto-fit on resize, and re-verifying the coordinate math — plus the existing tests click at fixed `clientX`/`clientY` under jsdom, where measured sizes are zero. That is a behavioral change to canvas interaction, not a layout change, and it deserves its own change with its own scenarios.

**Alternative considered:** `viewBox` + `width="100%"`, which would scale the SVG without touching the fit math. Rejected because it scales the *rendered* result: control-point hit radius (`POINT_RADIUS = 7`) and stroke widths would scale with the viewport, so points become harder to hit on a small window and oversized on a large one. A fixed drawing surface with scroll/centering around it is the honest version until responsive sizing is designed properly.

**Consequence:** on a wide viewport there will be empty space around the canvas. The side rail and status region absorb some of it; the rest is accepted.

### Validation summary sits beside the race button, not inside it

The error count renders as a sibling element adjacent to **Start Race**, wired to it with `aria-describedby`.

**Why:** two reasons point the same way. `App.test.tsx` uses `screen.getByText('Start Race')` to grab the button; nesting a count badge inside it changes the button's text content and breaks that selector. And a disabled button is not reliably announced with its own descendant content by screen readers, so an adjacent described-by element is also the better accessibility answer. Both argue against a badge inside the control.

### Tool hint is derived state, not stored state

A single lookup from the existing `toolMode` value to hint text, rendered in a hint region above the canvas. No new state, no new reducer action.

**Why:** `toolMode` already fully determines what a canvas click does — the current code proves it by deriving the button's sentence-label from exactly that value. The change is where the derived string renders, not what drives it.

### CSS stays plain CSS, with role-based classes replacing descendant selectors

Introduce `.btn`, `.btn--primary`, `.btn--ghost`, `.field`, `.panel` and apply them explicitly. Keep `.toolbar button` temporarily so nothing goes unstyled mid-migration, and delete it once every control carries a class.

**Why:** the descendant selectors are what forced `TrackMetadataPanel` to misuse `.toolbar`. Role classes let a form panel be styled as a panel. Plain CSS over CSS modules or Tailwind because the app has zero styling dependencies today and a visual pass is a poor reason to add a build-affecting one; a single stylesheet at this size is still manageable.

### Split `App.tsx` by mode and extract the toolbar

Extract `EditorToolbar` (the control clusters, taking handlers as props) and small shell components for header and work area. Keep the three mode branches in `App.tsx`.

**Why:** the toolbar is where most of the new markup lands — group labels, shortcut hints, the hint region, the validation summary. Leaving it inline pushes `App.tsx` past 400 lines of mostly presentation. Extraction is mechanical: the handlers already close over state that can be passed as props.

**Alternative considered:** one component per mode (`EditorScreen`, `RaceScreen`, `BrowseScreen`). Deferred — the mode branches are 6–20 lines each and splitting them would mean threading a dozen pieces of shared editor state through props for no present benefit.

### Token names change, so the race HUD is updated in the same pass

Existing race rules consume `--panel-bg`, `--panel-border`, `--accent`, `--text-primary`, `--text-muted`, `--radius-md`, `--space-sm`, `--space-md`. The expanded scale renames and extends these.

**Why not keep the old names as aliases:** six aliases pointing into a new scale is more confusing than updating roughly a dozen call sites, and the aliases would outlive the change. The race HUD's *appearance* is not being redesigned here — only the variable names it reads — so this stays a mechanical substitution and the HUD keeps rendering identically.

## Risks / Trade-offs

- **Text-based test assertions break when tool labels stabilize** → `getByText('Set start/finish line')` keeps working (that is the stable label); assertions matching the active-state sentences do not. Audit `App.test.tsx` and `TrackEditor2D.test.tsx` for text matches before editing markup, and convert tool-activation assertions to `data-testid` + `aria-pressed`, which is the more durable selector anyway.
- **Token rename silently breaks a rule that reads an undefined variable** → an undefined CSS custom property fails silently to an invalid/inherited value rather than erroring, so a missed call site shows up only visually. After the rename, grep for `var(--` across `src/**/*.css` and confirm every name resolves against the new `:root` block; run the app in both editor and race mode.
- **Layout regressions are invisible to the test suite** → jsdom does not lay out, so no automated test will catch a broken grid. Verify the editor, browse, and race screens in a real browser at ~1280px and ~1920px before considering the change done.
- **"Looks designed" is not a checkable condition** → the spec deltas cover only the three behavioral affordances; the visual outcome is reviewed by eye. Accepted; the alternative is writing unfalsifiable scenarios about appearance.
- **Clipboard API is unavailable in non-secure contexts and unstubbed in jsdom** → the copy control handles a rejected or missing `navigator.clipboard` by surfacing the failure and leaving the URL selectable (covered by a scenario in the `sharing-and-leaderboards` delta); tests stub `navigator.clipboard`.

## Migration Plan

Not applicable — no data, schema, URL, or API change. The editor stylesheet and markup change in place; a revert is a plain revert.
