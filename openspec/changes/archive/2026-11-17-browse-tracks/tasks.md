# Tasks

## 1. Server: schema and creator attribution

- [x] 1.1 Add nullable `creator_session_id TEXT` column to `tracks` in `server/db.ts` via an `ALTER TABLE` guarded against already-applied (e.g. wrapped so a duplicate-column error is ignored), and verify a fresh DB and an existing DB file both start up without error.
- [x] 1.2 Update `POST /api/tracks` in `server/index.ts` to accept an optional `creatorSessionId` in the request body, store it as `creator_session_id` on insert, and ensure the `ON CONFLICT` upsert clause does NOT overwrite `creator_session_id` on existing rows; verify with a test that re-saving an existing track id with a different `creatorSessionId` leaves the original creator unchanged.
- [x] 1.3 Update `src/api/client.ts`'s `shareTrack` to send the local anonymous session id (from `getOrCreateSessionId()` in `src/domain/session/anonymousSession.ts`) as `creatorSessionId`, and verify via a unit test that the POST body includes it.

## 2. Server: list, rename, delete endpoints

- [x] 2.1 Add `GET /api/tracks` to `server/index.ts` returning `{ id, name, createdAt }` for every row (no `document`), ordered by `created_at` descending; verify with a test that it returns all saved tracks without needing their ids.
- [x] 2.2 Add `PATCH /api/tracks/:id` accepting `{ name, sessionId }`, returning 404 if the track doesn't exist, 403 if `sessionId` doesn't match the stored `creator_session_id` (including when it is `NULL`), and otherwise updating `name`; verify with tests covering: creator rename succeeds, non-creator rename rejected with 403, rename of a track with no stored creator rejected.
- [x] 2.3 Add `DELETE /api/tracks/:id` accepting `{ sessionId }` (body or query), with the same 404/403 authorization rules as 2.2, removing the row from `tracks` (and its `lap_times` rows) on success; verify with tests covering: creator delete succeeds and the track then 404s at `GET /api/tracks/:id`, non-creator delete rejected with 403 and the track still resolves.

## 3. Client: API bindings

- [x] 3.1 Add `listTracks()`, `renameTrack(id, name)`, and `deleteTrack(id)` functions to `src/api/client.ts`, each sending the local anonymous session id where required by the server contract from Section 2; verify with unit tests mocking `fetch` for success and 403 responses.

## 4. Client: browse view

- [x] 4.1 Add a `TrackBrowser` component (`src/components/TrackBrowser.tsx`) that calls `listTracks()` on mount and renders each track's name and saved date with a way to open it (e.g. navigating into the existing share/load flow); verify with a component test that it renders a fetched list and an "open" action per row.
- [x] 4.2 Since the list response from 2.1 only returns id/name/createdAt (not `creator_session_id`), show rename and delete controls only for track ids this browser has locally recorded as self-created (mirroring `savedTracks`/`listSavedTracks()` in `src/domain/track/trackStorage.ts`), rather than trusting any server-sent ownership flag; verify with a test that rename/delete controls appear only for locally-known-created track ids and are absent for others.
- [x] 4.3 Wire rename (inline edit calling `renameTrack`, refreshing the list on success) and delete (confirm-then-call `deleteTrack`, removing the row from the list on success) in `TrackBrowser`; verify with tests covering successful rename, successful delete, and a rejected (403) rename/delete surfacing an error without changing the list.
- [x] 4.4 Add a `'browse'` app mode to `src/App.tsx` alongside existing `'edit'`/`'race'` modes, with a button to enter it and a way to open a selected track back into the editor (loading it via `fetchSharedTrack`); verify manually and with an `App.test.tsx` case that navigating to browse mode and back preserves editor state.

## 5. Integration verification

- [x] 5.1 Run the full server and client test suites and confirm they pass, then manually exercise: save a track, see it in browse, rename it, delete it, and confirm a second browser session (e.g. clearing `localStorage`) cannot rename/delete it.

## Workflow follow-up

- Archive the change after review and merge, syncing the `track-library` and `sharing-and-leaderboards` deltas into `openspec/specs/`.
