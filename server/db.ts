import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const DB_PATH = process.env.TRACKFORGE_DB_PATH ?? './data/trackforge.sqlite'
mkdirSync(dirname(DB_PATH), { recursive: true })

export const db = new DatabaseSync(DB_PATH)

db.exec(`
  CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    document TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS lap_times (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id TEXT NOT NULL,
    display_name TEXT,
    time_ticks INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (track_id) REFERENCES tracks(id)
  );

  CREATE INDEX IF NOT EXISTS idx_lap_times_track ON lap_times(track_id, time_ticks);
`)

try {
  db.exec('ALTER TABLE tracks ADD COLUMN creator_session_id TEXT')
} catch (err) {
  if (!(err instanceof Error) || !err.message.includes('duplicate column name')) throw err
}
