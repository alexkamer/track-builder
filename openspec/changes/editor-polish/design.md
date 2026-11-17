# Design

## Context

`TrackEditor2D` (`src/components/TrackEditor2D.tsx`) owns its own `ViewTransform` (`zoom`, `panX`, `panY`) as local `useState`, initialized once to `{ zoom: 1, panX: 0, panY: 0 }` and never reset. `LiveTrackPreview3D` (`src/components/LiveTrackPreview3D.tsx`) already has a `CameraFraming` component that recomputes centroid/bounding radius and repositions the camera in a `useEffect` keyed on `roadMesh`, which changes on every doc change including loads — so the 3D half of requirement 1 is effectively already implemented; this change adds an explicit scenario/test for the load case rather than new camera logic.

Track loads happen in `App.tsx` via `loadTrack(doc)`, which dispatches `{ type: 'LOAD', state: doc }` to the history reducer (`src/domain/track/history.ts`), replacing `state.present` wholesale (no `past`/`future` entry). There are three load sites: preset `<select>`, saved-track `<select>`, and the shared-track fetch in the initial `useEffect`.

The reducer (`src/domain/track/editorReducer.ts`) already has `DELETE_POINT`, `MOVE_POINT`, etc. There is no action for metadata; `metadata.author`/`description` exist on `TrackDocument` (`src/domain/track/schema.ts`) but nothing writes them.

Selection state (`selectedIndex`) lives in `App.tsx`, not in the reducer, and is passed down to `TrackEditor2D` and `ControlPointInspector`.

## Goals / Non-Goals

**Goals:**
- Reset the 2D view transform and 3D camera to fit the track's bounds on every load, without affecting zoom/pan during normal editing (adding/moving/deleting points mid-session should not re-fit the view).
- Give delete-point a discoverable UI control and a keyboard shortcut, reusing `DELETE_POINT` as-is.
- Add global undo/redo/delete keyboard shortcuts that call the exact same handlers as the existing Undo/Redo buttons and the new delete control, so behavior (including the 3-point floor) is defined once.
- Add a minimal metadata editing UI (two text inputs) wired through a new reducer action so edits are undoable like any other change.

**Non-Goals:**
- Changing the curve/mesh generation, validation rules, or history/undo data structures themselves.
- Auto-fitting in response to edits that change the track's extent (e.g., dragging a point far outside the current view) — only on load, per the proposal.
- Rich metadata editing (validation, length limits, markdown, etc.) — plain text inputs mapping 1:1 to the schema fields.

## Decisions

**Auto-fit trigger: derive from `doc` identity change via a load-counter/id, not from `useEffect` on every render.** `TrackEditor2D` cannot distinguish "doc changed because of a load" from "doc changed because of an edit" just by looking at `doc` — both replace the object. Expose a cheap, stable signal from `useTrackEditorHistory`: increment a `loadVersion` counter (or reuse `doc.id` + `doc.createdAt`, which change on load/preset-select but not on in-place edits) and pass it as a prop so `TrackEditor2D` can `useEffect` on that signal specifically to recompute `view`. `LiveTrackPreview3D`'s existing `CameraFraming` already keys off `roadMesh`, which already satisfies "reframe on load"; add a test asserting this rather than restructuring it. Alternative considered: re-fit on every `doc.controlPoints` change — rejected because it would also re-fit during normal point-dragging/adding, fighting the "zoom/pan don't alter and aren't altered by data edits" expectation implicit in the existing zoom/pan requirement.

**Fit computation: bounding box of control points with padding, mapped to canvas width/height.** Compute `minX/maxX/minZ/maxZ` over `doc.controlPoints`, add a fixed padding margin, then derive `zoom = min(width / boxWidth, height / boxHeight)` clamped to `[MIN_ZOOM, MAX_ZOOM]`, and `panX/panY` to center the box. Degenerate case (fewer than 2 distinct points, or zero-size box) falls back to the current default `{ zoom: 1, panX: 0, panY: 0 }`.

**Delete control placement: a button in `ControlPointInspector`, not a new toolbar button.** The inspector already renders only when a point is selected and already edits that point's fields, so "delete this point" reads naturally there and avoids adding always-visible-but-usually-disabled toolbar chrome. The keyboard shortcut is independent of this and lives in `App.tsx`.

**Keyboard shortcuts: a single `useEffect` with a `keydown` listener in `App.tsx`, guarded by focus target.** Shortcuts must not fire while the user is typing in the save-name, author, or description inputs. Guard by checking `event.target` against `HTMLInputElement`/`HTMLTextAreaElement` (consistent with how `useKeyboardCarInput.ts` already scopes key handling elsewhere in the app). Mac vs. Windows/Linux modifier (`metaKey` vs `ctrlKey`) is handled by checking `event.metaKey || event.ctrlKey`.

**Metadata action: new `SET_METADATA` reducer action taking a partial `TrackMetadata`.** Mirrors the existing per-field actions' shape (`{ type: 'SET_METADATA'; metadata: Partial<TrackMetadata> }`) merged into `doc.metadata`, rather than two separate `SET_AUTHOR`/`SET_DESCRIPTION` actions, since both fields are edited via the same small form and a combined action keeps the reducer surface smaller. Dispatched with `{ transient: true }` while typing and `commit()` on blur, matching the existing drag-to-move pattern, so every keystroke doesn't create a separate undo step.

## Risks / Trade-offs

- [Risk] A load-counter prop adds a bit of plumbing through `useTrackEditorHistory` → `App.tsx` → `TrackEditor2D`/`LiveTrackPreview3D`. → Mitigation: reuse `doc.id`/`doc.createdAt` (already present, already change on load) instead of adding new state, if they prove sufficient; only add a counter if some load path doesn't change either field.
- [Risk] Auto-fit on load could feel jarring if the user had deliberately zoomed into a saved track before saving again (save doesn't reset the view, only load does) → Mitigation: this matches the proposal's explicit scope (fit on load only) and is the behavior being requested; not treated as a defect here.
- [Risk] Keyboard shortcuts could conflict with browser/OS shortcuts (e.g., Ctrl+Y is "redo" in some browsers already, but also sometimes bound to history/bookmarks). → Mitigation: `preventDefault()` on the handled key combinations within the editor; scenario coverage only requires the app-level behavior, not cross-browser default suppression elsewhere.

## Migration Plan

Additive UI/behavior change with one new reducer action; no stored-track schema or serialization changes. No migration steps needed; existing saved/shared tracks load unaffected (metadata already defaults to `{}`).
