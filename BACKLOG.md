# Backlog

Candidate stories not yet promoted to an OpenSpec change. Pick one and run
`/openspec-propose` (or `opsx propose`) when ready to start it.

_Empty._

The previous entry, "Visual design pass on Menu and Race UI", has been delivered and was
removed: `editor-shell-redesign` grouped the editor toolbar into labelled groups
(`.toolbar-group` in `EditorToolbar.tsx`), gave primary actions visual priority, and moved the
validation summary beside **Start Race**; the race HUD, stats readout, camera switcher and
restart button are all styled as overlays (`.race-hud`, `.stats-hud`, `.camera-toggle`,
`.restart-button` in `App.css`).

## Known candidate, not yet written up

**A redistributable car model.** `low-poly-car-model` deliberately shipped nothing: the real
geometry is a local developer-only option behind `?car=lowpoly` because the source pack cannot be
redistributed, so a clean checkout still renders the primitive car built from boxes and
cylinders. The reusable parts now exist — the `CarModelHandle` contract, per-role PBR materials
driven by the `color`/`opacity` props, a per-source wheel radius, and a fallback path — so
adopting a CC0 model is a small job rather than a project. The open question is which direction:
a CC0 pack (Kenney's car kit is the obvious candidate, and ships real materials, so the
atlas-tile role inference would not be needed; note `kenney.nl` returns 403 to scripted
downloads, so the archive has to be fetched by hand) or a richer procedural car in code (no
downloads and no licence questions, lower ceiling). To be planned.
