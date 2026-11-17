import type { TrackDocument } from '../domain/track/schema'
import type { CarInput } from '../domain/physics/carPhysics'
import { getOrCreateSessionId } from '../domain/session/anonymousSession'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3001'

export interface CreateTrackResponse {
  id: string
  shareUrl: string
  document: TrackDocument
}

export async function shareTrack(doc: TrackDocument): Promise<CreateTrackResponse> {
  const res = await fetch(`${API_BASE}/api/tracks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...doc, creatorSessionId: getOrCreateSessionId() }),
  })
  if (!res.ok) throw new Error(`Failed to share track: ${res.status}`)
  return res.json()
}

export interface TrackSummary {
  id: string
  name: string
  createdAt: string
}

export async function listTracks(): Promise<TrackSummary[]> {
  const res = await fetch(`${API_BASE}/api/tracks`)
  if (!res.ok) throw new Error(`Failed to list tracks: ${res.status}`)
  const body = await res.json()
  return body.tracks
}

export async function renameTrack(id: string, name: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/tracks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, sessionId: getOrCreateSessionId() }),
  })
  if (!res.ok) throw new Error(`Failed to rename track: ${res.status}`)
}

export async function deleteTrack(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/tracks/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: getOrCreateSessionId() }),
  })
  if (!res.ok) throw new Error(`Failed to delete track: ${res.status}`)
}

export async function fetchSharedTrack(id: string): Promise<TrackDocument> {
  const res = await fetch(`${API_BASE}/api/tracks/${id}`)
  if (!res.ok) throw new Error(`Failed to fetch track: ${res.status}`)
  const body = await res.json()
  return body.document
}

export interface SubmitLapResponse {
  accepted: boolean
  timeTicks?: number
  error?: string
}

export async function submitLapTime(
  trackId: string,
  displayName: string,
  inputLog: CarInput[],
): Promise<SubmitLapResponse> {
  const res = await fetch(`${API_BASE}/api/tracks/${trackId}/laptimes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName, inputLog }),
  })
  return res.json()
}

export interface LeaderboardEntry {
  displayName: string
  timeTicks: number
}

export async function fetchLeaderboard(trackId: string): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${API_BASE}/api/tracks/${trackId}/leaderboard`)
  if (!res.ok) throw new Error(`Failed to fetch leaderboard: ${res.status}`)
  const body = await res.json()
  return body.leaderboard
}
