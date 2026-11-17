# Proposal

## Why

Today a saved track can only be opened by someone who already has its exact share URL (`GET /api/tracks/:id`). There is no way to discover tracks that exist on the server, and no way for the person who created a track to rename or remove it later. This makes tracks effectively "write-only" once their URL is lost, and leaves no cleanup path for abandoned or mistakenly-named tracks.

## What Changes

- Add a `GET /api/tracks` list endpoint that returns all saved tracks (id, name, created_at) so they are discoverable without their share URL.
- Add a browse view in the client that lists tracks from that endpoint and lets the user open any of them.
- Record which anonymous session created each track (`creatorSessionId` sent by the client on save, stored on the `tracks` row).
- Add `PATCH /api/tracks/:id` (rename) and `DELETE /api/tracks/:id` endpoints, authorized by comparing the caller's session id against the stored `creatorSessionId`.
- Add rename and delete controls to the browse view, shown only for tracks the current browser session created.
- **BREAKING**: none — existing `POST /api/tracks` and `GET /api/tracks/:id` behavior is preserved; `creatorSessionId` is an additive, optional field.

Explicitly out of scope: real accounts/authentication. Ownership stays scoped to the existing anonymous, client-supplied session id, which is a trust model already used for leaderboard display names. This means rename/delete authorization is spoofable by anyone who sends a matching session id — this tradeoff is recorded in `design.md`.

## Capabilities

### New Capabilities
- `track-library`: Browsing the set of saved tracks, and renaming or deleting a track you created, scoped to anonymous creator sessions.

### Modified Capabilities
- `sharing-and-leaderboards`: The "Save and load tracks losslessly" / track persistence requirement must additionally record the creating anonymous session so later ownership checks (rename/delete) have something to check against.

## Impact

- `server/db.ts`: add `creator_session_id` column to `tracks` table.
- `server/index.ts`: new `GET /api/tracks`, `PATCH /api/tracks/:id`, `DELETE /api/tracks/:id` routes; `POST /api/tracks` accepts and stores `creatorSessionId`.
- `src/domain/session/anonymousSession.ts`: no change in shape, but its session id is now also sent to the server on save/rename/delete.
- Client: new browse view/route, plus UI for rename/delete gated on session ownership.
