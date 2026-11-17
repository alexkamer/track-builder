import type { TrackDocument } from './schema'
import { deserializeTrack, serializeTrack } from './serialization'

const STORAGE_PREFIX = 'trackforge:track:'
const INDEX_KEY = 'trackforge:track-index'

function trackKey(id: string): string {
  return `${STORAGE_PREFIX}${id}`
}

function generateTrackId(): string {
  return `track-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function saveTrack(doc: TrackDocument, name: string): TrackDocument {
  const id = doc.id || generateTrackId()
  const toSave: TrackDocument = { ...doc, id, name }
  localStorage.setItem(trackKey(id), serializeTrack(toSave))

  const index: string[] = JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]')
  if (!index.includes(id)) {
    index.push(id)
    localStorage.setItem(INDEX_KEY, JSON.stringify(index))
  }

  return toSave
}

export function loadTrack(id: string): TrackDocument | null {
  const json = localStorage.getItem(trackKey(id))
  return json ? deserializeTrack(json) : null
}

export interface SavedTrackSummary {
  id: string
  name: string
}

export function listSavedTracks(): SavedTrackSummary[] {
  const index: string[] = JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]')
  return index
    .map((id) => loadTrack(id))
    .filter((doc): doc is TrackDocument => doc !== null)
    .map((doc) => ({ id: doc.id, name: doc.name }))
}
