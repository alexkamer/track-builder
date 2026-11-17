# Design

## Context

Both target areas live in two files plus the single shared stylesheet:
- `src/App.tsx` renders the editor's two `.toolbar` flex rows (12 controls total) and `App.css`'s `.toolbar` rule is just `display: flex; gap: 8px`. Toggle buttons use `aria-pressed` but have no corresponding `:not([aria-pressed="true"])`/`[aria-pressed="true"]` styling — the only visual state is the browser default.
- `src/components/RaceScene.tsx` renders `.race-hud`, `.camera-toggle`, `.restart-button`, `.countdown-overlay` as sibling absolutely-positioned elements layered over the `<Canvas>`. `App.css` already positions them (top/left/right offsets, z-index) but gives them no panel background, border, or type treatment beyond a text-shadow on the HUD text.
- Verified in both test files: no test queries by DOM structure (`closest`, `parentElement`, CSS-selector chains) or by class name — every assertion uses `getByTestId`/`getByRole`/text content. So markup can be freely re-nested (wrapping groups in `<div>`s, adding a `<fieldset>`-like group wrapper) as long as the existing `data-testid` attributes stay on the same elements and element roles (`button`, `select`, etc.) don't change.

See proposal.md for motivation and scope boundaries.

## Goals / Non-Goals

**Goals:**
- Introduce a small set of reusable CSS custom properties (color, spacing, radius) in `App.css` so the toolbar and HUD draw from one palette instead of ad hoc values, without pulling in a CSS framework or build-tool change.
- Visually group the editor toolbar into three clusters — file/sharing, editing tools, navigation — using wrapper `<div>`s with new class names; no `.toolbar` row is removed, controls just move inside grouped wrappers.
- Give toggle buttons (`start-line-tool-button`, `checkpoint-tool-button`, `snap-to-grid-button`, `pan-tool-button`) a distinct pressed look via `[aria-pressed="true"]` styling.
- Give `start-race-button` a primary-action treatment (color weight) distinct from secondary buttons.
- Restyle `.race-hud`, `.camera-toggle`, `.restart-button` as a consistent panel (background, padding, radius, border) matching `.leaderboard-panel`'s existing treatment so the HUD reads as one system rather than bare text/buttons floating over the canvas.

**Non-Goals:**
- No new component library, CSS-in-JS, or build tooling.
- No change to `.countdown-overlay`'s large centered-text treatment — it already reads clearly against the scene.
- No responsive/mobile layout work — out of scope for this pass.
- No change to `TrackMetadataPanel`, `ControlPointInspector`, `LeaderboardPanel`, or `TrackBrowser` beyond what's needed for color-token consistency if touched incidentally; restyling those panels in depth is a separate story.

## Decisions

- **CSS custom properties over inline styles or a CSS framework.** Add a small token set (`--panel-bg`, `--panel-border`, `--accent`, `--text-primary`, `--text-muted`, `--radius-md`, `--space-sm/md`) at `:root` or `.app-shell` scope in `App.css`. Rationale: the project already uses one global stylesheet with no CSS-in-JS/Tailwind present; custom properties let both the toolbar and HUD (different components) share values without a new dependency. Alternative considered: Tailwind utility classes — rejected, would require a new build-time dependency for a two-file styling pass.
- **Group via wrapper `<div>`s with semantic class names (`.toolbar-group--files`, `.toolbar-group--tools`, `.toolbar-group--nav`), not `<fieldset>`.** `<fieldset>` adds default browser border/padding that would need overriding anyway and has no form-semantic benefit here since these aren't a single form. Plain grouped divs keep markup simple and are invisible to existing tests (verified above — no structural queries).
- **Keep all `data-testid` values and element types unchanged.** This is the hard constraint from proposal.md; it means existing test files require zero edits. Verified by greping both `App.test.tsx` and `RaceScene.test.tsx` for structural/class-based queries — none exist.
- **Style toggle "pressed" state via the existing `aria-pressed` attribute as a CSS selector**, not a separate class. The components already set `aria-pressed`; adding `.toolbar button[aria-pressed="true"] { ... }` gets the visual state for free from existing markup/logic, with no JS change.
- **Reuse `.leaderboard-panel`'s panel look (translucent dark background, border-radius, padding) as the shared HUD panel style**, applied to `.race-hud`, `.camera-toggle`, and `.restart-button`, instead of inventing a second panel style. Keeps the HUD visually consistent with the one HUD element that's already somewhat styled.

## Risks / Trade-offs

- [Risk] Grouping toolbar controls into wrapper divs changes flex layout (row wrapping at narrow widths). → Mitigation: keep `.toolbar` as the outer flex container with `gap`, let groups be nested flex rows too; no fixed widths introduced, so existing wrap behavior at small viewports is preserved, not worsened.
- [Risk] Styling buttons by `[aria-pressed="true"]` could also match `start-race-button`/`share-track-button`/`save-track-button` if a future change adds `aria-pressed` to one of them for an unrelated reason. → Mitigation: scope the selector to the toolbar's tool-group wrapper (`.toolbar-group--tools button[aria-pressed="true"]`), not globally.
- [Risk] Making `start-race-button` visually "primary" could make it look enabled when `canRace` is false. → Mitigation: keep a distinct `:disabled` rule with reduced opacity/muted color that overrides the primary treatment, same pattern already implied by the existing `disabled` prop usage.
