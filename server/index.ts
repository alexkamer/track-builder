import express from 'express'
import { randomUUID } from 'node:crypto'
import { db } from './db.ts'
import { createTrackDocument, type TrackDocument } from '../src/domain/track/schema.ts'
import { generateTrack } from '../src/domain/generation/generateTrack.ts'
import { validateTrack } from '../src/domain/track/validation.ts'
import { replayInputLog } from '../src/domain/race/replayVerification.ts'
import type { CarInput } from '../src/domain/physics/carPhysics.ts'

const app = express()
app.use(express.json({ limit: '2mb' }))
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

const PORT = Number(process.env.PORT ?? 3001)

interface TrackRow {
  id: string
  name: string
  document: string
  created_at: string
}

interface LapTimeRow {
  display_name: string | null
  time_ticks: number
}

app.post('/api/tracks', (req, res) => {
  const incoming = req.body as Partial<TrackDocument>
  if (!incoming || !Array.isArray(incoming.controlPoints)) {
    return res.status(400).json({ error: 'A track document with controlPoints is required.' })
  }

  const doc: TrackDocument = createTrackDocument({
    ...incoming,
    id: incoming.id || randomUUID(),
  })

  const errors = validateTrack(doc)
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Track failed validation.', details: errors })
  }

  const stmt = db.prepare(
    `INSERT INTO tracks (id, name, document, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, document = excluded.document`,
  )
  stmt.run(doc.id, doc.name, JSON.stringify(doc), new Date().toISOString())

  res.status(201).json({ id: doc.id, shareUrl: `/track/${doc.id}`, document: doc })
})

app.get('/api/tracks/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id) as TrackRow | undefined
  if (!row) return res.status(404).json({ error: 'Track not found.' })
  res.json({ document: JSON.parse(row.document) as TrackDocument })
})

app.post('/api/tracks/:id/laptimes', (req, res) => {
  const row = db.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id) as TrackRow | undefined
  if (!row) return res.status(404).json({ error: 'Track not found.' })

  const { displayName, inputLog } = req.body as { displayName?: string; inputLog?: CarInput[] }
  if (!Array.isArray(inputLog) || inputLog.length === 0) {
    return res.status(400).json({ error: 'A non-empty inputLog is required.' })
  }

  const doc = JSON.parse(row.document) as TrackDocument
  const generated = generateTrack(doc)
  const result = replayInputLog(doc, generated, inputLog)

  if (!result.valid || result.lapTicks === null) {
    return res.status(400).json({ accepted: false, error: 'Replay did not produce a valid lap.' })
  }

  db.prepare(
    'INSERT INTO lap_times (track_id, display_name, time_ticks, created_at) VALUES (?, ?, ?, ?)',
  ).run(row.id, displayName?.trim() || null, result.lapTicks, new Date().toISOString())

  res.status(201).json({ accepted: true, timeTicks: result.lapTicks })
})

app.get('/api/tracks/:id/leaderboard', (req, res) => {
  const row = db.prepare('SELECT id FROM tracks WHERE id = ?').get(req.params.id) as { id: string } | undefined
  if (!row) return res.status(404).json({ error: 'Track not found.' })

  const entries = db
    .prepare('SELECT display_name, time_ticks FROM lap_times WHERE track_id = ? ORDER BY time_ticks ASC')
    .all(row.id) as unknown as LapTimeRow[]

  res.json({
    leaderboard: entries.map((e) => ({
      displayName: e.display_name ?? 'Anonymous',
      timeTicks: e.time_ticks,
    })),
  })
})

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Trackforge server listening on port ${PORT}`)
  })
}

export { app }
