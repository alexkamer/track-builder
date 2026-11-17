# Design

## Context

See proposal.md - Why. Relevant current state:

- `server/db.ts` defines `tracks(id, name, document, created_at)` with no ownership column, and `lap_times`.
- `server/index.ts` has `POST /api/tracks` (create/overwrite by id), `GET /api/tracks/:id`, lap time submission, and leaderboard routes. There is no list, rename, or delete route.
- The only identity concept in the system is the client-side anonymous session id from `src/domain/session/anonymousSession.ts` (`crypto.randomUUID()`, persisted in `localStorage`, never previously sent to the server). There is no password, token, or server-issued credential anywhere in the system — the leaderboard's `displayName` is already accepted as a trusted, unauthenticated client-supplied string, so this change's trust model is consistent with existing practice, not a new weakening of it.

## Goals / Non-Goals

**Goals:**
- Make saved tracks discoverable via a list endpoint and browse UI.
- Let the session that created a track rename or delete it.

**Non-Goals:**
- Real accounts, passwords, or server-issued auth tokens.
- Protecting against a malicious client that fabricates another session's id (see Risks).
- Pagination/search/sorting UI for the track list (small scale for now; can be added later without a spec change since it's not externally-observable *required* behavior).

## Decisions

**Ownership is the client-supplied `creatorSessionId`, stored verbatim.**
`POST /api/tracks` will accept an optional `creatorSessionId` field. On first insert of a given track id, the server stores it as `creator_session_id`. On `PATCH`/`DELETE`, the client sends the same session id (e.g. as a header or body field), and the server rejects the request with 403 if it doesn't match the stored value (or if the track has no stored creator, e.g. a track saved before this change — treat it as unowned and reject rename/delete rather than guessing an owner).
- *Alternative considered*: server-generated signed ownership token returned at save time. Rejected as disproportionate — it still reduces to "whoever holds the token," no different in trust strength from a session id, but adds token issuance/storage complexity for no real security gain given there's no account system to tie it to.
- *Alternative considered*: no ownership check at all (anyone can rename/delete anything). Rejected — the proposal explicitly asks for creator-scoped rename/delete, and an unscoped version invites accidental or malicious destruction of others' tracks.

**`creatorSessionId` is immutable after first save.** `POST /api/tracks` already supports upsert-by-id for editing a track's content; it must not let a caller change `creator_session_id` on an existing row (the `ON CONFLICT` update must omit that column), otherwise anyone could silently reassign ownership by re-posting a track id with a different session id.

**New list endpoint `GET /api/tracks` returns only `id`, `name`, `created_at`** (not the full `document`), since the browse view only needs enough to show a list and link to each track; full documents stay behind `GET /api/tracks/:id` as today.

**`creator_session_id` is a nullable column**, added via `ALTER TABLE` in `db.ts`'s existing `CREATE TABLE IF NOT EXISTS` bootstrap style (the project has no migration framework — schema changes are additive `ALTER TABLE ... ADD COLUMN` statements guarded to not error if already applied, consistent with how `db.ts` is structured today). Existing rows get `NULL`, which the rename/delete handlers treat as "no creator on file" → reject.

## Risks / Trade-offs

- **Spoofable ownership** → Anyone who can read or guess another browser's `localStorage` session id (or anyone, since the id is sent client-to-server with no secret binding it to a specific browser) can rename/delete that user's tracks. Mitigation: this is an explicit, documented limitation consistent with the project's existing anonymous-session trust model (display names are equally spoofable). No further mitigation in this change; real protection requires real auth, which is out of scope.
- **Pre-existing tracks have no creator** → Tracks saved before this change ships have `creator_session_id = NULL` and become permanently un-renameable/un-deletable via the UI. Mitigation: acceptable for this project's scale; noted here rather than silently worked around (e.g. no "adopt orphaned track" feature is being added).
- **Full table scan on `GET /api/tracks`** → Fine at current scale (no pagination needed); revisit if track count grows large enough to matter.

## Migration Plan

1. Add `creator_session_id TEXT` nullable column to `tracks` in `server/db.ts`.
2. Add `GET /api/tracks`, `PATCH /api/tracks/:id`, `DELETE /api/tracks/:id` to `server/index.ts`; update `POST /api/tracks` to accept and store `creatorSessionId` on insert only.
3. Update the client save call to send the local anonymous session id as `creatorSessionId`.
4. Add the browse view and rename/delete controls, gated on `localStorage` session id matching a track's (otherwise-untrusted) reported creator.

No rollback complexity beyond normal revert — the new column is additive and nullable, so rolling back the server code leaves the column unused but harmless.
